# Reestudo: "Estudar este conteúdo"

Data: 2026-11-04. É o "guia de estudos da própria plataforma" que o Peter tinha deixado para depois, e vem antes do
projeto 4 (IA). O Peter aprovou o caminho em conversa; este documento é o que ele ainda precisa aprovar antes de
qualquer código, com o esquema SQL e a estrutura de pastas que ele pediu para ver.

## Por quê

O aluno termina um simulado, vê o que errou e não tem onde aprender. O plano de estudo (projeto 3) já diz o que
fazer, mas a etapa "Revisar o conteúdo" está vazia: `materiais_revisao` tem 0 linhas. O aluno vê "Ainda não há
material de revisão" e só consegue praticar. Este módulo preenche esse vazio com uma explicação escrita por assunto e
exercícios de fixação, em todas as matérias do Ensino Médio.

**Sucesso:** um aluno que errou um assunto abre a explicação, entende, testa nos exercícios e vai para a prática com
questões reais, sem sair da plataforma e sem depender de o professor cadastrar material.

## O que o Peter decidiu

- Vale para **todas as matérias** do Ensino Médio.
- **Só conteúdo escrito.** Nada de áudio: sem botão "Ouvir", sem TTS, sem a etapa F do pedido original.
- **Um material por assunto**, não por tópico. São 179 assuntos em uso (ver "Como está hoje").
- **10 exercícios de fixação** por assunto, não 3.
- **Imagens na explicação**: gráficos, esquemas, linhas do tempo e fotos.
- **Publicação automática com quatro travas** (seção "As quatro travas"). Isso substitui a regra do pedido original de
  que o aluno só lê material com `revisado = true`.
- **Texto próprio.** A explicação é escrita para o Ensino Médio, e a Wikipédia em português serve só para conferir
  fatos e datas depois de escrito. Isso muda o pedido original, que era reescrever o verbete: um texto adaptado herdaria a
  licença CC BY-SA, e qualquer um poderia copiá-lo, o que pesa porque a plataforma vai vender cursos. Nada copiado de sites
  como Brasil Escola ou Toda Matéria: esses entram no máximo como link.
- **Erro achado pela checagem:** corrige-se uma vez, um novo conferidor checa, e só o que continuar com divergência vai para
  uma pessoa.
- Até umas 600 palavras, linguagem clara, exemplos resolvidos e pegadinhas de prova.
- O material é gerado uma vez por assunto e reaproveitado por todos os alunos. Nunca é gerado no acesso.
- Chaves só no servidor.

As telas foram aprovadas por esboço: `docs/superpowers/specs/assets/2026-11-04-reestudo/tela-literatura.html` (abra
no navegador; tem botão Computador/Celular e os exercícios funcionam). Ela é a referência visual deste documento.

## Fora do escopo

- Áudio, em qualquer forma.
- Classificar questões por tópico com IA (etapa B do pedido). Com material por assunto, ela deixa de ser necessária:
  6.375 das 6.377 questões publicadas já têm assunto.
- Material por tópico. A estrutura não fecha essa porta, mas não se constrói agora.
- Revisores por matéria e vínculo professor ↔ matéria. Com publicação automática, quem lê a amostra é o dono.
- Geração no servidor pela API do Claude. A API está sem crédito; o conteúdo é escrito em sessões do Claude Code pela
  assinatura, gravado pelo MCP do dono (mesmo caminho do `salvar_questoes`).
- Fórmulas tipográficas (KaTeX). Fórmulas simples em Unicode (H₂O, x²); as complicadas viram desenho.
- Enviar foto pelo painel. Fotos entram pelo MCP.
- Refazer os exercícios de fixação. A primeira resposta fica.
- Material próprio de uma escola: o material é geral.

## Anti-objetivos

Falhou, mesmo funcionando, se:

- o aluno tiver duas listas diferentes do que estudar (uma do plano, outra do reestudo);
- uma foto ou pintura chegar ao aluno sem uma pessoa ter olhado;
- um texto copiar ou parafrasear de perto a Wikipédia ou qualquer outro site;
- a resposta certa de um exercício vier no HTML da página;
- exercício de fixação mudar número do desempenho;
- gerar material custar dinheiro de API ou depender de acesso do aluno.

## Como está hoje (levantado em 2026-11-04)

- **Banco:** 6.377 questões publicadas; 6.375 com assunto. Assuntos em uso por matéria: Matemática 25, História 30,
  Física 16, Química 16, Biologia 16, Geografia 16, Português 12, Literatura 11, Sociologia 8, Filosofia 7, Artes 7,
  Inglês 5, Espanhol 5, Educação Física 5. Total: 179.
- **Tópicos:** 268, só de Matemática e Português; 5 questões têm tópico. Por isso a unidade é o assunto.
- **Plano:** a chave do conteúdo é o id do assunto (`src/lib/desempenho/calculos.ts`, `chaveConteudo`). A etapa
  "revisar" é marcada por `plano_revisoes` (`marcarRevisado` em `src/actions/plano-estudo.ts`).
  `src/lib/plano/extras.ts` monta os materiais; `MateriaisConteudo.tsx` os mostra no plano e no painel "Meu desempenho".
- **Vídeo de apoio:** `materiais_revisao` já guarda aula ou link por assunto, cadastrado em `/banco/assuntos`.
  Não se cria nada novo para isso.
- **Resultado do simulado:** `ResultadoAluno.tsx` tem a seção "Revise isto" com `TreinarAssunto`.
- **Texto sem HTML:** `markdownParaBlocos` e `partesDoTexto` (`src/lib/questoes/markdown.ts`) são o markdown mínimo do
  projeto; tudo passa pelo React como texto escapado.
- **Segurança do banco:** o site usa login próprio, não o Supabase Auth, e fala com o banco pelo servidor com a chave
  anônima. As políticas RLS são `using (true)` em tudo. A chave não aparece em nenhum JS público (conferido em
  2026-11-04), então a proteção real está no servidor. Consequência: **RLS por aluno, como o pedido sugeria, não é
  possível** (o banco não sabe quem é o aluno). A regra "o aluno só vê o que está publicado" fica no servidor, em
  `src/lib/estudos/`, como todas as outras do projeto.

## O caminho do aluno

1. Entrega o simulado. Em "Revise isto", cada assunto com material publicado ganha o botão **Estudar este conteúdo**.
2. No plano, na etapa "Revisar o conteúdo", e no painel "Meu desempenho", o mesmo link aparece em `MateriaisConteudo`.
   Não há tela nem lista paralela: "Estudar" **é** essa etapa.
3. `/aluno/estudar/<assuntoId>`: cabeçalho, faixa de etapas, explicação, 10 exercícios, próximo passo.
4. "Já estudei" chama `marcarRevisado`, e a etapa fica feita no plano.
5. O botão principal do fim é o próximo treino, pela regra `etapaDeTreino` (`src/lib/plano/plano.ts`), via
   `BotaoTreinoPlano`. O "Refazer simulado" do pedido virou isso, como o esboço mostra.

**Variações do fim da página:**

| Situação do assunto no plano | Faixa de etapas | Botão principal |
|---|---|---|
| "revisar" | Estudar, Praticar, Revisão | `etapaDeTreino`; nada se a revisão aguarda a data |
| "mais respostas" | Sem faixa | "Fazer diagnóstico" |
| "concluído" | Sem faixa | "Estudar de novo" |
| Fora do plano | Sem faixa | `TreinarAssunto` |

O acesso não exige estar no plano: todo aluno logado abre qualquer assunto publicado. Essa regra fica numa função só
(`podeEstudar`), para a loja poder restringir depois.

**Sem material publicado:** a página mostra "Ainda não há explicação para este conteúdo" e o link de volta ao plano.
Em conferência, "Este conteúdo está sendo conferido e volta em breve". Nos dois casos, o link "Estudar" não aparece no
plano, no painel nem no resultado, e o aviso atual de falta de material continua valendo.

### Exercícios na tela

Um por vez, com barra de progresso, bolinhas numeradas (verde acertou, vermelho errou) que levam a qualquer exercício,
Anterior e Próxima. No computador, a coluna fica fixa ao rolar a explicação; no celular, vem depois do texto.

A correção é sempre no servidor: a página recebe enunciado e alternativas, e `responderExercicio` devolve se acertou,
a letra certa e o comentário. Exercício já respondido volta da página com a resposta e a correção. A primeira resposta
fica, e nada disso conta no desempenho nem nas respostas usadas pelo painel.

Exercício pode ter uma figura, sempre desenho. Geometria e leitura de gráficos, que estão em Matemática, precisam disso.

**Exercício corrigido:** se o dono mudar enunciado, figura, alternativas ou gabarito de um exercício que já tem respostas,
elas são apagadas. Recalcular não resolve, porque a letra marcada pode apontar para outro texto, e como essas respostas não
contam em nada, o aluno só responde de novo. Corrigir apenas o comentário não apaga.

## Formato do conteúdo

`materiais_estudo.blocos` é uma lista de blocos validada por zod, sem HTML:

| Tipo | Campos |
|---|---|
| `titulo` | `texto` |
| `paragrafo` | `texto` (negrito e itálico do markdown mínimo) |
| `lista` | `itens[]` |
| `exemplo` | `enunciado`, `conta?`, `conclusao?` |
| `pegadinhas` | `itens[]` com `titulo` e `texto` |
| `trecho` | `texto` (com quebras de linha), `autor`, `repare?`, `imagem_id?` |
| `cartoes` | `itens[]` com `titulo`, `subtitulo?`, `texto` |
| `linha_tempo` | `titulo`, `legenda?`, `itens[]` com `ano`, `nome`, `destaque?` |
| `tabela` | `linhas[][]` |
| `imagem` | `imagem_id` |

`salvar_material_estudo` recusa mais de 800 palavras somando os textos (a meta é 600), bloco desconhecido e
`imagem_id` que não pertença ao material.

## Imagens

**Desenhos (gráficos e esquemas):** SVG guardado como texto em `imagens_estudo.svg` e mostrado por
`<img src="data:image/svg+xml;base64,...">`, com `alt` obrigatório. Dentro de `<img>`, o SVG não executa script nem
carrega nada de fora. Ao gravar, `src/lib/estudos/svg.ts` aceita só uma lista fechada de elementos (`svg`, `g`, `path`,
`line`, `polyline`, `polygon`, `rect`, `circle`, `ellipse`, `text`, `tspan`, `title`, `defs`, `marker`, `linearGradient`,
`stop`), recusa atributos `on*`, `href` e `style` com `url(`, e limita o tamanho a 30 KB. Foi escolhido em vez de PNG
porque não exige fonte no servidor da Vercel. Desenho vai ao ar com o material.

**Fotos e pinturas:** só domínio público ou licença livre, com crédito e licença obrigatórios. `salvar_material_estudo` recebe
a URL de cada foto e só aceita `upload.wikimedia.org` e `thumb.wikimedia.org`. O servidor baixa, passa por `sharp` (WebP, largura
máxima de 900 px, sem metadados) e grava no bucket público `estudos`. **Foto só aparece depois que uma pessoa aprovar
no painel.** Ela nasce junto com o material, já no seu lugar no texto; sem aprovação, o bloco `imagem` some, o bloco `trecho`
fica sem a foto e o resto segue no ar. Os leitores são adolescentes: uma pintura clássica com
nudez, por exemplo, não entra, mesmo sendo de domínio público.

## Esquema SQL

Arquivo `db/2026-11-04-reestudo.sql`, também acrescentado a `db/schema.sql`. O Peter cola no SQL Editor, e nada é
publicado antes de conferir no banco. Só tabelas novas; nenhuma existente muda.

```sql
-- ===== Reestudo (2026-11-04) =====

-- Um material por assunto, geral para todas as escolas.
create table if not exists materiais_estudo (
    id uuid primary key default gen_random_uuid(),
    assunto_id uuid not null unique references assuntos(id) on delete cascade,
    blocos jsonb not null,
    fonte varchar(10) not null check (fonte in ('wikipedia', 'ia')),  -- wikipedia = fatos conferidos em verbete
    fonte_titulo text,                    -- título do verbete usado na conferência
    fonte_url text,                       -- link do verbete
    situacao varchar(14) not null default 'rascunho'
        check (situacao in ('rascunho', 'retido', 'publicado', 'em_conferencia')),
    motivo text,                          -- por que ficou retido
    checagem jsonb,                       -- parecer da segunda checagem
    checado_em timestamptz,
    checagens smallint not null default 0,    -- quantas checagens já fez
    amostra boolean not null default false,   -- sorteado para leitura humana
    lido_por uuid references professores(id) on delete set null,
    lido_em timestamptz,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    constraint materiais_estudo_fonte_url_check check (
        (fonte = 'wikipedia' and fonte_url like 'https://pt.wikipedia.org/%') or (fonte = 'ia' and fonte_url is null)
    )
);
create index if not exists idx_materiais_estudo_situacao on materiais_estudo (situacao);

create table if not exists imagens_estudo (
    id uuid primary key default gen_random_uuid(),
    material_id uuid not null references materiais_estudo(id) on delete cascade,
    tipo varchar(7) not null check (tipo in ('desenho', 'foto')),
    svg text,                             -- desenho
    storage_path text,                    -- foto, no bucket `estudos`
    alt text not null,
    legenda text,
    credito text,
    licenca text,
    fonte_url text,
    aprovada_por uuid references professores(id) on delete set null,
    aprovada_em timestamptz,
    criado_em timestamptz not null default now(),
    constraint imagens_estudo_tipo_dados_check check (
        (tipo = 'desenho' and svg is not null and storage_path is null)
        or (tipo = 'foto' and storage_path is not null and svg is null and credito is not null and licenca is not null)
    )
);
create index if not exists idx_imagens_estudo_material on imagens_estudo (material_id);

create table if not exists exercicios_fixacao (
    id uuid primary key default gen_random_uuid(),
    material_id uuid not null references materiais_estudo(id) on delete cascade,
    ordem smallint not null check (ordem between 1 and 10),
    enunciado text not null,
    imagem_id uuid references imagens_estudo(id) on delete set null,  -- só desenho
    alternativas jsonb not null check (jsonb_array_length(alternativas) = 5),  -- [{letra, texto}]
    resposta_correta char(1) not null check (resposta_correta in ('A', 'B', 'C', 'D', 'E')),
    comentario text not null,
    situacao varchar(14) not null default 'rascunho'
        check (situacao in ('rascunho', 'retido', 'publicado', 'em_conferencia')),
    motivo text,
    checagens smallint not null default 0,
    unique (material_id, ordem)
);

-- Primeira resposta de cada aluno a cada exercício. Não entra no desempenho.
create table if not exists respostas_fixacao (
    conta_id uuid not null references alunos_contas(id) on delete cascade,
    exercicio_id uuid not null references exercicios_fixacao(id) on delete cascade,
    marcada char(1) not null check (marcada in ('A', 'B', 'C', 'D', 'E')),
    acertou boolean not null,
    respondida_em timestamptz not null default now(),
    primary key (conta_id, exercicio_id)
);
create index if not exists idx_respostas_fixacao_exercicio on respostas_fixacao (exercicio_id);

-- Botão "Encontrei um erro".
create table if not exists relatos_erro (
    id uuid primary key default gen_random_uuid(),
    material_id uuid not null references materiais_estudo(id) on delete cascade,
    exercicio_id uuid references exercicios_fixacao(id) on delete cascade,   -- null = o texto
    conta_id uuid references alunos_contas(id) on delete set null,
    professor_id uuid references professores(id) on delete set null,
    mensagem text check (length(mensagem) <= 500),
    situacao varchar(9) not null default 'aberto' check (situacao in ('aberto', 'corrigido', 'sem_erro')),
    resolvido_por uuid references professores(id) on delete set null,
    resolvido_em timestamptz,
    criado_em timestamptz not null default now()
);
create index if not exists idx_relatos_erro_abertos on relatos_erro (material_id) where situacao = 'aberto';
create index if not exists idx_relatos_erro_conta on relatos_erro (conta_id, criado_em);

-- Mesmo modelo das outras tabelas: o controle de acesso fica no servidor (ver "Como está hoje").
alter table materiais_estudo enable row level security;
alter table exercicios_fixacao enable row level security;
alter table imagens_estudo enable row level security;
alter table respostas_fixacao enable row level security;
alter table relatos_erro enable row level security;
drop policy if exists "acesso_total_materiais_estudo" on materiais_estudo;
create policy "acesso_total_materiais_estudo" on materiais_estudo for all using (true) with check (true);
drop policy if exists "acesso_total_exercicios_fixacao" on exercicios_fixacao;
create policy "acesso_total_exercicios_fixacao" on exercicios_fixacao for all using (true) with check (true);
drop policy if exists "acesso_total_imagens_estudo" on imagens_estudo;
create policy "acesso_total_imagens_estudo" on imagens_estudo for all using (true) with check (true);
drop policy if exists "acesso_total_respostas_fixacao" on respostas_fixacao;
create policy "acesso_total_respostas_fixacao" on respostas_fixacao for all using (true) with check (true);
drop policy if exists "acesso_total_relatos_erro" on relatos_erro;
create policy "acesso_total_relatos_erro" on relatos_erro for all using (true) with check (true);

-- Fotos: bucket público, como `capas`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('estudos', 'estudos', true, 2097152, array['image/webp'])
on conflict (id) do nothing;
drop policy if exists "estudos_ler" on storage.objects;
create policy "estudos_ler" on storage.objects for select using (bucket_id = 'estudos');
drop policy if exists "estudos_enviar" on storage.objects;
create policy "estudos_enviar" on storage.objects for insert with check (bucket_id = 'estudos');
drop policy if exists "estudos_apagar" on storage.objects;
create policy "estudos_apagar" on storage.objects for delete using (bucket_id = 'estudos');

NOTIFY pgrst, 'reload schema';
```

**Diferenças em relação ao pedido original:** `topicos` e `topico_id` já existem e não são tocados; `materiais_estudo`
fica um por assunto, com o texto em `blocos`; `tipo 'audio'` saiu; `video_link` usa `materiais_revisao`, que já existe;
`progresso_reestudo` virou `respostas_fixacao` mais o `plano_revisoes` que já marca "Já revisei"; `revisado` virou
`situacao`, `amostra` e `lido_em`; `slug_wikipedia` virou `fonte_url` no próprio material.

**Armadilha:** `juntarAssunto` (`src/actions/assuntos.ts`) apaga o assunto proposto, e o `on delete cascade` apagaria o
material dele. Antes de apagar, mover `materiais_estudo.assunto_id` para o destino se ele não tiver material.

## Situações

Vale para o material e para cada exercício:

| Situação | Significado | O aluno vê? |
|---|---|---|
| `rascunho` | Gravado, sem checagem | Não |
| `retido` | A checagem achou divergência | Não |
| `publicado` | No ar | Sim |
| `em_conferencia` | Alguém avisou erro; espera uma pessoa | Não |

O aluno só vê exercício `publicado` de material `publicado`, e o contador usa quantos sobraram ("3 de 9"). Toda leitura
do aluno passa por uma só função em `src/lib/estudos/dados.ts`.

- **Sem caminho de volta:** o que foi `publicado` nunca volta a `rascunho` ou `retido`. Por isso `rascunho` e `retido` nunca
  têm resposta de aluno, e só eles podem ser regravados ou checados.
- **Retirar do ar:** o botão do dono leva a `em_conferencia`, com o motivo. Só o dono devolve; a checagem não toca nesse estado.
- **Exercício `retido` em material `publicado`:** o resto segue no ar; o exercício entra quando for corrigido e passar na
  checagem.
- **Uma correção só:** na primeira divergência, o Claude pode corrigir e pedir nova checagem. Corrigido, o item volta a `rascunho` e
  passa pela nova checagem. Na segunda divergência (`checagens = 2`), o MCP recusa regravar, e o item fica para uma pessoa, em
  "Retidos" no painel.

## As quatro travas

**1. Segunda checagem independente.** Quem escreve não confere. Uma sessão nova do Claude Code (subagente que não viu o
raciocínio do autor) faz duas leituras: primeiro `ler_material_estudo` às cegas, sem gabarito nem comentário, e resolve cada exercício; depois a
leitura completa, para conferir os comentários e os fatos e datas do texto. Por fim, registra o parecer por
`registrar_checagem_estudo`. A regra é pura (`src/lib/estudos/situacao.ts`):

- exercício: `publicado` se o verificador disse ok **e** a resposta que encontrou é igual ao gabarito; senão, `retido`;
- material: `publicado` se o texto passou e pelo menos 5 exercícios passaram; senão, `retido`, com o motivo;
- todo exercício pendente precisa de parecer, ou a chamada é recusada;
- cada checagem soma 1 em `checagens`, e quem confere nunca é a sessão que escreveu ou corrigiu.

O parecer inteiro fica em `checagem`.

**2. Botão "Encontrei um erro".** Em cada exercício e no fim do texto, para alunos e professores, com mensagem opcional.
Ao avisar, o item vai para `em_conferencia` na hora: o exercício some, ou a página inteira, se for o texto. Cada conta
avisa uma vez por item (repetir não faz nada) e no máximo 5 vezes por dia. O dono resolve com "Corrigi" ou "Não há erro":
isso fecha todos os avisos abertos do item e o devolve a `publicado`.

**3. Amostra lida por uma pessoa.** Ao publicar, `amostra = true` para cerca de 1 em cada 5 assuntos, por conta pura sobre
o id do assunto. O dono lê no seu ritmo, com o material já no ar, e marca "Li" (`lido_por`, `lido_em`).

**4. Imagens com critério.** Conforme a seção "Imagens": desenho vai com o material; foto só com aprovação.

## Produção do conteúdo

Roteiro em `docs/reestudo-conteudo.md`, seguido em sessões do Claude Code:

1. `assuntos_para_estudo` lista os assuntos da matéria sem material e o número de questões.
2. Para cada assunto, ver algumas questões do banco, para acertar nível e foco.
3. Escrever a explicação, os desenhos e os 10 exercícios A–E com comentário, sem copiar de nenhum site. Fotos, só quando
   valerem a pena.
4. Buscar o verbete em `https://pt.wikipedia.org/api/rest_v1/page/summary/{slug}`, com User-Agent genérico do app, e conferir
   fatos e datas; se precisar, o conteúdo completo. Sem verbete, `fonte = 'ia'`.
5. `salvar_material_estudo`, que grava tudo como `rascunho`.
6. Subagente novo faz a trava 1.
7. Se algo ficar `retido`, corrigir uma vez (`salvar_material_estudo` ou `corrigir_exercicio_estudo`) e repetir o passo 6
   com outro subagente. O que divergir de novo fica para uma pessoa.

**Ordem de liberação:** Matemática primeiro (25 assuntos, 1.321 questões), depois uma matéria por vez. Assunto ainda sem
material segue mostrando o aviso atual.

## Painel

`/banco/estudos`, novo item no banco.

- **Todo professor:** lista por matéria e leitura de qualquer material publicado como o aluno vê, com "Encontrei um erro".
  Assim a escola consegue conferir e avisar.
- **Só o dono:** contadores e filtros de "Avisos de erro", "Retidos", "Fotos para aprovar" e "Amostra para ler"; em
  `/banco/estudos/<assuntoId>`, editar cada bloco de texto e cada exercício, publicar, retirar do ar, resolver avisos,
  aprovar ou recusar foto (recusada é apagada e o bloco fica sem ela) e marcar "Li". Edição do dono publica direto, sem nova checagem. Tópicos e vídeos continuam
  em `/banco/assuntos`.

## Ferramentas do MCP do dono

Em `src/lib/mcp/acoes/estudos.ts`, só no perfil `dono`, seguindo `escritas.ts` (`contaDoDono`, `registrado`):

- `assuntos_para_estudo(materia)`
- `salvar_material_estudo(assunto, materia, blocos, desenhos[], fotos[], fonte, fonte_titulo?, fonte_url?, exercicios[10])`:
  desenhos e fotos têm uma `chave` curta, que blocos e exercícios citam, e o servidor troca pelo id da imagem ao gravar.
  Só aceita assunto sem material, em `rascunho`, ou `retido` com `checagens = 1`; o que foi publicado se corrige pelo painel
- `ler_material_estudo(assunto, materia, as_cegas)`: com `as_cegas`, sem gabarito nem comentário
- `registrar_checagem_estudo(material, verificador, texto, exercicios[])`: cada exercício traz `ok`, `resposta_encontrada` e
  `problema?`
- `corrigir_exercicio_estudo(material, ordem, enunciado, alternativas, resposta_correta, comentario)`: só exercício `retido`
  com `checagens = 1`
- `avisos_estudo()`: avisos abertos, retidos e fotos pendentes

## Integração com o que existe

- `ExtrasConteudo` (`src/lib/plano/extras.ts`) ganha `estudo: { minutos: number } | null`, preenchido em `carregarPlano` só
  para material publicado.
- `MateriaisConteudo` mostra "Estudar este conteúdo" em primeiro lugar; na visão da escola, sem link. O aviso de falta
  de material só aparece se não houver estudo nem materiais.
- `minutosRevisar` usa o tempo do estudo quando ele existe. `minutosDoEstudo` é pura: palavras ÷ 150 mais 2 min por
  exercício, arredondado para cima de 5 em 5.
- `ResultadoAluno` recebe quais assuntos têm material e mostra o botão antes de `TreinarAssunto`.
- Aba ativa do menu do aluno em `/aluno/estudar`: Plano.

## Fonte na tela

No fim de todo texto: "Texto escrito com apoio de IA." Com `fonte = 'wikipedia'`, acrescenta-se "Fatos conferidos na
Wikipédia: *título* (link)." Foto sempre com legenda, crédito e licença.

## Estrutura de pastas

```
db/2026-11-04-reestudo.sql                         SQL para colar
docs/reestudo-conteudo.md                          roteiro de produção
src/lib/estudos/
  tipos.ts
  blocos.ts        + blocos.test.ts                validação zod, contagem de palavras
  svg.ts           + svg.test.ts                   lista fechada de elementos
  situacao.ts      + situacao.test.ts              checagem, amostra, o que o aluno vê
  tempo.ts         + tempo.test.ts                 minutosDoEstudo
  nucleo.ts        + nucleo.test.ts                responder, relatar e juntar, com dependências injetadas
  dados.ts                                         leituras do servidor
  gravar.ts                                        gravar o material e suas imagens
  fotos.ts                                         baixar, converter e gravar foto
src/actions/
  estudos.ts                                       aluno e professor: responderExercicio, relatarErro
  estudos-dono.ts                                  dono: editar, publicar, resolver, aprovar, marcar lido
src/lib/mcp/acoes/
  estudos.ts       + estudos.test.ts
src/app/aluno/estudar/[assuntoId]/
  page.tsx  loading.tsx  error.tsx
src/app/banco/estudos/
  page.tsx
  [assuntoId]/page.tsx
src/components/estudos/
  PaginaEstudo.tsx  PaginaEstudo.module.css
  Blocos.tsx                                       desenha os blocos, usado também na prévia do painel
  ExerciciosFixacao.tsx                            um por vez, cliente
  BotaoRelatarErro.tsx
  PainelEstudos.tsx  EditorEstudo.tsx  Painel.module.css
```

**Alterados:** `db/schema.sql`, `src/lib/types.ts`, `src/lib/plano/extras.ts`, `src/lib/plano/dados.ts`,
`src/components/plano/MateriaisConteudo.tsx`, `src/components/simulados/ResultadoAluno.tsx`,
`src/components/plano/CartaoConteudoPlano.tsx`, `src/actions/simulados-aluno.ts`, `src/actions/assuntos.ts`,
`src/app/aluno/layout.tsx`, `src/app/banco/page.tsx`, `src/lib/mcp/acoes.ts`,
`package.json` (novos testes) e `CLAUDE.md`.

## Testes obrigatórios

- A checagem cobre: gabarito divergente retém, parecer faltando recusa, menos de 5 exercícios retém o material.
- O SVG recusa `script`, `on*`, `foreignObject`, `image` e `href`.
- Bloco desconhecido, texto acima do limite e `imagem_id` alheio são recusados.
- A leitura do aluno não devolve gabarito nem comentário de exercício não respondido.
- A primeira resposta não muda ao responder de novo.
- Depois da segunda divergência, o MCP recusa regravar e corrigir; o painel do dono continua podendo.
- `ler_material_estudo` às cegas não devolve gabarito nem comentário.
- Regravar é recusado para material publicado ou em conferência.
- A checagem não republica material em conferência.
- Mudar o gabarito apaga as respostas daquele exercício; mudar só o comentário não apaga.
- Aviso repetido não conta duas vezes; o sexto do dia é recusado com mensagem clara.
- Exercício de material `em_conferencia` não pode ser respondido.
- Só o dono edita, publica, resolve e aprova; aluno não relata por outra conta.
- `juntarAssunto` não perde material.
- Sem material publicado, plano, painel e resultado continuam iguais a hoje.

## Fica para quem constrói

Nomes internos, a conta exata da amostra, divisão em tarefas, detalhes do CSS dentro do padrão `status-visual-aluno`,
mensagens de erro e o desenho do editor do painel, que pode ser simples: campos de texto por bloco e por exercício.

## Decisões minhas

O Peter não pediu estes pontos; ficam aqui para ele conferir:

- A regra de "só ver o que está publicado" fica no servidor, porque RLS por aluno não é possível neste sistema.
- Desenho guardado como SVG em texto; foto convertida para WebP em bucket público.
- O material passa com o texto aprovado e pelo menos 5 exercícios aprovados.
- Limite de 5 avisos de erro por conta por dia. Um aviso no texto tira a página do ar na hora, como combinado; se alguém
  abusar, o limite segura o estrago, e o próximo ajuste seria exigir dois avisos de contas diferentes.
- Exercício corrigido apaga as respostas dadas a ele, e o aluno responde de novo.
- Todo professor lê os materiais e pode avisar erro; editar e aprovar é só do dono.
- Edição do dono publica direto, sem nova checagem.
- "Refazer simulado" virou o próximo treino do plano.
- Matemática primeiro.
- Figura nos exercícios só como desenho.
