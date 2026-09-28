# Repaginação visual "Híbrido Status" + Ctrl+K — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a pele do Status Avalia pelo visual "Híbrido Status" (moldura azul da logo + área de trabalho clara) e adicionar uma paleta de comandos Ctrl+K, sem mudar regra de negócio.

**Architecture:** Uma camada de tokens de design em `globals.css` (Tailwind v4 `@theme`) gera utilitários semânticos (`bg-surface`, `text-muted`, `border-line`…). Dois componentes de layout (`PageLayout` para páginas internas, `AuthShell` para login/cadastro) e duas primitivas (`Modal`, `estilos.ts`) concentram o visual; as telas migram de classes `neutral-*/blue-*` fixas para os tokens, uma área por task. O Ctrl+K é um provider + componente client montado no layout raiz, com lógica pura testável em `lib/comandos.ts` e uma server action `buscarAlunos`.

**Tech Stack:** Next.js 16.2 (App Router, ler `node_modules/next/dist/docs/` antes de usar API nova), React 19, Tailwind CSS v4, lucide-react, Recharts 3, Supabase JS, `tsx` + `node:test` para os testes de lógica pura.

**Spec:** `docs/superpowers/specs/2026-09-28-repaginacao-visual-design.md`

## Global Constraints

- Nenhuma mudança em schema, migrations, MCP (`mcp/`, `src/lib/mcp-tools.ts`, `src/app/api/mcp`) ou regra de negócio das server actions existentes.
- Sem tema escuro: remover toda classe `dark:` dos arquivos tocados; ao fim, `grep -rn "dark:" src` deve retornar vazio.
- Amarelo `gold` (#F5D90A) nunca como texto ou contorno sobre fundo branco; sobre branco só como preenchimento com texto `gold-ink`.
- Vidro fosco (`backdrop-blur`) só em: Ctrl+K, modais e seu overlay, drawer do aluno, card do login. Nunca na planilha.
- Logo: usar `public/logo-status-branca.png` (já versionada) sobre azul; `public/LOGO2025_CURVAS.png` fica intocada. Nunca recolorir, recortar ou distorcer.
- Fontes: Space Grotesk (títulos, `font-display`), Manrope (corpo, `font-sans`), JetBrains Mono (números, `font-mono` + `tabular-nums`).
- Comportamento da planilha (teclado, Ctrl+Z, arrastar, salvamento, status rápido, presença, exportar) não muda.
- Textos de interface em português, no tom atual do app.
- Cada task termina com `npm run build` e `npm run lint` limpos e um commit; o usuário pediu commit + push automático no `master` ao fim de cada ajuste (`git push origin master`).
- Não existe framework de testes de UI no projeto. Lógica pura ganha teste com `node:test` via `tsx --test`; UI é verificada com build, lint e conferência visual no `npm run dev` (desktop ~1366px e mobile ~390px).

## Mapa de migração de classes (usado nas tasks 5–9)

Aplicar em todo arquivo migrado. Remover qualquer classe `dark:` sem substituto.

| Antes | Depois |
|---|---|
| `text-neutral-900`, `text-neutral-800` | `text-ink` |
| `text-neutral-700`, `text-neutral-600`, `text-neutral-500` | `text-muted` |
| `text-neutral-400`, `text-neutral-300` | `text-faint` |
| `bg-white` | `bg-surface` |
| `bg-neutral-50`, `bg-neutral-100`, `bg-slate-50` | `bg-surface-sunken` |
| `hover:bg-neutral-50`, `hover:bg-neutral-100` | `hover:bg-surface-sunken` |
| `border-neutral-200`, `border-neutral-300` | `border-line` |
| `ring-neutral-200` | `ring-line` |
| `text-blue-600`, `text-blue-700`, `text-blue-500` | `text-brand` |
| `hover:text-blue-600`, `hover:text-blue-700` | `hover:text-brand-bright` |
| `bg-blue-50` | `bg-brand/5` |
| `border-blue-500`, `focus:border-blue-500`, `ring-blue-500`, `outline-blue-500`, `border-blue-400` | mesma variante com `brand-bright` |
| botão `bg-blue-600 … text-white …` | `estilos.botaoPrimario` |
| botão branco com borda (`border-neutral-300 bg-white … text-neutral-700`) | `estilos.botaoSecundario` |
| botão só texto (`text-neutral-700 hover:bg-neutral-100`) | `estilos.botaoFantasma` |
| input/select com `border-neutral-300 … focus:border-blue-500` | `estilos.input` |
| `bg-rose-50` | `bg-danger/10` |
| `text-rose-600`, `text-rose-700`, `text-rose-500` | `text-danger` |
| `bg-rose-600`, `hover:bg-rose-700` | `bg-danger`, `hover:bg-danger/90` |
| `bg-emerald-50`, `bg-emerald-100` | `bg-ok/10` |
| `text-emerald-600`, `text-emerald-700` | `text-ok` |
| `bg-emerald-600`, `hover:bg-emerald-700` | `bg-ok`, `hover:bg-ok/90` |
| `bg-amber-50` | `bg-warn/10` |
| `text-amber-500`, `text-amber-700` | `text-warn` |
| `bg-indigo-50 text-indigo-700` (colunas de data) | `border border-dashed border-line bg-surface text-muted` |
| `rounded-lg`/`rounded-xl` em cards | `rounded-card` |
| `rounded-md` em botões/inputs | `rounded-control` |
| `shadow-sm` em cards | `shadow-card` |
| `bg-black/40` (overlay) | resolvido pelo `Modal` |
| `text-lg/xl font-semibold` em títulos de página ou modal | adicionar `font-display` |
| valores numéricos (notas, médias, KPIs, contagens) | adicionar `font-mono tabular-nums` |

---

## File Structure

**Criar**
- `DESIGN.md`: fonte de verdade dos tokens, exigida por `.agents/rules/design-rules.md`.
- `src/components/ui/estilos.ts`: constantes de classe (botões, input, card).
- `src/components/ui/Modal.tsx`: casca de modal com `<dialog>` nativo.
- `src/components/layout/PageLayout.tsx`: faixa azul + conteúdo sobreposto (páginas internas).
- `src/components/layout/AuthShell.tsx`: fundo aurora + card de vidro (login, cadastro, verificar, trocar senha).
- `src/components/turma/BimestreAbas.tsx`: seletor de série + abas de bimestre + "+" (substitui `FiltrosTurma`).
- `src/lib/comandos.ts` + `src/lib/comandos.test.ts`: normalização, filtro e destaque de texto (pura).
- `src/actions/busca.ts`: `buscarAlunos(termo)`.
- `src/components/command/CommandProvider.tsx`: contexto (abrir paleta, registrar ações contextuais).
- `src/components/command/CommandPalette.tsx`: UI da paleta.

**Modificar**
- `src/app/globals.css`, `src/app/layout.tsx`, `package.json` (script `test`)
- `src/components/layout/Sidebar.tsx`
- `src/components/ui/ConfirmDialog.tsx`, `src/components/ui/Avatar.tsx`
- `src/app/login/page.tsx`, `src/app/cadastro/page.tsx`, `src/app/verificar-email/page.tsx`, `src/app/trocar-senha/page.tsx`
- `src/app/page.tsx`, `src/components/home/TurmasLista.tsx`, `src/lib/turmas.ts`
- `src/app/turma/[turmaId]/page.tsx`, `src/components/turma/TurmaDashboard.tsx`, `src/components/turma/KpiCards.tsx`, `src/components/turma/AnaliseAprendizagem.tsx`, `src/components/turma/CriarBimestreModal.tsx`
- `src/components/grid/PlanilhaGrid.tsx`, `src/components/grid/CelulaNota.tsx`, `src/lib/status.ts`
- `src/components/grid/GestaoColunasModal.tsx`, `EstatisticaColunaModal.tsx`, `TransferirAlunoModal.tsx`, `src/components/aluno/AlunoDashboardDrawer.tsx`
- `src/app/admin/professores/page.tsx`, `src/app/admin/historico/page.tsx`, `src/components/admin/GerenciarProfessores.tsx`, `HistoricoTable.tsx`, `CodigoConvite.tsx`

**Remover**
- `src/components/turma/TurmaHeader.tsx`, `src/components/turma/FiltrosTurma.tsx` (Task 7)
- `public/banner-cabecalho.png` (Task 11, se nenhum import restar)

---

### Task 1: Fundação — tokens, fontes e DESIGN.md

**Files:**
- Modify: `src/app/globals.css` (arquivo inteiro)
- Modify: `src/app/layout.tsx:4-17,38-41`
- Create: `DESIGN.md`

**Interfaces:**
- Produces: utilitários Tailwind `bg|text|border|ring|outline-{frame,frame-deep,frame-line,frame-muted,canvas,surface,surface-sunken,zebra,line,line-soft,ink,muted,faint,brand,brand-bright,gold,gold-ink,ok,danger,warn}`, `shadow-card`, `shadow-float`, `rounded-control` (10px), `rounded-card` (14px), `rounded-float` (18px), `font-display`, `font-sans`, `font-mono`, `animate-salvo`, utilitários `bg-aurora` e `bg-grade-tech`.

- [ ] **Step 1: Substituir `src/app/globals.css` inteiro**

```css
@import "tailwindcss";

/* Tema único "Híbrido Status": moldura azul da logo + área de trabalho clara.
   Tokens documentados em DESIGN.md — mudar aqui, mudar lá. */

/* Mantém `dark:` preso à classe .dark (que nunca é aplicada) enquanto houver classes
   dark: antigas no código — sem isso o Tailwind v4 as ligaria no modo escuro do SO.
   Removido na Task 11, quando `grep -rn "dark:" src` estiver vazio. */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-frame: #0a2a6e;
  --color-frame-deep: #062056;
  --color-frame-line: #1c3f8a;
  --color-frame-muted: #a9bce6;

  --color-canvas: #eef2f9;
  --color-surface: #ffffff;
  --color-surface-sunken: #f4f7fc;
  --color-zebra: #fafbfe;
  --color-line: #dce3f0;
  --color-line-soft: #eaeff7;

  --color-ink: #0e1b3d;
  --color-muted: #5a6a8e;
  --color-faint: #98a5c2;

  --color-brand: #0444a0;
  --color-brand-bright: #1e6fd9;
  --color-gold: #f5d90a;
  --color-gold-ink: #0a1c4a;

  --color-ok: #0e9f6e;
  --color-danger: #d6264a;
  --color-warn: #b7791f;

  --radius-control: 10px;
  --radius-card: 14px;
  --radius-float: 18px;

  --shadow-card: 0 8px 28px rgb(10 42 110 / 0.08);
  --shadow-float: 0 40px 90px rgb(10 28 74 / 0.4);

  --animate-salvo: salvo 1.2s ease-out;
  @keyframes salvo {
    from { background-color: rgb(14 159 110 / 0.18); }
    to { background-color: transparent; }
  }
}

@theme inline {
  --font-sans: var(--font-manrope);
  --font-display: var(--font-space-grotesk);
  --font-mono: var(--font-jetbrains-mono);
}

@utility bg-aurora {
  background-color: #06163f;
  background-image:
    radial-gradient(520px 320px at 85% 0%, rgb(245 217 10 / 0.33), transparent 65%),
    radial-gradient(640px 420px at 5% 100%, rgb(30 111 217 / 0.67), transparent 65%),
    radial-gradient(500px 300px at 50% 50%, #0444a0, transparent 80%);
}

@utility bg-grade-tech {
  background-image:
    linear-gradient(rgb(255 255 255 / 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(circle at center, #000, transparent 75%);
}

body {
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-sans), Arial, Helvetica, sans-serif;
}

:where(button, a, input, select, textarea, summary):focus-visible {
  outline: 2px solid var(--color-brand-bright);
  outline-offset: 3px;
}

:where(button, a, summary) {
  touch-action: manipulation;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Trocar as fontes em `src/app/layout.tsx`**

Substituir o import e as constantes de fonte (linhas 4 e 9-17):

```tsx
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
```

```tsx
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});
```

E no `<html>`:

```tsx
      className={`${manrope.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
```

- [ ] **Step 3: Criar `DESIGN.md` na raiz**

```markdown
# DESIGN.md — Status Avalia ("Híbrido Status")

Fonte de verdade do visual. Tokens implementados em `src/app/globals.css` (`@theme`).
Spec completa: `docs/superpowers/specs/2026-09-28-repaginacao-visual-design.md`.

## Direção
Moldura (sidebar + faixa do topo) no azul da logo do Colégio Status; área de trabalho
clara com superfícies brancas flutuando. O "futurista" vem de profundidade (sombras
azuladas), números em mono, contornos de foco precisos e vidro fosco só em camadas
flutuantes. Sem tema escuro.

## Cores (utilitário Tailwind = nome do token)
| Token | Hex | Uso |
|---|---|---|
| frame | #0A2A6E | faixa do topo |
| frame-deep | #062056 | sidebar, overlay de modal (40%) |
| frame-line | #1C3F8A | bordas na moldura |
| frame-muted | #A9BCE6 | texto/ícone secundário na moldura |
| canvas | #EEF2F9 | fundo da área de trabalho |
| surface | #FFFFFF | cards, tabela, modais |
| surface-sunken | #F4F7FC | cabeçalho de tabela, coluna média, chips neutros |
| zebra | #FAFBFE | linhas alternadas |
| line / line-soft | #DCE3F0 / #EAEFF7 | bordas / divisórias |
| ink / muted / faint | #0E1B3D / #5A6A8E / #98A5C2 | texto principal / secundário / apagado |
| brand | #0444A0 | azul da logo: botão primário, edição, destaque numérico |
| brand-bright | #1E6FD9 | seleção, links, foco de teclado |
| gold / gold-ink | #F5D90A / #0A1C4A | amarelo da logo (preenchimento) / texto sobre ele |
| ok / danger / warn | #0E9F6E / #D6264A / #B7791F | presença P e salvo / crítico, F, destrutivo / transferido |

**Regra do amarelo:** nunca texto ou contorno sobre branco. Sobre branco, só preenchimento com `gold-ink`.

## Tipografia
- `font-display` Space Grotesk 500–700: títulos de página e modal.
- `font-sans` Manrope: corpo.
- `font-mono` JetBrains Mono + `tabular-nums`: notas, médias, KPIs, atalhos.
- Rótulos: 10–11px, caixa alta, `tracking-[0.1em]`, `text-muted`.

## Forma
- `rounded-control` 10px (botões, inputs) · `rounded-card` 14px (cards, tabela) · `rounded-float` 18px (modais, Ctrl+K).
- `shadow-card` em cards · `shadow-float` em camadas flutuantes.
- Vidro (`backdrop-blur`) só em Ctrl+K, modais, drawer e card do login.

## Logo
- Sobre azul: `public/logo-status-branca.png` (círculo original, texto branco).
- Sobre branco: `public/LOGO2025_CURVAS.png`. Nunca recolorir, recortar ou distorcer.

## Componentes base
- `components/layout/PageLayout.tsx`: faixa `frame` com título + logo, conteúdo sobreposto.
- `components/layout/AuthShell.tsx`: fundo `bg-aurora` + card de vidro.
- `components/ui/Modal.tsx`: `<dialog>` com overlay `frame-deep/40` + blur.
- `components/ui/estilos.ts`: classes de botão, input e card.
```

- [ ] **Step 4: Verificar**

Run: `npm run build`
Expected: build conclui sem erro (as fontes baixam no build; se a rede falhar, repetir).

Run: `npm run lint`
Expected: sem erros.

Run: `npm run dev` e abrir `http://localhost:3000/login`
Expected: fundo `#EEF2F9` sem as linhas de caderno; texto em Manrope. As telas ainda usam as classes antigas, o que é esperado.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx DESIGN.md
git commit -m "Adiciona tokens do tema Hibrido Status, novas fontes e DESIGN.md"
git push origin master
```

---

### Task 2: Primitivas — estilos.ts, Modal e ConfirmDialog

**Files:**
- Create: `src/components/ui/estilos.ts`
- Create: `src/components/ui/Modal.tsx`
- Modify: `src/components/ui/ConfirmDialog.tsx` (arquivo inteiro)
- Modify: `src/components/ui/Avatar.tsx:1-10`

**Interfaces:**
- Consumes: tokens da Task 1.
- Produces:
  - `estilos.botaoPrimario`, `estilos.botaoSecundario`, `estilos.botaoFantasma`, `estilos.botaoPerigo`, `estilos.input`, `estilos.card`, `estilos.rotulo` (strings de classe).
  - `Modal(props: { open: boolean; onClose: () => void; titulo: React.ReactNode; descricao?: React.ReactNode; largura?: "sm" | "md" | "lg"; children: React.ReactNode; rodape?: React.ReactNode })`.

- [ ] **Step 1: Criar `src/components/ui/estilos.ts`**

```ts
/** Classes compartilhadas do tema — use estas em vez de repetir utilitários de botão/input. */
const baseBotao =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-control px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export const estilos = {
  botaoPrimario: `${baseBotao} bg-brand text-white shadow-[0_4px_14px_rgb(4_68_160_/_0.3)] hover:bg-brand-bright`,
  botaoSecundario: `${baseBotao} border border-line bg-surface text-ink hover:border-brand-bright/40 hover:bg-surface-sunken`,
  botaoFantasma: `${baseBotao} text-muted hover:bg-surface-sunken hover:text-ink`,
  botaoPerigo: `${baseBotao} bg-danger text-white hover:bg-danger/90`,
  input:
    "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-brand-bright focus:ring-2 focus:ring-brand-bright/15",
  card: "rounded-card border border-line bg-surface shadow-card",
  rotulo: "text-[11px] font-semibold uppercase tracking-[0.1em] text-muted",
} as const;
```

- [ ] **Step 2: Criar `src/components/ui/Modal.tsx`**

```tsx
"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  largura?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  rodape?: React.ReactNode;
};

const LARGURAS = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" } as const;

/** Casca de modal do tema: <dialog> nativo (Esc e foco preso de graça), overlay azul com blur. */
export function Modal({ open, onClose, titulo, descricao, largura = "sm", children, rodape }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const descricaoId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const anterior = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={tituloId}
      aria-describedby={descricao ? descricaoId : undefined}
      className={`fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] ${LARGURAS[largura]} overflow-auto overscroll-contain rounded-float border border-white bg-surface p-0 text-ink shadow-float backdrop:bg-frame-deep/40 backdrop:backdrop-blur-sm`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const r = event.currentTarget.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose();
      }}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={tituloId} className="font-display text-lg font-semibold tracking-tight text-ink">
              {titulo}
            </h2>
            {descricao && (
              <p id={descricaoId} className="mt-1 text-sm text-muted">
                {descricao}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-control p-1.5 text-faint hover:bg-surface-sunken hover:text-ink">
            <X size={18} />
          </button>
        </div>
        {children}
        {rodape && <div className="flex justify-end gap-2 pt-1">{rodape}</div>}
      </div>
    </dialog>
  );
}
```

- [ ] **Step 3: Reescrever `src/components/ui/ConfirmDialog.tsx` sobre o `Modal`**

```tsx
"use client";

import { Modal } from "./Modal";
import { estilos } from "./estilos";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      titulo={title}
      descricao={message}
      rodape={
        <>
          <button type="button" onClick={onCancel} className={estilos.botaoFantasma}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} className={danger ? estilos.botaoPerigo : estilos.botaoPrimario}>
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}
```

- [ ] **Step 4: Trocar a paleta do `Avatar` para tons do tema**

Em `src/components/ui/Avatar.tsx`, substituir o array `CORES` (linhas 1-10):

```ts
const CORES = [
  "bg-brand/10 text-brand",
  "bg-brand-bright/10 text-brand-bright",
  "bg-gold/40 text-gold-ink",
  "bg-ok/10 text-ok",
  "bg-warn/10 text-warn",
  "bg-frame/10 text-frame",
];
```

- [ ] **Step 5: Verificar**

Run: `npm run build && npm run lint`
Expected: sem erros.

Run: `npm run dev`, abrir uma turma, clicar no ícone de excluir de um aluno.
Expected: o diálogo abre branco, com raio grande e fundo azulado desfocado; Esc e clique fora cancelam; "Excluir" em vermelho. Cancelar para não excluir.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui
git commit -m "Adiciona primitivas Modal e estilos do tema; ConfirmDialog usa Modal"
git push origin master
```

---

### Task 3: Shell — Sidebar em trilho e PageLayout

**Files:**
- Create: `src/components/layout/PageLayout.tsx`
- Modify: `src/components/layout/Sidebar.tsx` (arquivo inteiro)
- Modify: `src/app/layout.tsx:40-41` (classes do `body`)

**Interfaces:**
- Consumes: `Avatar` (`nome`, `size`), tokens.
- Produces:
  - `PageLayout(props: { crumb?: string; titulo: string; subtitulo?: React.ReactNode; acoes?: React.ReactNode; largura?: "max-w-3xl" | "max-w-4xl" | "max-w-6xl" | "max-w-7xl"; children: React.ReactNode })`. Renderiza `<header>` + `<main>`; a página **não** deve envolver com outro `<main>`.
  - `Sidebar` aceita `onAbrirBusca?: () => void` (ligado na Task 10; até lá o botão de busca não é renderizado).

- [ ] **Step 1: Criar `src/components/layout/PageLayout.tsx`**

```tsx
import Image from "next/image";
import Link from "next/link";

type PageLayoutProps = {
  crumb?: string;
  titulo: string;
  subtitulo?: React.ReactNode;
  acoes?: React.ReactNode;
  largura?: "max-w-3xl" | "max-w-4xl" | "max-w-6xl" | "max-w-7xl";
  children: React.ReactNode;
};

/** Faixa azul da moldura com título + logo; o conteúdo sobe e flutua sobre a borda dela. */
export function PageLayout({ crumb, titulo, subtitulo, acoes, largura = "max-w-7xl", children }: PageLayoutProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="bg-frame pb-20 text-white">
        <div className={`mx-auto w-full ${largura} px-4 pt-6 sm:px-6`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {crumb && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-frame-muted">{crumb}</p>
              )}
              <h1 className="mt-1 break-words font-display text-2xl font-semibold tracking-tight sm:text-3xl">{titulo}</h1>
              {subtitulo && <p className="mt-1 text-sm text-frame-muted">{subtitulo}</p>}
            </div>
            <Link href="/" aria-label="Colégio Status — início" className="hidden shrink-0 rounded sm:block">
              <Image src="/logo-status-branca.png" alt="Colégio Status" width={1580} height={513} className="h-11 w-auto" priority />
            </Link>
          </div>
          {acoes && <div className="mt-4 flex flex-wrap items-center gap-2">{acoes}</div>}
        </div>
      </header>
      <main className={`relative mx-auto -mt-16 flex w-full min-w-0 ${largura} flex-1 flex-col gap-5 px-4 pb-10 sm:px-6`}>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Reescrever `src/components/layout/Sidebar.tsx`**

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, LogOut, Users, History, GraduationCap, Search } from "lucide-react";
import { logout } from "@/actions/auth";
import { Avatar } from "@/components/ui/Avatar";
import type { Professor } from "@/lib/types";

type SidebarProps = {
  professor: Professor | null;
  onAbrirBusca?: () => void;
};

const itemBase =
  "group relative flex h-11 w-11 items-center justify-center rounded-[11px] transition md:h-10 md:w-10";

export function Sidebar({ professor, onAbrirBusca }: SidebarProps) {
  const pathname = usePathname();
  if (!professor) return null;

  const itens = [
    { href: "/", icon: GraduationCap, label: "Turmas", ativo: pathname === "/" || pathname.startsWith("/turma/") },
    ...(professor.role === "admin" ? [
      { href: "/admin/professores", icon: Users, label: "Professores", ativo: pathname === "/admin/professores" },
      { href: "/admin/historico", icon: History, label: "Histórico", ativo: pathname === "/admin/historico" },
    ] : []),
    { href: "/trocar-senha", icon: KeyRound, label: "Senha", ativo: pathname === "/trocar-senha" },
  ];

  return (
    <aside className="flex shrink-0 items-center gap-2 border-b border-frame-line bg-frame-deep px-3 py-2 md:sticky md:top-0 md:h-dvh md:w-16 md:flex-col md:border-r md:border-b-0 md:px-0 md:py-4">
      <Link href="/" aria-label="Colégio Status — início" className="mr-auto rounded md:hidden">
        <Image src="/logo-status-branca.png" alt="Colégio Status" width={1580} height={513} className="h-7 w-auto" priority />
      </Link>
      <nav aria-label="Navegação principal" className="flex items-center gap-1 md:flex-col md:gap-2">
        {onAbrirBusca && (
          <button type="button" onClick={onAbrirBusca} aria-label="Buscar (Ctrl+K)" title="Buscar (Ctrl+K)" className={`${itemBase} text-frame-muted hover:bg-white/10 hover:text-white md:mb-2`}>
            <Search size={18} aria-hidden="true" />
          </button>
        )}
        {itens.map(({ href, icon: Icon, label, ativo }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            aria-current={ativo ? (pathname === href ? "page" : "location") : undefined}
            className={`${itemBase} ${ativo ? "bg-gold text-gold-ink shadow-[0_0_18px_rgb(245_217_10_/_0.4)]" : "text-frame-muted hover:bg-white/10 hover:text-white"}`}
          >
            <Icon size={18} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-1 md:mt-auto md:flex-col md:gap-3">
        <span title={professor.nome} className="hidden md:block">
          <Avatar nome={professor.nome} />
        </span>
        <form action={logout}>
          <button type="submit" aria-label="Sair" title="Sair" className={`${itemBase} text-frame-muted hover:bg-danger/20 hover:text-white`}>
            <LogOut size={18} aria-hidden="true" />
          </button>
        </form>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Ajustar o `body` em `src/app/layout.tsx`**

```tsx
      <body className="flex min-h-full flex-col bg-canvas md:flex-row">
```

- [ ] **Step 4: Verificar**

Run: `npm run build && npm run lint`
Expected: sem erros.

Run: `npm run dev`, logar.
Expected (desktop): trilho azul-escuro de 64px à esquerda, fixo ao rolar; "Turmas" com fundo amarelo; avatar e Sair no rodapé; tooltips com o nome de cada item. Expected (390px): barra azul no topo com a logo branca à esquerda e os ícones à direita.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout src/app/layout.tsx
git commit -m "Sidebar em trilho de icones e PageLayout com faixa azul"
git push origin master
```

---

### Task 4: Telas de autenticação com aurora

**Files:**
- Create: `src/components/layout/AuthShell.tsx`
- Modify: `src/app/login/page.tsx`, `src/app/cadastro/page.tsx`, `src/app/verificar-email/page.tsx`, `src/app/trocar-senha/page.tsx`

**Interfaces:**
- Consumes: `bg-aurora`, `bg-grade-tech`, `estilos`.
- Produces: `AuthShell(props: { titulo: string; subtitulo?: React.ReactNode; children: React.ReactNode; comoForm?: (formData: FormData) => void | Promise<void> })`. Com `comoForm`, renderiza o card como `<form action={comoForm}>`; sem ele, como `<div>`. Também exporta `authInput` (classe de input translúcido), `authBotao` (botão amarelo) e `AuthAviso({ tipo: "erro" | "ok", children })`.

- [ ] **Step 1: Criar `src/components/layout/AuthShell.tsx`**

```tsx
import Image from "next/image";

export const authInput =
  "w-full rounded-control border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-frame-muted focus:border-gold focus:ring-3 focus:ring-gold/20";

export const authBotao =
  "w-full rounded-control bg-gold px-3 py-2.5 text-sm font-extrabold text-gold-ink shadow-[0_8px_24px_rgb(245_217_10_/_0.33)] transition hover:brightness-105 disabled:opacity-60";

export function AuthAviso({ tipo, children }: { tipo: "erro" | "ok"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={`rounded-control px-3 py-2 text-sm ${tipo === "erro" ? "bg-danger/25 text-white" : "bg-ok/25 text-white"}`}
    >
      {children}
    </p>
  );
}

type AuthShellProps = {
  titulo: string;
  subtitulo?: React.ReactNode;
  children: React.ReactNode;
  comoForm?: (formData: FormData) => void | Promise<void>;
};

/** Fundo aurora + card de vidro com a logo oficial branca. Primeira impressão do sistema. */
export function AuthShell({ titulo, subtitulo, children, comoForm }: AuthShellProps) {
  const conteudo = (
    <>
      <Image src="/logo-status-branca.png" alt="Colégio Status" width={1580} height={513} className="mb-6 h-auto w-full" priority />
      <h1 className="font-display text-2xl font-semibold tracking-tight">{titulo}</h1>
      {subtitulo && <p className="mt-1 text-sm text-frame-muted">{subtitulo}</p>}
      <div className="mt-5 flex flex-col gap-3">{children}</div>
    </>
  );
  const classeCard =
    "relative z-10 w-full max-w-sm rounded-[20px] border border-white/20 bg-white/10 p-7 text-white shadow-[0_30px_80px_rgb(0_0_0_/_0.5),inset_0_1px_0_rgb(255_255_255_/_0.15)] backdrop-blur-xl";

  return (
    <main className="bg-aurora relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="bg-grade-tech pointer-events-none absolute inset-0" />
      {comoForm ? (
        <form action={comoForm} className={classeCard}>{conteudo}</form>
      ) : (
        <div className={classeCard}>{conteudo}</div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Reescrever `src/app/login/page.tsx`**

```tsx
import Link from "next/link";
import { login } from "@/actions/auth";
import { AuthAviso, AuthShell, authBotao, authInput } from "@/components/layout/AuthShell";

type LoginPageProps = {
  searchParams: Promise<{ erro?: string }>;
};

const MENSAGENS_ERRO: Record<string, string> = {
  "1": "Email ou senha incorretos. Tente novamente.",
  "nao-verificado": "Confirme seu email antes de entrar — veja sua caixa de entrada.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { erro } = await searchParams;

  return (
    <AuthShell titulo="Bem-vindo de volta" subtitulo="Entre para lançar as notas das suas turmas." comoForm={login}>
      {erro && <AuthAviso tipo="erro">{MENSAGENS_ERRO[erro] ?? "Não foi possível entrar. Tente novamente."}</AuthAviso>}
      <label className="flex flex-col gap-1.5 text-xs text-frame-muted">
        Email
        <input type="email" name="email" autoFocus autoComplete="email" required className={authInput} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-frame-muted">
        Senha
        <input type="password" name="senha" autoComplete="current-password" required className={authInput} />
      </label>
      <button type="submit" className={`${authBotao} mt-1`}>Entrar →</button>
      <Link href="/cadastro" className="text-center text-sm text-frame-muted hover:text-white hover:underline">
        Não tem conta? Cadastre-se
      </Link>
    </AuthShell>
  );
}
```

- [ ] **Step 3: Migrar `cadastro`, `verificar-email` e `trocar-senha` com o mesmo padrão**

Para cada página:
1. Ler o arquivo inteiro antes de editar; manter toda a lógica, os `searchParams`, os `redirect`s, os nomes dos campos (`name=`) e as mensagens.
2. Trocar `<main …><form action={X} className="…card…">` por `<AuthShell titulo="…" subtitulo="…" comoForm={X}>`; em `verificar-email`, que não tem form, usar `<AuthShell titulo="…">` sem `comoForm`.
3. Cada `<input>` → envolver em `<label className="flex flex-col gap-1.5 text-xs text-frame-muted">` com o texto do antigo `placeholder` como rótulo, e `className={authInput}`.
4. Botão de submit, ou link com cara de botão em `verificar-email`, → `className={authBotao}`.
5. Parágrafos `bg-rose-50 … text-rose-700` → `<AuthAviso tipo="erro">`; `bg-emerald-50 … text-emerald-700` → `<AuthAviso tipo="ok">`.
6. Links secundários → `className="text-center text-sm text-frame-muted hover:text-white hover:underline"`.
7. Títulos: cadastro "Criar conta"; verificar-email mantém o texto atual; trocar-senha "Trocar senha", e o subtítulo atual (provisória/normal) vira `subtitulo`.

Em `trocar-senha` o professor está logado: a Sidebar aparece à esquerda e o `AuthShell` ocupa o resto. É o comportamento esperado pela spec.

- [ ] **Step 4: Verificar**

Run: `npm run build && npm run lint`
Expected: sem erros.

Run: `npm run dev`, deslogar e abrir `/login`, `/login?erro=1`, `/cadastro`, `/verificar-email`; logar e abrir `/trocar-senha`.
Expected: fundo aurora (dourado no alto à direita, azul embaixo, grade sutil), card de vidro com a logo branca no topo, foco do input com borda amarela, botão amarelo com texto azul-escuro. Login com senha errada mostra o aviso; login correto entra normalmente.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/AuthShell.tsx src/app/login src/app/cadastro src/app/verificar-email src/app/trocar-senha
git commit -m "Telas de autenticacao com fundo aurora e logo oficial branca"
git push origin master
```

---

### Task 5: Home — lista de turmas

**Files:**
- Modify: `src/app/page.tsx` (arquivo inteiro)
- Modify: `src/components/home/TurmasLista.tsx`
- Modify: `src/lib/turmas.ts:11-23`

**Interfaces:**
- Consumes: `PageLayout`, `estilos`, `getProfessorAtual()`.
- Produces: `corBimestre(bimestre)` retorna classes do tema.

- [ ] **Step 1: Reescrever `src/app/page.tsx`**

```tsx
import { supabase } from "@/lib/supabase/client";
import { TurmasLista } from "@/components/home/TurmasLista";
import { PageLayout } from "@/components/layout/PageLayout";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { getProfessorAtual } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [professor, turmas, { data: alunos }] = await Promise.all([
    getProfessorAtual(),
    listarTurmasAcessiveis(),
    supabase.from("alunos").select("turma_id"),
  ]);

  const contagemPorTurma: Record<string, number> = {};
  for (const a of alunos ?? []) {
    contagemPorTurma[a.turma_id] = (contagemPorTurma[a.turma_id] ?? 0) + 1;
  }

  const primeiroNome = professor?.nome.trim().split(/\s+/)[0];

  return (
    <PageLayout
      crumb="Redação · Colégio Status"
      titulo="Suas turmas"
      subtitulo={primeiroNome ? `Olá, Prof. ${primeiroNome}. Escolha uma turma para lançar e acompanhar as notas.` : undefined}
      largura="max-w-6xl"
    >
      <TurmasLista turmas={turmas} contagemPorTurma={contagemPorTurma} />
    </PageLayout>
  );
}
```

- [ ] **Step 2: Migrar `TurmasLista.tsx`**

Aplicar o Mapa de migração e estas mudanças específicas:
- Busca: envolver o `<div className="relative">` num card, `className={`${estilos.card} p-2`}`, para ela flutuar sobre a faixa. O input usa `${estilos.input} border-transparent bg-surface-sunken pl-9`.
- Estados vazios: `rounded-card border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-muted`.
- Título de série (`h2`): `flex items-center gap-1.5 ${estilos.rotulo}` com o ícone `text-brand`.
- Card de turma (`Link`): `group flex items-center gap-3 rounded-card border border-line bg-surface px-5 py-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-bright/50 hover:shadow-[0_14px_36px_rgb(10_42_110_/_0.14)]`.
- Ícone: `flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white`.
- Nome da turma: `truncate font-display font-semibold text-ink`.
- Contagem de alunos: `flex items-center gap-1 font-mono text-[11px] tabular-nums text-muted`.
- Importar `estilos` de `@/components/ui/estilos`.

- [ ] **Step 3: Remapear `CORES_BIMESTRE` em `src/lib/turmas.ts`**

```ts
const CORES_BIMESTRE: Record<string, string> = {
  "1º Bimestre": "bg-brand-bright/10 text-brand-bright",
  "2º Bimestre": "bg-ok/10 text-ok",
  "3º Bimestre": "bg-gold/40 text-gold-ink",
  "4º Bimestre": "bg-warn/10 text-warn",
};

export function corBimestre(bimestre: string): string {
  return CORES_BIMESTRE[bimestre] ?? "bg-surface-sunken text-muted";
}
```

- [ ] **Step 4: Verificar**

Run: `npm run build && npm run lint`
Expected: sem erros.

Run: `npm run dev`, abrir `/`.
Expected: faixa azul com "Suas turmas", saudação e logo branca à direita; a busca flutua sobre a borda da faixa; cards brancos por série sobem levemente no hover; o banner antigo sumiu.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/home/TurmasLista.tsx src/lib/turmas.ts
git commit -m "Home de turmas no layout com faixa azul e cards flutuantes"
git push origin master
```

---

### Task 6: Lógica pura do Ctrl+K e da busca (TDD)

Feita antes da planilha porque a Task 8 reaproveita `normalizar` de `lib/comandos.ts` no filtro de alunos.

**Files:**
- Create: `src/lib/comandos.ts`
- Test: `src/lib/comandos.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `normalizar(texto: string): string`: minúsculas, sem acento.
  - `type ItemComando = { id: string; grupo: "Alunos" | "Turmas" | "Ações"; rotulo: string; detalhe?: string; palavrasChave?: string[]; executar: () => void }`
  - `filtrarComandos(itens: ItemComando[], termo: string): ItemComando[]`: termo vazio devolve todos; senão, os que contêm o termo (normalizado) no rótulo ou nas palavras-chave, com quem começa pelo termo primeiro e a ordem original mantida no empate.
  - `trechosDestacados(texto: string, termo: string): { texto: string; destaque: boolean }[]`: divide o texto original marcando a 1ª ocorrência do termo, ignorando acento e caixa.

- [ ] **Step 1: Adicionar o script de teste em `package.json`**

Em `"scripts"`, após `"lint"`:

```json
    "test": "tsx --test src/lib/comandos.test.ts",
```

- [ ] **Step 2: Escrever o teste que falha — `src/lib/comandos.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarComandos, normalizar, trechosDestacados, type ItemComando } from "./comandos";

const item = (id: string, rotulo: string, palavrasChave?: string[]): ItemComando => ({
  id,
  grupo: "Ações",
  rotulo,
  palavrasChave,
  executar: () => {},
});

test("normalizar remove acento e caixa", () => {
  assert.equal(normalizar("José ÁVILA"), "jose avila");
});

test("filtrarComandos com termo vazio devolve todos na ordem", () => {
  const itens = [item("a", "Exportar"), item("b", "Sair")];
  assert.deepEqual(filtrarComandos(itens, "  ").map((i) => i.id), ["a", "b"]);
});

test("filtrarComandos ignora acento e usa palavras-chave", () => {
  const itens = [item("a", "Histórico"), item("b", "Trocar senha", ["password"]), item("c", "Sair")];
  assert.deepEqual(filtrarComandos(itens, "historico").map((i) => i.id), ["a"]);
  assert.deepEqual(filtrarComandos(itens, "PASS").map((i) => i.id), ["b"]);
});

test("filtrarComandos põe quem começa com o termo primeiro", () => {
  const itens = [item("a", "Nova atividade"), item("b", "Atividades da turma")];
  assert.deepEqual(filtrarComandos(itens, "ativ").map((i) => i.id), ["b", "a"]);
});

test("trechosDestacados marca a ocorrência preservando o texto original", () => {
  assert.deepEqual(trechosDestacados("Carla Souza", "car"), [
    { texto: "Car", destaque: true },
    { texto: "la Souza", destaque: false },
  ]);
});

test("trechosDestacados casa sem acento e no meio do texto", () => {
  assert.deepEqual(trechosDestacados("João Conceição", "conceicao"), [
    { texto: "João ", destaque: false },
    { texto: "Conceição", destaque: true },
  ]);
});

test("trechosDestacados sem termo ou sem ocorrência devolve o texto inteiro", () => {
  assert.deepEqual(trechosDestacados("Bruno", ""), [{ texto: "Bruno", destaque: false }]);
  assert.deepEqual(trechosDestacados("Bruno", "xyz"), [{ texto: "Bruno", destaque: false }]);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com erro de módulo não encontrado (`./comandos`).

- [ ] **Step 4: Implementar `src/lib/comandos.ts`**

```ts
/** Lógica pura da paleta de comandos (Ctrl+K) — sem React, testada em comandos.test.ts. */

export type ItemComando = {
  id: string;
  grupo: "Alunos" | "Turmas" | "Ações";
  rotulo: string;
  detalhe?: string;
  palavrasChave?: string[];
  executar: () => void;
};

/** Minúsculas e sem acento, pra "José" casar com "jose". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filtrarComandos(itens: ItemComando[], termo: string): ItemComando[] {
  const alvo = normalizar(termo.trim());
  if (!alvo) return itens;
  const pontuados: { item: ItemComando; pontos: number; ordem: number }[] = [];
  itens.forEach((item, ordem) => {
    const rotulo = normalizar(item.rotulo);
    const extras = (item.palavrasChave ?? []).map(normalizar);
    if (rotulo.startsWith(alvo)) pontuados.push({ item, pontos: 0, ordem });
    else if (rotulo.includes(alvo) || extras.some((p) => p.includes(alvo))) pontuados.push({ item, pontos: 1, ordem });
  });
  return pontuados.sort((a, b) => a.pontos - b.pontos || a.ordem - b.ordem).map((p) => p.item);
}

export function trechosDestacados(texto: string, termo: string): { texto: string; destaque: boolean }[] {
  const alvo = normalizar(termo.trim());
  if (!alvo) return [{ texto, destaque: false }];

  // Normaliza caractere a caractere, guardando de qual índice do original veio cada caractere normalizado.
  const chars = Array.from(texto);
  let normalizado = "";
  const origem: number[] = [];
  let posicao = 0;
  for (const ch of chars) {
    const n = normalizar(ch);
    for (let k = 0; k < n.length; k++) origem.push(posicao);
    normalizado += n;
    posicao += ch.length;
  }

  const idx = normalizado.indexOf(alvo);
  if (idx === -1) return [{ texto, destaque: false }];
  const inicio = origem[idx];
  const ultimo = origem[idx + alvo.length - 1];
  const fim = ultimo + Array.from(texto.slice(ultimo))[0].length;

  const partes: { texto: string; destaque: boolean }[] = [];
  if (inicio > 0) partes.push({ texto: texto.slice(0, inicio), destaque: false });
  partes.push({ texto: texto.slice(inicio, fim), destaque: true });
  if (fim < texto.length) partes.push({ texto: texto.slice(fim), destaque: false });
  return partes;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: PASS nos 7 testes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/comandos.ts src/lib/comandos.test.ts package.json
git commit -m "Adiciona logica pura de filtro e destaque do Ctrl+K com testes"
git push origin master
```

---

### Task 7: Turma — cabeçalho, abas de bimestre, KPIs e gráficos

**Files:**
- Create: `src/components/turma/BimestreAbas.tsx`
- Modify: `src/components/turma/TurmaDashboard.tsx` (arquivo inteiro)
- Modify: `src/components/turma/KpiCards.tsx` (arquivo inteiro)
- Modify: `src/components/turma/AnaliseAprendizagem.tsx` (cores)
- Modify: `src/components/turma/CriarBimestreModal.tsx` (usar `Modal`)
- Modify: `src/app/turma/[turmaId]/page.tsx:15-18,58-70`
- Delete: `src/components/turma/TurmaHeader.tsx`, `src/components/turma/FiltrosTurma.tsx`

**Interfaces:**
- Consumes: `PageLayout`, `Modal`, `estilos`.
- Produces:
  - `BimestreAbas(props: { turma: Turma; todasTurmas: Turma[] })`.
  - `TurmaDashboard` perde a prop `professorNome` e ganha `alunoFoco: { id: string; chave: string } | null` (consumida na Task 8 e na Task 10).
  - `PlanilhaGrid` passa a receber `alunoFocoId: string | null` e `onAlunoFocoConsumido: () => void` (implementado na Task 8; nesta task o dashboard já passa as props e o grid só as declara no tipo).

- [ ] **Step 1: Criar `src/components/turma/BimestreAbas.tsx`**

Reaproveita a lógica de `FiltrosTurma` (troca de série e bimestre, `proximoBimestre`, `CriarBimestreModal`) com o visual de controle segmentado sobre a moldura.

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Turma } from "@/lib/types";
import { CriarBimestreModal } from "./CriarBimestreModal";

type BimestreAbasProps = {
  turma: Turma;
  todasTurmas: Turma[];
};

function proximoBimestre(atual: string): string {
  const m = atual.match(/(\d+)/);
  if (!m) return "";
  return atual.replace(/\d+/, String(parseInt(m[1], 10) + 1));
}

/** "1º Bimestre" → "1º Bim" pra caber nas abas. */
function rotuloCurto(bimestre: string): string {
  return bimestre.replace(/bimestre/i, "Bim").trim();
}

export function BimestreAbas({ turma, todasTurmas }: BimestreAbasProps) {
  const router = useRouter();
  const [criarBimestreAberto, setCriarBimestreAberto] = useState(false);

  const seriesUnicas = useMemo(() => {
    const vistos = new Set<string>();
    return todasTurmas.filter((t) => {
      if (vistos.has(t.nome)) return false;
      vistos.add(t.nome);
      return true;
    });
  }, [todasTurmas]);

  const bimestresDaTurma = useMemo(
    () => todasTurmas.filter((t) => t.nome === turma.nome).sort((a, b) => a.bimestre.localeCompare(b.bimestre)),
    [todasTurmas, turma.nome]
  );

  function handleTrocarSerie(novoNome: string) {
    const mesmoBimestre = todasTurmas.find((t) => t.nome === novoNome && t.bimestre === turma.bimestre);
    const alvo = mesmoBimestre ?? todasTurmas.find((t) => t.nome === novoNome);
    if (alvo) router.push(`/turma/${alvo.id}`);
  }

  return (
    <>
      <select
        aria-label="Turma"
        value={turma.nome}
        onChange={(e) => handleTrocarSerie(e.target.value)}
        className="min-h-9 rounded-control border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white outline-none focus:border-gold [&>option]:text-ink"
      >
        {seriesUnicas.map((t) => (
          <option key={t.nome} value={t.nome}>
            {t.nome}
          </option>
        ))}
      </select>

      <nav aria-label="Bimestres" className="flex items-center gap-0.5 rounded-control border border-white/15 bg-white/10 p-0.5">
        {bimestresDaTurma.map((t) => {
          const ativo = t.id === turma.id;
          return (
            <Link
              key={t.id}
              href={`/turma/${t.id}`}
              aria-current={ativo ? "page" : undefined}
              className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${
                ativo ? "bg-surface text-brand shadow-sm" : "text-frame-muted hover:bg-white/10 hover:text-white"
              }`}
            >
              {rotuloCurto(t.bimestre)}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setCriarBimestreAberto(true)}
          aria-label="Criar novo bimestre para esta turma"
          title="Criar novo bimestre para esta turma"
          className="rounded-[8px] px-2 py-1.5 text-frame-muted hover:bg-white/10 hover:text-gold"
        >
          <Plus size={14} />
        </button>
      </nav>

      <CriarBimestreModal
        open={criarBimestreAberto}
        turmaId={turma.id}
        bimestreSugerido={proximoBimestre(turma.bimestre)}
        onClose={() => setCriarBimestreAberto(false)}
      />
    </>
  );
}
```

- [ ] **Step 2: Migrar `CriarBimestreModal.tsx` para o `Modal`**

Ler o arquivo. Manter props (`open`, `turmaId`, `bimestreSugerido`, `onClose`), estado e `handleSubmit`. Trocar o `<div className="fixed inset-0 …">` + painel por:

```tsx
<Modal open={open} onClose={onClose} titulo="Novo bimestre" descricao="Copia a lista de alunos desta turma para um novo período, sem atividades nem notas.">
  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
    {/* input do nome com className={estilos.input}; erro em "rounded-control bg-danger/10 px-3 py-2 text-sm text-danger" */}
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onClose} className={estilos.botaoFantasma}>Cancelar</button>
      <button type="submit" disabled={/* condição atual */} className={estilos.botaoPrimario}>{/* rótulo atual */}</button>
    </div>
  </form>
</Modal>
```

Usar o nome real do handler e do estado encontrados no arquivo. Se o texto da descrição diferir do que o modal diz hoje, manter o texto atual.

- [ ] **Step 3: Reescrever `KpiCards.tsx`**

```tsx
import { Star, TrendingDown, Users } from "lucide-react";

type KpiCardsProps = {
  totalAlunos: number;
  taxaCritico: number;
  mediaTurma: number | null;
};

function KpiCard({
  icone,
  corIcone,
  label,
  valor,
  corValor = "text-ink",
  destaque = false,
}: {
  icone: React.ReactNode;
  corIcone: string;
  label: string;
  valor: string;
  corValor?: string;
  destaque?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-card border border-white bg-surface px-4 py-3 shadow-[0_8px_28px_rgb(10_42_110_/_0.12)] ${destaque ? "border-t-[3px] border-t-gold" : ""}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${corIcone}`}>{icone}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted">{label}</div>
        <div className={`font-mono text-2xl font-semibold tabular-nums ${corValor}`}>{valor}</div>
      </div>
    </div>
  );
}

export function KpiCards({ totalAlunos, taxaCritico, mediaTurma }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard icone={<Users size={18} />} corIcone="bg-brand/10 text-brand" label="Total de alunos" valor={String(totalAlunos)} />
      <KpiCard
        icone={<TrendingDown size={18} />}
        corIcone="bg-danger/10 text-danger"
        label="Rendimento crítico"
        valor={`${taxaCritico.toFixed(0)}%`}
        corValor="text-danger"
      />
      <KpiCard
        icone={<Star size={18} />}
        corIcone="bg-gold/40 text-gold-ink"
        label="Média da turma"
        valor={mediaTurma !== null ? mediaTurma.toFixed(2) : "—"}
        corValor="text-brand"
        destaque
      />
    </div>
  );
}
```

- [ ] **Step 4: Reescrever `TurmaDashboard.tsx`**

Mantém todo o estado e cálculo atuais. Mudanças: `PageLayout` com as `BimestreAbas`, KPIs fora do `<details>`, segmented control Notas/Frequência no tema, e as props de foco do aluno.

```tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarCheck2, ClipboardList } from "lucide-react";
import type { Aluno, AtividadeColuna, TipoColuna, Turma } from "@/lib/types";
import { celulasIniciaisDe, type CelulasMap, type NotaCelulaComAutor } from "@/lib/celulas";
import { mediaAluno, mediaDeValores, paraEscala10 } from "@/lib/analytics";
import { PlanilhaGrid } from "@/components/grid/PlanilhaGrid";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";
import { BimestreAbas } from "./BimestreAbas";
import { KpiCards } from "./KpiCards";
import { AnaliseAprendizagem } from "./AnaliseAprendizagem";

type TurmaDashboardProps = {
  turma: Turma;
  todasTurmas: Turma[];
  colunasIniciais: AtividadeColuna[];
  alunosIniciais: Aluno[];
  notasIniciais: NotaCelulaComAutor[];
  /** Vem de ?aluno=<id>&t=<nonce> (Ctrl+K). `chave` muda a cada pedido, mesmo pro mesmo aluno. */
  alunoFoco: { id: string; chave: string } | null;
};

export function TurmaDashboard({
  turma,
  todasTurmas,
  colunasIniciais,
  alunosIniciais,
  notasIniciais,
  alunoFoco,
}: TurmaDashboardProps) {
  const [colunas, setColunas] = useState(colunasIniciais);
  const [alunos, setAlunos] = useState(alunosIniciais);
  const [celulas, setCelulas] = useState<CelulasMap>(() => celulasIniciaisDe(notasIniciais));
  const [maximizado, setMaximizado] = useState(false);
  const [aba, setAba] = useState<TipoColuna>("nota");
  const [salvamentosPendentes, setSalvamentosPendentes] = useState(0);
  const handlePendentesChange = useCallback((delta: number) => {
    setSalvamentosPendentes((total) => total + delta);
  }, []);

  // Pedido de abrir o drawer de um aluno: guardado até o grid consumir, e renovado quando a chave muda.
  const [alunoFocoId, setAlunoFocoId] = useState<string | null>(alunoFoco?.id ?? null);
  const [chaveFocoAnterior, setChaveFocoAnterior] = useState(alunoFoco?.chave ?? null);
  if ((alunoFoco?.chave ?? null) !== chaveFocoAnterior) {
    setChaveFocoAnterior(alunoFoco?.chave ?? null);
    setAlunoFocoId(alunoFoco?.id ?? null);
  }

  const colunasNota = useMemo(() => colunas.filter((c) => c.tipo !== "presenca"), [colunas]);
  const colunasPresenca = useMemo(() => colunas.filter((c) => c.tipo === "presenca"), [colunas]);
  const colunasAba = aba === "presenca" ? colunasPresenca : colunasNota;

  const handleColunasAbaChange = useCallback(
    (subset: AtividadeColuna[]) => {
      setColunas((prev) => [...prev.filter((c) => c.tipo !== aba), ...subset]);
    },
    [aba]
  );

  const mediaTurma10 = useMemo(() => {
    const valores = Object.values(celulas)
      .flatMap((linha) => Object.values(linha))
      .map((c) => c.valor)
      .filter((v): v is number => v !== null);
    const media = mediaDeValores(valores);
    return media !== null ? paraEscala10(media) : null;
  }, [celulas]);

  const taxaCritico = useMemo(() => {
    if (alunos.length === 0) return 0;
    const criticos = alunos.filter((a) => {
      const media = mediaAluno(celulas[a.id]);
      return media !== null && paraEscala10(media) < 6;
    }).length;
    return (criticos / alunos.length) * 100;
  }, [alunos, celulas]);

  const abaClasse = (ativa: boolean) =>
    `flex min-h-10 items-center gap-1.5 rounded-[8px] px-3 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
      ativa ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"
    }`;

  return (
    <PageLayout
      crumb={`Turmas / Redação · ${turma.ano_letivo}`}
      titulo={turma.nome}
      acoes={<BimestreAbas turma={turma} todasTurmas={todasTurmas} />}
    >
      {!maximizado && (
        <KpiCards totalAlunos={alunos.length} taxaCritico={taxaCritico} mediaTurma={mediaTurma10} />
      )}

      {!maximizado && (
        <details className={`${estilos.card} p-4`}>
          <summary className="cursor-pointer rounded text-sm font-semibold text-brand">
            Análise da turma
          </summary>
          <div className="mt-4">
            <AnaliseAprendizagem colunas={colunasNota} alunos={alunos} celulas={celulas} />
          </div>
        </details>
      )}

      <div className="inline-flex w-fit items-center gap-1 rounded-control border border-line bg-surface-sunken p-1">
        <button type="button" aria-pressed={aba === "nota"} disabled={salvamentosPendentes > 0} onClick={() => setAba("nota")} className={abaClasse(aba === "nota")}>
          <ClipboardList size={15} />
          Notas
        </button>
        <button type="button" aria-pressed={aba === "presenca"} disabled={salvamentosPendentes > 0} onClick={() => setAba("presenca")} className={abaClasse(aba === "presenca")}>
          <CalendarCheck2 size={15} />
          Frequência
        </button>
      </div>

      <PlanilhaGrid
        key={aba}
        turmaId={turma.id}
        turmaNome={turma.nome}
        turmaBimestre={turma.bimestre}
        tipoColuna={aba}
        colunas={colunasAba}
        alunos={alunos}
        celulas={celulas}
        todasTurmas={todasTurmas}
        onColunasChange={handleColunasAbaChange}
        onAlunosChange={setAlunos}
        onCelulasChange={setCelulas}
        onPendentesChange={handlePendentesChange}
        maximizado={maximizado}
        onToggleMaximizar={() => setMaximizado((m) => !m)}
        alunoFocoId={alunoFocoId}
        onAlunoFocoConsumido={() => setAlunoFocoId(null)}
      />
    </PageLayout>
  );
}
```

Confirmar em `src/lib/types.ts` que `Turma` tem `ano_letivo`; `TransferirAlunoModal` já o usa.

- [ ] **Step 5: Declarar as props novas no `PlanilhaGrid` (implementação na Task 8)**

Em `src/components/grid/PlanilhaGrid.tsx`, no tipo `PlanilhaGridProps`, adicionar:

```ts
  alunoFocoId: string | null;
  onAlunoFocoConsumido: () => void;
```

E adicionar `alunoFocoId, onAlunoFocoConsumido,` à desestruturação das props (após `onToggleMaximizar,`).

- [ ] **Step 6: Atualizar `src/app/turma/[turmaId]/page.tsx`**

Tipo das props:

```tsx
type PageProps = {
  params: Promise<{ turmaId: string }>;
  searchParams: Promise<{ aluno?: string; t?: string }>;
};

export default async function TurmaPage({ params, searchParams }: PageProps) {
  const { turmaId } = await params;
  const { aluno: alunoParam, t } = await searchParams;
```

E o `return`, trocando o `<main>` (o `PageLayout` já renderiza o `<main>`):

```tsx
  return (
    <TurmaDashboard
      turma={turma}
      todasTurmas={todasTurmas.length > 0 ? todasTurmas : [turma]}
      colunasIniciais={colunas ?? []}
      alunosIniciais={alunos ?? []}
      notasIniciais={notasComAutor}
      alunoFoco={alunoParam ? { id: alunoParam, chave: `${alunoParam}|${t ?? ""}` } : null}
    />
  );
```

- [ ] **Step 7: Cores dos gráficos em `AnaliseAprendizagem.tsx`**

- `#2563eb` (linha, gradiente, dot, barras) → `#0444A0` (brand).
- Grade (`CartesianGrid` com `className="text-neutral-200 …"`) → `className="text-line-soft"`.
- Eixos (`stroke="currentColor"` com `text-neutral-*`) → `className="text-faint"`.
- Barra ou valor abaixo do limiar crítico (se houver cor rose) → `#D6264A`.
- Aplicar o Mapa de migração nas classes de texto e cartões do arquivo. Os cards internos viram `rounded-card border border-line bg-surface p-4`, e os números ganham `font-mono tabular-nums`.

- [ ] **Step 8: Remover arquivos obsoletos**

```bash
git rm src/components/turma/TurmaHeader.tsx src/components/turma/FiltrosTurma.tsx
```

Run: `grep -rn "TurmaHeader\|FiltrosTurma\|professorNome" src`
Expected: nenhuma ocorrência.

- [ ] **Step 9: Verificar**

Run: `npm run build && npm run lint`
Expected: sem erros.

Run: `npm run dev`, abrir uma turma.
Expected: faixa azul com "Turmas / Redação · 2026", nome da turma e logo branca; abaixo, o seletor de série e as abas de bimestre, com a ativa branca e um "+" que abre o modal novo (Esc fecha); os três KPIs brancos sobrepõem a borda da faixa e a média tem filete amarelo; "Análise da turma" abre com gráficos em azul Status; trocar de bimestre por aba funciona.

- [ ] **Step 10: Commit**

```bash
git add -A src/components/turma src/components/grid/PlanilhaGrid.tsx src/app/turma
git commit -m "Turma com faixa azul, abas de bimestre, KPIs flutuantes e graficos no tema"
git push origin master
```

---

### Task 8: Planilha e células

**Files:**
- Modify: `src/components/grid/PlanilhaGrid.tsx` (seções citadas abaixo)
- Modify: `src/components/grid/CelulaNota.tsx`
- Modify: `src/lib/status.ts:22-35`

**Interfaces:**
- Consumes: `normalizar` de `@/lib/comandos` (Task 6), `estilos`, `alunoFocoId`/`onAlunoFocoConsumido` (Task 7).
- Produces:
  - `CelulaNota` ganha a prop `recemSalva: boolean`.
  - O container da célula em edição tem o atributo `data-bloqueia-atalhos`, que o Ctrl+K usa na Task 10 para não abrir durante a edição.

- [ ] **Step 1: Reusar `normalizar` no grid**

Em `PlanilhaGrid.tsx`, apagar a função local `normalizarBusca` (linhas ~37-43), importar `import { normalizar } from "@/lib/comandos";` e trocar os dois usos de `normalizarBusca(` por `normalizar(`.

- [ ] **Step 2: Implementar o foco de aluno vindo do Ctrl+K**

Após o `useEffect` que sincroniza `alunosRef`:

```tsx
  useEffect(() => {
    if (!alunoFocoId) return;
    if (alunos.some((a) => a.id === alunoFocoId)) setDrawerAlunoId(alunoFocoId);
    onAlunoFocoConsumido();
  }, [alunoFocoId, alunos, onAlunoFocoConsumido]);
```

- [ ] **Step 3: Rastrear células recém-salvas**

Junto dos outros `useState`:

```tsx
  const [recemSalvas, setRecemSalvas] = useState<Set<string>>(() => new Set());
```

No `.then` do `upsertCelula` (linha ~196), logo após o `onCelulasChange(...)` de sucesso:

```tsx
        const chaveSalva = `${aluno.id}:${coluna.id}`;
        setRecemSalvas((prev) => new Set(prev).add(chaveSalva));
        setTimeout(() => {
          setRecemSalvas((prev) => {
            const next = new Set(prev);
            next.delete(chaveSalva);
            return next;
          });
        }, 1200);
```

No `<CelulaNota …>` do corpo da tabela, adicionar:

```tsx
                        recemSalva={recemSalvas.has(`${aluno.id}:${coluna.id}`)}
```

- [ ] **Step 4: Indicador de salvamento e avisos (linhas ~496-535)**

O `<p role="status">` sai do topo e vai para a toolbar (Step 5). Os avisos ficam:
- Erro: `flex items-center justify-between rounded-control border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger`.
- Desfazer: `flex items-center justify-between rounded-control border border-brand/15 bg-brand/5 px-3 py-2 text-sm text-brand`; botão de dispensar com `text-brand/60 hover:text-brand`.

- [ ] **Step 5: Card com toolbar embutida (linhas ~537-600)**

Envolver toolbar + tabela num único card e trocar o container da tabela:

```tsx
      <div className={`${estilos.card} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
          {/* busca atual: wrapper "relative w-full max-w-56"; input com
              `${estilos.input} border-transparent bg-surface-sunken py-1.5 pl-8 pr-7` */}
          <p role="status" aria-live="polite" aria-atomic="true" className={`flex items-center gap-1.5 text-xs ${falhaSalvamento && pendentes === 0 ? "text-danger" : "text-muted"}`}>
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                pendentes > 0 ? "animate-pulse bg-gold" : falhaSalvamento ? "bg-danger" : "bg-ok shadow-[0_0_0_3px_rgb(14_159_110_/_0.15)]"
              }`}
            />
            {pendentes > 0
              ? `Salvando… (${pendentes} ${pendentes === 1 ? "alteração pendente" : "alterações pendentes"})`
              : falhaSalvamento
                ? "Uma alteração não foi salva. Confira a mensagem acima e tente novamente."
                : houveEdicao ? "Tudo salvo" : "Salvamento automático"}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Ordenar A–Z, Maximizar, Exportar: className={estilos.botaoSecundario} com "min-h-9 py-1.5" */}
            {/* Gerenciar atividades/chamadas: className={estilos.botaoPrimario} com "min-h-9 py-1.5";
                ícone Settings2 com className="text-gold" */}
          </div>
        </div>
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full table-fixed border-separate border-spacing-0">
            {/* thead/tbody abaixo */}
          </table>
        </div>
      </div>
```

A mensagem de falha agora diz "acima", porque o aviso de erro fica antes do card. Manter todos os handlers, `disabled`, `title` e rótulos atuais dos botões.

- [ ] **Step 6: Cabeçalho da tabela (linhas ~602-642)**

- `<tr>`: sem classe de fundo.
- Todo `<th>`: remover `border border-neutral-200 … dark:*` e usar `border-b border-line bg-surface-sunken px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted`. As colunas fixas (`Nº`, nome) mantêm `sticky top-0 left-… z-20` e as larguras.
- Botão da coluna de atividade: `inline-flex max-w-full items-center justify-center gap-1 rounded-[6px] border border-line bg-surface px-2 py-1 normal-case tracking-normal text-ink transition hover:border-brand-bright/50 hover:text-brand active:scale-95`.
- Coluna de data (`ehData`): `inline-flex max-w-full items-center justify-center gap-1 rounded-[6px] border border-dashed border-line bg-surface px-2 py-1 normal-case tracking-normal text-muted transition hover:border-brand-bright/50 hover:text-brand active:scale-95`.
- `<th>` da média: adicionar `border-l border-line`.

- [ ] **Step 7: Linhas (linhas ~645-850)**

- Linha vazia de busca: `px-3 py-6 text-center text-sm text-faint`.
- `bgLinha`: `const bgLinha = zebra ? "bg-zebra" : "bg-surface";`, e o `<tr>` usa `group ${bgLinha} …`. O alvo de arrastar passa a `outline-2 -outline-offset-2 outline-brand-bright`.
- Todos os `<td>`: trocar `border border-neutral-200 … dark:*` por `border-t border-line-soft`.
- `<td>` do Nº: `sticky left-0 z-[5] border-t border-line-soft ${bgLinha} px-1 py-1.5 text-center font-mono text-[11px] tabular-nums text-faint`; o grip usa `text-faint`.
- `<td>` do nome: `sticky left-12 sm:left-16 z-[5] border-t border-line-soft ${bgLinha} px-3 py-1.5 text-sm`; input de renomear com `w-full rounded-[6px] border border-brand bg-surface px-1.5 py-0.5 text-sm outline-none ring-2 ring-brand/15`; botão do nome com `flex w-full items-center gap-2 text-left font-semibold text-ink hover:text-brand`.
- Selo "editado": `rounded px-1 py-px text-muted ring-1 ring-line`. Selo de transferido: `inline-flex items-center gap-0.5 rounded bg-warn/10 px-1 py-px font-bold text-warn`.
- `<td>` das células: `border-t border-line-soft p-0`.
- `<td>` da média:

```tsx
                  <td
                    className={`border-t border-l border-line-soft border-l-line bg-surface-sunken px-2 py-1.5 text-center font-mono text-sm font-bold tabular-nums ${
                      critico ? "text-danger" : "text-ink"
                    }`}
                  >
                    {valorResumo !== null ? (
                      <>
                        {critico && <span aria-hidden="true" className="mr-0.5 align-[2px] text-[8px]">▼</span>}
                        {critico && <span className="sr-only">Crítico: </span>}
                        {tipoColuna === "presenca" ? `${valorResumo.toFixed(0)}%` : valorResumo.toFixed(2)}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
```

- Ações da linha: `<td className="border-t border-line-soft text-center">`. Os três botões usam `rounded-control p-1.5 text-faint transition hover:bg-surface-sunken active:scale-90`, mais `hover:text-brand` (editar), `hover:text-warn` (transferir) e `hover:text-danger` (excluir).

- [ ] **Step 8: Rodapé de adicionar alunos (linhas ~852-915)**

Aplicar o Mapa: textarea e input com `estilos.input` (manter `w-64` no input único e `resize-y` na textarea); botões de confirmar com `estilos.botaoPrimario`; cancelar com `estilos.botaoFantasma`; link "vários de uma vez" com `text-muted hover:text-brand`. Rótulo: `estilos.rotulo`. Container: `${estilos.card} flex flex-col gap-2 p-3`.

- [ ] **Step 9: `CelulaNota.tsx`**

Adicionar `recemSalva: boolean;` ao tipo e à desestruturação.

Containers de edição (os dois `return` com `editing`): trocar a classe por

```tsx
        data-bloqueia-atalhos
        className="relative flex items-center gap-1 rounded-[6px] border-2 border-brand bg-surface px-1 py-1 shadow-[0_6px_18px_rgb(4_68_160_/_0.2)]"
```

Input de edição: `min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none`. Select de status rápido: `w-8 shrink-0 rounded-[6px] border border-line bg-surface text-xs text-muted`.

Célula em repouso (último `return`):

```tsx
      className={`flex min-h-11 items-center justify-between gap-1 px-2 py-1.5 text-sm outline-none transition-colors ${
        active
          ? "bg-brand-bright/5 ring-2 ring-inset ring-brand-bright"
          : "hover:bg-brand-bright/[0.03]"
      } ${recemSalva ? "animate-salvo" : ""}`}
```

Valor numérico: `<span className="font-mono tabular-nums text-ink">`. Chip de status: `rounded-[6px] px-1.5 py-0.5 text-[10px] font-bold tracking-wide`. Lápis: `shrink-0 text-faint opacity-0 transition group-hover:opacity-100 hover:text-brand`, e adicionar `group` à classe do container.

- [ ] **Step 10: Cores de status em `src/lib/status.ts`**

```ts
export function corStatus(): string {
  return "bg-surface-sunken text-muted";
}

/** Badge verde/vermelho pra presença — aqui a cor ajuda a bater o olho na chamada do dia. */
export function corPresenca(status: string): string {
  const s = status.trim().toUpperCase();
  if (s === "P") return "bg-ok/15 text-ok";
  if (s === "F") return "bg-danger/10 text-danger";
  return corStatus();
}
```

- [ ] **Step 11: Verificar**

Run: `npm run build && npm run lint && npm test`
Expected: tudo limpo, 7 testes passando.

Run: `npm run dev`, abrir uma turma, e percorrer toda a checagem de regressão da planilha:
1. Clicar numa célula: contorno azul brilhante.
2. Enter ou digitar para editar: borda azul com sombra e fonte mono.
3. Enter salva: a célula pisca em verde claro por ~1s; o indicador passa de "Salvando…" (ponto amarelo pulsando) para "Tudo salvo" (ponto verde).
4. Setas e Tab navegam; Esc cancela a edição.
5. Status rápido (`•••`) aplica NF/FALTOU como chip neutro.
6. Aba Frequência: P verde, F vermelho; `%` com ▼ quando abaixo de 75.
7. Média abaixo de 6 em vermelho com ▼.
8. Renomear aluno, arrastar linha, Ordenar A–Z, Ctrl+Z desfaz.
9. Exportar Excel baixa o arquivo; Maximizar esconde KPIs e análise.
10. Buscar aluno filtra, inclusive ignorando acento.
11. Em 390px, a tabela rola na horizontal dentro do card e a página não rola na horizontal.

- [ ] **Step 12: Commit**

```bash
git add src/components/grid/PlanilhaGrid.tsx src/components/grid/CelulaNota.tsx src/lib/status.ts
git commit -m "Planilha no tema Hibrido: card com toolbar, estados de celula e flash de salvo"
git push origin master
```

---

### Task 9: Modais, drawer do aluno e admin

**Files:**
- Modify: `src/components/grid/TransferirAlunoModal.tsx` (arquivo inteiro)
- Modify: `src/components/grid/EstatisticaColunaModal.tsx`, `src/components/grid/GestaoColunasModal.tsx`
- Modify: `src/components/aluno/AlunoDashboardDrawer.tsx`
- Modify: `src/app/admin/professores/page.tsx`, `src/app/admin/historico/page.tsx`, `src/components/admin/GerenciarProfessores.tsx`, `src/components/admin/HistoricoTable.tsx`, `src/components/admin/CodigoConvite.tsx`

**Interfaces:**
- Consumes: `Modal`, `estilos`, `PageLayout`, Mapa de migração.

- [ ] **Step 1: Reescrever `TransferirAlunoModal.tsx` (modelo para os demais)**

```tsx
"use client";

import { useState } from "react";
import type { Turma } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { estilos } from "@/components/ui/estilos";

type TransferirAlunoModalProps = {
  aluno: { id: string; nome: string } | null;
  turmaAtualId: string;
  turmasDisponiveis: Turma[];
  onClose: () => void;
  onConfirmar: (turmaDestinoId: string) => Promise<void>;
};

export function TransferirAlunoModal({
  aluno,
  turmaAtualId,
  turmasDisponiveis,
  onClose,
  onConfirmar,
}: TransferirAlunoModalProps) {
  const [turmaDestinoId, setTurmaDestinoId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const opcoes = turmasDisponiveis.filter((t) => t.id !== turmaAtualId);

  function fechar() {
    setTurmaDestinoId("");
    setErro(null);
    onClose();
  }

  async function handleConfirmar() {
    if (!turmaDestinoId || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar(turmaDestinoId);
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível transferir o aluno.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open={aluno !== null}
      onClose={fechar}
      titulo={`Transferir ${aluno?.nome ?? ""}`}
      descricao="As notas já lançadas são levadas junto: atividades com o mesmo título na turma de destino recebem a nota dele; as que não existirem lá são criadas automaticamente."
      rodape={
        <>
          <button type="button" onClick={fechar} className={estilos.botaoFantasma}>
            Cancelar
          </button>
          <button type="button" onClick={handleConfirmar} disabled={!turmaDestinoId || enviando} className={estilos.botaoPrimario}>
            {enviando ? "Transferindo..." : "Transferir"}
          </button>
        </>
      }
    >
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      <select aria-label="Turma de destino" value={turmaDestinoId} onChange={(e) => setTurmaDestinoId(e.target.value)} className={estilos.input}>
        <option value="">Selecione a turma de destino</option>
        {opcoes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome} — {t.bimestre} ({t.ano_letivo})
          </option>
        ))}
      </select>
    </Modal>
  );
}
```

- [ ] **Step 2: `EstatisticaColunaModal.tsx` e `GestaoColunasModal.tsx`**

Mesmo padrão do Step 1:
1. Ler o arquivo inteiro. Manter props, estado e handlers.
2. Trocar o wrapper `fixed inset-0 …` + painel + cabeçalho com `X` por `<Modal open={…} onClose={onClose} titulo={…} largura="sm|md">`. `open` é a condição que hoje faz o componente retornar `null`, por exemplo `coluna !== null`. O `early return null` sai se o `Modal` passar a cobrir o caso; se o corpo depender do objeto não nulo, calcule os dados com guarda (`coluna ? … : …`) antes do JSX.
3. Botões de rodapé vão para `rodape`.
4. Mini-cards de estatística: `rounded-control border border-line bg-surface-sunken px-3 py-2`, com rótulo `text-xs text-muted` e valor `font-mono text-lg font-semibold tabular-nums text-ink`.
5. Aplicar o Mapa de migração no restante. `GestaoColunasModal` usa `largura="md"`.

- [ ] **Step 3: `AlunoDashboardDrawer.tsx`**

Manter a estrutura de painel lateral (não usar `Modal`, que é centralizado):
- Overlay: `absolute inset-0 bg-frame-deep/40 backdrop-blur-sm`.
- Painel: `relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-canvas shadow-float`.
- Cabeçalho (bloco com `Avatar`, nome e botão X): envolver em `<div className="bg-frame px-5 pt-5 pb-10 text-white">`, com nome em `font-display text-lg font-semibold`, subtítulo em `text-xs text-frame-muted` e botão X em `rounded-control p-1.5 text-frame-muted hover:bg-white/10 hover:text-white`.
- Conteúdo abaixo: `<div className="-mt-6 flex flex-col gap-5 px-5 pb-5">`, com os `StatTile` em `rounded-card border border-white bg-surface px-3 py-2 shadow-card` e valor `font-mono text-xl font-semibold tabular-nums`.
- Adicionar `useEffect` para fechar com Esc:

```tsx
  useEffect(() => {
    if (!aluno) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aluno, onClose]);
```

(Posicionar antes do `if (!aluno) return null;` e importar `useEffect` se ainda não estiver importado.)
- Gráfico: `#2563eb` → `#0444A0`; `CartesianGrid` com `className="text-line-soft"`; eixos com `className="text-faint"`.
- Mapa de migração no restante.

- [ ] **Step 4: Páginas admin**

`src/app/admin/professores/page.tsx` e `src/app/admin/historico/page.tsx`:
1. Ler cada arquivo inteiro.
2. Trocar o `<main …>` + link "Voltar" + `h1` + parágrafo por `<PageLayout crumb="Administração" titulo="…mesmo título…" subtitulo="…mesmo parágrafo…" largura="max-w-3xl|max-w-4xl" acoes={…}>`, mantendo a largura atual de cada página.
3. Links de ação do cabeçalho (ex.: "Histórico" em professores, "Voltar" em histórico) vão para `acoes` com `className="inline-flex items-center gap-1.5 rounded-control border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"`.
4. O conteúdo (componentes) fica como `children`. O primeiro bloco deve ser um card (`estilos.card`) para flutuar sobre a faixa.

`GerenciarProfessores.tsx`, `HistoricoTable.tsx`, `CodigoConvite.tsx`: aplicar o Mapa de migração. Tabelas no mesmo estilo da planilha: `th` com `bg-surface-sunken text-[10px] font-bold uppercase tracking-[0.1em] text-muted`, linhas com `border-t border-line-soft` e zebra `bg-zebra`, datas e números com `font-mono tabular-nums`. O código de convite em `CodigoConvite` usa `font-mono text-lg tracking-widest text-brand`. Selo de papel "admin" usa `bg-gold/40 text-gold-ink`.

- [ ] **Step 5: Verificar**

Run: `npm run build && npm run lint`
Expected: sem erros.

Run: `npm run dev` e conferir:
1. Transferir aluno (abrir, Esc fecha, confirmar transfere).
2. Clicar no título de uma coluna para ver a estatística.
3. Gerenciar atividades: criar, renomear e excluir coluna.
4. Clicar no nome do aluno: drawer com cabeçalho azul; Esc e clique fora fecham.
5. Como admin, `/admin/professores` e `/admin/historico` com faixa azul, filtros e paginação do histórico funcionando.

- [ ] **Step 6: Commit**

```bash
git add src/components/grid src/components/aluno src/components/admin src/app/admin
git commit -m "Modais, drawer do aluno e admin no tema Hibrido"
git push origin master
```

---

### Task 10: Paleta de comandos (Ctrl+K)

**Files:**
- Create: `src/actions/busca.ts`
- Create: `src/components/command/CommandProvider.tsx`
- Create: `src/components/command/CommandPalette.tsx`
- Modify: `src/app/layout.tsx` (montar provider e paleta)
- Modify: `src/components/layout/Sidebar.tsx` (botão de busca via contexto)
- Modify: `src/components/grid/PlanilhaGrid.tsx` (registrar ações contextuais)

**Interfaces:**
- Consumes: `ItemComando`, `filtrarComandos`, `trechosDestacados` (Task 6); `listarTurmasAcessiveis()`; `turmasLiberadasPara(professor)`; `logout`.
- Produces:
  - `buscarAlunos(termo: string): Promise<AlunoBusca[]>`, com `type AlunoBusca = { id: string; nome: string; turmaId: string; turmaNome: string; turmaBimestre: string }`.
  - `CommandProvider({ children })`, `useComandos(): { aberto: boolean; abrir: () => void; fechar: () => void; acoesContextuais: ItemComando[]; registrarAcoes: (acoes: ItemComando[]) => () => void }`.
  - `CommandPalette({ turmas: Turma[]; ehAdmin: boolean })`.

- [ ] **Step 1: Criar `src/actions/busca.ts`**

```ts
"use server";

import { supabase } from "@/lib/supabase/client";
import { getProfessorAtual, turmasLiberadasPara } from "@/lib/auth";

export type AlunoBusca = {
  id: string;
  nome: string;
  turmaId: string;
  turmaNome: string;
  turmaBimestre: string;
};

/**
 * Busca de alunos pelo nome pro Ctrl+K. Só devolve alunos de turmas que o
 * professor logado pode acessar; sem login, não devolve nada.
 */
export async function buscarAlunos(termo: string): Promise<AlunoBusca[]> {
  const professor = await getProfessorAtual();
  if (!professor) return [];

  const limpo = termo.trim();
  if (limpo.length < 2) return [];
  const padrao = `%${limpo.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const { data: alunos, error } = await supabase
    .from("alunos")
    .select("id, nome, turma_id")
    .ilike("nome", padrao)
    .order("nome")
    .limit(40);
  if (error) throw new Error(error.message);
  if (!alunos || alunos.length === 0) return [];

  const turmaIds = [...new Set(alunos.map((a) => a.turma_id))];
  const { data: turmas, error: erroTurmas } = await supabase
    .from("turmas")
    .select("id, nome, bimestre")
    .in("id", turmaIds);
  if (erroTurmas) throw new Error(erroTurmas.message);

  const liberadas = await turmasLiberadasPara(professor);
  const turmaPorId = new Map((turmas ?? []).map((t) => [t.id, t]));

  const resultado: AlunoBusca[] = [];
  for (const a of alunos) {
    const turma = turmaPorId.get(a.turma_id);
    if (!turma) continue;
    if (liberadas !== null && !liberadas.has(turma.nome)) continue;
    resultado.push({ id: a.id, nome: a.nome, turmaId: turma.id, turmaNome: turma.nome, turmaBimestre: turma.bimestre });
    if (resultado.length === 8) break;
  }
  return resultado;
}
```

- [ ] **Step 2: Criar `src/components/command/CommandProvider.tsx`**

```tsx
"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ItemComando } from "@/lib/comandos";

type ComandosContexto = {
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
  acoesContextuais: ItemComando[];
  /** Registra ações da página atual (ex.: "Exportar Excel" na turma). Devolve a função de remoção. */
  registrarAcoes: (acoes: ItemComando[]) => () => void;
};

const Contexto = createContext<ComandosContexto | null>(null);

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [registros, setRegistros] = useState<{ chave: number; acoes: ItemComando[] }[]>([]);

  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);

  const registrarAcoes = useCallback((acoes: ItemComando[]) => {
    const chave = Math.random();
    setRegistros((prev) => [...prev, { chave, acoes }]);
    return () => setRegistros((prev) => prev.filter((r) => r.chave !== chave));
  }, []);

  const valor = useMemo(
    () => ({ aberto, abrir, fechar, acoesContextuais: registros.flatMap((r) => r.acoes), registrarAcoes }),
    [aberto, abrir, fechar, registros, registrarAcoes]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useComandos(): ComandosContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useComandos precisa estar dentro de <CommandProvider>");
  return ctx;
}

/** Versão tolerante pra componentes que também renderizam fora do provider (ex.: páginas deslogadas). */
export function useComandosOpcional(): ComandosContexto | null {
  return useContext(Contexto);
}
```

- [ ] **Step 3: Criar `src/components/command/CommandPalette.tsx`**

```tsx
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, History, KeyRound, LogOut, Search, Users } from "lucide-react";
import type { Turma } from "@/lib/types";
import { filtrarComandos, trechosDestacados, type ItemComando } from "@/lib/comandos";
import { buscarAlunos, type AlunoBusca } from "@/actions/busca";
import { logout } from "@/actions/auth";
import { useComandos } from "./CommandProvider";

type CommandPaletteProps = {
  turmas: Turma[];
  ehAdmin: boolean;
};

const ORDEM_GRUPOS: ItemComando["grupo"][] = ["Alunos", "Turmas", "Ações"];

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function CommandPalette({ turmas, ehAdmin }: CommandPaletteProps) {
  const router = useRouter();
  const { aberto, abrir, fechar, acoesContextuais } = useComandos();
  const [termo, setTermo] = useState("");
  const [alunos, setAlunos] = useState<AlunoBusca[]>([]);
  const [indice, setIndice] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listaId = useId();

  // Atalho global. Não abre enquanto uma célula da planilha está em edição.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
      const alvo = e.target instanceof Element ? e.target : null;
      if (alvo?.closest("[data-bloqueia-atalhos]")) return;
      e.preventDefault();
      if (aberto) fechar();
      else abrir();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, abrir, fechar]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !aberto) return;
    const anterior = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      setTermo("");
      setAlunos([]);
      setIndice(0);
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, [aberto]);

  // Busca de alunos com debounce; só com 2+ caracteres.
  useEffect(() => {
    const limpo = termo.trim();
    if (!aberto || limpo.length < 2) {
      setAlunos([]);
      return;
    }
    let cancelado = false;
    const t = setTimeout(() => {
      buscarAlunos(limpo)
        .then((r) => !cancelado && setAlunos(r))
        .catch(() => !cancelado && setAlunos([]));
    }, 200);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [termo, aberto]);

  const irPara = (href: string) => () => {
    fechar();
    router.push(href);
  };

  const itens = useMemo(() => {
    const itensAlunos: ItemComando[] = alunos.map((a) => ({
      id: `aluno-${a.id}`,
      grupo: "Alunos",
      rotulo: a.nome,
      detalhe: `${a.turmaNome} · ${a.turmaBimestre}`,
      executar: irPara(`/turma/${a.turmaId}?aluno=${a.id}&t=${Date.now()}`),
    }));
    const itensTurmas: ItemComando[] = turmas.map((t) => ({
      id: `turma-${t.id}`,
      grupo: "Turmas",
      rotulo: `${t.nome} · ${t.bimestre}`,
      executar: irPara(`/turma/${t.id}`),
    }));
    const acoesFixas: ItemComando[] = [
      { id: "ir-turmas", grupo: "Ações", rotulo: "Ir para turmas", palavrasChave: ["inicio", "home"], executar: irPara("/") },
      ...(ehAdmin
        ? ([
            { id: "ir-professores", grupo: "Ações", rotulo: "Professores", palavrasChave: ["admin"], executar: irPara("/admin/professores") },
            { id: "ir-historico", grupo: "Ações", rotulo: "Histórico de alterações", palavrasChave: ["admin", "log"], executar: irPara("/admin/historico") },
          ] satisfies ItemComando[])
        : []),
      { id: "trocar-senha", grupo: "Ações", rotulo: "Trocar senha", palavrasChave: ["senha", "password"], executar: irPara("/trocar-senha") },
      {
        id: "sair",
        grupo: "Ações",
        rotulo: "Sair",
        palavrasChave: ["logout"],
        executar: () => {
          fechar();
          void logout();
        },
      },
    ];
    // Alunos já vêm filtrados do servidor; turmas e ações filtram aqui.
    return [
      ...itensAlunos,
      ...filtrarComandos(itensTurmas, termo),
      ...filtrarComandos([...acoesContextuais, ...acoesFixas], termo),
    ];
    // irPara é recriada a cada render, mas só depende de router/fechar, que são estáveis
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunos, turmas, termo, ehAdmin, acoesContextuais]);

  const indiceSeguro = itens.length === 0 ? -1 : Math.min(indice, itens.length - 1);

  function aoTeclarNoInput(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => (itens.length ? (i + 1) % itens.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => (itens.length ? (i - 1 + itens.length) % itens.length : 0));
    } else if (e.key === "Enter" && indiceSeguro >= 0) {
      e.preventDefault();
      itens[indiceSeguro].executar();
    }
  }

  const icone = (item: ItemComando) => {
    if (item.grupo === "Alunos") return <span className="text-[10px] font-bold">{iniciais(item.rotulo)}</span>;
    if (item.grupo === "Turmas") return <GraduationCap size={14} />;
    if (item.id === "ir-professores") return <Users size={14} />;
    if (item.id === "ir-historico") return <History size={14} />;
    if (item.id === "trocar-senha") return <KeyRound size={14} />;
    if (item.id === "sair") return <LogOut size={14} />;
    return <span aria-hidden="true">→</span>;
  };

  if (!aberto) return null;

  const opcaoId = (i: number) => `${listaId}-op-${i}`;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Paleta de comandos"
      className="fixed inset-x-0 top-[12vh] mx-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-float border border-white bg-white/85 p-0 text-ink shadow-float backdrop-blur-xl backdrop-saturate-150 backdrop:bg-frame-deep/40 backdrop:backdrop-blur-sm"
      onCancel={(e) => {
        e.preventDefault();
        fechar();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) fechar();
      }}
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <Search size={18} className="shrink-0 text-faint" aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listaId}
          aria-activedescendant={indiceSeguro >= 0 ? opcaoId(indiceSeguro) : undefined}
          aria-label="Buscar alunos, turmas e ações"
          placeholder="Buscar alunos, turmas e ações…"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setIndice(0);
          }}
          onKeyDown={aoTeclarNoInput}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
        />
        <kbd className="rounded-[5px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">ESC</kbd>
      </div>

      <div id={listaId} role="listbox" aria-label="Resultados" className="max-h-[50vh] overflow-y-auto py-2">
        {itens.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">
            {termo.trim().length >= 2 ? "Nada encontrado." : "Digite para buscar."}
          </p>
        )}
        {ORDEM_GRUPOS.map((grupo) => {
          const doGrupo = itens.map((item, i) => ({ item, i })).filter(({ item }) => item.grupo === grupo);
          if (doGrupo.length === 0) return null;
          return (
            <div key={grupo} role="group" aria-label={grupo}>
              <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">{grupo}</p>
              {doGrupo.map(({ item, i }) => {
                const ativo = i === indiceSeguro;
                return (
                  <div
                    key={item.id}
                    id={opcaoId(i)}
                    role="option"
                    aria-selected={ativo}
                    onMouseMove={() => setIndice(i)}
                    onClick={() => item.executar()}
                    className={`mx-1.5 flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm ${
                      ativo ? "bg-brand/[0.06] shadow-[inset_3px_0_0_var(--color-gold)]" : ""
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${ativo ? "bg-brand text-white" : "bg-surface-sunken text-muted"}`}>
                      {icone(item)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        {trechosDestacados(item.rotulo, termo).map((p, k) =>
                          p.destaque ? (
                            <mark key={k} className="rounded-[3px] bg-gold/50 text-inherit">{p.texto}</mark>
                          ) : (
                            <span key={k}>{p.texto}</span>
                          )
                        )}
                      </span>
                      {item.detalhe && <span className="block truncate text-xs text-muted">{item.detalhe}</span>}
                    </span>
                    {ativo && (
                      <kbd className="shrink-0 rounded-[5px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">↵</kbd>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 border-t border-line bg-surface-sunken/80 px-4 py-2 text-[11px] text-muted">
        <span>↑↓ navegar</span>
        <span>↵ abrir</span>
        <span>esc fechar</span>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 4: Montar no `src/app/layout.tsx`**

Imports:

```tsx
import { CommandProvider } from "@/components/command/CommandProvider";
import { CommandPalette } from "@/components/command/CommandPalette";
import { listarTurmasAcessiveis } from "@/actions/turmas";
```

Após o bloco do `redirect` de senha provisória:

```tsx
  const turmasPaleta = professor && !professor.senha_provisoria ? await listarTurmasAcessiveis() : [];
```

E o `<body>`:

```tsx
      <body className="flex min-h-full flex-col bg-canvas md:flex-row">
        <CommandProvider>
          <Sidebar professor={professor} />
          <div className="flex min-h-full min-w-0 flex-1 flex-col">{children}</div>
          {professor && !professor.senha_provisoria && (
            <CommandPalette turmas={turmasPaleta} ehAdmin={professor.role === "admin"} />
          )}
        </CommandProvider>
      </body>
```

- [ ] **Step 5: Botão de busca na Sidebar via contexto**

Em `Sidebar.tsx`: remover a prop `onAbrirBusca` do tipo e da assinatura (volta a ser `{ professor }: { professor: Professor | null }`), importar `import { useComandosOpcional } from "@/components/command/CommandProvider";` e, dentro do componente (antes do `if (!professor) return null;`):

```tsx
  const comandos = useComandosOpcional();
  const onAbrirBusca = professor && !professor.senha_provisoria ? comandos?.abrir : undefined;
```

O JSX do botão de busca continua o mesmo da Task 3 (`{onAbrirBusca && (…)}`).

- [ ] **Step 6: Ações contextuais da turma no `PlanilhaGrid`**

Import: `import { useComandosOpcional } from "@/components/command/CommandProvider";`

Após a declaração de `handleExportar` (a função precisa existir antes):

```tsx
  const comandos = useComandosOpcional();
  const handleExportarRef = useRef(handleExportar);
  useEffect(() => {
    handleExportarRef.current = handleExportar;
  });
  useEffect(() => {
    if (!comandos) return;
    return comandos.registrarAcoes([
      {
        id: "turma-nova-coluna",
        grupo: "Ações",
        rotulo: tipoColuna === "presenca" ? "Gerenciar chamadas desta turma" : "Nova atividade nesta turma",
        palavrasChave: ["coluna", "atividade", "chamada"],
        executar: () => {
          comandos.fechar();
          setGestaoColunasAberto(true);
        },
      },
      {
        id: "turma-exportar",
        grupo: "Ações",
        rotulo: "Exportar planilha em Excel",
        palavrasChave: ["excel", "xlsx", "baixar"],
        executar: () => {
          comandos.fechar();
          void handleExportarRef.current();
        },
      },
    ]);
    // registrarAcoes/fechar são estáveis; re-registra só quando o tipo de coluna muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoColuna]);
```

Se o `useEffect` de atualização do ref gerar aviso de lint no React 19 (`react-hooks/refs`), trocar por `useEffect(() => { handleExportarRef.current = handleExportar; }, [handleExportar]);`.

- [ ] **Step 7: Verificar**

Run: `npm run build && npm run lint && npm test`
Expected: tudo limpo.

Run: `npm run dev`, logado como professor comum, e conferir:
1. `Ctrl+K` em qualquer página abre o painel de vidro, com o foco no input; `Ctrl+K` de novo ou Esc fecha, e o foco volta para onde estava.
2. Sem digitar: aparecem turmas e ações. Digitar "hist" filtra; como professor comum, "Histórico" não aparece.
3. Digitar 2+ letras de um aluno: o grupo "Alunos" aparece com turma e bimestre, e o trecho digitado grifado em amarelo.
4. Somente teclado: ↓↓ e Enter num aluno abre a turma dele com o drawer daquele aluno aberto. Repetir a busca do mesmo aluno abre o drawer de novo.
5. Dentro de uma turma: "Nova atividade nesta turma" abre o modal de colunas; "Exportar planilha em Excel" baixa o arquivo.
6. Editando uma célula (input ativo), `Ctrl+K` **não** abre a paleta.
7. Botão de lupa na sidebar abre a paleta.
8. Acesso restrito: logar com um professor de `acesso_restrito = true` e buscar o nome de um aluno de turma não liberada. O aluno não deve aparecer.
9. Em 390px, o painel ocupa a largura com 16px de margem e rola internamente.

- [ ] **Step 8: Commit**

```bash
git add src/actions/busca.ts src/components/command src/app/layout.tsx src/components/layout/Sidebar.tsx src/components/grid/PlanilhaGrid.tsx
git commit -m "Adiciona paleta de comandos Ctrl+K com busca de alunos, turmas e acoes"
git push origin master
```

---

### Task 11: Limpeza e verificação final

**Files:**
- Modify: quaisquer arquivos em `src/` com sobras
- Delete: `public/banner-cabecalho.png` (se sem uso)
- Modify: `DESIGN.md` (se algum token mudou durante a execução)

- [ ] **Step 1: Procurar sobras**

Run: `grep -rn "dark:" src`
Expected: vazio. Se não estiver, remover as classes.

Run: `grep -rnE "(bg|text|border|ring|outline)-(neutral|slate|blue|rose|emerald|amber|indigo|purple|cyan|teal|fuchsia)-[0-9]+" src`
Expected: vazio. Cada ocorrência restante deve ser convertida pelo Mapa de migração.

Run: `grep -rn "#2563eb\|banner-cabecalho\|Geist" src`
Expected: vazio.

- [ ] **Step 2: Remover o custom-variant dark**

Com `grep -rn "dark:" src` vazio, apagar de `src/app/globals.css` o comentário e a linha `@custom-variant dark (&:where(.dark, .dark *));` adicionados na Task 1.

- [ ] **Step 3: Remover o banner sem uso**

```bash
git rm public/banner-cabecalho.png
```

- [ ] **Step 4: Checagem de contraste**

Conferir no DevTools (Inspect → Contrast) os pares abaixo; todos devem ser ≥ 4.5:1 (texto normal):
- `muted` (#5A6A8E) sobre `surface` (#FFFFFF) e sobre `canvas` (#EEF2F9).
- `frame-muted` (#A9BCE6) sobre `frame` (#0A2A6E).
- `gold-ink` (#0A1C4A) sobre `gold` (#F5D90A).
- `danger` (#D6264A) sobre `surface`.

`faint` (#98A5C2) fica abaixo de 4.5 e é usado só em texto decorativo/auxiliar (números de linha, placeholders), como na spec. Se algum par obrigatório falhar, escurecer o token no `globals.css` e no `DESIGN.md`.

- [ ] **Step 5: Verificação final completa**

Run: `npm run build && npm run lint && npm test`
Expected: tudo limpo.

Run: `npm run dev` e passar por todas as telas em 1366px e 390px: login, cadastro, verificar-email, home, turma (notas e frequência), modais, drawer, trocar-senha, admin/professores, admin/histórico e Ctrl+K. Repetir a checagem de regressão da planilha da Task 8, Step 11.
Expected: nenhuma tela com classe antiga visível, nenhuma rolagem horizontal da página em 390px, comportamento igual ao de antes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Limpeza final da repaginacao: remove sobras do tema antigo e banner"
git push origin master
```

---

## Notas de execução (2026-09-28)

Desvios do plano feitos durante a implementação:

- **Task 4:** os inputs do login não ganharam `required` (o plano sugeria). A validação de campo vazio continua no servidor, como antes.
- **Task 8, Step 2:** o `useEffect` que abria o drawer a partir de `alunoFocoId` foi barrado pelo lint do React 19 (`react-hooks/set-state-in-effect`). No lugar dele, o drawer é derivado na renderização: `drawerAlunoId = drawerEscolhidoId ?? alunoFocoId`; fechar o drawer limpa os dois (`onAlunoFocoConsumido`).
- **Task 9:** as classes dos componentes de admin foram migradas com um script que aplica o Mapa de migração, seguido de ajustes à mão (botões e inputs compactos na tabela, filtros do histórico dentro de card). O erro de lint antigo (aspas sem escape em `GerenciarProfessores.tsx`) foi corrigido junto.
- **Task 10:** duas correções exigidas pelo lint do React 19 na `CommandPalette`: `Date.now()` passou a rodar só ao executar o item (`react-hooks/purity`), e o resultado da busca de alunos é guardado junto com o termo que o gerou, com a lista exibida derivada (sem `setState` síncrono dentro de efeito).
