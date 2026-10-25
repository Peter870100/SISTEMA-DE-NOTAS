-- Planilha Viva — Sistema de Notas de Redação
-- Schema Supabase (PostgreSQL)

-- Extensão necessária para gen_random_uuid()
create extension if not exists pgcrypto;

-- Turmas (ex: 1ª série A do Ensino Médio - 2º Bimestre)
create table turmas (
    id uuid primary key default gen_random_uuid(),
    nome varchar(255) not null,           -- ex: "1ª série A"
    bimestre varchar(50) not null default '2º Bimestre',
    ano_letivo varchar(10) not null default '2026',
    created_at timestamptz not null default now()
);

-- Alunos da turma
create table alunos (
    id uuid primary key default gen_random_uuid(),
    turma_id uuid not null references turmas(id) on delete cascade,
    numero int,
    nome varchar(255) not null,
    ordem int not null default 0,
    nome_editado_em timestamptz,          -- preenchido quando o professor renomeia o aluno (marca "editado" na planilha)
    transferido_em timestamptz,           -- preenchido quando o aluno vem de outra turma
    created_at timestamptz not null default now()
);
create index idx_alunos_turma on alunos(turma_id);

-- Colunas dinâmicas de atividades/temas de redação
create table atividades_colunas (
    id uuid primary key default gen_random_uuid(),
    turma_id uuid not null references turmas(id) on delete cascade,
    titulo varchar(255) not null,          -- ex: "MUSEUS", "LEITURAS", ou a data da chamada ("14/08/26")
    tema text,
    peso numeric(4,2) not null default 1.0,
    tipo varchar(20) not null default 'nota' check (tipo in ('nota', 'presenca')), -- 'presenca' = chamada diária (P/F)
    ordem int not null default 0,
    created_at timestamptz not null default now()
);
create index idx_colunas_turma on atividades_colunas(turma_id);

-- Professores com acesso ao sistema (login individual, admin ou professor comum)
create table professores (
    id uuid primary key default gen_random_uuid(),
    nome varchar(255) not null,
    email varchar(255) not null unique,
    senha_hash varchar(255) not null,
    role varchar(20) not null default 'professor' check (role in ('admin', 'professor')),
    email_verificado boolean not null default false,   -- true se criado pelo admin, ou após confirmar o link do email
    token_verificacao varchar(255),                    -- token do link de confirmação (auto-cadastro)
    token_verificacao_expira timestamptz,
    senha_provisoria boolean not null default false,   -- true = senha definida pelo admin; força troca no próximo login
    acesso_restrito boolean not null default false,     -- true = só vê as turmas listadas em professor_turma_acesso
    telefone varchar(20) unique,                        -- usado pra identificar o professor no agente do Telegram
    ultimo_acesso timestamptz,                          -- atualizado (com throttle) a cada página carregada logado
    created_at timestamptz not null default now()
);

-- Turmas liberadas por professor, quando acesso_restrito = true (por nome da turma,
-- não por bimestre específico — assim o acesso continua valendo quando um bimestre novo é criado)
create table professor_turma_acesso (
    professor_id uuid not null references professores(id) on delete cascade,
    turma_nome varchar(255) not null,
    primary key (professor_id, turma_nome)
);

-- Configurações do sistema (linha única) — hoje só o código de convite do cadastro
create table configuracoes (
    id boolean primary key default true check (id),
    codigo_convite varchar(50) not null,
    updated_at timestamptz not null default now()
);
insert into configuracoes (id, codigo_convite) values (true, '689166');

-- Células de nota/status (matriz aluno x coluna)
create table notas_celulas (
    id uuid primary key default gen_random_uuid(),
    aluno_id uuid not null references alunos(id) on delete cascade,
    coluna_id uuid not null references atividades_colunas(id) on delete cascade,
    valor numeric(6,2) check (valor >= 0 and valor <= 1000),
    status_texto varchar(150),             -- 'ok', 'FALTOU -25-06', 'NF', livre
    atualizado_por uuid references professores(id), -- quem lançou/alterou por último
    updated_at timestamptz not null default now(),
    unique (aluno_id, coluna_id),
    check (not (valor is not null and status_texto is not null))  -- célula é nota OU status, nunca os dois
);
create index idx_notas_coluna on notas_celulas(coluna_id);

-- Histórico de alterações de nota feitas por professores comuns (não-admin), pro admin auditar
create table notas_historico (
    id uuid primary key default gen_random_uuid(),
    aluno_id uuid not null references alunos(id) on delete cascade,
    coluna_id uuid not null references atividades_colunas(id) on delete cascade,
    valor_anterior numeric(6,2),
    status_anterior varchar(150),
    valor_novo numeric(6,2),
    status_novo varchar(150),
    alterado_por uuid references professores(id),
    created_at timestamptz not null default now()
);
create index idx_historico_aluno on notas_historico(aluno_id);
create index idx_historico_professor on notas_historico(alterado_por);

-- updated_at automático
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_notas_updated_at
before update on notas_celulas
for each row execute function set_updated_at();

-- RLS: acesso controlado na camada da aplicação (login por professor via cookie
-- assinado, não pelo auth.uid() do Supabase) — RLS aqui continua permissiva, igual
-- ao modo demo original (link privado, uso restrito aos professores cadastrados).
alter table turmas enable row level security;
alter table alunos enable row level security;
alter table atividades_colunas enable row level security;
alter table notas_celulas enable row level security;
alter table professores enable row level security;
alter table configuracoes enable row level security;
alter table professor_turma_acesso enable row level security;
alter table notas_historico enable row level security;

create policy "acesso_total_turmas" on turmas for all using (true) with check (true);
create policy "acesso_total_alunos" on alunos for all using (true) with check (true);
create policy "acesso_total_colunas" on atividades_colunas for all using (true) with check (true);
create policy "acesso_total_notas" on notas_celulas for all using (true) with check (true);
create policy "acesso_total_professores" on professores for all using (true) with check (true);
create policy "acesso_total_configuracoes" on configuracoes for all using (true) with check (true);
create policy "acesso_total_professor_turma_acesso" on professor_turma_acesso for all using (true) with check (true);
create policy "acesso_total_notas_historico" on notas_historico for all using (true) with check (true);

-- ATENÇÃO (lixeira): lixeira_restaurar recria linhas com jsonb_populate_record + select *.
-- Se adicionar coluna NOT NULL sem default em turmas/alunos/atividades_colunas, ajuste a
-- função com coalesce, senão cópias antigas da lixeira deixam de restaurar. O mesmo vale para
-- questoes, questao_imagens, simulados, simulado_turmas, simulado_questoes, tentativas e
-- tentativa_respostas (Lixeira da Hermes etapa B, 2026-10-22).
-- ===== Lixeira reversível + origem dos registros (2026-09-28) =====

-- Origem de cada registro: criado pela tela ('app') ou pelo agente de IA ('hermes')
alter table turmas             add column if not exists criado_via varchar(10) not null default 'app';
alter table alunos             add column if not exists criado_via varchar(10) not null default 'app';
alter table atividades_colunas add column if not exists criado_via varchar(10) not null default 'app';

-- Cópias completas do que foi excluído. Restaurar recria tudo com os mesmos IDs.
create table if not exists lixeira (
    id uuid primary key default gen_random_uuid(),
    tipo varchar(20) not null check (tipo in ('turma', 'aluno', 'atividade')),
    titulo text not null,                  -- ex: "Ana Souza · 3º Ano A (3º Bimestre)"
    turma_id uuid,                         -- contexto, sem FK: a turma pode não existir mais
    turma_nome text,
    dados jsonb not null,                  -- linhas copiadas (entidade, filhos, notas, histórico)
    resumo jsonb not null default '{}',    -- contagens pra exibir, ex: {"alunos": 32, "notas": 254}
    excluido_por uuid references professores(id) on delete set null,
    excluido_via varchar(10) not null default 'app' check (excluido_via in ('app', 'hermes')),
    excluido_em timestamptz not null default now()
);
create index if not exists idx_lixeira_excluido_em on lixeira(excluido_em desc);

alter table lixeira enable row level security;
drop policy if exists "acesso_total_lixeira" on lixeira;
create policy "acesso_total_lixeira" on lixeira for all using (true) with check (true);

-- Copia pra lixeira e apaga, numa transação só. Devolve o id do item na lixeira.
create or replace function lixeira_excluir(
    p_tipo text,
    p_id uuid,
    p_ator uuid default null,
    p_via text default 'app'
) returns uuid
language plpgsql as $$
declare
    v_turma turmas%rowtype;
    v_aluno alunos%rowtype;
    v_coluna atividades_colunas%rowtype;
    v_dados jsonb;
    v_titulo text;
    v_lixeira_id uuid;
begin
    if p_tipo = 'turma' then
        select * into v_turma from turmas where id = p_id;
        if not found then raise exception 'Planilha não encontrada.'; end if;
        v_titulo := v_turma.nome || ' · ' || v_turma.bimestre;
        v_dados := jsonb_build_object(
            'turma', to_jsonb(v_turma),
            'alunos', coalesce((select jsonb_agg(to_jsonb(a) order by a.ordem) from alunos a where a.turma_id = p_id), '[]'::jsonb),
            'atividades', coalesce((select jsonb_agg(to_jsonb(c) order by c.ordem) from atividades_colunas c where c.turma_id = p_id), '[]'::jsonb),
            'notas', coalesce((select jsonb_agg(to_jsonb(n)) from notas_celulas n
                where n.aluno_id in (select id from alunos where turma_id = p_id)
                   or n.coluna_id in (select id from atividades_colunas where turma_id = p_id)), '[]'::jsonb),
            'historico', coalesce((select jsonb_agg(to_jsonb(h)) from notas_historico h
                where h.aluno_id in (select id from alunos where turma_id = p_id)
                   or h.coluna_id in (select id from atividades_colunas where turma_id = p_id)), '[]'::jsonb)
        );
        insert into lixeira (tipo, titulo, turma_id, turma_nome, dados, resumo, excluido_por, excluido_via)
        values ('turma', v_titulo, v_turma.id, v_turma.nome, v_dados,
            jsonb_build_object(
                'alunos', jsonb_array_length(v_dados->'alunos'),
                'atividades', jsonb_array_length(v_dados->'atividades'),
                'notas', jsonb_array_length(v_dados->'notas')),
            p_ator, p_via)
        returning id into v_lixeira_id;
        delete from turmas where id = p_id;  -- cascata leva alunos, colunas, notas e histórico

    elsif p_tipo = 'aluno' then
        select * into v_aluno from alunos where id = p_id;
        if not found then raise exception 'Aluno não encontrado.'; end if;
        select * into v_turma from turmas where id = v_aluno.turma_id;
        v_titulo := v_aluno.nome || ' · ' || v_turma.nome || ' (' || v_turma.bimestre || ')';
        v_dados := jsonb_build_object(
            'aluno', to_jsonb(v_aluno),
            'notas', coalesce((select jsonb_agg(to_jsonb(n)) from notas_celulas n where n.aluno_id = p_id), '[]'::jsonb),
            'historico', coalesce((select jsonb_agg(to_jsonb(h)) from notas_historico h where h.aluno_id = p_id), '[]'::jsonb)
        );
        insert into lixeira (tipo, titulo, turma_id, turma_nome, dados, resumo, excluido_por, excluido_via)
        values ('aluno', v_titulo, v_turma.id, v_turma.nome, v_dados,
            jsonb_build_object('notas', jsonb_array_length(v_dados->'notas')),
            p_ator, p_via)
        returning id into v_lixeira_id;
        delete from alunos where id = p_id;

    elsif p_tipo = 'atividade' then
        select * into v_coluna from atividades_colunas where id = p_id;
        if not found then raise exception 'Atividade não encontrada.'; end if;
        select * into v_turma from turmas where id = v_coluna.turma_id;
        v_titulo := v_coluna.titulo || ' · ' || v_turma.nome || ' (' || v_turma.bimestre || ')';
        v_dados := jsonb_build_object(
            'atividade', to_jsonb(v_coluna),
            'notas', coalesce((select jsonb_agg(to_jsonb(n)) from notas_celulas n where n.coluna_id = p_id), '[]'::jsonb),
            'historico', coalesce((select jsonb_agg(to_jsonb(h)) from notas_historico h where h.coluna_id = p_id), '[]'::jsonb)
        );
        insert into lixeira (tipo, titulo, turma_id, turma_nome, dados, resumo, excluido_por, excluido_via)
        values ('atividade', v_titulo, v_turma.id, v_turma.nome, v_dados,
            jsonb_build_object('notas', jsonb_array_length(v_dados->'notas')),
            p_ator, p_via)
        returning id into v_lixeira_id;
        delete from atividades_colunas where id = p_id;

    else
        raise exception 'Tipo inválido: %', p_tipo;
    end if;

    return v_lixeira_id;
end;
$$;

-- Recria o item com os mesmos IDs, numa transação só, e remove da lixeira.
-- Notas/histórico que apontam pra aluno ou atividade que não existe mais são pulados.
create or replace function lixeira_restaurar(p_lixeira_id uuid)
returns jsonb
language plpgsql as $$
declare
    r lixeira%rowtype;
    v_total int;
    v_restauradas int;
begin
    select * into r from lixeira where id = p_lixeira_id for update;
    if not found then raise exception 'Este item não está mais na lixeira.'; end if;

    if r.tipo = 'turma' then
        if exists (select 1 from turmas where id = (r.dados->'turma'->>'id')::uuid) then
            raise exception 'A planilha já existe — nada a restaurar.';
        end if;
        insert into turmas select * from jsonb_populate_record(null::turmas, r.dados->'turma');
        insert into alunos select * from jsonb_populate_recordset(null::alunos, r.dados->'alunos');
        insert into atividades_colunas select * from jsonb_populate_recordset(null::atividades_colunas, r.dados->'atividades');

    elsif r.tipo in ('aluno', 'atividade') then
        if not exists (select 1 from turmas where id = r.turma_id) then
            raise exception 'Restaure a planilha "%" primeiro.', r.turma_nome;
        end if;
        if r.tipo = 'aluno' then
            if exists (select 1 from alunos where id = (r.dados->'aluno'->>'id')::uuid) then
                raise exception 'O aluno já existe — nada a restaurar.';
            end if;
            insert into alunos select * from jsonb_populate_record(null::alunos, r.dados->'aluno');
        else
            if exists (select 1 from atividades_colunas where id = (r.dados->'atividade'->>'id')::uuid) then
                raise exception 'A atividade já existe — nada a restaurar.';
            end if;
            insert into atividades_colunas select * from jsonb_populate_record(null::atividades_colunas, r.dados->'atividade');
        end if;
    end if;

    -- Notas: só as que ainda têm aluno e atividade; autor apagado vira null.
    v_total := jsonb_array_length(coalesce(r.dados->'notas', '[]'::jsonb));
    insert into notas_celulas (id, aluno_id, coluna_id, valor, status_texto, atualizado_por, updated_at)
    select n.id, n.aluno_id, n.coluna_id, n.valor, n.status_texto,
           (select p.id from professores p where p.id = n.atualizado_por), n.updated_at
    from jsonb_populate_recordset(null::notas_celulas, coalesce(r.dados->'notas', '[]'::jsonb)) n
    where exists (select 1 from alunos a where a.id = n.aluno_id)
      and exists (select 1 from atividades_colunas c where c.id = n.coluna_id)
    on conflict do nothing;
    get diagnostics v_restauradas = row_count;

    insert into notas_historico (id, aluno_id, coluna_id, valor_anterior, status_anterior, valor_novo, status_novo, alterado_por, created_at)
    select h.id, h.aluno_id, h.coluna_id, h.valor_anterior, h.status_anterior, h.valor_novo, h.status_novo,
           (select p.id from professores p where p.id = h.alterado_por), h.created_at
    from jsonb_populate_recordset(null::notas_historico, coalesce(r.dados->'historico', '[]'::jsonb)) h
    where exists (select 1 from alunos a where a.id = h.aluno_id)
      and exists (select 1 from atividades_colunas c where c.id = h.coluna_id)
    on conflict do nothing;

    delete from lixeira where id = r.id;

    return jsonb_build_object(
        'tipo', r.tipo,
        'turma_id', r.turma_id,
        'notas_restauradas', v_restauradas,
        'notas_puladas', v_total - v_restauradas
    );
end;
$$;

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

-- ===== Plataforma de estudos: cursos, módulos e aulas (2026-10-04) =====

create table if not exists cursos (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id),
    professor_id uuid references professores(id) on delete set null,   -- dono
    titulo text not null,
    disciplina text not null,
    descricao text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_cursos_escola on cursos (escola_id);

create table if not exists curso_turmas (
    curso_id uuid not null references cursos(id) on delete cascade,
    escola_id uuid not null references escolas(id),
    turma_nome text not null,
    ano_letivo varchar(10) not null,
    primary key (curso_id, turma_nome, ano_letivo)
);
create index if not exists idx_curso_turmas_turma on curso_turmas (escola_id, turma_nome, ano_letivo);

create table if not exists modulos (
    id uuid primary key default gen_random_uuid(),
    curso_id uuid not null references cursos(id) on delete cascade,
    titulo text not null,
    ordem integer not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_modulos_curso on modulos (curso_id, ordem);

create table if not exists aulas (
    id uuid primary key default gen_random_uuid(),
    modulo_id uuid not null references modulos(id) on delete cascade,
    curso_id uuid not null references cursos(id) on delete cascade,
    titulo text not null,
    texto text,
    video_provedor varchar(10) check (video_provedor in ('youtube', 'bunny')),
    video_id varchar(64),
    publicada boolean not null default false,
    publicada_em timestamptz,
    gabarito_liberacao varchar(15) not null default 'apos_concluir'
        check (gabarito_liberacao in ('junto', 'apos_concluir', 'data')),
    gabarito_libera_em timestamptz,
    ordem integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((video_provedor is null) = (video_id is null))
);
create index if not exists idx_aulas_modulo on aulas (modulo_id, ordem);
create index if not exists idx_aulas_curso on aulas (curso_id);

create table if not exists aula_arquivos (
    id uuid primary key default gen_random_uuid(),
    aula_id uuid not null references aulas(id) on delete cascade,
    tipo varchar(10) not null check (tipo in ('material', 'gabarito')),
    nome_arquivo text not null,
    storage_path text not null unique,          -- "<escola_id>/<curso_id>/<aula_id>/<uuid>.pdf"
    tamanho_bytes integer not null,
    created_at timestamptz not null default now()
);
create index if not exists idx_aula_arquivos_aula on aula_arquivos (aula_id);

create table if not exists aula_progresso (
    conta_id uuid not null references alunos_contas(id) on delete cascade,
    aula_id uuid not null references aulas(id) on delete cascade,
    curso_id uuid not null references cursos(id) on delete cascade,
    posicao_seg integer not null default 0,       -- onde parou (retomar)
    maior_posicao_seg integer not null default 0, -- maior ponto assistido (para a %)
    duracao_seg integer,                           -- duração informada pelo player
    concluida_em timestamptz,
    atualizado_em timestamptz not null default now(),
    primary key (conta_id, aula_id)
);
create index if not exists idx_aula_progresso_curso on aula_progresso (curso_id, conta_id);

alter table cursos enable row level security;
alter table curso_turmas enable row level security;
alter table modulos enable row level security;
alter table aulas enable row level security;
alter table aula_arquivos enable row level security;
alter table aula_progresso enable row level security;
drop policy if exists "acesso_total_cursos" on cursos;
create policy "acesso_total_cursos" on cursos for all using (true) with check (true);
drop policy if exists "acesso_total_curso_turmas" on curso_turmas;
create policy "acesso_total_curso_turmas" on curso_turmas for all using (true) with check (true);
drop policy if exists "acesso_total_modulos" on modulos;
create policy "acesso_total_modulos" on modulos for all using (true) with check (true);
drop policy if exists "acesso_total_aulas" on aulas;
create policy "acesso_total_aulas" on aulas for all using (true) with check (true);
drop policy if exists "acesso_total_aula_arquivos" on aula_arquivos;
create policy "acesso_total_aula_arquivos" on aula_arquivos for all using (true) with check (true);
drop policy if exists "acesso_total_aula_progresso" on aula_progresso;
create policy "acesso_total_aula_progresso" on aula_progresso for all using (true) with check (true);

-- Bucket privado dos PDFs. O servidor (chave anon, só no servidor) gera links assinados
-- de envio e de download; o navegador nunca recebe a chave.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;
drop policy if exists "materiais_servidor_ler" on storage.objects;
create policy "materiais_servidor_ler" on storage.objects for select using (bucket_id = 'materiais');
drop policy if exists "materiais_servidor_enviar" on storage.objects;
create policy "materiais_servidor_enviar" on storage.objects for insert with check (bucket_id = 'materiais');
drop policy if exists "materiais_servidor_apagar" on storage.objects;
create policy "materiais_servidor_apagar" on storage.objects for delete using (bucket_id = 'materiais');

-- ===== Duração do vídeo informada pelo editor do professor (2026-10-04) =====
alter table aulas add column if not exists duracao_seg integer check (duracao_seg is null or (duracao_seg between 1 and 21600));

-- ===== Banco de questões (2026-10-04) =====

create table if not exists assuntos (
    id uuid primary key default gen_random_uuid(),
    materia text not null check (materia in ('portugues','literatura','ingles','espanhol','artes','educacao_fisica',
        'historia','geografia','filosofia','sociologia','fisica','quimica','biologia','matematica')),
    nome text not null,
    situacao varchar(10) not null default 'aprovado' check (situacao in ('aprovado', 'proposto')),
    created_at timestamptz not null default now()
);
create unique index if not exists uq_assuntos_materia_nome on assuntos (materia, lower(nome));

create table if not exists importacoes (
    id uuid primary key default gen_random_uuid(),
    escopo varchar(6) not null check (escopo in ('geral', 'escola')),
    escola_id uuid references escolas(id),
    origem varchar(8) not null check (origem in ('pdf', 'enemdev')),
    banca text not null,
    ano integer,
    caderno text not null default '',
    status varchar(10) not null default 'enviando'
        check (status in ('enviando', 'lendo', 'revisao', 'concluida', 'erro')),
    total_paginas integer not null default 0,
    paginas_lidas integer not null default 0,
    batch_id text,
    custo_estimado_usd numeric(8,2),
    custo_real_usd numeric(8,2),
    erro text,
    criado_por uuid references professores(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((escopo = 'geral') = (escola_id is null))
);

create table if not exists importacao_paginas (
    id uuid primary key default gen_random_uuid(),
    importacao_id uuid not null references importacoes(id) on delete cascade,
    tipo varchar(9) not null check (tipo in ('prova', 'gabarito')),
    numero integer not null,
    storage_path text not null unique,       -- <importacao_id>/<tipo>-<numero>.jpg (dentro do bucket questoes)
    largura integer not null,
    altura integer not null,
    status varchar(8) not null default 'pendente' check (status in ('pendente', 'lida', 'erro')),
    erro text,
    unique (importacao_id, tipo, numero)
);

create table if not exists questoes (
    id uuid primary key default gen_random_uuid(),
    escopo varchar(6) not null check (escopo in ('geral', 'escola')),
    escola_id uuid references escolas(id),
    banca text not null,
    ano integer,
    caderno text not null default '',
    numero integer,
    area varchar(10) not null check (area in ('linguagens', 'humanas', 'natureza', 'matematica')),
    materia text not null,
    assunto_id uuid references assuntos(id) on delete set null,
    enunciado text not null default '',
    comando text not null default '',
    alternativas jsonb not null default '[]',  -- [{ "letra": "A", "texto": "..." }, ... até "E"]
    resposta char(1) check (resposta in ('A', 'B', 'C', 'D', 'E')),
    anulada boolean not null default false,
    status varchar(9) not null default 'revisao' check (status in ('revisao', 'publicada')),
    precisa_revisao boolean not null default false,
    motivo_revisao text,
    origem varchar(8) not null check (origem in ('pdf', 'enemdev', 'manual')),
    importacao_id uuid references importacoes(id) on delete set null,
    pagina_id uuid references importacao_paginas(id) on delete set null,
    fonte_id text,                              -- id da questão no enem.dev
    criado_por uuid references professores(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((escopo = 'geral') = (escola_id is null)),
    check (status <> 'publicada' or anulada or resposta is not null)
);
create index if not exists idx_questoes_filtros on questoes (status, area, materia, banca, ano);
create index if not exists idx_questoes_escola on questoes (escola_id);
create index if not exists idx_questoes_importacao on questoes (importacao_id);
create unique index if not exists uq_questoes_geral on questoes (banca, ano, caderno, numero)
    where escopo = 'geral' and numero is not null;
create unique index if not exists uq_questoes_escola on questoes (escola_id, banca, ano, caderno, numero)
    where escopo = 'escola' and numero is not null;

create table if not exists questao_imagens (
    id uuid primary key default gen_random_uuid(),
    questao_id uuid not null references questoes(id) on delete cascade,
    alvo varchar(9) not null check (alvo in ('enunciado', 'A', 'B', 'C', 'D', 'E')),
    ordem integer not null default 0,
    tipo varchar(7) not null check (tipo in ('recorte', 'arquivo')),
    pagina_id uuid references importacao_paginas(id) on delete cascade,
    x numeric(6,5), y numeric(6,5), w numeric(6,5), h numeric(6,5),   -- frações 0..1 da página
    storage_path text,                                                  -- quando tipo = 'arquivo'
    created_at timestamptz not null default now(),
    check (
      (tipo = 'recorte' and pagina_id is not null and x is not null and y is not null and w > 0 and h > 0
        and x >= 0 and y >= 0 and x + w <= 1.00001 and y + h <= 1.00001)
      or (tipo = 'arquivo' and storage_path is not null)
    )
);
create index if not exists idx_questao_imagens_questao on questao_imagens (questao_id);

alter table assuntos enable row level security;
alter table importacoes enable row level security;
alter table importacao_paginas enable row level security;
alter table questoes enable row level security;
alter table questao_imagens enable row level security;
drop policy if exists "acesso_total_assuntos" on assuntos;
create policy "acesso_total_assuntos" on assuntos for all using (true) with check (true);
drop policy if exists "acesso_total_importacoes" on importacoes;
create policy "acesso_total_importacoes" on importacoes for all using (true) with check (true);
drop policy if exists "acesso_total_importacao_paginas" on importacao_paginas;
create policy "acesso_total_importacao_paginas" on importacao_paginas for all using (true) with check (true);
drop policy if exists "acesso_total_questoes" on questoes;
create policy "acesso_total_questoes" on questoes for all using (true) with check (true);
drop policy if exists "acesso_total_questao_imagens" on questao_imagens;
create policy "acesso_total_questao_imagens" on questao_imagens for all using (true) with check (true);

-- Bucket privado das páginas e imagens das questões (mesmo modelo do bucket `materiais`)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('questoes', 'questoes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "questoes_servidor_ler" on storage.objects;
create policy "questoes_servidor_ler" on storage.objects for select using (bucket_id = 'questoes');
drop policy if exists "questoes_servidor_enviar" on storage.objects;
create policy "questoes_servidor_enviar" on storage.objects for insert with check (bucket_id = 'questoes');
drop policy if exists "questoes_servidor_apagar" on storage.objects;
create policy "questoes_servidor_apagar" on storage.objects for delete using (bucket_id = 'questoes');

-- ===== Simulados (2026-10-04) =====

create table if not exists simulados (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id),
    tipo varchar(9) not null check (tipo in ('professor', 'treino')),
    professor_id uuid references professores(id) on delete set null,
    conta_id uuid references alunos_contas(id) on delete cascade,
    titulo text not null,
    duracao_min integer check (duracao_min is null or (duracao_min between 1 and 600)),
    abre_em timestamptz,
    fecha_em timestamptz,
    correcao varchar(10) not null default 'apos_prazo' check (correcao in ('na_hora', 'apos_prazo')),
    embaralhar boolean not null default true,
    status varchar(10) not null default 'rascunho' check (status in ('rascunho', 'publicado')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((tipo = 'treino') = (conta_id is not null)),
    check (tipo = 'treino' or duracao_min is not null),
    check (abre_em is null or fecha_em is null or fecha_em > abre_em)
);
create index if not exists idx_simulados_escola on simulados (escola_id, tipo, status);
create index if not exists idx_simulados_conta on simulados (conta_id);

create table if not exists simulado_turmas (
    simulado_id uuid not null references simulados(id) on delete cascade,
    escola_id uuid not null references escolas(id),
    turma_nome text not null,
    ano_letivo varchar(10) not null,
    primary key (simulado_id, turma_nome, ano_letivo)
);
create index if not exists idx_simulado_turmas_turma on simulado_turmas (escola_id, turma_nome, ano_letivo);

create table if not exists simulado_questoes (
    simulado_id uuid not null references simulados(id) on delete cascade,
    questao_id uuid not null references questoes(id) on delete cascade,
    ordem integer not null default 0,
    primary key (simulado_id, questao_id)
);

create table if not exists tentativas (
    id uuid primary key default gen_random_uuid(),
    simulado_id uuid not null references simulados(id) on delete cascade,
    conta_id uuid not null references alunos_contas(id) on delete cascade,
    ordem uuid[] not null,
    iniciada_em timestamptz not null default now(),
    prazo_em timestamptz,
    tempo_usado_seg integer not null default 0,
    ultimo_pulso_em timestamptz,
    entregue_em timestamptz,
    status varchar(12) not null default 'em_andamento' check (status in ('em_andamento', 'entregue')),
    acertos integer,
    total integer,
    porcentagem numeric(5,2),
    por_area jsonb,
    created_at timestamptz not null default now(),
    unique (simulado_id, conta_id)
);
-- Tempo (segundos) que cada questão ficou na tela: {questao_id: segundos} (2026-10-11)
alter table tentativas add column if not exists tempo_questoes jsonb;
create index if not exists idx_tentativas_conta on tentativas (conta_id, status);

create table if not exists tentativa_respostas (
    tentativa_id uuid not null references tentativas(id) on delete cascade,
    questao_id uuid not null references questoes(id) on delete cascade,
    alternativa char(1) check (alternativa in ('A', 'B', 'C', 'D', 'E')),
    respondida_em timestamptz not null default now(),
    correta boolean,
    primary key (tentativa_id, questao_id)
);

alter table simulados enable row level security;
alter table simulado_turmas enable row level security;
alter table simulado_questoes enable row level security;
alter table tentativas enable row level security;
alter table tentativa_respostas enable row level security;
drop policy if exists "acesso_total_simulados" on simulados;
create policy "acesso_total_simulados" on simulados for all using (true) with check (true);
drop policy if exists "acesso_total_simulado_turmas" on simulado_turmas;
create policy "acesso_total_simulado_turmas" on simulado_turmas for all using (true) with check (true);
drop policy if exists "acesso_total_simulado_questoes" on simulado_questoes;
create policy "acesso_total_simulado_questoes" on simulado_questoes for all using (true) with check (true);
drop policy if exists "acesso_total_tentativas" on tentativas;
create policy "acesso_total_tentativas" on tentativas for all using (true) with check (true);
drop policy if exists "acesso_total_tentativa_respostas" on tentativa_respostas;
create policy "acesso_total_tentativa_respostas" on tentativa_respostas for all using (true) with check (true);

-- ===== Multiescola (2026-10-04) =====

alter table lixeira add column if not exists escola_id uuid not null
    default '00000000-0000-0000-0000-000000000001' references escolas(id);
create index if not exists idx_lixeira_escola on lixeira (escola_id, excluido_em desc);

-- lixeira_excluir() não conhece a escola: o gatilho pega a da turma (ainda existe no momento do insert)
create or replace function lixeira_definir_escola()
returns trigger language plpgsql as $$
begin
  new.escola_id := coalesce((select escola_id from turmas where id = new.turma_id), new.escola_id);
  return new;
end;
$$;
drop trigger if exists trg_lixeira_escola on lixeira;
create trigger trg_lixeira_escola before insert on lixeira
for each row execute function lixeira_definir_escola();

alter table escolas add column if not exists ativa boolean not null default true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marcas', 'marcas', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "marcas_ler" on storage.objects;
create policy "marcas_ler" on storage.objects for select using (bucket_id = 'marcas');
drop policy if exists "marcas_enviar" on storage.objects;
create policy "marcas_enviar" on storage.objects for insert with check (bucket_id = 'marcas');
drop policy if exists "marcas_apagar" on storage.objects;
create policy "marcas_apagar" on storage.objects for delete using (bucket_id = 'marcas');

-- Controle de bimestres (2026-10-04)
-- Controle manual por turma, escola e ano. Executar no SQL Editor do Supabase.
begin;
alter table public.turmas add column if not exists bimestre_encerrado boolean not null default false;
alter table public.turmas add column if not exists bimestre_vigente boolean not null default false;
create unique index if not exists uq_bimestre_vigente on public.turmas (escola_id, nome, ano_letivo) where bimestre_vigente;
alter table public.turmas drop constraint if exists bimestre_vigente_aberto;
alter table public.turmas add constraint bimestre_vigente_aberto check (not (bimestre_encerrado and bimestre_vigente));

create or replace function public.alterar_situacao_bimestre(p_turma_id uuid, p_acao text)
returns setof public.turmas language plpgsql set search_path = public as $$
declare alvo public.turmas;
begin
  if p_acao not in ('encerrar', 'reabrir', 'ativar') or p_acao is null then
    raise exception 'Ação de bimestre inválida.';
  end if;
  select * into alvo from public.turmas where id = p_turma_id;
  if not found then raise exception 'Turma não encontrada.'; end if;
  -- Serializa trocas do período vigente, inclusive em requisições concorrentes.
  perform pg_advisory_xact_lock(hashtextextended(alvo.escola_id::text || ':' || alvo.nome || ':' || alvo.ano_letivo, 0));
  select * into alvo from public.turmas where id = p_turma_id for update;
  if not found then raise exception 'Turma não encontrada.'; end if;
  if p_acao = 'ativar' then
    if alvo.bimestre_encerrado then raise exception 'Reabra o bimestre antes de definir como vigente.'; end if;
    update public.turmas set bimestre_vigente = false
      where escola_id = alvo.escola_id and nome = alvo.nome and ano_letivo = alvo.ano_letivo and bimestre_vigente;
    update public.turmas set bimestre_vigente = true where id = p_turma_id;
  elsif p_acao = 'encerrar' then
    update public.turmas set bimestre_encerrado = true, bimestre_vigente = false where id = p_turma_id;
  else
    update public.turmas set bimestre_encerrado = false where id = p_turma_id;
  end if;
  return query select * from public.turmas where escola_id = alvo.escola_id and nome = alvo.nome and ano_letivo = alvo.ano_letivo;
end;
$$;

-- FOR SHARE mantém o período aberto até a escrita terminar; encerrar espera
-- essas transações terminarem. A proteção vale para tela, Hermes e importações.
create or replace function public.exigir_bimestre_aberto(p_turma_id uuid)
returns void language plpgsql set search_path = public as $$
declare encerrado boolean;
begin
  select bimestre_encerrado into encerrado from public.turmas where id = p_turma_id for share;
  -- Um pai aberto já excluído em cascata não precisa de outra trava.
  if not found then return; end if;
  if encerrado then raise exception 'Bimestre encerrado. Reabra o bimestre para fazer lançamentos.'; end if;
end;
$$;

create or replace function public.proteger_notas_bimestre()
returns trigger language plpgsql set search_path = public as $$
declare turma_aluno uuid; turma_coluna uuid;
begin
  if TG_OP <> 'INSERT' then
    select turma_id into turma_aluno from public.alunos where id = OLD.aluno_id;
    select turma_id into turma_coluna from public.atividades_colunas where id = OLD.coluna_id;
    -- Na exclusão em cascata, o pai já passou pela sua própria proteção.
    if turma_aluno is not null then perform public.exigir_bimestre_aberto(turma_aluno); end if;
    if turma_coluna is not null and turma_coluna is distinct from turma_aluno then perform public.exigir_bimestre_aberto(turma_coluna); end if;
  end if;
  if TG_OP <> 'DELETE' then
    select turma_id into turma_aluno from public.alunos where id = NEW.aluno_id;
    select turma_id into turma_coluna from public.atividades_colunas where id = NEW.coluna_id;
    if turma_aluno is null or turma_coluna is null or turma_aluno <> turma_coluna then
      raise exception 'Aluno e atividade devem pertencer ao mesmo bimestre.';
    end if;
    perform public.exigir_bimestre_aberto(turma_aluno);
    return NEW;
  end if;
  return OLD;
end;
$$;
drop trigger if exists trg_proteger_notas_bimestre on public.notas_celulas;
create trigger trg_proteger_notas_bimestre before insert or update or delete on public.notas_celulas for each row execute function public.proteger_notas_bimestre();

-- Impede mudar o arquivo encerrado apagando uma atividade/aluno ou transferindo
-- seus registros. Consulta e exportação continuam disponíveis.
create or replace function public.proteger_estrutura_bimestre()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP <> 'INSERT' then perform public.exigir_bimestre_aberto(OLD.turma_id); end if;
  if TG_OP <> 'DELETE' then
    perform public.exigir_bimestre_aberto(NEW.turma_id);
    return NEW;
  end if;
  return OLD;
end;
$$;
drop trigger if exists trg_proteger_alunos_bimestre on public.alunos;
create trigger trg_proteger_alunos_bimestre before insert or update or delete on public.alunos for each row execute function public.proteger_estrutura_bimestre();
drop trigger if exists trg_proteger_colunas_bimestre on public.atividades_colunas;
create trigger trg_proteger_colunas_bimestre before insert or update or delete on public.atividades_colunas for each row execute function public.proteger_estrutura_bimestre();
create or replace function public.proteger_exclusao_bimestre()
returns trigger language plpgsql set search_path = public as $$
begin
  if OLD.bimestre_encerrado then raise exception 'Bimestre encerrado. Reabra o bimestre para excluí-lo.'; end if;
  return OLD;
end;
$$;
drop trigger if exists trg_proteger_exclusao_bimestre on public.turmas;
create trigger trg_proteger_exclusao_bimestre before delete on public.turmas for each row execute function public.proteger_exclusao_bimestre();
notify pgrst, 'reload schema';
commit;

-- Capas de cursos e aulas (2026-10-05)
-- Capas opcionais, sem liberar envio ou exclusão anônimos.
begin;
alter table public.cursos add column if not exists capa_caminho text;
alter table public.aulas add column if not exists capa_caminho text;
create unique index if not exists idx_cursos_capa on public.cursos (capa_caminho) where capa_caminho is not null;
create unique index if not exists idx_aulas_capa on public.aulas (capa_caminho) where capa_caminho is not null;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('capas', 'capas', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
-- Gravação e exclusão usam exclusivamente a chave privada do servidor.
commit;
notify pgrst, 'reload schema';

-- Perfil do aluno: foto JPEG reduzida (256 x 256) ou emoji, vinculado a conta.
-- Executar no SQL Editor do mesmo projeto Supabase usado pelo aplicativo.
-- Nao altera nomes, senhas, notas ou fotos de outros alunos.
ALTER TABLE public.alunos_contas
  ADD COLUMN IF NOT EXISTS avatar_perfil text
  CHECK (avatar_perfil IS NULL OR octet_length(avatar_perfil) < 400000);
NOTIFY pgrst, 'reload schema';

-- Quiz da aula: rascunho do professor, versao publicada e tentativas do aluno.
BEGIN;
CREATE TABLE IF NOT EXISTS public.aula_quizzes (
  aula_id uuid PRIMARY KEY REFERENCES public.aulas(id) ON DELETE CASCADE,
  rascunho jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rascunho) = 'array' AND jsonb_array_length(rascunho) <= 5),
  perguntas jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(perguntas) = 'array' AND jsonb_array_length(perguntas) <= 5),
  publicado boolean NOT NULL DEFAULT false,
  versao uuid NOT NULL DEFAULT gen_random_uuid(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT publicado OR jsonb_array_length(perguntas) BETWEEN 3 AND 5)
);
CREATE TABLE IF NOT EXISTS public.aula_quiz_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  conta_id uuid NOT NULL REFERENCES public.alunos_contas(id) ON DELETE CASCADE,
  versao uuid NOT NULL,
  resultado jsonb NOT NULL CHECK (jsonb_typeof(resultado) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aula_quiz_tentativas_aluno_idx ON public.aula_quiz_tentativas (conta_id, aula_id, versao, created_at DESC);
-- A autenticacao do app usa cookies proprios: acesso somente pelas acoes do servidor.
ALTER TABLE public.aula_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aula_quiz_tentativas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aula_quizzes, public.aula_quiz_tentativas FROM anon, authenticated;
GRANT ALL ON public.aula_quizzes, public.aula_quiz_tentativas TO service_role;
NOTIFY pgrst, 'reload schema';

-- ===== Hermes etapa A (2026-10-12) =====
alter table tentativas add column if not exists saidas integer not null default 0;
alter table tentativas add column if not exists tempo_fora_seg integer not null default 0;
alter table tentativas add column if not exists eventos_saida jsonb;
alter table aula_progresso add column if not exists tempo_assistido_seg integer not null default 0;
alter table aula_progresso add column if not exists saidas integer not null default 0;
alter table aula_progresso add column if not exists tempo_fora_seg integer not null default 0;
COMMIT;

-- ===== Conferência de imagens (2026-10-18) =====
alter table questoes add column if not exists falta_imagem boolean not null default false;
alter table questoes add column if not exists conferida_em timestamptz;
alter table questao_imagens add column if not exists alinhamento varchar(8) not null default 'centro'
    check (alinhamento in ('esquerda', 'centro', 'direita'));
NOTIFY pgrst, 'reload schema';

-- ===== Barra de formatação do enunciado (2026-10-19) =====
alter table questoes add column if not exists conteudo jsonb;
NOTIFY pgrst, 'reload schema';

-- ===== Hermes etapa B: Lixeira de questões/simulados/tentativas, selo e registro (2026-10-22) =====
-- Idempotente (pode colar duas vezes). Não remove arquivos do Storage: é isso que permite restaurar.

-- Origem de cada registro: criado pela tela ('app') ou pela Hermes ('hermes')
alter table simulados   add column if not exists criado_via varchar(10) not null default 'app' check (criado_via in ('app', 'hermes'));
alter table questoes    add column if not exists criado_via varchar(10) not null default 'app' check (criado_via in ('app', 'hermes'));
alter table importacoes add column if not exists criado_via varchar(10) not null default 'app' check (criado_via in ('app', 'hermes'));

-- Registro de tudo o que a Hermes altera
create table if not exists hermes_registro (
    id uuid primary key default gen_random_uuid(),
    perfil varchar(10) not null check (perfil in ('dono', 'professor')),
    professor_id uuid references professores(id) on delete set null,
    escola_id uuid references escolas(id),
    ferramenta text not null,
    parametros jsonb not null default '{}',
    situacao varchar(10) not null default 'iniciada' check (situacao in ('iniciada', 'concluida', 'erro')),
    mensagem text,
    criado_em timestamptz not null default now(),
    concluido_em timestamptz
);
create index if not exists idx_hermes_registro_criado_em on hermes_registro (criado_em desc);
alter table hermes_registro enable row level security;
drop policy if exists "acesso_total_hermes_registro" on hermes_registro;
create policy "acesso_total_hermes_registro" on hermes_registro for all using (true) with check (true);

-- Lixeira: tipos novos e item sem escola (questão do banco geral)
alter table lixeira drop constraint if exists lixeira_tipo_check;
alter table lixeira add constraint lixeira_tipo_check
    check (tipo in ('turma', 'aluno', 'atividade', 'questao', 'simulado', 'tentativa'));
alter table lixeira alter column escola_id drop not null;

-- As funções antigas (turma/aluno/atividade) viram *_legado, só na primeira execução
do $$ begin
  if to_regprocedure('lixeira_excluir_legado(text,uuid,uuid,text)') is null then
    alter function lixeira_excluir(text, uuid, uuid, text) rename to lixeira_excluir_legado;
    alter function lixeira_restaurar(uuid) rename to lixeira_restaurar_legado;
  end if;
end $$;

create or replace function lixeira_excluir(
    p_tipo text,
    p_id uuid,
    p_ator uuid default null,
    p_via text default 'app'
) returns uuid
language plpgsql as $$
declare
    d jsonb;
    escola uuid;
    titulo_item text;
    item uuid;
begin
    if p_tipo in ('turma', 'aluno', 'atividade') then
        return lixeira_excluir_legado(p_tipo, p_id, p_ator, p_via);
    end if;

    if p_tipo = 'questao' then
        select jsonb_build_object(
                'questoes', jsonb_build_array(to_jsonb(q)),
                'questao_imagens', coalesce((select jsonb_agg(i) from questao_imagens i where i.questao_id = q.id), '[]'::jsonb),
                'simulado_questoes', coalesce((select jsonb_agg(i) from simulado_questoes i where i.questao_id = q.id), '[]'::jsonb),
                'tentativa_respostas', coalesce((select jsonb_agg(i) from tentativa_respostas i where i.questao_id = q.id), '[]'::jsonb)),
            q.escola_id,
            coalesce(nullif(left(q.enunciado, 120), ''), 'Questão sem enunciado')
        into d, escola, titulo_item
        from questoes q where q.id = p_id for update;
    elsif p_tipo = 'simulado' then
        select jsonb_build_object(
                'simulados', jsonb_build_array(to_jsonb(s)),
                'simulado_turmas', coalesce((select jsonb_agg(i) from simulado_turmas i where i.simulado_id = s.id), '[]'::jsonb),
                'simulado_questoes', coalesce((select jsonb_agg(i) from simulado_questoes i where i.simulado_id = s.id), '[]'::jsonb),
                'tentativas', coalesce((select jsonb_agg(i) from tentativas i where i.simulado_id = s.id), '[]'::jsonb),
                'tentativa_respostas', coalesce((select jsonb_agg(i) from tentativa_respostas i join tentativas t on t.id = i.tentativa_id where t.simulado_id = s.id), '[]'::jsonb)),
            s.escola_id, s.titulo
        into d, escola, titulo_item
        from simulados s where s.id = p_id for update;
    elsif p_tipo = 'tentativa' then
        select jsonb_build_object(
                'tentativas', jsonb_build_array(to_jsonb(t)),
                'tentativa_respostas', coalesce((select jsonb_agg(i) from tentativa_respostas i where i.tentativa_id = t.id), '[]'::jsonb)),
            s.escola_id, 'Tentativa: ' || s.titulo
        into d, escola, titulo_item
        from tentativas t join simulados s on s.id = t.simulado_id
        where t.id = p_id for update of t;
    else
        raise exception 'Tipo inválido';
    end if;

    if d is null then raise exception 'Registro não encontrado'; end if;

    -- escola nula (questão do banco geral) é gravada como está: o gatilho só troca por escola de turma
    insert into lixeira (tipo, titulo, dados, resumo, escola_id, excluido_por, excluido_via)
    values (p_tipo, titulo_item, d,
            jsonb_build_object('registros', (select sum(jsonb_array_length(value)) from jsonb_each(d))),
            escola, p_ator, p_via)
    returning id into item;

    if p_tipo = 'questao' then delete from questoes where id = p_id;
    elsif p_tipo = 'simulado' then delete from simulados where id = p_id;
    else delete from tentativas where id = p_id;
    end if;
    return item;
end $$;

create or replace function lixeira_restaurar(p_lixeira_id uuid)
returns jsonb
language plpgsql as $$
declare
    r lixeira%rowtype;
    tabela text;
    linhas jsonb;
    antes integer;
    pulados integer := 0;
begin
    select * into r from lixeira where id = p_lixeira_id for update;
    if not found then raise exception 'Item não encontrado'; end if;

    if r.tipo in ('turma', 'aluno', 'atividade') then
        return lixeira_restaurar_legado(p_lixeira_id);
    end if;

    -- Ordem das chaves estrangeiras. Qualquer conflito aborta tudo e o item continua na Lixeira.
    foreach tabela in array array['questoes', 'questao_imagens', 'simulados', 'simulado_turmas',
                                  'simulado_questoes', 'tentativas', 'tentativa_respostas'] loop
        if r.dados ? tabela then
            linhas := r.dados -> tabela;
            -- Referências "on delete set null" que sumiram depois da exclusão viram null (como o autor na restauração legada)
            if tabela = 'questoes' then
                select coalesce(jsonb_agg(e || jsonb_build_object(
                    'criado_por', case when e->>'criado_por' is not null and exists (select 1 from professores p where p.id = (e->>'criado_por')::uuid) then e->'criado_por' else 'null'::jsonb end,
                    'assunto_id', case when e->>'assunto_id' is not null and exists (select 1 from assuntos a where a.id = (e->>'assunto_id')::uuid) then e->'assunto_id' else 'null'::jsonb end,
                    'importacao_id', case when e->>'importacao_id' is not null and exists (select 1 from importacoes i where i.id = (e->>'importacao_id')::uuid) then e->'importacao_id' else 'null'::jsonb end,
                    'pagina_id', case when e->>'pagina_id' is not null and exists (select 1 from importacao_paginas g where g.id = (e->>'pagina_id')::uuid) then e->'pagina_id' else 'null'::jsonb end
                )), '[]'::jsonb) into linhas from jsonb_array_elements(linhas) e;
            elsif tabela = 'simulados' then
                select coalesce(jsonb_agg(e || jsonb_build_object(
                    'professor_id', case when e->>'professor_id' is not null and exists (select 1 from professores p where p.id = (e->>'professor_id')::uuid) then e->'professor_id' else 'null'::jsonb end
                )), '[]'::jsonb) into linhas from jsonb_array_elements(linhas) e;
            elsif tabela = 'questao_imagens' then
                -- recorte depende da página (FK em cascata): sem a página não há o que restaurar
                select coalesce(jsonb_agg(e), '[]'::jsonb) into linhas from jsonb_array_elements(linhas) e
                where e->>'pagina_id' is null or exists (select 1 from importacao_paginas g where g.id = (e->>'pagina_id')::uuid);
            -- Só na questão: o simulado ou a tentativa (aluno excluído, "Apagar de vez") pode ter sumido depois.
            -- Esses vínculos são pulados e contados; no simulado a falta da questão continua abortando tudo.
            elsif r.tipo = 'questao' and tabela = 'simulado_questoes' then
                antes := jsonb_array_length(linhas);
                select coalesce(jsonb_agg(e), '[]'::jsonb) into linhas from jsonb_array_elements(linhas) e
                where exists (select 1 from simulados s where s.id = (e->>'simulado_id')::uuid);
                pulados := pulados + antes - jsonb_array_length(linhas);
            elsif r.tipo = 'questao' and tabela = 'tentativa_respostas' then
                antes := jsonb_array_length(linhas);
                select coalesce(jsonb_agg(e), '[]'::jsonb) into linhas from jsonb_array_elements(linhas) e
                where exists (select 1 from tentativas t where t.id = (e->>'tentativa_id')::uuid);
                pulados := pulados + antes - jsonb_array_length(linhas);
            end if;
            begin
                execute format('insert into %I select * from jsonb_populate_recordset(null::%I, $1)', tabela, tabela)
                using linhas;
            exception
                when unique_violation then
                    raise exception 'Não foi possível restaurar: já existe um registro igual (%).', tabela;
                when foreign_key_violation then
                    raise exception 'Não foi possível restaurar: algo ligado a este item (%) foi apagado depois.', tabela;
            end;
        end if;
    end loop;

    delete from lixeira where id = r.id;
    return jsonb_build_object('tipo', r.tipo, 'turma_id', null, 'notas_restauradas', 0, 'notas_puladas', 0,
                              'vinculos_pulados', pulados);
end $$;

NOTIFY pgrst, 'reload schema';

-- ===== Relatórios: média de aprovação por escola (2026-10-22) =====
-- Idempotente (pode colar duas vezes).
alter table escolas add column if not exists media_aprovacao numeric(4,2) not null default 6.0 check (media_aprovacao >= 0 and media_aprovacao <= 10);

NOTIFY pgrst, 'reload schema';

-- ===== Hermes: importação de provas em PDF (2026-10-23) =====
-- Idempotente (pode colar duas vezes).
-- O bucket `questoes` passa a aceitar os PDFs originais (até 30 MB) mandados pela Hermes.
-- Mantém os tipos já aceitos (null = todos, continua null) e o limite (null = o do projeto, continua null).
update storage.buckets set
  file_size_limit = case when file_size_limit is null then null else greatest(file_size_limit, 31457280) end,
  allowed_mime_types = case when allowed_mime_types is null then null else
    array(select distinct unnest(allowed_mime_types || array['application/pdf', 'application/json'])) end
where id = 'questoes';

-- Upsert por cima de um arquivo que já existe (PDF original, selecao.json, página refeita) precisa de UPDATE.
drop policy if exists "questoes_servidor_atualizar" on storage.objects;
create policy "questoes_servidor_atualizar" on storage.objects for update using (bucket_id = 'questoes') with check (bucket_id = 'questoes');

NOTIFY pgrst, 'reload schema';

-- ===== Hermes etapa C1: ligação única com a planilha, progresso de aula na Lixeira, contas pela Hermes (2026-10-23) =====
-- Idempotente (pode colar duas vezes).

-- Uma linha da planilha (aluno do bimestre) só pode estar ligada a uma conta de aluno
create unique index if not exists uq_aluno_turmas_aluno on aluno_turmas (aluno_id) where aluno_id is not null;

-- Contas de aluno também podem ser criadas pela Hermes
-- Remove qualquer check antigo sobre criado_via (o nome automático pode variar), depois cria o novo
do $$ declare c record; begin
  for c in select conname from pg_constraint
           where conrelid = 'alunos_contas'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%criado_via%' loop
    execute format('alter table alunos_contas drop constraint %I', c.conname);
  end loop; end $$;
alter table alunos_contas add constraint alunos_contas_criado_via_check
    check (criado_via in ('escola', 'convite', 'hermes'));

-- Lixeira: tipo novo para o progresso de uma aula (zerar a aula de um aluno)
alter table lixeira drop constraint if exists lixeira_tipo_check;
alter table lixeira add constraint lixeira_tipo_check
    check (tipo in ('turma', 'aluno', 'atividade', 'questao', 'simulado', 'tentativa', 'progresso_aula'));

-- Copia a linha de aula_progresso para a Lixeira (com a escola da conta) e apaga
create or replace function lixeira_excluir_progresso(
    p_conta uuid,
    p_aula uuid,
    p_ator uuid default null,
    p_via text default 'app'
) returns uuid
language plpgsql as $$
declare
    d jsonb;
    escola uuid;
    titulo_item text;
    item uuid;
begin
    select jsonb_build_object('aula_progresso', jsonb_build_array(to_jsonb(p))),
           c.escola_id,
           'Progresso: ' || a.titulo || ' · ' || c.nome
    into d, escola, titulo_item
    from aula_progresso p
    join alunos_contas c on c.id = p.conta_id
    join aulas a on a.id = p.aula_id
    where p.conta_id = p_conta and p.aula_id = p_aula
    for update of p;

    if d is null then raise exception 'Progresso não encontrado'; end if;

    insert into lixeira (tipo, titulo, dados, resumo, escola_id, excluido_por, excluido_via)
    values ('progresso_aula', titulo_item, d, jsonb_build_object('registros', 1), escola, p_ator, p_via)
    returning id into item;

    delete from aula_progresso where conta_id = p_conta and aula_id = p_aula;
    return item;
end $$;

-- Mesmo corpo da etapa B (com a correção dos vínculos), só com 'aula_progresso' no fim da lista.
-- As FKs de aula_progresso são em cascata (conta, aula, curso): nada de "set null" a tratar.
-- Se o aluno já tem progresso novo nessa aula, o unique_violation aborta e a cópia fica na Lixeira.
create or replace function lixeira_restaurar(p_lixeira_id uuid)
returns jsonb
language plpgsql as $$
declare
    r lixeira%rowtype;
    tabela text;
    linhas jsonb;
    antes integer;
    pulados integer := 0;
begin
    select * into r from lixeira where id = p_lixeira_id for update;
    if not found then raise exception 'Item não encontrado'; end if;

    if r.tipo in ('turma', 'aluno', 'atividade') then
        return lixeira_restaurar_legado(p_lixeira_id);
    end if;

    -- Ordem das chaves estrangeiras. Qualquer conflito aborta tudo e o item continua na Lixeira.
    foreach tabela in array array['questoes', 'questao_imagens', 'simulados', 'simulado_turmas',
                                  'simulado_questoes', 'tentativas', 'tentativa_respostas', 'aula_progresso'] loop
        if r.dados ? tabela then
            linhas := r.dados -> tabela;
            -- Referências "on delete set null" que sumiram depois da exclusão viram null (como o autor na restauração legada)
            if tabela = 'questoes' then
                select coalesce(jsonb_agg(e || jsonb_build_object(
                    'criado_por', case when e->>'criado_por' is not null and exists (select 1 from professores p where p.id = (e->>'criado_por')::uuid) then e->'criado_por' else 'null'::jsonb end,
                    'assunto_id', case when e->>'assunto_id' is not null and exists (select 1 from assuntos a where a.id = (e->>'assunto_id')::uuid) then e->'assunto_id' else 'null'::jsonb end,
                    'importacao_id', case when e->>'importacao_id' is not null and exists (select 1 from importacoes i where i.id = (e->>'importacao_id')::uuid) then e->'importacao_id' else 'null'::jsonb end,
                    'pagina_id', case when e->>'pagina_id' is not null and exists (select 1 from importacao_paginas g where g.id = (e->>'pagina_id')::uuid) then e->'pagina_id' else 'null'::jsonb end
                )), '[]'::jsonb) into linhas from jsonb_array_elements(linhas) e;
            elsif tabela = 'simulados' then
                select coalesce(jsonb_agg(e || jsonb_build_object(
                    'professor_id', case when e->>'professor_id' is not null and exists (select 1 from professores p where p.id = (e->>'professor_id')::uuid) then e->'professor_id' else 'null'::jsonb end
                )), '[]'::jsonb) into linhas from jsonb_array_elements(linhas) e;
            elsif tabela = 'questao_imagens' then
                -- recorte depende da página (FK em cascata): sem a página não há o que restaurar
                select coalesce(jsonb_agg(e), '[]'::jsonb) into linhas from jsonb_array_elements(linhas) e
                where e->>'pagina_id' is null or exists (select 1 from importacao_paginas g where g.id = (e->>'pagina_id')::uuid);
            -- Só na questão: o simulado ou a tentativa (aluno excluído, "Apagar de vez") pode ter sumido depois.
            -- Esses vínculos são pulados e contados; no simulado a falta da questão continua abortando tudo.
            elsif r.tipo = 'questao' and tabela = 'simulado_questoes' then
                antes := jsonb_array_length(linhas);
                select coalesce(jsonb_agg(e), '[]'::jsonb) into linhas from jsonb_array_elements(linhas) e
                where exists (select 1 from simulados s where s.id = (e->>'simulado_id')::uuid);
                pulados := pulados + antes - jsonb_array_length(linhas);
            elsif r.tipo = 'questao' and tabela = 'tentativa_respostas' then
                antes := jsonb_array_length(linhas);
                select coalesce(jsonb_agg(e), '[]'::jsonb) into linhas from jsonb_array_elements(linhas) e
                where exists (select 1 from tentativas t where t.id = (e->>'tentativa_id')::uuid);
                pulados := pulados + antes - jsonb_array_length(linhas);
            end if;
            begin
                execute format('insert into %I select * from jsonb_populate_recordset(null::%I, $1)', tabela, tabela)
                using linhas;
            exception
                when unique_violation then
                    raise exception 'Não foi possível restaurar: já existe um registro igual (%).', tabela;
                when foreign_key_violation then
                    raise exception 'Não foi possível restaurar: algo ligado a este item (%) foi apagado depois.', tabela;
            end;
        end if;
    end loop;

    delete from lixeira where id = r.id;
    return jsonb_build_object('tipo', r.tipo, 'turma_id', null, 'notas_restauradas', 0, 'notas_puladas', 0,
                              'vinculos_pulados', pulados);
end $$;

NOTIFY pgrst, 'reload schema';

-- ===== Gerador de questões por IA (2026-10-24) =====
create table if not exists geracoes_ia (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id),          -- escola da conta (conta para o limite)
    professor_id uuid references professores(id) on delete set null,
    escopo varchar(6) not null check (escopo in ('geral', 'escola')),
    materia text not null,
    assunto_id uuid references assuntos(id) on delete set null,
    dificuldade varchar(7) not null check (dificuldade in ('facil', 'media', 'dificil')),
    orientacao text not null default '',
    questao_base_id uuid references questoes(id) on delete set null,
    quantidade_pedida integer not null check (quantidade_pedida between 1 and 10),
    quantidade_gerada integer not null default 0,
    status varchar(9) not null default 'gerando' check (status in ('gerando', 'concluida', 'erro')),
    erro text,
    tokens_entrada integer,
    tokens_saida integer,
    custo_usd numeric(8,4),
    created_at timestamptz not null default now()
);
create index if not exists idx_geracoes_ia_escola_data on geracoes_ia (escola_id, created_at);
alter table geracoes_ia enable row level security;
drop policy if exists "acesso_total_geracoes_ia" on geracoes_ia;
create policy "acesso_total_geracoes_ia" on geracoes_ia for all using (true) with check (true);

alter table questoes add column if not exists resolucao text;
alter table questoes add column if not exists geracao_id uuid references geracoes_ia(id) on delete set null;

-- origem passa a aceitar 'ia'
do $$
declare c text;
begin
    for c in select conname from pg_constraint
             where conrelid = 'questoes'::regclass and contype = 'c'
               and pg_get_constraintdef(oid) ilike '%origem%' loop
        execute format('alter table questoes drop constraint %I', c);
    end loop;
end $$;
alter table questoes add constraint questoes_origem_check
    check (origem in ('pdf', 'enemdev', 'manual', 'ia'));
NOTIFY pgrst, 'reload schema';
