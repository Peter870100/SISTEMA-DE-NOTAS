@AGENTS.md

# Estado do projeto (atualizado em 2026-10-05)

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

## Próximo passo
- **Loja com Stripe** (alunos de fora: curso avulso ou pacote completo com treinos; Pix e cartão 12x):
  spec `docs/superpowers/specs/2026-10-05-loja-stripe-design.md` e plano
  `docs/superpowers/plans/2026-10-05-loja-stripe.md` prontos. Falta o Peter aprovar o plano e então
  executar com subagentes. O SQL da loja (seção 1 da spec) ainda NÃO foi colado.
- Depois: Parte 5 — gerador de questões por IA (RAG com Voyage + pgvector).

## Pendências do Peter
- `ANTHROPIC_API_KEY` na Vercel → reimportar os anos do ENEM para classificar matéria/assunto (só
  assim as questões podem ser publicadas e usadas nos simulados).
- Verificar domínio no Resend (hoje e-mails só chegam ao dono da conta Resend).
- CNAME `teste` → `cname.vercel-dns.com` no Registro.br + domínio na Vercel, para testar a Escola Teste
  (escola já criada no painel; senha provisória do admin redefinida).
- Conta Stripe (modo de teste) e chaves `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` na Vercel.
- Decidir: dono continua vendo/editando questões de todas as escolas, ou restringir?
