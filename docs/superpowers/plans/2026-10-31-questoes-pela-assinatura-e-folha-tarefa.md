# Questões pela assinatura + folha de tarefa — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ferramenta `salvar_questoes` no MCP do dono (grava questões escritas pelo Claude, sem IA paga) e script local que monta a folha de tarefa e o gabarito em `.docx`.

**Architecture:** A gravação reaproveita o caminho do gerador (`respostaParaGeradas` + linha em `geracoes_ia`, já `concluida`, custo 0). A folha é um módulo puro em `src/lib/folha/` (dados → `Buffer` .docx com a biblioteca `docx`) chamado por `scripts/folha-tarefa.ts`, que lê as questões do Supabase.

**Tech Stack:** Next.js 16.2 / TypeScript, MCP SDK, zod, Supabase, `docx@9.11.0` (devDependency, versão exata), testes `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-30-questoes-pela-assinatura-e-folha-tarefa-design.md` (imagem de referência em `docs/superpowers/specs/assets/2026-10-30-folha-exemplo-enem.png`).

## Global Constraints

- Nada neste caminho chama a API da Anthropic; `custo_usd` = 0 e tokens nulos em `geracoes_ia`.
- Questões gravadas: `escopo 'geral'`, `escola_id null`, `status 'revisao'`, `origem 'ia'`, `banca 'Gerada por IA'`, `resolucao` preenchida, `criado_por` = conta do dono.
- `geracoes_ia.orientacao` = `"Escrita pelo Claude (assinatura)"` (constante `ORIENTACAO_ESCRITAS`).
- 1 a 10 questões por chamada; 5 alternativas A–E, textos distintos.
- `salvar_questoes` existe **só** no perfil `dono`.
- Sem SQL novo.
- Fórmulas: texto Unicode (x², ½, √, ×, ÷, ≤, ≥, π, %); nunca LaTeX.
- Folha: marca do Colégio Status (`public/LOGO2025_CURVAS.png`, 1580×513); nunca nome/logo do exemplo (Somos).
- Saída da folha em `folhas/` (adicionar `/folhas/` ao `.gitignore`).
- Senha do MCP nunca impressa nem gravada em arquivo versionado.
- Textos para o usuário em pt-BR.

## Review Focus

1. Assunto pedido que não existe ou é ambíguo → erro que lista os assuntos válidos (o Claude corrige e repete), nunca grava sem querer em outro assunto. Teste na Tarefa 2 (via `assuntoDaMateria`, já testado no projeto; checar que o erro chega no texto da ferramenta).
2. Alternativa repetida ou faltando letra → aquela questão é descartada e contada; se todas caem, erro e a geração fica `erro`. Teste na Tarefa 1.
3. Enunciado com várias linhas, negrito `**...**` e itálico `*...*` → parágrafos e marcas preservados no Word. Teste na Tarefa 3.
4. Último parágrafo de crédito ("ANDRADE, M. Macunaíma. Disponível em: ...") → menor e à direita; parágrafo normal com "Disponível" no meio de frase longa não. Teste na Tarefa 3.
5. Questão pedida na folha com figura ou `conteudo` formatado → aviso no terminal (Etapa 2), não falha silenciosa. Teste na Tarefa 4 (função pura `avisosDaQuestao`).

---

### Task 1: Núcleo puro das questões escritas

**Files:**
- Create: `src/lib/questoes/escritas.ts`
- Test: `src/lib/questoes/escritas.test.ts`
- Modify: `package.json` (incluir o teste no script `test`)

**Interfaces:**
- Consumes: `RespostaGeracao` de `src/lib/questoes/geracao.ts`.
- Produces:
  - `export const ORIENTACAO_ESCRITAS = "Escrita pelo Claude (assinatura)"`
  - `export type QuestaoEscrita = { enunciado: string; comando: string; alternativas: { letra: "A"|"B"|"C"|"D"|"E"; texto: string }[]; resposta: "A"|"B"|"C"|"D"|"E"; resolucao: string }`
  - `export function escritasParaResposta(qs: QuestaoEscrita[]): RespostaGeracao` — copia cada item com `assunto_id: null`.
  - `export function textoQuestoesSalvas(d: { geracaoId: string; ids: string[]; descartadas: number; link: string }): string`

- [ ] **Step 1: Testes**

```ts
test("escritasParaResposta: mantém ordem e zera assunto_id", () => {
  const r = escritasParaResposta([q("Um"), q("Dois")]);
  assert.deepEqual(r.questoes.map((x) => x.enunciado), ["Um", "Dois"]);
  assert.ok(r.questoes.every((x) => x.assunto_id === null));
});
test("respostaParaGeradas descarta alternativa repetida (via escritas)", () => {
  const ruim = { ...q("Três"), alternativas: q("x").alternativas.map((a) => ({ ...a, texto: "igual" })) };
  const { linhas, descartadas } = respostaParaGeradas(escritasParaResposta([q("Um enunciado bem diferente aqui"), ruim]), ctxBase);
  assert.equal(linhas.length, 1);
  assert.equal(descartadas, 1);
  assert.equal(linhas[0].status, "revisao");
  assert.equal(linhas[0].origem, "ia");
  assert.equal(linhas[0].escopo, "geral");
});
test("textoQuestoesSalvas: ids na ordem, descartadas e link", () => {
  const t = textoQuestoesSalvas({ geracaoId: "g1", ids: ["a", "b"], descartadas: 1, link: "https://x/banco" });
  assert.match(t, /2 questões salvas em revisão/);
  assert.match(t, /1\. a\n2\. b/);
  assert.match(t, /1 descartada/);
  assert.match(t, /https:\/\/x\/banco/);
  assert.match(t, /g1/);
});
```
(`q(enunciado)` = helper com 5 alternativas distintas, resposta "B", resolução "r"; `ctxBase` = `ContextoGeradas` com escopo "geral", escola_id null, materia "matematica", referencias [], assuntosValidos new Set().)

- [ ] **Step 2: Rodar e ver falhar** — `npx tsx --test src/lib/questoes/escritas.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** `escritas.ts` com as assinaturas acima. Texto: `"<n> questões salvas em revisão (lote <geracaoId>):\n1. <id>\n2. <id>…"`, depois `"<k> descartada(s) (alternativas inválidas ou repetidas)."` só se k > 0, depois `"Revisar: <link>"`. Singular "1 questão salva".
- [ ] **Step 4: Rodar e ver passar.** Adicionar o arquivo ao script `test` do `package.json`.
- [ ] **Step 5: Commit** `git commit -m "Questoes escritas: nucleo puro"`

### Task 2: `salvarQuestoesEscritasPor` + ferramenta `salvar_questoes` (só dono)

**Files:**
- Modify: `src/lib/questoes/geracao-servidor.ts` (nova função exportada no fim)
- Modify: `src/lib/mcp/acoes/geracao.ts` (registrar a ferramenta dentro de `if (perfil === "dono")`)
- Test: `src/lib/mcp/acoes/geracao-registro.test.ts` (+ incluir no script `test`)

**Interfaces:**
- Consumes: Tarefa 1; `respostaParaGeradas`, `anoLocal`, `recentesGeradas` (privada, mesmo arquivo); `contaDoDono`, `atorDoEscopo`, `registrado`, `falha`, `campoTelefone` (não precisa), `texto`; `assuntoDaMateria(ctx, nome, materia, true)`; `materiaDoTexto` de `../leitura/banco`; `urlDaEscola`, `slugDaEscola` (já no arquivo).
- Produces:
  - `export async function salvarQuestoesEscritasPor(ator: AtorGeracao, d: { materia: Materia; assunto_id: string | null; dificuldade: Dificuldade; questoes: QuestaoEscrita[] }): Promise<{ geracaoId: string; ids: string[]; descartadas: number }>`
  - Ferramenta MCP `salvar_questoes` com entrada `{ materia: string; assunto?: string; dificuldade: "facil"|"media"|"dificil"; questoes: QuestaoEscrita[] (min 1, max 10) }`.

- [ ] **Step 1: Teste de registro**

```ts
function servidorFalso() { const nomes: string[] = []; return { nomes, server: { registerTool: (n: string) => { nomes.push(n); } } as unknown as McpServer }; }
test("salvar_questoes só existe para o dono", () => {
  const dono = servidorFalso(); registrarAcoesGeracao(dono.server, async () => { throw new Error("x"); }, "dono");
  const prof = servidorFalso(); registrarAcoesGeracao(prof.server, async () => { throw new Error("x"); }, "professor");
  assert.ok(dono.nomes.includes("salvar_questoes"));
  assert.ok(!prof.nomes.includes("salvar_questoes"));
  assert.ok(prof.nomes.includes("gerar_questoes"));
});
```
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: `salvarQuestoesEscritasPor`** — mesma sequência de `comecarGeracaoPor`/`concluirGeracaoPor`, sem IA e sem cota: insere `geracoes_ia` (`escola_id: ator.escola_id`, `professor_id: ator.id`, `escopo: "geral"`, `materia`, `assunto_id`, `dificuldade`, `orientacao: ORIENTACAO_ESCRITAS`, `quantidade_pedida: questoes.length`, `status: "gerando"`); referências = `recentesGeradas` (pedido com escopo geral); `respostaParaGeradas(escritasParaResposta(qs), { escopo: "geral", escola_id: null, materia, assuntoPedido: d.assunto_id, assuntosValidos: new Set(), referencias, geracao_id, criado_por: ator.id, ano: anoLocal(new Date()) })`; nenhuma linha → erro "Nenhuma questão passou na conferência (confira as 5 alternativas, todas diferentes)."; insere em `questoes` com `.select("id")` preservando a ordem; fecha `status "concluida"`, `quantidade_gerada`, `custo_usd: 0`. Qualquer erro → `update status "erro", erro: mensagem` e relança.
- [ ] **Step 4: Ferramenta** — descrição exata:
  `"Grava questões que VOCÊ já escreveu (não chama IA, sem custo) no banco geral, em revisão. Use só quando o Peter pedir questões escritas por você; para a IA do site use gerar_questoes. De 1 a 10 por chamada, cada uma com enunciado, comando, 5 alternativas (A a E, todas diferentes), resposta e resolução. Fórmulas em texto Unicode (x², ½, √, ×), nunca LaTeX; negrito **assim** e itálico *assim*; créditos do texto (autor, \"Disponível em:\") no último parágrafo do enunciado. Devolve os ids na ordem enviada."`
  Corpo: `const ctx = await obter(args)`; `dono = await contaDoDono(ctx)`; `ator = await atorDoEscopo(ctx, dono.escola_id)`; `materia = materiaDoTexto(args.materia)` (inválida → erro "Matéria não reconhecida"); `assunto_id = args.assunto ? await assuntoDaMateria(ctx, args.assunto, materia, true) : null`; `registrado(perfil, ator, "salvar_questoes", { materia, assunto: args.assunto, dificuldade, quantidade }, …)` (não registra os textos inteiros); responde `textoQuestoesSalvas` com link `urlDaEscola(slug, "/banco?origem=ia&status=revisao&materia=" + materia)`; `atualizarTelas()`; erros via `falha("salvar as questões", e)`.
- [ ] **Step 5: Rodar** `npm test`, `npm run lint`, `npx tsc --noEmit` → tudo passa.
- [ ] **Step 6: Commit** `git commit -m "MCP do dono: salvar_questoes (questoes escritas pelo Claude, sem IA paga)"`

### Task 3: Montagem da folha e do gabarito (`src/lib/folha/`)

**Files:**
- Modify: `package.json` / `package-lock.json` (`npm i -D docx@9.11.0 --save-exact`)
- Create: `src/lib/folha/texto.ts` (puro), `src/lib/folha/docx.ts`
- Test: `src/lib/folha/folha.test.ts` (+ script `test`)

**Interfaces:**
- Consumes: `markdownParaBlocos(texto): Segmento[][]` de `src/lib/questoes/markdown.ts`.
- Produces:
  - `export type QuestaoFolha = { id: string; enunciado: string; comando: string; alternativas: { letra: string; texto: string }[]; resposta: string | null; resolucao: string | null; materia: string }`
  - `export type DadosFolha = { titulo: string; escola: string; logo: Buffer | null; questoes: QuestaoFolha[] }`
  - `texto.ts`: `export function ehCredito(paragrafo: string): boolean`; `export function numero2(n: number): string` ("01"); `export function separarCredito(enunciado: string): { corpo: Segmento[][]; credito: string | null }` (crédito só se o **último** parágrafo não vazio passar em `ehCredito`).
  - `docx.ts`: `export async function folhaAluno(d: DadosFolha): Promise<Buffer>`; `export async function folhaGabarito(d: DadosFolha): Promise<Buffer>`.

- [ ] **Step 1: Testes**

```ts
test("ehCredito", () => {
  assert.equal(ehCredito("ANDRADE, M. Macunaíma. Disponível em: www.bd.camara.leg.br. Acesso em: 17 set. 2023."), true);
  assert.equal(ehCredito("ZIEGLER, M. F. Disponível em: www.revistagalileu.globo.com."), true);
  assert.equal(ehCredito("Os produtos estavam disponíveis em várias lojas da cidade e o preço subiu 20% no mês."), false);
  assert.equal(ehCredito(""), false);
});
test("separarCredito: só o último parágrafo", () => {
  const r = separarCredito("Texto **forte** um.\nTexto dois.\nSILVA, J. Livro. Acesso em: 1 jan. 2024.");
  assert.equal(r.credito, "SILVA, J. Livro. Acesso em: 1 jan. 2024.");
  assert.equal(r.corpo.length, 2);
  assert.ok(r.corpo[0].some((s) => s.negrito && s.texto === "forte"));
  assert.equal(separarCredito("Sem crédito nenhum aqui.").credito, null);
});
test("numero2", () => { assert.equal(numero2(1), "01"); assert.equal(numero2(12), "12"); });
test("folhaAluno e folhaGabarito geram .docx (zip)", async () => {
  const d = { titulo: "Tarefa de Matemática", escola: "Colégio Status", logo: null, questoes: [qf("Quanto é 2²?")] };
  for (const b of [await folhaAluno(d), await folhaGabarito(d)]) assert.equal(b.subarray(0, 2).toString(), "PK");
});
```
`ehCredito`: verdadeiro se contém "Disponível em" ou "Acesso em" (sem diferenciar maiúsculas) **e** tem até 300 caracteres, ou se começa com SOBRENOME em maiúsculas seguido de vírgula (`/^[A-ZÀ-Ý]{2,}(?:\s[A-ZÀ-Ý]{2,})*,\s/`).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Instalar** `npm i -D docx@9.11.0 --save-exact` (pacote conferido: `dolanmiu/docx`, versão de 2026-10-13).
- [ ] **Step 4: Implementar `texto.ts`.**
- [ ] **Step 5: Implementar `docx.ts`** seguindo a seção "Diagramação" da spec e a imagem de referência. Decisões fixas: A4, margens 1,27 cm; Arial 11 pt (créditos 8 pt); 1ª página com cabeçalho (logo ~4,5 cm de largura à esquerda se `logo`, título centralizado em negrito 14 pt, nome da escola), depois linhas "Nome: ____  Turma: ____  Nº: ____  Data: ___/___/____" e linha horizontal; corpo em seção de 2 colunas com `separate: true` (linha entre colunas; pontilhada se a biblioteca permitir, senão contínua); título "QUESTÃO n" negrito com borda inferior grossa dupla no parágrafo (efeito da barra) e `keepNext`; texto justificado com recuo de 1ª linha 0,6 cm; comando em parágrafo próprio; alternativa = letra branca em negrito com sombreamento preto (`shading`) + tabulação + texto com recuo pendente 0,6 cm; rodapé com título à esquerda e número de página à direita (`PageNumber.CURRENT`). Gabarito: mesmo topo sem as linhas de nome, título "<titulo> — Resoluções", 2 colunas; por questão: `numero2(n)` negrito + resolução justificada, depois "Resposta: X" negrito.
- [ ] **Step 6: Rodar** `npm test`, lint e `tsc` → passam.
- [ ] **Step 7: Commit** `git commit -m "Folha de tarefa: montagem .docx (aluno e gabarito)"`

### Task 4: Script `scripts/folha-tarefa.ts` + ligação do Claude Code + documentação

**Files:**
- Create: `scripts/folha-tarefa.ts`, `src/lib/folha/avisos.ts`, `docs/folha-tarefa.md`
- Modify: `.gitignore` (`/folhas/`), `src/lib/folha/folha.test.ts`

**Interfaces:**
- Consumes: `folhaAluno`, `folhaGabarito`, `QuestaoFolha` (Tarefa 3).
- Produces: `export function avisosDaQuestao(q: { id: string; temImagem: boolean; temConteudo: boolean }, n: number): string[]`; CLI:
  `npx tsx scripts/folha-tarefa.ts --titulo "Tarefa de Matemática — Porcentagem" (--ids id1,id2,... | --geracao <id>)`
  grava `folhas/<AAAA-MM-DD>-<slug-do-titulo>.docx` e `folhas/<…>-gabarito.docx` e imprime os dois caminhos.

- [ ] **Step 1: Teste**

```ts
test("avisosDaQuestao", () => {
  assert.deepEqual(avisosDaQuestao({ id: "a", temImagem: false, temConteudo: false }, 1), []);
  assert.match(avisosDaQuestao({ id: "a", temImagem: true, temConteudo: false }, 3)[0], /Questão 3 .*figura/);
  assert.match(avisosDaQuestao({ id: "a", temImagem: false, temConteudo: true }, 2)[0], /Questão 2 .*formatação/);
});
```
- [ ] **Step 2: Ver falhar; implementar `avisos.ts`; ver passar.**
- [ ] **Step 3: Script** — lê `.env.local` como `scripts/criar-professor.ts` (`NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY`); `--geracao` busca ids por `geracao_id` ordenados por `created_at`; lê `questoes` (`id, enunciado, comando, alternativas, resposta, resolucao, materia, conteudo`) e `questao_imagens` dos ids; mantém a ordem pedida; id não achado → erro e sai com código 1; imprime avisos; logo de `public/LOGO2025_CURVAS.png`; escola "Colégio Status"; cria `folhas/` se faltar.
- [ ] **Step 4: `docs/folha-tarefa.md`** — como pedir (exemplo de frase), o comando do script, e a ligação do Claude Code ao MCP do dono:
  `claude mcp add --transport http --scope local statusavalia-dono https://www.statusavalia.com.br/api/mcp/dono --header "Authorization: Bearer <MCP_DONO_TOKEN do .env.local>"` — com o aviso de não colar a senha no chat (o comando é rodado lendo a variável do arquivo).
- [ ] **Step 5: Rodar** `npm test`, lint, `tsc`, `npm run build` → passam.
- [ ] **Step 6: Commit** `git commit -m "Folha de tarefa: script, avisos e documentacao"`

### Task 5: Publicar e testar de ponta a ponta (sessão principal, não subagente)

- [ ] Rebase em `origin/master`, push para `master`; esperar `tools/list` do `/api/mcp/dono` (com a senha do `.env.local`) conter `salvar_questoes`.
- [ ] Ligar o Claude Code com `claude mcp add` (lendo a senha do `.env.local` sem imprimir).
- [ ] Escrever 3 questões de teste de Matemática (porcentagem), chamar `salvar_questoes` (por JSON-RPC com curl, já que a ferramenta só aparece no Claude Code depois de reiniciar a sessão), conferir no banco (só leitura) as 3 linhas em revisão e a geração `concluida` com custo 0.
- [ ] Rodar o script com `--geracao <id>` e entregar os dois `.docx` ao Peter para ele avaliar o visual.
- [ ] Atualizar `CLAUDE.md` (Pronto e no ar) e a memória.
