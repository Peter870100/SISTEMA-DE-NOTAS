# Banco de questões: importação de provas com IA, revisão e questões da escola

Data: 2026-10-04 · Status: desenho aprovado no brainstorming, aguardando revisão da spec

## Objetivo

Parte 3 do roteiro (`docs/superpowers/specs/2026-10-03-contas-aluno-multiescola-design.md`).
Montar o banco de questões objetivas que os simulados (Parte 4) vão usar:

- **Banco geral** (só o dono abastece): provas oficiais (ENEM, UFMS, UEMS, UFGD, Fuvest…)
  importadas de PDF pela IA e o ENEM 2009–2023 trazido do enem.dev;
- **Questões da escola**: importadas de PDF pelo admin da escola ou digitadas pelo professor;
- **Revisão humana** obrigatória do que a IA leu, com a página original ao lado e ajuste
  do recorte das figuras;
- Classificação consistente por **área → matéria (lista fixa) → assunto** (lista que cresce
  com aprovação).

Aluno não usa nada desta parte diretamente; a resposta certa nunca vai ao navegador dele.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Tipos de questão | **Só objetivas A–E** (com marcação de anulada). Discursivas e somatórias ficam para depois |
| Imagens | **IA marca o quadro da figura na página**; o recorte é guardado como coordenadas sobre a imagem da página e ajustado arrastando na revisão. Também: trocar/adicionar/remover imagem por envio de arquivo, no enunciado e em cada alternativa |
| ENEM | **enem.dev para 2009–2023** (dados públicos do INEP via API; imagens copiadas para o nosso Storage) + **PDF a partir de 2024** |
| Classificação | Matérias **fixas**; assuntos com lista inicial, a IA pode **propor** novos, o dono aprova ou junta |
| Questões da escola | Professor **digita**; **admin/dono** também importam PDF. Professor não importa (custo de IA) |
| Processamento | **Em segundo plano, página por página**, pela **Message Batches API** da Anthropic (metade do preço). As páginas são renderizadas em imagem **no navegador** (pdf.js) e enviadas ao Storage por link assinado |
| Modelo | `claude-opus-5-5` com saída estruturada (`output_config.format`) |
| Embeddings | **Parte 5**. Aqui só guardamos texto limpo |
| Publicação | Questões entram "em revisão"; só "publicada" vale para simulados. "Aprovar todas sem aviso" por importação |

Descartados: tudo numa requisição esperando na tela (estoura o tempo da Vercel, custa o dobro);
importar só pelo Claude Code (não vira produto); IA escrevendo assuntos livremente (filtros se perdem).

## 1. Banco de dados

Schema manual: colado pelo Peter no SQL Editor e anexado ao fim de `db/schema.sql`. Idempotente.

```sql
-- ===== Banco de questões (2026-10-04) =====

create table if not exists assuntos (
    id uuid primary key default gen_random_uuid(),
    materia text not null check (materia in ('portugues','literatura','ingles','espanhol','artes','educacao_fisica',
        'historia','geografia','filosofia','sociologia','fisica','quimica','biologia','matematica')),
    nome text not null,
    situacao varchar(10) not null default 'aprovado' check (situacao in ('aprovado', 'proposto')),
    created_at timestamptz not null default now()
);
create unique index if not exists uq_assuntos_materia_nome on assuntos (materia, lower(nome));

create table if not exists importacoes (
    id uuid primary key default gen_random_uuid(),
    escopo varchar(6) not null check (escopo in ('geral', 'escola')),
    escola_id uuid references escolas(id),
    origem varchar(8) not null check (origem in ('pdf', 'enemdev')),
    banca text not null,
    ano integer,
    caderno text not null default '',
    status varchar(10) not null default 'enviando'
        check (status in ('enviando', 'lendo', 'revisao', 'concluida', 'erro')),
    total_paginas integer not null default 0,
    paginas_lidas integer not null default 0,
    batch_id text,
    custo_estimado_usd numeric(8,2),
    custo_real_usd numeric(8,2),
    erro text,
    criado_por uuid references professores(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((escopo = 'geral') = (escola_id is null))
);

create table if not exists importacao_paginas (
    id uuid primary key default gen_random_uuid(),
    importacao_id uuid not null references importacoes(id) on delete cascade,
    tipo varchar(9) not null check (tipo in ('prova', 'gabarito')),
    numero integer not null,
    storage_path text not null unique,       -- <importacao_id>/<tipo>-<numero>.jpg (dentro do bucket questoes)
    largura integer not null,
    altura integer not null,
    status varchar(8) not null default 'pendente' check (status in ('pendente', 'lida', 'erro')),
    erro text,
    unique (importacao_id, tipo, numero)
);

create table if not exists questoes (
    id uuid primary key default gen_random_uuid(),
    escopo varchar(6) not null check (escopo in ('geral', 'escola')),
    escola_id uuid references escolas(id),
    banca text not null,
    ano integer,
    caderno text not null default '',
    numero integer,
    area varchar(10) not null check (area in ('linguagens', 'humanas', 'natureza', 'matematica')),
    materia text not null,
    assunto_id uuid references assuntos(id) on delete set null,
    enunciado text not null default '',
    comando text not null default '',
    alternativas jsonb not null default '[]',  -- [{ "letra": "A", "texto": "..." }, ... até "E"]
    resposta char(1) check (resposta in ('A', 'B', 'C', 'D', 'E')),
    anulada boolean not null default false,
    status varchar(9) not null default 'revisao' check (status in ('revisao', 'publicada')),
    precisa_revisao boolean not null default false,
    motivo_revisao text,
    origem varchar(8) not null check (origem in ('pdf', 'enemdev', 'manual')),
    importacao_id uuid references importacoes(id) on delete set null,
    pagina_id uuid references importacao_paginas(id) on delete set null,
    fonte_id text,                              -- id da questão no enem.dev
    criado_por uuid references professores(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((escopo = 'geral') = (escola_id is null)),
    check (status <> 'publicada' or anulada or resposta is not null)
);
create index if not exists idx_questoes_filtros on questoes (status, area, materia, banca, ano);
create index if not exists idx_questoes_escola on questoes (escola_id);
create index if not exists idx_questoes_importacao on questoes (importacao_id);
create unique index if not exists uq_questoes_geral on questoes (banca, ano, caderno, numero)
    where escopo = 'geral' and numero is not null;
create unique index if not exists uq_questoes_escola on questoes (escola_id, banca, ano, caderno, numero)
    where escopo = 'escola' and numero is not null;

create table if not exists questao_imagens (
    id uuid primary key default gen_random_uuid(),
    questao_id uuid not null references questoes(id) on delete cascade,
    alvo varchar(9) not null check (alvo in ('enunciado', 'A', 'B', 'C', 'D', 'E')),
    ordem integer not null default 0,
    tipo varchar(7) not null check (tipo in ('recorte', 'arquivo')),
    pagina_id uuid references importacao_paginas(id) on delete cascade,
    x numeric(6,5), y numeric(6,5), w numeric(6,5), h numeric(6,5),   -- frações 0..1 da página
    storage_path text,                                                  -- quando tipo = 'arquivo'
    created_at timestamptz not null default now(),
    check (
      (tipo = 'recorte' and pagina_id is not null and x is not null and y is not null and w > 0 and h > 0
        and x >= 0 and y >= 0 and x + w <= 1.00001 and y + h <= 1.00001)
      or (tipo = 'arquivo' and storage_path is not null)
    )
);
create index if not exists idx_questao_imagens_questao on questao_imagens (questao_id);

alter table assuntos enable row level security;
alter table importacoes enable row level security;
alter table importacao_paginas enable row level security;
alter table questoes enable row level security;
alter table questao_imagens enable row level security;
drop policy if exists "acesso_total_assuntos" on assuntos;
create policy "acesso_total_assuntos" on assuntos for all using (true) with check (true);
drop policy if exists "acesso_total_importacoes" on importacoes;
create policy "acesso_total_importacoes" on importacoes for all using (true) with check (true);
drop policy if exists "acesso_total_importacao_paginas" on importacao_paginas;
create policy "acesso_total_importacao_paginas" on importacao_paginas for all using (true) with check (true);
drop policy if exists "acesso_total_questoes" on questoes;
create policy "acesso_total_questoes" on questoes for all using (true) with check (true);
drop policy if exists "acesso_total_questao_imagens" on questao_imagens;
create policy "acesso_total_questao_imagens" on questao_imagens for all using (true) with check (true);

-- Bucket privado das páginas e imagens das questões (mesmo modelo do bucket `materiais`)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('questoes', 'questoes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "questoes_servidor_ler" on storage.objects;
create policy "questoes_servidor_ler" on storage.objects for select using (bucket_id = 'questoes');
drop policy if exists "questoes_servidor_enviar" on storage.objects;
create policy "questoes_servidor_enviar" on storage.objects for insert with check (bucket_id = 'questoes');
drop policy if exists "questoes_servidor_apagar" on storage.objects;
create policy "questoes_servidor_apagar" on storage.objects for delete using (bucket_id = 'questoes');
```

**Matérias e áreas (fixas, no código):** Linguagens = português, literatura, inglês, espanhol,
artes, educação física; Humanas = história, geografia, filosofia, sociologia; Natureza = física,
química, biologia; Matemática = matemática. Rótulos com acento ficam num mapa em
`src/lib/questoes/materias.ts`.

**Assuntos iniciais:** semeados por um botão do dono em "Banco → Assuntos"
("Carregar lista inicial"), a partir de uma lista no código (8–15 assuntos por matéria,
baseados na matriz do ENEM). Idempotente (ignora os que já existem).

**Configuração nova:** variável `ANTHROPIC_API_KEY` na Vercel (produção) e em `.env.local`.
Dependências novas: `@anthropic-ai/sdk` (servidor) e `pdfjs-dist` (navegador).

## 2. Importação de PDF

**Tela `/banco/importar`** (dono → geral; admin da escola → escola): banca (lista + "Outra"),
ano, caderno, PDF da prova (obrigatório), PDF do gabarito (opcional). Máx. 60 páginas por PDF.

1. `criarImportacao(dados)` (servidor) cria a linha em `importacoes` (`enviando`).
2. **No navegador**, `pdfjs-dist` renderiza cada página a 150 dpi, largura máx. 1600 px, em JPEG
   qualidade 0,8 (< 5 MB). Para cada página: `prepararEnvioPagina` → link assinado de envio →
   upload direto (mesmo método da Parte 2) → `registrarPagina` (grava largura/altura).
3. `iniciarLeitura(importacaoId)` monta **um pedido por página da prova** e cria o lote na
   Message Batches API. Cada pedido leva: imagem da página N, imagem da página N+1 (contexto
   para questão que continua), imagens das páginas do gabarito, banca/ano/caderno, a lista de
   matérias e de assuntos **aprovados** (nome + id), e o pedido de saída estruturada. Grava
   `batch_id`, `status = 'lendo'`, `total_paginas`, `custo_estimado_usd`.
4. **Acompanhamento:** a tela `/banco/importacoes/[id]` chama `atualizarImportacao(id)` a cada
   20 s enquanto `lendo`. A action consulta o lote; quando `ended`, transfere o status para
   `revisao` com um update condicional (`where status = 'lendo'`, só um processa) e grava as
   questões. Mostra "Lendo prova… X de N páginas".
5. **Página com erro** (resposta inválida, recusa, erro do lote): `importacao_paginas.status =
   'erro'` com o motivo; botão "Ler de novo" cria um lote só com as páginas com erro.

**Saída estruturada por página** (JSON Schema; o servidor valida com zod antes de gravar):

```
{ "questoes": [ {
    "numero": int,                     // número impresso na prova
    "enunciado": string,               // texto de apoio + enunciado, markdown simples
    "comando": string,                 // frase antes das alternativas (pode ser "")
    "alternativas": [ { "letra": "A".."E", "texto": string } ],   // exatamente 5
    "resposta": "A".."E" | null,       // do gabarito; null se não achou
    "anulada": boolean,
    "area": "linguagens"|"humanas"|"natureza"|"matematica",
    "materia": <uma das 14>,
    "assunto_id": string | null,       // id da lista enviada
    "assunto_novo": string | null,     // proposta quando nenhum serve
    "figuras": [ { "alvo": "enunciado"|"A".."E", "x": num, "y": num, "w": num, "h": num } ], // frações da página N
    "duvidas": [ string ]              // vazio se nenhuma
} ] }
```

Só as questões que **começam** na página N entram na resposta dessa página. Questões cujo
número já existe na importação (ou no banco, mesmo escopo/banca/ano/caderno) não são
duplicadas: a primeira fica, as outras viram aviso na importação.

**Conversão para `questoes`** (função pura `respostaParaQuestoes`, testada):
`precisa_revisao = true` com `motivo_revisao` quando: `duvidas` não vazio, `resposta` null e
não anulada, menos ou mais que 5 alternativas, ou assunto novo proposto. `assunto_novo` cria
(ou reaproveita) um assunto `proposto` da mesma matéria. Figuras viram `questao_imagens`
(`recorte`), com coordenadas limitadas a `[0,1]` (função pura `limitarQuadro`).

**Custo:** estimado antes (≈ páginas × tokens médios × preço do lote) e real depois (soma do
`usage` dos resultados × preço do lote do modelo), gravados em `importacoes`. Na construção,
medir com uma prova real antes de importar em massa.

## 3. Revisão e banco

**`/banco/importacoes/[id]/revisar`**: lista de questões da importação (filtros: precisa de
revisão, sem resposta, com figura, aprovadas; as com aviso primeiro). Editor em duas colunas:
- esquerda: imagem da página (link assinado) com os quadros das figuras desenhados por cima;
  arrastar/redimensionar atualiza `x,y,w,h`; botões de página anterior/seguinte;
- direita: número, área/matéria/assunto (seleção; assunto proposto com aviso), enunciado,
  comando, alternativas (texto), imagens por alvo com "Trocar imagem", "+ Imagem", "Remover",
  resposta, anulada, aviso da IA; **"Aprovar e próxima"** (publica e abre a seguinte) e "Excluir".
- **"Aprovar todas sem aviso"** publica de uma vez as questões da importação com
  `precisa_revisao = false` e resposta (ou anulada).
- Quando todas estiverem publicadas ou excluídas, a importação vira `concluida`.

Recorte na tela: a imagem da página é mostrada com CSS (`background-size`/`position` a partir
das frações), sem gerar arquivo recortado. Envio de imagem: PNG/JPG/WEBP até 5 MB, mesmo
fluxo de link assinado, `tipo = 'arquivo'`.

**`/banco`**: questões publicadas (e "em revisão" para quem edita), busca por texto e filtros
banca/ano/área/matéria/assunto/escopo; abrir, editar, despublicar. **`/banco/assuntos`** (dono):
propostas com "Aprovar" e "Juntar com…" (move as questões e apaga o proposto); "Carregar lista inicial".

**Markdown simples:** enunciado/comando/alternativas aceitam negrito, itálico e quebras de linha;
renderizados por um componente próprio que não interpreta HTML (texto escapado).

## 4. Questões da escola e ENEM

**Nova questão (`/banco/nova`)**: professor, admin e dono. Mesmo editor da revisão sem a coluna
da página; banca "Própria" por padrão (editável), escopo "escola" (dono pode escolher "geral").
Salvar rascunho (`revisao`) ou publicar.

**Promover para o geral** (só dono): copia a questão da escola para `escopo = 'geral'`
(com imagens) e mantém a original.

**ENEM pelo enem.dev (`/banco/importar-enem`, só dono)**: escolha de anos 2009–2023.
Uma importação `origem = 'enemdev'` por ano. A tela chama `avancarImportacaoEnem(id)` em
laço; cada chamada busca 50 questões (`GET https://api.enem.dev/v1/exams/{ano}/questions?limit=50&offset=…`),
converte (função pura `enemDevParaQuestao`: `context` → enunciado, `alternativesIntroduction` →
comando, `alternatives` → A–E, `correctAlternative` → resposta, `discipline` → área, número
= `index`, caderno = idioma quando houver), copia as imagens (`files` e imagens do markdown)
para o bucket `questoes` como `arquivo` e remove as marcações de imagem do texto. Imagem
quebrada (`broken-image`), falha de download ou dados faltando → `precisa_revisao`.
Já existente (mesma banca/ano/caderno/número no geral) → pulada. Depois de baixar o ano, um
lote de classificação (texto, ~20 questões por pedido) preenche matéria e assunto; as
questões sem aviso entram **publicadas**, as com aviso ficam em revisão.

## 5. Regras de acesso

| | Banco geral | Questões da escola |
|---|---|---|
| Dono | importa (PDF e enem.dev), edita, publica, exclui | vê/edita todas; promove para o geral |
| Admin da escola | vê publicadas | importa PDF, cria, edita, publica todas da sua escola |
| Professor | vê publicadas | cria, edita e publica as próprias |
| Aluno | nada | nada |

- Toda action de professor começa com `exigirNaoAluno()` e exige professor; checagens de
  escopo/escola em `src/lib/questoes/acesso.ts` (fora de `"use server"`).
- **A resposta certa nunca vai a componente de aluno**; leituras para aluno (Parte 4) usarão
  uma função que omite `resposta`.
- Imagens e páginas só por link assinado (5 min), gerado depois da checagem.
- `ANTHROPIC_API_KEY` só no servidor. Hermes sem acesso.

**Fora desta parte:** discursivas e somatórias, embeddings, simulados, cobrança de IA das
escolas, importação de PDF por professor.

## 6. Testes

Unitários (`tsx --test`): `respostaParaQuestoes` (completa, sem gabarito, figura em
alternativa, assunto novo, número repetido, alternativas ≠ 5), `enemDevParaQuestao`
(com/sem imagem, imagem quebrada, idioma), `limitarQuadro`, regras de quem pode editar,
validação do JSON da IA (zod) recusando respostas malformadas, renderização segura do markdown.

Manual: importar uma prova curta da UFMS com gabarito; revisar, ajustar um recorte, trocar
uma imagem; aprovar tudo; importar o ENEM 2023 pelo enem.dev; professor cria questão própria
com imagem; confirmar o custo real registrado.
