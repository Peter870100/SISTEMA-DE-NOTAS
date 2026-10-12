-- ===== Hermes etapa A (2026-10-12) =====
alter table tentativas add column if not exists saidas integer not null default 0;
alter table tentativas add column if not exists tempo_fora_seg integer not null default 0;
alter table tentativas add column if not exists eventos_saida jsonb;
alter table aula_progresso add column if not exists tempo_assistido_seg integer not null default 0;
alter table aula_progresso add column if not exists saidas integer not null default 0;
alter table aula_progresso add column if not exists tempo_fora_seg integer not null default 0;

-- Consulta livre da Hermes: só views sem colunas sensíveis, papel sem acesso a public, transação só leitura.
create schema if not exists hermes;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'hermes_leitor') then create role hermes_leitor nologin; end if;
end $$;
grant hermes_leitor to anon;
revoke all on schema public from hermes_leitor;
grant usage on schema hermes to hermes_leitor;

create or replace view hermes.escolas as select id, nome, slug, ativa, created_at from escolas;
create or replace view hermes.professores as select id, nome, email, role, escola_id, email_verificado, senha_provisoria, acesso_restrito, telefone, ultimo_acesso, created_at from professores;
create or replace view hermes.professor_turma_acesso as select * from professor_turma_acesso;
create or replace view hermes.turmas as select * from turmas;
create or replace view hermes.alunos as select * from alunos;
create or replace view hermes.atividades_colunas as select * from atividades_colunas;
create or replace view hermes.notas_celulas as select * from notas_celulas;
create or replace view hermes.notas_historico as select * from notas_historico;
create or replace view hermes.alunos_contas as select id, escola_id, nome, email, usuario, senha_provisoria, email_verificado, ativo, criado_via, ultimo_acesso, created_at from alunos_contas;
create or replace view hermes.aluno_turmas as select * from aluno_turmas;
create or replace view hermes.cursos as select * from cursos;
create or replace view hermes.curso_turmas as select * from curso_turmas;
create or replace view hermes.modulos as select * from modulos;
create or replace view hermes.aulas as select * from aulas;
create or replace view hermes.aula_progresso as select * from aula_progresso;
create or replace view hermes.assuntos as select * from assuntos;
create or replace view hermes.importacoes as select * from importacoes;
create or replace view hermes.questoes as select * from questoes;
create or replace view hermes.simulados as select * from simulados;
create or replace view hermes.simulado_turmas as select * from simulado_turmas;
create or replace view hermes.simulado_questoes as select * from simulado_questoes;
create or replace view hermes.tentativas as select * from tentativas;
create or replace view hermes.tentativa_respostas as select * from tentativa_respostas;
grant select on all tables in schema hermes to hermes_leitor;

create or replace function public.hermes_consulta(consulta text) returns jsonb
language plpgsql security invoker set search_path = hermes, pg_catalog as $$
declare resultado jsonb;
begin
  if consulta ~ ';\s*\S' then raise exception 'Envie uma única consulta (sem ; no meio).'; end if;
  set local role hermes_leitor;
  set local transaction read only;
  set local statement_timeout = '8s';
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) q limit 500) t', rtrim(consulta, '; ')) into resultado;
  return resultado;
end $$;
grant execute on function public.hermes_consulta(text) to anon;
