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

## Ponto de segurança central: um MCP só do dono

O MCP atual (`/api/mcp`, senha `MCP_SECRET_TOKEN`) é usado pela Hermes para atender **professores**
pelo Telegram, identificados pelo telefone, e é restrito ao Colégio Status. Ele **não muda**.

Cria-se um segundo endereço: **`/api/mcp/dono`**, com senha própria **`MCP_DONO_TOKEN`** (Vercel),
configurado só no perfil de assistente pessoal da Hermes. Assim um professor no Telegram nunca chega
às ferramentas de dono. Comparação da senha em tempo constante; sem senha configurada = recusa tudo.

O servidor do dono declara `instructions` (texto que o cliente MCP entrega à IA): "você é a assistente
pessoal do Peter, dono da plataforma Status Avalia; responda em português; antes de alterar, confirme o
que vai fazer; exclusões vão para a Lixeira", mais um mapa curto do sistema (escolas, turmas por
bimestre, simulados, treinos, cursos, banco de questões, importações).

Toda alteração feita por ele grava `criado_via = 'hermes'` onde a tabela tiver essa coluna e registra
uma linha em `hermes_registro` (quando, ferramenta, parâmetros resumidos, resultado) — o Peter pode ver
o que ela fez.

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
| `perfil_aluno` | turmas, notas da planilha, simulados/treinos (nota e tempo), progresso nos cursos, último acesso |

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
- `sortear_questoes`: banca (sem diferenciar maiúsculas), ano de/até, área, matéria, assunto, quantidade;
  `adicionar_questao`, `trocar_questao`, `remover_questao`, `ordenar_questoes`.
- `publicar_simulado`, `liberar_correcao`, mandar para a Lixeira.

Reaproveita as funções do sistema (`sortear`, `corrigir`, regras de publicação), para o resultado ser
idêntico ao feito pela tela.

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
