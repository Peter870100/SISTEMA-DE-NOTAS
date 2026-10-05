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

Área de trabalho: padrão escolar `public/fundo-escolar.png` no fundo de PageLayout, com camada de 95% da cor canvas para deixar o desenho com 5% de visibilidade. Cabeçalho azul, cartões, tabelas e formulários mantêm superfícies opacas, preservando a leitura.

Rolagem no desktop: a moldura ocupa 100dvh; o conteúdo principal rola dentro dela e para no fim do conteúdo, com overscroll desativado. PageLayout preenche a altura disponível e mantém o fundo até a borda inferior. No celular, a rolagem natural da página é preservada.

## Aulas
Professor: `/cursos` (lista + novo curso), `/cursos/[id]` (módulos e aulas em cartões, ↑/↓ para ordenar, selo Publicada/Rascunho), editor da aula com prévia do vídeo e PDFs, `/cursos/[id]/progresso` (tabela aluno × % por módulo). Aluno: `/aluno/cursos` com barras de progresso e "Continuar", estados "Concluída" ✓ / "Não concluída · X% assistido" ◐ / "Não iniciada" ○, aula com player do YouTube (youtube-nocookie) e barra "X% assistido".

## Banco de questões
`/banco` (lista com filtros), `/banco/nova` e `/banco/questoes/[id]` (EditorQuestao), `/banco/importar` (PDF renderizado no navegador com pdf.js e enviado ao bucket `questoes`), `/banco/importacoes/[id]` (progresso da leitura pela IA, a cada 20 s), `/banco/importacoes/[id]/revisar` (lista · página original com quadros arrastáveis · editor), `/banco/assuntos` e `/banco/importar-enem` (só dono). Texto das questões em markdown mínimo renderizado sem HTML; figuras por recorte (CSS sobre a imagem da página) ou arquivo.

## Simulados
Professor: `/simulados` (lista com situação), `/simulados/novo` e `/simulados/[id]/editar` (dados + sorteio/troca de questões + publicar), `/simulados/[id]` (resultados, questões mais erradas, liberar correção). Aluno: `/aluno/simulados` (da turma e treinos), `/aluno/simulados/[id]` (prova com cronômetro do servidor, grade de questões, "salvo ✓", entrega automática; resultado por área). Respostas salvas a cada clique; a resposta certa só aparece no resultado liberado.

Títulos da área de trabalho: Space Grotesk 700, caixa alta, 30–36px e espaçamento de 0,045em. Assinatura menor com tracking de 0,2em; subtítulos em escrita normal. Sidebar de 80px, botões de 44px com contorno, ícones de 22px/traço 2,2, seleção amarela com barra lateral e etiquetas de função no hover/foco. Em telas baixas, botões de 40px e espaçamento menor.
Saudação em Suas turmas: primeiro nome do usuário em Space Grotesk, negrito, caixa alta e amarelo sobre o cabeçalho azul, separado do texto de orientação.

Revisão da navegação: sidebar sempre vertical à esquerda, 64px em telas estreitas e 80px no desktop. Área principal com rolagem própria em todas as larguras; navegação com rolagem em telas de até 640px de altura. Rajdhani 600/700 nos títulos e nome do usuário (`font-heading`), mantendo Manrope no texto e Space Grotesk nos demais componentes.
Etiquetas da sidebar: renderizadas via portal na página, posicionadas ao lado do botão no hover ou foco, em todas as larguras e alturas, sem recorte pela rolagem da navegação. Ocultadas ao sair do botão ou rolar a sidebar.
Etiquetas dos botões: fundo azul com 80% de opacidade (20% transparente) e desfoque de 4px, preservando o texto branco opaco.
Botões da sidebar: no hover com mouse, elevação de 2px com sombra suave e transição de 220ms, sem aumento de escala; retornam à posição original ao sair. Seleção mantém sombra dourada. Movimento desativado para preferência de redução de movimento.
Demonstração de degradê na sidebar: azul-marinho para azul nos botões normais; amarelo-claro para dourado no selecionado. Hover realça as cores, mantendo flutuação e etiquetas. Reflexo animado global desativado nesses botões para preservar o degradê.
Cabeçalho da área de trabalho: degradê azul de #062056 para #0A2A6E e #154E9B, mantendo texto e logo claros e nome do usuário em amarelo.
Cartões das turmas: degradê branco para azul-claro, ícone com degradê azul e hover com elevação de 3px, sombra suave e borda azul. Sem movimento contínuo; redução de movimento respeitada.
Agrupamentos de turmas: títulos das séries em Rajdhani 700, 20px, azul brand, com ícone de 20px, superfície branca suave e barra amarela à esquerda.
Turmas agrupadas por série e nome: um cartão expansível por turma, usando details/summary nativo para abrir e recolher bimestres. Links por bimestre ordenados numericamente, com contagem de alunos e selo Hermes preservados. Busca e navegação por teclado continuam disponíveis.

## Multiescola
Cada escola tem endereço próprio (`<slug>.statusavalia.com.br`; `www`/apex/`status.` = Status), logo, cores (principal → moldura e botões; destaque → dourado, tons derivados em `src/lib/marca.ts`), slogan e foto de login. O Status mantém o tema e a tela de login originais (vídeo, Fera). Dados sempre filtrados pela escola da conta logada (`src/lib/escola-acesso.ts`). Painel do dono em `/dono`: criar/editar/desativar escolas, enviar logo e foto, verificar endereço.

Controle de bimestres: cada período mostra Aberto, Em vigência (bolinha verde) ou Encerrado (cadeado e vermelho). O professor define um vigente por turma/escola/ano, encerra com confirmação e reabre quando quiser. Os encerrados continuam navegáveis para consulta e exportação; notas, frequência e estrutura da planilha ficam bloqueadas. Controles separados dos links para evitar navegação acidental.

Ícones da sidebar coloridos por função: turmas azul-claro, aulas e busca ciano, questões laranja, simulados e histórico lilás, professores e exportação verde, alunos turquesa, lixeira e saída coral, escolas e senha dourado. As cores permanecem no hover; o selecionado mantém ícone escuro sobre o destaque da escola, preservando etiquetas e flutuação.

Capas de cursos: cartões verticais 2:3, imagem enviada pelo professor, título sobre degradê escuro, contagem de módulos/aulas e progresso real do aluno sobre a capa. Envio de PNG/JPG/WebP até 2 MB com prévia ao criar/editar. Aulas: miniaturas horizontais 16:9, automáticas a partir do vídeo ou personalizadas no editor; remover a personalizada volta à automática. Imagens indisponíveis usam o ícone de livro e o azul da escola. Hover eleva 3px; redução de movimento respeitada.
Armazenamento de capas: bucket público `capas`, sem políticas de envio/exclusão anônimas; URLs de envio assinadas após autenticação/autorização do professor. Chave SUPABASE_SERVICE_ROLE_KEY restrita ao servidor.
