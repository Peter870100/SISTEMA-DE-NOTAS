# Loja com Stripe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vender curso avulso e pacote completo (cursos à venda + treinos) a alunos de fora, com Stripe Checkout (Pix e cartão até 12x), liberação por webhook e painel de produtos/vendas para o dono.

**Architecture:** Alunos de fora pertencem à escola da plataforma (`ESCOLA_LOJA_ID`). Regras puras (validade, acesso vigente, eventos do Stripe) em `src/lib/loja/regras.ts`. Servidor em `src/lib/loja/servidor.ts` (sem `"use server"`): cliente Stripe, acesso vigente da conta, aplicação de eventos. O acesso aos cursos do aluno da loja entra nas funções existentes de `src/lib/aulas/acesso.ts`, então todas as telas de aula/PDF passam a funcionar sem mudança. Webhook em `src/app/api/stripe/webhook/route.ts`.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions, Route Handlers), React 19, Supabase (cliente server-side), pacote `stripe` (Node), Tailwind 4, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-05-loja-stripe-design.md`

## Global Constraints

- Leia `node_modules/next/dist/docs/` antes de usar API do Next (params/searchParams/headers assíncronos; Route Handlers).
- Leia os tipos de `node_modules/stripe` antes de usar a API do Stripe (nomes exatos de campos e eventos).
- `ESCOLA_LOJA_ID = "00000000-0000-0000-0000-000000000002"`, slug `loja`; `ESCOLA_PADRAO_ID = "00000000-0000-0000-0000-000000000001"`.
- Moeda `brl`; preço em centavos lido **do banco**; o navegador nunca envia preço.
- `payment_method_types: ['card', 'pix']`; parcelamento ligado; Pix expira em 3600 s.
- Só o webhook com assinatura válida (`STRIPE_WEBHOOK_SECRET`) marca compra como `paga`/`reembolsada`/`expirada`; transições condicionais (idempotentes).
- Chaves só por variáveis de ambiente (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`); sem chave, loja mostra "Vendas em breve" e Comprar desativado.
- Só contas da escola da plataforma compram; alunos de escola e professores não.
- Aluno da loja: treinos só com pacote completo vigente; questões só `escopo = 'geral'` (regra existente por escola).
- Funções que recebem ids sem checar acesso nunca em arquivo `"use server"`. Chave anon do Supabase só no servidor.
- Textos em português do Brasil; preço exibido como `R$ 97,00`.

## Review Focus

1. **Mesmo evento do Stripe entregue duas vezes / fora de ordem** (ex.: `async_payment_succeeded` depois de `completed`): compra paga uma vez, validade calculada uma vez. Pinado em `estadoDaCompra` (Task 1) e na transição condicional de `aplicarEvento` (Task 3).
2. **Alguém chama o webhook sem assinatura ou com corpo alterado**: 400 e nada muda. Pinado na Task 3.
3. **Aluno volta da página do Stripe antes do webhook chegar / Pix ainda não pago**: tela de obrigado mostra "liberando…"/"aguardando Pix" e libera sozinha quando o webhook chega; ninguém ganha acesso pela URL de retorno. Pinado na Task 4.
4. **Acesso vencido ou reembolsado**: aula, PDF e treino ficam bloqueados; progresso preservado; renovar soma prazo. Pinado em `acessoVigente`/`novaValidade` (Task 1) e nas integrações da Task 2.
5. **Aluno de escola (ou professor) tentando comprar ou acessar a loja como comprador / dono desativando a escola da plataforma**: recusado. Pinado nas Tasks 3, 4 e 6.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `db/schema.sql`, `src/lib/types.ts` (mod.) | SQL e tipos `ProdutoLoja`, `Compra`, `OrigemContaAluno` + `'loja'` |
| `src/lib/dominio.ts` (mod.) + test | `SLUG_LOJA`, reservado, `urlDaEscola` da loja = www, exceção no login |
| `src/lib/loja/regras.ts` + `src/lib/loja/loja.test.ts` | Regras puras |
| `src/lib/loja/servidor.ts` | Stripe, vigência da conta, produtos, aplicar evento |
| `src/lib/escolas.ts`, `src/lib/aulas/acesso.ts`, `src/actions/simulados-aluno.ts` (mod.) | Integração do acesso comprado |
| `src/app/api/stripe/webhook/route.ts` | Webhook |
| `src/actions/loja.ts` | Cadastro da loja, iniciar compra, situação da compra |
| `src/app/loja/**`, `src/components/loja/**`, `src/lib/rotas.ts` (mod.) | Telas públicas |
| `src/app/aluno/page.tsx`, `src/app/aluno/simulados/page.tsx` (mod.) | Área do aluno da loja |
| `src/actions/dono-loja.ts`, `src/app/dono/loja/**`, `src/components/dono/**` | Painel do dono |

---

### Task 1: SQL, tipos, endereço e regras puras

**Files:** Modify `db/schema.sql`, `src/lib/types.ts`, `src/lib/dominio.ts`, `src/lib/dominio.test.ts`, `src/lib/escolas.ts`, `package.json`; Create `src/lib/loja/regras.ts`, `src/lib/loja/loja.test.ts`

**Interfaces — Produces:**
- `dominio.ts`: `SLUG_LOJA = "loja"` (também em `SUBDOMINIOS_RESERVADOS`); `urlDaEscola("loja", c)` = `https://www.statusavalia.com.br<c>`; `destinoDoLogin(slugDaConta, slugDoEndereco)` aceita `slugDaConta === "loja"` quando `slugDoEndereco === "status"`.
- `escolas.ts`: `export const ESCOLA_LOJA_ID = "00000000-0000-0000-0000-000000000002";`
- `types.ts`: `OrigemContaAluno = "escola" | "convite" | "loja"`; `ProdutoLoja`; `Compra`; tabelas `produtos_loja`, `compras` no `Database`.
- `loja/regras.ts`: `novaValidade`, `acessoVigente`, `podeVerCursoComprado`, `podeTreinar`, `formatarPreco`, `estadoDaCompra`, tipos `Vigencia`, `EventoLoja`.

- [ ] **Step 1: SQL** — copie, sem alterar, o bloco SQL da seção "1. Banco de dados" da spec para o fim de `db/schema.sql` (não rode).

- [ ] **Step 2: Tipos** (`src/lib/types.ts`):

```ts
export type ProdutoLoja = {
  id: string;
  tipo: "curso" | "completo";
  curso_id: string | null;
  titulo: string;
  descricao: string | null;
  preco_centavos: number;
  meses: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};
export type StatusCompra = "pendente" | "paga" | "reembolsada" | "expirada";
export type Compra = {
  id: string;
  conta_id: string;
  produto_id: string;
  valor_centavos: number;
  meses: number;
  stripe_session_id: string;
  stripe_payment_intent: string | null;
  status: StatusCompra;
  acesso_ate: string | null;
  paga_em: string | null;
  created_at: string;
};
```

`OrigemContaAluno` ganha `"loja"`. No `Database.public.Tables`:

```ts
      produtos_loja: {
        Row: ProdutoLoja;
        Insert: Partial<Omit<ProdutoLoja, "id" | "created_at" | "updated_at">> & { tipo: "curso" | "completo"; titulo: string; preco_centavos: number; meses: number };
        Update: Partial<Omit<ProdutoLoja, "id" | "created_at">>;
        Relationships: [];
      };
      compras: {
        Row: Compra;
        Insert: Partial<Omit<Compra, "id" | "created_at">> & { conta_id: string; produto_id: string; valor_centavos: number; meses: number; stripe_session_id: string };
        Update: Partial<Omit<Compra, "id" | "created_at">>;
        Relationships: [];
      };
```

- [ ] **Step 3: Endereço** — em `dominio.ts`: acrescente `"loja"` a `SUBDOMINIOS_RESERVADOS`; `export const SLUG_LOJA = "loja";`; em `urlDaEscola`, `slug === SLUG_PADRAO || slug === SLUG_LOJA` → host `www.`; em `destinoDoLogin`: `if (slugDoEndereco === slugDaConta || (slugDaConta === SLUG_LOJA && slugDoEndereco === SLUG_PADRAO)) return { ok: true };`. Em `escolas.ts`, exporte `ESCOLA_LOJA_ID`. Testes novos em `dominio.test.ts`:

```ts
test("loja: endereço www e login no www", () => {
  assert.equal(urlDaEscola("loja", "/loja"), "https://www.statusavalia.com.br/loja");
  assert.deepEqual(destinoDoLogin("loja", "status"), { ok: true });
  assert.deepEqual(destinoDoLogin("loja", "colegiox"), { ok: false, slug: "loja" });
  assert.deepEqual(destinoDoLogin("status", "loja"), { ok: false, slug: "status" });
  assert.notEqual(validarSubdominio("loja"), null);
});
```

- [ ] **Step 4: Testes das regras**

```ts
// src/lib/loja/loja.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { acessoVigente, estadoDaCompra, formatarPreco, novaValidade, podeTreinar, podeVerCursoComprado } from "./regras";

const d = (s: string) => new Date(s);

test("novaValidade: soma meses a partir de hoje ou da validade vigente", () => {
  assert.equal(novaValidade(null, 12, d("2026-10-05T12:00:00Z")).toISOString(), "2027-10-05T12:00:00.000Z");
  assert.equal(novaValidade(d("2026-12-01T00:00:00Z"), 1, d("2026-10-05T00:00:00Z")).toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(novaValidade(d("2026-01-01T00:00:00Z"), 1, d("2026-10-05T00:00:00Z")).toISOString(), "2026-11-05T00:00:00.000Z"); // vencida: conta de hoje
  assert.equal(novaValidade(null, 1, d("2026-01-31T10:00:00Z")).toISOString(), "2026-02-28T10:00:00.000Z"); // fim de mês
});

const AGORA = d("2026-10-05T00:00:00Z");
const compra = (p: Partial<{ status: string; acesso_ate: string | null; tipo: "curso" | "completo"; curso_id: string | null }>) => ({
  status: "paga", acesso_ate: "2027-01-01T00:00:00Z", tipo: "curso" as const, curso_id: "c1", ...p,
});

test("acessoVigente: só pagas e dentro da validade; maior validade vence", () => {
  const v = acessoVigente([
    compra({}),
    compra({ acesso_ate: "2027-06-01T00:00:00Z" }),
    compra({ curso_id: "c2", status: "pendente" }),
    compra({ curso_id: "c3", status: "reembolsada" }),
    compra({ curso_id: "c4", acesso_ate: "2026-01-01T00:00:00Z" }),
    compra({ tipo: "completo", curso_id: null, acesso_ate: "2026-12-01T00:00:00Z" }),
  ], AGORA);
  assert.equal(v.cursos.get("c1")!.toISOString(), "2027-06-01T00:00:00.000Z");
  assert.equal(v.cursos.has("c2"), false);
  assert.equal(v.cursos.has("c3"), false);
  assert.equal(v.cursos.has("c4"), false);
  assert.equal(v.completoAte!.toISOString(), "2026-12-01T00:00:00.000Z");
  assert.deepEqual(acessoVigente([], AGORA), { completoAte: null, cursos: new Map() });
});

test("podeVerCursoComprado e podeTreinar", () => {
  const soCurso = { completoAte: null, cursos: new Map([["c1", d("2027-01-01")]]) };
  const pacote = { completoAte: d("2027-01-01"), cursos: new Map() };
  const aVenda = new Set(["c1", "c9"]);
  assert.equal(podeVerCursoComprado("c1", soCurso, aVenda), true);
  assert.equal(podeVerCursoComprado("c9", soCurso, aVenda), false);
  assert.equal(podeVerCursoComprado("c9", pacote, aVenda), true);
  assert.equal(podeVerCursoComprado("c7", pacote, aVenda), false); // fora da venda: pacote não cobre
  assert.equal(podeTreinar(soCurso), false);
  assert.equal(podeTreinar(pacote), true);
});

test("formatarPreco", () => {
  assert.equal(formatarPreco(9700), "R$ 97,00");
  assert.equal(formatarPreco(123456), "R$ 1.234,56");
});

test("estadoDaCompra", () => {
  assert.equal(estadoDaCompra({ type: "checkout.session.completed", payment_status: "paid" }), "paga");
  assert.equal(estadoDaCompra({ type: "checkout.session.completed", payment_status: "unpaid" }), null);
  assert.equal(estadoDaCompra({ type: "checkout.session.async_payment_succeeded" }), "paga");
  assert.equal(estadoDaCompra({ type: "checkout.session.async_payment_failed" }), "expirada");
  assert.equal(estadoDaCompra({ type: "checkout.session.expired" }), "expirada");
  assert.equal(estadoDaCompra({ type: "charge.refunded", refunded: true }), "reembolsada");
  assert.equal(estadoDaCompra({ type: "charge.refunded", refunded: false }), null); // parcial
  assert.equal(estadoDaCompra({ type: "charge.dispute.created" }), "reembolsada");
  assert.equal(estadoDaCompra({ type: "invoice.paid" }), null);
});
```

- [ ] **Step 5:** `npx tsx --test src/lib/loja/loja.test.ts` → FAIL.

- [ ] **Step 6: Implementar**

```ts
// src/lib/loja/regras.ts
export type Vigencia = { completoAte: Date | null; cursos: Map<string, Date> };
export type CompraParaVigencia = { status: string; acesso_ate: string | null; tipo: "curso" | "completo"; curso_id: string | null };
export type EventoLoja = { type: string; payment_status?: string; refunded?: boolean };

export function novaValidade(validadeAtual: Date | null, meses: number, agora: Date): Date {
  const base = validadeAtual && validadeAtual > agora ? validadeAtual : agora;
  const r = new Date(base);
  const dia = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(dia, ultimo));
  return r;
}

export function acessoVigente(compras: CompraParaVigencia[], agora: Date): Vigencia {
  const v: Vigencia = { completoAte: null, cursos: new Map() };
  for (const c of compras) {
    if (c.status !== "paga" || !c.acesso_ate) continue;
    const ate = new Date(c.acesso_ate);
    if (ate <= agora) continue;
    if (c.tipo === "completo") {
      if (!v.completoAte || ate > v.completoAte) v.completoAte = ate;
    } else if (c.curso_id) {
      const atual = v.cursos.get(c.curso_id);
      if (!atual || ate > atual) v.cursos.set(c.curso_id, ate);
    }
  }
  return v;
}

/** `cursosAVenda`: cursos com produto ativo — o pacote cobre só esses. */
export function podeVerCursoComprado(cursoId: string, v: Vigencia, cursosAVenda: Set<string>): boolean {
  return v.cursos.has(cursoId) || (!!v.completoAte && cursosAVenda.has(cursoId));
}

export function podeTreinar(v: Vigencia): boolean {
  return !!v.completoAte;
}

export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
}

export function estadoDaCompra(e: EventoLoja): "paga" | "expirada" | "reembolsada" | null {
  switch (e.type) {
    case "checkout.session.completed": return e.payment_status === "paid" ? "paga" : null;
    case "checkout.session.async_payment_succeeded": return "paga";
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": return "expirada";
    case "charge.refunded": return e.refunded ? "reembolsada" : null;
    case "charge.dispute.created": return "reembolsada";
    default: return null;
  }
}
```

- [ ] **Step 7:** Testes passam; acrescente `src/lib/loja/loja.test.ts` ao script `test`; `npx tsc --noEmit && npm test` → OK.
- [ ] **Step 8:** Commit — `git add db/schema.sql src/lib package.json && git commit -m "Loja: SQL, tipos, endereco e regras"`

---

### Task 2: Servidor da loja e acesso comprado

**Files:** Modify `package.json` (dependência), `src/lib/aulas/acesso.ts`, `src/actions/simulados-aluno.ts`; Create `src/lib/loja/servidor.ts`

**Interfaces — Consumes:** Task 1. **Produces** (`servidor.ts`, sem `"use server"`):
- `stripeDisponivel(): boolean` (`!!process.env.STRIPE_SECRET_KEY`)
- `clienteStripe(): Stripe` (lança "Configure STRIPE_SECRET_KEY na Vercel." sem chave; instância única)
- `ehAlunoDaLoja(aluno: { escola_id: string }): boolean`
- `cursosAVenda(): Promise<Set<string>>` (curso_id de produtos `tipo='curso'` e `ativo`)
- `vigenciaDaConta(contaId: string): Promise<Vigencia>` (compras da conta com o tipo/curso do produto)
- `produtosAtivos(): Promise<ProdutoLoja[]>` (completo primeiro, depois por título)

- [ ] **Step 1:** `npm install stripe` (versão atual). Leia `node_modules/stripe/types` para o construtor e `checkout.sessions.create`.

- [ ] **Step 2: `src/lib/loja/servidor.ts`**

```ts
import Stripe from "stripe";
import { supabase } from "@/lib/supabase/client";
import { ESCOLA_LOJA_ID } from "@/lib/escolas";
import type { ProdutoLoja } from "@/lib/types";
import { acessoVigente, type Vigencia } from "./regras";

let cliente: Stripe | null = null;

export function stripeDisponivel(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function clienteStripe(): Stripe {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) throw new Error("Configure STRIPE_SECRET_KEY na Vercel.");
  cliente ??= new Stripe(chave);
  return cliente;
}

export function ehAlunoDaLoja(aluno: { escola_id: string }): boolean {
  return aluno.escola_id === ESCOLA_LOJA_ID;
}

export async function cursosAVenda(): Promise<Set<string>> {
  const { data, error } = await supabase.from("produtos_loja").select("curso_id").eq("tipo", "curso").eq("ativo", true);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((p) => p.curso_id).filter((id): id is string => !!id));
}

export async function vigenciaDaConta(contaId: string): Promise<Vigencia> {
  const { data: compras, error } = await supabase.from("compras").select("status, acesso_ate, produto_id").eq("conta_id", contaId).eq("status", "paga");
  if (error) throw new Error(error.message);
  const ids = [...new Set((compras ?? []).map((c) => c.produto_id))];
  if (ids.length === 0) return { completoAte: null, cursos: new Map() };
  const { data: produtos, error: e2 } = await supabase.from("produtos_loja").select("id, tipo, curso_id").in("id", ids);
  if (e2) throw new Error(e2.message);
  const porId = new Map((produtos ?? []).map((p) => [p.id, p]));
  return acessoVigente(
    (compras ?? []).flatMap((c) => {
      const p = porId.get(c.produto_id);
      return p ? [{ status: c.status, acesso_ate: c.acesso_ate, tipo: p.tipo, curso_id: p.curso_id }] : [];
    }),
    new Date(),
  );
}

export async function produtosAtivos(): Promise<ProdutoLoja[]> {
  const { data, error } = await supabase.from("produtos_loja").select("*").eq("ativo", true).order("titulo");
  if (error) throw new Error(error.message);
  return [...(data ?? [])].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "completo" ? -1 : 1));
}
```

- [ ] **Step 3: Cursos comprados** — em `src/lib/aulas/acesso.ts`, para aluno da loja (`ehAlunoDaLoja(aluno)`):
  - `cursosDoAluno(aluno)`: ids = cursos com `podeVerCursoComprado(id, vigência, aVenda)` — isto é, cursos avulsos vigentes ∪ (se pacote vigente) todos de `cursosAVenda()`; busque `cursos` por esses ids **sem** o filtro `escola_id` (os cursos são de escolas vendedoras); ordem por título.
  - `cursoVisivelParaAluno(aluno, cursoId)`: `podeVerCursoComprado(cursoId, await vigenciaDaConta(aluno.id), await cursosAVenda())` → busca o curso sem filtro de escola; senão `null`.
  - Alunos de escola: código atual intocado (ramifique no início de cada função).
  - `obterAulaParaAluno` já usa `cursoVisivelParaAluno` — não muda. Confirme com `grep -rn "cursoVisivelParaAluno\|cursosDoAluno" src` que todas as telas e ações de aula/PDF/progresso do aluno passam por essas duas funções; se alguma consulta `curso_turmas` direto para aluno, faça-a usar `cursoVisivelParaAluno`.
- [ ] **Step 4: Treinos** — em `src/actions/simulados-aluno.ts` `criarTreino`: logo após `exigirAluno()`, `if (ehAlunoDaLoja(aluno) && !podeTreinar(await vigenciaDaConta(aluno.id))) throw new Error("Os treinos fazem parte do pacote completo. Veja em /loja.");`. (`iniciarTentativa`, `responder` etc. seguem pelos treinos já criados — se o acesso vencer no meio, o treino em andamento pode ser terminado.)
- [ ] **Step 5:** `npx tsc --noEmit && npx eslint src/lib src/actions/simulados-aluno.ts && npm test && npm run build` → OK.
- [ ] **Step 6:** Commit — `git add package.json package-lock.json src && git commit -m "Loja: servidor, cursos comprados e treinos do pacote"`

---

### Task 3: Webhook e aplicação de eventos

**Files:** Modify `src/lib/loja/servidor.ts`, `src/lib/rotas.ts` (+ `src/lib/rotas.test.ts`); Create `src/app/api/stripe/webhook/route.ts`

**Interfaces — Produces:** `aplicarEvento(evento: Stripe.Event): Promise<void>` (em `servidor.ts`).

- [ ] **Step 1: `aplicarEvento`** — acrescente a `servidor.ts`:

```ts
import { estadoDaCompra, novaValidade } from "./regras";

/** Aplica um evento do Stripe às compras. Idempotente: cada transição é condicional ao estado atual. */
export async function aplicarEvento(evento: Stripe.Event): Promise<void> {
  const obj = evento.data.object as unknown as Record<string, unknown>;
  const estado = estadoDaCompra({
    type: evento.type,
    payment_status: typeof obj.payment_status === "string" ? obj.payment_status : undefined,
    refunded: typeof obj.refunded === "boolean" ? obj.refunded : undefined,
  });
  if (!estado) return;

  if (estado === "reembolsada") {
    const intent = typeof obj.payment_intent === "string" ? obj.payment_intent : null;
    if (!intent) return;
    const { error } = await supabase.from("compras").update({ status: "reembolsada", acesso_ate: new Date().toISOString() }).eq("stripe_payment_intent", intent).eq("status", "paga");
    if (error) throw new Error(error.message);
    return;
  }

  const sessionId = typeof obj.id === "string" ? obj.id : null;
  if (!sessionId) return;
  if (estado === "expirada") {
    const { error } = await supabase.from("compras").update({ status: "expirada" }).eq("stripe_session_id", sessionId).eq("status", "pendente");
    if (error) throw new Error(error.message);
    return;
  }

  // paga: toma a compra pendente; só um chamador consegue.
  const agora = new Date();
  const intent = typeof obj.payment_intent === "string" ? obj.payment_intent : null;
  const { data: tomadas, error } = await supabase.from("compras")
    .update({ status: "paga", paga_em: agora.toISOString(), stripe_payment_intent: intent })
    .eq("stripe_session_id", sessionId).eq("status", "pendente").select("id, conta_id, produto_id, meses");
  if (error) throw new Error(error.message);
  const c = tomadas?.[0];
  if (!c) return;
  const { data: anteriores, error: e2 } = await supabase.from("compras").select("acesso_ate").eq("conta_id", c.conta_id).eq("produto_id", c.produto_id).eq("status", "paga").neq("id", c.id);
  if (e2) throw new Error(e2.message);
  const vigente = (anteriores ?? []).map((a) => (a.acesso_ate ? new Date(a.acesso_ate) : null)).filter((x): x is Date => !!x && x > agora).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const { error: e3 } = await supabase.from("compras").update({ acesso_ate: novaValidade(vigente, c.meses, agora).toISOString() }).eq("id", c.id);
  if (e3) throw new Error(e3.message);
}
```

(Uma compra `paga` sem `acesso_ate` — falha entre os dois updates — não dá acesso; o Stripe reenvia em caso de 500, mas a transição já foi tomada. Por isso, se `e3` falhar, lance erro **e** registre `console.error` com o id; a Task 6 mostra no painel compras pagas sem validade com um botão "Recalcular validade".)

- [ ] **Step 2: Rota** — `src/app/api/stripe/webhook/route.ts`:

```ts
import type Stripe from "stripe";
import { aplicarEvento, clienteStripe } from "@/lib/loja/servidor";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  const assinatura = req.headers.get("stripe-signature");
  if (!segredo || !assinatura) return new Response("Assinatura ausente.", { status: 400 });
  const corpo = await req.text();
  let evento: Stripe.Event;
  try {
    evento = clienteStripe().webhooks.constructEvent(corpo, assinatura, segredo);
  } catch {
    return new Response("Assinatura inválida.", { status: 400 });
  }
  try {
    await aplicarEvento(evento);
  } catch (e) {
    console.error("stripe webhook", evento.id, e);
    return new Response("Erro ao processar.", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}
```

- [ ] **Step 3: Rotas públicas** — em `src/lib/rotas.ts`, acrescente `"/loja"` e `"/api/stripe/webhook"` a `PREFIXOS_PUBLICOS`. Em `src/lib/rotas.test.ts`, teste: `destinoDaRota("/loja", null) === "seguir"`, `destinoDaRota("/loja/abc", null) === "seguir"`, `destinoDaRota("/api/stripe/webhook", null) === "seguir"`; e que um aluno logado em `/loja` segue (`destinoDaRota("/loja", { tipo: "a", id: "x" }) === "seguir"` — rota pública vale para todos).
- [ ] **Step 4:** `npx tsc --noEmit && npx eslint src && npm test && npm run build` → OK.
- [ ] **Step 5:** Commit — `git add src && git commit -m "Loja: webhook do Stripe com assinatura e eventos idempotentes"`

---

### Task 4: Telas públicas da loja, cadastro e compra

**Files:** Create `src/actions/loja.ts`, `src/app/loja/page.tsx`, `src/app/loja/[produtoId]/page.tsx`, `src/app/loja/conta/page.tsx`, `src/app/loja/obrigado/page.tsx`, `src/components/loja/ComprarBotao.tsx`, `src/components/loja/AcompanharCompra.tsx`; Modify `src/actions/auth.ts` (login: `loja` exige e-mail verificado como `convite`)

**Interfaces — Consumes:** Tasks 1–3. **Produces** (`src/actions/loja.ts`, `"use server"`):
- `cadastrarNaLoja(formData: FormData): Promise<void>` — campos `nome`, `email`, `senha`, `confirmarSenha`, `produto` (opcional); cria `alunos_contas` (`escola_id = ESCOLA_LOJA_ID`, `criado_via = 'loja'`, `email_verificado = false`, token de verificação 24 h) e envia e-mail com `linkDaEscola(escolaLoja, "/verificar-email?token=…")`; reaproveita apenas conta `loja` não verificada com o mesmo e-mail; e-mail de professor ou de outra conta → `erro=duplicado`. Redireciona para `/loja/conta?enviado=1&produto=…`.
- `iniciarCompra(produtoId: string): Promise<void>` — `getAlunoAtual()`; sem aluno → `redirect("/loja/conta?produto=<id>")`; aluno que não é da loja → erro "A loja é para alunos sem escola. Fale com a sua escola."; produto ativo do banco (senão "Produto indisponível."); `stripeDisponivel()` senão "Vendas em breve."; cria a sessão (Global Constraints + spec §4; `customer_email` = e-mail da conta; `metadata.compra_id/conta_id/produto_id`; `success_url = linkDaEscola(loja, "/loja/obrigado?session={CHECKOUT_SESSION_ID}")`, `cancel_url = linkDaEscola(loja, "/loja/<produtoId>")`; `client_reference_id = conta.id`); insere `compras` (`pendente`, `valor_centavos`, `meses` copiados, `stripe_session_id`); `redirect(session.url)`.
- `situacaoCompra(sessionId: string): Promise<"paga" | "pendente" | "expirada" | "reembolsada" | null>` — só compra **da conta logada** com essa sessão; senão `null`.

- [ ] **Step 1: Actions** — implemente conforme acima (copie a validação e o envio de e-mail de `cadastrarAlunoComCodigo` em `src/actions/contas-aluno.ts`; checkout com `clienteStripe().checkout.sessions.create({ mode: "payment", currency: "brl", payment_method_types: ["card", "pix"], payment_method_options: { card: { installments: { enabled: true } }, pix: { expires_after_seconds: 3600 } }, line_items: [{ quantity: 1, price_data: { currency: "brl", unit_amount: produto.preco_centavos, product_data: { name: produto.titulo } } }], ... })` — confira os nomes nos tipos do pacote).
- [ ] **Step 2: Login** — em `src/actions/auth.ts`, a regra "conta por código entra com e-mail confirmado" vale também para `criado_via === "loja"`.
- [ ] **Step 3: Telas** (server components, marca sempre Status Avalia: use `marcaDaEscola(await obterEscola(ESCOLA_LOJA_ID))` e o mesmo `AuthShell`/estrutura visual da área pública; `export const dynamic = "force-dynamic"`):
  - `/loja`: título "Estude no seu ritmo"; cartão do **pacote completo** em destaque (título, descrição, "Todos os cursos + treinos ilimitados com questões do ENEM", preço `formatarPreco`, "acesso por N meses", botão Ver); grade dos **cursos à venda** (título do produto, descrição, nº de módulos e aulas publicadas do curso, preço, meses). Sem chave do Stripe: faixa "Vendas em breve". Sem produtos: "Em breve, novos cursos."
  - `/loja/[produtoId]`: detalhes; para curso, lista dos módulos e títulos das aulas publicadas (sem links); `ComprarBotao` (form que chama `iniciarCompra`; desativado sem Stripe; para aluno logado com acesso vigente ao produto: "Você tem acesso até dd/mm/aaaa · Renovar"). Produto inativo/inexistente → `notFound()`.
  - `/loja/conta`: duas colunas — "Criar conta" (form `cadastrarNaLoja`) e "Já tenho conta" (link para `/login`). Mensagens de erro como nas telas de cadastro existentes; `enviado=1` → "Enviamos um link para o seu e-mail. Depois de confirmar, entre e volte para concluir a compra."
  - `/loja/obrigado?session=…`: exige aluno logado (senão link para login); `AcompanharCompra` (cliente) chama `situacaoCompra` a cada 3 s por até 2 min: `paga` → "Acesso liberado!" + botões "Ir para os cursos" (`/aluno/cursos`) e, se pacote, "Criar um treino" (`/aluno/simulados`); `pendente` → "Liberando seu acesso… Se pagou com Pix, assim que o pagamento for confirmado o acesso aparece aqui."; `expirada` → "O Pix expirou." + voltar à loja; `null` → "Não encontramos essa compra na sua conta."
- [ ] **Step 4:** `npx tsc --noEmit && npm run lint && npm test && npm run build` → OK.
- [ ] **Step 5:** Commit — `git add src && git commit -m "Loja: vitrine, conta, compra e retorno do Stripe"`

---

### Task 5: Área do aluno da loja

**Files:** Modify `src/app/aluno/page.tsx`, `src/app/aluno/simulados/page.tsx`, `src/app/aluno/cursos/page.tsx` (se precisar de texto vazio específico)

- [ ] **Step 1: `/aluno`** — para aluno da loja: esconda o que é de turma (ex.: "entrar com código de turma"); mostre o cartão **Minhas compras**: cada compra `paga` (produto, "acesso até dd/mm/aaaa" ou "venceu em dd/mm/aaaa", link "Renovar" → `/loja/<produto>`), e link "Ver a loja". Aluno de escola: sem mudança.
- [ ] **Step 2: `/aluno/simulados`** — para aluno da loja: só a aba "Meus treinos"; com `podeTreinar`, `NovoTreino` como hoje; sem pacote vigente, no lugar do formulário: "Os treinos fazem parte do pacote completo." + botão para `/loja`. Simulados "da turma" não aparecem.
- [ ] **Step 3: `/aluno/cursos`** — lista vazia para aluno da loja: "Você ainda não tem cursos. Veja a loja." com link.
- [ ] **Step 4:** `npx tsc --noEmit && npm run lint && npm test && npm run build` → OK.
- [ ] **Step 5:** Commit — `git add src && git commit -m "Loja: area do aluno com compras e treinos do pacote"`

---

### Task 6: Painel do dono — produtos e vendas

**Files:** Create `src/actions/dono-loja.ts`, `src/app/dono/loja/page.tsx`, `src/components/dono/FormProduto.tsx`; Modify `src/app/dono/page.tsx` (link "Loja"), `src/actions/dono.ts` (escola da plataforma: não desativar e não editar endereço)

**Interfaces — Produces** (`src/actions/dono-loja.ts`, `"use server"`, toda função começa com o mesmo `exigirDono()` de `dono.ts` — extraia-o para `src/lib/dono.ts` sem `"use server"` e use nos dois):
- `type DadosProduto = { titulo: string; descricao: string; precoReais: string; meses: number; ativo: boolean }`
- `salvarPacote(d: DadosProduto): Promise<void>` (cria ou atualiza o único `completo`)
- `salvarProdutoCurso(cursoId: string, d: DadosProduto): Promise<void>` (cria ou atualiza o produto do curso; curso precisa existir)
- `definirProdutoAtivo(produtoId: string, ativo: boolean): Promise<void>`
- `listarVendas(pagina: number): Promise<{ itens: { id: string; aluno: string; email: string | null; produto: string; valor_centavos: number; status: StatusCompra; paga_em: string | null; acesso_ate: string | null }[]; totalMes: number; temMais: boolean }>` (compras `paga`/`reembolsada`, 50 por página, mais recentes; `totalMes` = soma das `paga` com `paga_em` no mês corrente, fuso America/Sao_Paulo)
- `recalcularValidade(compraId: string): Promise<void>` (compra `paga` sem `acesso_ate` → calcula como no webhook)

**Validação:** título 1–120; descrição até 600; preço `"97"`, `"97,90"` ou `"97.90"` → centavos inteiros entre 100 e 10.000.000; meses inteiro 1–36.

- [ ] **Step 1:** `src/lib/dono.ts` com `exigirDono()`; `dono.ts` passa a importá-lo. Em `dono.ts`: `definirEscolaAtiva` também recusa `ESCOLA_LOJA_ID` ("A escola da plataforma não pode ser desativada.").
- [ ] **Step 2:** Actions conforme acima.
- [ ] **Step 3: `/dono/loja`** (servidor; não-dono → `notFound()`): seção **Pacote completo** (`FormProduto`); seção **Cursos à venda** — tabela dos produtos de curso (curso, escola do curso, preço, meses, ativo, editar/ativar) e "Adicionar curso" (select com cursos de todas as escolas: "Título — Escola"); seção **Vendas** (tabela de `listarVendas`, total do mês, paginação, aviso destacado para compras pagas sem validade com botão "Recalcular validade"); link "Abrir o painel do Stripe" (`https://dashboard.stripe.com`). Sem `STRIPE_SECRET_KEY`: aviso "Configure STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET na Vercel para vender."
- [ ] **Step 4:** Em `/dono`, link "Loja" para `/dono/loja`; na lista de escolas, a da plataforma aparece com o selo "Plataforma" e sem botão de desativar.
- [ ] **Step 5:** `npx tsc --noEmit && npm run lint && npm test && npm run build` → OK.
- [ ] **Step 6:** Commit — `git add src && git commit -m "Loja: painel do dono com produtos e vendas"`

---

### Task 7: Documentação e verificação

- [ ] **Step 1:** Acrescente ao fim de `DESIGN.md`:

```markdown
## Loja
`/loja` (marca Status Avalia): vitrine com pacote completo em destaque e cursos à venda; `/loja/[produto]`, `/loja/conta`, `/loja/obrigado` (acompanha a liberação). Pagamento no Stripe Checkout (Pix e cartão até 12x); acesso liberado só pelo webhook `/api/stripe/webhook`. Alunos da loja pertencem à escola da plataforma e veem a área do aluno com "Minhas compras". Dono: `/dono/loja` (produtos e vendas).
```

- [ ] **Step 2:** `npm test && npm run lint && npm run build` → OK.
- [ ] **Step 3: Roteiro manual (Peter, modo de teste)** — colar o SQL; criar conta no Stripe (modo de teste); na Vercel, `STRIPE_SECRET_KEY` (chave secreta de teste) e, depois de criar o webhook no painel do Stripe apontando para `https://www.statusavalia.com.br/api/stripe/webhook` com os eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, a `STRIPE_WEBHOOK_SECRET`; Redeploy. Em `/dono/loja`, criar o pacote e pôr um curso à venda. Em outra janela anônima: `/loja` → criar conta → confirmar e-mail → comprar o curso com cartão `4242 4242 4242 4242` → ver o curso em `/aluno/cursos`; comprar o pacote com Pix de teste → criar treino; reembolsar no Stripe → acesso some; reenviar um evento pelo painel do Stripe → nada duplica.
- [ ] **Step 4:** Commit — `git add DESIGN.md && git commit -m "DESIGN: loja"`
