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
    created_at timestamptz not null default now()
);

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

create policy "acesso_total_turmas" on turmas for all using (true) with check (true);
create policy "acesso_total_alunos" on alunos for all using (true) with check (true);
create policy "acesso_total_colunas" on atividades_colunas for all using (true) with check (true);
create policy "acesso_total_notas" on notas_celulas for all using (true) with check (true);
create policy "acesso_total_professores" on professores for all using (true) with check (true);
