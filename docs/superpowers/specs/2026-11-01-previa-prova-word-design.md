# Pré-visualizar, imprimir e baixar a prova em Word (PDF pelo navegador)

Data: 2026-11-01. Pedido do Peter, com as decisões técnicas deixadas para o Claude ("faça como achar melhor").

## Por quê

Hoje, para ver uma prova gerada em `/banco/provas-word`, o professor (ou a diretora) precisa baixar o .docx e
abrir no Word. O Peter quer:

- um botão **Pré-visualizar** que abre a prova em **tela cheia** dentro do site;
- dentro da pré-visualização, um botão **Imprimir** para mandar direto para a impressora;
- dentro da pré-visualização, um botão **Baixar** com uma setinha (menu) para escolher **Word** ou **PDF**;
- fora da pré-visualização (no histórico), as mesmas opções de baixar em **Word** ou **PDF**.

Vale para provas **já geradas**: logo depois de gerar (bloco de resultado do formulário) e no histórico. Não
existe pré-visualização antes do sorteio (confirmado pelo Peter).

## Decisão sobre o PDF (do Peter)

Um teste (2026-11-01) mostrou que desenhar o .docx no navegador com a biblioteca `docx-preview` não serve: ela
não pagina (a prova vira uma folha comprida com as duas colunas esticadas), o cabeçalho cai sozinho numa
página e as linhas de identificação somem. PDF fiel ao Word exigiria um servidor de conversão (LibreOffice) pago
(~US$ 5/mês). **O Peter escolheu o caminho sem custo:**

- o site **desenha a própria pré-visualização** em páginas A4, imitando a folha do Word;
- **Imprimir** imprime essas páginas pelo navegador;
- **Baixar PDF** abre a janela de impressão do navegador para o professor escolher "Salvar como PDF" (não é um
  download direto; a tela avisa isso);
- **Baixar Word** é o .docx de hoje (rota existente).

## Objetivos

1. Página de pré-visualização em tela cheia para a prova e para o gabarito, com cara de folha A4 (fundo
   cinza, páginas brancas com sombra), fiel o bastante para o professor decidir se imprime.
2. O que se vê é o que se imprime: as mesmas páginas, com as mesmas quebras.
3. Barra de ações fixa no topo da pré-visualização: **Voltar**, alternância **Prova / Gabarito**, **Imprimir**,
   **Baixar ▾** (Word, PDF).
4. No histórico e no resultado de "Gerar prova": **Pré-visualizar** e **Baixar ▾** (Prova em Word, Gabarito em
   Word, Prova em PDF, Gabarito em PDF).

## Não objetivos

- Ser idêntico ao Word pixel a pixel (quebras de página podem cair em lugares diferentes do Word).
- PDF baixado direto do servidor.
- Mudar o .docx, a Hermes ou os links sem login (`?c=`). A Hermes continua mandando os links do Word.
- Pré-visualização antes de gerar.
- Editar a prova na pré-visualização.

## Anti-objetivos (seria falha mesmo funcionando)

- A pré-visualização ou a impressão sair com botões, menus ou barra do site no papel.
- Prova impressa com coluna da esquerda indo até o fim do documento antes da direita (o defeito do teste).
- Questão de outro professor aparecer para quem não é dono dela (mesma regra do download: dono da prova ou papel
  `dono`; senão 404).
- Texto cinza fora do que já é cinza na folha do Word (créditos/origem pequenos).

## Como a folha deve parecer (referência: `src/lib/folha/docx.ts`)

Copiar as medidas e cores do .docx (as constantes estão no topo de `docx.ts`):

- A4 (21 × 29,7 cm), margem lateral 1,5 cm, topo 1,2 cm; duas colunas com 0,8 cm entre elas e fio vertical
  entre as colunas.
- 1ª página: cabeçalho com logo (só escola Status, mesma regra de hoje: `ESCOLA_PADRAO_ID`), título, linhas
  Aluno(a)/Nº/Turma e Professor(a)/Data/Nota com traços para preencher (no gabarito: título + "Gabarito
  comentado", sem linhas). Páginas seguintes: título curto em versalete pequeno e fio azul claro.
- Rodapé em todas: "Simulado · caderno de questões" (ou "· gabarito comentado") e número da página.
- Faixa da matéria ("FÍSICA … questões 01 a 06"), título "QUESTÃO 01" com a barra cinza, texto Arial 9 pt
  justificado com recuo de 1ª linha, figuras na largura da coluna no máximo, crédito/origem pequenos à direita,
  bolinhas pretas das alternativas (`public/folha/alternativa-A..E.png`), tabela do markdown, "[Figura
  indisponível]", aviso final de questões que saíram do banco.
- Mesmas regras de texto do .docx: `comandoRepetido`, `partesDoTexto`/`celulasTabela`, `separarCredito`,
  `conteudo` (TipTap) quando houver, figura de alternativa abaixo da alternativa.
- Gabarito: mesmas faixas e títulos; "Resposta:" com a bolinha da letra; resolução quando houver.

Fontes: Arial para as questões e Calibri para cabeçalho/faixas/rodapé, como no Word, com alternativas genéricas
(`Arial, Helvetica, "Liberation Sans", sans-serif`; `Calibri, Carlito, "Segoe UI", sans-serif`).

## Paginação (decisão do Claude)

O navegador não pagina colunas de forma confiável na tela, então a pré-visualização **pagina sozinha**:

- O conteúdo vira uma lista de blocos na ordem do .docx (faixa da matéria, título da questão, parágrafo, figura,
  crédito, comando, cada alternativa, aviso final).
- Os blocos são medidos no navegador na largura de uma coluna e distribuídos: enche a coluna da esquerda, depois
  a da direita, depois a próxima página. A 1ª página tem menos altura útil por causa do cabeçalho.
- "Título da questão" nunca fica sozinho no pé de uma coluna (vai junto com o bloco seguinte).
- Um bloco mais alto que uma coluna inteira (raro: parágrafo enorme ou figura muito alta) é quebrado por linhas
  (parágrafo) ou reduzido para caber (figura). Como fazer isso fica com quem implementar.
- Repaginar quando as fontes e as imagens terminarem de carregar (senão as medidas mudam).
- Na impressão: `@page { size: A4; margin: 0 }`, uma página do site = uma folha, sem a barra de ações.

## De onde vêm os dados

- Nova página `src/app/banco/provas-word/[id]/previa/page.tsx` (servidor): exige professor da sessão (sem →
  `/login`); prova inexistente, excluída ou de outro professor (que não seja `dono`) → `notFound()`.
- Reaproveitar o carregamento de `montarArquivoProva` (questões na ordem, `carregarQuestoesFolha`, figuras
  recortadas com sharp, escola, logo, aviso de faltando). Separar em uma função que devolve os dados da folha
  (`DadosFolha`-like) para o .docx e para a pré-visualização usarem a mesma coisa.
- Figuras, logo e bolinhas vão para a tela como `data:` URL PNG (já estão em memória como Buffer). Limite de 60
  questões mantém isso num tamanho aceitável.
- `?qual=gabarito` abre no gabarito; `?imprimir=1` abre e chama a janela de impressão quando a paginação
  terminar (é o que "Baixar PDF" faz, vindo do histórico ou de dentro da pré-visualização).

## Botões e textos

- Histórico (`Historico.tsx`) e resultado de gerar (`NovaProva.tsx`): trocar "Baixar prova"/"Baixar gabarito"
  por **Pré-visualizar** (abre `/banco/provas-word/<id>/previa`) e **Baixar ▾** com 4 itens: "Prova (Word)",
  "Gabarito (Word)", "Prova (PDF)", "Gabarito (PDF)". Word = rota atual; PDF = pré-visualização com
  `?imprimir=1` (e `qual`) em nova aba.
- Pré-visualização: barra fixa no topo, padrão visual das telas do professor (azul-escuro, sem texto cinza):
  **← Voltar** (para `/banco/provas-word`), **Prova | Gabarito**, **Imprimir**, **Baixar ▾** ("Word" baixa o
  .docx do que está aberto; "PDF" abre a impressão).
- Ao escolher PDF, mostrar um aviso curto antes/depois de abrir a impressão: "Na janela de impressão, escolha
  **Salvar como PDF** no destino."
- Enquanto pagina: "Montando a prova…".
- Celular: a página pode ser rolada e as folhas ficam reduzidas para caber na largura; imprimir continua A4.

## Restrições

- Next.js 16.2: ler o guia em `node_modules/next/dist/docs/` antes da página nova (`params` é Promise etc.).
- Sem dependência nova (paginação própria). Sem SQL novo. Sem variável de ambiente nova.
- A pré-visualização e o .docx devem partir das mesmas regras puras de texto; regras novas ficam em módulos
  puros com teste (`tsx --test`; não importar módulos de servidor nos testes; adicionar o arquivo ao `npm test`).
- Rodar `npm test`, `npm run lint`, `npm run build`.
- Conferir no www, logado, depois do deploy: abrir a prova de Física UFGD 2023 (6 questões, 5 figuras), comparar
  com o PDF do Word e imprimir para PDF pelo navegador.

## Decisões do Claude depois da revisão

- **Estrutura comum (refator permitido):** a lógica que hoje está dentro de `docx.ts` e decide *o que* vai na
  folha (`blocosEnunciado`, `blocosComTabelas`, crédito + origem, comando pulado por `comandoRepetido`, ordem
  alternativa → figura da alternativa, faixas por matéria de `comFaixas`) passa para um módulo puro (ex.:
  `src/lib/folha/estrutura.ts`) que devolve uma lista neutra de blocos. `docx.ts` e a pré-visualização desenham
  essa lista. O .docx tem de sair **igual ao de hoje**: antes do refator, gravar o `word/document.xml` de folhas de
  referência (questão com `conteudo`, com markdown + tabela, com figura, com figura indisponível, com comando
  repetido, gabarito) e o teste compara depois do refator.
- **Tamanho das figuras:** na pré-visualização, cada figura é reduzida com sharp para no máximo ~1100 px de largura
  (≈ 300 dpi na largura da coluna, impressão nítida) antes de virar `data:` URL; o .docx continua com a resolução
  original. Teste de aceite também com uma prova grande (60 questões, das matérias com mais figuras, ex.:
  Matemática UEMS/UFMS): medir o tamanho do HTML da página localmente; se passar de ~4 MB, reduzir mais (ou
  JPEG para fotos) até caber, e registrar o número no relatório.

## O que fica para quem implementar

- Estrutura dos componentes, o algoritmo exato de medição e distribuição, como quebrar parágrafo longo.
- Se a página é client component inteira ou servidor + cliente.
- O desenho exato do menu "Baixar ▾" (seguindo os componentes que o site já tem).
