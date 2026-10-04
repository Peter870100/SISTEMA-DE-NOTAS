# Simulados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simulados online com cronômetro: o professor monta (sorteio + ajuste) e publica para turmas; o aluno faz com respostas salvas no servidor e correção automática; treinos livres do aluno com tempo pausável.

**Architecture:** Regras puras (prazo, tolerância, tempo do treino, correção, embaralhamento, sorteio, situação) em `src/lib/simulados/regras.ts` com testes. Servidor em `src/lib/simulados/*` (sem `"use server"`): acesso, questões para o aluno **sem a coluna `resposta`**, entrega/correção e entrega preguiçosa de tentativas vencidas. Actions em `src/actions/simulados.ts` (professor) e `src/actions/simulados-aluno.ts` (aluno). Prova do aluno é um componente cliente com fila de envio e cronômetro baseado no relógio do servidor.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions, params Promise), React 19, Supabase (cliente server-side), Tailwind 4, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-04-simulados-design.md`

## Global Constraints

- Leia `node_modules/next/dist/docs/` antes de usar API do Next (params/searchParams são `Promise`).
- SQL da spec **já aplicado em produção**; só anexar ao fim de `db/schema.sql`.
- Só questões `status = 'publicada'`; professor: geral + escola dele; aluno (treino): geral + escola dele.
- **A resposta certa nunca é enviada ao aluno** antes de `correcaoLiberada`: o tipo `QuestaoAluno` não tem `resposta` e a função que o monta nunca seleciona essa coluna.
- `TOLERANCIA_SEG = 30`; `PULSO_SEG = 15`; lacuna máxima creditada por pulso = 20 s; treino: 1–90 questões; duração 1–600 min.
- Anulada conta como certa para todos; em branco é errada; porcentagem com 2 casas.
- Professor: tempo sempre corre (`prazo_em` = min(início + duração, fecha_em)). Treino: tempo pausável (`tempo_usado_seg`), ou sem tempo.
- Correção do professor: `na_hora` | `apos_prazo` (padrão); "Liberar correção agora" muda para `na_hora`. Treino: sempre na hora.
- Uma tentativa por aluno por simulado (cada treino é um simulado `tipo = 'treino'`).
- Links de imagem da prova valem pelo tempo da prova: `min(6 h, restante + 30 min)` (mínimo 30 min).
- Ações de professor começam com `await exigirNaoAluno()`; ações de aluno usam `getAlunoAtual()`. Funções que recebem ids sem checar acesso nunca ficam em arquivo `"use server"`.
- Textos em português do Brasil. Commits com o Co-Authored-By do modelo; push conforme o controlador.

## Review Focus

1. **Aluno manda resposta depois do prazo, para questão fora do simulado, ou numa tentativa de outro aluno**: recusado. Pinado na Task 4 (`responder`) e nos testes de `aceitaResposta`.
2. **Dois cliques em "Entregar", ou entrega automática ao mesmo tempo que o aluno entrega**: corrigido uma vez só, resultado consistente. Pinado na Task 3 (claim condicional em `entregarTentativa`).
3. **Internet cai no meio da prova / aluno reabre a página**: nenhuma marcação perdida; prova continua com as marcações e o tempo certo. Pinado na Task 7 (fila local + `obterProva`).
4. **Correção "depois do prazo"**: antes do `fecha_em`, nenhuma tela ou action devolve gabarito, nota ou acerto por questão ao aluno. Pinado na Task 4 (`resultadoAluno`) e nos testes de `correcaoLiberada`.
5. **Banco com menos questões do que o pedido no sorteio**: sorteia o que houver e avisa, sem erro. Pinado na Task 2 (`sortear`) e na Task 5.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `db/schema.sql` (mod.), `src/lib/types.ts` (mod.) | SQL e tipos `Simulado`, `SimuladoTurma`, `SimuladoQuestao`, `Tentativa`, `TentativaResposta` |
| `src/lib/simulados/regras.ts` + `simulados.test.ts` | Regras puras |
| `src/lib/simulados/servidor.ts` | Acesso, questões do aluno, candidatos do sorteio, entrega/correção, entrega preguiçosa |
| `src/lib/questoes/storage.ts`, `src/lib/questoes/consultas.ts` (mod.) | Validade configurável dos links |
| `src/actions/simulados.ts` | Professor: criar/salvar, sortear, trocar, remover, adicionar, buscar, publicar, liberar |
| `src/actions/simulados-aluno.ts` | Aluno: novo treino, iniciar, responder, pulso, pausar, entregar, obter prova, resultado |
| `src/app/simulados/page.tsx`, `novo/page.tsx`, `[id]/page.tsx`, `[id]/editar/page.tsx` | Telas do professor |
| `src/components/simulados/FormSimulado.tsx`, `MontarQuestoes.tsx`, `LiberarCorrecao.tsx` | Componentes do professor |
| `src/app/aluno/simulados/page.tsx`, `[id]/page.tsx` | Telas do aluno |
| `src/components/simulados/NovoTreino.tsx`, `ProvaAluno.tsx`, `ResultadoAluno.tsx` | Componentes do aluno |
| `src/components/layout/Sidebar.tsx`, `src/app/aluno/page.tsx`, `DESIGN.md` (mod.) | Ligações e docs |

---

### Task 1: Schema e tipos

**Files:** Modify `db/schema.sql` (fim), `src/lib/types.ts`

**Interfaces — Produces:** tipos abaixo e tabelas `simulados`, `simulado_turmas`, `simulado_questoes`, `tentativas`, `tentativa_respostas` no `Database`.

- [ ] **Step 1:** Copie, sem alterar, o bloco SQL da seção "1. Banco de dados" da spec para o fim de `db/schema.sql` (não rode).

- [ ] **Step 2:** Em `src/lib/types.ts`, antes de `export type Database`:

```ts
export type TipoSimulado = "professor" | "treino";
export type Simulado = {
  id: string;
  escola_id: string;
  tipo: TipoSimulado;
  professor_id: string | null;
  conta_id: string | null;
  titulo: string;
  duracao_min: number | null;
  abre_em: string | null;
  fecha_em: string | null;
  correcao: "na_hora" | "apos_prazo";
  embaralhar: boolean;
  status: "rascunho" | "publicado";
  created_at: string;
  updated_at: string;
};
export type SimuladoTurma = { simulado_id: string; escola_id: string; turma_nome: string; ano_letivo: string };
export type SimuladoQuestao = { simulado_id: string; questao_id: string; ordem: number };
export type PorArea = Partial<Record<Area, { acertos: number; total: number }>>;
export type Tentativa = {
  id: string;
  simulado_id: string;
  conta_id: string;
  ordem: string[];
  iniciada_em: string;
  prazo_em: string | null;
  tempo_usado_seg: number;
  ultimo_pulso_em: string | null;
  entregue_em: string | null;
  status: "em_andamento" | "entregue";
  acertos: number | null;
  total: number | null;
  porcentagem: number | null;
  por_area: PorArea | null;
  created_at: string;
};
export type TentativaResposta = { tentativa_id: string; questao_id: string; alternativa: Letra | null; respondida_em: string; correta: boolean | null };
```

E em `Database.public.Tables`, depois de `questao_imagens`:

```ts
      simulados: {
        Row: Simulado;
        Insert: Partial<Omit<Simulado, "id" | "created_at" | "updated_at">> & { escola_id: string; tipo: TipoSimulado; titulo: string };
        Update: Partial<Omit<Simulado, "id" | "created_at">>;
        Relationships: [];
      };
      simulado_turmas: { Row: SimuladoTurma; Insert: SimuladoTurma; Update: Partial<SimuladoTurma>; Relationships: [] };
      simulado_questoes: { Row: SimuladoQuestao; Insert: SimuladoQuestao; Update: Partial<SimuladoQuestao>; Relationships: [] };
      tentativas: {
        Row: Tentativa;
        Insert: Partial<Omit<Tentativa, "created_at">> & { simulado_id: string; conta_id: string; ordem: string[] };
        Update: Partial<Omit<Tentativa, "id" | "created_at">>;
        Relationships: [];
      };
      tentativa_respostas: {
        Row: TentativaResposta;
        Insert: Partial<TentativaResposta> & { tentativa_id: string; questao_id: string };
        Update: Partial<TentativaResposta>;
        Relationships: [];
      };
```

- [ ] **Step 3:** `npx tsc --noEmit && npm test` → OK.
- [ ] **Step 4:** Commit — `git add db/schema.sql src/lib/types.ts && git commit -m "Simulados: schema e tipos"`

---

### Task 2: Regras puras

**Files:** Create `src/lib/simulados/regras.ts`, Test `src/lib/simulados/simulados.test.ts`, Modify `package.json` (script `test`)

**Interfaces — Produces:**
- `TOLERANCIA_SEG = 30`, `PULSO_SEG = 15`, `LACUNA_MAX_SEG = 20`, `MAX_TREINO = 90`
- `prazoFinal(iniciadaEm: Date, duracaoMin: number | null, fechaEm: Date | null): Date | null`
- `aceitaResposta(agora: Date, prazoEm: Date | null): boolean`
- `acumularTempo(tempoUsadoSeg: number, ultimoPulso: Date | null, agora: Date): number`
- `tempoEsgotado(tempoUsadoSeg: number, duracaoMin: number | null): boolean`
- `type Gabarito = Map<string, { resposta: Letra | null; anulada: boolean; area: Area }>`
- `corrigir(respostas: Map<string, Letra | null>, gabarito: Gabarito): { acertos: number; total: number; porcentagem: number; porArea: PorArea; corretas: Map<string, boolean> }`
- `correcaoLiberada(s: Pick<Simulado, "tipo" | "correcao" | "fecha_em">, agora: Date): boolean`
- `ordemEmbaralhada(ids: string[], semente: string): string[]`
- `sortear<T>(candidatos: T[], quantidade: number, aleatorio?: () => number): T[]`
- `type Situacao = "rascunho" | "agendado" | "aberto" | "encerrado"`; `situacaoSimulado(s: Pick<Simulado, "status" | "abre_em" | "fecha_em">, agora: Date): Situacao`

- [ ] **Step 1: Testes**

```ts
// src/lib/simulados/simulados.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { aceitaResposta, acumularTempo, correcaoLiberada, corrigir, ordemEmbaralhada, prazoFinal, situacaoSimulado, sortear, tempoEsgotado } from "./regras";

const T0 = new Date("2026-10-20T13:00:00Z");
const mais = (seg: number) => new Date(T0.getTime() + seg * 1000);

test("prazoFinal: duração ou fecha_em, o que vier antes", () => {
  assert.equal(prazoFinal(T0, 60, null)!.toISOString(), mais(3600).toISOString());
  assert.equal(prazoFinal(T0, 60, mais(1800))!.toISOString(), mais(1800).toISOString());
  assert.equal(prazoFinal(T0, null, mais(600))!.toISOString(), mais(600).toISOString());
  assert.equal(prazoFinal(T0, null, null), null);
});

test("aceitaResposta: tolerância de 30 s", () => {
  assert.equal(aceitaResposta(mais(100), mais(100)), true);
  assert.equal(aceitaResposta(mais(130), mais(100)), true);
  assert.equal(aceitaResposta(mais(131), mais(100)), false);
  assert.equal(aceitaResposta(mais(99999), null), true);
});

test("acumularTempo: pulsos normais somam, lacuna longa conta no máximo 20 s", () => {
  assert.equal(acumularTempo(0, null, T0), 0);
  assert.equal(acumularTempo(100, T0, mais(15)), 115);
  assert.equal(acumularTempo(100, T0, mais(3600)), 120);
  assert.equal(acumularTempo(100, mais(60), T0), 100); // relógio para trás não desconta
  assert.equal(tempoEsgotado(600, 10), true);
  assert.equal(tempoEsgotado(599, 10), false);
  assert.equal(tempoEsgotado(99999, null), false);
});

test("corrigir: brancos, anuladas e por área", () => {
  const gab = new Map([
    ["q1", { resposta: "A" as const, anulada: false, area: "natureza" as const }],
    ["q2", { resposta: "B" as const, anulada: false, area: "natureza" as const }],
    ["q3", { resposta: "C" as const, anulada: true, area: "matematica" as const }],
    ["q4", { resposta: "D" as const, anulada: false, area: "matematica" as const }],
  ]);
  const r = corrigir(new Map([["q1", "A" as const], ["q2", "C" as const], ["q3", null], ["q4", null]]), gab);
  assert.equal(r.acertos, 2); // q1 certa, q3 anulada
  assert.equal(r.total, 4);
  assert.equal(r.porcentagem, 50);
  assert.deepEqual(r.porArea, { natureza: { acertos: 1, total: 2 }, matematica: { acertos: 1, total: 2 } });
  assert.equal(r.corretas.get("q2"), false);
  assert.equal(r.corretas.get("q3"), true);
  assert.deepEqual(corrigir(new Map(), new Map()), { acertos: 0, total: 0, porcentagem: 0, porArea: {}, corretas: new Map() });
  assert.equal(corrigir(new Map([["q1", "A" as const]]), new Map([...gab].slice(0, 3))).porcentagem, 66.67);
});

test("correcaoLiberada", () => {
  assert.equal(correcaoLiberada({ tipo: "treino", correcao: "apos_prazo", fecha_em: null }, T0), true);
  assert.equal(correcaoLiberada({ tipo: "professor", correcao: "na_hora", fecha_em: mais(100).toISOString() }, T0), true);
  assert.equal(correcaoLiberada({ tipo: "professor", correcao: "apos_prazo", fecha_em: mais(100).toISOString() }, T0), false);
  assert.equal(correcaoLiberada({ tipo: "professor", correcao: "apos_prazo", fecha_em: mais(100).toISOString() }, mais(100)), true);
  assert.equal(correcaoLiberada({ tipo: "professor", correcao: "apos_prazo", fecha_em: null }, T0), false);
});

test("ordemEmbaralhada: estável para a mesma semente e é permutação", () => {
  const ids = Array.from({ length: 20 }, (_, i) => `q${i}`);
  const a = ordemEmbaralhada(ids, "tentativa-1");
  assert.deepEqual(a, ordemEmbaralhada(ids, "tentativa-1"));
  assert.deepEqual([...a].sort(), [...ids].sort());
  assert.notDeepEqual(a, ordemEmbaralhada(ids, "tentativa-2"));
  assert.notDeepEqual(a, ids);
});

test("sortear: sem repetir e limita ao disponível", () => {
  const s = sortear([1, 2, 3, 4, 5], 3);
  assert.equal(s.length, 3);
  assert.equal(new Set(s).size, 3);
  assert.equal(sortear([1, 2], 10).length, 2);
  assert.deepEqual(sortear([], 5), []);
});

test("situacaoSimulado", () => {
  const base = { status: "publicado" as const, abre_em: mais(100).toISOString(), fecha_em: mais(200).toISOString() };
  assert.equal(situacaoSimulado({ ...base, status: "rascunho" }, T0), "rascunho");
  assert.equal(situacaoSimulado(base, T0), "agendado");
  assert.equal(situacaoSimulado(base, mais(150)), "aberto");
  assert.equal(situacaoSimulado(base, mais(200)), "encerrado");
  assert.equal(situacaoSimulado({ status: "publicado", abre_em: null, fecha_em: null }, T0), "aberto");
});
```

- [ ] **Step 2:** `npx tsx --test src/lib/simulados/simulados.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/simulados/regras.ts
import type { Area, Letra, PorArea, Simulado } from "@/lib/types";

export const TOLERANCIA_SEG = 30;
export const PULSO_SEG = 15;
export const LACUNA_MAX_SEG = 20;
export const MAX_TREINO = 90;

export function prazoFinal(iniciadaEm: Date, duracaoMin: number | null, fechaEm: Date | null): Date | null {
  const porDuracao = duracaoMin ? new Date(iniciadaEm.getTime() + duracaoMin * 60_000) : null;
  if (porDuracao && fechaEm) return porDuracao < fechaEm ? porDuracao : fechaEm;
  return porDuracao ?? fechaEm ?? null;
}

export function aceitaResposta(agora: Date, prazoEm: Date | null): boolean {
  return !prazoEm || agora.getTime() <= prazoEm.getTime() + TOLERANCIA_SEG * 1000;
}

/** Soma o tempo desde o último pulso, no máximo 20 s (lacunas maiores = página fechada/pausada). */
export function acumularTempo(tempoUsadoSeg: number, ultimoPulso: Date | null, agora: Date): number {
  if (!ultimoPulso) return tempoUsadoSeg;
  const passou = Math.max(0, (agora.getTime() - ultimoPulso.getTime()) / 1000);
  return Math.round(tempoUsadoSeg + Math.min(passou, LACUNA_MAX_SEG));
}

export function tempoEsgotado(tempoUsadoSeg: number, duracaoMin: number | null): boolean {
  return !!duracaoMin && tempoUsadoSeg >= duracaoMin * 60;
}

export type Gabarito = Map<string, { resposta: Letra | null; anulada: boolean; area: Area }>;

export function corrigir(respostas: Map<string, Letra | null>, gabarito: Gabarito) {
  const corretas = new Map<string, boolean>();
  const porArea: PorArea = {};
  let acertos = 0;
  for (const [id, g] of gabarito) {
    const certa = g.anulada || (!!g.resposta && respostas.get(id) === g.resposta);
    corretas.set(id, certa);
    const a = (porArea[g.area] ??= { acertos: 0, total: 0 });
    a.total++;
    if (certa) { a.acertos++; acertos++; }
  }
  const total = gabarito.size;
  const porcentagem = total ? Math.round((10000 * acertos) / total) / 100 : 0;
  return { acertos, total, porcentagem, porArea, corretas };
}

export function correcaoLiberada(s: Pick<Simulado, "tipo" | "correcao" | "fecha_em">, agora: Date): boolean {
  if (s.tipo === "treino" || s.correcao === "na_hora") return true;
  return !!s.fecha_em && agora.getTime() >= Date.parse(s.fecha_em);
}

/** PRNG determinístico (mulberry32) a partir de um hash da semente. */
function gerador(semente: string): () => number {
  let h = 1779033703 ^ semente.length;
  for (let i = 0; i < semente.length; i++) { h = Math.imul(h ^ semente.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ordemEmbaralhada(ids: string[], semente: string): string[] {
  const r = gerador(semente);
  const lista = [...ids];
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

export function sortear<T>(candidatos: T[], quantidade: number, aleatorio: () => number = Math.random): T[] {
  const lista = [...candidatos];
  const n = Math.max(0, Math.min(quantidade, lista.length));
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(aleatorio() * (lista.length - i));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista.slice(0, n);
}

export type Situacao = "rascunho" | "agendado" | "aberto" | "encerrado";

export function situacaoSimulado(s: Pick<Simulado, "status" | "abre_em" | "fecha_em">, agora: Date): Situacao {
  if (s.status === "rascunho") return "rascunho";
  if (s.abre_em && agora.getTime() < Date.parse(s.abre_em)) return "agendado";
  if (s.fecha_em && agora.getTime() >= Date.parse(s.fecha_em)) return "encerrado";
  return "aberto";
}
```

- [ ] **Step 4:** Testes passam; acrescente `src/lib/simulados/simulados.test.ts` ao script `test`; `npm test` → PASS.
- [ ] **Step 5:** Commit — `git add src/lib/simulados package.json && git commit -m "Simulados: regras de tempo, correcao, embaralhamento e sorteio"`

---

### Task 3: Servidor — acesso, questões do aluno, entrega

**Files:** Create `src/lib/simulados/servidor.ts`; Modify `src/lib/questoes/storage.ts`, `src/lib/questoes/consultas.ts`

**Interfaces:**
- Consumes: `turmasDoAluno` (`@/lib/aulas/acesso`), `ehAdmin`, `getProfessorAtual`, `exigirNaoAluno`, regras (Task 2).
- Produces (sem `"use server"`):
  - `storage.ts`: `linksExibicao(paths: string[], segundos = 300)`
  - `consultas.ts`: `imagensParaTela(questaoIds: string[], validadeSeg = 300)`
  - `type QuestaoAluno = { id: string; enunciado: string; comando: string; alternativas: Alternativa[]; imagens: ImagemTela[] }`
  - `questoesParaAluno(ids: string[], validadeSeg: number): Promise<QuestaoAluno[]>` (na ordem dos ids; **nunca** seleciona `resposta`)
  - `podeEditarSimulado(professor: Professor, s: Simulado): boolean`
  - `exigirSimuladoEditavel(simuladoId: string): Promise<{ professor: Professor; simulado: Simulado }>`
  - `simuladoVisivelParaAluno(aluno: AlunoConta, s: Simulado): Promise<boolean>`
  - `filtroVisivel(escolaId: string)`: string para `.or()` — `escopo.eq.geral,escola_id.eq.<id>`
  - `type FiltrosSorteio = { area?: string; materia?: string; assunto_id?: string; banca?: string; anoDe?: number; anoAte?: number }`
  - `candidatosSorteio(escolaId: string, f: FiltrosSorteio, excluir: string[]): Promise<string[]>` (ids publicados, até 3000)
  - `entregarTentativa(tentativaId: string): Promise<void>` (claim `em_andamento`→`entregue`, corrige e grava)
  - `fecharVencidas(simuladoId: string): Promise<void>` (professor: `prazo_em + 30 s < agora`; treino: tempo esgotado)

- [ ] **Step 1: Validade dos links** — `storage.ts`: `export async function linksExibicao(paths: string[], segundos = EXIBICAO_SEG)` usando `segundos` em `createSignedUrls`. `consultas.ts`: `imagensParaTela(questaoIds: string[], validadeSeg = 300)` repassa para `linksExibicao(caminhos, validadeSeg)`.

- [ ] **Step 2: `src/lib/simulados/servidor.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { turmasDoAluno } from "@/lib/aulas/acesso";
import { imagensParaTela } from "@/lib/questoes/consultas";
import type { ImagemTela } from "@/components/questoes/ImagemQuestao";
import type { AlunoConta, Alternativa, Area, Letra, Professor, Simulado } from "@/lib/types";
import { acumularTempo, corrigir, tempoEsgotado, TOLERANCIA_SEG, type Gabarito } from "./regras";

export type QuestaoAluno = { id: string; enunciado: string; comando: string; alternativas: Alternativa[]; imagens: ImagemTela[] };

/** Questões para mostrar ao aluno — a coluna `resposta` nunca é lida aqui. */
export async function questoesParaAluno(ids: string[], validadeSeg: number): Promise<QuestaoAluno[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase.from("questoes").select("id, enunciado, comando, alternativas").in("id", ids);
  const imagens = await imagensParaTela(ids, validadeSeg);
  const porId = new Map((data ?? []).map((q) => [q.id, q]));
  return ids.flatMap((id) => {
    const q = porId.get(id);
    return q ? [{ id, enunciado: q.enunciado, comando: q.comando, alternativas: q.alternativas, imagens: imagens.get(id) ?? [] }] : [];
  });
}

export function podeEditarSimulado(professor: Professor, s: Simulado): boolean {
  return s.tipo === "professor" && s.escola_id === professor.escola_id && (s.professor_id === professor.id || ehAdmin(professor.role));
}

export async function exigirSimuladoEditavel(simuladoId: string): Promise<{ professor: Professor; simulado: Simulado }> {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  const { data: simulado } = await supabase.from("simulados").select("*").eq("id", simuladoId).maybeSingle();
  if (!simulado || !podeEditarSimulado(professor, simulado)) throw new Error("Simulado não encontrado.");
  return { professor, simulado };
}

export async function simuladoVisivelParaAluno(aluno: AlunoConta, s: Simulado): Promise<boolean> {
  if (s.escola_id !== aluno.escola_id) return false;
  if (s.tipo === "treino") return s.conta_id === aluno.id;
  if (s.status !== "publicado") return false;
  const [turmas, { data: alvo }] = await Promise.all([
    turmasDoAluno(aluno.id),
    supabase.from("simulado_turmas").select("turma_nome, ano_letivo").eq("simulado_id", s.id),
  ]);
  const minhas = new Set(turmas.map((t) => `${t.turma_nome}|${t.ano_letivo}`));
  return (alvo ?? []).some((t) => minhas.has(`${t.turma_nome}|${t.ano_letivo}`));
}

export function filtroVisivel(escolaId: string): string {
  return `escopo.eq.geral,escola_id.eq.${escolaId}`;
}

export type FiltrosSorteio = { area?: string; materia?: string; assunto_id?: string; banca?: string; anoDe?: number; anoAte?: number };

export async function candidatosSorteio(escolaId: string, f: FiltrosSorteio, excluir: string[]): Promise<string[]> {
  let c = supabase.from("questoes").select("id").eq("status", "publicada").or(filtroVisivel(escolaId));
  if (f.area) c = c.eq("area", f.area);
  if (f.materia) c = c.eq("materia", f.materia);
  if (f.assunto_id) c = c.eq("assunto_id", f.assunto_id);
  if (f.banca) c = c.eq("banca", f.banca);
  if (f.anoDe) c = c.gte("ano", f.anoDe);
  if (f.anoAte) c = c.lte("ano", f.anoAte);
  const { data } = await c.limit(3000);
  const fora = new Set(excluir);
  return (data ?? []).map((q) => q.id).filter((id) => !fora.has(id));
}

/** Entrega e corrige. O update condicional garante uma única correção, mesmo com dois chamadores. */
export async function entregarTentativa(tentativaId: string): Promise<void> {
  const agora = new Date().toISOString();
  const { data: tomou } = await supabase.from("tentativas").update({ status: "entregue", entregue_em: agora }).eq("id", tentativaId).eq("status", "em_andamento").select("*");
  const t = tomou?.[0];
  if (!t) return;
  const [{ data: questoes }, { data: respostas }] = await Promise.all([
    supabase.from("questoes").select("id, resposta, anulada, area").in("id", t.ordem),
    supabase.from("tentativa_respostas").select("questao_id, alternativa").eq("tentativa_id", t.id),
  ]);
  const gabarito: Gabarito = new Map((questoes ?? []).map((q) => [q.id, { resposta: q.resposta as Letra | null, anulada: q.anulada, area: q.area as Area }]));
  const marcadas = new Map((respostas ?? []).map((r) => [r.questao_id, r.alternativa as Letra | null]));
  const r = corrigir(marcadas, gabarito);
  const linhas = [...r.corretas].map(([questao_id, correta]) => ({ tentativa_id: t.id, questao_id, alternativa: marcadas.get(questao_id) ?? null, correta }));
  if (linhas.length) {
    const { error } = await supabase.from("tentativa_respostas").upsert(linhas, { onConflict: "tentativa_id,questao_id" });
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase.from("tentativas").update({ acertos: r.acertos, total: r.total, porcentagem: r.porcentagem, por_area: r.porArea }).eq("id", t.id);
  if (error) throw new Error(error.message);
}

/** Entrega preguiçosa: tentativas cujo tempo acabou e o aluno não entregou. */
export async function fecharVencidas(simuladoId: string): Promise<void> {
  const { data: s } = await supabase.from("simulados").select("tipo, duracao_min").eq("id", simuladoId).maybeSingle();
  if (!s) return;
  const { data: abertas } = await supabase.from("tentativas").select("id, prazo_em, tempo_usado_seg, ultimo_pulso_em").eq("simulado_id", simuladoId).eq("status", "em_andamento");
  const agora = new Date();
  for (const t of abertas ?? []) {
    const vencida = s.tipo === "professor"
      ? !!t.prazo_em && agora.getTime() > Date.parse(t.prazo_em) + TOLERANCIA_SEG * 1000
      : tempoEsgotado(acumularTempo(t.tempo_usado_seg, t.ultimo_pulso_em ? new Date(t.ultimo_pulso_em) : null, agora), s.duracao_min);
    if (vencida) await entregarTentativa(t.id);
  }
}
```

- [ ] **Step 3:** `npx tsc --noEmit && npx eslint src/lib/simulados src/lib/questoes && npm test` → OK.
- [ ] **Step 4:** Commit — `git add src/lib && git commit -m "Simulados: acesso, questoes sem resposta para o aluno e entrega com correcao"`

---

### Task 4: Actions do aluno

**Files:** Create `src/actions/simulados-aluno.ts`

**Interfaces:**
- Consumes: Task 3 (`questoesParaAluno`, `simuladoVisivelParaAluno`, `candidatosSorteio`, `entregarTentativa`, `fecharVencidas`, `QuestaoAluno`, `FiltrosSorteio`), regras (Task 2), `getAlunoAtual`.
- Produces (`"use server"`, todas com `getAlunoAtual()`):
  - `criarTreino(f: FiltrosSorteio & { quantidade: number; duracaoMin: number | null; titulo?: string }): Promise<{ simuladoId: string; sorteadas: number; pedidas: number }>`
  - `iniciarTentativa(simuladoId: string): Promise<string>` (tentativaId)
  - `type ProvaAluno = { simulado: { id: string; titulo: string; tipo: TipoSimulado; duracaoMin: number | null }; tentativaId: string; status: "em_andamento" | "entregue"; questoes: QuestaoAluno[]; respostas: Record<string, Letra | null>; prazoEm: string | null; restanteSeg: number | null; agoraServidor: string }`
  - `obterProva(simuladoId: string): Promise<ProvaAluno | null>`
  - `responder(tentativaId: string, questaoId: string, alternativa: Letra | null): Promise<{ ok: true } | { ok: false; erro: string; encerrada?: boolean }>`
  - `pulsoTreino(tentativaId: string): Promise<{ restanteSeg: number | null; encerrada: boolean }>`
  - `pausarTreino(tentativaId: string): Promise<void>`
  - `entregar(tentativaId: string): Promise<void>`
  - `type ResultadoAluno = { liberado: false; liberaEm: string | null } | { liberado: true; acertos: number; total: number; porcentagem: number; porArea: PorArea; itens: { questaoId: string; marcada: Letra | null; certa: Letra | null; anulada: boolean; correta: boolean }[] }`
  - `resultadoAluno(simuladoId: string): Promise<ResultadoAluno | null>`

- [ ] **Step 1: Implementar**

```ts
"use server";

import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual } from "@/lib/auth";
import { candidatosSorteio, entregarTentativa, fecharVencidas, questoesParaAluno, simuladoVisivelParaAluno, type FiltrosSorteio, type QuestaoAluno } from "@/lib/simulados/servidor";
import { aceitaResposta, acumularTempo, correcaoLiberada, MAX_TREINO, ordemEmbaralhada, prazoFinal, situacaoSimulado, sortear, tempoEsgotado } from "@/lib/simulados/regras";
import type { AlunoConta, Letra, PorArea, Simulado, Tentativa, TipoSimulado } from "@/lib/types";

async function exigirAluno(): Promise<AlunoConta> {
  const aluno = await getAlunoAtual();
  if (!aluno) throw new Error("Faça login novamente.");
  return aluno;
}

async function simuladoDoAluno(aluno: AlunoConta, simuladoId: string): Promise<Simulado> {
  const { data: s } = await supabase.from("simulados").select("*").eq("id", simuladoId).maybeSingle();
  if (!s || !(await simuladoVisivelParaAluno(aluno, s))) throw new Error("Simulado não encontrado.");
  return s;
}

async function tentativaDoAluno(aluno: AlunoConta, tentativaId: string): Promise<{ t: Tentativa; s: Simulado }> {
  const { data: t } = await supabase.from("tentativas").select("*").eq("id", tentativaId).eq("conta_id", aluno.id).maybeSingle();
  if (!t) throw new Error("Tentativa não encontrada.");
  const { data: s } = await supabase.from("simulados").select("*").eq("id", t.simulado_id).single();
  return { t, s: s! };
}

export async function criarTreino(f: FiltrosSorteio & { quantidade: number; duracaoMin: number | null; titulo?: string }) {
  const aluno = await exigirAluno();
  const pedidas = Math.round(f.quantidade);
  if (!Number.isFinite(pedidas) || pedidas < 1 || pedidas > MAX_TREINO) throw new Error(`Escolha de 1 a ${MAX_TREINO} questões.`);
  const duracao = f.duracaoMin == null ? null : Math.round(f.duracaoMin);
  if (duracao !== null && (duracao < 1 || duracao > 600)) throw new Error("Tempo de 1 a 600 minutos, ou sem tempo.");
  const ids = sortear(await candidatosSorteio(aluno.escola_id, f, []), pedidas);
  if (ids.length === 0) throw new Error("Não há questões publicadas com esses filtros.");
  const { data: s, error } = await supabase.from("simulados")
    .insert({ escola_id: aluno.escola_id, tipo: "treino", conta_id: aluno.id, titulo: (f.titulo?.trim() || `Treino de ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`).slice(0, 120), duracao_min: duracao, status: "publicado", correcao: "na_hora", embaralhar: false })
    .select("id").single();
  if (error || !s) throw new Error(error?.message ?? "Falha ao criar treino.");
  const { error: e2 } = await supabase.from("simulado_questoes").insert(ids.map((questao_id, ordem) => ({ simulado_id: s.id, questao_id, ordem })));
  if (e2) throw new Error(e2.message);
  return { simuladoId: s.id, sorteadas: ids.length, pedidas };
}

export async function iniciarTentativa(simuladoId: string): Promise<string> {
  const aluno = await exigirAluno();
  const s = await simuladoDoAluno(aluno, simuladoId);
  const { data: existente } = await supabase.from("tentativas").select("id").eq("simulado_id", s.id).eq("conta_id", aluno.id).maybeSingle();
  if (existente) return existente.id;
  if (s.tipo === "professor" && situacaoSimulado(s, new Date()) !== "aberto") throw new Error("Este simulado não está aberto agora.");
  const { data: qs } = await supabase.from("simulado_questoes").select("questao_id, ordem").eq("simulado_id", s.id).order("ordem");
  const ids = (qs ?? []).map((q) => q.questao_id);
  if (ids.length === 0) throw new Error("Simulado sem questões.");
  const id = randomUUID();
  const agora = new Date();
  const { error } = await supabase.from("tentativas").insert({
    id, simulado_id: s.id, conta_id: aluno.id,
    ordem: s.tipo === "professor" && s.embaralhar ? ordemEmbaralhada(ids, id) : ids,
    iniciada_em: agora.toISOString(),
    prazo_em: s.tipo === "professor" ? prazoFinal(agora, s.duracao_min, s.fecha_em ? new Date(s.fecha_em) : null)?.toISOString() ?? null : null,
    ultimo_pulso_em: s.tipo === "treino" && s.duracao_min ? agora.toISOString() : null,
  });
  if (error) {
    const { data: outra } = await supabase.from("tentativas").select("id").eq("simulado_id", s.id).eq("conta_id", aluno.id).maybeSingle();
    if (outra) return outra.id; // dois cliques: a outra chamada criou
    throw new Error(error.message);
  }
  return id;
}

export type ProvaAluno = {
  simulado: { id: string; titulo: string; tipo: TipoSimulado; duracaoMin: number | null };
  tentativaId: string;
  status: "em_andamento" | "entregue";
  questoes: QuestaoAluno[];
  respostas: Record<string, Letra | null>;
  prazoEm: string | null;
  restanteSeg: number | null;
  agoraServidor: string;
};

export async function obterProva(simuladoId: string): Promise<ProvaAluno | null> {
  const aluno = await exigirAluno();
  const s = await simuladoDoAluno(aluno, simuladoId);
  await fecharVencidas(s.id);
  const { data: t } = await supabase.from("tentativas").select("*").eq("simulado_id", s.id).eq("conta_id", aluno.id).maybeSingle();
  if (!t) return null;
  const agora = new Date();
  let restanteSeg: number | null = null;
  if (s.tipo === "professor" && t.prazo_em) restanteSeg = Math.max(0, Math.floor((Date.parse(t.prazo_em) - agora.getTime()) / 1000));
  if (s.tipo === "treino" && s.duracao_min) restanteSeg = Math.max(0, s.duracao_min * 60 - t.tempo_usado_seg);
  const validade = Math.min(6 * 3600, Math.max(1800, (restanteSeg ?? 3 * 3600) + 1800));
  const [questoes, { data: resp }] = await Promise.all([
    t.status === "em_andamento" ? questoesParaAluno(t.ordem, validade) : Promise.resolve([]),
    supabase.from("tentativa_respostas").select("questao_id, alternativa").eq("tentativa_id", t.id),
  ]);
  return {
    simulado: { id: s.id, titulo: s.titulo, tipo: s.tipo, duracaoMin: s.duracao_min },
    tentativaId: t.id,
    status: t.status,
    questoes,
    respostas: Object.fromEntries((resp ?? []).map((r) => [r.questao_id, r.alternativa as Letra | null])),
    prazoEm: t.prazo_em,
    restanteSeg,
    agoraServidor: agora.toISOString(),
  };
}

export async function responder(tentativaId: string, questaoId: string, alternativa: Letra | null) {
  const aluno = await exigirAluno();
  const { t, s } = await tentativaDoAluno(aluno, tentativaId);
  if (t.status !== "em_andamento") return { ok: false as const, erro: "Prova já entregue.", encerrada: true };
  if (!t.ordem.includes(questaoId)) return { ok: false as const, erro: "Questão fora do simulado." };
  if (alternativa !== null && !["A", "B", "C", "D", "E"].includes(alternativa)) return { ok: false as const, erro: "Alternativa inválida." };
  const agora = new Date();
  const foraDoPrazo = s.tipo === "professor"
    ? !aceitaResposta(agora, t.prazo_em ? new Date(t.prazo_em) : null)
    : tempoEsgotado(acumularTempo(t.tempo_usado_seg, t.ultimo_pulso_em ? new Date(t.ultimo_pulso_em) : null, agora), s.duracao_min);
  if (foraDoPrazo) {
    await entregarTentativa(t.id);
    return { ok: false as const, erro: "O tempo acabou.", encerrada: true };
  }
  const { error } = await supabase.from("tentativa_respostas").upsert({ tentativa_id: t.id, questao_id: questaoId, alternativa, respondida_em: agora.toISOString() }, { onConflict: "tentativa_id,questao_id" });
  if (error) return { ok: false as const, erro: "Não foi possível salvar. Tentando de novo…" };
  return { ok: true as const };
}

export async function pulsoTreino(tentativaId: string) {
  const aluno = await exigirAluno();
  const { t, s } = await tentativaDoAluno(aluno, tentativaId);
  if (s.tipo !== "treino" || t.status !== "em_andamento") return { restanteSeg: null, encerrada: t.status !== "em_andamento" };
  if (!s.duracao_min) return { restanteSeg: null, encerrada: false };
  const agora = new Date();
  const usado = acumularTempo(t.tempo_usado_seg, t.ultimo_pulso_em ? new Date(t.ultimo_pulso_em) : null, agora);
  await supabase.from("tentativas").update({ tempo_usado_seg: usado, ultimo_pulso_em: agora.toISOString() }).eq("id", t.id).eq("status", "em_andamento");
  if (tempoEsgotado(usado, s.duracao_min)) { await entregarTentativa(t.id); return { restanteSeg: 0, encerrada: true }; }
  return { restanteSeg: s.duracao_min * 60 - usado, encerrada: false };
}

export async function pausarTreino(tentativaId: string): Promise<void> {
  const aluno = await exigirAluno();
  const { t, s } = await tentativaDoAluno(aluno, tentativaId);
  if (s.tipo !== "treino" || t.status !== "em_andamento") return;
  const usado = acumularTempo(t.tempo_usado_seg, t.ultimo_pulso_em ? new Date(t.ultimo_pulso_em) : null, new Date());
  await supabase.from("tentativas").update({ tempo_usado_seg: usado, ultimo_pulso_em: null }).eq("id", t.id).eq("status", "em_andamento");
}

export async function entregar(tentativaId: string): Promise<void> {
  const aluno = await exigirAluno();
  const { t } = await tentativaDoAluno(aluno, tentativaId);
  await entregarTentativa(t.id);
}

export type ResultadoAluno =
  | { liberado: false; liberaEm: string | null }
  | { liberado: true; acertos: number; total: number; porcentagem: number; porArea: PorArea; itens: { questaoId: string; marcada: Letra | null; certa: Letra | null; anulada: boolean; correta: boolean }[] };

export async function resultadoAluno(simuladoId: string): Promise<ResultadoAluno | null> {
  const aluno = await exigirAluno();
  const s = await simuladoDoAluno(aluno, simuladoId);
  await fecharVencidas(s.id);
  const { data: t } = await supabase.from("tentativas").select("*").eq("simulado_id", s.id).eq("conta_id", aluno.id).maybeSingle();
  if (!t || t.status !== "entregue") return null;
  if (!correcaoLiberada(s, new Date())) return { liberado: false, liberaEm: s.fecha_em };
  const [{ data: resp }, { data: qs }] = await Promise.all([
    supabase.from("tentativa_respostas").select("questao_id, alternativa, correta").eq("tentativa_id", t.id),
    supabase.from("questoes").select("id, resposta, anulada").in("id", t.ordem),
  ]);
  const r = new Map((resp ?? []).map((x) => [x.questao_id, x]));
  const q = new Map((qs ?? []).map((x) => [x.id, x]));
  return {
    liberado: true,
    acertos: t.acertos ?? 0, total: t.total ?? 0, porcentagem: Number(t.porcentagem ?? 0), porArea: t.por_area ?? {},
    itens: t.ordem.map((id) => ({ questaoId: id, marcada: (r.get(id)?.alternativa as Letra | null) ?? null, certa: (q.get(id)?.resposta as Letra | null) ?? null, anulada: !!q.get(id)?.anulada, correta: !!r.get(id)?.correta })),
  };
}
```

- [ ] **Step 2:** `npx tsc --noEmit && npx eslint src/actions/simulados-aluno.ts && npm test` → OK.
- [ ] **Step 3:** Commit — `git add src/actions/simulados-aluno.ts && git commit -m "Simulados: actions do aluno (treino, prova, respostas, entrega, resultado)"`

---

### Task 5: Actions do professor

**Files:** Create `src/actions/simulados.ts`

**Interfaces:**
- Consumes: Task 3; `listarTurmasAcessiveis` (`@/actions/turmas`); `getProfessorAtual`, `exigirNaoAluno`.
- Produces (`"use server"`):
  - `type DadosSimulado = { titulo: string; turmas: { turma_nome: string; ano_letivo: string }[]; duracaoMin: number; abreEm: string; fechaEm: string; correcao: "na_hora" | "apos_prazo"; embaralhar: boolean }`
  - `criarSimulado(d: DadosSimulado): Promise<string>`; `salvarSimulado(id: string, d: DadosSimulado): Promise<void>`
  - `sortearQuestoes(id: string, f: FiltrosSorteio & { quantidade: number }): Promise<{ adicionadas: number; pedidas: number }>`
  - `trocarQuestao(id: string, questaoId: string, f: FiltrosSorteio): Promise<boolean>` (false se não houver outra)
  - `removerQuestao(id: string, questaoId: string): Promise<void>`
  - `adicionarQuestao(id: string, questaoId: string): Promise<void>`
  - `buscarQuestoesBanco(id: string, texto: string, f: FiltrosSorteio): Promise<{ id: string; banca: string; ano: number | null; numero: number | null; materia: string; trecho: string }[]>` (até 30, publicadas e visíveis)
  - `publicarSimulado(id: string): Promise<void>`; `liberarCorrecao(id: string): Promise<void>`

- [ ] **Step 1: Implementar**

```ts
"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { candidatosSorteio, exigirSimuladoEditavel, filtroVisivel, type FiltrosSorteio } from "@/lib/simulados/servidor";
import { sortear } from "@/lib/simulados/regras";

export type DadosSimulado = {
  titulo: string;
  turmas: { turma_nome: string; ano_letivo: string }[];
  duracaoMin: number;
  abreEm: string;
  fechaEm: string;
  correcao: "na_hora" | "apos_prazo";
  embaralhar: boolean;
};

function limpar(d: DadosSimulado) {
  const titulo = d.titulo.trim();
  if (!titulo) throw new Error("Informe o título.");
  const duracao = Math.round(d.duracaoMin);
  if (!Number.isFinite(duracao) || duracao < 1 || duracao > 600) throw new Error("Duração de 1 a 600 minutos.");
  const abre = Date.parse(d.abreEm), fecha = Date.parse(d.fechaEm);
  if (!Number.isFinite(abre) || !Number.isFinite(fecha) || fecha <= abre) throw new Error("A data de fechamento precisa ser depois da abertura.");
  if (d.correcao !== "na_hora" && d.correcao !== "apos_prazo") throw new Error("Escolha quando sai a correção.");
  return { titulo: titulo.slice(0, 160), duracao_min: duracao, abre_em: new Date(abre).toISOString(), fecha_em: new Date(fecha).toISOString(), correcao: d.correcao, embaralhar: d.embaralhar };
}

/** Só turmas (nome+ano) que o professor pode acessar; mantém as já ligadas. */
async function gravarTurmas(simuladoId: string, escolaId: string, turmas: DadosSimulado["turmas"]) {
  const acessiveis = new Set((await listarTurmasAcessiveis()).map((t) => `${t.nome}|${t.ano_letivo}`));
  const { data: atuais, error: e0 } = await supabase.from("simulado_turmas").select("turma_nome, ano_letivo").eq("simulado_id", simuladoId);
  if (e0) throw new Error(e0.message);
  const ja = new Set((atuais ?? []).map((t) => `${t.turma_nome}|${t.ano_letivo}`));
  const validas = [...new Map(turmas.filter((t) => acessiveis.has(`${t.turma_nome}|${t.ano_letivo}`) || ja.has(`${t.turma_nome}|${t.ano_letivo}`)).map((t) => [`${t.turma_nome}|${t.ano_letivo}`, t])).values()];
  const { error: e1 } = await supabase.from("simulado_turmas").delete().eq("simulado_id", simuladoId);
  if (e1) throw new Error(e1.message);
  if (validas.length) {
    const { error } = await supabase.from("simulado_turmas").insert(validas.map((t) => ({ simulado_id: simuladoId, escola_id: escolaId, turma_nome: t.turma_nome, ano_letivo: t.ano_letivo })));
    if (error) throw new Error(error.message);
  }
}

async function temTentativas(simuladoId: string): Promise<boolean> {
  const { count } = await supabase.from("tentativas").select("id", { count: "exact", head: true }).eq("simulado_id", simuladoId);
  return (count ?? 0) > 0;
}

async function exigirQuestoesEditaveis(id: string) {
  const r = await exigirSimuladoEditavel(id);
  if (await temTentativas(id)) throw new Error("Alunos já começaram: as questões não podem mais mudar.");
  return r;
}

async function idsDoSimulado(id: string): Promise<string[]> {
  const { data } = await supabase.from("simulado_questoes").select("questao_id, ordem").eq("simulado_id", id).order("ordem");
  return (data ?? []).map((q) => q.questao_id);
}

export async function criarSimulado(d: DadosSimulado): Promise<string> {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  const { data, error } = await supabase.from("simulados").insert({ ...limpar(d), escola_id: professor.escola_id, tipo: "professor", professor_id: professor.id, status: "rascunho" }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar simulado.");
  await gravarTurmas(data.id, professor.escola_id, d.turmas);
  return data.id;
}

export async function salvarSimulado(id: string, d: DadosSimulado): Promise<void> {
  const { simulado } = await exigirSimuladoEditavel(id);
  const { error } = await supabase.from("simulados").update({ ...limpar(d), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await gravarTurmas(id, simulado.escola_id, d.turmas);
}

export async function sortearQuestoes(id: string, f: FiltrosSorteio & { quantidade: number }) {
  const { simulado } = await exigirQuestoesEditaveis(id);
  const pedidas = Math.round(f.quantidade);
  if (!Number.isFinite(pedidas) || pedidas < 1 || pedidas > 200) throw new Error("Quantidade de 1 a 200.");
  const atuais = await idsDoSimulado(id);
  const novas = sortear(await candidatosSorteio(simulado.escola_id, f, atuais), pedidas);
  if (novas.length) {
    const { error } = await supabase.from("simulado_questoes").insert(novas.map((questao_id, i) => ({ simulado_id: id, questao_id, ordem: atuais.length + i })));
    if (error) throw new Error(error.message);
  }
  return { adicionadas: novas.length, pedidas };
}

export async function trocarQuestao(id: string, questaoId: string, f: FiltrosSorteio): Promise<boolean> {
  const { simulado } = await exigirQuestoesEditaveis(id);
  const atuais = await idsDoSimulado(id);
  const pos = atuais.indexOf(questaoId);
  if (pos < 0) throw new Error("Questão não está no simulado.");
  const [nova] = sortear(await candidatosSorteio(simulado.escola_id, f, atuais), 1);
  if (!nova) return false;
  const { error } = await supabase.from("simulado_questoes").delete().eq("simulado_id", id).eq("questao_id", questaoId);
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase.from("simulado_questoes").insert({ simulado_id: id, questao_id: nova, ordem: pos });
  if (e2) throw new Error(e2.message);
  return true;
}

export async function removerQuestao(id: string, questaoId: string): Promise<void> {
  await exigirQuestoesEditaveis(id);
  const { error } = await supabase.from("simulado_questoes").delete().eq("simulado_id", id).eq("questao_id", questaoId);
  if (error) throw new Error(error.message);
}

export async function adicionarQuestao(id: string, questaoId: string): Promise<void> {
  const { simulado } = await exigirQuestoesEditaveis(id);
  const { data: q } = await supabase.from("questoes").select("id").eq("id", questaoId).eq("status", "publicada").or(filtroVisivel(simulado.escola_id)).maybeSingle();
  if (!q) throw new Error("Questão não disponível.");
  const atuais = await idsDoSimulado(id);
  if (atuais.includes(questaoId)) return;
  const { error } = await supabase.from("simulado_questoes").insert({ simulado_id: id, questao_id: questaoId, ordem: atuais.length });
  if (error) throw new Error(error.message);
}

export async function buscarQuestoesBanco(id: string, texto: string, f: FiltrosSorteio) {
  const { simulado } = await exigirSimuladoEditavel(id);
  let c = supabase.from("questoes").select("id, banca, ano, numero, materia, enunciado").eq("status", "publicada").or(filtroVisivel(simulado.escola_id));
  const t = texto.replace(/[%_,()*\\]/g, " ").trim();
  if (t) c = c.ilike("enunciado", `%${t}%`);
  if (f.area) c = c.eq("area", f.area);
  if (f.materia) c = c.eq("materia", f.materia);
  if (f.banca) c = c.eq("banca", f.banca);
  if (f.anoDe) c = c.gte("ano", f.anoDe);
  if (f.anoAte) c = c.lte("ano", f.anoAte);
  const { data } = await c.limit(30);
  return (data ?? []).map((q) => ({ id: q.id, banca: q.banca, ano: q.ano, numero: q.numero, materia: q.materia, trecho: q.enunciado.replace(/[*]/g, "").slice(0, 160) }));
}

export async function publicarSimulado(id: string): Promise<void> {
  const { simulado } = await exigirSimuladoEditavel(id);
  const [ids, { count }] = await Promise.all([idsDoSimulado(id), supabase.from("simulado_turmas").select("simulado_id", { count: "exact", head: true }).eq("simulado_id", id)]);
  if (ids.length === 0) throw new Error("Adicione questões antes de publicar.");
  if ((count ?? 0) === 0) throw new Error("Escolha ao menos uma turma.");
  if (!simulado.abre_em || !simulado.fecha_em) throw new Error("Defina abertura e fechamento.");
  const { error } = await supabase.from("simulados").update({ status: "publicado", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function liberarCorrecao(id: string): Promise<void> {
  await exigirSimuladoEditavel(id);
  const { error } = await supabase.from("simulados").update({ correcao: "na_hora", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2:** `npx tsc --noEmit && npx eslint src/actions/simulados.ts` → OK.
- [ ] **Step 3:** Commit — `git add src/actions/simulados.ts && git commit -m "Simulados: actions do professor (montar, sortear, publicar, liberar)"`

---

### Task 6: Telas do professor

**Files:** Create `src/app/simulados/page.tsx`, `src/app/simulados/novo/page.tsx`, `src/app/simulados/[id]/page.tsx`, `src/app/simulados/[id]/editar/page.tsx`, `src/components/simulados/FormSimulado.tsx`, `src/components/simulados/MontarQuestoes.tsx`, `src/components/simulados/LiberarCorrecao.tsx`; Modify `src/components/layout/Sidebar.tsx`

**Interfaces:** Consumes Task 5 actions, Task 3 (`podeEditarSimulado`, `fecharVencidas`), Task 2 (`situacaoSimulado`), `listarTurmasAcessiveis`, `MATERIAS`, `AREAS`, `PageLayout`, `estilos`.

- [ ] **Step 1: `FormSimulado.tsx`** — campos: título; turmas (checkbox por turma·ano, uma opção por nome+ano a partir de `listarTurmasAcessiveis`, igual a `FormCurso`); duração (min); abre em / fecha em (`datetime-local`, convertidos com `new Date(valor).toISOString()`); correção (radio "Depois do prazo" padrão / "Na hora"); embaralhar (checkbox, padrão marcado). Sem `inicial` chama `criarSimulado` e navega para `/simulados/<id>/editar`; com `inicial` chama `salvarSimulado` e `router.refresh()`. Erros em `role="alert"`. Conversão para o input: `paraInputData(iso)` (mesma função de `src/components/cursos/EditorAula.tsx`, copie-a para dentro do componente).

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { criarSimulado, salvarSimulado, type DadosSimulado } from "@/actions/simulados";
import { estilos } from "@/components/ui/estilos";

type Props = { inicial?: DadosSimulado & { id: string }; turmas: { turma_nome: string; ano_letivo: string }[] };
const chave = (t: { turma_nome: string; ano_letivo: string }) => `${t.turma_nome}|${t.ano_letivo}`;

function paraInputData(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function FormSimulado({ inicial, turmas }: Props) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [marcadas, setMarcadas] = useState(new Set((inicial?.turmas ?? []).map(chave)));
  const [duracao, setDuracao] = useState(String(inicial?.duracaoMin ?? 90));
  const [abre, setAbre] = useState(paraInputData(inicial?.abreEm));
  const [fecha, setFecha] = useState(paraInputData(inicial?.fechaEm));
  const [correcao, setCorrecao] = useState<DadosSimulado["correcao"]>(inicial?.correcao ?? "apos_prazo");
  const [embaralhar, setEmbaralhar] = useState(inicial?.embaralhar ?? true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setErro(null); setAviso(null);
    const dados: DadosSimulado = {
      titulo, turmas: turmas.filter((t) => marcadas.has(chave(t))), duracaoMin: Number(duracao),
      abreEm: abre ? new Date(abre).toISOString() : "", fechaEm: fecha ? new Date(fecha).toISOString() : "", correcao, embaralhar,
    };
    try {
      if (inicial) { await salvarSimulado(inicial.id, dados); setAviso("Salvo."); router.refresh(); }
      else router.push(`/simulados/${await criarSimulado(dados)}/editar`);
    } catch (err) { setErro(err instanceof Error ? err.message : "Não foi possível salvar."); }
    finally { setOcupado(false); }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">{aviso}</p>}
      <label className="flex flex-col gap-1 text-xs text-muted">Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Simulado ENEM — Natureza" className={estilos.input} /></label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-muted">Turmas</legend>
        <div className="flex flex-wrap gap-2">
          {turmas.map((t) => { const k = chave(t); return (
            <label key={k} className="flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1.5 text-sm text-ink">
              <input type="checkbox" checked={marcadas.has(k)} onChange={(e) => { const n = new Set(marcadas); if (e.target.checked) n.add(k); else n.delete(k); setMarcadas(n); }} /> {t.turma_nome} · {t.ano_letivo}
            </label>); })}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted">Duração (min)<input value={duracao} onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ""))} inputMode="numeric" required className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Abre em<input type="datetime-local" value={abre} onChange={(e) => setAbre(e.target.value)} required className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Fecha em<input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={estilos.input} /></label>
      </div>
      <fieldset className="flex flex-col gap-1 text-sm text-ink">
        <legend className="mb-1 text-xs text-muted">Quando o aluno vê a correção</legend>
        <label className="flex items-center gap-2"><input type="radio" checked={correcao === "apos_prazo"} onChange={() => setCorrecao("apos_prazo")} /> Depois que o prazo terminar</label>
        <label className="flex items-center gap-2"><input type="radio" checked={correcao === "na_hora"} onChange={() => setCorrecao("na_hora")} /> Logo que entregar</label>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={embaralhar} onChange={(e) => setEmbaralhar(e.target.checked)} /> Embaralhar a ordem das questões para cada aluno</label>
      <button type="submit" disabled={ocupado} className={estilos.botaoPrimario}>{ocupado ? "Salvando…" : inicial ? "Salvar dados" : "Criar e escolher questões"}</button>
    </form>
  );
}
```

- [ ] **Step 2: `MontarQuestoes.tsx`** (cliente) — props `{ simuladoId: string; questoes: { id: string; banca: string; ano: number | null; numero: number | null; materia: string; trecho: string }[]; travado: boolean; assuntos: { id: string; materia: string; nome: string }[] }`. Filtros (área, matéria, assunto filtrado pela matéria, banca, ano de/até, quantidade) + **Sortear** (`sortearQuestoes`; aviso "Foram adicionadas N de M (não há mais questões com esses filtros)" quando N < M). Lista numerada: rótulo `banca ano · Nº · matéria` + trecho; botões **Trocar** (`trocarQuestao` com os filtros atuais; aviso se `false`), **Remover** (`removerQuestao`), link "Ver" para `/banco/questoes/<id>` (nova aba). Busca **+ Adicionar do banco**: campo de texto + resultados de `buscarQuestoesBanco` com botão "Adicionar" (`adicionarQuestao`). Com `travado`, esconde as ações e mostra "Alunos já começaram — as questões estão travadas." Após cada ação: `router.refresh()`; erros em `role="alert"`.

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adicionarQuestao, buscarQuestoesBanco, removerQuestao, sortearQuestoes, trocarQuestao } from "@/actions/simulados";
import { AREAS, MATERIAS } from "@/lib/questoes/materias";
import { estilos } from "@/components/ui/estilos";

type Item = { id: string; banca: string; ano: number | null; numero: number | null; materia: string; trecho: string };
type Props = { simuladoId: string; questoes: Item[]; travado: boolean; assuntos: { id: string; materia: string; nome: string }[] };
const rotuloMateria = (m: string) => MATERIAS[m as keyof typeof MATERIAS]?.rotulo ?? m;

export function MontarQuestoes({ simuladoId, questoes, travado, assuntos }: Props) {
  const router = useRouter();
  const [area, setArea] = useState(""); const [materia, setMateria] = useState(""); const [assunto, setAssunto] = useState("");
  const [banca, setBanca] = useState(""); const [anoDe, setAnoDe] = useState(""); const [anoAte, setAnoAte] = useState("");
  const [quantidade, setQuantidade] = useState("10");
  const [texto, setTexto] = useState(""); const [achadas, setAchadas] = useState<Item[]>([]);
  const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState<string | null>(null); const [aviso, setAviso] = useState<string | null>(null);
  const filtros = () => ({ area: area || undefined, materia: materia || undefined, assunto_id: assunto || undefined, banca: banca.trim() || undefined, anoDe: anoDe ? Number(anoDe) : undefined, anoAte: anoAte ? Number(anoAte) : undefined });

  async function executar(acao: () => Promise<void>) {
    setOcupado(true); setErro(null); setAviso(null);
    try { await acao(); router.refresh(); } catch (e) { setErro(e instanceof Error ? e.message : "Algo deu errado."); } finally { setOcupado(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">{aviso}</p>}
      {travado ? <p className="text-sm text-muted">Alunos já começaram — as questões estão travadas.</p> : (
        <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área" className={estilos.input}><option value="">Área</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={materia} onChange={(e) => { setMateria(e.target.value); setAssunto(""); }} aria-label="Matéria" className={estilos.input}><option value="">Matéria</option>{Object.entries(MATERIAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</select>
          <select value={assunto} onChange={(e) => setAssunto(e.target.value)} aria-label="Assunto" disabled={!materia} className={estilos.input}><option value="">Assunto</option>{assuntos.filter((a) => a.materia === materia).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
          <input value={banca} onChange={(e) => setBanca(e.target.value)} placeholder="Banca" aria-label="Banca" className={estilos.input} />
          <input value={anoDe} onChange={(e) => setAnoDe(e.target.value.replace(/\D/g, ""))} placeholder="Ano de" aria-label="Ano de" inputMode="numeric" className={estilos.input} />
          <input value={anoAte} onChange={(e) => setAnoAte(e.target.value.replace(/\D/g, ""))} placeholder="Ano até" aria-label="Ano até" inputMode="numeric" className={estilos.input} />
          <div className="flex gap-2">
            <input value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))} aria-label="Quantidade" inputMode="numeric" className={`${estilos.input} w-16`} />
            <button type="button" disabled={ocupado} onClick={() => void executar(async () => { const r = await sortearQuestoes(simuladoId, { ...filtros(), quantidade: Number(quantidade) }); if (r.adicionadas < r.pedidas) setAviso(`Foram adicionadas ${r.adicionadas} de ${r.pedidas} (não há mais questões com esses filtros).`); })} className={estilos.botaoPrimario}>Sortear</button>
          </div>
        </div>
      )}
      <ol className="divide-y divide-line">
        {questoes.map((q, i) => (
          <li key={q.id} className="flex flex-wrap items-start gap-2 py-2 text-sm">
            <span className="w-6 font-mono text-muted">{i + 1}.</span>
            <span className="min-w-0 flex-1"><span className="block text-xs text-muted">{q.banca} {q.ano ?? ""} · Nº {q.numero ?? "—"} · {rotuloMateria(q.materia)}</span><span className="line-clamp-2 text-ink">{q.trecho}</span></span>
            <Link href={`/banco/questoes/${q.id}`} target="_blank" className={estilos.botaoFantasma}>Ver</Link>
            {!travado && <>
              <button type="button" disabled={ocupado} onClick={() => void executar(async () => { if (!(await trocarQuestao(simuladoId, q.id, filtros()))) setAviso("Não há outra questão com os filtros atuais."); })} className={estilos.botaoFantasma}>Trocar</button>
              <button type="button" disabled={ocupado} onClick={() => void executar(() => removerQuestao(simuladoId, q.id))} className={estilos.botaoFantasma}>Remover</button>
            </>}
          </li>
        ))}
        {questoes.length === 0 && <li className="py-4 text-sm text-muted">Nenhuma questão ainda. Use os filtros e "Sortear".</li>}
      </ol>
      {!travado && (
        <details className="rounded-control border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold text-brand">+ Adicionar do banco</summary>
          <div className="mt-2 flex gap-2">
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar no enunciado" aria-label="Buscar no banco" className={estilos.input} />
            <button type="button" disabled={ocupado} onClick={() => void executar(async () => setAchadas(await buscarQuestoesBanco(simuladoId, texto, filtros())))} className={estilos.botaoSecundario}>Buscar</button>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {achadas.map((q) => (
              <li key={q.id} className="flex items-start gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1"><span className="block text-xs text-muted">{q.banca} {q.ano ?? ""} · {rotuloMateria(q.materia)}</span><span className="line-clamp-2">{q.trecho}</span></span>
                <button type="button" disabled={ocupado || questoes.some((x) => x.id === q.id)} onClick={() => void executar(() => adicionarQuestao(simuladoId, q.id))} className={estilos.botaoFantasma}>{questoes.some((x) => x.id === q.id) ? "Já está" : "Adicionar"}</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Páginas**

`src/app/simulados/page.tsx` — professor logado (senão `/login`); lista simulados `tipo = 'professor'` da escola (não-admin: `professor_id = professor.id`), mais recentes primeiro; cada linha: título, situação (`situacaoSimulado`: Rascunho/Agendado/Aberto/Encerrado), janela formatada (`toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })`), link para `/simulados/<id>` (publicado) ou `/simulados/<id>/editar` (rascunho). Botão "Novo simulado" → `/simulados/novo`.

`src/app/simulados/novo/page.tsx` — `PageLayout` com `FormSimulado` (sem `inicial`) e opções de turma vindas de `listarTurmasAcessiveis()` (uma por nome+ano).

`src/app/simulados/[id]/editar/page.tsx` — carrega o simulado, `podeEditarSimulado` (senão `notFound`); turmas ligadas (`simulado_turmas`); questões em ordem (join manual: `simulado_questoes` → `questoes` id, banca, ano, numero, materia, enunciado); assuntos (`assuntos` id, materia, nome); `travado` = existe tentativa. Seções: "Dados" (`FormSimulado` com `inicial`, opções = acessíveis ∪ já ligadas), "Questões" (`MontarQuestoes`), e botão **Publicar** (cliente pequeno que chama `publicarSimulado` e vai para `/simulados/<id>`; mostra erro). Se já publicado, mostra "Publicado" e link "Ver resultados".

`src/app/simulados/[id]/page.tsx` — acompanhar: `podeEditarSimulado` (senão `notFound`); `await fecharVencidas(id)`; tentativas com nome do aluno (`alunos_contas` nome); contagem começaram/entregaram; tabela aluno × acertos/total, %, por área (`AREAS`), tempo (entregue − iniciada, em minutos); "Questões mais erradas": a partir de `tentativa_respostas` das tentativas entregues, por questão: % de `correta` e alternativa mais marcada; ordenar por % crescente, mostrar até 10 com link "Ver" (`/banco/questoes/<id>`). Se `correcao === 'apos_prazo'` e o prazo não passou: `LiberarCorrecao` (cliente: confirma e chama `liberarCorrecao`, depois `router.refresh()`). Link "Editar" quando ainda rascunho ou sem tentativas.

- [ ] **Step 4: Barra lateral** — em `Sidebar.tsx`, depois de "Questões": `{ href: "/simulados", icon: Timer, label: "Simulados", ativo: pathname.startsWith("/simulados") }` e `Timer` no import de `lucide-react`.

- [ ] **Step 5:** `npx tsc --noEmit && npm run lint && npm run build` → OK.
- [ ] **Step 6:** Commit — `git add src/app/simulados src/components/simulados src/components/layout/Sidebar.tsx && git commit -m "Simulados: telas do professor (montar, publicar, acompanhar)"`

---

### Task 7: Telas do aluno

**Files:** Create `src/app/aluno/simulados/page.tsx`, `src/app/aluno/simulados/[id]/page.tsx`, `src/components/simulados/NovoTreino.tsx`, `src/components/simulados/ProvaAluno.tsx`, `src/components/simulados/ResultadoAluno.tsx`; Modify `src/app/aluno/page.tsx`

**Interfaces:** Consumes Task 4 actions e tipos (`ProvaAluno`, `ResultadoAluno`, `criarTreino`, `iniciarTentativa`, `responder`, `pulsoTreino`, `pausarTreino`, `entregar`, `obterProva`, `resultadoAluno`); `TextoQuestao`, `ImagemQuestao`; `situacaoSimulado`, `PULSO_SEG`; `AREAS`, `MATERIAS`.

- [ ] **Step 1: `/aluno/simulados/page.tsx`** — `getAlunoAtual()` (senão `/login`). **Da turma**: simulados `tipo='professor'`, `status='publicado'`, da escola, cujas `simulado_turmas` cruzam com `turmasDoAluno` (mesma regra de `simuladoVisivelParaAluno`, em lote); para cada um a tentativa do aluno (se houver). Estado: sem tentativa e `aberto` → **Começar** (form que chama `iniciarTentativa` e vai para `/aluno/simulados/<id>`); `agendado` → "Abre em dd/mm hh:mm"; `encerrado` sem tentativa → "Encerrado"; tentativa em andamento → **Continuar**; entregue → "Entregue · NN%" (se `correcaoLiberada`) ou "Entregue · correção em dd/mm hh:mm", link "Ver resultado". **Meus treinos**: `NovoTreino` + lista dos treinos do aluno (`tipo='treino'`, `conta_id = aluno.id`), mais recentes primeiro, com % se entregue ou "Continuar". Datas com `timeZone: "America/Sao_Paulo"`.

- [ ] **Step 2: `NovoTreino.tsx`** (cliente) — área, matéria, banca, ano de/até, quantidade (1–90, padrão 10), tempo: "Sem tempo" (padrão) ou minutos. Botão **Começar treino**: `criarTreino` → `iniciarTentativa(simuladoId)` → `router.push('/aluno/simulados/<id>')`; se `sorteadas < pedidas`, avisa antes de navegar ("Só havia N questões com esses filtros"). Erros em `role="alert"`.

- [ ] **Step 3: `ProvaAluno.tsx`** (cliente) — recebe `prova: ProvaAluno`.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { entregar, pausarTreino, pulsoTreino, responder, type ProvaAluno as Prova } from "@/actions/simulados-aluno";
import { PULSO_SEG } from "@/lib/simulados/regras";
import type { Letra } from "@/lib/types";
import { ImagemQuestao } from "@/components/questoes/ImagemQuestao";
import { TextoQuestao } from "@/components/questoes/TextoQuestao";
import { estilos } from "@/components/ui/estilos";

const LETRAS: Letra[] = ["A", "B", "C", "D", "E"];
type Pendente = { questaoId: string; alternativa: Letra | null };
const chaveLocal = (t: string) => `prova:${t}`;

function formatar(seg: number) {
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

export function ProvaAluno({ prova }: { prova: Prova }) {
  const router = useRouter();
  const [atual, setAtual] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, Letra | null>>(() => {
    try { return { ...prova.respostas, ...JSON.parse(localStorage.getItem(chaveLocal(prova.tentativaId)) ?? "{}") }; } catch { return prova.respostas; }
  });
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [restante, setRestante] = useState<number | null>(prova.restanteSeg);
  const fila = useRef<Pendente[]>([]);
  const enviando = useRef(false);
  const encerrando = useRef(false);
  // Diferença entre o relógio do servidor e o do aparelho, para o cronômetro do professor.
  const desvio = useRef(Date.parse(prova.agoraServidor) - Date.now());

  const terminar = useCallback(async () => {
    if (encerrando.current) return;
    encerrando.current = true;
    try { await entregar(prova.tentativaId); } catch { /* a entrega automática no servidor cobre */ }
    try { localStorage.removeItem(chaveLocal(prova.tentativaId)); } catch { /* sem armazenamento local */ }
    router.refresh();
  }, [prova.tentativaId, router]);

  // Envia a fila em ordem; se falhar, tenta de novo a cada 3 s (internet caiu).
  const processar = useCallback(async () => {
    if (enviando.current) return;
    enviando.current = true;
    setSalvando(true);
    while (fila.current.length) {
      const p = fila.current[0];
      try {
        const r = await responder(prova.tentativaId, p.questaoId, p.alternativa);
        if (!r.ok && r.encerrada) { setAviso(r.erro); fila.current = []; await terminar(); break; }
        fila.current.shift();
      } catch {
        setAviso("Sem conexão — suas respostas estão guardadas e serão enviadas assim que voltar.");
        await new Promise((ok) => setTimeout(ok, 3000));
      }
    }
    enviando.current = false;
    setSalvando(false);
    if (!fila.current.length) setAviso((a) => (a?.startsWith("Sem conexão") ? null : a));
  }, [prova.tentativaId, terminar]);

  function marcar(questaoId: string, alternativa: Letra | null) {
    const novo = { ...respostas, [questaoId]: alternativa };
    setRespostas(novo);
    try { localStorage.setItem(chaveLocal(prova.tentativaId), JSON.stringify(novo)); } catch { /* sem armazenamento local */ }
    fila.current = [...fila.current.filter((p) => p.questaoId !== questaoId), { questaoId, alternativa }];
    void processar();
  }

  // Cronômetro do professor: prazo do servidor menos o "agora" do servidor estimado.
  useEffect(() => {
    if (prova.simulado.tipo !== "professor" || !prova.prazoEm) return;
    const prazo = Date.parse(prova.prazoEm);
    const t = setInterval(() => {
      const r = Math.max(0, Math.floor((prazo - (Date.now() + desvio.current)) / 1000));
      setRestante(r);
      if (r === 0) void terminar();
    }, 1000);
    return () => clearInterval(t);
  }, [prova.simulado.tipo, prova.prazoEm, terminar]);

  // Treino com tempo: pulso a cada 15 s enquanto a página está visível; contagem local entre pulsos.
  useEffect(() => {
    if (prova.simulado.tipo !== "treino" || !prova.simulado.duracaoMin) return;
    const pulso = async () => {
      if (document.visibilityState !== "visible") return;
      try { const r = await pulsoTreino(prova.tentativaId); setRestante(r.restanteSeg); if (r.encerrada) await terminar(); } catch { /* tenta no próximo */ }
    };
    const aoMudar = () => { if (document.visibilityState === "hidden") void pausarTreino(prova.tentativaId); else void pulso(); };
    const tPulso = setInterval(() => void pulso(), PULSO_SEG * 1000);
    const tLocal = setInterval(() => { if (document.visibilityState === "visible") setRestante((r) => (r == null ? r : Math.max(0, r - 1))); }, 1000);
    document.addEventListener("visibilitychange", aoMudar);
    void pulso();
    return () => { clearInterval(tPulso); clearInterval(tLocal); document.removeEventListener("visibilitychange", aoMudar); };
  }, [prova.simulado.tipo, prova.simulado.duracaoMin, prova.tentativaId, terminar]);

  const q = prova.questoes[atual];
  const emBranco = prova.questoes.filter((x) => !respostas[x.id]).length;
  const alerta = restante !== null && restante <= 300;

  if (!q) return <p className="text-sm text-muted">Nenhuma questão.</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-semibold text-ink">{prova.simulado.titulo}</h1>
        <div className="flex items-center gap-2">
          {restante !== null && <span role="timer" aria-live="off" className={`rounded-control px-3 py-1 font-mono text-lg tabular-nums ${alerta ? "bg-gold/40 text-gold-ink" : "bg-surface-sunken text-ink"}`}>⏱ {formatar(restante)}</span>}
          {prova.simulado.tipo === "treino" && <button type="button" onClick={async () => { await pausarTreino(prova.tentativaId); router.push("/aluno/simulados"); }} className={estilos.botaoFantasma}>Pausar</button>}
          <button type="button" onClick={() => { if (window.confirm(emBranco ? `Você deixou ${emBranco} questão(ões) em branco. Entregar mesmo assim?` : "Entregar o simulado?")) void terminar(); }} className={estilos.botaoPrimario}>Entregar</button>
        </div>
      </div>
      {alerta && restante! > 0 && <p role="status" className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">Faltam menos de 5 minutos. Ao zerar, a prova é entregue automaticamente.</p>}
      {aviso && <p role="status" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{aviso}</p>}
      <section className={`${estilos.card} flex flex-col gap-3 p-4`} aria-label={`Questão ${atual + 1}`}>
        <p className="text-xs text-muted">Questão {atual + 1} de {prova.questoes.length} · <span aria-live="polite">{salvando ? "salvando…" : "salvo ✓"}</span></p>
        <TextoQuestao texto={q.enunciado} />
        {q.imagens.filter((i) => i.alvo === "enunciado").map((i) => <ImagemQuestao key={i.id} imagem={i} />)}
        {q.comando && <p className="text-sm font-medium text-ink">{q.comando}</p>}
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Alternativas</legend>
          {LETRAS.map((l) => (
            <label key={l} className={`flex cursor-pointer items-start gap-2 rounded-control border p-2 text-sm ${respostas[q.id] === l ? "border-brand bg-brand/10" : "border-line"}`}>
              <input type="radio" name={`q-${q.id}`} checked={respostas[q.id] === l} onChange={() => marcar(q.id, l)} className="mt-1" />
              <span className="flex-1"><strong>{l})</strong> {q.alternativas.find((a) => a.letra === l)?.texto}
                {q.imagens.filter((i) => i.alvo === l).map((i) => <ImagemQuestao key={i.id} imagem={i} />)}</span>
            </label>
          ))}
          {respostas[q.id] && <button type="button" onClick={() => marcar(q.id, null)} className={`${estilos.botaoFantasma} w-fit text-xs`}>Limpar resposta</button>}
        </fieldset>
      </section>
      <div className="flex justify-between">
        <button type="button" disabled={atual === 0} onClick={() => setAtual(atual - 1)} className={estilos.botaoSecundario}>◀ Anterior</button>
        <button type="button" disabled={atual === prova.questoes.length - 1} onClick={() => setAtual(atual + 1)} className={estilos.botaoSecundario}>Próxima ▶</button>
      </div>
      <nav aria-label="Ir para a questão" className="flex flex-wrap gap-1">
        {prova.questoes.map((x, i) => (
          <button key={x.id} type="button" onClick={() => setAtual(i)} aria-current={i === atual ? "step" : undefined} aria-label={`Questão ${i + 1}${respostas[x.id] ? ", respondida" : ""}`}
            className={`h-9 w-9 rounded-control text-sm font-semibold ${i === atual ? "ring-2 ring-brand" : ""} ${respostas[x.id] ? "bg-brand text-white" : "bg-surface-sunken text-ink"}`}>{i + 1}</button>
        ))}
      </nav>
    </div>
  );
}
```

Verifique o lint de hooks (`react-hooks`): se reclamar de `localStorage` no inicializador do `useState` durante a renderização no servidor, leia o armazenamento local num `useEffect` de montagem e mescle as respostas lá.

- [ ] **Step 4: `ResultadoAluno.tsx`** (server-safe) — props `{ resultado: ResultadoAluno; questoes: QuestaoAluno[] }`. Não liberado: "Entregue! A correção sai em dd/mm às hh:mm" (ou "quando o professor liberar" sem data). Liberado: acertos/total e %, por área (`AREAS`) com barra; lista na ordem: nº, ✓/✗ (anulada: "anulada"), "Sua resposta: X · Certa: Y", e `<details>` "Ver questão" com `TextoQuestao`, imagens e alternativas (a certa destacada).

- [ ] **Step 5: `/aluno/simulados/[id]/page.tsx`** — `getAlunoAtual()`; `const prova = await obterProva(id)` (erro "não encontrado" → `notFound()`). Sem tentativa: se aberto, botão **Começar** (form → `iniciarTentativa` → recarrega); senão a situação. Em andamento: `<ProvaAluno key={prova.tentativaId} prova={prova} />`. Entregue: `const resultado = await resultadoAluno(id)`; só se `resultado.liberado`, a página (server component) importa `questoesParaAluno` de `@/lib/simulados/servidor` e chama `questoesParaAluno(resultado.itens.map((i) => i.questaoId), 1800)` (a resposta certa vem de `resultado.itens`, não da questão); renderize `ResultadoAluno` com `questoes` (vazio quando não liberado). `export const dynamic = "force-dynamic"`.

- [ ] **Step 6: Cartão na área do aluno** — em `src/app/aluno/page.tsx`, o cartão "Simulados" vira `Link` para `/aluno/simulados`, sem o selo "Em breve" (mesmo padrão do cartão "Aulas").

- [ ] **Step 7:** `npx tsc --noEmit && npm run lint && npm run build && npm test` → OK.
- [ ] **Step 8:** Commit — `git add src/app/aluno src/components/simulados && git commit -m "Simulados: telas do aluno (treino, prova com cronometro e resultado)"`

---

### Task 8: Documentação e verificação

- [ ] **Step 1:** Acrescente ao fim de `DESIGN.md`:

```markdown
## Simulados
Professor: `/simulados` (lista com situação), `/simulados/novo` e `/simulados/[id]/editar` (dados + sorteio/troca de questões + publicar), `/simulados/[id]` (resultados, questões mais erradas, liberar correção). Aluno: `/aluno/simulados` (da turma e treinos), `/aluno/simulados/[id]` (prova com cronômetro do servidor, grade de questões, "salvo ✓", entrega automática; resultado por área). Respostas salvas a cada clique; a resposta certa só aparece no resultado liberado.
```

- [ ] **Step 2:** `npm test && npm run lint && npm run build` → OK.
- [ ] **Step 3: Roteiro manual (Peter)** — publicar algumas questões no banco (ou classificar o ENEM com a chave); professor cria simulado de 10 min para turma de teste, sorteia, troca uma questão, publica; aluno começa, responde metade, fecha a aba, volta e continua (marcações e tempo certos); desliga o Wi-Fi, marca uma resposta, religa (vai "salvando…" → "salvo ✓"); espera zerar (entrega sozinha); professor vê resultados e libera a correção; aluno vê o gabarito; aluno cria treino de 5 questões com 3 min, pausa, volta.
- [ ] **Step 4:** Commit — `git add DESIGN.md && git commit -m "DESIGN: simulados"`
