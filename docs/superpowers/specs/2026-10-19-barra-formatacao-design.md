# Barra de formatação do enunciado

Data: 2026-10-19 · Status: escopo aprovado pelo Peter no chat ("A + caixa de texto, linha e recuo"); desenho técnico por conta do Claude ("pode fazer, confio em você")

## Objetivo

O professor monta a questão com a cara da prova original. Exemplos do Peter:

- **Poesia**: o poema centralizado; embaixo, o comando alinhado normalmente.
- **Química**: a questão começa com a **imagem centralizada**, logo abaixo a **fonte da imagem**
  ("Disponível em: …"), depois a pergunta e as alternativas.
- A figura pode entrar **em qualquer ponto** do texto e ficar **à esquerda, no centro ou à direita**.

Hoje o enunciado é texto com `**negrito**`/`*itálico*` (`src/lib/questoes/markdown.ts`) e as figuras
aparecem sempre **depois** do texto (`questao_imagens`, alvo `enunciado`). Não há alinhamento,
fonte da imagem, caixa, linha nem recuo.

## Escopo (aprovado)

Barra no estilo Word, no **enunciado**:

| Grupo | Itens |
|---|---|
| Caractere | negrito, itálico, sublinhado, subscrito (H₂O), sobrescrito (x²) |
| Parágrafo | alinhar à esquerda · centro · direita · justificado; recuo (aumentar/diminuir, até 3 níveis) |
| Inserir | figura **no ponto do cursor** (com posição ◧ ▣ ◨ e **fonte da imagem** embaixo); **linha horizontal**; **caixa de texto** (quadro com borda para "Texto I", citações) |

Nas **alternativas**: só os itens de caractere (negrito, itálico, sublinhado, sub/sobrescrito) — fórmulas
como H₂SO₄ aparecem em alternativas. As figuras das alternativas continuam como hoje (por letra).

## Fora do escopo

- Tipo e tamanho de letra, espaçamento entre linhas, listas, tabelas (decisão do Peter com recomendação
  do Claude: aparência uniforme e leitura boa no celular).
- Ensinar a importação por IA a gerar o formato novo (passo seguinte sugerido).
- Quiz das aulas (`QuizAulaAluno`, tabela própria).
- Estudar ou copiar o Microsoft Word (pedido cancelado pelo Peter).

## Não pode acontecer

- Questão antiga mudar de aparência ou quebrar.
- Aluno receber HTML/código vindo do conteúdo (injeção). Nada de `dangerouslySetInnerHTML`.
- Busca no banco, listas, montagem de simulado e o assistente (MCP) pararem de achar questões pelo texto.
- Prova em andamento quebrar se o código for publicado antes do SQL.

## 1. Como fica guardado

SQL novo (Peter cola no SQL Editor; anexar a `db/schema.sql` com `NOTIFY pgrst, 'reload schema';`):

```sql
alter table questoes add column if not exists conteudo jsonb;
```

- `questoes.conteudo`: documento do enunciado no formato JSON do editor (ProseMirror/TipTap), **só com
  os tipos permitidos** (seção 2). `null` = questão antiga → mostra `enunciado` + figuras no fim, como hoje.
- `questoes.enunciado` continua sendo preenchido **com o texto puro** derivado do conteúdo (para busca,
  listas, simulado, MCP e IA).
- **Alternativas**: o JSON `alternativas` já existente ganha um campo opcional por item
  `conteudo` (documento só com parágrafos e marcas de caractere). `texto` continua com o texto puro.
- **Figura no texto**: nó `figura` com `imagemId` (um registro de `questao_imagens` desta questão,
  alvo `enunciado`), `alinhamento` e `legenda` (a fonte da imagem, texto puro até 300 caracteres).
  Figuras do enunciado que não aparecem em nenhum nó continuam mostradas no fim (compatível com hoje
  e com a conferência de imagens).

## 2. Tipos permitidos (lista fechada)

- Nós: `doc`, `paragraph` (atributos `textAlign`: left|center|right|justify; `recuo`: 0–3),
  `text`, `hardBreak`, `horizontalRule`, `caixa` (contém parágrafos), `figura` (atributos acima).
- Marcas: `bold`, `italic`, `underline`, `subscript`, `superscript`.
- Qualquer outra coisa é **descartada no servidor** ao salvar (função pura `limparConteudo`, testada),
  e o renderizador ignora o que não conhece.
- Limite de tamanho do documento (ex.: 60 mil caracteres de texto) para evitar abuso.

## 3. Editor (professor)

- Biblioteca: **TipTap 3** (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` + `extension-text-align`,
  `extension-subscript`, `extension-superscript`), verificada na documentação oficial; versão 3.32.0.
  StarterKit com tudo que não está na lista da seção 2 desligado. `immediatelyRender: false` (Next).
- Barra fixa no topo do campo do enunciado, botões com ícone (lucide), `aria-pressed`, dicas
  ("Negrito (Ctrl+B)"). Atalhos padrão do editor (Ctrl+B/I/U).
- **Inserir figura**: botão abre o fluxo atual de imagem (colar / arrastar / escolher + cortar, de
  `EntradaImagem`) e insere o nó no cursor. Ctrl+V de imagem dentro do editor também insere no cursor.
  Ao clicar numa figura: posição ◧ ▣ ◨, campo "Fonte da imagem", remover.
- Questão nova: mesma regra de hoje — imagens pendentes são enviadas ao criar; os nós guardam um id
  provisório trocado pelo id real depois do envio.
- Alternativas: editor de uma linha com a barra reduzida (caractere).
- "Ver como fica" usa o mesmo renderizador do aluno.
- Seguir o visual atual do `EditorQuestao` (a outra sessão restilizou; não redesenhar).

## 4. Exibição (aluno e banco)

- Componente novo `ConteudoQuestao` (renderiza o JSON com elementos React, lista fechada) usado onde
  hoje há `TextoQuestao` + figuras do enunciado: prova (`ProvaAluno`), resultado (`ResultadoAluno`),
  página da questão no banco, prévia do editor, tela de conferência.
- Figura renderizada por `ImagemQuestao` (já respeita alinhamento e mostra "Imagem indisponível").
  Legenda logo abaixo, letra menor, mesma posição da figura.
- Caixa: borda `--color-line`, fundo leve, cantos arredondados. Linha: `<hr>` discreto. Recuo: 2rem por nível.
- `questoesParaAluno` lê `conteudo` numa consulta separada tolerante a erro (como `falta_imagem`):
  sem a coluna, cai no texto antigo. Nunca selecionar `resposta` nem `*`.

## 5. Testes

Funções puras com teste (registrar no `package.json`): `limparConteudo` (descarta nós/marcas/atributos
fora da lista, limita recuo e tamanho, legenda), `textoDoConteudo` (texto puro para `enunciado`/`texto`),
`imagensDoConteudo` (ids usados, para saber quais figuras mostrar no fim), conversão do texto antigo em
documento ao abrir uma questão antiga no editor (`conteudoDeMarkdown`).

## 6. Restrições

- Trabalhar em `.worktrees/barra-formatacao` (a partir de `origin/master` 941a97d).
- A outra sessão mexe no `EditorQuestao`: antes de mexer, `git fetch` + rebase; em conflito, manter o
  visual dela.
- Ordem de publicação: SQL → conferir no banco → publicar (só com ok do Peter).
