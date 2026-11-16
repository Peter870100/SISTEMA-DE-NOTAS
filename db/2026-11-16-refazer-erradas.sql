-- ===== Refazer as erradas (2026-11-16) =====
-- Libera plano_etapa = 'refazer'. O nome do check foi gerado pelo Postgres; o bloco acha e troca o certo.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'simulados'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%plano_etapa%' and pg_get_constraintdef(oid) like '%diagnostico%'
  loop
    execute format('alter table simulados drop constraint %I', c.conname);
  end loop;
end $$;
alter table simulados add constraint simulados_plano_etapa_check
    check (plano_etapa in ('diagnostico', 'pratica', 'revisao', 'refazer'));

NOTIFY pgrst, 'reload schema';

-- Conferência: deve mostrar uma linha com 'refazer' na lista.
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'simulados'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%diagnostico%';
