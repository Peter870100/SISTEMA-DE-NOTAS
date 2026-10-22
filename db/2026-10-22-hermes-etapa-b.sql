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
            begin
                execute format('insert into %I select * from jsonb_populate_recordset(null::%I, $1)', tabela, tabela)
                using r.dados -> tabela;
            exception
                when unique_violation then
                    raise exception 'Não foi possível restaurar: já existe um registro igual (%).', tabela;
                when foreign_key_violation then
                    raise exception 'Não foi possível restaurar: algo ligado a este item (%) foi apagado depois.', tabela;
            end;
        end if;
    end loop;

    delete from lixeira where id = r.id;
    return jsonb_build_object('tipo', r.tipo, 'turma_id', null, 'notas_restauradas', 0, 'notas_puladas', 0);
end $$;

NOTIFY pgrst, 'reload schema';
