# Plataforma de estudos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Professores montam cursos (módulos → aulas com vídeo do YouTube, texto e PDFs) e os alunos assistem no site, retomam de onde pararam e veem o progresso em % por aula, módulo e curso.

**Architecture:** Tabelas novas no Supabase (`cursos`, `curso_turmas`, `modulos`, `aulas`, `aula_arquivos`, `aula_progresso`) e bucket privado `materiais`. Lógica pura (link do YouTube, porcentagens, anti-salto, gabarito, validação de arquivo) em `src/lib/aulas/*` com testes `tsx --test`. Checagens de acesso em `src/lib/aulas/acesso.ts` (sem `"use server"`), Server Actions em `src/actions/cursos.ts`, `src/actions/arquivos.ts`, `src/actions/progresso.ts`. Player com a IFrame API do YouTube atrás de uma interface que permite trocar de provedor.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions, params como Promise), React 19, Supabase (cliente único server-side com chave anon, Storage com links assinados), Tailwind 4, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-04-plataforma-estudos-design.md`

## Global Constraints

- Leia `node_modules/next/dist/docs/` antes de usar API do Next (ex.: `next/image` usa `preload`; `params`/`searchParams` são `Promise`).
- Schema manual: SQL em `db/schema.sql` (fim do arquivo) **e** colado pelo Peter no SQL Editor. Nada é publicado antes de ele colar.
- Vídeo: `video_provedor` ∈ {`youtube`, `bunny`} + `video_id`; agora só `youtube`. ID do YouTube = 11 caracteres `[A-Za-z0-9_-]`.
- PDFs: bucket privado `materiais`; só `.pdf`, até 25 MB (26214400 bytes); caminho `<escola_id>/<curso_id>/<aula_id>/<uuid>.pdf`.
- Download: link assinado de **300 segundos**, gerado depois de checar acesso.
- Aula concluída quando `maior_posicao_seg ≥ 0,9 × duracao_seg`; duração aceita 1..21600 s.
- Anti-salto: `maior_novo = min(posicao, maior_anterior + segundos_desde_a_última_gravação × 2 + 20)`; primeira gravação limite 20.
- % aula = `round(100 × maior/duracao)` (máx. 100; concluída = 100). % módulo/curso = `round(100 × concluídas publicadas / publicadas)`, 0 se não houver publicadas.
- Gabarito: `junto` → sempre; `apos_concluir` → aula concluída; `data` → agora ≥ `gabarito_libera_em`.
- Estados na tela do aluno: "Concluída", "Não concluída · X% assistido", "Não iniciada".
- Edita curso: o `professor_id` dono **ou** `ehAdmin(role)` da mesma escola. Toda action de professor começa com `await exigirNaoAluno()`; toda action de aluno usa `getAlunoAtual()`.
- Aluno vê curso só se `curso_turmas` cruza com `aluno_turmas` dele (escola, turma, ano) e só aulas `publicada = true`.
- Funções que recebem ids sem checar acesso nunca ficam em arquivo `"use server"`.
- Textos em português do Brasil. Commit e push no `master` ao fim de cada tarefa (preferência do Peter; durante a execução com subagentes, o controlador decide quando subir), com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Hermes (MCP) não ganha acesso a nada desta parte.

## Review Focus

1. **Aluno arrasta o vídeo até o fim** (ou o navegador manda uma posição enorme): a aula não pode virar "Concluída". Pinado na Task 2 (testes de `calcularProgresso`).
2. **Link do YouTube com extras** (`&t=30s`, `?si=…`, `m.youtube.com`, `youtube-nocookie.com/embed`, espaço em volta): deve ser reconhecido; link de outro site deve dar erro claro. Pinado na Task 2.
3. **Aluno abre a URL de uma aula em rascunho, de outro curso ou de outra escola** (ou pede o download de um PDF dela): resposta "não encontrado"/erro, nunca o conteúdo. Pinado na Task 3 (`obterAulaParaAluno`) e no roteiro da Task 10.
4. **Professor envia arquivo que não é PDF ou maior que 25 MB**: recusado antes do envio, com mensagem. Pinado na Task 2 (`validarArquivo`) e na Task 6.
5. **Aula despublicada ou excluída depois que alunos já tinham progresso**: sai da conta da % (despublicada) ou some com o progresso (excluída), sem quebrar as páginas. Pinado na Task 2 (`porcentagemConjunto` só com publicadas) e na Task 8.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `db/schema.sql` (mod.) | Bloco SQL da spec |
| `src/lib/types.ts` (mod.) | Tipos `Curso`, `CursoTurma`, `Modulo`, `Aula`, `AulaArquivo`, `AulaProgresso` e tabelas no `Database` |
| `src/lib/aulas/youtube.ts` | Puro: `extrairIdYoutube` |
| `src/lib/aulas/progresso.ts` | Puro: `calcularProgresso`, `porcentagemAula`, `porcentagemConjunto`, `estadoAula`, `gabaritoLiberado` |
| `src/lib/aulas/arquivos.ts` | Puro: `validarArquivo`, `caminhoArquivo` |
| `src/lib/aulas/aulas.test.ts` | Testes dos três módulos puros |
| `src/lib/aulas/acesso.ts` | Server (sem "use server"): `exigirCursoEditavel`, `turmasDoAluno`, `cursoVisivelParaAluno`, `obterAulaParaAluno` |
| `src/lib/aulas/consultas.ts` | Server: leitura de árvore do curso, progresso do aluno e da turma |
| `src/actions/cursos.ts` | Actions de professor: curso, módulos, aulas |
| `src/actions/arquivos.ts` | Actions: preparar/registrar/remover PDF, link de download |
| `src/actions/progresso.ts` | Actions de aluno: registrar progresso, concluir aula sem vídeo |
| `src/app/cursos/page.tsx` | Lista de cursos + novo curso |
| `src/app/cursos/[id]/page.tsx` | Estrutura do curso |
| `src/app/cursos/[id]/aulas/[aulaId]/page.tsx` | Editor da aula |
| `src/app/cursos/[id]/progresso/page.tsx` | Progresso da turma |
| `src/components/cursos/FormCurso.tsx` | Formulário de curso (novo/editar) |
| `src/components/cursos/EstruturaCurso.tsx` | Módulos e aulas (cliente) |
| `src/components/cursos/EditorAula.tsx` | Edição da aula (cliente) |
| `src/components/cursos/ArquivosAula.tsx` | Envio/remoção de PDFs (cliente) |
| `src/components/aulas/PlayerVideo.tsx` | Player do YouTube com `onTempo`/`iniciarEm` |
| `src/components/aulas/BaixarArquivo.tsx` | Botão de download (cliente) |
| `src/app/aluno/cursos/page.tsx` | Cursos do aluno |
| `src/app/aluno/cursos/[id]/page.tsx` | Curso do aluno |
| `src/app/aluno/aulas/[id]/page.tsx` + `src/components/aulas/AulaAluno.tsx` | Aula do aluno |
| `src/app/aluno/page.tsx` (mod.), `src/components/layout/Sidebar.tsx` (mod.), `DESIGN.md` (mod.) | Ligações e docs |

---

### Task 1: Schema e tipos

**Files:**
- Modify: `db/schema.sql` (fim), `src/lib/types.ts`

**Interfaces:**
- Produces: tipos `Curso`, `CursoTurma`, `Modulo`, `Aula`, `AulaArquivo`, `AulaProgresso`, `RegraGabarito`, `TipoArquivoAula`, `ProvedorVideo`; tabelas `cursos`, `curso_turmas`, `modulos`, `aulas`, `aula_arquivos`, `aula_progresso` no `Database`.

- [ ] **Step 1: SQL**

Copie, sem alterar, o bloco SQL da seção "1. Banco de dados" da spec (de `-- ===== Plataforma de estudos…` até a última `create policy` do bucket) para o fim de `db/schema.sql`, depois de uma linha em branco.

- [ ] **Step 2: Tipos**

Em `src/lib/types.ts`, antes de `export type Database`:

```ts
export type ProvedorVideo = "youtube" | "bunny";
export type RegraGabarito = "junto" | "apos_concluir" | "data";
export type TipoArquivoAula = "material" | "gabarito";

export type Curso = {
  id: string;
  escola_id: string;
  professor_id: string | null;
  titulo: string;
  disciplina: string;
  descricao: string | null;
  created_at: string;
  updated_at: string;
};

export type CursoTurma = { curso_id: string; escola_id: string; turma_nome: string; ano_letivo: string };

export type Modulo = { id: string; curso_id: string; titulo: string; ordem: number; created_at: string };

export type Aula = {
  id: string;
  modulo_id: string;
  curso_id: string;
  titulo: string;
  texto: string | null;
  video_provedor: ProvedorVideo | null;
  video_id: string | null;
  publicada: boolean;
  publicada_em: string | null;
  gabarito_liberacao: RegraGabarito;
  gabarito_libera_em: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type AulaArquivo = {
  id: string;
  aula_id: string;
  tipo: TipoArquivoAula;
  nome_arquivo: string;
  storage_path: string;
  tamanho_bytes: number;
  created_at: string;
};

export type AulaProgresso = {
  conta_id: string;
  aula_id: string;
  curso_id: string;
  posicao_seg: number;
  maior_posicao_seg: number;
  duracao_seg: number | null;
  concluida_em: string | null;
  atualizado_em: string;
};
```

Em `Database.public.Tables`, depois de `convites_turma`:

```ts
      cursos: {
        Row: Curso;
        Insert: Partial<Omit<Curso, "id" | "created_at" | "updated_at">> & { escola_id: string; titulo: string; disciplina: string };
        Update: Partial<Omit<Curso, "id" | "created_at">>;
        Relationships: [];
      };
      curso_turmas: {
        Row: CursoTurma;
        Insert: CursoTurma;
        Update: Partial<CursoTurma>;
        Relationships: [];
      };
      modulos: {
        Row: Modulo;
        Insert: Partial<Omit<Modulo, "id" | "created_at">> & { curso_id: string; titulo: string };
        Update: Partial<Omit<Modulo, "id" | "created_at">>;
        Relationships: [];
      };
      aulas: {
        Row: Aula;
        Insert: Partial<Omit<Aula, "id" | "created_at" | "updated_at">> & { modulo_id: string; curso_id: string; titulo: string };
        Update: Partial<Omit<Aula, "id" | "created_at">>;
        Relationships: [];
      };
      aula_arquivos: {
        Row: AulaArquivo;
        Insert: Omit<AulaArquivo, "id" | "created_at">;
        Update: Partial<Omit<AulaArquivo, "id" | "created_at">>;
        Relationships: [];
      };
      aula_progresso: {
        Row: AulaProgresso;
        Insert: Partial<AulaProgresso> & { conta_id: string; aula_id: string; curso_id: string };
        Update: Partial<AulaProgresso>;
        Relationships: [];
      };
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` — Expected: sem erros.

- [ ] **Step 4: PARAR — Peter cola o SQL**

O controlador mostra o bloco do Step 1 ao Peter. Nenhum código desta parte é publicado antes da confirmação (tarefas 2–9 podem andar localmente).

- [ ] **Step 5: Commit**

```bash
git add db/schema.sql src/lib/types.ts
git commit -m "Schema e tipos: cursos, modulos, aulas, arquivos e progresso"
```

---

### Task 2: Lógica pura (YouTube, progresso, gabarito, arquivos)

**Files:**
- Create: `src/lib/aulas/youtube.ts`, `src/lib/aulas/progresso.ts`, `src/lib/aulas/arquivos.ts`
- Test: `src/lib/aulas/aulas.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `extrairIdYoutube(link: string): string | null`
  - `LIMIAR_CONCLUSAO = 0.9`, `DURACAO_MAXIMA_SEG = 21600`
  - `type ProgressoAnterior = { maior_posicao_seg: number; atualizado_em: string; concluida_em: string | null } | null`
  - `calcularProgresso(anterior: ProgressoAnterior, posicao: number, duracao: number, agora?: number): { posicao_seg: number; maior_posicao_seg: number; duracao_seg: number; concluir: boolean } | null`
  - `porcentagemAula(p: { maior_posicao_seg: number; duracao_seg: number | null; concluida_em: string | null } | null): number`
  - `porcentagemConjunto(concluidas: number, total: number): number`
  - `type EstadoAula = "concluida" | "andamento" | "nao_iniciada"`; `estadoAula(p: { maior_posicao_seg: number; concluida_em: string | null } | null): EstadoAula`
  - `gabaritoLiberado(regra: RegraGabarito, liberaEm: string | null, concluida: boolean, agora?: number): boolean`
  - `TAMANHO_MAXIMO_PDF = 26214400`; `validarArquivo(nome: string, tamanho: number): string | null` (mensagem de erro ou null); `caminhoArquivo(escolaId, cursoId, aulaId, uuid): string`

- [ ] **Step 1: Testes**

```ts
// src/lib/aulas/aulas.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { extrairIdYoutube } from "./youtube";
import { calcularProgresso, estadoAula, gabaritoLiberado, porcentagemAula, porcentagemConjunto } from "./progresso";
import { caminhoArquivo, validarArquivo } from "./arquivos";

const ID = "dQw4w9WgXcQ";

test("youtube: formatos aceitos", () => {
  for (const link of [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=30s`,
    `https://m.youtube.com/watch?feature=share&v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc123`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `  youtu.be/${ID}  `,
  ]) {
    assert.equal(extrairIdYoutube(link), ID, link);
  }
});

test("youtube: links inválidos dão null", () => {
  for (const link of ["", "abc", "https://vimeo.com/123456", `https://www.youtube.com/watch?v=curto`, "https://youtube.com/", `https://evil.com/watch?v=${ID}`]) {
    assert.equal(extrairIdYoutube(link), null, link);
  }
});

const AGORA = 1_800_000_000_000;
const segAtras = (s: number) => new Date(AGORA - s * 1000).toISOString();

test("progresso: primeira gravação limita a 20 s", () => {
  assert.deepEqual(calcularProgresso(null, 15, 600, AGORA), { posicao_seg: 15, maior_posicao_seg: 15, duracao_seg: 600, concluir: false });
  const salto = calcularProgresso(null, 590, 600, AGORA)!;
  assert.equal(salto.maior_posicao_seg, 20);
  assert.equal(salto.posicao_seg, 590); // retomar guarda onde está
  assert.equal(salto.concluir, false);
});

test("progresso: avanço normal é aceito e conclui aos 90%", () => {
  const ant = { maior_posicao_seg: 525, atualizado_em: segAtras(15), concluida_em: null };
  const r = calcularProgresso(ant, 540, 600, AGORA)!;
  assert.equal(r.maior_posicao_seg, 540);
  assert.equal(r.concluir, true);
});

test("progresso: salto até o fim não conclui", () => {
  const ant = { maior_posicao_seg: 60, atualizado_em: segAtras(15), concluida_em: null };
  const r = calcularProgresso(ant, 599, 600, AGORA)!;
  assert.equal(r.maior_posicao_seg, 60 + 15 * 2 + 20);
  assert.equal(r.concluir, false);
});

test("progresso: voltar no vídeo não reduz o maior ponto", () => {
  const ant = { maior_posicao_seg: 300, atualizado_em: segAtras(15), concluida_em: null };
  const r = calcularProgresso(ant, 100, 600, AGORA)!;
  assert.equal(r.maior_posicao_seg, 300);
  assert.equal(r.posicao_seg, 100);
});

test("progresso: duração inválida é recusada; posição fora da faixa é limitada", () => {
  assert.equal(calcularProgresso(null, 10, 0, AGORA), null);
  assert.equal(calcularProgresso(null, 10, 30000, AGORA), null);
  assert.equal(calcularProgresso(null, 10, Number.NaN, AGORA), null);
  assert.equal(calcularProgresso(null, -5, 600, AGORA)!.posicao_seg, 0);
  assert.equal(calcularProgresso(null, 9999, 600, AGORA)!.posicao_seg, 600);
});

test("progresso: aula já concluída não conclui de novo", () => {
  const ant = { maior_posicao_seg: 590, atualizado_em: segAtras(15), concluida_em: segAtras(100) };
  assert.equal(calcularProgresso(ant, 595, 600, AGORA)!.concluir, false);
});

test("porcentagens", () => {
  assert.equal(porcentagemAula(null), 0);
  assert.equal(porcentagemAula({ maior_posicao_seg: 300, duracao_seg: 600, concluida_em: null }), 50);
  assert.equal(porcentagemAula({ maior_posicao_seg: 300, duracao_seg: null, concluida_em: null }), 0);
  assert.equal(porcentagemAula({ maior_posicao_seg: 10, duracao_seg: 600, concluida_em: "2026-10-04T10:00:00Z" }), 100);
  assert.equal(porcentagemAula({ maior_posicao_seg: 700, duracao_seg: 600, concluida_em: null }), 100);
  assert.equal(porcentagemConjunto(0, 0), 0);
  assert.equal(porcentagemConjunto(7, 10), 70);
  assert.equal(porcentagemConjunto(1, 3), 33);
  assert.equal(porcentagemConjunto(3, 3), 100);
});

test("estado da aula", () => {
  assert.equal(estadoAula(null), "nao_iniciada");
  assert.equal(estadoAula({ maior_posicao_seg: 0, concluida_em: null }), "nao_iniciada");
  assert.equal(estadoAula({ maior_posicao_seg: 40, concluida_em: null }), "andamento");
  assert.equal(estadoAula({ maior_posicao_seg: 40, concluida_em: "2026-10-04T10:00:00Z" }), "concluida");
});

test("gabarito liberado", () => {
  assert.equal(gabaritoLiberado("junto", null, false, AGORA), true);
  assert.equal(gabaritoLiberado("apos_concluir", null, false, AGORA), false);
  assert.equal(gabaritoLiberado("apos_concluir", null, true, AGORA), true);
  assert.equal(gabaritoLiberado("data", new Date(AGORA + 1000).toISOString(), true, AGORA), false);
  assert.equal(gabaritoLiberado("data", new Date(AGORA).toISOString(), false, AGORA), true);
  assert.equal(gabaritoLiberado("data", null, true, AGORA), false);
});

test("arquivos: só PDF até 25 MB", () => {
  assert.equal(validarArquivo("Lista 1.pdf", 1000), null);
  assert.equal(validarArquivo("LISTA.PDF", 26214400), null);
  assert.match(validarArquivo("foto.png", 1000)!, /PDF/);
  assert.match(validarArquivo("grande.pdf", 26214401)!, /25 MB/);
  assert.match(validarArquivo("vazio.pdf", 0)!, /vazio/);
  assert.equal(caminhoArquivo("e", "c", "a", "u"), "e/c/a/u.pdf");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx tsx --test src/lib/aulas/aulas.test.ts` — Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementar**

```ts
// src/lib/aulas/youtube.ts
const ID_VALIDO = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be"]);

/** Código do vídeo a partir de um link do YouTube (watch, youtu.be, shorts, embed), ou null. */
export function extrairIdYoutube(link: string): string | null {
  const texto = link.trim();
  if (!texto) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;

  let candidato: string | null = null;
  if (url.hostname.toLowerCase() === "youtu.be") {
    candidato = url.pathname.split("/")[1] ?? null;
  } else if (url.pathname === "/watch") {
    candidato = url.searchParams.get("v");
  } else {
    const [, tipo, id] = url.pathname.split("/");
    if (tipo === "shorts" || tipo === "embed") candidato = id ?? null;
  }
  return candidato && ID_VALIDO.test(candidato) ? candidato : null;
}
```

```ts
// src/lib/aulas/progresso.ts
import type { RegraGabarito } from "@/lib/types";

export const LIMIAR_CONCLUSAO = 0.9;
export const DURACAO_MAXIMA_SEG = 21600;
const FOLGA_SEG = 20;

export type ProgressoAnterior = { maior_posicao_seg: number; atualizado_em: string; concluida_em: string | null } | null;

/**
 * Novo progresso a partir do que o player informou. O maior ponto assistido só avança no
 * ritmo do relógio (até 2x + folga), então arrastar o vídeo até o fim não conclui a aula.
 * A posição de retomar guarda o que foi informado. Null se a duração for inválida.
 */
export function calcularProgresso(anterior: ProgressoAnterior, posicao: number, duracao: number, agora = Date.now()) {
  const duracaoSeg = Math.round(duracao);
  if (!Number.isFinite(duracaoSeg) || duracaoSeg < 1 || duracaoSeg > DURACAO_MAXIMA_SEG) return null;
  const posicaoSeg = Number.isFinite(posicao) ? Math.min(duracaoSeg, Math.max(0, Math.round(posicao))) : 0;

  const maiorAnterior = anterior?.maior_posicao_seg ?? 0;
  const segundosPassados = anterior ? Math.max(0, (agora - Date.parse(anterior.atualizado_em)) / 1000) : 0;
  const limite = Math.floor(anterior ? maiorAnterior + segundosPassados * 2 + FOLGA_SEG : FOLGA_SEG);
  const maior = Math.min(duracaoSeg, Math.max(maiorAnterior, Math.min(posicaoSeg, limite)));

  return {
    posicao_seg: posicaoSeg,
    maior_posicao_seg: maior,
    duracao_seg: duracaoSeg,
    concluir: !anterior?.concluida_em && maior >= LIMIAR_CONCLUSAO * duracaoSeg,
  };
}

export function porcentagemAula(p: { maior_posicao_seg: number; duracao_seg: number | null; concluida_em: string | null } | null): number {
  if (!p) return 0;
  if (p.concluida_em) return 100;
  if (!p.duracao_seg) return 0;
  return Math.min(100, Math.round((100 * p.maior_posicao_seg) / p.duracao_seg));
}

export function porcentagemConjunto(concluidas: number, total: number): number {
  return total > 0 ? Math.round((100 * concluidas) / total) : 0;
}

export type EstadoAula = "concluida" | "andamento" | "nao_iniciada";

export function estadoAula(p: { maior_posicao_seg: number; concluida_em: string | null } | null): EstadoAula {
  if (p?.concluida_em) return "concluida";
  return p && p.maior_posicao_seg > 0 ? "andamento" : "nao_iniciada";
}

export function gabaritoLiberado(regra: RegraGabarito, liberaEm: string | null, concluida: boolean, agora = Date.now()): boolean {
  if (regra === "junto") return true;
  if (regra === "apos_concluir") return concluida;
  return liberaEm !== null && agora >= Date.parse(liberaEm);
}
```

```ts
// src/lib/aulas/arquivos.ts
export const TAMANHO_MAXIMO_PDF = 26214400;

/** Mensagem de erro para o arquivo, ou null se pode ser enviado. */
export function validarArquivo(nome: string, tamanho: number): string | null {
  if (!/\.pdf$/i.test(nome.trim())) return "Envie apenas arquivos PDF.";
  if (!Number.isFinite(tamanho) || tamanho <= 0) return "O arquivo está vazio.";
  if (tamanho > TAMANHO_MAXIMO_PDF) return "O arquivo passa de 25 MB.";
  return null;
}

export function caminhoArquivo(escolaId: string, cursoId: string, aulaId: string, uuid: string): string {
  return `${escolaId}/${cursoId}/${aulaId}/${uuid}.pdf`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsx --test src/lib/aulas/aulas.test.ts` — Expected: PASS. Acrescente `src/lib/aulas/aulas.test.ts` ao fim do script `test` do `package.json`; `npm test` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/aulas package.json
git commit -m "Aulas: link do YouTube, progresso com anti-salto, gabarito e validacao de PDF"
```

---

### Task 3: Acesso e consultas no servidor

**Files:**
- Create: `src/lib/aulas/acesso.ts`, `src/lib/aulas/consultas.ts`

**Interfaces:**
- Consumes: `getProfessorAtual`, `exigirNaoAluno`, `getAlunoAtual` (`@/lib/auth`); `ehAdmin` (`@/lib/papeis`); `porcentagemAula`, `porcentagemConjunto`, `estadoAula` (Task 2).
- Produces (nenhum dos dois arquivos tem `"use server"`):
  - `exigirCursoEditavel(cursoId: string): Promise<{ professor: Professor; curso: Curso }>` — lança erro se não pode editar
  - `podeEditarCurso(professor: Professor, curso: Curso): boolean`
  - `turmasDoAluno(contaId: string): Promise<{ turma_nome: string; ano_letivo: string }[]>`
  - `cursosDoAluno(aluno: AlunoConta): Promise<Curso[]>`
  - `cursoVisivelParaAluno(aluno: AlunoConta, cursoId: string): Promise<Curso | null>`
  - `obterAulaParaAluno(aluno: AlunoConta, aulaId: string): Promise<{ aula: Aula; curso: Curso } | null>` — null se rascunho, sem acesso ou inexistente
  - `type AulaResumo = Aula & { qtd_material: number; qtd_gabarito: number }`; `type ModuloComAulas = Modulo & { aulas: AulaResumo[] }`
  - `arvoreDoCurso(cursoId: string, somentePublicadas: boolean): Promise<ModuloComAulas[]>`
  - `progressoDoAluno(contaId: string, cursoId: string): Promise<Map<string, AulaProgresso>>` (chave = aula_id)
  - `type ResumoCursoAluno = { curso: Curso; professor_nome: string | null; porcentagem: number; continuar: { aula_id: string; titulo: string } | null }`
  - `resumosCursosAluno(aluno: AlunoConta): Promise<ResumoCursoAluno[]>`

- [ ] **Step 1: `src/lib/aulas/acesso.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import type { AlunoConta, Aula, Curso, Professor } from "@/lib/types";

export function podeEditarCurso(professor: Professor, curso: Curso): boolean {
  if (curso.escola_id !== professor.escola_id) return false;
  return curso.professor_id === professor.id || ehAdmin(professor.role);
}

/** Professor logado que pode editar o curso, e o curso. Lança erro caso contrário. */
export async function exigirCursoEditavel(cursoId: string): Promise<{ professor: Professor; curso: Curso }> {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  const { data: curso } = await supabase.from("cursos").select("*").eq("id", cursoId).maybeSingle();
  if (!curso || !podeEditarCurso(professor, curso)) throw new Error("Você não pode editar esse curso.");
  return { professor, curso };
}

export async function turmasDoAluno(contaId: string): Promise<{ turma_nome: string; ano_letivo: string }[]> {
  const { data } = await supabase.from("aluno_turmas").select("turma_nome, ano_letivo").eq("conta_id", contaId);
  return data ?? [];
}

/** Ids dos cursos da escola do aluno ligados a alguma turma dele. */
async function idsCursosDoAluno(aluno: AlunoConta): Promise<string[]> {
  const turmas = await turmasDoAluno(aluno.id);
  if (turmas.length === 0) return [];
  const { data } = await supabase
    .from("curso_turmas")
    .select("curso_id, turma_nome, ano_letivo")
    .eq("escola_id", aluno.escola_id)
    .in("turma_nome", [...new Set(turmas.map((t) => t.turma_nome))]);
  const chaves = new Set(turmas.map((t) => `${t.turma_nome}|${t.ano_letivo}`));
  return [...new Set((data ?? []).filter((l) => chaves.has(`${l.turma_nome}|${l.ano_letivo}`)).map((l) => l.curso_id))];
}

export async function cursosDoAluno(aluno: AlunoConta): Promise<Curso[]> {
  const ids = await idsCursosDoAluno(aluno);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("cursos").select("*").in("id", ids).eq("escola_id", aluno.escola_id).order("titulo");
  return data ?? [];
}

export async function cursoVisivelParaAluno(aluno: AlunoConta, cursoId: string): Promise<Curso | null> {
  const ids = await idsCursosDoAluno(aluno);
  if (!ids.includes(cursoId)) return null;
  const { data } = await supabase.from("cursos").select("*").eq("id", cursoId).eq("escola_id", aluno.escola_id).maybeSingle();
  return data ?? null;
}

/** Aula publicada de um curso visível para o aluno; null em qualquer outro caso. */
export async function obterAulaParaAluno(aluno: AlunoConta, aulaId: string): Promise<{ aula: Aula; curso: Curso } | null> {
  const { data: aula } = await supabase.from("aulas").select("*").eq("id", aulaId).eq("publicada", true).maybeSingle();
  if (!aula) return null;
  const curso = await cursoVisivelParaAluno(aluno, aula.curso_id);
  return curso ? { aula, curso } : null;
}
```

- [ ] **Step 2: `src/lib/aulas/consultas.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import type { AlunoConta, Aula, AulaProgresso, Curso, Modulo } from "@/lib/types";
import { cursosDoAluno } from "@/lib/aulas/acesso";
import { porcentagemConjunto } from "@/lib/aulas/progresso";

export type AulaResumo = Aula & { qtd_material: number; qtd_gabarito: number };
export type ModuloComAulas = Modulo & { aulas: AulaResumo[] };

export async function arvoreDoCurso(cursoId: string, somentePublicadas: boolean): Promise<ModuloComAulas[]> {
  let consultaAulas = supabase.from("aulas").select("*").eq("curso_id", cursoId).order("ordem");
  if (somentePublicadas) consultaAulas = consultaAulas.eq("publicada", true);
  const [{ data: modulos }, { data: aulas }] = await Promise.all([
    supabase.from("modulos").select("*").eq("curso_id", cursoId).order("ordem"),
    consultaAulas,
  ]);
  const ids = (aulas ?? []).map((a) => a.id);
  const { data: arquivos } = ids.length
    ? await supabase.from("aula_arquivos").select("aula_id, tipo").in("aula_id", ids)
    : { data: [] as { aula_id: string; tipo: string }[] };

  const contagem = new Map<string, { material: number; gabarito: number }>();
  for (const a of arquivos ?? []) {
    const c = contagem.get(a.aula_id) ?? { material: 0, gabarito: 0 };
    if (a.tipo === "gabarito") c.gabarito++;
    else c.material++;
    contagem.set(a.aula_id, c);
  }
  return (modulos ?? []).map((m) => ({
    ...m,
    aulas: (aulas ?? [])
      .filter((a) => a.modulo_id === m.id)
      .map((a) => ({ ...a, qtd_material: contagem.get(a.id)?.material ?? 0, qtd_gabarito: contagem.get(a.id)?.gabarito ?? 0 })),
  }));
}

export async function progressoDoAluno(contaId: string, cursoId: string): Promise<Map<string, AulaProgresso>> {
  const { data } = await supabase.from("aula_progresso").select("*").eq("conta_id", contaId).eq("curso_id", cursoId);
  return new Map((data ?? []).map((p) => [p.aula_id, p]));
}

export type ResumoCursoAluno = {
  curso: Curso;
  professor_nome: string | null;
  porcentagem: number;
  continuar: { aula_id: string; titulo: string } | null;
};

export async function resumosCursosAluno(aluno: AlunoConta): Promise<ResumoCursoAluno[]> {
  const cursos = await cursosDoAluno(aluno);
  if (cursos.length === 0) return [];
  const idsProfessores = [...new Set(cursos.map((c) => c.professor_id).filter((id): id is string => !!id))];
  const { data: professores } = idsProfessores.length
    ? await supabase.from("professores").select("id, nome").in("id", idsProfessores)
    : { data: [] as { id: string; nome: string }[] };
  const nomes = new Map((professores ?? []).map((p) => [p.id, p.nome]));

  return Promise.all(
    cursos.map(async (curso) => {
      const [arvore, progresso] = await Promise.all([arvoreDoCurso(curso.id, true), progressoDoAluno(aluno.id, curso.id)]);
      const aulas = arvore.flatMap((m) => m.aulas);
      const concluidas = aulas.filter((a) => progresso.get(a.id)?.concluida_em).length;
      const emAndamento = aulas
        .filter((a) => progresso.has(a.id) && !progresso.get(a.id)!.concluida_em)
        .sort((x, y) => Date.parse(progresso.get(y.id)!.atualizado_em) - Date.parse(progresso.get(x.id)!.atualizado_em))[0];
      const proxima = emAndamento ?? aulas.find((a) => !progresso.get(a.id)?.concluida_em);
      return {
        curso,
        professor_nome: curso.professor_id ? nomes.get(curso.professor_id) ?? null : null,
        porcentagem: porcentagemConjunto(concluidas, aulas.length),
        continuar: proxima ? { aula_id: proxima.id, titulo: proxima.titulo } : null,
      };
    })
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npx eslint src/lib/aulas` — Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/aulas/acesso.ts src/lib/aulas/consultas.ts
git commit -m "Aulas: checagens de acesso e consultas de curso e progresso"
```

---

### Task 4: Actions de curso, módulos e aulas

**Files:**
- Create: `src/actions/cursos.ts`

**Interfaces:**
- Consumes: `exigirCursoEditavel` (Task 3), `exigirNaoAluno`, `getProfessorAtual`, `extrairIdYoutube` (Task 2).
- Produces (todas em `"use server"`, todas checam acesso):
  - `type DadosCurso = { titulo: string; disciplina: string; descricao: string; turmas: { turma_nome: string; ano_letivo: string }[] }`
  - `criarCurso(dados: DadosCurso): Promise<string>` (id)
  - `atualizarCurso(cursoId: string, dados: DadosCurso): Promise<void>`
  - `criarModulo(cursoId: string, titulo: string): Promise<void>`
  - `renomearModulo(moduloId: string, titulo: string): Promise<void>`
  - `excluirModulo(moduloId: string): Promise<void>`
  - `moverModulo(moduloId: string, direcao: -1 | 1): Promise<void>`
  - `criarAula(moduloId: string, titulo: string): Promise<string>` (id)
  - `type DadosAula = { titulo: string; texto: string; linkVideo: string; gabarito_liberacao: RegraGabarito; gabarito_libera_em: string | null }`
  - `salvarAula(aulaId: string, dados: DadosAula): Promise<void>` (lança "Link do YouTube não reconhecido." se o link não vazio for inválido)
  - `definirPublicacao(aulaId: string, publicada: boolean): Promise<void>`
  - `excluirAula(aulaId: string): Promise<void>` (apaga também os PDFs do bucket)
  - `moverAula(aulaId: string, direcao: -1 | 1): Promise<void>`
  - `contarProgressos(alvo: { moduloId?: string; aulaId?: string }): Promise<number>` (quantos alunos têm progresso, para a confirmação)

- [ ] **Step 1: Implementar**

```ts
"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import { exigirCursoEditavel } from "@/lib/aulas/acesso";
import { extrairIdYoutube } from "@/lib/aulas/youtube";
import type { RegraGabarito } from "@/lib/types";

export type DadosCurso = {
  titulo: string;
  disciplina: string;
  descricao: string;
  turmas: { turma_nome: string; ano_letivo: string }[];
};

function limparCurso(dados: DadosCurso) {
  const titulo = dados.titulo.trim();
  const disciplina = dados.disciplina.trim();
  if (!titulo || !disciplina) throw new Error("Informe o título e a disciplina.");
  return { titulo, disciplina, descricao: dados.descricao.trim() || null };
}

async function gravarTurmas(cursoId: string, escolaId: string, turmas: DadosCurso["turmas"]) {
  await supabase.from("curso_turmas").delete().eq("curso_id", cursoId);
  const unicas = [...new Map(turmas.map((t) => [`${t.turma_nome}|${t.ano_letivo}`, t])).values()];
  if (unicas.length === 0) return;
  const { error } = await supabase
    .from("curso_turmas")
    .insert(unicas.map((t) => ({ curso_id: cursoId, escola_id: escolaId, turma_nome: t.turma_nome, ano_letivo: t.ano_letivo })));
  if (error) throw new Error(error.message);
}

export async function criarCurso(dados: DadosCurso): Promise<string> {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  const limpo = limparCurso(dados);
  const { data, error } = await supabase
    .from("cursos")
    .insert({ ...limpo, escola_id: professor.escola_id, professor_id: professor.id })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar curso.");
  await gravarTurmas(data.id, professor.escola_id, dados.turmas);
  return data.id;
}

export async function atualizarCurso(cursoId: string, dados: DadosCurso): Promise<void> {
  const { curso } = await exigirCursoEditavel(cursoId);
  const { error } = await supabase
    .from("cursos")
    .update({ ...limparCurso(dados), updated_at: new Date().toISOString() })
    .eq("id", cursoId);
  if (error) throw new Error(error.message);
  await gravarTurmas(cursoId, curso.escola_id, dados.turmas);
}

async function moduloEditavel(moduloId: string) {
  const { data: modulo } = await supabase.from("modulos").select("*").eq("id", moduloId).maybeSingle();
  if (!modulo) throw new Error("Módulo não encontrado.");
  await exigirCursoEditavel(modulo.curso_id);
  return modulo;
}

async function aulaEditavel(aulaId: string) {
  const { data: aula } = await supabase.from("aulas").select("*").eq("id", aulaId).maybeSingle();
  if (!aula) throw new Error("Aula não encontrada.");
  const { curso } = await exigirCursoEditavel(aula.curso_id);
  return { aula, curso };
}

export async function criarModulo(cursoId: string, titulo: string): Promise<void> {
  await exigirCursoEditavel(cursoId);
  const limpo = titulo.trim();
  if (!limpo) throw new Error("Informe o nome do módulo.");
  const { count } = await supabase.from("modulos").select("id", { count: "exact", head: true }).eq("curso_id", cursoId);
  const { error } = await supabase.from("modulos").insert({ curso_id: cursoId, titulo: limpo, ordem: count ?? 0 });
  if (error) throw new Error(error.message);
}

export async function renomearModulo(moduloId: string, titulo: string): Promise<void> {
  await moduloEditavel(moduloId);
  const limpo = titulo.trim();
  if (!limpo) throw new Error("Informe o nome do módulo.");
  const { error } = await supabase.from("modulos").update({ titulo: limpo }).eq("id", moduloId);
  if (error) throw new Error(error.message);
}

async function apagarPdfsDasAulas(aulaIds: string[]) {
  if (aulaIds.length === 0) return;
  const { data } = await supabase.from("aula_arquivos").select("storage_path").in("aula_id", aulaIds);
  const caminhos = (data ?? []).map((a) => a.storage_path);
  if (caminhos.length) await supabase.storage.from("materiais").remove(caminhos);
}

export async function excluirModulo(moduloId: string): Promise<void> {
  await moduloEditavel(moduloId);
  const { data: aulas } = await supabase.from("aulas").select("id").eq("modulo_id", moduloId);
  await apagarPdfsDasAulas((aulas ?? []).map((a) => a.id));
  const { error } = await supabase.from("modulos").delete().eq("id", moduloId);
  if (error) throw new Error(error.message);
}

/** Troca a ordem com o vizinho (acima: -1, abaixo: 1) e renumera 0..n-1. */
async function mover(tabela: "modulos" | "aulas", filtro: { coluna: "curso_id" | "modulo_id"; valor: string }, id: string, direcao: -1 | 1) {
  const { data } = await supabase.from(tabela).select("id, ordem").eq(filtro.coluna, filtro.valor).order("ordem");
  const lista = [...(data ?? [])];
  const i = lista.findIndex((l) => l.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  for (let k = 0; k < lista.length; k++) {
    const { error } = await supabase.from(tabela).update({ ordem: k }).eq("id", lista[k].id);
    if (error) throw new Error(error.message);
  }
}

export async function moverModulo(moduloId: string, direcao: -1 | 1): Promise<void> {
  const modulo = await moduloEditavel(moduloId);
  await mover("modulos", { coluna: "curso_id", valor: modulo.curso_id }, moduloId, direcao);
}

export async function criarAula(moduloId: string, titulo: string): Promise<string> {
  const modulo = await moduloEditavel(moduloId);
  const limpo = titulo.trim();
  if (!limpo) throw new Error("Informe o título da aula.");
  const { count } = await supabase.from("aulas").select("id", { count: "exact", head: true }).eq("modulo_id", moduloId);
  const { data, error } = await supabase
    .from("aulas")
    .insert({ modulo_id: moduloId, curso_id: modulo.curso_id, titulo: limpo, ordem: count ?? 0 })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar aula.");
  return data.id;
}

export type DadosAula = {
  titulo: string;
  texto: string;
  linkVideo: string;
  gabarito_liberacao: RegraGabarito;
  gabarito_libera_em: string | null;
};

export async function salvarAula(aulaId: string, dados: DadosAula): Promise<void> {
  await aulaEditavel(aulaId);
  const titulo = dados.titulo.trim();
  if (!titulo) throw new Error("Informe o título da aula.");
  let video_id: string | null = null;
  if (dados.linkVideo.trim()) {
    video_id = extrairIdYoutube(dados.linkVideo);
    if (!video_id) throw new Error("Link do YouTube não reconhecido.");
  }
  if (!["junto", "apos_concluir", "data"].includes(dados.gabarito_liberacao)) throw new Error("Regra do gabarito inválida.");
  if (dados.gabarito_liberacao === "data" && (!dados.gabarito_libera_em || Number.isNaN(Date.parse(dados.gabarito_libera_em)))) {
    throw new Error("Informe a data de liberação do gabarito.");
  }
  const { error } = await supabase
    .from("aulas")
    .update({
      titulo,
      texto: dados.texto.trim() || null,
      video_provedor: video_id ? "youtube" : null,
      video_id,
      gabarito_liberacao: dados.gabarito_liberacao,
      gabarito_libera_em: dados.gabarito_liberacao === "data" ? new Date(dados.gabarito_libera_em!).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", aulaId);
  if (error) throw new Error(error.message);
}

export async function definirPublicacao(aulaId: string, publicada: boolean): Promise<void> {
  const { aula } = await aulaEditavel(aulaId);
  const { error } = await supabase
    .from("aulas")
    .update({ publicada, publicada_em: publicada ? aula.publicada_em ?? new Date().toISOString() : aula.publicada_em })
    .eq("id", aulaId);
  if (error) throw new Error(error.message);
}

export async function excluirAula(aulaId: string): Promise<void> {
  await aulaEditavel(aulaId);
  await apagarPdfsDasAulas([aulaId]);
  const { error } = await supabase.from("aulas").delete().eq("id", aulaId);
  if (error) throw new Error(error.message);
}

export async function moverAula(aulaId: string, direcao: -1 | 1): Promise<void> {
  const { aula } = await aulaEditavel(aulaId);
  await mover("aulas", { coluna: "modulo_id", valor: aula.modulo_id }, aulaId, direcao);
}

export async function contarProgressos(alvo: { moduloId?: string; aulaId?: string }): Promise<number> {
  let aulaIds: string[] = [];
  if (alvo.aulaId) {
    await aulaEditavel(alvo.aulaId);
    aulaIds = [alvo.aulaId];
  } else if (alvo.moduloId) {
    await moduloEditavel(alvo.moduloId);
    const { data } = await supabase.from("aulas").select("id").eq("modulo_id", alvo.moduloId);
    aulaIds = (data ?? []).map((a) => a.id);
  }
  if (aulaIds.length === 0) return 0;
  const { data } = await supabase.from("aula_progresso").select("conta_id").in("aula_id", aulaIds);
  return new Set((data ?? []).map((p) => p.conta_id)).size;
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npx eslint src/actions/cursos.ts && npm test` — Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add src/actions/cursos.ts
git commit -m "Aulas: actions de curso, modulos e aulas para o professor"
```

---

### Task 5: Telas do professor — lista e estrutura do curso

**Files:**
- Create: `src/app/cursos/page.tsx`, `src/app/cursos/[id]/page.tsx`, `src/components/cursos/FormCurso.tsx`, `src/components/cursos/EstruturaCurso.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `criarCurso`, `atualizarCurso`, `criarModulo`, `renomearModulo`, `excluirModulo`, `moverModulo`, `criarAula`, `moverAula`, `excluirAula`, `contarProgressos`, `type DadosCurso` (Task 4); `arvoreDoCurso`, `type ModuloComAulas` (Task 3); `podeEditarCurso` (Task 3); `listarTurmasAcessiveis` (`@/actions/turmas`); `PageLayout`, `Modal`, `estilos`.
- Produces: `<FormCurso>` com props `{ inicial?: DadosCurso & { id: string }; turmas: { turma_nome: string; ano_letivo: string }[]; onSalvo?: () => void }`.

- [ ] **Step 1: `src/components/cursos/FormCurso.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { atualizarCurso, criarCurso, type DadosCurso } from "@/actions/cursos";
import { estilos } from "@/components/ui/estilos";

type Props = {
  inicial?: DadosCurso & { id: string };
  turmas: { turma_nome: string; ano_letivo: string }[];
  onSalvo?: () => void;
};

const chave = (t: { turma_nome: string; ano_letivo: string }) => `${t.turma_nome}|${t.ano_letivo}`;

export function FormCurso({ inicial, turmas, onSalvo }: Props) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [disciplina, setDisciplina] = useState(inicial?.disciplina ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [marcadas, setMarcadas] = useState(new Set((inicial?.turmas ?? []).map(chave)));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const dados: DadosCurso = { titulo, disciplina, descricao, turmas: turmas.filter((t) => marcadas.has(chave(t))) };
    try {
      if (inicial) {
        await atualizarCurso(inicial.id, dados);
        router.refresh();
        onSalvo?.();
      } else {
        const id = await criarCurso(dados);
        router.push(`/cursos/${id}`);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      <label className="flex flex-col gap-1 text-xs text-muted">Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Física — 3º ano" className={estilos.input} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Disciplina<input value={disciplina} onChange={(e) => setDisciplina(e.target.value)} required placeholder="Física" className={estilos.input} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Descrição (opcional)<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className={estilos.input} /></label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-muted">Turmas que veem o curso</legend>
        {turmas.length === 0 && <p className="text-sm text-muted">Nenhuma turma disponível.</p>}
        <div className="flex flex-wrap gap-2">
          {turmas.map((t) => {
            const k = chave(t);
            return (
              <label key={k} className="flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1.5 text-sm text-ink">
                <input type="checkbox" checked={marcadas.has(k)} onChange={(e) => {
                  const nova = new Set(marcadas);
                  if (e.target.checked) nova.add(k); else nova.delete(k);
                  setMarcadas(nova);
                }} />
                {t.turma_nome} · {t.ano_letivo}
              </label>
            );
          })}
        </div>
      </fieldset>
      <button type="submit" disabled={salvando} className={estilos.botaoPrimario}>{salvando ? "Salvando…" : inicial ? "Salvar curso" : "Criar curso"}</button>
    </form>
  );
}
```

- [ ] **Step 2: `src/app/cursos/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { supabase } from "@/lib/supabase/client";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { PageLayout } from "@/components/layout/PageLayout";
import { FormCurso } from "@/components/cursos/FormCurso";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function CursosPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");

  let consulta = supabase.from("cursos").select("*").eq("escola_id", professor.escola_id).order("titulo");
  if (!ehAdmin(professor.role)) consulta = consulta.eq("professor_id", professor.id);
  const [{ data: cursos }, turmas, { data: professores }] = await Promise.all([
    consulta,
    listarTurmasAcessiveis(),
    supabase.from("professores").select("id, nome").eq("escola_id", professor.escola_id),
  ]);
  const nomes = new Map((professores ?? []).map((p) => [p.id, p.nome]));
  const opcoes = [...new Map(turmas.map((t) => [`${t.nome}|${t.ano_letivo}`, { turma_nome: t.nome, ano_letivo: t.ano_letivo }])).values()];

  return (
    <PageLayout crumb="Aulas" titulo="Seus cursos" subtitulo="Monte módulos e aulas com vídeo e material para as suas turmas." largura="max-w-6xl">
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="titulo-lista" className={`${estilos.card} p-4`}>
          <h2 id="titulo-lista" className="sr-only">Cursos</h2>
          {(cursos ?? []).length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted"><BookOpen size={16} aria-hidden="true" /> Nenhum curso ainda. Crie o primeiro ao lado.</p>
          ) : (
            <ul className="divide-y divide-line">
              {(cursos ?? []).map((c) => (
                <li key={c.id}>
                  <Link href={`/cursos/${c.id}`} className="flex items-center justify-between gap-3 rounded-control px-2 py-3 hover:bg-surface-sunken">
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{c.titulo}</span>
                      <span className="block text-xs text-muted">{c.disciplina}{ehAdmin(professor.role) && c.professor_id ? ` · ${nomes.get(c.professor_id) ?? ""}` : ""}</span>
                    </span>
                    <span aria-hidden="true" className="text-brand">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="titulo-novo" className={`${estilos.card} p-4`}>
          <h2 id="titulo-novo" className="mb-3 font-semibold text-ink">Novo curso</h2>
          <FormCurso turmas={opcoes} />
        </section>
      </div>
    </PageLayout>
  );
}
```

- [ ] **Step 3: `src/components/cursos/EstruturaCurso.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { contarProgressos, criarAula, criarModulo, excluirAula, excluirModulo, moverAula, moverModulo, renomearModulo } from "@/actions/cursos";
import type { ModuloComAulas } from "@/lib/aulas/consultas";
import { estilos } from "@/components/ui/estilos";

export function EstruturaCurso({ cursoId, modulos }: { cursoId: string; modulos: ModuloComAulas[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novoModulo, setNovoModulo] = useState("");

  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarExclusao(alvo: { moduloId?: string; aulaId?: string }, nome: string) {
    const alunos = await contarProgressos(alvo);
    const aviso = alunos > 0 ? ` ${alunos} aluno(s) já têm progresso aqui e ele será apagado.` : "";
    return window.confirm(`Excluir ${nome}?${aviso}`);
  }

  const iconeBotao = `${estilos.botaoFantasma} px-2`;

  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {modulos.length === 0 && <p className={`${estilos.card} p-4 text-sm text-muted`}>Comece criando o primeiro módulo.</p>}
      {modulos.map((m, i) => (
        <section key={m.id} aria-label={m.titulo} className={`${estilos.card} p-4`}>
          <div className="flex flex-wrap items-center gap-1">
            <h2 className="mr-auto font-semibold text-ink">Módulo {i + 1} — {m.titulo}</h2>
            <button type="button" aria-label="Subir módulo" disabled={ocupado || i === 0} onClick={() => executar(() => moverModulo(m.id, -1))} className={iconeBotao}><ArrowUp size={15} /></button>
            <button type="button" aria-label="Descer módulo" disabled={ocupado || i === modulos.length - 1} onClick={() => executar(() => moverModulo(m.id, 1))} className={iconeBotao}><ArrowDown size={15} /></button>
            <button type="button" aria-label="Renomear módulo" disabled={ocupado} onClick={() => { const t = window.prompt("Novo nome do módulo", m.titulo); if (t) void executar(() => renomearModulo(m.id, t)); }} className={iconeBotao}><Pencil size={15} /></button>
            <button type="button" aria-label="Excluir módulo" disabled={ocupado} onClick={async () => { if (await confirmarExclusao({ moduloId: m.id }, `o módulo "${m.titulo}" e suas aulas`)) void executar(() => excluirModulo(m.id)); }} className={iconeBotao}><Trash2 size={15} /></button>
          </div>
          <ol className="mt-2 divide-y divide-line">
            {m.aulas.map((a, j) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Link href={`/cursos/${cursoId}/aulas/${a.id}`} className="mr-auto min-w-0 font-medium text-ink hover:text-brand hover:underline">{j + 1}. {a.titulo}</Link>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${a.publicada ? "bg-ok/15 text-ink" : "bg-surface-sunken text-muted"}`}>{a.publicada ? "Publicada" : "Rascunho"}</span>
                <span className="text-xs text-muted">{[a.video_id ? "vídeo" : null, a.qtd_material + a.qtd_gabarito > 0 ? `${a.qtd_material + a.qtd_gabarito} PDF(s)` : null].filter(Boolean).join(" · ") || "vazia"}</span>
                <button type="button" aria-label="Subir aula" disabled={ocupado || j === 0} onClick={() => executar(() => moverAula(a.id, -1))} className={iconeBotao}><ArrowUp size={14} /></button>
                <button type="button" aria-label="Descer aula" disabled={ocupado || j === m.aulas.length - 1} onClick={() => executar(() => moverAula(a.id, 1))} className={iconeBotao}><ArrowDown size={14} /></button>
                <button type="button" aria-label="Excluir aula" disabled={ocupado} onClick={async () => { if (await confirmarExclusao({ aulaId: a.id }, `a aula "${a.titulo}"`)) void executar(() => excluirAula(a.id)); }} className={iconeBotao}><Trash2 size={14} /></button>
              </li>
            ))}
          </ol>
          <button type="button" disabled={ocupado} onClick={() => { const t = window.prompt("Título da nova aula"); if (t) void executar(async () => { const id = await criarAula(m.id, t); router.push(`/cursos/${cursoId}/aulas/${id}`); }); }} className={`${estilos.botaoSecundario} mt-2`}>
            <Plus size={15} aria-hidden="true" /> Aula
          </button>
        </section>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); if (novoModulo.trim()) void executar(async () => { await criarModulo(cursoId, novoModulo); setNovoModulo(""); }); }} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="novo-modulo">Nome do novo módulo</label>
        <input id="novo-modulo" value={novoModulo} onChange={(e) => setNovoModulo(e.target.value)} placeholder="Nome do novo módulo (ex.: Termodinâmica)" className={`${estilos.input} max-w-sm`} />
        <button type="submit" disabled={ocupado || !novoModulo.trim()} className={estilos.botaoPrimario}><Plus size={15} aria-hidden="true" /> Novo módulo</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: `src/app/cursos/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeEditarCurso } from "@/lib/aulas/acesso";
import { arvoreDoCurso } from "@/lib/aulas/consultas";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { PageLayout } from "@/components/layout/PageLayout";
import { EstruturaCurso } from "@/components/cursos/EstruturaCurso";
import { EditarCursoBotao } from "@/components/cursos/EditarCursoBotao";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function CursoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: curso } = await supabase.from("cursos").select("*").eq("id", id).maybeSingle();
  if (!curso || !podeEditarCurso(professor, curso)) notFound();

  const [modulos, { data: vinculos }, turmas] = await Promise.all([
    arvoreDoCurso(id, false),
    supabase.from("curso_turmas").select("turma_nome, ano_letivo").eq("curso_id", id),
    listarTurmasAcessiveis(),
  ]);
  const turmasCurso = vinculos ?? [];
  const opcoes = [...new Map([
    ...turmas.map((t) => [`${t.nome}|${t.ano_letivo}`, { turma_nome: t.nome, ano_letivo: t.ano_letivo }] as const),
    ...turmasCurso.map((t) => [`${t.turma_nome}|${t.ano_letivo}`, t] as const),
  ]).values()];

  return (
    <PageLayout
      crumb={`Aulas · ${curso.disciplina}`}
      titulo={curso.titulo}
      subtitulo={turmasCurso.length ? `Turmas: ${turmasCurso.map((t) => `${t.turma_nome} · ${t.ano_letivo}`).join(", ")}` : "Nenhuma turma vinculada — os alunos ainda não veem este curso."}
      acoes={
        <>
          <EditarCursoBotao inicial={{ id: curso.id, titulo: curso.titulo, disciplina: curso.disciplina, descricao: curso.descricao ?? "", turmas: turmasCurso }} turmas={opcoes} />
          <Link href={`/cursos/${id}/progresso`} className={estilos.botaoSecundario}><BarChart3 size={16} aria-hidden="true" /> Progresso da turma</Link>
        </>
      }
      largura="max-w-4xl"
    >
      <EstruturaCurso cursoId={id} modulos={modulos} />
    </PageLayout>
  );
}
```

E o botão de editar (modal com `FormCurso`):

```tsx
// src/components/cursos/EditarCursoBotao.tsx
"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { DadosCurso } from "@/actions/cursos";
import { Modal } from "@/components/ui/Modal";
import { estilos } from "@/components/ui/estilos";
import { FormCurso } from "./FormCurso";

export function EditarCursoBotao({ inicial, turmas }: { inicial: DadosCurso & { id: string }; turmas: { turma_nome: string; ano_letivo: string }[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={estilos.botaoSecundario}><Pencil size={16} aria-hidden="true" /> Editar curso</button>
      <Modal open={aberto} onClose={() => setAberto(false)} titulo="Editar curso" largura="md">
        <FormCurso inicial={inicial} turmas={turmas} onSalvo={() => setAberto(false)} />
      </Modal>
    </>
  );
}
```

(Acrescente `src/components/cursos/EditarCursoBotao.tsx` à lista de arquivos criados desta tarefa.)

- [ ] **Step 5: Item "Aulas" na barra lateral**

Em `src/components/layout/Sidebar.tsx`, no array `itens`, logo depois de "Turmas":

```ts
{ href: "/cursos", icon: BookOpen, label: "Aulas", ativo: pathname.startsWith("/cursos") },
```

e acrescente `BookOpen` ao import de `lucide-react`.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm run build` — Expected: OK.

- [ ] **Step 7: Commit**

```bash
git add src/app/cursos src/components/cursos src/components/layout/Sidebar.tsx
git commit -m "Aulas: telas do professor para criar cursos, modulos e aulas"
```

---

### Task 6: Editor da aula e envio de PDFs

**Files:**
- Create: `src/actions/arquivos.ts`, `src/app/cursos/[id]/aulas/[aulaId]/page.tsx`, `src/components/cursos/EditorAula.tsx`, `src/components/cursos/ArquivosAula.tsx`

**Interfaces:**
- Consumes: `salvarAula`, `definirPublicacao`, `type DadosAula` (Task 4); `exigirCursoEditavel`, `obterAulaParaAluno` (Task 3); `validarArquivo`, `caminhoArquivo`, `gabaritoLiberado` (Task 2); `getAlunoAtual`, `getProfessorAtual`, `exigirNaoAluno`; `podeEditarCurso`.
- Produces:
  - `prepararEnvioArquivo(aulaId: string, tipo: TipoArquivoAula, nome: string, tamanho: number): Promise<{ signedUrl: string; storagePath: string }>`
  - `registrarArquivo(aulaId: string, tipo: TipoArquivoAula, nome: string, tamanho: number, storagePath: string): Promise<void>`
  - `removerArquivo(arquivoId: string): Promise<void>`
  - `linkDownloadArquivo(arquivoId: string): Promise<string>` (professor que edita o curso, ou aluno com acesso e gabarito liberado)

- [ ] **Step 1: Prova do envio direto (spike, apagado no fim)**

Antes de escrever a action, confirme que o navegador consegue enviar ao link assinado **sem a chave do Supabase**. Com o SQL já colado, rode no worktree:

```bash
node -e '
const fs=require("fs");const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^"|"$/g,"")]}));
const {createClient}=require("@supabase/supabase-js");const s=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async()=>{const p="teste/spike-"+Date.now()+".pdf";const {data,error}=await s.storage.from("materiais").createSignedUploadUrl(p);if(error)throw error;
const fd=new FormData();fd.append("cacheControl","3600");fd.append("",new Blob(["%PDF-1.4\n%%EOF"],{type:"application/pdf"}),"x.pdf");
const r=await fetch(data.signedUrl,{method:"PUT",body:fd,headers:{"x-upsert":"false"}});console.log("PUT sem chave:",r.status,await r.text());
await s.storage.from("materiais").remove([p]);})()'
```

Expected: `PUT sem chave: 200`. Se der 400/401 pedindo `apikey`, **pare e reporte BLOCKED** ao controlador com a saída: a alternativa (servidor repassando o arquivo) esbarra no limite de 4,5 MB por requisição da Vercel e precisa de decisão.

- [ ] **Step 2: `src/actions/arquivos.ts`**

```ts
"use server";

import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual, getProfessorAtual } from "@/lib/auth";
import { exigirCursoEditavel, obterAulaParaAluno, podeEditarCurso } from "@/lib/aulas/acesso";
import { caminhoArquivo, validarArquivo } from "@/lib/aulas/arquivos";
import { gabaritoLiberado } from "@/lib/aulas/progresso";
import type { TipoArquivoAula } from "@/lib/types";

const VALIDADE_DOWNLOAD_SEG = 300;

async function aulaEditavel(aulaId: string) {
  const { data: aula } = await supabase.from("aulas").select("*").eq("id", aulaId).maybeSingle();
  if (!aula) throw new Error("Aula não encontrada.");
  const { curso } = await exigirCursoEditavel(aula.curso_id);
  return { aula, curso };
}

function tipoValido(tipo: string): tipo is TipoArquivoAula {
  return tipo === "material" || tipo === "gabarito";
}

export async function prepararEnvioArquivo(aulaId: string, tipo: TipoArquivoAula, nome: string, tamanho: number) {
  const { aula, curso } = await aulaEditavel(aulaId);
  if (!tipoValido(tipo)) throw new Error("Tipo de arquivo inválido.");
  const erro = validarArquivo(nome, tamanho);
  if (erro) throw new Error(erro);
  const storagePath = caminhoArquivo(curso.escola_id, curso.id, aula.id, randomUUID());
  const { data, error } = await supabase.storage.from("materiais").createSignedUploadUrl(storagePath);
  if (error || !data) throw new Error(error?.message ?? "Não foi possível preparar o envio.");
  return { signedUrl: data.signedUrl, storagePath };
}

export async function registrarArquivo(aulaId: string, tipo: TipoArquivoAula, nome: string, tamanho: number, storagePath: string): Promise<void> {
  const { aula, curso } = await aulaEditavel(aulaId);
  if (!tipoValido(tipo)) throw new Error("Tipo de arquivo inválido.");
  const erro = validarArquivo(nome, tamanho);
  if (erro) throw new Error(erro);
  if (!storagePath.startsWith(`${curso.escola_id}/${curso.id}/${aula.id}/`)) throw new Error("Caminho de arquivo inválido.");
  const { error } = await supabase
    .from("aula_arquivos")
    .insert({ aula_id: aula.id, tipo, nome_arquivo: nome.trim(), storage_path: storagePath, tamanho_bytes: Math.round(tamanho) });
  if (error) throw new Error(error.message);
}

export async function removerArquivo(arquivoId: string): Promise<void> {
  const { data: arquivo } = await supabase.from("aula_arquivos").select("*").eq("id", arquivoId).maybeSingle();
  if (!arquivo) return;
  await aulaEditavel(arquivo.aula_id);
  await supabase.storage.from("materiais").remove([arquivo.storage_path]);
  const { error } = await supabase.from("aula_arquivos").delete().eq("id", arquivoId);
  if (error) throw new Error(error.message);
}

/** Link de 5 minutos para baixar o PDF, depois de checar quem está pedindo. */
export async function linkDownloadArquivo(arquivoId: string): Promise<string> {
  const { data: arquivo } = await supabase.from("aula_arquivos").select("*").eq("id", arquivoId).maybeSingle();
  if (!arquivo) throw new Error("Arquivo não encontrado.");

  const professor = await getProfessorAtual();
  let permitido = false;
  if (professor) {
    const { data: aula } = await supabase.from("aulas").select("curso_id").eq("id", arquivo.aula_id).maybeSingle();
    const { data: curso } = aula ? await supabase.from("cursos").select("*").eq("id", aula.curso_id).maybeSingle() : { data: null };
    permitido = !!curso && podeEditarCurso(professor, curso);
  } else {
    const aluno = await getAlunoAtual();
    const acesso = aluno ? await obterAulaParaAluno(aluno, arquivo.aula_id) : null;
    if (aluno && acesso) {
      if (arquivo.tipo === "material") permitido = true;
      else {
        const { data: progresso } = await supabase
          .from("aula_progresso")
          .select("concluida_em")
          .eq("conta_id", aluno.id)
          .eq("aula_id", arquivo.aula_id)
          .maybeSingle();
        permitido = gabaritoLiberado(acesso.aula.gabarito_liberacao, acesso.aula.gabarito_libera_em, !!progresso?.concluida_em);
      }
    }
  }
  if (!permitido) throw new Error("Você não tem acesso a esse arquivo.");

  const { data, error } = await supabase.storage
    .from("materiais")
    .createSignedUrl(arquivo.storage_path, VALIDADE_DOWNLOAD_SEG, { download: arquivo.nome_arquivo });
  if (error || !data) throw new Error(error?.message ?? "Não foi possível gerar o link.");
  return data.signedUrl;
}
```

- [ ] **Step 3: `src/components/cursos/ArquivosAula.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { prepararEnvioArquivo, registrarArquivo, removerArquivo } from "@/actions/arquivos";
import { validarArquivo } from "@/lib/aulas/arquivos";
import type { AulaArquivo, TipoArquivoAula } from "@/lib/types";
import { BaixarArquivo } from "@/components/aulas/BaixarArquivo";
import { estilos } from "@/components/ui/estilos";

/** Envia ao link assinado do Supabase com progresso (XMLHttpRequest para ter onprogress). */
function enviar(url: string, arquivo: File, onProgresso: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const corpo = new FormData();
    corpo.append("cacheControl", "3600");
    corpo.append("", arquivo, arquivo.name);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgresso(Math.round((100 * e.loaded) / e.total)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Falha no envio do arquivo.")));
    xhr.onerror = () => reject(new Error("Falha no envio do arquivo."));
    xhr.send(corpo);
  });
}

export function ArquivosAula({ aulaId, tipo, arquivos }: { aulaId: string; tipo: TipoArquivoAula; arquivos: AulaArquivo[] }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEscolher(lista: FileList | null) {
    if (!lista) return;
    setErro(null);
    for (const arquivo of Array.from(lista)) {
      const invalido = validarArquivo(arquivo.name, arquivo.size);
      if (invalido) { setErro(`${arquivo.name}: ${invalido}`); continue; }
      try {
        setProgresso(0);
        const { signedUrl, storagePath } = await prepararEnvioArquivo(aulaId, tipo, arquivo.name, arquivo.size);
        await enviar(signedUrl, arquivo, setProgresso);
        await registrarArquivo(aulaId, tipo, arquivo.name, arquivo.size, storagePath);
      } catch (e) {
        setErro(`${arquivo.name}: ${e instanceof Error ? e.message : "falha no envio."}`);
      }
    }
    setProgresso(null);
    if (entrada.current) entrada.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      <ul className="flex flex-col gap-1">
        {arquivos.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-sm">
            <FileText size={15} className="text-brand" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-ink">{a.nome_arquivo}</span>
            <span className="text-xs text-muted">{(a.tamanho_bytes / 1048576).toFixed(1)} MB</span>
            <BaixarArquivo arquivoId={a.id} rotulo="Abrir" />
            <button type="button" aria-label={`Remover ${a.nome_arquivo}`} onClick={async () => { if (window.confirm(`Remover ${a.nome_arquivo}?`)) { await removerArquivo(a.id); router.refresh(); } }} className={`${estilos.botaoFantasma} px-2`}><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
      <input ref={entrada} type="file" accept="application/pdf,.pdf" multiple className="sr-only" id={`arquivos-${tipo}`} onChange={(e) => void aoEscolher(e.target.files)} />
      <label htmlFor={`arquivos-${tipo}`} className={`${estilos.botaoSecundario} w-fit cursor-pointer`}><Upload size={15} aria-hidden="true" /> Enviar PDF</label>
      {progresso !== null && (
        <div role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100} aria-label="Enviando arquivo" className="h-2 w-full max-w-xs overflow-hidden rounded bg-surface-sunken">
          <div className="h-full bg-brand transition-all" style={{ width: `${progresso}%` }} />
        </div>
      )}
    </div>
  );
}
```

E o botão de download (usado também pelo aluno na Task 8):

```tsx
// src/components/aulas/BaixarArquivo.tsx
"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { linkDownloadArquivo } from "@/actions/arquivos";
import { estilos } from "@/components/ui/estilos";

export function BaixarArquivo({ arquivoId, rotulo = "Baixar" }: { arquivoId: string; rotulo?: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={ocupado} onClick={async () => {
        setOcupado(true); setErro(null);
        try { window.location.href = await linkDownloadArquivo(arquivoId); }
        catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível baixar."); }
        finally { setOcupado(false); }
      }} className={estilos.botaoFantasma}><Download size={14} aria-hidden="true" /> {ocupado ? "Abrindo…" : rotulo}</button>
      {erro && <span role="alert" className="text-xs text-danger">{erro}</span>}
    </span>
  );
}
```

(Acrescente `src/components/aulas/BaixarArquivo.tsx` à lista de arquivos criados desta tarefa.)

- [ ] **Step 4: `src/components/cursos/EditorAula.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { definirPublicacao, salvarAula, type DadosAula } from "@/actions/cursos";
import { extrairIdYoutube } from "@/lib/aulas/youtube";
import type { Aula, RegraGabarito } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";

type Props = { aula: Aula; temArquivos: boolean };

function paraInputData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditorAula({ aula, temArquivos }: Props) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(aula.titulo);
  const [texto, setTexto] = useState(aula.texto ?? "");
  const [link, setLink] = useState(aula.video_id ? `https://www.youtube.com/watch?v=${aula.video_id}` : "");
  const [regra, setRegra] = useState<RegraGabarito>(aula.gabarito_liberacao);
  const [liberaEm, setLiberaEm] = useState(paraInputData(aula.gabarito_libera_em));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const idPrevia = link.trim() ? extrairIdYoutube(link) : null;
  const dados = (): DadosAula => ({ titulo, texto, linkVideo: link, gabarito_liberacao: regra, gabarito_libera_em: regra === "data" && liberaEm ? new Date(liberaEm).toISOString() : null });

  async function executar(acao: () => Promise<void>, mensagem: string) {
    setOcupado(true); setErro(null); setAviso(null);
    try { await acao(); setAviso(mensagem); router.refresh(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setOcupado(false); }
  }

  function publicar() {
    if (!idPrevia && !temArquivos && !window.confirm("Esta aula está vazia. Publicar mesmo assim?")) return;
    void executar(async () => { await salvarAula(aula.id, dados()); await definirPublicacao(aula.id, true); }, "Aula publicada. Os alunos já podem ver.");
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">{aviso}</p>}
      <label className="flex flex-col gap-1 text-xs text-muted">Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={estilos.input} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Link do vídeo do YouTube (opcional)
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/…" className={estilos.input} />
      </label>
      {link.trim() && !idPrevia && <p className="text-sm text-danger">Link do YouTube não reconhecido.</p>}
      {idPrevia && (
        <div className="aspect-video w-full max-w-xl overflow-hidden rounded-card bg-black">
          <iframe src={`https://www.youtube-nocookie.com/embed/${idPrevia}`} title="Prévia do vídeo" className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted">Texto da aula (opcional)<textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className={estilos.input} /></label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs text-muted">Quando o gabarito aparece para o aluno</legend>
        {([["junto", "Junto com o material"], ["apos_concluir", "Depois que ele concluir a aula"], ["data", "A partir de uma data"]] as const).map(([valor, rotulo]) => (
          <label key={valor} className="flex items-center gap-2 text-sm text-ink"><input type="radio" name="regra" checked={regra === valor} onChange={() => setRegra(valor)} /> {rotulo}</label>
        ))}
        {regra === "data" && <input type="datetime-local" value={liberaEm} onChange={(e) => setLiberaEm(e.target.value)} aria-label="Data de liberação do gabarito" className={`${estilos.input} max-w-xs`} />}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado} onClick={() => executar(() => salvarAula(aula.id, dados()), aula.publicada ? "Alterações salvas." : "Rascunho salvo.")} className={estilos.botaoSecundario}>{aula.publicada ? "Salvar alterações" : "Salvar rascunho"}</button>
        {aula.publicada ? (
          <button type="button" disabled={ocupado} onClick={() => executar(() => definirPublicacao(aula.id, false), "A aula voltou para rascunho e saiu da área dos alunos.")} className={estilos.botaoFantasma}>Voltar para rascunho</button>
        ) : (
          <button type="button" disabled={ocupado} onClick={publicar} className={estilos.botaoPrimario}>Publicar</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `src/app/cursos/[id]/aulas/[aulaId]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeEditarCurso } from "@/lib/aulas/acesso";
import { PageLayout } from "@/components/layout/PageLayout";
import { EditorAula } from "@/components/cursos/EditorAula";
import { ArquivosAula } from "@/components/cursos/ArquivosAula";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function EditarAulaPage({ params }: { params: Promise<{ id: string; aulaId: string }> }) {
  const { id, aulaId } = await params;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const [{ data: curso }, { data: aula }] = await Promise.all([
    supabase.from("cursos").select("*").eq("id", id).maybeSingle(),
    supabase.from("aulas").select("*").eq("id", aulaId).eq("curso_id", id).maybeSingle(),
  ]);
  if (!curso || !aula || !podeEditarCurso(professor, curso)) notFound();
  const { data: arquivos } = await supabase.from("aula_arquivos").select("*").eq("aula_id", aulaId).order("created_at");
  const lista = arquivos ?? [];

  return (
    <PageLayout crumb={`Aulas · ${curso.titulo}`} titulo={aula.titulo} subtitulo={aula.publicada ? "Publicada" : "Rascunho — os alunos ainda não veem"} acoes={<Link href={`/cursos/${id}`} className={estilos.botaoSecundario}>← Voltar ao curso</Link>} largura="max-w-4xl">
      <section aria-label="Dados da aula" className={`${estilos.card} p-4`}>
        <EditorAula aula={aula} temArquivos={lista.length > 0} />
      </section>
      <section aria-labelledby="titulo-material" className={`${estilos.card} p-4`}>
        <h2 id="titulo-material" className="mb-2 font-semibold text-ink">Material</h2>
        <ArquivosAula aulaId={aulaId} tipo="material" arquivos={lista.filter((a) => a.tipo === "material")} />
      </section>
      <section aria-labelledby="titulo-gabarito" className={`${estilos.card} p-4`}>
        <h2 id="titulo-gabarito" className="mb-2 font-semibold text-ink">Gabarito</h2>
        <ArquivosAula aulaId={aulaId} tipo="gabarito" arquivos={lista.filter((a) => a.tipo === "gabarito")} />
      </section>
    </PageLayout>
  );
}
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm run build` — Expected: OK. O build não pode reclamar de `node:crypto` em componente cliente (`ArquivosAula` só importa `@/lib/aulas/arquivos`, que é puro, e actions).

- [ ] **Step 7: Commit**

```bash
git add src/actions/arquivos.ts src/app/cursos src/components/cursos src/components/aulas/BaixarArquivo.tsx
git commit -m "Aulas: editor da aula com video, gabarito, publicacao e envio de PDFs"
```

---

### Task 7: Player do vídeo e registro de progresso

**Files:**
- Create: `src/actions/progresso.ts`, `src/components/aulas/PlayerVideo.tsx`

**Interfaces:**
- Consumes: `calcularProgresso`, `porcentagemAula` (Task 2); `obterAulaParaAluno` (Task 3); `getAlunoAtual`.
- Produces:
  - `registrarProgresso(aulaId: string, posicaoSeg: number, duracaoSeg: number): Promise<{ porcentagem: number; concluida: boolean }>`
  - `concluirAulaSemVideo(aulaId: string): Promise<void>`
  - `<PlayerVideo provedor="youtube" videoId iniciarEm={number} onTempo={(posicao, duracao) => void} />` — chama `onTempo` a cada 15 s tocando e ao pausar/terminar/esconder a página.

- [ ] **Step 1: `src/actions/progresso.ts`**

```ts
"use server";

import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual } from "@/lib/auth";
import { obterAulaParaAluno } from "@/lib/aulas/acesso";
import { calcularProgresso, porcentagemAula } from "@/lib/aulas/progresso";

export async function registrarProgresso(aulaId: string, posicaoSeg: number, duracaoSeg: number): Promise<{ porcentagem: number; concluida: boolean }> {
  const aluno = await getAlunoAtual();
  if (!aluno) throw new Error("Faça login novamente.");
  const acesso = await obterAulaParaAluno(aluno, aulaId);
  if (!acesso || !acesso.aula.video_id) throw new Error("Aula não encontrada.");

  const { data: anterior } = await supabase
    .from("aula_progresso")
    .select("*")
    .eq("conta_id", aluno.id)
    .eq("aula_id", aulaId)
    .maybeSingle();
  const novo = calcularProgresso(anterior ?? null, posicaoSeg, duracaoSeg);
  if (!novo) throw new Error("Duração do vídeo inválida.");

  const agora = new Date().toISOString();
  const concluida_em = anterior?.concluida_em ?? (novo.concluir ? agora : null);
  const { error } = await supabase.from("aula_progresso").upsert(
    {
      conta_id: aluno.id,
      aula_id: aulaId,
      curso_id: acesso.curso.id,
      posicao_seg: novo.posicao_seg,
      maior_posicao_seg: novo.maior_posicao_seg,
      duracao_seg: novo.duracao_seg,
      concluida_em,
      atualizado_em: agora,
    },
    { onConflict: "conta_id,aula_id" }
  );
  if (error) throw new Error(error.message);
  return { porcentagem: porcentagemAula({ ...novo, concluida_em }), concluida: !!concluida_em };
}

export async function concluirAulaSemVideo(aulaId: string): Promise<void> {
  const aluno = await getAlunoAtual();
  if (!aluno) throw new Error("Faça login novamente.");
  const acesso = await obterAulaParaAluno(aluno, aulaId);
  if (!acesso) throw new Error("Aula não encontrada.");
  if (acesso.aula.video_id) throw new Error("Essa aula tem vídeo: ela conclui ao assistir.");
  const agora = new Date().toISOString();
  const { error } = await supabase.from("aula_progresso").upsert(
    { conta_id: aluno.id, aula_id: aulaId, curso_id: acesso.curso.id, concluida_em: agora, atualizado_em: agora },
    { onConflict: "conta_id,aula_id" }
  );
  if (error) throw new Error(error.message);
}
```

Atenção: o `upsert` de `concluirAulaSemVideo` sobrescreve `concluida_em` se o aluno clicar de novo; isso é aceitável (aula sem vídeo, data da última confirmação).

- [ ] **Step 2: `src/components/aulas/PlayerVideo.tsx`**

Antes de escrever, leia a referência da IFrame API em https://developers.google.com/youtube/iframe_api_reference (eventos `onReady`, `onStateChange`, `YT.PlayerState`, `getCurrentTime`, `getDuration`, `seekTo`).

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { ProvedorVideo } from "@/lib/types";

type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
};
type YTNamespace = {
  Player: new (el: HTMLElement, opts: {
    videoId: string;
    host?: string;
    playerVars?: Record<string, number | string>;
    events?: { onStateChange?: (e: { data: number }) => void };
  }) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

let carregandoApi: Promise<YTNamespace> | null = null;
function carregarApiYoutube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  carregandoApi ??= new Promise((resolve) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { anterior?.(); resolve(window.YT!); };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return carregandoApi;
}

type Props = {
  provedor: ProvedorVideo;
  videoId: string;
  iniciarEm: number;
  onTempo: (posicaoSeg: number, duracaoSeg: number) => void;
};

const INTERVALO_MS = 15_000;

/** Player do vídeo da aula. Hoje só YouTube; Bunny entra como outro ramo com a mesma interface. */
export function PlayerVideo({ provedor, videoId, iniciarEm, onTempo }: Props) {
  const alvo = useRef<HTMLDivElement>(null);
  const aoTempo = useRef(onTempo);
  useEffect(() => { aoTempo.current = onTempo; }, [onTempo]);

  useEffect(() => {
    if (provedor !== "youtube" || !alvo.current) return;
    let player: YTPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelado = false;

    const informar = () => {
      if (!player) return;
      const duracao = player.getDuration();
      if (duracao > 0) aoTempo.current(player.getCurrentTime(), duracao);
    };
    const pararTimer = () => { if (timer) clearInterval(timer); timer = null; };
    const aoEsconder = () => { if (document.visibilityState === "hidden") informar(); };

    void carregarApiYoutube().then((YT) => {
      if (cancelado || !alvo.current) return;
      player = new YT.Player(alvo.current, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { start: Math.max(0, Math.floor(iniciarEm)), rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              pararTimer();
              timer = setInterval(informar, INTERVALO_MS);
            } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              pararTimer();
              informar();
            }
          },
        },
      });
    });
    document.addEventListener("visibilitychange", aoEsconder);

    return () => {
      cancelado = true;
      pararTimer();
      informar();
      document.removeEventListener("visibilitychange", aoEsconder);
      player?.destroy();
    };
  }, [provedor, videoId, iniciarEm]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-card bg-black">
      <div ref={alvo} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test` — Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add src/actions/progresso.ts src/components/aulas/PlayerVideo.tsx
git commit -m "Aulas: player do YouTube e registro de progresso com anti-salto"
```

---

### Task 8: Telas do aluno

**Files:**
- Create: `src/app/aluno/cursos/page.tsx`, `src/app/aluno/cursos/[id]/page.tsx`, `src/app/aluno/aulas/[id]/page.tsx`, `src/components/aulas/AulaAluno.tsx`
- Modify: `src/app/aluno/page.tsx`

**Interfaces:**
- Consumes: `getAlunoAtual`; `resumosCursosAluno`, `arvoreDoCurso`, `progressoDoAluno` (Task 3); `cursoVisivelParaAluno`, `obterAulaParaAluno` (Task 3); `porcentagemAula`, `porcentagemConjunto`, `estadoAula`, `gabaritoLiberado` (Task 2); `registrarProgresso`, `concluirAulaSemVideo` (Task 7); `<PlayerVideo>` (Task 7); `<BaixarArquivo>` (Task 6).

- [ ] **Step 1: Barra de progresso reaproveitável**

Crie dentro de `src/components/aulas/AulaAluno.tsx` e exporte também:

```tsx
export function BarraProgresso({ porcentagem, rotulo }: { porcentagem: number; rotulo: string }) {
  return (
    <div role="progressbar" aria-valuenow={porcentagem} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo} className="h-2 w-full overflow-hidden rounded bg-surface-sunken">
      <div className="h-full bg-brand" style={{ width: `${porcentagem}%` }} />
    </div>
  );
}
```

- [ ] **Step 2: `src/components/aulas/AulaAluno.tsx` (resto do arquivo)**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { concluirAulaSemVideo, registrarProgresso } from "@/actions/progresso";
import type { ProvedorVideo } from "@/lib/types";
import { PlayerVideo } from "@/components/aulas/PlayerVideo";
import { estilos } from "@/components/ui/estilos";

type Props = {
  aulaId: string;
  video: { provedor: ProvedorVideo; id: string } | null;
  iniciarEm: number;
  porcentagemInicial: number;
  concluidaInicial: boolean;
};

export function AulaAluno({ aulaId, video, iniciarEm, porcentagemInicial, concluidaInicial }: Props) {
  const router = useRouter();
  const [porcentagem, setPorcentagem] = useState(porcentagemInicial);
  const [concluida, setConcluida] = useState(concluidaInicial);
  const [erro, setErro] = useState<string | null>(null);

  const aoTempo = useCallback((posicao: number, duracao: number) => {
    registrarProgresso(aulaId, posicao, duracao)
      .then((r) => {
        setPorcentagem(r.porcentagem);
        if (r.concluida && !concluida) { setConcluida(true); router.refresh(); }
      })
      .catch(() => setErro("Não conseguimos salvar seu progresso agora. Ele volta a ser salvo sozinho."));
  }, [aulaId, concluida, router]);

  return (
    <div className="flex flex-col gap-3">
      {video ? (
        <>
          <PlayerVideo provedor={video.provedor} videoId={video.id} iniciarEm={iniciarEm} onTempo={aoTempo} />
          <div className="flex items-center gap-3">
            <div className="flex-1"><BarraProgresso porcentagem={porcentagem} rotulo="Quanto do vídeo você assistiu" /></div>
            <span className={`text-sm font-semibold ${concluida ? "text-ok" : "text-muted"}`}>
              {concluida ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={15} aria-hidden="true" /> Concluída</span> : `${porcentagem}% assistido`}
            </span>
          </div>
        </>
      ) : concluida ? (
        <p className="inline-flex items-center gap-1 text-sm font-semibold text-ok"><CheckCircle2 size={15} aria-hidden="true" /> Concluída</p>
      ) : (
        <button type="button" onClick={async () => {
          try { await concluirAulaSemVideo(aulaId); setConcluida(true); router.refresh(); }
          catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível concluir."); }
        }} className={`${estilos.botaoPrimario} w-fit`}>Concluir aula</button>
      )}
      {erro && <p role="status" className="text-xs text-muted">{erro}</p>}
    </div>
  );
}
```

(Junte com o `BarraProgresso` do Step 1 no mesmo arquivo; o arquivo é `"use client"`, e o componente de barra também é usado em páginas server — isso é permitido.)

- [ ] **Step 3: `src/app/aluno/cursos/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { resumosCursosAluno } from "@/lib/aulas/consultas";
import { BarraProgresso } from "@/components/aulas/AulaAluno";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function AlunoCursosPage() {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const resumos = await resumosCursosAluno(aluno);

  return (
    <>
      <div>
        <p className={estilos.rotulo}>Aulas</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Seus cursos</h1>
      </div>
      {resumos.length === 0 ? (
        <p className={`${estilos.card} p-5 text-sm text-muted`}>Ainda não há cursos para as suas turmas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {resumos.map(({ curso, professor_nome, porcentagem, continuar }) => (
            <li key={curso.id} className={`${estilos.card} flex flex-col gap-2 p-4`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/aluno/cursos/${curso.id}`} className="font-semibold text-ink hover:text-brand hover:underline">{curso.titulo}</Link>
                <span className="text-sm font-semibold text-ink">{porcentagem}%</span>
              </div>
              <p className="text-xs text-muted">{curso.disciplina}{professor_nome ? ` · prof. ${professor_nome}` : ""}</p>
              <BarraProgresso porcentagem={porcentagem} rotulo={`Progresso em ${curso.titulo}`} />
              {continuar && <Link href={`/aluno/aulas/${continuar.aula_id}`} className="w-fit text-sm font-semibold text-brand hover:underline">Continuar: {continuar.titulo} →</Link>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 4: `src/app/aluno/cursos/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { cursoVisivelParaAluno } from "@/lib/aulas/acesso";
import { arvoreDoCurso, progressoDoAluno } from "@/lib/aulas/consultas";
import { estadoAula, porcentagemAula, porcentagemConjunto } from "@/lib/aulas/progresso";
import { BarraProgresso } from "@/components/aulas/AulaAluno";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function AlunoCursoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const curso = await cursoVisivelParaAluno(aluno, id);
  if (!curso) notFound();
  const [modulos, progresso] = await Promise.all([arvoreDoCurso(id, true), progressoDoAluno(aluno.id, id)]);
  const todas = modulos.flatMap((m) => m.aulas);
  const total = porcentagemConjunto(todas.filter((a) => progresso.get(a.id)?.concluida_em).length, todas.length);

  return (
    <>
      <div>
        <Link href="/aluno/cursos" className="text-sm text-brand hover:underline">← Seus cursos</Link>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">{curso.titulo}</h1>
        {curso.descricao && <p className="mt-1 text-sm text-muted">{curso.descricao}</p>}
        <div className="mt-3 flex items-center gap-3"><div className="flex-1"><BarraProgresso porcentagem={total} rotulo="Progresso no curso" /></div><span className="text-sm font-semibold text-ink">{total}%</span></div>
      </div>
      {modulos.filter((m) => m.aulas.length > 0).map((m) => {
        const pct = porcentagemConjunto(m.aulas.filter((a) => progresso.get(a.id)?.concluida_em).length, m.aulas.length);
        return (
          <section key={m.id} aria-label={m.titulo} className={`${estilos.card} p-4`}>
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-ink">{m.titulo}</h2>
              <div className="flex-1"><BarraProgresso porcentagem={pct} rotulo={`Progresso em ${m.titulo}`} /></div>
              <span className="text-sm font-semibold text-ink">{pct}%</span>
            </div>
            <ol className="mt-2 divide-y divide-line">
              {m.aulas.map((a, i) => {
                const p = progresso.get(a.id) ?? null;
                const estado = estadoAula(p);
                const texto = estado === "concluida" ? "Concluída" : estado === "andamento" ? `Não concluída · ${porcentagemAula(p)}% assistido` : "Não iniciada";
                const icone = estado === "concluida" ? "✓" : estado === "andamento" ? "◐" : "○";
                return (
                  <li key={a.id}>
                    <Link href={`/aluno/aulas/${a.id}`} className="flex items-center gap-3 rounded-control px-1 py-2 text-sm hover:bg-surface-sunken">
                      <span aria-hidden="true" className={estado === "concluida" ? "text-ok" : "text-muted"}>{icone}</span>
                      <span className="flex-1 text-ink">{i + 1}. {a.titulo}</span>
                      <span className={`text-xs ${estado === "concluida" ? "text-ok" : "text-muted"}`}>{texto}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </>
  );
}
```

- [ ] **Step 5: `src/app/aluno/aulas/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { obterAulaParaAluno } from "@/lib/aulas/acesso";
import { arvoreDoCurso } from "@/lib/aulas/consultas";
import { gabaritoLiberado, porcentagemAula } from "@/lib/aulas/progresso";
import { AulaAluno } from "@/components/aulas/AulaAluno";
import { BaixarArquivo } from "@/components/aulas/BaixarArquivo";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function AlunoAulaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const acesso = await obterAulaParaAluno(aluno, id);
  if (!acesso) notFound();
  const { aula, curso } = acesso;

  const [{ data: progresso }, { data: arquivos }, modulos] = await Promise.all([
    supabase.from("aula_progresso").select("*").eq("conta_id", aluno.id).eq("aula_id", id).maybeSingle(),
    supabase.from("aula_arquivos").select("id, tipo, nome_arquivo").eq("aula_id", id).order("created_at"),
    arvoreDoCurso(curso.id, true),
  ]);
  const sequencia = modulos.flatMap((m) => m.aulas);
  const posicao = sequencia.findIndex((a) => a.id === id);
  const anterior = posicao > 0 ? sequencia[posicao - 1] : null;
  const proxima = posicao >= 0 && posicao < sequencia.length - 1 ? sequencia[posicao + 1] : null;
  const concluida = !!progresso?.concluida_em;
  const liberado = gabaritoLiberado(aula.gabarito_liberacao, aula.gabarito_libera_em, concluida);
  const materiais = (arquivos ?? []).filter((a) => a.tipo === "material");
  const gabaritos = (arquivos ?? []).filter((a) => a.tipo === "gabarito");
  const avisoGabarito = aula.gabarito_liberacao === "data" && aula.gabarito_libera_em
    ? `Disponível em ${new Date(aula.gabarito_libera_em).toLocaleDateString("pt-BR")}`
    : "Disponível depois que você concluir a aula";

  return (
    <>
      <div>
        <Link href={`/aluno/cursos/${curso.id}`} className="text-sm text-brand hover:underline">← {curso.titulo}</Link>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{aula.titulo}</h1>
      </div>
      <AulaAluno
        aulaId={aula.id}
        video={aula.video_provedor && aula.video_id ? { provedor: aula.video_provedor, id: aula.video_id } : null}
        iniciarEm={progresso && !concluida ? progresso.posicao_seg : 0}
        porcentagemInicial={porcentagemAula(progresso ?? null)}
        concluidaInicial={concluida}
      />
      {aula.texto && <section aria-label="Texto da aula" className={`${estilos.card} whitespace-pre-line p-4 text-sm text-ink`}>{aula.texto}</section>}
      {materiais.length > 0 && (
        <section aria-labelledby="titulo-material" className={`${estilos.card} p-4`}>
          <h2 id="titulo-material" className="mb-2 font-semibold text-ink">Material</h2>
          <ul className="flex flex-col gap-1">{materiais.map((a) => <li key={a.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate text-ink">{a.nome_arquivo}</span><BaixarArquivo arquivoId={a.id} /></li>)}</ul>
        </section>
      )}
      {gabaritos.length > 0 && (
        <section aria-labelledby="titulo-gabarito" className={`${estilos.card} p-4`}>
          <h2 id="titulo-gabarito" className="mb-2 font-semibold text-ink">Gabarito</h2>
          {liberado ? (
            <ul className="flex flex-col gap-1">{gabaritos.map((a) => <li key={a.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate text-ink">{a.nome_arquivo}</span><BaixarArquivo arquivoId={a.id} /></li>)}</ul>
          ) : (
            <p className="text-sm text-muted">{avisoGabarito}</p>
          )}
        </section>
      )}
      <nav aria-label="Navegação entre aulas" className="flex justify-between gap-2">
        {anterior ? <Link href={`/aluno/aulas/${anterior.id}`} className={estilos.botaoSecundario}>← Aula anterior</Link> : <span />}
        {proxima && <Link href={`/aluno/aulas/${proxima.id}`} className={estilos.botaoPrimario}>Próxima aula →</Link>}
      </nav>
    </>
  );
}
```

- [ ] **Step 6: Cartão "Aulas" deixa de ser "Em breve"**

Em `src/app/aluno/page.tsx`, o cartão de "Aulas" vira um link para `/aluno/cursos` sem o selo "Em breve" (o de "Simulados" continua igual). Troque o `.map` dos dois cartões por dois blocos explícitos:

```tsx
<div className="grid gap-4 sm:grid-cols-2">
  <Link href="/aluno/cursos" className={`${estilos.card} flex items-start gap-3 p-5 transition hover:border-brand-bright/40`}>
    <BookOpen size={22} className="mt-0.5 text-brand" aria-hidden="true" />
    <div>
      <h2 className="font-semibold text-ink">Aulas</h2>
      <p className="mt-1 text-sm text-muted">Videoaulas e materiais dos seus professores.</p>
    </div>
  </Link>
  <div className={`${estilos.card} flex items-start gap-3 p-5 opacity-80`}>
    <ClipboardCheck size={22} className="mt-0.5 text-brand" aria-hidden="true" />
    <div>
      <h2 className="flex items-center gap-2 font-semibold text-ink">
        Simulados
        <span className="rounded bg-gold/40 px-1.5 py-0.5 text-xs font-medium text-gold-ink">Em breve</span>
      </h2>
      <p className="mt-1 text-sm text-muted">Simulados das bancas com correção na hora.</p>
    </div>
  </div>
</div>
```

com `import Link from "next/link";` no topo.

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm run build && npm test` — Expected: OK.

- [ ] **Step 8: Commit**

```bash
git add src/app/aluno src/components/aulas
git commit -m "Aulas: telas do aluno com cursos, progresso, player e materiais"
```

---

### Task 9: Progresso da turma, documentação

**Files:**
- Create: `src/app/cursos/[id]/progresso/page.tsx`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: `getProfessorAtual`, `podeEditarCurso`, `arvoreDoCurso`, `porcentagemConjunto`.

- [ ] **Step 1: Página**

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeEditarCurso } from "@/lib/aulas/acesso";
import { arvoreDoCurso } from "@/lib/aulas/consultas";
import { porcentagemConjunto } from "@/lib/aulas/progresso";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ turma?: string }> };

export default async function ProgressoTurmaPage({ params, searchParams }: Props) {
  const [{ id }, { turma }] = await Promise.all([params, searchParams]);
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: curso } = await supabase.from("cursos").select("*").eq("id", id).maybeSingle();
  if (!curso || !podeEditarCurso(professor, curso)) notFound();

  const { data: turmasCurso } = await supabase.from("curso_turmas").select("turma_nome, ano_letivo").eq("curso_id", id);
  const opcoes = (turmasCurso ?? []).map((t) => ({ ...t, chave: `${t.turma_nome}|${t.ano_letivo}` }));
  const escolhida = opcoes.find((o) => o.chave === turma) ?? opcoes[0];

  const modulos = await arvoreDoCurso(id, true);
  const aulas = modulos.flatMap((m) => m.aulas);

  const { data: vinculos } = escolhida
    ? await supabase.from("aluno_turmas").select("conta_id").eq("escola_id", curso.escola_id).eq("turma_nome", escolhida.turma_nome).eq("ano_letivo", escolhida.ano_letivo)
    : { data: [] as { conta_id: string }[] };
  const contaIds = (vinculos ?? []).map((v) => v.conta_id);
  const [{ data: contas }, { data: progressos }] = await Promise.all([
    contaIds.length ? supabase.from("alunos_contas").select("id, nome, ultimo_acesso").in("id", contaIds).order("nome") : Promise.resolve({ data: [] as { id: string; nome: string; ultimo_acesso: string | null }[] }),
    contaIds.length ? supabase.from("aula_progresso").select("conta_id, aula_id, concluida_em").eq("curso_id", id).in("conta_id", contaIds) : Promise.resolve({ data: [] as { conta_id: string; aula_id: string; concluida_em: string | null }[] }),
  ]);
  const concluidas = new Set((progressos ?? []).filter((p) => p.concluida_em).map((p) => `${p.conta_id}|${p.aula_id}`));
  const fez = (contaId: string, lista: { id: string }[]) => lista.filter((a) => concluidas.has(`${contaId}|${a.id}`)).length;
  const porAula = aulas.map((a) => ({ aula: a, alunos: (contas ?? []).filter((c) => concluidas.has(`${c.id}|${a.id}`)).length })).sort((x, y) => x.alunos - y.alunos);

  return (
    <PageLayout crumb={`Aulas · ${curso.titulo}`} titulo="Progresso da turma" acoes={<Link href={`/cursos/${id}`} className={estilos.botaoSecundario}>← Voltar ao curso</Link>} largura="max-w-6xl">
      {opcoes.length === 0 ? (
        <p className={`${estilos.card} p-4 text-sm text-muted`}>Este curso ainda não está ligado a nenhuma turma.</p>
      ) : (
        <>
          <nav aria-label="Turmas" className="flex flex-wrap gap-2">
            {opcoes.map((o) => (
              <Link key={o.chave} href={`/cursos/${id}/progresso?turma=${encodeURIComponent(o.chave)}`} aria-current={o.chave === escolhida?.chave ? "page" : undefined} className={o.chave === escolhida?.chave ? estilos.botaoPrimario : estilos.botaoSecundario}>{o.turma_nome} · {o.ano_letivo}</Link>
            ))}
          </nav>
          <section aria-label="Alunos" className={`${estilos.card} overflow-x-auto p-4`}>
            {(contas ?? []).length === 0 ? (
              <p className="text-sm text-muted">Nenhum aluno com conta nesta turma ainda.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className={estilos.rotulo}>
                  <tr><th className="px-2 py-2">Aluno</th><th className="px-2 py-2">Curso</th>{modulos.filter((m) => m.aulas.length).map((m) => <th key={m.id} className="px-2 py-2">{m.titulo}</th>)}<th className="px-2 py-2">Último acesso</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(contas ?? []).map((c) => (
                    <tr key={c.id}>
                      <td className="px-2 py-2 font-medium text-ink">{c.nome}</td>
                      <td className="px-2 py-2 font-mono tabular-nums">{porcentagemConjunto(fez(c.id, aulas), aulas.length)}%</td>
                      {modulos.filter((m) => m.aulas.length).map((m) => <td key={m.id} className="px-2 py-2 font-mono tabular-nums text-muted">{porcentagemConjunto(fez(c.id, m.aulas), m.aulas.length)}%</td>)}
                      <td className="px-2 py-2 text-muted">{c.ultimo_acesso ? new Date(c.ultimo_acesso).toLocaleDateString("pt-BR") : "nunca"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          {aulas.length > 0 && (contas ?? []).length > 0 && (
            <section aria-labelledby="titulo-aulas" className={`${estilos.card} p-4`}>
              <h2 id="titulo-aulas" className="mb-2 font-semibold text-ink">Aulas com menos alunos concluindo</h2>
              <ol className="flex flex-col gap-1 text-sm">{porAula.map(({ aula, alunos }) => <li key={aula.id} className="flex justify-between gap-2"><span className="text-ink">{aula.titulo}</span><span className="font-mono tabular-nums text-muted">{alunos}/{(contas ?? []).length}</span></li>)}</ol>
            </section>
          )}
        </>
      )}
    </PageLayout>
  );
}
```

- [ ] **Step 2: DESIGN.md**

Acrescente ao fim de `DESIGN.md`:

```markdown
## Aulas
Professor: `/cursos` (lista + novo curso), `/cursos/[id]` (módulos e aulas em cartões, ↑/↓ para ordenar, selo Publicada/Rascunho), editor da aula com prévia do vídeo e PDFs, `/cursos/[id]/progresso` (tabela aluno × % por módulo). Aluno: `/aluno/cursos` com barras de progresso e "Continuar", estados "Concluída" ✓ / "Não concluída · X% assistido" ◐ / "Não iniciada" ○, aula com player do YouTube (youtube-nocookie) e barra "X% assistido".
```

- [ ] **Step 3: Verificar e commit**

Run: `npx tsc --noEmit && npm run lint && npm run build` — Expected: OK.

```bash
git add src/app/cursos DESIGN.md
git commit -m "Aulas: progresso da turma para o professor e DESIGN"
```

---

### Task 10: Verificação final

- [ ] **Step 1: Comandos**

Run: `npm test && npm run lint && npm run build` — Expected: tudo OK.

- [ ] **Step 2: Roteiro manual (Peter, depois do deploy)**

1. Professor: barra lateral → **Aulas** → "Novo curso" (ex.: "Física — teste", turma de teste) → abre o curso → "Novo módulo" → "+ Aula".
2. Na aula: cole um link do YouTube (prévia aparece), envie um PDF de material e um de gabarito, escolha "Depois que ele concluir a aula", **Publicar**.
3. Crie uma segunda aula e deixe em **rascunho**.
4. Aluno da turma (aba anônima): `/aluno` → **Aulas** → vê o curso com 0%; abre a aula; assiste ~metade; volta à lista: "Não concluída · ~50% assistido"; reabre a aula: o vídeo continua do ponto.
5. Arrastar o vídeo até o fim **não** conclui; assistir até o fim conclui (selo "Concluída", % do curso sobe).
6. Material baixa; gabarito só aparece depois de concluir.
7. A aula em rascunho não aparece para o aluno; abrir a URL dela dá "não encontrado".
8. Aluno de outra turma não vê o curso.
9. Professor: "Progresso da turma" mostra o aluno com a % certa.
10. Professor envia um `.png` ou PDF > 25 MB: recusado com mensagem.

- [ ] **Step 3: Deploy**

Depois do push, confira o status do commit em `https://api.github.com/repos/Peter870100/SISTEMA-DE-NOTAS/commits/<sha>/status` (`success`, projeto `sistema-de-notas`) e abra `https://www.statusavalia.com.br/cursos` logado como professor.
