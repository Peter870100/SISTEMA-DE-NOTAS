# Classificação fina das questões Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Novos níveis **Tópico** (dentro do assunto) e **Habilidades** (por área), mais **pré-requisitos** entre tópicos e
  **materiais de revisão**.
- Classificação no editor, uma questão por vez (`/banco/classificar`), em lote na lista do banco e pelo MCP do dono.
- Carga inicial de Português e Matemática.

**Architecture:**
- **Banco:** SQL manual em `db/schema.sql` com tabelas novas e um gatilho que zera `topico_id` quando o tópico não é
  do assunto da questão.
- **Regras:** funções puras em `src/lib/questoes/classificacao.ts`.
- **Gravação:** `src/lib/questoes/classificacao-servidor.ts`, usado pelas ações do site e pelo MCP.

**Tech Stack:** Next.js 16.2 (ler `node_modules/next/dist/docs/` antes de usar APIs do Next), React 19, Supabase
(`@/lib/supabase/client`), zod, MCP SDK, lucide-react, CSS modules, testes `tsx --test` (arquivos listados um a um
no script `test` do `package.json`; todo teste novo entra nessa lista).

**Spec:** `docs/superpowers/specs/2026-11-02-classificacao-fina-design.md`. Leia a spec inteira, com atenção à seção
"Decisões tomadas por mim".

## Global Constraints

- Textos em pt-BR. Na tela, o nível novo se chama **"Tópico"**; o assunto continua "Assunto".
- **Habilidades por área:** `linguagens`, `humanas`, `natureza` ou `matematica`. Código opcional, único por área.
- **Unicidade:** tópicos únicos por `(assunto_id, lower(nome))`; habilidades por `(area, lower(descricao))`.
- **Situação:** `aprovado` | `proposto`.
  - Professor ou admin pode **propor tópico**.
  - Só o dono cria habilidade e material e aprova, renomeia ou junta.
- **Permissão de classificar:** `podeEditarQuestao` (`src/lib/questoes/regras.ts`).
  - Banco geral: só o dono.
  - Questão da escola: admin da escola ou autor.
- **Classificar não muda o `status` da questão.**
- **Limites:** lote e MCP com até 50 itens por chamada; seleção na tela com até 100 por página.
- **Lote:**
  - Tópico só quando todas as questões são do mesmo assunto.
  - Habilidades só quando todas são da mesma área.
  - Modos `"adicionar"` | `"trocar"`.
- **Banco de dados:** só acrescentar; nada apagado nem renomeado. O Peter cola o SQL. As questões atuais continuam
  funcionando sem tópico.
- **Comentários:** densidade e estilo dos arquivos vizinhos (JSDoc curto em pt-BR).

## Review Focus

1. **Juntar assuntos com tópicos:** os tópicos do assunto que some vão para o destino; um tópico de mesmo nome é
   juntado, e nada se perde por cascata (Task 3 testa o plano de junção).
2. **Questão que muda de assunto:** o tópico é zerado pelo gatilho. A tela e o MCP não devem mostrar um erro por
   isso (Task 1 SQL + Task 3).
3. **Lote misturando assuntos ou áreas:** o campo fica desabilitado, com o motivo, e o servidor recusa mesmo se a
   tela deixar passar (Task 2 testa `validarLote`).
4. **Professor tentando classificar questão do banco geral pelo lote:** a resposta é "sem permissão" para esses
   itens, e os outros seguem (Task 3).
5. **Ids vindos do MCP inexistentes, ou tópico de outro assunto:** o item é recusado com o motivo, e os outros
   gravam (Task 8 testa).

---

### Task 1: SQL do banco e tipos

**Files:** Modify `db/schema.sql` (bloco novo no fim, "Classificação fina (2026-11-02)"), `src/lib/types.ts`.

- **Tabelas:** as da seção "Banco" da spec:
  - `topicos`, `habilidades` (com `area` e o mesmo check de `questoes.area`);
  - `questoes.topico_id` + índice;
  - `questao_habilidades`, `topico_prerequisitos`, `materiais_revisao` (com os checks);
  - RLS `acesso_total_*` como nas vizinhas.
- **Gatilho** `trg_questao_topico_do_assunto`, `before insert or update of assunto_id, topico_id on questoes`: se
  `new.topico_id` não é nulo e o tópico não tem `assunto_id = new.assunto_id`, faz `new.topico_id := null`.
- **Lixeira:** leia as funções de restaurar questão da lixeira (procure `lixeira` e `jsonb_populate_record` ou
  `insert into questoes` no schema).
  - Se um snapshot com `topico_id` de tópico inexistente quebraria a restauração pela chave estrangeira, ajuste
    para restaurar com `topico_id` nulo nesse caso.
  - Se o snapshot nem inclui a coluna, não mexa.
- **Tipos** em `types.ts`:
  - `Topico = { id; assunto_id; nome; situacao: "aprovado"|"proposto"; created_at }`;
  - `Habilidade = { id; area: Area; codigo: string|null; descricao; situacao; created_at }`;
  - `MaterialRevisao = { id; escola_id: string|null; topico_id: string|null; assunto_id: string|null; aula_id: string|null; titulo: string|null; url: string|null; created_at }`;
  - `topico_id: string | null` em `Questao`.
- [ ] Escrever o SQL, que deve poder rodar de novo sem erro (`if not exists`, `drop trigger if exists`,
  `create or replace`).
- [ ] `npx tsc --noEmit` limpo e `npm test` verde.
- [ ] Commit `feat: SQL e tipos da classificação fina`.

### Task 2: Regras puras

**Files:** Create `src/lib/questoes/classificacao.ts`, `src/lib/questoes/classificacao.test.ts` (e registrar no `package.json`).

**Interfaces (Produces):**
```ts
export const LIMITE_LOTE = 50;
export type ItemLote = { questaoId: string; topicoId?: string | null; habilidadeIds?: string[] };
export type QuestaoLote = { id: string; assunto_id: string | null; area: Area; escopo: Escopo; escola_id: string | null; criado_por: string | null };
export type Recusa = { questaoId: string; motivo: string };
export function validarItens(itens: ItemLote[], questoes: Map<string, QuestaoLote>, topicos: Map<string, { assunto_id: string }>, habilidades: Map<string, { area: Area }>, ator: Ator): { aceitos: ItemLote[]; recusados: Recusa[] }
export function mesmoAssunto(qs: QuestaoLote[]): string | null   // assunto comum ou null
export function mesmaArea(qs: QuestaoLote[]): Area | null
export function habilidadesFinais(atuais: string[], novas: string[], modo: "adicionar" | "trocar"): string[]  // sem repetidos, ordem estável
export function planoJuntarTopicos(origem: { id: string; nome: string }[], destino: { id: string; nome: string }[]): { mover: string[]; juntar: { de: string; para: string }[] }  // nomes iguais (sem acento/maiúsc.) juntam
export function nomeNormalizado(s: string): string
```
- **Motivos exatos de recusa:**
  - `"Questão não encontrada."`;
  - `"Sem permissão para editar esta questão."`;
  - `"Tópico não encontrado."`;
  - `"O tópico é de outro assunto."`;
  - `"Habilidade não encontrada."`;
  - `"A habilidade é de outra área."`.
- **Lote grande:** mais de `LIMITE_LOTE` itens lança `Error("No máximo 50 questões por vez.")`.
- [ ] **Testes primeiro:**
  - cada motivo de recusa;
  - itens válidos e inválidos juntos (os válidos seguem);
  - 51 itens lançam o erro;
  - `habilidadesFinais`: "adicionar" sem duplicar, e "trocar";
  - `mesmoAssunto` e `mesmaArea` com seleção mista → null;
  - `planoJuntarTopicos` com "Derivação" e "derivação" → juntar; nome novo → mover;
  - permissão: professor e questão do banco geral → recusa; dono → aceita.
- [ ] Rodar o teste: deve falhar.
- [ ] Implementar e rodar de novo: deve passar.
- [ ] `npm test`.
- [ ] Commit `feat: regras da classificação fina`.

### Task 3: Servidor e ações

**Files:**
- Create `src/lib/questoes/classificacao-servidor.ts`, `src/actions/classificacao.ts`.
- Modify `src/actions/assuntos.ts` (`juntarAssunto` também move tópicos e materiais).

**Interfaces (Produces):**
```ts
// classificacao-servidor.ts (usa Ator; nunca lê sessão)
export async function listarTopicos(assuntoIds?: string[]): Promise<Topico[]>
export async function listarHabilidades(area?: Area): Promise<Habilidade[]>
export async function classificacaoDasQuestoes(ids: string[]): Promise<Map<string, { topicoId: string | null; habilidadeIds: string[] }>>
export async function classificarQuestoesPor(ator: Ator, itens: ItemLote[], modo: "adicionar" | "trocar"): Promise<{ salvas: number; recusados: Recusa[] }>
export async function proporTopicoPor(ator: Ator, assuntoId: string, nome: string): Promise<Topico>  // devolve o existente se o nome normalizado já existe
export async function criarHabilidadePor(ator: Ator, area: Area, descricao: string, codigo: string | null, situacao: "aprovado" | "proposto"): Promise<Habilidade>  // só dono
export async function questoesParaClassificar(ator: Ator, f: { materia?: string; assuntoId?: string; soSemTopico: boolean; limite: number; depoisDe?: string }): Promise<{ questoes: Questao[]; total: number; classificadas: number }>
export async function juntarTopicos(deId: string, paraId: string): Promise<void>   // move questões, prerequisitos, materiais; apaga "de"
export async function juntarHabilidades(deId: string, paraId: string): Promise<void>
```
- **`classificarQuestoesPor`:**
  - lê questões, tópicos e habilidades em blocos;
  - valida com `validarItens`;
  - grava `topico_id` e `questao_habilidades` (apaga e insere as finais por questão);
  - não toca em `status` nem em `updated_at`, salvo se o padrão do projeto pedir, como em `salvarQuestao`.
- **Ações** em `src/actions/classificacao.ts` (`"use server"`):
  - todas chamam `exigirProfessor()`;
  - as de gerenciar (aprovar, renomear, juntar tópico e habilidade, pré-requisitos, materiais) exigem
    `role === "dono"`;
  - mensagens de erro em pt-BR e `revalidatePath("/banco", "layout")`.
- [ ] Implementar; `npx tsc --noEmit`, `npm test`. Commit `feat: gravação da classificação fina`.

### Task 4: Editor da questão

**Files:** Modify `src/components/questoes/EditorQuestao.tsx`, `src/actions/questoes.ts` (`DadosQuestao` ganha `topico_id?: string | null; habilidade_ids?: string[]`), as páginas que montam o editor (`src/app/banco/questoes/[id]/page.tsx`, `src/app/banco/nova/page.tsx`, revisão de importação), que passam `topicos` e `habilidades`.

- **Campos:** depois de Assunto, entram:
  - **Tópico:** select dos tópicos do assunto, com os "(proposto)" marcados e o botão "+ propor tópico", que abre um
    campo e chama a ação `proporTopico`;
  - **Habilidades:** caixas com busca, da área da questão, mostrando "H18 — descrição".
- Trocar a matéria ou o assunto limpa o tópico na tela.
- Salvar grava junto com a questão: `salvarQuestao` e `criarQuestao` chamam `classificarQuestoesPor(professor, [...], "trocar")` depois do update.
- [ ] Implementar; prints do editor em 1340 e 390 (página de prévia local, sem commitar). Lint, tsc, test, build.
- [ ] Commit `feat: tópico e habilidades no editor da questão`.

### Task 5: Classificar aos poucos (`/banco/classificar`)

**Files:** Create `src/app/banco/classificar/page.tsx` + componente cliente `src/components/questoes/ClassificarUma.tsx` (+ CSS). Modify `src/app/banco/page.tsx` (botão "Classificar" levando os filtros de matéria e assunto).

- **Navegação:**
  - query `?materia=&assunto=&semTopico=1&q=<id atual>`;
  - a página carrega a próxima questão com `questoesParaClassificar(professor, {..., limite: 1, depoisDe})`.
- **Mostra:**
  - enunciado e alternativas (componentes de `src/components/questoes/`);
  - os campos Tópico e Habilidades, iguais aos do editor (extrair um componente compartilhado
    `CamposClassificacao.tsx` na Task 4 e reutilizar aqui);
  - os botões "Salvar e próxima" e "Pular";
  - o progresso "142 de 1.380 classificadas neste assunto".
- Sem questão pendente: "Tudo classificado neste filtro".
- [ ] Implementar; prints 1340/390; lint, tsc, test, build. Commit `feat: classificar questões uma por vez`.

### Task 6: Classificar em lote na lista do banco

**Files:** Modify `src/app/banco/page.tsx` e o componente da lista. Leia como a lista é desenhada hoje e coloque a seleção num componente cliente novo `src/components/questoes/LoteClassificacao.tsx`.

- Caixa de seleção por questão, só nas que a pessoa pode editar, com "Selecionar todas desta página".
- A barra fixa "N selecionadas · Classificar" abre um painel com Tópico e Habilidades:
  - **Tópico:** habilitado só se `mesmoAssunto`;
  - **Habilidades:** habilitado só se `mesmaArea`, com o modo adicionar ou trocar;
  - quando desabilitado, o campo mostra o motivo.
- O resultado vem de `classificarQuestoesPor` e aparece como "38 classificadas, 2 sem permissão".
- [ ] Implementar; prints; lint, tsc, test, build. Commit `feat: classificar questões em lote`.

### Task 7: Tela de gerenciar (dono)

**Files:**
- Modify `src/app/banco/assuntos/page.tsx`, com o título "Classificação". Os assuntos propostos continuam ali.
- Create `src/components/questoes/GerenciarClassificacao.tsx` (+ CSS).

- **Abas:**
  - **Tópicos por assunto:**
    - filtros de matéria e assunto;
    - lista com nº de questões, situação, aprovar, renomear e juntar com outro tópico do mesmo assunto;
    - pré-requisitos do tópico: adicionar, com busca de tópicos de qualquer matéria, e remover;
    - materiais: aula, escolhida numa lista de aulas publicadas com busca, ou link (título + `https://`).
  - **Habilidades por área:** criar (código opcional + descrição), aprovar, renomear e juntar.
- Botão na página do banco, só para o dono, renomeado para "Classificação".
- [ ] Implementar; prints; lint, tsc, test, build. Commit `feat: gerenciar tópicos, habilidades, pré-requisitos e materiais`.

### Task 8: Ferramentas no MCP do dono

**Files:**
- Create `src/lib/mcp/acoes/classificacao.ts`, registrado no bloco `perfil === "dono"` de `src/lib/mcp/acoes.ts`.
- Testes em `src/lib/mcp/acoes/classificacao.test.ts`, no padrão de `acoes.test.ts` e `cursos.test.ts`, com o
  supabase simulado; o arquivo entra no `package.json`.

- `questoes_para_classificar`:
  - recebe `{ materia (nome, via materiaDoTexto), assunto? (nome), so_sem_topico=true, limite≤50 }`;
  - devolve texto com uma questão por bloco: id, assunto, início do enunciado (até 400 caracteres), alternativas
    curtas e classificação atual;
  - no fim, a lista de tópicos (id — nome) dos assuntos envolvidos e as habilidades da área (id — código — descrição).
- `classificar_questoes`:
  - recebe `{ itens: [{ questao_id, topico_id? , topico_novo?, habilidade_ids?, habilidades_novas?: [{codigo?, descricao}] }] ≤50, modo: "adicionar"|"trocar" = "trocar" }`;
  - `topico_novo` usa `proporTopicoPor` no assunto da questão;
  - `habilidades_novas` usa `criarHabilidadePor(..., "proposto")` na área da questão;
  - depois chama `classificarQuestoesPor`, usando `registrado(...)` e `atualizarTelas()` como `escritas.ts`;
  - devolve "N classificadas" e as recusas com o motivo.
- [ ] Testes primeiro:
  - tópico de outro assunto é recusado e os outros itens gravam;
  - id inexistente é recusado;
  - `topico_novo` cria o tópico como `proposto`;
  - 51 itens dão erro.
- [ ] Rodar o teste: deve falhar. Implementar e rodar de novo: deve passar. Depois `npm test` e `npx tsc --noEmit`.
- [ ] Commit `feat: classificar questões pelo MCP do dono`.

### Task 9: Carga inicial (Português e Matemática)

**Files:** Create `db/classificacao-inicial.sql`.

- **Tópicos:** de 4 a 8 por assunto, para **todos** os assuntos de `portugues` e `matematica`. A lista atual de
  assuntos está no banco: o orquestrador entrega a lista de nomes.
  - A inserção usa `select id from assuntos where materia=… and lower(nome)=lower(…)`, sem ids fixos.
  - `on conflict do nothing` pelo índice único, `situacao='aprovado'`.
  - Os tópicos são de nível ensino médio e ENEM, sem repetir o nome do próprio assunto.
- **Habilidades:** as **30 da área de Linguagens** e as **30 de Matemática** da *Matriz de Referência do ENEM*
  (INEP), código `H1`–`H30`, com o texto **copiado da fonte oficial**.
  - O implementador busca a matriz no site do INEP (`download.inep.gov.br`, "Matriz de Referência ENEM") e anota a
    URL no comentário do SQL.
  - Se não conseguir conferir na fonte, deixa as habilidades fora do arquivo e avisa.
- [ ] Escrever; revisar nomes duplicados. Commit `chore: carga inicial de tópicos e habilidades (Português e Matemática)`.

### Task 10: Publicação (orquestrador)

- [ ] Revisão do branch inteiro.
- [ ] O Peter cola o bloco novo do `db/schema.sql` e depois `db/classificacao-inicial.sql`. Conferir por leitura
  (chave anônima) que `topicos` existe, que `questoes.topico_id` responde e que os tópicos de Português estão lá.
- [ ] `npm test`, lint e build. Rebase em `origin/master`, push no `master` e conferência no www com a conta do dono:
  - classificar uma questão pela tela;
  - classificar 5 pelo MCP (`statusavalia-dono`).
- [ ] CLAUDE.md (item 13) e memória.
