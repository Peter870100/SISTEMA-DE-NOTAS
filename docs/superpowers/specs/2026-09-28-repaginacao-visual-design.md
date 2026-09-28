# Repaginação visual "Híbrido Status" + paleta de comandos (Ctrl+K)

Data: 2026-09-28 · Status: aprovado em brainstorming, aguardando revisão da spec

## Objetivo

Dar ao Status Avalia uma cara de produto profissional e moderno, mantendo a identidade
da logo do Colégio Status (azul royal + amarelo-ouro), e adicionar uma paleta de
comandos (Ctrl+K) para navegação rápida. Nenhuma regra de negócio, action ou schema muda,
exceto uma server action nova de busca para o Ctrl+K.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Direção | **Híbrido**: moldura (sidebar + faixa do topo) em azul Status forte; área de trabalho clara com superfícies brancas flutuando por cima |
| Por que não escuro | Testado "Navy Profundo" e "Navy Médio": escuro demais para horas de planilha e para projetor |
| Futurismo vem de | cards flutuantes com sombra azulada, números em fonte mono, contornos de foco, vidro fosco em camadas flutuantes, login "aurora" |
| Inovação de interação | Só a paleta Ctrl+K nesta versão (heatmap, micro-animações extras, sidebar expansível ficaram de fora) |
| Implementação | Abordagem A: camada de tokens semânticos + migração tela a tela; primitivas extraídas só onde há duplicação real (casca de modal, botão, input) |
| Logo | Oficial, com o círculo **intacto** e só o texto "COLÉGIO STATUS" em **branco**, para uso sobre o azul (`public/logo-status-branca.png`). Sobre fundo branco usa-se o original `LOGO2025_CURVAS.png`. Nada de recorte nem de placa branca |
| Tema escuro | Não há. As classes `dark:` existentes são código morto (nada ativa `.dark`) e serão removidas na migração |

Mockups de referência (locais, não versionados): `.superpowers/brainstorm/*/content/hibrido-completo.html`.

## 1. Tokens de design

Definidos em `src/app/globals.css` como variáveis CSS em `:root` e expostos ao Tailwind v4
via `@theme inline`, gerando utilitários como `bg-surface`, `text-muted`, `border-line`.
O mesmo conteúdo é documentado em `DESIGN.md` na raiz, exigido por `.agents/rules/design-rules.md`.

### Cores

| Token | Valor | Uso |
|---|---|---|
| `frame` | `#0A2A6E` | faixa superior das páginas autenticadas |
| `frame-deep` | `#062056` | sidebar |
| `frame-line` | `#1C3F8A` | bordas dentro da moldura |
| `frame-muted` | `#A9BCE6` | textos secundários e ícones inativos sobre a moldura |
| `canvas` | `#EEF2F9` | fundo da área de trabalho |
| `surface` | `#FFFFFF` | cards, tabela, modais |
| `surface-sunken` | `#F4F7FC` | cabeçalho da tabela, coluna média, inputs |
| `zebra` | `#FAFBFE` | linhas ímpares da planilha |
| `line` | `#DCE3F0` | bordas principais |
| `line-soft` | `#EAEFF7` | divisórias internas |
| `ink` | `#0E1B3D` | texto principal |
| `muted` | `#5A6A8E` | texto secundário |
| `faint` | `#98A5C2` | placeholders, números de linha |
| `brand` | `#0444A0` | azul da logo: botão primário, foco de edição, números em destaque |
| `brand-bright` | `#1E6FD9` | célula selecionada, links, hover |
| `gold` | `#F5D90A` | amarelo da logo: item ativo da sidebar, "+" do botão primário, destaques, botão do login |
| `gold-ink` | `#0A1C4A` | texto sobre `gold` |
| `ok` | `#0E9F6E` | presença P, "salvo" |
| `danger` | `#D6264A` | média crítica, presença F, ações destrutivas, erros |
| `warn` | `#B7791F` | etiqueta "transferido(a)" |

Regra do amarelo: amarelo **nunca** como texto ou contorno sobre branco (contraste
insuficiente). Sobre branco ele aparece só como preenchimento (botão, filete, grifo)
com texto `gold-ink`. Sobre a moldura azul pode ser usado livremente.

### Tipografia

- **Space Grotesk** (500–700): títulos de página, nome da turma, títulos de modal. Nova fonte via `next/font/google`, variável `--font-display`.
- **Manrope** (atual): corpo de texto e UI.
- **JetBrains Mono** (500–600): notas, médias, KPIs, atalhos de teclado. Substitui Geist Mono, variável `--font-mono`, sempre com `tabular-nums`.
- Rótulos de seção e cabeçalhos da tabela: 10–11px, caixa alta, `letter-spacing: .1em`, cor `muted`.

### Forma e profundidade

- Raios: `8px` (chips, inputs pequenos), `10px` (botões, inputs), `14px` (cards, tabela), `18–20px` (modais, Ctrl+K, card do login).
- Sombras azuladas, nunca cinzas: card `0 8px 28px rgb(10 42 110 / .08)`; flutuante `0 40px 90px rgb(10 28 74 / .4)`.
- Vidro fosco (`backdrop-filter: blur`) **somente** em camadas flutuantes: Ctrl+K, modais e o overlay de fundo deles, drawer do aluno e card do login. Nunca na planilha (performance em PCs simples).
- Foco de teclado global: contorno `2px brand-bright`, offset 3px (substitui o `#2563eb` atual).
- O fundo "linhas de caderno" do `body` sai.
- Respeitar `prefers-reduced-motion`: sem transições de brilho ou desfoque animado.

### Logo

- `public/logo-status-branca.png`: derivada do arquivo oficial. Pixels à direita da coluna 505 (o texto) pintados de branco, preservando o alpha; o círculo (colunas 0–489) fica idêntico. Já gerada e versionada junto com esta spec.
- Uso: sobre `frame`/aurora, sempre a versão branca; sobre superfície branca (se algum dia necessário), o original. Nunca recolorir o círculo, distorcer ou recortar.
- Tamanho: ~44px de altura na faixa do topo (desktop), largura total do card no login. Abaixo de `sm`, altura ~28px na barra superior do mobile. Se o "COLÉGIO" ficar ilegível nessa largura, mostrar só a logo sem título de página ao lado.

## 2. Estrutura das telas (shell)

### Sidebar (`src/components/layout/Sidebar.tsx`)
- Desktop: trilho fixo de ~64px em `frame-deep`, só ícones com `aria-label` e tooltip. Sem logo no trilho (a logo mora na faixa do topo). O item ativo fica com fundo `gold` e ícone `gold-ink`. No rodapé, um avatar com as iniciais do professor (reusar `components/ui/Avatar.tsx`), com o nome completo no tooltip, e o botão Sair.
- Um botão de busca (ícone de lupa) abre o Ctrl+K, para quem não conhece o atalho.
- Mobile (< md): barra horizontal no topo em `frame-deep`, mesmos itens, com a logo branca reduzida à esquerda. Nada de trilho lateral.

### Faixa de moldura (componente novo `PageHeader`)
- Faixa `frame` de altura fixa (~170px no desktop) atrás do topo da página. Linha 1: breadcrumb (`frame-muted`, caixa alta) e título em Space Grotesk branco à esquerda; **logo oficial branca à direita** (link para `/`). Linha 2: área de ações da página (abas de bimestre, atalho "Ctrl K Buscar").
- O conteúdo (KPIs, cards) sobe e sobrepõe a borda inferior da faixa. É o efeito "cards flutuando sobre o azul".
- Usada em: home, turma, admin/professores, admin/histórico, trocar-senha.

## 3. Telas

### Login, cadastro, verificar e-mail
- Fundo aurora: três radiais (dourado no alto à direita, azul claro embaixo à esquerda, `brand` ao centro) sobre `#06163F`, mais uma grade sutil de 40px com máscara radial. Tudo em CSS, sem imagem.
- Card de vidro central (`bg white/8%`, blur, borda `white/18%`) com a logo oficial branca ocupando a largura do card no topo, título, inputs translúcidos (foco com borda `gold` e anel `gold/20%`) e botão principal `gold` com texto `gold-ink`.
- Sem sidebar (a sidebar já some quando não há professor logado).

### Home, lista de turmas (`src/app/page.tsx`, `TurmasLista.tsx`)
- O banner `banner-cabecalho.png` sai. Entra o `PageHeader` "Suas turmas" com a saudação "Olá, Prof. <nome>".
- Turmas em grid de cards brancos flutuantes: nome da turma (Space Grotesk), bimestre, contagem de alunos em mono. Hover: leve elevação e borda `brand-bright`.
- Mantém as cores por bimestre de `lib/turmas.ts` (`corBimestre`), remapeadas para tons compatíveis com o fundo claro.

### Turma (`TurmaDashboard`, `TurmaHeader`, `FiltrosTurma`, `KpiCards`, `PlanilhaGrid`, `CelulaNota`)
- `TurmaHeader` vira o conteúdo do `PageHeader`: breadcrumb "Turmas / Redação · <ano>", título = nome da turma, abas de bimestre à direita e atalho Ctrl K. A logo colorida atual sai (a versão branca já está na faixa). O botão desabilitado "Sincronizar com Google" sai da tela.
- Abas de bimestre: segmented control translúcido sobre a moldura; a ativa fica branca com texto `brand`. São links para as turmas irmãs (mesmo `nome`, outro `bimestre`), usando a mesma fonte de dados do seletor atual. A ação "novo bimestre" (`CriarBimestreModal`) vira um "+" no fim das abas.
- KPIs: três cards brancos com ícone em quadrado tingido (azul / `danger` / âmbar); o card da média ganha filete superior `gold`; valores em mono.
- Planilha: dentro de um card branco com a toolbar embutida no topo (filtro, indicador "Tudo salvo" com ponto `ok`, Colunas, Exportar, botão primário "+ Atividade" em `brand` com "+" `gold`).
  - Cabeçalhos: fundo `surface-sunken`, caixa alta; colunas de atividade como chips brancos; colunas de presença (data) como chip tracejado com ícone de calendário.
  - Células: selecionada = contorno `brand-bright` + tinta azul leve; em edição = contorno `brand`, fundo branco, sombra azul; recém-salva = faixa `ok` que desbota em ~1,2s (a única animação nova da planilha).
  - Status em texto (OK, NF, FALTOU…): chip neutro `surface-sunken`/`muted`, como hoje. Presença P/F: chips `ok`/`danger` tingidos.
  - Coluna média: fundo `surface-sunken`, borda esquerda, mono em negrito; crítica em `danger` com prefixo ▼, para não depender só da cor.
  - Etiqueta "transferido(a)": chip `warn`.
  - Ações da linha (ver, transferir, excluir): ícones `faint`, coloridos só no hover.
- Nenhuma mudança em teclado, desfazer (Ctrl+Z), drag-and-drop ou salvamento. Só a camada visual.

### Camadas flutuantes
- Primitiva nova `components/ui/Modal.tsx`: overlay `frame-deep/40%` com blur de 4px e painel branco com raio 18px e sombra flutuante. Os 5 modais (`EstatisticaColunaModal`, `GestaoColunasModal`, `TransferirAlunoModal`, `CriarBimestreModal`, `ConfirmDialog`) passam a usá-la, mantendo o comportamento atual de foco/Esc de cada um.
- `AlunoDashboardDrawer`: mesmo overlay; painel lateral branco com cabeçalho em `frame`.
- Gráficos do Recharts (`AnaliseAprendizagem`, drawer): série principal `brand`, secundária `brand-bright`, destaque `gold`, crítico `danger`; grade `line-soft`.

### Admin e trocar senha
- `PageHeader` + conteúdo em cards brancos. Tabelas seguem o mesmo estilo da planilha (cabeçalho sunken, zebra, mono para datas e números).

## 4. Paleta de comandos (Ctrl+K)

### Comportamento
- Abre com `Ctrl+K` / `Cmd+K` em qualquer página autenticada e pelo botão de lupa da sidebar. Fecha com Esc, com clique fora e ao navegar.
- Não abre se o foco estiver numa célula em edição da planilha (o atalho não pode roubar a digitação); fora da edição, abre normalmente.
- Input no topo com foco automático. Resultados agrupados em **Alunos**, **Turmas** e **Ações**, com navegação por ↑↓ e Enter, e o trecho digitado grifado em `gold`.
- Sem texto digitado: mostra as turmas acessíveis (na mesma ordem de `listarTurmasAcessiveis()`) e as ações.
- Visual: painel de vidro claro (`white/85%`, blur 20px) sobre overlay `frame-deep/40%`, raio 18px, rodapé com dicas de teclado.
- Acessibilidade: padrão combobox/listbox (`role="combobox"`, `aria-activedescendant`, `role="option"`), foco preso no painel e devolvido ao elemento anterior ao fechar.

### Resultados
- **Turmas**: vêm de `listarTurmasAcessiveis()`. O item mostra nome + bimestre e leva para `/turma/<id>`.
- **Alunos**: nova server action `buscarAlunos(termo)` em `src/actions/busca.ts`.
  - Exige professor logado. Restringe às turmas que ele pode acessar, com a mesma regra de `turmasLiberadasPara` / `professorTemAcessoATurma`; admin vê todas.
  - Busca por nome com `ilike`, ignorando maiúsculas; retorna no máximo 8 resultados com `id`, `nome`, `turma_id`, nome e bimestre da turma. Só dispara com 2+ caracteres, com debounce de ~200ms.
  - O item leva para `/turma/<turma_id>` e abre o drawer daquele aluno. Isso exige que `TurmaDashboard` aceite um parâmetro de URL (`?aluno=<id>`) para abrir o `AlunoDashboardDrawer` ao carregar.
  - A média do aluno no resultado (vista no mockup) fica **fora** desta versão, porque exigiria calcular médias no servidor. O subtítulo mostra só turma e bimestre.
- **Ações** (fixas, filtradas pelo texto): "Ir para turmas", "Trocar senha", "Sair"; para admin, "Professores" e "Histórico". Dentro de uma turma, também "Nova atividade" e "Exportar Excel". Essas duas disparam as funções existentes da planilha através de um contexto ou evento leve que o `TurmaDashboard` registra ao montar.

### Componentes
- `src/components/command/CommandPalette.tsx` (client): estado aberto/fechado, atalho global, render do painel.
- `src/components/command/CommandProvider.tsx`: contexto para páginas registrarem ações contextuais (usado pela turma) e para a sidebar abrir a paleta.
- Montado em `src/app/layout.tsx` só quando há professor logado.

## 5. Ordem de migração

Cada etapa deixa o sistema funcionando e é commitada separadamente:

1. **Fundação**: tokens em `globals.css`, fontes em `layout.tsx`, `DESIGN.md`, primitivas `Modal`/`Button`/`Input`.
2. **Shell**: Sidebar em trilho + `PageHeader`.
3. **Autenticação**: login, cadastro, verificar-email e trocar-senha (aurora).
4. **Home**: lista de turmas.
5. **Turma**: header e abas, KPIs, planilha e células, modais, drawer, gráficos.
6. **Admin**: professores e histórico.
7. **Ctrl+K**: paleta, `buscarAlunos` e o parâmetro `?aluno=` no dashboard.
8. **Limpeza**: remover os `dark:` restantes, cores `neutral-*`/`blue-*` fixas que sobrarem e `banner-cabecalho.png` se não for mais usado.

## 6. Verificação

- `npm run build` e `npm run lint` limpos ao fim de cada etapa.
- Conferência visual rodando o app em cada tela: desktop ~1366px e mobile ~390px.
- Planilha: selecionar, editar, salvar, Ctrl+Z, arrastar linha, status rápido, presença P/F, colunas, exportar. Tudo igual ao comportamento atual.
- Contraste AA: `ink`/`muted` sobre `surface` e `canvas`, branco e `frame-muted` sobre `frame`, `gold-ink` sobre `gold`.
- Ctrl+K: só teclado de ponta a ponta; professor sem acesso a uma turma não recebe alunos dela em `buscarAlunos`; o atalho não interfere na edição de célula.

## Fora de escopo

Tema escuro, heatmap de notas, sidebar expansível, animações de contagem nos KPIs,
média do aluno no Ctrl+K, redesenho dos fluxos ou da estrutura de navegação, mudanças no
MCP, no schema ou nas regras de negócio.
