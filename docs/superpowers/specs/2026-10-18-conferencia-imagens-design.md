# Conferência de imagens das questões

Data: 2026-10-18 · Status: desenho conversado no brainstorming, aguardando aprovação do Peter

## Objetivo

Questões importadas de PDF chegam ao banco **sem a figura** que a prova original tem, e nada avisa.
Exemplo real: UFMS 2024 tem 60 questões, todas ligadas à página do caderno (27 páginas guardadas),
mas só 6 têm imagem. Não dá para descobrir pelo texto quais deveriam ter (só 3 citam
"figura/gráfico/tabela"). O Peter quer **conferir pessoalmente, uma a uma, com a página original ao
lado**, e consertar ali mesmo, do jeito mais rápido possível.

"O meu problema hoje chama-se imagem." Sucesso = o Peter percorre uma prova importada, completa as
figuras que faltam sem sair da tela, e nenhuma questão sem figura cai em simulado novo.

## Decisões tomadas

| Tema | Decisão | De quem |
|---|---|---|
| Como achar as questões sem figura | **Conferência pessoal, uma a uma, com a página original ao lado** (não usar IA de novo, não adivinhar pelo texto) | Peter |
| Onde | Na tela que já existe `/banco/importacoes/[id]/revisar` (lista · página · editor), ampliada | Claude |
| Recortar do caderno | Botão **"✂ Recortar figura"**: arrastar um retângulo na página e escolher o destino (enunciado ou A–E). Navegar para a página anterior/seguinte da mesma importação (figura que ficou em outra página) | Peter (ideia), Claude (navegação) |
| Imagem de fora | Em cada espaço de imagem: **colar print (Ctrl+V)**, **arrastar arquivo** ou **escolher do computador** | Peter |
| Cortar o print colado | Antes de enviar, janela para **cortar o pedaço** que interessa (arrastar as bordas) | Peter |
| Desde a criação | Dá para pôr imagem **já ao criar** a questão (hoje só depois de salvar) | Peter |
| Posição da figura | Por imagem: **esquerda · centro (padrão) · direita**, respeitada em todas as telas | Peter |
| Estados na conferência | **○ a conferir · ✓ conferida · ⚠ falta imagem**, com filtros na lista | Claude (o Peter aprovou o desenho) |
| Questão com "falta imagem" | **Sai dos simulados e treinos novos** e fica separada para validação: volta para `revisao` com a marca `falta_imagem` | Peter |
| Prova em andamento ou já feita | A questão **continua nela** (tirar quebraria respostas e notas); o aluno vê o aviso no lugar da figura | Claude |
| ENEM (enem.dev) | Sem página original → só colar/arrastar/escolher do computador | Claude |

## Fora do escopo (próximos projetos)

- Tipo de letra, tamanho e alinhamento do **texto** da questão (barra estilo Word). Mexe em como todo
  texto é guardado (`markdownParaBlocos`); o Peter aceitou deixar para depois.
- Campo **assunto na aula** (para o "Revise isto" achar aulas sem depender do título).
- Pedir à IA para achar as figuras que faltaram.

## Não pode acontecer (anti-objetivos)

- Questão sumir de uma prova em andamento ou mudar a nota de quem já fez.
- Perder ou duplicar imagens que já existem (os 6 recortes da UFMS e os arquivos do ENEM).
- A conferência ficar mais lenta que hoje: abrir a próxima questão e recortar devem ser poucos cliques.

## 1. Banco de dados

SQL novo (o Peter cola no SQL Editor; anexar ao fim de `db/schema.sql`). Conferir no banco, com
consulta só de leitura, antes de publicar o código.

```sql
-- ===== Conferência de imagens (2026-10-18) =====
alter table questoes add column if not exists falta_imagem boolean not null default false;
alter table questoes add column if not exists conferida_em timestamptz;
alter table questao_imagens add column if not exists alinhamento varchar(8) not null default 'centro'
    check (alinhamento in ('esquerda', 'centro', 'direita'));
```

- `falta_imagem`: marcada pelo botão "⚠ Falta imagem"; limpa ao marcar "Conferida".
- `conferida_em`: quando o professor deu "✓ Conferida". Nulo = a conferir.
- Recorte de outra página não precisa de coluna nova: `questao_imagens.pagina_id` já aponta a página.

## 2. Regras

- **⚠ Falta imagem** → `status = 'revisao'`, `falta_imagem = true`, `conferida_em = null`. Como
  sorteio do treino, sorteio e escolha manual do professor só usam `status = 'publicada'`
  (`candidatosComMateria`, `src/actions/simulados.ts`), ela sai de tudo que é novo sem outra mudança.
- **✓ Conferida — próxima** → `falta_imagem = false`, `conferida_em = now()`, publica (mesma
  exigência de hoje: resposta certa marcada ou anulada) e abre a próxima "a conferir" do filtro atual.
- Provas existentes leem as questões pelo id, sem olhar `status` (`questoesParaAluno`): continuam
  funcionando. Questão com `falta_imagem` numa prova mostra no lugar da figura o mesmo aviso de
  "Imagem indisponível" (já existe em `ImagemQuestao`).
- Permissão: as mesmas de hoje para editar a questão (`exigirEditorQuestao`) e para importar
  (`podeImportar`).

## 3. Telas

### 3.1 Conferência (`/banco/importacoes/[id]/revisar`, ampliada)

Mockup aprovado: lista à esquerda, página original no meio, questão à direita.

- **Lista**: ícone por questão (○ / ✓ / ⚠) e filtros **A conferir · Falta imagem · Conferidas ·
  Todas** (mantém os filtros atuais "Precisa de revisão" e "Sem resposta"). Abre na primeira "a
  conferir".
- **Página original**: botões **◀ página anterior / página seguinte ▶** (só páginas `tipo = 'prova'`
  da mesma importação) e **"✂ Recortar figura"**: arrastar um retângulo novo, escolher o destino
  (Enunciado, A–E) e "Usar recorte" → cria `questao_imagens` tipo `recorte` com a `pagina_id` da página
  mostrada. Os recortes existentes continuam movíveis/redimensionáveis como hoje (`PaginaComQuadros`).
- **Questão**: o editor de hoje, com a nova área de imagem (3.2) e, no rodapé, **"⚠ Falta imagem"**
  e **"✓ Conferida — próxima"**. Questão com `falta_imagem` mostra o aviso vermelho no topo.
- Acesso: a tela já existe para importações em revisão; deve abrir também para importações
  `concluida` (é o caso da UFMS 2024).

### 3.2 Área de imagem do editor (todas as telas que usam `EditorQuestao`)

Para o enunciado e cada alternativa:

- Zona **"Cole um print (Ctrl+V) · arraste o arquivo aqui · escolher do computador"**. Ctrl+V vale
  quando o foco está na zona (ou no editor dessa parte).
- Ao receber a imagem: janela **Cortar** com a imagem inteira e um retângulo ajustável; "Usar" envia
  só o pedaço (PNG/JPG/WebP, até 5 MB, como hoje).
- Cada figura: miniatura, **posição ◧ ▣ ◨**, trocar e remover.
- **Questão nova**: as imagens ficam guardadas no navegador até "Criar questão"; aí a questão é criada
  e as imagens enviadas. A frase "Depois de criar, você pode adicionar imagens" sai de
  `/banco/nova`.

### 3.3 Exibição

`ImagemQuestao` respeita `alinhamento` (esquerda/centro/direita) na prova, no resultado, no banco e
no editor.

## 4. Testes

- Funções puras com teste (registrar no script `test`): regras de estado (marcar falta imagem /
  conferida → campos esperados), filtro e ordem da lista de conferência, navegação de páginas
  (anterior/seguinte só dentro da importação), cálculo do recorte em frações (reaproveitar
  `limitarQuadro`).
- Checagens de sempre: `tsc`, `npm test`, `npm run lint`, `npm run build`; prévia com prints em 1340
  e 390 px (roteiro da skill `status-visual-aluno`, mesmo sendo área do professor).

## 5. Restrições

- Partir da branch `feature/revisar-erros` (este projeto usa o novo `ImagemQuestao` dela).
- **Outra sessão está restilizando o `EditorQuestao`** (alterações não commitadas na pasta principal,
  branch `feature/editor-simulado-visual`). Antes de mexer no editor: buscar `origin/master`, rebase,
  e em conflito manter o visual dela e só acrescentar a área de imagem. Se ela redesenhou a mesma
  área, parar e perguntar ao Peter.
- Seguir o padrão visual do projeto (`DESIGN.md`, azul + dourado, sem texto cinza).

## 6. Decisões do Claude na revisão do documento

- **Como chegar à conferência**: a página da importação (`/banco/importacoes/[id]`) ganha o botão
  **"Conferir imagens"**, também quando a importação está `concluida`, com a contagem "48 a conferir".
- **Status da importação**: marcar "falta imagem" não reabre a importação (continua `concluida`); o
  filtro "Falta imagem" e a contagem no botão bastam.
- **Botões "Falta imagem" e "Conferida"** aparecem só na tela de conferência. No editor comum
  (`/banco/questoes/[id]`, `/banco/nova`) entra apenas a nova área de imagem (3.2) e o aviso vermelho
  quando a questão tem `falta_imagem`.

## 7. Deixado para quem construir

- Aparência exata da janela de cortar e da zona de soltar (seguindo o padrão visual).
- Se o recorte novo na página é desenhado com um modo "recortar" ligado/desligado ou direto.
- Ordem das imagens novas dentro do mesmo destino (acrescentar no fim, como hoje).
