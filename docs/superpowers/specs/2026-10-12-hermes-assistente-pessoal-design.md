# Hermes como assistente pessoal do Peter (MCP do dono) — design

Data: 2026-10-12 · Status: aguardando aprovação do Peter

## Objetivo

A Hermes (IA pessoal do Peter, rodando fora da Vercel) deve conseguir **responder qualquer pergunta**
sobre o Status Avalia — área do professor e do aluno, todas as escolas — e **fazer alterações** a pedido
dele: configurar provas e simulados, corrigir questões e dados, gerir contas e turmas.

Decisões já tomadas com o Peter:
- Enxerga **todas as escolas** (papel de dono).
- **Consulta livre só de leitura** para perguntas que as ferramentas prontas não cobrem.
- Exclusões **sempre pela Lixeira** (restauráveis); nada é apagado de forma definitiva.
- Entrega em etapas **A → B → C**.
- Continua **sem chave geral do Supabase** (decisão de 2026-07-28): todo acesso passa pelo MCP.

Fora do escopo: corrigir o **código** do sistema (isso continua com o Claude Code / Peter).

## Dois perfis de acesso (segurança central)

A Hermes atende duas pessoas diferentes, com poderes diferentes:

| Perfil | Endereço / senha | Quem | Alcance |
|---|---|---|---|
| **Dono** | `/api/mcp/dono` · `MCP_DONO_TOKEN` | só o Peter (perfil de assistente pessoal) | todas as escolas, tudo, consulta livre |
| **Professor** | `/api/mcp` · `MCP_SECRET_TOKEN` (o atual) | professores pelo Telegram, identificados pelo **telefone** | só a **escola** do professor e as **turmas** que ele pode ver (mesma regra da tela: admin vê tudo da escola; professor com acesso restrito só as turmas liberadas) |

No perfil professor, **toda ferramenta nova exige o telefone**; telefone não cadastrado = recusa (hoje a
planilha aceita sem telefone e trata como Colégio Status — isso continua só para as ferramentas antigas).
O Peter, ao falar como professor pelo Telegram, também é atendido por esse perfil com o papel dele.
Professores cadastrados depois entram automaticamente (basta o telefone no cadastro).

**Áudio:** a transcrição é feita pela Hermes; o sistema recebe texto/parâmetros. Para ações que criam
ou publicam (simulado, prova, liberar correção), as `instructions` mandam a Hermes **resumir e pedir
confirmação** antes de executar.

Comparação de senhas em tempo constante; sem senha configurada = recusa tudo.

O servidor do dono declara `instructions` (texto que o cliente MCP entrega à IA): "você é a assistente
pessoal do Peter, dono da plataforma Status Avalia; responda em português; antes de alterar, confirme o
que vai fazer; exclusões vão para a Lixeira", mais um mapa curto do sistema. O do professor declara a
versão para atender professores.

## Selo da Hermes e registro

Tudo que a Hermes **cria** ganha `criado_via = 'hermes'` e mostra o **ícone da Hermes** (componente
`SeloHermes`, já usado na planilha) ao lado do nome: simulados, questões, importações, contas de aluno,
cursos/aulas. Exige coluna `criado_via` nessas tabelas (SQL). Alterações (publicar, liberar correção,
corrigir questão, liberar nova tentativa) ficam em `hermes_registro` (quando, quem pediu — dono ou
professor pelo telefone —, ferramenta, parâmetros resumidos, resultado), com uma tela simples
"Feito pela Hermes" no painel do dono.

## Etapa A — ver tudo + consulta livre

Ferramentas de leitura (todas aceitam `escola` opcional por nome ou slug; sem ela, todas):

| Ferramenta | Devolve |
|---|---|
| `visao_geral` | escolas e, por escola: professores, turmas, contas de aluno, simulados abertos, cursos, questões publicadas |
| `listar_simulados` | por escola/situação/tipo (professor ou treino) |
| `resultado_simulado` | alunos com nota, % por área, tempo total, tempo por questão, questões mais erradas |
| `listar_cursos` / `progresso_curso` | estrutura do curso; progresso por aluno de uma turma |
| `buscar_questoes` | filtros banca (sem diferenciar maiúsculas), ano, matéria, área, situação, texto |
| `estatisticas_banco` / `listar_importacoes` | números do banco; importações e situação |
| `listar_contas_aluno` / `listar_professores` | contas (ativa, último acesso, turmas); professores (papel, acesso) |
| `desempenho_turma` | por turma: notas da planilha, simulados (quem **terminou**, quem está **em andamento**, quem **não começou**, nota e tempo), cursos (quem **assistiu ou não** cada aula, até onde assistiu e %, aulas concluídas) |
| `perfil_aluno` | turmas, notas da planilha, simulados/treinos (nota e tempo), progresso nos cursos, último acesso |

`resultado_simulado`, `desempenho_turma`, `progresso_curso` e `perfil_aluno` também existem no **perfil
professor**, limitados às turmas dele.

**Tempo assistido:** hoje o sistema guarda o ponto mais adiantado do vídeo e se a aula foi concluída — a
Hermes responde "assistiu até 12:40 de 18:00 (70%)". *Opcional:* gravar o **tempo real somado**
(`aula_progresso.tempo_assistido_seg`, incrementado pelo player a cada 15 s com a aba visível) para
responder "assistiu 23 min no total".

As ferramentas pedem só as colunas necessárias: **nunca** `senha_hash`, `token_verificacao*`,
`codigo_convite*`.

### Consulta livre (`consultar_dados`)

A Hermes envia um `select` em SQL; o resultado volta em JSON (no máximo 500 linhas, 8 s).
Segurança no próprio banco, não em filtro de texto:
- Schema **`hermes`** com **views** das tabelas, **sem** as colunas sensíveis acima.
- Papel **`hermes_leitor`**: só `USAGE` no schema `hermes` e `SELECT` nas views; nenhum acesso a `public`.
- Função `public.hermes_consulta(sql text)` (security invoker): `set local role hermes_leitor`,
  `set local transaction read only`, `set local statement_timeout = '8s'`, executa
  `select coalesce(jsonb_agg(t), '[]') from (<sql>) t` com limite. `grant hermes_leitor to anon`
  para o `set role` funcionar (a chave anon só existe no servidor).
- Qualquer `insert/update/delete/drop` falha pelo `read only`; ler `public.professores` falha por
  falta de permissão.

Exige **SQL novo** (`db/2026-10-12-hermes.sql`), colado pelo Peter no SQL Editor antes do deploy.

## Etapa B — banco de questões, importação e simulados (ações completas)

**Importação de provas pela própria Hermes** (`importar_prova`): recebe o PDF da prova e o do gabarito
por **link** (o Peter manda o PDF para ela; ela repassa o link) ou em base64, banca, ano, caderno, escopo
(banco geral ou escola) e **páginas** de cada arquivo (todas ou "3", "1-20, 23" — mesma regra da tela).
No servidor: baixa (até 30 MB), separa as páginas escolhidas em PDFs de uma página (`pdf-lib`), guarda no
storage como a tela faz e dispara a mesma leitura por IA. A IA recebe cada página como documento PDF
(o Claude lê PDF diretamente), então o resultado é o mesmo da importação pela tela.
Depois: `situacao_importacao`, `ler_de_novo` (páginas com erro), `aprovar_sem_aviso`.

**Questões:** editar enunciado/alternativas/resposta, anular/desanular, trocar matéria/assunto,
publicar/voltar para revisão, mandar para a Lixeira.

**Simulados — configuração total**, com as mesmas regras da tela:
- `criar_simulado` / `configurar_simulado`: título, turmas, duração, abre/fecha, quando sai a correção,
  embaralhar.
- `sortear_questoes`: banca (sem diferenciar maiúsculas), ano de/até, área, matéria, assunto, quantidade.
  **Não repetir:** por padrão exclui questões que já estiveram em simulados (publicados) **das mesmas
  turmas**; `permitir_repetidas: true` desliga. O resultado informa quantas foram puladas por já terem caído.
  Mesmo filtro também na tela de montar simulado (caixa "Não repetir questões já aplicadas a estas turmas").
  `adicionar_questao`, `trocar_questao`, `remover_questao`, `ordenar_questoes`.
- `publicar_simulado`, `liberar_correcao`, mandar para a Lixeira.

Reaproveita as funções do sistema (`sortear`, `corrigir`, regras de publicação), para o resultado ser
idêntico ao feito pela tela.

**Também no perfil professor:** criar/configurar/sortear/publicar simulado e liberar correção para as
turmas que ele pode ver; importar prova e cuidar das questões no **banco da escola** (o banco geral
continua só do dono). O simulado criado fica com o professor que pediu como dono (`professor_id`), igual
à tela.

## Etapa C — alunos, contas, turmas e cursos (ações)

**Ajudar um aluno, a pedido do Peter:**
- `liberar_nova_tentativa` (apaga a tentativa dele num simulado — vai para a Lixeira),
  `encerrar_tentativa` (entrega uma prova travada e corrige), `recorrigir_tentativa`.
- Contas: criar, bloquear/desbloquear, **gerar senha provisória** (devolvida só para ela repassar ao
  Peter), trocar ou incluir turma, corrigir nome/usuário.
- Cursos do aluno: ver e zerar progresso de uma aula.

**Escola:** professores (acesso a turmas, papel); turmas da planilha em qualquer escola (as ferramentas
atuais passam a aceitar `escola`); cursos (publicar/despublicar aula, ligar curso a turmas).

## Lixeira

Hoje a Lixeira guarda turma, aluno e atividade. Ganha os tipos **questão**, **simulado** e **tentativa** (cópia da linha
e dos filhos em JSON, restauração pela tela de Lixeira já existente), com origem "Hermes".

## Testes

- Unidade: montagem do resultado do simulado e do perfil do aluno (funções puras), validação de
  parâmetros das ações, comparação de senha.
- Banco: depois de colar o SQL, conferir (só leitura) que `hermes_consulta('select 1')` responde e que
  `select * from public.professores` é recusado.
- Ponta a ponta após cada deploy: chamar o MCP do dono com 2–3 perguntas reais (ex.: resultado do
  simulado "Ufms 24") e uma ação reversível.

## O que o Peter precisa fazer

1. Criar `MCP_DONO_TOKEN` na Vercel (senha longa aleatória) e redeploy.
2. Colar o SQL da etapa A (e depois o da Lixeira, na etapa B) no Supabase.
3. Na Hermes, adicionar o servidor MCP `https://www.statusavalia.com.br/api/mcp/dono` com o cabeçalho
   `Authorization: Bearer <MCP_DONO_TOKEN>` — só no perfil de assistente pessoal.
