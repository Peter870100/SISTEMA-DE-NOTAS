@AGENTS.md

# Estado do projeto (atualizado em 2026-11-04)

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
10. Questões pela assinatura + folha de tarefa (2026-10-31; spec
   `docs/superpowers/specs/2026-10-30-questoes-pela-assinatura-e-folha-tarefa-design.md`): `salvar_questoes`
   (só MCP do dono) grava questões escritas pelo Claude no banco geral em revisão, sem IA paga (lote em
   `geracoes_ia` com custo 0); `scripts/folha-tarefa.ts` gera folha do aluno + gabarito em .docx na pasta
   `folhas/` (uso em `docs/folha-tarefa.md`). Claude Code ligado ao MCP do dono (`statusavalia-dono`).
11. Prova em Word (2026-11-01; spec `docs/superpowers/specs/2026-10-31-prova-em-word-design.md`): prova + gabarito
   .docx com questões oficiais do banco (figuras recortadas, `conteudo` formatado), pela Hermes (`previa_prova_word`,
   `gerar_prova_word`, `listar_provas_word`, `links_prova_word`) e pelo site (`/banco/provas-word`). Histórico em
   `provas_word`/`prova_word_questoes`; "inéditas" = ainda não usadas pelo professor. Download em
   `/api/provas-word/<id>/<prova|gabarito>` (link com `?c=` HMAC ou sessão). Uso em `docs/folha-tarefa.md`.
   Pré-visualização em `/banco/provas-word/<id>/previa` (Imprimir, Baixar Word/PDF; `?qual=gabarito`, `?imprimir=1`).
   Painel **Editar** na prévia (2026-11-02): cabeçalho (turma, data, valor, instruções, "Nome ou apelido do professor"
   em `professores.nome_prova`), subir/descer/arrastar, trocar e remover questões. Valor por questão: total no
   cabeçalho, fixos em `prova_word_questoes.valor` (null = automática, divisão em décimos), "QUESTÃO 01 (1,0)";
   `gerar_prova_word` aceita `valor`/`valores_questoes` (texto p/ o prompt da Hermes em `docs/folha-tarefa.md`).
12. Meu desempenho (2026-11-02; spec `docs/superpowers/specs/2026-11-02-meu-desempenho-design.md`): `/aluno/desempenho`
   (ícone de gráfico) e, na escola, "Conteúdos com mais erro na turma" no relatório + `/turma/<id>/relatorio/aluno/<id>/desempenho`.
   Só usa respostas já gravadas (matéria/assunto); 1ª resposta por questão; regras em `src/lib/desempenho/regras.ts`.
   Dados de teste: `db/dados-teste-desempenho.sql` (turma TESTE DESEMPENHO, usuários `teste.desempenho.*`) e
   `db/apagar-dados-teste-desempenho.sql`. É o projeto 1 de 4 do acompanhamento da aprendizagem.
13. Classificação fina (2026-11-02; spec `docs/superpowers/specs/2026-11-02-classificacao-fina-design.md`; projeto 2 de 4):
   **Tópico** (dentro do assunto) e **Habilidades** (por área, código opcional tipo "H18"), pré-requisitos entre tópicos
   e materiais de revisão. Classifica no editor da questão, uma por vez (`/banco/classificar`), em lote na lista do
   banco e pelo MCP do dono (`questoes_para_classificar`, `classificar_questoes`, até 50 por chamada). Dono gerencia em
   `/banco/assuntos` ("Classificação"). Gatilho no banco zera o tópico que não é do assunto da questão. Regras em
   `src/lib/questoes/classificacao.ts`, gravação em `classificacao-servidor.ts`. SQL colado: `db/2026-11-02-classificacao-fina.sql`
   (tabelas + 268 tópicos de Português/Matemática + H1–H30 de Linguagens e Matemática da Matriz ENEM do INEP).
14. Recomendações e plano de estudo (2026-11-04; spec `docs/superpowers/specs/2026-11-03-plano-de-estudo-design.md`; projeto 3 de 4):
   `/aluno/plano` (ícone de rota): sequência individual derivada do desempenho inicial. O plano não é gravado, é recalculado a
   cada abertura (`src/lib/plano/`). "Revisar": revisar o conteúdo → praticar → revisão posterior; "Mais respostas": diagnóstico.
   Os treinos do plano ficam em `simulados` (`plano_conteudo`, `plano_etapa`, `plano_rodada`) e ficam fora do desempenho inicial;
   "Já revisei" em `plano_revisoes`, tempo por semana em `planos_estudo`. Regras por escola no cartão "Recomendações de estudo" em
   `/configuracoes` (`escolas.regras_aprendizagem`; padrões e limites em `src/lib/plano/regras.ts`). SQL colado: `db/2026-11-03-plano-estudo.sql`.

## Próximo passo
- **Projeto 4 de 4 do acompanhamento da aprendizagem: IA.** Depende de crédito na API Anthropic (ver abaixo). O "guia de estudos da
  própria plataforma" foi deixado para depois: perguntar ao Peter antes de desenhar.
- **Loja com Stripe** (alunos de fora: curso avulso ou pacote completo com treinos; Pix e cartão 12x):
  spec `docs/superpowers/specs/2026-10-05-loja-stripe-design.md` e plano
  `docs/superpowers/plans/2026-10-05-loja-stripe.md` prontos. Falta o Peter aprovar o plano e então
  executar com subagentes. O SQL da loja (seção 1 da spec) ainda NÃO foi colado.
- Conta da API Anthropic está SEM CRÉDITO (2026-10-30): gerador do site e da Hermes falham com
  "credit balance is too low" até o Peter recarregar. A chave na Vercel foi trocada e é válida.
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
