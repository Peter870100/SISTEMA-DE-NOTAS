-- ===== Hermes etapa C1: ligação única com a planilha, progresso de aula na Lixeira, contas pela Hermes (2026-10-23) =====
-- Idempotente (pode colar duas vezes).

-- Uma linha da planilha (aluno do bimestre) só pode estar ligada a uma conta de aluno
create unique index if not exists uq_aluno_turmas_aluno on aluno_turmas (aluno_id) where aluno_id is not null;

-- Contas de aluno também podem ser criadas pela Hermes
alter table alunos_contas drop constraint if exists alunos_contas_criado_via_check;
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
