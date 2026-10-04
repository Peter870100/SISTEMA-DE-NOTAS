# Simulados: do professor e treinos do aluno

Data: 2026-10-04 · Status: desenho aprovado no brainstorming, aguardando revisão da spec

## Objetivo

Parte 4 do roteiro (`docs/superpowers/specs/2026-10-03-contas-aluno-multiescola-design.md`).
O aluno faz simulados online com cronômetro, usando as questões **publicadas** do banco
(Parte 3). Dois tipos:

- **Simulado do professor**: montado por sorteio + ajuste manual, para turmas, com janela
  de data e duração; uma tentativa por aluno; resultado da turma para o professor.
- **Treino do aluno**: o aluno sorteia por filtros quando quiser; tempo opcional e pausável;
  correção na hora; resultado só dele.

A resposta certa nunca vai ao navegador antes de a correção estar liberada.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Montagem (professor) | **Sorteio por filtros + trocar/remover/adicionar do banco** antes de publicar |
| Montagem (treino) | Só sorteio por filtros (máx. 90 questões) |
| Cronômetro | Professor: **tempo sempre corre** (fechar a página não pausa). Treino: **pausa** quando sai da página; pode ser sem tempo |
| Correção (professor) | Professor escolhe por simulado: **na hora** ou **depois do prazo** (padrão); botão "Liberar correção agora" |
| Correção (treino) | Sempre na hora |
| Respostas | **Gravadas no servidor a cada marcação**; fila local no navegador reenvia se a internet cair |
| Relógio | **Do servidor**: `prazo_em` gravado no início; respostas fora do prazo (+30 s de tolerância) recusadas |
| Entrega automática | Preguiçosa: tentativas vencidas são entregues quando alguém abre o simulado/resultado (sem cron) |
| Ordem | Professor: **embaralhada por aluno** (padrão, desligável), estável para o mesmo aluno; alternativas na ordem original |
| Tentativas | Uma por aluno por simulado (cada treino é um simulado próprio) |
| Anulada | Conta como **certa para todos** |
| Nota | Acertos e % (geral e por área). TRI fica para depois |

## 1. Banco de dados

**Já aplicado em produção** (o Peter colou). Anexar ao fim de `db/schema.sql`.

```sql
-- ===== Simulados (2026-10-04) =====

create table if not exists simulados (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id),
    tipo varchar(9) not null check (tipo in ('professor', 'treino')),
    professor_id uuid references professores(id) on delete set null,
    conta_id uuid references alunos_contas(id) on delete cascade,
    titulo text not null,
    duracao_min integer check (duracao_min is null or (duracao_min between 1 and 600)),
    abre_em timestamptz,
    fecha_em timestamptz,
    correcao varchar(10) not null default 'apos_prazo' check (correcao in ('na_hora', 'apos_prazo')),
    embaralhar boolean not null default true,
    status varchar(10) not null default 'rascunho' check (status in ('rascunho', 'publicado')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((tipo = 'treino') = (conta_id is not null)),
    check (tipo = 'treino' or duracao_min is not null),
    check (abre_em is null or fecha_em is null or fecha_em > abre_em)
);
create index if not exists idx_simulados_escola on simulados (escola_id, tipo, status);
create index if not exists idx_simulados_conta on simulados (conta_id);

create table if not exists simulado_turmas (
    simulado_id uuid not null references simulados(id) on delete cascade,
    escola_id uuid not null references escolas(id),
    turma_nome text not null,
    ano_letivo varchar(10) not null,
    primary key (simulado_id, turma_nome, ano_letivo)
);
create index if not exists idx_simulado_turmas_turma on simulado_turmas (escola_id, turma_nome, ano_letivo);

create table if not exists simulado_questoes (
    simulado_id uuid not null references simulados(id) on delete cascade,
    questao_id uuid not null references questoes(id) on delete cascade,
    ordem integer not null default 0,
    primary key (simulado_id, questao_id)
);

create table if not exists tentativas (
    id uuid primary key default gen_random_uuid(),
    simulado_id uuid not null references simulados(id) on delete cascade,
    conta_id uuid not null references alunos_contas(id) on delete cascade,
    ordem uuid[] not null,
    iniciada_em timestamptz not null default now(),
    prazo_em timestamptz,
    tempo_usado_seg integer not null default 0,
    ultimo_pulso_em timestamptz,
    entregue_em timestamptz,
    status varchar(12) not null default 'em_andamento' check (status in ('em_andamento', 'entregue')),
    acertos integer,
    total integer,
    porcentagem numeric(5,2),
    por_area jsonb,
    created_at timestamptz not null default now(),
    unique (simulado_id, conta_id)
);
create index if not exists idx_tentativas_conta on tentativas (conta_id, status);

create table if not exists tentativa_respostas (
    tentativa_id uuid not null references tentativas(id) on delete cascade,
    questao_id uuid not null references questoes(id) on delete cascade,
    alternativa char(1) check (alternativa in ('A', 'B', 'C', 'D', 'E')),
    respondida_em timestamptz not null default now(),
    correta boolean,
    primary key (tentativa_id, questao_id)
);

alter table simulados enable row level security;
alter table simulado_turmas enable row level security;
alter table simulado_questoes enable row level security;
alter table tentativas enable row level security;
alter table tentativa_respostas enable row level security;
drop policy if exists "acesso_total_simulados" on simulados;
create policy "acesso_total_simulados" on simulados for all using (true) with check (true);
drop policy if exists "acesso_total_simulado_turmas" on simulado_turmas;
create policy "acesso_total_simulado_turmas" on simulado_turmas for all using (true) with check (true);
drop policy if exists "acesso_total_simulado_questoes" on simulado_questoes;
create policy "acesso_total_simulado_questoes" on simulado_questoes for all using (true) with check (true);
drop policy if exists "acesso_total_tentativas" on tentativas;
create policy "acesso_total_tentativas" on tentativas for all using (true) with check (true);
drop policy if exists "acesso_total_tentativa_respostas" on tentativa_respostas;
create policy "acesso_total_tentativa_respostas" on tentativa_respostas for all using (true) with check (true);
```

## 2. Regras de tempo e correção (funções puras, testadas)

Em `src/lib/simulados/regras.ts`:

- `prazoFinal(iniciadaEm, duracaoMin | null, fechaEm | null): Date | null` — `min(iniciada + duração, fecha_em)`;
  sem duração e sem fecha_em → null (sem prazo).
- `TOLERANCIA_SEG = 30`; `aceitaResposta(agora, prazoEm | null): boolean` — `prazo == null || agora ≤ prazo + 30 s`.
- Treino pausável: `PULSO_SEG = 15`, `acumularTempo(tempoUsado, ultimoPulso | null, agora): number` — soma
  `min(agora − ultimoPulso, 20)` s (lacunas maiores = página fechada, não contam). Esgotado quando
  `tempoUsado ≥ duração × 60`.
- `corrigir(respostas: Map<questaoId, letra | null>, gabarito: Map<questaoId, { resposta, anulada, area }>)` →
  `{ acertos, total, porcentagem, porArea: Record<area, { acertos, total }>, corretas: Map<questaoId, boolean> }`;
  anulada = certa; em branco = errada; porcentagem com 2 casas.
- `correcaoLiberada(simulado, agora): boolean` — treino ou `na_hora` → sim; `apos_prazo` → `agora ≥ fecha_em`
  (ou liberada manualmente: "Liberar correção agora" muda `correcao` para `na_hora`).
- `ordemEmbaralhada(questaoIds, semente)` — embaralhamento determinístico (semente = id da tentativa) para
  a ordem ser estável para o aluno.
- `sortear(candidatos, quantidade, excluir, aleatorio = Math.random)` — sem repetição.
- `situacaoSimulado(simulado, agora)`: `rascunho | agendado | aberto | encerrado`.

## 3. Professor

**Barra lateral:** item "Simulados" → `/simulados` (lista: título, turmas, janela, situação, entregues/total).

**`/simulados/novo` e `/simulados/[id]/editar`** (rascunho; publicado sem tentativas também):
1. Dados: título, turmas (turma·ano acessíveis ao professor), duração (min), abre em, fecha em,
   correção (padrão "depois do prazo"), embaralhar (padrão sim).
2. Questões: filtros (área, matéria, assunto, banca, ano, quantidade) + **Sortear** (só publicadas, do geral
   e da escola do professor, sem repetir as já escolhidas); lista com **Trocar** (sorteia outra do mesmo filtro),
   **Remover**, ver a questão, e **+ Adicionar do banco** (busca por texto/filtros).
3. **Publicar** (exige título, turma, ≥ 1 questão, janela válida). Com alguma tentativa iniciada, as
   questões ficam travadas.

**`/simulados/[id]`**: começaram/entregaram; tabela aluno × (acertos, %, por área, tempo); questões mais
erradas (% de acerto e alternativa mais marcada); **Liberar correção agora**. Abrir a página entrega as
tentativas vencidas.

## 4. Aluno

**`/aluno`:** cartão "Simulados" sem "Em breve" → `/aluno/simulados`, abas **Da turma** e **Meus treinos**.
Estados: Disponível (Começar), Em andamento (Continuar), Entregue (correção em…/ %), Encerrado.
**Novo treino**: área/matéria, banca, ano, quantidade (1–90), tempo (min) ou sem tempo.

**`/aluno/simulados/[id]`** (fazer): questão atual (enunciado, imagens, alternativas — sem resposta),
anterior/próxima, grade de números (respondidas destacadas), cronômetro (amarelo e aviso aos 5 min;
entrega automática no zero), indicador "salvo ✓/salvando…", Entregar com confirmação (conta as em branco).
Treino: "Pausar"; pulso a cada 15 s enquanto visível.

**Resultado:** acertos, %, por área; lista com resposta do aluno × certa (✓/✗) e "Ver questão". Com
correção depois do prazo: "Entregue! A correção sai em dd/mm às hh:mm" (sem nota nem gabarito).

**Componente da questão para o aluno:** recebe `{ id, enunciado, comando, alternativas, imagens }` — o tipo
**não tem** `resposta`; montado por uma função de servidor que nunca seleciona a coluna `resposta`.

## 5. Regras de acesso

- Aluno vê simulados do professor `publicado` ligados às suas turmas (escola + turma + ano) e os próprios
  treinos. Começar: dentro da janela, uma vez. Salvar resposta: tentativa dele, `em_andamento`, questão do
  simulado, `aceitaResposta` (ou tempo do treino não esgotado). Entregar: dele.
- Resposta certa: só no resultado e só com `correcaoLiberada`.
- Treino: só questões publicadas visíveis ao aluno (geral + escola dele).
- Professor: cria para turmas da escola que pode acessar; edita/acompanha os seus; admin/dono, todos da escola.
- Ações de professor com `exigirNaoAluno()`; ações de aluno com `getAlunoAtual()`. Hermes sem acesso.
- Funções que recebem ids sem checar acesso ficam fora de `"use server"`.

**Fora desta parte:** TRI, discursivas, PDF impresso, ranking, atividade-simulado dentro das aulas.

## 6. Testes

Unitários: `prazoFinal` (duração vs fecha_em, sem prazo), `aceitaResposta` (tolerância), `acumularTempo`
(pulsos normais, lacuna longa, primeiro pulso), `corrigir` (brancos, anuladas, por área, 0 questões),
`correcaoLiberada`, `ordemEmbaralhada` (estável, permutação), `sortear` (sem repetir, quantidade maior que o
disponível), `situacaoSimulado`.

Manual: professor monta e publica para turma de teste; aluno começa, responde metade, fecha, volta e continua;
tempo acaba e entrega sozinha; professor vê resultados e libera a correção; aluno vê o gabarito; treino com pausa.
