-- ===== Reestudo (2026-11-04) =====

-- Um material por assunto, geral para todas as escolas.
create table if not exists materiais_estudo (
    id uuid primary key default gen_random_uuid(),
    assunto_id uuid not null unique references assuntos(id) on delete cascade,
    blocos jsonb not null,
    fonte varchar(10) not null check (fonte in ('wikipedia', 'ia')),  -- wikipedia = fatos conferidos em verbete
    fonte_titulo text,                    -- título do verbete usado na conferência
    fonte_url text,                       -- link do verbete
    situacao varchar(14) not null default 'rascunho'
        check (situacao in ('rascunho', 'retido', 'publicado', 'em_conferencia')),
    motivo text,                          -- por que ficou retido
    checagem jsonb,                       -- parecer da segunda checagem
    checado_em timestamptz,
    checagens smallint not null default 0,    -- quantas checagens já fez
    amostra boolean not null default false,   -- sorteado para leitura humana
    lido_por uuid references professores(id) on delete set null,
    lido_em timestamptz,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    constraint materiais_estudo_fonte_url_check check (
        (fonte = 'wikipedia' and fonte_url like 'https://pt.wikipedia.org/%') or (fonte = 'ia' and fonte_url is null)
    )
);
create index if not exists idx_materiais_estudo_situacao on materiais_estudo (situacao);

create table if not exists imagens_estudo (
    id uuid primary key default gen_random_uuid(),
    material_id uuid not null references materiais_estudo(id) on delete cascade,
    tipo varchar(7) not null check (tipo in ('desenho', 'foto')),
    svg text,                             -- desenho
    storage_path text,                    -- foto, no bucket `estudos`
    alt text not null,
    legenda text,
    credito text,
    licenca text,
    fonte_url text,
    aprovada_por uuid references professores(id) on delete set null,
    aprovada_em timestamptz,
    criado_em timestamptz not null default now(),
    constraint imagens_estudo_tipo_dados_check check (
        (tipo = 'desenho' and svg is not null and storage_path is null)
        or (tipo = 'foto' and storage_path is not null and svg is null and credito is not null and licenca is not null)
    )
);
create index if not exists idx_imagens_estudo_material on imagens_estudo (material_id);

create table if not exists exercicios_fixacao (
    id uuid primary key default gen_random_uuid(),
    material_id uuid not null references materiais_estudo(id) on delete cascade,
    ordem smallint not null check (ordem between 1 and 10),
    enunciado text not null,
    imagem_id uuid references imagens_estudo(id) on delete set null,  -- só desenho
    alternativas jsonb not null check (jsonb_array_length(alternativas) = 5),  -- [{letra, texto}]
    resposta_correta char(1) not null check (resposta_correta in ('A', 'B', 'C', 'D', 'E')),
    comentario text not null,
    situacao varchar(14) not null default 'rascunho'
        check (situacao in ('rascunho', 'retido', 'publicado', 'em_conferencia')),
    motivo text,
    checagens smallint not null default 0,
    unique (material_id, ordem)
);

-- Primeira resposta de cada aluno a cada exercício. Não entra no desempenho.
create table if not exists respostas_fixacao (
    conta_id uuid not null references alunos_contas(id) on delete cascade,
    exercicio_id uuid not null references exercicios_fixacao(id) on delete cascade,
    marcada char(1) not null check (marcada in ('A', 'B', 'C', 'D', 'E')),
    acertou boolean not null,
    respondida_em timestamptz not null default now(),
    primary key (conta_id, exercicio_id)
);
create index if not exists idx_respostas_fixacao_exercicio on respostas_fixacao (exercicio_id);

-- Botão "Encontrei um erro".
create table if not exists relatos_erro (
    id uuid primary key default gen_random_uuid(),
    material_id uuid not null references materiais_estudo(id) on delete cascade,
    exercicio_id uuid references exercicios_fixacao(id) on delete cascade,   -- null = o texto
    conta_id uuid references alunos_contas(id) on delete set null,
    professor_id uuid references professores(id) on delete set null,
    mensagem text check (length(mensagem) <= 500),
    situacao varchar(9) not null default 'aberto' check (situacao in ('aberto', 'corrigido', 'sem_erro')),
    resolvido_por uuid references professores(id) on delete set null,
    resolvido_em timestamptz,
    criado_em timestamptz not null default now()
);
create index if not exists idx_relatos_erro_abertos on relatos_erro (material_id) where situacao = 'aberto';
create index if not exists idx_relatos_erro_conta on relatos_erro (conta_id, criado_em);

-- Mesmo modelo das outras tabelas: o controle de acesso fica no servidor (ver "Como está hoje").
alter table materiais_estudo enable row level security;
alter table exercicios_fixacao enable row level security;
alter table imagens_estudo enable row level security;
alter table respostas_fixacao enable row level security;
alter table relatos_erro enable row level security;
drop policy if exists "acesso_total_materiais_estudo" on materiais_estudo;
create policy "acesso_total_materiais_estudo" on materiais_estudo for all using (true) with check (true);
drop policy if exists "acesso_total_exercicios_fixacao" on exercicios_fixacao;
create policy "acesso_total_exercicios_fixacao" on exercicios_fixacao for all using (true) with check (true);
drop policy if exists "acesso_total_imagens_estudo" on imagens_estudo;
create policy "acesso_total_imagens_estudo" on imagens_estudo for all using (true) with check (true);
drop policy if exists "acesso_total_respostas_fixacao" on respostas_fixacao;
create policy "acesso_total_respostas_fixacao" on respostas_fixacao for all using (true) with check (true);
drop policy if exists "acesso_total_relatos_erro" on relatos_erro;
create policy "acesso_total_relatos_erro" on relatos_erro for all using (true) with check (true);

-- Fotos: bucket público, como `capas`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('estudos', 'estudos', true, 2097152, array['image/webp'])
on conflict (id) do nothing;
drop policy if exists "estudos_ler" on storage.objects;
create policy "estudos_ler" on storage.objects for select using (bucket_id = 'estudos');
drop policy if exists "estudos_enviar" on storage.objects;
create policy "estudos_enviar" on storage.objects for insert with check (bucket_id = 'estudos');
drop policy if exists "estudos_apagar" on storage.objects;
create policy "estudos_apagar" on storage.objects for delete using (bucket_id = 'estudos');

NOTIFY pgrst, 'reload schema';
