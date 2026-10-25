# Gerador de questões por IA (Parte 5)

Data: 2026-10-24 · Status: Peter pediu para começar sem a rodada de perguntas ("pode começar");
as decisões abaixo marcadas **(decisão do Claude)** podem ser revistas por ele.

## Objetivo

O professor escolhe matéria (e, se quiser, assunto), quantidade e dificuldade, e a IA escreve
questões objetivas **novas**, A–E, no estilo das questões que já estão no banco (ENEM e provas
importadas). As questões geradas entram **em revisão**; o professor confere, ajusta no editor de
sempre e publica. Publicadas, valem para simulados como qualquer outra.

Também: na página de uma questão, **"Gerar parecidas"** usa aquela questão como modelo principal.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Exemplos ("com base no banco") | **Pelo assunto, sem embeddings** (decisão do Claude). O banco tem 2.741 questões, todas com matéria e assunto (190 assuntos, ~14 por assunto). Escolher exemplos publicados do mesmo assunto/matéria é mais preciso que semelhança de vetor e dispensa Voyage, pgvector e reindexação. O roteiro antigo (RAG com Voyage + pgvector) fica descartado por ora; volta se o banco crescer sem classificação |
| Modelo | `claude-opus-5-5`, chamada **síncrona** com streaming (`messages.stream(...).finalMessage()`), saída estruturada (`output_config.format` com `zodOutputFormat`), `effort: "high"` (a resposta certa precisa estar certa) |
| Recusa | Pedir `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) se o SDK instalado (0.131) aceitar; senão, `stop_reason === "refusal"` vira mensagem de erro amigável |
| Quantidade | 1 a 10 por pedido (padrão 5). Uma chamada gera todas (assim a IA não repete entre elas) |
| Quem gera | Professor, admin e dono (decisão do Claude: custo baixo, ~US$ 0,03–0,06 por questão) |
| Limite | **60 questões geradas por escola por dia** (fuso America/Campo_Grande); dono sem limite (decisão do Claude) |
| Escopo das geradas | Professor/admin → questões da escola. Dono escolhe geral ou escola (como em "Nova questão") |
| Figuras | Geradas são **só texto**. A IA é instruída a não criar questão que dependa de figura, gráfico ou tabela-imagem; dados vão no texto. Fórmulas em Unicode (x², √, π, ½, H₂O), sem LaTeX |
| Revisão | Sempre `status = 'revisao'`. Publicar é um clique por questão na tela do resultado (ou no editor) |
| Resolução comentada | Nova coluna `resolucao` (texto). A IA escreve uma resolução curta; o professor vê e edita no editor de qualquer questão. **Nunca vai ao aluno** nesta parte |
| Não repetir | (1) as geradas recentes do mesmo assunto na escola vão no pedido como "não repita"; (2) depois de gerar, uma função pura compara cada questão com os exemplos, com as recentes e entre si; parecida demais → `precisa_revisao` com o motivo |
| Hermes | Fora desta parte (ferramenta `gerar_questoes` fica para depois) |

## 1. Banco de dados

Schema manual: o Peter cola no SQL Editor; anexar ao fim de `db/schema.sql`. Idempotente.

```sql
-- ===== Gerador de questões por IA (2026-10-24) =====
create table if not exists geracoes_ia (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id),          -- escola da conta (conta para o limite)
    professor_id uuid references professores(id) on delete set null,
    escopo varchar(6) not null check (escopo in ('geral', 'escola')),
    materia text not null,
    assunto_id uuid references assuntos(id) on delete set null,
    dificuldade varchar(7) not null check (dificuldade in ('facil', 'media', 'dificil')),
    orientacao text not null default '',
    questao_base_id uuid references questoes(id) on delete set null,
    quantidade_pedida integer not null check (quantidade_pedida between 1 and 10),
    quantidade_gerada integer not null default 0,
    status varchar(9) not null default 'gerando' check (status in ('gerando', 'concluida', 'erro')),
    erro text,
    tokens_entrada integer,
    tokens_saida integer,
    custo_usd numeric(8,4),
    created_at timestamptz not null default now()
);
create index if not exists idx_geracoes_ia_escola_data on geracoes_ia (escola_id, created_at);
alter table geracoes_ia enable row level security;
drop policy if exists "acesso_total_geracoes_ia" on geracoes_ia;
create policy "acesso_total_geracoes_ia" on geracoes_ia for all using (true) with check (true);

alter table questoes add column if not exists resolucao text;
alter table questoes add column if not exists geracao_id uuid references geracoes_ia(id) on delete set null;

-- origem passa a aceitar 'ia'
do $$
declare c text;
begin
    for c in select conname from pg_constraint
             where conrelid = 'questoes'::regclass and contype = 'c'
               and pg_get_constraintdef(oid) ilike '%origem%' loop
        execute format('alter table questoes drop constraint %I', c);
    end loop;
end $$;
alter table questoes add constraint questoes_origem_check
    check (origem in ('pdf', 'enemdev', 'manual', 'ia'));
NOTIFY pgrst, 'reload schema';
```

Tipos em `src/lib/types.ts`: `Questao.origem` ganha `"ia"`; `Questao` ganha `resolucao: string | null`
e `geracao_id: string | null`; nova tabela `geracoes_ia` no `Database`.

Conferir que a Lixeira (`db/schema.sql`, funções de questão) continua funcionando com as colunas novas
(ela copia `to_jsonb(q)`, então deve funcionar; restaurar com `geracao_id` apontando para geração
existente é ok).

## 2. Tela `/banco/gerar`

Botão **"Gerar com IA"** (ícone `Sparkles`) em `/banco`, ao lado de "Nova questão", para professor,
admin e dono. Se não há `ANTHROPIC_API_KEY`, o botão aparece mas a tela avisa que a IA não está
configurada.

Formulário:
- Matéria (obrigatória, lista fixa) → Assunto (opcional: "Qualquer assunto da matéria" + aprovados da matéria);
- Quantidade (1–10, padrão 5); Dificuldade (Fácil / Média / Difícil, padrão Média);
- Orientação (opcional, até 500 caracteres; ex.: "contexto do Mato Grosso do Sul", "sobre a Era Vargas");
- Dono: "Banco geral" ou "Questões da escola";
- Mostra quantas questões a escola ainda pode gerar hoje.
- `/banco/gerar?base=<questaoId>`: vem do botão "Gerar parecidas"; matéria e assunto pré-preenchidos
  pela questão base, que aparece resumida no topo ("Modelo: ENEM 2019 nº 45 — …").

Ao enviar: botão ocupado, "Escrevendo as questões… pode levar até 2 minutos". A página exporta
`maxDuration = 300` (como `/banco/importar-enem`).

Resultado (mesma página, abaixo do formulário): um cartão por questão gerada com enunciado,
comando, alternativas (a correta destacada), resolução, selo de aviso quando `precisa_revisao`
(motivo), e botões **Publicar**, **Editar** (abre `/banco/questoes/[id]`) e **Excluir** (vai para a
Lixeira, como hoje). Visual do banco existente (`Banco.module.css`), sem texto cinza.

Na página da questão (`/banco/questoes/[id]`): botão **"Gerar parecidas"** (link para
`/banco/gerar?base=<id>`) para quem pode ver a questão. No editor: campo **"Resolução comentada"**
(textarea, opcional) para qualquer questão; salvo junto com o resto.

Em `/banco`: selo **"IA"** nos cartões com `origem = 'ia'` e filtro de origem "Geradas por IA".

## 3. Servidor

Server action `gerarQuestoes(pedido)` em `src/actions/geracao.ts`; núcleo testável em
`src/lib/questoes/geracao.ts` (funções puras) e `src/lib/questoes/geracao-servidor.ts` (banco + IA),
fora do `"use server"`, no mesmo jeito de `nucleo.ts`/`importacao-nucleo.ts`.

1. `exigirProfessor()`; validar pedido (zod): matéria válida, assunto da matéria e aprovado,
   quantidade 1–10, dificuldade, orientação ≤ 500, escopo (só dono escolhe geral), base que o ator
   pode ver (`podeVerQuestao`).
2. **Limite:** soma de `quantidade_pedida` das gerações da escola desde 00:00 em America/Campo_Grande
   com status `gerando`/`concluida`; se `soma + quantidade > 60` e não é dono → erro
   "A escola já gerou N questões hoje; o limite é 60." (contar as pedidas evita corrida de pedidos
   simultâneos; a geração com erro não conta).
3. Cria `geracoes_ia` (`gerando`).
4. **Exemplos** (`escolherExemplos`): questões `publicada`, não anuladas, visíveis ao ator (geral ou da
   escola dele), mesma matéria e, se houver, mesmo assunto; preferir as **sem** `questao_imagens`;
   sorteio de até 6. Se o assunto tiver menos de 3, completa com a matéria. Com base: a base + até 3
   do mesmo assunto. Enunciado cortado em 2.500 caracteres.
5. **Recentes**: até 20 questões `origem = 'ia'` da mesma escola (ou geral, se escopo geral), mesma
   matéria/assunto, mais novas primeiro — só os 200 primeiros caracteres do enunciado.
6. Pedido à IA (instruções em `instrucoesGeracao`, função pura): papel de professor elaborador de
   itens no padrão ENEM/vestibular brasileiro; questões **inéditas** (não parafrasear os exemplos;
   outro contexto, outros números/textos); texto-base autoral ou de domínio público descrito sem
   inventar citações atribuídas a autores reais; 5 alternativas plausíveis, uma só correta, sem
   "todas/nenhuma das anteriores"; distribuir a letra correta; dificuldade pedida; orientação do
   professor; sem figura; Unicode para fórmulas; português do Brasil. Lista de assuntos aprovados
   da matéria (id | nome) para a IA classificar cada questão.
7. Saída (zod, `GeracaoSchema`):
   ```
   { "questoes": [ {
       "enunciado": string, "comando": string,
       "alternativas": [ { "letra": "A".."E", "texto": string } ],   // exatamente 5
       "resposta": "A".."E",
       "resolucao": string,
       "assunto_id": string | null
   } ] }
   ```
8. `respostaParaGeradas` (pura): descarta itens sem 5 alternativas A–E distintas ou com texto
   vazio; `assunto_id` fora da lista → o assunto pedido (ou null); `parecenca` contra exemplos,
   recentes e as anteriores do mesmo lote; ≥ 0,55 → `precisa_revisao = true`,
   `motivo_revisao = "Parecida demais com <banca ano nº>"` (ou "com outra questão gerada").
9. Grava as questões: `origem 'ia'`, `status 'revisao'`, `banca 'Gerada por IA'`, `ano` atual,
   `caderno ''`, `numero null`, `area` da matéria, `resolucao`, `geracao_id`, `criado_por`,
   `escopo`/`escola_id`, `conteudo null`. Atualiza a geração (`concluida`, quantidade gerada,
   tokens, `custo_usd` = entrada × 4/1M + saída × 20/1M; somar cache read/creation como em
   `custoDoUso`, com preço normal — não o do lote).
10. Erros (sem chave, recusa, saída inválida, nenhuma questão válida, falha da API) → geração `erro`
    com motivo e mensagem clara ao professor; nada é gravado em `questoes`.

`parecenca(a, b)` (pura): normaliza (minúsculas, sem acento, só letras/números/espaço), conjuntos
de trigramas de palavras; Jaccard. Textos com menos de 3 palavras → 0.

Publicar/Excluir na tela de resultado usam as actions existentes (`publicarQuestao`, `excluirQuestao`),
que já checam acesso e a resposta.

## 4. Regras de acesso e segurança

- Toda action começa com `exigirProfessor()` (que já barra aluno).
- Exemplos só entre questões que o ator pode ver; a base também.
- `resolucao` e `resposta` nunca em leitura de aluno: conferir que as leituras do aluno
  (`src/lib/simulados`, `src/actions/simulados-aluno.ts`) selecionam colunas explícitas e não incluem
  `resolucao`; se alguma usa `select("*")` para aluno, trocar por colunas explícitas.
- Texto da IA é tratado como texto (renderizado pelo componente de markdown simples, sem HTML).
- `ANTHROPIC_API_KEY` só no servidor.

## 5. Testes

Unitários (`tsx --test`): `parecenca` (iguais = 1, diferentes ≈ 0, acentos/maiúsculas ignorados,
texto curto = 0); `respostaParaGeradas` (descarta alternativas ≠ 5/repetidas/vazias, assunto fora da
lista, marca parecida com exemplo e entre si, monta linha com origem/banca/status certos);
`instrucoesGeracao` (contém dificuldade, orientação, base, recentes, lista de assuntos);
`escolherExemplos` como função pura sobre uma lista (prefere sem imagem, completa pela matéria,
máximo 6); validação do pedido (quantidade fora de 1–10, professor pedindo geral, assunto de outra
matéria); limite diário (início do dia em Campo Grande, dono sem limite).

Manual (depois do SQL e do deploy): gerar 3 questões de Matemática/Porcentagem; conferir
resposta e resolução; publicar uma; "Gerar parecidas" a partir de uma do ENEM; ver o custo real
gravado em `geracoes_ia`.

## Fora desta parte

Questões com figura gerada; discursivas; ferramenta da Hermes; aluno gerando os próprios treinos;
mostrar a resolução ao aluno no resultado do simulado; embeddings/RAG por vetor; cobrança por IA.
