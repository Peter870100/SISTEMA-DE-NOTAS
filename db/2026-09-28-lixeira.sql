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
