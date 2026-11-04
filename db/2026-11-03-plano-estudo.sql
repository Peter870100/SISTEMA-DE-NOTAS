-- ===== Plano de estudo (2026-11-03) =====
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run (pode rodar de novo sem erro).

alter table escolas add column if not exists regras_aprendizagem jsonb;

alter table simulados add column if not exists plano_conteudo text;
alter table simulados add column if not exists plano_etapa varchar(11)
    check (plano_etapa in ('diagnostico', 'pratica', 'revisao'));
alter table simulados add column if not exists plano_rodada integer;
-- os três juntos, e só em treino
alter table simulados drop constraint if exists simulados_plano_check;
alter table simulados add constraint simulados_plano_check check (
    (plano_etapa is null and plano_conteudo is null and plano_rodada is null)
    or (plano_etapa is not null and plano_conteudo is not null and plano_rodada is not null and plano_rodada >= 1 and tipo = 'treino')
);
-- dois cliques ao mesmo tempo não criam dois treinos da mesma etapa
create unique index if not exists uq_simulados_plano
    on simulados (conta_id, plano_conteudo, plano_etapa, plano_rodada) where plano_etapa is not null;

create table if not exists planos_estudo (
    conta_id uuid primary key references alunos_contas(id) on delete cascade,
    escola_id uuid not null references escolas(id),
    minutos_semana integer not null check (minutos_semana between 15 and 1200),
    updated_at timestamptz not null default now()
);

create table if not exists plano_revisoes (
    conta_id uuid not null references alunos_contas(id) on delete cascade,
    conteudo text not null,
    revisado_em timestamptz not null default now(),
    primary key (conta_id, conteudo)
);

alter table planos_estudo enable row level security;
alter table plano_revisoes enable row level security;
drop policy if exists "acesso_total_planos_estudo" on planos_estudo;
create policy "acesso_total_planos_estudo" on planos_estudo for all using (true) with check (true);
drop policy if exists "acesso_total_plano_revisoes" on plano_revisoes;
create policy "acesso_total_plano_revisoes" on plano_revisoes for all using (true) with check (true);

NOTIFY pgrst, 'reload schema';
