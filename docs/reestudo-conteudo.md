# Reestudo: roteiro de produção do conteúdo

Para uma sessão do Claude Code ligada ao MCP do dono (`statusavalia-dono`) que nunca viu este projeto. Este documento basta
para produzir uma matéria de ponta a ponta. A spec completa é `docs/superpowers/specs/2026-11-04-reestudo-design.md`.

## O que se produz

Para cada **assunto** do banco de questões (não por tópico), um material de estudo geral para todas as escolas:

- uma explicação em blocos (sem HTML), de Ensino Médio, até cerca de 600 palavras;
- desenhos (SVG) quando ajudam, e fotos só quando valem a pena;
- exatamente **10 exercícios** de múltipla escolha A a E, cada um com comentário.

Tudo é gravado como `rascunho`. Nada chega ao aluno antes de uma segunda sessão (o conferidor) checar às cegas. Ligar o MCP:
ver "Ligar o Claude Code ao MCP do dono" em `docs/folha-tarefa.md` (o token fica só no `.env.local`; nunca cole no chat).
Nas ferramentas abaixo, `professor_telefone` é opcional no perfil do dono.

## Ordem de liberação

**Matemática primeiro** (25 assuntos), depois **uma matéria por vez**. Não comece outra matéria com a anterior pela metade.
Assunto sem material continua mostrando ao aluno o aviso atual de falta de material.

## Passo a passo (por assunto)

1. **Listar.** `assuntos_para_estudo(materia)` mostra os assuntos aprovados, o número de questões publicadas e a situação do
   material (`sem material`, `rascunho`, `retido`, `em_conferencia`, `publicado`). Pegue um `sem material`.
2. **Ver o banco.** Chame `buscar_questoes` (MCP do dono) com `materia` e `situacao: "publicada"` e uma palavra do assunto em
   `texto` (ela não filtra por assunto; também aceita `banca`, `ano`, `area` e `limite`, até 100) para ver algumas questões e
   acertar o nível e o foco: o que o ENEM e os vestibulares realmente cobram.
3. **Escrever** a explicação, os desenhos e os 10 exercícios, sem copiar de nenhum site (critérios abaixo).
4. **Conferir fatos e datas na Wikipédia, depois de escrito.** Busque o verbete em
   `https://pt.wikipedia.org/api/rest_v1/page/summary/{slug}` com um User-Agent genérico do app (ex.: `StatusAvalia/1.0`); se
   precisar de mais, o conteúdo completo. Corrija o seu texto onde errou. Se houver verbete, use `fonte: "wikipedia"` com
   `fonte_titulo` e `fonte_url` (começa com `https://pt.wikipedia.org/`). Sem verbete, `fonte: "ia"` e sem `fonte_url`.
5. **Gravar.** `salvar_material_estudo` (exemplo abaixo). Grava tudo como `rascunho`. Só aceita assunto sem material, em
   `rascunho`, ou `retido` com uma checagem feita. O que já foi publicado se corrige pelo painel `/banco/estudos`, não por aqui.
6. **Checar.** Um **subagente novo** faz a checagem às cegas (instrução pronta abaixo). Nunca a sessão que escreveu ou corrigiu.
7. **Se algo ficou retido.** Ver "Quando algo é retido".

Anote o `id` do material que o passo 5 devolve: o conferidor precisa dele.

## Critérios de escrita

- **Nível:** Ensino Médio, linguagem clara, direta, para adolescentes.
- **Tamanho:** até cerca de **600 palavras** somando todos os textos dos blocos. A ferramenta **recusa acima de 800**.
- **Texto próprio.** Nunca copie nem parafraseie de perto Wikipédia, Brasil Escola, Toda Matéria ou qualquer site. A Wikipédia
  serve **só para conferir fatos e datas depois de escrito**. Outros sites, no máximo como link, nunca como texto.
- **Exemplos resolvidos** (bloco `exemplo` com `conta` e `conclusao`) e **pegadinhas de prova** (bloco `pegadinhas`).
- **Fórmulas** simples em Unicode (x², ½, √, H₂O). As complicadas viram desenho.
- **Desenhos só quando ajudam** (gráfico, esquema, geometria). Não enfeite.
- **Exercícios:** 10, cada um com 5 alternativas (A a E, nessa ordem), uma só certa, e `comentario` dizendo por que a certa está
  certa e por que as outras não. Variem a letra do gabarito. Dificuldade crescente. Enunciado autocontido.
- **Obras ainda sob direitos autorais** (Modernismo e outros autores): só **trechos curtos**, sempre com a fonte (`autor`).
- **Sem HTML** em nenhum campo. Markdown mínimo (negrito e itálico) só em `paragrafo`.

### Blocos aceitos (`tipo`)

| Tipo | Campos |
|---|---|
| `titulo` | `texto` |
| `paragrafo` | `texto` |
| `lista` | `itens[]` |
| `exemplo` | `enunciado`, `conta?`, `conclusao?` |
| `pegadinhas` | `itens[]` com `titulo` e `texto` |
| `trecho` | `texto`, `autor`, `repare?`, `imagem_id?` |
| `cartoes` | `itens[]` com `titulo`, `subtitulo?`, `texto` |
| `linha_tempo` | `titulo`, `legenda?`, `itens[]` com `ano`, `nome`, `destaque?` |
| `tabela` | `linhas[][]` (a primeira linha é o cabeçalho) |
| `imagem` | `imagem_id` |

Campo fora desta lista é recusado. Em `imagem_id` (blocos) vai a `chave` curta de um desenho ou foto enviados na mesma chamada;
o servidor troca pelo id real.

## Desenhos (SVG)

- Só estes elementos: `svg`, `g`, `path`, `line`, `polyline`, `polygon`, `rect`, `circle`, `ellipse`, `text`, `tspan`, `title`,
  `defs`, `marker`, `linearGradient`, `stop`. Sem `script`, `foreignObject`, `image`, `href`, atributos `on*` nem `style` com `url(`.
- Até **30 KB**. Sempre com `viewBox` e com `alt` (texto alternativo obrigatório na chamada).
- **Todo `<text>` leva `font-family="Arial, sans-serif"`.** Um SVG dentro de `<img>` não herda a fonte da página e, sem isso,
  cai numa fonte com serifa.
- Cores com bom contraste, sem depender só de cor. Exercício pode ter figura, mas **só desenho** (nunca foto).
- Desenho vai ao ar junto com o material.

## Fotos e pinturas

- **Só domínio público ou licença livre**, com `credito`, `licenca` e `fonte_url` (página de origem) obrigatórios.
- A `url` da imagem só pode ser de `upload.wikimedia.org` ou `thumb.wikimedia.org` (https).
- **Adequada a adolescentes: sem nudez, mesmo em arte clássica de domínio público**, e sem conteúdo violento ou impróprio.
- A foto **só aparece ao aluno depois que uma pessoa aprova no painel** (`/banco/estudos`). Até lá o bloco `imagem` some e
  o `trecho` fica sem a foto; o resto do material segue no ar. Por isso o texto deve fazer sentido sem a foto.
- Use foto só quando acrescenta algo (um retrato, um quadro citado no texto).

## Exemplo de chamada: `salvar_material_estudo`

Material mínimo e válido. O exemplo mostra o **exercício 1 por inteiro**; a chamada real traz os **10** (a ferramenta exige
exatamente 10), todos no mesmo formato. Aqui o texto é curto só para servir de molde; o material real tem a explicação completa.

```json
{
  "assunto": "Porcentagem",
  "materia": "Matemática",
  "fonte": "wikipedia",
  "fonte_titulo": "Percentagem",
  "fonte_url": "https://pt.wikipedia.org/wiki/Percentagem",
  "blocos": [
    { "tipo": "titulo", "texto": "O que é porcentagem" },
    { "tipo": "paragrafo", "texto": "Porcentagem é uma fração de denominador 100. Dizer **25%** é o mesmo que dizer 25/100, 0,25 ou ¼." },
    { "tipo": "imagem", "imagem_id": "barra" },
    { "tipo": "exemplo", "enunciado": "Uma camisa de R$ 80,00 tem desconto de 15%. Quanto custa agora?", "conta": "Desconto: 0,15 × 80 = 12. Preço: 80 − 12 = 68.", "conclusao": "A camisa passa a custar R$ 68,00." },
    { "tipo": "pegadinhas", "itens": [
      { "titulo": "Aumento e desconto não se cancelam", "texto": "Aumentar 20% e depois descontar 20% não volta ao valor inicial, porque o segundo percentual incide sobre um valor maior." }
    ] }
  ],
  "desenhos": [
    {
      "chave": "barra",
      "alt": "Barra dividida em quatro partes iguais, com uma parte pintada, representando 25%.",
      "legenda": "25% é uma entre quatro partes iguais.",
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 240 70\"><title>25%</title><rect x=\"10\" y=\"10\" width=\"220\" height=\"30\" fill=\"#fff\" stroke=\"#1e3a8a\"/><rect x=\"10\" y=\"10\" width=\"55\" height=\"30\" fill=\"#f5b800\" stroke=\"#1e3a8a\"/><line x1=\"65\" y1=\"10\" x2=\"65\" y2=\"40\" stroke=\"#1e3a8a\"/><line x1=\"120\" y1=\"10\" x2=\"120\" y2=\"40\" stroke=\"#1e3a8a\"/><line x1=\"175\" y1=\"10\" x2=\"175\" y2=\"40\" stroke=\"#1e3a8a\"/><text x=\"37\" y=\"60\" font-size=\"13\" text-anchor=\"middle\" font-family=\"Arial, sans-serif\" fill=\"#1e3a8a\">25%</text></svg>"
    }
  ],
  "fotos": [],
  "exercicios": [
    {
      "enunciado": "Quanto é 20% de 150?",
      "alternativas": [
        { "letra": "A", "texto": "20" },
        { "letra": "B", "texto": "75" },
        { "letra": "C", "texto": "30" },
        { "letra": "D", "texto": "120" },
        { "letra": "E", "texto": "180" }
      ],
      "resposta_correta": "C",
      "comentario": "20% = 0,2, e 0,2 × 150 = 30. A (20) usa o próprio percentual como se fosse o resultado. B (75) é 50% de 150, a metade, e não 20%. D (120) é o valor depois de tirar 20% (150 − 30), não os 20%. E (180) é o valor depois de somar 20% (150 + 30)."
    }
  ]
}
```

No `comentario`, explique **por que cada alternativa errada está errada**, como acima: o conferidor e o aluno leem isso.

Para um exercício com figura, acrescente `"imagem": "<chave de um desenho>"` (nunca de foto). Para uma foto, o item de `fotos` leva
`chave`, `url`, `alt`, `legenda?`, `credito`, `licenca` e `fonte_url`, e um bloco `imagem` (ou o `imagem_id` de um `trecho`)
cita a `chave`.

Se a chamada for recusada (texto longo, bloco desconhecido, `imagem_id` sem imagem, SVG fora da lista), a mensagem diz o motivo:
corrija e envie de novo. Resposta de sucesso devolve o `id` do material.

## Checagem às cegas (trava 1)

Quem escreve não confere. Abra um **subagente novo**, que não viu o raciocínio do autor, e cole a instrução abaixo trocando
`<ASSUNTO>`, `<MATERIA>` e `<ID_DO_MATERIAL>`. Ele precisa do MCP `statusavalia-dono`.

```
Você é o conferidor independente de um material de estudo do Status Avalia (Ensino Médio). Você NÃO escreveu este material e
não pode escrever, corrigir nem regravar nada: só ler e dar o parecer.

Assunto: <ASSUNTO>. Matéria: <MATERIA>. Id do material: <ID_DO_MATERIAL>.

1. PRIMEIRA LEITURA, ÀS CEGAS. Chame ler_material_estudo com assunto, materia e as_cegas: true. Leia a explicação. Depois resolva
   você mesmo cada um dos exercícios, sem nenhum gabarito: anote a letra que VOCÊ encontrou para cada ordem (ou null se não
   houver resposta certa ou houver mais de uma). Anote também problemas: enunciado ambíguo, alternativa duplicada ou errada,
   figura que não bate com o enunciado, nível inadequado, texto confuso.
2. SÓ DEPOIS, leitura completa: chame ler_material_estudo com as_cegas: false. Confira os comentários e o gabarito, e confira
   os fatos, datas, nomes e contas do texto (use https://pt.wikipedia.org/api/rest_v1/page/summary/{slug} com User-Agent
   genérico quando precisar). Não mude a resposta que você encontrou na etapa 1 por ter visto o gabarito.
3. Chame registrar_checagem_estudo com material = <ID_DO_MATERIAL>, verificador = um nome para você (ex.: "conferidor-1"),
   texto = { ok, problema? } e, para CADA exercício pendente, { ordem, ok, resposta_encontrada, problema? }. Use ok: false
   quando o enunciado, as alternativas, o comentário ou o gabarito tiverem erro, mesmo que você tenha chegado à letra certa.
   resposta_encontrada é a letra da etapa 1. Descreva cada problema de forma que o autor consiga corrigir.
4. Responda só com o resultado devolvido pela ferramenta e a lista de problemas. Não proponha textos novos nem corrija.
```

Regras de decisão (automáticas, no servidor):

- Exercício: `publicado` se `ok` e a `resposta_encontrada` é igual ao gabarito; senão `retido`.
- Material: `publicado` se o texto passou e **pelo menos 5** exercícios passaram; senão `retido`, com o motivo.
- Todo exercício pendente precisa de parecer, ou a chamada é recusada.
- Ao publicar, cerca de 1 em cada 5 assuntos é marcado para o dono ler depois (amostra).

## Quando algo é retido

1. Leia o motivo (`ler_material_estudo` sem `as_cegas`, ou `avisos_estudo()` para ver tudo o que está retido).
2. **Corrija uma vez.** Texto, desenhos ou vários exercícios: regrave com `salvar_material_estudo` (aceita material `retido`
   que passou por uma checagem). Um exercício só: `corrigir_exercicio_estudo(material, ordem, enunciado, alternativas,
   resposta_correta, comentario)`. O item volta a `rascunho`.
3. **Novo conferidor**, subagente diferente do anterior e diferente de quem corrigiu, com a mesma instrução. No material
   já publicado, só os exercícios corrigidos são reconferidos (o parecer do texto é ignorado).
   Atenção: **pendente** é o exercício com `situacao: "rascunho"`; só ele recebe parecer na checagem. Exercício `retido` só
   volta a ser pendente depois de corrigido.
   `corrigir_exercicio_estudo` **não troca a figura** do exercício (mantém a que ele já tinha): se a figura precisa mudar,
   regrave o material inteiro com `salvar_material_estudo`. E **se o texto foi reprovado, a correção é regravar** o material:
   o MCP recusa nova checagem de material `retido` por texto reprovado enquanto ele não for regravado.
4. **Na segunda divergência o item fica para uma pessoa.** O MCP passa a recusar regravar e corrigir; o item aparece em
   "Retidos" no painel `/banco/estudos`, onde o dono edita e publica. Não insista nem contorne.

Exercício `retido` em material `publicado`: o resto segue no ar, e o exercício entra quando for corrigido e passar na checagem.

## Cuidados

- Leituras paginadas do PostgREST (Supabase) em qualquer script ou consulta: sempre com `order` fixo, senão linhas se repetem
  ou somem entre páginas.
- Gerar material não usa API paga: a escrita é a própria sessão, e a gravação é pelo MCP.
- Não toque no que está `publicado` ou `em_conferencia` por esta via; isso é do painel e do dono.
- Dúvida sobre foto ou texto sensível: não envie. Melhor um material sem a foto.
