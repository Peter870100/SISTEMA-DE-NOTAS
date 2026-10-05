# Antes da 2ª escola — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Várias escolas na mesma plataforma, com dados separados, endereço por subdomínio, visual próprio e um painel do dono para criar e administrar escolas.

**Architecture:** Funções puras testadas para endereço→escola, subdomínio, cores/contraste e decisões de acesso. Verificações centrais de escola em `src/lib/escola-acesso.ts` usadas por todas as actions e páginas antigas; a escola de acesso é sempre a da conta logada. A escola do endereço (lida do `host`) só define marca e onde o login é aceito. Painel `/dono` com actions próprias.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions, params Promise), React 19, Supabase (cliente server-side com chave anon), Tailwind 4, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-04-multiescola-design.md`

## Global Constraints

- Leia `node_modules/next/dist/docs/` antes de usar API do Next (params/searchParams/headers são assíncronos).
- `ESCOLA_PADRAO_ID = "00000000-0000-0000-0000-000000000001"` (Colégio Status, slug `status`) — já existe em `src/lib/escolas.ts`.
- Domínio base: `statusavalia.com.br`. `www.`, apex e `status.` → Status; `*.vercel.app`, `localhost`, `127.0.0.1` → Status.
- Escola de **acesso** = escola da conta logada; nunca a do endereço.
- Sem login, nenhuma action de dados funciona (acaba o modelo "anônimo passa").
- Todo insert em `turmas`, `professores`, `alunos_contas` grava `escola_id` explicitamente.
- O dono não lê turmas, notas, alunos, contas nem professores de nenhuma escola pelo painel (só contagens).
- Subdomínio: `^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$`, único, fora de `www, api, app, admin, dono, mail, smtp, ftp, status, suporte, ajuda, login, static, cdn`; imutável.
- Logo/foto: PNG, JPG ou WebP, até 2 MB, bucket público `marcas`, caminho começando por `<escola_id>/`.
- O Status não pode ser desativado; com cores nulas, o tema atual fica intacto (nenhuma variável CSS sobrescrita).
- Hermes (`src/lib/mcp-tools.ts`) só enxerga e grava dados do Status.
- Ações de professor/aluno: funções que recebem ids sem checar acesso nunca ficam em arquivo `"use server"`. Chave anon só no servidor.
- Textos em português do Brasil.

## Review Focus

1. **Professor da Escola X chama uma action com o id de uma turma/aluno/coluna/item de lixeira do Status** (pelo navegador, sem a tela): recusado. Pinado nos testes de `podeAcessarTurma` (Task 3) e na revisão de cada action das Tasks 4–5.
2. **Requisição sem login chamando uma action de dados** (ex.: POST para `/login` com o id de `upsertCelula`): recusada. Pinado em `exigirProfessorLogado` (Task 3) e no item "sem login" das Tasks 4–5.
3. **Duas escolas com turma de mesmo nome ("1ª série A")**: listas, paleta de comandos, acesso restrito, exportação e busca nunca misturam. Pinado nas Tasks 4–5 (filtro por `escola_id` em toda leitura de `turmas`).
4. **Conta de outra escola entrando no endereço errado / escola desativada**: não cria sessão, mostra a mensagem certa; quem já estava logado numa escola desativada perde a sessão na próxima página. Pinado em `destinoDoLogin` (Task 1) e Task 7.
5. **Escola sem logo ou sem cores** (recém-criada): telas funcionam com o nome em texto e o tema padrão; cor principal clara demais é recusada. Pinado em `variaveisDaMarca`/`validarCores` (Task 2) e Task 8.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `db/schema.sql` (mod.), `src/lib/types.ts` (mod.) | SQL e tipos (`Escola.ativa`, `ItemLixeira.escola_id`) |
| `src/lib/dominio.ts` + `src/lib/dominio.test.ts` | Endereço→slug, URL da escola, validação de subdomínio, decisão do login |
| `src/lib/marca.ts` (mod.) + `src/lib/marca.test.ts` | Cores derivadas, contraste, validação de cores, tipo `MarcaEscola` |
| `src/lib/escola-regras.ts` + `src/lib/escola-regras.test.ts` | Decisões puras de acesso |
| `src/lib/escolas.ts` (mod.) | Escola por id/slug, escola do endereço, link da escola |
| `src/lib/escola-acesso.ts` | Verificações centrais (servidor, sem `"use server"`) |
| `src/lib/auth.ts` (mod.) | Sessão recusada se a escola estiver desativada; `exigirAcessoATurmaId` endurecido |
| actions/páginas antigas (mod.) | Filtro por escola (Tasks 4–5) |
| `src/lib/mcp-tools.ts` (mod.) | Hermes só no Status |
| `src/actions/auth.ts`, `cadastro.ts`, `contas-aluno.ts`, `src/app/login/page.tsx` (mod.) | Login/cadastro/e-mails por endereço |
| `src/app/layout.tsx`, `LoginShell.tsx`, `AuthShell.tsx`, `EscolaContexto.tsx`, `next.config.ts` (mod.) | Visual por escola |
| `src/actions/dono.ts`, `src/app/dono/**`, `src/components/dono/**` | Painel do dono |

---

### Task 1: SQL, tipos e regras de endereço

**Files:** Modify `db/schema.sql` (fim), `src/lib/types.ts`, `package.json`; Create `src/lib/dominio.ts`, `src/lib/dominio.test.ts`

**Interfaces — Produces:**
- `DOMINIO_BASE = "statusavalia.com.br"`, `SLUG_PADRAO = "status"`, `SUBDOMINIOS_RESERVADOS: readonly string[]`
- `escolaDoHost(host: string | null | undefined): string | null`
- `urlDaEscola(slug: string, caminho: string): string`
- `validarSubdominio(s: string): string | null` (mensagem de erro ou null)
- `destinoDoLogin(slugDaConta: string, slugDoEndereco: string | null): { ok: true } | { ok: false; slug: string }`
- `Escola.ativa: boolean`; `ItemLixeira.escola_id: string`

- [ ] **Step 1: SQL** — acrescente ao fim de `db/schema.sql` (não rode; já entregue ao Peter, que cola no SQL Editor):

```sql
-- ===== Multiescola (2026-10-04) =====

alter table lixeira add column if not exists escola_id uuid not null
    default '00000000-0000-0000-0000-000000000001' references escolas(id);
create index if not exists idx_lixeira_escola on lixeira (escola_id, excluido_em desc);

-- lixeira_excluir() não conhece a escola: o gatilho pega a da turma (ainda existe no momento do insert)
create or replace function lixeira_definir_escola()
returns trigger language plpgsql as $$
begin
  new.escola_id := coalesce((select escola_id from turmas where id = new.turma_id), new.escola_id);
  return new;
end;
$$;
drop trigger if exists trg_lixeira_escola on lixeira;
create trigger trg_lixeira_escola before insert on lixeira
for each row execute function lixeira_definir_escola();

alter table escolas add column if not exists ativa boolean not null default true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marcas', 'marcas', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "marcas_ler" on storage.objects;
create policy "marcas_ler" on storage.objects for select using (bucket_id = 'marcas');
drop policy if exists "marcas_enviar" on storage.objects;
create policy "marcas_enviar" on storage.objects for insert with check (bucket_id = 'marcas');
drop policy if exists "marcas_apagar" on storage.objects;
create policy "marcas_apagar" on storage.objects for delete using (bucket_id = 'marcas');
```

- [ ] **Step 2: Tipos** — em `src/lib/types.ts`: `Escola` ganha `ativa: boolean;` (depois de `codigo_convite_professor`); o tipo da linha da lixeira (procure `lixeira` em `types.ts`, tipo `ItemLixeira`) ganha `escola_id: string;`. Ajuste `Insert` da lixeira/escolas no `Database` se exigirem os campos (devem ficar opcionais no Insert).

- [ ] **Step 3: Testes**

```ts
// src/lib/dominio.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { destinoDoLogin, escolaDoHost, urlDaEscola, validarSubdominio } from "./dominio";

test("escolaDoHost: Status nos endereços dele, testes e previews", () => {
  for (const h of ["www.statusavalia.com.br", "statusavalia.com.br", "status.statusavalia.com.br", "WWW.StatusAvalia.com.br:443", "sistema-de-notas.vercel.app", "localhost:3000", "127.0.0.1", "statusavalia.com.br."]) {
    assert.equal(escolaDoHost(h), "status", h);
  }
  assert.equal(escolaDoHost(null), "status");
});

test("escolaDoHost: subdomínio vira slug; o resto é desconhecido", () => {
  assert.equal(escolaDoHost("colegiox.statusavalia.com.br"), "colegiox");
  assert.equal(escolaDoHost("Colegio-X.statusavalia.com.br"), "colegio-x");
  assert.equal(escolaDoHost("a.b.statusavalia.com.br"), null);
  assert.equal(escolaDoHost("statusavalia.com.br.evil.com"), null);
  assert.equal(escolaDoHost("outrosite.com"), null);
});

test("urlDaEscola", () => {
  assert.equal(urlDaEscola("status", "/login"), "https://www.statusavalia.com.br/login");
  assert.equal(urlDaEscola("colegiox", "redefinir-senha?token=1"), "https://colegiox.statusavalia.com.br/redefinir-senha?token=1");
});

test("validarSubdominio", () => {
  assert.equal(validarSubdominio("colegiox"), null);
  assert.equal(validarSubdominio("colegio-x2"), null);
  assert.notEqual(validarSubdominio("ab"), null);
  assert.notEqual(validarSubdominio("-colegio"), null);
  assert.notEqual(validarSubdominio("colegio-"), null);
  assert.notEqual(validarSubdominio("Colegio"), null);
  assert.notEqual(validarSubdominio("colégio"), null);
  assert.notEqual(validarSubdominio("a".repeat(31)), null);
  assert.notEqual(validarSubdominio("www"), null);
  assert.notEqual(validarSubdominio("status"), null);
});

test("destinoDoLogin", () => {
  assert.deepEqual(destinoDoLogin("status", "status"), { ok: true });
  assert.deepEqual(destinoDoLogin("colegiox", "status"), { ok: false, slug: "colegiox" });
  assert.deepEqual(destinoDoLogin("status", "colegiox"), { ok: false, slug: "status" });
  assert.deepEqual(destinoDoLogin("status", null), { ok: false, slug: "status" });
});
```

- [ ] **Step 4:** `npx tsx --test src/lib/dominio.test.ts` → FAIL.

- [ ] **Step 5: Implementar**

```ts
// src/lib/dominio.ts
export const DOMINIO_BASE = "statusavalia.com.br";
export const SLUG_PADRAO = "status";
export const SUBDOMINIOS_RESERVADOS = ["www", "api", "app", "admin", "dono", "mail", "smtp", "ftp", "status", "suporte", "ajuda", "login", "static", "cdn"] as const;

const FORMATO_SUBDOMINIO = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/** Slug da escola pelo endereço; null se o endereço não é de nenhuma escola. */
export function escolaDoHost(host: string | null | undefined): string | null {
  if (!host) return SLUG_PADRAO;
  const h = host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (h === DOMINIO_BASE || h === `www.${DOMINIO_BASE}`) return SLUG_PADRAO;
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".vercel.app")) return SLUG_PADRAO;
  if (!h.endsWith(`.${DOMINIO_BASE}`)) return null;
  const sub = h.slice(0, -(DOMINIO_BASE.length + 1));
  return /^[a-z0-9-]+$/.test(sub) ? sub : null;
}

export function urlDaEscola(slug: string, caminho: string): string {
  const host = slug === SLUG_PADRAO ? `www.${DOMINIO_BASE}` : `${slug}.${DOMINIO_BASE}`;
  return `https://${host}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}

export function validarSubdominio(s: string): string | null {
  if (!FORMATO_SUBDOMINIO.test(s)) return "Use de 3 a 30 letras minúsculas, números ou hífen (sem hífen no começo ou no fim).";
  if ((SUBDOMINIOS_RESERVADOS as readonly string[]).includes(s)) return "Esse endereço é reservado. Escolha outro.";
  return null;
}

/** O login só vale no endereço da escola da conta. */
export function destinoDoLogin(slugDaConta: string, slugDoEndereco: string | null): { ok: true } | { ok: false; slug: string } {
  return slugDoEndereco === slugDaConta ? { ok: true } : { ok: false, slug: slugDaConta };
}
```

- [ ] **Step 6:** Testes passam; acrescente `src/lib/dominio.test.ts` ao script `test` do `package.json`; `npx tsc --noEmit && npm test` → OK.
- [ ] **Step 7:** Commit — `git add db/schema.sql src/lib/types.ts src/lib/dominio.ts src/lib/dominio.test.ts package.json && git commit -m "Multiescola: SQL, tipos e regras de endereco"`

---

### Task 2: Cores da marca e contraste

**Files:** Modify `src/lib/marca.ts`, `package.json`; Create `src/lib/marca.test.ts`

**Interfaces — Produces:**
- `type MarcaEscola = { nome: string; logo_url: string; slogan: string | null; foto_login_url: string | null; padrao: boolean }`; `MARCA_PADRAO` (Status, `padrao: true`, slogan "Cada aprendizado merece atenção.", foto null)
- `marcaDaEscola(e: Pick<Escola, "id" | "nome" | "logo_url" | "slogan" | "foto_login_url">): MarcaEscola` (`padrao = e.id === ESCOLA_PADRAO_ID`)
- `hexParaRgb(hex: string): [number, number, number] | null`; `razaoContraste(a: string, b: string): number`; `textoSobre(hex: string): "#ffffff" | "#0e1b3d"`
- `variaveisDaMarca(corPrincipal: string | null, corDestaque: string | null): Record<string, string>`
- `validarCores(corPrincipal: string | null, corDestaque: string | null): { erro: string | null; alertas: string[] }`

**Regras (decididas):** a interface escreve texto branco sobre a moldura em muitos lugares, então **cor principal com contraste < 4,5 contra branco é recusada** (erro). Destaque com contraste < 3 contra a cor principal gera **alerta** (não bloqueia). Hex aceito: `#rgb` ou `#rrggbb`.

- [ ] **Step 1: Testes**

```ts
// src/lib/marca.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { hexParaRgb, razaoContraste, textoSobre, validarCores, variaveisDaMarca, marcaDaEscola, MARCA_PADRAO } from "./marca";

test("hexParaRgb", () => {
  assert.deepEqual(hexParaRgb("#0a2a6e"), [10, 42, 110]);
  assert.deepEqual(hexParaRgb("#FFF"), [255, 255, 255]);
  assert.equal(hexParaRgb("0a2a6e"), null);
  assert.equal(hexParaRgb("#12345"), null);
  assert.equal(hexParaRgb("#gggggg"), null);
});

test("razaoContraste e textoSobre", () => {
  assert.equal(Math.round(razaoContraste("#000000", "#ffffff")), 21);
  assert.equal(razaoContraste("#777777", "#777777"), 1);
  assert.equal(textoSobre("#0a2a6e"), "#ffffff");
  assert.equal(textoSobre("#f5d90a"), "#0e1b3d");
});

test("variaveisDaMarca: nulas não mexem no tema", () => {
  assert.deepEqual(variaveisDaMarca(null, null), {});
  const v = variaveisDaMarca("#0b5d3b", "#ffb703");
  assert.equal(v["--color-frame"], "#0b5d3b");
  assert.equal(v["--color-brand"], "#0b5d3b");
  assert.equal(v["--color-gold"], "#ffb703");
  assert.equal(v["--color-gold-ink"], "#0e1b3d");
  for (const k of ["--color-frame-deep", "--color-frame-line", "--color-frame-muted", "--color-brand-bright"]) assert.match(v[k], /^#[0-9a-f]{6}$/);
  assert.deepEqual(Object.keys(variaveisDaMarca(null, "#ffb703")).sort(), ["--color-gold", "--color-gold-ink"]);
  assert.deepEqual(variaveisDaMarca("xyz", null), {});
});

test("validarCores", () => {
  assert.deepEqual(validarCores(null, null), { erro: null, alertas: [] });
  assert.equal(validarCores("#0b5d3b", "#ffb703").erro, null);
  assert.notEqual(validarCores("#f1f1f1", null).erro, null); // texto branco ilegível
  assert.notEqual(validarCores("verde", null).erro, null);
  assert.notEqual(validarCores(null, "#12").erro, null);
  assert.equal(validarCores("#0b5d3b", "#0d6b45").alertas.length, 1); // destaque quase igual à moldura
});

test("marcaDaEscola", () => {
  assert.equal(marcaDaEscola({ id: "00000000-0000-0000-0000-000000000001", nome: "Colégio Status", logo_url: "/l.png", slogan: null, foto_login_url: null }).padrao, true);
  const x = marcaDaEscola({ id: "x", nome: "Escola X", logo_url: "", slogan: "Oi", foto_login_url: null });
  assert.equal(x.padrao, false);
  assert.equal(x.slogan, "Oi");
  assert.equal(MARCA_PADRAO.padrao, true);
});
```

- [ ] **Step 2:** `npx tsx --test src/lib/marca.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — substitua o conteúdo de `src/lib/marca.ts`:

```ts
import type { Escola } from "@/lib/types";

const ESCOLA_PADRAO_ID = "00000000-0000-0000-0000-000000000001";

export type MarcaEscola = { nome: string; logo_url: string; slogan: string | null; foto_login_url: string | null; padrao: boolean };

export const MARCA_PADRAO: MarcaEscola = {
  nome: "Colégio Status",
  logo_url: "/logo-status-branca.png",
  slogan: "Cada aprendizado merece atenção.",
  foto_login_url: null,
  padrao: true,
};

export function marcaDaEscola(e: Pick<Escola, "id" | "nome" | "logo_url" | "slogan" | "foto_login_url">): MarcaEscola {
  return { nome: e.nome, logo_url: e.logo_url, slogan: e.slogan, foto_login_url: e.foto_login_url, padrao: e.id === ESCOLA_PADRAO_ID };
}

type Rgb = [number, number, number];
const BRANCO: Rgb = [255, 255, 255];
const PRETO: Rgb = [0, 0, 0];
const TINTA = "#0e1b3d";

export function hexParaRgb(hex: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function paraHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

function misturar(a: Rgb, b: Rgb, t: number): Rgb {
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as Rgb;
}

function luminancia(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function razaoContraste(a: string, b: string): number {
  const ra = hexParaRgb(a), rb = hexParaRgb(b);
  if (!ra || !rb) return 1;
  const [l1, l2] = [luminancia(ra), luminancia(rb)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function textoSobre(hex: string): "#ffffff" | "#0e1b3d" {
  return razaoContraste(hex, "#ffffff") >= razaoContraste(hex, TINTA) ? "#ffffff" : "#0e1b3d";
}

/** Variáveis CSS do tema para as cores da escola. Cor nula ou inválida = mantém o tema padrão. */
export function variaveisDaMarca(corPrincipal: string | null, corDestaque: string | null): Record<string, string> {
  const v: Record<string, string> = {};
  const p = corPrincipal ? hexParaRgb(corPrincipal) : null;
  if (p) {
    v["--color-frame"] = paraHex(p);
    v["--color-frame-deep"] = paraHex(misturar(p, PRETO, 0.25));
    v["--color-frame-line"] = paraHex(misturar(p, BRANCO, 0.15));
    v["--color-frame-muted"] = paraHex(misturar(p, BRANCO, 0.65));
    v["--color-brand"] = paraHex(p);
    v["--color-brand-bright"] = paraHex(misturar(p, BRANCO, 0.25));
  }
  const d = corDestaque ? hexParaRgb(corDestaque) : null;
  if (d) {
    v["--color-gold"] = paraHex(d);
    v["--color-gold-ink"] = textoSobre(paraHex(d));
  }
  return v;
}

export function validarCores(corPrincipal: string | null, corDestaque: string | null): { erro: string | null; alertas: string[] } {
  if (corPrincipal && !hexParaRgb(corPrincipal)) return { erro: "Cor principal inválida (use o formato #RRGGBB).", alertas: [] };
  if (corDestaque && !hexParaRgb(corDestaque)) return { erro: "Cor de destaque inválida (use o formato #RRGGBB).", alertas: [] };
  if (corPrincipal && razaoContraste(corPrincipal, "#ffffff") < 4.5) {
    return { erro: "A cor principal é clara demais: o texto branco do menu e dos botões ficaria ilegível. Escolha um tom mais escuro.", alertas: [] };
  }
  const alertas: string[] = [];
  if (corPrincipal && corDestaque && razaoContraste(corPrincipal, corDestaque) < 3) {
    alertas.push("A cor de destaque quase some sobre a cor principal. Considere um tom mais contrastante.");
  }
  return { erro: null, alertas };
}
```

- [ ] **Step 4:** Testes passam; adicione `src/lib/marca.test.ts` ao script `test`. Rode `npx tsc --noEmit`: os usos atuais de `MarcaEscola` (layout, `EscolaContexto`) vão reclamar dos campos novos — no `src/app/layout.tsx` troque `marca = { nome: escola.nome, logo_url: escola.logo_url }` por `marca = marcaDaEscola(escola)` (import de `@/lib/marca`). `npm test` → OK.
- [ ] **Step 5:** Commit — `git add src/lib/marca.ts src/lib/marca.test.ts src/app/layout.tsx package.json && git commit -m "Multiescola: cores da marca e contraste"`

---

### Task 3: Núcleo do servidor — escola do endereço, sessão e verificações centrais

**Files:** Create `src/lib/escola-regras.ts`, `src/lib/escola-regras.test.ts`, `src/lib/escola-acesso.ts`; Modify `src/lib/escolas.ts`, `src/lib/auth.ts`, `src/app/layout.tsx`, `package.json` (a tela "Escola não encontrada" é renderizada pelo layout, ver Step 6).

**Interfaces — Produces:**
- `escola-regras.ts` (puro): `podeAcessarTurma(professor: { escola_id: string }, turma: { escola_id: string; nome: string }, liberadas: Set<string> | null): boolean`; `mesmaEscola(a: { escola_id: string | null }, escolaId: string): boolean`
- `escolas.ts`: `obterEscolaPorSlug(slug: string): Promise<Escola | null>` (cache); `escolaDoEndereco(): Promise<Escola | null>` (lê `host` de `headers()`); `linkDaEscola(escola: Pick<Escola, "slug">, caminho: string): string`
- `auth.ts`: `getProfessorAtual()`/`getAlunoAtual()` devolvem null se a escola da conta estiver com `ativa = false`; `exigirAcessoATurmaId(professor, turmaId)` passa a **exigir professor** e escola igual.
- `escola-acesso.ts` (sem `"use server"`):
  - `exigirProfessorLogado(): Promise<Professor>` — lança "Faça login novamente." se não houver professor (inclui aluno logado)
  - `exigirAdminDaEscola(): Promise<Professor>` — professor com `ehAdmin(role)`, senão lança "Apenas administradores podem fazer isso."
  - `exigirTurmaDaEscola(professor: Professor, turmaId: string): Promise<Turma>` — lança "Você não tem acesso a essa turma."
  - `exigirAlunoDaEscola(professor: Professor, alunoId: string): Promise<{ aluno: Aluno; turma: Turma }>` — lança "Aluno não encontrado."
  - `exigirColunaDaEscola(professor: Professor, colunaId: string): Promise<{ coluna: AtividadeColuna; turma: Turma }>` — lança "Atividade não encontrada."
  - `turmasDaEscola(professor: Professor): Promise<Turma[]>` — turmas da escola, filtradas pelo acesso restrito, ordem nome/bimestre

- [ ] **Step 1: Testes**

```ts
// src/lib/escola-regras.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mesmaEscola, podeAcessarTurma } from "./escola-regras";

const P = { escola_id: "e1" };

test("podeAcessarTurma: escola diferente nunca", () => {
  assert.equal(podeAcessarTurma(P, { escola_id: "e2", nome: "1A" }, null), false);
  assert.equal(podeAcessarTurma(P, { escola_id: "e2", nome: "1A" }, new Set(["1A"])), false);
});

test("podeAcessarTurma: mesma escola respeita acesso restrito", () => {
  assert.equal(podeAcessarTurma(P, { escola_id: "e1", nome: "1A" }, null), true);
  assert.equal(podeAcessarTurma(P, { escola_id: "e1", nome: "1A" }, new Set(["1A"])), true);
  assert.equal(podeAcessarTurma(P, { escola_id: "e1", nome: "2B" }, new Set(["1A"])), false);
  assert.equal(podeAcessarTurma(P, { escola_id: "e1", nome: "1A" }, new Set()), false);
});

test("mesmaEscola", () => {
  assert.equal(mesmaEscola({ escola_id: "e1" }, "e1"), true);
  assert.equal(mesmaEscola({ escola_id: "e2" }, "e1"), false);
  assert.equal(mesmaEscola({ escola_id: null }, "e1"), false);
});
```

- [ ] **Step 2:** FAIL; depois implemente:

```ts
// src/lib/escola-regras.ts
export function podeAcessarTurma(professor: { escola_id: string }, turma: { escola_id: string; nome: string }, liberadas: Set<string> | null): boolean {
  return turma.escola_id === professor.escola_id && (liberadas === null || liberadas.has(turma.nome));
}

export function mesmaEscola(a: { escola_id: string | null }, escolaId: string): boolean {
  return !!a.escola_id && a.escola_id === escolaId;
}
```

Testes passam; adicione `src/lib/escola-regras.test.ts` ao script `test`.

- [ ] **Step 3: `src/lib/escolas.ts`** — acrescente:

```ts
import { headers } from "next/headers";
import { escolaDoHost, urlDaEscola } from "@/lib/dominio";

export const obterEscolaPorSlug = cache(async (slug: string): Promise<Escola | null> => {
  const { data } = await supabase.from("escolas").select("*").eq("slug", slug).maybeSingle();
  return data ?? null;
});

/** Escola do endereço desta requisição (marca e onde o login vale). Nunca usar para dar acesso. */
export async function escolaDoEndereco(): Promise<Escola | null> {
  const slug = escolaDoHost((await headers()).get("host"));
  return slug ? obterEscolaPorSlug(slug) : null;
}

/** Link absoluto para e-mails: endereço da escola em produção; em teste/preview, o endereço do app. */
export function linkDaEscola(escola: Pick<Escola, "slug">, caminho: string): string {
  if (process.env.VERCEL_ENV === "production") return urlDaEscola(escola.slug, caminho);
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}
```

- [ ] **Step 4: `src/lib/auth.ts`**
  - Em `getAlunoAtual()` e `getProfessorAtual()`, depois de achar a conta: `const escola = await obterEscola(data.escola_id).catch(() => null); if (!escola || escola.ativa === false) return null;` (import `obterEscola` de `@/lib/escolas`; atenção a import circular: `escolas.ts` não importa `auth.ts`, ok).
  - `exigirAcessoATurmaId(professor, turmaId)`: se `!professor` → `throw new Error("Faça login novamente.")`; leia `turmas` com `select("nome, escola_id")`; recuse se `!turma || !podeAcessarTurma(professor, turma, await turmasLiberadasPara(professor))`. Atualize o comentário (sem "anônimo passa").

- [ ] **Step 5: `src/lib/escola-acesso.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import { getProfessorAtual, turmasLiberadasPara } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { podeAcessarTurma } from "@/lib/escola-regras";
import type { Aluno, AtividadeColuna, Professor, Turma } from "@/lib/types";

export async function exigirProfessorLogado(): Promise<Professor> {
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  return professor;
}

export async function exigirAdminDaEscola(): Promise<Professor> {
  const professor = await exigirProfessorLogado();
  if (!ehAdmin(professor.role)) throw new Error("Apenas administradores podem fazer isso.");
  return professor;
}

export async function exigirTurmaDaEscola(professor: Professor, turmaId: string): Promise<Turma> {
  const { data: turma } = await supabase.from("turmas").select("*").eq("id", turmaId).maybeSingle();
  if (!turma || !podeAcessarTurma(professor, turma, await turmasLiberadasPara(professor))) throw new Error("Você não tem acesso a essa turma.");
  return turma;
}

export async function exigirAlunoDaEscola(professor: Professor, alunoId: string): Promise<{ aluno: Aluno; turma: Turma }> {
  const { data: aluno } = await supabase.from("alunos").select("*").eq("id", alunoId).maybeSingle();
  if (!aluno) throw new Error("Aluno não encontrado.");
  const turma = await exigirTurmaDaEscola(professor, aluno.turma_id).catch(() => null);
  if (!turma) throw new Error("Aluno não encontrado.");
  return { aluno, turma };
}

export async function exigirColunaDaEscola(professor: Professor, colunaId: string): Promise<{ coluna: AtividadeColuna; turma: Turma }> {
  const { data: coluna } = await supabase.from("atividades_colunas").select("*").eq("id", colunaId).maybeSingle();
  if (!coluna) throw new Error("Atividade não encontrada.");
  const turma = await exigirTurmaDaEscola(professor, coluna.turma_id).catch(() => null);
  if (!turma) throw new Error("Atividade não encontrada.");
  return { coluna, turma };
}

export async function turmasDaEscola(professor: Professor): Promise<Turma[]> {
  const { data, error } = await supabase.from("turmas").select("*").eq("escola_id", professor.escola_id).order("nome").order("bimestre");
  if (error) throw new Error(error.message);
  const liberadas = await turmasLiberadasPara(professor);
  return (data ?? []).filter((t) => podeAcessarTurma(professor, t, liberadas));
}
```

(Confira os nomes reais dos tipos de aluno da planilha e de coluna em `src/lib/types.ts` — `Aluno` e o tipo de `atividades_colunas` — e use-os.)

- [ ] **Step 6: Endereço desconhecido** — em `src/app/layout.tsx`, no começo do `RootLayout`: `const escolaEndereco = await escolaDoEndereco();`. Se `escolaEndereco === null`, devolva o `<html>`/`<body>` com uma tela simples (sem Sidebar): título "Escola não encontrada", texto "Este endereço não corresponde a nenhuma escola da plataforma." e link para `https://www.statusavalia.com.br`. Se a escola do endereço existir mas `ativa === false`, mostre "Acesso suspenso. Fale com a plataforma." da mesma forma. (O resto do layout não muda nesta task.)

- [ ] **Step 7:** `npx tsc --noEmit && npx eslint src/lib src/app/layout.tsx && npm test` → OK.
- [ ] **Step 8:** Commit — `git add src/lib src/app/layout.tsx package.json && git commit -m "Multiescola: escola do endereco, sessao por escola ativa e verificacoes centrais"`

---

### Task 4: Separação dos dados — turmas, alunos, notas, colunas, busca, exportação

**Files:** Modify `src/actions/turmas.ts`, `src/actions/alunos.ts`, `src/actions/notas.ts`, `src/actions/colunas.ts`, `src/actions/busca.ts`, `src/actions/exportacao.ts`, `src/app/page.tsx`, `src/app/turma/[turmaId]/page.tsx`

**Interfaces — Consumes (Task 3):** `exigirProfessorLogado`, `exigirAdminDaEscola`, `exigirTurmaDaEscola`, `exigirAlunoDaEscola`, `exigirColunaDaEscola`, `turmasDaEscola` de `@/lib/escola-acesso`; `exigirAcessoATurmaId` (já endurecido).

**Regras para cada action/página destes arquivos (aplique a todas, sem exceção):**
1. Primeira linha: `const professor = await exigirProfessorLogado();` (ou `exigirAdminDaEscola()` onde hoje é `exigirAdmin()`). Remova os ramos "se não houver professor, segue".
2. Recebeu `turmaId` → `await exigirTurmaDaEscola(professor, turmaId)`; recebeu `alunoId` → `exigirAlunoDaEscola`; recebeu `colunaId` → `exigirColunaDaEscola`. Recebeu lista de ids (ex.: `reordenarAlunos(turmaId, ids)`, `reordenarColunas`) → verifique a turma e restrinja o update com `.eq("turma_id", turmaId)` para ids de outra turma não serem tocados.
3. Toda leitura de `turmas` filtra `.eq("escola_id", professor.escola_id)` (ou usa `turmasDaEscola`). Leitura de `alunos`/`atividades_colunas`/`notas_celulas` só por ids de turmas já verificadas.
4. Insert em `turmas` grava `escola_id: professor.escola_id`.

**Checklist por arquivo:**
- `turmas.ts`: `listarTurmasAcessiveis()` → `return turmasDaEscola(await exigirProfessorLogado())` mantendo a assinatura (é usada no layout e em várias telas; para aluno logado continua lançando — o layout só chama com professor). `listarNomesTurmas()` (admin) filtra pela escola. `criarBimestre(...)`: turma de origem verificada com `exigirTurmaDaEscola`; insert com `escola_id`.
- `alunos.ts`: `transferirAluno(alunoId, turmaDestinoId)` → aluno via `exigirAlunoDaEscola` e destino via `exigirTurmaDaEscola` (as duas da mesma escola); `addAluno`, `adicionarAlunos`, `reordenarAlunos` → turma; `deleteAluno`, `renomearAluno` → aluno.
- `notas.ts`: `upsertCelula(...)` → `exigirColunaDaEscola` + `exigirAlunoDaEscola`, e recuse se `aluno.turma_id !== coluna.turma_id` ("Aluno e atividade de turmas diferentes.").
- `colunas.ts`: `addColuna`, `reordenarColunas` → turma; `renameColuna`, `deleteColuna` → coluna.
- `busca.ts`: `buscarAlunos(termo)` → só alunos de `turmasDaEscola(professor)`.
- `exportacao.ts`: `dadosExportacao(bimestre)` → turmas de `turmasDaEscola(professor)` (filtradas pelo bimestre como hoje).
- `src/app/page.tsx` (início do professor): contagem de alunos só das turmas de `listarTurmasAcessiveis()`/`turmasDaEscola` (hoje lê `alunos` inteira — passe a usar `.in("turma_id", idsDasTurmas)` com blocos de até 150 ids).
- `src/app/turma/[turmaId]/page.tsx`: carregue a turma com `exigirTurmaDaEscola(professor, turmaId)` (professor via `getProfessorAtual()`; sem professor → `redirect("/login")`; erro de acesso → `notFound()`).

- [ ] **Step 1:** Aplique as regras e o checklist acima, lendo cada arquivo inteiro antes de editar.
- [ ] **Step 2:** `grep -n "from(\"turmas\")" src/actions/turmas.ts src/actions/alunos.ts src/actions/notas.ts src/actions/colunas.ts src/actions/busca.ts src/actions/exportacao.ts src/app/page.tsx "src/app/turma/[turmaId]/page.tsx"` — cada ocorrência precisa de filtro de escola ou de id já verificado; anote no relatório cada linha e por que está segura.
- [ ] **Step 3:** `npx tsc --noEmit && npx eslint <arquivos alterados> && npm test && npm run build` → OK.
- [ ] **Step 4:** Commit — `git add src/actions src/app && git commit -m "Multiescola: turmas, alunos, notas e colunas filtrados por escola"`

---

### Task 5: Separação dos dados — histórico, lixeira, professores, contas de aluno, convites, configurações

**Files:** Modify `src/actions/historico.ts`, `src/actions/lixeira.ts`, `src/actions/professores.ts`, `src/actions/contas-aluno.ts`, `src/actions/convites.ts`, `src/actions/configuracoes.ts`, `src/lib/configuracoes.ts`, `src/app/admin/historico/page.tsx`, `src/app/admin/professores/page.tsx`, demais `src/app/admin/**` que leem essas tabelas

**Interfaces — Consumes (Task 3):** `exigirProfessorLogado`, `exigirAdminDaEscola`, `exigirTurmaDaEscola`, `turmasDaEscola`, `mesmaEscola`.

**Regras (as mesmas da Task 4, mais):**
- `historico.ts` `listarHistorico(filtro)`: `exigirAdminDaEscola()`; restrinja aos `aluno_id` de alunos das turmas da escola (`turmas.escola_id = professor.escola_id` → ids de turmas → ids de alunos, em blocos de 150); `filtro.turmaId` precisa ser da escola. Professores listados só da escola.
- `lixeira.ts`: `listarLixeira()` filtra `.eq("escola_id", admin.escola_id)`; `restaurarDaLixeira(id)`, `apagarDaLixeira(id)`: leia o item (`select("id, escola_id")`) e recuse se `!mesmaEscola(item, admin.escola_id)` ("Item não encontrado."); `desfazerExclusao(id)`: `exigirProfessorLogado()`, item da mesma escola e (regra atual) excluído pelo próprio professor.
- `professores.ts`: `listarProfessores()`, `listarAcessoTurmasPorProfessor()` filtram pela escola do admin (acessos: só de professores da escola); toda action com `id` de professor (`atualizarAcessoTurmas`, `atualizarTelefoneProfessor`, `definirSenhaProvisoria`, `excluirProfessor`, `exigirPoderSobreAlvo`) carrega o alvo com `escola_id` e recusa se não for da escola ("Professor não encontrado."); `atualizarAcessoTurmas` só aceita nomes de turmas da escola; `criarProfessor` grava `escola_id: admin.escola_id`.
- `contas-aluno.ts`: as funções admin já usam `admin.escola_id` — troque o helper local por `exigirAdminDaEscola()` e garanta que `definirContaAtiva(contaId)` e `novaSenhaAlunoPeloAdmin(contaId)` recusam conta de outra escola (o helper local que lê `alunos_contas.escola_id` deve comparar e lançar "Conta não encontrada."); `criarContasAluno(turmaId, …)` usa `exigirTurmaDaEscola`. `cadastrarAlunoComCodigo` (público) não muda nesta task.
- `convites.ts`: o helper `exigirTurma(turmaId)` passa a ser `exigirProfessorLogado()` + `exigirTurmaDaEscola()`; `novaSenhaAlunoPeloProfessor(turmaId, contaId)` exige que a conta esteja vinculada à turma **e** seja da escola.
- `configuracoes.ts` / `src/lib/configuracoes.ts`: `obterCodigoConvite(escolaId: string)` lê `escolas.codigo_convite_professor` da escola dada (sem default); `atualizarCodigoConvite` usa `exigirAdminDaEscola()` e grava na escola do admin. Ajuste `src/app/admin/professores/page.tsx` para passar `professor.escola_id`. (O uso em `cadastro.ts` é ajustado na Task 7; até lá passe `ESCOLA_PADRAO_ID` lá para compilar.)
- `src/app/admin/historico/page.tsx`: listas de turmas/professores filtradas pela escola do admin.
- Rode `grep -rnE "from\(\"(turmas|alunos|atividades_colunas|notas_celulas|notas_historico|lixeira|professores|professor_turma_acesso|alunos_contas)\"\)" src/app/admin src/actions/historico.ts src/actions/lixeira.ts src/actions/professores.ts src/actions/contas-aluno.ts src/actions/convites.ts src/actions/configuracoes.ts` e justifique cada linha no relatório.

- [ ] **Step 1:** Aplique as regras lendo cada arquivo inteiro antes.
- [ ] **Step 2:** `npx tsc --noEmit && npx eslint <arquivos alterados> && npm test && npm run build` → OK.
- [ ] **Step 3:** Commit — `git add src && git commit -m "Multiescola: historico, lixeira, professores e contas por escola"`

---

### Task 6: Hermes só no Status

**Files:** Modify `src/lib/mcp-tools.ts`

**Regras:** importe `ESCOLA_PADRAO_ID` de `@/lib/escolas` (se o import puxar `next/headers` e quebrar o endpoint, declare a constante localmente com o mesmo valor e um comentário apontando para `escolas.ts`). Em **todas** as ferramentas:
- leitura de `turmas` → `.eq("escola_id", ESCOLA_PADRAO_ID)`;
- leitura por id de turma/aluno/coluna → confirme que a turma (direta ou via aluno/coluna) é do Status antes de agir; senão responda erro "Turma não encontrada.";
- busca de professor (ex.: por telefone) → `.eq("escola_id", ESCOLA_PADRAO_ID)`;
- inserts em `turmas` → `escola_id: ESCOLA_PADRAO_ID`;
- `lixeira`: leitura por id só se `escola_id = ESCOLA_PADRAO_ID`.

- [ ] **Step 1:** Leia o arquivo inteiro e aplique; liste no relatório cada ferramenta e o filtro aplicado.
- [ ] **Step 2:** `npx tsc --noEmit && npx eslint src/lib/mcp-tools.ts && npm test` → OK.
- [ ] **Step 3:** Commit — `git add src/lib/mcp-tools.ts && git commit -m "Multiescola: Hermes restrito ao Status"`

---

### Task 7: Login, cadastro e e-mails pelo endereço

**Files:** Modify `src/actions/auth.ts`, `src/actions/cadastro.ts`, `src/actions/contas-aluno.ts` (só `cadastrarAlunoComCodigo` e o link de verificação), `src/app/login/page.tsx`, `src/app/cadastro/page.tsx` (mensagem nova)

**Interfaces — Consumes:** `escolaDoEndereco`, `obterEscola`, `linkDaEscola` (Task 3); `destinoDoLogin`, `urlDaEscola` (Task 1); `obterCodigoConvite(escolaId)` (Task 5).

- [ ] **Step 1: `login(formData)`** — depois de validar a senha (professor e aluno), antes de `iniciarSessao`:

```ts
const escolaConta = await obterEscola(conta.escola_id); // selecione escola_id no select da conta
if (!escolaConta.ativa) redirect("/login?erro=suspenso");
const endereco = await escolaDoEndereco();
const destino = destinoDoLogin(escolaConta.slug, endereco?.slug ?? null);
if (!destino.ok) redirect(`/login?erro=outra-escola&escola=${encodeURIComponent(destino.slug)}`);
```

- [ ] **Step 2: `src/app/login/page.tsx`** — mensagens: `suspenso: "Acesso suspenso. Fale com a plataforma."`; para `erro=outra-escola`, carregue `obterEscolaPorSlug(escola)` e mostre "Sua conta é da {nome}." com um link/botão "Entrar no endereço da {nome}" para `urlDaEscola(slug, "/login")` (se a escola não existir, mensagem genérica de erro). Nunca usar o parâmetro como URL direta (só como slug validado pela busca).

- [ ] **Step 3: `pedirRedefinicaoSenha`** — para professor também use `obterEscola(professor.escola_id)` (selecione `escola_id`); link com `linkDaEscola(escola, "/redefinir-senha?token=…")` para professor e aluno.

- [ ] **Step 4: `cadastrar(formData)` (professor)** — `const escola = await escolaDoEndereco(); if (!escola || !escola.ativa) redirect("/cadastro?erro=codigo");` código esperado `escola.codigo_convite_professor`; `dadosProfessor` inclui `escola_id: escola.id`; e-mail com `escola` e link `linkDaEscola(escola, "/verificar-email?token=…")`.

- [ ] **Step 5: `cadastrarAlunoComCodigo`** — link de verificação com `linkDaEscola(escolaDoConvite, …)` (a escola do convite já é conhecida ali; carregue com `obterEscola`).

- [ ] **Step 6:** `grep -rn "NEXT_PUBLIC_APP_URL\|obterEscolaPadrao" src/actions` → não deve sobrar uso fora de `linkDaEscola`. `npx tsc --noEmit && npx eslint <alterados> && npm test && npm run build` → OK.
- [ ] **Step 7:** Commit — `git add src && git commit -m "Multiescola: login, cadastro e e-mails pelo endereco da escola"`

---

### Task 8: Visual por escola

**Files:** Modify `src/app/layout.tsx`, `src/components/layout/EscolaContexto.tsx`, `src/components/layout/LoginShell.tsx`, `src/components/layout/AuthShell.tsx`, `next.config.ts`, telas públicas que usam `LoginShell`/`AuthShell` (login, cadastro, esqueci/redefinir senha, verificar-email, entrar-com-código)

**Interfaces — Consumes:** `MarcaEscola`, `marcaDaEscola`, `variaveisDaMarca` (Task 2); `escolaDoEndereco` (Task 3).

- [ ] **Step 1: Layout** — escola da marca = escola da conta logada; sem login, a escola do endereço. `marca = marcaDaEscola(escola)`; `<html style={variaveisDaMarca(escola.cor_principal, escola.cor_destaque)}>` (objeto vazio para o Status). Troque `export const metadata` por `export async function generateMetadata()` com `title: \`${escola.nome} · Status Avalia\`` (falha ao ler a escola → título atual).

- [ ] **Step 2: `EscolaContexto.tsx`** — `LogoEscola`: se `logo_url` vazio, renderize o nome da escola em texto (`font-display font-bold text-white`) no lugar da imagem; se a URL for externa (começa com `http`), use `next/image` normalmente (configurado no Step 3).

- [ ] **Step 3: `next.config.ts`** — `images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/marcas/**" }] }`.

- [ ] **Step 4: `LoginShell` e `AuthShell`** — recebem a marca por prop (`marca: MarcaEscola`; as páginas públicas passam `marcaDaEscola(await escolaDoEndereco())`, com `MARCA_PADRAO` se nula). Com `marca.padrao === true` o JSX atual fica **idêntico** (vídeo, Fera, textos do Status). Para outras escolas: logo via `LogoEscola`/imagem da marca; título = `marca.slogan` (ou "Bem-vindo à {nome}"); sem `LoginVideo` e sem `FeraMascote`; fundo do lado esquerdo = `marca.foto_login_url` como imagem de capa (se houver) ou nada; rodapé "{nome} · Status Avalia".

- [ ] **Step 5:** `npx tsc --noEmit && npm run lint && npm test && npm run build` → OK. Confira no `npm run dev` que `http://localhost:3000/login` continua exatamente como antes (Status).
- [ ] **Step 6:** Commit — `git add src next.config.ts && git commit -m "Multiescola: visual por escola (cores, logo, login)"`

---

### Task 9: Painel do dono

**Files:** Create `src/actions/dono.ts`, `src/app/dono/page.tsx`, `src/app/dono/escolas/nova/page.tsx`, `src/app/dono/escolas/[id]/page.tsx`, `src/components/dono/FormEscola.tsx`, `src/components/dono/EnviarMarca.tsx`, `src/components/dono/VerificarEndereco.tsx`, `src/components/dono/AtivarEscola.tsx`; Modify `src/components/layout/Sidebar.tsx`

**Interfaces — Consumes:** `validarSubdominio`, `urlDaEscola` (Task 1); `validarCores`, `variaveisDaMarca` (Task 2); `getProfessorAtual`; `ESCOLA_PADRAO_ID`.
**Produces (`src/actions/dono.ts`, `"use server"`, toda função começa com `exigirDono()`):**
- `type DadosEscola = { nome: string; nome_remetente_email: string; slogan: string; cor_principal: string; cor_destaque: string; codigo_convite_professor: string }`
- `type ResumoEscola = { id: string; nome: string; slug: string; ativa: boolean; professores: number; turmas: number; contas: number }`
- `listarEscolas(): Promise<ResumoEscola[]>`
- `criarEscola(slug: string, d: DadosEscola, admin: { nome: string; email: string }): Promise<{ escolaId: string; senhaProvisoria: string }>`
- `salvarEscola(id: string, d: DadosEscola): Promise<void>`
- `definirEscolaAtiva(id: string, ativa: boolean): Promise<void>`
- `urlEnvioMarca(escolaId: string, tipo: "logo" | "login", tipoArquivo: string, tamanho: number): Promise<{ caminho: string; token: string; url: string }>`
- `confirmarMarca(escolaId: string, tipo: "logo" | "login", caminho: string): Promise<void>`
- `verificarEndereco(escolaId: string): Promise<boolean>`
- `gerarCodigoConvite(): Promise<string>`

- [ ] **Step 1: `src/actions/dono.ts`**

```ts
"use server";

import { randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { getProfessorAtual } from "@/lib/auth";
import { ESCOLA_PADRAO_ID } from "@/lib/escolas";
import { urlDaEscola, validarSubdominio } from "@/lib/dominio";
import { validarCores } from "@/lib/marca";

const BUCKET = "marcas";
const TIPOS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

async function exigirDono() {
  const p = await getProfessorAtual();
  if (!p || p.role !== "dono") throw new Error("Só o dono da plataforma acessa o painel.");
  return p;
}

export type DadosEscola = { nome: string; nome_remetente_email: string; slogan: string; cor_principal: string; cor_destaque: string; codigo_convite_professor: string };
export type ResumoEscola = { id: string; nome: string; slug: string; ativa: boolean; professores: number; turmas: number; contas: number };

function limpar(d: DadosEscola) {
  const nome = String(d.nome ?? "").trim();
  const remetente = String(d.nome_remetente_email ?? "").trim() || nome;
  const codigo = String(d.codigo_convite_professor ?? "").trim();
  if (!nome) throw new Error("Informe o nome da escola.");
  if (codigo.length < 4 || codigo.length > 50) throw new Error("O código de convite precisa ter de 4 a 50 caracteres.");
  const cor_principal = String(d.cor_principal ?? "").trim() || null;
  const cor_destaque = String(d.cor_destaque ?? "").trim() || null;
  const cores = validarCores(cor_principal, cor_destaque);
  if (cores.erro) throw new Error(cores.erro);
  return { nome: nome.slice(0, 120), nome_remetente_email: remetente.slice(0, 120), slogan: String(d.slogan ?? "").trim().slice(0, 160) || null, cor_principal, cor_destaque, codigo_convite_professor: codigo };
}

async function contar(tabela: "professores" | "alunos_contas", escolaId: string): Promise<number> {
  const { count, error } = await supabase.from(tabela).select("id", { count: "exact", head: true }).eq("escola_id", escolaId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listarEscolas(): Promise<ResumoEscola[]> {
  await exigirDono();
  const { data, error } = await supabase.from("escolas").select("id, nome, slug, ativa").order("nome");
  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map(async (e) => {
    const [professores, contas, { data: turmas, error: e2 }] = await Promise.all([
      contar("professores", e.id),
      contar("alunos_contas", e.id),
      supabase.from("turmas").select("nome, ano_letivo").eq("escola_id", e.id).limit(5000),
    ]);
    if (e2) throw new Error(e2.message);
    return { ...e, professores, contas, turmas: new Set((turmas ?? []).map((t) => `${t.nome}|${t.ano_letivo}`)).size };
  }));
}

export async function gerarCodigoConvite(): Promise<string> {
  await exigirDono();
  return String(randomInt(100000, 1000000));
}

export async function criarEscola(slug: string, d: DadosEscola, admin: { nome: string; email: string }) {
  await exigirDono();
  const s = String(slug ?? "").trim();
  const erroSlug = validarSubdominio(s);
  if (erroSlug) throw new Error(erroSlug);
  const campos = limpar(d);
  const nomeAdmin = String(admin?.nome ?? "").trim();
  const email = String(admin?.email ?? "").trim().toLowerCase();
  if (!nomeAdmin || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe nome e e-mail válidos do primeiro admin.");
  const [{ data: jaSlug }, { data: jaProf }, { data: jaAluno }] = await Promise.all([
    supabase.from("escolas").select("id").eq("slug", s).maybeSingle(),
    supabase.from("professores").select("id").eq("email", email).maybeSingle(),
    supabase.from("alunos_contas").select("id").eq("email", email).maybeSingle(),
  ]);
  if (jaSlug) throw new Error("Esse endereço já está em uso.");
  if (jaProf || jaAluno) throw new Error("Esse e-mail já tem conta na plataforma.");
  const { data: escola, error } = await supabase.from("escolas").insert({ ...campos, slug: s, logo_url: "", ativa: true }).select("id").single();
  if (error || !escola) throw new Error(error?.message ?? "Falha ao criar a escola.");
  const senhaProvisoria = randomBytes(6).toString("base64url");
  const { error: e2 } = await supabase.from("professores").insert({
    nome: nomeAdmin, email, senha_hash: await bcrypt.hash(senhaProvisoria, 10), role: "admin",
    email_verificado: true, senha_provisoria: true, escola_id: escola.id,
  });
  if (e2) {
    await supabase.from("escolas").delete().eq("id", escola.id);
    throw new Error(e2.message);
  }
  return { escolaId: escola.id, senhaProvisoria };
}

export async function salvarEscola(id: string, d: DadosEscola): Promise<void> {
  await exigirDono();
  const { error } = await supabase.from("escolas").update(limpar(d)).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function definirEscolaAtiva(id: string, ativa: boolean): Promise<void> {
  await exigirDono();
  if (id === ESCOLA_PADRAO_ID && !ativa) throw new Error("O Colégio Status não pode ser desativado.");
  const { error } = await supabase.from("escolas").update({ ativa: Boolean(ativa) }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function urlEnvioMarca(escolaId: string, tipo: "logo" | "login", tipoArquivo: string, tamanho: number) {
  await exigirDono();
  if (tipo !== "logo" && tipo !== "login") throw new Error("Tipo inválido.");
  const ext = TIPOS[tipoArquivo as keyof typeof TIPOS];
  if (!ext) throw new Error("Envie PNG, JPG ou WebP.");
  if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > 2 * 1024 * 1024) throw new Error("A imagem pode ter no máximo 2 MB.");
  const { data: escola } = await supabase.from("escolas").select("id").eq("id", escolaId).maybeSingle();
  if (!escola) throw new Error("Escola não encontrada.");
  const caminho = `${escola.id}/${tipo}-${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(caminho);
  if (error || !data) throw new Error(error?.message ?? "Falha ao preparar o envio.");
  return { caminho, token: data.token, url: data.signedUrl };
}

export async function confirmarMarca(escolaId: string, tipo: "logo" | "login", caminho: string): Promise<void> {
  await exigirDono();
  if (tipo !== "logo" && tipo !== "login") throw new Error("Tipo inválido.");
  if (!new RegExp(`^${escolaId}/${tipo}-[0-9a-f-]{36}\\.(png|jpg|webp)$`).test(caminho)) throw new Error("Arquivo inválido.");
  const url = supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
  const { error } = await supabase.from("escolas").update(tipo === "logo" ? { logo_url: url } : { foto_login_url: url }).eq("id", escolaId);
  if (error) throw new Error(error.message);
}

export async function verificarEndereco(escolaId: string): Promise<boolean> {
  await exigirDono();
  const { data: e } = await supabase.from("escolas").select("slug").eq("id", escolaId).maybeSingle();
  if (!e) return false;
  try {
    const r = await fetch(urlDaEscola(e.slug, "/login"), { redirect: "manual", signal: AbortSignal.timeout(5000), cache: "no-store" });
    return r.status < 500;
  } catch {
    return false;
  }
}
```

(Confirme no `Database` de `types.ts` que o `Insert` de `escolas` aceita esses campos; ajuste o tipo se necessário. O envio pelo navegador usa o mesmo padrão já usado para PDFs: procure `createSignedUploadUrl` em `src/actions/arquivos.ts` e o componente cliente que faz o `PUT` — copie o padrão.)

- [ ] **Step 2: Páginas** (servidor; sem dono → `notFound()`):
  - `/dono`: `PageLayout` "Escolas", tabela de `listarEscolas()` (nome, endereço `slug.statusavalia.com.br` — Status mostra `www.statusavalia.com.br` —, Ativa/Desativada, professores, turmas, contas) com link para `/dono/escolas/<id>` e botão "Nova escola".
  - `/dono/escolas/nova`: `FormEscola` em modo criação (campos de `DadosEscola` + subdomínio + nome e e-mail do primeiro admin; botão "Gerar" chama `gerarCodigoConvite`). Ao criar: mostra **uma vez** a senha provisória com aviso "Copie agora — ela não aparece de novo" e link para a página da escola.
  - `/dono/escolas/[id]`: `FormEscola` em modo edição (subdomínio só leitura); `EnviarMarca` para logo e para foto de login (prévia; chama `urlEnvioMarca` → PUT → `confirmarMarca` → `router.refresh()`); passo a passo do endereço (CNAME `<slug>` → `cname.vercel-dns.com` no Registro.br; adicionar `<slug>.statusavalia.com.br` em Vercel → Settings → Domains) — não mostrar para o Status; `VerificarEndereco` (botão → "funcionando ✓" / "ainda não — pode levar alguns minutos"); `AtivarEscola` (botão Desativar/Reativar com confirmação; escondido para o Status).
- [ ] **Step 3: `FormEscola`** (cliente): prévia ao vivo — uma faixa com a cor principal, o nome em branco e um botão na cor de destaque com `textoSobre`; abaixo, `validarCores(...)` mostrando o erro (em `role="alert"`, desabilita salvar) e os alertas (em `role="status"`). Inputs de cor: `<input type="color">` + campo de texto hex sincronizados; botão "Usar cores padrão" limpa os dois.
- [ ] **Step 4: Sidebar** — item "Escolas" (`href: "/dono"`, ícone `Building2` do `lucide-react`) visível só quando `professor?.role === "dono"`, depois dos itens de admin.
- [ ] **Step 5:** `npx tsc --noEmit && npm run lint && npm test && npm run build` → OK.
- [ ] **Step 6:** Commit — `git add src && git commit -m "Multiescola: painel do dono (escolas, marca, endereco, ativar)"`

---

### Task 10: Documentação e verificação

- [ ] **Step 1:** Acrescente ao fim de `DESIGN.md`:

```markdown
## Multiescola
Cada escola tem endereço próprio (`<slug>.statusavalia.com.br`; `www`/apex/`status.` = Status), logo, cores (principal → moldura e botões; destaque → dourado, tons derivados em `src/lib/marca.ts`), slogan e foto de login. O Status mantém o tema e a tela de login originais (vídeo, Fera). Dados sempre filtrados pela escola da conta logada (`src/lib/escola-acesso.ts`). Painel do dono em `/dono`: criar/editar/desativar escolas, enviar logo e foto, verificar endereço.
```

- [ ] **Step 2:** `npm test && npm run lint && npm run build` → OK.
- [ ] **Step 3: Roteiro manual (Peter)** — colar o SQL; no painel `/dono`, criar "Escola Teste" (subdomínio `teste`), anotar a senha provisória; CNAME `teste` → `cname.vercel-dns.com` no Registro.br e adicionar `teste.statusavalia.com.br` na Vercel; "Verificar endereço"; entrar em `teste.statusavalia.com.br` com o admin (trocar a senha), criar turma e professor; conferir que nada do Status aparece e vice-versa; tentar entrar com conta do Status em `teste.` (mensagem + link); mudar cores e logo; desativar e reativar; conferir o Hermes no Status.
- [ ] **Step 4:** Commit — `git add DESIGN.md && git commit -m "DESIGN: multiescola"`
