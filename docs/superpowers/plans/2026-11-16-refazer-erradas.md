# Refazer as erradas — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** depois de estudar, o aluno volta às questões que errou no assunto (uma chance só, no máximo 10 por vez), como uma etapa
nova do plano entre Estudar e Praticar; e os treinos livres passam a preferir questões nunca vistas.

**Architecture:** o refazer é um treino do plano (`simulados.plano_etapa = 'refazer'`). As pendentes são calculadas no servidor
(`carregarPlano`) e entram em `montarPlano` (pura) como contagem; a etapa, a sugestão e a validação são funções puras em
`src/lib/plano/`. Desempenho e relatórios tiram o refazer das contas de acerto.

**Tech Stack:** Next.js 16.2 (App Router, server actions), React 19, Supabase (PostgREST), TypeScript, testes com `tsx --test`
(`node:test` + `assert/strict`).

**Spec:** `docs/superpowers/specs/2026-11-16-refazer-erradas-design.md` (ler inteira antes de começar).

## Global Constraints

- Trabalhar na worktree `c:\Users\pkinh\Desktop\appnotasescola\.worktrees\refazer-erradas` (branch `feature/refazer-erradas`). Nunca mexer na pasta principal.
- Este Next.js tem mudanças: antes de usar qualquer API do Next, ler o guia em `node_modules/next/dist/docs/`.
- Nenhuma dependência nova.
- `MAX_REFAZER = 10`.
- Textos para o aluno em pt-BR, exatamente como neste plano. Telas do aluno no padrão `status-visual-aluno` (nada de texto cinza); reaproveitar as classes CSS que já existem nos componentes tocados.
- Todo arquivo de teste novo entra na lista do script `test` de `package.json`.
- Verificação por tarefa: `npm test` e `npx tsc --noEmit -p .` (leva ~2 min; precisa terminar sem nenhuma linha de erro).
- Commits terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Nada que grava `plano_etapa = 'refazer'` vai para o `master` antes de o Peter colar o SQL e confirmar o `select` de conferência** (Task 7).

## Review Focus

- Duplo clique em "Já estudei, refazer as erradas" ou em "Refazer N questões": um treino só (a colisão do índice único devolve o aberto). Teste na Task 3.
- Refazer aberto quando o estudo volta a "não feito" numa rodada nova: o aluno continua achando o treino ("Continuar treino"). Teste na Task 2.
- Conteúdo sem assunto (chave `materia:<m>`): o refazer funciona igual. Teste na Task 2.
- Refazer entregue com tudo em branco: gasta a chance de todas as questões do treino (vem da `ordem` da tentativa, não das respostas). Teste na Task 1.
- Aluno sem nenhuma errada mostrável (todas anuladas, despublicadas ou em sigilo): plano igual ao de hoje, 3 etapas. Teste na Task 2.

---

### Task 1: Tipos, SQL e regra das pendentes

**Files:**
- Create: `db/2026-11-16-refazer-erradas.sql` (o SQL da seção "Esquema SQL" da spec, sem mudar nada)
- Modify: `db/schema.sql:1459-1460` (o check de `plano_etapa` passa a incluir `'refazer'`)
- Create: `src/lib/plano/refazer.ts`, `src/lib/plano/refazer.test.ts`
- Modify: `src/lib/plano/tipos.ts`, `src/lib/plano/textos.ts` (`PREFIXO`), `src/components/plano/CartaoConteudoPlano.tsx` (`TITULO`, `ULTIMO`), `src/lib/plano/dados.ts` (`lerTreinos`, chamada de `montarPlano`), `src/lib/plano/plano.test.ts` (helpers), `package.json`

**Interfaces:**
- Produces:
  - `type EtapaPlano = "diagnostico" | "pratica" | "revisao" | "refazer"`
  - `TreinoDoPlano` ganha `questaoIds: string[]` (a `ordem` da tentativa da conta nesse simulado, entregue ou não; `[]` sem tentativa)
  - `Etapa` ganha `pendentes?: number` (só a etapa de refazer usa)
  - `EntradaPlano` ganha `refazer: Record<string, { pendentes: number }>` (chave do conteúdo)
  - em `src/lib/plano/refazer.ts`: `export const MAX_REFAZER = 10`; `export function ehRefazer(etapa: string | null | undefined): boolean`;
    `export type ErradaInicial = { questaoId: string; erradaEm: string }`;
    `export function pendentesRefazer(erradas: ErradaInicial[], refeitas: ReadonlySet<string>, mostraveis: ReadonlySet<string>): string[]`
    (ids sem repetição, mostráveis e não refeitos, do erro mais recente para o mais antigo; empate pela data → id em ordem crescente; questão repetida fica com a data mais recente)
  - `PREFIXO.refazer = "Refazer"` (título `Refazer: <nome>`), `TITULO.refazer = "Refazer as erradas"`, `ULTIMO.refazer = "Refez"`

- [ ] **Step 1: Escrever `src/lib/plano/refazer.test.ts`**

```ts
test("pendentes: tira refeitas e não mostráveis, mais recente primeiro", () => {
  const erradas = [
    { questaoId: "q1", erradaEm: "2026-10-01T10:00:00.000Z" },
    { questaoId: "q2", erradaEm: "2026-10-05T10:00:00.000Z" },
    { questaoId: "q3", erradaEm: "2026-10-03T10:00:00.000Z" },
    { questaoId: "q4", erradaEm: "2026-10-04T10:00:00.000Z" },
  ];
  assert.deepEqual(pendentesRefazer(erradas, new Set(["q3"]), new Set(["q1", "q2", "q3"])), ["q2", "q1"]);
});
test("pendentes: repetida conta uma vez, com a data mais recente; empate pelo id", () => {
  const erradas = [
    { questaoId: "b", erradaEm: "2026-10-01T10:00:00.000Z" },
    { questaoId: "a", erradaEm: "2026-10-02T10:00:00.000Z" },
    { questaoId: "c", erradaEm: "2026-10-02T10:00:00.000Z" },
    { questaoId: "b", erradaEm: "2026-10-09T10:00:00.000Z" },
  ];
  assert.deepEqual(pendentesRefazer(erradas, new Set(), new Set(["a", "b", "c"])), ["b", "a", "c"]);
});
test("pendentes: refazer entregue em branco gasta a chance (refeitas vêm da ordem do treino)", () => {
  const erradas = [{ questaoId: "q1", erradaEm: "2026-10-01T10:00:00.000Z" }];
  assert.deepEqual(pendentesRefazer(erradas, new Set(["q1"]), new Set(["q1"])), []);
});
test("ehRefazer", () => {
  assert.equal(ehRefazer("refazer"), true);
  assert.equal(ehRefazer("pratica"), false);
  assert.equal(ehRefazer(null), false);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx tsx --test src/lib/plano/refazer.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar `refazer.ts`, os tipos e as entradas dos mapas.** Em `lerTreinos` (`src/lib/plano/dados.ts`), ler também `ordem` das tentativas e preencher `questaoIds`; em `carregarPlano`, passar `refazer: {}` para `montarPlano` por enquanto (a Task 3 preenche). Em `plano.test.ts`, os helpers ganham os padrões `questaoIds: []` (`tr`) e `refazer: {}` (`plano`). Criar o SQL e atualizar o check em `db/schema.sql`. Acrescentar `src/lib/plano/refazer.test.ts` ao `test` do `package.json`.
- [ ] **Step 4: Verificar** — `npm test` PASS; `npx tsc --noEmit -p .` sem erros.
- [ ] **Step 5: Commit** — `feat: tipo refazer no plano e regra das pendentes`

---

### Task 2: Etapa de refazer no plano (puro)

**Files:**
- Modify: `src/lib/plano/plano.ts`, `src/lib/plano/textos.ts`
- Test: `src/lib/plano/plano.test.ts`, `src/lib/plano/textos.test.ts`

**Interfaces:**
- Consumes: Task 1 (`EntradaPlano.refazer`, `TreinoDoPlano.questaoIds`, `Etapa.pendentes`, `MAX_REFAZER`).
- Produces (em `plano.ts`):
  - `etapaDeTreino(c: Pick<ConteudoPlano, "situacao" | "etapas">): EtapaPlano | null` com a regra nova (abaixo).
  - `export function etapasLiberadas(c: Pick<ConteudoPlano, "situacao" | "etapas">): EtapaPlano[]`: a sugestão primeiro, depois as outras aceitas, na ordem `refazer`, `pratica`; sem repetir.
  - `export function sugestaoDepoisDeEstudar(c: Pick<ConteudoPlano, "situacao" | "etapas">): EtapaPlano | null`: `etapaDeTreino` com a etapa `refazer` `aguardando` tratada como `disponivel`.
- Produces (em `textos.ts`): `textoRecomendacao` aceita `refazer?: boolean` no primeiro argumento.

**Regra da etapa** (no caminho "revisar"; inserida logo depois de `revisar`):
- existe se `entrada.refazer[chave].pendentes > 0` ou se há treino `refazer` do conteúdo;
- `estado`: concluído → `feita`; treino de refazer aberto → `disponivel`; `pendentes === 0` → `feita`; estudo (`revisar`) não feito → `aguardando`; senão `disponivel`;
- `treinoAberto`: o refazer aberto mais recente (concluído → `null`); `resultado`: o último refazer entregue; `disponivelEm: null`; `pendentes`: o número recebido;
- `minutos = minutosPorQuestao ×` (aberto → `questaoIds.length`; pendentes > 0 → `min(pendentes, MAX_REFAZER)`; senão `total` do último entregue).
- `minutosProximos`: o `aguardando` da etapa `refazer` soma os minutos e **não** interrompe a conta.
- O conjunto de conteúdos do plano em `montarPlano` (`comPraticaOuRevisao`) passa a incluir os que têm treino de refazer. `percorrer`, `temPlano`, `depois` e `historico` não mudam.
- `texto`: `refazer: true` quando a etapa existe e não está `feita`. (A spec diz "quando existe"; com ela feita, a frase "refaça as questões" ficaria velha.)

**Regra da sugestão:** "mais respostas" → `diagnostico`; concluído → `pratica`; prática não feita → `pratica` se a prática tem treino aberto, senão `refazer` se o refazer está `disponivel`, senão `pratica`; prática feita → `revisao` se disponível, senão `refazer` se `disponivel`, senão `null`.

- [ ] **Step 1: Testes em `plano.test.ts`** (usar `so`, `cd`, `pri`, `tr`, `estados` que já existem; `ESTUDOU = { a: "2026-11-02T10:00:00.000Z" }` como `revisadoEm`)

```ts
test("refazer antes de estudar: 4 etapas, refazer aguardando e fora da sugestão", () => {
  const c = so({ refazer: { a: { pendentes: 3 } } });
  assert.deepEqual(c.etapas.map((e) => e.tipo), ["revisar", "refazer", "pratica", "revisao"]);
  assert.deepEqual(estados(c), ["disponivel", "aguardando", "disponivel", "aguardando"]);
  assert.deepEqual(c.etapas.map((e) => e.minutos), [15, 9, 15, 9]);
  assert.equal(c.minutosProximos, 39);
  assert.equal(c.total, 4);
  assert.equal(c.etapas[1].pendentes, 3);
  assert.equal(etapaDeTreino(c), "pratica");
  assert.deepEqual(etapasLiberadas(c), ["pratica"]);
  assert.equal(sugestaoDepoisDeEstudar(c), "refazer");
  assert.equal(c.texto, "Você errou 7 de 10 questões de Assunto a. Revise esse conteúdo, refaça as questões que errou e depois resolva uma sequência de 5 questões, começando pelas mais simples.");
});
test("depois de estudar, refazer disponível e sugerido; no máximo 10", () => {
  const c = so({ refazer: { a: { pendentes: 12 } }, revisadoEm: ESTUDOU });
  assert.deepEqual(estados(c), ["feita", "disponivel", "disponivel", "aguardando"]);
  assert.equal(c.etapas[1].minutos, 30);
  assert.equal(etapaDeTreino(c), "refazer");
  assert.deepEqual(etapasLiberadas(c), ["refazer", "pratica"]);
});
test("prática aberta vem antes do refazer", () => {
  const c = so({ refazer: { a: { pendentes: 3 } }, revisadoEm: ESTUDOU, treinos: [tr({ simuladoId: "p1" })] });
  assert.equal(etapaDeTreino(c), "pratica");
  assert.deepEqual(etapasLiberadas(c), ["pratica", "refazer"]);
});
// refazer entregue (acertos 1, total 3, questaoIds q1..q3), pendentes 0: etapa "feita", resultado {1,3}, minutos 9,
//   texto sem "refaça", etapaDeTreino "pratica"; com pendentes 1: "disponivel", pendentes 1.
// com [praticaOk] e com [praticaOk, refazer 3/3] e com [praticaOk, refazer 0/3]: rodada, situacao, etiqueta e depois iguais.
// [praticaOk, revisaoOk] + pendentes 2: situacao "concluido", refazer "feita", etapasLiberadas ["pratica"].
// praticaOk (entregue 2026-10-20, revisão liberada em 03/11) + pendentes 2 + ESTUDOU: etapaDeTreino "revisao", etapasLiberadas ["revisao", "refazer"];
//   prática aprovada entregue em 2026-11-01 (revisão aguardando): etapaDeTreino "refazer".
// conteúdo sem prioridade (prioridades: []) com refazer aberto (entregueEm null, questaoIds ["q1","q2"]) e pendentes 2:
//   continua no plano, treinoAberto do refazer = id dele, minutos 6.
// rodada 2 (prática entregue 1/5 depois do ESTUDOU) com refazer aberto: refazer "disponivel" com treinoAberto, etapaDeTreino "refazer".
// chave "materia:matematica" (cd("materia:matematica", { assuntoId: null })) com pendentes 2: etapa refazer presente.
// pendentes 0 e nenhum treino de refazer: 3 etapas, como hoje.
```

Cada linha comentada vira um `test(...)` com essas asserções.

- [ ] **Step 2: Teste em `textos.test.ts`** — `textoRecomendacao({ tipo: "revisar", nome: "Morfologia", erros: 7, questoes: 10, foco: { topicoId: "t", nome: "Derivação parassintética", erros: 4, questoes: 5 }, refazer: true }, R)` === `"Você errou 7 de 10 questões de Morfologia, 4 delas sobre Derivação parassintética. Revise esse tópico, refaça as questões que errou e depois resolva uma sequência de 5 questões, começando pelas mais simples."`; sem `refazer`, os textos de hoje (testes existentes continuam passando).
- [ ] **Step 3: Rodar e ver falhar** — `npx tsx --test src/lib/plano/plano.test.ts src/lib/plano/textos.test.ts` → FAIL.
- [ ] **Step 4: Implementar** em `plano.ts` e `textos.ts`.
- [ ] **Step 5: Verificar** — `npm test` PASS (os testes antigos de `plano.test.ts` e `nucleo.test.ts` continuam passando sem mudança de asserção); `npx tsc --noEmit -p .` sem erros.
- [ ] **Step 6: Commit** — `feat: etapa refazer as erradas no plano`

---

### Task 3: Criar o treino de refazer (núcleo, dados e ação)

**Files:**
- Modify: `src/lib/plano/nucleo.ts`, `src/lib/plano/nucleo.test.ts`, `src/lib/plano/dados.ts`, `src/actions/plano-estudo.ts`

**Interfaces:**
- Consumes: Task 1 (`pendentesRefazer`, `ehRefazer`, `MAX_REFAZER`, `questaoIds`), Task 2 (`etapasLiberadas`).
- Produces:
  - `DepsTreinoPlano` ganha `pendentesRefazer(chave: string): Promise<string[]>` (ids, erro mais recente primeiro).
  - `DadosPlano` ganha `pendentesRefazer: Record<string, string[]>`.
  - `criarTreinoDoPlanoCom` aceita `etapa: "refazer"`.

**Núcleo:** `ETAPAS` inclui `"refazer"`. A checagem passa a ser `etapasLiberadas(plano).includes(etapa)`; se a etapa pedida é `refazer` e está `aguardando`, o erro é `"Estude o conteúdo antes de refazer as questões."`, nos outros casos o de hoje. Treino aberto → devolve como hoje. Para `refazer`: pega `deps.pendentesRefazer(chave)`; vazio → `{ ok: false, erro: "Não há questões para refazer em <nome>." }`; senão as `MAX_REFAZER` primeiras, `ordenarPorFacilidade`, `tituloTreino("refazer", nome)`, rodada = `contarTreinos + 1`, `aviso: null`, colisão como hoje. Não chama `deps.candidatas`.

**Dados (`carregarPlano`):** as erradas iniciais por chave (`erradasDe`) viram `ErradaInicial` (`erradaEm` = `entregueEm` da resposta). Refeitas = união de `questaoIds` dos treinos `refazer` **entregues**. Mostráveis = das `idsErradas`, as que passam em `status = 'publicada'`, `anulada = false`, `filtroVisivel(escola)` e não estão em `questoesDeProvasEmSigilo(aluno)` (ler por ids com `lerPorIds`, com `order`; juntar ao ramo paralelo `lerQuestoes` ou criar um ramo novo). Para cada conteúdo: `pendentesRefazer(...)` → `DadosPlano.pendentesRefazer[chave]` e `refazer[chave] = { pendentes: lista.length }` para `montarPlano`. Nas duas visões.

**Ação:** em `criarTreinoDoPlano`, `pendentesRefazer: async (chave) => (await ler(chave)).pendentesRefazer[chave] ?? []`.

- [ ] **Step 1: Testes em `nucleo.test.ts`** (o helper `montar` ganha `pendentes?: string[]` → `pendentesRefazer: async () => o.pendentes ?? []`, e conta chamadas de `candidatas`)

```ts
const comRefazer = (estado: Etapa["estado"], aberto: string | null = null) =>
  plano("revisar", [etapa("revisar", "feita"), etapa("refazer", estado, aberto), etapa("pratica", "disponivel"), etapa("revisao", "aguardando")]);
const doze = Array.from({ length: 12 }, (_, i) => `q${i + 1}`);

test("refazer: 10 de erro mais recente, ordenadas por facilidade, sem sortear do banco", async () => {
  const { deps, chamadas } = montar({ plano: comRefazer("disponivel"), pendentes: doze, facil: { q2: 90 }, contar: 1 });
  assert.deepEqual(await pedir(deps, "refazer"), { ok: true, simuladoId: "novo", aviso: null });
  assert.deepEqual(chamadas.inserir[0].questaoIds, ["q2", "q1", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"]);
  assert.equal(chamadas.inserir[0].etapa, "refazer");
  assert.equal(chamadas.inserir[0].titulo, "Refazer: Porcentagem");
  assert.equal(chamadas.inserir[0].rodada, 2);
  assert.equal(chamadas.candidatas, 0);
});
test("refazer sem pendentes", async () => {
  const { deps } = montar({ plano: comRefazer("disponivel"), pendentes: [] });
  assert.deepEqual(await pedir(deps, "refazer"), { ok: false, erro: "Não há questões para refazer em Porcentagem." });
});
test("refazer antes de estudar é recusado", async () => {
  const { deps } = montar({ plano: comRefazer("aguardando"), pendentes: ["q1"] });
  assert.deepEqual(await pedir(deps, "refazer"), { ok: false, erro: "Estude o conteúdo antes de refazer as questões." });
});
test("refazer feito é recusado; praticar com refazer pendente é aceito", async () => {
  const a = montar({ plano: comRefazer("feita"), pendentes: ["q1"] });
  assert.deepEqual(await pedir(a.deps, "refazer"), { ok: false, erro: "Esta etapa ainda não está disponível." });
  const b = montar({ plano: comRefazer("disponivel"), pendentes: ["q1"] });
  assert.equal((await pedir(b.deps, "pratica")).ok, true);
  assert.equal(b.chamadas.inserir[0].etapa, "pratica");
});
test("refazer aberto é reutilizado; duplo clique (colisão) devolve o aberto", async () => {
  const a = montar({ plano: comRefazer("disponivel", "r1"), pendentes: ["q1"] });
  assert.deepEqual(await pedir(a.deps, "refazer"), { ok: true, simuladoId: "r1", aviso: null });
  const b = montar({ plano: comRefazer("disponivel"), pendentes: ["q1"], insercao: "colisao", aberto: "outro" });
  assert.deepEqual(await pedir(b.deps, "refazer"), { ok: true, simuladoId: "outro", aviso: null });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx tsx --test src/lib/plano/nucleo.test.ts` → FAIL.
- [ ] **Step 3: Implementar** núcleo, dados e ação.
- [ ] **Step 4: Verificar** — `npm test` PASS; `npx tsc --noEmit -p .` sem erros.
- [ ] **Step 5: Commit** — `feat: criar o treino de refazer as erradas`

---

### Task 4: Refazer fora dos números (desempenho e relatórios)

**Files:**
- Modify: `src/lib/desempenho/calculos.ts`, `src/lib/desempenho/calculos.test.ts`, `src/lib/relatorios/calculos.ts`, `src/lib/relatorios/calculos.test.ts`, `src/lib/relatorios/dados.ts`

**Interfaces:**
- Consumes: Task 1 (`ehRefazer`).
- Produces: em `src/lib/relatorios/calculos.ts`, `export function treinosQueContam<T extends { s: { plano_etapa?: string | null } }>(treinos: T[]): T[]` (tira os de refazer).

**Mudanças:** `ehTreinoDepois` devolve `true` também para `planoEtapa === "refazer"`. `evolucao` ignora respostas com `ehRefazer(r.planoEtapa)`. Em `relatorios/dados.ts`: `COLUNAS_SIMULADO` ganha `plano_etapa`, `SimuladoLido` ganha `plano_etapa?: string | null`, e `respostasDasContas` usa `treinosQueContam(e.treinos)`. `treinosDaPessoa` não muda (o refazer continua listado).

- [ ] **Step 1: Testes**
  - `calculos.test.ts` (desempenho): com uma resposta inicial errada da questão `q1` (simulado do professor) e uma resposta certa de `q1` num treino `planoEtapa: "refazer"`: `respostasIniciais(...)` só tem a do professor; `resumoGeral(respostasIniciais(...))` dá `{ respondidas: 1, acertos: 0, erros: 1, emBranco: 0, taxaAcerto: 0, refeitas: 0 }`; `evolucao(...)` não tem a atividade do refazer e continua tendo uma de `planoEtapa: "pratica"`.
  - `calculos.test.ts` (relatórios): `treinosQueContam([{ s: { plano_etapa: null } }, { s: { plano_etapa: "pratica" } }, { s: { plano_etapa: "refazer" } }, { s: {} }])` devolve o 1º, o 2º e o 4º.
- [ ] **Step 2: Rodar e ver falhar** — `npx tsx --test src/lib/desempenho/calculos.test.ts src/lib/relatorios/calculos.test.ts` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** — `npm test` PASS; `npx tsc --noEmit -p .` sem erros.
- [ ] **Step 5: Commit** — `feat: refazer fora do desempenho e dos relatórios`

---

### Task 5: Treinos livres preferem questões nunca vistas

**Files:**
- Modify: `src/lib/simulados/regras.ts`, `src/lib/simulados/simulados.test.ts`, `src/actions/simulados-aluno.ts`

**Interfaces:**
- Produces (em `regras.ts`):
  - `export function ordenarPorNovidade(ids: string[], vistas: Record<string, string>, aleatorio: () => number = Math.random): string[]`: as não vistas embaralhadas primeiro; depois as vistas, da data mais antiga para a mais recente (empate: id crescente).
  - `export function sortearEquilibradoEmOrdem<T>(grupos: T[][], quantidade: number, aleatorio: () => number = Math.random): T[]`: igual a `sortearEquilibrado`, mas **sem** embaralhar dentro de cada grupo (só a ordem dos grupos e o caderno no fim).

**Ação:** `criarTreino` lê `vistasDaConta(aluno.id)` (de `@/lib/plano/dados`). Uma matéria: `sortear(ordenarPorNovidade(candidatos, vistas).slice(0, pedidas), pedidas)`. Várias: `sortearEquilibradoEmOrdem(materias.map((m) => ordenarPorNovidade(<ids da matéria>, vistas)), pedidas)`. Nada mais muda (limites, filtros, mensagem de "não há questões").

- [ ] **Step 1: Testes em `simulados.test.ts`**

```ts
test("ordenarPorNovidade: nunca vistas primeiro, depois da vista há mais tempo", () => {
  const r = ordenarPorNovidade(["a", "b", "c", "d"], { c: "2026-10-01T00:00:00.000Z", a: "2026-11-01T00:00:00.000Z" });
  assert.deepEqual([...r.slice(0, 2)].sort(), ["b", "d"]);
  assert.deepEqual(r.slice(2), ["c", "a"]);
});
test("ordenarPorNovidade: sem vistas, todas, sem repetir", () => {
  assert.deepEqual([...ordenarPorNovidade(["x", "y", "z"], {})].sort(), ["x", "y", "z"]);
});
test("sortearEquilibradoEmOrdem: respeita a ordem dentro da matéria e equilibra", () => {
  const r = sortearEquilibradoEmOrdem([["a1", "a2", "a3"], ["b1"]], 3);
  assert.deepEqual([...r].sort(), ["a1", "a2", "b1"]);
  assert.equal(sortearEquilibradoEmOrdem([["a1"], ["b1"]], 10).length, 2);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx tsx --test src/lib/simulados/simulados.test.ts` → FAIL.
- [ ] **Step 3: Implementar** as duas funções e a mudança em `criarTreino`.
- [ ] **Step 4: Verificar** — `npm test` PASS; `npx tsc --noEmit -p .` sem erros.
- [ ] **Step 5: Commit** — `feat: treinos livres preferem questões nunca vistas`

---

### Task 6: Telas (plano, estudo e Meu desempenho)

**Files:**
- Create: `src/components/estudos/BotaoEstudeiRefazer.tsx`
- Modify: `src/components/plano/rotulos.ts`, `src/components/plano/CartaoConteudoPlano.tsx`, `src/components/desempenho/AcaoTreino.tsx`, `src/components/estudos/PaginaEstudo.tsx` (e o `.module.css` dela, se a faixa de 4 passos precisar)

**Interfaces:**
- Consumes: Task 2 (`etapaDeTreino`, `sugestaoDepoisDeEstudar`, `Etapa.pendentes`), Task 3 (`criarTreinoDoPlano` com `"refazer"`), `marcarRevisado` (`src/actions/plano-estudo.ts`), `MAX_REFAZER`.
- Produces:
  - `quantidadeDaEtapa(etapa: EtapaPlano, regras: RegrasAprendizagem, pendentes = 0): number` (refazer → `min(pendentes, MAX_REFAZER)`).
  - `rotuloEtapa(etapa, regras, aberto, situacao, pendentes = 0): string` (refazer → `"Refazer N questões"`, ou `"Refazer 1 questão"`; aberto → `"Continuar treino"`, como hoje).
  - `BotaoEstudeiRefazer({ conteudo, className }: { conteudo: string; className?: string })`, cliente.

**Comportamento:**
- **Cartão do plano:** `estadoTexto` para `refazer`: `aguardando` → `"Depois de estudar"`; `disponivel` com `resultado` e sem treino aberto → `"Faltam N"` (`N = pendentes`); os outros como hoje. `AcoesEtapa`: refazer `aguardando` ou `feita` → sem botão; `disponivel` → `AcaoTreino` com `etapa="refazer"`. No `AcaoTreino` do cartão e no de `components/desempenho/AcaoTreino.tsx`, o aviso e o esconder por `extras.disponiveis` **não** valem para `refazer`; o rótulo usa `pendentes` da etapa.
- **`BotaoEstudeiRefazer`:** rótulo `"Já estudei, refazer as erradas"` (ocupado: `"Montando treino…"`). Chama `marcarRevisado({ conteudo })`; se falhar, mostra o erro e para. Depois `criarTreinoDoPlano({ conteudo, etapa: "refazer" })`; ok → `router.push("/aluno/simulados/<id>")`; erro → mostra o erro e `router.refresh()`. Mesmo visual e padrão de erro de `BotaoTreinoPlano`.
- **Página do estudo (`ProximoPasso`):** o `aviso` e o `esconder` por `extras.disponiveis` (linhas 83-84 de hoje) também não valem quando a etapa é `refazer`. Se a etapa `revisar` não está feita e `sugestaoDepoisDeEstudar(plano) === "refazer"` → título `"Agora refaça as que você errou"`, texto `"N questões de <nome> que você errou ou deixou em branco. Uma chance em cada; no fim você vê a resposta certa."` (`N = quantidadeDaEtapa("refazer", regras, pendentes)`) e só o `BotaoEstudeiRefazer`. Se a sugestão já é `refazer` → mesmo título e texto, `"Já estudei"` não aparece (está feito) e o `BotaoTreinoPlano` de refazer. Nos outros casos, como hoje.
- **Faixa de etapas:** com a etapa de refazer, 4 passos: Estudar ("Você está aqui"), Refazer as erradas (`"N questões do simulado"`), Praticar, Revisão. Feito marcado com `data-feito` como os outros.

- [ ] **Step 1: Implementar** `rotulos.ts`, o cartão, os dois `AcaoTreino`, o botão novo e a página do estudo.
- [ ] **Step 2: Verificar** — `npm test` PASS; `npm run lint` sem erros; `npx tsc --noEmit -p .` sem erros.
- [ ] **Step 3: Conferir à mão** os quatro casos do `ProximoPasso` lendo o código contra a tabela acima (não há teste de componente no projeto).
- [ ] **Step 4: Commit** — `feat: telas do refazer as erradas`

---

### Task 7: Integração e publicação

**Files:**
- Modify: `CLAUDE.md` (seção "Próximo passo": tirar "voltar às questões erradas" e "Treinar este assunto não repetir"; item 14 ou 15: registrar o refazer com a spec e o SQL `db/2026-11-16-refazer-erradas.sql`)

- [ ] **Step 1:** `git fetch origin && git rebase origin/master`; resolver conflitos se houver.
- [ ] **Step 2:** `npm test`, `npm run lint`, `npm run build` — todos sem erro.
- [ ] **Step 3:** atualizar `CLAUDE.md`; commit `docs: CLAUDE.md com refazer as erradas`.
- [ ] **Step 4: Parar e pedir ao Peter** para colar `db/2026-11-16-refazer-erradas.sql` no SQL Editor e mandar o resultado do `select` do fim. Só seguir quando a linha mostrar `'refazer'` na lista.
- [ ] **Step 5:** `git push origin HEAD:master`.
- [ ] **Step 6:** conferir no www (deploy "success" na Vercel não basta): a página `/aluno/plano` abre sem erro.
