# Editar a prova em Word na pré-visualização — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na pré-visualização da prova em Word, deixar editar o cabeçalho (título, turma, data, valor e instruções) e as questões (trocar por inédita do mesmo assunto, remover e reordenar), gravando tudo na prova.

**Architecture:** As regras puras ficam num arquivo novo, `src/lib/folha/editar-prova.ts`, com testes. O núcleo do servidor (`provas-word-servidor.ts`) ganha leitura e gravação do `cabecalho` (jsonb novo em `provas_word`) e as operações nas questões. O cabeçalho é desenhado igual no Word (`docx.ts`) e na prévia (`Folha.tsx`). Um painel `Editor.tsx` ao lado da `<Previa>` chama server actions e depois `router.refresh()`. A `<Previa>` remonta por `key` e refaz a paginação.

**Tech Stack:** Next.js 16.2 (App Router, server actions), React 19, Supabase, zod, biblioteca `docx`, `node:test` via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-01-editar-prova-word-design.md`

## Global Constraints

- Limites: título com 1 a 120 caracteres; turma até 40; valor até 20; instruções até 600 (quebras de linha mantidas); data `AAAA-MM-DD` válida. Campos vazios (depois do trim) não são gravados.
- `cabecalho` jsonb: `{ turma?: string, data?: string, valor?: string, instrucoes?: string }`.
- Sem cabeçalho preenchido, a folha (Word e prévia) fica **idêntica** à de hoje.
- Turma, data, valor e instruções aparecem só na **prova**. O gabarito continua com título + "Gabarito comentado".
- Quem edita: o professor dono da prova ou `role === "dono"`. Prova excluída não pode ser editada.
- Textos fixos (copiar exatamente): "Salvar cabeçalho", "Cabeçalho salvo.", "Questão N trocada.", "Questão N removida.", "Não há outra inédita deste assunto. Trocar por uma que você já usou?", "Trocar mesmo assim", "Cancelar", "Não há outra questão deste assunto no banco.", "Não dá para trocar esta questão; remova-a.", "Remover a questão N?", "Instruções".
- Server actions devolvem `{ ok: false, erro }` e nunca lançam (o Next esconde a mensagem em produção).
- Telas: azul-escuro, sem texto cinza (padrão de `/banco/provas-word`).
- SQL manual: vai em `db/schema.sql`, e o Peter cola no SQL Editor. Nada vai para o `master` antes de conferir no banco que `provas_word.cabecalho` existe.
- Trabalhar no worktree `.worktrees/editar-prova-word`. Ao remover o worktree, desfazer antes a junction de `node_modules`.

## Review Focus

1. Prova antiga (`cabecalho = {}`) ou coluna sem chaves: a prévia e o download continuam iguais. Teste no `folha.test.ts` (Task 2) comparando o XML com e sem `cabecalho: {}`.
2. Duas trocas seguidas na mesma questão: a segunda não pode trazer de volta a primeira nem uma questão que já está na prova. Teste de `escolherTroca` excluindo os ids da prova (Task 1).
3. Data digitada inválida ("2026-02-30") ou instruções só com espaços: rejeitar e ignorar, respectivamente. Testes de `validarCabecalho` (Task 1).
4. Instruções com quebras de linha e caracteres como `<` ou `&`: aparecem literais no Word e na prévia. Teste no `folha.test.ts` (Task 2).
5. Remover a última questão ou mover para fora dos limites: o servidor recusa mesmo se o cliente mandar. Testes de `reordenar` e `removerDaOrdem` (Task 1) e guarda no núcleo (Task 3).

---

### Task 1: Regras puras da edição

**Files:**
- Create: `src/lib/folha/editar-prova.ts`
- Test: `src/lib/folha/editar-prova.test.ts`

**Interfaces:**
- Produces:
  - `type CabecalhoProva = { turma?: string; data?: string; valor?: string; instrucoes?: string }`
  - `const LIMITES_CABECALHO = { titulo: 120, turma: 40, valor: 20, instrucoes: 600 }`
  - `validarCabecalho(entrada: { titulo: string; turma?: string; data?: string; valor?: string; instrucoes?: string }): { ok: true; titulo: string; cabecalho: CabecalhoProva } | { ok: false; erro: string }`. Faz trim de tudo (instruções: trim só nas pontas, quebras internas mantidas) e omite os vazios.
  - `lerCabecalho(bruto: unknown): CabecalhoProva`. Lê o jsonb do banco com tolerância: ignora chaves desconhecidas e valores que não são string.
  - `dataBR(iso: string): string` → `"2026-11-05"` vira `"05/11/2026"`.
  - `reordenar<T>(lista: T[], de: number, para: number): T[] | null` → null se algum índice está fora de `0..n-1` ou se `de === para`.
  - `removerDaOrdem<T>(lista: T[], indice: number): T[] | null` → null se o índice é inválido ou se a lista tem 1 item.
  - `escolherTroca(candidatas: string[], naProva: Set<string>, usadas: Set<string>, aceitarUsadas: boolean, aleatorio?: () => number): { id: string; usada: boolean } | { id: null; haUsadas: boolean }`. Tira as que estão em `naProva`. Sorteia entre as inéditas. Se não houver inédita e `aceitarUsadas`, sorteia entre as usadas. `haUsadas` diz se havia usada disponível, para a tela escolher a mensagem.
  - `trechoEnunciado(texto: string, max = 90): string`. Texto puro: tira marcações (`**`, `_`, `#`, tags HTML, marcadores de imagem `[...]`), junta espaços e corta em `max` com "…".

- [ ] **Step 1: Escrever os testes que falham** em `editar-prova.test.ts` (estilo de `provas-word.test.ts`):

```ts
test("validarCabecalho: trim, omite vazios e mantém quebras", () => {
  const r = validarCabecalho({ titulo: "  Simulado  ", turma: " 3º A ", data: "2026-11-05", valor: "", instrucoes: "  Use caneta.\nSem consulta.  " });
  assert.deepEqual(r, { ok: true, titulo: "Simulado", cabecalho: { turma: "3º A", data: "2026-11-05", instrucoes: "Use caneta.\nSem consulta." } });
});
test("validarCabecalho: recusa título vazio, longo, data inválida e limites", () => {
  assert.equal(validarCabecalho({ titulo: "   " }).ok, false);
  assert.equal(validarCabecalho({ titulo: "x".repeat(121) }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", data: "2026-02-30" }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", data: "05/11/2026" }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", turma: "x".repeat(41) }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", valor: "x".repeat(21) }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", instrucoes: "x".repeat(601) }).ok, false);
  assert.deepEqual(validarCabecalho({ titulo: "T", instrucoes: "   \n  " }), { ok: true, titulo: "T", cabecalho: {} });
});
test("lerCabecalho: tolera lixo", () => {
  assert.deepEqual(lerCabecalho(null), {});
  assert.deepEqual(lerCabecalho({ turma: "3A", valor: 10, outra: "x" }), { turma: "3A" });
});
test("dataBR", () => assert.equal(dataBR("2026-11-05"), "05/11/2026"));
test("reordenar", () => {
  assert.deepEqual(reordenar(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(reordenar(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  assert.equal(reordenar(["a", "b"], 0, 2), null);
  assert.equal(reordenar(["a", "b"], -1, 0), null);
  assert.equal(reordenar(["a", "b"], 1, 1), null);
});
test("removerDaOrdem", () => {
  assert.deepEqual(removerDaOrdem(["a", "b", "c"], 1), ["a", "c"]);
  assert.equal(removerDaOrdem(["a"], 0), null);
  assert.equal(removerDaOrdem(["a", "b"], 5), null);
});
test("escolherTroca: inédita primeiro, nunca uma da prova", () => {
  assert.deepEqual(escolherTroca(["a", "b", "c"], new Set(["a"]), new Set(["b"]), false, () => 0), { id: "c", usada: false });
  assert.deepEqual(escolherTroca(["a", "b"], new Set(["a"]), new Set(["b"]), false), { id: null, haUsadas: true });
  assert.deepEqual(escolherTroca(["a", "b"], new Set(["a"]), new Set(["b"]), true), { id: "b", usada: true });
  assert.deepEqual(escolherTroca(["a"], new Set(["a"]), new Set(), true), { id: null, haUsadas: false });
});
test("trechoEnunciado", () => {
  assert.equal(trechoEnunciado("**Leia** o  texto\n<b>abaixo</b>."), "Leia o texto abaixo.");
  assert.equal(trechoEnunciado("x".repeat(100), 90), "x".repeat(89) + "…");
});
```

- [ ] **Step 2: Rodar e ver falhar**: `npx tsx --test src/lib/folha/editar-prova.test.ts`. Esperado: FAIL (módulo não existe).
- [ ] **Step 3: Implementar `editar-prova.ts`** com as assinaturas acima. Data válida: `new Date(iso + "T00:00:00Z")` e conferir que ano, mês e dia batem (assim recusa 2026-02-30). Para sortear, reaproveitar a ideia de `embaralhar` de `provas-word.ts` (índice `Math.floor(aleatorio() * n)`).
- [ ] **Step 4: Rodar e ver passar**: o mesmo comando. Esperado: todos PASS.
- [ ] **Step 5: Commit**: `git add src/lib/folha/editar-prova*.ts && git commit -m "feat: regras puras para editar a prova em Word"`

---

### Task 2: Cabeçalho na folha (Word e prévia) + coluna no banco

**Files:**
- Modify: `db/schema.sql` (depois do bloco de `prova_word_questoes`, antes do `NOTIFY`)
- Modify: `src/lib/folha/docx.ts` (`DadosFolha`, `cabecalho()`, `folhaAluno`)
- Modify: `src/lib/folha/previa.ts` (`DadosPrevia`)
- Modify: `src/lib/folha/previa-servidor.ts` (`dadosPrevia` repassa `cabecalho`)
- Modify: `src/app/banco/provas-word/[id]/previa/Folha.tsx` (`Cabecalho`) e `Previa.module.css` se precisar
- Modify: `src/lib/folha/provas-word-servidor.ts` (`dadosFolhaProva` lê `cabecalho` e passa por `lerCabecalho`)
- Test: `src/lib/folha/folha.test.ts`

**Interfaces:**
- Consumes: `CabecalhoProva`, `lerCabecalho` e `dataBR` (Task 1).
- Produces: `DadosFolha.cabecalho?: CabecalhoProva | null` e `DadosPrevia.cabecalho: CabecalhoProva` (sempre objeto, `{}` quando vazio).

- [ ] **Step 1: SQL em `db/schema.sql`**:

```sql
alter table provas_word add column if not exists cabecalho jsonb not null default '{}';
```

- [ ] **Step 2: Testes que falham** em `folha.test.ts` (usar `qf()` e `documentoXml` como os testes vizinhos):

```ts
test("cabeçalho vazio não muda a folha", async () => {
  const base = { titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [qf("Quanto é 2²?")] };
  assert.equal(await documentoXml(await folhaAluno(base)), await documentoXml(await folhaAluno({ ...base, cabecalho: {} })));
});
test("cabeçalho preenchido aparece na prova e não no gabarito", async () => {
  const d = { titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [qf("Quanto é 2²?")],
    cabecalho: { turma: "3º A", data: "2026-11-05", valor: "10,0", instrucoes: "Use caneta <azul> & preta.\nSem consulta." } };
  const aluno = await documentoXml(await folhaAluno(d));
  for (const t of ["3º A", "05/11/2026", "10,0", "Instruções", "Use caneta &lt;azul&gt; &amp; preta.", "Sem consulta."]) assert.ok(aluno.includes(t), t);
  assert.ok(!aluno.includes("____/____/______"));
  const gab = await documentoXml(await folhaGabarito(d));
  for (const t of ["3º A", "05/11/2026", "Instruções"]) assert.ok(!gab.includes(t), t);
});
```

- [ ] **Step 3: Rodar e ver falhar**: `npx tsx --test src/lib/folha/folha.test.ts`. Esperado: FAIL no segundo teste.
- [ ] **Step 4: Implementar no `docx.ts`.** `cabecalho(d, subtitulo, comIdentificacao)` usa `d.cabecalho` só quando `comIdentificacao`:
  - Turma preenchida: o campo vira `{ rotulo: "Turma", ate: null, depois: turma }`.
  - Data preenchida: `depois: dataBR(data)`.
  - Valor preenchido: na 2ª linha, a Nota fica `{ rotulo: "Nota", ate: FIM_LINHA - cm(2.4) }` seguida de `{ rotulo: "Valor", ate: null, depois: valor }`, sem quebrar a linha. O builder pode ajustar o `cm` desde que caiba numa linha.
  - Instruções: um parágrafo depois da tabela do cabeçalho, com o rótulo "Instruções: " em negrito AZUL e o texto no tamanho `CORPO`. Cada `\n` vira quebra (`TextRun({ break: 1 })`). Fica antes do `Paragraph` vazio de 160.
  - O `linhaPreencher` atual já aceita `ate: null` com `depois`.
- [ ] **Step 5: Espelhar no `Folha.tsx`** (`Cabecalho`): os mesmos campos em `LinhaPreencher` e o bloco de instruções com `white-space: pre-line`, só quando `qual === "prova"`. As medidas seguem as do docx (usar `x()`, `p()`, `cm()` como no resto do arquivo). Repassar `cabecalho` em `dadosPrevia` (`cabecalho: dados.cabecalho ?? {}`).
- [ ] **Step 6: `dadosFolhaProva`**: incluir `cabecalho` no `select` de `provas_word` e em `DadosFolha` (`cabecalho: lerCabecalho(prova.cabecalho)`).
- [ ] **Step 7: Rodar e ver passar**: `npx tsx --test src/lib/folha/folha.test.ts`. Esperado: PASS. Depois `npm test`: tudo PASS.
- [ ] **Step 8: Commit**: `git commit -am "feat: turma, data, valor e instruções no cabeçalho da prova em Word"` (inclui `db/schema.sql`).

---

### Task 3: Núcleo e server actions da edição

**Files:**
- Modify: `src/lib/folha/provas-word-servidor.ts`
- Modify: `src/app/banco/provas-word/acoes.ts`

**Interfaces:**
- Consumes: Task 1 (`validarCabecalho`, `reordenar`, `removerDaOrdem`, `escolherTroca`, `trechoEnunciado`, `lerCabecalho`) e as funções privadas `elegiveis`/`usadasPeloProfessor` do mesmo arquivo.
- Produces (núcleo, todas `async`, lançam `Error` com mensagem para o professor):
  - `type EditorProva = { id: string; role?: string | null }` (o professor que pede).
  - `salvarCabecalho(quem: EditorProva, provaId: string, entrada: { titulo: string; turma?: string; data?: string; valor?: string; instrucoes?: string }): Promise<void>`
  - `moverQuestao(quem: EditorProva, provaId: string, de: number, para: number): Promise<void>` (índices 0-based na ordem atual).
  - `removerQuestao(quem: EditorProva, provaId: string, indice: number): Promise<void>`
  - `trocarQuestao(quem: EditorProva, provaId: string, indice: number, aceitarUsadas: boolean): Promise<{ trocada: true; usada: boolean } | { trocada: false; motivo: "so-usadas" | "nenhuma" | "sem-base" }>`
  - `questoesDoEditor(provaId: string): Promise<{ indice: number; questaoId: string; rotulo: string; trecho: string }[]>`. `rotulo` é "Matéria · Assunto" (só matéria se não há assunto; "Questão removida do banco" se a questão sumiu).
- Produces (actions em `acoes.ts`, entradas `unknown` validadas com zod):
  - `salvarCabecalhoProva(entrada: unknown): Promise<{ ok: true } | Falha>`, com entrada `{ provaId, titulo, turma?, data?, valor?, instrucoes? }`.
  - `moverQuestaoProva(entrada: unknown)` → `{ provaId, de, para }`; `removerQuestaoProva(entrada: unknown)` → `{ provaId, indice }`. As duas devolvem `{ ok: true } | Falha`.
  - `trocarQuestaoProva(entrada: unknown): Promise<{ ok: true; trocada: boolean; usada?: boolean; motivo?: "so-usadas" | "nenhuma" | "sem-base" } | Falha>`, com entrada `{ provaId, indice, aceitarUsadas }`.
  - Todas chamam `revalidatePath(\`/banco/provas-word/${provaId}/previa\`)` e `revalidatePath(CAMINHO)`.

- [ ] **Step 1: Guarda comum**: `async function provaEditavel(quem, provaId)` lê `id, professor_id, escola_id, filtros, excluida_em` e lança "Prova não encontrada." se não existe, se foi excluída ou se `quem.id !== professor_id && quem.role !== "dono"`. Devolve a linha e os `questao_id` na ordem (`order("ordem")`).
- [ ] **Step 2: `salvarCabecalho`**: `validarCabecalho`. Se `ok: false`, lança `erro`. Senão faz `update({ titulo, cabecalho })`.
- [ ] **Step 3: `moverQuestao` e `removerQuestao`**: aplicam `reordenar`/`removerDaOrdem` na lista de ids. `null` lança "Não foi possível mudar a ordem." / "A prova precisa ter pelo menos 1 questão.". Remover apaga a linha do índice. Os dois regravam `ordem` (1..n) com um `update` por linha que mudou (no máximo 60; a PK é `(prova_id, questao_id)`, então `ordem` repetida no meio não quebra nada).
- [ ] **Step 4: `trocarQuestao`**: lê `materia, assunto_id` da questão do índice. Se ela não existe, usa `filtros.materia`/`filtros.assunto_id` da prova. Se não há nem matéria, devolve `sem-base`. Filtros da busca: `{ assunto_id }` se houver, senão `{ materia }`, mais `banca`, `anoDe` e `anoAte` de `provas_word.filtros`. `elegiveis(prova.escola_id, filtros)` e `usadasPeloProfessor(prova.professor_id)` vão para `escolherTroca`. Com `id: null`, devolve `{ trocada: false, motivo: haUsadas ? "so-usadas" : "nenhuma" }`. Com `id`, faz `update({ questao_id: novo }).eq("prova_id").eq("questao_id", antigo)`.
- [ ] **Step 5: `questoesDoEditor`**: ids na ordem, depois `questoes.select("id, enunciado, materia, assunto_id")` e `assuntos.select("id, nome")`. Matéria pelo rótulo de `MATERIAS`. `trechoEnunciado(enunciado)`.
- [ ] **Step 6: Actions** em `acoes.ts`, no padrão de `excluirProvaWord`: `exigirProfessor()`, zod (`provaId: z.uuid()`, índices `z.number().int().min(0)`, `aceitarUsadas: z.boolean()`, textos `z.string().max(1000)`; os limites finos ficam com `validarCabecalho`) e `mensagem(e, ...)`.
- [ ] **Step 7: Verificar**: `npm run lint` e `npx tsc --noEmit`, sem erros novos. `npm test`: PASS.
- [ ] **Step 8: Commit**: `git commit -am "feat: núcleo e ações para editar cabeçalho e questões da prova em Word"`

---

### Task 4: Painel "Editar" na pré-visualização

**Files:**
- Create: `src/app/banco/provas-word/[id]/previa/Editor.tsx`
- Create: `src/app/banco/provas-word/[id]/previa/PreviaEditavel.tsx`
- Modify: `src/app/banco/provas-word/[id]/previa/page.tsx`
- Modify: `src/app/banco/provas-word/[id]/previa/Previa.tsx`
- Modify: `src/app/banco/provas-word/[id]/previa/Previa.module.css`

**Interfaces:**
- Consumes: as actions da Task 3, `questoesDoEditor`, `CabecalhoProva` e `DadosPrevia.cabecalho`.
- Produces: `Editor({ provaId, titulo, cabecalho, questoes, aoFechar }: { provaId: string; titulo: string; cabecalho: CabecalhoProva; questoes: { indice: number; questaoId: string; rotulo: string; trecho: string }[]; aoFechar: () => void })`.

- [ ] **Step 1: `page.tsx`**: busca `questoesDoEditor(id)` junto com `dadosPrevia` (`Promise.all`; quem vê pode editar, pela regra de `podeVer`) e renderiza um invólucro cliente novo, `PreviaEditavel` (Create: `.../previa/PreviaEditavel.tsx`), com as props da `<Previa>` mais `editor={{ titulo, cabecalho, questoes }}`.
- [ ] **Step 2: `PreviaEditavel`** guarda `aberto` em `useState` e renderiza `<Previa key={versao} ... editorAberto={aberto} aoAlternarEditor={() => setAberto(v => !v)} />` e, se `aberto`, `<Editor .../>`. `versao` é uma string derivada dos dados (`titulo + JSON.stringify(cabecalho) + ids.join()`). Assim a prévia remonta e repagina depois do `router.refresh()`, e o painel, que fica fora da `key`, mantém o estado e a rolagem.
- [ ] **Step 3: Botão "Editar"** na barra da `<Previa>` (ícone `Pencil` do lucide), antes de "Imprimir", com `aria-pressed={editorAberto}`. Fica desabilitado enquanto `!pronto`, como os outros botões. O `Editor` abre num portal próprio no `body` com o atributo `data-previa-editor`, à direita, 380px; no celular (≤ 700px), tela cheia. Na `<Previa>`: o filtro do `inert` também ignora `data-previa-editor`. Com `editorAberto`, a área das folhas ganha `padding-right: 380px` (só acima de 700px). Na impressão o painel já some pela regra `body > :not([data-previa])`.
- [ ] **Step 4: `Editor.tsx`**: seção Cabeçalho (inputs com `maxLength` dos `LIMITES_CABECALHO`, `type="date"`, textarea, botão "Salvar cabeçalho") e seção Questões (lista `N. rótulo`, trecho e botões ↑ ↓ Trocar Remover, com `aria-label` como "Subir questão N"). Usa `useTransition`. Enquanto pendente, todos os botões ficam `disabled`. Depois de `ok`, `router.refresh()` e a mensagem do Global Constraints, em `role="status"`. Erro em `role="alert"`. Trocar com `motivo: "so-usadas"` mostra o texto e os botões "Trocar mesmo assim" (chama de novo com `aceitarUsadas: true`) e "Cancelar". `"nenhuma"` e `"sem-base"` mostram os textos fixos. Remover usa o `ConfirmDialog` de `@/components/ui/ConfirmDialog` com "Remover a questão N?". Os campos do cabeçalho começam com os valores salvos e só são reiniciados quando `titulo`/`cabecalho` mudam (usar `key` no form).
- [ ] **Step 5: Verificar**: `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run build`, todos sem erro.
- [ ] **Step 6: Commit**: `git commit -am "feat: painel Editar na pré-visualização da prova em Word"`

---

### Task 5: Conferência e publicação

- [ ] **Step 1**: Pedir ao Peter para colar no SQL Editor `alter table provas_word add column if not exists cabecalho jsonb not null default '{}'; NOTIFY pgrst, 'reload schema';`. Conferir com uma leitura (`select cabecalho from provas_word limit 1` via REST ou `consultar_dados`) que a coluna existe.
- [ ] **Step 2**: Teste manual no `npm run dev` (worktree) com uma prova de teste do dono: salvar o cabeçalho, trocar, remover, subir e descer. Conferir que a prévia repagina e que o Word baixado mostra a mesma prova.
- [ ] **Step 3**: Rebase em `origin/master`, push no `master`, conferir o deploy no www (memória: Vercel "success" não garante que está no ar) e atualizar o `CLAUDE.md` (item 11).
