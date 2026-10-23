# Hermes etapa C1: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contas de aluno ligadas à planilha (criar a partir da planilha, ligar pelo nome ou à mão) e ferramentas da Hermes (perfil dono) para contas e para ajudar o aluno (nova tentativa, encerrar, recorrigir, zerar aula).

**Architecture:** As regras de contas e de ajuda ao aluno ficam num núcleo com ator explícito (`AtorEscola`, como na etapa B). As server actions continuam como casca fina, e as ferramentas MCP do perfil dono chamam o mesmo núcleo via `atorDoEscopo` + `executarRegistrado`. A ligação usa `aluno_turmas.aluno_id`.

**Tech Stack:** Next.js 16.2 (ler `node_modules/next/dist/docs/`), Supabase (cliente anon do servidor), bcryptjs (já usado), `@modelcontextprotocol/sdk` + zod, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-23-hermes-etapa-c1-design.md` (+ spec mãe `docs/superpowers/specs/2026-10-12-hermes-assistente-pessoal-design.md`, Etapa C).

## Global Constraints

- **Ligação:**
  - `aluno_turmas.aluno_id` = linha do aluno no bimestre **vigente** do grupo (escola + `turma_nome` + `ano_letivo`); sem vigente, no último bimestre;
  - uma linha só pode ter uma conta (índice único parcial);
  - a ligação automática só acontece quando o nome normalizado (`normalizarBusca`) casa de forma **única** dos dois lados, dentro da mesma turma e do mesmo ano.
- **Permissões:**
  - na tela, `exigirAdminDaEscola` (admin ou dono da escola logada);
  - na Hermes, **só o perfil dono**, com `atorDoEscopo` (a escola vem da conta, da turma ou da tentativa lida do banco, ou do pedido para criar).
  - Conta de outra escola, referida pelo id → "Conta não encontrada." (a mensagem da tela).
- **Senha provisória:**
  - `gerarSenhaProvisoria` + `bcrypt.hash(…, 10)`, `senha_provisoria = true`, como hoje;
  - a senha volta **só na resposta**;
  - `resumirParametros` já mascara as chaves `senha`, `token` e `telefone`; a resposta da ferramenta nunca vai para o `hermes_registro`.
- **Exclusões pela Lixeira:**
  - tentativa → `lixeira_excluir('tentativa', …)`;
  - progresso de aula → `lixeira_excluir_progresso` (SQL novo).
- **Sistema:** usar as funções que já existem: `entregarTentativa`, `corrigirTentativa`, `sugerirUsuario`, `gerarSenhaProvisoria`.
- Nunca ler `senha_hash`, `token_verificacao*` nem `codigo_convite*`, exceto para gravar hash novo.
- Textos em pt-BR. Tokens do `DESIGN.md`, sem texto cinza.
- **Schema manual:** o SQL vai em `db/2026-10-23-hermes-etapa-c1.sql` e no fim de `db/schema.sql`. Conferir antes de publicar.
- Testes novos registrados no script `test`.
- Worktree `.worktrees/hermes-c`. Antes de cada task, `git fetch` e `git rebase origin/master`.

## Review Focus

1. **Dois alunos com o mesmo nome na turma**, ou uma conta com nome igual a dois alunos → nenhum dos dois é ligado automaticamente, e a prévia mostra "nome repetido: ligue à mão". Teste na Task 2.
2. **"Criar contas da planilha" rodado duas vezes** → a segunda não cria contas para quem já tem conta ligada. Teste na Task 2.
3. **Liberar nova tentativa de uma prova em andamento**, com o aluno fazendo agora → recusa ("O aluno está fazendo a prova agora; encerre antes."), a menos que o pedido seja explícito com `mesmo_em_andamento: true`. Teste na Task 4.
4. **Senha provisória** não aparece em `hermes_registro.parametros` nem em `mensagem`. Teste na Task 5.
5. **Restaurar** uma tentativa ou um progresso de aula da Lixeira, quando o aluno já refez a prova ou a aula → conflito claro, e a cópia continua na Lixeira (o `unique_violation` da restauração já trata isso). Conferência na Task 6.

---

### Task 1: SQL (ligação única, progresso na Lixeira, origem hermes)

**Files:**
- Create: `db/2026-10-23-hermes-etapa-c1.sql`
- Modify: `db/schema.sql` (anexar), `src/lib/types.ts` (`TipoLixeira` + `"progresso_aula"`), `src/lib/lixeira.ts` + `src/lib/lixeira.test.ts` (rótulo "Progresso de aula restaurado.", resumo), `src/components/admin/LixeiraLista.tsx` (ícone, nome e plural do tipo novo)

**Interfaces — Produces:**
- índice `uq_aluno_turmas_aluno`;
- check de `lixeira.tipo` com `progresso_aula`;
- `lixeira_excluir_progresso(p_conta uuid, p_aula uuid, p_ator uuid default null, p_via text default 'app') returns uuid`: copia a linha de `aula_progresso` para `dados.aula_progresso`, com a escola da conta, e apaga;
- `lixeira_restaurar` passando a incluir `'aula_progresso'` no fim da lista de tabelas (as regras de "set null" não se aplicam, porque as FKs de `aula_progresso` são cascade);
- check de `alunos_contas.criado_via` aceitando `'hermes'` (drop/add constraint, de forma idempotente; descobrir o nome real da constraint em `db/schema.sql`).

O SQL precisa ser idempotente. `lixeira_restaurar` é redefinida por inteiro, mantendo o corpo atual da produção (o arquivo da etapa B com a correção dos vínculos) e só acrescentando `aula_progresso`.

- [ ] **Step 1:** Escrever os testes de texto em `lixeira.test.ts` para `progresso_aula`.
- [ ] **Step 2:** Rodar o teste. Esperado: FALHA.
- [ ] **Step 3:** Escrever o SQL e o resto da task.
- [ ] **Step 4:** Rodar `npm test`, `npx tsc --noEmit` e `npm run lint`. Esperado: 0.
- [ ] **Step 5:** Commit "Hermes C1: SQL da ligacao unica e progresso na Lixeira".
- [ ] **Step 6 (controller):** mandar o SQL ao Peter e conferir depois, só lendo: o índice responde (`aluno_turmas` lê normal) e `lixeira_restaurar` de um uuid aleatório responde "Item não encontrado".

### Task 2: Ligação conta ↔ planilha (núcleo puro e com banco)

**Files:**
- Create: `src/lib/contas/ligacao.ts` (puro), `src/lib/contas/ligacao.test.ts`, `src/lib/contas/nucleo.ts`
- Modify: `src/actions/contas-aluno.ts` (casca fina; ações novas), `package.json`

**Interfaces — Produces:**
- Puras:
  - `linhaDeReferencia(bimestres: { turmaId: string; vigente: boolean; bimestre: string }[]): string | null`: o vigente, senão o último pela ordem do bimestre.
  - `sugerirLigacoes(contas: { contaId: string; nome: string; alunoIdAtual: string | null }[], alunos: { alunoId: string; nome: string; jaLigado: boolean }[]): { ligar: { contaId: string; alunoId: string }[]; repetidos: { nome: string; contas: number; alunos: number }[]; semPar: string[] }`.
    - Casa só nomes normalizados únicos dos dois lados;
    - ignora contas já ligadas e alunos já ligados.
  - `alunosSemConta(alunos, ligadosIds: Set<string>)`.
- Núcleo, com `AtorEscola`:
  - `grupoDaTurmaId(ator, turmaId)`: valida que a turma é da escola do ator, com as turmas liberadas.
  - `previaContasDaPlanilhaPor(ator, turmaId): Promise<{ nome: string; usuario: string; alunoId: string }[]>`.
  - `criarContasDaPlanilhaPor(ator, turmaId, linhas: { alunoId: string; usuario: string }[]): Promise<CredencialGerada[]>`:
    - usa a mesma validação de usuário e a mesma criação de `criarContasAluno`, extraindo o trecho em comum;
    - o nome vem da planilha, nunca do cliente;
    - grava `aluno_turmas.aluno_id` = a linha de referência;
    - quem já tem conta ligada é ignorado (item 2 da Review Focus).
  - `previaLigacoesPorNomePor(ator, turmaId)` → `sugerirLigacoes`.
  - `aplicarLigacoesPor(ator, turmaId, pares: { contaId; alunoId }[])`:
    - revalida cada par: conta e aluno do mesmo grupo, aluno sem conta;
    - violação do índice único → mensagem clara.
  - `ligarContaPor(ator, contaId, alunoId | null)`: liga à mão, ou desliga com `null`.

- [ ] **Step 1:** Escrever os testes puros:
  - `sugerirLigacoes` (item 1 da Review Focus):
    - "João Silva" × "joao  silva" → liga;
    - dois alunos "Pedro" → nenhum ligado e aparece em `repetidos`;
    - conta já ligada → ignorada;
    - aluno já ligado → ignorado.
  - `linhaDeReferencia`: com vigente; sem vigente → o último.
  - `alunosSemConta`.
- [ ] **Step 2:** `npx tsx --test src/lib/contas/ligacao.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Implementar o núcleo e as ações novas em `src/actions/contas-aluno.ts`:
  - `previaContasDaPlanilha(turmaId)`;
  - `criarContasDaPlanilha(turmaId, linhas)`;
  - `previaLigacoesPorNome(turmaId)`;
  - `aplicarLigacoes(turmaId, pares)`;
  - `ligarConta(contaId, alunoId | null)`.

  As ações que já existem continuam com a mesma assinatura e passam a usar o núcleo.
- [ ] **Step 4:** Rodar `npm test`, `npx tsc --noEmit` e `npm run lint`. Esperado: 0.
- [ ] **Step 5:** Commit "Contas: ligacao com a planilha (nucleo e acoes)".

### Task 3: Tela "Contas de alunos": criar da planilha e ligar

**Files:**
- Modify: `src/components/admin/GerenciarAlunos.tsx` (+ `ContasAdmin.module.css`), `src/app/admin/alunos/page.tsx` (passar o que faltar), `src/actions/contas-aluno.ts` (`listarContasAluno` passa a dizer se cada conta está ligada e a quê)

**Interfaces — Consumes:** as ações da Task 2.

Tela:
- **Botão "Criar contas da planilha"**, ao lado do lote atual:
  - escolher a turma;
  - prévia com nome, usuário editável e "já tem conta" desabilitado;
  - "Criar contas";
  - mesma planilha Excel de acessos de hoje.
- **Botão "Ligar pelo nome"**, com a turma escolhida: prévia do que será ligado, lista de repetidos ("ligue à mão") e "Aplicar".
- **Em cada conta:** selo "Ligada a <nome da planilha>" ou "Sem ligação com a planilha", com o seletor "Ligar a…" (alunos sem conta da turma da conta) e "Desligar".

Visual dos cartões existentes (`ContasAdmin.module.css`, `DESIGN.md`), sem texto cinza, funcionando a 390 px.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** Rodar `npx tsc --noEmit`, `npm run lint` e `npm run build`. Esperado: 0.
- [ ] **Step 3:** Commit "Contas: criar contas da planilha e ligar pelo nome na tela".

### Task 4: Núcleo de contas e de ajuda ao aluno (para a Hermes)

**Files:**
- Modify: `src/lib/contas/nucleo.ts`
- Create: `src/lib/simulados/ajuda.ts`, `src/lib/simulados/ajuda.test.ts`, `src/lib/aulas/ajuda.ts`
- Modify: `package.json`

**Interfaces — Produces** (todas com `AtorEscola`; conta, tentativa e aula sempre conferidas na escola do ator):
- **Contas:**
  - `definirContaAtivaPor(ator, contaId, ativo)`;
  - `novaSenhaPor(ator, contaId): Promise<string>`;
  - `editarContaPor(ator, contaId, { nome?, usuario? })`: o usuário segue a mesma regra `/^[a-z0-9.]+$/` e é único (`23505` → "Esse usuário já existe.");
  - `turmasDaContaPor(ator, contaId, { incluir?: { turma_nome; ano_letivo }[]; remover?: … })`: a turma precisa existir na escola; trocar = remover + incluir; ao remover, a ligação daquele grupo vai junto;
  - `criarContasPor(ator, turmaId, alunos: { nome; usuario }[])`: o lote atual, com `criado_via = 'hermes'` quando `ator.via === 'hermes'`.
- **Ajuda ao aluno:**
  - `regraNovaTentativa(t: { status: string; prazo_em: string | null }, agora: Date, mesmoEmAndamento: boolean): string | null` (puro): devolve a mensagem de recusa ou `null`;
  - `liberarNovaTentativaPor(ator, tentativaId, mesmoEmAndamento = false): Promise<string>`: devolve o id na Lixeira;
  - `encerrarTentativaPor(ator, tentativaId)`: só `em_andamento`; senão "Essa tentativa já foi entregue.";
  - `recorrigirTentativaPor(ator, tentativaId)`;
  - `zerarProgressoAulaPor(ator, contaId, aulaId): Promise<string>`: a aula precisa ser de curso da mesma escola.

- [ ] **Step 1:** Escrever os testes puros de `regraNovaTentativa` (item 3 da Review Focus):
  - em andamento com prazo futuro e sem a flag → recusa;
  - com a flag → `null`;
  - entregue → `null`;
  - em andamento com prazo vencido → `null`.
- [ ] **Step 2:** Rodar o teste. Esperado: FALHA.
- [ ] **Step 3:** Implementar o núcleo. As ações da tela que já existem (`definirContaAtiva`, `novaSenhaAlunoPeloAdmin`, `criarContasAluno`) passam a chamar o núcleo, com a mesma assinatura e as mesmas mensagens.
- [ ] **Step 4:** Rodar `npm test`, `npx tsc --noEmit` e `npm run lint`. Esperado: 0.
- [ ] **Step 5:** Commit "Hermes C1: nucleo de contas e de ajuda ao aluno".

### Task 5: Ferramentas da Hermes (perfil dono)

**Files:**
- Create: `src/lib/mcp/acoes/contas.ts`, `src/lib/mcp/acoes/ajuda.ts`, `src/lib/mcp/acoes/contas.test.ts`
- Modify: `src/lib/mcp/acoes.ts` (registrar só quando `perfil === "dono"`), `src/app/api/mcp/dono/route.ts` (`INSTRUCOES`), `package.json`

Ferramentas (aluno por nome ou `conta_id`; turma por nome; escola opcional, como na etapa B; nome que casa com várias contas → lista para escolher):

| Ferramenta | Função |
|---|---|
| `criar_contas_aluno` (turma, nomes[]) | `criarContasPor`: devolve usuários e senhas |
| `criar_contas_da_planilha` (turma) | `previaContasDaPlanilhaPor` + `criarContasDaPlanilhaPor` |
| `ligar_contas_pelo_nome` (turma, aplicar?: boolean) | sem `aplicar`, mostra a prévia; com `aplicar: true`, aplica |
| `ligar_conta` (aluno, aluno_planilha) | `ligarContaPor` |
| `bloquear_conta` / `desbloquear_conta` | `definirContaAtivaPor` |
| `gerar_senha_provisoria` | `novaSenhaPor` |
| `corrigir_conta` (nome?, usuario?) | `editarContaPor` |
| `turmas_da_conta` (incluir?, remover?) | `turmasDaContaPor` |
| `liberar_nova_tentativa` (aluno, simulado, mesmo_em_andamento?) | `liberarNovaTentativaPor` |
| `encerrar_tentativa` / `recorrigir_tentativa` (aluno, simulado) | `…Por` |
| `zerar_progresso_aula` (aluno, curso, aula) | `zerarProgressoAulaPor` |

- Todas passam por `executarRegistrado`.
- `INSTRUCOES` do dono: "Antes de criar contas, gerar senha, bloquear, liberar nova tentativa, encerrar ou zerar progresso, resuma e peça confirmação. Senhas provisórias só na resposta; não repita em outras mensagens."

- [ ] **Step 1:** Escrever os testes puros:
  - textos de resposta: as credenciais em lista, sem "undefined";
  - escolha do aluno com nome repetido → lista;
  - `parametrosParaRegistro` das ferramentas de senha sem nenhuma senha (item 4 da Review Focus);
  - validação de `usuario`.
- [ ] **Step 2:** Rodar o teste. Esperado: FALHA.
- [ ] **Step 3:** Implementar e registrar.
- [ ] **Step 4:** Rodar `npm test`, `npx tsc --noEmit`, `npm run lint` e `npm run build`. Esperado: 0.
- [ ] **Step 5:** Commit "Hermes C1: ferramentas de contas e ajuda ao aluno".

### Task 6: Prévia, conferência ponta a ponta e entrega

- [ ] **Prévia temporária da tela de contas** com dados fictícios (roteiro em `C:\Users\pkinh\.claude\skills\status-visual-aluno\references\previa-e-publicacao.md`, seções 1–3), mostrando:
  - criar da planilha;
  - ligar pelo nome com repetidos;
  - os selos.

  Prints em 1340 e 390.
- [ ] **Ponta a ponta na HARMONIA**, a escola de teste, com cliente MCP em memória e perfil dono, contra o banco real:
  1. criar uma turma de teste "Turma Teste C1" com 3 alunos na planilha, um deles com nome repetido de propósito;
  2. `criar_contas_da_planilha`, conferindo `aluno_id`;
  3. `ligar_contas_pelo_nome` com repetido;
  4. `gerar_senha_provisoria`, conferindo que o registro não tem a senha;
  5. `bloquear_conta`, depois `desbloquear_conta`;
  6. criar um treino de teste para uma conta (pelo mesmo caminho do aluno, ou direto no banco só para teste), depois `encerrar_tentativa`, `liberar_nova_tentativa` e restaurar pela RPC;
  7. `carregarRelatorioAluno` daquela linha deve mostrar `temConta: true`;
  8. **limpar tudo** o que foi criado: turma, alunos, contas, vínculos, simulado de teste e itens da Lixeira de teste.
- [ ] Rodar `npx tsc --noEmit`, `npm test`, `npm run lint` e `npm run build`, todos com saída 0.
- [ ] Com o SQL conferido: publicar e conferir o deploy.
