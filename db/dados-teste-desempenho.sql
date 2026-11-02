-- Dados de teste do painel "Meu desempenho" (Colégio Status). Cole no SQL Editor do Supabase.
-- Pode rodar várias vezes: começa apagando o que db/apagar-dados-teste-desempenho.sql apaga.
-- Cria: turma 'TESTE DESEMPENHO' (2026), 3 alunos na planilha, 3 contas (teste.desempenho.ana/bruno/carla),
-- 4 simulados de professor encerrados (correção na hora) e as tentativas entregues.
--   Ana: erra quase todo o assunto-alvo (matemática) até o simulado 3, 2 em branco, melhora no 4.
--   Bruno: vai bem nos 4. Carla: fez só os simulados 1 e 2.
-- As questões são escolhidas aqui dentro (order by id): publicadas, não anuladas, com assunto e gabarito,
-- do banco geral. Matérias: matemática (assunto-alvo = o de matemática com mais questões), português e história.
-- Os simulados de teste têm professor_id nulo: em /simulados só aparecem para admins.
-- A senha das contas é a combinada com o Peter (aqui só o hash bcrypt).
begin;

-- 1. Limpa o que já existia (mesmo conteúdo do script de apagar)
delete from simulados
 where escola_id = '00000000-0000-0000-0000-000000000001' and titulo like '[TESTE DESEMPENHO]%';
delete from alunos_contas
 where escola_id = '00000000-0000-0000-0000-000000000001' and lower(usuario) like 'teste.desempenho.%';
delete from turmas
 where escola_id = '00000000-0000-0000-0000-000000000001' and nome = 'TESTE DESEMPENHO';

-- 2. Turma, alunos da planilha e contas
create temp table _pessoa on commit drop as
select * from (values
    (1, 'teste.desempenho.ana',   'Ana Teste',   gen_random_uuid(), gen_random_uuid()),
    (2, 'teste.desempenho.bruno', 'Bruno Teste', gen_random_uuid(), gen_random_uuid()),
    (3, 'teste.desempenho.carla', 'Carla Teste', gen_random_uuid(), gen_random_uuid())
) as t(n, usuario, nome, conta_id, aluno_id);

create temp table _turma on commit drop as select gen_random_uuid() as id;

insert into turmas (id, nome, bimestre, ano_letivo, escola_id, bimestre_vigente)
select id, 'TESTE DESEMPENHO', '2º Bimestre', '2026', '00000000-0000-0000-0000-000000000001', true from _turma;

insert into alunos (id, turma_id, numero, nome, ordem)
select p.aluno_id, t.id, p.n, p.nome, p.n from _pessoa p cross join _turma t;

insert into alunos_contas (id, escola_id, nome, usuario, senha_hash, senha_provisoria, email_verificado, ativo, criado_via)
select conta_id, '00000000-0000-0000-0000-000000000001', nome, usuario,
       '$2b$10$vYvhmblRK2k/frUAN9LCOeeLkniarLMPhu37/dRe94ia0IVuFYuJG', false, false, true, 'escola'
  from _pessoa;

insert into aluno_turmas (conta_id, escola_id, turma_nome, ano_letivo, aluno_id)
select conta_id, '00000000-0000-0000-0000-000000000001', 'TESTE DESEMPENHO', '2026', aluno_id from _pessoa;

-- 3. Questões: pools determinísticos (order by id)
--    t = assunto-alvo de matemática; m = outras de matemática; p = português; h = história
create temp table _sel on commit drop as
with base as (
    select q.id, q.materia, q.assunto_id, q.area, q.resposta::text as resposta,
           (select array_agg(e->>'letra' order by e->>'letra') from jsonb_array_elements(q.alternativas) e) as letras
      from questoes q
     where q.status = 'publicada' and q.anulada = false and q.assunto_id is not null
       and q.resposta is not null and q.escopo = 'geral'
       and jsonb_typeof(q.alternativas) = 'array'
), boa as (
    select * from base
     where cardinality(letras) >= 2 and resposta = any (letras)
       and letras <@ array['A','B','C','D','E']::text[] and array_position(letras, null) is null
), alvo as (
    select assunto_id from boa where materia = 'matematica'
     group by assunto_id having count(*) >= 8
     order by count(*) desc, assunto_id limit 1
)
select 't'::text as kind, (row_number() over (order by id))::int as k, id, area, resposta, letras
  from boa where assunto_id = (select assunto_id from alvo)
union all
select 'm', (row_number() over (order by id))::int, id, area, resposta, letras
  from boa where materia = 'matematica' and assunto_id <> (select assunto_id from alvo)
union all
select 'p', (row_number() over (order by id))::int, id, area, resposta, letras
  from boa where materia = 'portugues'
union all
select 'h', (row_number() over (order by id))::int, id, area, resposta, letras
  from boa where materia = 'historia';

-- 4. Simulados: 4 provas, 10 questões cada; o 4 repete p1 e h1 do 1.
--    Início a 20, 15, 10 e 5 dias atrás, aberto por 2 dias (o 4 fecha há 3 dias).
create temp table _sim on commit drop as
select n, gen_random_uuid() as id,
       date_trunc('day', now()) - ((25 - 5 * n) * interval '1 day') + interval '8 hours' as abre_em
  from generate_series(1, 4) as n;

create temp table _slot (sim int, pos int, kind text, k int) on commit drop;
insert into _slot values
 (1,1,'t',1),(1,2,'t',2),(1,3,'m',1),(1,4,'m',2),(1,5,'p',1),(1,6,'p',2),(1,7,'p',3),(1,8,'h',1),(1,9,'h',2),(1,10,'h',3),
 (2,1,'t',3),(2,2,'t',4),(2,3,'m',3),(2,4,'m',4),(2,5,'p',4),(2,6,'p',5),(2,7,'p',6),(2,8,'h',4),(2,9,'h',5),(2,10,'h',6),
 (3,1,'t',5),(3,2,'t',6),(3,3,'m',5),(3,4,'m',6),(3,5,'p',7),(3,6,'p',8),(3,7,'p',9),(3,8,'h',7),(3,9,'h',8),(3,10,'h',9),
 (4,1,'t',7),(4,2,'t',8),(4,3,'m',7),(4,4,'m',8),(4,5,'p',10),(4,6,'p',11),(4,7,'h',10),(4,8,'h',11),(4,9,'p',1),(4,10,'h',1);

create temp table _simq on commit drop as
select s.sim, s.pos, s.kind, l.id as questao_id, l.area, l.resposta, l.letras
  from _slot s join _sel l on l.kind = s.kind and l.k = s.k;

-- Se faltarem questões no banco, desfaz tudo em vez de criar prova incompleta
do $$
begin
    if (select count(*) from _simq) <> 40 or exists (select 1 from _simq group by sim having count(*) <> 10) then
        raise exception 'Faltam questões publicadas com assunto no banco geral para montar os 4 simulados de teste.';
    end if;
end $$;

insert into simulados (id, escola_id, tipo, titulo, duracao_min, abre_em, fecha_em, correcao, embaralhar, status)
select id, '00000000-0000-0000-0000-000000000001', 'professor', '[TESTE DESEMPENHO] Simulado ' || n, 60,
       abre_em, abre_em + interval '2 days', 'na_hora', true, 'publicado'
  from _sim;

insert into simulado_turmas (simulado_id, escola_id, turma_nome, ano_letivo)
select id, '00000000-0000-0000-0000-000000000001', 'TESTE DESEMPENHO', '2026' from _sim;

insert into simulado_questoes (simulado_id, questao_id, ordem)
select s.id, q.questao_id, q.pos from _simq q join _sim s on s.n = q.sim;

-- 5. Respostas: c = certa, e = errada (próxima letra), b = em branco
create temp table _resp on commit drop as
select p.n as pessoa, p.usuario, q.sim, q.pos, q.questao_id, q.area,
       case c.cod when 'c' then q.resposta
                  when 'e' then q.letras[(array_position(q.letras, q.resposta) % cardinality(q.letras)) + 1]
                  else null end as alternativa,
       (c.cod = 'c') as correta
  from _pessoa p
  join _simq q on (p.n <> 3 or q.sim <= 2)            -- Carla: só simulados 1 e 2
  cross join lateral (select case
        when p.n = 1 and q.kind = 't' then (case when q.sim < 4 then 'e' else 'c' end)
        when p.n = 1 and ((q.sim = 1 and q.pos = 7) or (q.sim = 2 and q.pos = 10)) then 'b'
        when p.n = 1 and ((q.sim in (1, 2) and q.pos % 3 = 0) or (q.sim = 3 and q.pos % 4 = 0) or (q.sim = 4 and q.pos = 4)) then 'e'
        when p.n = 2 and (q.sim * 7 + q.pos) % 9 = 0 then 'e'
        when p.n = 3 and (q.pos + q.sim) % 3 = 0 then 'e'
        else 'c' end as cod) c;

-- 6. Tentativas entregues (início 3h depois da abertura, deslocado por aluno; tempo usado por aluno)
create temp table _tent on commit drop as
select gen_random_uuid() as id, p.usuario, p.conta_id, p.n as pessoa, s.n as sim, s.id as simulado_id,
       s.abre_em + interval '3 hours' + (p.n - 1) * interval '1 hour' as iniciada_em,
       (case p.n when 1 then 3300 when 2 then 2400 else 2700 end) as usado
  from _pessoa p join _sim s on (p.n <> 3 or s.n <= 2);

insert into tentativas (id, simulado_id, conta_id, ordem, iniciada_em, prazo_em, tempo_usado_seg, ultimo_pulso_em,
                        entregue_em, status, acertos, total, porcentagem, por_area)
select t.id, t.simulado_id, t.conta_id,
       (select array_agg(r.questao_id order by r.pos) from _resp r where r.pessoa = t.pessoa and r.sim = t.sim),
       t.iniciada_em, t.iniciada_em + interval '60 minutes', t.usado,
       t.iniciada_em + t.usado * interval '1 second', t.iniciada_em + t.usado * interval '1 second', 'entregue',
       a.acertos, a.total, round(100.0 * a.acertos / a.total, 2),
       (select jsonb_object_agg(x.area, jsonb_build_object('acertos', x.acertos, 'total', x.total))
          from (select r.area, count(*) filter (where r.correta)::int as acertos, count(*)::int as total
                  from _resp r where r.pessoa = t.pessoa and r.sim = t.sim group by r.area) x)
  from _tent t
  cross join lateral (select count(*) filter (where r.correta)::int as acertos, count(*)::int as total
                        from _resp r where r.pessoa = t.pessoa and r.sim = t.sim) a;

insert into tentativa_respostas (tentativa_id, questao_id, alternativa, respondida_em, correta)
select t.id, r.questao_id, r.alternativa, t.iniciada_em + r.pos * interval '3 minutes', r.correta
  from _resp r join _tent t on t.pessoa = r.pessoa and t.sim = r.sim;

commit;
