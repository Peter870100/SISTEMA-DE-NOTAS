# Banco de questões — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Banco de questões objetivas com importação de provas em PDF pela IA (em segundo plano), revisão humana com recorte de figuras, ENEM 2009–2023 via enem.dev, questões próprias da escola e assuntos controlados.

**Architecture:** Lógica pura em `src/lib/questoes/*` (matérias, recorte, markdown seguro, formato da resposta da IA, conversão do enem.dev) com testes `tsx --test`. Acesso em `src/lib/questoes/acesso.ts` (sem `"use server"`). IA em `src/lib/questoes/ia.ts` (SDK `@anthropic-ai/sdk`, Message Batches, `claude-opus-5-5`, saída estruturada com zod). Server Actions em `src/actions/questoes.ts`, `src/actions/importacoes.ts`, `src/actions/assuntos.ts`, `src/actions/enem.ts`. Páginas do PDF viram JPEG no navegador com `pdfjs-dist` e sobem ao bucket `questoes` por link assinado. Figuras são recortes guardados como frações da página e mostrados com CSS.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions, params Promise), React 19, Supabase (cliente server-side, Storage com links assinados), `@anthropic-ai/sdk` (Message Batches), `pdfjs-dist`, zod 4, Tailwind 4, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-04-banco-questoes-design.md`

## Global Constraints

- Leia `node_modules/next/dist/docs/` antes de usar API do Next (params/searchParams são `Promise`).
- O SQL da spec **já está aplicado em produção** (o Peter colou). Só anexá-lo ao fim de `db/schema.sql`.
- Modelo: `claude-opus-5-5`; `output_config: { effort: "medium", format: zodOutputFormat(...) }`; nada de `budget_tokens`, `thinking: disabled` ou prefill.
- Preço do lote (Opus 5.5, 50% de desconto): **US$ 2 por milhão de tokens de entrada, US$ 10 por milhão de saída**.
- `ANTHROPIC_API_KEY` só no servidor; o SDK lê do ambiente (`new Anthropic()`).
- Matérias fixas (chaves): `portugues, literatura, ingles, espanhol, artes, educacao_fisica, historia, geografia, filosofia, sociologia, fisica, quimica, biologia, matematica`. Áreas: `linguagens, humanas, natureza, matematica`.
- Só objetivas A–E; exatamente 5 alternativas; resposta `A`–`E` ou anulada.
- Bucket `questoes` (privado): páginas em `<importacao_id>/<tipo>-<numero>.jpg`; imagens enviadas em `imagens/<questao_id>/<uuid>.<ext>`; PNG/JPG/WEBP até 5 MB (5242880). Links de exibição: 300 s. Links de imagem para a IA: 72 h (259200 s).
- Páginas: JPEG qualidade 0,8, largura máx. 1600 px, máx. 60 páginas por PDF.
- Recorte: frações `x, y, w, h` em `[0,1]`, `x + w ≤ 1`, `y + h ≤ 1`, `w, h ≥ 0.01`.
- Dono importa para o geral (PDF e enem.dev) e promove; admin da escola importa PDF para a escola; professor só digita (cria/edita/publica as próprias). Aluno: nada.
- **A resposta certa nunca vai a componente de aluno** (nenhuma tela de aluno nesta parte).
- Toda action de professor começa com `await exigirNaoAluno()`; funções que recebem ids sem checar acesso nunca ficam em arquivo `"use server"`.
- Textos em português do Brasil. Commit e push conforme o controlador (execução com subagentes: só commit), com o Co-Authored-By do modelo.

## Review Focus

1. **Resposta da IA malformada** (JSON fora do formato, 4 ou 6 alternativas, assunto_id inexistente ou de outra matéria, quadro fora da página): nada quebra; a questão entra "precisa de revisão" com o motivo, ou a página fica em erro com "Ler de novo". Pinado na Task 3.
2. **Mesma prova importada duas vezes / questão repetida entre páginas**: nada duplicado; vira aviso. Pinado na Task 3 (`numerosExistentes`) e na Task 6 (índice único tratado).
3. **Professor tentando editar questão de outro professor, de outra escola ou do banco geral; admin tentando importar para o geral**: recusado no servidor. Pinado na Task 4 (testes de `podeEditarQuestao`/`podeImportar`).
4. **Imagem do enem.dev quebrada ou fora do ar**: questão entra em revisão com motivo; a importação do ano não para. Pinado na Task 5 e na Task 11.
5. **Texto com HTML/script no enunciado** (vindo da IA ou digitado): mostrado como texto, nunca interpretado. Pinado na Task 2 (`markdownParaBlocos` escapa por construção) e no componente `TextoQuestao`.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `db/schema.sql` (mod.) | Bloco SQL da spec |
| `src/lib/types.ts` (mod.) | Tipos `Assunto`, `Importacao`, `ImportacaoPagina`, `Questao`, `QuestaoImagem` e tabelas no `Database` |
| `src/lib/questoes/materias.ts` | Puro: `MATERIAS`, `AREAS`, `LETRAS`, `areaDaMateria`, `ehMateria` |
| `src/lib/questoes/assuntos-iniciais.ts` | Puro: lista inicial de assuntos por matéria |
| `src/lib/questoes/quadro.ts` | Puro: `limitarQuadro`, `estiloRecorte` |
| `src/lib/questoes/markdown.ts` | Puro: `markdownParaBlocos` |
| `src/lib/questoes/formato-ia.ts` | Puro: schemas zod da resposta da IA, `respostaParaQuestoes`, `classificacaoParaAtualizacoes` |
| `src/lib/questoes/enemdev.ts` | Puro: tipos do enem.dev, `enemDevParaQuestao` |
| `src/lib/questoes/questoes.test.ts` | Testes dos módulos puros e de acesso |
| `src/lib/questoes/acesso.ts` | `podeEditarQuestao`, `podeImportar`, `exigirEditorQuestao`, `exigirImportador` (puros + server) |
| `src/lib/questoes/ia.ts` | Server: cliente Anthropic, montagem dos pedidos do lote, custo |
| `src/lib/questoes/storage.ts` | Server: links assinados de exibição e para a IA |
| `src/actions/questoes.ts` | Criar/salvar/publicar/excluir/promover questão; imagens (enviar, trocar, remover, recorte) |
| `src/actions/assuntos.ts` | Listar, aprovar, juntar, carregar lista inicial |
| `src/actions/importacoes.ts` | Criar importação, páginas, iniciar leitura, atualizar, ler de novo, aprovar todas |
| `src/actions/enem.ts` | Importação do enem.dev e lote de classificação |
| `src/components/questoes/TextoQuestao.tsx` | Renderiza markdown seguro |
| `src/components/questoes/ImagemQuestao.tsx` | Mostra recorte ou arquivo |
| `src/components/questoes/EditorQuestao.tsx` | Editor (direita da revisão, nova/editar) |
| `src/components/questoes/PaginaComQuadros.tsx` | Página com quadros arrastáveis |
| `src/components/questoes/ImportarProva.tsx` | Render do PDF no navegador + upload |
| `src/components/questoes/AcompanharImportacao.tsx` | Progresso com atualização a cada 20 s |
| `src/app/banco/page.tsx`, `src/app/banco/nova/page.tsx`, `src/app/banco/questoes/[id]/page.tsx` | Banco, nova, editar |
| `src/app/banco/importar/page.tsx`, `src/app/banco/importacoes/[id]/page.tsx`, `src/app/banco/importacoes/[id]/revisar/page.tsx` | Importação |
| `src/app/banco/assuntos/page.tsx`, `src/app/banco/importar-enem/page.tsx` | Assuntos e ENEM |
| `src/components/layout/Sidebar.tsx` (mod.), `DESIGN.md` (mod.) | Ligações e docs |

---

### Task 1: Dependências, schema e tipos

**Files:**
- Modify: `package.json` (dependências), `db/schema.sql`, `src/lib/types.ts`, `next.config.ts` (se necessário para o pdf.js)

**Interfaces:**
- Produces: tipos `Escopo`, `Area`, `Letra`, `AlvoImagem`, `Alternativa`, `Assunto`, `Importacao`, `ImportacaoPagina`, `Questao`, `QuestaoImagem`; tabelas `assuntos`, `importacoes`, `importacao_paginas`, `questoes`, `questao_imagens` no `Database`.

- [ ] **Step 1: Dependências**

Run: `npm install @anthropic-ai/sdk pdfjs-dist`
Expected: as duas entram em `dependencies`; `npm test` continua passando.

- [ ] **Step 2: SQL no schema**

Copie, sem alterar, o bloco SQL da seção "1. Banco de dados" da spec para o fim de `db/schema.sql`, depois de uma linha em branco. (Já está aplicado em produção — não rode.)

- [ ] **Step 3: Tipos** — em `src/lib/types.ts`, antes de `export type Database`:

```ts
export type Escopo = "geral" | "escola";
export type Area = "linguagens" | "humanas" | "natureza" | "matematica";
export type Letra = "A" | "B" | "C" | "D" | "E";
export type AlvoImagem = "enunciado" | Letra;
export type Alternativa = { letra: Letra; texto: string };

export type Assunto = { id: string; materia: string; nome: string; situacao: "aprovado" | "proposto"; created_at: string };

export type StatusImportacao = "enviando" | "lendo" | "revisao" | "concluida" | "erro";
export type Importacao = {
  id: string;
  escopo: Escopo;
  escola_id: string | null;
  origem: "pdf" | "enemdev";
  banca: string;
  ano: number | null;
  caderno: string;
  status: StatusImportacao;
  total_paginas: number;
  paginas_lidas: number;
  batch_id: string | null;
  custo_estimado_usd: number | null;
  custo_real_usd: number | null;
  erro: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportacaoPagina = {
  id: string;
  importacao_id: string;
  tipo: "prova" | "gabarito";
  numero: number;
  storage_path: string;
  largura: number;
  altura: number;
  status: "pendente" | "lida" | "erro";
  erro: string | null;
};

export type Questao = {
  id: string;
  escopo: Escopo;
  escola_id: string | null;
  banca: string;
  ano: number | null;
  caderno: string;
  numero: number | null;
  area: Area;
  materia: string;
  assunto_id: string | null;
  enunciado: string;
  comando: string;
  alternativas: Alternativa[];
  resposta: Letra | null;
  anulada: boolean;
  status: "revisao" | "publicada";
  precisa_revisao: boolean;
  motivo_revisao: string | null;
  origem: "pdf" | "enemdev" | "manual";
  importacao_id: string | null;
  pagina_id: string | null;
  fonte_id: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type QuestaoImagem = {
  id: string;
  questao_id: string;
  alvo: AlvoImagem;
  ordem: number;
  tipo: "recorte" | "arquivo";
  pagina_id: string | null;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  storage_path: string | null;
  created_at: string;
};
```

Em `Database.public.Tables`, depois de `aula_progresso`:

```ts
      assuntos: {
        Row: Assunto;
        Insert: Partial<Omit<Assunto, "id" | "created_at">> & { materia: string; nome: string };
        Update: Partial<Omit<Assunto, "id" | "created_at">>;
        Relationships: [];
      };
      importacoes: {
        Row: Importacao;
        Insert: Partial<Omit<Importacao, "id" | "created_at" | "updated_at">> & { escopo: Escopo; origem: "pdf" | "enemdev"; banca: string };
        Update: Partial<Omit<Importacao, "id" | "created_at">>;
        Relationships: [];
      };
      importacao_paginas: {
        Row: ImportacaoPagina;
        Insert: Partial<Omit<ImportacaoPagina, "id">> & { importacao_id: string; tipo: "prova" | "gabarito"; numero: number; storage_path: string; largura: number; altura: number };
        Update: Partial<Omit<ImportacaoPagina, "id">>;
        Relationships: [];
      };
      questoes: {
        Row: Questao;
        Insert: Partial<Omit<Questao, "id" | "created_at" | "updated_at">> & { escopo: Escopo; banca: string; area: Area; materia: string; origem: "pdf" | "enemdev" | "manual" };
        Update: Partial<Omit<Questao, "id" | "created_at">>;
        Relationships: [];
      };
      questao_imagens: {
        Row: QuestaoImagem;
        Insert: Partial<Omit<QuestaoImagem, "id" | "created_at">> & { questao_id: string; alvo: AlvoImagem; tipo: "recorte" | "arquivo" };
        Update: Partial<Omit<QuestaoImagem, "id" | "created_at">>;
        Relationships: [];
      };
```

- [ ] **Step 4: Verificar** — Run: `npx tsc --noEmit && npm test` — Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json db/schema.sql src/lib/types.ts
git commit -m "Banco de questoes: dependencias, schema e tipos"
```

---

### Task 2: Matérias, assuntos iniciais, recorte e markdown seguro

**Files:**
- Create: `src/lib/questoes/materias.ts`, `src/lib/questoes/assuntos-iniciais.ts`, `src/lib/questoes/quadro.ts`, `src/lib/questoes/markdown.ts`
- Test: `src/lib/questoes/questoes.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `MATERIAS: Record<Materia, { rotulo: string; area: Area }>`; `type Materia`; `AREAS: Record<Area, string>`; `LETRAS: readonly Letra[]`; `ehMateria(x: string): x is Materia`; `areaDaMateria(m: Materia): Area`
  - `ASSUNTOS_INICIAIS: Record<Materia, string[]>`
  - `type Quadro = { x: number; y: number; w: number; h: number }`; `limitarQuadro(q: Quadro): Quadro`; `estiloRecorte(q: Quadro, largura: number, altura: number): { backgroundSize: string; backgroundPosition: string; aspectRatio: string }`
  - `type Segmento = { texto: string; negrito: boolean; italico: boolean }`; `markdownParaBlocos(texto: string): Segmento[][]` (cada item = um parágrafo/linha)

- [ ] **Step 1: Testes**

```ts
// src/lib/questoes/questoes.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { MATERIAS, areaDaMateria, ehMateria, LETRAS } from "./materias";
import { ASSUNTOS_INICIAIS } from "./assuntos-iniciais";
import { estiloRecorte, limitarQuadro } from "./quadro";
import { markdownParaBlocos } from "./markdown";

test("matérias e áreas", () => {
  assert.equal(Object.keys(MATERIAS).length, 14);
  assert.equal(areaDaMateria("fisica"), "natureza");
  assert.equal(areaDaMateria("filosofia"), "humanas");
  assert.equal(areaDaMateria("ingles"), "linguagens");
  assert.equal(ehMateria("fisica"), true);
  assert.equal(ehMateria("astrologia"), false);
  assert.deepEqual([...LETRAS], ["A", "B", "C", "D", "E"]);
  for (const m of Object.keys(MATERIAS)) assert.ok((ASSUNTOS_INICIAIS as Record<string, string[]>)[m].length >= 5, m);
});

test("limitarQuadro mantém o quadro dentro da página", () => {
  assert.deepEqual(limitarQuadro({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }), { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  assert.deepEqual(limitarQuadro({ x: -0.1, y: 0.9, w: 0.5, h: 0.5 }), { x: 0, y: 0.9, w: 0.5, h: 0.1 });
  const q = limitarQuadro({ x: 0.995, y: 0, w: 0.5, h: 0.001 });
  assert.ok(q.w >= 0.01 && q.h >= 0.01 && q.x + q.w <= 1 && q.y + q.h <= 1);
  const nan = limitarQuadro({ x: Number.NaN, y: 0, w: 0.2, h: 0.2 });
  assert.equal(nan.x, 0);
});

test("estiloRecorte calcula fundo e proporção", () => {
  const e = estiloRecorte({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 1000, 2000);
  assert.equal(e.backgroundSize, "200% auto");
  assert.equal(e.backgroundPosition, "50% 66.6667%");
  assert.equal(e.aspectRatio, "500 / 500");
  const inteiro = estiloRecorte({ x: 0, y: 0, w: 1, h: 1 }, 800, 1200);
  assert.equal(inteiro.backgroundPosition, "0% 0%");
});

test("markdown seguro: negrito, itálico, linhas, HTML vira texto", () => {
  assert.deepEqual(markdownParaBlocos("Olá **mundo** e *você*"), [[
    { texto: "Olá ", negrito: false, italico: false },
    { texto: "mundo", negrito: true, italico: false },
    { texto: " e ", negrito: false, italico: false },
    { texto: "você", negrito: false, italico: true },
  ]]);
  assert.equal(markdownParaBlocos("linha 1\nlinha 2").length, 2);
  assert.deepEqual(markdownParaBlocos("<script>x</script>"), [[{ texto: "<script>x</script>", negrito: false, italico: false }]]);
  assert.deepEqual(markdownParaBlocos(""), []);
  assert.deepEqual(markdownParaBlocos("a **sem fechar"), [[{ texto: "a **sem fechar", negrito: false, italico: false }]]);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx tsx --test src/lib/questoes/questoes.test.ts` → FAIL (módulos não existem).

- [ ] **Step 3: Implementar**

```ts
// src/lib/questoes/materias.ts
import type { Area, Letra } from "@/lib/types";

export const AREAS: Record<Area, string> = {
  linguagens: "Linguagens",
  humanas: "Ciências Humanas",
  natureza: "Ciências da Natureza",
  matematica: "Matemática",
};

export const MATERIAS = {
  portugues: { rotulo: "Português", area: "linguagens" },
  literatura: { rotulo: "Literatura", area: "linguagens" },
  ingles: { rotulo: "Inglês", area: "linguagens" },
  espanhol: { rotulo: "Espanhol", area: "linguagens" },
  artes: { rotulo: "Artes", area: "linguagens" },
  educacao_fisica: { rotulo: "Educação Física", area: "linguagens" },
  historia: { rotulo: "História", area: "humanas" },
  geografia: { rotulo: "Geografia", area: "humanas" },
  filosofia: { rotulo: "Filosofia", area: "humanas" },
  sociologia: { rotulo: "Sociologia", area: "humanas" },
  fisica: { rotulo: "Física", area: "natureza" },
  quimica: { rotulo: "Química", area: "natureza" },
  biologia: { rotulo: "Biologia", area: "natureza" },
  matematica: { rotulo: "Matemática", area: "matematica" },
} as const satisfies Record<string, { rotulo: string; area: Area }>;

export type Materia = keyof typeof MATERIAS;
export const LETRAS: readonly Letra[] = ["A", "B", "C", "D", "E"];

export function ehMateria(x: string): x is Materia {
  return Object.prototype.hasOwnProperty.call(MATERIAS, x);
}

export function areaDaMateria(m: Materia): Area {
  return MATERIAS[m].area;
}
```

```ts
// src/lib/questoes/assuntos-iniciais.ts
import type { Materia } from "./materias";

/** Lista inicial (matriz do ENEM, resumida). O dono carrega uma vez em Banco → Assuntos. */
export const ASSUNTOS_INICIAIS: Record<Materia, string[]> = {
  portugues: ["Interpretação de texto", "Gêneros textuais", "Variação linguística", "Funções da linguagem", "Coesão e coerência", "Figuras de linguagem", "Morfologia", "Sintaxe", "Semântica"],
  literatura: ["Escolas literárias", "Modernismo", "Romantismo", "Realismo e Naturalismo", "Literatura contemporânea", "Gêneros literários", "Intertextualidade"],
  ingles: ["Interpretação de texto", "Vocabulário em contexto", "Gêneros textuais", "Gramática em contexto", "Aspectos culturais"],
  espanhol: ["Interpretação de texto", "Vocabulário em contexto", "Gêneros textuais", "Gramática em contexto", "Aspectos culturais"],
  artes: ["Artes visuais", "Música", "Teatro e dança", "Arte brasileira", "Vanguardas artísticas", "Patrimônio cultural"],
  educacao_fisica: ["Práticas corporais", "Esporte e sociedade", "Saúde e qualidade de vida", "Corpo e cultura", "Lazer"],
  historia: ["Antiguidade", "Idade Média", "Idade Moderna", "Brasil Colônia", "Brasil Império", "Brasil República", "Era Vargas", "Ditadura militar", "Guerras mundiais", "Guerra Fria", "Revoluções", "Cidadania e direitos"],
  geografia: ["Cartografia", "Clima", "Relevo e solos", "Hidrografia", "Biomas e vegetação", "População", "Urbanização", "Agropecuária", "Indústria e energia", "Globalização", "Questões ambientais", "Geopolítica"],
  filosofia: ["Filosofia antiga", "Ética", "Política", "Teoria do conhecimento", "Filosofia moderna", "Filosofia contemporânea"],
  sociologia: ["Cultura e sociedade", "Trabalho", "Desigualdade social", "Movimentos sociais", "Estado e poder", "Cidadania", "Meios de comunicação"],
  fisica: ["Cinemática", "Dinâmica", "Energia e trabalho", "Hidrostática", "Termologia", "Termodinâmica", "Óptica", "Ondulatória", "Eletrostática", "Eletrodinâmica", "Magnetismo", "Física moderna"],
  quimica: ["Atomística", "Tabela periódica", "Ligações químicas", "Funções inorgânicas", "Estequiometria", "Soluções", "Termoquímica", "Cinética química", "Equilíbrio químico", "Eletroquímica", "Química orgânica", "Química ambiental"],
  biologia: ["Citologia", "Genética", "Evolução", "Ecologia", "Fisiologia humana", "Botânica", "Zoologia", "Microbiologia", "Bioquímica", "Biotecnologia", "Saúde e doenças"],
  matematica: ["Razão e proporção", "Porcentagem", "Funções", "Equações e inequações", "Progressões", "Geometria plana", "Geometria espacial", "Geometria analítica", "Trigonometria", "Estatística", "Probabilidade", "Análise combinatória", "Matemática financeira", "Leitura de gráficos e tabelas"],
};
```

```ts
// src/lib/questoes/quadro.ts
export type Quadro = { x: number; y: number; w: number; h: number };
const MINIMO = 0.01;

function numero(v: number, padrao: number): number {
  return Number.isFinite(v) ? v : padrao;
}

/** Quadro dentro da página: frações em [0,1], x+w ≤ 1, y+h ≤ 1, lados ≥ 0,01. */
export function limitarQuadro(q: Quadro): Quadro {
  const x = Math.min(1 - MINIMO, Math.max(0, numero(q.x, 0)));
  const y = Math.min(1 - MINIMO, Math.max(0, numero(q.y, 0)));
  const w = Math.min(1 - x, Math.max(MINIMO, numero(q.w, MINIMO)));
  const h = Math.min(1 - y, Math.max(MINIMO, numero(q.h, MINIMO)));
  const arred = (n: number) => Math.round(n * 100000) / 100000;
  return { x: arred(x), y: arred(y), w: arred(w), h: arred(h) };
}

const pct = (n: number) => `${Number(n.toFixed(4))}%`;

/** CSS para mostrar só o recorte de uma imagem de página (background-image). */
export function estiloRecorte(q: Quadro, largura: number, altura: number) {
  const posX = q.w >= 1 ? 0 : (q.x / (1 - q.w)) * 100;
  const posY = q.h >= 1 ? 0 : (q.y / (1 - q.h)) * 100;
  return {
    backgroundSize: `${pct(100 / q.w).replace("%", "")}% auto`,
    backgroundPosition: `${pct(posX)} ${pct(posY)}`,
    aspectRatio: `${Math.round(q.w * largura)} / ${Math.round(q.h * altura)}`,
  };
}
```

```ts
// src/lib/questoes/markdown.ts
export type Segmento = { texto: string; negrito: boolean; italico: boolean };

/**
 * Markdown mínimo: **negrito**, *itálico* e quebras de linha. Não interpreta HTML —
 * tudo vira texto, e o componente renderiza com elementos React (escapados).
 * Marcação sem fechamento fica literal.
 */
export function markdownParaBlocos(texto: string): Segmento[][] {
  if (!texto) return [];
  return texto.split(/\r?\n/).map((linha) => {
    const segmentos: Segmento[] = [];
    const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    let ultimo = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(linha))) {
      if (m.index > ultimo) segmentos.push({ texto: linha.slice(ultimo, m.index), negrito: false, italico: false });
      segmentos.push(m[1] !== undefined ? { texto: m[1], negrito: true, italico: false } : { texto: m[2], negrito: false, italico: true });
      ultimo = re.lastIndex;
    }
    if (ultimo < linha.length) segmentos.push({ texto: linha.slice(ultimo), negrito: false, italico: false });
    return segmentos;
  });
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx tsx --test src/lib/questoes/questoes.test.ts` → PASS. Acrescente o arquivo ao script `test`; `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/questoes package.json
git commit -m "Banco de questoes: materias, assuntos iniciais, recorte e markdown seguro"
```

---

### Task 3: Formato da resposta da IA e conversão para questões

**Files:**
- Create: `src/lib/questoes/formato-ia.ts`
- Test: `src/lib/questoes/questoes.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `MATERIAS`, `ehMateria`, `areaDaMateria`, `LETRAS` (Task 2); `limitarQuadro` (Task 2).
- Produces:
  - `RespostaPaginaSchema` (zod) e `type RespostaPagina = z.infer<typeof RespostaPaginaSchema>`
  - `ClassificacaoSchema` (zod) e `type Classificacao`
  - `type ContextoPagina = { escopo: Escopo; escola_id: string | null; banca: string; ano: number | null; caderno: string; importacao_id: string; pagina_id: string; numerosExistentes: Set<number>; assuntos: Map<string, string> /* id → matéria (aprovados) */ }`
  - `type NovaQuestao = { linha: Database["public"]["Tables"]["questoes"]["Insert"]; imagens: { alvo: AlvoImagem; x: number; y: number; w: number; h: number }[]; assuntoNovo: { materia: string; nome: string } | null }`
  - `respostaParaQuestoes(resposta: RespostaPagina, ctx: ContextoPagina): { questoes: NovaQuestao[]; avisos: string[] }` — adiciona ao `ctx.numerosExistentes` os números aceitos
  - `classificacaoParaAtualizacoes(c: Classificacao, assuntos: Map<string, string>): { id: string; materia: string; area: Area; assunto_id: string | null; assuntoNovo: string | null; precisa: boolean }[]`

- [ ] **Step 1: Testes** (acrescentar a `questoes.test.ts`)

```ts
import { respostaParaQuestoes, RespostaPaginaSchema, classificacaoParaAtualizacoes } from "./formato-ia";

const ALT = ["A", "B", "C", "D", "E"].map((letra) => ({ letra, texto: `alt ${letra}` }));
function questaoIA(extra: Record<string, unknown> = {}) {
  return {
    numero: 37, enunciado: "Texto", comando: "Assinale", alternativas: ALT, resposta: "C", anulada: false,
    area: "natureza", materia: "fisica", assunto_id: "as-1", assunto_novo: null, figuras: [], duvidas: [], ...extra,
  };
}
function ctx() {
  return { escopo: "geral" as const, escola_id: null, banca: "UFMS", ano: 2024, caderno: "", importacao_id: "imp", pagina_id: "pag",
    numerosExistentes: new Set<number>(), assuntos: new Map([["as-1", "fisica"], ["as-2", "quimica"]]) };
}

test("IA: questão completa vira linha publicável sem revisão", () => {
  const r = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [questaoIA()] }), ctx());
  assert.equal(r.questoes.length, 1);
  const q = r.questoes[0];
  assert.equal(q.linha.numero, 37);
  assert.equal(q.linha.resposta, "C");
  assert.equal(q.linha.precisa_revisao, false);
  assert.equal(q.linha.status, "revisao");
  assert.equal(q.linha.assunto_id, "as-1");
  assert.equal(q.linha.origem, "pdf");
});

test("IA: sem gabarito, dúvidas, assunto novo e assunto de outra matéria pedem revisão", () => {
  const c = ctx();
  const r = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [
    questaoIA({ numero: 1, resposta: null }),
    questaoIA({ numero: 2, duvidas: ["imagem cortada"] }),
    questaoIA({ numero: 3, assunto_id: null, assunto_novo: "Gravitação" }),
    questaoIA({ numero: 4, assunto_id: "as-2" }),
    questaoIA({ numero: 5, assunto_id: "nao-existe" }),
  ] }), c);
  assert.deepEqual(r.questoes.map((q) => q.linha.precisa_revisao), [true, true, true, true, true]);
  assert.match(r.questoes[0].linha.motivo_revisao!, /gabarito/i);
  assert.deepEqual(r.questoes[2].assuntoNovo, { materia: "fisica", nome: "Gravitação" });
  assert.equal(r.questoes[3].linha.assunto_id, null);
  assert.equal(r.questoes[4].linha.assunto_id, null);
});

test("IA: anulada sem resposta não pede revisão por gabarito", () => {
  const r = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [questaoIA({ resposta: null, anulada: true })] }), ctx());
  assert.equal(r.questoes[0].linha.precisa_revisao, false);
});

test("IA: figura em alternativa e quadro fora da página são limitados", () => {
  const r = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [questaoIA({ figuras: [
    { alvo: "enunciado", x: 0.1, y: 0.1, w: 0.5, h: 0.2 },
    { alvo: "B", x: 0.9, y: 0.95, w: 0.5, h: 0.5 },
  ] })] }), ctx());
  const [f1, f2] = r.questoes[0].imagens;
  assert.equal(f1.alvo, "enunciado");
  assert.equal(f2.alvo, "B");
  assert.ok(f2.x + f2.w <= 1 && f2.y + f2.h <= 1);
});

test("IA: número repetido na importação vira aviso, não duplica", () => {
  const c = ctx();
  c.numerosExistentes.add(37);
  const r = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [questaoIA(), questaoIA({ numero: 38 }), questaoIA({ numero: 38 })] }), c);
  assert.deepEqual(r.questoes.map((q) => q.linha.numero), [38]);
  assert.equal(r.avisos.length, 2);
});

test("IA: schema recusa alternativas fora de A–E e matéria inválida", () => {
  assert.equal(RespostaPaginaSchema.safeParse({ questoes: [questaoIA({ alternativas: ALT.slice(0, 4) })] }).success, true); // aceita, mas marca revisão
  assert.equal(RespostaPaginaSchema.safeParse({ questoes: [questaoIA({ materia: "astrologia" })] }).success, false);
  assert.equal(RespostaPaginaSchema.safeParse({ questoes: [questaoIA({ resposta: "F" })] }).success, false);
  const r = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [questaoIA({ alternativas: ALT.slice(0, 4) })] }), ctx());
  assert.equal(r.questoes[0].linha.precisa_revisao, true);
  assert.match(r.questoes[0].linha.motivo_revisao!, /5 alternativas/);
});

test("classificação do enem.dev", () => {
  const ups = classificacaoParaAtualizacoes({ itens: [
    { id: "q1", materia: "fisica", assunto_id: "as-1", assunto_novo: null },
    { id: "q2", materia: "quimica", assunto_id: "as-1", assunto_novo: null },
    { id: "q3", materia: "biologia", assunto_id: null, assunto_novo: "Genética de populações" },
  ] }, new Map([["as-1", "fisica"]]));
  assert.deepEqual(ups.map((u) => [u.id, u.area, u.assunto_id, u.precisa]), [["q1", "natureza", "as-1", false], ["q2", "natureza", null, true], ["q3", "natureza", null, true]]);
  assert.equal(ups[2].assuntoNovo, "Genética de populações");
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// src/lib/questoes/formato-ia.ts
import { z } from "zod";
import type { AlvoImagem, Area, Database, Escopo } from "@/lib/types";
import { MATERIAS, areaDaMateria, ehMateria } from "./materias";
import { limitarQuadro } from "./quadro";

const LETRA = z.enum(["A", "B", "C", "D", "E"]);
const MATERIA = z.enum(Object.keys(MATERIAS) as [string, ...string[]]);

export const RespostaPaginaSchema = z.object({
  questoes: z.array(z.object({
    numero: z.number().int(),
    enunciado: z.string(),
    comando: z.string(),
    alternativas: z.array(z.object({ letra: LETRA, texto: z.string() })),
    resposta: LETRA.nullable(),
    anulada: z.boolean(),
    area: z.enum(["linguagens", "humanas", "natureza", "matematica"]),
    materia: MATERIA,
    assunto_id: z.string().nullable(),
    assunto_novo: z.string().nullable(),
    figuras: z.array(z.object({ alvo: z.enum(["enunciado", "A", "B", "C", "D", "E"]), x: z.number(), y: z.number(), w: z.number(), h: z.number() })),
    duvidas: z.array(z.string()),
  })),
});
export type RespostaPagina = z.infer<typeof RespostaPaginaSchema>;

export const ClassificacaoSchema = z.object({
  itens: z.array(z.object({ id: z.string(), materia: MATERIA, assunto_id: z.string().nullable(), assunto_novo: z.string().nullable() })),
});
export type Classificacao = z.infer<typeof ClassificacaoSchema>;

export type ContextoPagina = {
  escopo: Escopo;
  escola_id: string | null;
  banca: string;
  ano: number | null;
  caderno: string;
  importacao_id: string;
  pagina_id: string;
  numerosExistentes: Set<number>;
  assuntos: Map<string, string>; // id → matéria (só aprovados)
};

export type NovaQuestao = {
  linha: Database["public"]["Tables"]["questoes"]["Insert"];
  imagens: { alvo: AlvoImagem; x: number; y: number; w: number; h: number }[];
  assuntoNovo: { materia: string; nome: string } | null;
};

export function respostaParaQuestoes(resposta: RespostaPagina, ctx: ContextoPagina): { questoes: NovaQuestao[]; avisos: string[] } {
  const questoes: NovaQuestao[] = [];
  const avisos: string[] = [];
  for (const q of resposta.questoes) {
    if (ctx.numerosExistentes.has(q.numero)) {
      avisos.push(`Questão ${q.numero} já existe e foi ignorada.`);
      continue;
    }
    ctx.numerosExistentes.add(q.numero);

    const motivos: string[] = [...q.duvidas];
    const letras = q.alternativas.map((a) => a.letra).join("");
    if (q.alternativas.length !== 5 || letras !== "ABCDE") motivos.push("A questão precisa ter 5 alternativas (A a E).");
    if (!q.resposta && !q.anulada) motivos.push("Resposta não encontrada no gabarito.");

    let assunto_id: string | null = null;
    if (q.assunto_id) {
      if (ctx.assuntos.get(q.assunto_id) === q.materia) assunto_id = q.assunto_id;
      else motivos.push("Assunto sugerido não confere com a matéria.");
    }
    const novo = !assunto_id && q.assunto_novo?.trim() ? { materia: q.materia, nome: q.assunto_novo.trim() } : null;
    if (novo) motivos.push(`Assunto novo proposto: ${novo.nome}.`);

    const materia = q.materia;
    const area: Area = ehMateria(materia) ? areaDaMateria(materia) : q.area;
    questoes.push({
      linha: {
        escopo: ctx.escopo,
        escola_id: ctx.escola_id,
        banca: ctx.banca,
        ano: ctx.ano,
        caderno: ctx.caderno,
        numero: q.numero,
        area,
        materia,
        assunto_id,
        enunciado: q.enunciado.trim(),
        comando: q.comando.trim(),
        alternativas: q.alternativas.map((a) => ({ letra: a.letra, texto: a.texto.trim() })),
        resposta: q.resposta,
        anulada: q.anulada,
        status: "revisao",
        precisa_revisao: motivos.length > 0,
        motivo_revisao: motivos.length ? motivos.join(" ") : null,
        origem: "pdf",
        importacao_id: ctx.importacao_id,
        pagina_id: ctx.pagina_id,
      },
      imagens: q.figuras.map((f) => ({ alvo: f.alvo, ...limitarQuadro(f) })),
      assuntoNovo: novo,
    });
  }
  return { questoes, avisos };
}

export function classificacaoParaAtualizacoes(c: Classificacao, assuntos: Map<string, string>) {
  return c.itens.map((i) => {
    const assunto_id = i.assunto_id && assuntos.get(i.assunto_id) === i.materia ? i.assunto_id : null;
    const assuntoNovo = !assunto_id && i.assunto_novo?.trim() ? i.assunto_novo.trim() : null;
    return {
      id: i.id,
      materia: i.materia,
      area: areaDaMateria(i.materia as keyof typeof MATERIAS),
      assunto_id,
      assuntoNovo,
      precisa: !assunto_id,
    };
  });
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx tsx --test src/lib/questoes/questoes.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/questoes
git commit -m "Banco de questoes: formato da resposta da IA e conversao para questoes"
```

---

### Task 4: Regras de acesso

**Files:**
- Create: `src/lib/questoes/acesso.ts`
- Test: `src/lib/questoes/questoes.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `getProfessorAtual`, `exigirNaoAluno` (`@/lib/auth`); `ehAdmin` (`@/lib/papeis`).
- Produces:
  - `type Ator = { id: string; role: ProfessorRole; escola_id: string }`
  - `podeEditarQuestao(ator: Ator, q: Pick<Questao, "escopo" | "escola_id" | "criado_por">): boolean`
  - `podeVerQuestao(ator: Ator, q: Pick<Questao, "escopo" | "escola_id" | "status" | "criado_por">): boolean`
  - `podeImportar(ator: Ator, escopo: Escopo): boolean`
  - `exigirProfessor(): Promise<Professor>` (exigirNaoAluno + getProfessorAtual)
  - `exigirEditorQuestao(questaoId: string): Promise<{ professor: Professor; questao: Questao }>`
  - `exigirImportacao(importacaoId: string): Promise<{ professor: Professor; importacao: Importacao }>` (só quem pode importar naquele escopo/escola)

- [ ] **Step 1: Testes** (acrescentar)

```ts
import { podeEditarQuestao, podeImportar, podeVerQuestao } from "./acesso";

const DONO = { id: "d", role: "dono" as const, escola_id: "e1" };
const ADMIN = { id: "a", role: "admin" as const, escola_id: "e1" };
const PROF = { id: "p", role: "professor" as const, escola_id: "e1" };
const OUTRO = { id: "o", role: "professor" as const, escola_id: "e2" };

test("acesso: banco geral só o dono edita; todos veem publicadas", () => {
  const geral = { escopo: "geral" as const, escola_id: null, criado_por: "d", status: "publicada" as const };
  assert.equal(podeEditarQuestao(DONO, geral), true);
  assert.equal(podeEditarQuestao(ADMIN, geral), false);
  assert.equal(podeEditarQuestao(PROF, geral), false);
  assert.equal(podeVerQuestao(PROF, geral), true);
  assert.equal(podeVerQuestao(PROF, { ...geral, status: "revisao" }), false);
  assert.equal(podeVerQuestao(DONO, { ...geral, status: "revisao" }), true);
});

test("acesso: questão da escola", () => {
  const doProf = { escopo: "escola" as const, escola_id: "e1", criado_por: "p", status: "revisao" as const };
  assert.equal(podeEditarQuestao(PROF, doProf), true);
  assert.equal(podeEditarQuestao({ ...PROF, id: "p2" }, doProf), false);
  assert.equal(podeEditarQuestao(ADMIN, doProf), true);
  assert.equal(podeEditarQuestao(DONO, doProf), true);
  assert.equal(podeEditarQuestao(OUTRO, doProf), false);
  assert.equal(podeVerQuestao(OUTRO, { ...doProf, status: "publicada" }), false);
  assert.equal(podeVerQuestao({ ...PROF, id: "p2" }, { ...doProf, status: "publicada" }), true);
  assert.equal(podeVerQuestao({ ...PROF, id: "p2" }, doProf), false);
});

test("acesso: importar", () => {
  assert.equal(podeImportar(DONO, "geral"), true);
  assert.equal(podeImportar(ADMIN, "geral"), false);
  assert.equal(podeImportar(ADMIN, "escola"), true);
  assert.equal(podeImportar(PROF, "escola"), false);
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// src/lib/questoes/acesso.ts
import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import type { Escopo, Importacao, Professor, ProfessorRole, Questao } from "@/lib/types";

export type Ator = { id: string; role: ProfessorRole; escola_id: string };

export function podeEditarQuestao(ator: Ator, q: Pick<Questao, "escopo" | "escola_id" | "criado_por">): boolean {
  if (ator.role === "dono") return true;
  if (q.escopo === "geral") return false;
  if (q.escola_id !== ator.escola_id) return false;
  return ehAdmin(ator.role) || q.criado_por === ator.id;
}

export function podeVerQuestao(ator: Ator, q: Pick<Questao, "escopo" | "escola_id" | "status" | "criado_por">): boolean {
  if (podeEditarQuestao(ator, q)) return true;
  if (q.status !== "publicada") return false;
  return q.escopo === "geral" || q.escola_id === ator.escola_id;
}

export function podeImportar(ator: Ator, escopo: Escopo): boolean {
  return escopo === "geral" ? ator.role === "dono" : ehAdmin(ator.role);
}

export async function exigirProfessor(): Promise<Professor> {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  return professor;
}

export async function exigirEditorQuestao(questaoId: string): Promise<{ professor: Professor; questao: Questao }> {
  const professor = await exigirProfessor();
  const { data: questao } = await supabase.from("questoes").select("*").eq("id", questaoId).maybeSingle();
  if (!questao || !podeEditarQuestao(professor, questao)) throw new Error("Você não pode editar essa questão.");
  return { professor, questao };
}

export async function exigirImportacao(importacaoId: string): Promise<{ professor: Professor; importacao: Importacao }> {
  const professor = await exigirProfessor();
  const { data: importacao } = await supabase.from("importacoes").select("*").eq("id", importacaoId).maybeSingle();
  if (!importacao || !podeImportar(professor, importacao.escopo)) throw new Error("Importação não encontrada.");
  if (importacao.escopo === "escola" && importacao.escola_id !== professor.escola_id && professor.role !== "dono") {
    throw new Error("Importação não encontrada.");
  }
  return { professor, importacao };
}
```

Atenção: `acesso.ts` importa `@/lib/supabase/client` e `@/lib/auth`, que dependem do ambiente Next. Se o teste não conseguir importar o arquivo por isso, mova as três funções puras (`podeEditarQuestao`, `podeVerQuestao`, `podeImportar` e o tipo `Ator`) para `src/lib/questoes/regras.ts` (sem imports de servidor), reexporte-as de `acesso.ts` e teste `regras.ts`.

- [ ] **Step 4: Rodar e ver passar; `npx tsc --noEmit`.**

- [ ] **Step 5: Commit** — `git add src/lib/questoes && git commit -m "Banco de questoes: regras de acesso"`

---

### Task 5: Conversão do enem.dev

**Files:**
- Create: `src/lib/questoes/enemdev.ts`
- Test: `src/lib/questoes/questoes.test.ts` (acrescentar)

**Interfaces:**
- Produces:
  - `type EnemDevQuestao = { title: string; index: number; discipline: string; language: string | null; year: number; context: string | null; files: string[]; correctAlternative: string; alternativesIntroduction: string | null; alternatives: { letter: string; text: string | null; file: string | null; isCorrect: boolean }[] }`
  - `enemDevParaQuestao(q: EnemDevQuestao): { linha: Database["public"]["Tables"]["questoes"]["Insert"]; imagens: { alvo: AlvoImagem; url: string }[] }` — `linha.escopo = "geral"`, `banca = "ENEM"`, `origem = "enemdev"`, `materia` provisória (primeira matéria da área: linguagens→`portugues`, humanas→`historia`, natureza→`fisica`, matematica→`matematica`), `precisa_revisao` true se imagem quebrada, alternativa sem texto nem arquivo, ou resposta inválida.

- [ ] **Step 1: Testes** (acrescentar)

```ts
import { enemDevParaQuestao, type EnemDevQuestao } from "./enemdev";

function enem(extra: Partial<EnemDevQuestao> = {}): EnemDevQuestao {
  return {
    title: "Questão 10 - ENEM 2023", index: 10, discipline: "linguagens", language: null, year: 2023,
    context: "Texto **base**\n\n![](https://enem.dev/2023/img1.png)\n\nFonte", files: [],
    correctAlternative: "E", alternativesIntroduction: "Conclui-se que",
    alternatives: ["A", "B", "C", "D", "E"].map((letter) => ({ letter, text: `alt ${letter}`, file: null, isCorrect: letter === "E" })),
    ...extra,
  };
}

test("enem.dev: conversão básica, imagem do markdown extraída", () => {
  const { linha, imagens } = enemDevParaQuestao(enem());
  assert.equal(linha.banca, "ENEM");
  assert.equal(linha.ano, 2023);
  assert.equal(linha.numero, 10);
  assert.equal(linha.caderno, "");
  assert.equal(linha.area, "linguagens");
  assert.equal(linha.resposta, "E");
  assert.equal(linha.comando, "Conclui-se que");
  assert.ok(!linha.enunciado!.includes("!["));
  assert.deepEqual(imagens, [{ alvo: "enunciado", url: "https://enem.dev/2023/img1.png" }]);
  assert.equal(linha.precisa_revisao, false);
  assert.equal(linha.status, "revisao");
});

test("enem.dev: idioma vira caderno; disciplina vira área", () => {
  assert.equal(enemDevParaQuestao(enem({ language: "ingles" })).linha.caderno, "ingles");
  assert.equal(enemDevParaQuestao(enem({ discipline: "ciencias-humanas" })).linha.area, "humanas");
  assert.equal(enemDevParaQuestao(enem({ discipline: "ciencias-natureza" })).linha.area, "natureza");
  assert.equal(enemDevParaQuestao(enem({ discipline: "matematica" })).linha.area, "matematica");
});

test("enem.dev: imagem quebrada e alternativa-imagem", () => {
  const quebrada = enemDevParaQuestao(enem({ context: "x ![](https://enem.dev/broken-image.svg)" }));
  assert.equal(quebrada.linha.precisa_revisao, true);
  assert.match(quebrada.linha.motivo_revisao!, /imagem/i);
  assert.equal(quebrada.imagens.length, 0);
  const alts = ["A", "B", "C", "D", "E"].map((letter) => ({ letter, text: null, file: `https://enem.dev/2023/alt-${letter}.png`, isCorrect: letter === "A" }));
  const r = enemDevParaQuestao(enem({ alternatives: alts, correctAlternative: "A", files: ["https://enem.dev/2023/f.png"] }));
  assert.equal(r.imagens.filter((i) => i.alvo !== "enunciado").length, 5);
  assert.ok(r.imagens.some((i) => i.alvo === "enunciado" && i.url.endsWith("/f.png")));
  assert.equal(r.linha.precisa_revisao, false);
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// src/lib/questoes/enemdev.ts
import type { AlvoImagem, Area, Database, Letra } from "@/lib/types";

export type EnemDevQuestao = {
  title: string;
  index: number;
  discipline: string;
  language: string | null;
  year: number;
  context: string | null;
  files: string[];
  correctAlternative: string;
  alternativesIntroduction: string | null;
  alternatives: { letter: string; text: string | null; file: string | null; isCorrect: boolean }[];
};

const AREA: Record<string, Area> = { linguagens: "linguagens", "ciencias-humanas": "humanas", "ciencias-natureza": "natureza", matematica: "matematica" };
const MATERIA_PROVISORIA: Record<Area, string> = { linguagens: "portugues", humanas: "historia", natureza: "fisica", matematica: "matematica" };
const IMG_MD = /!\[[^\]]*\]\(([^)\s]+)\)/g;
const quebrada = (url: string) => url.includes("broken-image");

/** Separa as imagens markdown do texto. */
function extrairImagens(texto: string | null): { texto: string; urls: string[] } {
  const urls: string[] = [];
  const limpo = (texto ?? "").replace(IMG_MD, (_m, url: string) => { urls.push(url); return ""; });
  return { texto: limpo.replace(/\n{3,}/g, "\n\n").trim(), urls };
}

export function enemDevParaQuestao(q: EnemDevQuestao) {
  const motivos: string[] = [];
  const imagens: { alvo: AlvoImagem; url: string }[] = [];
  const area = AREA[q.discipline] ?? "linguagens";

  const ctx = extrairImagens(q.context);
  for (const url of [...ctx.urls, ...(q.files ?? [])]) {
    if (quebrada(url)) motivos.push("Imagem do enunciado indisponível no enem.dev.");
    else if (!imagens.some((i) => i.alvo === "enunciado" && i.url === url)) imagens.push({ alvo: "enunciado", url });
  }

  const alternativas = q.alternatives.map((a) => {
    const letra = a.letter as Letra;
    const t = extrairImagens(a.text);
    for (const url of [...t.urls, ...(a.file ? [a.file] : [])]) {
      if (quebrada(url)) motivos.push(`Imagem da alternativa ${letra} indisponível no enem.dev.`);
      else imagens.push({ alvo: letra, url });
    }
    if (!t.texto && !a.file && t.urls.length === 0) motivos.push(`Alternativa ${letra} sem conteúdo.`);
    return { letra, texto: t.texto };
  });

  const letras = alternativas.map((a) => a.letra).join("");
  if (alternativas.length !== 5 || letras !== "ABCDE") motivos.push("A questão precisa ter 5 alternativas (A a E).");
  const resposta = ["A", "B", "C", "D", "E"].includes(q.correctAlternative) ? (q.correctAlternative as Letra) : null;
  if (!resposta) motivos.push("Resposta inválida no enem.dev.");

  const linha: Database["public"]["Tables"]["questoes"]["Insert"] = {
    escopo: "geral",
    escola_id: null,
    banca: "ENEM",
    ano: q.year,
    caderno: q.language ?? "",
    numero: q.index,
    area,
    materia: MATERIA_PROVISORIA[area],
    enunciado: ctx.texto,
    comando: (q.alternativesIntroduction ?? "").trim(),
    alternativas,
    resposta,
    anulada: false,
    status: "revisao",
    precisa_revisao: motivos.length > 0,
    motivo_revisao: motivos.length ? [...new Set(motivos)].join(" ") : null,
    origem: "enemdev",
    fonte_id: `${q.year}-${q.language ?? "geral"}-${q.index}`,
  };
  return { linha, imagens };
}
```

- [ ] **Step 4: Rodar e ver passar.**

- [ ] **Step 5: Commit** — `git add src/lib/questoes && git commit -m "Banco de questoes: conversao das questoes do enem.dev"`

---

### Task 6: Storage, IA e actions de questões e assuntos

**Files:**
- Create: `src/lib/questoes/storage.ts`, `src/lib/questoes/ia.ts`, `src/actions/questoes.ts`, `src/actions/assuntos.ts`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  - `storage.ts`: `BUCKET = "questoes"`; `linkExibicao(path: string): Promise<string>` (300 s); `linkParaIA(path: string): Promise<string>` (259200 s); `linksExibicao(paths: string[]): Promise<Map<string, string>>`
  - `ia.ts`: `MODELO = "claude-opus-5-5"`; `PRECO_ENTRADA_LOTE = 2 / 1_000_000`; `PRECO_SAIDA_LOTE = 10 / 1_000_000`; `clienteIA(): Anthropic`; `instrucoesLeitura(banca, ano, caderno, assuntos: {id,materia,nome}[]): string`; `pedidoPagina(params: { customId: string; paginaUrl: string; proximaUrl: string | null; gabaritoUrls: string[]; instrucoes: string })`; `pedidoClassificacao(customId: string, questoes: {id: string; area: string; enunciado: string; comando: string}[], assuntos: {id,materia,nome}[])`; `custoDoUso(u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): number`; `estimarCustoPaginas(paginas: number): number` (≈ 9000 tokens de entrada e 3000 de saída por página)
  - `actions/questoes.ts` (todas checam acesso): `type DadosQuestao = { banca: string; ano: number | null; caderno: string; numero: number | null; materia: string; assunto_id: string | null; enunciado: string; comando: string; alternativas: { letra: Letra; texto: string }[]; resposta: Letra | null; anulada: boolean; escopo?: Escopo }`; `criarQuestao(dados: DadosQuestao): Promise<string>`; `salvarQuestao(id: string, dados: DadosQuestao): Promise<void>`; `publicarQuestao(id: string, publicar: boolean): Promise<void>`; `excluirQuestao(id: string): Promise<void>`; `promoverQuestao(id: string): Promise<string>`; `prepararEnvioImagem(questaoId: string, nome: string, tamanho: number, tipoMime: string): Promise<{ signedUrl: string; storagePath: string }>`; `registrarImagem(questaoId: string, alvo: AlvoImagem, storagePath: string, substituirId: string | null): Promise<void>`; `removerImagem(imagemId: string): Promise<void>`; `atualizarRecorte(imagemId: string, quadro: Quadro): Promise<void>`
  - `actions/assuntos.ts`: `listarAssuntos(): Promise<Assunto[]>` (professor logado); `aprovarAssunto(id: string)`; `juntarAssunto(propostoId: string, destinoId: string)`; `carregarAssuntosIniciais(): Promise<number>` — as três últimas só `dono`.

- [ ] **Step 1: `src/lib/questoes/storage.ts`**

```ts
import { supabase } from "@/lib/supabase/client";

export const BUCKET = "questoes";
const EXIBICAO_SEG = 300;
const IA_SEG = 259200; // 72 h: o lote pode demorar

async function assinar(path: string, segundos: number): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, segundos);
  if (error || !data) throw new Error(error?.message ?? "Falha ao gerar link.");
  return data.signedUrl;
}

export const linkExibicao = (path: string) => assinar(path, EXIBICAO_SEG);
export const linkParaIA = (path: string) => assinar(path, IA_SEG);

export async function linksExibicao(paths: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(paths)];
  if (unicos.length === 0) return new Map();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unicos, EXIBICAO_SEG);
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]));
}
```

- [ ] **Step 2: `src/lib/questoes/ia.ts`**

Antes de escrever, confira a assinatura de `zodOutputFormat` em `node_modules/@anthropic-ai/sdk/helpers/zod` (aceita schema do zod 4) e o tipo dos pedidos de `client.messages.batches.create`.

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ClassificacaoSchema, RespostaPaginaSchema } from "./formato-ia";
import { MATERIAS } from "./materias";

export const MODELO = "claude-opus-5-5";
export const PRECO_ENTRADA_LOTE = 2 / 1_000_000;
export const PRECO_SAIDA_LOTE = 10 / 1_000_000;

let cliente: Anthropic | null = null;
export function clienteIA(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Configure ANTHROPIC_API_KEY na Vercel para usar a importação com IA.");
  cliente ??= new Anthropic();
  return cliente;
}

type AssuntoIA = { id: string; materia: string; nome: string };

function listaMaterias(): string {
  return Object.entries(MATERIAS).map(([k, v]) => `${k} (${v.rotulo}, área ${v.area})`).join("; ");
}

function listaAssuntos(assuntos: AssuntoIA[]): string {
  return assuntos.map((a) => `${a.id} | ${a.materia} | ${a.nome}`).join("\n");
}

export function instrucoesLeitura(banca: string, ano: number | null, caderno: string, assuntos: AssuntoIA[]): string {
  return [
    `Você está digitalizando uma prova objetiva (${banca}${ano ? ` ${ano}` : ""}${caderno ? `, ${caderno}` : ""}) para um banco de questões escolar.`,
    "A primeira imagem é a página a ler. A segunda (se houver) é a página seguinte, só para completar uma questão que continue nela. As demais são o gabarito oficial.",
    "Extraia APENAS as questões cujo número começa na primeira imagem. Copie o texto fielmente, em português, sem resumir; use **negrito** e *itálico* só onde a prova usa; mantenha quebras de parágrafo.",
    "enunciado = textos de apoio + enunciado. comando = a frase imediatamente antes das alternativas (\"\" se não houver). alternativas = A a E.",
    "resposta = letra do gabarito para esse número, ou null se não encontrar. anulada = true se o gabarito indicar anulação.",
    "figuras = cada figura, gráfico, mapa, tabela-imagem ou tirinha da primeira imagem, com o quadro em frações da página (x, y do canto superior esquerdo; w, h), e alvo = enunciado ou a letra da alternativa a que pertence.",
    `Matérias permitidas: ${listaMaterias()}.`,
    "assunto_id = o id de um assunto da lista abaixo que corresponda à matéria escolhida; se nenhum servir, assunto_id = null e assunto_novo = um nome curto de assunto.",
    "duvidas = frases curtas sobre qualquer incerteza (texto ilegível, figura cortada, questão incompleta); [] se nenhuma.",
    "Assuntos (id | matéria | nome):",
    listaAssuntos(assuntos),
  ].join("\n");
}

export function pedidoPagina(p: { customId: string; paginaUrl: string; proximaUrl: string | null; gabaritoUrls: string[]; instrucoes: string }) {
  const imagens = [p.paginaUrl, ...(p.proximaUrl ? [p.proximaUrl] : []), ...p.gabaritoUrls];
  return {
    custom_id: p.customId,
    params: {
      model: MODELO,
      max_tokens: 16000,
      output_config: { effort: "medium" as const, format: zodOutputFormat(RespostaPaginaSchema) },
      messages: [{
        role: "user" as const,
        content: [
          ...imagens.map((url) => ({ type: "image" as const, source: { type: "url" as const, url } })),
          { type: "text" as const, text: p.instrucoes },
        ],
      }],
    },
  };
}

export function pedidoClassificacao(customId: string, questoes: { id: string; area: string; enunciado: string; comando: string }[], assuntos: AssuntoIA[]) {
  const texto = [
    "Classifique cada questão do ENEM abaixo na matéria (lista fixa) e no assunto (lista de assuntos).",
    `Matérias permitidas: ${listaMaterias()}. A matéria precisa ser compatível com a área informada.`,
    "Responda um item por questão com o mesmo id. assunto_id da lista, ou null e assunto_novo com um nome curto.",
    "Assuntos (id | matéria | nome):",
    listaAssuntos(assuntos),
    "Questões:",
    ...questoes.map((q) => `### id=${q.id} área=${q.area}\n${q.enunciado.slice(0, 1500)}\n${q.comando}`),
  ].join("\n");
  return {
    custom_id: customId,
    params: {
      model: MODELO,
      max_tokens: 8000,
      output_config: { effort: "medium" as const, format: zodOutputFormat(ClassificacaoSchema) },
      messages: [{ role: "user" as const, content: texto }],
    },
  };
}

export function custoDoUso(u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): number {
  const entrada = u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  return entrada * PRECO_ENTRADA_LOTE + u.output_tokens * PRECO_SAIDA_LOTE;
}

export function estimarCustoPaginas(paginas: number): number {
  return Math.round(paginas * (9000 * PRECO_ENTRADA_LOTE + 3000 * PRECO_SAIDA_LOTE) * 100) / 100;
}
```

Se o tipo do SDK não aceitar `format: zodOutputFormat(...)` dentro de `params` de um lote, use o formato JSON Schema equivalente que `zodOutputFormat` produz (`{ type: "json_schema", schema: … }`, gerado com `z.toJSONSchema(RespostaPaginaSchema)`), e anote no relatório.

- [ ] **Step 3: `src/actions/questoes.ts`**

```ts
"use server";

import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase/client";
import { exigirEditorQuestao, exigirProfessor, podeImportar } from "@/lib/questoes/acesso";
import { ehMateria, areaDaMateria, LETRAS } from "@/lib/questoes/materias";
import { limitarQuadro, type Quadro } from "@/lib/questoes/quadro";
import { BUCKET } from "@/lib/questoes/storage";
import type { AlvoImagem, Escopo, Letra } from "@/lib/types";

export type DadosQuestao = {
  banca: string;
  ano: number | null;
  caderno: string;
  numero: number | null;
  materia: string;
  assunto_id: string | null;
  enunciado: string;
  comando: string;
  alternativas: { letra: Letra; texto: string }[];
  resposta: Letra | null;
  anulada: boolean;
  escopo?: Escopo;
};

const MIME: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const TAMANHO_MAXIMO = 5242880;

function limpar(d: DadosQuestao) {
  const banca = d.banca.trim();
  if (!banca) throw new Error("Informe a banca.");
  if (!ehMateria(d.materia)) throw new Error("Escolha a matéria.");
  const alternativas = LETRAS.map((letra) => ({ letra, texto: (d.alternativas.find((a) => a.letra === letra)?.texto ?? "").trim() }));
  if (d.resposta && !LETRAS.includes(d.resposta)) throw new Error("Resposta inválida.");
  return {
    banca,
    ano: d.ano && Number.isInteger(d.ano) ? d.ano : null,
    caderno: d.caderno.trim(),
    numero: d.numero && Number.isInteger(d.numero) ? d.numero : null,
    area: areaDaMateria(d.materia),
    materia: d.materia,
    assunto_id: d.assunto_id || null,
    enunciado: d.enunciado.trim(),
    comando: d.comando.trim(),
    alternativas,
    resposta: d.resposta,
    anulada: d.anulada,
  };
}

function traduzirErro(message: string): string {
  return message.includes("uq_questoes") ? "Já existe uma questão com essa banca, ano, caderno e número." : message;
}

export async function criarQuestao(dados: DadosQuestao): Promise<string> {
  const professor = await exigirProfessor();
  const escopo: Escopo = dados.escopo === "geral" && professor.role === "dono" ? "geral" : "escola";
  const { data, error } = await supabase
    .from("questoes")
    .insert({ ...limpar(dados), escopo, escola_id: escopo === "geral" ? null : professor.escola_id, origem: "manual", status: "revisao", criado_por: professor.id })
    .select("id")
    .single();
  if (error || !data) throw new Error(traduzirErro(error?.message ?? "Falha ao criar questão."));
  return data.id;
}

export async function salvarQuestao(id: string, dados: DadosQuestao): Promise<void> {
  const { questao } = await exigirEditorQuestao(id);
  const limpo = limpar(dados);
  if (questao.status === "publicada" && !limpo.anulada && !limpo.resposta) throw new Error("Questão publicada precisa de resposta (ou ser anulada).");
  const { error } = await supabase.from("questoes").update({ ...limpo, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(traduzirErro(error.message));
}

export async function publicarQuestao(id: string, publicar: boolean): Promise<void> {
  const { questao } = await exigirEditorQuestao(id);
  if (publicar && !questao.anulada && !questao.resposta) throw new Error("Marque a resposta certa (ou anulada) antes de publicar.");
  const { error } = await supabase
    .from("questoes")
    .update({ status: publicar ? "publicada" : "revisao", precisa_revisao: publicar ? false : questao.precisa_revisao, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function excluirQuestao(id: string): Promise<void> {
  await exigirEditorQuestao(id);
  const { data: imagens } = await supabase.from("questao_imagens").select("storage_path").eq("questao_id", id).eq("tipo", "arquivo");
  const caminhos = (imagens ?? []).map((i) => i.storage_path).filter((p): p is string => !!p);
  if (caminhos.length) await supabase.storage.from(BUCKET).remove(caminhos);
  const { error } = await supabase.from("questoes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Copia uma questão de escola para o banco geral (só dono). Imagens 'arquivo' são copiadas no Storage. */
export async function promoverQuestao(id: string): Promise<string> {
  const { professor, questao } = await exigirEditorQuestao(id);
  if (professor.role !== "dono" || questao.escopo !== "escola") throw new Error("Só o dono promove questões de escola.");
  const { id: _id, created_at: _c, updated_at: _u, ...resto } = questao;
  const { data: nova, error } = await supabase
    .from("questoes")
    .insert({ ...resto, escopo: "geral", escola_id: null, numero: null, status: "revisao", criado_por: professor.id })
    .select("id")
    .single();
  if (error || !nova) throw new Error(error?.message ?? "Falha ao promover.");
  const { data: imagens } = await supabase.from("questao_imagens").select("*").eq("questao_id", id);
  for (const img of imagens ?? []) {
    let storage_path = img.storage_path;
    if (img.tipo === "arquivo" && img.storage_path) {
      const ext = img.storage_path.split(".").pop();
      storage_path = `imagens/${nova.id}/${randomUUID()}.${ext}`;
      const { error: erroCopia } = await supabase.storage.from(BUCKET).copy(img.storage_path, storage_path);
      if (erroCopia) throw new Error(erroCopia.message);
    }
    const { id: _i, created_at: _ci, questao_id: _q, ...dadosImg } = img;
    await supabase.from("questao_imagens").insert({ ...dadosImg, questao_id: nova.id, storage_path });
  }
  return nova.id;
}

export async function prepararEnvioImagem(questaoId: string, nome: string, tamanho: number, tipoMime: string) {
  await exigirEditorQuestao(questaoId);
  const ext = MIME[tipoMime];
  if (!ext) throw new Error("Envie PNG, JPG ou WEBP.");
  if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > TAMANHO_MAXIMO) throw new Error("A imagem precisa ter até 5 MB.");
  const storagePath = `imagens/${questaoId}/${randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) throw new Error(error?.message ?? "Falha ao preparar envio.");
  void nome;
  return { signedUrl: data.signedUrl, storagePath };
}

export async function registrarImagem(questaoId: string, alvo: AlvoImagem, storagePath: string, substituirId: string | null): Promise<void> {
  await exigirEditorQuestao(questaoId);
  if (!["enunciado", ...LETRAS].includes(alvo)) throw new Error("Destino da imagem inválido.");
  const prefixo = `imagens/${questaoId}/`;
  if (!storagePath.startsWith(prefixo) || !/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(storagePath.slice(prefixo.length))) {
    throw new Error("Caminho de imagem inválido.");
  }
  if (substituirId) await removerImagemInterna(questaoId, substituirId);
  const { count } = await supabase.from("questao_imagens").select("id", { count: "exact", head: true }).eq("questao_id", questaoId).eq("alvo", alvo);
  const { error } = await supabase.from("questao_imagens").insert({ questao_id: questaoId, alvo, tipo: "arquivo", storage_path: storagePath, ordem: count ?? 0 });
  if (error) throw new Error(error.message);
}

async function removerImagemInterna(questaoId: string, imagemId: string) {
  const { data: img } = await supabase.from("questao_imagens").select("*").eq("id", imagemId).eq("questao_id", questaoId).maybeSingle();
  if (!img) return;
  if (img.tipo === "arquivo" && img.storage_path) await supabase.storage.from(BUCKET).remove([img.storage_path]);
  await supabase.from("questao_imagens").delete().eq("id", imagemId);
}

export async function removerImagem(imagemId: string): Promise<void> {
  const { data: img } = await supabase.from("questao_imagens").select("questao_id").eq("id", imagemId).maybeSingle();
  if (!img) return;
  await exigirEditorQuestao(img.questao_id);
  await removerImagemInterna(img.questao_id, imagemId);
}

export async function atualizarRecorte(imagemId: string, quadro: Quadro): Promise<void> {
  const { data: img } = await supabase.from("questao_imagens").select("questao_id, tipo").eq("id", imagemId).maybeSingle();
  if (!img || img.tipo !== "recorte") throw new Error("Recorte não encontrado.");
  await exigirEditorQuestao(img.questao_id);
  const { error } = await supabase.from("questao_imagens").update(limitarQuadro(quadro)).eq("id", imagemId);
  if (error) throw new Error(error.message);
}

void podeImportar;
```

(Remova as linhas `void nome;` / `void podeImportar;` e os imports não usados se o lint reclamar — elas só existem para deixar claro que os parâmetros são intencionais.)

- [ ] **Step 4: `src/actions/assuntos.ts`**

```ts
"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirProfessor } from "@/lib/questoes/acesso";
import { ASSUNTOS_INICIAIS } from "@/lib/questoes/assuntos-iniciais";
import type { Assunto } from "@/lib/types";

async function exigirDono() {
  const professor = await exigirProfessor();
  if (professor.role !== "dono") throw new Error("Só o dono da plataforma gerencia assuntos.");
  return professor;
}

export async function listarAssuntos(): Promise<Assunto[]> {
  await exigirProfessor();
  const { data } = await supabase.from("assuntos").select("*").order("materia").order("nome");
  return data ?? [];
}

export async function aprovarAssunto(id: string): Promise<void> {
  await exigirDono();
  const { error } = await supabase.from("assuntos").update({ situacao: "aprovado" }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Move as questões do assunto proposto para o destino e apaga o proposto. */
export async function juntarAssunto(propostoId: string, destinoId: string): Promise<void> {
  await exigirDono();
  if (propostoId === destinoId) throw new Error("Escolha outro assunto.");
  const [{ data: proposto }, { data: destino }] = await Promise.all([
    supabase.from("assuntos").select("*").eq("id", propostoId).maybeSingle(),
    supabase.from("assuntos").select("*").eq("id", destinoId).maybeSingle(),
  ]);
  if (!proposto || !destino || proposto.materia !== destino.materia) throw new Error("Os assuntos precisam ser da mesma matéria.");
  const { error } = await supabase.from("questoes").update({ assunto_id: destinoId }).eq("assunto_id", propostoId);
  if (error) throw new Error(error.message);
  await supabase.from("assuntos").delete().eq("id", propostoId);
}

export async function carregarAssuntosIniciais(): Promise<number> {
  await exigirDono();
  const linhas = Object.entries(ASSUNTOS_INICIAIS).flatMap(([materia, nomes]) => nomes.map((nome) => ({ materia, nome, situacao: "aprovado" as const })));
  const { data: existentes } = await supabase.from("assuntos").select("materia, nome");
  const chave = (m: string, n: string) => `${m}|${n.toLowerCase()}`;
  const ja = new Set((existentes ?? []).map((e) => chave(e.materia, e.nome)));
  const novas = linhas.filter((l) => !ja.has(chave(l.materia, l.nome)));
  if (novas.length) {
    const { error } = await supabase.from("assuntos").insert(novas);
    if (error) throw new Error(error.message);
  }
  return novas.length;
}
```

- [ ] **Step 5: Verificar** — `npx tsc --noEmit && npm run lint && npm test` → OK.

- [ ] **Step 6: Commit**

```bash
git add src/lib/questoes src/actions/questoes.ts src/actions/assuntos.ts
git commit -m "Banco de questoes: storage, IA e actions de questoes e assuntos"
```

---

### Task 7: Importação de PDF no servidor

**Files:**
- Create: `src/actions/importacoes.ts`

**Interfaces:**
- Consumes: `exigirImportacao`, `exigirProfessor`, `podeImportar` (Task 4); `clienteIA`, `instrucoesLeitura`, `pedidoPagina`, `custoDoUso`, `estimarCustoPaginas` (Task 6); `linkParaIA`, `BUCKET` (Task 6); `RespostaPaginaSchema`, `respostaParaQuestoes` (Task 3).
- Produces:
  - `criarImportacao(d: { escopo: Escopo; banca: string; ano: number | null; caderno: string }): Promise<string>`
  - `prepararEnvioPagina(importacaoId: string, tipo: "prova" | "gabarito", numero: number): Promise<{ signedUrl: string; storagePath: string }>`
  - `registrarPagina(importacaoId: string, tipo: "prova" | "gabarito", numero: number, largura: number, altura: number): Promise<void>`
  - `iniciarLeitura(importacaoId: string): Promise<void>`
  - `type SituacaoImportacao = { status: StatusImportacao; total: number; lidas: number; erros: { pagina: number; erro: string }[]; avisos: string[]; custoEstimado: number | null; custoReal: number | null; questoes: number }`
  - `atualizarImportacao(importacaoId: string): Promise<SituacaoImportacao>`
  - `lerDeNovo(importacaoId: string): Promise<void>`
  - `aprovarTodasSemAviso(importacaoId: string): Promise<number>`

- [ ] **Step 1: Implementar**

```ts
"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirImportacao, exigirProfessor, podeImportar } from "@/lib/questoes/acesso";
import { clienteIA, custoDoUso, estimarCustoPaginas, instrucoesLeitura, pedidoPagina } from "@/lib/questoes/ia";
import { BUCKET, linkParaIA } from "@/lib/questoes/storage";
import { RespostaPaginaSchema, respostaParaQuestoes } from "@/lib/questoes/formato-ia";
import type { Escopo, StatusImportacao } from "@/lib/types";

const MAX_PAGINAS = 60;

export async function criarImportacao(d: { escopo: Escopo; banca: string; ano: number | null; caderno: string }): Promise<string> {
  const professor = await exigirProfessor();
  if (!podeImportar(professor, d.escopo)) throw new Error("Você não pode importar provas nesse banco.");
  const banca = d.banca.trim();
  if (!banca) throw new Error("Informe a banca.");
  const { data, error } = await supabase
    .from("importacoes")
    .insert({ escopo: d.escopo, escola_id: d.escopo === "geral" ? null : professor.escola_id, origem: "pdf", banca, ano: d.ano, caderno: d.caderno.trim(), criado_por: professor.id })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar importação.");
  return data.id;
}

function caminhoPagina(importacaoId: string, tipo: "prova" | "gabarito", numero: number) {
  return `${importacaoId}/${tipo}-${numero}.jpg`;
}

export async function prepararEnvioPagina(importacaoId: string, tipo: "prova" | "gabarito", numero: number) {
  const { importacao } = await exigirImportacao(importacaoId);
  if (importacao.status !== "enviando") throw new Error("Essa importação já foi enviada.");
  if (!["prova", "gabarito"].includes(tipo) || !Number.isInteger(numero) || numero < 1 || numero > MAX_PAGINAS) throw new Error("Página inválida.");
  const storagePath = caminhoPagina(importacaoId, tipo, numero);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: true });
  if (error || !data) throw new Error(error?.message ?? "Falha ao preparar envio.");
  return { signedUrl: data.signedUrl, storagePath };
}

export async function registrarPagina(importacaoId: string, tipo: "prova" | "gabarito", numero: number, largura: number, altura: number) {
  const { importacao } = await exigirImportacao(importacaoId);
  if (importacao.status !== "enviando") throw new Error("Essa importação já foi enviada.");
  if (!Number.isInteger(largura) || !Number.isInteger(altura) || largura < 100 || altura < 100) throw new Error("Página inválida.");
  const { error } = await supabase
    .from("importacao_paginas")
    .upsert({ importacao_id: importacaoId, tipo, numero, storage_path: caminhoPagina(importacaoId, tipo, numero), largura, altura, status: "pendente" }, { onConflict: "importacao_id,tipo,numero" });
  if (error) throw new Error(error.message);
}

async function assuntosAprovados() {
  const { data } = await supabase.from("assuntos").select("id, materia, nome").eq("situacao", "aprovado").order("materia");
  return data ?? [];
}

/** Cria o lote com um pedido por página da prova (todas ou só as indicadas). */
async function enviarLote(importacaoId: string, somentePaginas: number[] | null) {
  const { data: importacao } = await supabase.from("importacoes").select("*").eq("id", importacaoId).single();
  const { data: paginas } = await supabase.from("importacao_paginas").select("*").eq("importacao_id", importacaoId).order("numero");
  const provas = (paginas ?? []).filter((p) => p.tipo === "prova");
  const gabaritos = (paginas ?? []).filter((p) => p.tipo === "gabarito");
  if (!importacao || provas.length === 0) throw new Error("Envie as páginas da prova primeiro.");

  const instrucoes = instrucoesLeitura(importacao.banca, importacao.ano, importacao.caderno, await assuntosAprovados());
  const gabaritoUrls = await Promise.all(gabaritos.map((g) => linkParaIA(g.storage_path)));
  const alvo = provas.filter((p) => !somentePaginas || somentePaginas.includes(p.numero));
  const pedidos = await Promise.all(alvo.map(async (p) => {
    const proxima = provas.find((q) => q.numero === p.numero + 1);
    return pedidoPagina({
      customId: p.id,
      paginaUrl: await linkParaIA(p.storage_path),
      proximaUrl: proxima ? await linkParaIA(proxima.storage_path) : null,
      gabaritoUrls,
      instrucoes,
    });
  }));
  const lote = await clienteIA().messages.batches.create({ requests: pedidos });
  await supabase.from("importacao_paginas").update({ status: "pendente", erro: null }).in("id", alvo.map((p) => p.id));
  await supabase
    .from("importacoes")
    .update({ batch_id: lote.id, status: "lendo", total_paginas: provas.length, erro: null, custo_estimado_usd: estimarCustoPaginas(provas.length), updated_at: new Date().toISOString() })
    .eq("id", importacaoId);
}

export async function iniciarLeitura(importacaoId: string): Promise<void> {
  const { importacao } = await exigirImportacao(importacaoId);
  if (importacao.status !== "enviando") throw new Error("Essa importação já está sendo lida.");
  await enviarLote(importacaoId, null);
}

export type SituacaoImportacao = {
  status: StatusImportacao;
  total: number;
  lidas: number;
  erros: { pagina: number; erro: string }[];
  avisos: string[];
  custoEstimado: number | null;
  custoReal: number | null;
  questoes: number;
};

/** Consulta o lote; quando terminou, grava as questões (só um chamador processa). */
export async function atualizarImportacao(importacaoId: string): Promise<SituacaoImportacao> {
  const { importacao } = await exigirImportacao(importacaoId);
  let avisos: string[] = [];
  if (importacao.status === "lendo" && importacao.batch_id) {
    const lote = await clienteIA().messages.batches.retrieve(importacao.batch_id);
    if (lote.processing_status === "ended") {
      const { data: tomou } = await supabase
        .from("importacoes")
        .update({ status: "revisao", updated_at: new Date().toISOString() })
        .eq("id", importacaoId)
        .eq("status", "lendo")
        .select("id");
      if (tomou && tomou.length > 0) avisos = await gravarResultados(importacaoId, importacao.batch_id);
    } else {
      const feitas = lote.request_counts.succeeded + lote.request_counts.errored + lote.request_counts.canceled + lote.request_counts.expired;
      await supabase.from("importacoes").update({ paginas_lidas: feitas }).eq("id", importacaoId);
    }
  }
  return situacao(importacaoId, avisos);
}

async function gravarResultados(importacaoId: string, batchId: string): Promise<string[]> {
  const { data: importacao } = await supabase.from("importacoes").select("*").eq("id", importacaoId).single();
  const { data: paginas } = await supabase.from("importacao_paginas").select("*").eq("importacao_id", importacaoId);
  const { data: existentes } = await supabase.from("questoes").select("numero").eq("importacao_id", importacaoId);
  const assuntos = await assuntosAprovados();
  const mapaAssuntos = new Map(assuntos.map((a) => [a.id, a.materia]));
  const numerosExistentes = new Set((existentes ?? []).map((e) => e.numero).filter((n): n is number => n !== null));
  const avisos: string[] = [];
  let custo = Number(importacao!.custo_real_usd ?? 0);
  let lidas = 0;

  for await (const r of await clienteIA().messages.batches.results(batchId)) {
    const pagina = (paginas ?? []).find((p) => p.id === r.custom_id);
    if (!pagina) continue;
    if (r.result.type !== "succeeded") {
      await supabase.from("importacao_paginas").update({ status: "erro", erro: `Falha na leitura (${r.result.type}).` }).eq("id", pagina.id);
      continue;
    }
    const msg = r.result.message;
    custo += custoDoUso(msg.usage);
    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") {
      await supabase.from("importacao_paginas").update({ status: "erro", erro: msg.stop_reason === "refusal" ? "A IA recusou esta página." : "Resposta cortada." }).eq("id", pagina.id);
      continue;
    }
    const texto = msg.content.find((b) => b.type === "text");
    let resposta;
    try {
      resposta = RespostaPaginaSchema.parse(JSON.parse(texto && texto.type === "text" ? texto.text : ""));
    } catch {
      await supabase.from("importacao_paginas").update({ status: "erro", erro: "Resposta da IA fora do formato." }).eq("id", pagina.id);
      continue;
    }
    const { questoes, avisos: av } = respostaParaQuestoes(resposta, {
      escopo: importacao!.escopo, escola_id: importacao!.escola_id, banca: importacao!.banca, ano: importacao!.ano, caderno: importacao!.caderno,
      importacao_id: importacaoId, pagina_id: pagina.id, numerosExistentes, assuntos: mapaAssuntos,
    });
    avisos.push(...av.map((a) => `Página ${pagina.numero}: ${a}`));
    for (const q of questoes) {
      let assunto_id = q.linha.assunto_id ?? null;
      if (q.assuntoNovo) {
        const { data: proposto } = await supabase
          .from("assuntos")
          .upsert({ materia: q.assuntoNovo.materia, nome: q.assuntoNovo.nome, situacao: "proposto" }, { onConflict: "materia,nome", ignoreDuplicates: false })
          .select("id")
          .maybeSingle();
        assunto_id = proposto?.id ?? null;
      }
      const { data: criada, error } = await supabase.from("questoes").insert({ ...q.linha, assunto_id }).select("id").single();
      if (error || !criada) {
        avisos.push(`Página ${pagina.numero}: questão ${q.linha.numero} não foi gravada (${error?.message.includes("uq_questoes") ? "já existe no banco" : error?.message}).`);
        continue;
      }
      if (q.imagens.length) {
        await supabase.from("questao_imagens").insert(q.imagens.map((f, i) => ({ questao_id: criada.id, alvo: f.alvo, ordem: i, tipo: "recorte" as const, pagina_id: pagina.id, x: f.x, y: f.y, w: f.w, h: f.h })));
      }
    }
    await supabase.from("importacao_paginas").update({ status: "lida", erro: null }).eq("id", pagina.id);
    lidas++;
  }
  await supabase
    .from("importacoes")
    .update({ custo_real_usd: Math.round(custo * 100) / 100, paginas_lidas: lidas, erro: avisos.length ? avisos.join("\n").slice(0, 4000) : null, updated_at: new Date().toISOString() })
    .eq("id", importacaoId);
  return avisos;
}

async function situacao(importacaoId: string, avisosNovos: string[]): Promise<SituacaoImportacao> {
  const [{ data: imp }, { data: paginas }, { count }] = await Promise.all([
    supabase.from("importacoes").select("*").eq("id", importacaoId).single(),
    supabase.from("importacao_paginas").select("numero, status, erro, tipo").eq("importacao_id", importacaoId),
    supabase.from("questoes").select("id", { count: "exact", head: true }).eq("importacao_id", importacaoId),
  ]);
  const avisos = avisosNovos.length ? avisosNovos : (imp?.erro ?? "").split("\n").filter(Boolean);
  return {
    status: imp!.status,
    total: imp!.total_paginas,
    lidas: imp!.paginas_lidas,
    erros: (paginas ?? []).filter((p) => p.tipo === "prova" && p.status === "erro").map((p) => ({ pagina: p.numero, erro: p.erro ?? "Erro" })),
    avisos,
    custoEstimado: imp!.custo_estimado_usd,
    custoReal: imp!.custo_real_usd,
    questoes: count ?? 0,
  };
}

export async function lerDeNovo(importacaoId: string): Promise<void> {
  const { importacao } = await exigirImportacao(importacaoId);
  if (importacao.status === "lendo") throw new Error("A leitura ainda está em andamento.");
  const { data: comErro } = await supabase.from("importacao_paginas").select("numero").eq("importacao_id", importacaoId).eq("tipo", "prova").eq("status", "erro");
  const numeros = (comErro ?? []).map((p) => p.numero);
  if (numeros.length === 0) throw new Error("Nenhuma página com erro.");
  await enviarLote(importacaoId, numeros);
}

export async function aprovarTodasSemAviso(importacaoId: string): Promise<number> {
  await exigirImportacao(importacaoId);
  const { data, error } = await supabase
    .from("questoes")
    .update({ status: "publicada", updated_at: new Date().toISOString() })
    .eq("importacao_id", importacaoId)
    .eq("status", "revisao")
    .eq("precisa_revisao", false)
    .or("resposta.not.is.null,anulada.eq.true")
    .select("id");
  if (error) throw new Error(error.message);
  const { count } = await supabase.from("questoes").select("id", { count: "exact", head: true }).eq("importacao_id", importacaoId).eq("status", "revisao");
  if ((count ?? 0) === 0) await supabase.from("importacoes").update({ status: "concluida" }).eq("id", importacaoId);
  return data?.length ?? 0;
}
```

Notas: (a) o `upsert` em `assuntos` com `onConflict: "materia,nome"` precisa de uma restrição única exatamente nessas colunas; o índice da spec é sobre `lower(nome)`. Se o upsert falhar, troque por: buscar `assuntos` com `.eq("materia", m).ilike("nome", nome)` e, se não houver, inserir. (b) Ao lidar com um lote que ainda estava `lendo` para `lerDeNovo`, o processamento acrescenta às questões já existentes da importação (os números já gravados entram em `numerosExistentes`).

- [ ] **Step 2: Verificar** — `npx tsc --noEmit && npm run lint && npm test` → OK.

- [ ] **Step 3: Commit** — `git add src/actions/importacoes.ts && git commit -m "Banco de questoes: importacao de PDF em lote no servidor"`

---

### Task 8: Telas de importação (render no navegador e acompanhamento)

**Files:**
- Create: `src/components/questoes/ImportarProva.tsx`, `src/components/questoes/AcompanharImportacao.tsx`, `src/app/banco/importar/page.tsx`, `src/app/banco/importacoes/[id]/page.tsx`

**Interfaces:**
- Consumes: `criarImportacao`, `prepararEnvioPagina`, `registrarPagina`, `iniciarLeitura`, `atualizarImportacao`, `lerDeNovo`, `aprovarTodasSemAviso`, `type SituacaoImportacao` (Task 7); `estimarCustoPaginas` — **não** importar `ia.ts` no cliente (ele importa o SDK); replique a fórmula localmente no componente: `paginas * (9000 * 2 + 3000 * 10) / 1_000_000`.

- [ ] **Step 1: `src/components/questoes/ImportarProva.tsx`**

Antes, leia `node_modules/pdfjs-dist/package.json` e a documentação do pdf.js para a versão instalada: import ESM (`pdfjs-dist`), configuração do worker (`GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()` em bundlers modernos) e a API `getDocument({ data }).promise`, `page.getViewport({ scale })`, `page.render({ canvasContext, viewport }).promise`. Carregue o pdf.js com `await import("pdfjs-dist")` dentro do handler para não entrar no bundle do servidor.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { criarImportacao, iniciarLeitura, prepararEnvioPagina, registrarPagina } from "@/actions/importacoes";
import { estilos } from "@/components/ui/estilos";
import type { Escopo } from "@/lib/types";

const BANCAS = ["ENEM", "UFMS", "UEMS", "UFGD", "Fuvest"];
const MAX_PAGINAS = 60;
const LARGURA_MAX = 1600;

type Pagina = { blob: Blob; largura: number; altura: number };

async function renderizarPdf(arquivo: File, aoAvancar: (feitas: number, total: number) => void): Promise<Pagina[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  if (doc.numPages > MAX_PAGINAS) throw new Error(`O PDF tem ${doc.numPages} páginas; o máximo é ${MAX_PAGINAS}.`);
  const paginas: Pagina[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const escala = Math.min(150 / 72, LARGURA_MAX / base.width);
    const viewport = page.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob = await new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao gerar imagem."))), "image/jpeg", 0.8));
    paginas.push({ blob, largura: canvas.width, altura: canvas.height });
    aoAvancar(n, doc.numPages);
  }
  return paginas;
}

async function enviar(url: string, blob: Blob) {
  const corpo = new FormData();
  corpo.append("cacheControl", "3600");
  corpo.append("", blob, "pagina.jpg");
  const r = await fetch(url, { method: "PUT", body: corpo, headers: { "x-upsert": "true" } });
  if (!r.ok) throw new Error("Falha ao enviar página.");
}

export function ImportarProva({ escopos }: { escopos: Escopo[] }) {
  const router = useRouter();
  const [escopo, setEscopo] = useState<Escopo>(escopos[0]);
  const [banca, setBanca] = useState("ENEM");
  const [outra, setOutra] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [caderno, setCaderno] = useState("");
  const [prova, setProva] = useState<File | null>(null);
  const [gabarito, setGabarito] = useState<File | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function importar(e: React.FormEvent) {
    e.preventDefault();
    if (!prova) return;
    setErro(null);
    try {
      setProgresso("Lendo o PDF…");
      const paginasProva = await renderizarPdf(prova, (f, t) => setProgresso(`Preparando prova: página ${f} de ${t}`));
      const paginasGab = gabarito ? await renderizarPdf(gabarito, (f, t) => setProgresso(`Preparando gabarito: página ${f} de ${t}`)) : [];
      const custo = (paginasProva.length * (9000 * 2 + 3000 * 10)) / 1_000_000;
      if (!window.confirm(`São ${paginasProva.length} páginas. Custo estimado da leitura: ≈ US$ ${custo.toFixed(2)}. Continuar?`)) { setProgresso(null); return; }
      const id = await criarImportacao({ escopo, banca: banca === "Outra" ? outra : banca, ano: ano ? Number(ano) : null, caderno });
      const todas = [...paginasProva.map((p, i) => ({ ...p, tipo: "prova" as const, numero: i + 1 })), ...paginasGab.map((p, i) => ({ ...p, tipo: "gabarito" as const, numero: i + 1 }))];
      for (const [i, p] of todas.entries()) {
        setProgresso(`Enviando páginas: ${i + 1} de ${todas.length}`);
        const { signedUrl } = await prepararEnvioPagina(id, p.tipo, p.numero);
        await enviar(signedUrl, p.blob);
        await registrarPagina(id, p.tipo, p.numero, p.largura, p.altura);
      }
      setProgresso("Mandando para a IA…");
      await iniciarLeitura(id);
      router.push(`/banco/importacoes/${id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível importar.");
      setProgresso(null);
    }
  }

  const ocupado = progresso !== null;
  return (
    <form onSubmit={importar} className={`${estilos.card} flex max-w-2xl flex-col gap-3 p-5`}>
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {escopos.length > 1 && (
        <label className="flex flex-col gap-1 text-xs text-muted">Banco
          <select value={escopo} onChange={(e) => setEscopo(e.target.value as Escopo)} className={estilos.input}>
            <option value="geral">Banco geral (todas as escolas)</option>
            <option value="escola">Questões da minha escola</option>
          </select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted">Banca
          <select value={banca} onChange={(e) => setBanca(e.target.value)} className={estilos.input}>
            {[...BANCAS, "Outra"].map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Ano<input value={ano} onChange={(e) => setAno(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Caderno (opcional)<input value={caderno} onChange={(e) => setCaderno(e.target.value)} placeholder="1º dia" className={estilos.input} /></label>
      </div>
      {banca === "Outra" && <label className="flex flex-col gap-1 text-xs text-muted">Nome da banca<input value={outra} onChange={(e) => setOutra(e.target.value)} required className={estilos.input} /></label>}
      <label className="flex flex-col gap-1 text-xs text-muted">PDF da prova<input type="file" accept="application/pdf" required onChange={(e) => setProva(e.target.files?.[0] ?? null)} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">PDF do gabarito (opcional)<input type="file" accept="application/pdf" onChange={(e) => setGabarito(e.target.files?.[0] ?? null)} /></label>
      {progresso && <p role="status" className="text-sm text-muted">{progresso}</p>}
      <button type="submit" disabled={ocupado || !prova} className={estilos.botaoPrimario}>{ocupado ? "Importando…" : "Enviar"}</button>
    </form>
  );
}
```

- [ ] **Step 2: `src/app/banco/importar/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { podeImportar } from "@/lib/questoes/acesso";
import { supabase } from "@/lib/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { ImportarProva } from "@/components/questoes/ImportarProva";
import { estilos } from "@/components/ui/estilos";
import type { Escopo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const escopos = (["geral", "escola"] as Escopo[]).filter((e) => podeImportar(professor, e));
  if (escopos.length === 0) redirect("/banco");
  let consulta = supabase.from("importacoes").select("*").order("created_at", { ascending: false }).limit(20);
  if (professor.role !== "dono") consulta = consulta.eq("escola_id", professor.escola_id);
  const { data: recentes } = await consulta;

  return (
    <PageLayout crumb="Banco de questões" titulo="Importar prova" subtitulo="A IA lê o PDF em segundo plano; depois você revisa." largura="max-w-4xl">
      <ImportarProva escopos={escopos} />
      {(recentes ?? []).length > 0 && (
        <section className={`${estilos.card} p-4`} aria-labelledby="t-recentes">
          <h2 id="t-recentes" className="mb-2 font-semibold text-ink">Importações recentes</h2>
          <ul className="divide-y divide-line text-sm">
            {(recentes ?? []).map((i) => (
              <li key={i.id}><Link href={`/banco/importacoes/${i.id}`} className="flex justify-between gap-2 py-2 hover:text-brand">
                <span>{i.banca} {i.ano ?? ""} {i.caderno}</span>
                <span className="text-muted">{{ enviando: "Enviando", lendo: "Lendo", revisao: "Em revisão", concluida: "Concluída", erro: "Erro" }[i.status]}</span>
              </Link></li>
            ))}
          </ul>
        </section>
      )}
    </PageLayout>
  );
}
```

- [ ] **Step 3: `src/components/questoes/AcompanharImportacao.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { aprovarTodasSemAviso, atualizarImportacao, lerDeNovo, type SituacaoImportacao } from "@/actions/importacoes";
import { estilos } from "@/components/ui/estilos";

export function AcompanharImportacao({ importacaoId, inicial }: { importacaoId: string; inicial: SituacaoImportacao }) {
  const [s, setS] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const atualizar = useCallback(async () => {
    try { setS(await atualizarImportacao(importacaoId)); } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao atualizar."); }
  }, [importacaoId]);

  useEffect(() => {
    if (s.status !== "lendo") return;
    const t = setInterval(() => void atualizar(), 20_000);
    return () => clearInterval(t);
  }, [s.status, atualizar]);

  const pct = s.total ? Math.round((100 * s.lidas) / s.total) : 0;
  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">{aviso}</p>}
      <section className={`${estilos.card} flex flex-col gap-2 p-4`}>
        {s.status === "lendo" ? (
          <>
            <p className="font-semibold text-ink">Lendo prova… {s.lidas} de {s.total} páginas</p>
            <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Leitura da prova" className="h-2 overflow-hidden rounded bg-surface-sunken"><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>
            <p className="text-xs text-muted">Pode fechar esta página; a leitura continua. Ela se atualiza sozinha a cada 20 segundos.</p>
            <button type="button" onClick={() => void atualizar()} className={`${estilos.botaoFantasma} w-fit`}>Atualizar agora</button>
          </>
        ) : (
          <p className="font-semibold text-ink">{s.questoes} questões lidas · {s.status === "concluida" ? "Concluída" : s.status === "revisao" ? "Pronta para revisão" : s.status}</p>
        )}
        <p className="text-xs text-muted">Custo estimado: {s.custoEstimado != null ? `US$ ${Number(s.custoEstimado).toFixed(2)}` : "—"} · Custo real: {s.custoReal != null ? `US$ ${Number(s.custoReal).toFixed(2)}` : "—"}</p>
      </section>
      {s.erros.length > 0 && (
        <section className={`${estilos.card} p-4`}>
          <h2 className="mb-2 font-semibold text-danger">Páginas com erro</h2>
          <ul className="text-sm">{s.erros.map((e) => <li key={e.pagina}>Página {e.pagina}: {e.erro}</li>)}</ul>
          <button type="button" disabled={s.status === "lendo"} onClick={async () => { try { await lerDeNovo(importacaoId); await atualizar(); } catch (e) { setErro(e instanceof Error ? e.message : "Falha."); } }} className={`${estilos.botaoSecundario} mt-2`}>Ler de novo</button>
        </section>
      )}
      {s.avisos.length > 0 && (
        <details className={`${estilos.card} p-4 text-sm`}><summary className="cursor-pointer font-semibold text-ink">Avisos ({s.avisos.length})</summary><ul className="mt-2 list-disc pl-5 text-muted">{s.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></details>
      )}
      {(s.status === "revisao" || s.status === "concluida") && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/banco/importacoes/${importacaoId}/revisar`} className={estilos.botaoPrimario}>Revisar</Link>
          <button type="button" onClick={async () => { try { const n = await aprovarTodasSemAviso(importacaoId); setAviso(`${n} questão(ões) publicada(s).`); await atualizar(); } catch (e) { setErro(e instanceof Error ? e.message : "Falha."); } }} className={estilos.botaoSecundario}>Aprovar todas sem aviso</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `src/app/banco/importacoes/[id]/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { atualizarImportacao } from "@/actions/importacoes";
import { PageLayout } from "@/components/layout/PageLayout";
import { AcompanharImportacao } from "@/components/questoes/AcompanharImportacao";

export const dynamic = "force-dynamic";

export default async function ImportacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getProfessorAtual())) redirect("/login");
  let inicial;
  try { inicial = await atualizarImportacao(id); } catch { notFound(); }
  return (
    <PageLayout crumb="Banco de questões" titulo="Importação" largura="max-w-4xl">
      <AcompanharImportacao importacaoId={id} inicial={inicial} />
    </PageLayout>
  );
}
```

- [ ] **Step 5: Verificar** — `npx tsc --noEmit && npm run lint && npm run build` → OK (o build não pode puxar `@anthropic-ai/sdk` para o cliente).

- [ ] **Step 6: Commit** — `git add src/components/questoes src/app/banco && git commit -m "Banco de questoes: telas de importacao e acompanhamento"`

---

### Task 9: Editor de questão, texto e imagens

**Files:**
- Create: `src/components/questoes/TextoQuestao.tsx`, `src/components/questoes/ImagemQuestao.tsx`, `src/components/questoes/EditorQuestao.tsx`

**Interfaces:**
- Consumes: `markdownParaBlocos` (Task 2); `estiloRecorte`, `type Quadro` (Task 2); `MATERIAS`, `LETRAS` (Task 2); actions de questões (Task 6).
- Produces:
  - `<TextoQuestao texto={string} />`
  - `type ImagemTela = { id: string; alvo: AlvoImagem; tipo: "recorte" | "arquivo"; url: string; quadro: Quadro | null; largura: number | null; altura: number | null }`
  - `<ImagemQuestao imagem={ImagemTela} />`
  - `<EditorQuestao questao={Questao | null} imagens={ImagemTela[]} assuntos={Assunto[]} podeEscolherGeral={boolean} aoSalvar?: (id: string) => void; modoRevisao?: boolean; proximaHref?: string | null />` — sem `questao` cria (`criarQuestao`); com `questao` salva (`salvarQuestao`); "Publicar"/"Voltar para revisão"; em `modoRevisao`, "Aprovar e próxima" (salva + publica + vai para `proximaHref`) e "Excluir".

- [ ] **Step 1: `TextoQuestao.tsx`**

```tsx
import { markdownParaBlocos } from "@/lib/questoes/markdown";

/** Markdown mínimo, sem HTML: tudo vira texto escapado pelo React. */
export function TextoQuestao({ texto }: { texto: string }) {
  const blocos = markdownParaBlocos(texto);
  return (
    <div className="flex flex-col gap-1 whitespace-pre-wrap text-sm text-ink">
      {blocos.map((segs, i) => (
        <p key={i} className="min-h-[1em]">
          {segs.map((s, j) => (s.negrito ? <strong key={j}>{s.texto}</strong> : s.italico ? <em key={j}>{s.texto}</em> : <span key={j}>{s.texto}</span>))}
        </p>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `ImagemQuestao.tsx`**

```tsx
import { estiloRecorte, type Quadro } from "@/lib/questoes/quadro";
import type { AlvoImagem } from "@/lib/types";

export type ImagemTela = { id: string; alvo: AlvoImagem; tipo: "recorte" | "arquivo"; url: string; quadro: Quadro | null; largura: number | null; altura: number | null };

export function ImagemQuestao({ imagem }: { imagem: ImagemTela }) {
  if (imagem.tipo === "arquivo" || !imagem.quadro || !imagem.largura || !imagem.altura) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imagem.url} alt="Figura da questão" className="max-h-96 max-w-full rounded border border-line" />;
  }
  const e = estiloRecorte(imagem.quadro, imagem.largura, imagem.altura);
  return (
    <div role="img" aria-label="Figura da questão" className="w-full max-w-xl rounded border border-line bg-no-repeat"
      style={{ backgroundImage: `url(${JSON.stringify(imagem.url)})`, backgroundSize: e.backgroundSize, backgroundPosition: e.backgroundPosition, aspectRatio: e.aspectRatio }} />
  );
}
```

- [ ] **Step 3: `EditorQuestao.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { criarQuestao, excluirQuestao, prepararEnvioImagem, publicarQuestao, registrarImagem, removerImagem, salvarQuestao, type DadosQuestao } from "@/actions/questoes";
import { LETRAS, MATERIAS } from "@/lib/questoes/materias";
import type { AlvoImagem, Assunto, Letra, Questao } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";
import { ImagemQuestao, type ImagemTela } from "./ImagemQuestao";
import { TextoQuestao } from "./TextoQuestao";

type Props = {
  questao: Questao | null;
  imagens: ImagemTela[];
  assuntos: Assunto[];
  podeEscolherGeral: boolean;
  modoRevisao?: boolean;
  proximaHref?: string | null;
};

async function enviarImagem(url: string, arquivo: File) {
  const corpo = new FormData();
  corpo.append("cacheControl", "3600");
  corpo.append("", arquivo, arquivo.name);
  const r = await fetch(url, { method: "PUT", body: corpo, headers: { "x-upsert": "false" } });
  if (!r.ok) throw new Error("Falha ao enviar imagem.");
}

export function EditorQuestao({ questao, imagens, assuntos, podeEscolherGeral, modoRevisao = false, proximaHref = null }: Props) {
  const router = useRouter();
  const [d, setD] = useState<DadosQuestao>(() => ({
    banca: questao?.banca ?? "Própria",
    ano: questao?.ano ?? new Date().getFullYear(),
    caderno: questao?.caderno ?? "",
    numero: questao?.numero ?? null,
    materia: questao?.materia ?? "portugues",
    assunto_id: questao?.assunto_id ?? null,
    enunciado: questao?.enunciado ?? "",
    comando: questao?.comando ?? "",
    alternativas: LETRAS.map((letra) => ({ letra, texto: questao?.alternativas.find((a) => a.letra === letra)?.texto ?? "" })),
    resposta: questao?.resposta ?? null,
    anulada: questao?.anulada ?? false,
    escopo: questao?.escopo ?? "escola",
  }));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [previa, setPrevia] = useState(false);

  const assuntosMateria = assuntos.filter((a) => a.materia === d.materia);
  const set = <K extends keyof DadosQuestao>(k: K, v: DadosQuestao[K]) => setD((x) => ({ ...x, [k]: v }));

  async function executar(acao: () => Promise<void>, msg?: string) {
    setOcupado(true); setErro(null); setAviso(null);
    try { await acao(); if (msg) setAviso(msg); router.refresh(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setOcupado(false); }
  }

  async function salvar(): Promise<string> {
    if (questao) { await salvarQuestao(questao.id, d); return questao.id; }
    const id = await criarQuestao(d);
    router.push(`/banco/questoes/${id}`);
    return id;
  }

  async function enviarPara(alvo: AlvoImagem, arquivo: File, substituirId: string | null) {
    if (!questao) throw new Error("Salve a questão antes de adicionar imagens.");
    const { signedUrl, storagePath } = await prepararEnvioImagem(questao.id, arquivo.name, arquivo.size, arquivo.type);
    await enviarImagem(signedUrl, arquivo);
    await registrarImagem(questao.id, alvo, storagePath, substituirId);
  }

  function blocoImagens(alvo: AlvoImagem) {
    const lista = imagens.filter((i) => i.alvo === alvo);
    const idInput = `img-${alvo}`;
    return (
      <div className="flex flex-col gap-2">
        {lista.map((img) => (
          <div key={img.id} className="flex flex-col gap-1">
            <ImagemQuestao imagem={img} />
            <div className="flex gap-2">
              <label className={`${estilos.botaoFantasma} cursor-pointer px-2 text-xs`}><Upload size={13} aria-hidden="true" /> Trocar imagem
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void executar(() => enviarPara(alvo, f, img.id)); }} />
              </label>
              <button type="button" onClick={() => void executar(() => removerImagem(img.id))} className={`${estilos.botaoFantasma} px-2 text-xs`}><Trash2 size={13} aria-hidden="true" /> Remover</button>
            </div>
          </div>
        ))}
        {questao && (
          <label htmlFor={idInput} className={`${estilos.botaoFantasma} w-fit cursor-pointer px-2 text-xs`}><ImagePlus size={13} aria-hidden="true" /> {lista.length ? "+ Imagem" : "Adicionar imagem"}
            <input id={idInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void executar(() => enviarPara(alvo, f, null)); }} />
          </label>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">{aviso}</p>}
      {questao?.precisa_revisao && questao.motivo_revisao && <p className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">⚠ {questao.motivo_revisao}</p>}

      <div className="grid gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted">Banca<input value={d.banca} onChange={(e) => set("banca", e.target.value)} className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Ano<input value={d.ano ?? ""} onChange={(e) => set("ano", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} inputMode="numeric" className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Caderno<input value={d.caderno} onChange={(e) => set("caderno", e.target.value)} className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Nº<input value={d.numero ?? ""} onChange={(e) => set("numero", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} inputMode="numeric" className={estilos.input} /></label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">Matéria
          <select value={d.materia} onChange={(e) => { set("materia", e.target.value); set("assunto_id", null); }} className={estilos.input}>
            {Object.entries(MATERIAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Assunto
          <select value={d.assunto_id ?? ""} onChange={(e) => set("assunto_id", e.target.value || null)} className={estilos.input}>
            <option value="">— sem assunto —</option>
            {assuntosMateria.map((a) => <option key={a.id} value={a.id}>{a.nome}{a.situacao === "proposto" ? " (proposto)" : ""}</option>)}
          </select>
        </label>
      </div>
      {podeEscolherGeral && !questao && (
        <label className="flex flex-col gap-1 text-xs text-muted">Banco
          <select value={d.escopo} onChange={(e) => set("escopo", e.target.value as "geral" | "escola")} className={estilos.input}>
            <option value="escola">Questões da minha escola</option>
            <option value="geral">Banco geral</option>
          </select>
        </label>
      )}

      <div className="flex items-center justify-between"><span className={estilos.rotulo}>Enunciado</span><button type="button" onClick={() => setPrevia(!previa)} className={`${estilos.botaoFantasma} px-2 text-xs`}>{previa ? "Editar texto" : "Ver como fica"}</button></div>
      {previa ? <TextoQuestao texto={d.enunciado} /> : <textarea value={d.enunciado} onChange={(e) => set("enunciado", e.target.value)} rows={8} className={estilos.input} aria-label="Enunciado" />}
      <p className="text-xs text-muted">Use **negrito** e *itálico*. Quebre linhas normalmente.</p>
      {blocoImagens("enunciado")}
      <label className="flex flex-col gap-1 text-xs text-muted">Comando<input value={d.comando} onChange={(e) => set("comando", e.target.value)} className={estilos.input} /></label>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${estilos.rotulo} mb-1`}>Alternativas e resposta</legend>
        {LETRAS.map((letra) => (
          <div key={letra} className="flex flex-col gap-1 rounded-control border border-line p-2">
            <div className="flex items-start gap-2">
              <label className="flex items-center gap-1 pt-2 text-sm font-semibold text-ink"><input type="radio" name="resposta" checked={d.resposta === letra} onChange={() => set("resposta", letra as Letra)} aria-label={`Resposta ${letra}`} /> {letra})</label>
              <textarea value={d.alternativas.find((a) => a.letra === letra)!.texto} onChange={(e) => set("alternativas", d.alternativas.map((a) => (a.letra === letra ? { ...a, texto: e.target.value } : a)))} rows={2} className={estilos.input} aria-label={`Alternativa ${letra}`} />
            </div>
            {blocoImagens(letra)}
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={d.anulada} onChange={(e) => set("anulada", e.target.checked)} /> Questão anulada</label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado} onClick={() => void executar(async () => { await salvar(); }, "Salvo.")} className={estilos.botaoSecundario}>{questao ? "Salvar" : "Criar questão"}</button>
        {questao && (questao.status === "publicada"
          ? <button type="button" disabled={ocupado} onClick={() => void executar(() => publicarQuestao(questao.id, false), "Voltou para revisão.")} className={estilos.botaoFantasma}>Voltar para revisão</button>
          : <button type="button" disabled={ocupado} onClick={() => void executar(async () => { await salvar(); await publicarQuestao(questao.id, true); if (modoRevisao && proximaHref) router.push(proximaHref); }, "Publicada.")} className={estilos.botaoPrimario}>{modoRevisao ? "Aprovar e próxima" : "Publicar"}</button>)}
        {questao && <button type="button" disabled={ocupado} onClick={() => { if (window.confirm("Excluir esta questão?")) void executar(async () => { await excluirQuestao(questao.id); router.push(proximaHref ?? "/banco"); }); }} className={`${estilos.botaoFantasma} text-danger`}>Excluir</button>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar** — `npx tsc --noEmit && npm run lint` → OK.

- [ ] **Step 5: Commit** — `git add src/components/questoes && git commit -m "Banco de questoes: editor de questao com texto seguro e imagens"`

---

### Task 10: Revisão com a página e quadros arrastáveis

**Files:**
- Create: `src/components/questoes/PaginaComQuadros.tsx`, `src/app/banco/importacoes/[id]/revisar/page.tsx`
- Create: `src/lib/questoes/consultas.ts` (server, sem "use server")

**Interfaces:**
- Consumes: `exigirImportacao` (Task 4); `linksExibicao` (Task 6); `atualizarRecorte` (Task 6); `EditorQuestao`, `ImagemTela` (Task 9); `listarAssuntos` (Task 6).
- Produces:
  - `consultas.ts`: `imagensParaTela(questaoIds: string[]): Promise<Map<string, ImagemTela[]>>` (resolve recortes com a imagem/tamanho da página e arquivos com link assinado)
  - `<PaginaComQuadros url largura altura quadros={{ id: string; alvo: string; quadro: Quadro }[]} />` — arrastar move, arrastar o canto inferior direito redimensiona; ao soltar, chama `atualizarRecorte` e `router.refresh()`.

- [ ] **Step 1: `src/lib/questoes/consultas.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import { linksExibicao } from "@/lib/questoes/storage";
import type { ImagemTela } from "@/components/questoes/ImagemQuestao";

export async function imagensParaTela(questaoIds: string[]): Promise<Map<string, ImagemTela[]>> {
  const mapa = new Map<string, ImagemTela[]>();
  if (questaoIds.length === 0) return mapa;
  const { data: imagens } = await supabase.from("questao_imagens").select("*").in("questao_id", questaoIds).order("ordem");
  const paginaIds = [...new Set((imagens ?? []).map((i) => i.pagina_id).filter((p): p is string => !!p))];
  const { data: paginas } = paginaIds.length ? await supabase.from("importacao_paginas").select("*").in("id", paginaIds) : { data: [] };
  const paginaPorId = new Map((paginas ?? []).map((p) => [p.id, p]));
  const caminhos = [
    ...(imagens ?? []).filter((i) => i.tipo === "arquivo" && i.storage_path).map((i) => i.storage_path as string),
    ...(paginas ?? []).map((p) => p.storage_path),
  ];
  const links = await linksExibicao(caminhos);
  for (const i of imagens ?? []) {
    const pagina = i.pagina_id ? paginaPorId.get(i.pagina_id) : undefined;
    const url = i.tipo === "arquivo" ? links.get(i.storage_path ?? "") : pagina ? links.get(pagina.storage_path) : undefined;
    if (!url) continue;
    const tela: ImagemTela = {
      id: i.id, alvo: i.alvo, tipo: i.tipo, url,
      quadro: i.tipo === "recorte" ? { x: Number(i.x), y: Number(i.y), w: Number(i.w), h: Number(i.h) } : null,
      largura: pagina?.largura ?? null, altura: pagina?.altura ?? null,
    };
    mapa.set(i.questao_id, [...(mapa.get(i.questao_id) ?? []), tela]);
  }
  return mapa;
}
```

- [ ] **Step 2: `src/components/questoes/PaginaComQuadros.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { atualizarRecorte } from "@/actions/questoes";
import { limitarQuadro, type Quadro } from "@/lib/questoes/quadro";

type Item = { id: string; alvo: string; quadro: Quadro };

export function PaginaComQuadros({ url, largura, altura, quadros }: { url: string; largura: number; altura: number; quadros: Item[] }) {
  const router = useRouter();
  const area = useRef<HTMLDivElement>(null);
  const [itens, setItens] = useState(quadros);
  const [erro, setErro] = useState<string | null>(null);
  const arraste = useRef<{ id: string; modo: "mover" | "redimensionar"; x0: number; y0: number; q0: Quadro } | null>(null);

  function fracao(e: React.PointerEvent) {
    const r = area.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  function iniciar(e: React.PointerEvent, item: Item, modo: "mover" | "redimensionar") {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = fracao(e);
    arraste.current = { id: item.id, modo, x0: p.x, y0: p.y, q0: item.quadro };
  }

  function mover(e: React.PointerEvent) {
    const a = arraste.current;
    if (!a) return;
    const p = fracao(e);
    const dx = p.x - a.x0, dy = p.y - a.y0;
    const q = a.modo === "mover" ? { ...a.q0, x: a.q0.x + dx, y: a.q0.y + dy } : { ...a.q0, w: a.q0.w + dx, h: a.q0.h + dy };
    setItens((lista) => lista.map((i) => (i.id === a.id ? { ...i, quadro: limitarQuadro(q) } : i)));
  }

  async function soltar() {
    const a = arraste.current;
    arraste.current = null;
    if (!a) return;
    const item = itens.find((i) => i.id === a.id);
    if (!item) return;
    try { await atualizarRecorte(item.id, item.quadro); router.refresh(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar o recorte."); }
  }

  return (
    <div className="flex flex-col gap-2">
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
      <div ref={area} onPointerMove={mover} onPointerUp={() => void soltar()} className="relative w-full select-none overflow-hidden rounded border border-line" style={{ aspectRatio: `${largura} / ${altura}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Página original da prova" className="absolute inset-0 h-full w-full" draggable={false} />
        {itens.map((i) => (
          <div key={i.id} onPointerDown={(e) => iniciar(e, i, "mover")} className="absolute cursor-move border-2 border-brand bg-brand/10"
            style={{ left: `${i.quadro.x * 100}%`, top: `${i.quadro.y * 100}%`, width: `${i.quadro.w * 100}%`, height: `${i.quadro.h * 100}%` }}
            aria-label={`Recorte da figura (${i.alvo})`}>
            <span className="absolute left-0 top-0 bg-brand px-1 text-[10px] font-bold text-white">{i.alvo}</span>
            <span onPointerDown={(e) => iniciar(e, i, "redimensionar")} className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-brand" aria-hidden="true" />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Arraste o quadro para mover; puxe o canto azul para ajustar o tamanho.</p>
    </div>
  );
}
```

- [ ] **Step 3: `src/app/banco/importacoes/[id]/revisar/page.tsx`**

Mostra a lista da importação e a questão escolhida (`?q=<id>`, padrão: primeira com aviso, senão a primeira em revisão), em duas colunas.

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeImportar } from "@/lib/questoes/acesso";
import { imagensParaTela } from "@/lib/questoes/consultas";
import { linkExibicao } from "@/lib/questoes/storage";
import { PageLayout } from "@/components/layout/PageLayout";
import { EditorQuestao } from "@/components/questoes/EditorQuestao";
import { PaginaComQuadros } from "@/components/questoes/PaginaComQuadros";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; filtro?: string }> };

export default async function RevisarPage({ params, searchParams }: Props) {
  const [{ id }, { q, filtro }] = await Promise.all([params, searchParams]);
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: imp } = await supabase.from("importacoes").select("*").eq("id", id).maybeSingle();
  if (!imp || !podeImportar(professor, imp.escopo) || (imp.escopo === "escola" && imp.escola_id !== professor.escola_id && professor.role !== "dono")) notFound();

  const { data: todas } = await supabase.from("questoes").select("*").eq("importacao_id", id).order("numero");
  const lista = (todas ?? []).filter((x) =>
    filtro === "aviso" ? x.precisa_revisao : filtro === "sem-resposta" ? !x.resposta && !x.anulada : filtro === "aprovadas" ? x.status === "publicada" : true);
  const ordenada = [...lista].sort((a, b) => Number(b.precisa_revisao) - Number(a.precisa_revisao) || (a.numero ?? 0) - (b.numero ?? 0));
  const atual = ordenada.find((x) => x.id === q) ?? ordenada.find((x) => x.status === "revisao") ?? ordenada[0];
  const proxima = atual ? ordenada.slice(ordenada.indexOf(atual) + 1).find((x) => x.status === "revisao") : undefined;

  const [imagens, { data: assuntos }, pagina] = await Promise.all([
    imagensParaTela(atual ? [atual.id] : []),
    supabase.from("assuntos").select("*").order("nome"),
    atual?.pagina_id ? supabase.from("importacao_paginas").select("*").eq("id", atual.pagina_id).single().then((r) => r.data) : Promise.resolve(null),
  ]);
  const urlPagina = pagina ? await linkExibicao(pagina.storage_path) : null;
  const imgsAtual = atual ? imagens.get(atual.id) ?? [] : [];
  const base = `/banco/importacoes/${id}/revisar`;
  const filtros = [["", "Todas"], ["aviso", "Precisa de revisão"], ["sem-resposta", "Sem resposta"], ["aprovadas", "Aprovadas"]] as const;

  return (
    <PageLayout crumb={`Revisão · ${imp.banca} ${imp.ano ?? ""} ${imp.caderno}`} titulo="Revisar questões" acoes={<Link href={`/banco/importacoes/${id}`} className={estilos.botaoSecundario}>← Importação</Link>} largura="max-w-7xl">
      <nav aria-label="Filtros" className="flex flex-wrap gap-2">
        {filtros.map(([v, rotulo]) => <Link key={v} href={v ? `${base}?filtro=${v}` : base} className={(filtro ?? "") === v ? estilos.botaoPrimario : estilos.botaoSecundario}>{rotulo}</Link>)}
      </nav>
      <div className="grid gap-4 lg:grid-cols-[14rem_1fr_1fr]">
        <ol className={`${estilos.card} max-h-[75vh] overflow-y-auto p-2 text-sm`}>
          {ordenada.map((x) => (
            <li key={x.id}><Link href={`${base}?q=${x.id}${filtro ? `&filtro=${filtro}` : ""}`} aria-current={x.id === atual?.id ? "page" : undefined}
              className={`flex justify-between gap-2 rounded px-2 py-1 ${x.id === atual?.id ? "bg-brand/10 font-semibold" : "hover:bg-surface-sunken"}`}>
              <span>Nº {x.numero ?? "—"}</span>
              <span className="text-xs">{x.status === "publicada" ? "✓" : x.precisa_revisao ? "⚠" : ""}</span>
            </Link></li>
          ))}
          {ordenada.length === 0 && <li className="p-2 text-muted">Nada neste filtro.</li>}
        </ol>
        <section aria-label="Página original" className={`${estilos.card} p-3`}>
          {pagina && urlPagina
            ? <PaginaComQuadros key={atual!.id} url={urlPagina} largura={pagina.largura} altura={pagina.altura} quadros={imgsAtual.filter((i) => i.tipo === "recorte" && i.quadro).map((i) => ({ id: i.id, alvo: i.alvo, quadro: i.quadro! }))} />
            : <p className="text-sm text-muted">Sem página original.</p>}
        </section>
        <section aria-label="Questão copiada" className={`${estilos.card} p-3`}>
          {atual
            ? <EditorQuestao key={atual.id} questao={atual} imagens={imgsAtual} assuntos={assuntos ?? []} podeEscolherGeral={false} modoRevisao proximaHref={proxima ? `${base}?q=${proxima.id}${filtro ? `&filtro=${filtro}` : ""}` : `/banco/importacoes/${id}`} />
            : <p className="text-sm text-muted">Nenhuma questão.</p>}
        </section>
      </div>
    </PageLayout>
  );
}
```

Quando a última questão em revisão é publicada, a importação deve virar `concluida`: em `publicarQuestao` (Task 6 — ajuste aqui), depois de publicar, se a questão tem `importacao_id` e não restam questões `revisao` nela, atualize `importacoes.status = 'concluida'`.

- [ ] **Step 4: Verificar** — `npx tsc --noEmit && npm run lint && npm run build` → OK.

- [ ] **Step 5: Commit** — `git add src/lib/questoes/consultas.ts src/components/questoes src/app/banco src/actions/questoes.ts && git commit -m "Banco de questoes: revisao com pagina original e recorte arrastavel"`

---

### Task 11: Banco, nova questão, editar e assuntos

**Files:**
- Create: `src/app/banco/page.tsx`, `src/app/banco/nova/page.tsx`, `src/app/banco/questoes/[id]/page.tsx`, `src/app/banco/assuntos/page.tsx`, `src/components/questoes/GerenciarAssuntos.tsx`

**Interfaces:**
- Consumes: `podeVerQuestao`, `podeEditarQuestao`, `podeImportar` (Task 4); `imagensParaTela` (Task 10); `EditorQuestao`, `TextoQuestao`, `ImagemQuestao` (Task 9); `promoverQuestao` (Task 6); `aprovarAssunto`, `juntarAssunto`, `carregarAssuntosIniciais` (Task 6); `MATERIAS`, `AREAS` (Task 2).

- [ ] **Step 1: `src/app/banco/page.tsx`** — lista com filtros por `searchParams` (`texto`, `banca`, `ano`, `area`, `materia`, `assunto`, `escopo`, `status`), 50 por página (`pagina`).

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2, Upload, Tags, Database } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeImportar } from "@/lib/questoes/acesso";
import { AREAS, MATERIAS } from "@/lib/questoes/materias";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";
const POR_PAGINA = 50;

type Filtros = { texto?: string; banca?: string; ano?: string; area?: string; materia?: string; escopo?: string; status?: string; pagina?: string };

export default async function BancoPage({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const pagina = Math.max(1, Number(f.pagina) || 1);

  let c = supabase.from("questoes").select("id, banca, ano, caderno, numero, area, materia, enunciado, status, escopo, precisa_revisao, criado_por, escola_id", { count: "exact" });
  // Visibilidade: dono vê tudo; outros veem geral publicadas + da escola (publicadas, ou todas se admin, ou as próprias).
  if (professor.role !== "dono") {
    const daEscola = professor.role === "admin" ? `and(escopo.eq.escola,escola_id.eq.${professor.escola_id})` : `and(escopo.eq.escola,escola_id.eq.${professor.escola_id},or(status.eq.publicada,criado_por.eq.${professor.id}))`;
    c = c.or(`and(escopo.eq.geral,status.eq.publicada),${daEscola}`);
  }
  if (f.texto) c = c.ilike("enunciado", `%${f.texto.replace(/[%_,()]/g, " ")}%`);
  if (f.banca) c = c.eq("banca", f.banca);
  if (f.ano && Number(f.ano)) c = c.eq("ano", Number(f.ano));
  if (f.area) c = c.eq("area", f.area);
  if (f.materia) c = c.eq("materia", f.materia);
  if (f.escopo === "geral" || f.escopo === "escola") c = c.eq("escopo", f.escopo);
  if (f.status === "publicada" || f.status === "revisao") c = c.eq("status", f.status);
  const { data: questoes, count } = await c.order("ano", { ascending: false }).order("numero").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);

  const query = (extra: Partial<Filtros>) => `/banco?${new URLSearchParams(Object.entries({ ...f, ...extra }).filter(([, v]) => v) as [string, string][]).toString()}`;
  const total = count ?? 0;

  return (
    <PageLayout crumb="Banco de questões" titulo="Questões" subtitulo={`${total} questão(ões)`} largura="max-w-7xl"
      acoes={<>
        <Link href="/banco/nova" className={estilos.botaoPrimario}><FilePlus2 size={16} aria-hidden="true" /> Nova questão</Link>
        {(podeImportar(professor, "geral") || podeImportar(professor, "escola")) && <Link href="/banco/importar" className={estilos.botaoSecundario}><Upload size={16} aria-hidden="true" /> Importar prova</Link>}
        {professor.role === "dono" && <Link href="/banco/importar-enem" className={estilos.botaoSecundario}><Database size={16} aria-hidden="true" /> Importar ENEM</Link>}
        {professor.role === "dono" && <Link href="/banco/assuntos" className={estilos.botaoSecundario}><Tags size={16} aria-hidden="true" /> Assuntos</Link>}
      </>}>
      <form className={`${estilos.card} grid gap-2 p-3 sm:grid-cols-4 lg:grid-cols-8`} action="/banco">
        <input name="texto" defaultValue={f.texto} placeholder="Buscar no enunciado" aria-label="Buscar" className={`${estilos.input} sm:col-span-2`} />
        <input name="banca" defaultValue={f.banca} placeholder="Banca" aria-label="Banca" className={estilos.input} />
        <input name="ano" defaultValue={f.ano} placeholder="Ano" aria-label="Ano" inputMode="numeric" className={estilos.input} />
        <select name="area" defaultValue={f.area ?? ""} aria-label="Área" className={estilos.input}><option value="">Área</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="materia" defaultValue={f.materia ?? ""} aria-label="Matéria" className={estilos.input}><option value="">Matéria</option>{Object.entries(MATERIAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</select>
        <select name="status" defaultValue={f.status ?? ""} aria-label="Situação" className={estilos.input}><option value="">Situação</option><option value="publicada">Publicadas</option><option value="revisao">Em revisão</option></select>
        <button type="submit" className={estilos.botaoSecundario}>Filtrar</button>
      </form>
      <ul className={`${estilos.card} divide-y divide-line`}>
        {(questoes ?? []).map((q) => (
          <li key={q.id}><Link href={`/banco/questoes/${q.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-surface-sunken">
            <span className="text-xs text-muted">{q.banca} {q.ano ?? ""} {q.caderno} · Nº {q.numero ?? "—"} · {MATERIAS[q.materia as keyof typeof MATERIAS]?.rotulo ?? q.materia} · {q.escopo === "geral" ? "Banco geral" : "Escola"}{q.status === "revisao" ? " · em revisão" : ""}{q.precisa_revisao ? " · ⚠" : ""}</span>
            <span className="line-clamp-2 text-sm text-ink">{q.enunciado.replace(/[*]/g, "") || "(sem texto)"}</span>
          </Link></li>
        ))}
        {(questoes ?? []).length === 0 && <li className="p-6 text-sm text-muted">Nenhuma questão encontrada.</li>}
      </ul>
      <nav aria-label="Páginas" className="flex justify-between">
        {pagina > 1 ? <Link href={query({ pagina: String(pagina - 1) })} className={estilos.botaoSecundario}>← Anteriores</Link> : <span />}
        {pagina * POR_PAGINA < total && <Link href={query({ pagina: String(pagina + 1) })} className={estilos.botaoSecundario}>Próximas →</Link>}
      </nav>
    </PageLayout>
  );
}
```

- [ ] **Step 2: `src/app/banco/nova/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { EditorQuestao } from "@/components/questoes/EditorQuestao";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function NovaQuestaoPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: assuntos } = await supabase.from("assuntos").select("*").order("nome");
  return (
    <PageLayout crumb="Banco de questões" titulo="Nova questão" subtitulo="Depois de criar, você pode adicionar imagens." largura="max-w-3xl">
      <section className={`${estilos.card} p-4`}><EditorQuestao questao={null} imagens={[]} assuntos={assuntos ?? []} podeEscolherGeral={professor.role === "dono"} /></section>
    </PageLayout>
  );
}
```

- [ ] **Step 3: `src/app/banco/questoes/[id]/page.tsx`** — quem pode editar vê o editor; quem só pode ver vê a questão em modo leitura (com a resposta, pois é professor); dono vê "Promover para o banco geral" em questões de escola.

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeEditarQuestao, podeVerQuestao } from "@/lib/questoes/acesso";
import { imagensParaTela } from "@/lib/questoes/consultas";
import { LETRAS } from "@/lib/questoes/materias";
import { PageLayout } from "@/components/layout/PageLayout";
import { EditorQuestao } from "@/components/questoes/EditorQuestao";
import { ImagemQuestao } from "@/components/questoes/ImagemQuestao";
import { TextoQuestao } from "@/components/questoes/TextoQuestao";
import { PromoverQuestao } from "@/components/questoes/PromoverQuestao";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function QuestaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: q } = await supabase.from("questoes").select("*").eq("id", id).maybeSingle();
  if (!q || !podeVerQuestao(professor, q)) notFound();
  const [imagens, { data: assuntos }] = await Promise.all([imagensParaTela([id]), supabase.from("assuntos").select("*").order("nome")]);
  const imgs = imagens.get(id) ?? [];
  const edita = podeEditarQuestao(professor, q);

  return (
    <PageLayout crumb="Banco de questões" titulo={`${q.banca} ${q.ano ?? ""} · Nº ${q.numero ?? "—"}`} largura="max-w-3xl"
      acoes={<>
        <Link href="/banco" className={estilos.botaoSecundario}>← Banco</Link>
        {professor.role === "dono" && q.escopo === "escola" && <PromoverQuestao questaoId={id} />}
      </>}>
      <section className={`${estilos.card} p-4`}>
        {edita ? <EditorQuestao questao={q} imagens={imgs} assuntos={assuntos ?? []} podeEscolherGeral={false} /> : (
          <div className="flex flex-col gap-3">
            <TextoQuestao texto={q.enunciado} />
            {imgs.filter((i) => i.alvo === "enunciado").map((i) => <ImagemQuestao key={i.id} imagem={i} />)}
            <p className="text-sm font-medium text-ink">{q.comando}</p>
            <ol className="flex flex-col gap-2">{LETRAS.map((l) => (
              <li key={l} className={`rounded-control border p-2 text-sm ${q.resposta === l ? "border-ok bg-ok/10" : "border-line"}`}>
                <strong>{l})</strong> {q.alternativas.find((a) => a.letra === l)?.texto}
                {imgs.filter((i) => i.alvo === l).map((i) => <ImagemQuestao key={i.id} imagem={i} />)}
              </li>
            ))}</ol>
            {q.anulada && <p className="text-sm text-danger">Questão anulada.</p>}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
```

E o botão (cliente):

```tsx
// src/components/questoes/PromoverQuestao.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { promoverQuestao } from "@/actions/questoes";
import { estilos } from "@/components/ui/estilos";

export function PromoverQuestao({ questaoId }: { questaoId: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  return (
    <button type="button" disabled={ocupado} className={estilos.botaoSecundario} onClick={async () => {
      if (!window.confirm("Copiar esta questão para o banco geral (em revisão)?")) return;
      setOcupado(true);
      try { router.push(`/banco/questoes/${await promoverQuestao(questaoId)}`); }
      catch (e) { window.alert(e instanceof Error ? e.message : "Não foi possível promover."); setOcupado(false); }
    }}>Promover para o banco geral</button>
  );
}
```

(Acrescente `src/components/questoes/PromoverQuestao.tsx` aos arquivos criados.)

- [ ] **Step 4: Assuntos — `src/components/questoes/GerenciarAssuntos.tsx` e `src/app/banco/assuntos/page.tsx`**

```tsx
// src/components/questoes/GerenciarAssuntos.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { aprovarAssunto, carregarAssuntosIniciais, juntarAssunto } from "@/actions/assuntos";
import { MATERIAS } from "@/lib/questoes/materias";
import type { Assunto } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";

export function GerenciarAssuntos({ assuntos }: { assuntos: Assunto[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [destinos, setDestinos] = useState<Record<string, string>>({});
  const propostos = assuntos.filter((a) => a.situacao === "proposto");
  const aprovados = assuntos.filter((a) => a.situacao === "aprovado");
  const rotulo = (m: string) => MATERIAS[m as keyof typeof MATERIAS]?.rotulo ?? m;

  async function executar(acao: () => Promise<unknown>, msg: string) {
    setErro(null); setAviso(null);
    try { await acao(); setAviso(msg); router.refresh(); } catch (e) { setErro(e instanceof Error ? e.message : "Falha."); }
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">{aviso}</p>}
      <section className={`${estilos.card} p-4`}>
        <h2 className="mb-2 font-semibold text-ink">Propostos pela IA ({propostos.length})</h2>
        {propostos.length === 0 && <p className="text-sm text-muted">Nenhuma proposta.</p>}
        <ul className="divide-y divide-line">
          {propostos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="mr-auto"><strong>{p.nome}</strong> <span className="text-muted">· {rotulo(p.materia)}</span></span>
              <button type="button" onClick={() => void executar(() => aprovarAssunto(p.id), `“${p.nome}” aprovado.`)} className={estilos.botaoSecundario}>Aprovar</button>
              <select value={destinos[p.id] ?? ""} onChange={(e) => setDestinos({ ...destinos, [p.id]: e.target.value })} aria-label={`Juntar ${p.nome} com`} className={`${estilos.input} max-w-56`}>
                <option value="">Juntar com…</option>
                {aprovados.filter((a) => a.materia === p.materia).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
              <button type="button" disabled={!destinos[p.id]} onClick={() => void executar(() => juntarAssunto(p.id, destinos[p.id]), "Assuntos juntados.")} className={estilos.botaoFantasma}>Juntar</button>
            </li>
          ))}
        </ul>
      </section>
      <section className={`${estilos.card} p-4`}>
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold text-ink">Aprovados ({aprovados.length})</h2>
          <button type="button" onClick={() => void executar(async () => setAviso(`${await carregarAssuntosIniciais()} assunto(s) carregado(s).`), "Lista inicial carregada.")} className={estilos.botaoSecundario}>Carregar lista inicial</button></div>
        {Object.keys(MATERIAS).map((m) => {
          const daMateria = aprovados.filter((a) => a.materia === m);
          return daMateria.length ? <p key={m} className="py-1 text-sm"><strong>{rotulo(m)}:</strong> <span className="text-muted">{daMateria.map((a) => a.nome).join(", ")}</span></p> : null;
        })}
      </section>
    </div>
  );
}
```

```tsx
// src/app/banco/assuntos/page.tsx
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { GerenciarAssuntos } from "@/components/questoes/GerenciarAssuntos";

export const dynamic = "force-dynamic";

export default async function AssuntosPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  if (professor.role !== "dono") redirect("/banco");
  const { data: assuntos } = await supabase.from("assuntos").select("*").order("materia").order("nome");
  return <PageLayout crumb="Banco de questões" titulo="Assuntos" largura="max-w-4xl"><GerenciarAssuntos assuntos={assuntos ?? []} /></PageLayout>;
}
```

- [ ] **Step 5: Verificar** — `npx tsc --noEmit && npm run lint && npm run build` → OK.

- [ ] **Step 6: Commit** — `git add src/app/banco src/components/questoes && git commit -m "Banco de questoes: lista, nova, editar, promover e assuntos"`

---

### Task 12: ENEM pelo enem.dev

**Files:**
- Create: `src/actions/enem.ts`, `src/components/questoes/ImportarEnem.tsx`, `src/app/banco/importar-enem/page.tsx`

**Interfaces:**
- Consumes: `exigirProfessor` (Task 4); `enemDevParaQuestao`, `type EnemDevQuestao` (Task 5); `clienteIA`, `pedidoClassificacao`, `custoDoUso` (Task 6); `ClassificacaoSchema`, `classificacaoParaAtualizacoes` (Task 3); `BUCKET` (Task 6).
- Produces:
  - `criarImportacaoEnem(ano: number): Promise<string>` (dono; 2009–2023; reaproveita importação existente do mesmo ano se ainda não concluída)
  - `type PassoEnem = { importacaoId: string; feitas: number; total: number; terminou: boolean; status: StatusImportacao }`
  - `avancarImportacaoEnem(importacaoId: string): Promise<PassoEnem>` — baixa 50 questões a partir de `paginas_lidas` (usado como offset), grava, copia imagens; quando acabar o ano, cria o lote de classificação (`status = 'lendo'`) e devolve `terminou: false` até a classificação acabar
  - `atualizarClassificacaoEnem(importacaoId: string): Promise<PassoEnem>` — quando o lote termina, aplica matéria/assunto; publica as sem aviso; `status = 'revisao'` (ou `concluida` se nenhuma ficou em revisão)

- [ ] **Step 1: `src/actions/enem.ts`**

```ts
"use server";

import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase/client";
import { exigirProfessor } from "@/lib/questoes/acesso";
import { enemDevParaQuestao, type EnemDevQuestao } from "@/lib/questoes/enemdev";
import { clienteIA, custoDoUso, pedidoClassificacao } from "@/lib/questoes/ia";
import { ClassificacaoSchema, classificacaoParaAtualizacoes } from "@/lib/questoes/formato-ia";
import { BUCKET } from "@/lib/questoes/storage";
import type { StatusImportacao } from "@/lib/types";

const API = "https://api.enem.dev/v1";
const LOTE_DOWNLOAD = 50;
const POR_PEDIDO = 20;

async function exigirDono() {
  const p = await exigirProfessor();
  if (p.role !== "dono") throw new Error("Só o dono importa o ENEM.");
  return p;
}

export type PassoEnem = { importacaoId: string; feitas: number; total: number; terminou: boolean; status: StatusImportacao };

export async function criarImportacaoEnem(ano: number): Promise<string> {
  const dono = await exigirDono();
  if (!Number.isInteger(ano) || ano < 2009 || ano > 2023) throw new Error("Ano fora de 2009–2023.");
  const { data: existente } = await supabase.from("importacoes").select("id, status").eq("origem", "enemdev").eq("ano", ano).neq("status", "concluida").maybeSingle();
  if (existente) return existente.id;
  const { data, error } = await supabase.from("importacoes")
    .insert({ escopo: "geral", escola_id: null, origem: "enemdev", banca: "ENEM", ano, caderno: "", status: "enviando", criado_por: dono.id })
    .select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar importação.");
  return data.id;
}

async function copiarImagem(url: string, questaoId: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") ?? "";
    const ext = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : tipo.includes("jpeg") || tipo.includes("jpg") ? "jpg" : null;
    if (!ext) return null;
    const corpo = await r.arrayBuffer();
    if (corpo.byteLength > 5242880) return null;
    const caminho = `imagens/${questaoId}/${randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(caminho, corpo, { contentType: tipo });
    return error ? null : caminho;
  } catch {
    return null;
  }
}

export async function avancarImportacaoEnem(importacaoId: string): Promise<PassoEnem> {
  await exigirDono();
  const { data: imp } = await supabase.from("importacoes").select("*").eq("id", importacaoId).single();
  if (!imp || imp.origem !== "enemdev") throw new Error("Importação não encontrada.");
  if (imp.status === "lendo") return atualizarClassificacaoEnem(importacaoId);
  if (imp.status !== "enviando") return { importacaoId, feitas: imp.paginas_lidas, total: imp.total_paginas, terminou: true, status: imp.status };

  const offset = imp.paginas_lidas;
  const r = await fetch(`${API}/exams/${imp.ano}/questions?limit=${LOTE_DOWNLOAD}&offset=${offset}`, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`O enem.dev respondeu ${r.status}. Tente de novo em instantes.`);
  const corpo = (await r.json()) as { metadata: { total: number; hasMore: boolean }; questions: EnemDevQuestao[] };

  for (const q of corpo.questions) {
    const { linha, imagens } = enemDevParaQuestao(q);
    const { data: criada, error } = await supabase.from("questoes").insert({ ...linha, importacao_id: importacaoId, criado_por: imp.criado_por }).select("id").single();
    if (error) {
      if (error.message.includes("uq_questoes")) continue; // já existe: pula
      throw new Error(error.message);
    }
    let falhou = false;
    for (const [i, img] of imagens.entries()) {
      const caminho = await copiarImagem(img.url, criada.id);
      if (!caminho) { falhou = true; continue; }
      await supabase.from("questao_imagens").insert({ questao_id: criada.id, alvo: img.alvo, ordem: i, tipo: "arquivo", storage_path: caminho });
    }
    if (falhou) {
      await supabase.from("questoes").update({ precisa_revisao: true, motivo_revisao: [linha.motivo_revisao, "Uma imagem não pôde ser copiada do enem.dev."].filter(Boolean).join(" ") }).eq("id", criada.id);
    }
  }

  const feitas = offset + corpo.questions.length;
  await supabase.from("importacoes").update({ paginas_lidas: feitas, total_paginas: corpo.metadata.total, updated_at: new Date().toISOString() }).eq("id", importacaoId);
  if (corpo.metadata.hasMore && corpo.questions.length > 0) {
    return { importacaoId, feitas, total: corpo.metadata.total, terminou: false, status: "enviando" };
  }
  await iniciarClassificacao(importacaoId);
  return { importacaoId, feitas, total: corpo.metadata.total, terminou: false, status: "lendo" };
}

async function iniciarClassificacao(importacaoId: string) {
  const [{ data: questoes }, { data: assuntos }] = await Promise.all([
    supabase.from("questoes").select("id, area, enunciado, comando").eq("importacao_id", importacaoId).is("assunto_id", null),
    supabase.from("assuntos").select("id, materia, nome").eq("situacao", "aprovado"),
  ]);
  const lista = questoes ?? [];
  if (lista.length === 0) {
    await supabase.from("importacoes").update({ status: "revisao" }).eq("id", importacaoId);
    return;
  }
  const pedidos = [];
  for (let i = 0; i < lista.length; i += POR_PEDIDO) pedidos.push(pedidoClassificacao(`c${i}`, lista.slice(i, i + POR_PEDIDO), assuntos ?? []));
  const lote = await clienteIA().messages.batches.create({ requests: pedidos });
  await supabase.from("importacoes").update({ batch_id: lote.id, status: "lendo", custo_estimado_usd: Math.round(pedidos.length * 0.05 * 100) / 100 }).eq("id", importacaoId);
}

export async function atualizarClassificacaoEnem(importacaoId: string): Promise<PassoEnem> {
  await exigirDono();
  const { data: imp } = await supabase.from("importacoes").select("*").eq("id", importacaoId).single();
  if (!imp) throw new Error("Importação não encontrada.");
  const passo = (status: StatusImportacao, terminou: boolean): PassoEnem => ({ importacaoId, feitas: imp.paginas_lidas, total: imp.total_paginas, terminou, status });
  if (imp.status !== "lendo" || !imp.batch_id) return passo(imp.status, imp.status !== "enviando");
  const lote = await clienteIA().messages.batches.retrieve(imp.batch_id);
  if (lote.processing_status !== "ended") return passo("lendo", false);

  const { data: tomou } = await supabase.from("importacoes").update({ status: "revisao" }).eq("id", importacaoId).eq("status", "lendo").select("id");
  if (!tomou || tomou.length === 0) return passo("revisao", true);

  const { data: assuntos } = await supabase.from("assuntos").select("id, materia").eq("situacao", "aprovado");
  const mapa = new Map((assuntos ?? []).map((a) => [a.id, a.materia]));
  let custo = 0;
  for await (const r of await clienteIA().messages.batches.results(imp.batch_id)) {
    if (r.result.type !== "succeeded") continue;
    custo += custoDoUso(r.result.message.usage);
    const bloco = r.result.message.content.find((b) => b.type === "text");
    const analise = ClassificacaoSchema.safeParse((() => { try { return JSON.parse(bloco && bloco.type === "text" ? bloco.text : ""); } catch { return null; } })());
    if (!analise.success) continue;
    for (const u of classificacaoParaAtualizacoes(analise.data, mapa)) {
      let assunto_id = u.assunto_id;
      if (u.assuntoNovo) {
        const { data: existente } = await supabase.from("assuntos").select("id").eq("materia", u.materia).ilike("nome", u.assuntoNovo).maybeSingle();
        assunto_id = existente?.id ?? (await supabase.from("assuntos").insert({ materia: u.materia, nome: u.assuntoNovo, situacao: "proposto" }).select("id").single()).data?.id ?? null;
      }
      const { data: q } = await supabase.from("questoes").select("precisa_revisao, motivo_revisao, importacao_id").eq("id", u.id).maybeSingle();
      if (!q || q.importacao_id !== importacaoId) continue;
      await supabase.from("questoes").update({
        materia: u.materia, area: u.area, assunto_id,
        precisa_revisao: q.precisa_revisao || u.precisa,
        motivo_revisao: u.precisa ? [q.motivo_revisao, u.assuntoNovo ? `Assunto novo proposto: ${u.assuntoNovo}.` : "Sem assunto."].filter(Boolean).join(" ") : q.motivo_revisao,
      }).eq("id", u.id);
    }
  }
  // Publica o que veio limpo (fonte já revisada); o resto fica em revisão.
  await supabase.from("questoes").update({ status: "publicada" }).eq("importacao_id", importacaoId).eq("precisa_revisao", false).not("resposta", "is", null);
  const { count } = await supabase.from("questoes").select("id", { count: "exact", head: true }).eq("importacao_id", importacaoId).eq("status", "revisao");
  const final: StatusImportacao = (count ?? 0) === 0 ? "concluida" : "revisao";
  await supabase.from("importacoes").update({ status: final, custo_real_usd: Math.round(custo * 100) / 100, updated_at: new Date().toISOString() }).eq("id", importacaoId);
  return passo(final, true);
}
```

Notas: (a) as questões do enem.dev sem matéria classificada ficam com a matéria provisória da área e `precisa_revisao`; (b) cada chamada de `avancarImportacaoEnem` baixa 50 questões e suas imagens — se o tempo da função na Vercel ficar apertado, reduza `LOTE_DOWNLOAD` para 25.

- [ ] **Step 2: `src/components/questoes/ImportarEnem.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { avancarImportacaoEnem, criarImportacaoEnem, type PassoEnem } from "@/actions/enem";
import { estilos } from "@/components/ui/estilos";

const ANOS = Array.from({ length: 15 }, (_, i) => 2023 - i);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ImportarEnem() {
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [passos, setPassos] = useState<Record<number, PassoEnem | string>>({});
  const [rodando, setRodando] = useState(false);

  async function importar() {
    setRodando(true);
    for (const ano of [...marcados].sort()) {
      try {
        const id = await criarImportacaoEnem(ano);
        let p = await avancarImportacaoEnem(id);
        setPassos((x) => ({ ...x, [ano]: p }));
        while (!p.terminou) {
          if (p.status === "lendo") await espera(20_000);
          p = await avancarImportacaoEnem(id);
          setPassos((x) => ({ ...x, [ano]: p }));
        }
      } catch (e) {
        setPassos((x) => ({ ...x, [ano]: e instanceof Error ? e.message : "Falha." }));
      }
    }
    setRodando(false);
  }

  return (
    <div className={`${estilos.card} flex flex-col gap-3 p-5`}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMarcados(new Set(ANOS))} className={estilos.botaoFantasma}>Todos</button>
        {ANOS.map((a) => (
          <label key={a} className="flex items-center gap-1 rounded-control border border-line px-2 py-1 text-sm">
            <input type="checkbox" checked={marcados.has(a)} disabled={rodando} onChange={(e) => { const n = new Set(marcados); if (e.target.checked) n.add(a); else n.delete(a); setMarcados(n); }} /> {a}
          </label>
        ))}
      </div>
      <button type="button" disabled={rodando || marcados.size === 0} onClick={() => void importar()} className={`${estilos.botaoPrimario} w-fit`}>{rodando ? "Importando…" : "Importar anos marcados"}</button>
      <p className="text-xs text-muted">Mantenha esta página aberta durante a importação. Cada ano leva alguns minutos (download + classificação pela IA).</p>
      <ul className="flex flex-col gap-1 text-sm">
        {Object.entries(passos).map(([ano, p]) => (
          <li key={ano}>
            <strong>{ano}:</strong>{" "}
            {typeof p === "string" ? <span className="text-danger">{p}</span>
              : p.status === "enviando" ? `baixando ${p.feitas} de ${p.total}`
              : p.status === "lendo" ? "classificando matérias e assuntos…"
              : <>concluído · <Link href={`/banco/importacoes/${p.importacaoId}`} className="text-brand hover:underline">ver</Link></>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: `src/app/banco/importar-enem/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { PageLayout } from "@/components/layout/PageLayout";
import { ImportarEnem } from "@/components/questoes/ImportarEnem";

export const dynamic = "force-dynamic";

export default async function ImportarEnemPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  if (professor.role !== "dono") redirect("/banco");
  return (
    <PageLayout crumb="Banco de questões" titulo="Importar ENEM (enem.dev)" subtitulo="ENEM 2009–2023: questões, gabarito e imagens; a IA classifica matéria e assunto." largura="max-w-4xl">
      <ImportarEnem />
    </PageLayout>
  );
}
```

A tela `/banco/importacoes/[id]` (Task 8) chama `atualizarImportacao`, que é específica de PDF (`exigirImportacao` + lote de páginas). Para importações `origem = 'enemdev'`, faça `atualizarImportacao` devolver a situação sem consultar o lote de páginas (a classificação é tratada por `atualizarClassificacaoEnem`): no início de `atualizarImportacao`, se `importacao.origem === "enemdev"`, retorne `situacao(importacaoId, [])` direto.

- [ ] **Step 4: Verificar** — `npx tsc --noEmit && npm run lint && npm run build` → OK.

- [ ] **Step 5: Commit** — `git add src/actions/enem.ts src/actions/importacoes.ts src/components/questoes src/app/banco && git commit -m "Banco de questoes: importacao do ENEM pelo enem.dev com classificacao"`

---

### Task 13: Barra lateral, documentação e verificação final

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`, `DESIGN.md`

- [ ] **Step 1: Barra lateral** — no array `itens`, depois de "Aulas": `{ href: "/banco", icon: ClipboardList, label: "Questões", ativo: pathname.startsWith("/banco") }`, com `ClipboardList` no import de `lucide-react`.

- [ ] **Step 2: DESIGN.md** — acrescente ao fim:

```markdown
## Banco de questões
`/banco` (lista com filtros), `/banco/nova` e `/banco/questoes/[id]` (EditorQuestao), `/banco/importar` (PDF renderizado no navegador com pdf.js e enviado ao bucket `questoes`), `/banco/importacoes/[id]` (progresso da leitura pela IA, a cada 20 s), `/banco/importacoes/[id]/revisar` (lista · página original com quadros arrastáveis · editor), `/banco/assuntos` e `/banco/importar-enem` (só dono). Texto das questões em markdown mínimo renderizado sem HTML; figuras por recorte (CSS sobre a imagem da página) ou arquivo.
```

- [ ] **Step 3: Comandos** — `npm test && npm run lint && npm run build` → tudo OK.

- [ ] **Step 4: Roteiro manual (Peter, com `ANTHROPIC_API_KEY` configurada)**
1. Banco → Assuntos → "Carregar lista inicial".
2. Importar uma prova curta (≤ 10 páginas) da UFMS com o gabarito; conferir o custo estimado; acompanhar até "Pronta para revisão"; conferir o custo real.
3. Revisar: ajustar um recorte arrastando; trocar uma imagem; aprovar com "Aprovar e próxima"; usar "Aprovar todas sem aviso".
4. Banco → Importar ENEM → marcar 2023 → acompanhar até concluir; abrir algumas questões; conferir as que ficaram em revisão.
5. Como professor: Nova questão com imagem no enunciado e numa alternativa; publicar.
6. Como admin: importar uma prova para a escola; o banco geral não aparece como opção.

- [ ] **Step 5: Commit** — `git add src/components/layout/Sidebar.tsx DESIGN.md && git commit -m "Banco de questoes: item na barra lateral e DESIGN"`
