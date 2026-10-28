# Hermes: gerar questões por IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ferramentas `gerar_questoes` e `situacao_geracao` nos MCPs da Hermes (professor e dono), usando o gerador que já existe.

**Architecture:** O núcleo `gerarQuestoesPor` é dividido em `comecarGeracaoPor` (valida, confere cota, cria a linha `gerando`) e `concluirGeracaoPor` (IA, conferência, gravação). A ferramenta MCP chama a primeira, agenda a segunda com `after()` do `next/server` e responde na hora; os routes MCP sobem `maxDuration` para 300. `situacao_geracao` lê `geracoes_ia` e as questões com aquele `geracao_id`.

**Tech Stack:** Next.js 16.2 (route handlers, `after`), `@modelcontextprotocol/sdk`, zod, Supabase, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-27-hermes-gerar-questoes-design.md`

## Global Constraints

- Ler `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` antes de usar `after` (AGENTS.md: este Next tem mudanças).
- Mesmas regras da tela: 1–10 questões; dificuldade `facil|media|dificil`; orientação até 500; cota `LIMITE_DIARIO` = 60 por escola por dia, dono sem limite; geradas sempre em `status = "revisao"`.
- Professor nunca no banco geral nem em outra escola. Mensagem de geração de outra escola: `"Geração não encontrada."` (não confirma que existe).
- Pedido igual `gerando` há menos de 15 min (`JANELA_REPETIDA_MS`) não cria outro.
- `gerando` há mais de `MAX_GERANDO_MS` (10 min) vira `erro` com `"A geração parou no meio. Tente de novo."`.
- Custo com vírgula decimal (`US$ 0,04`), como `dinheiro` de `importacao.ts`.
- Nenhum SQL novo. Textos em português, sem texto em inglês para o professor.
- Arquivo de teste novo entra na lista explícita do script `test` em `package.json`.
- Arquivos puros (`geracao-hermes.ts`) não importam Supabase nem `next/*` no topo: os testes rodam sem `.env`.

## Review Focus

1. Hermes repete `gerar_questoes` após tempo esgotado → não cria nem cobra de novo (teste de `criteriosGeracaoRepetida` na Task 2; consulta na Task 3).
2. Função morre no meio (`after` cortado) → `situacao_geracao` depois de 10 min mostra erro, não "gerando" eterno (teste `gerandoParou`, Task 2).
3. Professor pede `banco: "geral"` ou consulta geração de outra escola → recusa sem vazar (testes Task 2; `atorDoEscopo` com `ERRO_GERACAO` na Task 3).
4. Questão gerada já mandada para a Lixeira ou editada depois → lista mostra só as que existem, com a situação atual (Task 3 lê de `questoes` na hora).
5. `numero` fora da lista ou geração não concluída → mensagem clara (teste `escolherNumero`, Task 2).

---

### Task 1: Dividir o núcleo do gerador

**Files:**
- Modify: `src/lib/questoes/geracao-servidor.ts`

**Interfaces:**
- Produces:
  - `type AtorGeracao = Pick<Professor, "id" | "role" | "escola_id">` (exportado; `AtorEscola` da Hermes satisfaz).
  - `type GeracaoIniciada = { geracaoId: string; pedido: PedidoGeracao; base: Questao | null; assuntos: { id: string; nome: string }[]; aprovados: Set<string>; agora: Date }`
  - `comecarGeracaoPor(ator: AtorGeracao, bruto: unknown): Promise<GeracaoIniciada>` — `prepararPedido` + cota + insert `gerando` (as linhas 191–221 de hoje).
  - `concluirGeracaoPor(ator: AtorGeracao, g: GeracaoIniciada): Promise<ResultadoGeracao>` — o resto (linhas 223–297), igual.
  - `gerarQuestoesPor(ator, bruto)` = `concluirGeracaoPor(ator, await comecarGeracaoPor(ator, bruto))`, mesma assinatura com `AtorGeracao`.
  - `restanteHojePara(ator: AtorGeracao): Promise<number | null>` = `restanteHoje(await pedidasHoje(ator.escola_id), ator.role)` (para a resposta da Hermes).

- [ ] **Step 1:** Trocar `Professor` por `AtorGeracao` em `gerarQuestoesPor`, `candidatasExemplo`, `recentesGeradas`, `prepararPedido` (só usam `id`, `role`, `escola_id`; `podeVerQuestao` e `filtroVisivel` já aceitam esse formato — conferir os tipos deles).
- [ ] **Step 2:** Extrair `comecarGeracaoPor` / `concluirGeracaoPor` / `restanteHojePara` como acima, sem mudar mensagens nem ordem das operações.
- [ ] **Step 3:** Run `npx tsc --noEmit -p .` e `npm test` — Expected: sem erros de tipo; todos os testes passam (a tela `/banco/gerar` usa `gerarQuestoesPor` e não muda).
- [ ] **Step 4:** Commit `Gerador IA: nucleo em duas partes (comecar e concluir)`.

### Task 2: Partes puras da Hermes

**Files:**
- Create: `src/lib/mcp/acoes/geracao-hermes.ts`
- Create: `src/lib/mcp/acoes/geracao-hermes.test.ts`
- Modify: `package.json` (script `test`: acrescentar `src/lib/mcp/acoes/geracao-hermes.test.ts`)

**Interfaces:**
- Consumes: `materiaDoTexto` (`../leitura/banco`), `Perfil` (`./ator`), `MATERIAS`.
- Produces (todas puras):
  - `ERRO_GERACAO = "Geração não encontrada."`, `ERRO_BANCO_ESCOLA_GERACAO = "Você só pode gerar no banco da sua escola."`, `MSG_PAROU = "A geração parou no meio. Tente de novo."`, `JANELA_REPETIDA_MS = 15 * 60 * 1000`.
  - `type ArgsGerar = { materia?: string; assunto?: string; dificuldade: "facil"|"media"|"dificil"; quantidade: number; orientacao?: string; questao_modelo_id?: string; banco?: "escola"|"geral" }`
  - `type PedidoHermes = { materia: string | null; assunto: string | null; dificuldade; quantidade: number; orientacao: string; modeloId: string | null; escopo: "escola"|"geral" }`
  - `lerPedidoGeracao(args: ArgsGerar, perfil: Perfil): PedidoHermes` — `materia` vira a chave via `materiaDoTexto`; sem matéria e sem modelo → `"Diga a matéria (ou a questão modelo)."`; professor + geral → `ERRO_BANCO_ESCOLA_GERACAO`; strings aparadas, vazias viram null/"".
  - `criteriosGeracaoRepetida(p: { materia: string; assunto_id: string|null; dificuldade; quantidade: number; orientacao: string; escopo; base_id: string|null }, escolaId: string, professorId: string, agora: number)` → `{ escola_id, professor_id, status: "gerando", materia, assunto_id, dificuldade, quantidade_pedida, orientacao, questao_base_id, escopo, desde: ISO }`.
  - `gerandoParou(createdAt: string, agora: number): boolean` — `agora - created > MAX_GERANDO_MS` (de `@/lib/questoes/geracao`; data inválida → true).
  - `textoGeracaoIniciada(d: { id: string; rotulo: string; quantidade: number; restante: number | null }): string`
  - `type LinhaGerada = { id: string; enunciado: string; resposta: string | null; status: string }`
  - `textoSituacaoGeracao(d: { id: string; status: "gerando"|"concluida"|"erro"; minutos?: number; erro?: string | null; questoes?: LinhaGerada[]; descartadas?: number; custo?: number | null; link?: string }): string`
  - `escolherNumero<T>(lista: T[], numero: number): T` — 1..N; senão `"Essa geração tem N questões; peça um número de 1 a N."`.
  - `textoQuestaoCompleta(q: { id: string; enunciado: string; comando: string; alternativas: { letra: string; texto: string }[]; resposta: string | null; resolucao: string | null; status: string }, numero: number): string`

- [ ] **Step 1: Write the failing tests** em `geracao-hermes.test.ts` (padrão de `importacao.test.ts`, `node:test` + `assert/strict`):
  - `lerPedidoGeracao`: professor + `banco: "geral"` lança exatamente `ERRO_BANCO_ESCOLA_GERACAO`; dono + geral → `escopo "geral"`; padrão `"escola"`; `{ materia: "Matemática" }` → `materia: "matematica"`; sem matéria e sem modelo lança `/Diga a matéria/`; só `questao_modelo_id` → `materia: null`, `modeloId` preenchido; `orientacao: "  "` → `""`.
  - `criteriosGeracaoRepetida`: `desde` = `new Date(agora - JANELA_REPETIDA_MS).toISOString()`; `quantidade_pedida` = quantidade; `status: "gerando"`.
  - `gerandoParou`: criado há 9 min → false; há 11 min → true; `"xx"` → true.
  - `textoGeracaoIniciada`: contém o id, `"5 questões"`, `"situacao_geracao"`; com `restante: 55` contém `"55"`; com `restante: null` não fala em cota.
  - `textoSituacaoGeracao`: `gerando` com `minutos: 2` contém `"Ainda gerando"`; `erro` com `"A IA demorou demais. Tente uma quantidade menor. (Request timed out)"` mostra a frase sem o parêntese final; `concluida` com 2 questões contém `"1)"`, `"2)"`, as respostas `"(C)"`, os ids, o link, `"US$ 0,04"` para `custo: 0.043`; enunciado de 300 caracteres aparece cortado com `"…"` (até ~120); `concluida` com `questoes: []` diz que nenhuma está mais no banco.
  - `escolherNumero`: `([a,b], 2)` → b; `0` e `3` lançam `/de 1 a 2/`.
  - `textoQuestaoCompleta`: contém `"A) "`…, `"Resposta: C"`, a resolução quando houver, e `"Em revisão"` para `status: "revisao"`.
- [ ] **Step 2:** Run `npx tsx --test src/lib/mcp/acoes/geracao-hermes.test.ts` — Expected: FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `geracao-hermes.ts` com as assinaturas acima (formatação de dinheiro e plural como em `importacao.ts`; remover detalhe técnico com regex `/\s*\([^)]*\)\s*$/`).
- [ ] **Step 4:** Run o mesmo comando e `npm test` — Expected: PASS.
- [ ] **Step 5:** Commit `Hermes gerar questoes: partes puras e testes`.

### Task 3: Ferramentas MCP, `after` e instruções

**Files:**
- Create: `src/lib/mcp/acoes/geracao.ts`
- Modify: `src/lib/mcp/acoes.ts` (registrar para os dois perfis, junto de `registrarAcoesImportacao`)
- Modify: `src/lib/mcp/acoes/questoes.ts` (exportar `assuntoDaMateria` para reaproveitar)
- Modify: `src/app/api/mcp/route.ts`, `src/app/api/mcp/dono/route.ts` (`maxDuration = 300`; acrescentar ao `INSTRUCOES`)

**Interfaces:**
- Consumes: Task 1 (`comecarGeracaoPor`, `concluirGeracaoPor`, `restanteHojePara`), Task 2 (tudo), `escolaParaCriar`, `atorDoEscopo`, `contaDoDono`, `registrado`, `falha`, `campoId`, `campoEscola`, `campoTelefone`, `texto`, `urlDaEscola`.
- Produces: `registrarAcoesGeracao(server: McpServer, obter: ObterCtx, perfil: Perfil): void`.

- [ ] **Step 1: `gerar_questoes`** — inputSchema: `materia`, `assunto`, `dificuldade` (enum), `quantidade` (int 1–10), `orientacao` (max 500), `questao_modelo_id` (`campoId`, opcional), `banco` (enum), `...campoEscola`, `...campoTelefone`. Descrição avisa: IA paga (alguns centavos de dólar por pedido), resumir e pedir confirmação antes, questões entram em revisão, depois `situacao_geracao`. Fluxo: `lerPedidoGeracao` → ator como `importar_prova` (geral: `contaDoDono`; escola: `escolaParaCriar` + `atorDoEscopo`) → assunto por nome com `assuntoDaMateria` (com modelo e sem matéria: ler a matéria da modelo antes) → montar o `bruto` do núcleo (`materia`, `assunto_id`, `quantidade`, `dificuldade`, `orientacao`, `escopo`, `base_id`) → dentro de `registrado(perfil, ator, "gerar_questoes", args, …)`: procurar repetida com `criteriosGeracaoRepetida` (`.eq` de cada campo, `.is` para nulos, `.gte("created_at", desde)`); se houver, responder `"Já estou gerando essas questões (geração X); use situacao_geracao."`; senão `comecarGeracaoPor`, `after(async () => { try { await concluirGeracaoPor(...) } catch (e) { console.error(...) } ; revalidar /banco protegido })`, responder `textoGeracaoIniciada` com `restanteHojePara`. Erros via `falha("gerar as questões", e)`.
- [ ] **Step 2: `situacao_geracao`** — inputSchema: `geracao_id` (`campoId`), `numero` (int ≥ 1, opcional), `...campoTelefone`. Ler `geracoes_ia` (`id, escola_id, status, erro, created_at, custo_usd, quantidade_pedida, quantidade_gerada, materia`); inexistente → `ERRO_GERACAO`; `atorDoEscopo(ctx, escola_id, ERRO_GERACAO)`. `gerando` + `gerandoParou` → update `status: "erro", erro: MSG_PAROU` (só se ainda `gerando`) e responder isso. `concluida` → questões `.eq("geracao_id", id).order("created_at")` (`id, enunciado, comando, alternativas, resposta, resolucao, status`); `descartadas = quantidade_pedida - quantidade_gerada` (mín. 0); link `urlDaEscola(slug, \`/banco?origem=ia&status=revisao&materia=${materia}\`)`. Com `numero`: `escolherNumero` + `textoQuestaoCompleta` (geração não concluída → `"A geração ainda não terminou."`).
- [ ] **Step 3: Routes** — `maxDuration = 300` nos dois. Acrescentar ao `INSTRUCOES` dos dois (texto da spec, seção "Instruções da Hermes"): resumir e pedir confirmação antes de `gerar_questoes` citando que a IA é paga (alguns centavos de dólar) e a cota; depois `situacao_geracao`; com o pedido ainda gerando, dizer que leva alguns minutos e consultar de novo quando o professor perguntar; se `gerar_questoes` falhar por tempo, não repetir sem perguntar; questões ficam em revisão, `situacao_geracao` com `numero` mostra uma inteira, `publicar_questao` publica.
- [ ] **Step 4:** Run `npm test`, `npm run lint`, `npm run build` — Expected: tudo limpo.
- [ ] **Step 5:** Commit `Hermes: gerar_questoes e situacao_geracao`.

### Task 4: Publicar e conferir

- [ ] **Step 1:** Conferência só-leitura no banco (SQL nenhum novo, mas confirmar): `select id, status, erro, custo_usd, quantidade_gerada from geracoes_ia limit 1` e `select geracao_id, resolucao from questoes limit 1` (com `.limit(1)`, não `head: true`).
- [ ] **Step 2:** `git fetch && git rebase origin/master`, `npm test`, push no `master`.
- [ ] **Step 3:** Conferir no domínio: `POST https://www.statusavalia.com.br/api/mcp/dono` com `tools/list` (token do `.env.local`, nunca no chat) mostra `gerar_questoes` e `situacao_geracao`.
- [ ] **Step 4:** Atualizar `CLAUDE.md` (item 8 / próximo passo) e a memória do gerador; commit e push.
