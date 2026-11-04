# Recomendações e plano de estudo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** recomendações configuráveis e um plano de estudo individual em `/aluno/plano`, derivados do desempenho
inicial do aluno, com treinos de diagnóstico, prática e revisão posterior escolhidos pela classificação fina.

**Architecture:** regras e cálculos em funções puras em `src/lib/plano/`, testadas com `tsx --test`. Elas são:

- regras;
- textos;
- escolha de questões;
- máquina de estados do plano;
- montagem dos materiais;
- núcleo da ação de criar treino, com dependências injetadas.

O servidor (`src/lib/plano/dados.ts`) lê o Supabase e monta tudo para as páginas. O painel do projeto 1 passa a
separar o desempenho inicial dos treinos do plano e a usar as regras da escola. O plano não é gravado; o banco
guarda só:

- os treinos do plano (três colunas novas em `simulados`);
- as marcas de "Já revisei";
- o tempo por semana;
- as regras da escola.

**Tech Stack:** Next.js 16.2 (server components + server actions), React 19, TypeScript, Supabase
(`@/lib/supabase/client`), zod, lucide-react, CSS Modules, `node:test` via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-03-plano-de-estudo-design.md`. Leia a spec inteira antes de cada tarefa:
ela traz os textos exatos, os padrões e os limites das regras e as regras da máquina de estados.

## Global Constraints

- **Ambiente:**
  - Respostas, textos de tela e mensagens de commit em pt-BR.
  - Trabalhar no worktree `.worktrees/plano-estudo` (branch `plano-estudo`).
  - Nunca `git stash` sem tag.
  - Next.js 16 tem mudanças: leia o guia relevante em `node_modules/next/dist/docs/` antes de usar uma API do Next
    que você não viu no código do projeto.
- **Server actions:** nunca lançam para o cliente; devolvem `{ ok: true, ... } | { ok: false, erro: string }`. A
  conta vem sempre da sessão (`getAlunoAtual()` / `getProfessorAtual()`), nunca de um parâmetro.
- **Textos:** são sugestões, nunca diagnósticos. Singular e plural: "1 questão" / "2 questões".
- **Visual:** o padrão do skill `status-visual-aluno` (invoque-o nas tarefas de tela). Sem texto cinza.
  Funciona em 1340px e em 390px, sem rolagem horizontal.
- **Valores padrão das regras:**
  - `minQuestoesPrioridade` 5 (2–30), `taxaErroPrioridade` 60 (30–95);
  - `questoesPratica` 5 (3–15), `questoesDiagnostico` 5 (3–15), `questoesRevisao` 3 (2–10);
  - `diasRevisao` 7 (1–60), `metaAcerto` 60 (30–100), `diasSemRepetir` 30 (0–365);
  - `minutosPorQuestao` 3 (1–10), `minutosMaterial` 15 (5–120).
- **Tempo por semana:** as opções são 30, 60, 120, 180, 300 e 480 min; o padrão é 120.
- **Testes:** todo arquivo `*.test.ts` novo entra no script `test` do `package.json`, no fim da lista.
- **Comandos de verificação:** `npm test`, `npm run lint` e `npm run build` passam no fim de cada tarefa que
  muda código (`build` só nas tarefas de tela e na final).
- **Commits:** terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Dois cliques em "Praticar"** (ou duas abas): um só treino; a segunda chamada recebe o mesmo `simuladoId`
  (Task 6, colisão no índice único).
- **Conteúdo sem assunto (`materia:matematica`):**
  - funciona de ponta a ponta: chave válida, candidatas pela matéria, texto com "Matemática (sem assunto)";
  - `materia:xyz` e textos soltos são recusados (Task 5 `chaveValida`, Task 6).
- **Tentativa entregue com `acertos`/`total` nulos ou `total = 0`:** não quebra e não conclui a etapa
  (Task 4, "resultado nulo não passa").
- **Aluno que já viu todas as questões do conteúdo há pouco:**
  - o botão some e aparece "Não há questões novas de X no banco agora.";
  - a ação devolve o mesmo erro (Task 3 `contarDisponiveis`, Task 6).
- **Regras da escola gravadas pela metade ou com lixo no jsonb:** cada campo inválido volta ao padrão, e o painel
  e o plano usam as regras da escola (Task 1 `normalizarRegras`, Task 2 `montarPainel` com regras próprias).

---

### Task 1: SQL, tipos, regras e textos

**Files:**
- Create: `db/2026-11-03-plano-estudo.sql`
- Modify: `db/schema.sql` (bloco novo no fim, igual ao arquivo acima)
- Modify: `src/lib/types.ts` (`Simulado`, `Escola`, `Database.Tables`)
- Create: `src/lib/plano/tipos.ts`, `src/lib/plano/regras.ts`, `src/lib/plano/textos.ts`, `src/lib/plano/regras-servidor.ts`
- Test: `src/lib/plano/regras.test.ts`, `src/lib/plano/textos.test.ts`

**Interfaces:**
- Produces (`src/lib/plano/tipos.ts`):
  ```ts
  export type EtapaPlano = "diagnostico" | "pratica" | "revisao";
  export type RegrasAprendizagem = { minQuestoesPrioridade: number; taxaErroPrioridade: number; questoesPratica: number;
    questoesDiagnostico: number; questoesRevisao: number; diasRevisao: number; metaAcerto: number; diasSemRepetir: number;
    minutosPorQuestao: number; minutosMaterial: number };
  export type Foco = { topicoId: string; nome: string; erros: number; questoes: number };
  ```
- Produces (`regras.ts`):
  - `REGRAS_PADRAO: RegrasAprendizagem`;
  - `LIMITES: Record<keyof RegrasAprendizagem, { min: number; max: number; rotulo: string; ajuda: string }>`;
  - `normalizarRegras(v: unknown): RegrasAprendizagem`;
  - `validarRegras(v: unknown): { ok: true; regras: RegrasAprendizagem } | { ok: false; erro: string }`;
  - `TEMPOS_SEMANA = [30, 60, 120, 180, 300, 480] as const`, `TEMPO_SEMANA_PADRAO = 120`;
  - `tempoSemanaValido(m: unknown): m is number`.
- Produces (`textos.ts`):
  - `textoRecomendacao(c: { tipo: "revisar" | "mais_respostas"; nome: string; erros: number; questoes: number; foco: Foco | null }, r: RegrasAprendizagem): string`;
  - `textoCriterio(r): string`;
  - `formatarMinutos(min: number): string`;
  - `textoSemMaterial(nome: string, temResolucao: boolean): string`;
  - `textoQuestoesDisponiveis(nome: string, disponiveis: number, pedidas: number): string | null`;
  - `textoResolucoes(n: number): string`;
  - `tituloTreino(etapa: EtapaPlano, nome: string): string`.
- Produces (`regras-servidor.ts`):
  - `regrasDaEscola(escolaId: string): Promise<RegrasAprendizagem>`: com erro ou coluna ausente, devolve `REGRAS_PADRAO`, como `mediaAprovacaoDaEscola`;
  - `gravarRegrasDaEscola(escolaId: string, regras: RegrasAprendizagem | null): Promise<void>`: lança em erro.
- Produces (tipos do banco em `types.ts`):
  - `Simulado` ganha `plano_conteudo?: string | null; plano_etapa?: EtapaPlano | null; plano_rodada?: number | null`
    (opcionais, para não quebrar objetos montados em testes);
  - `Escola` ganha `regras_aprendizagem?: unknown`;
  - `Database.Tables` ganha:
    - `planos_estudo` (Row `{ conta_id; escola_id; minutos_semana: number; updated_at }`);
    - `plano_revisoes` (Row `{ conta_id; conteudo; revisado_em }`).

- [ ] **Step 1: SQL.** Escreva `db/2026-11-03-plano-estudo.sql`:
  - **Corpo:** exatamente o bloco da seção "Banco de dados" da spec;
  - **RLS e políticas:** `alter table ... enable row level security` e `drop policy if exists` + `create policy
    "acesso_total_<tabela>" ... for all using (true) with check (true)` para as duas tabelas, como em
    `db/2026-11-02-classificacao-fina.sql`;
  - **Fim:** `NOTIFY pgrst, 'reload schema';`;
  - **Cabeçalho:** um comentário dizendo "Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run (pode rodar de novo sem erro)".

  Copie o mesmo bloco no fim de `db/schema.sql` sob o título `-- ===== Plano de estudo (2026-11-03) =====`.
- [ ] **Step 2: Conferir o SQL no PGlite.** Monte uma pasta no scratchpad da sessão:
  - instale `@electric-sql/pglite@0.5.10` com `npm init -y && npm i`;
  - rode um script Node que cria stubs mínimos de `escolas(id uuid primary key)`,
    `alunos_contas(id uuid primary key)` e `simulados` com as colunas de `db/schema.sql` necessárias (`id`,
    `escola_id`, `tipo`, `conta_id`, `titulo`);
  - em seguida, execute o arquivo **duas vezes**.

  Esperado: nenhuma exceção.
  - O `check` recusa um insert com `plano_etapa='pratica'` e `plano_rodada` nulo.
  - O índice único recusa o segundo insert igual com código `23505`.
  - `NOTIFY` pode ser removido só no teste.
- [ ] **Step 3: Testes de regras** (`regras.test.ts`):
  ```ts
  test("normalizarRegras: nulo, lixo e parcial caem no padrão campo a campo", () => {
    assert.deepEqual(normalizarRegras(null), REGRAS_PADRAO);
    assert.deepEqual(normalizarRegras("x"), REGRAS_PADRAO);
    const r = normalizarRegras({ taxaErroPrioridade: "abc", minQuestoesPrioridade: 8, diasRevisao: 0, metaAcerto: 70.5 });
    assert.equal(r.taxaErroPrioridade, 60); assert.equal(r.minQuestoesPrioridade, 8);
    assert.equal(r.diasRevisao, 7); /* fora do limite */ assert.equal(r.metaAcerto, 60); /* não inteiro */
  });
  test("validarRegras: exige os 10 inteiros dentro dos limites e diz qual está errado", () => {
    assert.deepEqual(validarRegras(REGRAS_PADRAO), { ok: true, regras: REGRAS_PADRAO });
    const e = validarRegras({ ...REGRAS_PADRAO, questoesPratica: 20 });
    assert.equal(e.ok, false); assert.match((e as { erro: string }).erro, /Questões na prática: use um número inteiro de 3 a 15\./);
    assert.equal(validarRegras({ ...REGRAS_PADRAO, metaAcerto: undefined }).ok, false);
  });
  test("tempoSemanaValido: só as opções da lista", () => {
    assert.ok(tempoSemanaValido(120)); assert.ok(!tempoSemanaValido(45)); assert.ok(!tempoSemanaValido("120"));
  });
  ```
  **Rótulos de `LIMITES`, na ordem dos campos:**
  - "Questões para revisão prioritária";
  - "Erro para revisão prioritária (%)";
  - "Questões na prática";
  - "Questões no diagnóstico";
  - "Questões na revisão posterior";
  - "Dias até a revisão posterior";
  - "Meta de acerto (%)";
  - "Dias sem repetir questão";
  - "Minutos por questão";
  - "Minutos por material".

  **`ajuda`:** uma frase curta que diz para quê serve, tirada da coluna "Para quê" da tabela da spec.
- [ ] **Step 4: Testes de textos** (`textos.test.ts`), com `R = REGRAS_PADRAO`:
  ```ts
  assert.equal(textoRecomendacao({ tipo: "revisar", nome: "Porcentagem", erros: 7, questoes: 10, foco: null }, R),
    "Você errou 7 de 10 questões de Porcentagem. Revise esse conteúdo e depois resolva uma sequência de 5 questões, começando pelas mais simples.");
  assert.equal(textoRecomendacao({ tipo: "revisar", nome: "Morfologia", erros: 7, questoes: 10, foco: { topicoId: "t", nome: "Derivação parassintética", erros: 4, questoes: 5 } }, R),
    "Você errou 7 de 10 questões de Morfologia, 4 delas sobre Derivação parassintética. Revise esse tópico e depois resolva uma sequência de 5 questões, começando pelas mais simples.");
  assert.equal(textoRecomendacao({ tipo: "mais_respostas", nome: "Porcentagem", erros: 1, questoes: 1, foco: null }, R),
    "Você respondeu só 1 questão de Porcentagem e errou 1. Precisamos de mais respostas: resolva 5 questões de diagnóstico para entender melhor.");
  assert.equal(textoCriterio({ ...R, minQuestoesPrioridade: 8, taxaErroPrioridade: 70 }),
    "Sugestão pelo critério: 8 ou mais questões e 70% ou mais de erro. Um resultado isolado não comprova uma dificuldade.");
  assert.deepEqual([15, 60, 105, 120].map(formatarMinutos), ["15 min", "1 h", "1 h 45", "2 h"]);
  assert.equal(textoSemMaterial("Porcentagem", true), "Ainda não há material de revisão para Porcentagem.");
  assert.equal(textoSemMaterial("Porcentagem", false), "Ainda não há material de revisão para Porcentagem. Peça ao seu professor uma indicação.");
  assert.equal(textoQuestoesDisponiveis("Porcentagem", 5, 5), null);
  assert.equal(textoQuestoesDisponiveis("Porcentagem", 0, 5), "Não há questões novas de Porcentagem no banco agora.");
  assert.equal(textoQuestoesDisponiveis("Porcentagem", 1, 5), "Só há 1 questão nova de Porcentagem agora; a sequência terá 1.");
  assert.equal(textoQuestoesDisponiveis("Porcentagem", 3, 5), "Só há 3 questões novas de Porcentagem agora; a sequência terá 3.");
  assert.equal(textoResolucoes(1), "Releia a resolução da questão que você errou");
  assert.equal(textoResolucoes(3), "Releia as resoluções das 3 questões que você errou");
  assert.equal(tituloTreino("pratica", "Porcentagem"), "Prática: Porcentagem");
  assert.equal(tituloTreino("diagnostico", "X"), "Diagnóstico: X"); assert.equal(tituloTreino("revisao", "X"), "Revisão: X");
  assert.equal(tituloTreino("pratica", "a".repeat(200)).length, 120);
  ```
- [ ] **Step 5: Rodar e ver falhar.** Rode `npx tsx --test src/lib/plano/regras.test.ts src/lib/plano/textos.test.ts`.
  Esperado: FAIL (módulos inexistentes).
- [ ] **Step 6: Implementar.** Crie `tipos.ts`, `regras.ts`, `textos.ts` e `regras-servidor.ts`, e altere `types.ts`.
  - **`validarRegras`:** use zod.
  - **`regras-servidor.ts`:** lê e grava `escolas.regras_aprendizagem` (`null` volta ao padrão).
- [ ] **Step 7: Rodar e ver passar.** Os dois testes acima passam. Acrescente os dois arquivos ao script `test` e
  rode `npm test` e `npm run lint`: tudo verde.
- [ ] **Step 8: Commit.** Mensagem: `feat: SQL, regras e textos do plano de estudo`.

---

### Task 2: Painel com desempenho inicial, foco e regras da escola

**Files:**
- Modify: `src/lib/desempenho/tipos.ts`, `src/lib/desempenho/calculos.ts`, `src/lib/desempenho/regras.ts`, `src/lib/desempenho/dados.ts`
- Test: `src/lib/desempenho/calculos.test.ts`

**Interfaces:**
- Consumes: Task 1 (`RegrasAprendizagem`, `REGRAS_PADRAO`, `Foco`, `EtapaPlano`, `textoRecomendacao`, `textoCriterio`).
- Produces:
  - `RespostaDesempenho` ganha `topicoId: string | null; topicoNome: string | null; planoEtapa: EtapaPlano | null; planoConteudo: string | null`.
  - `TopicoDesempenho = { topicoId: string; nome: string; questoes: number; acertos: number; erros: number; emBranco: number; taxaErro: number; legenda: string }`.
  - `ConteudoDesempenho` ganha `foco: Foco | null; topicos: TopicoDesempenho[]` (só os tópicos com alguma
    questão classificada, pior taxa primeiro).
  - `PainelDesempenho` ganha `conteudos: ConteudoDesempenho[]` (todos, do desempenho inicial) e `criterio: string`.
  - `desempenho/regras.ts`:
    - `export type Regras = RegrasAprendizagem & { maxConteudosGrafico: number }`;
    - `export const REGRAS: Regras = { ...REGRAS_PADRAO, maxConteudosGrafico: 8 }`;
    - `export function regrasDoPainel(r: RegrasAprendizagem): Regras`;
    - `export const FRASE_INICIAL = "Os números mostram o desempenho inicial; os treinos do plano aparecem na evolução e no plano de estudo."`;
    - `AVISO_DIFICULDADE` continua;
    - `textoRevisar` e `textoMaisRespostas` saem; use os textos da Task 1.
  - `calculos.ts`:
    - `export function ehTreinoDepois(r: Pick<RespostaDesempenho, "planoEtapa">): boolean`: verdadeiro para `"pratica"` e `"revisao"`;
    - `export function respostasIniciais(rs: RespostaDesempenho[]): RespostaDesempenho[]`;
    - `export function focoDoConteudo(primeiras: RespostaDesempenho[]): Foco | null`: recebe as primeiras respostas de **um** conteúdo.
    - `Prioridade.texto` passa a vir de `textoRecomendacao(..., regras)`, com o foco do conteúdo.
  - `questoesErradas(rs, chave)` passa a usar só as respostas iniciais.

- [ ] **Step 1: Atualizar a fábrica dos testes.** `r()` ganha `topicoId: null, topicoNome: null, planoEtapa: null,
  planoConteudo: null`, e `c()` ganha `foco: null, topicos: []`. Ajuste os testes antigos que comparavam
  `textoRevisar` para os textos novos.
- [ ] **Step 2: Testes novos:**
  ```ts
  test("montarPainel: prática e revisão do plano ficam fora dos totais, dos conteúdos e das prioridades, mas dentro da evolução", () => {
    const base = [1,2,3,4,5].map(() => r({ correta: false, alternativa: "B" }));            // 5 erros no as1
    const plano = [1,2,3].map(() => r({ atividadeId: "a2", tentativaId: "t2", planoEtapa: "pratica", planoConteudo: "as1", entregueEm: "2026-10-09T12:00:00Z" }));
    const diag = [r({ atividadeId: "a3", tentativaId: "t3", planoEtapa: "diagnostico", planoConteudo: "as1", correta: false, alternativa: "C" })];
    const p = montarPainel([...base, ...plano, ...diag]);
    assert.equal(p.resumo.respondidas, 6);                // 5 + diagnóstico, sem a prática
    assert.equal(p.evolucao.length, 3);
    assert.equal(p.prioridades[0].tipo, "revisar");
  });
  test("montarPainel: usa as regras da escola", () => {
    const rs = [1,2].map(() => r({ correta: false, alternativa: "B" }));
    assert.equal(montarPainel(rs).prioridades[0].tipo, "mais_respostas");
    assert.equal(montarPainel(rs, regrasDoPainel({ ...REGRAS_PADRAO, minQuestoesPrioridade: 2 })).prioridades[0].tipo, "revisar");
    assert.match(montarPainel(rs, regrasDoPainel({ ...REGRAS_PADRAO, minQuestoesPrioridade: 2 })).criterio, /^Sugestão pelo critério: 2 ou mais/);
  });
  test("focoDoConteudo: tópico com mais erros, mínimo de 2 erros, empate pela taxa e depois pelo nome", () => {
    const t = (topicoId: string | null, topicoNome: string | null, ok: boolean) => r({ topicoId, topicoNome, correta: ok, alternativa: ok ? "A" : "B" });
    assert.equal(focoDoConteudo([t("t1", "Juros", false), t(null, null, false)]), null);       // só 1 erro no tópico
    assert.deepEqual(focoDoConteudo([t("t1", "Juros", false), t("t1", "Juros", false), t("t1", "Juros", true)]), { topicoId: "t1", nome: "Juros", erros: 2, questoes: 3 });
    const emp = focoDoConteudo([t("tb", "B", false), t("tb", "B", false), t("ta", "A", false), t("ta", "A", false), t("ta", "A", true)]);
    assert.equal(emp?.topicoId, "tb");                                                          // 2/2 > 2/3
    assert.equal(focoDoConteudo([t("tz", "Z", false), t("tz", "Z", false), t("ty", "Y", false), t("ty", "Y", false)])?.nome, "Y");
  });
  test("porConteudo: tópicos do conteúdo com legenda, só os classificados", () => {
    const rs = [r({ topicoId: "t1", topicoNome: "Juros", correta: false, alternativa: "B" }), r({ topicoId: "t1", topicoNome: "Juros" }), r()];
    const [c1] = porConteudo(rs);
    assert.deepEqual(c1.topicos.map((t) => [t.nome, t.legenda]), [["Juros", "50% de erro — 1 erro em 2 questões"]]);
  });
  ```
- [ ] **Step 3: Rodar e ver falhar.** Rode `npx tsx --test src/lib/desempenho/calculos.test.ts`. Esperado: FAIL.
- [ ] **Step 4: Implementar.**
  - **Funções puras:** `montarPainel(rs, regras = REGRAS)` faz resumo, conteúdos, `maisErro`, matérias e
    prioridades sobre `respostasIniciais(rs)`, e a evolução sobre todas as respostas.
  - **`desempenho/dados.ts`:**
    - lê `questoes.topico_id` e os nomes em `topicos`, em blocos, como já faz com `assuntos`;
    - lê `simulados.plano_etapa` e `plano_conteudo` em `lerSimulados`;
    - preenche os quatro campos novos;
    - `respostasDaTurma` continua igual (os campos do plano vêm nulos).
  - **`GraficoConteudos.tsx`:** ganha a prop `minQuestoes: number` e para de importar `REGRAS`. Quem chama passa
    `REGRAS.minQuestoesPrioridade` por enquanto; a Task 9 troca pelas regras da escola.
- [ ] **Step 5: Rodar e ver passar.** Rode `npm test` e `npm run lint`: verde.
- [ ] **Step 6: Commit.** Mensagem: `feat: painel separa desempenho inicial, tópico de foco e regras configuráveis`.

---

### Task 3: Escolha das questões

**Files:**
- Create: `src/lib/plano/selecao.ts`
- Test: `src/lib/plano/selecao.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Candidata = { id: string; topicoId: string | null; habilidadeIds: string[]; ultimaVez: string | null };
  export type PedidoSelecao = { candidatas: Candidata[]; quantidade: number; focoTopicoId: string | null; habilidadeIds: string[]; agora: Date; diasSemRepetir: number; sortear?: () => number };
  export function selecionarQuestoes(p: PedidoSelecao): { ids: string[]; faltaram: number; repetidas: number };
  export function ordenarPorFacilidade(ids: string[], facilidade: Record<string, number | null>): string[];
  export function facilidadeDe(contagem: { acertos: number; total: number } | null, dificuldadeGeracao: "facil" | "media" | "dificil" | null): number | null;
  export function contarDisponiveis(candidatas: Candidata[], agora: Date, diasSemRepetir: number): number;
  ```

**Algoritmo de `selecionarQuestoes`:**

1. **Exclui:** as questões com `ultimaVez` a menos de `diasSemRepetir` dias de `agora`.
2. **Ordena pela chave** `(grupo, relevância, desempate)`:
   - **grupo:** 0 para nunca vista, 1 para vista há mais tempo;
   - **relevância:**
     - 0: do tópico de foco **e** com habilidade-alvo;
     - 1: só do tópico de foco;
     - 2: só com habilidade-alvo;
     - 3: as demais.
   - **desempate:** no grupo 0, ordem embaralhada (Fisher–Yates com `sortear`, padrão `Math.random`); no grupo 1,
     `ultimaVez` crescente.
3. **Corta** nas `quantidade` primeiras.
4. **Devolve:**
   - `faltaram = quantidade - ids.length`;
   - `repetidas` = quantas das escolhidas têm `ultimaVez`.

**Outras regras:**

- **`ordenarPorFacilidade`:** ordem estável por facilidade decrescente; nula conta como 50.
- **`facilidadeDe`:** com `total >= 5`, `Math.round(acertos / total * 100)`; senão `facil` 80, `media` 50,
  `dificil` 20; senão `null`.

- [ ] **Step 1: Testes:**
  ```ts
  const agora = new Date("2026-11-03T12:00:00Z");
  const q = (id: string, o: Partial<Candidata> = {}): Candidata => ({ id, topicoId: null, habilidadeIds: [], ultimaVez: null, ...o });
  const fixo = () => 0.5;
  test("exclui as vistas há menos de diasSemRepetir e põe as novas antes das antigas", () => {
    const r = selecionarQuestoes({ candidatas: [q("velha", { ultimaVez: "2026-09-01T00:00:00Z" }), q("recente", { ultimaVez: "2026-10-30T00:00:00Z" }), q("nova")], quantidade: 3, focoTopicoId: null, habilidadeIds: [], agora, diasSemRepetir: 30, sortear: fixo });
    assert.deepEqual(r, { ids: ["nova", "velha"], faltaram: 1, repetidas: 1 });
  });
  test("relevância: foco+habilidade, foco, habilidade, resto", () => {
    const cs = [q("resto"), q("hab", { habilidadeIds: ["h1"] }), q("foco", { topicoId: "t1" }), q("ambos", { topicoId: "t1", habilidadeIds: ["h1"] })];
    assert.deepEqual(selecionarQuestoes({ candidatas: cs, quantidade: 4, focoTopicoId: "t1", habilidadeIds: ["h1"], agora, diasSemRepetir: 30, sortear: fixo }).ids, ["ambos", "foco", "hab", "resto"]);
  });
  test("antigas da mais antiga para a mais recente", () => {
    const cs = [q("b", { ultimaVez: "2026-08-01T00:00:00Z" }), q("a", { ultimaVez: "2026-07-01T00:00:00Z" })];
    assert.deepEqual(selecionarQuestoes({ candidatas: cs, quantidade: 2, focoTopicoId: null, habilidadeIds: [], agora, diasSemRepetir: 30 }).ids, ["a", "b"]);
  });
  test("sorteio injetado decide a ordem dentro do mesmo grupo e relevância", () => {
    const cs = [q("x"), q("y"), q("z")];
    const a = selecionarQuestoes({ candidatas: cs, quantidade: 3, focoTopicoId: null, habilidadeIds: [], agora, diasSemRepetir: 30, sortear: () => 0 }).ids;
    const b = selecionarQuestoes({ candidatas: cs, quantidade: 3, focoTopicoId: null, habilidadeIds: [], agora, diasSemRepetir: 30, sortear: () => 0.99 }).ids;
    assert.deepEqual([...a].sort(), ["x", "y", "z"]); assert.notDeepEqual(a, b);
  });
  test("diasSemRepetir 0 não exclui nada", () => {
    assert.equal(selecionarQuestoes({ candidatas: [q("r", { ultimaVez: "2026-11-03T11:00:00Z" })], quantidade: 1, focoTopicoId: null, habilidadeIds: [], agora, diasSemRepetir: 0 }).ids.length, 1);
  });
  test("ordenarPorFacilidade: mais fácil primeiro, nula no meio, estável", () => {
    assert.deepEqual(ordenarPorFacilidade(["d", "n", "f", "m"], { d: 20, n: null, f: 80, m: 50 }), ["f", "n", "m", "d"]);
  });
  test("facilidadeDe: uso com 5+ respostas, senão geração, senão nula", () => {
    assert.equal(facilidadeDe({ acertos: 4, total: 5 }, "dificil"), 80);
    assert.equal(facilidadeDe({ acertos: 1, total: 4 }, "dificil"), 20);
    assert.equal(facilidadeDe(null, "facil"), 80); assert.equal(facilidadeDe(null, null), null);
  });
  test("contarDisponiveis: novas e vistas há tempo; sem as recentes", () => {
    assert.equal(contarDisponiveis([q("n"), q("v", { ultimaVez: "2026-01-01T00:00:00Z" }), q("r", { ultimaVez: "2026-11-01T00:00:00Z" })], agora, 30), 2);
  });
  ```
  (No teste de `ordenarPorFacilidade`, `n` vem antes de `m` porque os dois valem 50 e `n` aparece primeiro na
  entrada: a ordem é estável.)
- [ ] **Step 2: Rodar e ver falhar.** Rode `npx tsx --test src/lib/plano/selecao.test.ts`. Esperado: FAIL.
- [ ] **Step 3: Implementar** `selecao.ts`.
- [ ] **Step 4: Rodar e ver passar.** Acrescente o teste ao script `test` e rode `npm test` e `npm run lint`: verde.
- [ ] **Step 5: Commit.** Mensagem: `feat: escolha de questões do plano (novas, relevância, mais fáceis primeiro)`.

---

### Task 4: Máquina de estados, ordem e tempo da semana

**Files:**
- Create: `src/lib/plano/plano.ts`
- Modify: `src/lib/plano/tipos.ts`
- Test: `src/lib/plano/plano.test.ts`

**Interfaces:**
- Consumes: Task 1 (regras, textos); Task 2 (`ConteudoDesempenho`, `Prioridade`).
- Produces (em `tipos.ts`):
  ```ts
  export type TreinoDoPlano = { simuladoId: string; conteudo: string; etapa: EtapaPlano; rodada: number; criadoEm: string; entregueEm: string | null; acertos: number | null; total: number | null };
  export type TipoEtapa = "revisar" | EtapaPlano;
  export type Etapa = { tipo: TipoEtapa; estado: "feita" | "disponivel" | "aguardando"; minutos: number; disponivelEm: string | null; treinoAberto: string | null; resultado: { acertos: number; total: number } | null };
  export type ConteudoPlano = { chave: string; materia: string | null; materiaRotulo: string; assuntoId: string | null; nome: string;
    situacao: "revisar" | "mais_respostas" | "concluido"; etiqueta: string; rodada: number; texto: string; aviso: string | null;
    inicial: ConteudoDesempenho; foco: Foco | null; etapas: Etapa[]; feitas: number; total: number;
    depois: { acertos: number; total: number } | null; historico: { diagnosticos: number; praticas: number; revisoes: number }; minutosProximos: number };
  export type Plano = { semana: ConteudoPlano[]; depois: ConteudoPlano[]; concluidos: ConteudoPlano[]; progresso: { feitas: number; total: number; pct: number };
    minutosSemana: number; tempoEscolhido: boolean; minutosDaSemana: number; criterio: string };
  export type EntradaPlano = { conteudos: ConteudoDesempenho[]; prioridades: Prioridade[]; treinos: TreinoDoPlano[];
    revisadoEm: Record<string, string>; minutosRevisar: Record<string, number>; prerequisitos: Record<string, string[]>;
    minutosSemana: number | null; regras: RegrasAprendizagem; agora: Date };
  ```
- Produces (em `plano.ts`): `montarPlano(e: EntradaPlano): Plano`, `ordenarComPrerequisitos(chaves: string[], prereqs: Record<string, string[]>): string[]`.

**Regras** (detalhe na spec, seção "Etapas do plano"):

- **Treinos:** só contam os da chave. "Entregue" é `entregueEm != null`. Cada treino entregue tem
  `pct = total > 0 && acertos != null ? acertos / total * 100 : 0`, e passa quando `pct >= metaAcerto`.
- **Situação "revisar"** (o conteúdo é prioridade `revisar`, ou tem prática ou revisão do plano). Percorra as
  práticas e revisões **entregues** em ordem de `entregueEm`, começando com `rodada = 1`,
  `inicioRodada = null`, `praticaOk = null` e `concluido = false`:
  - **prática:**
    - se `concluido` estiver verdadeiro, ele volta a falso, `rodada += 1` e `inicioRodada = entregueEm`;
    - passou: `praticaOk = entregueEm`;
    - não passou: `rodada += 1`, `inicioRodada = entregueEm` e `praticaOk = null`.
  - **revisão** (ignorada se `praticaOk` for nulo):
    - passou: `concluido = true`;
    - não passou: `rodada += 1`, `inicioRodada = entregueEm` e `praticaOk = null`.
  - **Prática aberta com `concluido`:** se `concluido` estiver verdadeiro e existir uma prática **aberta**
    (criada e não entregue), `concluido` volta a falso e `rodada += 1` ("Estudar de novo").
- **Etapas da rodada "revisar":**
  1. **revisar:**
     - `feita` se `revisadoEm[chave]` existe e (`inicioRodada` é nulo ou `revisadoEm > inicioRodada`);
     - senão `disponivel`;
     - `minutos = minutosRevisar[chave] ?? minutosMaterial`.
  2. **pratica:**
     - `feita` se `praticaOk`, senão `disponivel`;
     - `treinoAberto` = a prática aberta, se houver;
     - `resultado` = a última prática entregue da rodada atual;
     - `minutos = questoesPratica × minutosPorQuestao`.
  3. **revisao:**
     - com `praticaOk`: `disponivelEm = praticaOk + diasRevisao dias`, e o estado é `disponivel` quando
       `agora >= disponivelEm`, senão `aguardando`;
     - sem `praticaOk`: `aguardando` com `disponivelEm` nulo;
     - concluído: as 3 etapas ficam `feita`;
     - `treinoAberto` = a revisão aberta;
     - `minutos = questoesRevisao × minutosPorQuestao`.
- **Situação "mais_respostas":** quando é prioridade `mais_respostas` e não tem prática nem revisão. Tem uma etapa:
  - `diagnostico`, `disponivel`;
  - `treinoAberto` = o diagnóstico aberto;
  - `minutos = questoesDiagnostico × minutosPorQuestao`;
  - `historico.diagnosticos` = os entregues.
- **Concluído:** sai em `concluidos`, com `situacao: "concluido"` e `etiqueta "Concluído"`.
- **Etiqueta, nesta prioridade:**
  - "Revisão posterior liberada" (etapa revisão `disponivel`);
  - `Rodada ${n}` (n ≥ 2);
  - "Revisão prioritária" / "Precisamos de mais respostas".
- **Aviso:** `"Vamos de novo: revise e pratique com questões novas."` quando `rodada >= 2`; senão `null`.
- **Texto:** `textoRecomendacao` com o `inicial` do conteúdo e o foco.
- **Depois:** soma de acertos e total das práticas e revisões entregues (todas as rodadas), ou `null`.
- **`minutosProximos`:** soma dos minutos das etapas `disponivel` não feitas, em ordem, parando na primeira
  `aguardando`.
- **Quem entra:**
  - as chaves das prioridades;
  - as chaves com prática ou revisão;
  - sem `ConteudoDesempenho` para a chave, o conteúdo fica de fora.
- **Ordem dos não concluídos:**
  1. revisão posterior liberada;
  2. em andamento (alguma etapa feita ou treino aberto);
  3. "revisar" na ordem das prioridades;
  4. diagnósticos;
  5. depois disso, `ordenarComPrerequisitos`: cada pré-requisito que aparece depois sobe para logo antes do
     primeiro conteúdo que depende dele (uma passada; laços ignorados).
- **Semana:**
  - percorre em ordem; um conteúdo com `minutosProximos = 0` (só etapas aguardando) vai para `depois`;
  - o primeiro com minutos entra sempre;
  - os seguintes entram enquanto `soma + minutosProximos <= minutosSemana`; no primeiro que não cabe, ele e todos
    os seguintes vão para `depois`;
  - `minutosSemana` = valor informado ou `TEMPO_SEMANA_PADRAO`, e `tempoEscolhido = minutosSemana != null` na
    entrada.
- **Progresso:**
  - `feitas` e `total` somam as etapas de todos os conteúdos, com os concluídos com todas feitas;
  - `pct = total ? Math.round(feitas / total * 100) : 0`;
  - `criterio = textoCriterio(regras)`.

- [ ] **Step 1: Testes** (`plano.test.ts`):
  - **Ajudantes:** `cd(chave, o)` monta um `ConteudoDesempenho`; `pri(c, tipo)`, uma `Prioridade`;
    `tr(o)`, um `TreinoDoPlano`; `agora = 2026-11-03T12:00:00Z`.
  - **Casos com asserções exatas:**
    - **conteúdo novo:**
      - etapas `["disponivel", "disponivel", "aguardando"]`, `feitas 0`, `total 3`;
      - `etiqueta "Revisão prioritária"`;
      - `minutosProximos 30` (15 + 5×3).
    - **"Já revisei" sem treino:** etapa 1 `feita`.
    - **prática entregue 4/5:** etapa 2 `feita`; revisão `aguardando` com `disponivelEm` = entrega + 7 dias
      (ISO); com `agora` 8 dias depois, revisão `disponivel` e etiqueta "Revisão posterior liberada".
    - **prática entregue 2/5:**
      - `rodada 2`, `etiqueta "Rodada 2"` e o aviso "Vamos de novo…";
      - etapa 1 `disponivel` mesmo com `revisadoEm` anterior à entrega;
      - etapa 1 `feita` com `revisadoEm` posterior.
    - **resultado nulo não passa:** prática entregue com `acertos: null, total: null` → rodada 2, sem exceção.
    - **revisão entregue 3/3 depois da prática 4/5:**
      - vai para `concluidos`, `situacao "concluido"`, `depois {acertos: 7, total: 8}`;
      - continua contando 3/3 no progresso.
    - **concluído + prática aberta:** volta para a semana com `rodada 2` e etapa 2 `treinoAberto` = id.
    - **mais respostas:** uma etapa `diagnostico`; `historico.diagnosticos` conta os entregues; treino aberto
      aparece em `treinoAberto`.
    - **ordem:**
      - revisão liberada antes de "em andamento", e este antes de "revisar" novo e de diagnóstico;
      - `ordenarComPrerequisitos(["a", "b", "c"], { a: ["c"] })` → `["c", "a", "b"]`;
      - laço `{ a: ["b"], b: ["a"] }` não trava e devolve as duas chaves uma vez.
    - **semana:**
      - com 30 min e dois conteúdos de 30, o primeiro fica na semana e o segundo em `depois`
        (`minutosDaSemana 30`);
      - com 30 min e o primeiro de 45, ele fica mesmo assim;
      - um conteúdo só com revisão aguardando vai para `depois`;
      - `minutosSemana null` dá 120 e `tempoEscolhido false`.
- [ ] **Step 2: Rodar e ver falhar.** Rode `npx tsx --test src/lib/plano/plano.test.ts`. Esperado: FAIL.
- [ ] **Step 3: Implementar** `plano.ts`.
- [ ] **Step 4: Rodar e ver passar.** Acrescente o teste ao script `test` e rode `npm test` e `npm run lint`: verde.
- [ ] **Step 5: Commit.** Mensagem: `feat: estado do plano de estudo (rodadas, revisão posterior, semana e progresso)`.

---

### Task 5: Materiais, chave do conteúdo e leitura do servidor

**Files:**
- Create: `src/lib/plano/extras.ts` (puro), `src/lib/plano/dados.ts` (servidor)
- Test: `src/lib/plano/extras.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4. `respostasDaConta`, `montarPainel` e `regrasDoPainel` (Task 2); `cursosDoAluno`
  (`src/lib/aulas/acesso.ts`); `questoesDeProvasEmSigilo` e `filtroVisivel` (`src/lib/simulados/servidor.ts`);
  `aulasDoTema` (`src/lib/simulados/revisao.ts`); `ehMateria` (`src/lib/questoes/materias.ts`).
- Produces (`extras.ts`):
  ```ts
  export type MaterialTela = { id: string; titulo: string; tipo: "aula" | "link"; href: string | null; minutos: number };
  export type ExtrasConteudo = { materiais: MaterialTela[]; resolucoes: number; disponiveis: number | null;
    prerequisitos: { nome: string; assunto: string }[]; habilidades: { codigo: string | null; descricao: string }[] };
  export function chaveValida(chave: string): { assuntoId: string } | { materia: string } | null;
  export function materiaisDoConteudo(e: { linhas: MaterialRevisao[]; topicoFocoId: string | null; assuntoId: string | null; escolaId: string;
    aulas: Record<string, { titulo: string; acessivel: boolean }>; aulasDoTema: { id: string; titulo: string }[];
    duracoesSeg: Record<string, number>; visao: "aluno" | "escola"; minutosMaterial: number }): MaterialTela[];
  export function minutosDaAula(seg: number | undefined, padrao: number): number; // ceil(seg/60/5)*5, mínimo 5; sem seg → padrao
  ```
- Produces (`dados.ts`):
  ```ts
  export type DadosPlano = { painel: PainelDesempenho; respostas: RespostaDesempenho[]; plano: Plano; extras: Record<string, ExtrasConteudo>;
    regras: RegrasAprendizagem; habilidadesAlvo: Record<string, string[]> };
  export async function carregarPlano(conta: { id: string; escolaId: string }, visao: "aluno" | "escola", agora?: Date): Promise<DadosPlano>;
  export async function vistasDaConta(contaId: string): Promise<Record<string, string>>;
  export async function candidatasDoConteudo(aluno: AlunoConta, chave: string, vistas: Record<string, string>): Promise<Candidata[]>;
  export async function facilidadeDasQuestoes(ids: string[]): Promise<Record<string, number | null>>;
  ```

**Regras de `materiaisDoConteudo`:**

- **Linhas que entram:** só as com `escola_id` nulo ou igual a `escolaId`, e do tópico de foco ou do assunto.
- **Ordem:** primeiro as do tópico, depois as do assunto (cada grupo na ordem recebida), depois as
  `aulasDoTema` que ainda não apareceram.
- **Aula:**
  - na visão aluno, sem `acessivel`, ela sai;
  - título = `aulas[id].titulo`;
  - `href = /aluno/aulas/<id>` só na visão aluno (`null` na escola);
  - minutos por `minutosDaAula(duracoesSeg[id], minutosMaterial)`.
- **Link:** `href = url` (nas duas visões), `minutos = minutosMaterial`.
- **Sem repetição:** a mesma aula não aparece duas vezes.

**`chaveValida`:**

- uuid (regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, minúsculo) → `{ assuntoId }`;
- `materia:<m>` com `ehMateria(m)` → `{ materia }`;
- o resto → `null`.

**`carregarPlano`** (leituras em paralelo quando independentes; leitura em blocos de 200 ids e páginas de 1000,
como em `desempenho/dados.ts`):

1. **Regras e painel:**
   - `regras = regrasDaEscola(escolaId)`;
   - `respostas = respostasDaConta(...)`;
   - `painel = montarPainel(respostas, regrasDoPainel(regras))`.
2. **Treinos do plano:**
   - `simulados` com `conta_id` = conta e `plano_etapa` não nulo;
   - `tentativas` deles com `conta_id`: `entregue_em`, `acertos`, `total`, `status`;
   - entregue = `status = 'entregue'`;
   - `criadoEm = simulados.created_at`.
3. **Marcas e tempo:** `plano_revisoes` da conta e `planos_estudo.minutos_semana`.
4. **Materiais:**
   - `materiais_revisao` dos assuntos das chaves e dos tópicos de foco;
   - **aulas, na visão aluno:** as publicadas dos cursos do aluno (`acessivel`) mais os títulos das aulas citadas
     nos materiais;
   - **aulas, na visão escola:** só os títulos das citadas;
   - `aulasDoTema(nome do conteúdo, aulas acessíveis)` só na visão aluno;
   - **duração:** o maior `aula_progresso.duracao_seg` de cada aula citada.
5. **`revisadoEm[chave]`:** o maior entre `plano_revisoes.revisado_em` e o `aula_progresso.concluida_em` da conta
   nas aulas dos materiais da chave.
6. **Questões erradas:** as primeiras respostas **iniciais** erradas ou em branco por chave. Delas saem:
   - `resolucoes` = quantas têm `resolucao` não nula;
   - `habilidadesAlvo[chave]` = as habilidades delas (`questao_habilidades`);
   - `extras.habilidades`: até 3, com `codigo` e `descricao` de `habilidades`, ordenadas por `ordenarHabilidades`.
7. **Pré-requisitos:**
   - `topico_prerequisitos` do foco (ou, sem foco, dos tópicos das questões erradas da chave);
   - nome e assunto de cada pré-requisito, em `topicos` e `assuntos`;
   - `prerequisitos[chave]` = os `assunto_id` dos pré-requisitos que são chaves do plano.
8. **Disponíveis, só na visão aluno:**
   - `vistasDaConta` (`tentativas` da conta, todas: cada id da `ordem` → o maior `iniciada_em`);
   - candidatas por chave, numa leitura por bloco de assuntos (e uma por matéria para as chaves `materia:`);
   - `disponiveis = contarDisponiveis(...)`. Na visão escola, `disponiveis` é `null`.
9. **Plano:** `montarPlano({ ..., minutosRevisar: minutos do 1º material de cada chave })`.

**`candidatasDoConteudo`:**

- **Filtro:** questões `status = 'publicada'`, `anulada = false`, `.or(filtroVisivel(aluno.escola_id))`, do
  assunto (ou da matéria), sem as de `questoesDeProvasEmSigilo(aluno)`.
- **Campos:** `topico_id` e as habilidades (`questao_habilidades` em blocos); `ultimaVez` vem de `vistas`.

**`facilidadeDasQuestoes`:**

- conta `tentativa_respostas` com `correta` não nula por `questao_id` (acertos e total);
- lê `questoes.geracao_id` → `geracoes_ia.dificuldade`;
- aplica `facilidadeDe`.

- [ ] **Step 1: Testes de `extras.test.ts`:**
  - `chaveValida`:
    - `"materia:matematica"` → `{ materia: "matematica" }`;
    - `"materia:xyz"`, `"abc"`, `""` e um uuid com maiúsculas → `null`;
    - um uuid minúsculo → `{ assuntoId }`.
  - `minutosDaAula(601, 15) = 15`, `minutosDaAula(1260, 15) = 25`, `minutosDaAula(30, 15) = 5`,
    `minutosDaAula(undefined, 15) = 15`.
  - `materiaisDoConteudo`:
    - material de outra escola fica de fora;
    - tópico antes do assunto;
    - aula sem acesso some na visão aluno e aparece sem `href` na escola;
    - aula repetida entre material e `aulasDoTema` aparece uma vez;
    - link com `href` = url nas duas visões.
- [ ] **Step 2: Rodar e ver falhar.** Rode `npx tsx --test src/lib/plano/extras.test.ts`. Esperado: FAIL.
- [ ] **Step 3: Implementar** `extras.ts` e `dados.ts`. O `dados.ts` não tem teste unitário; ele é conferido nas
  Tasks 8 e 9 com os dados de teste.
- [ ] **Step 4: Rodar e ver passar.** Acrescente o teste ao script `test` e rode `npm test` e `npm run lint`: verde.
- [ ] **Step 5: Commit.** Mensagem: `feat: materiais, chave e leitura do plano de estudo`.

---

### Task 6: Núcleo e ações do aluno

**Files:**
- Create: `src/lib/plano/nucleo.ts`, `src/actions/plano-estudo.ts`
- Test: `src/lib/plano/nucleo.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5; `iniciarTentativa` de `src/actions/simulados-aluno.ts`.
- Produces:
  ```ts
  // nucleo.ts
  export type DepsTreinoPlano = {
    conteudo(chave: string): Promise<{ plano: ConteudoPlano; habilidadeIds: string[] } | null>;
    candidatas(chave: string): Promise<Candidata[]>;
    facilidade(ids: string[]): Promise<Record<string, number | null>>;
    treinoAberto(chave: string, etapa: EtapaPlano): Promise<string | null>;
    contarTreinos(chave: string, etapa: EtapaPlano): Promise<number>;
    inserirTreino(t: { titulo: string; conteudo: string; etapa: EtapaPlano; rodada: number; questaoIds: string[] }): Promise<{ simuladoId: string } | "colisao">;
    regras: RegrasAprendizagem; agora: Date; sortear?: () => number;
  };
  export type ResultadoTreinoPlano = { ok: true; simuladoId: string; aviso: string | null } | { ok: false; erro: string };
  export async function criarTreinoDoPlanoCom(deps: DepsTreinoPlano, entrada: { conteudo: string; etapa: EtapaPlano }): Promise<ResultadoTreinoPlano>;
  // src/actions/plano-estudo.ts ("use server")
  export async function criarTreinoDoPlano(entrada: { conteudo: string; etapa: EtapaPlano }): Promise<ResultadoTreinoPlano>;
  export async function marcarRevisado(entrada: { conteudo: string }): Promise<{ ok: true } | { ok: false; erro: string }>;
  export async function salvarTempoSemana(entrada: { minutos: number }): Promise<{ ok: true } | { ok: false; erro: string }>;
  ```

**Regras de `criarTreinoDoPlanoCom`, nesta ordem:**

1. `chaveValida` nulo → `"Conteúdo inválido."`; etapa fora das três → `"Etapa inválida."`.
2. `conteudo()` nulo → `"Este conteúdo não está no seu plano."`.
3. **Etapa permitida:**
   - `diagnostico`: só com `situacao "mais_respostas"`;
   - `pratica`: com `revisar` ou `concluido`;
   - `revisao`: só se a etapa `revisao` estiver `disponivel`;
   - senão `"Esta etapa ainda não está disponível."`.
4. **Treino aberto:** o `treinoAberto` da etapa no plano, ou `deps.treinoAberto`. Existindo, devolve
   `{ ok: true, simuladoId, aviso: null }`.
5. **Quantidade:** `questoesDiagnostico` / `questoesPratica` / `questoesRevisao`.
6. **Escolha:**
   - `selecionarQuestoes` com o foco do plano e `habilidadeIds`;
   - sem nenhuma questão → `{ ok: false, erro: textoQuestoesDisponiveis(nome, 0, q)! }`;
   - em seguida, `ordenarPorFacilidade(ids, await facilidade(ids))`.
7. **Gravação:**
   - `rodada = contarTreinos + 1`;
   - `inserirTreino` com `tituloTreino(etapa, nome)`;
   - `"colisao"` → `treinoAberto` de novo → devolve o id, ou `"Tente de novo."`.
8. **Aviso:** `textoQuestoesDisponiveis(nome, ids.length, q)` quando `faltaram > 0`, senão `null`.

**Ações:**

- Envolvem tudo em try/catch → `{ ok: false, erro: "Não foi possível ..." }`.
- **`criarTreinoDoPlano`:**
  - `inserirTreino` grava `simulados` (`tipo 'treino'`, `conta_id`, `escola_id`, `status 'publicado'`,
    `correcao 'na_hora'`, `embaralhar false`, `duracao_min null` e os três campos do plano) e `simulado_questoes`;
  - erro com `code === "23505"` → `"colisao"`;
  - depois de `ok`, chama `iniciarTentativa(simuladoId)`;
  - `deps.conteudo` usa `carregarPlano({ id, escolaId }, "aluno")` e procura a chave em
    `semana`, `depois` e `concluidos`.
- **`marcarRevisado`:** `chaveValida`, depois upsert em `plano_revisoes` (`onConflict "conta_id,conteudo"`,
  `revisado_em` agora).
- **`salvarTempoSemana`:** `tempoSemanaValido`, depois upsert em `planos_estudo` (`onConflict "conta_id"`,
  `updated_at` agora).

- [ ] **Step 1: Testes de `nucleo.test.ts`** (deps falsas em memória):
  - chave inválida (`"materia:xyz"`);
  - fora do plano;
  - diagnóstico pedido para um conteúdo "revisar" → erro de etapa;
  - revisão `aguardando` → erro de etapa;
  - treino aberto → devolve o mesmo id e não chama `inserirTreino`;
  - zero candidatas → `"Não há questões novas de Porcentagem no banco agora."`;
  - 3 candidatas para prática de 5 → ok com aviso `"Só há 3 questões novas de Porcentagem agora; a sequência terá 3."`
    e `inserirTreino` recebe 3 ids em ordem de facilidade;
  - `rodada` = `contarTreinos + 1`;
  - `"colisao"` → devolve o id de `treinoAberto`;
  - título `"Prática: Porcentagem"`;
  - chave `materia:matematica` aceita.
- [ ] **Step 2: Rodar e ver falhar.** Rode `npx tsx --test src/lib/plano/nucleo.test.ts`. Esperado: FAIL.
- [ ] **Step 3: Implementar** `nucleo.ts` e `src/actions/plano-estudo.ts`.
- [ ] **Step 4: Rodar e ver passar.** Acrescente o teste ao script `test` e rode `npm test` e `npm run lint`: verde.
- [ ] **Step 5: Commit.** Mensagem: `feat: ações do plano (criar treino, já revisei, tempo por semana)`.

---

### Task 7: Componentes do plano e página `/aluno/plano`

**Files:**
- Create: `src/components/plano/PlanoEstudo.tsx`, `src/components/plano/CartaoConteudoPlano.tsx`,
  `src/components/plano/MateriaisConteudo.tsx`, `src/components/plano/BotaoTreinoPlano.tsx`,
  `src/components/plano/BotaoJaRevisei.tsx`, `src/components/plano/TempoSemana.tsx`,
  `src/components/plano/SeloPlano.tsx`, `src/components/plano/PlanoEstudo.module.css`
- Create: `src/app/aluno/plano/page.tsx`, `loading.tsx`, `error.tsx`
- Modify: `src/app/aluno/layout.tsx` (item do menu)

**Interfaces:**
- Consumes:
  - `carregarPlano` e os tipos `Plano`, `ConteudoPlano`, `ExtrasConteudo`, `MaterialTela`;
  - as ações da Task 6;
  - `formatarMinutos`, `textoSemMaterial`, `textoQuestoesDisponiveis` e `textoResolucoes`;
  - `PainelResumo` (`src/components/ui/PainelResumo.tsx`);
  - `linkDetalhe` e `chaveMateria` (`src/components/desempenho/links.ts`).
- Produces (usados também pela Task 8):
  - `MateriaisConteudo({ nome, extras, visao, hrefResolucoes }: { nome: string; extras: ExtrasConteudo; visao: "aluno" | "escola"; hrefResolucoes: string | null })`;
  - `BotaoTreinoPlano({ conteudo, etapa, treinoAberto, rotulo, className }: { conteudo: string; etapa: EtapaPlano; treinoAberto: string | null; rotulo: string; className?: string })`, client;
  - `SeloPlano({ c }: { c: ConteudoPlano })`: "No plano: 1 de 3 etapas" ou "Revisado ✓" no concluído;
  - `rotuloEtapa(etapa: EtapaPlano, regras: RegrasAprendizagem, aberto: boolean, situacao: ConteudoPlano["situacao"]): string`,
    exportado de `BotaoTreinoPlano.tsx`. Valores:
    - aberto → "Continuar treino";
    - `pratica` → `Praticar ${n} questões`, ou "Estudar de novo" no concluído;
    - `diagnostico` → `Fazer diagnóstico (${n} questões)`;
    - `revisao` → `Fazer revisão (${n} questões)`.

- [ ] **Step 1: Ler o skill.** Invoque o skill `status-visual-aluno` e leia `src/components/desempenho/PainelDesempenho.tsx`
  e o CSS dele: a página nova segue o mesmo desenho (cabeçalho em cartão, `Secao`, cartões com `cartao-interativo`).
- [ ] **Step 2: Página e componentes**, como na spec, seção "Telas → 1".
  - **Ícone do cabeçalho:** `Route`.
  - **`PainelResumo`:**
    - Progresso: `${pct}%`, detalhe `${feitas} de ${total} etapas`;
    - Conteúdos no plano;
    - Tempo desta semana: `≈ ${formatarMinutos(minutosDaSemana)}`;
    - Concluídos.
  - **`TempoSemana`:** chips de `TEMPOS_SEMANA` com `aria-pressed`. Sem `tempoEscolhido`, aparece o aviso
    "Escolha quanto tempo você tem; por enquanto usamos 2 h.".
  - **`CartaoConteudoPlano`:**
    - `id={`conteudo-${chave}`}` (âncora do "Ver no plano");
    - etapas numeradas em `<ol>`, com estado em texto ("Feita ✓", "Agora", "A partir de 12/11", com data em
      `America/Sao_Paulo`) e minutos;
    - etapa 1 com `MateriaisConteudo` e `BotaoJaRevisei`;
    - etapas de treino com `BotaoTreinoPlano`. Quando `extras.disponiveis === 0` e não há treino aberto, o botão
      some e aparece o texto de `textoQuestoesDisponiveis`; quando é menor que a quantidade, aparece o aviso acima
      do botão;
    - pré-requisitos ("Antes, é bom saber: X (Assunto)") e habilidades (`H18 — descrição`) quando houver;
    - `resultado` da última prática ("acertou 2 de 5").
  - **Seções** "Para esta semana", "Depois" (cartões compactos: só cabeçalho, texto e a próxima ação) e
    "Concluídos" (antes = `inicial.legenda`, depois = `Depois do estudo: acertou X de Y`, botão "Estudar de novo").
  - **`hrefResolucoes`:** `linkDetalhe("/aluno/desempenho", chaveMateria(inicial), chave) + "#detalhe-conteudo"`.
  - **Estados vazios** e `error.tsx` / `loading.tsx` como na spec, copiando o jeito dos de `src/app/aluno/desempenho/`.
- [ ] **Step 3: Menu.** Em `src/app/aluno/layout.tsx`, depois de "Desempenho", entra `{ href: "/aluno/plano",
  icone: Route, cor: "laranja", rotulo: "Plano" }`.
- [ ] **Step 4: Verificar.** Rode `npm run lint` e `npm run build`. Esperado: sem erros.
- [ ] **Step 5: Commit.** Mensagem: `feat: página Plano de estudo do aluno`.

---

### Task 8: Painel "Meu desempenho" com as recomendações

**Files:**
- Modify: `src/components/desempenho/PainelDesempenho.tsx`, `DetalheConteudo.tsx`, `GraficoConteudos.tsx`, `PainelDesempenho.module.css`
- Modify: `src/app/aluno/desempenho/page.tsx`, `src/app/turma/[turmaId]/relatorio/aluno/[alunoId]/desempenho/page.tsx`
- Modify: `src/lib/desempenho/dados.ts` (tirar `aulasDoAlunoParaRevisao` se ficar sem uso)

**Interfaces:**
- Consumes: `carregarPlano` (Task 5); `MateriaisConteudo`, `BotaoTreinoPlano`, `rotuloEtapa` e `SeloPlano`
  (Task 7); `FRASE_INICIAL` (Task 2).
- `PainelDesempenho` troca a prop `aulas` por:
  - `plano: Record<string, ConteudoPlano>` (semana, depois e concluídos, por chave);
  - `extras: Record<string, ExtrasConteudo>`;
  - `regras: RegrasAprendizagem`.

- [ ] **Step 1: Mudanças**, conforme a spec, seção "Telas → 2":
  - **`CartaoPrioridade`:**
    - `p.texto`, mais `painel.criterio` em letra menor;
    - `MateriaisConteudo` com `hrefResolucoes` para o detalhe;
    - `SeloPlano` quando a chave está no plano;
    - **aluno:**
      - `BotaoTreinoPlano` (prática para "revisar", diagnóstico para "mais respostas", com o treino aberto do
        plano);
      - escondido com o texto de falta quando `disponiveis === 0`;
      - link "Ver no plano" para `/aluno/plano#conteudo-<chave>`;
    - **escola:** sem botões.
  - **`DetalheConteudo`:**
    - "Revisão sugerida" com `MateriaisConteudo` e, no aluno, `BotaoTreinoPlano`;
    - linha "Depois do estudo: acertou X de Y" quando `plano[chave]?.depois`;
    - lista "Tópicos deste conteúdo" (nome + legenda) quando `conteudo.topicos.length > 0`.
  - **`AulasDoConteudo` e `TreinarAssunto`:** saem do painel. `TreinarAssunto` continua em `ResultadoAluno`.
  - **Cabeçalho:** `FRASE_INICIAL` abaixo da descrição.
  - **`GraficoConteudos`:** recebe `minQuestoes = regras.minQuestoesPrioridade`.
  - **Páginas:** as duas usam `carregarPlano` (visão aluno e escola). A da escola só carrega quando há `contaId`;
    sem conta, ela passa um painel vazio (`montarPainel([])`) e registros vazios.
- [ ] **Step 2: Verificar.** Rode `npm test`, `npm run lint` e `npm run build`. Esperado: sem erros.
- [ ] **Step 3: Commit.** Mensagem: `feat: recomendações e materiais no painel Meu desempenho`.

---

### Task 9: Cartão "Recomendações de estudo" em `/configuracoes`

**Files:**
- Create: `src/components/configuracoes/RegrasAprendizagemCard.tsx`, `src/actions/regras-aprendizagem.ts`
- Modify: `src/app/configuracoes/page.tsx`, `src/components/configuracoes/ConfiguracoesPainel.tsx`, `ConfiguracoesPainel.module.css`

**Interfaces:**
- Consumes: `LIMITES`, `REGRAS_PADRAO`, `validarRegras` (Task 1); `regrasDaEscola` e `gravarRegrasDaEscola`.
- Produces:
  - `salvarRegrasAprendizagem(entrada: unknown): Promise<{ ok: true; regras: RegrasAprendizagem } | { ok: false; erro: string }>`;
  - `voltarRegrasPadrao(): Promise<{ ok: true; regras: RegrasAprendizagem } | { ok: false; erro: string }>`.
  - As duas exigem `getProfessorAtual()` com `ehAdmin(role)`; senão devolvem `"Só a administração da escola pode mudar as regras."`.

- [ ] **Step 1: Ação e cartão.**
  - **Cartão:** copia o desenho de `MediaAprovacaoCard`, com título "Recomendações de estudo" e descrição "Quando
    um conteúdo vira prioridade e como o plano de estudo é montado.".
  - **Campos:** os 10 em grade, com `rotulo`, o limite ("de 3 a 15") e `ajuda`.
  - **Botões:** "Salvar" e "Voltar ao padrão", com mensagem `role="status"`.
  - **Página:** lê `regrasDaEscola(atual.escola_id)` só para admin e passa ao painel, que mostra o cartão só
    para admin.
- [ ] **Step 2: Verificar.** Rode `npm run lint` e `npm run build`. Esperado: sem erros.
- [ ] **Step 3: Commit.** Mensagem: `feat: regras de recomendação editáveis nas configurações`.

---

### Task 10: Fechamento

- [ ] **Step 1: Comandos finais.** Rode `npm test`, `npm run lint` e `npm run build`. Esperado: tudo verde.
- [ ] **Step 2: CLAUDE.md.** Novo item em "Pronto e no ar":
  - "Recomendações e plano de estudo (projeto 3 de 4)";
  - a spec;
  - `/aluno/plano`;
  - as regras em `/configuracoes`;
  - o SQL `db/2026-11-03-plano-estudo.sql`.

  Atualize "Próximo passo" (projeto 4: IA).
- [ ] **Step 3: Commit.** Mensagem: `docs: CLAUDE.md com o plano de estudo`.
