# Arrastar questões e "Nome na prova" — plano de implementação

Spec: `docs/superpowers/specs/2026-11-02-arrastar-e-nome-na-prova-design.md`. Branch `feature/editar-prova-word`
(worktree `.worktrees/editar-prova-word`), em cima de `31cd9bf`.

## Global Constraints

- `professores.nome_prova varchar(60)` null; trim; vazio grava `null`; até 60 caracteres.
- Nome na folha = `nome_prova ?? nome` do **dono da prova** (`provas_word.professor_id`).
- Com matéria única (`filtros.materia`): "Nome — Matéria" (travessão com espaços; rótulo de `MATERIAS`).
- Word e prévia iguais (usar `linhasIdentificacao` como fonte única). Gabarito sem mudança.
- Textos fixos: "Nome na prova", "Vale para todas as suas provas. Em branco, sai o seu nome.".
- Server actions devolvem `{ ok: false, erro }` e nunca lançam.
- Telas azul-escuro, sem texto cinza.
- Setas ↑ ↓ continuam. Arrastar usa a ação de mover já existente (`de`, `para`, `questaoId`).

### Task 1: Nome na prova (banco, folha, painel, Configurações, admin)

Files: `db/schema.sql`, `src/lib/folha/editar-prova.ts` (+test), `src/lib/folha/docx.ts`, `src/lib/folha/folha.test.ts`,
`src/app/banco/provas-word/[id]/previa/Folha.tsx`, `src/lib/folha/previa*.ts`, `src/lib/folha/provas-word-servidor.ts`,
`src/app/banco/provas-word/acoes.ts`, `.../previa/Editor.tsx`, `.../previa/page.tsx`/`PreviaEditavel.tsx`,
`src/components/configuracoes/ConfiguracoesPainel.tsx` (+ cartão novo), `src/app/admin/professores/**`, `src/lib/types.ts`.

- [ ] Step 1: SQL em `db/schema.sql` (coluna `nome_prova` na tabela `professores`, com `alter table ... add column if not exists` no fim, como as outras alterações).
- [ ] Step 2 (TDD): `linhasIdentificacao` recebe o nome do professor (já com a matéria, se houver) e, quando há nome, a linha "Professor(a)" mostra o nome como texto no lugar do traço; "Data"/"Nota" seguem as regras atuais. Função pura `nomeNaProva(nome, nomeProva, materiaRotulo?)` em `editar-prova.ts` (trim, fallback, " — Matéria"). Testes: apelido, fallback, matéria única, em branco; e em `folha.test.ts`: o nome aparece na prova, não no gabarito; nome longo (60 + matéria) não estoura (mesma técnica da linha extra).
- [ ] Step 3: `dadosFolhaProva` lê `nome, nome_prova` do professor da prova e a matéria única de `filtros`; `DadosFolha`/`DadosPrevia` levam o nome pronto. Word e prévia usam.
- [ ] Step 4: Núcleo + action `salvarNomeProva(quem, texto)` (só o próprio professor; valida 60). No painel "Editar", campo "Nome na prova" com o texto de ajuda, só se quem vê é o professor da prova; salvo junto com "Salvar cabeçalho" (uma chamada a mais, mensagem "Cabeçalho salvo."). Valor inicial = `nome_prova` atual.
- [ ] Step 5: Configurações: cartão "Nome na prova" (input + Salvar) para todo professor, no padrão dos cartões existentes (ex.: `MediaAprovacaoCard`).
- [ ] Step 6: Admin `/admin/professores`: campo opcional "Nome na prova" ao criar e ao editar professor, seguindo o formulário existente.
- [ ] Step 7: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. Commit `feat: nome na prova (apelido do professor) no cabeçalho`.

### Task 2: Arrastar questões no painel Editar

Files: `src/app/banco/provas-word/[id]/previa/Editor.tsx`, `Previa.module.css` (ou CSS do editor).

- [ ] Step 1: Alça (ícone `GripVertical` do lucide) em cada linha, com `aria-label` "Arrastar questão N". Arrastar com pointer events (mouse e toque; `touch-action: none` na alça), linha fantasma/indicador de destino, rolagem do painel perto das bordas. Ao soltar numa posição diferente, chama a mesma função das setas com `de`, `para` e `questaoId`. Pendente = não arrasta. Esc cancela.
- [ ] Step 2: Setas continuam iguais.
- [ ] Step 3: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`. Commit `feat: arrastar questões no painel Editar`.

### Task 3: Conferência e publicação

- [ ] Step 1: Conferir no banco (leitura) que `professores.nome_prova` existe.
- [ ] Step 2: Teste manual no `npm run dev` (porta 3005).
- [ ] Step 3: Rebase em `origin/master`, push no `master`, conferir no www, atualizar `CLAUDE.md` (item 11).
