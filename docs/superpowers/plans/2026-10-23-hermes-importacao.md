# Importação de provas pela Hermes: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As ferramentas `importar_prova`, `situacao_importacao`, `ler_de_novo` e `aprovar_sem_aviso` importam uma prova em PDF pela Hermes, com o mesmo resultado da tela "Importar prova".

**Architecture:**
- O servidor desenha as páginas do PDF em JPEG (`pdfjs-dist` legacy + `@napi-rs/canvas`), com os parâmetros da tela.
- Os originais ficam no storage, e o desenho acontece em levas de ~40 s, retomadas a cada chamada.
- As regras da importação vão para um núcleo com ator explícito (`AtorEscola` da etapa B), usado pela tela e pela Hermes.

**Tech Stack:** Next.js 16.2 (ler `node_modules/next/dist/docs/`, em especial `serverExternalPackages`), `pdfjs-dist` 6.x (já instalado), `@napi-rs/canvas` 1.0.10 (já no lock como dependência opcional do pdfjs), Supabase Storage, `@modelcontextprotocol/sdk` + zod, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-23-hermes-importacao-design.md` (e a spec mãe `docs/superpowers/specs/2026-10-12-hermes-assistente-pessoal-design.md`, seção Etapa B).

## Global Constraints

- **Desenho:** 150 dpi (`escala = min(150/72, 1600 / largura_base)`), fundo branco, JPEG qualidade 0,8. Os mesmos números de `src/components/questoes/ImportarProva.tsx` (`LARGURA_MAX = 1600`). Caminho `importacao/<id>/<tipo>-<n>.jpg` via `caminhoPagina`. Linha em `importacao_paginas` com largura e altura reais.
- **Entrada:**
  - só `https`; recusar host `localhost`, IP literal privado ou loopback (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7);
  - no máximo 30 MB (abortar a leitura ao passar);
  - 30 s para baixar;
  - os primeiros bytes precisam ser `%PDF`;
  - o base64 tem o mesmo limite.
- **Páginas:** `lerPaginas(texto, total)`; "todas" = todas; no máximo 60 por arquivo (`MAX_PAGINAS`).
- **Levas:** orçamento de **40 000 ms** de desenho por chamada. Tudo desenhado → `iniciarLeituraPor` uma vez só (o `reservar` atual garante isso).
- **Permissões:**
  - `podeImportar(ator, escopo)`: banco geral só o dono;
  - perfil professor só no banco da própria escola, com `professor_telefone` obrigatório;
  - `criado_via = 'hermes'` na importação.
- Toda ferramenta passa por `executarRegistrado` (`src/lib/hermes/registro.ts`).
- As `instructions` dos dois perfis: antes de `importar_prova` e de `aprovar_sem_aviso`, resumir e pedir confirmação, citando o custo estimado (`estimarCustoPaginas`). Depois de importar, chamar `situacao_importacao` até "lendo" ou "concluída".
- A tela "Importar prova" continua igual por fora.
- **Schema manual:** o SQL vai em `db/2026-10-23-hermes-importacao.sql` e no fim de `db/schema.sql`. Conferir antes de publicar.
- Textos em pt-BR. Testes novos registrados no script `test`.
- Worktree `.worktrees/hermes-b2`. Antes de cada task, `git fetch` e `git rebase origin/master`.

## Review Focus

1. **PDF de 60 páginas:** nenhuma chamada passa de 60 s; cada `situacao_importacao` avança e nunca redesenha página pronta; ao fim, a leitura começa uma vez só. Teste da divisão em levas na Task 3.
2. **Link do Telegram que expira entre as chamadas:** as levas seguintes usam o original guardado, nunca o link. Teste na Task 3.
3. **PDF corrompido, protegido por senha ou com zero páginas selecionadas:** mensagem clara ("O PDF da prova está protegido por senha.", "Nenhuma página escolhida."), sem importação pela metade presa em "enviando". Testes nas Tasks 1 e 3.
4. **Professor manda `banco: "geral"`, ou o dono não diz a escola** (com mais de uma) → recusa ou pede a escola. Teste na Task 4.
5. **Duas chamadas de `situacao_importacao` ao mesmo tempo** (a Hermes repetindo) → não desenham a mesma página duas vezes de forma destrutiva (o `upsert` em `importacao_paginas` + o storage com upsert tornam isso seguro) e não iniciam a leitura duas vezes. Teste na Task 3.

---

### Task 1: Desenho de PDF no servidor

**Files:**
- Create: `src/lib/questoes/pdf-servidor.ts`, `src/lib/questoes/pdf-servidor.test.ts`, `src/lib/questoes/__fixtures__/prova-2-paginas.pdf` (PDF pequeno feito por nós: 2 páginas A4 com texto "Questão 1" / "Questão 2"; gerar com um script de uma vez, sem conteúdo de terceiros)
- Modify: `next.config.*` (`serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"]`, se a leitura da doc do Next indicar), `package.json` (teste)

**Interfaces — Produces:**
- `abrirPdfServidor(bytes: Uint8Array): Promise<{ numPaginas: number; desenhar(n: number): Promise<{ jpeg: Buffer; largura: number; altura: number }>; fechar(): Promise<void> }>`.
  - Usa `pdfjs-dist/legacy/build/pdf.mjs` sem worker, e o canvas do `@napi-rs/canvas`.
  - Senha → erro "O PDF está protegido por senha.".
  - Arquivo inválido → "Não consegui abrir o PDF.".
- `escalaPagina(larguraBase: number): number` (puro): `min(150/72, 1600/larguraBase)`.

- [ ] **Step 1:** Escrever os testes:
  - `escalaPagina(595)` → 150/72;
  - `escalaPagina(2000)` → 0,8;
  - abrir o fixture → `numPaginas` = 2;
  - `desenhar(1)` → `jpeg` começa com `FF D8`, `largura` ≤ 1600 e `altura` > `largura` (A4 em pé);
  - bytes `"%PDF-lixo"` → "Não consegui abrir o PDF.".
- [ ] **Step 2:** `npx tsx --test src/lib/questoes/pdf-servidor.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Implementar. Conferir no `package-lock.json` que o `@napi-rs/canvas` está travado na 1.0.10 e que não entra **nenhum pacote novo** no `package.json` (é dependência opcional já instalada). Se o pdfjs exigir declarar o pacote, adicionar `@napi-rs/canvas` **exatamente 1.0.10** e rodar `npm audit signatures`.
- [ ] **Step 4:** Rodar `npm run build` e conferir que a rota do MCP compila com o desenho, sem erro de módulo nativo. Rodar `npm test`, `npx tsc --noEmit` e `npm run lint`. Esperado: 0.
- [ ] **Step 5:** Commit "Importacao: desenho de PDF no servidor".

### Task 2: Núcleo da importação com ator

**Files:**
- Create: `src/lib/questoes/importacao-nucleo.ts`
- Modify: `src/actions/importacoes.ts` (casca fina: `atorDaSessao()` → `…Por`), `src/lib/questoes/acesso.ts` (`exigirImportacaoPor(ator, id)`)

**Interfaces:**
- Consumes: `AtorEscola` e `atorDaSessao` (`src/lib/simulados/ator.ts`); `podeImportar`.
- Produces:
  - `criarImportacaoPor(ator, d: { escopo; banca; ano; caderno }): Promise<string>`: grava `criado_via` quando `ator.via !== "app"`, e `escola_id = ator.escola_id` para escopo escola;
  - `registrarPaginaPor(ator, id, tipo, numero, largura, altura)`;
  - `prepararEnvioPaginaPor`;
  - `iniciarLeituraPor(ator, id)`;
  - `atualizarImportacaoPor(ator, id): Promise<SituacaoImportacao>`;
  - `lerDeNovoPor(ator, id)`;
  - `aprovarSemAvisoPor(ator, id): Promise<number>`;
  - `exigirImportacaoPor(ator, id)`.

  As mensagens, a ordem das verificações e os efeitos são os mesmos de hoje.

- [ ] **Step 1:** Mover a lógica. As exportações de `src/actions/importacoes.ts` mantêm as mesmas assinaturas. Grep por todos os chamadores (`ImportarProva`, `AcompanharImportacao`, a página da importação e a da revisão) e conferir que nada muda para eles.
- [ ] **Step 2:** Rodar `npm test`, `npx tsc --noEmit`, `npm run lint` e `npm run build`. Esperado: 0.
- [ ] **Step 3:** Commit "Importacao: regras num nucleo com ator explicito".

### Task 3: Download seguro, originais e desenho em levas

**Files:**
- Create: `src/lib/questoes/pdf-entrada.ts` (validação pura + download), `src/lib/questoes/pdf-entrada.test.ts`, `src/lib/questoes/importacao-levas.ts`, `src/lib/questoes/importacao-levas.test.ts`, `db/2026-10-23-hermes-importacao.sql`
- Modify: `db/schema.sql` (anexar o SQL), `package.json`

**Interfaces — Produces:**
- `validarUrlPdf(url: string): string | null` (puro): devolve a mensagem de erro ou `null`.
- `validarBytesPdf(b: Uint8Array): string | null` (puro).
- `baixarPdf(url: string, limiteBytes = 31457280, timeoutMs = 30000): Promise<Uint8Array>`: lê por stream e aborta ao passar do limite.
- `decodificarBase64Pdf(s: string): Uint8Array`, com o mesmo limite.
- `guardarOriginal(importacaoId, tipo, bytes)` / `lerOriginal(importacaoId, tipo)`: `importacao/<id>/original-<tipo>.pdf` no bucket `questoes`.
- `planejarLeva(pendentes: number[], tempoMedioMs: number | null, orcamentoMs = 40000): number[]` (puro): quantas páginas cabem no orçamento. Sem média, começa com 5. Sempre pelo menos 1.
- `desenharProximaLeva(ator: AtorEscola, importacaoId: string, selecao: { prova: number[]; gabarito: number[] }, agora = Date.now): Promise<{ prontas: number; faltam: number; erro?: string }>`:
  - descobre as páginas que faltam: as escolhidas menos as que já têm linha em `importacao_paginas`;
  - desenha a partir do original guardado, envia o JPEG (`upsert`) e chama `registrarPaginaPor`;
  - para quando o orçamento acaba.
  - A seleção fica gravada no próprio storage (`importacao/<id>/selecao.json`), para que as chamadas seguintes não dependam da Hermes repetir os parâmetros.

SQL: `update storage.buckets` do bucket `questoes`, aceitando `application/pdf` e até 30 MB (31 457 280 bytes), mantendo os tipos atuais (revisar o trecho de `43702ff:db/2026-10-20-hermes-origem.sql`), mais `NOTIFY pgrst`.

- [ ] **Step 1:** Escrever os testes:
  - `validarUrlPdf`:
    - `http://…` → recusa;
    - `https://localhost/x.pdf`, `https://127.0.0.1/a`, `https://10.0.0.5/a`, `https://[::1]/a` e `https://192.168.1.2/a` → recusa;
    - `https://api.telegram.org/file/bot…/x.pdf` → aceita.
  - `validarBytesPdf`: sem `%PDF` → "O arquivo não é um PDF."; acima do limite → "O PDF passa de 30 MB.".
  - `planejarLeva`:
    - 60 pendentes e média de 900 ms → 44;
    - sem média → 5;
    - média de 50 000 ms → 1;
    - lista vazia → [].
  - Levas com um "desenhador" falso injetado, sem Supabase:
    - segunda chamada não redesenha página pronta;
    - original lido do storage e não da URL (item 2 da Review Focus);
    - página que falha → `erro` citando o número.
- [ ] **Step 2:** `npx tsx --test src/lib/questoes/pdf-entrada.test.ts src/lib/questoes/importacao-levas.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Implementar. A função de levas recebe dependências injetáveis (ler original, desenhar, enviar e registrar), para os testes não precisarem de rede.
- [ ] **Step 4:** Rodar `npm test`, `npx tsc --noEmit` e `npm run lint`. Esperado: 0.
- [ ] **Step 5:** Commit "Importacao: download seguro, originais e desenho em levas".
- [ ] **Step 6 (controller):** mandar o SQL ao Peter e conferir depois (só leitura): o bucket aceita `application/pdf`.

### Task 4: Ferramentas da Hermes

**Files:**
- Create: `src/lib/mcp/acoes/importacao.ts`, `src/lib/mcp/acoes/importacao.test.ts`
- Modify: `src/lib/mcp/acoes.ts` (registrar), `src/app/api/mcp/dono/route.ts` e `src/app/api/mcp/route.ts` (`INSTRUCOES`), `src/app/banco/importacoes/...` (selo da Hermes na lista de importações, se houver lista; leitura tolerante de `criado_via`), `package.json`

**Interfaces — Consumes:**
- `atorDoEscopo`, `escolaParaCriar` e `registrado`/`executarRegistrado` da etapa B (`src/lib/mcp/acoes/ator.ts`);
- Tasks 2 e 3.

Ferramentas e parâmetros: os da spec.

- **`importar_prova`:**
  - exige exatamente um entre `prova_url` e `prova_base64`;
  - o gabarito é opcional;
  - valida o escopo: o professor recebe "Você só pode importar no banco da sua escola." para `geral`;
  - baixa, valida, cria a importação e guarda os originais e a seleção;
  - roda a primeira leva.
  - Se falhar depois de criar a importação: marca a importação com erro (mesmo padrão do `enviarLote`: `status` e `erro`) e responde com a mensagem.
- **`situacao_importacao`:**
  - ainda faltam páginas → roda a próxima leva;
  - acabaram e o status é "enviando" → `iniciarLeituraPor`;
  - senão → `atualizarImportacaoPor`.
  - Resposta: situação, páginas prontas/total, questões criadas, avisos, link `/banco/importacoes/<id>/revisar` no domínio da escola (`urlDaEscola`).
- **`ler_de_novo`** e **`aprovar_sem_aviso`**: chamam o núcleo.

- [ ] **Step 1:** Escrever os testes dos textos de resposta e das validações de parâmetro (puros):
  - os dois campos de prova ao mesmo tempo → erro;
  - professor com `geral` → recusa (item 4 da Review Focus);
  - `paginas_prova: "todas"` → `null`;
  - resposta com "faltam N páginas" e a instrução de chamar `situacao_importacao`.
- [ ] **Step 2:** `npx tsx --test src/lib/mcp/acoes/importacao.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Implementar e registrar nos dois perfis. Atualizar as `INSTRUCOES` conforme as Global Constraints.
- [ ] **Step 4:** Rodar `npm test`, `npx tsc --noEmit`, `npm run lint` e `npm run build`. Esperado: 0.
- [ ] **Step 5:** Commit "Hermes: importar prova em PDF".

### Task 5: Conferência ponta a ponta e entrega

- [ ] **Na HARMONIA (escola de teste), sem gastar IA**, com cliente MCP em memória e perfil dono:
  1. `importar_prova` com o fixture em base64, `banco: "escola"`, `escola: "HARMONIA"`, todas as páginas;
  2. `situacao_importacao` até "todas as páginas desenhadas".

  Conferir no banco e no storage, só lendo, os 2 JPEGs, as 2 linhas de `importacao_paginas` com largura e altura, os originais, `criado_via = 'hermes'` e as linhas do `hermes_registro`.

  **Não chamar `iniciarLeitura`** (não há `ANTHROPIC_API_KEY` local). Deixar a importação de teste parada em "enviando", ou apagá-la pelo caminho que a tela usa, se existir. Dizer no relatório o que ficou.
- [ ] **Teste de PDF maior:** desenhar localmente, sem gravar, um PDF de 20 páginas gerado por nós. Medir o tempo por página e confirmar a divisão em levas.
- [ ] Rodar `npx tsc --noEmit`, `npm test`, `npm run lint` e `npm run build`, todos com saída 0.
- [ ] Com o SQL conferido: publicar (rebase em `origin/master`, push) e conferir o deploy. Avisar o Peter para fazer a primeira importação real pela Hermes: uma prova curta, para a leitura pela IA rodar na Vercel.
