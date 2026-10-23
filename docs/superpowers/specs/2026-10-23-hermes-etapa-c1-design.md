# Hermes etapa C1: contas de aluno, ligação com a planilha e ajuda ao aluno

Data: 2026-10-23 · Status: escopo aprovado na spec da Hermes (`2026-10-12-hermes-assistente-pessoal-design.md`, Etapa C, "Ajudar um aluno" e "Contas"), com o Peter ("pode ser"); este documento fecha o desenho e acrescenta a ligação conta ↔ planilha, que os relatórios (etapa D) mostraram ser necessária.

## Objetivo

1. **Os relatórios mostram tudo de cada aluno.** Hoje nenhuma conta de login está ligada à linha do aluno na planilha, então simulados, treinos e aulas aparecem como "sem login". O admin passa a **criar as contas a partir da planilha**, já ligadas, e a **ligar contas existentes** (automaticamente pelo nome, ou à mão).
2. **A Hermes ajuda um aluno a pedido do Peter:**
   - liberar nova tentativa num simulado;
   - encerrar uma prova travada;
   - recorrigir;
   - zerar o progresso de uma aula;
   - criar contas e gerar senha provisória;
   - bloquear e desbloquear contas;
   - corrigir nome e usuário;
   - trocar ou incluir turma;
   - ligar à planilha.

Fica para a **C2**, em plano próprio: professores (papel e acesso a turmas), turmas da planilha em qualquer escola pelas ferramentas antigas, e cursos (publicar e despublicar aula, ligar curso a turma).

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Ligação | `aluno_turmas.aluno_id` aponta para a linha do aluno no **bimestre vigente** (sem vigente, no último). Os outros bimestres juntam pelo nome, como os relatórios já fazem. Uma linha da planilha só pode estar ligada a **uma** conta (índice único parcial) | A coluna já existe ("reservado: ligação futura") e os relatórios já leem por ela |
| Criar contas da planilha | Na tela **Contas de alunos**: "Criar contas da planilha", com a turma escolhida, lista os alunos **sem conta ligada** com o usuário sugerido (`sugerirUsuario`), cria as contas com o nome da planilha e já liga. Mesma geração de senha e mesmo Excel de acessos de hoje | Resolve na origem: nome igual e vínculo certo |
| Ligar contas existentes | Botão "Ligar pelo nome": casa conta e aluno da **mesma turma** pelo nome normalizado (`normalizarBusca`). Só liga quando o casamento é **único** dos dois lados, e mostra uma prévia antes. Em cada conta sem ligação, um seletor "Ligar a…" com os alunos da turma | Seguro: nunca liga às cegas nomes repetidos |
| Quem faz | Na tela: admin e dono da escola (`exigirAdminDaEscola`, a regra de hoje). Na Hermes: **só no perfil dono** ("a pedido do Peter", como diz a spec mãe) | Contas e senhas são sensíveis. O professor pelo Telegram fica de fora nesta etapa |
| Senha provisória | `gerar_senha_provisoria` devolve a senha **só na resposta** ao dono. Não vai para o `hermes_registro` (já mascarado) nem para logs | A Hermes repassa ao Peter |
| Liberar nova tentativa | Manda a tentativa para a **Lixeira** (tipo `tentativa`, que já existe), e o aluno pode refazer. Restaurável pela tela da Lixeira | "Nada é apagado de forma definitiva" |
| Encerrar e recorrigir | `encerrar_tentativa` usa `entregarTentativa` e `recorrigir_tentativa` usa `corrigirTentativa`: as mesmas funções do sistema | Resultado igual ao da tela |
| Zerar progresso de aula | A linha de `aula_progresso` vai para a Lixeira (tipo novo `progresso_aula`) | Restaurável |
| Registro e selo | Toda ferramenta passa por `executarRegistrado`. Contas criadas pela Hermes ganham `alunos_contas.criado_via = 'hermes'`, se a coluna aceitar, ou uma marca equivalente | Padrão da etapa B |

## Banco (SQL manual)

- `create unique index if not exists uq_aluno_turmas_aluno on aluno_turmas (aluno_id) where aluno_id is not null;`
- **Lixeira:** o tipo `progresso_aula` entra no check. Nova função `lixeira_excluir_progresso(p_conta uuid, p_aula uuid, p_ator uuid, p_via text) returns uuid`, porque a chave da tabela é composta. `lixeira_restaurar` passa a restaurar `aula_progresso`.
- **`alunos_contas.criado_via`:** hoje o check é `('escola','convite')`. Ampliar para `('escola','convite','hermes')`, de forma idempotente.

## Não pode acontecer

- **Admin de uma escola** ligar ou criar contas, ou mexer em tentativas, de outra escola.
- **Duas contas na mesma linha da planilha**, ou uma ligação automática errada entre nomes repetidos.
- **Senha provisória** aparecer no registro da Hermes, em log ou na tela "Feito pela Hermes".
- **Liberar nova tentativa** apagar a tentativa de vez. Ela vai para a Lixeira.
- **Tela "Contas de alunos" atual** mudar o que já faz: o lote por nomes digitados continua igual.

## Testes

- **Unidade:**
  - sugestão de ligação: único, repetido, acento, espaço, maiúsculas;
  - escolha do bimestre de referência;
  - validações das ferramentas;
  - textos de resposta, sem senha no registro.
- **Ponta a ponta na HARMONIA** (escola de teste):
  1. criar uma turma de teste com 3 alunos na planilha;
  2. "criar contas da planilha";
  3. conferir a ligação e o relatório do aluno, que passa a mostrar "com login";
  4. gerar senha, bloquear e desbloquear;
  5. tentativa de treino: criar, encerrar, liberar nova e restaurar;
  6. limpar tudo no fim.
