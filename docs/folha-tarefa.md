# Folha de tarefa (.docx)

Gera a folha do aluno e o gabarito comentado, em Word, a partir de questões do banco.

## Como pedir ao Claude Code

Exemplo de frase:

> Monte uma folha de tarefa de Matemática sobre porcentagem com 10 questões do banco, título "Tarefa de Matemática — Porcentagem".

O Claude escolhe as questões pelo MCP do dono (`statusavalia-dono`) e roda o script abaixo.

## Comando do script

```
npx tsx scripts/folha-tarefa.ts --titulo "Tarefa de Matemática — Porcentagem" --ids id1,id2,id3
npx tsx scripts/folha-tarefa.ts --titulo "Tarefa de Matemática — Porcentagem" --subtitulo "9º ano" --ids id1,id2,id3
npx tsx scripts/folha-tarefa.ts --titulo "Tarefa de Matemática — Porcentagem" --geracao <id-da-geracao>
```

- `--subtitulo` (opcional): linha abaixo do título no cabeçalho, ex.: `--subtitulo "9º ano · Ensino Fundamental"`.
- `--ids`: ids das questões, na ordem desejada.
- `--geracao`: todas as questões de uma geração por IA (a ordem de criação é só aproximada; quando a ordem importar, use `--ids` na ordem devolvida por `salvar_questoes`).
- Grava em `folhas/` (ignorada pelo git): `AAAA-MM-DD-<titulo>.docx` (data local) e `AAAA-MM-DD-<titulo>-gabarito.docx`, e imprime os dois caminhos.
- As bolinhas das alternativas (padrão do caderno do ENEM) vêm de `public/folha/alternativa-A.png` … `-E.png`, regeneráveis com `npx tsx scripts/gerar-bolinhas-folha.ts`.
- Avisa quando uma questão tem figura ou formatação especial que o .docx não reproduz.
- Lê `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do `.env.local` (somente leitura no banco).

## Ligar o Claude Code ao MCP do dono

O token (`MCP_DONO_TOKEN`) fica só no `.env.local`/Vercel. **Não cole o token no chat.**
Rode o comando abaixo no terminal, lendo a linha do arquivo para uma variável sem imprimi-la.

PowerShell (na pasta do projeto):

```powershell
$t = (Get-Content .env.local | Where-Object { $_ -like 'MCP_DONO_TOKEN=*' } | Select-Object -First 1).Substring('MCP_DONO_TOKEN='.Length).Trim('"')
claude mcp add --transport http --scope local statusavalia-dono https://www.statusavalia.com.br/api/mcp/dono --header "Authorization: Bearer $t"
Remove-Variable t
```

Bash:

```bash
t=$(grep '^MCP_DONO_TOKEN=' .env.local | head -1 | cut -d= -f2- | tr -d '"')
claude mcp add --transport http --scope local statusavalia-dono https://www.statusavalia.com.br/api/mcp/dono --header "Authorization: Bearer $t"
unset t
```

Forma genérica (placeholder, não é um valor real):

```
claude mcp add --transport http --scope local statusavalia-dono https://www.statusavalia.com.br/api/mcp/dono --header "Authorization: Bearer <MCP_DONO_TOKEN do .env.local>"
```

Use `--scope local` (não `project`) para o token não ir parar em arquivo versionado.

## Prova em Word pela Hermes e pelo site

Prova com questões **oficiais do banco** (publicadas, com resposta, sem pendência de figura ou revisão), com as
figuras recortadas da prova original e o texto formatado. Sai em dois arquivos .docx: a prova e o gabarito.

- **Pela Hermes (Telegram):** o professor pede, por exemplo, "uma prova de 10 questões de Biologia da UFMS".
  A Hermes chama `previa_prova_word`, conta quantas questões existem, quantas ele já usou e quantas são inéditas,
  e pergunta se é atividade de fixação ou simulado (e, se faltar inédita, se completa com já usadas). Depois
  `gerar_prova_word` devolve os dois links. Para reenviar uma prova antiga: `listar_provas_word` e `links_prova_word`.
- **Pelo site:** Banco de questões → **Provas em Word** (`/banco/provas-word`). Formulário "Nova prova" com prévia,
  e o histórico com Pré-visualizar / Baixar ▾ (Prova/Gabarito em Word ou PDF) / Excluir / Limpar tudo.
- **Inédita** = questão que o professor ainda não pôs em nenhuma prova em Word dele (contam também as provas
  excluídas do histórico; simulados online não contam).
- **Links:** os da Hermes têm um código (`?c=`) e abrem sem login; não expiram, mas param de funcionar se a prova for
  excluída. No site, o download usa a sessão (só o professor da prova ou o dono).
- **Título:** "Atividade de Fixação – <Matéria>" ou "Simulado – <Matéria>", com " · <Assunto>" quando houver.
  Logo do Colégio Status só na escola Status; nas outras, o nome da escola no cabeçalho.
- Tabelas: `provas_word` e `prova_word_questoes` (`db/schema.sql`). Questão que foi para a lixeira depois some da
  prova, com o aviso "N questões desta prova não estão mais no banco".

## Pré-visualizar, imprimir e PDF

- No histórico de `/banco/provas-word` (e logo após gerar uma prova), clique em **Pré-visualizar**. A prova abre
  em tela cheia, paginada como folha A4; há a aba do gabarito.
- **Imprimir** abre a janela de impressão do navegador com a folha atual.
- **Baixar ▾** oferece Word (.docx) e PDF. No histórico (e logo após gerar), o menu lista **Prova (Word)**,
  **Gabarito (Word)**, **Prova (PDF)** e **Gabarito (PDF)**; dentro da pré-visualização, **Word** e **PDF** da folha
  aberta. Nos itens de PDF abre-se a janela de impressão: escolha "Salvar como PDF" como impressora.
- As quebras de página da prévia e do PDF podem diferir um pouco das do Word.

## Valor da prova

- **Valor total:** número com até 1 casa decimal (ex.: 10 ou 7,5). Com valor, cada questão sai com o seu no título,
  na prova e no gabarito: "QUESTÃO 01 (1,0)". Sem valor, a prova fica como antes, sem valor nenhum.
- **Divisão automática:** o total é dividido entre as questões em décimos; a sobra (0,1) vai para as últimas. Ex.:
  10,0 em 3 questões = 3,3 + 3,3 + 3,4.
- **Valor fixo:** no painel **Editar** da pré-visualização, a caixinha ao lado de cada questão fixa o valor dela (em
  branco = automática, mostrando o valor sugerido). As automáticas dividem o que sobra. Fixos acima do total
  não são aceitos; se o total baixar depois, a folha sai sem valores por questão e o painel avisa.
- **Mostrar o valor de cada questão:** opção do cabeçalho no painel Editar; ligada sozinha quando a prova ganha um
  valor total. Desligada, só o total aparece no cabeçalho.
- **Site:** campo "Valor da prova" (opcional) no formulário "Nova prova".
- **Hermes:** `previa_prova_word` pergunta "Quanto vale a prova? (se não quiser valor, diga 'sem valor')" e
  `gerar_prova_word` recebe `valor` e, se o professor fixar questões, `valores_questoes` (`[{ numero, valor }]`).

### Para colar no prompt de sistema da Hermes

```
Prova em Word: antes de gerar, se o professor não disse, pergunte junto com o resto
"Quanto vale a prova? (se não quiser valor, diga 'sem valor')".
Mande o total em `valor` de gerar_prova_word; se ele disser "sem valor", não mande `valor`.
Se ele fixar questões ("a 1 vale 2"), mande em `valores_questoes` ([{ numero: 1, valor: 2 }]);
as outras dividem o que sobra.
```
