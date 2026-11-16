# Refazer as erradas

Data: 2026-11-16. É o passo que faltava no caminho que o Peter descreveu em 2026-11-08: o aluno erra no simulado, o plano
manda estudar, ele lê o texto e faz os 10 exercícios, e **volta às questões que errou**. Junto vai um ajuste nos treinos
livres, que hoje podem repetir questões já vistas.

## Por quê

O aluno erra, estuda e vai direto para a prática com questões novas, sem nunca voltar às que errou. O Peter quer que ele
volte a elas: uma chance só em cada uma; se errar de novo, vê a certa, e o assunto segue no plano até a revisão de 7 dias.

**Sucesso:** depois de estudar, o plano e a página do estudo levam o aluno às questões que ele errou naquele assunto. Ele
responde cada uma uma vez, vê a correção, e o plano continua com a prática e a revisão como hoje.

## O que o Peter decidiu

- **O refazer entra antes da prática, sem substituí-la** (escolha A, 2026-11-16). O plano fica:
  `Estudar → Refazer as erradas → Praticar → Revisão`.
  O resultado do refazer **não aprova nem reprova**: quem decide se o aluno aprendeu continua sendo a prática com questões
  novas e a revisão posterior. Motivo: no resultado do simulado o aluno já viu a letra certa, então acertar no refazer prova pouco.
- **Uma chance só** em cada questão. Errou de novo, vê a certa no resultado do treino e a questão não volta pelo refazer.
- **Só depois de estudar** (2026-11-16): o refazer libera quando o estudo do conteúdo está feito ("Já estudei" ou aula concluída,
  a mesma marca da etapa `revisar`). Na página do estudo, "Já estudei" e o refazer viram um botão só, que marca e abre o treino.
  Motivo: com uma chance só, refazer sem ter estudado desperdiça a chance.

## Decisões minhas (o Peter aprovou a lista em conversa; ficam aqui para conferir)

- **Quais questões:** as erradas ou em branco entre as primeiras respostas **iniciais** do aluno naquele conteúdo, a mesma
  base que já faz o conteúdo entrar no plano (`erradasDe` em `carregarPlano`, `src/lib/plano/dados.ts`). Ou seja, simulados
  do professor, treinos livres e diagnósticos; nunca prática, revisão ou o próprio refazer.
- **No máximo 10 por treino.** Com mais pendentes, a etapa continua disponível com as que faltam.
- **Pendente** = errada inicial, ainda mostrável ao aluno, que não estava em nenhum treino de refazer **entregue** daquela
  conta. Responder em branco no refazer também gasta a chance.
- **Erro novo reabre a etapa:** se o aluno errar outra questão do assunto num simulado ou treino livre depois, ela vira
  pendente e a etapa volta a "Agora".
- **A prática não trava.** Praticar continua liberado mesmo com refazer pendente, e antes de estudar a sugestão continua sendo
  praticar, como hoje. O refazer é o passo **sugerido** logo depois de estudar.
- **Feito como treino do plano** (simulado `tipo = 'treino'` com `plano_etapa = 'refazer'`), na mesma tela de prova e de
  resultado que já existe, com figuras e resolução. Precisa de uma linha de SQL.
- **Fora dos números:** o refazer não muda o "Meu desempenho", nem o gráfico de evolução, nem o "Depois do estudo: acertou X de Y",
  nem o acerto por matéria e as matérias fracas dos relatórios (turma, aluno e Hermes). Continua na lista de treinos do aluno
  nos relatórios, com o título "Refazer: …", para o professor ver que ele refez.
- **Treino aberto vem primeiro:** com uma prática já aberta, a sugestão é "Continuar treino" dela, não o refazer.
- **Fica no plano:** conteúdo com treino de refazer continua no plano mesmo se deixar de ser prioridade, como já acontece com
  prática e revisão.
- **Treinos livres e "Treinar este assunto":** primeiro questões que o aluno nunca viu, depois as vistas há mais tempo. Se o
  banco acabar, completa com as já vistas. Não bloqueia nunca.

## Caminhos considerados

**Onde entra no plano** (decisão do Peter): **A, antes da prática** (escolhido) ou B, no lugar da prática. B encurta o caminho,
mas faria o avanço depender do acerto em questões cuja resposta o aluno já viu.

**Como construir** (decisão minha; o Peter deixou comigo):

1. **Treino do plano com `plano_etapa = 'refazer'`** (escolhido). Reaproveita a tela de prova e de resultado (figuras, conteúdo
   formatado, resolução, tempo por questão), a criação com proteção de duplo clique e o "Continuar treino". Custa uma linha de SQL
   e o cuidado de tirar o refazer dos números (desempenho e relatórios).
2. **Exercícios na própria página do estudo**, como os de fixação, com correção na hora. Daria a correção questão a questão, mas
   teria que redesenhar as questões do banco fora da tela de prova (figuras com link assinado, formatação) e criar outra tabela de respostas.
3. **Treino comum sem marca**, só com as questões erradas. Sem SQL, mas o plano não saberia achar o treino aberto nem diferenciar
   o refazer de um treino livre; teria que adivinhar pelo título.

## Fora do escopo

- Refazer no caminho "Precisamos de mais respostas" (diagnóstico). Ali o aluno ainda não estudou nada.
- Refazer as erradas da prática ou da revisão do plano. Errar a prática já abre uma rodada nova, com questões novas.
- Correção questão a questão durante o treino. A correção sai no resultado, como em todo treino.
- Regra por escola para o tamanho do refazer (fica fixo em 10).
- Botão "Voltar ao plano" no resultado dos treinos do plano (hoje nenhum tem; não muda aqui).
- Refazer pelo resultado do simulado ("Revise isto"). O caminho é o plano e a página do estudo.

## Anti-objetivos

Falhou, mesmo funcionando, se:

- o acerto no refazer fizer o conteúdo avançar, concluir ou mudar de rodada;
- o refazer mudar qualquer número do "Meu desempenho", ou o acerto por matéria e as matérias fracas dos relatórios da escola e
  da Hermes;
- a mesma questão voltar duas vezes pelo refazer;
- o refazer impedir o aluno de praticar;
- o aluno conseguir gastar a chance do refazer antes de estudar;
- aparecer no refazer uma questão anulada, despublicada, de outra escola ou de prova em sigilo.

## Como está hoje

- **Etapas do plano** (`src/lib/plano/plano.ts`): `revisar` (estudar, marcada por `plano_revisoes`), `pratica` e `revisao`;
  `diagnostico` no caminho "mais respostas". O plano não é gravado: é recalculado a cada abertura por `montarPlano` (pura).
- **Treinos do plano:** `simulados` com `plano_conteudo`, `plano_etapa` (check em `'diagnostico', 'pratica', 'revisao'`) e
  `plano_rodada`; índice único em `(conta_id, plano_conteudo, plano_etapa, plano_rodada)`. Criados por `criarTreinoDoPlano`
  (`src/actions/plano-estudo.ts`) → `criarTreinoDoPlanoCom` (`src/lib/plano/nucleo.ts`), que só aceita a etapa que
  `etapaDeTreino` devolve.
- **Sugestão do próximo treino:** `etapaDeTreino` é usada na página do estudo (`PaginaEstudo.tsx`), no painel "Meu desempenho"
  (`components/desempenho/AcaoTreino.tsx`) e na validação do núcleo.
- **Desempenho:** `ehTreinoDepois` (`src/lib/desempenho/calculos.ts`) tira prática e revisão das respostas iniciais;
  `primeirasRespostas` fica com a primeira resposta por questão. `evolucao` usa **todas** as respostas, inclusive prática e revisão.
- **Questões vistas:** `vistasDaConta` (`src/lib/plano/dados.ts`) dá a última vez que cada questão apareceu numa tentativa.
  A prática e a revisão usam isso (`selecionarQuestoes`, `diasSemRepetir`); `criarTreino` (`src/actions/simulados-aluno.ts`) não:
  sorteia entre todas as publicadas.
- **Correção:** treino tem `correcao = 'na_hora'`; durante a prova não há correção, e o resultado mostra a marcada e a certa.

## Esquema SQL

Arquivo `db/2026-11-16-refazer-erradas.sql`, e a mesma mudança no check de `plano_etapa` em `db/schema.sql`. O Peter cola no
SQL Editor. **Nada que grava `'refazer'` vai ao ar antes de ele confirmar o resultado do `select` do fim.**

```sql
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
```

`varchar(11)` comporta `'refazer'`. O check que amarra `plano_*` a `tipo = 'treino'` e o índice único não mudam.

## O plano com o refazer

### A etapa

Nova `EtapaPlano`: `"refazer"`. Em `ConteudoPlano.etapas`, no caminho "revisar", fica entre `revisar` e `pratica`:

| Campo | Valor |
|---|---|
| Aparece | se o conteúdo tem alguma pendente **ou** algum treino de refazer (aberto ou entregue). Sem nenhum dos dois, as etapas ficam como hoje. |
| `estado` | `feita` se o conteúdo está concluído ou não há pendentes nem treino aberto; com treino de refazer aberto, `disponivel`; com pendentes e a etapa `revisar` ainda não feita, `aguardando` ("Depois de estudar"); com pendentes e o estudo feito, `disponivel`. |
| `treinoAberto` | o treino de refazer criado e não entregue, se houver |
| `resultado` | acertos do último refazer entregue |
| `minutos` | `min(pendentes, 10) × minutosPorQuestao` (com treino aberto, o tamanho dele) |

O refazer **não entra** em `percorrer` (rodadas), em `temPlano` (não tira o conteúdo de "mais respostas"), nem em `depois`
("Depois do estudo"). Entra em `feitas`/`total` (progresso) e em `minutosProximos` (tempo da semana), como as outras etapas.
**Cuidado:** `minutosProximos` para na primeira etapa `aguardando`. O refazer `aguardando` espera só o estudo, que vem antes dele
na mesma semana: ele soma os minutos e **não** interrompe a conta (senão a prática sumiria do tempo da semana).
Entra também no conjunto de conteúdos do plano em `montarPlano` (hoje `comPraticaOuRevisao`): conteúdo com treino de refazer
continua no plano mesmo sem ser mais prioridade, para o treino aberto não ficar órfão nem o `criarTreinoDoPlano` recusar com
"não está no seu plano".

`EntradaPlano` ganha `refazer: Record<chave, { pendentes: number }>`, calculado em `carregarPlano` (ver "Dados"). `montarPlano`
continua pura.

### Qual treino sugerir e quais aceitar

`etapaDeTreino` continua sendo **a sugestão** (um botão principal). Passa a ser:

- "mais respostas" → `diagnostico`; concluído → `pratica` (como hoje);
- prática não feita → `pratica` se houver prática aberta; senão `refazer` se disponível; senão `pratica`;
- prática feita → `revisao` se disponível, senão `refazer` se disponível, senão `null`.

"Disponível" aqui é o `estado` da etapa: antes de estudar o refazer está `aguardando`, então a sugestão continua `pratica`, como hoje.

Nova `etapasLiberadas(c)`, usada pelo núcleo para aceitar ou recusar o pedido: a sugestão mais `pratica` quando a prática não está
feita e `refazer` quando está `disponivel`. Assim o botão "Praticar" do cartão continua funcionando com refazer pendente, e o
núcleo recusa refazer antes de estudar ("Estude o conteúdo antes de refazer as questões.").

Nova `sugestaoDepoisDeEstudar(c)`: a mesma regra de `etapaDeTreino`, calculada como se a etapa `revisar` estivesse feita. A página
do estudo usa isso para decidir o botão único (ver "Telas").

### Texto do cartão

`textoRecomendacao`, no caminho "revisar", quando a etapa de refazer existe: "Revise esse conteúdo, refaça as questões que errou
e depois resolva uma sequência de N questões, começando pelas mais simples." (com foco: "Revise esse tópico, refaça…"). Sem a etapa,
o texto de hoje.

## Criar o treino de refazer

`criarTreinoDoPlanoCom` com `etapa = 'refazer'`:

1. Valida pela `etapasLiberadas`. Treino aberto de refazer → devolve ele (como as outras etapas).
2. Pega as pendentes do conteúdo (nova dependência `pendentesRefazer(chave)`, que devolve ids com a data do erro).
3. Nenhuma → `{ ok: false, erro: "Não há questões para refazer em <nome>." }`.
4. Escolhe as 10 de erro mais recente e as ordena com `ordenarPorFacilidade`. Não passa por `selecionarQuestoes` (as
   questões já foram vistas, de propósito).
5. Título `Refazer: <nome>`, `plano_rodada` = número de refazeres do conteúdo + 1, mesma colisão de duplo clique das outras etapas.
6. `criarTreinoDoPlano` abre a tentativa, como hoje.

## Dados (`carregarPlano`)

- **Erradas iniciais** já são lidas (`erradasDe`). Guardar também a data da resposta (`entregueEm`) para escolher as mais recentes.
- **Refeitas:** questões das tentativas **entregues** dos treinos com `plano_etapa = 'refazer'` da conta (a `ordem` da tentativa),
  por conteúdo.
- **Mostráveis:** das erradas, só as que hoje passariam nos filtros de `lerCandidatas`: publicada, não anulada, visível à escola
  (`filtroVisivel`) e fora de prova em sigilo (`questoesDeProvasEmSigilo`). Uma consulta por ids, em blocos, com `order`.
- `pendentes` = mostráveis − refeitas. Só na visão do aluno; na da escola, a contagem também é feita para a etapa aparecer igual
  (sem botões, como as outras etapas na visão da escola).
- A regra "pendentes = mostráveis − refeitas, 10 mais recentes" vira função pura com teste.

## Telas

**Cartão do plano** (`CartaoConteudoPlano.tsx`): etapa "Refazer as erradas", estado "Depois de estudar" / "Agora" / "Feita ✓"
(hoje `aguardando` sem data diz "Depois da prática": o refazer precisa do seu texto); com pendentes depois de um refazer, "Faltam N".
Sem botão enquanto aguarda o estudo. Resultado: "Refez: acertou X de Y". Botão `BotaoTreinoPlano` com rótulo "Refazer N questões" ou
"Continuar treino". O aviso de "não há questões novas" (`extras.disponiveis`) **não vale** para o refazer, que nunca é escondido por ele.
No cartão compacto, o refazer aparece como próxima etapa quando for a primeira disponível (já é o comportamento de `proxima`).

**Página do estudo** (`PaginaEstudo.tsx`):
- Faixa de etapas: com a etapa de refazer, quatro passos: Estudar (você está aqui) → Refazer as erradas (N questões do simulado) →
  Praticar → Revisão.
- Próximo passo, quando o estudo **ainda não** foi marcado e `sugestaoDepoisDeEstudar` é `refazer`: título "Agora refaça as que
  você errou", texto "N questões de <nome> que você errou ou deixou em branco. Uma chance em cada; no fim você vê a resposta
  certa." Um botão só, **"Já estudei, refazer as erradas"**: chama `marcarRevisado` e depois `criarTreinoDoPlano({ etapa: 'refazer' })`
  e entra no treino. Se a marca der certo e o treino falhar, mostra o erro; ao recarregar, a página já mostra o botão de refazer.
- Próximo passo, quando o estudo já foi marcado e a sugestão é `refazer`: mesmo título e texto, botão "Refazer N questões" (ou
  "Continuar treino").
- Nos outros casos, como hoje ("Já estudei" + a sugestão).

**Meu desempenho** (`AcaoTreino.tsx`): segue `etapaDeTreino`. Antes de estudar continua sugerindo praticar; depois, o refazer
quando for o caso, com o mesmo rótulo.

**Resultado do treino:** a tela de hoje (marcada, certa, resolução, "Revise isto"). Nada muda.

Tudo dentro do padrão `status-visual-aluno` (sem texto cinza).

## Desempenho

- `ehTreinoDepois` inclui `refazer`: as respostas do refazer saem das iniciais (não mexem em erradas, foco, prioridades nem no
  contador "refeitas").
- `evolucao` ignora as respostas com `planoEtapa === 'refazer'`. Prática e revisão continuam lá, como hoje.
- A página de desempenho da escola (`/turma/<id>/relatorio/aluno/<id>/desempenho`) usa as mesmas funções, então fica igual.
- **Relatórios da turma e do aluno** (`src/lib/relatorios/dados.ts`) não passam por essas funções: leem toda tentativa de
  `tipo = 'treino'` sem olhar `plano_etapa`. Ler `plano_etapa` junto do treino e tirar as respostas de refazer de
  `respostasDasContas` antes de `acertoPorMateria` (e portanto de `materiasMaisFracas`). Prática e revisão continuam contando,
  como hoje. `treinosDaPessoa` continua listando o refazer. A Hermes lê os mesmos relatórios (`src/lib/mcp/leitura/relatorios.ts`)
  e herda a regra; `src/lib/mcp/leitura/alunos.ts` só lista os treinos com título e nota, e fica como está.

## Treinos livres sem repetir

`criarTreino` (`src/actions/simulados-aluno.ts`), que serve ao "Treinar este assunto" e ao "Novo treino":

- Lê `vistasDaConta(aluno.id)`.
- Nova função pura de ordem: as nunca vistas primeiro, sorteadas; depois as vistas, da mais antiga para a mais recente. Pega as `n`
  primeiras. Com várias matérias, a mesma ordem dentro de cada matéria antes do equilíbrio de `sortearEquilibrado` (que hoje
  embaralha cada grupo: precisa de uma variante que mantenha a ordem dentro do grupo e só misture o caderno no fim).
- Não usa `diasSemRepetir` e nunca recusa por falta de questão nova: o limite continua sendo o número de publicadas.

## Testes obrigatórios

- Plano: conteúdo com erradas pendentes mostra 4 etapas, com o refazer em "disponivel" entre estudar e praticar; sem pendentes nem
  treino, 3 etapas como hoje.
- Refazer entregue com todas as pendentes zera a etapa (`feita`); erro inicial novo depois disso a reabre.
- Acerto ou erro no refazer não muda `rodada`, `situacao`, `etiqueta` nem `depois`.
- Conteúdo concluído deixa o refazer `feita`.
- `etapaDeTreino`: sugere refazer antes da prática; com a prática feita, a revisão disponível vem antes do refazer.
- `etapasLiberadas`: com refazer pendente, aceita `pratica` e `refazer`; o núcleo recusa `refazer` sem pendentes.
- Núcleo: no máximo 10, as de erro mais recente; treino aberto é devolvido; nenhuma pendente dá a mensagem.
- Pendentes: refeita (inclusive em branco) não volta; anulada, despublicada, de outra escola ou em sigilo não entra.
- Desempenho: respostas do refazer não mudam resumo, prioridades nem erradas; `evolucao` não as mostra.
- Relatórios: respostas do refazer não entram no acerto por matéria nem nas matérias fracas; o treino continua na lista de treinos.
- `etapaDeTreino` com prática aberta e refazer pendente sugere a prática.
- Antes de estudar: refazer `aguardando`, `etapaDeTreino` sugere `pratica`, o núcleo recusa `refazer`, e `minutosProximos` soma
  estudo + refazer + prática (o `aguardando` do refazer não corta a conta).
- Depois de "Já estudei", o refazer fica `disponivel` e passa a ser a sugestão; `sugestaoDepoisDeEstudar` dá `refazer` antes da marca.
- Conteúdo que deixou de ser prioridade, com só um treino de refazer, continua no plano e o treino aberto continua acessível.
- Treino livre: nunca vistas antes das vistas; vistas da mais antiga para a mais recente; com poucas novas, completa com vistas;
  várias matérias continuam equilibradas.

## Integração e publicação

1. SQL colado pelo Peter e o `select` de conferência com `'refazer'`.
2. `npm test`, `npm run lint`, `npm run build`.
3. Push no `master` e conferir no www (deploy "success" na Vercel não basta).
4. CLAUDE.md: tirar "voltar às questões erradas" e "Treinar este assunto não repetir" de "Ainda por fazer"; registrar o refazer
   no item 14/15.

## Fica para quem constrói

Nomes internos, divisão em tarefas, formato exato de `pendentesRefazer`, onde guardar a data do erro, CSS dentro do padrão,
textos de erro além dos citados.
