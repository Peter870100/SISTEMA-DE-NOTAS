# Relatórios do aluno e da turma (Hermes etapa D)

Data: 2026-10-22 · Status: decisões aprovadas pelo Peter no chat ("pode fazer assim"); aguardando a aprovação deste desenho

## Objetivo

O admin, e a Hermes falando com ele, sabe **tudo** de qualquer aluno e de qualquer turma num só lugar, com gráficos:
- se fez ou não fez cada simulado e treino, com que nota e em quanto tempo;
- quantas vezes saiu da página;
- quais aulas assistiu;
- a nota de cada bimestre e a nota de cada matéria;
- **quanto falta para atingir a média**.

Hoje esses dados existem, mas espalhados: a planilha de cada bimestre, a tela de resultado de cada simulado e o progresso de cada curso. A Hermes já os responde em texto (`perfil_aluno`, `desempenho_turma`), mas sem gráfico e sem o "quanto falta".

Sucesso = o Peter pergunta à Hermes "como está o João do 3º A?" e recebe um resumo de 3 linhas com o link. O link abre uma página com gráficos, que dá para imprimir para a reunião de pais.

## Decisões tomadas

| Tema | Decisão | De quem |
|---|---|---|
| Média para passar | Campo por escola em **Configurações**: "Média para aprovação", padrão **6,0** (o sistema já usa 6 como "crítico") | Peter, com recomendação do Claude |
| Como os bimestres contam | **Média simples** dos 4 bimestres. Pesos por bimestre ficam para depois, se alguma escola precisar | idem |
| Quanto falta | (média × 4 − soma dos bimestres **encerrados**) ÷ bimestres que faltam. Ex.: 5,0 e 6,0, média 6 → precisa de 6,5 em cada um dos dois restantes | idem |
| Nota por matéria | Calculada das respostas dos **simulados e treinos**, porque cada questão tem matéria. A planilha continua por atividade, como o professor montou | idem |
| Formato | Páginas **"Relatório do aluno"** e **"Relatório da turma"** no sistema, com gráficos e botão de imprimir/PDF. A Hermes manda **resumo curto + link**. Imagem no Telegram fica para depois | idem |
| Quem vê | Dono e admin: a escola toda. Professor: só as turmas dele (a regra que a tela da turma já usa). Aluno: fora por ora | idem |

## Fora do escopo

- Relatório para o próprio aluno ver.
- Pesos por bimestre, recuperação e conselho de classe.
- Imagem do gráfico enviada pelo Telegram.
- Comparar escolas entre si.

## Não pode acontecer

- Professor ver relatório de turma ou aluno fora do acesso dele, pela tela ou pelo link que a Hermes manda. O link exige login e as mesmas regras da tela da turma.
- O relatório dar uma média diferente da planilha. A média de cada bimestre é calculada pela **mesma função** da tela (`mediaAluno`, escala 0–1000 → 0–10).
- "Quanto falta" impossível ou enganoso:
  - se não há como chegar à média (precisa de mais de 10), dizer isso claramente;
  - se já atingiu, dizer "já atingiu a média";
  - se nenhum bimestre foi encerrado, não calcular.
- Aluno sem conta de login sumir do relatório. O relatório parte da **planilha**, e a conta só acrescenta simulados e aulas quando está ligada.

## 1. Dados e cálculos (puros, testados)

**Banco (SQL manual, colado pelo Peter):** `alter table escolas add column if not exists media_aprovacao numeric(4,2) not null default 6.0 check (media_aprovacao between 0 and 10);`

Funções puras em `src/lib/relatorios/`:
- **`mediaBimestre`**: média do aluno num bimestre, reaproveitando `mediaAluno` + `paraEscala10`.
- **`quantoFalta(medias: (number | null)[], encerrados: boolean[], mediaAprovacao: number)`**: devolve `{ situacao: "atingiu" | "precisa" | "impossivel" | "sem_dados", porBimestre?: number }`.
  - Bimestre não encerrado não entra na soma, mesmo que já tenha notas. A nota parcial dele aparece no gráfico como "em andamento".
- **`notaPorMateria`**: a partir das respostas das tentativas **entregues** (`tentativa_respostas.correta` + `questoes.materia`), dá o percentual de acerto por matéria, com o número de questões.
  - Matéria com menos de 5 questões aparece com o aviso "poucas questões".
  - Anuladas não contam (mesma regra de `corrigir`).
- **`resumoSimulados`**: para cada simulado da turma, se o aluno **fez**, **está fazendo** ou **não fez**, com nota, tempo, saídas e tempo fora. Os treinos aparecem em separado.
- **`resumoAulas`**: aulas dos cursos ligados à turma: concluídas, começadas e não começadas, com o % assistido.
- Turma:
  - média por bimestre;
  - ranking pela média dos bimestres encerrados, ou pelo bimestre vigente se nenhum foi encerrado;
  - quem está abaixo da média;
  - quem não fez cada simulado;
  - as 3 matérias com menor acerto.

A ligação aluno da planilha ↔ conta de login é a mesma de `perfil_aluno`: `aluno_turmas.aluno_id`, ou o nome quando o vínculo não existe.

## 2. Telas

Rotas dentro da turma, que já tem as regras de acesso (`exigirAcessoATurmaId`):
- **`/turma/[turmaId]/relatorio`** — Relatório da turma. Junta todos os bimestres da turma de mesmo nome e ano letivo.
  - Números no topo: alunos, média da turma, quantos abaixo da média, % que fez o último simulado.
  - Gráficos (Recharts, que o projeto já usa):
    - média por bimestre com a linha da média de aprovação;
    - distribuição das médias;
    - acerto por matéria.
  - Tabelas:
    - alunos (média de cada bimestre, quanto falta, simulados feitos/total, aulas concluídas), ordenável, com link para o relatório de cada aluno;
    - quem não fez cada simulado.
- **`/turma/[turmaId]/relatorio/aluno/[alunoId]`** — Relatório do aluno.
  - Cabeçalho: nome, turma, último acesso e a frase-resumo (ver seção 3).
  - Gráficos:
    - notas por bimestre com a linha da média;
    - acerto por matéria;
    - evolução nos simulados (nota por data).
  - Listas:
    - simulados (fez/não fez, nota, tempo, saídas);
    - treinos;
    - aulas;
    - atividades da planilha do bimestre vigente.
  - Mostra "quanto falta" em destaque.
- **Botão "Relatório"** na tela da turma e na gaveta do aluno (`AlunoDashboardDrawer`), levando às páginas acima.
- **Impressão:** `@media print` limpo (sem menu lateral, gráficos com cores que saem no papel) e botão "Imprimir / salvar PDF" (`window.print()`).
- Visual: cartões e tokens do `DESIGN.md`, padrão das telas de admin; sem texto cinza; funcionando a 390 px.
- **Configurações:** campo "Média para aprovação" (0 a 10, com uma casa decimal), só admin e dono.

## 3. Hermes

- **Ferramentas novas de leitura**, nos dois perfis (professor limitado às turmas dele):
  - `relatorio_aluno` (aluno por nome, turma opcional);
  - `relatorio_turma` (turma por nome).
- Cada uma devolve:
  - uma **frase-resumo**. Ex.: "João Silva (3º A): média 5,4 nos bimestres encerrados; precisa de 6,8 no 4º para chegar a 6,0. Fez 3 de 5 simulados (faltou ao 'Ufms 24' e ao 'Revisão 2'). Mais fraco em Física (38% de acerto). Assistiu 7 de 12 aulas.";
  - 5 a 8 linhas de detalhe;
  - o **link** `https://<domínio da escola>/turma/<id>/relatorio/aluno/<id>` (domínio pela escola, `src/lib/dominio.ts`).
- `perfil_aluno` e `desempenho_turma` continuam iguais. As ferramentas novas reaproveitam os cálculos da seção 1, para a Hermes e a página dizerem a mesma coisa.
- O link abre a página só para quem tem login e acesso. A Hermes avisa: "abra logado como admin".

## Testes

- **Unidade:**
  - `quantoFalta`: atingiu, precisa, impossível, sem dados, bimestre não encerrado ignorado, média configurada diferente de 6;
  - `notaPorMateria`: anuladas fora, só tentativas entregues, aviso de poucas questões;
  - resumo de simulados: fez, fazendo, não fez;
  - ranking;
  - frase-resumo.
- **Prévia** com dados fictícios: as duas páginas em 1340 e 390 e na impressão.
- **Ponta a ponta:** relatório de um aluno da Escola Teste pela Hermes, conferindo que os números batem com a planilha.

## O que o Peter precisa fazer

1. Colar o SQL da `media_aprovacao` no Supabase. Eu confiro antes de publicar.
2. Aprovar a publicação.
