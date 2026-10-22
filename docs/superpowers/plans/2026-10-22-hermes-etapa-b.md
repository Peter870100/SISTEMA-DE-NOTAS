# Hermes etapa B: questões e simulados (plano de implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Hermes passa a **alterar** dados de questões e simulados, com as mesmas regras da tela, pelos dois perfis (dono e professor). Tudo o que ela cria ganha o selo da Hermes, toda alteração fica registrada, e as exclusões vão para a Lixeira.

**Architecture:** As regras que hoje vivem dentro das server actions (que dependem do cookie de login) passam para um **núcleo** que recebe um `AtorEscola` explícito. As server actions continuam iguais por fora: montam o ator a partir da sessão e chamam o núcleo. As ferramentas MCP montam o ator a partir do `Escopo` da etapa A (dono, ou professor pelo telefone) e chamam o mesmo núcleo. Por isso o resultado é idêntico ao da tela. Cada ferramenta de escrita passa por `executarRegistrado`, que grava em `hermes_registro`.

**Tech Stack:** Next.js 16.2 (ler `node_modules/next/dist/docs/` antes de usar API do Next), React 19.2, Supabase (cliente anon no servidor, como o resto do sistema), `@modelcontextprotocol/sdk` + zod (padrão de `src/lib/mcp/leitura/*`), TypeScript, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-12-hermes-assistente-pessoal-design.md`, seções "Dois perfis de acesso", "Selo da Hermes e registro", "Etapa B" (exceto a importação de provas) e "Lixeira".

**Fora deste plano (próximos planos):**
- **B2, importação de provas pela Hermes** (`importar_prova`, `situacao_importacao`, `ler_de_novo`, `aprovar_sem_aviso`). Mexe em PDF no servidor e no fluxo de páginas da conferência, e merece um plano próprio.
- **C, alunos, contas, turmas e cursos.**

**Referência, não base:** o commit local `43702ff` (branch `feat/hermes`) é uma versão paralela, feita sobre uma base antiga e sem a etapa A. **Não fazer merge dele.** Pode servir de consulta para três peças: `src/lib/simulados/repetidas.ts` (não repetir), `src/lib/simulados/configuracao.ts` e o SQL da Lixeira em `db/2026-10-20-hermes-lixeira.sql` (funções de questão, simulado e tentativa). O caminho de SQL livre com papel próprio no banco (`hermes_leitor`, `HERMES_DATABASE_URL`, `src/lib/hermes/sql.ts`) **não entra**: a etapa A já resolveu a consulta livre de forma estruturada.

## Global Constraints

- **Perfil dono:** `/api/mcp/dono` com `MCP_DONO_TOKEN`, alcança todas as escolas. **Perfil professor:** `/api/mcp` com `MCP_SECRET_TOKEN`, alcança só a escola dele e as turmas que ele pode ver (admin vê a escola toda; professor com acesso restrito só as turmas liberadas).
- No perfil professor, **toda ferramenta nova exige `professor_telefone`**. Telefone não cadastrado = recusa (`escopoDoTelefone`, que já existe).
- Ações que **criam ou publicam** (criar simulado, publicar, liberar correção, publicar questão): as `instructions` mandam a Hermes **resumir e pedir confirmação** antes de executar.
- Exclusões **sempre pela Lixeira** (restauráveis). Nada é apagado de forma definitiva.
- **Sem chave geral do Supabase:** o acesso continua pelo cliente anon do servidor, como o resto do sistema.
- Tudo o que a Hermes **cria** ganha `criado_via = 'hermes'` e mostra o `SeloHermes` ao lado do nome (simulados e questões, neste plano). Alterações ficam em `hermes_registro`: quando, quem pediu (dono, ou professor pelo telefone), ferramenta, parâmetros resumidos e resultado. A tela "Feito pela Hermes" fica no painel do dono.
- **Reaproveitar as funções do sistema** (`sortear`, `candidatosSorteio`, `corrigir`, regras de publicação, `limparConteudo`), para o resultado ser idêntico ao feito pela tela.
- **No perfil professor:** criar, configurar, sortear e publicar simulado e liberar correção, só para as turmas que ele vê. Cuidar de questões só no **banco da escola**; o banco geral continua só do dono. Simulado criado pela Hermes a pedido do professor fica com `professor_id` desse professor.
- Banca **sem diferenciar maiúsculas** (`padraoExato`, que já existe).
- **Não repetir:** por padrão o sorteio exclui questões que já estiveram em simulados **publicados** das **mesmas turmas**. `permitir_repetidas: true` desliga. O resultado informa quantas foram puladas. O mesmo filtro aparece na tela de montar simulado, na caixa "Não repetir questões já aplicadas a estas turmas".
- Nunca ler `senha_hash`, `token_verificacao*` nem `codigo_convite*`.
- Textos em pt-BR. Tokens do `DESIGN.md`.
- **Schema manual:** o SQL vai em `db/2026-10-22-hermes-etapa-b.sql` **e** ao fim de `db/schema.sql`. O Peter cola no SQL Editor. Conferir no banco (só leitura) antes de publicar código que dependa dele.
- Testes novos registrados no script `test` do `package.json`.
- Worktree `.worktrees/hermes-b`. Antes de cada task, `git fetch` e `git rebase origin/master`. Outra sessão pode mexer nas mesmas telas: em conflito, manter as duas mudanças; se ela redesenhou a mesma coisa, parar.

## Review Focus

1. **Professor fora do alcance:** um professor pelo Telegram pede para mexer num simulado ou numa questão de **outra escola**, ou de uma turma que não foi liberada para ele → recusa com a mesma mensagem da tela, e nada é gravado. Teste em `acoes.test.ts` (Task 6).
2. **Questão com formatação editada pela Hermes:** a Hermes troca o texto de uma questão que tem `conteudo` (barra de formatação). O aluno precisa ver o **texto novo**, não o antigo guardado no documento. As figuras que estavam no meio do texto não somem: voltam para o fim. Teste em `questoes-nucleo.test.ts` (Task 4).
3. **Simulado com tentativas:** a Hermes tenta trocar questões, duração ou abertura depois que alunos começaram → mesma recusa da tela ("Alunos já começaram…"). Teste em `configuracao.test.ts` (Task 2).
4. **Não repetir sem turmas:** o simulado ainda não tem turmas → nada é excluído, e o resultado diz isso em vez de "0 puladas". Teste em `repetidas.test.ts` (Task 3).
5. **Restaurar da Lixeira:**
   - uma questão que estava num simulado com respostas volta **com** os vínculos e as respostas;
   - restaurar um simulado cujas questões foram apagadas depois → erro claro, e a cópia continua na Lixeira.

   Conferência manual descrita na Task 1.
6. **Dono sem escola:** o dono pede "crie um simulado" sem dizer a escola e há mais de uma → a ferramenta pede a escola (lista as opções) em vez de escolher uma. Teste em `acoes.test.ts` (Task 6).

---

### Task 1: Banco (SQL), tipos e textos da Lixeira

**Files:**
- Create: `db/2026-10-22-hermes-etapa-b.sql`
- Modify: `db/schema.sql` (anexar o mesmo SQL ao fim), `src/lib/types.ts`, `src/lib/lixeira.ts`, `src/lib/lixeira.test.ts`, `src/actions/lixeira.ts`, `src/components/admin/LixeiraLista.tsx` (só se precisar de rótulo novo)

**Interfaces:**
- Produces:
  - `TipoLixeira = "turma" | "aluno" | "atividade" | "questao" | "simulado" | "tentativa"`
  - `Simulado.criado_via` e `Questao.criado_via` (`"app" | "hermes"`)
  - tipo `HermesRegistro` (colunas da tabela abaixo)
  - RPC `lixeira_excluir(p_tipo, p_id, p_ator, p_via)` aceitando os 3 tipos novos, devolvendo o id do item na Lixeira
  - RPC `lixeira_restaurar(p_lixeira_id)` restaurando os 3 tipos novos

SQL. Partir de `db/2026-10-20-hermes-lixeira.sql` do commit `43702ff`, só a parte da Lixeira; as funções `hermes_zerar_progresso` e `hermes_configurar_professor` ficam para o plano C.
- `alter table simulados|questoes|importacoes add column if not exists criado_via varchar(10) not null default 'app' check (criado_via in ('app','hermes'))`.
- Tabela `hermes_registro`:
  - colunas `id`, `perfil` (`dono`|`professor`), `professor_id` (fk `professores`, `on delete set null`), `escola_id` (pode ser null), `ferramenta`, `parametros` jsonb, `situacao` (`iniciada`|`concluida`|`erro`), `mensagem` text, `criado_em`, `concluido_em`;
  - índice por `criado_em desc`;
  - RLS e policy iguais às das outras tabelas do sistema (`for all using (true) with check (true)`).
- Lixeira:
  - o check de `tipo` ganha `questao`, `simulado` e `tentativa`;
  - `escola_id` deixa de ser `not null`, porque a questão do banco geral não tem escola;
  - `lixeira_excluir` e `lixeira_restaurar` atendem os novos tipos e mantêm os antigos funcionando: renomear as atuais para `*_legado` só se `*_legado` ainda não existir, e delegar para elas.
- Restauração: na ordem das chaves estrangeiras (`questoes`, `questao_imagens`, `simulados`, `simulado_turmas`, `simulado_questoes`, `tentativas`, `tentativa_respostas`). Conflito aborta tudo e o item continua na Lixeira.
- Questão na Lixeira guarda as imagens, os vínculos com simulados e as respostas. **Os arquivos do Storage ficam** (é isso que permite restaurar).
- `NOTIFY pgrst, 'reload schema';` no fim.

- [ ] **Step 1: Escrever os testes de texto em `src/lib/lixeira.test.ts`**

```ts
test("descreverResumo dos tipos novos usa o total de registros", () => {
  assert.equal(descreverResumo("questao", { registros: 1 }), "1 registro");
  assert.equal(descreverResumo("simulado", { registros: 34 }), "34 registros");
});
test("mensagemRestauracao dos tipos novos", () => {
  assert.equal(mensagemRestauracao({ tipo: "questao", turma_id: null, notas_restauradas: 0, notas_puladas: 0 }), "Questão restaurada.");
  assert.equal(mensagemRestauracao({ tipo: "simulado", turma_id: null, notas_restauradas: 0, notas_puladas: 0 }), "Simulado restaurado.");
  assert.equal(mensagemRestauracao({ tipo: "tentativa", turma_id: null, notas_restauradas: 0, notas_puladas: 0 }), "Tentativa restaurada.");
});
```

- [ ] **Step 2:** `npx tsx --test src/lib/lixeira.test.ts`. Esperado: FALHA (tipos e rótulos ainda não existem).
- [ ] **Step 3:** Atualizar os tipos em `src/lib/types.ts`: `ResumoLixeira` ganha `registros?: number`. Atualizar `descreverResumo` e `ROTULO` em `src/lib/lixeira.ts`.
- [ ] **Step 4:** Escrever o SQL.
- [ ] **Step 5:** Ajustar `listarLixeira`: para o dono, listar também os itens com `escola_id` nulo (`.or(...)`). Para os outros papéis, nada muda.
- [ ] **Step 6:** `npx tsx --test src/lib/lixeira.test.ts`, depois `npx tsc --noEmit`. Esperado: PASSA, e sem erro de tipo.
- [ ] **Step 7:** Commit "Hermes B: SQL da Lixeira nova, selo e registro".
- [ ] **Step 8 (controller):** mandar o SQL ao Peter. Depois que ele colar, conferir só lendo:
  - `simulados.criado_via`, `questoes.criado_via` e a tabela `hermes_registro` respondem;
  - `rpc('lixeira_restaurar', { p_lixeira_id: <uuid aleatório> })` devolve "Item não encontrado" (prova que a função nova está lá sem alterar nada).

  A conferência manual do item 5 da Review Focus é feita na Task 7, numa escola de teste.

### Task 2: Núcleo de simulados com ator explícito

**Files:**
- Create: `src/lib/simulados/ator.ts`, `src/lib/simulados/configuracao.ts`, `src/lib/simulados/configuracao.test.ts`, `src/lib/simulados/nucleo.ts`
- Modify: `src/actions/simulados.ts` (vira casca fina), `src/lib/simulados/servidor.ts` (`podeEditarSimulado` aceita `Ator`), `package.json` (teste novo)

**Interfaces:**
- Consumes: `Ator` de `src/lib/questoes/regras.ts` (`{ id, role, escola_id }`); `turmasLiberadasPara` de `src/lib/auth.ts`; `sortear` e `candidatosSorteio`.
- Produces:
  - `type AtorEscola = Ator & { turmas: Set<string> | null; via: "app" | "hermes" }`. `turmas` null = vê todas as turmas da escola. `escola_id` = a escola onde a ação acontece (o dono pela Hermes recebe a escola do pedido).
  - `atorDaSessao(): Promise<AtorEscola>` em `ator.ts`: faz `exigirNaoAluno` + `getProfessorAtual` + `turmasLiberadasPara` e usa `via: "app"`.
  - Em `configuracao.ts` (puro): `limparConfiguracao(d: DadosSimulado)` (as regras de `limpar` de hoje), `limparFiltros(f)`, `mudancaProibidaComTentativas(antes, depois, turmasAntes, turmasDepois): boolean`, `validarPublicacao(s, qtdQuestoes, qtdTurmas): string | null`, `validarOrdem(atual: string[], nova: string[]): string | null`.
  - Em `nucleo.ts`, todas com `(ator: AtorEscola, …)`:
    - `criarSimuladoPor(ator, d): Promise<string>`, que grava `criado_via = ator.via`;
    - `salvarSimuladoPor(ator, id, d)`;
    - `sortearQuestoesPor(ator, id, f & { quantidade; naoRepetir? })`, que devolve `{ adicionadas, pedidas, puladas }`;
    - `trocarQuestaoPor`, `removerQuestaoPor`, `adicionarQuestaoPor`, `buscarQuestoesBancoPor`;
    - `ordenarQuestoesPor(ator, id, ordem: string[])`;
    - `publicarSimuladoPor(ator, id)`;
    - `liberarCorrecaoPor(ator, id)`;
    - `excluirSimuladoPor(ator, id): Promise<string>`, que chama a RPC `lixeira_excluir('simulado', …)` e devolve o id na Lixeira;
    - `exigirSimuladoEditavelPor(ator, id)`.
  - As turmas gravadas passam pelo filtro "existe na escola de `ator.escola_id` **e** está em `ator.turmas`" (null = todas). É a mesma regra de hoje, com `turmasDaEscola`.

- [ ] **Step 1:** Escrever `configuracao.test.ts`:
  - título vazio → "Informe o título.";
  - duração 0 e 601 → "Duração de 1 a 600 minutos.";
  - fechamento antes da abertura → erro;
  - `limparFiltros({ area: "xyz" })` → "Área inválida.";
  - `mudancaProibidaComTentativas` é true ao mudar duração, embaralhar, abertura ou ao **tirar** uma turma, e false ao mudar só título, correção, fechamento, ou ao **acrescentar** turma (item 3 da Review Focus);
  - `validarPublicacao` com 0 questões → "Adicione questões antes de publicar.", com 0 turmas → "Escolha ao menos uma turma.";
  - `validarOrdem(["a","b"], ["b","a"])` → null, e `validarOrdem(["a","b"], ["a"])` / `(["a","b"], ["a","c"])` → "A nova ordem precisa ter exatamente as mesmas questões.".
- [ ] **Step 2:** `npx tsx --test src/lib/simulados/configuracao.test.ts`. Esperado: FALHA (o módulo não existe).
- [ ] **Step 3:** Mover as regras para `configuracao.ts` e o resto para `nucleo.ts`. `src/actions/simulados.ts` mantém **as mesmas exportações e assinaturas** de hoje; cada uma faz `const ator = await atorDaSessao()` e chama a versão `…Por`. `MontarQuestoes` e as outras telas não mudam nesta task. Excluir simulado ainda não tem botão na tela, e isso fica assim. `ordenar` é usado só pela Hermes.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run lint`. Esperado: tudo 0, e os testes antigos de simulados passam sem mudança.
- [ ] **Step 5:** Commit "Simulados: regras num nucleo com ator explicito".

### Task 3: Não repetir questões já aplicadas

**Files:**
- Create: `src/lib/simulados/repetidas.ts`, `src/lib/simulados/repetidas.test.ts`
- Modify: `src/lib/simulados/nucleo.ts` (`sortearQuestoesPor`, `trocarQuestaoPor`), `src/actions/simulados.ts` (`sortearQuestoes` e `trocarQuestao` aceitam `naoRepetir`), `src/components/simulados/MontarQuestoes.tsx`, `package.json`

**Interfaces:**
- Produces:
  - `filtrarRepetidas(ids: string[], aplicadas: Set<string>): { ids: string[]; puladas: number }` (puro).
  - `questoesAplicadas(escolaId: string, simuladoId: string): Promise<{ aplicadas: Set<string>; semTurmas: boolean }>`: devolve as questões de simulados `tipo = 'professor'`, `status = 'publicado'`, da mesma escola, ligados a alguma das mesmas turmas (nome + ano), **excluindo o próprio simulado**. Ler por páginas e em blocos (`lerTodas`/`emBlocos`), como em `43702ff:src/lib/simulados/repetidas.ts`.
  - `sortearQuestoesPor(…)` com `naoRepetir` (padrão **true**) devolve `{ adicionadas, pedidas, puladas, semTurmas }`.

- [ ] **Step 1:** Escrever os testes de `filtrarRepetidas`:
  - `(["a","b","c"], new Set(["b"]))` → `{ ids: ["a","c"], puladas: 1 }`;
  - conjunto vazio → nada pulado;
  - todos aplicados → `ids: []`.
- [ ] **Step 2:** `npx tsx --test src/lib/simulados/repetidas.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Implementar e ligar no sorteio e na troca: a troca também evita as questões repetidas quando `naoRepetir`.
- [ ] **Step 4:** Tela (`MontarQuestoes`): caixa de seleção **marcada por padrão** com o texto "Não repetir questões já aplicadas a estas turmas", ao lado de "Sortear questões". Quando `puladas > 0`, o aviso diz "N questões foram puladas por já terem caído para estas turmas.". Quando `semTurmas`, diz "O simulado ainda não tem turmas: nenhuma questão foi excluída por repetição." (item 4 da Review Focus). Seguir o visual do `MontarQuestoes.module.css` / `DESIGN.md`.
- [ ] **Step 5:** `npm test`, `npx tsc --noEmit`, `npm run lint`. Esperado: 0.
- [ ] **Step 6:** Commit "Simulados: nao repetir questoes ja aplicadas as mesmas turmas".

### Task 4: Núcleo de questões com ator e exclusão pela Lixeira

**Files:**
- Create: `src/lib/questoes/nucleo.ts`, `src/lib/questoes/questoes-nucleo.test.ts`
- Modify: `src/actions/questoes.ts` (casca fina para editar, publicar e excluir), `src/lib/questoes/acesso.ts` (`exigirEditorQuestaoPor(ator, id)`), `package.json`

**Interfaces:**
- Consumes: `Ator`, `podeEditarQuestao`, `limparConteudo`, `conteudoDeMarkdown`, `textoDoConteudo` (de `src/lib/questoes/conteudo.ts`).
- Produces:
  - `exigirEditorQuestaoPor(ator: Ator, id): Promise<Questao>`.
  - `type EdicaoQuestao = Partial<{ enunciado: string; comando: string; alternativas: { letra: Letra; texto: string }[]; resposta: Letra | null; anulada: boolean; materia: string; assunto_id: string | null }>`.
  - `editarQuestaoPor(ator, id, e: EdicaoQuestao): Promise<{ avisos: string[] }>`: altera só os campos enviados.
  - `publicarQuestaoPor(ator, id, publicar: boolean)`.
  - `excluirQuestaoPor(ator, id, via: "app" | "hermes"): Promise<string>`: chama `lixeira_excluir('questao', …)`.
  - `documentosAposEdicao(q, e)` (puro): devolve os `conteudo` novos.

Regra do `documentosAposEdicao` (item 2 da Review Focus):
- Se o **enunciado** mudar e a questão tiver `conteudo`, o novo `conteudo` é `conteudoDeMarkdown(novoEnunciado)`. As figuras que estavam no meio do texto deixam de ser citadas e voltam ao fim, porque o renderizador mostra as não citadas no fim. Gera o aviso "A formatação do enunciado foi reiniciada; as figuras voltaram para o fim do texto.".
- Se o texto de uma **alternativa** mudar e ela tiver `conteudo`, vale o mesmo para aquela alternativa, sem aviso.
- Campos não enviados mantêm o `conteudo` atual.

Validação: as mesmas de `limpar` em `src/actions/questoes.ts` (banca, matéria, 5 alternativas, letra da resposta). Extrair o que for preciso para não duplicar.

- [ ] **Step 1:** Escrever os testes de `documentosAposEdicao`:
  - enunciado novo numa questão com documento → documento igual a `conteudoDeMarkdown(novo)`, sem nó `figura`, e com o aviso;
  - sem enunciado na edição → o documento original sai intacto (mesmo objeto, ou igual em `deepEqual`);
  - questão sem documento (`conteudo` null) → continua null e sem aviso;
  - alternativa B alterada → só a B ganha documento novo, e as outras ficam iguais.
- [ ] **Step 2:** `npx tsx --test src/lib/questoes/questoes-nucleo.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Implementar. Na tela, `excluirQuestao` passa a usar `excluirQuestaoPor(…, "app")`, ou seja, também vai para a Lixeira, e **deixa de apagar os arquivos do Storage**. Hoje apagar uma questão que caiu num simulado destrói as respostas dos alunos; pela Lixeira, elas podem voltar. `salvarQuestao` e `publicarQuestao` da tela continuam com as mesmas regras e passam a usar `exigirEditorQuestaoPor`.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run lint`. Esperado: 0.
- [ ] **Step 5:** Commit "Questoes: nucleo com ator; excluir vai para a Lixeira".

### Task 5: Registro da Hermes, selo e tela "Feito pela Hermes"

**Files:**
- Create: `src/lib/hermes/registro.ts`, `src/lib/hermes/registro.test.ts`, `src/app/dono/hermes/page.tsx` (e o `.module.css` dela, se precisar)
- Modify: `src/app/dono/page.tsx` (link para a tela nova), `src/app/simulados/page.tsx` e a lista do banco (`src/app/banco/page.tsx` ou o componente que lista as questões): `SeloHermes` quando `criado_via === "hermes"`. `package.json`.

**Interfaces:**
- Produces:
  - `resumirParametros(v: unknown): unknown` (puro): corta strings em 200 caracteres e listas em 20 itens, limita a profundidade em 3 e troca as chaves `senha`, `token` e `telefone` por `"***"`. O telefone é guardado em `professor_id`, então não precisa ficar nos parâmetros.
  - `executarRegistrado<T>(ctx: { perfil: "dono" | "professor"; professorId: string | null; escolaId: string | null }, ferramenta: string, parametros: unknown, acao: () => Promise<T>): Promise<T>`:
    - antes da ação, grava `iniciada`;
    - se a ação der certo, atualiza para `concluida`;
    - se der erro, atualiza para `erro` com a mensagem e **relança o erro**;
    - se a gravação do registro falhar, **a ação não roda** (nada é alterado sem registro).
  - Tela `/dono/hermes`: só o dono (`role === "dono"`; os outros papéis vão para `/`). Mostra as últimas 200 linhas: data e hora, quem pediu (o dono, ou o nome do professor), escola, ferramenta, situação e mensagem. Visual dos cartões do painel do dono (`DESIGN.md`; sem texto cinza).

- [ ] **Step 1:** Escrever os testes de `resumirParametros`:
  - string de 500 caracteres → 200 + "…";
  - lista de 50 → 20 itens + `"… e mais 30"`;
  - `{ senha: "x", token: "y", professor_telefone: "6799…" }` → as três chaves viram `"***"`;
  - profundidade maior que 3 → `"…"`.
- [ ] **Step 2:** `npx tsx --test src/lib/hermes/registro.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Implementar o registro, a tela e o selo.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run lint`. Esperado: 0.
- [ ] **Step 5:** Commit "Hermes B: registro das acoes, selo e tela Feito pela Hermes".

### Task 6: Ferramentas MCP de escrita (simulados e questões)

**Files:**
- Create: `src/lib/mcp/acoes.ts` (registro), `src/lib/mcp/acoes/ator.ts`, `src/lib/mcp/acoes/simulados.ts`, `src/lib/mcp/acoes/questoes.ts`, `src/lib/mcp/acoes/acoes.test.ts`
- Modify: `src/app/api/mcp/dono/route.ts`, `src/app/api/mcp/route.ts` (registrar as ações e atualizar as `INSTRUCOES`), `package.json`

**Interfaces:**
- Consumes:
  - `Escopo`, `ObterCtx`, `campoEscola`, `campoTelefone`, `escolasDoPedido`, `acharPorNome` e `texto` da etapa A;
  - as funções `…Por` das Tasks 2–4;
  - `executarRegistrado` (Task 5).
- Produces:
  - `atorDoEscopo(ctx: Ctx, escolaId: string): Promise<AtorEscola>`:
    - **dono** → `{ id: <id do professor com role 'dono'>, role: "dono", escola_id: escolaId, turmas: null, via: "hermes" }`;
    - **professor** → recusa ("Você só pode mexer na sua escola.") se `escolaId !== escopo.escolaId`; senão devolve `{ id: escopo.professorId, role: escopo.papel ?? "professor", escola_id, turmas: escopo.turmas, via: "hermes" }`.
  - `escolaParaCriar(ctx, escola?: string): Promise<EscolaInfo>`: o professor usa a escola dele. O dono precisa de **exatamente uma** escola casando com o nome; sem nome e com mais de uma escola → erro "Diga em qual escola: A, B, C." (item 6 da Review Focus).
  - `registrarAcoes(server, obter, perfil: "dono" | "professor")`.

Ferramentas (nomes exatos; todas com `campoTelefone`, e as que criam com `campoEscola`):

| Ferramenta | Parâmetros principais | Função |
|---|---|---|
| `criar_simulado` | `titulo`, `turmas: string[]` (nomes; ano letivo = o mais recente da turma na escola), `duracao_min`, `abre_em`, `fecha_em` (ISO ou "dd/mm/aaaa hh:mm", fuso de São Paulo), `correcao: "na_hora" \| "apos_prazo"`, `embaralhar` | `criarSimuladoPor` |
| `configurar_simulado` | `simulado_id` + os mesmos campos, todos opcionais (os que faltam mantêm o valor atual) | `salvarSimuladoPor` |
| `sortear_questoes` | `simulado_id`, `quantidade`, `banca?`, `ano_de?`, `ano_ate?`, `area?`, `materia?`, `assunto?` (por nome), `permitir_repetidas?` | `sortearQuestoesPor` com `naoRepetir = !permitir_repetidas` |
| `adicionar_questao` / `remover_questao` / `trocar_questao` | `simulado_id`, `questao_id` (+ filtros na troca) | `…Por` |
| `ordenar_questoes` | `simulado_id`, `ordem: string[]` | `ordenarQuestoesPor` |
| `publicar_simulado` / `liberar_correcao` | `simulado_id` | `…Por` |
| `mandar_simulado_para_lixeira` | `simulado_id` | `excluirSimuladoPor` |
| `editar_questao` | `questao_id` + os campos de `EdicaoQuestao` (matéria e assunto por nome) | `editarQuestaoPor` (os avisos entram na resposta) |
| `publicar_questao` | `questao_id`, `publicar: boolean` | `publicarQuestaoPor` |
| `mandar_questao_para_lixeira` | `questao_id` | `excluirQuestaoPor(…, "hermes")` |

- Toda ferramenta: `obter(args)` → `atorDoEscopo` (com a escola do simulado ou da questão lidos do banco) → `executarRegistrado` → função do núcleo.
- Resposta curta em pt-BR com o que foi feito, os ids e os avisos. Erros voltam como `texto("Não foi possível …: <mensagem>")`, com `isError: true`.
- `INSTRUCOES` do dono: trocar "Nesta etapa você só consulta: não altera nada." por "Você também pode criar e alterar simulados e questões. **Antes de criar, publicar, liberar correção ou mandar para a Lixeira, resuma o que vai fazer e peça confirmação.** Exclusões vão para a Lixeira (dá para restaurar)."
- `INSTRUCOES` do professor: acrescentar a mesma regra de confirmação e "Você só mexe nas turmas e no banco da escola do professor.".

- [ ] **Step 1:** Escrever `acoes.test.ts` (funções puras de `ator.ts` e da conversão de parâmetros; o Supabase não entra):
  - `atorDoEscopo` de professor com `escolaId` diferente → recusa (item 1 da Review Focus);
  - de dono → `role: "dono"`, `escola_id` do pedido, `turmas: null`, `via: "hermes"`;
  - `escolaParaCriar` puro sobre uma lista: dono com 2 escolas e sem nome → erro listando as duas; com um nome que casa uma → ela;
  - conversão de datas: `"25/10/2026 08:00"` → `"2026-10-25T11:00:00.000Z"`, e ISO passa igual;
  - nomes de turma inexistentes → erro listando as turmas da escola.

  Extrair essas conversões para funções puras em `ator.ts`, para poder testar.
- [ ] **Step 2:** `npx tsx --test src/lib/mcp/acoes/acoes.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Implementar as ferramentas e registrar nas duas rotas: dono com `perfil "dono"`, professor com `"professor"`. No professor, `professor_telefone` é obrigatório (vem de `escopoDoTelefone`).
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Esperado: 0.
- [ ] **Step 5:** Commit "Hermes B: ferramentas de escrita para simulados e questoes".

### Task 7: Prévia, conferência ponta a ponta e entrega

- [ ] **Prévia temporária** (não commitar; roteiro em `C:\Users\pkinh\.claude\skills\status-visual-aluno\references\previa-e-publicacao.md`, seções 1–3):
  - tela de montar simulado com a caixa "Não repetir…" e os avisos;
  - lista de simulados e banco com o selo;
  - tela "Feito pela Hermes" com linhas fictícias.

  Prints em 1340 e 390.
- [ ] **Teste das ferramentas** com um cliente MCP local (script em TypeScript no scratchpad, chamando `registrarAcoes` num `McpServer` em memória contra o banco real) **só numa escola de teste** ("Escola Teste", já criada no painel). Roteiro:
  1. criar um simulado;
  2. sortear 5 questões (conferir `puladas`);
  3. ordenar;
  4. publicar;
  5. mandar para a Lixeira;
  6. restaurar pela RPC.

  Conferir no banco (só leitura) que `hermes_registro` tem as linhas e que o simulado voltou. Não mexer em dados da escola real.
- [ ] Apagar a prévia e os scripts e remover `.next/dev/types`. Rodar `npx tsc --noEmit`, `npm test`, `npm run lint` e `npm run build`, todos com saída 0.
- [ ] Com o SQL conferido e o ok do Peter: publicar (rebase em `origin/master`, push) e conferir o deploy no www.
- [ ] Contar ao Peter o que ele precisa testar pela própria Hermes: uma pergunta e uma ação reversível pelo perfil dono, e uma pelo Telegram como professor.
