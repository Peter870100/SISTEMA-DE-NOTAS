# Prova em Word com questões do banco (Hermes + site) — desenho

Data: 2026-10-31. Conversa com o Peter (dono). Continua a folha de tarefa
(`docs/superpowers/specs/2026-10-30-questoes-pela-assinatura-e-folha-tarefa-design.md`), que hoje só
roda como script local com questões escritas pelo Claude. Esta é a "etapa 2" daquela spec, agora
para os professores.

## Intenção

O professor manda um áudio para a Hermes ("faz uma prova com 10 questões de Biologia da UFMS") e
recebe no Telegram dois links: a prova do aluno em Word e o gabarito em Word. As questões são
**oficiais, do banco** (UFMS, UEMS, UFGD, ENEM…), já conferidas, **com as figuras** — sem elas a
questão não serve. A prova é só para imprimir: o aluno faz no papel, o professor corrige à mão pelo
gabarito; nada é lançado no site.

Cada prova gerada fica num **histórico do professor no site**, para baixar de novo, reaproveitar
("manda de novo a prova de Biologia de semana passada") sem gerar outra, ou saber o que já mandou —
sem depender do Telegram. O sistema evita repetir questões que o professor já usou.

Custo: nenhuma IA paga no caminho. Só os tokens da Hermes para entender o pedido.

## Metas

1. Motor que escolhe questões do banco, monta a prova e o gabarito em .docx (visual aprovado) com as
   figuras, e grava a prova no histórico.
2. **Parte 1 — Hermes**: ferramentas MCP para prévia (inéditas), gerar, listar o histórico e
   reenviar links. Professor (`/api/mcp`, pelo telefone) e dono (`/api/mcp/dono`).
3. **Parte 2 — site**: página "Provas em Word" com o histórico (baixar prova, baixar gabarito,
   excluir, limpar tudo) e um formulário para gerar uma prova nova com a mesma prévia de inéditas.

Ordem de entrega: motor + Parte 1 primeiro; Parte 2 logo depois (o histórico no site pode vir junto da
Parte 1 se ficar barato, porque os links já precisam da rota de download).

## Fora do escopo

- Criar questões novas (IA ou `salvar_questoes`) — fica para depois.
- Prova impressa ligada a simulado online, lançamento de notas, correção automática.
- Envio por e-mail (domínio do Resend não verificado).
- Mandar o arquivo anexado no Telegram (só links; pode vir depois se a Hermes suportar).
- Escolher questão por questão (o sistema sorteia pelo filtro; ver "trocar" abaixo como opcional).

## Não pode acontecer (anti-metas)

- Questão sem a figura, ou com figura errada/cortada, na prova. Melhor ficar de fora do que sair
  quebrada.
- Questão em revisão, anulada ou sem resposta na prova.
- Professor de uma escola ver/baixar prova de outro professor ou de outra escola.
- Link de download que vence e deixa o professor na mão (o histórico promete reaproveitar).
- Mudar o visual aprovado da folha (ver abaixo) sem o Peter pedir.

## Como funciona (decidido com o Peter)

### Pedido pela Hermes

1. Professor pede por áudio/texto: matéria, banca, quantidade; às vezes ano, assunto e o tipo.
2. **Antes de montar, a Hermes sempre explica o cenário de inéditas e pergunta**, numa mensagem só:
   > "De Biologia da UFMS há 74 questões; você já usou 18, restam **56 inéditas**. Monto as 10 só com
   > inéditas? É **atividade de fixação** ou **simulado**?"
   - Se o professor já disse o tipo no áudio, não pergunta o tipo de novo.
   - Se não há inéditas suficientes: "Só restam 6 inéditas. Completo com 4 já usadas, ou faço uma
     prova com 6?"
3. Com a resposta, gera e devolve os dois links (prova e gabarito).
4. "Manda de novo aquela prova de…" → a Hermes busca no histórico, mostra as candidatas se houver mais
   de uma, e reenvia os links **sem gerar outra prova**.

Essas regras de conversa vão nas descrições das ferramentas MCP (a Hermes segue o que a ferramenta
diz), para não depender de mexer no SOUL.md do VPS.

### Título

Composto pelo tipo + matéria (+ assunto, se o pedido teve assunto):
"Atividade de Fixação – Biologia", "Simulado – Biologia · Genética". O tipo é **fixação** ou
**simulado**. O título aparece na faixa da matéria da folha e no histórico.

### Regra das inéditas (decidido)

- Conta **por professor**: uma questão é "usada" se já saiu em qualquer prova em Word gerada por
  aquele professor (Hermes ou site).
- Padrão: só inéditas. Se faltarem, o professor escolhe (completar com usadas ou prova menor). Pode
  dizer "pode repetir" para desligar a regra.
- **Excluir uma prova do histórico (ou "limpar tudo") não devolve as questões às inéditas**: some da
  tela, mas o sistema continua lembrando que foram usadas. Por isso a exclusão é lógica (marca de
  excluída), não apaga as linhas de uso.
- Questões usadas em simulados online não contam (são coisas separadas).

### Quais questões entram

Só questões que o professor pode usar (banco geral + da escola dele), **publicadas**, não anuladas,
com resposta, sem `falta_imagem` e sem `precisa_revisao`. Filtros iguais aos do sorteio de simulado
(`src/lib/mcp/acoes/simulados.ts`, `FiltrosSorteio` em `src/lib/simulados/servidor.ts`): banca, ano
de/até, área, matéria, assunto. Escolha aleatória entre as elegíveis.

### Arquivos e links

- **O Word é montado na hora do download**, a partir da lista de questões guardada (ordem fixa). Não se
  guarda o .docx. Assim o link nunca vence e o armazenamento não cresce. (Chamada minha; o Peter
  aceitou.) Consequência aceita: se uma questão for editada no banco depois, a prova baixada de novo
  sai com o texto corrigido.
- Se uma questão da prova foi para a lixeira depois, a prova sai sem ela e o arquivo traz um aviso
  discreto no fim (ou a Hermes avisa) — decisão do construtor como mostrar.
- **Links para o Telegram** abrem sem login (o professor toca no celular): URL com um código assinado
  pelo servidor (HMAC do id da prova). Sem data de validade. Preferência: não criar variável de
  ambiente nova (o Peter teria que cadastrar na Vercel); derivar de um segredo que já existe.
  Excluir a prova do histórico **invalida os links** dela.
- No site, o download usa a sessão do professor (sem código).

### Visual (aprovado, não mudar)

O mesmo de `src/lib/folha/docx.ts` aprovado pelo Peter em 2026-10-31 ("AMEI"): cabeçalho compacto
(logo pequeno + fio azul 0E3562, linhas Aluno/Nº/Turma e Professor/Data/Nota), faixa da matéria com o
título, duas colunas, "QUESTÃO NN" em negrito 10,5 + faixa cinza + linha preta, alternativas com
bolinha preta e letra branca (PNG em `public/folha/`), texto das questões e do gabarito em Arial 9.
Gabarito em arquivo separado.

Novidades que o visual precisa ganhar (a etapa 2 da folha):
- **Figuras** das questões, na posição em que aparecem no conteúdo, com largura máxima da coluna e
  proporção mantida. Figuras de recorte (`questao_imagens.tipo = 'recorte'`) são recortadas da imagem
  da página (`importacao_paginas.storage_path`, bucket `questoes`) com sharp; `tipo = 'arquivo'` vem
  direto do bucket. Figuras de alternativa (`alvo` A–E) aparecem na alternativa, ao lado da bolinha.
- **Conteúdo formatado** (`questoes.conteudo`, JSON TipTap — ver `src/lib/questoes/conteudo.ts` e
  `src/components/questoes/ConteudoQuestao.tsx`): negrito, itálico, sublinhado, sub/sobrescrito,
  alinhamento, recuo, linha horizontal, caixa, figura com legenda. Questão sem `conteudo` usa o
  texto antigo (`enunciado`/`comando`, como hoje).
- Créditos/fonte da questão como já faz a folha atual (`separarCredito`), e a origem da questão
  ("UFMS 2024") discreta junto ao número ou ao crédito — chamada do construtor.
- **Logo (decidido pelo Peter): o da Status**, `public/logo-folha.png` (o da folha aprovada). O
  `logo_url` das escolas é branco (feito para o topo azul do site) e some no papel: não usar. O foco
  agora é só a Status; uma prova de outra escola sai com o nome da escola no cabeçalho e sem logo
  (sem campo novo de logo por escola por enquanto).
- **Tipo fixação/simulado muda só o título** (decidido): mesmo cabeçalho, mesmo gabarito.
- **Gabarito**: letra certa de cada questão; quando houver `resolucao`, mostra como hoje. Questões
  oficiais quase nunca têm resolução, então o gabarito costuma ser só a grade de letras.

### Histórico no site (Parte 2)

Página "Provas em Word" (perto do Banco de questões; rota e menu a critério do construtor), só com as
provas do professor logado: data, título, banca/filtro, nº de questões, origem (Telegram/site), botões
Baixar prova, Baixar gabarito, Excluir, e "Limpar tudo" com confirmação. Formulário "Nova prova":
banca, matéria, assunto, ano, quantidade, tipo; mostra a prévia de inéditas antes de gerar, com as
mesmas escolhas da Hermes. Seguir o padrão visual das telas do professor (não é tela do aluno).

## Dados (SQL manual, colar no SQL Editor)

Proposta (o construtor ajusta nomes/índices, mantendo a ideia):

- `provas_word`: id, escola_id, professor_id, titulo, tipo (`fixacao`|`simulado`), filtros (jsonb, o
  pedido como veio), origem (`hermes`|`site`), created_at, excluida_em (null = visível).
- `prova_word_questoes`: prova_id, questao_id, ordem. Chave (prova_id, questao_id). É desta tabela
  (juntando provas do professor, inclusive excluídas) que saem as "usadas".
- `prova_word_questoes.questao_id` **sem chave estrangeira** (chamada minha): mandar uma questão para a
  lixeira apaga a linha de `questoes` (`lixeira_excluir` copia e apaga), e com cascade o sistema
  perderia que ela estava na prova e que foi usada. Sem a FK, a prova sabe que falta uma questão (e
  avisa), e uma questão restaurada da lixeira continua contando como usada.
- RLS no mesmo modelo das outras tabelas (acesso pelo servidor).

Antes de publicar código que usa as tabelas, conferir no banco (só leitura) que o SQL foi colado.

## Ferramentas MCP (Parte 1)

Nos dois MCPs (professor pelo telefone; dono). Nomes sugeridos, o construtor pode ajustar:

- `previa_prova_word` — filtros + quantidade → total elegível, quantas o professor já usou, quantas
  inéditas, e se a quantidade pedida cabe só em inéditas. A descrição manda a Hermes mostrar isso e
  perguntar (inéditas/completar/menor + tipo se faltar) **antes** de gerar.
- `gerar_prova_word` — filtros, quantidade, tipo, `permitir_repetidas` → grava a prova e devolve
  título, nº de questões (e quantas repetidas, se houver) e os dois links.
- `listar_provas_word` — histórico do professor (não excluídas), com busca opcional por texto/matéria
  e período; devolve id, data, título, nº de questões.
- `links_prova_word` — id → os dois links de novo.

No MCP do dono, a prova é do dono como professor (a conta do Peter, papel `dono`) e da escola indicada
(ou a dele). As "usadas" do dono contam por ele em todas as escolas, e o histórico dele mostra todas,
com o nome da escola em cada prova (chamada minha). Seguir o padrão de `escolaParaCriar`/`atorDoEscopo` em `src/lib/mcp/acoes/`. Registrar as
ações em `hermes_registro` como as outras ferramentas de escrita.

## Restrições

- Next.js 16.2 (ler `node_modules/next/dist/docs/` antes de rota nova), Vercel. Geração de uma prova
  de até ~40 questões com figuras precisa caber no tempo da função (usar `maxDuration` se preciso).
- `docx` hoje está em devDependencies: passa para dependencies. `sharp` já está instalado (via Next);
  declarar explicitamente se for usado no servidor.
- Reaproveitar `src/lib/folha/docx.ts` (não criar um segundo gerador). O script
  `scripts/folha-tarefa.ts` deve continuar funcionando.
- Quantidade por prova: 1 a 60 (chamada minha).
- Fluxo do projeto: worktree, testes `npm test`, `npm run lint`, `npm run build`, push no `master`.

## Deixado ao construtor

Rotas e nomes de arquivos, como pôr figuras no .docx (ImageRun inline, tamanho em EMU), como mostrar
questão que sumiu do banco, forma exata do código assinado do link, layout da página do histórico,
ordem das questões na prova (sorteada ou agrupada por banca/ano).

## Chamadas minhas (para o Peter conferir)

- Word montado na hora do download, links sem validade, excluir invalida os links.
- Gabarito só com letras quando não há resolução.
- Até 60 questões por prova.
- Questão que vai para a lixeira continua contando como usada (sem FK na tabela de uso).
- Dono: usadas e histórico juntando todas as escolas.
- Links assinados com um segredo que já existe (ex.: `AUTH_SECRET`), sem variável nova.
- Questões de simulados online não contam como "usadas".
