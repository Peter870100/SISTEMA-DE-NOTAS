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
-- função com coalesce, senão cópias antigas da lixeira deixam de restaurar.
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
