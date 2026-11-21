-- Novas tentativas ficam separadas da primeira resposta.
create table if not exists respostas_fixacao_tentativas (
  conta_id uuid not null references alunos_contas(id) on delete cascade,
  exercicio_id uuid not null references exercicios_fixacao(id) on delete cascade,
  tentativa_id uuid not null,
  marcada char(1) not null check (marcada in ('A', 'B', 'C', 'D', 'E')),
  acertou boolean not null,
  respondida_em timestamptz not null default now(),
  primary key (conta_id, tentativa_id, exercicio_id)
);
create index if not exists idx_fixacao_tentativas_exercicio on respostas_fixacao_tentativas (exercicio_id);
alter table respostas_fixacao_tentativas enable row level security;
-- Acesso somente no servidor com service role, após verificar a sessão do aluno.
