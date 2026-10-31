# Questões pela assinatura + folha de tarefa em Word — desenho

Data: 2026-10-30. Pedido do Peter (dono). Primeira de três ideias que ele trouxe; as outras duas
(simulado por voz e botão "folha em Word" no site) ficam para depois.

**Etapa 1 (este documento):** a folha só precisa funcionar com questões de **texto** — as escritas
pelo Claude via `salvar_questoes`. **Etapa 2 (depois, com o visual já aprovado):** aceitar o acervo do
banco (ENEM, PDFs importados) com figuras recortadas (`questao_imagens` tipo `recorte`) e texto
formatado em `questoes.conteudo`. Decisão do Peter: "faça a 1 primeiro".

## Por que

O gerador de questões do site (`/banco/gerar` e `gerar_questoes` da Hermes) usa a API paga da
Anthropic, que precisa de créditos à parte. O Peter paga a assinatura do Claude e usa o Claude Code
no VS Code. Ele quer poder pedir questões aqui ("faz 8 questões de porcentagem para tarefa do 9º
ano") e receber:

1. as questões **guardadas no banco** (para reaproveitar em simulado ou outra tarefa), e
2. uma **folha de tarefa em Word (.docx)** no padrão ENEM, pronta para imprimir, com espaço no
   cabeçalho para o nome do aluno.

Quem escreve as questões é o Claude da sessão (pago pela assinatura); o site só grava. O gerador
atual continua igual e volta a funcionar quando houver crédito na API — as duas formas convivem.

## Como vai funcionar (fluxo de uso)

1. O Peter pede no Claude Code: matéria, assunto, quantidade, nível/série, e se quer folha.
2. O Claude consulta exemplos do banco pelo MCP do dono (`buscar_questoes`, etc.) para acertar o
   estilo e não repetir questões existentes.
3. O Claude escreve as questões (enunciado, comando, 5 alternativas, resposta, resolução) e chama a
   ferramenta nova **`salvar_questoes`** no MCP do dono. Elas entram no banco geral **em revisão**.
4. O Claude roda o script **`scripts/folha-tarefa.ts`** com os ids gravados e entrega o caminho do
   `.docx` (folha do aluno) e do gabarito.
5. O Peter revisa/publica no `/banco` quando quiser (a folha não depende de publicar).

## Parte 1 — ferramenta `salvar_questoes` (MCP do dono)

- Só no MCP do dono (`/api/mcp/dono`). Não entra no MCP do professor.
- Entrada:
  - `materia` (texto, como em `gerar_questoes`: aceita rótulo ou chave, via `materiaDoTexto`);
  - `assunto` opcional (nome; casado com os assuntos **aprovados** da matéria; sem casamento → sem
    assunto, como o gerador faz);
  - `dificuldade` (`facil` | `media` | `dificil`);
  - `questoes`: lista de **1 a 10** itens `{ enunciado, comando, alternativas: [{letra, texto}] A–E,
    resposta, resolucao }`. (Limite 10 = mesmo do gerador e da coluna `quantidade_pedida`.)
- Gravação: **reusar o caminho do gerador** — montar um `RespostaGeracao` e passar por
  `respostaParaGeradas` (valida 5 alternativas distintas, marca "parecida demais" comparando com as
  últimas geradas da matéria e entre si). Resultado: `escopo 'geral'`, `escola_id null`,
  `status 'revisao'`, `origem 'ia'`, `banca 'Gerada por IA'`, `resolucao` preenchida, `criado_por` =
  conta do dono. Assim elas aparecem no mesmo filtro do banco (`?origem=ia&status=revisao`).
- Registra uma linha em `geracoes_ia` já `concluida`, com `custo_usd 0`, tokens nulos e
  `orientacao` começando com "Escrita pelo Claude (assinatura)" — para agrupar o lote, aparecer em
  `situacao_geracao` e separar dos pedidos pagos. Dono não conta na cota (regra que já existe).
- Questões inválidas são descartadas e contadas; se nenhuma passar, erro claro.
- **Fórmulas e símbolos:** texto simples com caracteres Unicode (x², x³, ½, √, ×, ÷, ≤, ≥, π, %,
  frações como "3/4"); nada de LaTeX (o site não renderiza). A descrição da ferramenta diz isso.
- **Créditos do texto-base** (autor, "Disponível em:", "Acesso em:") vão como último parágrafo do
  `enunciado`, sozinhos numa linha; sem coluna nova.
- Resposta da ferramenta: ids gravados (na ordem enviada), quantas descartadas e o link do `/banco`
  filtrado — mesmo estilo de texto de `situacao_geracao`.
- **Sem SQL novo**: `origem 'ia'` e as colunas usadas já existem no banco.
- A descrição da ferramenta deixa claro: não chama IA, não tem custo, é para quem já escreveu as
  questões. A Hermes enxerga a ferramenta, mas o texto orienta que o caminho dela continua sendo
  `gerar_questoes`.

## Parte 2 — script `scripts/folha-tarefa.ts` (roda local, `npx tsx`)

- Entrada por argumentos: ids das questões (ou um `geracao_id`, que expande para as questões dele),
  título da folha (ex.: "Tarefa de Matemática — Porcentagem"), e opcionais turma e data.
- Lê as questões direto do Supabase com as variáveis de `.env.local` (mesmo padrão de
  `scripts/criar-professor.ts`), **na ordem pedida**; aceita questões em revisão ou publicadas.
- Etapa 1 usa `enunciado` + `comando` + `alternativas` (texto, com o negrito/itálico simples que o
  site já aceita). Questão com figura ou com `conteudo` formatado: o script avisa no terminal e
  segue só com o texto (ou recusa, se ficaria ilegível) — tratamento completo é a Etapa 2.
- Parágrafo final do enunciado que pareça crédito (começa com sobrenome em maiúsculas seguido de
  vírgula, ou contém "Disponível em"/"Acesso em") sai em letra menor, alinhado à direita.
- Gera dois arquivos `.docx` numa pasta `folhas/` na raiz do projeto (ignorada no git):
  - **folha do aluno**: sem respostas;
  - **gabarito** (arquivo separado, para o professor): letra certa e resolução de cada questão.
- Biblioteca: `docx` (npm), como dependência de desenvolvimento — conferir autenticidade do pacote
  antes de instalar.

### Diagramação da folha do aluno (referência: `assets/2026-10-30-folha-exemplo-enem.png`)

Seguir o padrão visual da imagem de exemplo, **com a marca da escola** (Colégio Status — logo de
`public/`, nunca a marca do exemplo):

- **Cabeçalho da 1ª página:** logo da escola + título da folha; abaixo, linhas para preencher
  **Nome**, **Turma**, **Nº** e **Data**; linha horizontal separando do conteúdo.
- **Corpo em duas colunas** com linha vertical pontilhada entre elas; tamanho A4; margens estreitas
  como no exemplo.
- **Título de cada questão:** "QUESTÃO n" em negrito seguido de uma barra grossa (faixa de linhas)
  até o fim da coluna; numeração de 1 em diante na ordem da folha.
- **Texto-base** justificado, recuo na primeira linha dos parágrafos; fonte/créditos (quando houver)
  em letra menor, alinhada à direita.
- **Comando** em parágrafo próprio; **alternativas** com a letra em destaque no estilo do exemplo
  (letra branca em círculo preto, ou o equivalente mais próximo que renderize bem no Word) e texto
  com recuo pendente.
- Fonte sem serifa (Arial ou equivalente), ~11 pt no corpo.
- **Rodapé:** título da folha à esquerda/centro e número da página à direita.
- Questão não deve começar no fim de uma coluna e quebrar logo em seguida quando der para evitar
  ("manter com o próximo" no título da questão).
- **Figuras:** fora da Etapa 1 (ver acima).

### Diagramação do gabarito (referência enviada pelo Peter: folha de "Resoluções" de cursinho)

Modelo de folha de resoluções (o Peter mandou como imagem no chat, não ficou arquivo): mesma marca
da escola no topo, título "<título da folha> — Resoluções"; **duas colunas**; quando houver mais de
uma matéria, o nome da matéria centralizado em negrito como título de seção; cada questão começa com
o **número em negrito** (01, 02…) seguido do texto da resolução, justificado; termina com
"**Resposta: X**" em negrito na linha seguinte. Rodapé com nome da folha e página.

## Ligação do Claude Code ao MCP do dono

Na implementação, conectar esta máquina com `claude mcp add` (transporte HTTP,
`https://www.statusavalia.com.br/api/mcp/dono`, cabeçalho `Authorization: Bearer` lido do
`MCP_DONO_TOKEN` do `.env.local`, escopo local, sem imprimir a senha). Documentar o passo em
`docs/` para refazer depois.

## Fora deste trabalho

- Botão "baixar folha em Word" no site (vem depois, reaproveitando a diagramação aprovada aqui).
- Etapa 2: questões do acervo com figuras recortadas e texto formatado (`conteudo`).
- Simulado por voz; enviar a folha pelo Telegram; PDF.
- Qualquer mudança no gerador pago (`gerar_questoes`, `/banco/gerar`).

## Não pode acontecer

- Gastar crédito da API da Anthropic neste caminho.
- Usar logo, nome ou marca de outra empresa (o exemplo é só referência de diagramação).
- Questão escrita pelo Claude ir direto para "publicada" ou para o banco de uma escola.
- Mostrar ou gravar a senha do MCP em arquivo versionado.

## Decisões tomadas pelo Claude (o Peter disse "pode começar")

- Questões ficam guardadas no banco geral, em revisão.
- Folha montada por script local, não pelo site (o site vem depois, com o modelo aprovado).
- Gabarito em arquivo separado da folha do aluno, no modelo de "Resoluções" que o Peter mandou.
- Cabeçalho com Nome, Turma, Nº e Data.
- Saída na pasta `folhas/` do projeto.
- Fórmulas em Unicode simples; créditos como último parágrafo do enunciado.

## Deixado para quem construir

- Nome exato dos argumentos do script e formato dos nomes de arquivo.
- Como desenhar a letra em círculo no Word.
- Qual arquivo de logo usar (`public/LOGO2025_CURVAS.png` parece a versão colorida; a
  `logo-status-branca.png` é branca e não serve em papel).
