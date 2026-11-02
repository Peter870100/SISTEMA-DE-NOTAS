# Meu desempenho: painel de aprendizagem do aluno (projeto 1 de 4)

Data: 2026-11-02. Aprovação: Peter, no chat ("achei perfeito. pode fazer").

## Por quê

O Peter quer acompanhar a aprendizagem: o aluno vê as próprias dificuldades e a escola vê as dos alunos.
O pedido original tinha seis partes: classificação fina, registro, painel, recomendações, plano de estudo e IA.
Ele foi dividido em quatro projetos. **Este é o projeto 1: o painel.** Ele usa só o que o site já guarda:

- a matéria e o assunto da questão (lista padronizada em `assuntos`);
- a alternativa marcada em cada questão dos simulados e treinos (`tentativa_respostas`).

Os outros projetos vêm depois, cada um com sua spec:

- **Projeto 2:** classificação fina (conteúdo, habilidade, pré-requisito, materiais), com classificação em lote.
- **Projeto 3:** recomendações configuráveis e plano de estudo.
- **Projeto 4:** IA para sugerir classificação e redigir orientações.

Hoje nenhum aluno usa o sistema. O painel nasce com **dados de teste** que podem ser apagados depois.

## Públicos e acesso

- **Aluno:** página `/aluno/desempenho`, novo item "Desempenho" no menu do aluno, com ícone de gráfico.
  - Mostra só o próprio desempenho; a conta vem da sessão e nunca de um parâmetro.
  - Só entram as tentativas **entregues** cuja correção já foi liberada (`correcaoLiberada` em
    `src/lib/simulados/regras.ts`). Uma prova com correção "após o prazo" só aparece depois do prazo,
    para o painel não revelar gabarito antes da hora.
- **Escola:** dentro do relatório que já existe (`/turma/[turmaId]/relatorio`), com a mesma regra de acesso
  dele (`exigirTurmaDaEscola` + `podeVerGrupo`):
  - **Turma:** nova seção "Conteúdos com mais erro na turma" no relatório da turma.
  - **Aluno:** página `/turma/[turmaId]/relatorio/aluno/[alunoId]/desempenho`, com o **mesmo painel** que o aluno
    vê, mais um link "Desempenho" no relatório do aluno e na tabela de alunos.
  - A escola vê todas as tentativas entregues, mesmo as que ainda não foram liberadas ao aluno.
  - O aluno da planilha é ligado à conta pela regra do relatório (`contaDaPessoa` em
    `src/lib/relatorios/dados.ts`). Aluno sem conta mostra o aviso que já existe ("Sem conta de login…").

## Como contar (regras verificáveis, funções puras e testadas)

- **Resposta:** cada questão de uma tentativa entregue. Questão anulada não entra.
  - **Acerto:** `correta = true`.
  - **Em branco:** `alternativa` nula. É contada à parte e não entra como erro.
  - **Erro:** alternativa marcada e errada.
- **Painel de números:** questões respondidas, acertos, erros, em branco e taxa de acerto
  (acertos ÷ respondidas, com as em branco no divisor).
- **Desempenho inicial (minha decisão):** quando a mesma questão aparece em mais de uma tentativa, os totais e
  os gráficos por conteúdo usam **só a primeira resposta** do aluno a ela. Assim "7 erros em 10 questões"
  são 10 questões diferentes, e acertar uma questão já vista não esconde a dificuldade. As respostas
  seguintes aparecem só como contagem ("refez 3 questões") e serão usadas no projeto 3.
- **Conteúdo** é o assunto da questão. Questão sem assunto entra no grupo "Matéria (sem assunto)", para
  questões sem classificação continuarem contando. É a mesma regra de `assuntosParaRevisar`.
- **Evolução:** uma barra ou ponto por atividade entregue (simulado ou treino), em ordem de entrega, com a
  taxa de acerto e "7 de 10". A seta compara a última atividade com a anterior **e diz quais são**:
  "↑ 12 pontos: *Treino de Química* (04/11) comparado com *Simulado 1* (28/10)". Logo abaixo vem a frase
  fixa "Atividades diferentes podem ter dificuldades diferentes".
- **Regras de prioridade**, em um arquivo de configuração (`src/lib/desempenho/regras.ts`) com os
  valores iniciais abaixo:
  - **Revisão prioritária:** 5 ou mais questões distintas no conteúdo **e** taxa de erro de 60% ou mais.
  - **Precisamos de mais respostas:** de 1 a 4 questões distintas no conteúdo, quando houve algum erro.
  - Os demais conteúdos só aparecem nos gráficos.
- **Textos:** cada prioridade é escrita como sugestão, nunca como diagnóstico. Exemplo: "Você errou 7 de 10
  questões de *Derivação parassintética*. Vale revisar esse assunto e depois treinar com questões novas."
  Os textos ficam no mesmo arquivo de regras.

## O que a tela mostra (aluno e escola, mesmo componente)

1. **Cabeçalho em cartão**, no padrão `status-visual-aluno`: título "Meu desempenho" (na escola, "Desempenho
   de *Nome*") e o período, desde a primeira atividade.
2. **Painel de números** (`PainelResumo`, quatro itens): respondidas, acertos, erros e em branco, e taxa de acerto.
   Como são cinco números, os erros e as questões em branco ficam juntos num item.
3. **Conteúdos com mais erro:** gráfico de barras horizontais (recharts, que já está no projeto) com até 8
   conteúdos que tiveram erro, ordenados pela taxa de erro e, no empate, pelo número de erros. O rótulo segue
   o formato "70% de erro — 7 erros em 10 questões". Conteúdo com menos de 5 questões ganha a marca
   "poucas respostas". Os rótulos não podem ser cortados e, no celular, ficam acima da barra.
4. **Evolução:** gráfico por atividade e a seta com os nomes das atividades comparadas.
5. **Prioridades de revisão:** cartões com as regras acima. Cada cartão tem:
   - o texto da sugestão;
   - as aulas do tema (`aulasDoTema`) quando existirem;
   - o botão **"Treinar este assunto"** (componente `TreinarAssunto`, que já existe), só na visão do aluno.

   Sem aula ou questão para o assunto, o cartão diz isso: "Ainda não há aula sobre este assunto".
6. **Matérias:** ao clicar numa matéria, abrem os conteúdos dela (barras com a mesma legenda). Ao clicar num
   conteúdo, abrem:
   - as questões que o aluno errou ou deixou em branco, com o enunciado, a alternativa marcada, a correta e a
     resolução (`questoes.resolucao`) quando houver;
   - a revisão sugerida: aulas do tema e "Treinar este assunto".

   A escola vê o mesmo. A navegação muda o endereço (`?materia=…&conteudo=…`), então funciona o botão
   voltar e dá para mandar o link.
7. **Estados:**
   - **Carregando:** `loading.tsx` com esqueleto.
   - **Sem histórico:** cartão "Você ainda não entregou nenhum simulado ou treino" e um botão para os simulados.
   - **Erro:** `error.tsx` com "Tentar de novo".
   - **Pouco histórico:** mostra o que tem, e as prioridades com pouco dado viram "Precisamos de mais respostas".

**Turma (seção nova no relatório da turma):** as barras dos conteúdos com mais erro na turma, juntando
todos os alunos com conta e usando a regra da primeira resposta por aluno e questão. A legenda segue o mesmo
formato, por exemplo "62% de erro — 31 erros em 50 respostas". Cada aluno da tabela ganha o link
"Desempenho".

Visual: o padrão `status-visual-aluno`, que vale para a página do aluno e para a página nova da escola:
- cabeçalho e menu azul-marinho, ícones dourados e cartões brancos arredondados em fundo claro;
- títulos e gráficos em azul, sem texto cinza;
- duas colunas a partir de 1200px e uma no celular, conferidas em print em 1340px e 390px.

A imagem de referência citada no pedido não veio; vale o padrão atual.

## Dados de teste (para apagar depois)

O banco não muda: nenhuma tabela ou coluna nova. Os dados de teste vêm em dois arquivos SQL que o Peter cola
no SQL Editor:

- `db/dados-teste-desempenho.sql` cria no Colégio Status:
  - uma turma "TESTE DESEMPENHO" (2026);
  - três alunos na planilha e três contas de aluno ligadas a eles, com usuário e senha conhecidos;
  - quatro simulados de professor publicados e já encerrados, com correção liberada, montados com questões
    **publicadas reais** do banco que têm assunto (escolhidas pelo SQL);
  - as tentativas entregues, com respostas variadas que geram prioridades, conteúdos com pouco dado,
    questões em branco e uma questão repetida.
- `db/apagar-dados-teste-desempenho.sql` apaga tudo o que o primeiro criou (encontra pelo nome da turma e
  pelo prefixo dos usuários). Os registros reais não são tocados.

Os dois arquivos podem ser rodados mais de uma vez sem duplicar nada. A senha das contas de teste vai no
arquivo como hash bcrypt; a senha em texto fica só na resposta ao Peter, nunca no repositório.

## Decisões tomadas por mim (revisão do construtor)

1. **Quais tentativas entram:**
   - **Painel do aluno e painel do aluno visto pela escola:** todas as tentativas entregues da conta
     (simulados do professor e treinos), em todos os anos e turmas. Os números são os mesmos nas duas
     telas; a única diferença é que, para o aluno, ficam de fora as provas com correção ainda não liberada.
     A consulta é nova: ela lê a conta inteira e **não** reaproveita o recorte "turma e ano" de
     `carregarExtras`.
   - **Seção da turma:** só os simulados do professor ligados à turma (`simulado_turmas`) no ano letivo
     da turma. Os treinos ficam de fora, porque cada aluno escolhe o assunto do próprio treino. Entram
     as tentativas entregues dos alunos com conta, liberadas ou não.
2. **Taxa de erro:** erros ÷ questões distintas do conteúdo. As questões em branco ficam no divisor, mas
   não contam como erro, e aparecem na legenda quando houver: "60% de erro — 6 erros em 10 questões
   (2 em branco)". A regra de prioridade usa essa mesma taxa. Um conteúdo só com questões em branco
   não entra no gráfico de erro nem vira prioridade, mas aparece na lista da matéria.
3. **Evolução:** a nota de cada atividade é a de todas as respostas dela, como o aluno viu na correção.
   A regra da primeira resposta vale só para os totais e para os conteúdos.
4. **Anulada:** vale o estado atual de `questoes.anulada`. Uma questão anulada depois sai do painel.
5. **Dados de teste:**
   - O SQL liga `aluno_turmas.aluno_id` às linhas da planilha.
   - Os usuários têm o prefixo `teste.desempenho.`, e a turma se chama "TESTE DESEMPENHO".
   - O script de apagar só remove contas com esse prefixo **e** do Colégio Status, a turma com esse nome
     e os simulados cujo título começa com "[TESTE DESEMPENHO]".

## Fora deste projeto (fica para os projetos 2 a 4)

- Classificação fina, habilidades, pré-requisitos, materiais e classificação em lote.
- Regras editáveis numa tela; aqui elas ficam em um arquivo.
- Plano de estudo, tempo disponível e progresso do plano.
- Novas tentativas da mesma prova (hoje é uma por simulado), dicas e lançamento de prova impressa.
- IA.

## Testes e validação

- Testes das funções puras de cálculo:
  - acerto, erro, em branco e anulada;
  - primeira resposta quando a questão se repete;
  - grupo sem assunto;
  - as regras de prioridade nos limites (4 e 5 questões, 59% e 60%);
  - a evolução e a seta (dois itens, um item, nenhum);
  - os textos.
- Teste de acesso:
  - o aluno não vê a prova com correção ainda não liberada;
  - a página da escola recusa uma turma de fora do escopo do professor.
- `npm test`, `npm run lint` e `npm run build`.
- Prints em 1340px e 390px com os dados de teste e, depois de publicar, conferência no www com uma conta de teste.
