# Conferência de imagens — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O professor confere cada questão importada ao lado da página original e completa a figura que falta (recorte no caderno, print colado, arquivo), com posição da figura e estados conferida / falta imagem.

**Architecture:** Regras puras em `src/lib/questoes/conferencia.ts` (testadas); ações de servidor novas em `src/actions/questoes.ts`; a tela `/banco/importacoes/[id]/revisar` ganha filtros, navegação de página e botões; o `EditorQuestao` ganha uma área de imagem nova (`EntradaImagem` + `CortarImagem`) que funciona também antes de criar a questão; `ImagemQuestao` respeita `alinhamento`.

**Tech Stack:** Next.js 16.2 (ler `node_modules/next/dist/docs/` antes de usar API do Next), React 19, Supabase (chave anon no servidor), TypeScript, `tsx --test`, CSS Modules + Tailwind 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-18-conferencia-imagens-design.md`

## Global Constraints

- Textos da interface em pt-BR; padrão visual do `DESIGN.md` (azul `--color-brand` + dourado `--color-gold`, sem texto cinza na área do aluno).
- Imagens: PNG, JPEG ou WebP, até 5 MB (`TAMANHO_MAXIMO` e `MIME` de `src/actions/questoes.ts`).
- Alinhamento: `'esquerda' | 'centro' | 'direita'`, padrão `'centro'`.
- Recortes em frações 0..1 da página, sempre passados por `limitarQuadro` (`src/lib/questoes/quadro.ts`).
- "Falta imagem" → `status='revisao'`, `falta_imagem=true`, `conferida_em=null`. "Conferida" → `falta_imagem=false`, `conferida_em=now`, `status='publicada'` (exige resposta ou anulada, mensagem atual "Marque a resposta certa (ou anulada) antes de publicar.").
- Não filtrar `status` em `questoesParaAluno`: provas existentes continuam com a questão.
- Testes novos registrados no script `test` do `package.json`.
- Trabalhar em `.worktrees/conferencia-imagens` (branch `feature/conferencia-imagens`, parte de `feature/revisar-erros`). Antes das Tasks 5 e 7 (editor): `git fetch` + `git rebase origin/master`; em conflito no `EditorQuestao`, manter o visual da outra sessão e só acrescentar; se ela redesenhou a área de imagem, parar e perguntar ao Peter.

## Review Focus

1. Ctrl+V com texto (não imagem) na área de imagem → nada acontece, nenhum erro; o texto não é colado no lugar errado.
2. Print grande (tela 4K) depois do corte ainda passa de 5 MB em PNG → enviar como JPEG qualidade 0,9; se ainda passar, mensagem "A imagem precisa ter até 5 MB." sem travar o editor.
3. Clique sem arrastar no modo recortar (quadro minúsculo) → ignorado, nenhum recorte criado.
4. "✓ Conferida — próxima" numa questão sem resposta → mensagem de erro, questão continua "a conferir", não navega.
5. Página anterior na primeira página / seguinte na última → botão desabilitado; recorte com `pagina_id` de outra importação → recusado no servidor.

---

### Task 1: Banco, tipos e alinhamento na exibição

**Files:**
- Modify: `db/schema.sql` (anexar ao fim), `src/lib/types.ts` (`Questao`, `QuestaoImagem`, `Database` Insert/Update), `src/components/questoes/ImagemQuestao.tsx`, `src/lib/questoes/consultas.ts`
- Create: `src/lib/questoes/conferencia.ts`, `src/lib/questoes/conferencia.test.ts`

**Interfaces:**
- Produces: `type Alinhamento = "esquerda" | "centro" | "direita"` (em `src/lib/types.ts`); `Questao.falta_imagem: boolean`; `Questao.conferida_em: string | null`; `QuestaoImagem.alinhamento: Alinhamento`; `ImagemTela.alinhamento: Alinhamento`; `export function ImagemIndisponivel()` em `ImagemQuestao.tsx`; `justificarAlinhamento(a: Alinhamento): "flex-start" | "center" | "flex-end"` em `conferencia.ts`.

- [ ] **Step 1: Anexar o SQL da spec (seção 1) a `db/schema.sql`**, com o cabeçalho `-- ===== Conferência de imagens (2026-10-18) =====`.
- [ ] **Step 2: Teste que falha** em `conferencia.test.ts`:

```ts
test("justificarAlinhamento", () => {
  assert.equal(justificarAlinhamento("esquerda"), "flex-start");
  assert.equal(justificarAlinhamento("centro"), "center");
  assert.equal(justificarAlinhamento("direita"), "flex-end");
});
```
Registrar `src/lib/questoes/conferencia.test.ts` no script `test`. Rodar `npx tsx --test src/lib/questoes/conferencia.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** `justificarAlinhamento`; tipos novos; `imagensParaTela` copia `alinhamento` (`i.alinhamento ?? "centro"`); `ImagemQuestao` envolve a figura num `div` com `display:flex; justify-content: justificarAlinhamento(...)`; exportar `ImagemIndisponivel`.
- [ ] **Step 4:** `npx tsx --test src/lib/questoes/conferencia.test.ts` → PASS; `npx tsc --noEmit -p .` → sem erros.
- [ ] **Step 5: Commit** "Conferencia: colunas novas, tipos e alinhamento da figura".

### Task 2: Regras puras da conferência

**Files:** Modify `src/lib/questoes/conferencia.ts`, `conferencia.test.ts`

**Interfaces:**
- Produces:
  - `type EstadoConferencia = "a_conferir" | "conferida" | "falta_imagem"`
  - `estadoConferencia(q: Pick<Questao, "falta_imagem" | "conferida_em">): EstadoConferencia` — `falta_imagem` vence; senão `conferida_em ? "conferida" : "a_conferir"`.
  - `type FiltroConferencia = "a-conferir" | "falta-imagem" | "conferidas"`
  - `camposFaltaImagem(): { status: "revisao"; falta_imagem: true; conferida_em: null }`
  - `camposConferida(agora: Date): { status: "publicada"; falta_imagem: false; conferida_em: string; precisa_revisao: false }`
  - `paginaVizinha(paginas: { id: string; numero: number }[], atualId: string, direcao: -1 | 1): string | null` — só entre as páginas dadas (o chamador passa as `tipo='prova'` da importação), ordenadas por `numero`; `null` nas pontas ou se `atualId` não estiver na lista.
  - `quadroDoArraste(a: { x: number; y: number }, b: { x: number; y: number }): Quadro | null` — retângulo entre dois pontos (qualquer direção), `null` se largura ou altura < 0,01; senão `limitarQuadro`.

- [ ] **Step 1: Testes que falham**: `estadoConferencia` (3 casos + falta_imagem com conferida_em preenchido → `"falta_imagem"`); `camposConferida(new Date("2026-10-18T12:00:00Z")).conferida_em === "2026-10-18T12:00:00.000Z"`; `paginaVizinha` com páginas fora de ordem `[{id:"p3",numero:3},{id:"p1",numero:1},{id:"p2",numero:2}]`: (`"p2"`,-1)→`"p1"`, (`"p2"`,1)→`"p3"`, (`"p1"`,-1)→`null`, (`"p3"`,1)→`null`, (`"px"`,1)→`null`; `quadroDoArraste({x:.5,y:.6},{x:.2,y:.1})` → `{x:.2,y:.1,w:.3,h:.5}`; `quadroDoArraste({x:.5,y:.5},{x:.505,y:.9})` → `null`.
- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar. **Step 4:** rodar → PASS.
- [ ] **Step 5: Commit** "Conferencia: regras puras (estado, pagina vizinha, recorte)".

### Task 3: Ações de servidor

**Files:** Modify `src/actions/questoes.ts`

**Interfaces:**
- Consumes: `camposFaltaImagem`, `camposConferida`, `limitarQuadro`, `exigirEditorQuestao`.
- Produces:
  - `marcarFaltaImagem(questaoId: string): Promise<void>`
  - `marcarConferida(questaoId: string): Promise<void>` — mesma checagem de resposta de `publicarQuestao` e mesma atualização da importação para `concluida` quando não sobra `revisao` (extrair essa parte de `publicarQuestao` para uma função interna e reutilizar).
  - `criarRecorte(questaoId: string, paginaId: string, alvo: AlvoImagem, quadro: Quadro): Promise<void>` — recusa ("Página de outra prova.") se a página não for `tipo='prova'` da mesma `importacao_id` da questão; `ordem` = quantidade atual no mesmo `alvo`; `alinhamento` padrão.
  - `definirAlinhamento(imagemId: string, alinhamento: Alinhamento): Promise<void>` — valida o valor; recusa "Posição inválida.".
  - Todas terminam com `revalidatePath("/banco", "layout")`.

- [ ] **Step 1: Implementar as quatro ações.** (Sem teste automático de banco no projeto; as regras estão cobertas na Task 2.)
- [ ] **Step 2:** `npx tsc --noEmit -p .` e `npm run lint` → sem erros.
- [ ] **Step 3: Commit** "Conferencia: acoes falta imagem, conferida, recorte novo e alinhamento".

### Task 4: Entrada de imagem com corte (componentes)

**Files:**
- Create: `src/components/questoes/EntradaImagem.tsx`, `src/components/questoes/CortarImagem.tsx`, `src/components/questoes/EntradaImagem.module.css`
- Modify: `src/lib/questoes/conferencia.ts`, `conferencia.test.ts`

**Interfaces:**
- Produces:
  - `pixelsDoQuadro(q: Quadro, largura: number, altura: number): { sx: number; sy: number; sw: number; sh: number }` (inteiros, `Math.round`, `sw,sh ≥ 1`) em `conferencia.ts`.
  - `<EntradaImagem rotulo: string; aoEscolher: (arquivo: File) => Promise<void>; desabilitado?: boolean />` — zona com "Cole um print (Ctrl+V) · arraste o arquivo aqui · escolher do computador"; aceita `paste` (só `image/*` do `clipboardData.items`; texto é ignorado), `drop` e `input[type=file]`; abre `CortarImagem` antes de chamar `aoEscolher`.
  - `<CortarImagem arquivo: File; aoUsar: (cortado: File) => void; aoCancelar: () => void />` — modal com a imagem e um retângulo arrastável/redimensionável (começa na imagem inteira); "Usar" desenha num `canvas` com `pixelsDoQuadro` e gera PNG; se > 5 MB, gera JPEG 0,9; se ainda > 5 MB, mostra "A imagem precisa ter até 5 MB.".

- [ ] **Step 1: Teste que falha**: `pixelsDoQuadro({x:.1,y:.2,w:.5,h:.25}, 1000, 800)` → `{sx:100,sy:160,sw:500,sh:200}`; `pixelsDoQuadro({x:0,y:0,w:.0001,h:.0001}, 100, 100)` → `sw===1 && sh===1`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar `pixelsDoQuadro` e os componentes (receitas visuais da skill `status-visual-aluno`: botão principal dourado, contorno azul, sem cinza) → **Step 4:** PASS + `tsc` + `lint`.
- [ ] **Step 5: Commit** "Editor: entrada de imagem com colar, arrastar e cortar".

### Task 5: Editor usa a entrada nova (também antes de criar)

**Files:** Modify `src/components/questoes/EditorQuestao.tsx`, `src/app/banco/nova/page.tsx`

**Interfaces:**
- Consumes: `EntradaImagem`, `definirAlinhamento`, `ImagemTela.alinhamento`, `Questao.falta_imagem`.
- Produces: nenhuma interface nova para outras tasks.

- [ ] **Step 1: Rebase** (`git fetch -q && git rebase origin/master`; regra de conflito das Global Constraints).
- [ ] **Step 2: `blocoImagens`** troca o `label` "Adicionar imagem" por `EntradaImagem`; cada figura ganha três botões de posição (◧ ▣ ◨, `aria-pressed`) chamando `definirAlinhamento`, além de Trocar/Remover.
- [ ] **Step 3: Questão nova**: `pendentes: { alvo: AlvoImagem; arquivo: File; url: string }[]` no estado (miniatura via `URL.createObjectURL`, revogar ao remover/desmontar); em `salvar()` sem `questao`, depois de `criarQuestao`, enviar cada pendente com `prepararEnvioImagem` + `enviarImagem` + `registrarImagem`, e só então `router.push`. Remover o subtítulo "Depois de criar, você pode adicionar imagens." de `/banco/nova`.
- [ ] **Step 4: Aviso** no topo quando `questao?.falta_imagem`: "⚠ Esta questão está marcada como “falta imagem” e não entra em simulados novos." (vermelho, `role="status"`).
- [ ] **Step 5:** `tsc`, `lint`, `npm test` → verdes. **Commit** "Editor: imagem antes de criar, posicao da figura e aviso de falta imagem".

### Task 6: Recortar figura na página (novo recorte + páginas vizinhas)

**Files:** Modify `src/components/questoes/PaginaComQuadros.tsx`

**Interfaces:**
- Consumes: `quadroDoArraste`, `criarRecorte`.
- Produces: props novas `questaoId: string; paginaId: string; anteriorHref: string | null; seguinteHref: string | null`.

- [ ] **Step 1:** Botão **"✂ Recortar figura"** liga o modo recorte (cursor de mira). Arrastar na página desenha o retângulo (`quadroDoArraste`); ao soltar, aparece "Vai para: [Enunciado ▾ A–E] · Usar recorte · Cancelar". "Usar" chama `criarRecorte(questaoId, paginaId, alvo, quadro)` e `router.refresh()`. Quadro `null` (clique) não abre nada.
- [ ] **Step 2:** Links **◀ página anterior / página seguinte ▶** (desabilitados quando `null`). Mover/redimensionar os recortes existentes continua igual.
- [ ] **Step 3:** `tsc`, `lint` → verdes. **Commit** "Conferencia: recortar figura nova e navegar entre paginas".

### Task 7: Tela de conferência e botão na importação

**Files:** Modify `src/app/banco/importacoes/[id]/revisar/page.tsx`, `src/components/questoes/EditorQuestao.tsx`, `src/components/questoes/AcompanharImportacao.tsx`, `src/actions/importacoes.ts` (`SituacaoImportacao`)

**Interfaces:**
- Consumes: `estadoConferencia`, `paginaVizinha`, `marcarFaltaImagem`, `marcarConferida`, props novas de `PaginaComQuadros`.
- Produces: `SituacaoImportacao.aConferir: number` (questões da importação com `estadoConferencia === "a_conferir"`).

- [ ] **Step 1: Rebase** (mesma regra).
- [ ] **Step 2: Página `revisar`**: lê `?pagina=<id>` (padrão: `atual.pagina_id`); carrega as páginas `tipo='prova'` da importação para `paginaVizinha`; filtros novos `a-conferir` (padrão ao abrir sem filtro), `falta-imagem`, `conferidas`, além dos atuais; ícone na lista ○ / ✓ / ⚠ por `estadoConferencia`; abre na primeira "a conferir".
- [ ] **Step 3: `EditorQuestao` em `modoRevisao`**: rodapé com **"⚠ Falta imagem"** (`marcarFaltaImagem`, fica na questão) e **"✓ Conferida — próxima"** (`salvar()` → `marcarConferida` → `router.push(proximaHref)`; em erro, mostra a mensagem e não navega). Substituem "Aprovar e próxima".
- [ ] **Step 4: `AcompanharImportacao`**: ao lado de "Revisar", botão **"Conferir imagens (N a conferir)"** → `/banco/importacoes/[id]/revisar?filtro=a-conferir`.
- [ ] **Step 5:** `tsc`, `lint`, `npm test` → verdes. **Commit** "Conferencia: filtros, estados e botoes na tela de revisao".

### Task 8: Aviso para o aluno em prova com questão "falta imagem"

**Files:** Modify `src/lib/simulados/servidor.ts` (`QuestaoAluno`, `questoesParaAluno`), `src/components/simulados/ProvaAluno.tsx`, `src/components/simulados/ResultadoAluno.tsx`

**Interfaces:**
- Consumes: `ImagemIndisponivel`.
- Produces: `QuestaoAluno.faltaImagem: boolean`.

- [ ] **Step 1:** `questoesParaAluno` seleciona `falta_imagem` (sem filtrar `status`).
- [ ] **Step 2:** Na prova e no resultado, se `faltaImagem`, mostrar `<ImagemIndisponivel />` logo após o enunciado.
- [ ] **Step 3:** `tsc`, `lint`, `npm test` → verdes. **Commit** "Simulados: aviso de figura faltando na prova".

### Task 9: Prévia, checagens e entrega ao Peter

- [ ] **Step 1:** Prévia temporária `src/app/login-preview-conferencia/` (não commitar) com: editor de questão nova com uma figura pendente e outra com posição "direita"; `PaginaComQuadros` no modo recorte; lista com ○/✓/⚠. Prints 1340 e 390 px (roteiro `status-visual-aluno/references/previa-e-publicacao.md`), conferir hover e o modal de corte.
- [ ] **Step 2:** Apagar a prévia e `.next/dev/types`; `tsc`, `npm test`, `npm run lint`, `npm run build` → todos 0.
- [ ] **Step 3:** Entregar ao Peter o SQL da seção 1 para colar; depois conferir no banco (só leitura) que `questoes.falta_imagem`, `questoes.conferida_em` e `questao_imagens.alinhamento` existem.
- [ ] **Step 4:** Publicar **só com o ok do Peter** (push em `master` = deploy), junto com `feature/revisar-erros` se ainda não publicada; acompanhar o status Vercel do commit.
