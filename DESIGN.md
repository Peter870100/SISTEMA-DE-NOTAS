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
