# Contas de aluno + base para várias escolas

Data: 2026-10-03 · Status: desenho aprovado no brainstorming, aguardando revisão da spec

## Objetivo

Transformar o Status Avalia numa plataforma que alunos também usam, começando pela
**conta do aluno** e pela **base para várias escolas**. Esta é a Parte 1 de um projeto
maior (ver "Roteiro"): ela não entrega aulas nem simulados, mas tudo que vem depois
depende dela.

Ao fim desta parte:
- o aluno entra no mesmo site, pela mesma tela de login, e cai na área dele (`/aluno`);
- a escola cria contas de aluno (usuário + senha provisória), uma a uma ou em lote;
- o professor gera um código de turma e o aluno se cadastra sozinho com ele;
- todo dado novo carrega a escola dona, e o Colégio Status é a escola nº 1;
- o banco já tem pgvector ligado, pronto para o RAG das partes seguintes.

## Roteiro do projeto (cada parte tem spec própria)

| Parte | Entrega | Depende de |
|---|---|---|
| **1. Contas de aluno + base multi-escola** (esta spec) | Login de aluno, convites, área do aluno vazia | — |
| 2. Plataforma de estudos | Áreas do conhecimento, aulas com vídeo (YouTube não listado) e PDF | 1 |
| 3. Banco de questões | Importação de PDF por IA (Claude), revisão humana, banco geral (só o dono publica) + questões da escola, embeddings (Voyage AI + pgvector), carga do ENEM via enem.dev se a licença permitir | 1 |
| 4. Simulados e atividades | Simulado do professor e treino do aluno, cronômetro, filtro por área/banca/ano, correção automática | 2, 3 |
| 5. Gerador de questões (RAG) | Questões novas no estilo da banca a partir do material da turma, marcadas "gerada por IA", com aprovação do professor | 3 |
| Antes da 2ª escola | Filtro por escola em todas as telas de professor, endereço próprio por escola, cores por escola, painel do dono para cadastrar escolas | 1 |

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Para quem | Várias escolas no futuro; por enquanto só o Status. Todo dado novo tem `escola_id` |
| Identificação da escola antes do login | Login único agora (com a marca do Status); endereço próprio por escola quando houver a 2ª |
| Banco de questões | Banco geral abastecido só pelo dono da plataforma + questões próprias de cada escola |
| Como o aluno entra | Escola cria → **usuário** + senha provisória. Código de turma → **email** + senha. Ambos podem ter email depois |
| Modelo de contas | **Tabela `alunos_contas` separada** de `professores`, mesmo mecanismo de login (cookie assinado). Descartados: tabela única de usuários (migraria `professores`, mexe em telas, admin e Hermes) e Supabase Auth (refaz o login inteiro) |
| Conta × lista de notas | Separadas agora; campo `aluno_id` reservado para ligar no futuro. Aluno **não** vê notas nesta parte |
| Dados do aluno | Só o mínimo (LGPD, menores): nome, email e/ou usuário, escola, turmas |
| Papéis | Novo papel `dono` (a conta do Peter), acima do `admin`. `admin` passa a significar admin da escola. `dono` passa em toda checagem de admin |
| Vínculo com turma | Por **nome da turma + ano letivo** (turmas têm um registro por bimestre) |
| Embeddings | pgvector ligado já nesta parte; colunas de vetor só nas partes 3 e 5 |

## 1. Banco de dados

O schema é manual: o bloco abaixo é colado no SQL Editor do Supabase e anexado ao fim
de `db/schema.sql`. É idempotente.

```sql
-- ===== Contas de aluno + base multi-escola (2026-10-03) =====

create extension if not exists vector;  -- preparação para o RAG (partes 3 e 5)

create table if not exists escolas (
    id uuid primary key default gen_random_uuid(),
    nome text not null,                         -- "Colégio Status"
    slug varchar(40) not null unique,           -- "status" → futuro status.statusavalia.com.br
    logo_url text not null,                     -- caminho em /public ou URL do Storage
    cor_principal varchar(9),                   -- usadas só quando entrar a 2ª escola
    cor_destaque varchar(9),
    slogan text,
    foto_login_url text,
    nome_remetente_email text not null,         -- "Colégio Status"
    codigo_convite_professor varchar(50) not null,
    created_at timestamptz not null default now()
);

-- O Status com id fixo, para servir de default nas colunas abaixo
insert into escolas (id, nome, slug, logo_url, slogan, nome_remetente_email, codigo_convite_professor)
select '00000000-0000-0000-0000-000000000001', 'Colégio Status', 'status',
       '/logo-status-branca.png', 'Cada aprendizado merece atenção.', 'Colégio Status',
       (select codigo_convite from configuracoes where id = true)
where not exists (select 1 from escolas where slug = 'status');

-- Dados atuais passam a ser do Status. O default mantém funcionando todo insert
-- existente (telas e Hermes) sem mudar código.
alter table professores add column if not exists escola_id uuid not null
    default '00000000-0000-0000-0000-000000000001' references escolas(id);
alter table turmas add column if not exists escola_id uuid not null
    default '00000000-0000-0000-0000-000000000001' references escolas(id);

-- Papel de dono da plataforma
alter table professores drop constraint if exists professores_role_check;
alter table professores add constraint professores_role_check
    check (role in ('dono', 'admin', 'professor'));

create table if not exists alunos_contas (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id),
    nome text not null,
    email varchar(255),
    usuario varchar(60),
    senha_hash text not null,
    senha_provisoria boolean not null default false,
    email_verificado boolean not null default false,
    token_verificacao varchar(64),
    token_verificacao_expira timestamptz,
    ativo boolean not null default true,
    criado_via varchar(10) not null check (criado_via in ('escola', 'convite')),
    ultimo_acesso timestamptz,
    created_at timestamptz not null default now(),
    check (email is not null or usuario is not null)
);
-- Únicos no sistema inteiro (o login é único para todas as escolas)
create unique index if not exists uq_alunos_contas_email on alunos_contas (lower(email)) where email is not null;
create unique index if not exists uq_alunos_contas_usuario on alunos_contas (lower(usuario)) where usuario is not null;

create table if not exists aluno_turmas (
    conta_id uuid not null references alunos_contas(id) on delete cascade,
    escola_id uuid not null references escolas(id),
    turma_nome text not null,
    ano_letivo varchar(10) not null,
    aluno_id uuid references alunos(id) on delete set null,  -- reservado: ligação futura com a lista de notas
    created_at timestamptz not null default now(),
    primary key (conta_id, turma_nome, ano_letivo)
);
create index if not exists idx_aluno_turmas_turma on aluno_turmas (escola_id, turma_nome, ano_letivo);

create table if not exists convites_turma (
    id uuid primary key default gen_random_uuid(),
    codigo varchar(6) not null unique,          -- exibido como "K7P-4QX"
    escola_id uuid not null references escolas(id),
    turma_nome text not null,
    ano_letivo varchar(10) not null,
    criado_por uuid references professores(id) on delete set null,
    expira_em timestamptz,                      -- null = sem validade
    ativo boolean not null default true,
    usos integer not null default 0,
    created_at timestamptz not null default now()
);

-- Mesmo padrão das tabelas atuais: o acesso passa pelo servidor, que aplica as regras
alter table escolas enable row level security;
alter table alunos_contas enable row level security;
alter table aluno_turmas enable row level security;
alter table convites_turma enable row level security;
drop policy if exists "acesso_total_escolas" on escolas;
create policy "acesso_total_escolas" on escolas for all using (true) with check (true);
drop policy if exists "acesso_total_alunos_contas" on alunos_contas;
create policy "acesso_total_alunos_contas" on alunos_contas for all using (true) with check (true);
drop policy if exists "acesso_total_aluno_turmas" on aluno_turmas;
create policy "acesso_total_aluno_turmas" on aluno_turmas for all using (true) with check (true);
drop policy if exists "acesso_total_convites_turma" on convites_turma;
create policy "acesso_total_convites_turma" on convites_turma for all using (true) with check (true);
```

Depois de colar, promover a conta do Peter (email com que ele entra hoje):
`update professores set role = 'dono' where email = :email_do_peter;`, confirmando o
email antes de rodar.

A coluna `configuracoes.codigo_convite` fica sem uso (o cadastro de professor passa a ler
`escolas.codigo_convite_professor`); não é apagada nesta parte.

## 2. Login e sessão

**Identificador.** O campo do login vira "Email ou usuário". Com `@`: procura em
`professores`, depois em `alunos_contas` por email. Sem `@`: procura só em
`alunos_contas` por usuário. Comparação sempre em minúsculas.

**Email único entre os dois tipos.** O cadastro de professor recusa email que já é de
aluno, e o de aluno recusa email que já é de professor.

**Cookie.** Mesmo cookie `app_auth`, novo formato `<tipo>:<id>.<assinatura>`, com
`tipo` = `p` (professor) ou `a` (aluno) e a assinatura HMAC calculada sobre `tipo:id`.
Cookie antigo, sem `:`, é lido como professor: ninguém é deslogado. Funções em
`src/lib/auth.ts`:
- `assinarSessao(tipo, id)` e `verificarSessao(cookie) → { tipo, id } | null`;
- `getProfessorAtual()` continua igual para quem a chama (retorna null para sessão de aluno);
- novo `getAlunoAtual()`: retorna null se a sessão não for de aluno **ou se a conta
  estiver inativa** (bloqueio vale na próxima página aberta);
- novo `ehAdmin(p)`: `role` é `admin` ou `dono`. Substitui as checagens `role === "admin"`.

**Trava de páginas (`src/proxy.ts`).** Lê o tipo do cookie, sem ir ao banco:
- aluno só abre `/aluno/*`; qualquer outra rota protegida → `/aluno`;
- professor que abre `/aluno/*` → `/`;
- públicas, além das atuais: `/aluno/entrar-com-codigo`;
- `/api/mcp` continua público no proxy e autenticado pelo próprio endpoint, como hoje.

**Senha provisória.** Conta criada pela escola nasce com senha aleatória de 8 caracteres
(alfabeto sem 0/O/1/I/l) e `senha_provisoria = true`. No login, vai para
`/aluno/trocar-senha` antes de qualquer outra página.

**Esqueci minha senha.** Aluno com email usa o fluxo atual. O token de redefinição passa a
carregar o tipo da conta (token antigo sem tipo = professor). Aluno sem email vê
"Peça uma nova senha à sua escola".

**Verificação de email.** `/verificar-email` aceita token de professor ou de aluno.
Os emails passam a usar `escolas.nome_remetente_email` no remetente e no texto.

## 3. Telas

**Login (`/login`).** Campo "Email ou usuário" e link "Sou aluno e tenho um código".
O resto da tela (marca, vídeo, textos) não muda.

**Cadastro por código (`/aluno/entrar-com-codigo`, pública).**
1. Aluno digita o código (aceita com ou sem hífen, maiúsculas ou minúsculas).
2. Código válido → mostra "Colégio Status · 3º A · 2026" para confirmar.
3. Nome, email, senha (mín. 6) e confirmação.
4. Email de confirmação; ao confirmar, entra já ligado à turma. `usos` do convite +1.

Código inválido, inativo ou vencido → "Código inválido. Confira com seu professor."

**Área do aluno (`/aluno`).**
- "Olá, {nome}", escola e lista de turmas.
- Cartões "Aulas" e "Simulados" com selo "Em breve" (as partes 2 e 4 entram aqui).
- "Entrar em outra turma": campo de código, já logado, para adicionar turma sem criar conta.
- Menu: trocar senha, sair. Layout próprio, sem a barra lateral de professor.

**Professor: código da turma.** Na página da turma, botão "Código para alunos" abre um
modal: gerar código (validade opcional: 7 dias, 30 dias, sem validade), copiar, desativar,
quantos alunos entraram. Gerar um novo desativa o anterior daquela turma e ano. Abaixo, a
lista de alunos com conta na turma, com "Gerar nova senha" (mostra a senha provisória uma
vez, para o professor repassar).

**Admin da escola (`/admin/alunos`).**
- Lista de contas com busca, turma, situação (ativa/bloqueada), último acesso.
- Criar aluno: nome + turma; o sistema sugere o usuário e gera a senha provisória.
- **Criar em lote:** escolhe a turma, cola os nomes (um por linha), revisa a prévia
  com os usuários sugeridos e confirma; baixa uma planilha `.xlsx` com nome, usuário
  e senha provisória (a senha não fica guardada em texto em lugar nenhum).
- Bloquear/desbloquear e gerar nova senha.

**Usuário sugerido.** `primeironome.ultimosobrenome`, sem acento, minúsculo
(`João da Silva` → `joao.silva`); se existir, acrescenta número (`joao.silva2`).

**Marca da escola.** Barra lateral, cabeçalho das páginas e emails leem nome e logo da
escola do usuário logado (`escolas`), não mais do código. Telas antes do login usam a
escola `status`. Cores continuam as do tema atual até a 2ª escola.

## 4. Regras de acesso

- Toda consulta do código novo filtra pela escola de quem está logado.
- Aluno só lê os próprios dados e as turmas em `aluno_turmas`. Não acessa nenhuma Server
  Action de professor: cada action de professor já chama `getProfessorAtual()`; as que
  hoje aceitam requisição anônima (modelo permissivo de `exigirAcessoATurmaId`) passam a
  **recusar sessão de aluno** explicitamente.
- Professor gera código e reseta senha só de turma a que tem acesso
  (`professorTemAcessoATurma`). Admin e dono: qualquer turma da escola.
- Hermes (MCP) não enxerga `alunos_contas`, `aluno_turmas` nem `convites_turma`.
- **Limite conhecido:** as telas de professor que já existem ainda não filtram por escola.
  Com uma escola só, isso não expõe nada. **Nenhuma 2ª escola pode ser cadastrada antes
  da etapa "Antes da 2ª escola"** do roteiro.

**Fora desta parte:** limite de tentativas de login, aluno ver notas, acesso de pais,
painel do dono para cadastrar escolas, cores por escola.

## 5. Testes

Unitários (`tsx --test`, mesmo padrão de `src/lib/*.test.ts`, incluídos no script `test`):
- sessão: assina e valida `p:` e `a:`; rejeita adulterado; trocar `a` por `p` invalida;
  cookie antigo vira professor;
- usuário sugerido: acentos, nome único, sobrenomes compostos, sufixo numérico;
- código de convite: tamanho, alfabeto sem ambíguos, normalização (`k7p-4qx` = `K7P4QX`);
- senha provisória: tamanho e alfabeto;
- identificador do login: com `@` = email, sem `@` = usuário.

Verificação manual antes de subir:
- professor existente continua logado após o deploy e vê tudo como antes;
- aluno criado pela escola: entra, troca a senha, cai em `/aluno`, não abre `/` nem `/admin`;
- aluno por código: cadastro, email, entrada já na turma; segundo código adiciona turma;
- conta bloqueada sai na próxima página;
- lote: planilha baixada com as senhas, e todas entram;
- `npm run build`, `npm test`, `npm run lint` sem erros.
