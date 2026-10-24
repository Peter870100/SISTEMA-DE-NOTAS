# Hermes etapa C2: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Hermes passa a cuidar de professores (papel, acesso, telefone, senha provisória), opera as planilhas de qualquer escola com as ferramentas antigas e cuida de cursos (publicar aula, ligar curso a turmas).

**Architecture:**
- Mesmo padrão das etapas B e C1: as regras ficam em núcleos com `AtorEscola`, as server actions são cascas finas e as ferramentas MCP usam `atorDoEscopo` + `executarRegistrado`.
- As ferramentas antigas (`src/lib/mcp-tools.ts`) deixam de usar a escola fixa `ESCOLA_PADRAO_ID`. Elas passam a receber um "contexto de planilha", com a escola e as turmas liberadas, decidido pelo perfil:
  - **dono:** a escola do pedido;
  - **professor com telefone:** o escopo dele;
  - **professor sem telefone:** o Colégio Status, como hoje.

**Tech Stack:** Next.js 16.2, Supabase (cliente anon do servidor), `@modelcontextprotocol/sdk` + zod, bcryptjs, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-23-hermes-etapa-c2-design.md` (+ spec mãe, Etapa C).

## Global Constraints

- **Professores (só perfil dono):**
  - ninguém altera a conta do dono, e o papel `dono` não é atribuído nem removido (mensagem: "A conta do dono não pode ser alterada pela Hermes.");
  - os papéis aceitos são só `admin` e `professor`;
  - as turmas liberadas existem na escola do professor;
  - senha provisória: `gerarSenhaProvisoria` + `bcrypt.hash(…, 10)` + `senha_provisoria = true`, como em `definirSenhaProvisoria`; a senha aparece só na resposta.
- **Telefone do professor:** a mesma normalização e validação de `atualizarTelefoneProfessor`. Um telefone repetido em outra conta é recusado, porque o escopo do Telegram exige unicidade.
- **Planilha:**
  - perfil professor sem `professor_telefone`: comportamento idêntico ao de hoje (Colégio Status);
  - com telefone: `escopoDoTelefone` (escola + turmas), e turma fora do alcance → "Você não tem acesso à turma X.";
  - perfil dono: parâmetro `escola` (mais de uma escola e sem `escola` → pergunta).
- **Registro:** toda ferramenta que grava (as novas e as antigas que escrevem) passa por `executarRegistrado`. As de leitura não registram.
- **Nomes:** nas ferramentas que gravam, nome exato ou pergunta (regra da C1). As ferramentas antigas mantêm a busca de hoje para **ler**; para **gravar** com nome parcial, perguntam.
- **Cursos (só dono):**
  - `definirPublicacao` com as mesmas regras;
  - turmas do curso: a lista inteira é substituída, e só turmas da escola do curso entram.
- Sem SQL novo.
- Textos em pt-BR. Testes novos registrados no script `test`.
- Worktree `.worktrees/hermes-c2`. Antes de cada task, `git fetch` e `git rebase origin/master`.
- **Código editado só com Edit/Write.** Edição por shell já apagou uma barra de regex antes.

## Review Focus

1. **Professor pelo Telegram, sem telefone** (o uso atual) → tudo igual a hoje. Teste de contexto na Task 2.
2. **Professor com telefone de outra escola** lança nota → age na escola dele, nunca no Colégio Status. Teste na Task 2.
3. **Pedido para tornar alguém dono, ou mexer na conta do dono** → recusa. Teste na Task 1.
4. **Telefone novo já usado por outro professor** → recusa clara. Teste na Task 1.
5. **Publicar uma aula de vídeo sem duração** → mesma recusa da tela. Conferência na Task 4.

---

### Task 1: Núcleo de professores e ferramentas (dono)

**Files:**
- Create: `src/lib/professores/nucleo.ts`, `src/lib/professores/regras.ts`, `src/lib/professores/regras.test.ts`, `src/lib/mcp/acoes/professores.ts`
- Modify: `src/actions/professores.ts` (cascas finas, mesmas mensagens), `src/lib/mcp/acoes.ts` (registrar no dono), `package.json`

**Interfaces — Produces:**
- Puras, em `regras.ts`:
  - `podeAlterarProfessor(alvoRole, novoPapel?): string | null` (devolve a mensagem de recusa);
  - `normalizarTelefone` (reaproveitar o que a tela já faz, extraindo se precisar).
- Núcleo:
  - `configurarProfessorPor(ator, professorId, { papel?, restrito?, turmas? })`;
  - `telefoneProfessorPor(ator, professorId, telefone)`;
  - `senhaProvisoriaProfessorPor(ator, professorId): Promise<string>`.
- Ferramentas:
  - `configurar_professor` (professor por nome, `escola?`, `papel?`, `acesso: "todas" | "restrito"`, `turmas?`);
  - `telefone_professor`;
  - `senha_provisoria_professor`.

- [ ] **Step 1:** Escrever os testes puros:
  - alvo dono → recusa;
  - `novoPapel: "dono"` → recusa;
  - admin → professor e professor → admin → ok;
  - normalização do telefone.
- [ ] **Step 2:** Rodar o teste. Esperado: FALHA.
- [ ] **Step 3:** Implementar o núcleo, as cascas e as ferramentas. As `INSTRUCOES` do dono passam a mencionar confirmação antes de mudar papel, acesso, telefone ou senha de professor.
- [ ] **Step 4:** Rodar `npm test`, `npx tsc --noEmit`, `npm run lint` e `npm run build`. Esperado: 0.
- [ ] **Step 5:** Commit "Hermes C2: professores (papel, acesso, telefone, senha)".

### Task 2: Ferramentas antigas da planilha em qualquer escola

**Files:**
- Create: `src/lib/mcp/planilha-contexto.ts`, `src/lib/mcp/planilha-contexto.test.ts`
- Modify: `src/lib/mcp-tools.ts` (trocar a escola fixa pelo contexto; registro nas que gravam; nome exato para gravar), `src/app/api/mcp/dono/route.ts` (registrar as ferramentas da planilha com `escola`), `src/app/api/mcp/route.ts` (contexto do professor), `package.json`

**Interfaces — Produces:**
- `type ContextoPlanilha = { escolaId: string; turmas: Set<string> | null; registro: { perfil: "dono" | "professor"; professorId: string | null } }`.
- `contextoPlanilha(perfil, args: { escola?; professor_telefone? }, deps): Promise<ContextoPlanilha | { pergunta: string }>`:
  - **dono:** escolhe a escola pelo nome ou slug (`escolasDoPedido`), e pergunta se houver várias sem `escola`;
  - **professor com telefone:** `escopoDoTelefone`;
  - **professor sem telefone:** `{ escolaId: ESCOLA_PADRAO_ID, turmas: <a regra de hoje para telefone ausente> }`.
- `registrarFerramentas(server, supabase, obterContexto)`: a assinatura muda e todas as ferramentas usam o contexto.

- [ ] **Step 1:** Escrever os testes puros do contexto, com dependências injetadas (itens 1 e 2 da Review Focus):
  - professor sem telefone → escola padrão e as mesmas turmas de hoje;
  - professor com telefone de outra escola → a escola dele;
  - dono com 2 escolas sem `escola` → pergunta;
  - dono com `escola: "harmonia"` → a HARMONIA.
- [ ] **Step 2:** Rodar o teste. Esperado: FALHA.
- [ ] **Step 3:** Refatorar `mcp-tools.ts`. **Ler a função antiga de cada ferramenta antes** e manter as mensagens. Trocar todo `ESCOLA_PADRAO_ID` pelo `ctx.escolaId`. As ferramentas que gravam passam por `executarRegistrado`. Para gravar, nome de turma ou aluno parcial pergunta, enquanto ler mantém a busca de hoje.
- [ ] **Step 4:** Rodar `npm test`, `npx tsc --noEmit`, `npm run lint` e `npm run build`. Esperado: 0.
- [ ] **Step 5:** Commit "Hermes C2: ferramentas da planilha em qualquer escola".

### Task 3: Cursos (publicar aula, turmas do curso)

**Files:**
- Create: `src/lib/aulas/cursos-nucleo.ts`, `src/lib/mcp/acoes/cursos.ts`, `src/lib/mcp/acoes/cursos.test.ts`
- Modify: `src/actions/cursos.ts` (`definirPublicacao` e a gravação de turmas do curso como cascas finas, mesmas mensagens), `src/lib/mcp/acoes.ts`, `package.json`

**Interfaces — Produces:**
- `publicarAulaPor(ator, aulaId, publicada: boolean)`;
- `turmasDoCursoPor(ator, cursoId, turmas: { turma_nome; ano_letivo }[])`;
- ferramentas `publicar_aula` (curso, aula, `publicar: boolean`) e `turmas_do_curso` (curso, turmas[]).

Curso e aula pelo título exato, ou pergunta.

- [ ] **Step 1:** Escrever os testes puros:
  - resolução de curso e aula por título exato ou parcial;
  - turmas do curso: nomes inexistentes → erro com a lista de turmas da escola.
- [ ] **Step 2:** Rodar o teste. Esperado: FALHA.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar `npm test`, `npx tsc --noEmit`, `npm run lint` e `npm run build`. Esperado: 0.
- [ ] **Step 5:** Commit "Hermes C2: cursos (publicar aula e turmas do curso)".

### Task 4: Conferência ponta a ponta e entrega

- [ ] **Na HARMONIA**, com cliente MCP em memória e o banco real, nesta ordem:
  1. **Perfil dono, ferramentas antigas** com `escola: "HARMONIA"`: `criar_turma` "Turma Teste C2", `criar_aluno`, `criar_atividade`, `lancar_nota` e `ver_planilha`;
  2. **Curso de teste** criado pelo núcleo, só para o teste: `turmas_do_curso` com a turma de teste; `publicar_aula` numa aula sem vídeo deve publicar, e numa aula de vídeo sem duração deve recusar (item 5 da Review Focus);
  3. **Professor de teste** criado no banco só para o teste, na HARMONIA: `configurar_professor` (restrito, só a turma de teste), `telefone_professor` e `senha_provisoria_professor`, conferindo que a senha não aparece no registro;
  4. **Perfil professor com o telefone de teste:** `lancar_nota` na turma liberada funciona e numa turma não liberada recusa;
  5. **Perfil professor sem telefone:** `listar_turmas` lista as do Colégio Status, só lendo, como hoje;
  6. **Limpar tudo** o que foi criado.
- [ ] Rodar `npx tsc --noEmit`, `npm test`, `npm run lint` e `npm run build`, todos com saída 0.
- [ ] Publicar e conferir o deploy.
