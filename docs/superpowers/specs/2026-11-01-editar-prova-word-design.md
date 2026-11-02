# Editar a prova em Word na pré-visualização — design

Data: 2026-11-01. Continua a Prova em Word (`2026-10-31-prova-em-word-design.md`) e a pré-visualização
(`2026-11-01-previa-prova-word-design.md`).

## Por quê

Hoje o professor gera a prova e, se quiser mudar qualquer coisa (título, turma, data, valor, uma questão
que não serve), precisa baixar o Word e mexer à mão. Aí a prova do site deixa de ser a prova que foi
aplicada. A ideia é deixar as edições mais comuns na própria pré-visualização, **gravadas na prova**, de
modo que a prévia, o .docx baixado, o PDF e os links da Hermes mostrem sempre a mesma prova.

Decidido com o Peter: **não** fazer edição livre do texto das questões. O texto vem do banco. Para
ajuste fino continua valendo o "Baixar Word". (Corrigir a questão no banco fica para depois.)

## Objetivos

1. **Cabeçalho editável**: título, turma, data, valor e instruções.
2. **Questões**: trocar uma questão por outra inédita do mesmo assunto, remover e mudar a ordem.

## Fora do escopo

- Editar enunciado, alternativas ou resolução.
- Adicionar uma questão escolhida à mão (só a troca sorteada).
- Edição pela Hermes. Os links da Hermes já refletem as edições, porque o .docx é montado na hora.
- Desfazer ou ver o histórico de versões.

## Anti-objetivos (seria falha mesmo funcionando)

- A prévia mostrar uma coisa e o Word baixado outra.
- Uma questão trocada continuar contando como "já usada", ou uma questão nova não contar como usada.
- Quebrar a pré-visualização ou o download das provas antigas, que não têm cabeçalho gravado.

## Dados (SQL manual: o Peter cola no SQL Editor)

```sql
alter table provas_word add column if not exists cabecalho jsonb not null default '{}';
NOTIFY pgrst, 'reload schema';
```

O formato de `cabecalho` é `{ turma?: string, data?: "AAAA-MM-DD", valor?: string, instrucoes?: string }`.
Os campos vazios não são gravados. O título continua na coluna `titulo`, que já existe. Limites:
título com 1 a 120 caracteres; turma até 40; valor até 20; instruções até 600 (quebras de linha mantidas).
A data precisa ser válida.

As questões continuam em `prova_word_questoes (prova_id, questao_id, ordem)`:
- **Trocar**: `update ... set questao_id = nova where prova_id and questao_id = antiga`.
- **Remover**: apaga a linha e renumera `ordem` (1..n).
- **Ordem**: regrava `ordem` de todas as linhas (no máximo 60).

A regra das "inéditas" (`usadasPeloProfessor`) lê `prova_word_questoes`. Por isso a questão trocada ou
removida volta a ser inédita e a nova passa a ser usada, sem mudar nada nessa função.

## Como o cabeçalho aparece (Word e prévia iguais)

O cabeçalho é montado em dois lugares, `src/lib/folha/docx.ts` (`cabecalho`) e
`src/app/banco/provas-word/[id]/previa/Folha.tsx` (`Cabecalho`). Os dois precisam mudar juntos.
`DadosFolha` e `DadosPrevia` ganham `cabecalho?: { turma?, data?, valor?, instrucoes? }`.

- **Título**: como hoje (maiúsculas). Também aparece no topo das páginas seguintes, no rodapé e no nome
  do arquivo.
- **Turma**: se estiver preenchida, o texto vai no lugar da linha depois de "Turma:".
- **Data**: se estiver preenchida, vai como `dd/mm/aaaa` no lugar de `____/____/______`.
- **Valor**: se estiver preenchido, "Valor: 10,0" aparece junto do campo "Nota" na 2ª linha, sem
  quebrar a linha. O builder escolhe o arranjo exato, por exemplo encurtando a linha da Nota.
- **Instruções**: se estiverem preenchidas, vão num bloco logo abaixo do cabeçalho, com o rótulo
  "Instruções" e texto no tamanho do corpo. Só na **prova**, não no gabarito.
- **Gabarito**: título + "Gabarito comentado", como hoje (turma, data, valor e instruções não aparecem).
- Sem nenhum campo preenchido, a folha fica idêntica à de hoje (provas antigas não mudam).

## Tela: painel "Editar" na pré-visualização

- Novo botão **Editar** na barra da prévia. Ele abre um painel lateral à direita (no celular, por cima
  da tela inteira). As folhas continuam visíveis ao lado. O painel não sai na impressão.
- O painel só aparece para quem pode editar: o professor dono da prova ou o papel `dono` (a mesma regra
  de quem pode ver). Prova excluída não abre (já dá 404).
- **Seção Cabeçalho**: campos Título, Turma, Data (seletor de data), Valor e Instruções (área de texto),
  e o botão **Salvar cabeçalho**. Os erros de validação aparecem junto do campo ou do botão.
- **Seção Questões** (lista na ordem da prova): número, "Matéria · Assunto" e o começo do enunciado
  (cerca de 90 caracteres, texto puro). Cada linha tem:
  - **↑ / ↓**: move uma posição e grava na hora. O ↑ fica desabilitado na primeira questão e o ↓ na última.
  - **Trocar**: pede uma inédita do mesmo assunto (regra abaixo). Se não houver, mostra a pergunta
    "Não há outra inédita deste assunto. Trocar por uma que você já usou?" com **Trocar mesmo assim** e
    **Cancelar**. Se não houver nenhuma, mostra "Não há outra questão deste assunto no banco."
  - **Remover**: confirma ("Remover a questão N?") e grava. Fica desabilitado quando só resta 1 questão.
- Cada ação grava na hora (não há "salvar rascunho"). Depois de gravar, a página recarrega os dados do
  servidor (`router.refresh()`) e a prévia **refaz a paginação** com os dados novos, mostrando
  "Montando a prova…" como hoje. O painel continua aberto e na mesma posição de rolagem.
- Enquanto uma ação está rodando, os botões do painel ficam desabilitados.
- Mensagens de sucesso curtas, por exemplo "Questão 3 trocada." ou "Cabeçalho salvo.".
- O visual segue o resto de `/banco/provas-word` (azul-escuro, sem texto cinza).

## Regra da troca

Questão candidata:
- passa nas mesmas condições de `elegiveis()` (publicada, não anulada, com resposta, sem falta de
  imagem, sem revisão pendente, visível para a escola da prova);
- tem o **mesmo `assunto_id`** da questão trocada. Se a trocada não tem assunto, vale a **mesma matéria**;
- respeita a banca e o intervalo de anos de `provas_word.filtros`, se existirem;
- **não** está nesta prova.

Preferência: primeiro as inéditas do professor dono da prova, sorteadas. Só com a confirmação
"Trocar mesmo assim" entra uma já usada. A nova questão fica na **mesma posição** (`ordem`).

Se a questão trocada não existe mais no banco (foi para a lixeira), usa a matéria e o assunto de
`provas_word.filtros`. Se ainda assim não houver base, mostra "Não dá para trocar esta questão; remova-a."

## Servidor

- Funções novas no núcleo (`src/lib/folha/provas-word-servidor.ts`), para a Hermes poder usar no futuro:
  `salvarCabecalho`, `trocarQuestao`, `removerQuestao` e `moverQuestao` (ou `reordenar`). Todas recebem
  o professor que pede e conferem que a prova é dele (ou que ele é `dono`) e que não foi excluída.
- As regras puras (validar o cabeçalho, escolher a candidata, renumerar a ordem, formatar a data) ficam
  em `src/lib/folha/provas-word.ts` ou em um arquivo puro vizinho, **com testes** (`npm test`).
- Server actions em `src/app/banco/provas-word/acoes.ts`, no mesmo padrão das que já existem
  (`exigirProfessor`, zod, `{ ok: false, erro }` em vez de lançar, `revalidatePath`).
- `dadosFolhaProva` passa a ler `cabecalho` e a lista de questões com "Matéria · Assunto" e o começo do
  enunciado para o painel. O builder decide se isso vai em `dadosFolhaProva` ou numa leitura à parte na
  `page.tsx`.

## Deixado para o builder

- O layout exato do painel e do campo Valor na linha da Nota.
- Como remontar a prévia depois de editar: por exemplo, uma `key` na `<Previa>` derivada de uma versão
  dos dados, ou zerar `resultado`/`divididos` quando `dados` muda. O painel fica fora da parte remontada
  para não perder o estado.
- Se o painel é um componente novo (`Editor.tsx`) ao lado de `Previa.tsx` (recomendado).

## Antes de publicar

Conferir no banco, com uma consulta só de leitura, que a coluna `provas_word.cabecalho` existe. Sem ela
a leitura da prévia quebraria. Até o Peter colar o SQL, o código não vai para o `master`.
