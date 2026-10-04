# Contas de aluno + base multi-escola — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alunos entram no mesmo site (conta criada pela escola ou por código de turma) e caem numa área própria; todo dado novo carrega a escola dona, com o Colégio Status como escola nº 1.

**Architecture:** Tabela `alunos_contas` separada de `professores`, mesmo login por cookie HMAC, agora com o tipo da conta no cookie (`p:`/`a:`). O `src/proxy.ts` roteia por tipo sem ir ao banco. Lógica pura (sessão, rotas, usuário sugerido, códigos, senhas) fica em módulos sem dependência de Next/Supabase, testados com `tsx --test`. Server Actions novas em `src/actions/contas-aluno.ts` e `src/actions/convites.ts`.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions, `proxy.ts`), React 19, Supabase (cliente único server-side), bcryptjs, Resend, xlsx, Tailwind 4, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-03-contas-aluno-multiescola-design.md`

## Global Constraints

- Este Next tem mudanças incompatíveis com o que você conhece: antes de usar uma API do Next, leia o guia em `node_modules/next/dist/docs/` (ex.: `next/image` usa `preload`, não `priority`).
- Schema é manual: SQL vai em `db/schema.sql` (anexado ao fim) **e** o Peter cola no SQL Editor do Supabase. Sem migrations.
- Escola padrão: id fixo `00000000-0000-0000-0000-000000000001`, slug `status`.
- Papéis: `dono` | `admin` | `professor`. `dono` passa em toda checagem de admin.
- Cookie: nome `app_auth`, valor `<tipo>:<id>.<assinatura>`, `tipo` ∈ {`p`,`a`}, HMAC-SHA256 com `AUTH_SECRET` sobre `tipo:id`. Cookie sem `:` = professor (legado).
- Email e usuário sempre gravados e comparados em minúsculas, sem espaços nas pontas. Email não pode existir ao mesmo tempo em `professores` e `alunos_contas`.
- Senha mínima: 6 caracteres. Senha provisória: 8 caracteres do alfabeto `ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789`.
- Código de convite: 6 caracteres do alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, guardado sem hífen, exibido `XXX-XXX`.
- Usuário sugerido: `primeironome.ultimosobrenome`, sem acento, minúsculo; repetido → sufixo `2`, `3`…
- Dados do aluno: só nome, email e/ou usuário, escola, turmas (LGPD).
- Textos de interface em português do Brasil, no tom das telas atuais.
- Commit e push no `master` ao fim de cada tarefa (preferência do Peter), com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Hermes (MCP) não ganha acesso a nenhuma tabela nova.

## Review Focus

1. **Aluno logado chamando Server Action de professor**: várias actions aceitam sessão anônima (modelo permissivo) e `getProfessorAtual()` devolve `null` para aluno. Esperado: recusa com erro. Pinado na Task 4 (`exigirNaoAluno` + teste de `verificarSessao`) e na checagem manual da Task 13.
2. **Nomes difíceis no lote**: acentos, nome de uma palavra só, "da/de/dos", dois "Ana Souza" colados na mesma lista. Esperado: `ana.souza` e `ana.souza2`, nunca repetido. Pinado na Task 2.
3. **Código digitado do jeito que der**: minúsculas, com ou sem hífen, com espaços. Esperado: `k7p-4qx`, `K7P4QX` e ` k7p 4qx ` acham o mesmo convite. Pinado na Task 2.
4. **Email com maiúsculas/espaços no login e no cadastro**: `Joao@X.com ` deve logar e deve colidir com `joao@x.com` já cadastrado (inclusive se for de professor). Pinado nas Tasks 2 e 6.
5. **Professor com cookie ou link de redefinição gerado antes do deploy**: continua logado; link antigo continua valendo até expirar. Pinado nas Tasks 3 e 10.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `db/schema.sql` (modificar) | Bloco SQL da spec, anexado ao fim |
| `src/lib/types.ts` (modificar) | Tipos `Escola`, `AlunoConta`, `AlunoTurma`, `ConviteTurma`, papel `dono`, `escola_id` |
| `src/lib/contas-aluno.ts` (criar) | Puro: `sugerirUsuario`, `gerarSenhaProvisoria`, `gerarCodigoConvite`, `normalizarCodigo`, `formatarCodigo`, `normalizarIdentificador`, `ehEmail` |
| `src/lib/sessao.ts` (criar) | Puro: `segredo`, `assinarSessao`, `verificarSessao`, tipo `Sessao` |
| `src/lib/rotas.ts` (criar) | Puro: `destinoDaRota(pathname, sessao)` usado pelo proxy |
| `src/lib/papeis.ts` (criar) | Puro: `ehAdmin(role)` |
| `src/lib/token-senha.ts` (modificar) | Token de redefinição carrega o tipo da conta |
| `src/lib/auth.ts` (modificar) | `getProfessorAtual` só para `p`, `getAlunoAtual`, `exigirNaoAluno`, `iniciarSessao`, `contaDoTokenRedefinicao` |
| `src/lib/escolas.ts` (criar) | `obterEscola`, `obterEscolaPadrao`, `ESCOLA_PADRAO_ID` |
| `src/lib/configuracoes.ts` (modificar) | Código de convite de professor lido de `escolas` |
| `src/lib/email.ts` (modificar) | Remetente/nome da escola nos emails |
| `src/components/layout/EscolaContexto.tsx` (criar) | Contexto cliente com nome/logo da escola + `LogoEscola` |
| `src/proxy.ts` (modificar) | Roteamento por tipo de sessão |
| `src/actions/auth.ts` (modificar) | Login por email ou usuário, esqueci/redefinir para aluno, `trocarSenhaAluno` |
| `src/actions/cadastro.ts` (modificar) | Recusa email de aluno; escola padrão |
| `src/actions/convites.ts` (criar) | Gerar/desativar convite, contas da turma, nova senha pelo professor |
| `src/actions/contas-aluno.ts` (criar) | Cadastro por código, entrar em outra turma, admin: listar/criar/lote/bloquear/nova senha |
| `src/app/aluno/layout.tsx` (criar) | Casca da área do aluno, bloqueio e senha provisória |
| `src/app/aluno/page.tsx` (criar) | Início do aluno |
| `src/app/aluno/trocar-senha/page.tsx` (criar) | Troca de senha do aluno |
| `src/app/aluno/entrar-com-codigo/page.tsx` (criar) | Cadastro público por código |
| `src/app/admin/alunos/page.tsx` (criar) | Página do admin |
| `src/components/admin/GerenciarAlunos.tsx` (criar) | Lista, criar, lote, bloquear, nova senha |
| `src/components/turma/CodigoAlunos.tsx` (criar) | Botão + modal do código da turma |

---

### Task 1: Schema e tipos

**Files:**
- Modify: `db/schema.sql` (fim do arquivo)
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: tipos `Escola`, `AlunoConta`, `AlunoContaComSenha`, `AlunoTurma`, `ConviteTurma`, `ProfessorRole = "dono" | "admin" | "professor"`, `Professor.escola_id`, `Turma.escola_id`; tabelas `escolas`, `alunos_contas`, `aluno_turmas`, `convites_turma` no tipo `Database`.

- [ ] **Step 1: Anexar o SQL ao schema**

Copie, sem alterar, o bloco SQL inteiro da seção "1. Banco de dados" da spec (de `-- ===== Contas de aluno + base multi-escola (2026-10-03) =====` até a última `create policy`) e cole no fim de `db/schema.sql`, depois de uma linha em branco.

- [ ] **Step 2: Atualizar os tipos**

Em `src/lib/types.ts`, adicione `escola_id: string;` a `Turma` (depois de `ano_letivo`) e a `Professor` (depois de `role`), e troque `ProfessorRole`:

```ts
export type ProfessorRole = "dono" | "admin" | "professor";
```

Adicione, antes de `export type Database`:

```ts
export type Escola = {
  id: string;
  nome: string;
  slug: string;
  logo_url: string;
  cor_principal: string | null;
  cor_destaque: string | null;
  slogan: string | null;
  foto_login_url: string | null;
  nome_remetente_email: string;
  codigo_convite_professor: string;
  created_at: string;
};

export type OrigemContaAluno = "escola" | "convite";

export type AlunoConta = {
  id: string;
  escola_id: string;
  nome: string;
  email: string | null;
  usuario: string | null;
  senha_provisoria: boolean;
  email_verificado: boolean;
  ativo: boolean;
  criado_via: OrigemContaAluno;
  ultimo_acesso: string | null;
  created_at: string;
};

/** Linha crua de alunos_contas (com hash e token) — só em actions server-side. */
export type AlunoContaComSenha = AlunoConta & {
  senha_hash: string;
  token_verificacao: string | null;
  token_verificacao_expira: string | null;
};

export type AlunoTurma = {
  conta_id: string;
  escola_id: string;
  turma_nome: string;
  ano_letivo: string;
  aluno_id: string | null;
  created_at: string;
};

export type ConviteTurma = {
  id: string;
  codigo: string;
  escola_id: string;
  turma_nome: string;
  ano_letivo: string;
  criado_por: string | null;
  expira_em: string | null;
  ativo: boolean;
  usos: number;
  created_at: string;
};
```

Dentro de `Database.public.Tables`, depois de `lixeira`, adicione:

```ts
      escolas: {
        Row: Escola;
        Insert: Partial<Omit<Escola, "id" | "created_at">> & {
          nome: string;
          slug: string;
          logo_url: string;
          nome_remetente_email: string;
          codigo_convite_professor: string;
        };
        Update: Partial<Omit<Escola, "id" | "created_at">>;
        Relationships: [];
      };
      alunos_contas: {
        Row: AlunoContaComSenha;
        Insert: Partial<Omit<AlunoContaComSenha, "id" | "created_at">> & {
          escola_id: string;
          nome: string;
          senha_hash: string;
          criado_via: OrigemContaAluno;
        };
        Update: Partial<Omit<AlunoContaComSenha, "id" | "created_at">>;
        Relationships: [];
      };
      aluno_turmas: {
        Row: AlunoTurma;
        Insert: Omit<AlunoTurma, "created_at" | "aluno_id"> & { aluno_id?: string | null };
        Update: Partial<Omit<AlunoTurma, "created_at">>;
        Relationships: [];
      };
      convites_turma: {
        Row: ConviteTurma;
        Insert: Partial<Omit<ConviteTurma, "id" | "created_at">> & {
          codigo: string;
          escola_id: string;
          turma_nome: string;
          ano_letivo: string;
        };
        Update: Partial<Omit<ConviteTurma, "id" | "created_at">>;
        Relationships: [];
      };
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: só erros em lugares que montam `Professor`/`Turma` literais sem `escola_id`. Para cada um: se o objeto vem do banco via `select(...)` com lista de colunas, acrescente `escola_id` à lista (ex.: o `select` de `getProfessorAtual` em `src/lib/auth.ts` vira `"id, nome, email, role, escola_id, email_verificado, senha_provisoria, acesso_restrito, telefone, ultimo_acesso, created_at"`). Repita até `npx tsc --noEmit` sair sem erros.

- [ ] **Step 4: PARAR — Peter cola o SQL**

Mostre ao Peter o bloco SQL do Step 1 e peça para colar no SQL Editor do Supabase. Em seguida, peça o email com que ele entra hoje e entregue para ele rodar: `update professores set role = 'dono' where email = '<email que ele confirmou>';`. Não siga para a Task 5 em diante antes da confirmação dele (Tasks 2–4 são código puro e podem andar).

- [ ] **Step 5: Commit**

```bash
git add db/schema.sql src/lib/types.ts src/lib/auth.ts
git commit -m "Schema e tipos: escolas, contas de aluno, convites de turma"
git push origin master
```

---

### Task 2: Funções puras de conta de aluno

**Files:**
- Create: `src/lib/contas-aluno.ts` (usa `node:crypto` — só servidor)
- Create: `src/lib/codigo-convite.ts` (sem `node:crypto` — usável em componente cliente)
- Test: `src/lib/contas-aluno.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `sugerirUsuario(nome: string, existentes: Set<string>): string` — adiciona o escolhido em `existentes`
  - `gerarSenhaProvisoria(): string`
  - `gerarCodigoConvite(): string` (6 chars, sem hífen)
  - `normalizarCodigo(entrada: string): string`
  - `formatarCodigo(codigo: string): string` (`K7P4QX` → `K7P-4QX`)
  - `normalizarIdentificador(entrada: string): string` (trim + minúsculas)
  - `ehEmail(identificador: string): boolean`

- [ ] **Step 1: Escrever os testes**

```ts
// src/lib/contas-aluno.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ehEmail,
  formatarCodigo,
  gerarCodigoConvite,
  gerarSenhaProvisoria,
  normalizarCodigo,
  normalizarIdentificador,
  sugerirUsuario,
} from "./contas-aluno";

test("usuário sugerido: primeiro nome + último sobrenome, sem acento, minúsculo", () => {
  assert.equal(sugerirUsuario("João da Silva", new Set()), "joao.silva");
  assert.equal(sugerirUsuario("  MARIA   Conceição dos Santos ", new Set()), "maria.santos");
  assert.equal(sugerirUsuario("Ândria Lú", new Set()), "andria.lu");
});

test("usuário sugerido: nome de uma palavra e caracteres estranhos", () => {
  assert.equal(sugerirUsuario("Pelé", new Set()), "pele");
  assert.equal(sugerirUsuario("Ana-Clara O'Neil", new Set()), "anaclara.oneil");
});

test("usuário sugerido: repetido ganha sufixo e entra no conjunto (lote com nomes iguais)", () => {
  const existentes = new Set(["joao.silva"]);
  assert.equal(sugerirUsuario("João Silva", existentes), "joao.silva2");
  assert.equal(sugerirUsuario("Joao Silva", existentes), "joao.silva3");
  const lote = new Set<string>();
  assert.equal(sugerirUsuario("Ana Souza", lote), "ana.souza");
  assert.equal(sugerirUsuario("Ana Souza", lote), "ana.souza2");
});

test("usuário sugerido: nome vazio vira 'aluno'", () => {
  assert.equal(sugerirUsuario("   ", new Set()), "aluno");
});

test("senha provisória: 8 caracteres do alfabeto sem ambíguos", () => {
  for (let i = 0; i < 200; i++) {
    const senha = gerarSenhaProvisoria();
    assert.match(senha, /^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]{8}$/);
  }
});

test("código de convite: 6 caracteres maiúsculos sem ambíguos", () => {
  for (let i = 0; i < 200; i++) {
    assert.match(gerarCodigoConvite(), /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  }
});

test("código de convite: normaliza minúsculas, hífen e espaços", () => {
  assert.equal(normalizarCodigo("k7p-4qx"), "K7P4QX");
  assert.equal(normalizarCodigo(" k7p 4qx "), "K7P4QX");
  assert.equal(normalizarCodigo("K7P4QX"), "K7P4QX");
  assert.equal(formatarCodigo("K7P4QX"), "K7P-4QX");
});

test("identificador do login: trim + minúsculas; com @ é email", () => {
  assert.equal(normalizarIdentificador("  Joao@X.com "), "joao@x.com");
  assert.equal(normalizarIdentificador(" Joao.Silva "), "joao.silva");
  assert.equal(ehEmail("joao@x.com"), true);
  assert.equal(ehEmail("joao.silva"), false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx tsx --test src/lib/contas-aluno.test.ts`
Expected: FAIL — `Cannot find module './contas-aluno'`.

- [ ] **Step 3: Implementar**

```ts
// src/lib/contas-aluno.ts
import { randomInt } from "node:crypto";

const ALFABETO_SENHA = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function sortear(alfabeto: string, tamanho: number): string {
  let saida = "";
  for (let i = 0; i < tamanho; i++) saida += alfabeto[randomInt(alfabeto.length)];
  return saida;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * `primeironome.ultimosobrenome`, sem acento e minúsculo. Se já existir em `existentes`,
 * acrescenta 2, 3… O escolhido entra em `existentes`, então um lote com nomes iguais
 * nunca repete usuário.
 */
export function sugerirUsuario(nome: string, existentes: Set<string>): string {
  const partes = semAcento(nome)
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  const base = partes.length === 0 ? "aluno" : partes.length === 1 ? partes[0] : `${partes[0]}.${partes[partes.length - 1]}`;

  let candidato = base;
  for (let n = 2; existentes.has(candidato); n++) candidato = `${base}${n}`;
  existentes.add(candidato);
  return candidato;
}

export function gerarSenhaProvisoria(): string {
  return sortear(ALFABETO_SENHA, 8);
}

export function gerarCodigoConvite(): string {
  return sortear(ALFABETO_CODIGO, 6);
}

export { formatarCodigo, normalizarCodigo } from "./codigo-convite";

export function normalizarIdentificador(entrada: string): string {
  return entrada.trim().toLowerCase();
}

export function ehEmail(identificador: string): boolean {
  return identificador.includes("@");
}
```

```ts
// src/lib/codigo-convite.ts — sem dependência de Node: o modal do professor (cliente) usa
export function normalizarCodigo(entrada: string): string {
  return entrada.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatarCodigo(codigo: string): string {
  return `${codigo.slice(0, 3)}-${codigo.slice(3)}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsx --test src/lib/contas-aluno.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Incluir no script de teste**

Em `package.json`, o script `test` passa a ser:

```json
"test": "tsx --test src/lib/comandos.test.ts src/lib/lixeira.test.ts src/lib/token-senha.test.ts src/lib/contas-aluno.test.ts"
```

Run: `npm test` — Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/contas-aluno.ts src/lib/codigo-convite.ts src/lib/contas-aluno.test.ts package.json
git commit -m "Contas de aluno: usuario sugerido, senha provisoria e codigo de convite"
git push origin master
```

---

### Task 3: Sessão com tipo de conta e token de redefinição com tipo

**Files:**
- Create: `src/lib/sessao.ts`
- Test: `src/lib/sessao.test.ts`
- Modify: `src/lib/token-senha.ts`, `src/lib/token-senha.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `type TipoConta = "p" | "a"`; `type Sessao = { tipo: TipoConta; id: string }`
  - `segredo(): string` (lê `AUTH_SECRET`; movido de `auth.ts`)
  - `assinarSessao(tipo: TipoConta, id: string, chave: string): string`
  - `verificarSessao(cookie: string | undefined, chave: string): Sessao | null`
  - `gerarTokenRedefinicao(id, senhaHash, chave, agora?, tipo: TipoConta = "p")`
  - `contaDoToken(token: string | undefined): Sessao | null` — sem validar, só para saber qual tabela/hash buscar
  - `validarTokenRedefinicao(token, senhaHash, chave, agora?): Sessao | null` (antes devolvia `string | null`)

- [ ] **Step 1: Escrever os testes de sessão**

```ts
// src/lib/sessao.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { assinarSessao, verificarSessao } from "./sessao";

const ID = "3f1c2a9e-0000-4000-8000-000000000001";
const CHAVE = "segredo-de-teste";

test("assina e valida sessão de professor e de aluno", () => {
  assert.deepEqual(verificarSessao(assinarSessao("p", ID, CHAVE), CHAVE), { tipo: "p", id: ID });
  assert.deepEqual(verificarSessao(assinarSessao("a", ID, CHAVE), CHAVE), { tipo: "a", id: ID });
});

test("trocar 'a' por 'p' no cookie invalida a assinatura", () => {
  const cookieAluno = assinarSessao("a", ID, CHAVE);
  assert.equal(verificarSessao(cookieAluno.replace(/^a:/, "p:"), CHAVE), null);
});

test("cookie legado (sem tipo) é lido como professor", () => {
  const assinatura = createHmac("sha256", CHAVE).update(ID).digest("hex");
  assert.deepEqual(verificarSessao(`${ID}.${assinatura}`, CHAVE), { tipo: "p", id: ID });
});

test("rejeita adulterado, outra chave, tipo desconhecido e lixo", () => {
  const cookie = assinarSessao("p", ID, CHAVE);
  assert.equal(verificarSessao(cookie.slice(0, -1) + "0", CHAVE), null);
  assert.equal(verificarSessao(cookie, "outra-chave"), null);
  const assinaturaX = createHmac("sha256", CHAVE).update(`x:${ID}`).digest("hex");
  assert.equal(verificarSessao(`x:${ID}.${assinaturaX}`, CHAVE), null);
  assert.equal(verificarSessao("lixo", CHAVE), null);
  assert.equal(verificarSessao(undefined, CHAVE), null);
  assert.equal(verificarSessao("", CHAVE), null);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx tsx --test src/lib/sessao.test.ts`
Expected: FAIL — `Cannot find module './sessao'`.

- [ ] **Step 3: Implementar `sessao.ts`**

```ts
// src/lib/sessao.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export type TipoConta = "p" | "a";
export type Sessao = { tipo: TipoConta; id: string };

export function segredo(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Defina AUTH_SECRET.");
  return s;
}

function hmac(texto: string, chave: string): string {
  return createHmac("sha256", chave).update(texto).digest("hex");
}

/** Valor do cookie de sessão: `tipo:id.assinatura`, com a assinatura cobrindo `tipo:id`. */
export function assinarSessao(tipo: TipoConta, id: string, chave: string): string {
  return `${tipo}:${id}.${hmac(`${tipo}:${id}`, chave)}`;
}

/** Sessão do cookie, ou null se inválido/adulterado. Cookie antigo sem `tipo:` é de professor. */
export function verificarSessao(cookie: string | undefined, chave: string): Sessao | null {
  if (!cookie) return null;
  const ponto = cookie.lastIndexOf(".");
  if (ponto <= 0) return null;
  const assinado = cookie.slice(0, ponto);
  const assinatura = cookie.slice(ponto + 1);

  const recebida = Buffer.from(assinatura);
  const esperada = Buffer.from(hmac(assinado, chave));
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;

  const doisPontos = assinado.indexOf(":");
  if (doisPontos === -1) return { tipo: "p", id: assinado };
  const tipo = assinado.slice(0, doisPontos);
  const id = assinado.slice(doisPontos + 1);
  if ((tipo !== "p" && tipo !== "a") || !id) return null;
  return { tipo, id };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsx --test src/lib/sessao.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Testes do token com tipo**

Em `src/lib/token-senha.test.ts`, troque o import por:

```ts
import { contaDoToken, gerarTokenRedefinicao, validarTokenRedefinicao } from "./token-senha";
```

Nos testes existentes, onde se espera `ID` de `validarTokenRedefinicao`, passe a esperar `{ tipo: "p", id: ID }` com `assert.deepEqual` (os `null` ficam iguais). Substitua o último teste (`idDoTokenRedefinicao…`) por:

```ts
test("contaDoToken extrai tipo e id sem validar, e devolve null pra lixo", () => {
  assert.deepEqual(contaDoToken(gerarTokenRedefinicao(ID, HASH, SEGREDO, AGORA)), { tipo: "p", id: ID });
  assert.deepEqual(contaDoToken(gerarTokenRedefinicao(ID, HASH, SEGREDO, AGORA, "a")), { tipo: "a", id: ID });
  assert.equal(contaDoToken("lixo"), null);
  assert.equal(contaDoToken(undefined), null);
});

test("token de aluno valida como aluno e não vira professor se trocar o prefixo", () => {
  const token = gerarTokenRedefinicao(ID, HASH, SEGREDO, AGORA, "a");
  assert.deepEqual(validarTokenRedefinicao(token, HASH, SEGREDO, AGORA), { tipo: "a", id: ID });
  assert.equal(validarTokenRedefinicao(token.replace(/^a~/, ""), HASH, SEGREDO, AGORA), null);
});

test("token legado (gerado antes do tipo existir) continua valendo como professor", () => {
  // formato antigo: id.expira.assinatura, assinatura sobre `redefinir:id:expira:hash`
  const expira = AGORA + 60_000;
  const assinatura = createHmac("sha256", SEGREDO).update(`redefinir:${ID}:${expira}:${HASH}`).digest("hex");
  assert.deepEqual(validarTokenRedefinicao(`${ID}.${expira}.${assinatura}`, HASH, SEGREDO, AGORA), { tipo: "p", id: ID });
});
```

E acrescente no topo do arquivo de teste: `import { createHmac } from "node:crypto";`.

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx tsx --test src/lib/token-senha.test.ts`
Expected: FAIL — `contaDoToken` não exportado.

- [ ] **Step 7: Implementar o token com tipo**

Substitua `src/lib/token-senha.ts` por:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Sessao, TipoConta } from "./sessao";

const VALIDADE_MS = 60 * 60 * 1000;

/** Parte do id no token: `uuid` para professor (formato legado) e `a~uuid` para aluno. */
function parteId(tipo: TipoConta, id: string): string {
  return tipo === "a" ? `a~${id}` : id;
}

function lerParteId(parte: string): Sessao | null {
  if (!parte) return null;
  if (parte.startsWith("a~")) return parte.length > 2 ? { tipo: "a", id: parte.slice(2) } : null;
  return { tipo: "p", id: parte };
}

function assinar(parte: string, expira: number, senhaHash: string, chave: string): string {
  return createHmac("sha256", chave).update(`redefinir:${parte}:${expira}:${senhaHash}`).digest("hex");
}

/**
 * Token do link "esqueci minha senha": `parteId.expira.assinatura`. Não fica salvo no banco —
 * a assinatura inclui o hash atual da senha, então o link morre sozinho assim que a senha muda.
 */
export function gerarTokenRedefinicao(
  id: string,
  senhaHash: string,
  chave: string,
  agora = Date.now(),
  tipo: TipoConta = "p"
): string {
  const expira = agora + VALIDADE_MS;
  const parte = parteId(tipo, id);
  return `${parte}.${expira}.${assinar(parte, expira, senhaHash, chave)}`;
}

/** Tipo e id da conta dona do token, sem validar nada — só pra saber qual hash buscar. */
export function contaDoToken(token: string | undefined): Sessao | null {
  const partes = token?.split(".") ?? [];
  return partes.length === 3 ? lerParteId(partes[0]) : null;
}

/** Conta do token se é autêntico, não expirou e a senha não mudou desde que foi gerado; senão null. */
export function validarTokenRedefinicao(
  token: string,
  senhaHash: string | null,
  chave: string,
  agora = Date.now()
): Sessao | null {
  const [parte, expiraTexto, assinatura] = token.split(".");
  const expira = Number(expiraTexto);
  const conta = lerParteId(parte ?? "");
  if (!conta || !assinatura || !senhaHash || !Number.isFinite(expira) || expira < agora) return null;

  const esperada = Buffer.from(assinar(parte, expira, senhaHash, chave));
  const recebida = Buffer.from(assinatura);
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;
  return conta;
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx tsx --test src/lib/token-senha.test.ts src/lib/sessao.test.ts`
Expected: PASS.

- [ ] **Step 9: Ajustar quem usa as funções antigas**

`src/lib/auth.ts` ainda importa `idDoTokenRedefinicao` e tem `segredo`/`assinarSessao`/`verificarSessao` próprios. Nesta tarefa, só o necessário para compilar (a reescrita completa é a Task 4):
- remova de `auth.ts` as funções `segredo`, `assinarSessao`, `verificarSessao` e o import de `node:crypto`;
- no topo: `import { assinarSessao, segredo, verificarSessao, type Sessao } from "@/lib/sessao";` e `export { segredo } from "@/lib/sessao";`
- substitua `professorDoTokenRedefinicao` por:

```ts
/** Conta (professor ou aluno) dona de um link de "esqueci minha senha" ainda válido, ou null. */
export async function contaDoTokenRedefinicao(token: string | undefined): Promise<Sessao | null> {
  const conta = contaDoToken(token);
  if (!token || !conta) return null;
  const tabela = conta.tipo === "a" ? "alunos_contas" : "professores";
  const { data } = await supabase.from(tabela).select("senha_hash").eq("id", conta.id).maybeSingle();
  return validarTokenRedefinicao(token, data?.senha_hash ?? null, segredo());
}
```

  com `import { contaDoToken, validarTokenRedefinicao } from "@/lib/token-senha";`
- em `getProfessorAtual`: `const sessao = verificarSessao(cookieStore.get(COOKIE_NOME)?.value, segredo()); if (!sessao || sessao.tipo !== "p") return null; const professorId = sessao.id;`
- em `src/actions/auth.ts`: `assinarSessao(professor.id)` → `assinarSessao("p", professor.id, segredo())`; em `redefinirSenha`, `const conta = await contaDoTokenRedefinicao(token); if (!conta || conta.tipo !== "p") redirect("/redefinir-senha?erro=link"); const professorId = conta.id;` (aluno entra na Task 10).
- em `src/app/redefinir-senha/page.tsx`: `professorDoTokenRedefinicao` → `contaDoTokenRedefinicao`.
- em `src/proxy.ts`: `import { COOKIE_NOME } from "@/lib/auth"` continua; `verificarSessao(cookie)` → `verificarSessao(cookie, segredo())` com `import { segredo, verificarSessao } from "@/lib/sessao";` (roteamento por tipo entra na Task 5).

Run: `npx tsc --noEmit` — Expected: sem erros.

- [ ] **Step 10: Script de teste e commit**

Acrescente `src/lib/sessao.test.ts` ao script `test` do `package.json`. Run: `npm test` — Expected: todos PASS.

```bash
git add src/lib/sessao.ts src/lib/sessao.test.ts src/lib/token-senha.ts src/lib/token-senha.test.ts src/lib/auth.ts src/actions/auth.ts src/app/redefinir-senha/page.tsx src/proxy.ts package.json
git commit -m "Sessao e token de redefinicao carregam o tipo da conta"
git push origin master
```

---

### Task 4: Papel dono, conta de aluno no servidor e trava nas actions de professor

**Files:**
- Create: `src/lib/papeis.ts`, `src/lib/papeis.test.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/actions/alunos.ts`, `src/actions/colunas.ts`, `src/actions/notas.ts`, `src/actions/turmas.ts`
- Modify: `src/app/admin/historico/page.tsx`, `src/app/admin/lixeira/page.tsx`, `src/app/admin/professores/page.tsx`, `src/app/layout.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/admin/GerenciarProfessores.tsx`, `src/lib/mcp-tools.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `Sessao`, `assinarSessao`, `verificarSessao`, `segredo` (Task 3); `AlunoConta` (Task 1).
- Produces:
  - `ehAdmin(role: ProfessorRole): boolean` em `src/lib/papeis.ts` (puro, usável em componente cliente)
  - em `src/lib/auth.ts`: `getSessaoAtual(): Promise<Sessao | null>`, `getAlunoAtual(): Promise<AlunoConta | null>`, `exigirNaoAluno(): Promise<void>`, `iniciarSessao(tipo: TipoConta, id: string): Promise<void>`

- [ ] **Step 1: Teste de `ehAdmin`**

```ts
// src/lib/papeis.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { ehAdmin } from "./papeis";

test("dono e admin passam como admin; professor não", () => {
  assert.equal(ehAdmin("dono"), true);
  assert.equal(ehAdmin("admin"), true);
  assert.equal(ehAdmin("professor"), false);
});
```

Run: `npx tsx --test src/lib/papeis.test.ts` — Expected: FAIL (módulo não existe).

- [ ] **Step 2: Implementar `papeis.ts`**

```ts
// src/lib/papeis.ts
import type { ProfessorRole } from "./types";

/** Admin da escola ou dono da plataforma: o dono passa em toda checagem de admin. */
export function ehAdmin(role: ProfessorRole): boolean {
  return role === "admin" || role === "dono";
}
```

Run: `npx tsx --test src/lib/papeis.test.ts` — Expected: PASS. Acrescente o arquivo ao script `test`.

- [ ] **Step 3: Funções de sessão em `auth.ts`**

Acrescente a `src/lib/auth.ts`:

```ts
import type { AlunoConta } from "@/lib/types";
import type { TipoConta } from "@/lib/sessao";
import { ehAdmin } from "@/lib/papeis";

/** Sessão do cookie da requisição atual (professor ou aluno), ou null. */
export async function getSessaoAtual(): Promise<Sessao | null> {
  const cookieStore = await cookies();
  return verificarSessao(cookieStore.get(COOKIE_NOME)?.value, segredo());
}

/** Grava o cookie de sessão (30 dias), igual ao login de professor. */
export async function iniciarSessao(tipo: TipoConta, id: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NOME, assinarSessao(tipo, id, segredo()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

/** Aluno logado e ativo, ou null. Conta bloqueada pela escola some na próxima página. */
export async function getAlunoAtual(): Promise<AlunoConta | null> {
  const sessao = await getSessaoAtual();
  if (!sessao || sessao.tipo !== "a") return null;

  const { data } = await supabase
    .from("alunos_contas")
    .select("id, escola_id, nome, email, usuario, senha_provisoria, email_verificado, ativo, criado_via, ultimo_acesso, created_at")
    .eq("id", sessao.id)
    .maybeSingle();
  if (!data || !data.ativo) return null;

  const desatualizado =
    !data.ultimo_acesso || Date.now() - new Date(data.ultimo_acesso).getTime() > THROTTLE_ULTIMO_ACESSO_MS;
  if (desatualizado) {
    const agora = new Date().toISOString();
    await supabase.from("alunos_contas").update({ ultimo_acesso: agora }).eq("id", sessao.id);
    data.ultimo_acesso = agora;
  }
  return data;
}

/**
 * Lança erro se quem chama é aluno. Use no topo de toda Server Action de professor que
 * aceita requisição sem professor logado (modelo permissivo), porque para um aluno
 * `getProfessorAtual()` devolve null e ele passaria como anônimo.
 */
export async function exigirNaoAluno(): Promise<void> {
  const sessao = await getSessaoAtual();
  if (sessao?.tipo === "a") throw new Error("Essa ação é só para professores.");
}
```

Mova a constante `THROTTLE_ULTIMO_ACESSO_MS` para cima de `getProfessorAtual` se precisar (ela já existe no arquivo). Em `getProfessorAtual`, use `getSessaoAtual()` em vez de ler o cookie diretamente. Em `exigirAdmin`: `if (!atual || !ehAdmin(atual.role))`. Em `turmasLiberadasPara`: `if (ehAdmin(professor.role) || !professor.acesso_restrito) return null;`.

- [ ] **Step 4: Trava nas actions de professor**

Acrescente `await exigirNaoAluno();` como **primeira linha** do corpo destas funções (e o import de `exigirNaoAluno` de `@/lib/auth` em cada arquivo):
- `src/actions/alunos.ts`: `transferirAluno`, `addAluno`, `adicionarAlunos`, `deleteAluno`, `reordenarAlunos`, `renomearAluno`
- `src/actions/colunas.ts`: `addColuna`, `renameColuna`, `deleteColuna`, `reordenarColunas`
- `src/actions/notas.ts`: `upsertCelula`
- `src/actions/turmas.ts`: `listarTurmasAcessiveis`

As demais (`exigirAdmin`, `buscarAlunos`, `dadosExportacao`, `criarBimestre`, `desfazerExclusao`) já recusam quem não é professor.

Em `src/actions/alunos.ts:32`, troque `professor.role !== "admin"` por `!ehAdmin(professor.role)` (import de `@/lib/papeis`).

- [ ] **Step 5: Trocar as checagens de admin restantes**

Troque por `ehAdmin(x.role)` / `!ehAdmin(x.role)` (import de `@/lib/papeis`):
- `src/app/admin/historico/page.tsx:14`, `src/app/admin/lixeira/page.tsx:11`, `src/app/admin/professores/page.tsx:16`
- `src/app/layout.tsx:63` (`ehAdmin={ehAdmin(professor.role)}`)
- `src/components/layout/Sidebar.tsx:24`
- `src/components/admin/GerenciarProfessores.tsx:331, 357, 445`
- `src/lib/mcp-tools.ts:56`

Em `GerenciarProfessores.tsx`, o selo de papel (linha ~331) mostra o texto do papel; onde ele escreve "admin", passe a escrever `p.role === "dono" ? "dono" : p.role`.

Run: `grep -rn 'role === "admin"\|role !== "admin"' src` — Expected: nenhuma linha.
Run: `npx tsc --noEmit && npm test` — Expected: sem erros, todos PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/papeis.ts src/lib/papeis.test.ts src/lib/auth.ts src/actions src/app src/components src/lib/mcp-tools.ts package.json
git commit -m "Papel dono, sessao de aluno no servidor e trava nas actions de professor"
git push origin master
```

---

### Task 5: Roteamento por tipo no proxy

**Files:**
- Create: `src/lib/rotas.ts`, `src/lib/rotas.test.ts`
- Modify: `src/proxy.ts`, `package.json`

**Interfaces:**
- Consumes: `Sessao` (Task 3).
- Produces: `destinoDaRota(pathname: string, sessao: Sessao | null): "seguir" | "/login" | "/aluno" | "/"`; `ehRotaPublica(pathname: string): boolean`.

- [ ] **Step 1: Testes**

```ts
// src/lib/rotas.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { destinoDaRota, ehRotaPublica } from "./rotas";

const P = { tipo: "p" as const, id: "1" };
const A = { tipo: "a" as const, id: "2" };

test("rotas públicas passam para qualquer um", () => {
  for (const r of ["/login", "/cadastro", "/verificar-email", "/esqueci-senha", "/redefinir-senha", "/api/mcp", "/aluno/entrar-com-codigo", "/logo.png"]) {
    assert.equal(ehRotaPublica(r), true, r);
    assert.equal(destinoDaRota(r, null), "seguir", r);
  }
});

test("sem sessão em rota protegida vai para /login", () => {
  assert.equal(destinoDaRota("/", null), "/login");
  assert.equal(destinoDaRota("/aluno", null), "/login");
});

test("aluno só abre /aluno/*", () => {
  assert.equal(destinoDaRota("/aluno", A), "seguir");
  assert.equal(destinoDaRota("/aluno/trocar-senha", A), "seguir");
  assert.equal(destinoDaRota("/", A), "/aluno");
  assert.equal(destinoDaRota("/admin/professores", A), "/aluno");
  assert.equal(destinoDaRota("/turma/abc", A), "/aluno");
});

test("professor não abre /aluno/*, exceto a página pública de código", () => {
  assert.equal(destinoDaRota("/", P), "seguir");
  assert.equal(destinoDaRota("/aluno", P), "/");
  assert.equal(destinoDaRota("/alunos-qualquer", P), "seguir");
  assert.equal(destinoDaRota("/aluno/entrar-com-codigo", P), "seguir");
});
```

Run: `npx tsx --test src/lib/rotas.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implementar**

```ts
// src/lib/rotas.ts
import type { Sessao } from "./sessao";

const PREFIXOS_PUBLICOS = [
  "/login",
  "/cadastro",
  "/verificar-email",
  "/esqueci-senha",
  "/redefinir-senha",
  "/api/mcp",
  "/aluno/entrar-com-codigo",
];

export function ehRotaPublica(pathname: string): boolean {
  return PREFIXOS_PUBLICOS.some((p) => pathname.startsWith(p)) || /\.(?:png|jpe?g|webp|svg|ico|gif|mp4)$/i.test(pathname);
}

function ehAreaAluno(pathname: string): boolean {
  return pathname === "/aluno" || pathname.startsWith("/aluno/");
}

/** Para onde a requisição vai: segue, ou redireciona conforme o tipo da sessão. */
export function destinoDaRota(pathname: string, sessao: Sessao | null): "seguir" | "/login" | "/aluno" | "/" {
  if (ehRotaPublica(pathname)) return "seguir";
  if (!sessao) return "/login";
  if (sessao.tipo === "a") return ehAreaAluno(pathname) ? "seguir" : "/aluno";
  return ehAreaAluno(pathname) ? "/" : "seguir";
}
```

Run: `npx tsx --test src/lib/rotas.test.ts` — Expected: PASS. Acrescente ao script `test`.

- [ ] **Step 3: Usar no proxy**

Substitua o corpo de `proxy` em `src/proxy.ts`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NOME } from "@/lib/auth";
import { segredo, verificarSessao } from "@/lib/sessao";
import { destinoDaRota } from "@/lib/rotas";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessao = verificarSessao(request.cookies.get(COOKIE_NOME)?.value, segredo());
  const destino = destinoDaRota(pathname, sessao);

  if (destino !== "seguir") {
    return NextResponse.redirect(new URL(destino, request.url));
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}
```

Mantenha o `export const config` atual. Atenção: `COOKIE_NOME` vem de `@/lib/auth`, que importa `next/headers` e o Supabase. Se o build reclamar disso no proxy, mova `COOKIE_NOME` para `src/lib/sessao.ts` e reexporte de `auth.ts` (`export { COOKIE_NOME } from "@/lib/sessao"`).

Run: `npx tsc --noEmit && npm test` — Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add src/lib/rotas.ts src/lib/rotas.test.ts src/proxy.ts src/lib/sessao.ts src/lib/auth.ts package.json
git commit -m "Proxy roteia por tipo de conta: aluno so abre /aluno"
git push origin master
```

---

### Task 6: Login por email ou usuário

**Files:**
- Modify: `src/actions/auth.ts` (função `login`)
- Modify: `src/app/login/page.tsx`
- Modify: `src/actions/cadastro.ts`

**Interfaces:**
- Consumes: `normalizarIdentificador`, `ehEmail` (Task 2); `iniciarSessao` (Task 4).
- Produces: formulário de login com campo `identificador`; erros `?erro=1`, `?erro=nao-verificado`, `?erro=bloqueado`.

- [ ] **Step 1: Reescrever `login`**

```ts
export async function login(formData: FormData) {
  const identificador = normalizarIdentificador(String(formData.get("identificador") ?? ""));
  const senha = String(formData.get("senha") ?? "");
  if (!identificador || !senha) redirect("/login?erro=1");

  if (ehEmail(identificador)) {
    const { data: professor } = await supabase
      .from("professores")
      .select("id, senha_hash, email_verificado, senha_provisoria")
      .eq("email", identificador)
      .maybeSingle();
    if (professor) {
      if (!(await bcrypt.compare(senha, professor.senha_hash))) redirect("/login?erro=1");
      if (!professor.email_verificado) redirect("/login?erro=nao-verificado");
      await iniciarSessao("p", professor.id);
      redirect(professor.senha_provisoria ? "/trocar-senha" : "/");
    }
  }

  const { data: aluno } = await supabase
    .from("alunos_contas")
    .select("id, senha_hash, email_verificado, senha_provisoria, ativo, criado_via")
    .eq(ehEmail(identificador) ? "email" : "usuario", identificador)
    .maybeSingle();

  if (!aluno || !(await bcrypt.compare(senha, aluno.senha_hash))) redirect("/login?erro=1");
  if (!aluno.ativo) redirect("/login?erro=bloqueado");
  // Conta por código entra com email: precisa confirmar antes. Conta criada pela escola entra com usuário.
  if (aluno.criado_via === "convite" && !aluno.email_verificado) redirect("/login?erro=nao-verificado");

  await iniciarSessao("a", aluno.id);
  redirect(aluno.senha_provisoria ? "/aluno/trocar-senha" : "/aluno");
}
```

Imports: `normalizarIdentificador`, `ehEmail` de `@/lib/contas-aluno`; `iniciarSessao` de `@/lib/auth`. Remova o import de `assinarSessao` se ficar sem uso.

- [ ] **Step 2: Tela de login**

Em `src/app/login/page.tsx`:
- `MENSAGENS_ERRO`: `"1": "Email, usuário ou senha incorretos. Tente novamente."` e acrescente `bloqueado: "Sua conta está bloqueada. Fale com a sua escola."`
- troque o `<label>` do email por:

```tsx
<label className="flex flex-col gap-2 text-sm text-frame-muted">
  Email ou usuário
  <input type="text" name="identificador" required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="seu.email@exemplo.com ou joao.silva" className={`${authInput} min-h-12`} />
</label>
```

- logo abaixo do link "Não tem conta? Cadastre-se", acrescente:

```tsx
<Link href="/aluno/entrar-com-codigo" className="text-center text-sm text-frame-muted hover:text-white hover:underline">
  Sou aluno e tenho um código
</Link>
```

- [ ] **Step 3: Cadastro de professor recusa email de aluno**

Em `src/actions/cadastro.ts`, logo depois da checagem de campos vazios:

```ts
const { data: contaAluno } = await supabase.from("alunos_contas").select("id").eq("email", email).maybeSingle();
if (contaAluno) redirect("/cadastro?erro=duplicado");
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npx eslint src/actions/auth.ts src/app/login/page.tsx src/actions/cadastro.ts` — Expected: sem erros.
Manual (`npm run dev`): professor existente entra digitando o email com maiúsculas e espaço no fim (`  SeuEmail@Dominio.com `) → cai em `/`.

- [ ] **Step 5: Commit**

```bash
git add src/actions/auth.ts src/app/login/page.tsx src/actions/cadastro.ts
git commit -m "Login aceita email ou usuario e encaminha aluno para /aluno"
git push origin master
```

---

### Task 7: Escola no servidor, marca da escola e emails

**Files:**
- Create: `src/lib/escolas.ts`, `src/components/layout/EscolaContexto.tsx`
- Modify: `src/lib/configuracoes.ts`, `src/actions/configuracoes.ts`
- Modify: `src/app/layout.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/PageLayout.tsx`
- Modify: `src/lib/email.ts`, `src/actions/cadastro.ts`, `src/actions/auth.ts`

**Interfaces:**
- Produces:
  - `ESCOLA_PADRAO_ID: string`; `obterEscola(id: string): Promise<Escola>`; `obterEscolaPadrao(): Promise<Escola>` (ambas com `cache` do React)
  - `type MarcaEscola = { nome: string; logo_url: string }`; `<EscolaProvider marca>`; `useMarcaEscola(): MarcaEscola`; `<LogoEscola className />`
  - `enviarEmailVerificacao(destinatario, nome, link, escola: MarcaEmail)` e `enviarEmailRedefinicaoSenha(destinatario, nome, link, escola: MarcaEmail)` com `type MarcaEmail = { nome: string; nome_remetente_email: string }`

- [ ] **Step 1: `src/lib/escolas.ts`**

```ts
import { cache } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Escola } from "@/lib/types";

export const ESCOLA_PADRAO_ID = "00000000-0000-0000-0000-000000000001";

export const obterEscola = cache(async (id: string): Promise<Escola> => {
  const { data, error } = await supabase.from("escolas").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Escola não encontrada.");
  return data;
});

/** Escola das telas antes do login (por enquanto, sempre o Colégio Status). */
export const obterEscolaPadrao = cache(() => obterEscola(ESCOLA_PADRAO_ID));
```

- [ ] **Step 2: Código de convite de professor vem da escola**

`src/lib/configuracoes.ts`:

```ts
import { obterEscolaPadrao } from "@/lib/escolas";

/** Código de convite exigido no cadastro público de professor (por escola). */
export async function obterCodigoConvite(): Promise<string | null> {
  const escola = await obterEscolaPadrao();
  return escola.codigo_convite_professor;
}
```

`src/actions/configuracoes.ts`: o update passa a ser
`supabase.from("escolas").update({ codigo_convite_professor: codigoLimpo }).eq("id", (await getProfessorAtual())!.escola_id)` — importe `getProfessorAtual` (o `exigirAdmin()` acima garante que existe).

- [ ] **Step 3: Contexto da marca**

```tsx
// src/components/layout/EscolaContexto.tsx
"use client";

import Image from "next/image";
import { createContext, useContext } from "react";

export type MarcaEscola = { nome: string; logo_url: string };

const MARCA_PADRAO: MarcaEscola = { nome: "Colégio Status", logo_url: "/logo-status-branca.png" };
const Contexto = createContext<MarcaEscola>(MARCA_PADRAO);

export function EscolaProvider({ marca, children }: { marca: MarcaEscola; children: React.ReactNode }) {
  return <Contexto.Provider value={marca}>{children}</Contexto.Provider>;
}

export function useMarcaEscola(): MarcaEscola {
  return useContext(Contexto);
}

/** Logo branca da escola de quem está logado. */
export function LogoEscola({ className }: { className?: string }) {
  const { nome, logo_url } = useMarcaEscola();
  return <Image src={logo_url} alt={nome} width={1580} height={513} className={className} preload />;
}
```

Antes de escrever, confira em `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` se `logo_url` externo exigiria `images.remotePatterns` — por ora os logos ficam em `/public`, então não.

- [ ] **Step 4: Layout raiz entrega a marca**

Em `src/app/layout.tsx`, depois de obter `professor`:

```ts
const escola = professor ? await obterEscola(professor.escola_id) : await obterEscolaPadrao();
```

e envolva o conteúdo de `<body>` (de `<CommandProvider>` até o fechamento dele) com
`<EscolaProvider marca={{ nome: escola.nome, logo_url: escola.logo_url }}>…</EscolaProvider>`.

Em `Sidebar.tsx`: troque o `<Image …logo-status-branca…>` por `<LogoEscola className="h-7 w-auto" />` e o `aria-label="Colégio Status — início"` por `` aria-label={`${nome} — início`} `` com `const { nome } = useMarcaEscola();` (chame o hook antes do `if (!professor) return null;`). Remova o import de `Image` se sobrar sem uso.

Em `PageLayout.tsx`: mesma troca (`<LogoEscola className="h-auto w-40 lg:w-52" />`). Como `PageLayout` não é componente cliente, troque o `aria-label` por um fixo `"Início"` e deixe o nome da escola no `alt` da logo.

- [ ] **Step 5: Emails com a marca da escola**

Em `src/lib/email.ts`, as duas funções ganham o último parâmetro `escola: MarcaEmail` e usam:
- `from: \`${escola.nome_remetente_email} <onboarding@resend.dev>\``
- assunto e texto: troque "Avalia" por `${escola.nome}` (ex.: `subject: \`Confirme seu email — ${escola.nome}\``).

Exporte `export type MarcaEmail = { nome: string; nome_remetente_email: string };`.

Atualize as chamadas: em `src/actions/cadastro.ts` e em `pedirRedefinicaoSenha` (`src/actions/auth.ts`), passe `await obterEscolaPadrao()`.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm run lint` — Expected: sem erros.
Manual: barra lateral e cabeçalho das páginas mostram a logo do Status como antes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/escolas.ts src/components/layout/EscolaContexto.tsx src/lib/configuracoes.ts src/actions/configuracoes.ts src/app/layout.tsx src/components/layout/Sidebar.tsx src/components/layout/PageLayout.tsx src/lib/email.ts src/actions/cadastro.ts src/actions/auth.ts
git commit -m "Marca e codigo de convite vem da escola; emails com o nome da escola"
git push origin master
```

---

### Task 8: Área do aluno (casca, início, trocar senha, entrar em outra turma)

**Files:**
- Create: `src/app/aluno/layout.tsx`, `src/app/aluno/page.tsx`, `src/app/aluno/trocar-senha/page.tsx`
- Create: `src/lib/convites.ts`
- Create: `src/actions/contas-aluno.ts` (primeiras funções)
- Modify: `src/actions/auth.ts` (`trocarSenhaAluno`)
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `getAlunoAtual` (Task 4), `obterEscola` (Task 7), `normalizarCodigo` (Task 2).
- Produces:
  - `buscarConviteValido(codigo: string): Promise<ConviteValido | null>` com `type ConviteValido = { id: string; codigo: string; escola_id: string; escola_nome: string; turma_nome: string; ano_letivo: string }`
  - `entrarEmTurmaComCodigo(formData: FormData): Promise<void>` (action de formulário; redireciona para `/aluno?turma=ok` ou `/aluno?erro=codigo`)
  - em `src/lib/convites.ts` (não é action): `type ConviteValido`, `vincularContaAoConvite(contaId: string, convite: ConviteValido): Promise<void>`, `listarMinhasTurmas(contaId: string): Promise<AlunoTurma[]>`
  - `trocarSenhaAluno(formData: FormData): Promise<void>`

- [ ] **Step 1: Vínculo conta↔turma em `src/lib/convites.ts`**

Fica fora de um arquivo `"use server"` de propósito: tudo que um arquivo `"use server"` exporta vira action chamável do navegador, e ligar uma conta a qualquer turma não pode ser chamável.

```ts
// src/lib/convites.ts
import { supabase } from "@/lib/supabase/client";

export type ConviteValido = {
  id: string;
  codigo: string;
  escola_id: string;
  escola_nome: string;
  turma_nome: string;
  ano_letivo: string;
};

/** Liga a conta à turma do convite (sem duplicar) e conta mais um uso. */
export async function vincularContaAoConvite(contaId: string, convite: ConviteValido): Promise<void> {
  const { error } = await supabase.from("aluno_turmas").upsert(
    { conta_id: contaId, escola_id: convite.escola_id, turma_nome: convite.turma_nome, ano_letivo: convite.ano_letivo },
    { onConflict: "conta_id,turma_nome,ano_letivo", ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
  const { data: atual } = await supabase.from("convites_turma").select("usos").eq("id", convite.id).single();
  await supabase.from("convites_turma").update({ usos: (atual?.usos ?? 0) + 1 }).eq("id", convite.id);
}

/** Turmas de uma conta. Chamar só com o id do aluno logado. */
export async function listarMinhasTurmas(contaId: string): Promise<AlunoTurma[]> {
  const { data } = await supabase
    .from("aluno_turmas")
    .select("*")
    .eq("conta_id", contaId)
    .order("ano_letivo", { ascending: false })
    .order("turma_nome");
  return data ?? [];
}
```

(acrescente `import type { AlunoTurma } from "@/lib/types";` no topo de `src/lib/convites.ts`)

- [ ] **Step 1b: Funções de convite e turmas em `src/actions/contas-aluno.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual } from "@/lib/auth";
import { normalizarCodigo } from "@/lib/codigo-convite";
import { vincularContaAoConvite, type ConviteValido } from "@/lib/convites";

/** Convite ativo e dentro da validade para o código digitado (em qualquer formato), ou null. */
export async function buscarConviteValido(codigoDigitado: string): Promise<ConviteValido | null> {
  const codigo = normalizarCodigo(codigoDigitado);
  if (codigo.length !== 6) return null;
  const { data } = await supabase
    .from("convites_turma")
    .select("id, codigo, escola_id, turma_nome, ano_letivo, expira_em, ativo, escolas(nome)")
    .eq("codigo", codigo)
    .maybeSingle();
  if (!data || !data.ativo) return null;
  if (data.expira_em && new Date(data.expira_em) < new Date()) return null;
  const escola = data.escolas as unknown as { nome: string } | null;
  return {
    id: data.id,
    codigo: data.codigo,
    escola_id: data.escola_id,
    escola_nome: escola?.nome ?? "",
    turma_nome: data.turma_nome,
    ano_letivo: data.ano_letivo,
  };
}

/** Aluno já logado digita um código novo para entrar em outra turma. */
export async function entrarEmTurmaComCodigo(formData: FormData): Promise<void> {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const convite = await buscarConviteValido(String(formData.get("codigo") ?? ""));
  if (!convite || convite.escola_id !== aluno.escola_id) redirect("/aluno?erro=codigo");
  await vincularContaAoConvite(aluno.id, convite);
  redirect("/aluno?turma=ok");
}
```

Para o `escolas(nome)` no `select` funcionar com o tipo `Database` atual (que tem `Relationships: []`), o cast `as unknown as` acima resolve o tipo; confira no dev que o Supabase devolve o objeto `escolas` (a FK `convites_turma.escola_id → escolas.id` existe no SQL).

`buscarConviteValido` pode ficar como action: ela só confirma se um código existe e mostra escola e turma, que é justamente o que a tela pública faz.

- [ ] **Step 2: `trocarSenhaAluno` em `src/actions/auth.ts`**

```ts
export async function trocarSenhaAluno(formData: FormData) {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");

  const senhaAtual = String(formData.get("senhaAtual") ?? "");
  const novaSenha = String(formData.get("novaSenha") ?? "");
  const confirmarSenha = String(formData.get("confirmarSenha") ?? "");

  const { data: registro } = await supabase.from("alunos_contas").select("senha_hash").eq("id", aluno.id).single();
  if (!registro || !(await bcrypt.compare(senhaAtual, registro.senha_hash))) redirect("/aluno/trocar-senha?erro=senha-atual");
  if (novaSenha.length < 6) redirect("/aluno/trocar-senha?erro=curta");
  if (novaSenha !== confirmarSenha) redirect("/aluno/trocar-senha?erro=confirmacao");

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  const { error } = await supabase.from("alunos_contas").update({ senha_hash: senhaHash, senha_provisoria: false }).eq("id", aluno.id);
  if (error) redirect("/aluno/trocar-senha?erro=falha");
  redirect("/aluno?senha=ok");
}
```

- [ ] **Step 3: Layout raiz não mostra nada de professor para aluno**

Nada a mudar em `src/app/layout.tsx` além da Task 7: para aluno, `getProfessorAtual()` é null, então a barra lateral e a paleta não aparecem. Para a marca, troque a linha da escola por:

```ts
const aluno = professor ? null : await getAlunoAtual();
const escola = await obterEscola(professor?.escola_id ?? aluno?.escola_id ?? ESCOLA_PADRAO_ID);
```

- [ ] **Step 4: `src/app/aluno/layout.tsx`**

```tsx
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { getAlunoAtual } from "@/lib/auth";
import { LogoEscola } from "@/components/layout/EscolaContexto";

export const dynamic = "force-dynamic";

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname.startsWith("/aluno/entrar-com-codigo")) return <>{children}</>;

  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login?erro=bloqueado");
  if (aluno.senha_provisoria && pathname !== "/aluno/trocar-senha") redirect("/aluno/trocar-senha");

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="bg-frame-deep text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/aluno" aria-label="Início" className="rounded">
            <LogoEscola className="h-8 w-auto" />
          </Link>
          <nav aria-label="Conta" className="flex items-center gap-1 text-sm">
            <span className="mr-2 hidden text-frame-muted sm:inline">{aluno.nome}</span>
            <Link href="/aluno/trocar-senha" className="flex min-h-10 items-center gap-1.5 rounded-control px-3 hover:bg-white/10">
              <KeyRound size={16} aria-hidden="true" /> Senha
            </Link>
            <form action={logout}>
              <button type="submit" className="flex min-h-10 items-center gap-1.5 rounded-control px-3 hover:bg-danger/20">
                <LogOut size={16} aria-hidden="true" /> Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
```

Observação: `redirect("/login?erro=bloqueado")` também cobre conta inexistente; o cookie velho é sobrescrito no próximo login.

- [ ] **Step 5: `src/app/aluno/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { BookOpen, ClipboardCheck } from "lucide-react";
import { getAlunoAtual } from "@/lib/auth";
import { obterEscola } from "@/lib/escolas";
import { entrarEmTurmaComCodigo } from "@/actions/contas-aluno";
import { listarMinhasTurmas } from "@/lib/convites";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ erro?: string; turma?: string; senha?: string }> };

export default async function AlunoInicioPage({ searchParams }: Props) {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const [{ erro, turma, senha }, escola, turmas] = await Promise.all([
    searchParams,
    obterEscola(aluno.escola_id),
    listarMinhasTurmas(aluno.id),
  ]);

  return (
    <>
      <div>
        <p className={estilos.rotulo}>{escola.nome}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Olá, {aluno.nome.split(" ")[0]}!</h1>
      </div>

      {senha === "ok" && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">Senha alterada.</p>}
      {turma === "ok" && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">Pronto! Você entrou na turma.</p>}

      <section aria-labelledby="titulo-turmas" className={`${estilos.card} p-5`}>
        <h2 id="titulo-turmas" className="font-semibold text-ink">Minhas turmas</h2>
        {turmas.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Você ainda não está em nenhuma turma. Peça o código ao seu professor.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {turmas.map((t) => (
              <li key={`${t.turma_nome}|${t.ano_letivo}`} className="rounded-control bg-surface-sunken px-3 py-1.5 text-sm text-ink">
                {t.turma_nome} · {t.ano_letivo}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { titulo: "Aulas", texto: "Videoaulas e materiais dos seus professores.", Icone: BookOpen },
          { titulo: "Simulados", texto: "Simulados das bancas com correção na hora.", Icone: ClipboardCheck },
        ].map(({ titulo, texto, Icone }) => (
          <div key={titulo} className={`${estilos.card} flex items-start gap-3 p-5 opacity-80`}>
            <Icone size={22} className="mt-0.5 text-brand" aria-hidden="true" />
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-ink">
                {titulo}
                <span className="rounded bg-gold/40 px-1.5 py-0.5 text-xs font-medium text-gold-ink">Em breve</span>
              </h2>
              <p className="mt-1 text-sm text-muted">{texto}</p>
            </div>
          </div>
        ))}
      </div>

      <section aria-labelledby="titulo-outra-turma" className={`${estilos.card} p-5`}>
        <h2 id="titulo-outra-turma" className="font-semibold text-ink">Entrar em outra turma</h2>
        <p className="mt-1 text-sm text-muted">Mudou de turma ou de ano? Digite o código que o professor passou.</p>
        {erro === "codigo" && <p role="alert" className="mt-3 rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">Código inválido. Confira com seu professor.</p>}
        <form action={entrarEmTurmaComCodigo} className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="codigo-turma">Código da turma</label>
          <input id="codigo-turma" name="codigo" required placeholder="K7P-4QX" autoCapitalize="characters" className={`${estilos.input} max-w-40 font-mono uppercase tracking-widest`} />
          <button type="submit" className={estilos.botaoPrimario}>Entrar na turma</button>
        </form>
      </section>
    </>
  );
}
```

- [ ] **Step 6: `src/app/aluno/trocar-senha/page.tsx`**

Copie a estrutura de `src/app/trocar-senha/page.tsx` (leia-a primeiro), trocando: a action para `trocarSenhaAluno`; os redirecionamentos de erro para `/aluno/trocar-senha?erro=…`; e, quando `aluno.senha_provisoria` for true, o subtítulo para "Crie uma senha sua para continuar. A senha que a escola passou é provisória." Use os mesmos códigos de erro (`senha-atual`, `curta`, `confirmacao`, `falha`) e as mesmas mensagens da página de professor.

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test` — Expected: OK.
Manual: crie no SQL Editor uma conta de teste (`insert into alunos_contas (escola_id, nome, usuario, senha_hash, senha_provisoria, criado_via) values ('00000000-0000-0000-0000-000000000001', 'Teste Aluno', 'teste.aluno', '<hash bcrypt de "Abc12345" gerado com: node -e "console.log(require(\'bcryptjs\').hashSync(\'Abc12345\',10))">', true, 'escola');`). Entre com `teste.aluno` → vai para `/aluno/trocar-senha`; troque → `/aluno`; abrir `/` leva de volta a `/aluno`.

- [ ] **Step 8: Commit**

```bash
git add src/app/aluno src/actions/contas-aluno.ts src/lib/convites.ts src/actions/auth.ts src/app/layout.tsx
git commit -m "Area do aluno: inicio, trocar senha e entrar em outra turma por codigo"
git push origin master
```

---

### Task 9: Código da turma para o professor

**Files:**
- Create: `src/actions/convites.ts`
- Create: `src/components/turma/CodigoAlunos.tsx`
- Modify: `src/components/turma/TurmaDashboard.tsx` (prop `acoes`)

**Interfaces:**
- Consumes: `gerarCodigoConvite`, `formatarCodigo`, `gerarSenhaProvisoria` (Task 2); `getProfessorAtual`, `professorTemAcessoATurma` (existentes); `ehAdmin` (Task 4).
- Produces:
  - `type PainelCodigoTurma = { convite: { id: string; codigo: string; expira_em: string | null; usos: number } | null; contas: { id: string; nome: string; usuario: string | null; email: string | null; ativo: boolean; ultimo_acesso: string | null }[] }`
  - `obterPainelCodigoTurma(turmaId: string): Promise<PainelCodigoTurma>`
  - `gerarConviteTurma(turmaId: string, validadeDias: 7 | 30 | null): Promise<PainelCodigoTurma>`
  - `desativarConviteTurma(turmaId: string): Promise<PainelCodigoTurma>`
  - `novaSenhaAlunoPeloProfessor(turmaId: string, contaId: string): Promise<string>` (senha provisória em texto, mostrada uma vez)

- [ ] **Step 1: `src/actions/convites.ts`**

```ts
"use server";

import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { getProfessorAtual, professorTemAcessoATurma } from "@/lib/auth";
import { gerarCodigoConvite, gerarSenhaProvisoria } from "@/lib/contas-aluno";
import type { Professor, Turma } from "@/lib/types";

export type PainelCodigoTurma = {
  convite: { id: string; codigo: string; expira_em: string | null; usos: number } | null;
  contas: { id: string; nome: string; usuario: string | null; email: string | null; ativo: boolean; ultimo_acesso: string | null }[];
};

/** Professor logado com acesso à turma (da escola dele), e a turma. */
async function exigirTurma(turmaId: string): Promise<{ professor: Professor; turma: Turma }> {
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  const { data: turma } = await supabase.from("turmas").select("*").eq("id", turmaId).single();
  if (!turma || turma.escola_id !== professor.escola_id || !(await professorTemAcessoATurma(professor, turma.nome))) {
    throw new Error("Você não tem acesso a essa turma.");
  }
  return { professor, turma };
}

async function montarPainel(turma: Turma): Promise<PainelCodigoTurma> {
  const [{ data: convite }, { data: vinculos }] = await Promise.all([
    supabase
      .from("convites_turma")
      .select("id, codigo, expira_em, usos")
      .eq("escola_id", turma.escola_id)
      .eq("turma_nome", turma.nome)
      .eq("ano_letivo", turma.ano_letivo)
      .eq("ativo", true)
      .maybeSingle(),
    supabase
      .from("aluno_turmas")
      .select("conta_id")
      .eq("escola_id", turma.escola_id)
      .eq("turma_nome", turma.nome)
      .eq("ano_letivo", turma.ano_letivo),
  ]);
  const ids = (vinculos ?? []).map((v) => v.conta_id);
  const { data: contas } = ids.length
    ? await supabase.from("alunos_contas").select("id, nome, usuario, email, ativo, ultimo_acesso").in("id", ids).order("nome")
    : { data: [] };
  return { convite: convite ?? null, contas: contas ?? [] };
}

export async function obterPainelCodigoTurma(turmaId: string): Promise<PainelCodigoTurma> {
  const { turma } = await exigirTurma(turmaId);
  return montarPainel(turma);
}

/** Gera um código novo para a turma e o ano; o anterior (se houver) é desativado. */
export async function gerarConviteTurma(turmaId: string, validadeDias: 7 | 30 | null): Promise<PainelCodigoTurma> {
  const { professor, turma } = await exigirTurma(turmaId);
  await supabase
    .from("convites_turma")
    .update({ ativo: false })
    .eq("escola_id", turma.escola_id)
    .eq("turma_nome", turma.nome)
    .eq("ano_letivo", turma.ano_letivo);

  const expira_em = validadeDias ? new Date(Date.now() + validadeDias * 86_400_000).toISOString() : null;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { error } = await supabase.from("convites_turma").insert({
      codigo: gerarCodigoConvite(),
      escola_id: turma.escola_id,
      turma_nome: turma.nome,
      ano_letivo: turma.ano_letivo,
      criado_por: professor.id,
      expira_em,
    });
    if (!error) return montarPainel(turma);
    if (error.code !== "23505") throw new Error(error.message); // 23505 = código repetido: sorteia de novo
  }
  throw new Error("Não foi possível gerar o código. Tente de novo.");
}

export async function desativarConviteTurma(turmaId: string): Promise<PainelCodigoTurma> {
  const { turma } = await exigirTurma(turmaId);
  await supabase
    .from("convites_turma")
    .update({ ativo: false })
    .eq("escola_id", turma.escola_id)
    .eq("turma_nome", turma.nome)
    .eq("ano_letivo", turma.ano_letivo);
  return montarPainel(turma);
}

/** Nova senha provisória para um aluno da turma. Devolvida uma vez para o professor repassar. */
export async function novaSenhaAlunoPeloProfessor(turmaId: string, contaId: string): Promise<string> {
  const { turma } = await exigirTurma(turmaId);
  const { data: vinculo } = await supabase
    .from("aluno_turmas")
    .select("conta_id")
    .eq("conta_id", contaId)
    .eq("escola_id", turma.escola_id)
    .eq("turma_nome", turma.nome)
    .eq("ano_letivo", turma.ano_letivo)
    .maybeSingle();
  if (!vinculo) throw new Error("Esse aluno não está nessa turma.");

  const senha = gerarSenhaProvisoria();
  const { error } = await supabase
    .from("alunos_contas")
    .update({ senha_hash: await bcrypt.hash(senha, 10), senha_provisoria: true })
    .eq("id", contaId);
  if (error) throw new Error(error.message);
  return senha;
}
```

- [ ] **Step 2: `src/components/turma/CodigoAlunos.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Copy, KeyRound, Ticket } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { estilos } from "@/components/ui/estilos";
import { formatarCodigo } from "@/lib/codigo-convite";
import {
  desativarConviteTurma,
  gerarConviteTurma,
  novaSenhaAlunoPeloProfessor,
  obterPainelCodigoTurma,
  type PainelCodigoTurma,
} from "@/actions/convites";

export function CodigoAlunos({ turmaId }: { turmaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [painel, setPainel] = useState<PainelCodigoTurma | null>(null);
  const [validade, setValidade] = useState<"7" | "30" | "sem">("30");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<{ nome: string; senha: string } | null>(null);

  async function executar(acao: () => Promise<PainelCodigoTurma | void>) {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await acao();
      if (resultado) setPainel(resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  function abrir() {
    setAberto(true);
    setSenhaGerada(null);
    void executar(() => obterPainelCodigoTurma(turmaId));
  }

  const convite = painel?.convite ?? null;

  return (
    <>
      <button type="button" onClick={abrir} className={estilos.botaoSecundario}>
        <Ticket size={16} aria-hidden="true" /> Código para alunos
      </button>
      <Modal open={aberto} onClose={() => setAberto(false)} titulo="Código para alunos" descricao="O aluno usa este código em “Sou aluno e tenho um código”, na tela de login." largura="md">
        <div className="flex flex-col gap-4">
          {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}

          {convite ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-control bg-surface-sunken px-4 py-2 font-mono text-2xl tracking-widest text-brand">{formatarCodigo(convite.codigo)}</span>
              <button type="button" onClick={() => navigator.clipboard.writeText(formatarCodigo(convite.codigo))} className={estilos.botaoFantasma}>
                <Copy size={15} aria-hidden="true" /> Copiar
              </button>
              <p className="w-full text-xs text-muted">
                {convite.usos} {convite.usos === 1 ? "aluno entrou" : "alunos entraram"} ·{" "}
                {convite.expira_em ? `vale até ${new Date(convite.expira_em).toLocaleDateString("pt-BR")}` : "sem validade"}
              </p>
            </div>
          ) : (
            painel && <p className="text-sm text-muted">Nenhum código ativo para esta turma.</p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Validade
              <select value={validade} onChange={(e) => setValidade(e.target.value as "7" | "30" | "sem")} className={estilos.input}>
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
                <option value="sem">Sem validade</option>
              </select>
            </label>
            <button type="button" disabled={ocupado} onClick={() => executar(() => gerarConviteTurma(turmaId, validade === "sem" ? null : (Number(validade) as 7 | 30)))} className={estilos.botaoPrimario}>
              {convite ? "Gerar novo código" : "Gerar código"}
            </button>
            {convite && (
              <button type="button" disabled={ocupado} onClick={() => executar(() => desativarConviteTurma(turmaId))} className={estilos.botaoFantasma}>
                Desativar
              </button>
            )}
          </div>

          {senhaGerada && (
            <p role="status" className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">
              Nova senha de <strong>{senhaGerada.nome}</strong>: <span className="font-mono">{senhaGerada.senha}</span>. Ela aparece só agora; o aluno troca no próximo acesso.
            </p>
          )}

          <div>
            <h3 className={estilos.rotulo}>Alunos com conta nesta turma</h3>
            {painel && painel.contas.length === 0 && <p className="mt-2 text-sm text-muted">Ninguém ainda.</p>}
            <ul className="mt-2 divide-y divide-line">
              {painel?.contas.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-ink">{c.nome}</span>
                    <span className="block truncate text-xs text-muted">{c.usuario ?? c.email}{c.ativo ? "" : " · bloqueado"}</span>
                  </span>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => executar(async () => setSenhaGerada({ nome: c.nome, senha: await novaSenhaAlunoPeloProfessor(turmaId, c.id) }))}
                    className={estilos.botaoFantasma}
                  >
                    <KeyRound size={14} aria-hidden="true" /> Nova senha
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>
    </>
  );
}
```

Importe `formatarCodigo` de `@/lib/codigo-convite`, nunca de `@/lib/contas-aluno`: este usa `node:crypto` e quebraria o bundle do cliente.

- [ ] **Step 3: Botão no cabeçalho da turma**

Em `src/components/turma/TurmaDashboard.tsx:91`:

```tsx
acoes={
  <>
    <BimestreAbas turma={turma} todasTurmas={todasTurmas} />
    <CodigoAlunos turmaId={turma.id} />
  </>
}
```

com `import { CodigoAlunos } from "./CodigoAlunos";`.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm run build` — Expected: OK (o build pega import de `node:crypto` no cliente).
Manual: na turma, "Código para alunos" → gerar (30 dias) → aparece `XXX-XXX`; gerar de novo troca o código; desativar some.

- [ ] **Step 5: Commit**

```bash
git add src/actions/convites.ts src/components/turma/CodigoAlunos.tsx src/components/turma/TurmaDashboard.tsx
git commit -m "Professor gera codigo da turma para alunos e reseta senha"
git push origin master
```

---

### Task 10: Cadastro por código, confirmação de email e esqueci a senha do aluno

**Files:**
- Create: `src/app/aluno/entrar-com-codigo/page.tsx`
- Modify: `src/actions/contas-aluno.ts` (`cadastrarAlunoComCodigo`)
- Modify: `src/app/verificar-email/page.tsx`
- Modify: `src/actions/auth.ts` (`pedirRedefinicaoSenha`, `redefinirSenha`)
- Modify: `src/app/esqueci-senha/page.tsx`

**Interfaces:**
- Consumes: `buscarConviteValido` (Task 8), `vincularContaAoConvite` (`src/lib/convites.ts`, Task 8), `enviarEmailVerificacao` com marca (Task 7), `contaDoTokenRedefinicao` (Task 3), `gerarTokenRedefinicao(…, tipo)` (Task 3).
- Produces: `cadastrarAlunoComCodigo(formData: FormData): Promise<void>`; página com etapas `?codigo=` (confirmar) → formulário → `?enviado=1`.

- [ ] **Step 1: `cadastrarAlunoComCodigo`**

Acrescente a `src/actions/contas-aluno.ts`:

```ts
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { enviarEmailVerificacao } from "@/lib/email";
import { obterEscola } from "@/lib/escolas";
import { normalizarIdentificador } from "@/lib/contas-aluno";
import { vincularContaAoConvite } from "@/lib/convites";

export async function cadastrarAlunoComCodigo(formData: FormData): Promise<void> {
  const codigo = String(formData.get("codigo") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const email = normalizarIdentificador(String(formData.get("email") ?? ""));
  const senha = String(formData.get("senha") ?? "");
  const confirmar = String(formData.get("confirmarSenha") ?? "");
  const voltar = (erro: string) => redirect(`/aluno/entrar-com-codigo?codigo=${encodeURIComponent(codigo)}&erro=${erro}`);

  const convite = await buscarConviteValido(codigo);
  if (!convite) redirect("/aluno/entrar-com-codigo?erro=codigo");
  if (!nome || !email.includes("@")) voltar("campos");
  if (senha.length < 6) voltar("curta");
  if (senha !== confirmar) voltar("confirmacao");

  const [{ data: professor }, { data: existente }] = await Promise.all([
    supabase.from("professores").select("id").eq("email", email).maybeSingle(),
    supabase.from("alunos_contas").select("id, email_verificado").eq("email", email).maybeSingle(),
  ]);
  if (professor || existente?.email_verificado) voltar("duplicado");

  const token = randomBytes(32).toString("hex");
  const dados = {
    escola_id: convite.escola_id,
    nome,
    email,
    senha_hash: await bcrypt.hash(senha, 10),
    email_verificado: false,
    token_verificacao: token,
    token_verificacao_expira: new Date(Date.now() + 86_400_000).toISOString(),
    criado_via: "convite" as const,
  };
  // Cadastro repetido sem confirmar o email: reaproveita a conta e manda novo link.
  const { data: conta, error } = existente
    ? await supabase.from("alunos_contas").update(dados).eq("id", existente.id).select("id").single()
    : await supabase.from("alunos_contas").insert(dados).select("id").single();
  if (error || !conta) voltar("falha");

  await vincularContaAoConvite(conta!.id, convite);

  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/verificar-email?token=${token}`;
  try {
    await enviarEmailVerificacao(email, nome, link, await obterEscola(convite.escola_id));
  } catch {
    voltar("email");
  }
  redirect("/aluno/entrar-com-codigo?enviado=1");
}
```

- [ ] **Step 2: Página `src/app/aluno/entrar-com-codigo/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthAviso, AuthShell, authBotao, authInput } from "@/components/layout/AuthShell";
import { buscarConviteValido, cadastrarAlunoComCodigo } from "@/actions/contas-aluno";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ codigo?: string; erro?: string; enviado?: string }> };

const MENSAGENS: Record<string, string> = {
  codigo: "Código inválido. Confira com seu professor.",
  campos: "Preencha nome, email e senha.",
  curta: "A senha precisa ter pelo menos 6 caracteres.",
  confirmacao: "A confirmação não bate com a senha.",
  duplicado: "Esse email já tem conta. Entre pela tela de login.",
  falha: "Não foi possível criar a conta. Tente de novo.",
  email: "Não conseguimos enviar o email agora. Tente de novo em alguns minutos.",
};
const rotulo = "flex flex-col gap-1.5 text-xs text-frame-muted";
const linkSecundario = "text-center text-sm text-frame-muted hover:text-white hover:underline";

async function irParaCodigo(formData: FormData) {
  "use server";
  redirect(`/aluno/entrar-com-codigo?codigo=${encodeURIComponent(String(formData.get("codigo") ?? ""))}`);
}

export default async function EntrarComCodigoPage({ searchParams }: Props) {
  const { codigo, erro, enviado } = await searchParams;

  if (enviado) {
    return (
      <AuthShell titulo="Confira seu email" subtitulo="Enviamos um link para confirmar sua conta. Ele vale por 24 horas — veja também a caixa de spam.">
        <Link href="/login" className={`${authBotao} text-center`}>Ir para o login</Link>
      </AuthShell>
    );
  }

  const convite = codigo ? await buscarConviteValido(codigo) : null;

  if (!convite) {
    return (
      <AuthShell titulo="Entrar com código" subtitulo="Digite o código que seu professor passou." comoForm={irParaCodigo}>
        {(erro || codigo) && <AuthAviso tipo="erro">{MENSAGENS.codigo}</AuthAviso>}
        <label className={rotulo}>
          Código da turma
          <input name="codigo" required autoFocus autoCapitalize="characters" placeholder="K7P-4QX" className={`${authInput} font-mono uppercase tracking-widest`} />
        </label>
        <button type="submit" className={`${authBotao} mt-1`}>Continuar</button>
        <Link href="/login" className={linkSecundario}>Já tenho conta</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell titulo="Criar sua conta" subtitulo={`${convite.escola_nome} · ${convite.turma_nome} · ${convite.ano_letivo}`} comoForm={cadastrarAlunoComCodigo}>
      {erro && <AuthAviso tipo="erro">{MENSAGENS[erro] ?? MENSAGENS.falha}</AuthAviso>}
      <input type="hidden" name="codigo" value={convite.codigo} />
      <label className={rotulo}>Nome completo<input name="nome" required autoComplete="name" className={authInput} /></label>
      <label className={rotulo}>Email<input type="email" name="email" required autoComplete="email" className={authInput} /></label>
      <label className={rotulo}>Senha<input type="password" name="senha" required minLength={6} autoComplete="new-password" className={authInput} /></label>
      <label className={rotulo}>Confirmar senha<input type="password" name="confirmarSenha" required minLength={6} autoComplete="new-password" className={authInput} /></label>
      <button type="submit" className={`${authBotao} mt-1`}>Criar conta</button>
      <Link href="/aluno/entrar-com-codigo" className={linkSecundario}>Não é essa turma? Trocar código</Link>
    </AuthShell>
  );
}
```

Atenção: um código digitado errado na 1ª etapa volta com `?codigo=` inválido, e o aviso aparece porque `codigo` está presente. Na primeira visita (sem `codigo`) não aparece aviso.

- [ ] **Step 3: `/verificar-email` aceita aluno**

Em `src/app/verificar-email/page.tsx`, depois do bloco do professor, se `!sucesso && token`, repita a mesma busca/atualização em `alunos_contas` (`select("id, token_verificacao_expira").eq("token_verificacao", token)` e o mesmo `update`). Troque o texto de erro para "Link inválido ou expirado. Faça o cadastro de novo pra receber um novo email." e o botão de erro para `/login` com o texto "Voltar para o login" (serve aos dois tipos).

- [ ] **Step 4: Esqueci/redefinir para aluno**

Em `pedirRedefinicaoSenha` (`src/actions/auth.ts`), normalize o email com `normalizarIdentificador` e, quando não houver professor, procure o aluno:

```ts
if (!professor) {
  const { data: aluno } = await supabase
    .from("alunos_contas")
    .select("id, nome, senha_hash, escola_id")
    .eq("email", email)
    .maybeSingle();
  if (aluno) {
    const token = gerarTokenRedefinicao(aluno.id, aluno.senha_hash, segredo(), Date.now(), "a");
    const link = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/redefinir-senha?token=${token}`;
    try {
      await enviarEmailRedefinicaoSenha(email, aluno.nome, link, await obterEscola(aluno.escola_id));
    } catch {
      redirect("/esqueci-senha?erro=email");
    }
  }
}
```

Em `redefinirSenha`, troque o trecho da Task 3 por:

```ts
const conta = await contaDoTokenRedefinicao(token);
if (!conta) redirect("/redefinir-senha?erro=link");
if (novaSenha.length < 6) voltar("curta");
if (novaSenha !== confirmarSenha) voltar("confirmacao");

const senhaHash = await bcrypt.hash(novaSenha, 10);
const { error } = await supabase
  .from(conta.tipo === "a" ? "alunos_contas" : "professores")
  .update({ senha_hash: senhaHash, senha_provisoria: false, email_verificado: true })
  .eq("id", conta.id);
if (error) voltar("falha");
redirect("/login?senha-redefinida=1");
```

Em `src/app/esqueci-senha/page.tsx`, acima do link "Lembrei a senha", acrescente:

```tsx
<p className="text-center text-xs text-frame-muted">Aluno que entra com usuário? Peça uma nova senha à sua escola.</p>
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test` — Expected: OK.
Manual: gere um código numa turma; em aba anônima, `/aluno/entrar-com-codigo` → digite o código em minúsculas sem hífen → confirma a turma → cadastre com um email seu → o link do email confirma → login com o email → `/aluno` mostra a turma. Cadastrar de novo com o email de um professor → "Esse email já tem conta". "Esqueci minha senha" com o email do aluno → o link redefine e o login funciona.

- [ ] **Step 6: Commit**

```bash
git add src/app/aluno/entrar-com-codigo src/actions/contas-aluno.ts src/app/verificar-email/page.tsx src/actions/auth.ts src/app/esqueci-senha/page.tsx
git commit -m "Cadastro de aluno por codigo da turma, confirmacao de email e redefinicao de senha"
git push origin master
```

---

### Task 11: Admin da escola — contas de aluno (lista, criar, bloquear, nova senha)

**Files:**
- Modify: `src/actions/contas-aluno.ts` (funções de admin)
- Create: `src/app/admin/alunos/page.tsx`, `src/components/admin/GerenciarAlunos.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `exigirAdmin`, `getProfessorAtual`, `sugerirUsuario`, `gerarSenhaProvisoria`.
- Produces:
  - `type ContaAlunoAdmin = { id: string; nome: string; usuario: string | null; email: string | null; ativo: boolean; ultimo_acesso: string | null; turmas: string[] }` (`turmas` como `"3º A · 2026"`)
  - `type CredencialGerada = { nome: string; usuario: string; senha: string; turma: string }`
  - `listarContasAluno(): Promise<ContaAlunoAdmin[]>`
  - `prepararLote(nomes: string[]): Promise<{ nome: string; usuario: string }[]>` (só sugere, não grava)
  - `criarContasAluno(turmaId: string, alunos: { nome: string; usuario: string }[]): Promise<CredencialGerada[]>`
  - `definirContaAtiva(contaId: string, ativo: boolean): Promise<void>`
  - `novaSenhaAlunoPeloAdmin(contaId: string): Promise<string>`

- [ ] **Step 1: Actions de admin**

Acrescente a `src/actions/contas-aluno.ts`:

```ts
import { exigirAdmin, getProfessorAtual } from "@/lib/auth";
import { gerarSenhaProvisoria, sugerirUsuario } from "@/lib/contas-aluno";
import type { Professor } from "@/lib/types";

export type ContaAlunoAdmin = { id: string; nome: string; usuario: string | null; email: string | null; ativo: boolean; ultimo_acesso: string | null; turmas: string[] };
export type CredencialGerada = { nome: string; usuario: string; senha: string; turma: string };

async function adminAtual(): Promise<Professor> {
  await exigirAdmin();
  return (await getProfessorAtual())!;
}

async function contaDaMinhaEscola(contaId: string, escolaId: string): Promise<void> {
  const { data } = await supabase.from("alunos_contas").select("escola_id").eq("id", contaId).maybeSingle();
  if (!data || data.escola_id !== escolaId) throw new Error("Conta não encontrada.");
}

export async function listarContasAluno(): Promise<ContaAlunoAdmin[]> {
  const admin = await adminAtual();
  const [{ data: contas }, { data: vinculos }] = await Promise.all([
    supabase.from("alunos_contas").select("id, nome, usuario, email, ativo, ultimo_acesso").eq("escola_id", admin.escola_id).order("nome"),
    supabase.from("aluno_turmas").select("conta_id, turma_nome, ano_letivo").eq("escola_id", admin.escola_id),
  ]);
  const turmasPorConta = new Map<string, string[]>();
  for (const v of vinculos ?? []) {
    turmasPorConta.set(v.conta_id, [...(turmasPorConta.get(v.conta_id) ?? []), `${v.turma_nome} · ${v.ano_letivo}`]);
  }
  return (contas ?? []).map((c) => ({ ...c, turmas: turmasPorConta.get(c.id) ?? [] }));
}

/** Usuários já tomados que começam igual aos sugeridos — para o sufixo numérico não colidir. */
async function usuariosExistentes(bases: string[]): Promise<Set<string>> {
  const prefixos = [...new Set(bases.map((b) => b.replace(/\d+$/, "")))];
  const existentes = new Set<string>();
  for (const prefixo of prefixos) {
    const { data } = await supabase.from("alunos_contas").select("usuario").ilike("usuario", `${prefixo}%`);
    for (const linha of data ?? []) if (linha.usuario) existentes.add(linha.usuario);
  }
  return existentes;
}

export async function prepararLote(nomes: string[]): Promise<{ nome: string; usuario: string }[]> {
  await adminAtual();
  const limpos = nomes.map((n) => n.trim().replace(/\s+/g, " ")).filter(Boolean);
  const existentes = await usuariosExistentes(limpos.map((n) => sugerirUsuario(n, new Set())));
  return limpos.map((nome) => ({ nome, usuario: sugerirUsuario(nome, existentes) }));
}

export async function criarContasAluno(turmaId: string, alunos: { nome: string; usuario: string }[]): Promise<CredencialGerada[]> {
  const admin = await adminAtual();
  const { data: turma } = await supabase.from("turmas").select("nome, ano_letivo, escola_id").eq("id", turmaId).single();
  if (!turma || turma.escola_id !== admin.escola_id) throw new Error("Turma não encontrada.");

  const credenciais: CredencialGerada[] = [];
  for (const { nome, usuario } of alunos) {
    const usuarioLimpo = usuario.trim().toLowerCase();
    if (!nome.trim() || !/^[a-z0-9.]+$/.test(usuarioLimpo)) throw new Error(`Usuário inválido para ${nome}.`);
    const senha = gerarSenhaProvisoria();
    const { data: conta, error } = await supabase
      .from("alunos_contas")
      .insert({ escola_id: admin.escola_id, nome: nome.trim(), usuario: usuarioLimpo, senha_hash: await bcrypt.hash(senha, 10), senha_provisoria: true, criado_via: "escola" })
      .select("id")
      .single();
    if (error?.code === "23505") throw new Error(`O usuário ${usuarioLimpo} já existe. Gere a prévia de novo. ${credenciais.length} conta(s) já foram criadas antes deste.`);
    if (error || !conta) throw new Error(error?.message ?? "Falha ao criar conta.");
    await supabase.from("aluno_turmas").insert({ conta_id: conta.id, escola_id: admin.escola_id, turma_nome: turma.nome, ano_letivo: turma.ano_letivo });
    credenciais.push({ nome: nome.trim(), usuario: usuarioLimpo, senha, turma: `${turma.nome} · ${turma.ano_letivo}` });
  }
  return credenciais;
}

export async function definirContaAtiva(contaId: string, ativo: boolean): Promise<void> {
  const admin = await adminAtual();
  await contaDaMinhaEscola(contaId, admin.escola_id);
  const { error } = await supabase.from("alunos_contas").update({ ativo }).eq("id", contaId);
  if (error) throw new Error(error.message);
}

export async function novaSenhaAlunoPeloAdmin(contaId: string): Promise<string> {
  const admin = await adminAtual();
  await contaDaMinhaEscola(contaId, admin.escola_id);
  const senha = gerarSenhaProvisoria();
  const { error } = await supabase.from("alunos_contas").update({ senha_hash: await bcrypt.hash(senha, 10), senha_provisoria: true }).eq("id", contaId);
  if (error) throw new Error(error.message);
  return senha;
}
```

Atenção ao erro de lote: se a criação parar no meio, as credenciais já criadas se perdem da tela. Por isso o `GerenciarAlunos` (Step 3) gera a planilha só ao fim; se der erro, ele mostra a mensagem e recarrega a lista, e o admin usa "Nova senha" nas contas que já tinham sido criadas. Isso está escrito na mensagem de erro.

- [ ] **Step 2: Página `src/app/admin/alunos/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { listarContasAluno } from "@/actions/contas-aluno";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { PageLayout } from "@/components/layout/PageLayout";
import { GerenciarAlunos } from "@/components/admin/GerenciarAlunos";

export const dynamic = "force-dynamic";

export default async function AlunosAdminPage() {
  const atual = await getProfessorAtual();
  if (!atual || !ehAdmin(atual.role)) redirect("/");

  const [contas, turmas] = await Promise.all([listarContasAluno(), listarTurmasAcessiveis()]);
  // Uma opção por turma+ano (as turmas têm um registro por bimestre): fica o mais recente.
  const opcoes = [...new Map(turmas.map((t) => [`${t.nome}|${t.ano_letivo}`, { id: t.id, rotulo: `${t.nome} · ${t.ano_letivo}` }])).values()];

  return (
    <PageLayout crumb="Administração" titulo="Contas de aluno" subtitulo="Crie acessos, bloqueie contas e gere senhas novas." largura="max-w-6xl">
      <GerenciarAlunos contasIniciais={contas} turmas={opcoes} />
    </PageLayout>
  );
}
```

- [ ] **Step 3: `src/components/admin/GerenciarAlunos.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { KeyRound, Lock, Unlock, UserPlus, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { estilos } from "@/components/ui/estilos";
import {
  criarContasAluno,
  definirContaAtiva,
  listarContasAluno,
  novaSenhaAlunoPeloAdmin,
  prepararLote,
  type ContaAlunoAdmin,
  type CredencialGerada,
} from "@/actions/contas-aluno";

type Props = { contasIniciais: ContaAlunoAdmin[]; turmas: { id: string; rotulo: string }[] };

async function baixarPlanilha(credenciais: CredencialGerada[]) {
  const XLSX = await import("xlsx");
  const linhas = credenciais.map((c) => ({ Nome: c.nome, Turma: c.turma, Usuário: c.usuario, "Senha provisória": c.senha }));
  const planilha = XLSX.utils.json_to_sheet(linhas);
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, "Acessos");
  XLSX.writeFile(livro, `acessos-alunos-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function GerenciarAlunos({ contasIniciais, turmas }: Props) {
  const [contas, setContas] = useState(contasIniciais);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [loteAberto, setLoteAberto] = useState(false);
  const [turmaId, setTurmaId] = useState(turmas[0]?.id ?? "");
  const [textoNomes, setTextoNomes] = useState("");
  const [previa, setPrevia] = useState<{ nome: string; usuario: string }[] | null>(null);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? contas.filter((c) => [c.nome, c.usuario ?? "", c.email ?? "", ...c.turmas].join(" ").toLowerCase().includes(termo)) : contas;
  }, [contas, busca]);

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
      setContas(await listarContasAluno());
    } finally {
      setOcupado(false);
    }
  }

  function abrirLote() {
    setLoteAberto(true);
    setTextoNomes("");
    setPrevia(null);
  }

  return (
    <div className={`${estilos.card} flex flex-col gap-4 p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, usuário, email ou turma" aria-label="Buscar contas" className={`${estilos.input} max-w-sm`} />
        <button type="button" onClick={abrirLote} disabled={turmas.length === 0} className={`${estilos.botaoPrimario} ml-auto`}>
          <UserPlus size={16} aria-hidden="true" /> Criar contas
        </button>
      </div>

      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">{aviso}</p>}

      {contas.length === 0 ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted"><Users size={16} aria-hidden="true" /> Nenhuma conta de aluno ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={estilos.rotulo}>
              <tr><th className="px-3 py-2">Aluno</th><th className="px-3 py-2">Acesso</th><th className="px-3 py-2">Turmas</th><th className="px-3 py-2">Último acesso</th><th className="px-3 py-2"><span className="sr-only">Ações</span></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtradas.map((c) => (
                <tr key={c.id} className={c.ativo ? "" : "opacity-60"}>
                  <td className="px-3 py-2 font-medium text-ink">{c.nome}{!c.ativo && <span className="ml-2 rounded bg-danger/15 px-1.5 py-0.5 text-xs text-danger">bloqueada</span>}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{c.usuario ?? c.email}</td>
                  <td className="px-3 py-2 text-muted">{c.turmas.join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-muted">{c.ultimo_acesso ? new Date(c.ultimo_acesso).toLocaleDateString("pt-BR") : "nunca"}</td>
                  <td className="flex justify-end gap-1 px-3 py-2">
                    <button type="button" disabled={ocupado} onClick={() => executar(async () => { const senha = await novaSenhaAlunoPeloAdmin(c.id); setAviso(`Nova senha de ${c.nome}: ${senha} (aparece só agora; o aluno troca no próximo acesso).`); })} className={estilos.botaoFantasma}>
                      <KeyRound size={14} aria-hidden="true" /> Nova senha
                    </button>
                    <button type="button" disabled={ocupado} onClick={() => executar(async () => { await definirContaAtiva(c.id, !c.ativo); setContas(await listarContasAluno()); })} className={estilos.botaoFantasma}>
                      {c.ativo ? <><Lock size={14} aria-hidden="true" /> Bloquear</> : <><Unlock size={14} aria-hidden="true" /> Desbloquear</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={loteAberto} onClose={() => setLoteAberto(false)} titulo="Criar contas de aluno" descricao="Um nome por linha. Para criar uma conta só, cole um nome." largura="lg">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Turma
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className={estilos.input}>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
            </select>
          </label>
          {previa === null ? (
            <>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Nomes
                <textarea value={textoNomes} onChange={(e) => setTextoNomes(e.target.value)} rows={10} placeholder={"Ana Souza\nJoão da Silva\n…"} className={estilos.input} />
              </label>
              <button type="button" disabled={ocupado || !textoNomes.trim()} onClick={() => executar(async () => setPrevia(await prepararLote(textoNomes.split("\n"))))} className={estilos.botaoPrimario}>
                Ver prévia
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Confira os usuários. Você pode editar antes de criar.</p>
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {previa.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate text-ink">{p.nome}</span>
                    <input value={p.usuario} aria-label={`Usuário de ${p.nome}`} onChange={(e) => setPrevia(previa.map((q, j) => (j === i ? { ...q, usuario: e.target.value } : q)))} className={`${estilos.input} max-w-48 font-mono text-xs`} />
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPrevia(null)} className={estilos.botaoFantasma}>Voltar</button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => executar(async () => {
                    const credenciais = await criarContasAluno(turmaId, previa);
                    await baixarPlanilha(credenciais);
                    setContas(await listarContasAluno());
                    setLoteAberto(false);
                    setAviso(`${credenciais.length} conta(s) criada(s). A planilha com os usuários e senhas foi baixada — guarde-a, as senhas não aparecem de novo.`);
                  })}
                  className={estilos.botaoPrimario}
                >
                  Criar {previa.length} conta(s) e baixar planilha
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 4: Link na barra lateral**

Em `src/components/layout/Sidebar.tsx`, no bloco de itens de admin, depois de "Professores":

```ts
{ href: "/admin/alunos", icon: Contact, label: "Alunos", ativo: pathname === "/admin/alunos" },
```

com `Contact` acrescentado ao import de `lucide-react`.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm run build` — Expected: OK.
Manual: `/admin/alunos` → "Criar contas" → cole `Ana Souza`, `Ana Souza`, `João da Silva` → prévia mostra `ana.souza`, `ana.souza2`, `joao.silva` → criar → planilha baixada com as 3 senhas → as 3 entram pelo login. Bloquear uma → ela não entra (`Sua conta está bloqueada`), e se estava logada sai na próxima página.

- [ ] **Step 6: Commit**

```bash
git add src/actions/contas-aluno.ts src/app/admin/alunos src/components/admin/GerenciarAlunos.tsx src/components/layout/Sidebar.tsx
git commit -m "Admin da escola: contas de aluno com criacao em lote e planilha de acessos"
git push origin master
```

---

### Task 12: Documentação do design

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: Registrar as telas novas**

Acrescente ao fim de `DESIGN.md`:

```markdown
## Área do aluno
`app/aluno/layout.tsx`: faixa azul (`bg-frame-deep`) com a logo da escola, nome do aluno, Senha e Sair; conteúdo em `max-w-5xl`, cartões `estilos.card`. Sem a barra lateral de professor. Cartões de módulos futuros usam o selo amarelo "Em breve". Cadastro por código usa `AuthShell`.

## Marca da escola
Logo e nome vêm de `escolas` via `EscolaProvider`/`LogoEscola` (`components/layout/EscolaContexto.tsx`). Telas antes do login usam a escola padrão (Status).
```

- [ ] **Step 2: Commit**

```bash
git add DESIGN.md
git commit -m "DESIGN: area do aluno e marca da escola"
git push origin master
```

---

### Task 13: Verificação final

- [ ] **Step 1: Comandos**

Run: `npm test && npm run lint && npm run build`
Expected: todos os testes PASS, lint sem erros, build concluído.

- [ ] **Step 2: Roteiro manual (dev ou produção depois do deploy)**

1. Professor que já estava logado antes do deploy continua logado e vê turmas, notas e admin como antes.
2. Aluno criado pelo admin: entra com usuário + senha provisória → troca a senha → `/aluno`; abrir `/`, `/admin/professores` e `/turma/<id>` volta para `/aluno`.
3. **Review Focus 1:** logado como aluno, no console do navegador em `/aluno`, não há como chamar actions de professor pela interface; confira lendo o código que as 12 actions da Task 4 Step 4 começam com `await exigirNaoAluno()` (`grep -n "exigirNaoAluno" src/actions/*.ts` deve listar as 12).
4. Aluno por código: cadastro, email de confirmação, entrada já na turma; um segundo código (outra turma) adiciona a turma na área dele.
5. Conta bloqueada sai na próxima página aberta.
6. Lote com nomes repetidos gera usuários distintos e a planilha traz todas as senhas.
7. Link de "esqueci minha senha" de professor gerado **antes** do deploy (se houver algum à mão) ainda funciona.

- [ ] **Step 3: Conferir deploy**

Depois do último push, confira o status do commit em `https://api.github.com/repos/Peter870100/SISTEMA-DE-NOTAS/commits/<sha>/status` (deve ficar `success`, projeto Vercel `sistema-de-notas`) e abra `https://www.statusavalia.com.br/login` para ver o campo "Email ou usuário" e o link "Sou aluno e tenho um código".
