# Importação de provas pela Hermes (etapa B2)

Data: 2026-10-23 · Status: escopo já aprovado na spec da Hermes (`2026-10-12-hermes-assistente-pessoal-design.md`, Etapa B, "Importação de provas pela própria Hermes"); este documento fecha o desenho técnico, que o Peter delegou ao Claude ("b2").

## Objetivo

O Peter manda o PDF da prova, e o do gabarito, para a Hermes pelo Telegram. Ela importa, a IA lê as questões e elas caem no banco para conferir, **exatamente como na tela "Importar prova"**. Depois a Hermes acompanha a leitura, manda ler de novo as páginas com erro e aprova as questões sem aviso.

Sucesso = "Hermes, importe esta prova da UFMS 2025, páginas 2 a 30, gabarito na página 1", e minutos depois as questões estão na conferência, com as páginas originais ao lado para recortar figuras, igual a uma importação feita pela tela.

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Como as páginas viram imagem | **O servidor desenha cada página em JPEG** com o `pdfjs-dist` (já instalado) e o `@napi-rs/canvas` (já vem com ele no `package-lock`). Usa os mesmos parâmetros da tela: 150 dpi, largura máxima 1600, fundo branco, qualidade 0,8 | Tudo o que vem depois fica igual: storage `importacao/<id>/prova-N.jpg`, `importacao_paginas` com largura e altura, leitura pela IA por imagem, conferência com recorte. A alternativa (guardar PDFs de 1 página e mudar a conferência para PDF) mexeria em telas que acabaram de ficar boas |
| Como o PDF chega | Por **link https** (o link do arquivo no Telegram que a Hermes repassa) ou em **base64**. Até **30 MB** por arquivo, 30 s para baixar, só `https`, e o arquivo precisa começar com `%PDF` | Mesmo limite da spec. Recusar `http`, IPs privados e `localhost` evita usar o servidor para chamar endereços internos |
| PDF original | Guardado no storage privado (`importacao/<id>/original-prova.pdf` e `original-gabarito.pdf`) | O link do Telegram expira. O desenho das páginas continua de onde parou, a partir da cópia guardada |
| Tempo da Vercel (60 s por chamada) | O desenho é **em etapas**. Cada chamada desenha páginas até **~40 s** e para. `situacao_importacao` continua de onde parou. Quando todas as páginas estiverem desenhadas, a leitura pela IA começa sozinha. A Hermes é instruída a chamar `situacao_importacao` até aparecer "lendo" | Uma prova de 60 páginas não cabe numa chamada só. Assim não depende do plano da Vercel |
| Mesmas regras da tela | Ações de importação num núcleo com ator explícito (como na etapa B): `criarImportacaoPor`, `registrarPaginaPor`, `iniciarLeituraPor`, `atualizarImportacaoPor`, `lerDeNovoPor`, `aprovarSemAvisoPor`. A tela continua igual por fora | Resultado idêntico ao da tela, com as mesmas permissões (`podeImportar`: banco geral só o dono, banco da escola admin e dono) |
| Páginas | O mesmo texto da tela: "todas" ou "3", "1-20, 23" (`lerPaginas`), no máximo 60 por arquivo | Mesma regra |
| Selo e registro | `importacoes.criado_via = 'hermes'` (a coluna já existe). Toda ferramenta passa por `executarRegistrado` | Padrão da etapa B |
| Custo | Antes de importar, a Hermes **resume e pede confirmação**, incluindo o custo estimado (`estimarCustoPaginas`), porque a leitura pela IA é paga | Ação que gasta dinheiro |

## Ferramentas (perfis dono e professor; professor só no banco da escola)

- **`importar_prova`**: `prova_url` ou `prova_base64`, `gabarito_url` ou `gabarito_base64` (opcional), `paginas_prova` ("todas" ou o texto), `paginas_gabarito`, `banca`, `ano`, `caderno`, `banco` ("escola" ou "geral"), `escola` (dono), `professor_telefone`.
  - Valida e baixa, guarda os originais, cria a importação (`criado_via = 'hermes'`) e desenha a primeira leva de páginas.
  - Responde com o id, as páginas prontas e as que faltam, o custo estimado e "chame situacao_importacao".
- **`situacao_importacao`** (`importacao_id`):
  - se ainda faltam páginas, desenha a próxima leva;
  - quando todas estiverem prontas, inicia a leitura (uma vez só);
  - se já está lendo, faz o mesmo que a tela faz ao atualizar (`atualizarImportacao`: busca o resultado do lote, grava as questões).
  - Responde com a situação, as questões criadas, as páginas com erro e o link da conferência.
- **`ler_de_novo`** (`importacao_id`): o mesmo que o botão da tela.
- **`aprovar_sem_aviso`** (`importacao_id`): o mesmo que o botão da tela. Pede confirmação.

## Banco (SQL manual)

- **Bucket `questoes`:** aceitar `application/pdf` e arquivos até 30 MB, mantendo os tipos que já estão lá (o mesmo `update storage.buckets` do commit `43702ff`, revisado).
- Nenhuma tabela nova. As páginas desenhadas usam `importacao_paginas`, como hoje.

## Não pode acontecer

- **Professor** importar no **banco geral** ou para outra escola.
- **Servidor baixar** de `http`, `localhost`, IP privado ou um arquivo acima de 30 MB. O download para no limite, sem baixar tudo antes de recusar.
- **Leitura pela IA começar duas vezes** para a mesma importação. O passo de reservar, que já existe, continua valendo.
- **Importação travar no meio.** Se uma página falhar ao desenhar, a importação vai para o estado "erro" com a página citada, e a Hermes diz isso.
- **A tela de importar** mudar de comportamento.

## Testes

- **Unidade:**
  - validação do link (https, host, IP privado);
  - validação dos bytes (`%PDF`, tamanho);
  - texto das páginas;
  - divisão em levas por tempo;
  - textos de resposta das ferramentas.
- **Desenho real** de um PDF pequeno guardado no repositório, de 2 páginas e feito por nós: gera JPEG com o tamanho esperado.
- **Ponta a ponta na HARMONIA, sem gastar IA:** importar um PDF pequeno pela ferramenta até "todas as páginas desenhadas", conferindo os arquivos no storage e as linhas em `importacao_paginas`. A leitura pela IA precisa da `ANTHROPIC_API_KEY`, que existe só na Vercel: o primeiro teste com leitura de verdade é o Peter pela Hermes, depois de publicado.
