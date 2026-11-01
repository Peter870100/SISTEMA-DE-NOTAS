# Pré-visualização da prova em Word Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão "Pré-visualizar" que abre a prova (e o gabarito) em tela cheia, paginada em A4 como a folha do Word, com Imprimir e Baixar ▾ (Word / PDF pela janela de impressão); as mesmas opções de baixar no histórico.

**Architecture:** A decisão de *o que* vai na folha sai de `docx.ts` para um módulo puro (`estrutura.ts`) que devolve uma lista neutra de itens; o .docx (igual ao de hoje, garantido por XML de referência) e a pré-visualização desenham essa lista. O servidor carrega os dados uma vez (`dadosFolhaProva`), a página de prévia recebe figuras reduzidas como `data:` URL, mede os itens no navegador e distribui em colunas/páginas com um paginador puro.

**Tech Stack:** Next.js 16.2 (App Router), React 19, docx 9.11.0, sharp, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-01-previa-prova-word-design.md`

## Global Constraints

- Sem dependência nova, sem SQL novo, sem variável de ambiente nova.
- O .docx (prova e gabarito) sai **igual ao de hoje**: `word/document.xml` idêntico ao de referência gravado antes do refator.
- Medidas e cores da folha vêm das constantes de `src/lib/folha/docx.ts` (A4; margem lateral 1,5 cm; topo/rodapé 1,2 cm; 0,8 cm entre colunas com fio; Arial 9 pt nas questões; título da questão 10,5 pt; cores 0E3562 / E8EEF6 / D9D9D9 / B9CBE4). Exportar o que a prévia precisar em vez de duplicar números.
- Fontes: `Arial, Helvetica, "Liberation Sans", sans-serif` (questões) e `Calibri, Carlito, "Segoe UI", sans-serif` (cabeçalho, faixas, rodapé).
- Logo só na escola Status (`ESCOLA_PADRAO_ID`); acesso à prévia = professor da sessão dono da prova ou papel `dono`, senão `notFound()`; sem sessão → `/login`.
- Figuras da prévia: no máximo ~1100 px de largura (sharp), como `data:` URL; o .docx mantém a resolução original.
- Textos: "Pré-visualizar", "Baixar", "Prova (Word)", "Gabarito (Word)", "Prova (PDF)", "Gabarito (PDF)", "Imprimir", "← Voltar", "Prova", "Gabarito", "Montando a prova…", "Na janela de impressão, escolha **Salvar como PDF** no destino."
- Visual das telas do professor, sem texto cinza (memória `feedback_visual_sem_cinza`); a barra da prévia nunca sai no papel.
- Next 16: ler o guia em `node_modules/next/dist/docs/` antes da página nova (`params`/`searchParams` são Promise).
- Testes só de módulos puros; cada arquivo de teste novo entra na lista do script `test` em `package.json`. `npm test`, `npm run lint`, `npm run build` limpos ao fim de cada task.

## Review Focus

1. Questão com bloco mais alto que uma coluna inteira (figura muito alta) → vai sozinha numa coluna e é reduzida para caber, nunca some nem empurra a página para fora do A4 (teste no Task 3: `paginar` com bloco maior que a coluna).
2. "QUESTÃO NN" ou faixa da matéria no pé da coluna → desce junto com o bloco seguinte (teste no Task 3).
3. Fontes/imagens que carregam depois → a página repagina depois de `document.fonts.ready` e do `load` das imagens; imprimir antes de terminar não é possível (botão desabilitado enquanto "Montando a prova…") (Task 4).
4. Prova de outro professor pela URL da prévia → 404 (Task 4, mesma regra da rota de download).
5. Prova grande (60 questões com figuras) → HTML da prévia abaixo de ~4 MB; medir e registrar (Task 4, verificação).

---

### Task 1: Estrutura comum da folha (refator sem mudar o .docx)

**Files:**
- Create: `src/lib/folha/estrutura.ts`, `src/lib/folha/estrutura.test.ts`, `src/lib/folha/referencia/*.xml` (XML de referência), `src/lib/folha/referencia.test.ts`
- Modify: `src/lib/folha/docx.ts`, `package.json`

**Interfaces:**
- Produces (em `estrutura.ts`, puro, sem `docx` nem `Buffer`):
  - `type FiguraRef = { id: string; alvo: AlvoFigura; alinhamento: "esquerda" | "centro" | "direita" }` e `type AlvoFigura` (movido de `docx.ts`, que reexporta).
  - `type QuestaoBase<F extends FiguraRef>` = o `QuestaoFolha` de hoje com `figuras?: F[]`; `docx.ts` passa a ter `type QuestaoFolha = QuestaoBase<FiguraFolha>` (`FiguraFolha = FiguraRef & { png: Buffer | null; largura: number; altura: number }`).
  - `type ItemFolha<F>` (união discriminada por `tipo`):
    `faixa {materia, de, ate, primeira}` · `titulo {numero, primeiraDoBloco}` · `paragrafo {segmentos: Segmento[], indice}` · `tabela {linhas: string[][]}` · `noConteudo {no: NoConteudo, primeiro: boolean, figuras: F[]}` (parágrafo, linha, caixa ou figura do TipTap) · `figura {figura: F | undefined, alinhamento?: string, legenda?: string, naAlternativa: boolean}` · `credito {credito: string | null, origem: string | null}` · `comando {segmentos, indice, comTexto: boolean}` · `alternativa {letra, texto, conteudo?}` · `resolucao {segmentos, indice}` · `resposta {letra: string | null}` · `aviso {texto}`.
  - `itensProva<F>(questoes: QuestaoBase<F>[], avisoFinal?: string | null): ItemFolha<F>[]` e `itensGabarito<F>(...)`.
- `docx.ts` mantém `folhaAluno(d: DadosFolha)` e `folhaGabarito(d)` com a mesma assinatura; por dentro desenha `itensProva`/`itensGabarito`.

- [ ] **Step 1: Gravar as referências antes de mexer.** Script de uso único (no scratchpad, não commitado) que gera `folhaAluno` e `folhaGabarito` para 6 casos e salva `word/document.xml` em `src/lib/folha/referencia/<caso>-{prova,gabarito}.xml`: (a) `conteudo` TipTap com negrito, caixa, linha e figura inline; (b) markdown com tabela sem figura; (c) markdown com tabela e figura do enunciado; (d) figura indisponível + figura de alternativa; (e) comando repetido + crédito + origem; (f) duas matérias seguidas + `avisoFinal` + bolinhas. Os casos ficam num módulo `src/lib/folha/referencia/casos.ts` (exporta `CASOS: Record<string, DadosFolha>`, PNG 1×1 embutido) para o teste reusar.
- [ ] **Step 2: Teste de referência** `referencia.test.ts`: para cada caso, `documentoXml(await folhaAluno(caso))` === arquivo `<caso>-prova.xml` e o mesmo para o gabarito. Rodar: passa (ainda sem refator). Commit `test: XML de referência da folha`.
- [ ] **Step 3: Testes de `estrutura.ts`** (falham): `itensProva` de uma questão markdown com tabela e sem figura → tipos `["faixa","titulo","paragrafo","tabela","paragrafo","credito"?, "comando", "alternativa"×5]` conforme o caso; com figura do enunciado → sem `tabela` e com `figura` depois dos parágrafos; comando repetido → item `comando` ausente; figura de alternativa `B` → item `figura` com `naAlternativa: true` logo após a alternativa B; duas matérias → duas `faixa` com `de/ate` 1–2 e 3–3; `avisoFinal` → último item `aviso`; `itensGabarito` → `titulo`, `resolucao`…, `resposta {letra:"B"}`.
- [ ] **Step 4: Implementar `estrutura.ts` e reescrever `docx.ts`** para desenhar cada `ItemFolha` (as funções de desenho atuais viram um `switch` por `tipo`). Mover `comFaixas`, `blocosEnunciado`, `blocosComTabelas` (a parte de decisão), escolha do comando, crédito/origem e ordem das alternativas para `estrutura.ts`.
- [ ] **Step 5:** `npm test` (referência idêntica + testes antigos + novos), `npx tsc --noEmit`, `npm run lint`. Gerar uma prova pelo script antigo (`scripts/folha-tarefa.ts`) e ver que abre.
- [ ] **Step 6: Commit** `refactor: estrutura comum da folha (docx igual)`.

### Task 2: Dados da folha no servidor (um carregamento para .docx e prévia)

**Files:**
- Create: `src/lib/folha/previa.ts` (tipos puros), `src/lib/folha/previa-servidor.ts`
- Modify: `src/lib/folha/provas-word-servidor.ts`

**Interfaces:**
- Consumes: Task 1 (`QuestaoBase`, `FiguraRef`), `carregarQuestoesFolha`, `DadosFolha`.
- Produces:
  - `dadosFolhaProva(id: string): Promise<{ prova: { id; professor_id; escola_id; titulo; created_at; excluida: boolean }; dados: DadosFolha; nomeBase: string } | null>` em `provas-word-servidor.ts`; `montarArquivoProva` passa a usá-la (comportamento igual).
  - Em `previa.ts`: `type FiguraTela = FiguraRef & { src: string | null; largura: number; altura: number }`; `type DadosPrevia = { titulo: string; escola: string; logo: string | null; bolinhas: Partial<Record<"A"|"B"|"C"|"D"|"E", string>>; questoes: QuestaoBase<FiguraTela>[]; avisoFinal: string | null }` (tudo serializável; `src` = `data:image/png;base64,…`).
  - Em `previa-servidor.ts`: `dadosPrevia(dados: DadosFolha): Promise<DadosPrevia>` — reduz cada figura com sharp para largura ≤ 1100 px (sem ampliar), mantém `largura`/`altura` originais em px para a proporção, PNG; `png: null` → `src: null`.

- [ ] **Step 1: Implementar** (sem teste unitário: módulos de servidor travam o `tsx --test`).
- [ ] **Step 2:** `npm test` (referência do Task 1 continua idêntica), `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 3: Commit** `feat: dados da folha para a prévia`.

### Task 3: Paginador puro

**Files:**
- Create: `src/lib/folha/paginar.ts`, `src/lib/folha/paginar.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `type BlocoMedido = { altura: number; grudaNoProximo: boolean }`; `type PaginaPrevia = { colunas: [number[], number[]]; reduzir: Record<number, number> }` (índices dos blocos; `reduzir[i]` = altura máxima para um bloco maior que a coluna); `paginar(blocos: BlocoMedido[], alturaPrimeira: number, alturaDemais: number): PaginaPrevia[]`.

Regras: enche a coluna 0 e depois a 1 de cada página; a 1ª página usa `alturaPrimeira` nas duas colunas; bloco que não cabe vai para a próxima coluna; um bloco com `grudaNoProximo` (faixa, título da questão) só fica numa coluna se o próximo também couber nela (senão desce junto; em cadeia: faixa + título + próximo); bloco maior que uma coluna vazia fica sozinho numa coluna e entra em `reduzir` com a altura da coluna; lista vazia → uma página vazia.

- [ ] **Step 1: Testes** (falham): 3 blocos de 40 em colunas de 100 → `[[0,1],[2]]` na pág. 1; 5 blocos de 60 → pág. 1 `[[0],[1]]`, pág. 2 `[[2],[3]]`, pág. 3 `[[4],[]]`; `alturaPrimeira` 50 e `alturaDemais` 100 com blocos 40,40,40 → pág. 1 `[[0],[1]]`, pág. 2 `[[2],[]]`; título gruda: alturas 50,30(gruda),40 em coluna 100 → `[[0],[1,2]]`; cadeia faixa+título: 70,10(gruda),10(gruda),40 → `[[0],[1,2,3]]`; bloco de 250 em coluna 100 → sozinho com `reduzir[0] = 100`; `[]` → `[{ colunas: [[],[]], reduzir: {} }]`.
- [ ] **Step 2: Implementar.** Step 3: passa; adicionar ao `npm test`. Step 4: Commit `feat: paginador da prévia`.

### Task 4: Página de pré-visualização

**Files:**
- Create: `src/app/banco/provas-word/[id]/previa/page.tsx` (servidor), `src/app/banco/provas-word/[id]/previa/Previa.tsx` (cliente), `src/app/banco/provas-word/[id]/previa/Folha.tsx` (desenho de `ItemFolha<FiguraTela>` em React), `src/app/banco/provas-word/[id]/previa/Previa.module.css`
- Modify: `next.config.*` (`outputFileTracingIncludes` de `/banco/provas-word/[id]/previa` com os mesmos arquivos de `ARQUIVOS_FOLHA`), `src/components/...` só se reaproveitar o menu do Task 5.

**Interfaces:**
- Consumes: Task 1 (`itensProva`, `itensGabarito`, `ItemFolha`), Task 2 (`dadosFolhaProva`, `dadosPrevia`, `DadosPrevia`), Task 3 (`paginar`), `getProfessorAtual`, `ConteudoQuestao`-like desenho de `NoConteudo` (pode reaproveitar trechos de `src/components/questoes/ConteudoQuestao.tsx`).
- Produces: rota `/banco/provas-word/<id>/previa?qual=prova|gabarito&imprimir=1`; componente `MenuBaixar({ provaId, qual?: "prova" | "gabarito", noPdf: (qual) => void })` exportado de `Previa.tsx` ou de um arquivo próprio, usado no Task 5.

- [ ] **Step 1: Página servidor:** sessão (sem → `redirect("/login")`); `dadosFolhaProva(id)`; nula, excluída, ou `professor.id !== prova.professor_id && professor.role !== "dono"` → `notFound()`; `dadosPrevia` → `<Previa dados qual imprimir provaId />`. `maxDuration = 60`.
- [ ] **Step 2: Cliente:** monta `itensProva`/`itensGabarito`; renderiza cada item numa área de medição invisível com a largura exata de uma coluna; mede alturas depois de `document.fonts.ready` e das imagens carregadas; mede a altura útil da 1ª página (com cabeçalho grande) e das demais (com topo curto); `paginar`; desenha as páginas A4 (cabeçalho grande na 1ª, topo curto nas outras, rodapé "<título curto> · caderno de questões | gabarito comentado" + nº da página, fio entre colunas); aplica `reduzir` como `max-height` + `object-fit: contain` na figura. Repagina ao trocar Prova/Gabarito.
- [ ] **Step 3: Barra e impressão:** barra fixa (← Voltar, Prova | Gabarito, Imprimir, Baixar ▾) desabilitada com "Montando a prova…" até paginar; `@media print`: some a barra, `@page { size: A4; margin: 0 }`, cada página `break-after: page`, sem sombra/fundo; PDF = mostra o aviso "Na janela de impressão, escolha **Salvar como PDF** no destino." e chama `window.print()`; `?imprimir=1` imprime sozinho depois de paginar. Celular: páginas com `transform: scale` para caber na largura (só na tela).
- [ ] **Step 4:** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. Rodar `npm run dev` com uma sessão local da conta dono (cookie gerado por script no scratchpad usando a mesma assinatura de `src/lib/sessao.ts`; nunca commitar o script nem imprimir o segredo) e comparar a prova de Física UFGD 2023 (`28ea2f15-5ad3-4ecc-a3fc-9f7e93eeb4c7`) com o PDF do Word; imprimir para PDF pelo Chrome e conferir 2 páginas sem barra. Sem login → 307 para `/login`; id de outra prova de outro professor → 404. Medir o tamanho do HTML de uma prova de 60 questões com figuras (gerar só localmente com `dadosPrevia` sobre 60 ids elegíveis via script no scratchpad, sem gravar prova) e registrar; se > 4 MB, reduzir mais as figuras.
- [ ] **Step 5: Commit** `feat: pré-visualização da prova em Word`.

### Task 5: Botões no histórico e no resultado, documentação e entrega

**Files:**
- Modify: `src/app/banco/provas-word/Historico.tsx`, `src/app/banco/provas-word/NovaProva.tsx`, `docs/folha-tarefa.md`, `CLAUDE.md` (item 11: uma frase sobre a prévia)

- [ ] **Step 1:** Trocar "Baixar prova"/"Baixar gabarito" por **Pré-visualizar** (link para a prévia) e **Baixar ▾** (`MenuBaixar` do Task 4) com "Prova (Word)", "Gabarito (Word)" (rotas atuais) e "Prova (PDF)", "Gabarito (PDF)" (abre `/banco/provas-word/<id>/previa?qual=…&imprimir=1` em nova aba). Menu fecha com Esc e clique fora; acessível por teclado.
- [ ] **Step 2:** `npm run lint`, `npm run build`, `npm test`.
- [ ] **Step 3:** Documentação curta em `docs/folha-tarefa.md` ("Pré-visualizar, imprimir e PDF") e `CLAUDE.md`.
- [ ] **Step 4: Commit** `feat: pré-visualizar e baixar Word/PDF no histórico`; push no `master` (rebase em `origin/master` antes); esperar o deploy e conferir no www que `/banco/provas-word/<id>/previa` sem login dá 307 para `/login`; o teste logado fica com o Peter (avisar).
