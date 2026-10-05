# Antes da 2ª escola: dados separados, endereço, visual e painel do dono

Data: 2026-10-04 · Status: desenho aprovado no brainstorming, aguardando revisão da spec

## Objetivo

Poder vender a plataforma para uma segunda escola sem que uma veja os dados da outra, cada uma
com o seu endereço (`escola.statusavalia.com.br`), logo, cores, slogan e foto de login; e o dono
da plataforma cria e administra escolas por um painel, sem SQL.

**Sucesso:** criar a "Escola Teste" no painel; entrando como professor dela, nada do Status aparece,
o visual e o login são os da Escola Teste; para quem usa o Status, nada muda.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Separação | **Filtro no servidor com verificações centrais** (sem trocar o login, sem RLS por escola) |
| Endereço | **Subdomínio** por escola; `www`, apex e `status.` continuam abrindo o Status |
| DNS | Manual por escola: CNAME no Registro.br + domínio adicionado na Vercel |
| Escola atual | Para acesso: a escola **da conta logada**. O endereço só define marca e onde o login é aceito |
| Login | Só no endereço da própria escola; conta de outra escola é levada ao endereço certo |
| Dono | **Só o painel** (criar/editar/desativar escolas, primeiro admin). Não vê dados das escolas |
| Hermes | Continua só no Status, com filtro explícito |
| Visual | Cor principal + destaque por escola; tons derivados calculados; Status sem mudança |
| Logo/foto | Enviadas pelo painel para bucket público `marcas`; Status mantém os arquivos de `/public` |
| Subdomínio | Imutável depois de criado |
| Desativar | Coluna `ativa`; desativada = ninguém da escola entra; dados preservados; Status nunca |

## 1. Banco de dados (o Peter cola no SQL Editor)

```sql
-- ===== Multiescola (2026-10-04) =====

-- Lixeira passa a ser por escola (itens antigos são do Status)
alter table lixeira add column if not exists escola_id uuid not null
    default '00000000-0000-0000-0000-000000000001' references escolas(id);
create index if not exists idx_lixeira_escola on lixeira (escola_id, excluido_em desc);

-- lixeira_excluir() não conhece a escola: o gatilho pega a da turma (ainda existe no momento do insert)
create or replace function lixeira_definir_escola()
returns trigger language plpgsql as $$
begin
  new.escola_id := coalesce((select escola_id from turmas where id = new.turma_id), new.escola_id);
  return new;
end;
$$;
drop trigger if exists trg_lixeira_escola on lixeira;
create trigger trg_lixeira_escola before insert on lixeira
for each row execute function lixeira_definir_escola();

-- Escola pode ser desativada pelo dono
alter table escolas add column if not exists ativa boolean not null default true;

-- Bucket público das logos e fotos de login (aparecem antes do login)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marcas', 'marcas', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "marcas_ler" on storage.objects;
create policy "marcas_ler" on storage.objects for select using (bucket_id = 'marcas');
drop policy if exists "marcas_enviar" on storage.objects;
create policy "marcas_enviar" on storage.objects for insert with check (bucket_id = 'marcas');
drop policy if exists "marcas_apagar" on storage.objects;
create policy "marcas_apagar" on storage.objects for delete using (bucket_id = 'marcas');
```

Nenhuma outra tabela muda: `professores`, `turmas`, `alunos_contas`, `aluno_turmas`, `convites_turma`,
`cursos`, `questoes`, `simulados` etc. já têm `escola_id`. `alunos`, `atividades_colunas`,
`notas_celulas` e `notas_historico` chegam à escola pela turma.

## 2. Separação dos dados

**Escola atual = escola da conta logada** (`professor.escola_id` / `aluno.escola_id`). Sem login,
nenhuma action de dados funciona — acaba o "requisição anônima passa" de `exigirAcessoATurmaId`
e similares.

**Verificações centrais** em `src/lib/escola-acesso.ts` (sem `"use server"`), com as decisões em
funções puras testadas:
- `exigirProfessorLogado()` → professor (lança se não houver).
- `exigirTurmaDaEscola(professor, turmaId)` → turma da escola do professor **e** acessível
  (regra atual de `acesso_restrito` / `professor_turma_acesso`).
- Derivadas pela turma: `exigirAlunoDaEscola` (aluno da planilha), `exigirColunaDaEscola`.
- `exigirItemLixeiraDaEscola`, `exigirContaAlunoDaEscola`, `exigirProfessorDaEscola` (tela admin;
  regra "só o dono mexe em outro dono" mantida).

**Ajustes:** `src/actions/` turmas, alunos, notas, colunas, historico, lixeira (`lib/lixeira.ts`
grava `escola_id`), busca, exportacao, convites, contas-aluno, professores, cadastro, auth
(e páginas `src/app/page.tsx`, `turma/[turmaId]`, `admin/*`, `verificar-email`):
- toda listagem filtra pela escola do usuário;
- toda action que recebe id passa pela verificação central;
- todo insert grava `escola_id` explicitamente (não depender do default do Status).

**Nomes de turma iguais** em escolas diferentes não se misturam: as turmas são sempre lidas com
`escola_id` da conta; `professor_turma_acesso` é por professor (de uma escola só).

**`configuracoes.codigo_convite`** deixa de ser usado; vale `escolas.codigo_convite_professor`.

**Hermes** (`src/lib/mcp-tools.ts`): todas as consultas e inserts filtram/gravam
`escola_id = ESCOLA_PADRAO_ID` explicitamente.

## 3. Escola pelo endereço, login e e-mails

**Resolver o endereço** (`src/lib/dominio.ts`, puro e testado): `escolaDoHost(host)` →
- `www.statusavalia.com.br`, `statusavalia.com.br`, `status.statusavalia.com.br` → slug `status`;
- `<slug>.statusavalia.com.br` → `<slug>`;
- `*.vercel.app`, `localhost`, `127.0.0.1` → `status` (testes e previews);
- qualquer outro → `null`.

O `proxy.ts` passa o slug adiante (header `x-escola-slug`); o servidor carrega a escola por slug
(com cache). Slug sem escola → página "Escola não encontrada" com link para o www.

**Login** (professor e aluno): a tela usa a marca da escola do endereço. Credenciais certas de uma
conta de **outra** escola → não cria sessão; mostra "Sua conta é da <Escola>" e leva a
`https://<slug>.statusavalia.com.br/login`. Escola desativada → "Acesso suspenso. Fale com a
plataforma." (também para quem já estava logado: a sessão é recusada na próxima página).

**Cadastro de professor** com código: o código precisa ser o da escola do endereço; a conta nasce
nela. Aluno com código de turma: sem mudança (o código já é da turma).

**E-mails**: remetente com `nome_remetente_email` da escola (já é assim); links (verificação,
redefinir senha, contas de aluno) apontam para o endereço da escola
(`urlDaEscola(escola, caminho)`). Endereço de envio continua `onboarding@resend.dev` até o domínio
ser verificado no Resend.

**Cookie** de sessão continua preso ao host exato (sem `domain=`), então sessões não cruzam escolas.

## 4. Visual por escola

**Cores**: `cor_principal` → moldura e botões; `cor_destaque` → o "dourado". Tons derivados
(`frame-deep`, `frame-line`, `frame-muted`, `brand`, `brand-bright`, `gold-ink`) calculados por
funções puras em `src/lib/marca.ts`; texto sobre moldura/botão escolhido por contraste (branco ou
escuro). Aplicados como variáveis CSS no `<html style>` no servidor (sem piscar). Cores nulas →
tema atual do Status, sem nenhuma variável sobrescrita.

**Alerta de contraste** no painel (razão WCAG < 4,5 entre texto e moldura/botão, ou destaque
ilegível sobre a moldura).

**Logo e foto de login**: escolas novas enviam pelo painel para o bucket `marcas`
(`<escola_id>/logo-<uuid>.<ext>`, `<escola_id>/login-<uuid>.<ext>`; PNG/JPG/WebP até 2 MB) e
`logo_url`/`foto_login_url` guardam a URL pública. Status mantém os caminhos de `/public`.

**Só do Status**: vídeo, fundo de doodles, mascote "Fera" e fotos de campus do login. Outras
escolas: a mesma estrutura de tela com a foto enviada (ou fundo liso na cor principal), slogan e logo.

**Título da aba** e nome no menu = nome da escola. Favicon continua o da plataforma.

## 5. Painel do dono

**Rota** `/dono` (+ `/dono/escolas/nova`, `/dono/escolas/[id]`), item "Escolas" no menu só para
`role = 'dono'`; outros recebem `notFound()`. Actions em `src/actions/dono.ts`, todas começando
por `exigirDono()`.

**Lista**: nome, endereço, ativa/desativada, contagens (professores, turmas, contas de aluno).

**Criar/editar**: nome, subdomínio, nome de remetente, slogan, cor principal, cor de destaque
(prévia ao vivo + alerta de contraste), logo, foto de login, código de convite de professor
(botão "gerar").
- Subdomínio: `^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$` (3–30), único, fora da lista reservada
  (`www`, `api`, `app`, `admin`, `dono`, `mail`, `smtp`, `ftp`, `status`, `suporte`, `ajuda`,
  `login`, `static`, `cdn`); **imutável** depois de criado.
- **Primeiro admin** (só na criação): nome + e-mail; senha provisória gerada e mostrada **uma
  vez**; `role = 'admin'`, `senha_provisoria = true`, `email_verificado = true`, `escola_id` = nova.

**Passo a passo do endereço** na página da escola: CNAME `<slug>` → `cname.vercel-dns.com` no
Registro.br; adicionar `<slug>.statusavalia.com.br` em Vercel → Settings → Domains; botão
**Verificar endereço** (o servidor faz `GET https://<slug>.statusavalia.com.br/login` com timeout de
5 s e responde "funcionando ✓" ou "ainda não").

**Desativar/reativar** (`ativa`); o Status (id padrão) não pode ser desativado.

## 6. Regras de acesso (resumo)

- Toda leitura/escrita de dados escolares usa a escola da conta logada; nunca a do endereço.
- Sem login: nenhuma action de dados.
- Dono: painel de escolas; não lê turmas, notas, alunos ou contas de outras escolas.
- Funções que recebem ids sem checar acesso ficam fora de `"use server"`.
- Chave anon só no servidor (sem mudança).

**Fora desta parte:** domínio próprio da escola, "entrar como escola" para suporte, favicon por
escola, RLS por escola, Stripe/alunos de fora, mudar o subdomínio.

## 7. Testes

Unitários: `escolaDoHost` (www, apex, status., subdomínio, vercel.app, localhost, desconhecido,
maiúsculas/porta); decisões de acesso (turma de outra escola, sem login, restrito sem acesso, admin);
validação de subdomínio (formato, reservado); tons derivados e escolha de texto por contraste;
razão de contraste; redirecionamento de conta de outra escola.

Manual: criar "Escola Teste" no painel com subdomínio de teste; configurar CNAME + Vercel; entrar
com o admin dela (troca de senha), criar turma e professor; conferir que nada do Status aparece e
vice-versa; tentar logar com conta do Status no endereço da Escola Teste (redireciona); desativar e
reativar; Hermes segue funcionando no Status.
