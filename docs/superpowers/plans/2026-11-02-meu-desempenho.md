# Meu desempenho Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Painel "Meu desempenho" para o aluno (`/aluno/desempenho`) e para a escola (seção na turma + página por aluno), calculado só com respostas de simulados/treinos já gravadas, mais SQL de dados de teste.

**Architecture:**
- **Cálculo:** funções puras em `src/lib/desempenho/` (tipos, regras configuráveis, cálculos) recebem uma lista
  plana de respostas e devolvem o painel.
- **Leitura:** um carregador de servidor (`dados.ts`) lê as respostas da conta (ou da turma) no Supabase.
- **Tela:** um único componente `PainelDesempenho` desenha o painel nas duas visões; os gráficos usam recharts
  em componentes cliente.

**Tech Stack:** Next.js 16.2 (App Router, server components; ler `node_modules/next/dist/docs/` antes de usar
`loading.tsx`/`error.tsx`/`searchParams`), React 19, Supabase (`@/lib/supabase/client`), recharts 3, lucide-react,
CSS modules, testes `tsx --test` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-11-02-meu-desempenho-design.md` (leia inteira, inclusive "Decisões tomadas por mim").

## Global Constraints

- **Idioma:** textos em pt-BR. Na área do aluno não há texto cinza (`text-muted`); vale a skill `status-visual-aluno`.
- **Legenda do gráfico de conteúdos:** `"70% de erro — 7 erros em 10 questões"`, acrescida de `" (2 em branco)"`
  quando houver questões em branco. Na turma, a palavra é "respostas" no lugar de "questões".
- **Regras iniciais:** `MIN_QUESTOES_PRIORIDADE = 5`, `TAXA_ERRO_PRIORIDADE = 60` (%). "Precisamos de mais
  respostas" vale de 1 a 4 questões distintas com pelo menos 1 erro. O gráfico mostra até 8 conteúdos.
- **Contagem:**
  - a primeira resposta a cada questão vale para os totais e para os conteúdos (questões anuladas, pelo estado
    atual, ficam fora);
  - a evolução usa todas as respostas da atividade;
  - taxa de erro = erros ÷ questões distintas.
- **Aluno:** só tentativas `status='entregue'` com `correcaoLiberada(simulado, agora)`.
- **Escola:** todas as tentativas entregues. A conta do aluno sai sempre da sessão ou da regra `contaDaPessoa`,
  nunca de um parâmetro de URL.
- **Banco:** nenhuma tabela ou coluna nova. O SQL de teste usa usuários `teste.desempenho.*`, a turma
  "TESTE DESEMPENHO" e simulados com título iniciado por "[TESTE DESEMPENHO]".
- **Comentários:** densidade e estilo dos arquivos vizinhos (JSDoc curto em pt-BR).

## Review Focus

1. **Conteúdo sem assunto:** questão sem `assunto_id` → grupo "Química (sem assunto)", nunca some nem quebra o gráfico (Task 1 testa).
2. **Correção não liberada:** prova de professor com `correcao='apos_prazo'` e prazo no futuro não aparece para o aluno, mas aparece para a escola (Task 2 testa `entraNoPainel`).
3. **Atividade só com questões repetidas:** a evolução continua mostrando a nota da atividade (todas as respostas), e os totais não contam a questão de novo (Task 1 testa).
4. **Nomes longos de conteúdo no gráfico:** rótulo não é cortado nem sobrepõe a barra, em 390px o nome vai acima da barra (Task 3 confere em print).
5. **`?conteudo=` inexistente ou de outra matéria na URL:** a página ignora e mostra a lista da matéria, sem erro 500 (Task 4 testa `detalheDaUrl`).

---

### Task 1: Cálculos puros do painel

**Files:**
- Create: `src/lib/desempenho/tipos.ts`, `src/lib/desempenho/regras.ts`, `src/lib/desempenho/calculos.ts`
- Test: `src/lib/desempenho/calculos.test.ts`

**Interfaces:**
- Produces (`tipos.ts`):
  ```ts
  export type RespostaDesempenho = {
    contaId: string; tentativaId: string; atividadeId: string; atividadeTitulo: string;
    tipo: "professor" | "treino"; entregueEm: string; // ISO
    questaoId: string; materia: string | null; assuntoId: string | null; assuntoNome: string | null;
    alternativa: "A" | "B" | "C" | "D" | "E" | null; correta: boolean | null; anulada: boolean;
  };
  export type ResumoGeral = { respondidas: number; acertos: number; erros: number; emBranco: number; taxaAcerto: number /* 0–100, inteiro arredondado */; refeitas: number };
  export type ConteudoDesempenho = { chave: string /* assuntoId ou "materia:<m>" */; materia: string | null; materiaRotulo: string; assuntoId: string | null; nome: string /* assunto ou "<Matéria> (sem assunto)" */; questoes: number; acertos: number; erros: number; emBranco: number; taxaErro: number /* 0–100 inteiro */; legenda: string };
  export type MateriaDesempenho = { materia: string; rotulo: string; questoes: number; acertos: number; erros: number; emBranco: number; taxaAcerto: number; conteudos: ConteudoDesempenho[] };
  export type AtividadeEvolucao = { atividadeId: string; titulo: string; entregueEm: string; acertos: number; total: number; pct: number };
  export type Comparacao = { atual: AtividadeEvolucao; anterior: AtividadeEvolucao; diferenca: number /* pontos */; texto: string };
  export type Prioridade = { tipo: "revisar" | "mais_respostas"; conteudo: ConteudoDesempenho; texto: string };
  export type PainelDesempenho = { resumo: ResumoGeral; maisErro: ConteudoDesempenho[]; materias: MateriaDesempenho[]; evolucao: AtividadeEvolucao[]; comparacao: Comparacao | null; prioridades: Prioridade[]; primeiraAtividade: string | null };
  ```
- Produces (`regras.ts`): `export const REGRAS = { minQuestoesPrioridade: 5, taxaErroPrioridade: 60, maxConteudosGrafico: 8 } as const; export type Regras = typeof REGRAS;` mais as funções de texto `textoRevisar(c)`, `textoMaisRespostas(c)`, `AVISO_DIFICULDADE = "Atividades diferentes podem ter dificuldades diferentes."`.
- Produces (`calculos.ts`):
  ```ts
  primeirasRespostas(rs: RespostaDesempenho[]): RespostaDesempenho[]  // por contaId+questaoId, menor entregueEm (empate: tentativaId); sem anuladas
  resumoGeral(rs: RespostaDesempenho[]): ResumoGeral                   // usa primeirasRespostas; refeitas = respostas não anuladas descartadas
  porConteudo(rs: RespostaDesempenho[], unidade?: "questões" | "respostas"): ConteudoDesempenho[]
  legendaErro(c: Pick<ConteudoDesempenho,"taxaErro"|"erros"|"questoes"|"emBranco">, unidade?: "questões" | "respostas"): string
  maisErro(cs: ConteudoDesempenho[], regras?: Regras): ConteudoDesempenho[]   // erros>0, taxaErro desc, erros desc, nome; até maxConteudosGrafico
  porMateria(cs: ConteudoDesempenho[]): MateriaDesempenho[]                    // pior taxaAcerto primeiro
  evolucao(rs: RespostaDesempenho[]): AtividadeEvolucao[]                       // todas as respostas não anuladas, por entregueEm asc
  comparar(ev: AtividadeEvolucao[]): Comparacao | null                           // últimas duas
  prioridades(cs: ConteudoDesempenho[], regras?: Regras): Prioridade[]           // "revisar" primeiro (taxaErro desc), depois "mais_respostas"
  montarPainel(rs: RespostaDesempenho[], regras?: Regras): PainelDesempenho
  ```
  O rótulo da matéria vem de `MATERIAS` em `src/lib/questoes/materias.ts` (com `ehMateria`), e a matéria
  desconhecida ou nula usa o próprio texto, ou "Sem matéria". Na turma, a primeira resposta é contada por
  aluno e questão (`contaId`); a unidade é "respostas".

- [ ] **Step 1: Write the failing tests** em `calculos.test.ts` (helper `r(o: Partial<RespostaDesempenho>)` com padrões). Asserções:
  - `legendaErro({taxaErro:70,erros:7,questoes:10,emBranco:0})` → `"70% de erro — 7 erros em 10 questões"`; com `emBranco:2` → `"… em 10 questões (2 em branco)"`; `erros:1, questoes:1` → `"100% de erro — 1 erro em 1 questão"`; unidade `"respostas"` → `"… em 50 respostas"`.
  - `resumoGeral`: 3 respostas (certa, errada, `alternativa:null`) + 1 anulada → `{respondidas:3, acertos:1, erros:1, emBranco:1, taxaAcerto:33, refeitas:0}`.
  - Mesma questão em duas tentativas (primeira errada em 01/10, depois certa em 05/10) → `acertos:0, erros:1, refeitas:1`.
  - `porConteudo` com questão sem assunto de `materia:"quimica"` → `nome:"Química (sem assunto)"`, `chave:"materia:quimica"`.
  - `prioridades`: 5 questões com 3 erros (60%) → `tipo:"revisar"`; 5 com 2 erros (40%) → nenhuma; 4 com 4 erros → `"mais_respostas"`; conteúdo só com questões em branco → nenhuma. O texto de revisar para 7 de 10 em "Derivação parassintética" é `"Você errou 7 de 10 questões de Derivação parassintética. Vale revisar esse assunto e depois treinar com questões novas."`.
  - `evolucao` + `comparar`: duas atividades (4/10 em 28/10 "Simulado 1", depois 6/10 em 04/11 "Treino de Química") → `diferenca: 20`, e o texto contém `"↑ 20 pontos"`, `"Treino de Química"` e `"Simulado 1"`. Com uma atividade só, `comparar` devolve `null`; com nenhuma, `[]` e `null`.
  - Atividade feita só de questões já vistas: aparece em `evolucao` com a nota cheia dela, e `resumoGeral.respondidas` não cresce.
  - `maisErro` corta em 8 e ignora conteúdos com `erros:0`.
  - `montarPainel([])` → resumo zerado, listas vazias, `comparacao:null`, `primeiraAtividade:null`.

- [ ] **Step 2: Run** `npx tsx --test src/lib/desempenho/calculos.test.ts`. Expected: FAIL (módulos inexistentes).
- [ ] **Step 3: Implement** `tipos.ts`, `regras.ts` e `calculos.ts` com as assinaturas acima. O texto de `comparar` segue este modelo:
  - `"↑ 20 pontos: Treino de Química (04/11) comparado com Simulado 1 (28/10)"`;
  - usa `↓` quando a nota cai e `"= mesma taxa"` quando não muda;
  - as datas saem em `dd/mm` no fuso America/Sao_Paulo.
- [ ] **Step 4: Run** the test file again. Expected: PASS. Depois `npm test` (tudo verde).
- [ ] **Step 5: Commit** `feat: cálculos do painel Meu desempenho`.

### Task 2: Leitura dos dados (servidor)

**Files:**
- Create: `src/lib/desempenho/acesso.ts` (puro), `src/lib/desempenho/dados.ts` (Supabase)
- Modify: `src/lib/relatorios/dados.ts` (exportar `contaDoAlunoDaTurma`)
- Test: `src/lib/desempenho/acesso.test.ts`

**Interfaces:**
- Consumes: `RespostaDesempenho` (Task 1); `correcaoLiberada` (`src/lib/simulados/regras.ts`); `GrupoTurma`, `AlunoForaDoGrupo` (`src/lib/relatorios/dados.ts`).
- Produces:
  ```ts
  // acesso.ts
  export function entraNoPainel(s: { tipo: "professor"|"treino"; correcao: string; fecha_em: string|null }, agora: Date, visao: "aluno"|"escola"): boolean
  // dados.ts
  export async function respostasDaConta(contaId: string, escolaId: string, visao: "aluno"|"escola", agora?: Date): Promise<RespostaDesempenho[]>
  export async function respostasDaTurma(g: GrupoTurma): Promise<RespostaDesempenho[]>   // só simulados de professor ligados ao grupo, contas do grupo (aluno_turmas)
  export type QuestaoErrada = { questao: QuestaoAluno; marcada: Letra|null; certa: Letra|null; resolucao: string|null; atividadeTitulo: string };
  export async function questoesErradas(rs: RespostaDesempenho[], chaveConteudo: string): Promise<QuestaoErrada[]>  // primeiras respostas erradas/em branco do conteúdo
  export async function aulasDoAlunoParaRevisao(contaId: string, escolaId: string): Promise<{ id: string; titulo: string }[]>
  // relatorios/dados.ts
  export async function contaDoAlunoDaTurma(g: GrupoTurma, alunoId: string): Promise<{ nome: string; contaId: string | null }>  // lança AlunoForaDoGrupo
  ```
- **Como cada função lê:**
  - `respostasDaConta` lê `tentativas` (conta, `status='entregue'`) junto com `simulados` (`escola_id` igual ao da conta),
    filtra com `entraNoPainel` e então lê `tentativa_respostas` e `questoes` (`materia, assunto_id, anulada, resposta`)
    e `assuntos` (nome). Lê em blocos de 200 ids, como `lerPorIds` em `relatorios/dados.ts`. `entregueEm` =
    `tentativas.entregue_em`.
  - `questoesErradas` usa `questoesParaAluno(ids, 1800)` para o enunciado e as figuras, e lê `resposta, resolucao` à
    parte, só no servidor.
  - `aulasDoAlunoParaRevisao` repete a leitura de `montarRevisao` (`cursosDoAluno` + aulas publicadas) e devolve `[]`
    em caso de erro.
  - `contaDoAlunoDaTurma` reaproveita `carregarBase` e `montarPessoa`.

- [ ] **Step 1: Write the failing test** `acesso.test.ts`:
  - treino → `true` nas duas visões;
  - professor `na_hora` → `true`;
  - `apos_prazo` com `fecha_em` 1 hora no futuro → aluno `false`, escola `true`;
  - `fecha_em` 1 hora no passado → aluno `true`;
  - `fecha_em: null` com `apos_prazo` → aluno `false`.
- [ ] **Step 2: Run** `npx tsx --test src/lib/desempenho/acesso.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `acesso.ts` (escola → sempre `true`; aluno → `correcaoLiberada`), then `dados.ts` and the `contaDoAlunoDaTurma` export. Os erros do Supabase viram `throw new Error(error.message)`, como em `servidor.ts`.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: PASS, sem erros de tipo.
- [ ] **Step 5: Commit** `feat: leitura das respostas para o painel de desempenho`.

### Task 3: Componente `PainelDesempenho` e gráficos

**Files:**
- Create: `src/components/desempenho/PainelDesempenho.tsx` (servidor), `src/components/desempenho/GraficoConteudos.tsx` e `GraficoEvolucao.tsx` (`"use client"`, recharts), `src/components/desempenho/DetalheConteudo.tsx`, `src/components/desempenho/PainelDesempenho.module.css`
- Read first: `C:\Users\pkinh\.claude\skills\status-visual-aluno\SKILL.md` e `references/receitas.md`; `src/components/ui/PainelResumo.tsx`, `src/components/ui/SecaoPainel.module.css`, `src/components/simulados/ResultadoAluno.tsx` (como mostra a questão corrigida com `ConteudoQuestao`/`ImagemQuestao`), `src/components/relatorios/GraficosAluno.tsx` (uso do recharts).

**Interfaces:**
- Consumes: `PainelDesempenho`, `ConteudoDesempenho`, `MateriaDesempenho` (Task 1); `QuestaoErrada` (Task 2); `TreinarAssunto` (`src/components/simulados/TreinarAssunto.tsx`); `PainelResumo`.
- Produces:
  ```ts
  export function PainelDesempenho(props: {
    painel: PainelDesempenho; visao: "aluno" | "escola"; titulo: string; // "Meu desempenho" | "Desempenho de <nome>"
    hrefBase: string;            // página atual sem query; links de matéria/conteúdo = `${hrefBase}?materia=…&conteudo=…`
    materiaAberta: string | null; conteudoAberto: string | null;
    erradas: QuestaoErrada[];    // do conteúdo aberto
    aulas: { id: string; titulo: string }[]; // para aulasDoTema; [] na visão da escola
    voltar?: { href: string; rotulo: string };
  }): JSX.Element
  export function GraficoConteudos(props: { conteudos: ConteudoDesempenho[] }): JSX.Element  // barras horizontais, % de erro, legenda ao lado/abaixo
  ```
- **O que a tela mostra** (seções na ordem da spec, "O que a tela mostra" itens 1 a 7):
  - Painel de números com 4 itens:
    - "Respondidas" (`refeitas` no detalhe: "refez 3");
    - "Acertos";
    - "Erros" (detalhe: "+ 2 em branco");
    - "Taxa de acerto".
  - Sem resposta nenhuma (`resumo.respondidas === 0`): só o cabeçalho e o cartão de sem histórico.
    - Na visão do aluno, com o botão "Ir para os simulados" (`/aluno/simulados`).
    - Na da escola, com o texto "Este aluno ainda não entregou nenhum simulado ou treino".
  - Cartões de prioridade:
    - "revisar" com etiqueta vermelha "Revisão prioritária";
    - "mais_respostas" com etiqueta dourada "Precisamos de mais respostas";
    - aulas via `aulasDoTema(c.nome, aulas)` (links `/aluno/aulas/<id>` só no aluno);
    - sem aula, o texto "Ainda não há aula sobre este assunto";
    - `TreinarAssunto` só na visão do aluno.
  - Evolução:
    - `GraficoEvolucao` (barras verticais da `pct` por atividade, com tooltip "7 de 10");
    - o texto `comparacao.texto` com a seta e, abaixo, `AVISO_DIFICULDADE`.
  - Gráficos sem cortes: `GraficoConteudos` usa altura de `conteudos.length * 44 + 24` px e escreve o nome e a legenda em
    HTML (não no eixo do SVG) acima de cada barra, então nada é cortado no celular.

- [ ] **Step 1: Build a preview page** temporária e local (não commitar):
  - local: `src/app/previa-desempenho/page.tsx`;
  - conteúdo: o `PainelDesempenho` com um `montarPainel(...)` de dados fictícios, que tenham um nome de conteúdo longo, uma
    matéria sem assunto, as duas prioridades e 5 atividades;
  - abrir com `npm run dev` e tirar prints em 1340px e 390px. Siga
    `C:\Users\pkinh\.claude\skills\status-visual-aluno\references\previa-e-publicacao.md`.
- [ ] **Step 2: Implement** os componentes até os prints não terem texto cortado, sobreposto ou cinza.
- [ ] **Step 3: Run** `npm run lint` e `npx tsc --noEmit`. Expected: limpos.
- [ ] **Step 4:** Apague a página de prévia e faça o commit `feat: componente do painel de desempenho`.

### Task 4: Página do aluno

**Files:**
- Create: `src/app/aluno/desempenho/page.tsx`, `loading.tsx`, `error.tsx`, `src/lib/desempenho/url.ts`
- Modify: `src/app/aluno/layout.tsx` (item "Desempenho", ícone `ChartColumn` do lucide, `cor: "verde"` (cores em `globals.css` `.sidebar-botao[data-cor]`), depois de "Simulados")
- Test: `src/lib/desempenho/url.test.ts`

**Interfaces:**
- Consumes: `getAlunoAtual` (`src/lib/auth.ts`), `respostasDaConta`, `questoesErradas`, `aulasDoAlunoParaRevisao` (Task 2), `montarPainel` (Task 1), `PainelDesempenho` (Task 3).
- Produces: `export function detalheDaUrl(painel: PainelDesempenho, busca: { materia?: string|string[]; conteudo?: string|string[] }): { materia: string|null; conteudo: string|null }`. Matéria inexistente vira `null`. Conteúdo inexistente, ou que não pertence à matéria, também vira `null`. Conteúdo válido sem matéria preenche a matéria dele.

- [ ] **Step 1: Write failing tests** `url.test.ts`:
  - matéria e conteúdo válidos → os dois;
  - `conteudo` de outra matéria → `{ materia, conteudo: null }`;
  - `conteudo` desconhecido → `null`;
  - parâmetros em array → usa o primeiro;
  - só `conteudo` válido → matéria preenchida.
- [ ] **Step 2: Run** `npx tsx --test src/lib/desempenho/url.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `url.ts` e a página:
  - aluno vem de `getAlunoAtual()` (sem aluno → `redirect("/login")`);
  - `respostasDaConta(aluno.id, aluno.escola_id, "aluno")`;
  - `questoesErradas` só quando há conteúdo aberto;
  - `aulasDoAlunoParaRevisao`;
  - `export const dynamic = "force-dynamic"`, como as outras páginas do aluno;
  - `loading.tsx` com esqueleto de cartões;
  - `error.tsx` (cliente) com "Não foi possível carregar seu desempenho" e o botão "Tentar de novo" (`reset`).
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run build`. Expected: tudo passa.
- [ ] **Step 5: Commit** `feat: página Meu desempenho do aluno`.

### Task 5: Visão da escola

**Files:**
- Create: `src/app/turma/[turmaId]/relatorio/aluno/[alunoId]/desempenho/page.tsx`, `src/components/desempenho/ConteudosTurma.tsx`
- Modify:
  - `src/components/relatorios/TabelaAlunos.tsx` (link "Desempenho" por aluno);
  - `src/components/relatorios/RelatorioAluno.tsx` (botão "Desempenho" no topo);
  - `src/components/relatorios/RelatorioTurma.tsx` (nova seção, prop `conteudos: ConteudoDesempenho[]`);
  - `src/app/turma/[turmaId]/relatorio/page.tsx` (carregar `respostasDaTurma` → `maisErro(porConteudo(rs, "respostas"))`;
    em caso de falha, seção com aviso, sem derrubar o relatório).

**Interfaces:**
- Consumes: `getProfessorAtual`, `exigirTurmaDaEscola`, `grupoDaTurma`, `contaDoAlunoDaTurma`, `AlunoForaDoGrupo`, `respostasDaConta(contaId, g.escolaId, "escola")`, `questoesErradas`, `detalheDaUrl`, `PainelDesempenho` (`visao="escola"`, `aulas=[]`), `GraficoConteudos`.
- Página do aluno:
  - usa a mesma checagem de `relatorio/aluno/[alunoId]/page.tsx`: turma fora do escopo → `notFound()`, e
    `AlunoForaDoGrupo` → `notFound()`;
  - `contaId` nulo → cabeçalho e o aviso `TEXTO_SEM_CONTA` (`src/lib/relatorios/calculos.ts`);
  - `voltar = { href: /turma/<id>/relatorio/aluno/<alunoId>, rotulo: "Relatório do aluno" }`.
- `ConteudosTurma`:
  - título "Conteúdos com mais erro na turma";
  - `GraficoConteudos`;
  - lista vazia → "Nenhum simulado entregue nesta turma ainda".

- [ ] **Step 1: Implement** as mudanças.
- [ ] **Step 2: Run** `npm test`, `npm run lint`, `npm run build`. Expected: passam.
- [ ] **Step 3: Commit** `feat: desempenho por aluno e conteúdos da turma no relatório`.

### Task 6: SQL de dados de teste

**Files:**
- Create: `db/dados-teste-desempenho.sql`, `db/apagar-dados-teste-desempenho.sql`

**Interfaces:**
- Consumes: as tabelas de `db/schema.sql`:
  - `turmas`, `alunos`, `alunos_contas`, `aluno_turmas`;
  - `simulados`, `simulado_turmas`, `simulado_questoes`, `tentativas`, `tentativa_respostas`;
  - `questoes`, `assuntos`.
  Leia as colunas e os `check` reais (inclusive os `alter table` posteriores) antes de escrever.
- **Valores fixos:**
  - `escola_id = '00000000-0000-0000-0000-000000000001'`, ano letivo `'2026'`, turma "TESTE DESEMPENHO";
  - 3 contas `teste.desempenho.ana`, `teste.desempenho.bruno`, `teste.desempenho.carla`, `criado_via='escola'`,
    `senha_provisoria=false`, `senha_hash` = bcrypt (custo 10) de uma senha que o orquestrador passa ao implementador
    e que **não** vai em nenhum comentário;
  - 3 linhas em `alunos` com os mesmos nomes ("Ana Teste", "Bruno Teste", "Carla Teste"), ligadas por
    `aluno_turmas.aluno_id`.
- **Simulados:**
  - 4 simulados `tipo='professor'`, `status='publicado'`, `correcao='na_hora'`;
  - `abre_em`/`fecha_em` entre 20 e 5 dias atrás, um por semana; `duracao_min=60`; títulos
    "[TESTE DESEMPENHO] Simulado 1" a "4";
  - cada um com 10 questões `publicada`, não anuladas e com `assunto_id`, de 2 ou 3 matérias. A escolha é
    determinística (`order by id`), com um assunto que apareça em pelo menos 6 questões no total;
  - o simulado 4 repete 2 questões do simulado 1.
- **Respostas:**
  - Ana erra muito um assunto (≥5 questões, ≥60% de erro → prioridade), deixa 2 em branco e melhora no simulado 4;
  - Bruno vai bem;
  - Carla fez só 2 simulados;
  - `correta` = (`alternativa` = `questoes.resposta`); `alternativa` nula → `correta=false`;
  - tentativas `status='entregue'` com `entregue_em` dentro da janela, e `acertos`/`total`/`porcentagem` coerentes.
- **Reexecução:** os dois scripts podem rodar várias vezes. O de criar começa apagando o que o de apagar apaga. O de
  apagar só toca linhas com esses nomes, prefixos e títulos (e o `escola_id` do Status).

- [ ] **Step 1: Write** os dois scripts, em `begin; … commit;`.
- [ ] **Step 2: Check** com consulta só de leitura (chave anônima, como em `CLAUDE.md`) que as questões escolhidas existem e têm assunto. O orquestrador entrega o SQL ao Peter, que cola no SQL Editor.
- [ ] **Step 3: Commit** `chore: SQL de dados de teste do painel de desempenho`.

### Task 7: Conferência final e publicação (orquestrador)

- [ ] Revisão do branch inteiro (subagente revisor).
- [ ] Peter cola `db/dados-teste-desempenho.sql`; conferir por leitura que a turma e as tentativas existem.
- [ ] `npm test`, `npm run lint`, `npm run build`. Depois rebase em `origin/master`, push no `master` e conferência no www:
  - entrar com `teste.desempenho.ana`;
  - ver `/aluno/desempenho` e o detalhe de um conteúdo;
  - ver o relatório da turma TESTE DESEMPENHO com a conta do dono.
- [ ] Atualizar `CLAUDE.md` (item novo em "Pronto e no ar"; os projetos 2 a 4 em "Próximo passo") e a memória.
