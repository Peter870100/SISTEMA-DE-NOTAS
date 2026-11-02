# Classificação fina das questões (projeto 2 de 4)

Data: 2026-11-02. O Peter pediu para começar sem perguntas ("comece"), então as decisões abaixo são minhas
e estão marcadas como tal.

## Por quê

O pedido original do acompanhamento da aprendizagem pede para cada questão ter:

- disciplina, conteúdo e assunto específico;
- habilidades;
- conteúdos que são pré-requisito;
- resolução comentada;
- materiais de revisão.

A classificação precisa ser padronizada, sem o mesmo conteúdo com dois nomes, e as questões antigas devem ser
classificadas aos poucos, também em lote. O painel "Meu desempenho" (projeto 1) e as recomendações
(projeto 3) dependem disso para falar em "derivação parassintética" e não só em "Morfologia".

## Como está hoje (levantado no banco em 2026-11-02)

- **Questões:** há 6.375 publicadas e 428 em revisão. Quase todas têm `materia` e `assunto_id`; só 6 estão sem assunto.
- **Assuntos:** são 181 em `assuntos`, todos aprovados, com nome único por matéria. São **amplos**
  ("Morfologia", "Sintaxe", "Interpretação de texto"), então correspondem ao nível **conteúdo** do pedido.
  - O dono cuida deles em `/banco/assuntos`: aprova os propostos pela IA e junta duplicados.
- **Resolução comentada:** já existe (`questoes.resolucao`, editável no `EditorQuestao`).
- **Quem pode editar** (`podeEditarQuestao`): as questões do banco geral só o dono edita. As da escola, o admin
  da escola e o autor.

## A hierarquia (minha decisão)

| Pedido | No sistema | Exemplo |
|---|---|---|
| Disciplina | `materia` (já existe) | Português |
| Conteúdo | `assuntos` (já existe; continua se chamando **Assunto** na tela, como no site e na Hermes) | Morfologia |
| Assunto específico | **Tópico**: tabela nova `topicos`, filha de um assunto | Derivação parassintética |
| Habilidades | tabela nova `habilidades`, ligada à questão por `questao_habilidades` (várias por questão) | Distinguir parassíntese de derivação prefixal e sufixal |

Escolhi o nome **"Tópico"** para não ter dois "assuntos" na mesma tela.

- **Tópico:** cada questão tem **no máximo um** (`questoes.topico_id`, opcional). Ele precisa ser do mesmo assunto da
  questão: se o assunto da questão mudar, o tópico é apagado.
- **Habilidades:** uma questão pode ter várias. Cada habilidade pertence a uma **área** (linguagens, humanas,
  natureza ou matemática, como `questoes.area`), porque a Matriz do ENEM é por área. Pode ter um código opcional,
  como "H18" do ENEM ou "EM13LP01" da BNCC, único por área quando existe.
- **Contagem nos totais:** cada questão conta uma vez, mesmo com várias habilidades. A regra é do projeto 3
  e fica registrada aqui para não se perder.
- **Pré-requisitos:** são ligados entre **tópicos** (tabela `topico_prerequisitos`, "para X é bom saber Y").
  Tópico e pré-requisito podem ser de assuntos ou matérias diferentes, mas um tópico não pode ser pré-requisito
  dele mesmo.
- **Materiais de revisão:** tabela `materiais_revisao`, ligada a um tópico ou a um assunto. Cada material é
  **uma aula da plataforma** (`aula_id`) **ou** um link externo (título + URL), com
  `escola_id` nulo = material de todas as escolas (só o dono cria).
  - **Visão do aluno:** os materiais de aula só aparecem quando o aluno tem acesso à aula.
  - **Visão da escola:** o painel mostra os materiais das escolas e os da própria escola.

**Padronização:** tópicos e habilidades seguem o modelo de `assuntos`.

- Os nomes são únicos dentro do assunto ou da matéria (`lower(nome)`).
- A situação é `aprovado` ou `proposto`.
- Professor e admin escolhem da lista e podem **propor** um tópico novo, que entra como `proposto` e já pode ser
  usado na questão.
- O dono **aprova, renomeia ou junta**. Juntar passa as questões, pré-requisitos e materiais para o outro e apaga o
  proposto.
- Tudo é do banco geral: a lista é a mesma para todas as escolas.

## Telas

1. **Editor da questão** (`EditorQuestao`, seção "Identificação"):
   - depois de Matéria e Assunto, entram os campos **Tópico** (lista do assunto, com "+ propor tópico") e
     **Habilidades** (várias, com busca, da área da questão);
   - a resolução comentada continua onde está;
   - salvar segue as regras de edição de hoje.
2. **Classificar aos poucos** (`/banco/classificar`): uma questão por vez, só as que a pessoa pode editar.
   - **Filtros:** matéria, assunto e "sem tópico" (ligado por padrão).
   - **Questão:** enunciado e alternativas para ler; abaixo, Tópico + Habilidades e os botões
     "Salvar e próxima" e "Pular".
   - **Progresso:** "142 de 1.380 classificadas neste assunto".
   - O botão "Classificar" na página do banco abre essa tela com os filtros atuais.
3. **Classificar em lote** (na mesma página `/banco`): caixas de seleção nas questões da lista, mais
   "Selecionar todas desta página" (até 100). O botão "Classificar selecionadas" abre um painel com:
   - **Tópico:** igual para todas, e só quando todas são do mesmo assunto; senão o campo fica desabilitado com
     o motivo.
   - **Habilidades:** "adicionar" ou "trocar por", só quando todas são da mesma área.

   O resultado diz "38 classificadas, 2 sem permissão".
4. **Gerenciar classificação** (`/banco/assuntos` vira "Classificação", só para o dono). Por assunto, a tela mostra:
   - os tópicos, com nº de questões, aprovar, renomear e juntar;
   - os pré-requisitos de cada tópico;
   - os materiais de revisão (aula da plataforma, escolhida da lista, ou link);
   - uma aba de habilidades por matéria, com código, descrição, renomear e juntar.

   Os assuntos propostos continuam como estão hoje.

## Lote pelo Claude (sem IA paga)

Classificar 6.800 questões à mão não é viável. Por isso o MCP do dono (`/api/mcp/dono`) ganha duas ferramentas,
seguindo o modelo de `salvar_questoes`, para o Claude Code ligado ao MCP (`statusavalia-dono`) classificar em lote
sem custo de API:

- **`questoes_para_classificar`:** recebe `materia`, `assunto?`, `so_sem_topico` (padrão true) e `limite` (até 50).
  Devolve, por questão, o id, o enunciado resumido, as alternativas, o assunto, os tópicos e habilidades
  disponíveis (id e nome; as habilidades são as da área da questão) e a classificação atual.
- **`classificar_questoes`:** recebe uma lista `{ questao_id, topico_id | topico_novo?, habilidade_ids?,
  habilidades_novas? }` (até 50).
  - **Validação:** todos os ids precisam existir, o tópico precisa ser do assunto da questão e as habilidades da
    área da questão. Item inválido é recusado com o motivo, e os outros seguem.
  - Os tópicos e habilidades novos entram como `proposto`.
  - A ferramenta devolve o resumo.

## Banco (SQL manual, em `db/schema.sql`, que o Peter cola)

O SQL só acrescenta. Nada é apagado nem renomeado, e as questões atuais continuam funcionando sem tópico.

- `topicos (id, assunto_id → assuntos on delete cascade, nome, situacao, created_at)`, único `(assunto_id, lower(nome))`.
- `habilidades (id, area, codigo null, descricao, situacao, created_at)`, com a mesma restrição de valores de
  `questoes.area`, e únicos `(area, lower(descricao))` e `(area, codigo)` quando o código existe.
- `questoes.topico_id uuid null references topicos on delete set null`, com índice.
- `questao_habilidades (questao_id → questoes cascade, habilidade_id → habilidades cascade, pk dos dois)`.
- `topico_prerequisitos (topico_id, prerequisito_id, pk, check topico_id <> prerequisito_id)`.
- `materiais_revisao (id, escola_id null, topico_id null, assunto_id null, aula_id null → aulas cascade, titulo,
  url, created_at)`. Os checks exigem:
  - exatamente um entre tópico e assunto;
  - aula **ou** (título e URL `https://`).
- RLS igual ao das tabelas vizinhas (`acesso_total_*`).

Antes de publicar o código, confiro **por leitura** que o SQL foi aplicado (regra do CLAUDE.md).

## Lista inicial (minha decisão)

Sem nada na lista, ninguém consegue classificar. O projeto já entrega um **arquivo SQL de carga inicial**
(`db/classificacao-inicial.sql`), que o Peter cola, com:

- **Tópicos** para os assuntos de **Português e Matemática** (projeto-piloto, 37 assuntos, cerca de 4 a 8 tópicos
  cada), escritos por mim a partir dos conteúdos de ensino médio e ENEM, como "Formação de palavras" e
  "Derivação parassintética";
- **Habilidades** da Matriz de Referência do ENEM das áreas de Linguagens e Matemática:
  - código H1 a H30, com o texto oficial do INEP **conferido na fonte** antes de entrar;
  - cadastradas uma vez por área (`linguagens` e `matematica`), então valem para todas as matérias da área;
  - se a fonte oficial não puder ser conferida, o arquivo sai **sem** as habilidades (só os tópicos) e isso é avisado.

As outras matérias ganham tópicos depois, pela tela, pelo lote do Claude ou pelo projeto 4 (IA).

## Decisões tomadas por mim (revisão do construtor)

1. **Juntar assuntos** (`juntarAssunto`, que já existe): os tópicos do assunto que some **passam para o que fica**.
   Se já existir um tópico de mesmo nome no destino, os dois são juntados: questões, pré-requisitos e materiais
   vão para o que fica. Os materiais ligados ao assunto que some também passam para o destino.
   Nada é apagado por cascata.
2. **Tópico de outro assunto:** a regra fica no banco, com um gatilho em `questoes` (antes de insert e de update
   de `assunto_id` ou `topico_id`). Se o tópico não for do assunto da questão, `topico_id` vira nulo. Assim todos os
   caminhos que gravam questão respeitam a regra: editor, importação, gerador, `salvar_questoes`, SQL e lixeira.
3. **Materiais da escola:** ficam para depois. Neste projeto só o dono cria materiais, todos com
   `escola_id` nulo. A coluna fica pronta para o futuro. Qualquer aula publicada pode ser escolhida, e o aluno só
   vê a aula se tiver acesso a ela (a regra de hoje).
4. **Propor habilidade:** só o dono cria habilidades, pela tela de Classificação ou pelo MCP
   (`habilidades_novas` entra como `proposto`). Professor e admin só escolhem da lista. Professor pode propor
   **tópico**.
5. **Lote com áreas diferentes:** o campo Habilidades fica desabilitado, com o motivo, quando as questões
   selecionadas não são todas da mesma área. O campo Tópico segue a mesma lógica com o assunto.
6. **Situação da questão:** classificar não muda `status`. A tela e o MCP incluem questões publicadas e em revisão.
7. **Lixeira:** ao restaurar uma questão cujo tópico não existe mais, o tópico fica nulo (o gatilho do item 2
   cuida disso) e as habilidades não voltam. O construtor confere a função de restaurar e, se a coluna nova
   quebrar a restauração, ajusta só o necessário.

## Painel e outras partes (o que muda e o que não muda)

- **O painel "Meu desempenho" não muda neste projeto.** Agrupar o painel por tópico e mostrar habilidades e
  materiais fica para o projeto 3.
- **Fora do escopo:**
  - API de questões (`/api/questoes`), Hermes do professor, gerador, provas em Word e simulados;
  - copiar o tópico e as habilidades quando uma questão é duplicada ou promovida.
- **Questões do banco geral:** como hoje, só o dono classifica, pela tela ou pelo lote do Claude. O professor
  classifica as questões da escola que ele pode editar.

## Testes e validação

- Funções puras e testadas:
  - quem pode classificar (reaproveita `podeEditarQuestao`);
  - validação do lote: tópico de outro assunto, habilidade de outra matéria, id inexistente, mais de 50 itens,
    "trocar por" e "adicionar";
  - limpar o tópico quando o assunto muda;
  - juntar tópicos (o que vai para onde).
- Ferramentas do MCP: os mesmos casos, com o banco simulado como nos testes atuais de `src/lib/mcp/acoes`.
- `npm test`, `npm run lint` e `npm run build`. Prints de `/banco/classificar` e do lote em 1340px e 390px.
- Depois de publicar, conferir no www com a conta do dono:
  - classificar uma questão na tela;
  - classificar 5 questões pelo MCP.
