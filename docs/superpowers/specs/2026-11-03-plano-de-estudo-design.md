# Recomendações e plano de estudo (projeto 3 de 4)

Data: 2026-11-03. O Peter pediu para fazer sem perguntas ("pode fazer"), então as decisões abaixo são minhas.

## Por quê

O pedido original do acompanhamento da aprendizagem tem seis partes. Duas já estão no ar:

- **Projeto 1:** o painel "Meu desempenho".
- **Projeto 2:** a classificação fina (tópicos, habilidades, pré-requisitos, materiais).

Este projeto cobre as seções 4 e 5 do pedido:

- **Recomendações de estudo:**
  - regras configuráveis que transformam resultados em orientações;
  - "Precisamos de mais respostas" com questões de diagnóstico;
  - revisão e prática quando há erros recorrentes;
  - questões escolhidas pela habilidade, pelo conteúdo e pela dificuldade, considerando pré-requisitos e sem
    repetir de imediato.
- **Plano de estudo individual:**
  - uma sequência com o conteúdo a revisar, o material, as questões para praticar, o tempo estimado, a revisão
    posterior e o progresso;
  - o aluno informa quanto tempo tem;
  - o plano se atualiza quando ele estuda e responde;
  - a falta de material ou de questões aparece com clareza.

**Fora daqui:** a IA (projeto 4) e o "guia de estudos da própria plataforma", que o Peter deixou para depois.
Este plano usa só materiais e questões da própria plataforma e serve de base para esse guia.

## Como está hoje (levantado em 2026-11-03)

- **Prioridades do painel:** saem de `prioridades()` em `src/lib/desempenho/calculos.ts`, com as regras fixas
  em `src/lib/desempenho/regras.ts`:
  - **revisar:** 5 ou mais questões e 60% ou mais de erro;
  - **mais respostas:** de 1 a 4 questões com algum erro.
  - Cada cartão mostra um texto, as aulas cujo título cita o assunto (`aulasDoTema`) e o botão
    "Treinar este assunto", que sorteia 10 questões do assunto.
- **Conteúdo:** no painel, conteúdo é o **assunto** da questão. Sem assunto, a questão vai para o grupo da
  matéria (`chaveConteudo`: o id do assunto ou `materia:<m>`).
- **Desempenho inicial:** é a primeira resposta do aluno a cada questão (`primeirasRespostas`).
- **Classificação fina:** o banco tem `topicos` (268), `habilidades`, `questao_habilidades`,
  `topico_prerequisitos` (0) e `materiais_revisao` (0). Só 5 questões têm tópico.
  - Cada material é de um tópico ou de um assunto, e é uma aula da plataforma ou um link.
  - Só o dono cria materiais, em `/banco/assuntos` → Classificação.
- **Treinos do aluno:** `criarTreino` em `src/actions/simulados-aluno.ts` grava um `simulados` com
  `tipo = 'treino'` e `conta_id`. As questões são sorteadas, e as que estão em provas sob sigilo ficam de fora
  (`questoesDeProvasEmSigilo`).
- **Dificuldade:** a tabela `questoes` **não tem** coluna de dificuldade. Ela só existe no lote de geração
  (`geracoes_ia.dificuldade`, ligado pela coluna `questoes.geracao_id`).
- **Aulas:** o progresso fica em `aula_progresso`. A aula é concluída com 90% assistido (`concluida_em`).
- **Configurações da escola:** `/configuracoes` já tem cartões só para admin, como a média de aprovação
  (`escolas.media_aprovacao`, com valor padrão quando a coluna não existe).

## Decisões principais (minhas)

1. **A unidade continua sendo o conteúdo do painel**, ou seja, o assunto (ou a matéria, sem assunto). As
   regras de prioridade precisam de 5 questões, e quase nada tem tópico. O tópico entra como **foco**:
   - **Escolha do foco:** é o tópico com mais erros entre as primeiras respostas do conteúdo, com pelo menos
     2 erros. No empate, vence a maior taxa de erro e depois o nome.
   - **Onde o foco aparece:** no texto ("4 delas sobre Derivação parassintética"), na escolha das questões e
     nos materiais.
2. **Desempenho inicial × depois do estudo:**
   - **Treinos do plano** são os de prática e de revisão posterior. As respostas deles **não entram** nos
     totais, nos conteúdos nem nas prioridades do painel, que continuam sendo o desempenho inicial.
   - **Onde elas aparecem:** como "depois do estudo", no plano e no detalhe do conteúdo, e também na evolução,
     que mostra todas as atividades.
   - **Diagnóstico:** conta como desempenho inicial, porque serve justamente para medir.
   - **Treinos de antes:** os treinos avulsos, como "Treinar este assunto" e o "Novo treino", continuam
     contando como hoje.
3. **O plano é derivado, não montado à mão.** A cada abertura da página, ele é recalculado com:
   - as prioridades atuais;
   - os treinos do plano e os resultados deles;
   - as marcas de "Já revisei";
   - o tempo por semana informado.

   O banco guarda só esses três últimos. Assim o plano se atualiza sozinho quando o aluno estuda e responde.
4. **Regras configuráveis por escola** em `escolas.regras_aprendizagem` (jsonb). O admin edita num cartão novo
   em `/configuracoes`. Sem valor gravado, ou sem a coluna, valem os padrões. O painel do projeto 1 passa a
   usar essas regras da escola.
5. **Dificuldade calculada pelo uso.** É a taxa de acerto de todas as respostas corrigidas à questão, de
   qualquer aluno e escola, quando houver pelo menos 5. Sem isso, vale a dificuldade do lote de geração, se a
   questão veio do gerador. Sem as duas, a dificuldade é desconhecida e a questão fica no meio da fila. Nenhuma
   coluna nova em `questoes`.

## Regras (padrões e limites)

Ficam num arquivo, `src/lib/plano/regras.ts`, e podem ser sobrescritas pela escola. Um valor fora dos limites
volta ao padrão.

| Regra | Padrão | Limites | Para quê |
|---|---|---|---|
| `minQuestoesPrioridade` | 5 | 2–30 | questões distintas para "Revisão prioritária" |
| `taxaErroPrioridade` | 60 | 30–95 | % de erro para "Revisão prioritária" |
| `questoesPratica` | 5 | 3–15 | tamanho da sequência de prática |
| `questoesDiagnostico` | 5 | 3–15 | tamanho do diagnóstico |
| `questoesRevisao` | 3 | 2–10 | tamanho da revisão posterior |
| `diasRevisao` | 7 | 1–60 | dias depois da prática para liberar a revisão posterior |
| `metaAcerto` | 60 | 30–100 | % de acerto que conclui a prática ou a revisão |
| `diasSemRepetir` | 30 | 0–365 | uma questão vista há menos que isso não volta |
| `minutosPorQuestao` | 3 | 1–10 | tempo estimado por questão |
| `minutosMaterial` | 15 | 5–120 | tempo estimado de um material sem duração conhecida |

`maxConteudosGrafico` (8) continua fixo no projeto 1, porque é só de exibição.

## Textos das recomendações

As funções puras ficam em `src/lib/plano/textos.ts`. Os textos são sempre sugestões, nunca diagnósticos.

- **Revisar, sem foco:** "Você errou 7 de 10 questões de Porcentagem. Revise esse conteúdo e depois resolva uma
  sequência de 5 questões, começando pelas mais simples."
- **Revisar, com foco:** "Você errou 7 de 10 questões de Morfologia, 4 delas sobre Derivação parassintética.
  Revise esse tópico e depois resolva uma sequência de 5 questões, começando pelas mais simples."
- **Mais respostas:** "Você respondeu só 3 questões de Porcentagem e errou 2. Precisamos de mais respostas:
  resolva 5 questões de diagnóstico para entender melhor."
- **Critério, em letra menor abaixo do texto, com os números da escola:** "Sugestão pelo critério: 5 ou mais
  questões e 60% ou mais de erro. Um resultado isolado não comprova uma dificuldade."

Singular e plural seguem o padrão do projeto 1 ("1 questão", "2 questões").

## Escolha das questões (função pura, testada)

A função fica em `src/lib/plano/selecao.ts`.

Ela recebe:

- as candidatas, cada uma com `id`, `topicoId`, `habilidadeIds`, `facilidade` (0–100 ou nula) e `ultimaVez`
  (quando o aluno a viu pela última vez, ou nulo);
- a quantidade;
- o tópico de foco;
- as habilidades-alvo, que são as das questões que o aluno errou no conteúdo na primeira resposta;
- a data de agora;
- `diasSemRepetir`;
- um sorteio injetável, para os testes.

**Candidatas:**

- **Filtro:** questões publicadas, não anuladas, visíveis à escola (banco geral + escola) e fora das provas sob
  sigilo.
- **Do conteúdo:** do assunto, ou da matéria quando o conteúdo é `materia:<m>`, como em `TreinarAssunto`.
- **Lidas no servidor:** o tópico e as habilidades de cada candidata. A facilidade só é calculada para as
  questões já escolhidas no passo 3 (no máximo 15), para não ler respostas demais.

**Ordem da escolha:**

1. **Exclusão:** saem as questões que o aluno viu há menos de `diasSemRepetir` dias. "Ver" é estar na `ordem`
   de qualquer tentativa dele, entregue ou não.
2. **Grupos:**
   - primeiro as **nunca vistas**;
   - depois as vistas há mais tempo, da mais antiga para a mais recente.
   - **Dentro de cada grupo, pela relevância:** (0) do tópico de foco e com habilidade-alvo; (1) do tópico de
     foco; (2) com habilidade-alvo; (3) as demais do conteúdo. Dentro da mesma relevância, a ordem é sorteada.
3. **Quantidade:** pega as `quantidade` primeiras.
4. **Ordem final:** as escolhidas são ordenadas da mais fácil para a mais difícil. A desconhecida conta como 50.
   No empate, mantém a ordem da escolha.
5. **Saída:** `{ ids, faltaram, repetidas }`. `faltaram` é quanto faltou para a quantidade. `repetidas` é
   quantas já tinham sido vistas antes.

**Pré-requisitos:** são ligados entre tópicos. Para o tópico de foco (ou, sem foco, para os tópicos das
questões erradas do conteúdo), o plano lê os pré-requisitos. Eles servem para duas coisas:

- **Ordem do plano:** se o conteúdo de um pré-requisito também está no plano, ele vem antes.
- **Aviso no cartão:** "Antes, é bom saber: *Frações* (Aritmética)".

## Etapas do plano (máquina de estados derivada, função pura)

O plano fica em `src/lib/plano/plano.ts`.

**Quem entra no plano:**

- todos os conteúdos que hoje são prioridade;
- os conteúdos que já têm treino do plano, como histórico.

**Conteúdo do tipo "revisar".** Uma **rodada** tem três etapas:

1. **Revisar o conteúdo:**
   - **Concluída quando:** o aluno clica em "Já revisei" ou conclui uma aula do material.
   - **Na segunda rodada:** só vale a marca ou a aula concluída depois da última prática.
   - **Tempo:** a duração da aula principal (o maior `aula_progresso.duracao_seg` conhecido daquela aula,
     arredondado para cima de 5 em 5 min) ou `minutosMaterial`.
2. **Praticar:** uma sequência de `questoesPratica` questões, começando pelas mais simples.
   - **Concluída quando:** o treino de prática dessa rodada é entregue.
   - **Resultado:**
     - acerto ≥ `metaAcerto`: libera a etapa 3;
     - abaixo da meta: começa uma **nova rodada**, com o aviso "Vamos de novo: revise e pratique com questões
       novas".
   - **Tempo:** `questoesPratica × minutosPorQuestao`.
3. **Revisão posterior:** `questoesRevisao` questões novas, liberadas `diasRevisao` dias depois da entrega da
   prática.
   - **Antes da data:** mostra "Disponível a partir de 12/11".
   - **Resultado:**
     - acerto ≥ meta: o conteúdo fica **concluído**;
     - abaixo da meta: nova rodada.

O aluno pode pular a ordem. O botão de praticar fica sempre disponível, e a etapa 1 é só sugerida.

**Conteúdo do tipo "mais respostas":** tem uma etapa só, **Diagnóstico**, com `questoesDiagnostico` questões.

- **Depois de entregue:** as respostas entram no desempenho inicial, e o conteúdo é reavaliado na próxima
  abertura. Ele pode virar "revisar", sair das prioridades ou continuar pedindo mais respostas. Nesse último
  caso, aparece um novo diagnóstico.
- **Histórico:** os diagnósticos já feitos aparecem como "1 diagnóstico feito".

**Concluídos:** conteúdos cuja última revisão posterior atingiu a meta. Eles vão para a seção "Concluídos" com
o antes e o depois:

- **Antes:** "7 erros em 10 questões".
- **Depois do estudo:** "acertou 4 de 5 na prática e 3 de 3 na revisão".
- **Estudar de novo:** o botão começa uma nova rodada.
- **Se o conteúdo continuar prioridade no desempenho inicial:** o selo "Revisado" aparece no cartão do painel,
  e o conteúdo não volta sozinho para "Para esta semana".

**Treino aberto:** se já existe um treino do plano criado e não entregue para aquela etapa, o botão vira
"Continuar treino" e leva a ele.

**Ordem dos conteúdos:**

1. revisões posteriores já liberadas;
2. rodadas em andamento (com alguma etapa feita);
3. "revisar", na ordem do painel (`porErro`), com os pré-requisitos antes;
4. diagnósticos;
5. concluídos, em seção própria.

**Tempo por semana:** o aluno escolhe entre 30 min, 1 h, 2 h, 3 h, 5 h e 8 h. Antes de escolher, o padrão é
2 h, e um aviso pede a escolha.

- **"Para esta semana":** percorre os conteúdos na ordem e soma as próximas etapas **disponíveis agora** de cada
  um até o limite, sempre com pelo menos uma.
- **Depois:** os demais conteúdos, e as etapas com data futura, entram em "Depois".

**Progresso:**

- **Por conteúdo:** "1 de 3 etapas".
- **Geral:** etapas feitas ÷ etapas da rodada atual de todos os conteúdos, em %. Os concluídos entram com
  todas as etapas feitas, para a porcentagem não cair quando um conteúdo termina.
- **Diagnóstico:** conta como 1 etapa.

## Falta de material ou de questões

- **Materiais do conteúdo, na visão do aluno:**
  - os `materiais_revisao` do tópico de foco e do assunto, da escola do aluno ou de todas as escolas;
  - a aula só aparece se o aluno tiver acesso a ela (curso dele, aula publicada);
  - mais as aulas cujo título cita o assunto (`aulasDoTema`, como hoje), sem repetir aula.
- **Resoluções:** se alguma questão errada do conteúdo tiver resolução, entra também o item "Releia as
  resoluções das 3 questões que você errou", com link para o detalhe do conteúdo no painel.
- **Sem nenhum material:** "Ainda não há material de revisão para *Porcentagem*." Se também não houver
  resolução, acrescenta "Peça ao seu professor uma indicação".
- **Questões:** ao abrir a página, o plano conta as candidatas de cada conteúdo, já tirando as vistas há pouco
  e as que estão sob sigilo.
  - **Menos que o pedido:** "Só há 3 questões novas de *Porcentagem* agora; a sequência terá 3."
  - **Zero:** o botão some e aparece "Não há questões novas de *Porcentagem* no banco agora."
  - **No clique:** a ação devolve a mesma mensagem, se a situação mudar entre abrir a página e clicar.

## Banco de dados (SQL que o Peter cola)

O arquivo é `db/2026-11-03-plano-estudo.sql`, e o mesmo bloco vai no fim de `db/schema.sql`. Ele só
acrescenta, pode rodar de novo sem erro e não mexe nos registros atuais.

```sql
alter table escolas add column if not exists regras_aprendizagem jsonb;

alter table simulados add column if not exists plano_conteudo text;
alter table simulados add column if not exists plano_etapa varchar(11)
    check (plano_etapa in ('diagnostico', 'pratica', 'revisao'));
alter table simulados add column if not exists plano_rodada integer;
-- os três juntos, e só em treino
alter table simulados drop constraint if exists simulados_plano_check;
alter table simulados add constraint simulados_plano_check check (
    (plano_etapa is null and plano_conteudo is null and plano_rodada is null)
    or (plano_etapa is not null and plano_conteudo is not null and plano_rodada >= 1 and tipo = 'treino')
);
-- dois cliques ao mesmo tempo não criam dois treinos da mesma etapa
create unique index if not exists uq_simulados_plano
    on simulados (conta_id, plano_conteudo, plano_etapa, plano_rodada) where plano_etapa is not null;

create table if not exists planos_estudo (
    conta_id uuid primary key references alunos_contas(id) on delete cascade,
    escola_id uuid not null references escolas(id),
    minutos_semana integer not null check (minutos_semana between 15 and 1200),
    updated_at timestamptz not null default now()
);

create table if not exists plano_revisoes (
    conta_id uuid not null references alunos_contas(id) on delete cascade,
    conteudo text not null,
    revisado_em timestamptz not null default now(),
    primary key (conta_id, conteudo)
);
```

Mais o RLS e as políticas `acesso_total_*`, no mesmo padrão das tabelas atuais, e `NOTIFY pgrst, 'reload schema'`.

- **Rodada:** quantos treinos do plano já existem para (conta, conteúdo, etapa), mais 1. A rodada só é criada
  quando não há treino aberto daquela etapa.
- **Dois cliques:** se a gravação esbarrar no índice único, a ação lê o treino que a outra chamada criou e
  devolve esse.
- **"Já revisei":** um upsert que troca `revisado_em` por agora.

**Ordem da publicação:** o SQL precisa estar colado e conferido por uma consulta de leitura antes do push. O
painel do projeto 1 passa a ler `simulados.plano_etapa`. A leitura das regras da escola cai no padrão quando a
coluna não existe, como `mediaAprovacaoDaEscola`.

## Telas

O visual segue o padrão `status-visual-aluno`:

- cabeçalho em cartão com ícone dourado e `PainelResumo`;
- cartões brancos com bloco azul e `cartao-interativo`;
- etiquetas coloridas e nada de texto cinza;
- largura total, uma coluna no celular.

### 1. Página nova `/aluno/plano` ("Plano de estudo")

- **Menu do aluno:** item "Plano", entre "Desempenho" e a conta, com ícone de rota (`Route`, lucide) e uma cor
  nova do menu.
- **Arquivos:** `page.tsx`, `loading.tsx` e `error.tsx`.

A página mostra, nesta ordem:

1. **Cabeçalho:** "Plano de estudo", com a descrição "Montado a partir do seu desempenho. Ele se atualiza quando
   você estuda e responde questões."
2. **Painel de números:**
   - Progresso: 33%, "3 de 9 etapas".
   - Conteúdos no plano.
   - Tempo desta semana: "≈ 1 h 45".
   - Concluídos.
3. **Cartão "Quanto tempo você tem por semana?":** botões de escolha (30 min … 8 h). Ao tocar, grava na hora e
   a página atualiza.
4. **"Para esta semana":** um cartão por conteúdo, com:
   - **Identificação:** matéria, nome e etiqueta ("Revisão prioritária", "Precisamos de mais respostas",
     "Revisão posterior liberada", "Rodada 2").
   - **Texto:** a recomendação e o critério em letra menor.
   - **Contexto:** o pré-requisito ("Antes, é bom saber…") e até 3 habilidades-alvo (código + descrição curta).
   - **Etapas numeradas:**
     - cada uma com estado (feita ✓ / agora / disponível em dd/mm), tempo estimado e ação;
     - o material com link para a aula ou para o link externo, e o botão "Já revisei";
     - os botões "Praticar 5 questões" / "Continuar treino" / "Fazer diagnóstico" / "Fazer revisão".
   - **Progresso do conteúdo:** "1 de 3 etapas".
   - **Faltas:** os avisos de material ou de questões, quando houver.
5. **"Depois":** os demais conteúdos, mais compactos e com as mesmas ações.
6. **"Concluídos":** antes e depois do estudo, com "Estudar de novo".

**Estados da página:**

- **Sem histórico:** "Entregue um simulado ou treino para montarmos seu plano", com botão para os simulados.
- **Sem prioridades:** "Nenhum conteúdo pede revisão agora. Continue praticando", com o mesmo botão.
- **Erro:** "Tentar de novo", no `error.tsx`.

### 2. Painel "Meu desempenho" (aluno e escola)

- **Cartões de prioridade:** passam a usar o texto novo, o critério, os materiais (como no plano) e o selo do
  plano ("No plano: 1 de 3 etapas", "Revisado ✓").
- **Ações do aluno:** "Praticar 5 questões" ou "Fazer diagnóstico" (as mesmas do plano) e o link "Ver no plano".
  Essas ações substituem o "Treinar este assunto" nos cartões e no detalhe do conteúdo.
- **Na escola:** os mesmos textos, materiais (sem link de aula, como hoje) e selo, sem botões.
- **`TreinarAssunto`:** continua no resultado do simulado (`ResultadoAluno`).
- **Detalhe do conteúdo:**
  - **"Depois do estudo":** acertos nos treinos do plano daquele conteúdo, quando houver.
  - **"Tópicos deste conteúdo":** a legenda do projeto 1 por tópico, só quando alguma questão tiver tópico.
- **Frase no cabeçalho do painel:** "Os números mostram o desempenho inicial; os treinos do plano aparecem na
  evolução e no plano de estudo."
- **Painel da escola:** lê as regras da escola do aluno e o estado do plano daquela conta (só leitura), com o
  mesmo acesso de hoje (`exigirTurmaDaEscola` + `podeVerGrupo`).

### 3. Cartão "Recomendações de estudo" em `/configuracoes` (só admin)

- **Campos:** os 10 números da tabela de regras, com os limites e o texto de ajuda de cada um, mais o botão
  "Voltar ao padrão".
- **Gravação:** uma server action que exige admin e valida com zod nos limites. O erro volta como
  `{ ok:false, erro }`, sem lançar, como as outras ações.

## Ações (server actions, em `src/actions/plano-estudo.ts`)

As três ações tiram a conta da sessão (`getAlunoAtual`), nunca de um parâmetro.

- **`criarTreinoDoPlano({ conteudo, etapa })`**
  - **Validação:** a chave precisa ser um uuid de assunto existente ou `materia:<m>` com `ehMateria`. A etapa
    precisa caber no estado atual (por exemplo, revisão só depois da data).
  - **Montagem:** reaproveita a escolha de questões e grava `simulados` (`tipo = 'treino'`, `correcao = 'na_hora'`,
    `embaralhar = false`, sem tempo) com os três campos do plano.
  - **Títulos:** "Prática: Porcentagem", "Diagnóstico: Porcentagem" e "Revisão: Porcentagem".
  - **Saída:** inicia a tentativa (`iniciarTentativa`) e devolve o `simuladoId`, e o cliente navega para o treino.
- **`marcarRevisado({ conteudo })`:** faz o upsert em `plano_revisoes`.
- **`salvarTempoSemana({ minutos })`:** só aceita os valores da lista e faz o upsert em `planos_estudo`.

## O que não muda

- Simulados do professor, correção, sigilo, o "Novo treino" e o "Treinar este assunto" do resultado.
- A seção da turma no relatório, que só usa os simulados do professor.
- O MCP e a Hermes. Ferramentas de plano para a Hermes ficam para depois.

**Fora do escopo:**

- IA (projeto 4);
- guia de estudos da plataforma;
- materiais da escola criados por professor;
- relatório "conteúdos sem material" para o dono;
- avisos por e-mail ou Telegram;
- várias tentativas da mesma prova.

## Testes e validação

- **Testes das funções puras:**
  - **regras:** normalizar, limites e padrão quando o valor é inválido;
  - **textos:** com foco e sem foco, singular e plural, critério com os números da escola;
  - **foco:** empate e mínimo de 2 erros;
  - **escolha das questões:**
    - exclusão das vistas há pouco;
    - novas antes das antigas;
    - relevância;
    - mais fácil primeiro e desconhecida no meio;
    - `faltaram`;
    - sorteio injetado;
  - **máquina de estados:**
    - cada etapa;
    - nova rodada abaixo da meta;
    - revisão antes e depois da data;
    - "Já revisei" velho na segunda rodada;
    - treino aberto;
    - concluído;
    - diagnóstico;
  - **ordem:** pré-requisito antes, revisão liberada primeiro;
  - **orçamento de tempo:** pelo menos uma etapa, corte no limite, etapas futuras em "Depois";
  - **painel inicial:** os treinos de prática e revisão ficam fora dos totais e dentro da evolução.
- **Testes das ações:**
  - chave inválida;
  - treino aberto reaproveitado;
  - colisão no índice único devolvendo o treino existente;
  - tempo fora da lista;
  - ação de regras sem admin.
- **SQL:** testado no PGlite (`scratchpad/pgtest`, como no projeto 2) antes de mandar ao Peter.
- **Comandos:** `npm test`, `npm run lint` e `npm run build`.
- **Prints em 1340px e 390px:** `/aluno/plano` com os dados de teste, e o painel com os cartões novos.
- **Depois de publicar:** conferir no www com a conta `teste.desempenho.ana`:
  - abrir o plano;
  - escolher o tempo;
  - criar uma prática, entregar e ver a etapa avançar.
