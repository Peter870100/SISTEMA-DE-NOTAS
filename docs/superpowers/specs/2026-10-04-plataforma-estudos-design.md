# Plataforma de estudos: cursos, módulos e aulas

Data: 2026-10-04 · Status: desenho aprovado no brainstorming, aguardando revisão da spec

## Objetivo

Parte 2 do roteiro em `docs/superpowers/specs/2026-10-03-contas-aluno-multiescola-design.md`.
O professor organiza **curso → módulos → aulas**; cada aula tem vídeo (qualquer duração),
texto, material e gabarito em PDF. O aluno assiste dentro do site, retoma de onde parou e
vê o progresso em porcentagem por aula, módulo e curso. O professor vê o progresso da turma.

Depende da Parte 1 (contas de aluno, `aluno_turmas`, `escolas`, sessão tipada).

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Vídeo | **YouTube não listado agora**, guardado como `video_provedor` + `video_id` para entrar Bunny Stream depois sem refazer aulas |
| PDFs | Supabase Storage, bucket privado `materiais`; só PDF, até 25 MB por arquivo |
| Ordem das aulas | **Livre**: o aluno abre qualquer aula |
| Publicação | **Rascunho → Publicar** (e "Voltar para rascunho"); sem agendamento |
| Quem edita | Professor dono do curso **e** admin/dono da escola |
| "Curso" | Disciplina de um professor (ex.: "Física — 3º ano"); dois professores de Física têm cursos separados |
| Vínculo com turmas | Por **nome da turma + ano letivo**, como `aluno_turmas` |
| Progresso | **Automático pelo player** (YouTube IFrame API). Aula concluída ao chegar a 90% do vídeo. Aula sem vídeo: botão "Concluir aula" |
| % da aula | maior ponto assistido ÷ duração do vídeo |
| % do módulo/curso | aulas publicadas concluídas ÷ aulas publicadas |
| Gabarito | Libera `junto` (com o material), `apos_concluir` (após concluir a aula) ou `data` (a partir de uma data) |
| Atividade online | Fica para a Parte 4 (simulados); aqui a atividade é o PDF |

Descartados: botão manual "marquei como assistida" (o aluno marcaria sem assistir e a
porcentagem perderia valor); aulas em sequência obrigatória; agendamento.

## 1. Banco de dados

Schema manual: o bloco é colado pelo Peter no SQL Editor do Supabase e anexado ao fim de
`db/schema.sql`. Idempotente.

```sql
-- ===== Plataforma de estudos: cursos, módulos e aulas (2026-10-04) =====

create table if not exists cursos (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id),
    professor_id uuid references professores(id) on delete set null,   -- dono
    titulo text not null,
    disciplina text not null,
    descricao text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_cursos_escola on cursos (escola_id);

create table if not exists curso_turmas (
    curso_id uuid not null references cursos(id) on delete cascade,
    escola_id uuid not null references escolas(id),
    turma_nome text not null,
    ano_letivo varchar(10) not null,
    primary key (curso_id, turma_nome, ano_letivo)
);
create index if not exists idx_curso_turmas_turma on curso_turmas (escola_id, turma_nome, ano_letivo);

create table if not exists modulos (
    id uuid primary key default gen_random_uuid(),
    curso_id uuid not null references cursos(id) on delete cascade,
    titulo text not null,
    ordem integer not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_modulos_curso on modulos (curso_id, ordem);

create table if not exists aulas (
    id uuid primary key default gen_random_uuid(),
    modulo_id uuid not null references modulos(id) on delete cascade,
    curso_id uuid not null references cursos(id) on delete cascade,
    titulo text not null,
    texto text,
    video_provedor varchar(10) check (video_provedor in ('youtube', 'bunny')),
    video_id varchar(64),
    publicada boolean not null default false,
    publicada_em timestamptz,
    gabarito_liberacao varchar(15) not null default 'apos_concluir'
        check (gabarito_liberacao in ('junto', 'apos_concluir', 'data')),
    gabarito_libera_em timestamptz,
    ordem integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((video_provedor is null) = (video_id is null))
);
create index if not exists idx_aulas_modulo on aulas (modulo_id, ordem);
create index if not exists idx_aulas_curso on aulas (curso_id);

create table if not exists aula_arquivos (
    id uuid primary key default gen_random_uuid(),
    aula_id uuid not null references aulas(id) on delete cascade,
    tipo varchar(10) not null check (tipo in ('material', 'gabarito')),
    nome_arquivo text not null,
    storage_path text not null unique,          -- "<escola_id>/<curso_id>/<aula_id>/<uuid>.pdf"
    tamanho_bytes integer not null,
    created_at timestamptz not null default now()
);
create index if not exists idx_aula_arquivos_aula on aula_arquivos (aula_id);

create table if not exists aula_progresso (
    conta_id uuid not null references alunos_contas(id) on delete cascade,
    aula_id uuid not null references aulas(id) on delete cascade,
    curso_id uuid not null references cursos(id) on delete cascade,
    posicao_seg integer not null default 0,       -- onde parou (retomar)
    maior_posicao_seg integer not null default 0, -- maior ponto assistido (para a %)
    duracao_seg integer,                           -- duração informada pelo player
    concluida_em timestamptz,
    atualizado_em timestamptz not null default now(),
    primary key (conta_id, aula_id)
);
create index if not exists idx_aula_progresso_curso on aula_progresso (curso_id, conta_id);

alter table cursos enable row level security;
alter table curso_turmas enable row level security;
alter table modulos enable row level security;
alter table aulas enable row level security;
alter table aula_arquivos enable row level security;
alter table aula_progresso enable row level security;
drop policy if exists "acesso_total_cursos" on cursos;
create policy "acesso_total_cursos" on cursos for all using (true) with check (true);
drop policy if exists "acesso_total_curso_turmas" on curso_turmas;
create policy "acesso_total_curso_turmas" on curso_turmas for all using (true) with check (true);
drop policy if exists "acesso_total_modulos" on modulos;
create policy "acesso_total_modulos" on modulos for all using (true) with check (true);
drop policy if exists "acesso_total_aulas" on aulas;
create policy "acesso_total_aulas" on aulas for all using (true) with check (true);
drop policy if exists "acesso_total_aula_arquivos" on aula_arquivos;
create policy "acesso_total_aula_arquivos" on aula_arquivos for all using (true) with check (true);
drop policy if exists "acesso_total_aula_progresso" on aula_progresso;
create policy "acesso_total_aula_progresso" on aula_progresso for all using (true) with check (true);

-- Bucket privado dos PDFs. O servidor (chave anon, só no servidor) gera links assinados
-- de envio e de download; o navegador nunca recebe a chave.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;
drop policy if exists "materiais_servidor_ler" on storage.objects;
create policy "materiais_servidor_ler" on storage.objects for select using (bucket_id = 'materiais');
drop policy if exists "materiais_servidor_enviar" on storage.objects;
create policy "materiais_servidor_enviar" on storage.objects for insert with check (bucket_id = 'materiais');
drop policy if exists "materiais_servidor_apagar" on storage.objects;
create policy "materiais_servidor_apagar" on storage.objects for delete using (bucket_id = 'materiais');
```

## 2. Vídeo e progresso

**Link do YouTube.** Função pura `extrairIdYoutube(link): string | null` aceita
`youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/shorts/ID`, `youtube.com/embed/ID`,
com ou sem `www.`/`m.` e parâmetros extras; ID = 11 caracteres `[A-Za-z0-9_-]`. Qualquer
outra coisa → null e o formulário mostra "Link do YouTube não reconhecido".

**Player.** Componente cliente que carrega a IFrame API do YouTube
(`https://www.youtube.com/iframe_api`) com `youtube-nocookie.com` como host, começa em
`posicao_seg` e:
- a cada 15 s tocando, e ao pausar/terminar/sair da página, chama
  `registrarProgresso(aulaId, posicaoSeg, duracaoSeg)`;
- mostra a barra "X% assistido" e o selo "Concluída" assim que o servidor confirmar.

O componente esconde o provedor atrás de uma interface (`onTempo(posicao, duracao)`,
`iniciarEm`) para o Bunny entrar como outro componente depois.

**`registrarProgresso` (servidor).** Só aluno logado com acesso à aula publicada. Regras:
- `duracao_seg` aceita de 1 a 21600 (6 h); `posicao_seg` é limitada a `[0, duracao]`.
- **Anti-salto:** `maior_posicao_seg` novo = `min(posicao, maior_anterior + segundos_desde_a_última_gravação × 2 + 20)`.
  Na primeira gravação, o limite é `20`. Pular o vídeo até o fim não conclui a aula.
- `posicao_seg` (retomar) grava a posição informada, mesmo se maior que o permitido para a %.
- Concluída quando `maior_posicao_seg ≥ 0,9 × duracao_seg` (grava `concluida_em` uma vez; não desconclui).
- Devolve `{ porcentagem, concluida }`.

**Aula sem vídeo.** `concluirAulaSemVideo(aulaId)`: só se a aula não tiver vídeo.

**Porcentagens** (funções puras, testadas):
- aula com vídeo: `round(100 × maior_posicao_seg / duracao_seg)`, máx. 100; concluída = 100;
- módulo/curso: `round(100 × concluídas publicadas / publicadas)`; sem aulas publicadas = 0.

**Gabarito liberado** (função pura `gabaritoLiberado(regra, liberaEm, concluida, agora)`):
`junto` → sempre; `apos_concluir` → aula concluída; `data` → `agora ≥ liberaEm`.

## 3. Telas do professor

**Barra lateral:** item "Aulas" (ícone de livro) → `/cursos`.

**`/cursos`:** cursos do professor (admin/dono: todos da escola, com o nome do professor).
"Novo curso": título, disciplina, turmas (lista de turma·ano da escola; uma opção por
nome+ano, como em `/admin/alunos`).

**`/cursos/[id]`:** módulos com suas aulas (título, Publicada/Rascunho, "vídeo · N PDFs").
Ações: editar curso (título, disciplina, descrição, turmas), novo módulo, renomear/excluir
módulo, nova aula no módulo, reordenar módulos e aulas por botões ↑/↓ (funciona no
celular). Botão "Progresso da turma".

**`/cursos/[id]/aulas/[aulaId]`:** título, texto, link do YouTube com prévia do vídeo,
"Material" e "Gabarito" (enviar PDFs com barra de progresso, remover), regra de liberação
do gabarito (e data, se `data`), botões "Salvar rascunho" e "Publicar"/"Voltar para rascunho".

**Envio de PDF:** o servidor valida (professor pode editar a aula, nome `.pdf`,
tamanho ≤ 25 MB), cria o caminho `<escola>/<curso>/<aula>/<uuid>.pdf` e devolve um link
assinado de envio (`createSignedUploadUrl`). O navegador envia o arquivo direto a esse
link, sem a chave do Supabase. Depois confirma com `registrarArquivo`, que grava
`aula_arquivos`. Remover apaga o objeto do bucket e a linha. Se o envio direto exigir a
chave no navegador, o plano usa como alternativa uma rota do servidor que recebe o arquivo
e o repassa ao Storage, com o limite de tamanho configurado na rota.

**Progresso da turma (`/cursos/[id]/progresso`):** filtro por turma·ano do curso; tabela
aluno × (% do curso, % de cada módulo, último acesso); abaixo, aulas publicadas com a
quantidade de alunos que concluíram (menor primeiro).

**Confirmações:** excluir módulo/aula mostra quantos alunos têm progresso nela; publicar
aula sem vídeo e sem PDF pergunta "Esta aula está vazia. Publicar mesmo assim?".

## 4. Telas do aluno

**`/aluno`:** o cartão "Aulas" deixa de ser "Em breve" e leva a `/aluno/cursos`.

**`/aluno/cursos`:** cursos das turmas do aluno com barra e %, nome do professor e
"Continuar: <aula> →" (última aula com progresso não concluída; se não houver, a primeira
publicada não concluída).

**`/aluno/cursos/[id]`:** módulos com % e as aulas publicadas com estado:
"Concluída" ✓, "Não concluída · X% assistido" ◐, "Não iniciada" ○.

**`/aluno/aulas/[id]`:** player começando onde parou + barra "X% assistido" (ou "Concluída");
texto; "Material" (downloads); "Gabarito" (download se liberado, senão
"Disponível depois que você concluir a aula" / "Disponível em dd/mm"); aula sem vídeo
mostra "Concluir aula"; "← Aula anterior" / "Próxima aula →" na ordem do curso.

**Download:** `linkDownloadArquivo(arquivoId)` gera link assinado de 5 minutos, depois de
checar acesso (e a regra do gabarito).

## 5. Regras de acesso

- Aluno vê um curso só se `curso_turmas` tiver (escola, turma, ano) de uma linha sua em
  `aluno_turmas`. Só aulas `publicada = true`. Rascunho e arquivos de rascunho: nunca.
- Professor edita curso se for o `professor_id`; admin/dono (`ehAdmin`) edita qualquer curso
  da própria escola. Toda consulta do professor filtra pela escola dele.
- Toda Server Action de professor desta parte começa com `exigirNaoAluno()` e exige
  professor logado; toda action de aluno usa `getAlunoAtual()`.
- Funções que recebem ids e não checam acesso ficam fora de arquivos `"use server"`.
- Proxy: `/cursos` é rota de professor (aluno é mandado para `/aluno`); as rotas do aluno
  ficam em `/aluno/*`, já cobertas pela Parte 1.
- Hermes (MCP) não ganha acesso a nada desta parte.

**Fora desta parte:** Bunny Stream, agendar publicação, sequência obrigatória, atividade
online, comentários/dúvidas, certificado, capa do curso, duplicar curso.

## 6. Testes

Unitários (`tsx --test`, no script `test`):
- `extrairIdYoutube`: os quatro formatos, `www.`/`m.`, parâmetros extras, links inválidos;
- porcentagens: aula (0, meio, ≥90% → concluída, duração ausente), módulo/curso (sem aulas, parcial, todas);
- anti-salto: avanço normal aceito, salto limitado, primeira gravação, duração inválida;
- `gabaritoLiberado`: as três regras e as bordas de data.

Manual (roteiro no fim do plano): professor cria curso para uma turma, módulo, aula com
vídeo e PDFs, publica; aluno da turma vê o curso, assiste metade (aparece
"Não concluída · ~50% assistido"), sai, volta no mesmo ponto, conclui (selo e % sobem),
baixa o gabarito liberado após concluir; aluno de outra turma não vê o curso; rascunho não
aparece; professor vê o progresso da turma.
