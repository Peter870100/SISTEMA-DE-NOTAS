# Relatórios do aluno e da turma (plano de implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Páginas "Relatório da turma" e "Relatório do aluno", com gráficos e o cálculo de quanto falta para a média, mais as ferramentas `relatorio_aluno` e `relatorio_turma` da Hermes, que devolvem um resumo e o link.

**Architecture:**
- Cálculos **puros** em `src/lib/relatorios/calculos.ts`.
- Um **carregador** em `src/lib/relatorios/dados.ts`, que lê o banco para um grupo de turma (escola + nome + ano letivo, todos os bimestres) e devolve objetos prontos.
- As páginas e a Hermes usam o mesmo carregador e os mesmos cálculos. A permissão fica com quem chama: a página usa `exigirTurmaDaEscola` e a Hermes usa `podeVerTurma` do `Escopo`.

**Tech Stack:** Next.js 16.2 (ler `node_modules/next/dist/docs/` antes de usar API do Next; `params` são `Promise`), React 19.2, Recharts (já instalado; ver `src/components/aluno/AlunoDashboardDrawer.tsx`), Supabase (cliente anon do servidor), `@modelcontextprotocol/sdk` + zod (padrão de `src/lib/mcp/leitura/*`), `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-22-relatorios-design.md`

**Depende de:** nada da etapa B. Pode ser feito e publicado de forma independente. Se a B for publicada antes, fazer rebase.

## Global Constraints

- **Média de aprovação:** `escolas.media_aprovacao numeric(4,2) not null default 6.0`, de 0 a 10, com uma casa decimal na tela. Só admin e dono editam, em Configurações.
- **Média do bimestre:** sempre `paraEscala10(mediaAluno(celulas))` de `src/lib/analytics.ts`, igual à planilha.
- **Bimestres:** média simples. Só bimestres com `bimestre_encerrado = true` entram no "quanto falta". O número de bimestres do ano é **4**.
- **Quanto falta:** `(media × 4 − soma dos encerrados) ÷ (4 − encerrados)`.
  - Resultado > 10 → "impossível";
  - média dos encerrados ≥ média de aprovação **e** todos os 4 encerrados, ou resultado ≤ 0 → "atingiu";
  - nenhum encerrado → "sem dados".
- **Nota por matéria:** só tentativas `status = 'entregue'`. Questões anuladas não contam. A matéria vem de `questoes.materia`, e o rótulo de `MATERIAS`. Menos de 5 questões → aviso "poucas questões".
- **Ligação planilha ↔ conta:** `aluno_turmas.aluno_id`, ou o nome normalizado (`normalizarBusca`), como em `perfil_aluno`. A mesma pessoa em bimestres diferentes casa pelo `aluno_id` ligado ou pelo nome normalizado. Aluno sem conta aparece, e simulados e aulas mostram "sem login".
- **Acesso:**
  - **Páginas:** login obrigatório e `exigirTurmaDaEscola(professor, turmaId)`. Aluno fora da turma → 404.
  - **Hermes:** perfil professor só nas turmas que `podeVerTurma` libera; perfil dono em todas.
- Nunca ler `senha_hash`, `token_verificacao*` nem `codigo_convite*`.
- Textos em pt-BR. Tokens do `DESIGN.md`, sem texto cinza, funcionando a 390 px. Impressão limpa com `@media print`.
- **Schema manual:** o SQL vai em `db/2026-10-22-relatorios.sql` e no fim de `db/schema.sql`. Sem a coluna, o sistema usa 6,0 (leitura tolerante).
- Testes novos registrados no script `test`.
- Worktree `.worktrees/relatorios`. Antes de cada task, `git fetch` e `git rebase origin/master`. Em conflito com outra sessão, manter os dois lados; se ela redesenhou a mesma tela, parar.

## Review Focus

1. **Professor restrito abre o link** de um aluno de turma não liberada (o link chega pela Hermes ou é copiado) → 404, sem dados. Pela Hermes, recusa. Testes na Task 3 (função de acesso pura) e na Task 6.
2. **Aluno que mudou de nome ou tem acento diferente entre bimestres** ("Joao" × "João"): o histórico precisa juntar pelo vínculo ou pelo nome normalizado. Nome repetido na mesma turma (dois "Pedro Henrique") não pode misturar os dois: quando há mais de um com o mesmo nome normalizado, usar só o `aluno_id` ligado, e sem ele mostrar "histórico parcial". Teste na Task 2.
3. **Quanto falta nos limites:** 4 encerrados abaixo da média → "não atingiu", e não "impossível"; média 0 configurada; bimestre com notas mas não encerrado. Testes na Task 2.
4. **Turma sem simulados, sem cursos ou sem nenhuma nota:** as páginas mostram estados vazios ("Nenhum simulado para esta turma ainda"), sem gráfico quebrado nem divisão por zero (NaN). Teste da frase-resumo e dos resumos na Task 2; prévia na Task 7.
5. **Tentativa em andamento ou vencida sem entrega:** conta como "fazendo" ou "não entregou", nunca como nota 0. Teste na Task 2.

---

### Task 1: Média de aprovação (SQL, leitura e Configurações)

**Files:**
- Create: `db/2026-10-22-relatorios.sql`, `src/lib/relatorios/media.ts`, `src/lib/relatorios/media.test.ts`, `src/actions/media-aprovacao.ts`
- Modify: `db/schema.sql` (anexar o SQL), `src/lib/types.ts` (`Escola.media_aprovacao?: number`), `src/components/configuracoes/ConfiguracoesPainel.tsx` (cartão novo, só para admin e dono), `package.json`

**Interfaces — Produces:**
- `MEDIA_PADRAO = 6`.
- `normalizarMedia(v: unknown): number` (puro): número finito entre 0 e 10, arredondado a 1 casa; o resto vira `MEDIA_PADRAO`.
- `validarMediaDigitada(texto: string): number | string` (puro): aceita "6", "6,5", "6.5"; fora de 0–10 → "A média precisa estar entre 0 e 10.".
- `mediaAprovacaoDaEscola(escolaId: string): Promise<number>`: leitura tolerante (sem a coluna → 6).
- Action `salvarMediaAprovacao(valor: string): Promise<{ ok: true } | { ok: false; erro: string }>`: só admin ou dono da escola logada (`exigirAdminDaEscola`).

- [ ] **Step 1:** Escrever os testes de `normalizarMedia`:
  - `undefined`, `"x"`, `-1` e `11` → 6;
  - `6.55` → 6.6;
  - `7` → 7.
- [ ] **Step 2:** Escrever os testes de `validarMediaDigitada`:
  - `"6,5"` → 6.5;
  - `"10"` → 10;
  - `"10,1"` → a mensagem de erro;
  - `""` → "Informe a média.".
- [ ] **Step 3:** `npx tsx --test src/lib/relatorios/media.test.ts`. Esperado: FALHA.
- [ ] **Step 4:** Implementar as funções, o SQL e o cartão "Média para aprovação" em Configurações: campo + "Salvar" + texto de ajuda "Usada nos relatórios para calcular quanto falta.".
- [ ] **Step 5:** `npm test`, `npx tsc --noEmit`, `npm run lint`. Esperado: 0.
- [ ] **Step 6:** Commit "Relatorios: media de aprovacao por escola".
- [ ] **Step 7 (controller):** mandar o SQL ao Peter. Depois que ele colar, conferir só lendo que `escolas.media_aprovacao` responde.

### Task 2: Cálculos puros dos relatórios

**Files:**
- Create: `src/lib/relatorios/tipos.ts`, `src/lib/relatorios/calculos.ts`, `src/lib/relatorios/calculos.test.ts`
- Modify: `package.json`

**Interfaces — Produces** (todas puras, sem Supabase):
- Tipos em `tipos.ts`:
  - `BimestreAluno = { bimestre: string; turmaId: string; media: number | null; encerrado: boolean; vigente: boolean }`.
  - `ResultadoQuantoFalta = { situacao: "atingiu" | "precisa" | "nao_atingiu" | "impossivel" | "sem_dados"; porBimestre?: number; mediaAtual?: number }`. `nao_atingiu` = os 4 encerrados e abaixo da média.
  - `AcertoMateria = { materia: string; rotulo: string; acertos: number; total: number; pct: number; poucas: boolean }`.
  - `SituacaoSimulado = "fez" | "fazendo" | "nao_entregou" | "nao_fez" | "sem_login"`.
  - `LinhaSimuladoAluno = { simuladoId; titulo; abreEm; fechaEm; situacao: SituacaoSimulado; nota10: number | null; tempoSeg: number | null; saidas: number | null; tempoForaSeg: number | null }`.
  - `ResumoAulas = { total: number; concluidas: number; comecadas: number; naoComecadas: number; aulas: { titulo: string; pct: number; concluida: boolean }[] }`.
  - `RelatorioAluno`, que junta: `nome`, `turmaNome`, `anoLetivo`, `bimestres`, `quantoFalta`, `materias`, `simulados`, `treinos`, `aulas` (`ResumoAulas | null`), `ultimoAcesso`, `historicoParcial`, `frase`.
  - `RelatorioTurma`, que junta:
    - `alunos` (lista com nome, alunoId, as médias por bimestre, `quantoFalta`, simulados feitos/total e aulas concluídas);
    - `mediaPorBimestre`;
    - `abaixoDaMedia`;
    - `simulados` (lista com quem não fez);
    - `materiasFracas` (3);
    - `distribuicao` (faixas 0–2, 2–4, 4–6, 6–8, 8–10);
    - `frase`.
- `quantoFalta(bimestres: BimestreAluno[], media: number): ResultadoQuantoFalta`.
- `acertoPorMateria(respostas: { materia: string | null; correta: boolean | null; anulada: boolean }[]): AcertoMateria[]`: ordena pelo menor `pct`; ignora `correta === null` (não respondida) contando-a como erro, e ignora `materia` null.
- `situacaoNoSimulado(t: { status: string; prazo_em: string | null } | null, temConta: boolean, agora: Date): SituacaoSimulado`:
  - sem conta → `sem_login`;
  - sem tentativa → `nao_fez`;
  - `entregue` → `fez`;
  - `em_andamento` com prazo futuro → `fazendo`;
  - senão → `nao_entregou`.
- `agruparAlunoEntreBimestres(linhas: { turmaId: string; bimestre: string; alunoId: string; nome: string }[], alvo: { alunoId: string; nome: string }, vinculados: Set<string>): { alunoIds: string[]; parcial: boolean }` (item 2 da Review Focus).
- `rankingTurma(alunos: { nome: string; medias: (number | null)[]; encerrados: boolean[]; vigente: number | null }[])`: devolve os alunos em ordem decrescente.
- `fraseAluno(r: Omit<RelatorioAluno, "frase">, media: number): string` e `fraseTurma(r: Omit<RelatorioTurma, "frase">, media: number): string`, no formato do exemplo da spec. Números com vírgula (`nota10`).

- [ ] **Step 1:** Escrever `calculos.test.ts`:
  - `quantoFalta`:
    - [5, 6] encerrados, média 6 → `precisa`, 6,5;
    - [9, 9] → `atingiu`;
    - [2, 2, 2] → `impossivel` (precisaria de 12);
    - 4 encerrados [5, 5, 5, 5] → `nao_atingiu`;
    - nenhum encerrado → `sem_dados`;
    - um bimestre com média mas não encerrado não entra na conta;
    - média configurada 7.
  - `acertoPorMateria`:
    - anulada fora;
    - não respondida conta como erro;
    - 3 questões → `poucas: true`;
    - ordem crescente.
  - `situacaoNoSimulado`: os 5 casos.
  - `agruparAlunoEntreBimestres`:
    - "Joao" e "João" juntam;
    - dois "Pedro Henrique" com um vinculado → só o vinculado, e `parcial` false;
    - dois iguais sem vínculo → só o alvo, e `parcial: true`.
  - `fraseAluno`:
    - aluno sem simulados e sem cursos → frase sem "NaN" e sem "0 de 0" (diz "Nenhum simulado para a turma ainda");
    - exemplo completo igual ao texto esperado.
  - `rankingTurma`: empate em ordem alfabética.
- [ ] **Step 2:** `npx tsx --test src/lib/relatorios/calculos.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar o teste focado, depois `npm test`, `npx tsc --noEmit` e `npm run lint`. Esperado: 0.
- [ ] **Step 5:** Commit "Relatorios: calculos puros (quanto falta, materias, situacoes)".

### Task 3: Carregador de dados

**Files:**
- Create: `src/lib/relatorios/dados.ts`, `src/lib/relatorios/acesso.ts`, `src/lib/relatorios/acesso.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes:
  - tipos e cálculos da Task 2;
  - `mediaAprovacaoDaEscola` (Task 1);
  - `lerTodas` e `lerPorIds` de `src/lib/mcp/leitura/comum.ts`, ou `emBlocos` (ler por páginas de 1000 e `.in` em blocos de 100);
  - `normalizarBusca`.
- Produces:
  - `type GrupoTurma = { escolaId: string; nome: string; anoLetivo: string }`.
  - `grupoDaTurma(turma: { escola_id; nome; ano_letivo }): GrupoTurma`.
  - `podeVerGrupo(escopo: Escopo, g: GrupoTurma): boolean` (puro, em `acesso.ts`, usando `podeVerTurma`).
  - `carregarRelatorioTurma(g: GrupoTurma, agora = new Date()): Promise<RelatorioTurma>`.
  - `carregarRelatorioAluno(g: GrupoTurma, alunoId: string, agora = new Date()): Promise<RelatorioAluno>`. `alunoId` é a linha de `alunos` de qualquer bimestre do grupo; outro grupo → erro "Aluno não encontrado nesta turma.".

O que o carregador lê (só as colunas necessárias):
- `turmas` do grupo (todos os bimestres) → `alunos` e `atividades_colunas` → `notas_celulas`;
- `aluno_turmas` do grupo → `alunos_contas` (id, nome, ultimo_acesso);
- simulados `tipo = 'professor'` e `status = 'publicado'` ligados ao grupo por `simulado_turmas` (turma_nome + ano_letivo + escola) → `tentativas` das contas;
- treinos (`tipo = 'treino'`) das contas → `tentativas`;
- `tentativa_respostas` + `questoes` (materia, anulada) para as matérias;
- `curso_turmas` do grupo → `aulas` publicadas → `aula_progresso` das contas.

- [ ] **Step 1:** Escrever os testes de `podeVerGrupo` (item 1 da Review Focus):
  - dono → true;
  - professor de outra escola → false;
  - professor restrito sem a turma liberada → false;
  - com ela → true;
  - restrito com `turmas` null → true.
- [ ] **Step 2:** `npx tsx --test src/lib/relatorios/acesso.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Implementar `acesso.ts` e `dados.ts`. Importar o cliente Supabase de forma preguiçosa ou em arquivo separado, para os testes puros rodarem sem variáveis de ambiente.
- [ ] **Step 4:** Script temporário de conferência (não commitar; no scratchpad, rodado com `npx tsx --env-file=.env.local`), **só leitura**: carregar o relatório de uma turma e de um aluno reais. Conferir que a média de cada bimestre é **igual** à que a planilha mostra, usando a mesma turma pela função da tela (`mediaAluno`). Anotar no relatório da task os números comparados.
- [ ] **Step 5:** `npm test`, `npx tsc --noEmit`, `npm run lint`. Esperado: 0.
- [ ] **Step 6:** Commit "Relatorios: carregador de dados da turma e do aluno".

### Task 4: Página "Relatório da turma"

**Files:**
- Create: `src/app/turma/[turmaId]/relatorio/page.tsx`, `src/components/relatorios/RelatorioTurma.tsx`, `src/components/relatorios/Relatorio.module.css`, `src/components/relatorios/GraficosTurma.tsx` (cliente, Recharts), `src/components/relatorios/BotaoImprimir.tsx` (cliente)
- Modify: `src/components/turma/TurmaDashboard.tsx` (botão "Relatório da turma")

**Interfaces — Consumes:** `carregarRelatorioTurma`, `grupoDaTurma`, `exigirTurmaDaEscola`, `getProfessorAtual`.

A página:
- sem login → `/login`; sem acesso → `notFound()`;
- carrega o relatório e renderiza o que a spec pede na seção 2;
- links para o relatório de cada aluno.

Gráficos:
- barras da média por bimestre com `ReferenceLine` na média de aprovação;
- distribuição em barras;
- acerto por matéria em barras horizontais.

Estados vazios com texto. Impressão: `@media print` esconde a navegação e os botões e mantém os gráficos (largura fixa). Botão "Imprimir / salvar PDF" (`window.print()`).

- [ ] **Step 1:** Implementar a página e os componentes.
- [ ] **Step 2:** `npx tsc --noEmit`, `npm run lint`, `npm run build`. Esperado: 0.
- [ ] **Step 3:** Commit "Relatorios: pagina da turma com graficos e impressao".

### Task 5: Página "Relatório do aluno"

**Files:**
- Create: `src/app/turma/[turmaId]/relatorio/aluno/[alunoId]/page.tsx`, `src/components/relatorios/RelatorioAluno.tsx`, `src/components/relatorios/GraficosAluno.tsx`
- Modify: `src/components/aluno/AlunoDashboardDrawer.tsx` (link "Relatório completo"; a gaveta recebe `turmaId` se ainda não tiver)

A página:
- acesso igual ao da Task 4;
- `alunoId` fora do grupo → `notFound()`;
- conteúdo da seção 2 da spec, com "quanto falta" em destaque (cartão com cor por situação: verde atingiu, amarelo precisa, vermelho impossível ou não atingiu, azul sem dados);
- "histórico parcial" com aviso quando `historicoParcial`.

Gráficos:
- notas por bimestre com a linha da média (o bimestre em andamento aparece tracejado ou com rótulo "em andamento");
- acerto por matéria;
- nota dos simulados por data (linha).

Mesma impressão da Task 4.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `npx tsc --noEmit`, `npm run lint`, `npm run build`. Esperado: 0.
- [ ] **Step 3:** Commit "Relatorios: pagina do aluno com quanto falta e graficos".

### Task 6: Ferramentas da Hermes

**Files:**
- Create: `src/lib/mcp/leitura/relatorios.ts`, `src/lib/relatorios/texto-hermes.ts`, `src/lib/relatorios/texto-hermes.test.ts`
- Modify: `src/lib/mcp/leitura.ts` (registrar), `package.json`

**Interfaces:**
- Consumes:
  - `carregarRelatorioAluno`, `carregarRelatorioTurma`, `podeVerGrupo`;
  - `urlDaEscola(slug, caminho)` de `src/lib/dominio.ts`;
  - `escolasDoPedido`, `acharPorNome`, `campoEscola`, `campoTelefone`, `texto` da etapa A.
- Produces:
  - `textoRelatorioAluno(r: RelatorioAluno, link: string): string`: a frase + 5 a 8 linhas + "Relatório completo (abra logado): <link>".
  - `textoRelatorioTurma(r: RelatorioTurma, link: string): string`.
  - As ferramentas abaixo.

Ferramentas:
- **`relatorio_aluno`** (`aluno` obrigatório, `turma?`, `escola?`, `professor_telefone?`):
  - acha o aluno nas planilhas das turmas visíveis;
  - mais de um → lista para escolher (como `perfil_aluno`);
  - fora do alcance → "Não encontrei esse aluno nas turmas que você pode ver.".
- **`relatorio_turma`** (`turma`, `escola?`, `professor_telefone?`).
- Link com a turma do bimestre vigente (ou o último bimestre) do grupo: `/turma/<id>/relatorio` e `/turma/<id>/relatorio/aluno/<id>`.

- [ ] **Step 1:** Escrever os testes de `textoRelatorioAluno` e `textoRelatorioTurma` com objetos fictícios:
  - contém a frase, o link e no máximo 10 linhas;
  - sem simulados → diz isso;
  - nenhum "NaN" ou "undefined".
- [ ] **Step 2:** `npx tsx --test src/lib/relatorios/texto-hermes.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Implementar e registrar as ferramentas nos dois perfis (`registrarLeitura` já é usado pelas duas rotas).
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Esperado: 0.
- [ ] **Step 5:** Commit "Hermes: relatorio_aluno e relatorio_turma com link".

### Task 7: Prévia, conferência e entrega

- [ ] **Prévia temporária** (não commitar; roteiro em `C:\Users\pkinh\.claude\skills\status-visual-aluno\references\previa-e-publicacao.md`, seções 1–3) das duas páginas com dados fictícios:
  - um aluno completo;
  - um aluno sem conta;
  - uma turma sem simulados.

  Prints em 1340, 390 e em modo impressão (`page.emulate_media(media="print")`).
- [ ] **Conferência ponta a ponta, só leitura:**
  - pelas ferramentas da Hermes (cliente MCP em memória, perfil dono): relatório de uma turma e de um aluno da Escola Teste, ou de uma turma real **só lendo**;
  - os números batem com a planilha e com a tela de resultado do simulado;
  - o link abre a página certa.
- [ ] Apagar a prévia e os scripts e remover `.next/dev/types`. Rodar `npx tsc --noEmit`, `npm test`, `npm run lint` e `npm run build`, todos com saída 0.
- [ ] Com o SQL conferido e o ok do Peter: publicar (rebase em `origin/master`, push) e conferir no www.
