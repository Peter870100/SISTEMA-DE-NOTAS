# Gerador de questões por IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Professor gera questões objetivas inéditas por IA, com exemplos do próprio banco (mesmo assunto), que entram em revisão para ele conferir e publicar.

**Architecture:** Funções puras em `src/lib/questoes/geracao.ts` (pedido, limite, exemplos, instruções, conversão da resposta, semelhança); orquestração com banco + Anthropic em `src/lib/questoes/geracao-servidor.ts`; server actions finas em `src/actions/geracao.ts`; tela `/banco/gerar` (server page + componente cliente). Sem embeddings.

**Tech Stack:** Next.js 16.2 (ler `node_modules/next/dist/docs/` antes de mexer em rotas/actions), React 19, Supabase JS, `@anthropic-ai/sdk` 0.131 (`zodOutputFormat` de `@anthropic-ai/sdk/helpers/zod`), zod, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-24-gerador-questoes-ia-design.md`

## Global Constraints

- Modelo `claude-opus-5-5`; `output_config: { effort: "high", format: zodOutputFormat(GeracaoSchema) }`; streaming com `.finalMessage()`; `max_tokens: 32000`; sem `thinking: disabled`, sem `temperature`.
- Preço normal (não lote): entrada US$ 4/1M, saída US$ 20/1M.
- Quantidade 1–10 (padrão 5); orientação ≤ 500 caracteres; dificuldade `facil|media|dificil`.
- Limite: 60 questões pedidas por escola por dia (dia de America/Campo_Grande), contando gerações `gerando`/`concluida`; dono sem limite.
- Questão gerada: `origem 'ia'`, `status 'revisao'`, `banca 'Gerada por IA'`, `ano` = ano atual, `caderno ''`, `numero null`, `conteudo null`.
- Semelhança ≥ 0,55 → `precisa_revisao = true`.
- Textos de tela em pt-BR; sem texto cinza (memória "Visual sem cinza"); seguir `Banco.module.css`/`estilos`.
- `resolucao` e `resposta` nunca em leitura de aluno (leituras atuais usam colunas explícitas: manter).
- Testes novos entram na lista do script `test` em `package.json`.

## Review Focus

- IA devolve questão com duas alternativas iguais ou letra repetida → a questão é descartada, as outras gravadas (teste em Task 2).
- IA devolve `assunto_id` inventado ou de outra matéria → usa o assunto pedido (ou null) (teste em Task 2).
- Professor pede 10 quando a escola já pediu 55 hoje → recusa com a mensagem do limite; 23:59 de ontem em Campo Grande não conta (teste em Task 3).
- Assunto com 0–2 questões publicadas → exemplos completados pela matéria; matéria vazia → gera sem exemplos (teste em Task 3).
- Resposta da IA cortada (`stop_reason` `max_tokens`) ou recusa → geração `erro`, nada gravado em `questoes`, mensagem clara (Task 4, conferido por revisão do código).

---

### Task 1: SQL e tipos

**Files:**
- Modify: `db/schema.sql` (anexar ao fim o bloco "Gerador de questões por IA (2026-10-24)" exatamente como na seção 1 da spec)
- Modify: `src/lib/types.ts` (`Questao`, `Database["public"]["Tables"]`)

**Interfaces:**
- Produces: `Questao.origem: "pdf" | "enemdev" | "manual" | "ia"`; `Questao.resolucao: string | null`; `Questao.geracao_id: string | null`; tipo `GeracaoIA` (linha de `geracoes_ia`, campos da spec) e `Dificuldade = "facil" | "media" | "dificil"` exportados de `types.ts`; tabela `geracoes_ia` no `Database` (Row/Insert/Update no mesmo formato das outras).

- [ ] **Step 1:** Anexar o SQL ao `db/schema.sql`.
- [ ] **Step 2:** Atualizar os tipos; Insert de `questoes` aceita `resolucao?` e `geracao_id?`.
- [ ] **Step 3:** `npx tsc --noEmit` → sem erros novos (comparar com `git stash`-livre: rodar antes e depois; o projeto deve compilar).
- [ ] **Step 4:** Commit `Gerador IA: SQL e tipos`.

### Task 2: Conversão da resposta da IA e semelhança

**Files:**
- Create: `src/lib/questoes/geracao.ts`
- Test: `src/lib/questoes/geracao.test.ts` (adicionar ao script `test`)

**Interfaces:**
- Produces:
  - `GeracaoSchema` (zod, formato da spec §3.7) e `type RespostaGeracao = z.infer<typeof GeracaoSchema>`
  - `parecenca(a: string, b: string): number` — Jaccard de trigramas de palavras após normalizar (minúsculas, sem acento via `normalize("NFD")`, só `[a-z0-9 ]`); menos de 3 palavras em qualquer lado → 0.
  - `LIMIAR_PARECENCA = 0.55`
  - `type Referencia = { rotulo: string; texto: string }` (rótulo como "ENEM 2019 nº 45")
  - `type ContextoGeradas = { escopo: Escopo; escola_id: string | null; materia: Materia; assuntoPedido: string | null; assuntosValidos: Set<string>; referencias: Referencia[]; geracao_id: string; criado_por: string; ano: number }`
  - `respostaParaGeradas(r: RespostaGeracao, ctx: ContextoGeradas): { linhas: Database["public"]["Tables"]["questoes"]["Insert"][]; descartadas: number }`

- [ ] **Step 1: Testes que falham**

```ts
test("parecenca: iguais = 1, ignora acento e maiúscula", () => {
  assert.equal(parecenca("A Revolução Industrial começou na Inglaterra", "a revolucao industrial comecou na inglaterra"), 1);
});
test("parecenca: textos diferentes ficam perto de 0", () => {
  assert.ok(parecenca("A fotossíntese ocorre nos cloroplastos das plantas", "O preço do produto subiu vinte por cento em março") < 0.1);
});
test("parecenca: menos de 3 palavras = 0", () => { assert.equal(parecenca("sim não", "sim não"), 0); });
test("respostaParaGeradas: descarta alternativas repetidas, vazias ou ≠ 5", () => {
  // 3 itens: válido; letras A,A,C,D,E; texto vazio em B → linhas.length === 1, descartadas === 2
});
test("respostaParaGeradas: assunto fora da lista vira o assunto pedido", () => {
  // assunto_id "inventado" com assuntoPedido "as-1" → linha.assunto_id === "as-1"; assuntoPedido null → null
});
test("respostaParaGeradas: parecida com referência marca revisão com o rótulo", () => {
  // enunciado igual ao texto da referência {rotulo:"ENEM 2019 nº 45"} → precisa_revisao true, motivo_revisao "Parecida demais com ENEM 2019 nº 45."
});
test("respostaParaGeradas: duas geradas iguais entre si → a segunda marcada", () => {
  // motivo_revisao "Parecida demais com outra questão gerada."
});
test("respostaParaGeradas: monta a linha com origem ia", () => {
  // origem "ia", status "revisao", banca "Gerada por IA", caderno "", numero null, area = areaDaMateria(materia),
  // resolucao do item, geracao_id, criado_por, escopo/escola_id do ctx, alternativas A–E com texto trim
});
```

- [ ] **Step 2:** `npx tsx --test src/lib/questoes/geracao.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar em `geracao.ts` (sem imports de servidor; só `types`, `materias`, `zod`). Semelhança comparada com `enunciado + " " + comando` da gerada contra cada `referencia.texto` e contra as geradas anteriores do mesmo lote.
- [ ] **Step 4:** Rodar → PASS. Adicionar o arquivo ao script `test`; `npm test` → PASS.
- [ ] **Step 5:** Commit `Gerador IA: conversao da resposta e semelhanca`.

### Task 3: Pedido, limite, exemplos e instruções

**Files:**
- Modify: `src/lib/questoes/geracao.ts`
- Test: `src/lib/questoes/geracao.test.ts`

**Interfaces:**
- Produces:
  - `PedidoGeracaoSchema` (zod): `{ materia: string; assunto_id: string | null; quantidade: number (int 1–10); dificuldade: Dificuldade; orientacao: string (trim, ≤ 500); escopo: Escopo; base_id: string | null }`; `type PedidoGeracao`
  - `validarPedido(bruto: unknown, ator: { role: ProfessorRole }, assuntosDaMateria: Set<string>): PedidoGeracao` — lança `Error` com mensagem pt-BR: matéria inválida ("Escolha uma matéria."), assunto fora do conjunto ("Esse assunto não é da matéria escolhida."), quantidade ("Escolha de 1 a 10 questões."), orientação longa ("A orientação pode ter até 500 caracteres."); não-dono com `escopo "geral"` → força `"escola"`.
  - `LIMITE_DIARIO = 60`
  - `inicioDoDia(agora: Date): Date` — 00:00 de America/Campo_Grande do dia de `agora`, em UTC (Campo Grande é UTC−4 fixo, sem horário de verão; calcular pelo `Intl.DateTimeFormat` com `timeZone` para não fixar o offset).
  - `restanteHoje(pedidasHoje: number, role: ProfessorRole): number | null` — `null` = sem limite (dono); senão `max(0, 60 − pedidasHoje)`.
  - `type CandidataExemplo = { id: string; rotulo: string; assunto_id: string | null; enunciado: string; comando: string; alternativas: { letra: Letra; texto: string }[]; resposta: Letra | null; temImagem: boolean }`
  - `escolherExemplos(candidatas: CandidataExemplo[], assuntoId: string | null, sortear: (n: number) => number = (n) => Math.floor(Math.random() * n)): CandidataExemplo[]` — até 6; primeiro as do assunto sem imagem, depois do assunto com imagem, depois as da matéria (outros assuntos) sem imagem, com imagem; embaralha dentro de cada grupo; completa pela matéria só se o assunto tiver menos de 3. Enunciado cortado em 2.500 caracteres.
  - `instrucoesGeracao(p: { pedido: PedidoGeracao; materiaRotulo: string; assuntoNome: string | null; assuntos: { id: string; nome: string }[]; exemplos: CandidataExemplo[]; base: CandidataExemplo | null; recentes: string[] }): string` — conteúdo da spec §3.6, rótulo da dificuldade em português ("fácil", "média", "difícil"), base marcada como "MODELO PRINCIPAL", recentes como lista "Já geradas (não repita)".

- [ ] **Step 1: Testes que falham**

```ts
test("validarPedido: quantidade 0 e 11 recusadas", ...);         // mensagem "Escolha de 1 a 10 questões."
test("validarPedido: professor pedindo geral vira escola", ...);  // role "professor", escopo "geral" → "escola"; dono mantém "geral"
test("validarPedido: assunto de outra matéria recusado", ...);
test("inicioDoDia: 02:30 UTC de 25/10 ainda é 24/10 em Campo Grande", () => {
  assert.equal(inicioDoDia(new Date("2026-10-25T02:30:00Z")).toISOString(), "2026-10-24T04:00:00.000Z");
});
test("restanteHoje: 55 pedidas → 5; dono → null", ...);
test("escolherExemplos: prefere sem imagem e não passa de 6", ...);
test("escolherExemplos: assunto com 2 completa pela matéria; com 3 não completa", ...);
test("escolherExemplos: lista vazia → []", ...);
test("instrucoesGeracao: inclui dificuldade, orientação, modelo principal, recentes e ids dos assuntos", ...);
```

- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar → PASS; `npm test` → PASS.
- [ ] **Step 5:** Commit `Gerador IA: pedido, limite, exemplos e instrucoes`.

### Task 4: Servidor e actions

**Files:**
- Create: `src/lib/questoes/geracao-servidor.ts` (sem `"use server"`)
- Create: `src/actions/geracao.ts` (`"use server"`)
- Modify: `src/lib/questoes/ia.ts` (exportar `PRECO_ENTRADA = 4 / 1_000_000`, `PRECO_SAIDA = 20 / 1_000_000`)

**Interfaces:**
- Consumes: tudo de Tasks 2–3; `clienteIA()`, `iaDisponivel()`, `MODELO` de `ia.ts`; `exigirProfessor`, `podeVerQuestao` de `acesso.ts`; `filtroVisivel(escolaId)` de `src/lib/simulados/servidor.ts`; `supabase` de `src/lib/supabase/client`.
- Produces:
  - `type ResultadoGeracao = { geracaoId: string; questoes: Questao[]; descartadas: number; custoUsd: number }`
  - `gerarQuestoesPor(ator: Professor, bruto: unknown): Promise<ResultadoGeracao>` (servidor)
  - `pedidasHoje(escolaId: string, agora?: Date): Promise<number>` (servidor)
  - actions: `gerarQuestoes(pedido: unknown): Promise<ResultadoGeracao>` e `cotaDeHoje(): Promise<number | null>` (restante; `null` = sem limite). Ambas começam com `exigirProfessor()`; `gerarQuestoes` chama `revalidatePath("/banco")`.

- [ ] **Step 1:** Ler `node_modules/next/dist/docs/` sobre Server Actions / `maxDuration` e o README TypeScript do skill claude-api (streaming + structured outputs). Confirmar no SDK 0.131 se `client.beta.messages.stream` aceita `fallbacks: "default"` com `betas: ["server-side-fallback-2026-07-01"]`; se não tipar, usar `client.messages.stream` sem fallback.
- [ ] **Step 2:** Implementar `gerarQuestoesPor` seguindo a spec §3 passos 1–10. Detalhes que o plano fixa:
  - sem `iaDisponivel()` → `Error("A IA não está configurada (ANTHROPIC_API_KEY na Vercel).")` antes de criar a geração;
  - limite: se `restanteHoje(pedidasHoje, role)` não é null e é menor que a quantidade → `Error("A escola já pediu N questões hoje; o limite é 60 por dia.")` (com N real; se restante > 0, acrescentar " Ainda dá para gerar R.");
  - candidatas a exemplo: `status publicada`, `anulada false`, `.or(filtroVisivel(ator.escola_id))`, mesma matéria, até 200 linhas (`id, banca, ano, numero, assunto_id, enunciado, comando, alternativas, resposta`) + quais têm `questao_imagens` (uma consulta `in("questao_id", ids)`); rótulo `${banca} ${ano ?? ""} nº ${numero}` sem partes vazias;
  - base: ler, checar `podeVerQuestao(ator, base)` → senão `Error("Questão modelo não encontrada.")`; a matéria e o assunto do pedido passam a ser os da base se o pedido vier sem assunto;
  - recentes: `origem 'ia'`, mesma matéria (e assunto, se houver), escopo/escola do pedido, 20 mais novas, `enunciado.slice(0, 200)`;
  - `stop_reason` `refusal` → `"A IA recusou esse pedido. Tente reformular a orientação."`; `max_tokens` → `"A resposta da IA veio incompleta. Tente uma quantidade menor."`; `parsed_output` nulo/inválido → `"A IA devolveu um formato inválido. Tente de novo."`; `respostaParaGeradas` sem linhas → `"Nenhuma questão gerada passou na conferência. Tente de novo."`. Em todos, `geracoes_ia.status = 'erro'`, `erro` = mensagem, e relançar;
  - custo: `(input + cache_read + cache_creation) × PRECO_ENTRADA + output × PRECO_SAIDA`, arredondado a 4 casas;
  - inserir as linhas num só `insert(...).select("*")`; atualizar a geração para `concluida` com `quantidade_gerada`, tokens e custo.
- [ ] **Step 3:** `npx tsc --noEmit` e `npm run lint` → sem erros.
- [ ] **Step 4:** Commit `Gerador IA: servidor e actions`.

### Task 5: Tela `/banco/gerar` e entrada no banco

**Files:**
- Create: `src/app/banco/gerar/page.tsx` (server; `export const maxDuration = 300`; redireciona aluno/sem login como `/banco/nova`)
- Create: `src/components/questoes/GeradorQuestoes.tsx` (cliente)
- Create: `src/components/questoes/GeradorQuestoes.module.css` (se precisar além de `estilos`/`Banco.module.css`)
- Modify: `src/app/banco/page.tsx` (botão "Gerar com IA" com `Sparkles` depois de "Nova questão"; selo "IA" no cartão quando `origem === "ia"`; filtro `origem=ia` "Geradas por IA" no formulário de filtros)

**Interfaces:**
- Consumes: `gerarQuestoes`, `cotaDeHoje` (Task 4); `publicarQuestao(id, true)`, `excluirQuestao(id)` de `src/actions/questoes.ts`; `MATERIAS`, `LETRAS`; componentes de exibição existentes (`ConteudoQuestao`/`TextoAlternativa` ou o markdown simples de `src/lib/questoes/markdown.ts`).
- Produces: rota `/banco/gerar?base=<id>` usada pela Task 6.

- [ ] **Step 1:** Página server: lê professor, assuntos aprovados (`id, materia, nome`), `iaDisponivel()`, cota (`restanteHoje(await pedidasHoje(...))`), e a base quando `?base=` (só se `podeVerQuestao`; senão ignora). Passa tudo ao componente.
- [ ] **Step 2:** Componente: formulário da spec §2 (assunto filtrado pela matéria; dono vê escolha de escopo; mostra "Hoje a escola ainda pode gerar R questões" ou nada para o dono; sem IA → aviso e botão desabilitado). Envio com `useTransition`; botão ocupado com "Escrevendo as questões… pode levar até 2 minutos"; erro da action mostrado em caixa de erro do padrão do app.
- [ ] **Step 3:** Resultado: um cartão por questão (enunciado, comando, A–E com a correta destacada, "Resolução", aviso `motivo_revisao` quando houver) e botões Publicar / Editar (`/banco/questoes/[id]`) / Excluir; após publicar ou excluir, o cartão mostra o novo estado. Rodapé: "N questões geradas · custo US$ X" e "M descartadas" quando > 0.
- [ ] **Step 4:** Mudanças em `/banco` (botão, selo, filtro). A consulta já seleciona colunas explícitas: incluir `origem`.
- [ ] **Step 5:** `npm run lint` e `npm run build` → sem erros.
- [ ] **Step 6:** Commit `Gerador IA: tela de geracao e entrada no banco`.

### Task 6: Resolução no editor e "Gerar parecidas"

**Files:**
- Modify: `src/actions/questoes.ts` (`DadosQuestao.resolucao?: string`; `criarQuestao`/`salvarQuestao` gravam `resolucao` trim, vazio → null, até 5.000 caracteres; ausente → não altera)
- Modify: `src/components/questoes/EditorQuestao.tsx` (textarea "Resolução comentada", opcional, abaixo da resposta; envia `resolucao`)
- Modify: `src/app/banco/questoes/[id]/page.tsx` (link "Gerar parecidas" com `Sparkles` para quem vê a questão; na visão só-leitura, mostrar a resolução quando houver)
- Modify: `src/lib/questoes/edicao.ts` se a validação de campos morar lá
- Test: `src/lib/questoes/questoes.test.ts` (ou o teste do arquivo onde a limpeza de `resolucao` ficar)

**Interfaces:**
- Consumes: rota da Task 5.
- Produces: `limparResolucao(v: string | undefined): string | null | undefined` (pura, em `edicao.ts`): `undefined` → `undefined`; trim vazio → `null`; > 5.000 → `Error("A resolução pode ter até 5.000 caracteres.")`.

- [ ] **Step 1: Teste que falha** — `limparResolucao(undefined) === undefined`, `limparResolucao("  ") === null`, `limparResolucao(" x ") === "x"`, 5.001 caracteres lança.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar e ligar nas actions/editor/página. **Step 4:** `npm test`, `npm run lint`, `npm run build` → PASS.
- [ ] **Step 5:** Commit `Gerador IA: resolucao no editor e gerar parecidas`.
