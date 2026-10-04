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
- Rótulos: 12px, caixa alta, `tracking-[0.1em]`, `text-muted`.

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

## Login institucional
LoginShell.tsx: layout institucional azul original, com apresentação à esquerda e formulário azul à direita; empilhados no celular. Cabeçalho, textos, campos, botão amarelo e rodapé preservados. Apenas a apresentação das fotos mudou: public/segmento-medio.jpg como fundo com camada azul para legibilidade, sem cards de segmentos.

Vídeo de apresentação: `public/login-status-loop.mp4`, trecho de 18 segundos a partir de 00:08 do original, em 720p/H.264, sem áudio e com entrada/saída suave. LoginVideo mantém a foto como alternativa, aplica a camada azul sem controles visíveis; não carrega o vídeo com redução de movimento ou economia de dados.

Botões: hover com elevação de 3px, escala de 1,03, sombra, halo azul (dourado nos botões amarelos) e reflexo de luz de 700ms. Clique com escala de 0,97. Apenas dispositivos com mouse, sem movimento para quem prefere animações reduzidas e sem efeitos em botões desabilitados.

Cadastro: outra cena do vídeo (00:36–00:54), em `public/cadastro-status-loop.mp4`, com imagem alternativa `public/cadastro-status-poster.jpg`. Fundo em tela inteira com camada azul e card mais opaco para manter os campos legíveis, incluindo a confirmação de cadastro.

Fera: mascote transparente no canto inferior esquerdo do login e cadastro, flutuando suavemente. Largura de 112–128px no desktop, fixo no canto; no celular, 64–80px em espaço reservado no fim da página para não cobrir campos. Sem textos adicionais junto ao mascote. Redução de movimento respeitada.

Exportação: ícone de planilha na Sidebar abre o modal de exportar turmas com seleção de bimestre ou todos os bimestres. A ação saiu do cabeçalho de Suas turmas e está disponível nas telas autenticadas para quem possui turmas e já alterou a senha provisória.

## Área do aluno
`app/aluno/layout.tsx`: faixa azul (`bg-frame-deep`) com a logo da escola, nome do aluno, Senha e Sair; conteúdo em `max-w-5xl`, cartões `estilos.card`. Sem a barra lateral de professor. Cartões de módulos futuros usam o selo amarelo "Em breve". Cadastro por código usa `AuthShell`.

## Marca da escola
Logo e nome vêm de `escolas` via `EscolaProvider`/`LogoEscola` (`components/layout/EscolaContexto.tsx`). Telas antes do login usam a escola padrão (Status).
