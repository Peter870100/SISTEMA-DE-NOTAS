# Valor por questão — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A prova em Word ganha valor total numérico e valor por questão, com divisão automática e fixos. Fica igual no Word, na prévia e no gabarito, e funciona pelo site e pela Hermes.

**Architecture:** As regras ficam em funções puras num arquivo novo, `src/lib/folha/valores.ts`, com valores em **décimos inteiros**. `dadosFolhaProva` calcula os valores uma vez e os põe em cada questão. O docx e a prévia só imprimem. O valor fixo fica em `prova_word_questoes.valor`, e a opção "mostrar" fica em `provas_word.cabecalho.valorPorQuestao`.

**Tech Stack:** Next.js 16.2 (server actions), React 19, Supabase, zod, `docx`, testes com `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-02-valor-por-questao-design.md`, incluindo a seção "Decisões tomadas na revisão". O SQL (`prova_word_questoes.valor numeric(6,1)`) **já foi aplicado** e conferido no banco.

## Global Constraints

- Valor: número com vírgula ou ponto, até 1 casa decimal, > 0 e ≤ 1000. Na folha sempre com 1 casa e vírgula: "10,0".
- Sem valor total válido, nenhum valor aparece por questão. Opção desligada também esconde. A opção ausente conta como desligada.
- Divisão em décimos inteiros: base = ⌊resto/n⌋ e a sobra k é +0,1 para as **k últimas** automáticas. Fixos > total: nenhum valor por questão (Word, prévia e gabarito), com aviso no painel.
- Na folha: "QUESTÃO 01 (1,0)", igual no .docx e na prévia, na prova e no gabarito.
- Automática = `null` no banco; o valor calculado nunca é gravado.
- Textos fixos (copiar exatamente):
  - "Mostrar o valor de cada questão"
  - "Os valores fixos (X) passam do valor da prova (Y)."
  - "As questões somam X e a prova vale Y."
  - "Preencha o valor da prova para os valores aparecerem."
  - "Quanto vale a prova? (se não quiser valor, diga 'sem valor')"
  - "Valor da prova"
- Server actions devolvem `{ ok: false, erro }` e nunca lançam. Telas em azul-escuro, sem texto cinza. Arquivos em CRLF no worktree.
- Worktree `.worktrees/editar-prova-word`. Um dev server (porta 3005) roda nele; não derrubar.

## Review Focus

1. Prova sem valor (cabeçalho antigo ou novo, sem `valor`): o XML e a prévia ficam idênticos aos de antes. Teste em `folha.test.ts` (Task 2).
2. "10 pontos" salvo antes e o professor só muda a turma: salvar passa. Teste de `validarCabecalho` com `valorAnterior` (Task 1).
3. Total baixado para menos que os fixos: a folha sai sem valores por questão, sem nenhum "(-1,0)". Teste de `valoresDasQuestoes` (Task 1) e de `folha.test.ts` (Task 2).
4. Valores com ponto flutuante (0,1 + 0,2): a soma confere exatamente. Teste com total 1,0 em 3 questões → 0,3 + 0,3 + 0,4 (Task 1).
5. Hermes com `valores_questoes` inválido (numero 0, repetido, fora de n, sem `valor`): recusa antes de gravar a prova. Teste da validação pura (Task 1, `validarValoresPedido`).

---

### Task 1: Regras puras de valor

**Files:**
- Create: `src/lib/folha/valores.ts`, `src/lib/folha/valores.test.ts` (incluir no script `test` do `package.json`, como `editar-prova.test.ts`)
- Modify: `src/lib/folha/editar-prova.ts` (+ test): `CabecalhoProva.valorPorQuestao?: boolean`, `lerCabecalho` lê o booleano, `validarCabecalho` aceita `valorAnterior?: string` e normaliza o valor, `itensLinhaCabecalho` imprime o valor formatado quando numérico

**Interfaces (Produces):**
- `lerDecimos(texto: string | null | undefined): number | null`: "10" → 100, "7,5" → 75, "7.5" → 75. Devolve null para vazio, texto, 0, negativo, > 1000 ou mais de 1 casa.
- `formatarDecimos(d: number): string`: 100 → "10,0", 5 → "0,5".
- `type ValoresProva = { porQuestao: (number | null)[] | null; aviso: string | null }`, em décimos.
- `valoresDasQuestoes(totalDecimos: number | null, fixos: (number | null)[], mostrar: boolean): ValoresProva`
- `validarValoresPedido(n: number, total: number | null, itens: { numero: number; valor: number }[]): { ok: true; fixos: (number | null)[] } | { ok: false; erro: string }`, com total e itens em décimos. É a validação da Hermes e do site.
- `validarCabecalho(entrada, valorAnterior?)`: quando `valor` ≠ `valorAnterior` e não vazio, exige `lerDecimos` não nulo e grava o texto normalizado `formatarDecimos(...)` (ex.: "10,0"); igual ao anterior, mantém como está. Erro: "O valor da prova deve ser um número, ex.: 10 ou 7,5.". `valorPorQuestao` passa adiante como veio.

- [ ] **Step 1: Testes que falham** (`valores.test.ts`):
  - `lerDecimos`: "10"→100; "7,5"→75; " 7.5 "→75; "0"→null; "10,25"→null; "10 pontos"→null; "1001"→null.
  - `formatarDecimos(100)`→"10,0"; `formatarDecimos(5)`→"0,5".
  - `valoresDasQuestoes(100, [null,null,null], true).porQuestao` → `[33,33,34]`.
  - Com Q1 fixo: `valoresDasQuestoes(100, [20, ...Array(9).fill(null)], true).porQuestao` → `[20, 8, 9,9,9,9,9,9,9,9]`. Resto 80 em 9: base 8, k=8, então a 2ª questão fica com 8 e as 8 últimas com 9.
  - `valoresDasQuestoes(10, [null,null,null], true)` → `[3,3,4]`.
  - `mostrar=false` → `porQuestao: null`; total null → `porQuestao: null`.
  - Fixos 120 > total 100 → `porQuestao: null`, `aviso: "Os valores fixos (12,0) passam do valor da prova (10,0)."`.
  - Todas fixas somando 90 com total 100 → `porQuestao: [..fixos]`, `aviso: "As questões somam 9,0 e a prova vale 10,0."`.
  - `validarValoresPedido`: total null e itens não vazios → erro; numero 0, numero > n ou repetido → erro; fixos > total → erro; caso ok devolve `fixos` posicional.
  - Em `editar-prova.test.ts`: `validarCabecalho({titulo:"T", valor:"10 pontos"}, "10 pontos")` → ok, com o valor mantido. `validarCabecalho({titulo:"T", valor:"10"})` → `cabecalho.valor === "10,0"`. `validarCabecalho({titulo:"T", valor:"dez"})` → erro. `lerCabecalho({valorPorQuestao:true})` mantém o booleano. `lerCabecalho({valorPorQuestao:"sim"})` descarta.
- [ ] **Step 2:** `npx tsx --test src/lib/folha/valores.test.ts src/lib/folha/editar-prova.test.ts`: FAIL.
- [ ] **Step 3:** Implementar. Os limites de texto do campo valor seguem `LIMITES_CABECALHO.valor` (15).
- [ ] **Step 4:** Os mesmos testes passam; `npm test` todo passa.
- [ ] **Step 5:** Commit `feat: regras puras de valor por questão`.

### Task 2: Valor na folha (Word, prévia, gabarito)

**Files:** `src/lib/folha/docx.ts` (`tituloQuestao`), `src/app/banco/provas-word/[id]/previa/Folha.tsx` (`TituloQuestao`), `src/lib/folha/estrutura.ts` (o item de título leva `valor?: string`), `src/lib/folha/provas-word-servidor.ts` (`dadosFolhaProva`), `src/lib/folha/previa*.ts`, `src/lib/folha/folha.test.ts`.

**Interfaces:**
- Consumes: `valoresDasQuestoes`, `lerDecimos`, `formatarDecimos` (Task 1).
- Produces: `QuestaoFolha.valor?: string` (já formatado, ex.: "1,0"). `dadosFolhaProva` lê `prova_word_questoes.valor` na ordem e calcula com `lerDecimos(cabecalho.valor)` e `cabecalho.valorPorQuestao === true`. Também devolve `avisoValores: string | null` para o painel.

- [ ] **Step 1: Testes** em `folha.test.ts`:
  - Questões com `valor: "1,0"` → o XML da prova e o do gabarito contêm "(1,0)" no parágrafo do título da questão.
  - Sem `valor`, o XML fica idêntico ao de hoje.
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3:** Implementar. Imprimir " (v)" depois de "QUESTÃO NN", no mesmo parágrafo, sem negrito. Fazer o mesmo na prévia. `numeric` vem do Supabase como número ou string: converter com `Math.round(Number(x)*10)`.
- [ ] **Step 4:** `npm test` passa.
- [ ] **Step 5:** Commit `feat: valor de cada questão no Word e na prévia`.

### Task 3: Núcleo e ações de edição de valores

**Files:** `src/lib/folha/provas-word-servidor.ts`, `src/app/banco/provas-word/acoes.ts`.

**Interfaces:**
- Consumes: Task 1, e o `provaEditavel`/`mesmaQuestao`/`PROVA_MUDOU` existentes.
- Produces:
  - `salvarValorQuestao(quem: EditorProva, provaId: string, indice: number, questaoId: string, valor: string | null): Promise<void>`: valor vazio ou null grava null. Texto inválido lança "O valor da questão deve ser um número, ex.: 2 ou 1,5.". Se os fixos resultantes passarem do total válido, lança o texto "Os valores fixos (X) passam do valor da prova (Y).".
  - Action `salvarValorQuestaoProva({ provaId, indice, questaoId, valor })` → `{ ok: true } | Falha`.
  - `salvarCabecalho` passa a receber `valorPorQuestao?: boolean` e chama `validarCabecalho(entrada, valorAnteriorSalvo)`. Quando antes não havia total válido e agora há, grava `valorPorQuestao: true`.
  - `questoesDoEditor` passa a devolver `valor: number | null` (o fixo, em décimos) e `sugerido: number | null`, além de `aviso`.
  - `trocarQuestao` mantém o `valor` da linha (o UPDATE só mexe em `questao_id`; conferir). `removerQuestao` apaga a linha junto com o valor.
- [ ] **Step 1:** Implementar seguindo o padrão das ações existentes (zod: `valor: z.string().max(15).nullable()`).
- [ ] **Step 2:** `npm run lint`, `npx tsc --noEmit` e `npm test` sem erros.
- [ ] **Step 3:** Commit `feat: salvar valor da questão e opção de mostrar valores`.

### Task 4: Painel "Editar" com valores

**Files:** `src/app/banco/provas-word/[id]/previa/Editor.tsx`, `Previa.module.css`, `PreviaEditavel.tsx`/`page.tsx`, para repassar os dados novos e a `key` da prévia (incluir os valores na `versao`).

- [ ] **Step 1:** Seção Cabeçalho: o campo "Valor" vira `inputMode="decimal"`, com placeholder "Ex.: 10". Ao lado, o checkbox "Mostrar o valor de cada questão", que vai em "Salvar cabeçalho".
- [ ] **Step 2:** Cada linha da lista ganha uma caixinha de valor (`inputMode="decimal"`, `aria-label` "Valor da questão N"). O placeholder é o `sugerido` formatado. O valor inicial é o fixo. Salvar no blur/Enter só se mudou, por `executar` com a action da Task 3, passando `questaoId`. Desabilitar enquanto pendente.
- [ ] **Step 3:** Mostrar o `aviso` (`role="status"`) acima da lista. Sem total válido e com algum fixo, mostrar "Preencha o valor da prova para os valores aparecerem.".
- [ ] **Step 4:** `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run build`.
- [ ] **Step 5:** Commit `feat: valor por questão no painel Editar`.

### Task 5: Gerar com valor (site e Hermes) + texto da Hermes

**Files:** `src/app/banco/provas-word/NovaProva.tsx`, `src/app/banco/provas-word/acoes.ts` (`gerarProvaWord`), `src/lib/folha/provas-word-servidor.ts` (função de gerar: aceita `valorDecimos` e `fixos`), `src/lib/mcp/acoes/provas-word.ts`, `docs/folha-tarefa.md`.

- [ ] **Step 1:** Gerar com `valor` grava `cabecalho = { valor: formatarDecimos(v), valorPorQuestao: true }` e os fixos em `prova_word_questoes.valor` por posição. Sem valor, a prova fica como hoje.
- [ ] **Step 2:** Site: campo opcional "Valor da prova" no formulário de nova prova. Inválido mostra erro, como os outros campos.
- [ ] **Step 3:** Hermes, em `gerar_prova_word`, recebe `valor: z.number().positive().max(1000).optional()` e `valores_questoes: z.array(z.object({ numero: z.number().int(), valor: z.number().positive() })).optional()`. Converter para décimos (recusar mais de 1 casa) e validar com `validarValoresPedido` **antes** de gerar; um erro vai como texto para a Hermes. As descrições dizem: "Sem `valor` = prova sem valor nenhum".
- [ ] **Step 4:** Descrição de `previa_prova_word`: acrescentar que, na mesma mensagem, pergunte "Quanto vale a prova? (se não quiser valor, diga 'sem valor')", a menos que o professor já tenha dito. Se ele disser valores de questões específicas, eles são repassados em `valores_questoes`.
- [ ] **Step 5:** `docs/folha-tarefa.md` ganha uma seção "Valor da prova" com o uso, mais um bloco "Para colar no prompt de sistema da Hermes" (3 a 5 linhas com a mesma regra).
- [ ] **Step 6:** `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run build`. Commit `feat: gerar prova em Word com valor (site e Hermes)`.

### Task 6: Conferência e publicação

- [ ] **Step 1:** Coluna `prova_word_questoes.valor` conferida (feito em 2026-11-02).
- [ ] **Step 2:** Teste manual do Peter em `localhost:3005`.
- [ ] **Step 3:** Rebase em `origin/master`, push no `master`, conferir no www e atualizar o `CLAUDE.md` (item 11).
