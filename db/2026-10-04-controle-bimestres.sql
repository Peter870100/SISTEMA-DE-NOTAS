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
