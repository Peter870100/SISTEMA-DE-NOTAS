# Hermes — Etapa A (ver tudo, consulta livre, desempenho, saídas da página) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Hermes passa a enxergar o sistema inteiro — pelo MCP do dono (todas as escolas + consulta livre só de leitura) e pelo MCP dos professores (só a escola/turmas do professor) — e o sistema passa a registrar saídas da página em simulados e aulas.

**Architecture:** Ferramentas de leitura num módulo único (`src/lib/mcp/leitura.ts`) que recebe um **escopo** (`dono` ou `professor` com escola e turmas liberadas) e é registrado em dois endpoints: o novo `/api/mcp/dono` (senha `MCP_DONO_TOKEN`) e o atual `/api/mcp`. Montagem de textos e contas em funções puras testadas (`src/lib/hermes/*.ts`). Consulta livre via ferramenta estruturada (`consultar_dados`: tabela + colunas + filtros de uma lista fixa, sem colunas sensíveis), executada no servidor — sem SQL livre no banco. Saídas da página contadas no navegador (Page Visibility API) e enviadas pelos mesmos caminhos que já levam o tempo por questão e o progresso da aula.

**Tech Stack:** Next.js 16.2 (App Router, server actions), React 19, Supabase (PostgREST, chave anon só no servidor), `@modelcontextprotocol/sdk` (`McpServer`, `WebStandardStreamableHTTPServerTransport`), `zod`, testes `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-12-hermes-assistente-pessoal-design.md`

## Global Constraints

- Respostas e textos em **pt-BR**; textos da Hermes curtos e diretos.
- **Nunca** ler/expor `senha_hash`, `token_verificacao`, `token_verificacao_expira`, `codigo_convite`, `codigo_convite_professor` (em ferramentas e nas views `hermes.*`).
- Sem chave geral do Supabase: tudo pelo MCP; a chave anon fica só no servidor.
- `MCP_DONO_TOKEN` e `MCP_SECRET_TOKEN` comparados em tempo constante; senha ausente = 401 em tudo.
- Perfil professor: **toda ferramenta nova exige `professor_telefone`**; telefone não cadastrado = erro "Telefone não cadastrado como professor."; alcance = escola do professor e, se `acesso_restrito` e não admin, só as turmas liberadas (por **nome**).
- Etapa A **não altera dados** pelo MCP (as ferramentas antigas da planilha continuam iguais).
- Consulta livre: só no perfil dono; no máximo **500 linhas**, **8 s**.
- Saídas da página valem **daqui para frente**; dados antigos aparecem como "—".
- SQL novo vai em `db/schema.sql` **e** em `db/2026-10-12-hermes-etapa-a.sql`; o Peter cola no SQL Editor; antes de publicar código que dependa dele, conferir (só leitura) que foi aplicado.
- Cada tarefa termina com `npx tsc --noEmit -p .`, `npm test`, `npm run lint` verdes; build ao final de cada lote publicado.
- Commits em pt-BR com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push no `master` após rebase em `origin/master`.

## Review Focus

1. **Professor de outra escola / acesso restrito pedindo turma que não é dele** → deve receber "turma não encontrada", nunca dados. (Teste em Task 6.)
2. **Consulta livre tentando escrever ou ler coluna sensível** (`update ...`, `select senha_hash from public.alunos_contas`) → erro do banco, nada muda. (Verificação SQL em Task 1 e teste de mensagem em Task 7.)
3. **Aluno que sai e volta muitas vezes / perde conexão** → contadores nunca diminuem nem duplicam ao reenviar (merge por máximo; eventos limitados a 200). (Teste em Task 2.)
4. **Simulado sem entregas / aluno sem tentativa** → `resultado_simulado` e `desempenho_turma` listam "não começou" sem quebrar. (Teste em Task 3.)
5. **Nome de turma/aluno/simulado com acento ou maiúsculas diferentes** → busca acha mesmo assim (normalização). (Teste em Task 3.)

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `db/2026-10-12-hermes-etapa-a.sql` (novo) + `db/schema.sql` | colunas de saídas, schema/views `hermes`, papel `hermes_leitor`, função `hermes_consulta` |
| `src/lib/hermes/presenca.ts` (novo) | regras puras de saídas (merge, limites, formatação) |
| `src/lib/hermes/relatorios.ts` (novo) | montagem pura dos textos: resultado de simulado, desempenho de turma, perfil de aluno, progresso de curso |
| `src/lib/hermes/hermes.test.ts` (novo) | testes das funções acima + senha |
| `src/lib/hermes/senha.ts` (novo) | comparação de senha em tempo constante |
| `src/lib/mcp/escopo.ts` (novo) | tipo `Escopo` e resolução pelo telefone |
| `src/lib/mcp/leitura.ts` (novo) | registra as ferramentas de leitura (consultas Supabase + relatórios) |
| `src/app/api/mcp/dono/route.ts` (novo) | endpoint do dono + `instructions` |
| `src/app/api/mcp/route.ts` | passa a registrar também as ferramentas de leitura (perfil professor) |
| `src/components/simulados/ProvaAluno.tsx`, `src/actions/simulados-aluno.ts`, `src/lib/simulados/servidor.ts` | enviar e gravar saídas no simulado |
| `src/components/simulados/ComecarTentativa.tsx` | aviso "a plataforma registra quando você sai" |
| `src/app/simulados/[id]/page.tsx` | coluna "Saídas" |
| `src/components/aulas/PlayerVideo.tsx`, `src/components/aulas/AulaAluno.tsx`, `src/actions/progresso.ts` | tempo assistido real e saídas na aula |
| `src/app/cursos/[id]/progresso/page.tsx` | tempo assistido e saídas |
| `src/lib/types.ts` | novos campos |
| `package.json` | incluir `src/lib/hermes/hermes.test.ts` no script `test` |

---

### Task 1: SQL da Etapa A

**Files:**
- Create: `db/2026-10-12-hermes-etapa-a.sql`
- Modify: `db/schema.sql` (anexar o mesmo conteúdo ao final, com cabeçalho `-- ===== Hermes etapa A (2026-10-12) =====`)
- Modify: `src/lib/types.ts` (campos em `Tentativa` e `AulaProgresso`)

**Interfaces:**
- Produces: colunas `tentativas.saidas int`, `tentativas.tempo_fora_seg int`, `tentativas.eventos_saida jsonb`; `aula_progresso.tempo_assistido_seg int`, `aula_progresso.saidas int`, `aula_progresso.tempo_fora_seg int`. (Revisão de segurança: **sem** função de SQL livre no banco — ver Task 6, `consultar_dados` estruturado.)

- [ ] **Step 1: Escrever o SQL**

```sql
-- ===== Hermes etapa A (2026-10-12) =====
alter table tentativas add column if not exists saidas integer not null default 0;
alter table tentativas add column if not exists tempo_fora_seg integer not null default 0;
alter table tentativas add column if not exists eventos_saida jsonb;
alter table aula_progresso add column if not exists tempo_assistido_seg integer not null default 0;
alter table aula_progresso add column if not exists saidas integer not null default 0;
alter table aula_progresso add column if not exists tempo_fora_seg integer not null default 0;

```

- [ ] **Step 2: Tipos** — em `src/lib/types.ts`, `Tentativa` ganha `saidas: number; tempo_fora_seg: number; eventos_saida: EventoSaida[] | null;` e exporta `export type EventoSaida = { questao: number | null; saiu_em: string; voltou_em: string | null };`. `AulaProgresso` ganha `tempo_assistido_seg: number; saidas: number; tempo_fora_seg: number;`.

- [ ] **Step 3: Verificar tipos** — `npx tsc --noEmit -p .` → sem erros.

- [ ] **Step 4: Commit** — `git add db src/lib/types.ts && git commit -m "Hermes A: SQL de saidas e consulta livre (hermes_consulta)"`.

- [ ] **Step 5: Pedir ao Peter para colar** `db/2026-10-12-hermes-etapa-a.sql` no SQL Editor (só `alter table ... add column if not exists`). Depois conferir com script só de leitura que `select saidas, tempo_fora_seg, eventos_saida from tentativas limit 1` e `select tempo_assistido_seg, saidas, tempo_fora_seg from aula_progresso limit 1` respondem. Não publicar código das Tasks 4–7 antes disso.

---

### Task 2: Regras puras de saídas da página

**Files:**
- Create: `src/lib/hermes/presenca.ts`, `src/lib/hermes/hermes.test.ts`
- Modify: `package.json` (acrescentar `src/lib/hermes/hermes.test.ts` ao script `test`)

**Interfaces:**
- Produces:
  - `type Presenca = { saidas: number; tempoForaSeg: number; eventos: EventoSaida[] }`
  - `mesclarPresenca(salva: Partial<Presenca> | null, nova: unknown): Presenca` — contadores = máximo dos dois (nunca diminuem), inteiros ≥ 0, `tempoForaSeg` ≤ 6 h; eventos = união por `saiu_em`, ordenados, no máximo 200, `questao` inteiro ≥ 1 ou null.
  - `formatarPresenca(saidas: number | null, foraSeg: number | null): string` — `"—"` se null; `"nenhuma"` se 0; senão `"3 saídas · 2:40 fora"` (1 → "1 saída").

- [ ] **Step 1: Teste que falha**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarPresenca, mesclarPresenca } from "./presenca";

test("mesclarPresenca: nunca diminui, limita e une eventos", () => {
  const a = mesclarPresenca({ saidas: 3, tempoForaSeg: 100, eventos: [{ questao: 2, saiu_em: "2026-10-12T10:00:00Z", voltou_em: "2026-10-12T10:01:00Z" }] },
    { saidas: 2, tempoForaSeg: 150.6, eventos: [{ questao: 2, saiu_em: "2026-10-12T10:00:00Z", voltou_em: null }, { questao: 5, saiu_em: "2026-10-12T10:05:00Z", voltou_em: null }] });
  assert.equal(a.saidas, 3);
  assert.equal(a.tempoForaSeg, 151);
  assert.equal(a.eventos.length, 2);
  assert.equal(mesclarPresenca(null, { saidas: -4, tempoForaSeg: 999999, eventos: "x" }).tempoForaSeg, 6 * 3600);
  assert.equal(mesclarPresenca(null, { saidas: -4 }).saidas, 0);
  const muitos = Array.from({ length: 250 }, (_, i) => ({ questao: 1, saiu_em: new Date(1e12 + i * 1000).toISOString(), voltou_em: null }));
  assert.equal(mesclarPresenca(null, { eventos: muitos }).eventos.length, 200);
});

test("formatarPresenca", () => {
  assert.equal(formatarPresenca(null, null), "—");
  assert.equal(formatarPresenca(0, 0), "nenhuma");
  assert.equal(formatarPresenca(1, 65), "1 saída · 1:05 fora");
  assert.equal(formatarPresenca(3, 160), "3 saídas · 2:40 fora");
});
```

- [ ] **Step 2:** `npx tsx --test src/lib/hermes/hermes.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
import { formatarDuracao } from "@/lib/simulados/regras";
import type { EventoSaida } from "@/lib/types";

export type Presenca = { saidas: number; tempoForaSeg: number; eventos: EventoSaida[] };
const MAX_FORA = 6 * 3600;
const MAX_EVENTOS = 200;

const inteiro = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : 0);
const data = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

function eventos(v: unknown): EventoSaida[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((e) => {
    const saiu = data(e?.saiu_em);
    if (!saiu) return [];
    const q = typeof e?.questao === "number" && Number.isInteger(e.questao) && e.questao >= 1 ? e.questao : null;
    return [{ questao: q, saiu_em: saiu, voltou_em: data(e?.voltou_em) }];
  });
}

export function mesclarPresenca(salva: Partial<Presenca> | null, nova: unknown): Presenca {
  const n = (nova && typeof nova === "object" ? nova : {}) as Record<string, unknown>;
  const porSaida = new Map<string, EventoSaida>();
  for (const e of [...eventos(salva?.eventos), ...eventos(n.eventos)]) {
    const atual = porSaida.get(e.saiu_em);
    porSaida.set(e.saiu_em, atual && atual.voltou_em ? atual : e);
  }
  return {
    saidas: Math.max(inteiro(salva?.saidas, 1e6), inteiro(n.saidas, 1e6)),
    tempoForaSeg: Math.max(inteiro(salva?.tempoForaSeg, MAX_FORA), inteiro(n.tempoForaSeg, MAX_FORA)),
    eventos: [...porSaida.values()].sort((a, b) => a.saiu_em.localeCompare(b.saiu_em)).slice(-MAX_EVENTOS),
  };
}

export function formatarPresenca(saidas: number | null, foraSeg: number | null): string {
  if (saidas == null || foraSeg == null) return "—";
  if (saidas === 0) return "nenhuma";
  return `${saidas} ${saidas === 1 ? "saída" : "saídas"} · ${formatarDuracao(foraSeg)} fora`;
}
```

- [ ] **Step 4:** teste → PASS; acrescentar `src/lib/hermes/hermes.test.ts` ao `"test"` do `package.json`; `npm test` → todos passam.

- [ ] **Step 5: Commit** — `"Hermes A: regras de presenca na pagina (merge e formato)"`.

---

### Task 3: Relatórios puros (simulado, turma, aluno, curso)

**Files:**
- Create: `src/lib/hermes/relatorios.ts`
- Test: `src/lib/hermes/hermes.test.ts`

**Interfaces:**
- Consumes: `formatarPresenca` (Task 2), `formatarDuracao`, `tempoDeProvaSeg` (`src/lib/simulados/regras.ts`).
- Produces:
  - `normalizarBusca(s: string): string` — minúsculas, sem acento, espaços colapsados.
  - `type LinhaAluno = { nome: string; status: "entregue" | "em_andamento" | "nao_comecou"; porcentagem: number | null; acertos: number | null; total: number | null; tempoSeg: number | null; saidas: number | null; tempoForaSeg: number | null }`
  - `situacaoTurmaNoSimulado(alunos: { contaId: string; nome: string }[], tentativas: Map<string, Pick<Tentativa,"status"|"porcentagem"|"acertos"|"total"|"iniciada_em"|"entregue_em"|"prazo_em"|"tempo_usado_seg"|"saidas"|"tempo_fora_seg">>, tipo: "professor" | "treino"): LinhaAluno[]` — ordenado por nome; sem tentativa = `nao_comecou`.
  - `textoResultadoSimulado(titulo: string, linhas: LinhaAluno[], maisErradas: { rotulo: string; pct: number; tempoMedioSeg: number | null }[]): string` — cabeçalho com contagens ("12 entregaram · 3 em andamento · 5 não começaram · média 64,5%"), lista por aluno, top 5 mais erradas.
  - `textoProgressoAula(maiorPosicaoSeg: number, duracaoSeg: number | null, tempoAssistidoSeg: number, concluida: boolean, saidas: number, foraSeg: number): string` — ex.: `"assistiu até 12:40 de 18:00 (70%) · 23:10 assistidos · 2 saídas · 1:05 fora"`, `"concluída"`, `"não assistiu"`.

- [ ] **Step 1: Teste que falha**

```ts
import { normalizarBusca, situacaoTurmaNoSimulado, textoProgressoAula, textoResultadoSimulado } from "./relatorios";

test("normalizarBusca", () => assert.equal(normalizarBusca("  3ª Série  A "), "3a serie a"));

test("situacaoTurmaNoSimulado e texto", () => {
  const ini = "2026-10-12T10:00:00Z";
  const t = new Map([["c1", { status: "entregue", porcentagem: 80, acertos: 8, total: 10, iniciada_em: ini, entregue_em: "2026-10-12T10:30:00Z", prazo_em: null, tempo_usado_seg: 0, saidas: 2, tempo_fora_seg: 40 }],
    ["c2", { status: "em_andamento", porcentagem: null, acertos: null, total: null, iniciada_em: ini, entregue_em: null, prazo_em: null, tempo_usado_seg: 0, saidas: 0, tempo_fora_seg: 0 }]] as const);
  const l = situacaoTurmaNoSimulado([{ contaId: "c3", nome: "Carla" }, { contaId: "c1", nome: "Ana" }, { contaId: "c2", nome: "Bruno" }], new Map(t as never), "professor");
  assert.deepEqual(l.map((x) => [x.nome, x.status]), [["Ana", "entregue"], ["Bruno", "em_andamento"], ["Carla", "nao_comecou"]]);
  assert.equal(l[0].tempoSeg, 1800);
  const txt = textoResultadoSimulado("Ufms 24", l, []);
  assert.match(txt, /1 entregou · 1 em andamento · 1 não começou/);
  assert.match(txt, /Ana — 80% \(8\/10\) · 30:00 · 2 saídas · 0:40 fora/);
  assert.equal(textoResultadoSimulado("X", [], []).includes("Nenhum aluno"), true);
});

test("textoProgressoAula", () => {
  assert.equal(textoProgressoAula(0, 600, 0, false, 0, 0), "não assistiu");
  assert.equal(textoProgressoAula(600, 600, 700, true, 0, 0), "concluída · 11:40 assistidos");
  assert.equal(textoProgressoAula(760, 1080, 1390, false, 2, 65), "assistiu até 12:40 de 18:00 (70%) · 23:10 assistidos · 2 saídas · 1:05 fora");
});
```

- [ ] **Step 2:** rodar → FAIL.

- [ ] **Step 3: Implementar** `src/lib/hermes/relatorios.ts`

```ts
import { formatarDuracao, tempoDeProvaSeg } from "@/lib/simulados/regras";
import type { Tentativa } from "@/lib/types";
import { formatarPresenca } from "./presenca";

export function normalizarBusca(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ª|º/g, (c) => (c === "ª" ? "a" : "o")).toLowerCase().replace(/\s+/g, " ").trim();
}

type TentResumo = Pick<Tentativa, "status" | "porcentagem" | "acertos" | "total" | "iniciada_em" | "entregue_em" | "prazo_em" | "tempo_usado_seg" | "saidas" | "tempo_fora_seg">;
export type LinhaAluno = { nome: string; status: "entregue" | "em_andamento" | "nao_comecou"; porcentagem: number | null; acertos: number | null; total: number | null; tempoSeg: number | null; saidas: number | null; tempoForaSeg: number | null };

export function situacaoTurmaNoSimulado(alunos: { contaId: string; nome: string }[], tentativas: Map<string, TentResumo>, tipo: "professor" | "treino"): LinhaAluno[] {
  return alunos.map(({ contaId, nome }) => {
    const t = tentativas.get(contaId);
    if (!t) return { nome, status: "nao_comecou" as const, porcentagem: null, acertos: null, total: null, tempoSeg: null, saidas: null, tempoForaSeg: null };
    const entregue = t.status === "entregue";
    return { nome, status: entregue ? "entregue" as const : "em_andamento" as const,
      porcentagem: entregue && t.porcentagem != null ? Number(t.porcentagem) : null, acertos: entregue ? t.acertos : null, total: entregue ? t.total : null,
      tempoSeg: entregue ? tempoDeProvaSeg(tipo, t) : null, saidas: t.saidas ?? null, tempoForaSeg: t.tempo_fora_seg ?? null };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export function textoResultadoSimulado(titulo: string, linhas: LinhaAluno[], maisErradas: { rotulo: string; pct: number; tempoMedioSeg: number | null }[]): string {
  if (linhas.length === 0) return `${titulo}: Nenhum aluno nas turmas deste simulado.`;
  const ent = linhas.filter((l) => l.status === "entregue");
  const notas = ent.map((l) => l.porcentagem).filter((p): p is number => p != null);
  const media = notas.length ? ` · média ${pct(notas.reduce((a, b) => a + b, 0) / notas.length)}` : "";
  const cab = `${titulo}: ${plural(ent.length, "entregou", "entregaram")} · ${linhas.filter((l) => l.status === "em_andamento").length} em andamento · ${plural(linhas.filter((l) => l.status === "nao_comecou").length, "não começou", "não começaram")}${media}`;
  const linhasTxt = linhas.map((l) => {
    if (l.status === "nao_comecou") return `- ${l.nome} — não começou`;
    if (l.status === "em_andamento") return `- ${l.nome} — em andamento · saídas: ${formatarPresenca(l.saidas, l.tempoForaSeg)}`;
    return `- ${l.nome} — ${pct(l.porcentagem ?? 0)} (${l.acertos ?? 0}/${l.total ?? 0}) · ${l.tempoSeg != null ? formatarDuracao(l.tempoSeg) : "—"} · ${formatarPresenca(l.saidas, l.tempoForaSeg)}`;
  });
  const erradas = maisErradas.slice(0, 5).map((q) => `- ${q.rotulo}: ${pct(q.pct)} de acerto${q.tempoMedioSeg != null ? ` · ${formatarDuracao(q.tempoMedioSeg)} em média` : ""}`);
  return [cab, ...linhasTxt, ...(erradas.length ? ["Questões mais erradas:", ...erradas] : [])].join("\n");
}

export function textoProgressoAula(maiorPosicaoSeg: number, duracaoSeg: number | null, tempoAssistidoSeg: number, concluida: boolean, saidas: number, foraSeg: number): string {
  const extras = [tempoAssistidoSeg > 0 ? `${formatarDuracao(tempoAssistidoSeg)} assistidos` : null, saidas > 0 ? formatarPresenca(saidas, foraSeg) : null].filter(Boolean);
  if (concluida) return ["concluída", ...extras].join(" · ");
  if (maiorPosicaoSeg <= 0 && tempoAssistidoSeg <= 0) return "não assistiu";
  const base = duracaoSeg ? `assistiu até ${formatarDuracao(maiorPosicaoSeg)} de ${formatarDuracao(duracaoSeg)} (${Math.min(100, Math.round((100 * maiorPosicaoSeg) / duracaoSeg))}%)` : `assistiu até ${formatarDuracao(maiorPosicaoSeg)}`;
  return [base, ...extras].join(" · ");
}
```

- [ ] **Step 4:** testes → PASS; `npm test` verde.
- [ ] **Step 5: Commit** — `"Hermes A: relatorios puros de simulado, turma e aula"`.

---

### Task 4: Saídas da página no simulado (aluno → servidor → tela do professor)

**Files:**
- Modify: `src/components/simulados/ProvaAluno.tsx`, `src/actions/simulados-aluno.ts`, `src/lib/simulados/servidor.ts`, `src/components/simulados/ComecarTentativa.tsx`, `src/app/simulados/[id]/page.tsx`

**Interfaces:**
- Consumes: `mesclarPresenca`, `formatarPresenca`, `Presenca` (Task 2).
- Produces: `salvarTempos(t, tempos, presenca?: unknown)` em `servidor.ts` grava também `saidas`, `tempo_fora_seg`, `eventos_saida` via `mesclarPresenca`; `responder`, `pulsoTreino`, `pausarTreino`, `entregar` aceitam 5º/3º parâmetro opcional `presenca?: { saidas: number; tempoForaSeg: number; eventos: EventoSaida[] }`.

- [ ] **Step 1: Servidor** — em `salvarTempos` (`src/lib/simulados/servidor.ts`), ampliar a assinatura para `(t: { id: string; ordem: string[]; tempo_questoes: unknown; saidas?: number; tempo_fora_seg?: number; eventos_saida?: unknown }, tempos: unknown, presenca?: unknown)`; calcular `const p = presenca ? mesclarPresenca({ saidas: t.saidas, tempoForaSeg: t.tempo_fora_seg, eventos: t.eventos_saida as never }, presenca) : null;` e incluir no `update` `...(p ? { saidas: p.saidas, tempo_fora_seg: p.tempoForaSeg, eventos_saida: p.eventos } : {})`. Não pular o update quando só a presença mudou (comparar também `p`).
- [ ] **Step 2: Actions** — em `src/actions/simulados-aluno.ts`, repassar o novo parâmetro em `responder`, `pulsoTreino`, `pausarTreino`, `entregar` para `salvarTempos`.
- [ ] **Step 3: Navegador** — em `ProvaAluno.tsx`, `const presenca = useRef<Presenca>({ saidas: 0, tempoForaSeg: 0, eventos: [] })` com cópia em `localStorage` chave `prova-presenca:<tentativaId>` (carregar no mesmo efeito que carrega os tempos, usando `mesclarPresenca`). Listener `visibilitychange`: ao ficar `hidden` (e não `encerrando`), `saidas += 1` e empurra `{ questao: atualRef.current + 1, saiu_em: agora, voltou_em: null }`; ao voltar `visible`, preenche `voltou_em` do último evento e soma a diferença (segundos) em `tempoForaSeg`. Enviar `{ ...presenca.current }` em todas as chamadas que já enviam `{ ...tempos.current }`.
- [ ] **Step 4: Aviso** — em `ComecarTentativa.tsx`, acima do botão: `<p className="text-sm text-ink">A plataforma registra quando você sai desta página durante a prova.</p>`; e em `ProvaAluno.tsx`, no painel "Seu progresso", uma linha discreta com o mesmo texto.
- [ ] **Step 5: Tela do professor** — em `src/app/simulados/[id]/page.tsx`, nova coluna "Saídas" antes de "Tempo" com `t.eventos_saida === null && t.saidas === 0 ? "—" : formatarPresenca(t.saidas, t.tempo_fora_seg)` (tentativas antigas não têm o dado e mostram "—").
- [ ] **Step 6: Verificar** — `npx tsc --noEmit -p .`, `npm run lint`, `npm test`; prévia Playwright do resultado com dados fictícios (ver skill `status-visual-aluno`, referências) para conferir a coluna.
- [ ] **Step 7: Commit** — `"Simulado registra saidas da pagina e mostra ao professor"`.

---

### Task 5: Tempo assistido real e saídas na aula

**Files:**
- Modify: `src/components/aulas/PlayerVideo.tsx`, `src/components/aulas/AulaAluno.tsx`, `src/actions/progresso.ts`, `src/app/cursos/[id]/progresso/page.tsx`

**Interfaces:**
- Consumes: `mesclarPresenca`, `textoProgressoAula`.
- Produces: `registrarProgresso(aulaId: string, posicaoSeg: number, extra?: { assistidoDeltaSeg: number; saidas: number; tempoForaSeg: number })`.

- [ ] **Step 1: Player** — em `PlayerVideo.tsx`, ao `informar()` (já chamado a cada `INTERVALO_MS` e ao esconder), calcular `assistidoDeltaSeg` = segundos desde o último informe **somente se** a aba esteve visível e o vídeo em reprodução (usar o estado do player já disponível); contar saídas/tempo fora como na Task 4 (sem eventos). Repassar pelo callback já existente até `AulaAluno` → `registrarProgresso(aulaId, posicao, extra)`.
- [ ] **Step 2: Servidor** — em `registrarProgresso`, ler `tempo_assistido_seg, saidas, tempo_fora_seg` do `anterior`; `tempo_assistido_seg = anterior + min(assistidoDeltaSeg, 120)` (delta limitado contra envio errado); saídas/tempo fora por `mesclarPresenca` (máximo). Gravar nos dois `upsert` (com e sem duração).
- [ ] **Step 3: Aviso** — no `AulaAluno`, abaixo do player: "A plataforma registra quanto tempo você assiste e quando sai desta página."
- [ ] **Step 4: Tela do professor** — em `progresso/page.tsx`, ler `maior_posicao_seg, duracao_seg, tempo_assistido_seg, saidas, tempo_fora_seg, concluida_em` e mostrar coluna "Assistido" (tempo somado) e "Saídas" por aluno (soma das aulas do curso).
- [ ] **Step 5: Verificar** (tsc, lint, test) e **Commit** — `"Aula registra tempo assistido real e saidas da pagina"`.

---

### Task 6: Escopo e ferramentas de leitura (módulo único)

**Files:**
- Create: `src/lib/mcp/escopo.ts`, `src/lib/mcp/leitura.ts`, `src/lib/hermes/senha.ts`
- Test: `src/lib/hermes/hermes.test.ts`

**Interfaces:**
- Produces:
  - `type Escopo = { tipo: "dono" } | { tipo: "professor"; escolaId: string; professorId: string; turmas: Set<string> | null }` (`turmas` null = todas da escola).
  - `async function escopoDoTelefone(supabase, telefone: string | undefined): Promise<Escopo>` — busca `professores` por `telefone` (sem filtro de escola), lança "Telefone não cadastrado como professor." se não achar; `turmas` = null se admin/sem restrição, senão `professor_turma_acesso`.
  - `podeVerTurma(e: Escopo, escolaId: string, turmaNome: string): boolean` (pura).
  - `senhaConfere(recebida: string | null, esperada: string | undefined): boolean` (pura, `timingSafeEqual` sobre SHA-256 dos dois).
  - `registrarLeitura(server: McpServer, supabase: SupabaseClient, obterEscopo: (args: { professor_telefone?: string }) => Promise<Escopo>, opcoes: { consultaLivre: boolean })`.

- [ ] **Step 1: Testes que falham**

```ts
import { podeVerTurma } from "../mcp/escopo";
import { senhaConfere } from "./senha";

test("podeVerTurma respeita escola e turmas liberadas", () => {
  assert.equal(podeVerTurma({ tipo: "dono" }, "e2", "3ª A"), true);
  const prof = { tipo: "professor" as const, escolaId: "e1", professorId: "p", turmas: new Set(["3ª A"]) };
  assert.equal(podeVerTurma(prof, "e1", "3ª A"), true);
  assert.equal(podeVerTurma(prof, "e1", "3ª B"), false);
  assert.equal(podeVerTurma(prof, "e2", "3ª A"), false);
  assert.equal(podeVerTurma({ ...prof, turmas: null }, "e1", "qualquer"), true);
});

test("senhaConfere", () => {
  assert.equal(senhaConfere("Bearer abc", "abc"), true);
  assert.equal(senhaConfere("Bearer abd", "abc"), false);
  assert.equal(senhaConfere(null, "abc"), false);
  assert.equal(senhaConfere("Bearer ", undefined), false);
});
```

- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar** `escopo.ts` (com `podeVerTurma` puro e `escopoDoTelefone`) e `senha.ts`:

```ts
import { createHash, timingSafeEqual } from "node:crypto";
export function senhaConfere(cabecalho: string | null, esperada: string | undefined): boolean {
  if (!esperada || !cabecalho) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(cabecalho), h(`Bearer ${esperada}`));
}
```

- [ ] **Step 4: Ferramentas** em `leitura.ts` (todas com `inputSchema` zod, `escola` opcional em dono — ignorado no perfil professor, que usa a escola dele; busca por nome com `normalizarBusca`; erros de "não encontrado" quando `podeVerTurma` for falso):
  - `visao_geral` — por escola visível: contagens (professores, turmas distintas por nome+ano, contas de aluno, simulados abertos, cursos, questões publicadas visíveis).
  - `listar_simulados {escola?, situacao?: "aberto"|"agendado"|"encerrado"|"rascunho", tipo?: "professor"|"treino"}` — título, situação (`situacaoSimulado`), turmas, entregas/começaram.
  - `resultado_simulado {simulado}` — acha por título normalizado; alunos das turmas do simulado via `aluno_turmas` + `alunos_contas`; tentativas; respostas para "mais erradas"; texto via `situacaoTurmaNoSimulado` + `textoResultadoSimulado`.
  - `desempenho_turma {turma, ano_letivo?}` — notas da planilha (média por aluno com `mediaAluno` e `paraEscala10` de `src/lib/analytics.ts`, as mesmas da tela da turma), simulados das turma (status por aluno resumido) e cursos ligados à turma (aulas concluídas/assistidas por aluno com `textoProgressoAula`).
  - `listar_cursos {escola?}` e `progresso_curso {curso, turma?}`.
  - `buscar_questoes {banca?, ano?, materia?, area?, situacao?, texto?, limite?=20}` — banca com `padraoExato` (`src/lib/questoes/busca.ts`); devolve id, banca/ano/nº, matéria, situação, 120 caracteres do enunciado.
  - `estatisticas_banco {escola?}` e `listar_importacoes {escola?}`.
  - `listar_contas_aluno {escola?, turma?}` e `listar_professores {escola?}` (sem colunas sensíveis — `select` explícito).
  - `perfil_aluno {nome}` — contas visíveis com nome parecido (se >1, listar e pedir para escolher); turmas, notas da planilha da turma correspondente (por nome), tentativas (simulados e treinos com nota/tempo/saídas), progresso nos cursos (`textoProgressoAula` por aula), último acesso.
  - Se `opcoes.consultaLivre`: `consultar_dados {tabela, colunas?, filtros?, ordem?, limite?}` — consulta **estruturada**, só leitura, executada no servidor com supabase-js (sem SQL vindo da Hermes):
    - `TABELAS_LIVRES` (constante em `src/lib/hermes/consulta-livre.ts`): mapa tabela → colunas permitidas, cobrindo escolas (sem `codigo_convite_professor`), professores (sem `senha_hash`, `token_verificacao`, `token_verificacao_expira`), professor_turma_acesso, turmas, alunos, atividades_colunas, notas_celulas, notas_historico, alunos_contas (sem `senha_hash`, tokens), aluno_turmas, cursos, curso_turmas, modulos, aulas, aula_progresso, assuntos, importacoes, questoes, simulados, simulado_turmas, simulado_questoes, tentativas, tentativa_respostas. `configuracoes` e `convites_turma` ficam de fora.
    - `filtros`: lista de `{coluna, op, valor}` com `op` em `eq, neq, gt, gte, lt, lte, ilike, in, is_null, not_null`; coluna precisa estar na lista da tabela. `ordem`: `{coluna, asc}`. `limite` 1–500 (padrão 100). `colunas` omitido = todas as permitidas.
    - Função pura `validarConsultaLivre(entrada): { tabela; colunas: string[]; filtros; ordem; limite } | { erro: string }` com testes: tabela fora da lista, coluna sensível pedida (`senha_hash`), op inválida, limite fora da faixa → erro em pt-BR.
    - Resultado em JSON indentado truncado a 60 000 caracteres com aviso; conta total via `count: "exact"`.
- [ ] **Step 5: Verificar** (tsc, lint, test) e **Commit** — `"Hermes A: ferramentas de leitura com escopo dono/professor"`.

---

### Task 7: Endpoints (dono novo + professor atual)

**Files:**
- Create: `src/app/api/mcp/dono/route.ts`
- Modify: `src/app/api/mcp/route.ts`

**Interfaces:**
- Consumes: `registrarLeitura`, `escopoDoTelefone`, `senhaConfere`, `registrarFerramentas` (existente).

- [ ] **Step 1: Dono**

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { criarSupabaseClient } from "@/lib/mcp-tools";
import { registrarLeitura } from "@/lib/mcp/leitura";
import { senhaConfere } from "@/lib/hermes/senha";

export const runtime = "nodejs";
export const maxDuration = 60;

const INSTRUCOES = `Você é a Hermes, assistente pessoal do Peter, dono da plataforma Status Avalia (escolas, turmas com notas por bimestre, simulados com cronômetro, treinos dos alunos, cursos com videoaulas, banco de questões e importação de provas por IA). Responda sempre em português, de forma curta. Enxergue todas as escolas. Para perguntas que as ferramentas não cobrem, use consultar_dados (consulta só de leitura por tabela, colunas e filtros). Nesta etapa você só consulta: não altera nada.`;

async function handle(req: Request): Promise<Response> {
  if (!senhaConfere(req.headers.get("authorization"), process.env.MCP_DONO_TOKEN)) return new Response("Unauthorized", { status: 401 });
  const supabase = criarSupabaseClient();
  const server = new McpServer({ name: "status-avalia-dono", version: "1.0.0" }, { instructions: INSTRUCOES });
  registrarLeitura(server, supabase, async () => ({ tipo: "dono" }), { consultaLivre: true });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}
export { handle as GET, handle as POST, handle as DELETE };
```

- [ ] **Step 2: Professor** — em `src/app/api/mcp/route.ts`, trocar a comparação pela `senhaConfere(req.headers.get("authorization"), process.env.MCP_SECRET_TOKEN)` e, após `registrarFerramentas`, chamar `registrarLeitura(server, supabase, ({ professor_telefone }) => escopoDoTelefone(supabase, professor_telefone), { consultaLivre: false })`. Passar `instructions` curtas: "Você atende professores do Status Avalia. Sempre informe professor_telefone. Responda em português."
- [ ] **Step 3: Verificar** — tsc, lint, test, build.
- [ ] **Step 4: Commit + publicar** — rebase em `origin/master`, push, acompanhar deploy (status do commit no GitHub, com consulta espaçada ≥ 45 s).
- [ ] **Step 5: Peter configura** `MCP_DONO_TOKEN` na Vercel (senha longa aleatória) + Redeploy, e adiciona na Hermes o servidor `https://www.statusavalia.com.br/api/mcp/dono` com `Authorization: Bearer <MCP_DONO_TOKEN>`.
- [ ] **Step 6: Teste ponta a ponta** — com o token (o Peter roda, ou fornece só para o teste local via `.env.local`, nunca no chat): `tools/list` traz as 13 ferramentas; `resultado_simulado {"simulado":"Ufms 24"}` devolve texto coerente; `consultar_dados {"tabela":"questoes","filtros":[{"coluna":"banca","op":"ilike","valor":"ufms"}]}` → total 60; `consultar_dados {"tabela":"alunos_contas","colunas":["senha_hash"]}` → recusada; no `/api/mcp`, ferramenta nova sem telefone → erro de telefone.

---

### Task 8: Registro e encerramento

- [ ] Atualizar `CLAUDE.md` ("Pronto e no ar": Hermes etapa A; "Próximo passo": etapas B e C) e a memória (`reference`: endereços dos MCPs e nomes das variáveis, sem valores).
- [ ] Commit `"Docs: Hermes etapa A no ar"` e push.
