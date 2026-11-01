# Prova em Word Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O professor pede pela Hermes (ou pelo site) uma prova com questões oficiais do banco e recebe dois links: a prova em Word com as figuras e o gabarito; cada prova fica num histórico reaproveitável.

**Architecture:** Regras puras em `src/lib/folha/provas-word.ts` (título, inéditas, sorteio, código do link). `src/lib/folha/docx.ts` aprende a desenhar `conteudo` (TipTap) e figuras. `src/lib/folha/figuras-servidor.ts` carrega as questões e recorta as figuras com sharp. `src/lib/folha/provas-word-servidor.ts` é o núcleo (prévia, gerar, listar, excluir, montar arquivos). Uma rota de download monta o .docx na hora. Ferramentas MCP e uma página no site chamam o núcleo.

**Tech Stack:** Next.js 16.2 (App Router), Supabase, docx 9.11.0, sharp, zod, MCP SDK, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-31-prova-em-word-design.md`

## Global Constraints

- Visual aprovado da folha não muda: Arial 9 (`CORPO_QUESTAO = 18`), título da questão 10,5 (`TITULO_QUESTAO = 21`), cores 0E3562/E8EEF6/D9D9D9, bolinhas de `public/folha/alternativa-A..E.png`, duas colunas, gabarito em arquivo separado.
- Logo: `public/logo-folha.png` só para a escola Status (`ESCOLA_PADRAO_ID` de `src/lib/escola-padrao.ts`); outras escolas: nome no cabeçalho, sem logo.
- Tipo `fixacao` | `simulado` só muda o título: "Atividade de Fixação – <Matéria>" / "Simulado – <Matéria>", com " · <Assunto>" quando houver assunto.
- Elegíveis: `status = 'publicada'`, `anulada = false`, `resposta is not null`, `falta_imagem = false`, `precisa_revisao = false`, banco geral + escola do professor.
- "Usadas" = questões em `prova_word_questoes` de provas do mesmo `professor_id` (inclusive excluídas). Simulados online não contam.
- Quantidade por prova: 1 a 60.
- Link sem login: `?c=<hmac>` com `AUTH_SECRET` (via `segredo()` de `src/lib/sessao.ts`); sem validade; prova excluída → 404.
- Sem IA paga. Sem variável de ambiente nova.
- `docx` vai de devDependencies para dependencies; declarar `sharp` em dependencies.
- SQL manual em `db/schema.sql`; antes de publicar, conferir no banco (consulta só de leitura) que foi colado.
- Testes só de módulos puros (importar módulos de servidor no `tsx --test` trava). Adicionar cada arquivo de teste novo à lista do script `test` em `package.json`.
- Antes de rota/página nova, ler o guia em `node_modules/next/dist/docs/` (Next 16 tem mudanças: `params` é Promise etc.).
- Mensagens e textos em pt-BR.

## Review Focus

1. Questão com figura de recorte numa página que não existe mais no storage → a questão sai com o aviso "[Figura indisponível]" no lugar, não quebra o arquivo inteiro (teste no Task 2 com figura ausente).
2. Pedido maior que as elegíveis (ex.: 10 pedidas, 6 existem no filtro) → prévia diz "só há 6" e gerar não inventa (teste no Task 1, `escolherQuestoes`).
3. Professor A tenta baixar a prova do professor B pelo site com sessão válida → 404 (Task 5: dono da prova = professor da sessão, ou papel dono).
4. Código `c` adulterado ou de outra prova → 404 (teste no Task 1, `verificarCodigoLink`).
5. Questão da prova mandada para a lixeira depois → prova baixa sem ela e o gabarito/prova registra "1 questão desta prova não está mais no banco" (Task 4, `montarArquivosProva` devolve `faltando`; Task 2 desenha o aviso).

---

### Task 1: Regras puras da prova em Word

**Files:**
- Create: `src/lib/folha/provas-word.ts`
- Test: `src/lib/folha/provas-word.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `type TipoProva = "fixacao" | "simulado"`
  - `tituloProva(tipo: TipoProva, materia: string, assunto?: string | null): string`
  - `type Cenario = { elegiveis: number; usadas: number; ineditas: number; pedidas: number; cabeEmIneditas: boolean }`
  - `cenarioIneditas(elegiveis: string[], usadas: Set<string>, pedidas: number): Cenario`
  - `escolherQuestoes(elegiveis: string[], usadas: Set<string>, pedidas: number, permitirRepetidas: boolean, aleatorio?: () => number): { ids: string[]; repetidas: number }`
  - `codigoLink(provaId: string, chave: string): string` e `verificarCodigoLink(provaId: string, codigo: string | null | undefined, chave: string): boolean`
  - `const LIMITE_QUESTOES_PROVA = 60`

- [ ] **Step 1: Escrever os testes**

```ts
test("tituloProva", () => {
  assert.equal(tituloProva("fixacao", "Biologia"), "Atividade de Fixação – Biologia");
  assert.equal(tituloProva("simulado", "Biologia", "Genética"), "Simulado – Biologia · Genética");
});
test("cenarioIneditas", () => {
  const c = cenarioIneditas(["a", "b", "c", "d"], new Set(["b", "x"]), 3);
  assert.deepEqual(c, { elegiveis: 4, usadas: 1, ineditas: 3, pedidas: 3, cabeEmIneditas: true });
  assert.equal(cenarioIneditas(["a", "b"], new Set(["a"]), 2).cabeEmIneditas, false);
});
test("escolherQuestoes: só inéditas por padrão, sem completar", () => {
  const r = escolherQuestoes(["a", "b", "c"], new Set(["a"]), 3, false, () => 0);
  assert.equal(r.ids.length, 2); assert.equal(r.repetidas, 0); assert.ok(!r.ids.includes("a"));
});
test("escolherQuestoes: com repetidas completa depois das inéditas", () => {
  const r = escolherQuestoes(["a", "b", "c"], new Set(["a"]), 3, true, () => 0);
  assert.equal(r.ids.length, 3); assert.equal(r.repetidas, 1); assert.equal(r.ids.at(-1), "a");
});
test("escolherQuestoes: nunca passa do que existe nem repete id", () => {
  const r = escolherQuestoes(["a", "b"], new Set(), 10, true);
  assert.equal(new Set(r.ids).size, 2);
});
test("codigoLink: confere e recusa adulterado/outra prova", () => {
  const c = codigoLink("p1", "k");
  assert.equal(verificarCodigoLink("p1", c, "k"), true);
  assert.equal(verificarCodigoLink("p2", c, "k"), false);
  assert.equal(verificarCodigoLink("p1", c.slice(0, -1) + "0", "k"), false);
  assert.equal(verificarCodigoLink("p1", null, "k"), false);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx tsx --test src/lib/folha/provas-word.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** em `src/lib/folha/provas-word.ts`. Sorteio: embaralhar inéditas e usadas separadamente (Fisher–Yates com `aleatorio`, padrão `Math.random`), pegar inéditas primeiro. Código: HMAC-SHA256 de `prova-word:<id>` em hex, primeiros 32 caracteres; comparação com `timingSafeEqual` (padrão de `src/lib/sessao.ts`).
- [ ] **Step 4: Rodar e ver passar**; adicionar o arquivo à lista do `npm test`; `npm test` passa.
- [ ] **Step 5: Commit** — `feat: regras puras da prova em Word`.

---

### Task 2: Folha desenha conteúdo formatado e figuras

**Files:**
- Modify: `src/lib/folha/docx.ts`
- Test: `src/lib/folha/folha.test.ts`

**Interfaces:**
- Produces (acréscimos em `QuestaoFolha`, todos opcionais, para o script atual continuar igual):
  - `conteudo?: DocConteudo | null` (do enunciado; tipo de `src/lib/questoes/conteudo.ts`)
  - `alternativas: { letra: string; texto: string; conteudo?: DocConteudo | null }[]`
  - `figuras?: FiguraFolha[]` com `type FiguraFolha = { id: string; alvo: "enunciado" | "A" | "B" | "C" | "D" | "E"; png: Buffer | null; largura: number; altura: number; alinhamento: "esquerda" | "centro" | "direita" }` (`png: null` = indisponível)
  - `origem?: string | null` (ex.: "UFMS 2024")
- `DadosFolha` ganha `avisoFinal?: string | null` (texto discreto no fim da prova e do gabarito).

- [ ] **Step 1: Testes novos** (mesmo estilo de inspeção do XML dos testes atuais):
  - "conteúdo: negrito e figura do enunciado viram run negrito e 1 imagem" — `conteudo` com parágrafo `{text:"forte", marks:[bold]}` e nó `figura` `imagemId:"f1"`, `figuras:[{id:"f1", alvo:"enunciado", png:<PNG 1×1 válido>, largura:800, altura:400, alinhamento:"centro"}]`, sem bolinhas → XML tem `<w:b/>` perto de "forte" e exatamente 1 `<pic:pic`.
  - "figura larga é limitada à largura da coluna" — figura 4000×1000 px → `cx` do `<wp:extent>` ≤ largura da coluna em EMU (`LARGURA_COLUNA` twips × 635).
  - "figura indisponível vira aviso" — `png: null` → XML contém "[Figura indisponível]" e 0 `<pic:pic`.
  - "figura do enunciado sem nó no conteúdo vai depois do texto" — questão sem `conteudo`, com 1 figura `alvo: "enunciado"` → 1 `<pic:pic`.
  - "figura de alternativa aparece na alternativa" — figura `alvo: "B"` → 1 `<pic:pic` (sem bolinhas).
  - "origem e aviso final" — `origem: "UFMS 2024"` aparece no XML; `avisoFinal` aparece no XML do aluno e do gabarito.
  - Os testes antigos continuam passando (script `scripts/folha-tarefa.ts` intacto).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** em `docx.ts`:
  - `blocosDoConteudo(doc, figuras): Bloco[]` — parágrafo (marcas bold/italic/underline/subscript/superscript → `TextRun` com as mesmas opções de `runs`; `textAlign` → alinhamento; `recuo` n → `indent.left = n * RECUO`), `hardBreak` → `break: 1`, `horizontalRule` → parágrafo com borda inferior fina, `caixa` → tabela 1×1 com borda fina contendo os parágrafos, `figura` → parágrafo com `ImageRun` (alinhamento pelo nó ou da figura) + legenda em `PEQUENO` se houver. Sem `conteudo`, segue o caminho atual (markdown) e põe as figuras de `alvo: "enunciado"` depois do texto, antes do comando.
  - Figura: largura = `min(largura_px, coluna_px)` com `coluna_px = LARGURA_COLUNA / 15` (twips→px a 96 dpi), altura proporcional; `png: null` → parágrafo itálico "[Figura indisponível]".
  - Alternativa com `conteudo` usa os runs do 1º parágrafo; figura com `alvo` = letra vai em parágrafo próprio logo abaixo, com o recuo da alternativa.
  - `origem`: texto `PEQUENO` cinza à direita, junto do crédito (ou sozinho se não houver crédito).
  - `avisoFinal`: parágrafo `PEQUENO` itálico no fim do corpo, nas duas folhas.
- [ ] **Step 4: Rodar e ver passar** (`npm test`); gerar uma folha pelo script antigo e ver que abre (`npx tsx scripts/folha-tarefa.ts --titulo "Teste" --ids <id de questão escrita>`).
- [ ] **Step 5: Commit** — `feat: folha desenha conteúdo formatado e figuras`.

---

### Task 3: SQL e carregamento das questões com figuras

**Files:**
- Modify: `db/schema.sql` (seção nova no fim, datada 2026-10-31)
- Create: `src/lib/folha/figuras-servidor.ts`
- Create: `src/lib/folha/recorte.ts` + teste `src/lib/folha/recorte.test.ts`
- Modify: `package.json` (dependencies: `docx` 9.11.0 e `sharp` na versão já instalada em `node_modules/sharp/package.json`; script `test`)

**Interfaces:**
- Produces:
  - `pixelsDoRecorte(q: Quadro, largura: number, altura: number): { left: number; top: number; width: number; height: number }` (puro; inteiros, dentro da página, lados ≥ 1)
  - `carregarQuestoesFolha(ids: string[]): Promise<{ questoes: QuestaoFolha[]; faltando: string[] }>` — mantém a ordem de `ids`; `faltando` = ids que não existem mais em `questoes`.

- [ ] **Step 1: SQL** (colar no fim de `db/schema.sql`):

```sql
-- ===== Provas em Word (2026-10-31) =====
create table if not exists provas_word (
    id uuid primary key default gen_random_uuid(),
    escola_id uuid not null references escolas(id),
    professor_id uuid not null references professores(id) on delete cascade,
    titulo text not null,
    tipo varchar(8) not null check (tipo in ('fixacao', 'simulado')),
    filtros jsonb not null default '{}',
    origem varchar(6) not null check (origem in ('hermes', 'site')),
    created_at timestamptz not null default now(),
    excluida_em timestamptz
);
create index if not exists idx_provas_word_professor on provas_word (professor_id, created_at desc);
create table if not exists prova_word_questoes (
    prova_id uuid not null references provas_word(id) on delete cascade,
    questao_id uuid not null,            -- sem FK: a lixeira apaga a questão e a prova precisa lembrar
    ordem integer not null,
    primary key (prova_id, questao_id)
);
create index if not exists idx_prova_word_questoes_questao on prova_word_questoes (questao_id);
alter table provas_word enable row level security;
alter table prova_word_questoes enable row level security;
drop policy if exists "acesso_total_provas_word" on provas_word;
create policy "acesso_total_provas_word" on provas_word for all using (true) with check (true);
drop policy if exists "acesso_total_prova_word_questoes" on prova_word_questoes;
create policy "acesso_total_prova_word_questoes" on prova_word_questoes for all using (true) with check (true);
```

- [ ] **Step 2: Teste de `pixelsDoRecorte`** — `({x:0.1,y:0.2,w:0.5,h:0.25}, 1000, 2000)` → `{left:100, top:400, width:500, height:500}`; quadro que passa da borda (`x:0.9,w:0.2`) é limitado (`left + width ≤ largura`); rodar e ver falhar; implementar (arredondar, usar `limitarQuadro` de `src/lib/questoes/quadro.ts`); ver passar.
- [ ] **Step 3: `carregarQuestoesFolha`** em `figuras-servidor.ts` (cliente `supabase` de `@/lib/supabase/client` como `src/lib/questoes/consultas.ts`): lê `questoes` (id, enunciado, comando, alternativas, resposta, resolucao, materia, conteudo, banca, ano), `questao_imagens` ordenadas por `ordem`, `importacao_paginas` das figuras de recorte; baixa cada arquivo do bucket `questoes` (`BUCKET` de `src/lib/questoes/storage.ts`, `supabase.storage.from(BUCKET).download`), uma vez por página; recorte com `sharp(buf).extract(pixelsDoRecorte(...)).png()`; `arquivo` → `sharp(buf).png()`; largura/altura do PNG resultante; falha de download/recorte → `png: null`. `origem` = `"<BANCA> <ano>"`.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit` limpos.
- [ ] **Step 5: Commit** — `feat: tabelas das provas em Word e carregamento das figuras`. **Avisar o Peter para colar o SQL** (mandar a seção) e conferir com consulta só de leitura antes do Task 5 ir ao ar.

---

### Task 4: Núcleo das provas em Word

**Files:**
- Create: `src/lib/folha/provas-word-servidor.ts`

**Interfaces:**
- Consumes: Task 1 (todas), Task 3 (`carregarQuestoesFolha`), `folhaAluno`/`folhaGabarito`, `filtroVisivel` e `FiltrosSorteio` de `src/lib/simulados/servidor.ts`, `padraoExato` de `src/lib/questoes/busca.ts`.
- Produces:
  - `type PedidoProva = { escolaId: string; professorId: string; filtros: FiltrosSorteio; quantidade: number; materiaRotulo: string; assuntoNome?: string | null }`
  - `previaProva(p: PedidoProva): Promise<Cenario>`
  - `gerarProva(p: PedidoProva & { tipo: TipoProva; permitirRepetidas: boolean; origem: "hermes" | "site" }): Promise<{ id: string; titulo: string; total: number; repetidas: number }>` — erro "Nenhuma questão com esses filtros." se 0.
  - `listarProvas(professorId: string, busca?: string): Promise<ProvaResumo[]>` com `type ProvaResumo = { id: string; titulo: string; tipo: TipoProva; total: number; created_at: string; origem: "hermes" | "site"; escola_id: string }` (não excluídas, mais recentes primeiro, busca em `titulo` com ilike).
  - `lerProva(id: string): Promise<{ id: string; professor_id: string; escola_id: string; titulo: string; excluida: boolean } | null>`
  - `excluirProva(professorId: string, id: string): Promise<void>` e `limparProvas(professorId: string): Promise<number>` (marcam `excluida_em = now()`; só as do professor).
  - `montarArquivoProva(id: string, qual: "prova" | "gabarito"): Promise<{ nome: string; buffer: Buffer }>` — lê `prova_word_questoes` por `ordem`, `carregarQuestoesFolha`, `avisoFinal` quando `faltando.length` ("1 questão desta prova não está mais no banco." / "N questões…"), logo: `public/logo-folha.png` se `escola_id` for a da Status, senão `null`; bolinhas de `public/folha/`; nome do arquivo `<slug do título>-<dd-mm-aaaa>[-gabarito].docx`.
  - `linksProva(id: string, base: string): { prova: string; gabarito: string }` → `${base}/api/provas-word/${id}/prova?c=…` e `/gabarito?c=…`; `base` = `https://www.statusavalia.com.br` (constante; ver `reference_dominio_producao`).

- [ ] **Step 1: Implementar.** Elegíveis: mesma consulta de `candidatosComMateria` + os filtros de elegibilidade das Global Constraints, paginando de 1000 em 1000. Usadas: `prova_word_questoes` juntando `provas_word` do `professor_id` (duas consultas: ids das provas do professor, depois questões por blocos de ids). Gravar `provas_word` e depois `prova_word_questoes` (se a segunda falhar, apagar a prova criada). Como ler arquivos de `public/` na Vercel: `readFile(join(process.cwd(), "public", ...))` e garantir que entram no bundle da função (`outputFileTracingIncludes` em `next.config.*` para as rotas da prova e do MCP, conferir no guia do Next 16).
- [ ] **Step 2:** `npx tsc --noEmit` e `npm run lint` limpos; `npm test` passa.
- [ ] **Step 3: Commit** — `feat: núcleo das provas em Word`.

---

### Task 5: Rota de download

**Files:**
- Create: `src/app/api/provas-word/[id]/[arquivo]/route.ts`

**Interfaces:**
- Consumes: Task 4 (`lerProva`, `montarArquivoProva`), Task 1 (`verificarCodigoLink`), `segredo()`, `getProfessorAtual()`.

- [ ] **Step 1: Implementar `GET`**: `runtime = "nodejs"`, `maxDuration = 120`. `arquivo` ∈ {`prova`, `gabarito`} senão 404. Prova inexistente ou `excluida` → 404. Autorizado se `verificarCodigoLink(id, c, segredo())` **ou** professor da sessão com `id === prova.professor_id` ou papel `dono`. Senão 404 (não 401: não confirmar que existe). Resposta: `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `Content-Disposition: attachment; filename="<nome>"` (com `filename*=UTF-8''` codificado), `Cache-Control: private, no-store`.
- [ ] **Step 2:** `npm run build` passa. Teste manual local (`npm run dev`): criar uma prova pelo núcleo (script curto no scratchpad ou pelo Task 6) e baixar pelo link com e sem `c`; abrir no Word e conferir figuras.
- [ ] **Step 3: Commit** — `feat: download da prova em Word`.

---

### Task 6: Ferramentas da Hermes

**Files:**
- Create: `src/lib/mcp/acoes/provas-word.ts`
- Modify: `src/lib/mcp/acoes.ts` (registrar para os dois perfis), `src/app/api/mcp/route.ts` e `src/app/api/mcp/dono/route.ts` (uma frase nas instruções: "Prova em Word: sempre previa_prova_word antes de gerar_prova_word.")

**Interfaces:**
- Consumes: Task 4; `materiaDoTexto` (`src/lib/mcp/leitura/banco.ts`); a resolução de área/assunto que hoje está privada em `src/lib/mcp/acoes/simulados.ts` (`areaDoTexto`, `assuntoDoTexto`, `camposFiltro` sem `permitir_repetidas`, `filtrosDe`) — **exportar** de lá e reaproveitar; `contaDoDono`, `escolaParaCriar`, `registrado`, `falha`, `campoId`, `campoTelefone`, `campoEscola`.
- Produces: ferramentas `previa_prova_word`, `gerar_prova_word`, `listar_provas_word`, `links_prova_word`.

Quem é o professor: perfil professor → `escopo.professorId` e `escopo.escolaId`; dono → `contaDoDono(ctx).id` e escola de `escolaParaCriar(ctx, args.escola)` (para listar/links, sem escola). `materiaRotulo`: rótulo de `MATERIAS`; sem matéria no pedido, usar a área ou "Questões".

Descrições (texto exato, a Hermes segue isto):
- `previa_prova_word`: "Mostra quantas questões do banco servem para uma prova em Word (com figuras, só publicadas) e quantas o professor ainda não usou. SEMPRE chame antes de gerar_prova_word e, numa única mensagem, conte ao professor o cenário (total, já usadas, inéditas) e pergunte: se faltarem inéditas, se completa com já usadas ou faz uma prova menor; e, se ele não disse, se é atividade de fixação ou simulado."
- `gerar_prova_word`: "Gera a prova em Word e o gabarito (arquivos separados) e devolve os dois links para o professor baixar. Só chame depois de previa_prova_word e da resposta do professor. Mande os links como vieram."
- `listar_provas_word`: "Lista as provas em Word que o professor já gerou (histórico). Use quando ele pedir para reenviar uma prova antiga: se houver mais de uma candidata, mostre título e data e pergunte qual."
- `links_prova_word`: "Devolve de novo os links da prova e do gabarito de uma prova do histórico, sem gerar outra."

Entradas: `previa` e `gerar` = filtros (banca, ano_de, ano_ate, area, materia, assunto) + `quantidade` (1..60); `gerar` acrescenta `tipo` (enum fixacao/simulado) e `permitir_repetidas` (boolean, padrão false). `listar` = `busca?`. `links` = `prova_id`. Todos com `campoTelefone`; dono também `campoEscola` em previa/gerar.

Saídas (texto): prévia → "Biologia (UFMS): 74 questões no banco; você já usou 18; 56 inéditas. Pedidas: 10 — cabem só em inéditas." / "… só há 6 inéditas para 10 pedidas." ; gerar → "Prova \"Simulado – Biologia\" com 10 questões (2 já usadas antes).\nProva: <link>\nGabarito: <link>" ; listar → linhas "dd/mm/aaaa · <título> · N questões · id <id>" (até 20, mais recentes); links → mesmo bloco de links. `gerar` usa `registrado(...)` para entrar em `hermes_registro`; outra pessoa (professor) pedindo `links_prova_word` de prova que não é dele → "Prova não encontrada.".

- [ ] **Step 1: Implementar.**
- [ ] **Step 2:** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. Rodar local e chamar `tools/list` nos dois MCPs (curl com o token lido só da linha da chave em `.env.local`, sem imprimir) — as 4 ferramentas aparecem nos dois.
- [ ] **Step 3: Commit** — `feat: ferramentas da Hermes para prova em Word`.

---

### Task 7: Página "Provas em Word" no site

**Files:**
- Create: `src/app/banco/provas-word/page.tsx` (lista + formulário), `src/app/banco/provas-word/acoes.ts` (server actions)
- Modify: `src/app/banco/page.tsx` (atalho "Provas em Word" junto dos outros atalhos do banco)

**Interfaces:**
- Consumes: Task 4 (`previaProva`, `gerarProva`, `listarProvas`, `excluirProva`, `limparProvas`), Task 1 (`tituloProva`, `LIMITE_QUESTOES_PROVA`).

- [ ] **Step 1: Implementar.** Página com `getProfessorAtual()` (sem professor → `/login`), padrão visual das telas do professor (`PageLayout`, `estilos`, ver `src/app/banco/page.tsx`). Lista: data, título, nº de questões, origem ("Telegram"/"Site"), links Baixar prova/Baixar gabarito (rota do Task 5 sem `c`), Excluir (confirmação), "Limpar tudo" (confirmação: "As provas somem da lista, mas as questões continuam contando como já usadas."). Formulário "Nova prova": banca, matéria (de `MATERIAS`), assunto (opcional, por texto), ano de/até, quantidade (1..60), tipo; botão "Ver questões disponíveis" mostra a prévia (mesmas frases da Hermes) e só então "Gerar prova" (com escolha "completar com já usadas" quando faltar). Escola = a do professor; dono usa a escola atual dele.
- [ ] **Step 2:** `npm run lint`, `npm run build`; rodar local e percorrer: gerar, baixar os dois, excluir, limpar tudo; gerar de novo com os mesmos filtros e ver que a prévia continua contando as usadas.
- [ ] **Step 3: Commit** — `feat: página Provas em Word no banco`.

---

### Task 8: Documentação e entrega

**Files:**
- Modify: `docs/folha-tarefa.md` (seção "Prova em Word pela Hermes e pelo site"), `CLAUDE.md` (item 11 em "Pronto e no ar"; remover a linha velha "Folha de tarefa: Peter avaliar o visual"; tirar "Etapa 2 pendente" do item 10)

- [ ] **Step 1:** Escrever a documentação curta (como pedir pela Hermes, o que é "inédita", onde fica o histórico).
- [ ] **Step 2:** Conferir no banco (só leitura) que `provas_word` e `prova_word_questoes` existem. Push no `master`, esperar o deploy e testar no `www`: `tools/list` no MCP do dono, uma `previa_prova_word` de Biologia/UFMS, um `gerar_prova_word` de 3 questões, baixar os dois links e abrir no Word conferindo as figuras; excluir essa prova de teste pela página.
- [ ] **Step 3: Commit** — `docs: prova em Word`.
