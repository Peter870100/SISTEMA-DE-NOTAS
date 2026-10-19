# Barra de formatação — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O professor formata o enunciado (alinhamento, recuo, negrito/itálico/sublinhado, sub/sobrescrito, caixa, linha) e insere figuras em qualquer ponto com posição e fonte; o aluno vê exatamente isso; questões antigas continuam iguais.

**Architecture:** Documento JSON (formato TipTap/ProseMirror) em `questoes.conteudo` e `alternativas[].conteudo`, sempre passado por `limparConteudo` (lista fechada) no servidor; `enunciado`/`texto` guardam o texto puro derivado. Exibição por um renderizador React próprio (`ConteudoQuestao`), sem HTML cru. Edição com TipTap 3 num componente `EditorConteudo`.

**Tech Stack:** Next.js 16.2 (ler `node_modules/next/dist/docs/` antes de usar API do Next), React 19.2, TipTap 3.32.0, Supabase, TypeScript, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-19-barra-formatacao-design.md`

## Global Constraints

- Lista fechada de nós: `doc`, `paragraph` (`textAlign` left|center|right|justify, `recuo` 0–3), `text`, `hardBreak`, `horizontalRule`, `caixa`, `figura` (`imagemId`, `alinhamento` esquerda|centro|direita, `legenda` ≤ 300). Marcas: `bold`, `italic`, `underline`, `subscript`, `superscript`. Alternativas: só `doc`/`paragraph`(sem atributos)/`text`/`hardBreak` + as 5 marcas.
- Texto total do documento ≤ 60 000 caracteres.
- Nada de `dangerouslySetInnerHTML`; renderização só com elementos React.
- `conteudo` null → comportamento antigo (texto + figuras no fim).
- `enunciado` e `alternativas[].texto` sempre preenchidos com o texto puro.
- `questoesParaAluno`: nunca `resposta` nem `*`; `conteudo` lido em consulta separada que ignora erro.
- Textos em pt-BR; tokens do `DESIGN.md`; sem texto cinza na área do aluno.
- TipTap: só os pacotes `@tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-text-align @tiptap/extension-subscript @tiptap/extension-superscript` na versão 3.32.0 (verificados no site oficial); rodar `npm audit signatures` depois de instalar.
- Worktree `.worktrees/barra-formatacao`; `git fetch` + `git rebase origin/master` antes das Tasks 4 e 5; conflito no `EditorQuestao` → manter visual da outra sessão; se ela redesenhou a área do enunciado, parar.
- Testes novos registrados no script `test`.

## Review Focus

1. Conteúdo malicioso enviado direto à ação do servidor (nó `script`, atributo `href`, marca desconhecida, recuo 99, legenda gigante) → descartado/limitado por `limparConteudo`.
2. Questão antiga aberta no editor e salva sem mexer → aparência igual (texto, negrito/itálico, quebras e figuras no fim).
3. Figura removida da questão (botão Remover) mas ainda citada no documento → não quebra: o renderizador pula nós sem imagem correspondente.
4. Figura de **outra** questão citada no documento → descartada no salvar.
5. Prova em andamento com o código publicado antes do SQL → continua abrindo (cai no texto antigo).

---

### Task 1: Banco, tipos e funções puras do conteúdo

**Files:** `db/schema.sql`; `src/lib/types.ts` (`Questao.conteudo: DocConteudo | null`, `Alternativa.conteudo?: DocConteudo | null`); Create `src/lib/questoes/conteudo.ts`, `src/lib/questoes/conteudo.test.ts`.

**Interfaces — Produces:**
- Tipos `DocConteudo`, `NoConteudo`, `MarcaConteudo`, `AlinhamentoTexto = "left"|"center"|"right"|"justify"`.
- `limparConteudo(doc: unknown, opcoes: { modo: "enunciado" | "alternativa"; imagensValidas?: Set<string> }): DocConteudo | null` — devolve só o permitido; `null` se vazio/inválido; nós `figura` sem `imagemId` em `imagensValidas` (quando dado) são removidos; recuo fora de 0–3 vira o limite; legenda cortada em 300; texto além de 60 000 cortado.
- `textoDoConteudo(doc: DocConteudo | null): string` — parágrafos separados por `\n`, `hardBreak` → `\n`, figura/linha não geram texto, caixa → seus parágrafos.
- `imagensDoConteudo(doc: DocConteudo | null): string[]` — ids de figura na ordem.
- `conteudoDeMarkdown(texto: string): DocConteudo` — converte o formato antigo (`**`, `*`, linhas) em parágrafos com marcas.

- [ ] Step 1: SQL da spec §1 anexado a `db/schema.sql` com `NOTIFY pgrst, 'reload schema';`.
- [ ] Step 2: Testes que falham, no mínimo: nó desconhecido some; marca `link` some; `textAlign:"x"` some; `recuo: 9` → 3; legenda 400 chars → 300; figura com id fora de `imagensValidas` some; modo alternativa remove `caixa`/`figura`/`horizontalRule`/`textAlign`; `textoDoConteudo` de doc com caixa + figura + hardBreak; `imagensDoConteudo` ordem; `conteudoDeMarkdown("a **b** *c*\nd")` → 2 parágrafos com marcas certas; ida e volta `textoDoConteudo(conteudoDeMarkdown(t)) === t` sem marcadores.
- [ ] Step 3: implementar → Step 4: verde + `tsc`.
- [ ] Step 5: Commit "Conteudo: coluna, tipos e funcoes puras do documento".

### Task 2: Renderizador e exibição para o aluno e no banco

**Files:** Create `src/components/questoes/ConteudoQuestao.tsx` (+ `.module.css`); Modify `src/lib/simulados/servidor.ts`, `src/components/simulados/ProvaAluno.tsx`, `src/components/simulados/ResultadoAluno.tsx`, `src/app/banco/questoes/[id]/page.tsx`.

**Interfaces — Produces:**
- `<ConteudoQuestao doc: DocConteudo | null; textoAntigo: string; imagens: ImagemTela[] />` — com `doc`: renderiza nós (figura via `ImagemQuestao` + legenda) e depois as figuras do enunciado não citadas; sem `doc`: `TextoQuestao` + todas as figuras do enunciado (igual a hoje).
- `<TextoAlternativa doc: DocConteudo | null; texto: string />` — marcas de caractere ou texto antigo.
- `QuestaoAluno.conteudo: DocConteudo | null` e alternativas com `conteudo`.

- [ ] Step 1: Implementar o renderizador com lista fechada (ignora desconhecidos) e CSS (caixa, linha, recuo 2rem/nível, legenda menor abaixo da figura na mesma posição).
- [ ] Step 2: `questoesParaAluno` lê `id, conteudo, alternativas` numa consulta separada que ignora erro.
- [ ] Step 3: Trocar `TextoQuestao`+figuras do enunciado por `ConteudoQuestao` nas 3 telas; alternativas por `TextoAlternativa`.
- [ ] Step 4: `tsc`, eslint, `npm test`. Commit "Conteudo: renderizador e exibicao na prova, resultado e banco".

### Task 3: Servidor salva o conteúdo

**Files:** Modify `src/actions/questoes.ts` (`DadosQuestao`, `limpar`, `criarQuestao`, `salvarQuestao`).

**Interfaces:** `DadosQuestao.conteudo?: unknown`; `alternativas[i].conteudo?: unknown`. Ao salvar: `limparConteudo(..., { modo:"enunciado", imagensValidas: ids das imagens alvo enunciado desta questão })` (na criação, sem imagens ainda: figuras descartadas — o editor salva de novo após enviar as pendentes, Task 5); `enunciado = textoDoConteudo(conteudo)` quando houver conteúdo; idem por alternativa. Sem `conteudo` enviado → comportamento atual.

- [ ] Step 1: implementar; Step 2: `tsc`, eslint, `npm test`. Commit "Conteudo: servidor limpa e salva o documento".

### Task 4: Componente EditorConteudo (TipTap)

**Files:** `package.json`/lock (instalar os 6 pacotes 3.32.0 + `npm audit signatures`); Create `src/components/questoes/EditorConteudo.tsx`, `src/components/questoes/editor/figura.ts` (nó com NodeView React), `src/components/questoes/editor/caixa.ts`, `src/components/questoes/editor/recuo.ts`, `src/components/questoes/EditorConteudo.module.css`.

**Interfaces — Produces:**
- `<EditorConteudo modo: "enunciado" | "alternativa"; valor: DocConteudo | null; aoMudar: (doc: DocConteudo) => void; imagens: Map<string, { url: string }>; aoInserirImagem?: (arquivo: File) => Promise<string /* imagemId ou id provisório */>; rotulo: string />`
- Barra: modo enunciado = B, I, U, x₂, x², ◧ ▣ ◨ ☰ (alinhar/justificar), recuo −/+, linha, caixa, figura; modo alternativa = B, I, U, x₂, x².
- Figura: inserir no cursor via `EntradaImagem` (colar/arrastar/escolher + cortar) e Ctrl+V de imagem no editor; selecionada → posição ◧ ▣ ◨, campo "Fonte da imagem", remover.
- `immediatelyRender: false`; StarterKit com heading, lists, blockquote, code, codeBlock, strike, link desligados.

- [ ] Step 1: rebase; instalar pacotes; `npm audit signatures`.
- [ ] Step 2: implementar componente e extensões; teste puro onde couber (ex.: comandos de recuo limitados 0–3 em função pura).
- [ ] Step 3: `tsc`, eslint, `npm test`, `npm run build`. Commit "Editor: barra de formatacao com TipTap".

### Task 5: EditorQuestao usa o EditorConteudo

**Files:** Modify `src/components/questoes/EditorQuestao.tsx`.

- [ ] Step 1: rebase.
- [ ] Step 2: enunciado: `EditorConteudo` modo enunciado (valor = `questao.conteudo ?? conteudoDeMarkdown(questao.enunciado)`); `d.conteudo` no estado; texto puro derivado ao salvar. Alternativas: `EditorConteudo` modo alternativa. "Ver como fica" usa `ConteudoQuestao`. A área "Imagem do enunciado" vira só a lista das figuras não citadas (com o botão de inserir no texto).
- [ ] Step 3: questão nova: figuras inseridas recebem id provisório; ao criar, enviar pendentes, trocar ids provisórios pelos reais no documento e salvar de novo; depois navegar.
- [ ] Step 4: `tsc`, eslint, `npm test`. Commit "Editor: enunciado e alternativas com a barra de formatacao".

### Task 6: Prévia, checagens e entrega

- [ ] Prévia temporária (não commitar) com: poema centralizado com recuo, caixa "Texto I", linha, questão de química com figura centralizada + fonte antes da pergunta, H₂SO₄ numa alternativa; editor com a barra; prints 1340 e 390.
- [ ] Apagar a prévia, `.next/types`; `tsc`, `npm test`, `npm run lint`, `npm run build`.
- [ ] SQL ao Peter → conferir coluna `questoes.conteudo` (só leitura) → publicar só com o ok dele.
