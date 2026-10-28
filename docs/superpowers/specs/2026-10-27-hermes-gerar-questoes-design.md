# Hermes: gerar questões por IA — desenho

Data: 2026-10-27. Continua o gerador de questões (`2026-10-24-gerador-questoes-ia-design.md`), que hoje só
existe na tela `/banco/gerar` e no botão "Gerar parecidas".

## Por quê

O professor já conversa com a Hermes no Telegram para notas, provas, contas e cursos. Gerar questões é a
peça que falta: ele quer pedir "gera 5 questões de porcentagem, nível médio" sem abrir o site, e conferir
depois com calma. O Peter deixou o desenho da conversa por conta do Claude ("confio em vc").

## O que o professor vê (decisão do Claude)

1. Pede em texto livre: matéria, assunto (opcional), dificuldade, quantidade (1–10), uma orientação
   (opcional, ex.: "contexto de supermercado") — ou "parecidas com a questão X".
2. A Hermes resume o pedido e **pede confirmação**, citando o custo aproximado (a IA é paga; o primeiro
   teste real gastou cerca de US$ 0,015 por questão — citar "alguns centavos de dólar") e quanto ainda
   resta da cota de hoje.
3. Confirmado, a Hermes chama `gerar_questoes` e responde na hora: "Comecei a gerar 5 questões de
   Matemática · Porcentagem (média). Leva uns minutos."
4. Depois, `situacao_geracao` devolve, quando pronto, **uma linha por questão**: número, o começo do
   enunciado (~120 caracteres), a resposta certa e o id; o total descartado pela conferência; o custo real;
   e o **link para a revisão no banco** (as questões entram sempre "em revisão", como na tela).
5. Se o professor quiser ler uma inteira, `situacao_geracao` com `numero` devolve a questão completa
   (enunciado, comando, alternativas, resposta, resolução) — a Hermes não tinha como ler uma questão
   inteira (`buscar_questoes` só dá o começo). Daí segue com as ferramentas que já existem:
   `editar_questao`, `publicar_questao` (que já pede confirmação), `mandar_questao_para_lixeira`. Nada novo
   para aprovar.

A Hermes não consegue "voltar sozinha" depois de minutos sem mensagem nova; a instrução para ela é a mesma
da importação: chamar `situacao_geracao` alguns instantes depois e, se ainda estiver gerando, dizer ao
professor que avisa quando ele perguntar de novo (ou chamar mais tarde, se o cliente da Hermes permitir).

## Objetivos

- Ferramenta `gerar_questoes` nos dois MCPs (professor `/api/mcp` e dono `/api/mcp/dono`).
- Ferramenta `situacao_geracao` nos dois MCPs.
- Mesmas regras da tela: cota de 60 por escola por dia (dono sem limite e fora da cota), matéria travada
  com questão modelo, assunto só entre os aprovados, professor só no banco da escola, dono pode escolher o
  banco geral.
- Registro no `hermes_registro`, como as outras ações (`registrado`).

## Fora (não-objetivos)

- Aprovar/publicar em lote pelo Telegram (já dá uma a uma com `publicar_questao`).
- Figuras nas questões geradas, resolução para o aluno (fora também na tela).
- Mudar o prompt, o modelo ou a conferência das geradas.

## Anti-objetivos (seria um fracasso mesmo funcionando)

- Questão gerada aparecer publicada sem ninguém conferir.
- Pedido repetido pela Hermes (por tempo esgotado ou reenvio) gerar e cobrar duas vezes.
- Geração que morreu no meio ficar "gerando" para sempre e comendo a cota.
- Professor gerar no banco geral ou de outra escola.

## Como funciona

### Espera longa (decisão do Claude)

A geração leva até ~4,5 min (`TEMPO_IA_MS = 270 s`); a chamada MCP precisa responder bem antes de 60 s.
Em vez do lote da Anthropic (usado na importação), usar **`after()` do `next/server`**: a ferramenta cria
a linha em `geracoes_ia` (status `gerando`), agenda o resto com `after` e responde já. Para o `after` ter
tempo, os dois routes MCP sobem `maxDuration` de 60 para **300** (é só o teto; as outras ferramentas
continuam rápidas). Ler `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`.

### Divisão do núcleo

`gerarQuestoesPor` (`src/lib/questoes/geracao-servidor.ts`) vira duas partes, sem mudar o comportamento da
tela:

- `comecarGeracaoPor(ator, bruto)` → prepara e valida o pedido, confere a cota, insere `geracoes_ia`
  (`gerando`) e devolve `{ geracaoId, pedido, ... }` com o que a segunda parte precisa.
- `concluirGeracaoPor(...)` → exemplos, chamada à IA, conferência, gravação, `concluida`/`erro` (o
  `try/catch` atual).
- `gerarQuestoesPor` passa a chamar as duas em sequência (a tela continua síncrona).

O tipo do ator passa de `Professor` para o que o código realmente usa (`id`, `role`, `escola_id` — o
`Ator` de `src/lib/questoes/regras`), para aceitar o `AtorEscola` da Hermes.

### `gerar_questoes`

Arquivo novo `src/lib/mcp/acoes/geracao.ts`, registrado em `src/lib/mcp/acoes.ts` para os dois perfis.

Parâmetros:
- `materia` (texto, pelo nome — `materiaDoTexto`), obrigatória sem `questao_modelo_id`;
- `assunto` (texto, opcional — mesma busca por nome de `questoes.ts`, `assuntoDaMateria`; reaproveitar
  movendo para um lugar comum);
- `dificuldade`: `facil` | `media` | `dificil`;
- `quantidade`: 1–10;
- `orientacao` (opcional, até 500);
- `questao_modelo_id` (opcional) = "parecidas com";
- `banco`: `escola` (padrão) | `geral` (só dono; professor recebe o erro da importação, "só no banco da
  sua escola");
- `escola` (só dono, como `importar_prova`) e `professor_telefone`.

Ator: como `importar_prova` (`escolaParaCriar` + `atorDoEscopo`; banco geral → conta do dono). Com
questão modelo, a escola é a da conta (a regra `podeVerQuestao` do núcleo decide se a modelo vale).

Repetição: se já existe geração `gerando` da mesma escola, mesmo professor, mesmo pedido (matéria,
assunto, dificuldade, quantidade, orientação, modelo, escopo) criada há menos de 15 min, não cria outra:
responde "Já estou gerando essas questões (geração X); use situacao_geracao." (como
`textoJaEmAndamento`).

Resposta: id da geração, resumo do pedido, "leva alguns minutos", "chame situacao_geracao com
geracao_id X", e quanto resta da cota hoje (professor).

Dentro do `after`: chamar `concluirGeracaoPor`; o erro já fica gravado na linha (`status = erro`, `erro`),
então o `after` só registra no `console.error`. Depois, `revalidatePath("/banco", "layout")` protegido como
em `questoes.ts`.

### `situacao_geracao`

Parâmetro `geracao_id` (+ `professor_telefone`). Lê `geracoes_ia`; geração de outra escola (professor) →
"Geração não encontrada." sem confirmar que existe. Respostas:

- `gerando` há menos de `MAX_GERANDO_MS` (10 min): "Ainda gerando (começou há N min). Consulte de novo
  daqui a pouco."
- `gerando` há mais que isso: marca `erro` com "A geração parou no meio. Tente de novo." e responde isso
  (a cota já ignora esses casos, `contaNaCota`).
- `erro`: a mensagem gravada (sem o detalhe técnico entre parênteses, se houver).
- `concluida`: as linhas descritas acima (questões com `geracao_id` = X, ordem de criação), descartadas,
  custo (vírgula decimal, como a tela), link `urlDaEscola(slug, "/banco?origem=ia&status=revisao&materia=<chave>")`
  (filtros que `src/app/banco/page.tsx` já aceita). Questão que já foi para a Lixeira some da lista.
- Com `numero` (1..N, na ordem da lista) e geração `concluida`: a questão completa em texto (enunciado,
  comando, alternativas A–E, resposta, resolução, situação atual, id). Número fora da lista → erro claro.

### Instruções da Hermes

Acrescentar ao `INSTRUCOES` dos dois routes: antes de `gerar_questoes`, resumir o pedido e pedir
confirmação citando que a IA é paga (alguns centavos de dólar) e a cota; depois, usar `situacao_geracao`;
se `gerar_questoes` falhar por tempo, não repetir sem perguntar; as questões ficam em revisão e podem ser
publicadas com `publicar_questao`.

## Testes

Partes puras com `tsx --test`, no padrão de `importacao.test.ts`: leitura dos parâmetros (banco geral para
professor, modelo × matéria), texto de resposta de `gerar_questoes` e de `situacao_geracao` (cada status),
critério de pedido repetido, e "gerando velho vira erro". O núcleo dividido mantém os testes existentes
do gerador passando. `npm run lint` e `npm run build` limpos.

## Banco

Nenhum SQL novo: `geracoes_ia` já tem `status`, `erro`, custo e `quantidade_gerada`; `questoes.geracao_id`
já existe. (Conferir com uma consulta só de leitura antes de publicar, como sempre.)

## Deixado para quem constrói

- Nome exato das funções internas e onde mora o `assuntoDaMateria` comum.
- Texto final das respostas, desde que diga as mesmas coisas.

## Decisões do Claude (para o Peter conferir)

- Conversa: confirmação com custo antes, resumo de uma linha por questão depois, revisão no site.
- `after()` + `maxDuration` 300 nos dois MCPs, em vez do lote da Anthropic.
- `numero` em `situacao_geracao` para ler uma questão inteira pelo Telegram.
- Pedido repetido em 15 min não gera de novo.
