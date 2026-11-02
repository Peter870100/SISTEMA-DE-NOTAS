-- Apaga os dados de teste do painel "Meu desempenho" (criados por db/dados-teste-desempenho.sql).
-- Cole no SQL Editor do Supabase. Pode rodar várias vezes. Só toca no Colégio Status e só em:
--   - simulados com título começando com '[TESTE DESEMPENHO]';
--   - contas de aluno com usuário começando com 'teste.desempenho.';
--   - a turma 'TESTE DESEMPENHO' (alunos da planilha vão junto).
-- Questões do banco nunca são apagadas.
-- Atenção: se algum bimestre da turma de teste estiver "encerrado", o delete falha; reabra o bimestre antes.
begin;

-- Simulados: simulado_turmas, simulado_questoes, tentativas e tentativa_respostas saem em cascata.
delete from simulados
 where escola_id = '00000000-0000-0000-0000-000000000001'
   and titulo like '[TESTE DESEMPENHO]%';

-- Contas: aluno_turmas, tentativas, treinos e progresso de aulas da conta saem em cascata.
delete from alunos_contas
 where escola_id = '00000000-0000-0000-0000-000000000001'
   and lower(usuario) like 'teste.desempenho.%';

-- Turma: alunos da planilha, colunas e notas saem em cascata.
delete from turmas
 where escola_id = '00000000-0000-0000-0000-000000000001'
   and nome = 'TESTE DESEMPENHO';

commit;
