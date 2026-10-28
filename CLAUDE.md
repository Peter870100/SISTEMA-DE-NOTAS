@AGENTS.md

# Estado do projeto (atualizado em 2026-10-28)

Plataforma escolar "Status Avalia" (Next.js 16.2, React 19, Supabase, TypeScript). Produção em
www.statusavalia.com.br (projeto Vercel `sistema-de-notas`, deploy automático a cada push no `master`).
O Peter fala português; respostas em pt-BR.

## Como trabalhamos
- Fluxo: brainstorming → spec (`docs/superpowers/specs/`) → plano (`docs/superpowers/plans/`) →
  execução com subagentes (implementar + revisar cada tarefa, revisão final) → push no `master`.
- Trabalhar em worktree (`.worktrees/<nome>`, junction de `node_modules`, copiar `.env.local` e
  `next-env.d.ts`). Outra sessão pode estar usando a pasta principal: nunca mexer no trabalho não
  commitado dela; integrar só via `origin/master` (rebase).
- Schema do Supabase é manual: o SQL vai em `db/schema.sql` e o Peter cola no SQL Editor. Antes de
  publicar código que depende de SQL novo, conferir no banco (consulta só de leitura) que foi aplicado.
- Chaves só em `.env.local`/Vercel, nunca no chat. Testes: `npm test` (tsx --test), `npm run lint`,
  `npm run build`.

## Pronto e no ar
1. Contas de aluno + várias escolas (login de aluno, código de turma, contas criadas pela escola).
2. Plataforma de estudos: `/cursos` (ícone de livro) — cursos/módulos/aulas com link do YouTube e PDFs,
   % assistido, página de progresso.
3. Banco de questões (`/banco`): importação de PDF por IA, ENEM (enem.dev), questões da escola.
4. Simulados (`/simulados`, `/aluno/simulados`): prova do professor com cronômetro e treinos do aluno.
5. Multiescola: dados separados pela escola da conta (`src/lib/escola-acesso.ts`), escola pelo
   subdomínio (`src/lib/dominio.ts`), visual por escola (`src/lib/marca.ts`), painel do dono `/dono`
   (ícone de prédio; a conta pkinho871@gmail.com é `dono`), "Nova turma" na tela inicial para admin.
6. Hermes etapa A (só leitura): MCP do dono `/api/mcp/dono` (`MCP_DONO_TOKEN`, todas as escolas,
   `consultar_dados` com lista de tabelas/colunas em `src/lib/hermes/consulta-livre.ts`) e leitura no
   MCP do professor `/api/mcp` (escopo pelo telefone: escola + turmas liberadas). Ferramentas em
   `src/lib/mcp/leitura/`. Saídas da página (prova e aula) e tempo assistido real; coluna "Saídas".
7. Hermes etapas B, B2, C1, C2 e D (escrita, importação de prova, contas, professores, cursos,
   relatórios) — a spec da Hermes está toda no ar.
8. Gerador de questões por IA (`/banco/gerar`, "Gerar parecidas" na questão; spec
   `docs/superpowers/specs/2026-10-24-gerador-questoes-ia-design.md`): exemplos pelo assunto, sem
   embeddings; geradas entram em revisão; 60 por escola por dia (dono sem limite); custo em `geracoes_ia`.
9. Gerador na Hermes (2026-10-28; spec `docs/superpowers/specs/2026-10-27-hermes-gerar-questoes-design.md`):
   `gerar_questoes` responde na hora e termina com `after()` (MCPs com `maxDuration` 300);
   `situacao_geracao` lista as geradas e, com `numero`, mostra uma inteira. Código em `src/lib/mcp/acoes/geracao*.ts`.

## Próximo passo
- **Loja com Stripe** (alunos de fora: curso avulso ou pacote completo com treinos; Pix e cartão 12x):
  spec `docs/superpowers/specs/2026-10-05-loja-stripe-design.md` e plano
  `docs/superpowers/plans/2026-10-05-loja-stripe.md` prontos. Falta o Peter aprovar o plano e então
  executar com subagentes. O SQL da loja (seção 1 da spec) ainda NÃO foi colado.
- Gerador na Hermes: falta uma geração real pelo Telegram chegar a "concluída" (confirma que o `after()`
  roda até o fim na Vercel). Se ficar "parou no meio" após 10 min, o `after` não está sendo mantido.
- Build da Vercel às vezes falha baixando Google Fonts (`Can't resolve ...font/google/font`): é passageiro,
  basta outro deploy (commit vazio no `master`).

## Pendências do Peter
- Verificar domínio no Resend (hoje e-mails só chegam ao dono da conta Resend).
- CNAME `teste` → `cname.vercel-dns.com` no Registro.br + domínio na Vercel, para testar a Escola Teste
  (escola já criada no painel; senha provisória do admin redefinida).
- Conta Stripe (modo de teste) e chaves `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` na Vercel.
- `MCP_DONO_TOKEN` na Vercel (diferente de `MCP_SECRET_TOKEN`) + Redeploy; na Hermes, servidor
  `https://www.statusavalia.com.br/api/mcp/dono` com `Authorization: Bearer <token>`; Hermes deve usar
  o telefone do remetente do Telegram como `professor_telefone`.
- Decidir: dono continua vendo/editando questões de todas as escolas, ou restringir?
