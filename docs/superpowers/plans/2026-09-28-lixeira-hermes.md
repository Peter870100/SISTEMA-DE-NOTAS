# Lixeira reversível + exclusão pelo Hermes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda exclusão de planilha, aluno ou atividade (pela tela ou pelo Hermes) vai para uma lixeira restaurável por admin; o Hermes ganha `excluir_turma`; itens criados pelo Hermes ganham selo.

**Architecture:** Duas funções Postgres (`lixeira_excluir`, `lixeira_restaurar`) fazem cópia+exclusão e restauração em transação única; o app e o MCP só chamam essas RPCs nos caminhos de exclusão. Nenhuma leitura existente muda. Textos e regras de exibição ficam em `src/lib/lixeira.ts` (puro, testado). Uma página `/admin/lixeira` lista e restaura.

**Tech Stack:** Next.js 16.2 (App Router), React 19, Supabase JS (RPC), PostgreSQL plpgsql, Tailwind v4 (tokens do tema "Híbrido Status"), `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-09-28-lixeira-hermes-design.md`

## Global Constraints

- Schema é manual: o SQL é colado pelo usuário no SQL Editor do Supabase. Não existe migration automática. Código que chama as RPCs só funciona depois do SQL aplicado.
- Hermes (MCP) usa só o endpoint `/api/mcp` com `MCP_SECRET_TOKEN`; nenhuma credencial nova é dada a ele. Hermes **não** ganha ferramenta de restaurar.
- Restaurar e apagar de vez: só admin (`exigirAdmin`). Exceção: `desfazerExclusao` para o próprio professor, exclusão via `app`, até 30 minutos.
- Visual segue `DESIGN.md` (tokens `surface`, `muted`, `brand-bright`, `danger`, `ok`, `estilos.*`, `PageLayout`, `ConfirmDialog`). Sem classes `neutral-*`/`blue-*`/`dark:`.
- Textos em português, no tom atual do app.
- Cada task termina com `npx tsc --noEmit -p .`, lint dos arquivos alterados (`npx eslint <arquivos>`), `npm test` quando houver teste, commit e `git push origin master`.

---

## File Structure

**Criar**
- `src/lib/lixeira.ts` + `src/lib/lixeira.test.ts`: textos de resumo, origem e resultado (puro).
- `src/actions/lixeira.ts`: `listarLixeira`, `restaurarDaLixeira`, `apagarDaLixeira`, `desfazerExclusao`.
- `src/components/ui/SeloHermes.tsx`: selo "Hermes".
- `src/app/admin/lixeira/page.tsx`: página server.
- `src/components/admin/LixeiraLista.tsx`: lista client com filtros e ações.

**Modificar**
- `db/schema.sql` (anexar bloco SQL da spec)
- `src/lib/types.ts` (`criado_via`, `ItemLixeira`, `ResultadoRestauracao`, `Database.Tables.lixeira`, `Database.Functions`)
- `package.json` (script `test` inclui `lixeira.test.ts`)
- `src/actions/alunos.ts` (`deleteAluno` → RPC; remover `restaurarAlunoExcluido`)
- `src/actions/colunas.ts` (`deleteColuna` → checagem de acesso + RPC)
- `src/components/grid/PlanilhaGrid.tsx` (Ctrl+Z via `desfazerExclusao`; texto do diálogo; selos)
- `src/components/grid/GestaoColunasModal.tsx` (texto do diálogo)
- `src/lib/mcp-tools.ts` (`criado_via: "hermes"`, exclusões via RPC, `excluir_turma`, marcações)
- `src/components/home/TurmasLista.tsx`, `src/components/turma/TurmaDashboard.tsx` (selos)
- `src/components/layout/Sidebar.tsx`, `src/components/command/CommandPalette.tsx` (link Lixeira)

---

### Task 1: SQL da lixeira

**Files:**
- Modify: `db/schema.sql` (anexar ao fim)

**Interfaces:**
- Produces: colunas `criado_via` em `turmas`/`alunos`/`atividades_colunas`; tabela `lixeira`; RPCs `lixeira_excluir(p_tipo text, p_id uuid, p_ator uuid default null, p_via text default 'app') returns uuid` e `lixeira_restaurar(p_lixeira_id uuid) returns jsonb` (`{tipo, turma_id, notas_restauradas, notas_puladas}`).

- [ ] **Step 1: Anexar o bloco SQL a `db/schema.sql`**

Copiar **literalmente** o bloco `sql` da seção "1. Banco de dados" da spec para o fim de `db/schema.sql`, precedido de uma linha em branco e deste comentário:

```sql
-- ATENÇÃO (lixeira): lixeira_restaurar recria linhas com jsonb_populate_record + select *.
-- Se adicionar coluna NOT NULL sem default em turmas/alunos/atividades_colunas, ajuste a
-- função com coalesce, senão cópias antigas da lixeira deixam de restaurar.
```

- [ ] **Step 2: Entregar o SQL ao usuário e aguardar**

Mostrar ao usuário o mesmo bloco, pedindo para colar em Supabase → SQL Editor → Run. **Parar até ele confirmar que rodou sem erro.** Se der erro, corrigir o SQL (no arquivo e na spec) antes de seguir.

- [ ] **Step 3: Conferir pelo app que o schema existe**

Run:
```bash
node --env-file=.env.local -e "
const {createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async()=>{
  const a=await s.from('lixeira').select('id').limit(1);
  const b=await s.from('turmas').select('criado_via').limit(1);
  const c=await s.rpc('lixeira_restaurar',{p_lixeira_id:'00000000-0000-0000-0000-000000000000'});
  console.log('lixeira:',a.error?.message??'ok','| criado_via:',b.error?.message??'ok','| rpc:',c.error?.message);
})()"
```
Expected: `lixeira: ok | criado_via: ok | rpc: Este item não está mais na lixeira.`

- [ ] **Step 4: Commit**

```bash
git add db/schema.sql
git commit -m "Adiciona SQL da lixeira reversivel e origem dos registros"
git push origin master
```

---

### Task 2: Tipos e lógica pura da lixeira (TDD)

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/lixeira.ts`
- Test: `src/lib/lixeira.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `type OrigemRegistro = "app" | "hermes"`; `criado_via: OrigemRegistro` em `Turma`, `Aluno`, `AtividadeColuna`.
  - `type TipoLixeira = "turma" | "aluno" | "atividade"`.
  - `type ResumoLixeira = { alunos?: number; atividades?: number; notas?: number }`.
  - `type ItemLixeira = { id: string; tipo: TipoLixeira; titulo: string; turma_id: string | null; turma_nome: string | null; resumo: ResumoLixeira; excluido_por: string | null; excluido_via: OrigemRegistro; excluido_em: string }`.
  - `type ResultadoRestauracao = { tipo: TipoLixeira; turma_id: string | null; notas_restauradas: number; notas_puladas: number }`.
  - `descreverResumo(tipo: TipoLixeira, resumo: ResumoLixeira): string`
  - `descreverOrigem(via: OrigemRegistro, nomeProfessor: string | null, temAutor: boolean): string`
  - `mensagemRestauracao(r: ResultadoRestauracao): string`

- [ ] **Step 1: Tipos em `src/lib/types.ts`**

Adicionar após `export type TipoColuna …`:

```ts
/** Quem criou/excluiu: a tela do sistema ou o agente de IA (Hermes, via MCP). */
export type OrigemRegistro = "app" | "hermes";
```

Adicionar `criado_via: OrigemRegistro;` como último campo antes de `created_at` em `Turma`, `Aluno` e `AtividadeColuna`.

Adicionar antes de `export type Database`:

```ts
export type TipoLixeira = "turma" | "aluno" | "atividade";

export type ResumoLixeira = { alunos?: number; atividades?: number; notas?: number };

/** Linha da lixeira sem a cópia (`dados`), que é pesada e só a função de restaurar usa. */
export type ItemLixeira = {
  id: string;
  tipo: TipoLixeira;
  titulo: string;
  turma_id: string | null;
  turma_nome: string | null;
  resumo: ResumoLixeira;
  excluido_por: string | null;
  excluido_via: OrigemRegistro;
  excluido_em: string;
};

export type ResultadoRestauracao = {
  tipo: TipoLixeira;
  turma_id: string | null;
  notas_restauradas: number;
  notas_puladas: number;
};
```

Em `Database.public.Tables`, após `notas_historico`:

```ts
      lixeira: {
        Row: ItemLixeira & { dados: unknown };
        Insert: never;
        Update: never;
        Relationships: [];
      };
```

Trocar `Functions: Record<string, never>;` por:

```ts
    Functions: {
      lixeira_excluir: {
        Args: { p_tipo: TipoLixeira; p_id: string; p_ator?: string | null; p_via?: OrigemRegistro };
        Returns: string;
      };
      lixeira_restaurar: {
        Args: { p_lixeira_id: string };
        Returns: ResultadoRestauracao;
      };
    };
```

- [ ] **Step 2: Teste que falha, `src/lib/lixeira.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { descreverOrigem, descreverResumo, mensagemRestauracao } from "./lixeira";

test("descreverResumo de planilha lista alunos, atividades e notas com plural certo", () => {
  assert.equal(descreverResumo("turma", { alunos: 32, atividades: 8, notas: 254 }), "32 alunos · 8 atividades · 254 notas");
  assert.equal(descreverResumo("turma", { alunos: 1, atividades: 1, notas: 1 }), "1 aluno · 1 atividade · 1 nota");
  assert.equal(descreverResumo("turma", { alunos: 0, atividades: 0, notas: 0 }), "planilha vazia");
});

test("descreverResumo de aluno/atividade mostra só as notas", () => {
  assert.equal(descreverResumo("aluno", { notas: 12 }), "12 notas");
  assert.equal(descreverResumo("atividade", { notas: 1 }), "1 nota");
  assert.equal(descreverResumo("aluno", {}), "sem notas");
});

test("descreverOrigem cobre Hermes, professor e autor removido", () => {
  assert.equal(descreverOrigem("hermes", "Ana Lima", true), "Hermes, a pedido de Ana Lima");
  assert.equal(descreverOrigem("hermes", null, false), "Hermes");
  assert.equal(descreverOrigem("app", "Ana Lima", true), "Ana Lima");
  assert.equal(descreverOrigem("app", null, true), "Professor removido");
  assert.equal(descreverOrigem("app", null, false), "Desconhecido");
});

test("mensagemRestauracao informa notas restauradas e puladas", () => {
  assert.equal(
    mensagemRestauracao({ tipo: "turma", turma_id: "t", notas_restauradas: 254, notas_puladas: 0 }),
    "Planilha restaurada com 254 notas."
  );
  assert.equal(
    mensagemRestauracao({ tipo: "aluno", turma_id: "t", notas_restauradas: 9, notas_puladas: 3 }),
    "Aluno restaurado com 9 notas. 3 notas foram puladas porque a atividade ou o aluno delas não existe mais."
  );
  assert.equal(
    mensagemRestauracao({ tipo: "atividade", turma_id: "t", notas_restauradas: 1, notas_puladas: 1 }),
    "Atividade restaurada com 1 nota. 1 nota foi pulada porque a atividade ou o aluno dela não existe mais."
  );
  assert.equal(
    mensagemRestauracao({ tipo: "aluno", turma_id: "t", notas_restauradas: 0, notas_puladas: 0 }),
    "Aluno restaurado."
  );
});
```

Em `package.json`, script `test`:

```json
    "test": "tsx --test src/lib/comandos.test.ts src/lib/lixeira.test.ts",
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com `Cannot find module './lixeira'`.

- [ ] **Step 4: Implementar `src/lib/lixeira.ts`**

```ts
/** Textos da lixeira (puro, sem Supabase) — testado em lixeira.test.ts. */
import type { OrigemRegistro, ResultadoRestauracao, ResumoLixeira, TipoLixeira } from "./types";

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

export function descreverResumo(tipo: TipoLixeira, resumo: ResumoLixeira): string {
  if (tipo === "turma") {
    const alunos = resumo.alunos ?? 0;
    const atividades = resumo.atividades ?? 0;
    const notas = resumo.notas ?? 0;
    if (alunos + atividades + notas === 0) return "planilha vazia";
    return [
      plural(alunos, "aluno", "alunos"),
      plural(atividades, "atividade", "atividades"),
      plural(notas, "nota", "notas"),
    ].join(" · ");
  }
  const notas = resumo.notas ?? 0;
  return notas === 0 ? "sem notas" : plural(notas, "nota", "notas");
}

/** `temAutor` = a linha tinha `excluido_por` preenchido (mesmo que o professor tenha sido removido depois). */
export function descreverOrigem(via: OrigemRegistro, nomeProfessor: string | null, temAutor: boolean): string {
  if (via === "hermes") return nomeProfessor ? `Hermes, a pedido de ${nomeProfessor}` : "Hermes";
  if (nomeProfessor) return nomeProfessor;
  return temAutor ? "Professor removido" : "Desconhecido";
}

const ROTULO: Record<TipoLixeira, string> = {
  turma: "Planilha restaurada",
  aluno: "Aluno restaurado",
  atividade: "Atividade restaurada",
};

export function mensagemRestauracao(r: ResultadoRestauracao): string {
  const base = r.notas_restauradas > 0 ? `${ROTULO[r.tipo]} com ${plural(r.notas_restauradas, "nota", "notas")}.` : `${ROTULO[r.tipo]}.`;
  if (r.notas_puladas === 0) return base;
  const pulada =
    r.notas_puladas === 1
      ? "1 nota foi pulada porque a atividade ou o aluno dela não existe mais."
      : `${r.notas_puladas} notas foram puladas porque a atividade ou o aluno delas não existe mais.`;
  return `${base} ${pulada}`;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: PASS (7 testes de comandos + 4 de lixeira = 11).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: sem erro. Se algum objeto literal `Turma`/`Aluno`/`AtividadeColuna` montado à mão no código reclamar de `criado_via` ausente, adicionar `criado_via: "app"` nele.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/lixeira.ts src/lib/lixeira.test.ts package.json
git commit -m "Tipos e textos da lixeira com testes"
git push origin master
```

---

### Task 3: Actions da lixeira e exclusões da tela

**Files:**
- Create: `src/actions/lixeira.ts`
- Modify: `src/actions/alunos.ts` (`deleteAluno`, remover `restaurarAlunoExcluido`)
- Modify: `src/actions/colunas.ts` (`deleteColuna`)
- Modify: `src/components/grid/PlanilhaGrid.tsx` (`handleConfirmDelete`, import, texto do `ConfirmDialog`)
- Modify: `src/components/grid/GestaoColunasModal.tsx` (texto do `ConfirmDialog`)

**Interfaces:**
- Consumes: RPCs da Task 1; tipos da Task 2; `exigirAdmin`, `getProfessorAtual`, `exigirAcessoATurmaId` de `@/lib/auth`.
- Produces:
  - `listarLixeira(): Promise<(ItemLixeira & { excluido_por_nome: string | null })[]>`
  - `restaurarDaLixeira(id: string): Promise<ResultadoRestauracao>`
  - `apagarDaLixeira(id: string): Promise<void>`
  - `desfazerExclusao(id: string): Promise<ResultadoRestauracao>`
  - `deleteAluno(alunoId: string): Promise<string>` e `deleteColuna(colunaId: string): Promise<string>` devolvem o id da lixeira.

- [ ] **Step 1: Criar `src/actions/lixeira.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import { exigirAdmin, getProfessorAtual } from "@/lib/auth";
import type { ItemLixeira, ResultadoRestauracao } from "@/lib/types";

const COLUNAS_EXIBICAO = "id, tipo, titulo, turma_id, turma_nome, resumo, excluido_por, excluido_via, excluido_em";

/** Janela em que o professor ainda pode desfazer a própria exclusão (Ctrl+Z) sem precisar do admin. */
const JANELA_DESFAZER_MS = 30 * 60 * 1000;

export async function listarLixeira(): Promise<(ItemLixeira & { excluido_por_nome: string | null })[]> {
  await exigirAdmin();
  const { data, error } = await supabase
    .from("lixeira")
    .select(COLUNAS_EXIBICAO)
    .order("excluido_em", { ascending: false });
  if (error) throw new Error(error.message);
  const itens = (data ?? []) as ItemLixeira[];

  const ids = [...new Set(itens.map((i) => i.excluido_por).filter((id): id is string => !!id))];
  const { data: professores } = ids.length
    ? await supabase.from("professores").select("id, nome").in("id", ids)
    : { data: [] as { id: string; nome: string }[] };
  const nomePorId = new Map((professores ?? []).map((p) => [p.id, p.nome]));

  return itens.map((i) => ({ ...i, excluido_por_nome: i.excluido_por ? nomePorId.get(i.excluido_por) ?? null : null }));
}

async function restaurar(id: string): Promise<ResultadoRestauracao> {
  const { data, error } = await supabase.rpc("lixeira_restaurar", { p_lixeira_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/lixeira");
  revalidatePath("/");
  if (data.turma_id) revalidatePath(`/turma/${data.turma_id}`);
  return data;
}

export async function restaurarDaLixeira(id: string): Promise<ResultadoRestauracao> {
  await exigirAdmin();
  return restaurar(id);
}

export async function apagarDaLixeira(id: string): Promise<void> {
  await exigirAdmin();
  const { error } = await supabase.from("lixeira").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/lixeira");
}

/** Ctrl+Z do professor: só a própria exclusão, feita pela tela, há no máximo 30 minutos. */
export async function desfazerExclusao(id: string): Promise<ResultadoRestauracao> {
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  const { data: item } = await supabase
    .from("lixeira")
    .select("excluido_por, excluido_via, excluido_em")
    .eq("id", id)
    .maybeSingle();
  if (!item) throw new Error("Este item não está mais na lixeira.");
  const dentroDaJanela = Date.now() - new Date(item.excluido_em).getTime() <= JANELA_DESFAZER_MS;
  if (item.excluido_por !== professor.id || item.excluido_via !== "app" || !dentroDaJanela) {
    throw new Error("Não dá mais pra desfazer por aqui. Peça a um administrador para restaurar pela lixeira.");
  }
  return restaurar(id);
}
```

- [ ] **Step 2: `deleteAluno` via lixeira em `src/actions/alunos.ts`**

Substituir a função `deleteAluno` inteira por:

```ts
/** Manda o aluno (com notas e histórico) pra lixeira. Devolve o id do item na lixeira, pro Ctrl+Z. */
export async function deleteAluno(alunoId: string): Promise<string> {
  const professor = await getProfessorAtual();
  if (professor) {
    const { data: aluno } = await supabase
      .from("alunos")
      .select("turma_id")
      .eq("id", alunoId)
      .single();
    if (!aluno) throw new Error("Aluno não encontrado.");
    await exigirAcessoATurmaId(professor, aluno.turma_id);
  }

  const { data, error } = await supabase.rpc("lixeira_excluir", {
    p_tipo: "aluno",
    p_id: alunoId,
    p_ator: professor?.id ?? null,
    p_via: "app",
  });
  if (error) throw new Error(error.message);
  return data;
}
```

Apagar a função `restaurarAlunoExcluido` inteira, com o comentário JSDoc dela, e remover do topo do arquivo os imports que ficarem sem uso (conferir com o lint: provavelmente `ValorCelula`).

- [ ] **Step 3: `deleteColuna` com checagem de acesso + lixeira em `src/actions/colunas.ts`**

Conferir os imports do topo e garantir `import { exigirAcessoATurmaId, getProfessorAtual } from "@/lib/auth";`. Substituir `deleteColuna` por:

```ts
/** Manda a coluna (com notas e histórico) pra lixeira. Devolve o id do item na lixeira. */
export async function deleteColuna(colunaId: string): Promise<string> {
  const professor = await getProfessorAtual();
  if (professor) {
    const { data: coluna } = await supabase
      .from("atividades_colunas")
      .select("turma_id")
      .eq("id", colunaId)
      .single();
    if (!coluna) throw new Error("Atividade não encontrada.");
    await exigirAcessoATurmaId(professor, coluna.turma_id);
  }

  const { data, error } = await supabase.rpc("lixeira_excluir", {
    p_tipo: "atividade",
    p_id: colunaId,
    p_ator: professor?.id ?? null,
    p_via: "app",
  });
  if (error) throw new Error(error.message);
  return data;
}
```

- [ ] **Step 4: Ctrl+Z da planilha via `desfazerExclusao`**

Em `src/components/grid/PlanilhaGrid.tsx`:
- No import de `@/actions/alunos`, remover `restaurarAlunoExcluido`.
- Adicionar `import { desfazerExclusao } from "@/actions/lixeira";`.
- Em `handleConfirmDelete`, trocar `await deleteAluno(id);` por `const lixeiraId = await deleteAluno(id);` e o corpo do `registrarUndo` por:

```tsx
        registrarUndo(`"${alunoRemovido.nome}" excluído`, async () => {
          // A restauração recria o aluno com o mesmo id, então o que está em memória continua válido.
          await desfazerExclusao(lixeiraId);
          onAlunosChange(
            [...alunosRef.current, alunoRemovido].sort((a, b) => a.ordem - b.ordem)
          );
          onCelulasChange((prev) => ({ ...prev, [alunoRemovido.id]: celulasRemovidas }));
        });
```

- Na `ConfirmDialog` de exclusão de aluno, trocar a `message` por:

```tsx
        message={`Excluir "${confirmDelete?.nome}"? Ele e todas as notas dele vão para a lixeira. Dá pra desfazer com Ctrl+Z logo em seguida, e um administrador pode restaurar pela lixeira.`}
```

- [ ] **Step 5: Texto da exclusão de coluna em `GestaoColunasModal.tsx`**

Trocar a `message` do `ConfirmDialog` por:

```tsx
        message={`Excluir a coluna "${confirmDelete?.titulo}"? Ela e as notas lançadas nela vão para a lixeira; um administrador pode restaurá-las.`}
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit -p . && npx eslint src/actions/lixeira.ts src/actions/alunos.ts src/actions/colunas.ts src/components/grid/PlanilhaGrid.tsx src/components/grid/GestaoColunasModal.tsx && npm test`
Expected: sem erros; 11 testes passando.

- [ ] **Step 7: Commit**

```bash
git add src/actions src/components/grid
git commit -m "Exclusoes da tela vao para a lixeira; Ctrl+Z restaura do banco; deleteColuna checa acesso"
git push origin master
```

---

### Task 4: Hermes (MCP)

**Files:**
- Modify: `src/lib/mcp-tools.ts`

**Interfaces:**
- Consumes: RPC `lixeira_excluir`; helpers internos `resolverProfessorInfo`, `turmasLiberadas`, `resolverTurma`, `resolverAluno`, `resolverAtividade`, `texto`.
- Produces: ferramenta MCP `excluir_turma({ turma_nome, bimestre?, professor_telefone? })`.

- [ ] **Step 1: Tipos locais**

No topo de `mcp-tools.ts`, acrescentar `criado_via?: string` aos tipos locais `Turma`, `Aluno` e `Coluna`.

- [ ] **Step 2: Helper de exclusão via lixeira**

Dentro de `registrarFerramentas`, após `resolverAtividade`:

```ts
  /** Manda pra lixeira (restaurável por admin). Devolve o resumo gravado, pra resposta ao agente. */
  async function excluirParaLixeira(
    tipo: "turma" | "aluno" | "atividade",
    id: string,
    professor: ProfessorInfo
  ): Promise<{ alunos?: number; atividades?: number; notas?: number }> {
    const { data: lixeiraId, error } = await supabase.rpc("lixeira_excluir", {
      p_tipo: tipo,
      p_id: id,
      p_ator: professor?.id ?? null,
      p_via: "hermes",
    });
    if (error) throw new Error(error.message);
    const { data: item } = await supabase.from("lixeira").select("resumo").eq("id", lixeiraId).single();
    return (item?.resumo ?? {}) as { alunos?: number; atividades?: number; notas?: number };
  }
```

- [ ] **Step 3: Gravar `criado_via: "hermes"` nas cinco criações**

- `criar_turma`: tipo do objeto `insert` passa a `{ nome: string; bimestre?: string; ano_letivo?: string; criado_via: string }`, inicializado com `{ nome: nomeLimpo, criado_via: "hermes" }`.
- `criar_aluno`: `.insert({ turma_id: turma.id, nome: nome.trim(), numero: numero ?? null, ordem: count ?? 0, criado_via: "hermes" })`.
- `criar_alunos_em_lote`: `.insert({ turma_id: turma.id, nome, ordem, criado_via: "hermes" })`.
- `criar_atividade`: `.insert({ turma_id: turma.id, titulo: titulo.trim(), ordem: count ?? 0, criado_via: "hermes" })`.
- `lancar_presenca_em_lote`: `.insert({ turma_id: turma.id, titulo: dataLimpa, tipo: "presenca", ordem: count ?? 0, criado_via: "hermes" })`.

- [ ] **Step 4: `excluir_aluno` e `excluir_atividade` via lixeira**

`excluir_aluno`: descrição passa a

```ts
        "Move um aluno de uma turma para a lixeira, junto com todas as notas dele. Nada é apagado de vez: um administrador pode restaurar pela lixeira do sistema.",
```

e o corpo, após `resolverAluno`:

```ts
      const resumo = await excluirParaLixeira("aluno", aluno.id, professor);
      return texto(
        `OK: "${aluno.nome}" movido para a lixeira (${resumo.notas ?? 0} notas), da turma ${turma.nome}. Um administrador pode restaurá-lo em /admin/lixeira.`
      );
```

`excluir_atividade`: descrição passa a

```ts
        'Move uma coluna de atividade ou chamada (o professor às vezes chama de "planilha") para a lixeira, junto com as notas lançadas nela. Nada é apagado de vez: um administrador pode restaurar pela lixeira do sistema.',
```

e o corpo, após `resolverAtividade`:

```ts
      const resumo = await excluirParaLixeira("atividade", atividade.id, professor);
      return texto(
        `OK: "${atividade.titulo}" movida para a lixeira (${resumo.notas ?? 0} notas), da turma ${turma.nome}. Um administrador pode restaurá-la em /admin/lixeira.`
      );
```

- [ ] **Step 5: Nova ferramenta `excluir_turma`**

Registrar logo após `criar_turma`:

```ts
  server.registerTool(
    "excluir_turma",
    {
      title: "Excluir turma (planilha inteira)",
      description:
        "Move uma turma/planilha inteira (de um bimestre) para a lixeira, com todos os alunos, atividades, notas e histórico. Nada é apagado de vez: um administrador pode restaurar pela lixeira do sistema. Para remover só uma coluna de atividade, use excluir_atividade.",
      inputSchema: {
        turma_nome: z.string().describe('Nome da turma, ex: "1ª série C"'),
        bimestre: z.string().optional().describe('Ex: "2º Bimestre" — necessário se a turma tiver mais de um bimestre'),
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, bimestre, professor_telefone }) => {
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const resumo = await excluirParaLixeira("turma", turma.id, professor);
      return texto(
        `Planilha "${turma.nome} · ${turma.bimestre}" movida para a lixeira (${resumo.alunos ?? 0} alunos, ${resumo.atividades ?? 0} atividades, ${resumo.notas ?? 0} notas). Um administrador pode restaurá-la em /admin/lixeira.`
      );
    }
  );
```

- [ ] **Step 6: Marcar o que o Hermes criou em `listar_turmas` e `ver_planilha`**

`listar_turmas`: `const linhas = visiveis.map((t) => \`- ${t.nome} — ${t.bimestre} (${t.ano_letivo})${t.criado_via === "hermes" ? " (criada pelo Hermes)" : ""}\`);`

`ver_planilha`: no `cabecalho`, acrescentar `${turma.criado_via === "hermes" ? " (criada pelo Hermes)" : ""}` ao fim; em `listaColunas`, mapear `c.titulo + (c.criado_via === "hermes" ? "*" : "")` e, se alguma coluna tiver `*`, adicionar a linha `"(* = criada pelo Hermes)"` logo após `listaColunas`; nos alunos, `${a.nome}${a.criado_via === "hermes" ? "*" : ""}`.

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit -p . && npx eslint src/lib/mcp-tools.ts`
Expected: sem erros.

Run (smoke local do MCP, com `npm run dev` em outro terminal): `curl -s -X POST http://localhost:3000/api/mcp -H "Authorization: Bearer $MCP_SECRET_TOKEN" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -o '"excluir_turma"'`
Expected: `"excluir_turma"`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/mcp-tools.ts
git commit -m "Hermes: excluir_turma, exclusoes via lixeira e marca de itens criados por ele"
git push origin master
```

---

### Task 5: Selo "Hermes" nas telas

**Files:**
- Create: `src/components/ui/SeloHermes.tsx`
- Modify: `src/components/home/TurmasLista.tsx`, `src/components/turma/TurmaDashboard.tsx`, `src/components/grid/PlanilhaGrid.tsx`

**Interfaces:**
- Produces: `SeloHermes({ sobreMoldura?: boolean })`.

- [ ] **Step 1: Criar `src/components/ui/SeloHermes.tsx`**

```tsx
import { Bot } from "lucide-react";

/** Marca discreta pra itens criados pelo Hermes (agente de IA). `sobreMoldura` = versão pra faixa azul. */
export function SeloHermes({ sobreMoldura = false }: { sobreMoldura?: boolean }) {
  return (
    <span
      title="Criado pelo Hermes"
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-[5px] px-1 py-px text-[10px] font-bold normal-case tracking-normal ${
        sobreMoldura ? "bg-white/15 text-white" : "bg-brand-bright/10 text-brand-bright"
      }`}
    >
      <Bot size={10} aria-hidden="true" />
      Hermes
    </span>
  );
}
```

- [ ] **Step 2: Colocar o selo**

- `TurmasLista.tsx`: na linha de metadados do card (onde estão o chip de bimestre e a contagem de alunos), acrescentar `{turma.criado_via === "hermes" && <SeloHermes />}`.
- `TurmaDashboard.tsx`: o `titulo` do `PageLayout` é `string`; passar o selo em `subtitulo`: `subtitulo={turma.criado_via === "hermes" ? <SeloHermes sobreMoldura /> : undefined}`.
- `PlanilhaGrid.tsx`:
  - linha do aluno: incluir `aluno.criado_via === "hermes"` na condição que mostra a faixa de selos (`(aluno.nome_editado_em || aluno.transferido_em || aluno.criado_via === "hermes") && (…)`) e acrescentar `{aluno.criado_via === "hermes" && <SeloHermes />}` dentro dela;
  - cabeçalho da coluna: após `<span className="truncate">{c.titulo}</span>`, acrescentar `{c.criado_via === "hermes" && <SeloHermes />}`.
- Importar `SeloHermes` de `@/components/ui/SeloHermes` em cada arquivo.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit -p . && npx eslint src/components/ui/SeloHermes.tsx src/components/home src/components/turma src/components/grid/PlanilhaGrid.tsx`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components
git commit -m "Selo Hermes em planilhas, alunos e colunas criados pela IA"
git push origin master
```

---

### Task 6: Página `/admin/lixeira`

**Files:**
- Create: `src/app/admin/lixeira/page.tsx`
- Create: `src/components/admin/LixeiraLista.tsx`
- Modify: `src/components/layout/Sidebar.tsx`, `src/components/command/CommandPalette.tsx`

**Interfaces:**
- Consumes: `listarLixeira`, `restaurarDaLixeira`, `apagarDaLixeira` (Task 3); `descreverResumo`, `descreverOrigem`, `mensagemRestauracao` (Task 2); `PageLayout`, `ConfirmDialog`, `estilos`.

- [ ] **Step 1: Página server `src/app/admin/lixeira/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { listarLixeira } from "@/actions/lixeira";
import { PageLayout } from "@/components/layout/PageLayout";
import { LixeiraLista } from "@/components/admin/LixeiraLista";

export const dynamic = "force-dynamic";

export default async function LixeiraPage() {
  const atual = await getProfessorAtual();
  if (!atual || atual.role !== "admin") redirect("/");

  const itens = await listarLixeira();

  return (
    <PageLayout
      crumb="Administração"
      titulo="Lixeira"
      subtitulo="Tudo que foi excluído — pela tela ou pelo Hermes — fica aqui até você restaurar ou apagar de vez."
      largura="max-w-4xl"
    >
      <LixeiraLista itensIniciais={itens} />
    </PageLayout>
  );
}
```

- [ ] **Step 2: Lista client `src/components/admin/LixeiraLista.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { Bot, ClipboardList, GraduationCap, RotateCcw, Trash2, User } from "lucide-react";
import type { ItemLixeira, TipoLixeira } from "@/lib/types";
import { apagarDaLixeira, restaurarDaLixeira } from "@/actions/lixeira";
import { descreverOrigem, descreverResumo, mensagemRestauracao } from "@/lib/lixeira";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { estilos } from "@/components/ui/estilos";

type Item = ItemLixeira & { excluido_por_nome: string | null };

const ICONE: Record<TipoLixeira, typeof GraduationCap> = { turma: GraduationCap, aluno: User, atividade: ClipboardList };
const NOME_TIPO: Record<TipoLixeira, string> = { turma: "Planilha", aluno: "Aluno", atividade: "Atividade" };

export function LixeiraLista({ itensIniciais }: { itensIniciais: Item[] }) {
  const [itens, setItens] = useState(itensIniciais);
  const [tipo, setTipo] = useState<TipoLixeira | "todos">("todos");
  const [origem, setOrigem] = useState<"todas" | "hermes" | "app">("todas");
  const [confirmar, setConfirmar] = useState<{ item: Item; acao: "restaurar" | "apagar" } | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const turmasNaLixeira = useMemo(
    () => new Set(itens.filter((i) => i.tipo === "turma").map((i) => i.turma_id)),
    [itens]
  );

  const visiveis = itens.filter(
    (i) => (tipo === "todos" || i.tipo === tipo) && (origem === "todas" || i.excluido_via === origem)
  );

  async function executar() {
    if (!confirmar) return;
    const { item, acao } = confirmar;
    setConfirmar(null);
    setOcupado(item.id);
    setAviso(null);
    try {
      if (acao === "restaurar") {
        const r = await restaurarDaLixeira(item.id);
        setAviso({ tipo: "ok", texto: mensagemRestauracao(r) });
      } else {
        await apagarDaLixeira(item.id);
        setAviso({ tipo: "ok", texto: `"${item.titulo}" foi apagado definitivamente.` });
      }
      setItens((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente." });
    } finally {
      setOcupado(null);
    }
  }

  const filtro = (ativo: boolean) =>
    `rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${ativo ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className={`${estilos.card} flex flex-wrap items-center gap-3 p-3`}>
        <div className="inline-flex items-center gap-0.5 rounded-control border border-line bg-surface-sunken p-0.5" role="group" aria-label="Filtrar por tipo">
          {(["todos", "turma", "aluno", "atividade"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)} className={filtro(tipo === t)}>
              {t === "todos" ? "Todos" : `${NOME_TIPO[t]}s`}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-control border border-line bg-surface-sunken p-0.5" role="group" aria-label="Filtrar por origem">
          {(["todas", "hermes", "app"] as const).map((o) => (
            <button key={o} type="button" aria-pressed={origem === o} onClick={() => setOrigem(o)} className={filtro(origem === o)}>
              {o === "todas" ? "Todas as origens" : o === "hermes" ? "Hermes" : "Professores"}
            </button>
          ))}
        </div>
      </div>

      {aviso && (
        <p
          role={aviso.tipo === "erro" ? "alert" : "status"}
          className={`rounded-control border px-3 py-2 text-sm ${aviso.tipo === "erro" ? "border-danger/20 bg-danger/10 text-danger" : "border-ok/20 bg-ok/10 text-ok"}`}
        >
          {aviso.texto}
        </p>
      )}

      <div className={`${estilos.card} overflow-hidden`}>
        {visiveis.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {itens.length === 0 ? "A lixeira está vazia." : "Nada na lixeira com esses filtros."}
          </p>
        ) : (
          <ul>
            {visiveis.map((item) => {
              const Icone = ICONE[item.tipo];
              const bloqueado = item.tipo !== "turma" && turmasNaLixeira.has(item.turma_id);
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 border-t border-line-soft px-4 py-3 first:border-t-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-sunken text-muted" title={NOME_TIPO[item.tipo]}>
                    <Icone size={17} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{item.titulo}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <span>{descreverResumo(item.tipo, item.resumo)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        {item.excluido_via === "hermes" && <Bot size={12} className="text-brand-bright" aria-hidden="true" />}
                        {descreverOrigem(item.excluido_via, item.excluido_por_nome, item.excluido_por !== null)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{new Date(item.excluido_em).toLocaleString("pt-BR")}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={bloqueado || ocupado === item.id}
                      title={bloqueado ? `Restaure a planilha "${item.turma_nome}" primeiro` : undefined}
                      onClick={() => setConfirmar({ item, acao: "restaurar" })}
                      className={`${estilos.botaoSecundario} min-h-9 py-1.5`}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      Restaurar
                    </button>
                    <button
                      type="button"
                      disabled={ocupado === item.id}
                      onClick={() => setConfirmar({ item, acao: "apagar" })}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-2.5 py-1.5 text-sm font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Apagar de vez
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmar !== null}
        title={confirmar?.acao === "apagar" ? "Apagar de vez" : "Restaurar"}
        message={
          confirmar?.acao === "apagar"
            ? `Isso apaga definitivamente "${confirmar.item.titulo}" (${descreverResumo(confirmar.item.tipo, confirmar.item.resumo)}) e não pode ser desfeito.`
            : `Restaurar "${confirmar?.item.titulo}"? Tudo volta exatamente como estava, com as notas.`
        }
        confirmLabel={confirmar?.acao === "apagar" ? "Apagar de vez" : "Restaurar"}
        danger={confirmar?.acao === "apagar"}
        onConfirm={executar}
        onCancel={() => setConfirmar(null)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Link na Sidebar e no Ctrl+K**

`Sidebar.tsx`: importar `Trash2` de `lucide-react` e, na lista de itens de admin, após Histórico:

```tsx
      { href: "/admin/lixeira", icon: Trash2, label: "Lixeira", ativo: pathname === "/admin/lixeira" },
```

`CommandPalette.tsx`: no bloco `ehAdmin` das ações fixas, após "Histórico de alterações":

```tsx
            { id: "ir-lixeira", grupo: "Ações", rotulo: "Lixeira", palavrasChave: ["admin", "restaurar", "excluidos"], executar: irPara("/admin/lixeira") },
```

e na função `icone`, antes do `return` final: `if (item.id === "ir-lixeira") return <Trash2 size={14} />;` (importar `Trash2`).

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit -p . && npx eslint src/app/admin/lixeira src/components/admin/LixeiraLista.tsx src/components/layout/Sidebar.tsx src/components/command/CommandPalette.tsx`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/lixeira src/components/admin/LixeiraLista.tsx src/components/layout/Sidebar.tsx src/components/command/CommandPalette.tsx
git commit -m "Pagina de lixeira no admin com restaurar e apagar de vez"
git push origin master
```

---

### Task 7: Verificação final e roteiro com o usuário

- [ ] **Step 1: Checagem completa**

Run: `npm test && npm run build && npm run lint`
Expected: 11 testes passando, build ok, lint sem erros.

- [ ] **Step 2: Teste de ponta a ponta das RPCs (sem tocar em dados reais)**

Script temporário no scratchpad que cria uma turma `TESTE LIXEIRA (apagar)` com 2 alunos, 1 atividade e 2 notas; chama `lixeira_excluir('aluno')` → confere que o aluno sumiu e a lixeira tem `resumo.notas = 1`; `lixeira_restaurar` → confere aluno e nota de volta com o mesmo id; `lixeira_excluir('turma')` → confere que turma, alunos, colunas e notas sumiram; `lixeira_restaurar` → confere tudo de volta; exclui a turma de novo e apaga o item da lixeira, sem deixar resto. **Pedir autorização ao usuário antes de rodar**, porque escreve no banco de produção (mesmo que só na turma de teste).

- [ ] **Step 3: Roteiro manual para o usuário**

Passar ao usuário o roteiro da seção 8 da spec, incluindo pedir ao Hermes "exclua a planilha TESTE LIXEIRA" e conferir o item em `/admin/lixeira` como "Hermes, a pedido de …".
