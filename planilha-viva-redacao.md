# Planilha Viva — Sistema de Notas de Redação

## Overview

Aplicação web estilo "planilha viva" (grid editável tipo Google Sheets) para o professor de
Redação lançar e acompanhar notas/status de atividades por turma, substituindo a planilha
`.xlsx` atual. Colunas de atividades são dinâmicas por turma; nomes de alunos já cadastrados
são somáveis mas não sobrescrevíveis (trava read-only); painel lateral mostra evolução
individual do aluno com gráfico (Recharts).

**Decisões confirmadas com o usuário (2026-07-25):**
1. Importação automática da planilha `.xlsx` de referência via script de seed (Node + lib `xlsx`).
2. Células de nota: dropdown de status rápido (OK, NF, FALTOU, NÃO FEZ, ESTAVA FAZENDO PROVA) + campo numérico livre (0–1000), ambos na mesma célula.
3. Sem autenticação — modo demo/uso individual (sem tela de login).

**Descobertas ao inspecionar o arquivo `.xlsx` real** (`planilha/2ª BIMESTRE STATUS - REDAÇÃO - PROF. PETER (3).xlsx`):
- O arquivo tem **6 turmas** (abas): `1ªA`, `1ªB`, `2ªA`, `2ªB`, `3ªA`, `3ªB` — não apenas "1ª série A". A 7ª aba (`Página1`) está vazia e será ignorada. O seed importa as 6 turmas.
- Cada turma tem seu próprio conjunto de colunas de atividade (nomes variam levemente entre turmas, ex.: "LEITURAS" vs "LEITURA") — já coberto pelo desenho `atividades_colunas` por `turma_id`.
- Duas colunas por planilha (ex. colunas F e K na aba 1ªA) são espaçadores vazios sem cabeçalho — o importador pula colunas sem título.
- A coluna **"NOTA DE SALA"** é, na planilha original, um valor **calculado por fórmula** (soma das 4 melhores notas de atividade ÷ 400). No sistema novo ela será importada como valor comum (snapshot do que estava calculado) e passa a ser **editável manualmente como qualquer outra coluna** — não será recalculada automaticamente. Se o professor quiser o recálculo automático no futuro, é uma extensão separada.
- Status em texto livre aparecem com grafias variadas (`ok`/`OK`, `faltou`/`FALTOU`, `NÃO FEZ`, `FALTOU -25-06`, `faltou - 09-07`, até um caso `"1B"` indicando transferência de turma). Por isso `status_texto` é texto livre, não um ENUM fechado — o dropdown é só um atalho de UI.

## Project Type
WEB (Next.js App Router, full-stack)

## Success Criteria
- [ ] SQL aplicado no Supabase sem erros; tabelas com constraints corretas
- [ ] Seed importa as 6 turmas, alunos e notas do `.xlsx` real sem perda de dados
- [ ] Grid carrega, edição de célula (nota ou status) salva no Supabase em < 1s (otimista)
- [ ] Nome do aluno é 100% read-only no grid para alunos existentes
- [ ] Adicionar/excluir aluno funciona com confirmação na exclusão
- [ ] Painel lateral do aluno abre com gráfico de evolução (Recharts) e métricas
- [ ] Build (`npm run build`) e lint sem erros

## Tech Stack
- Next.js 16 (App Router) + TypeScript — escolha explícita do usuário
- Tailwind CSS v4 — estilização
- Supabase (PostgreSQL) — client direto (`@supabase/supabase-js`), sem ORM (Prisma) para manter o acesso simples e próximo do SQL, conforme pedido do usuário
- Recharts — gráfico de evolução do aluno
- `xlsx` (SheetJS) — parser do arquivo de referência no script de seed
- Sem autenticação (modo demo) — RLS permissiva no Supabase, documentada como apropriada apenas para link privado/uso individual

## File Structure
```
appnotasescola/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # redireciona/lista turmas
│   │   ├── globals.css                 # Tailwind v4 (@theme)
│   │   └── turma/[turmaId]/page.tsx    # a Planilha Viva
│   ├── components/
│   │   ├── grid/PlanilhaGrid.tsx
│   │   ├── grid/CelulaNota.tsx
│   │   ├── grid/GestaoColunasModal.tsx
│   │   └── aluno/AlunoDashboardDrawer.tsx
│   ├── lib/
│   │   ├── supabase/client.ts          # browser client
│   │   ├── supabase/server.ts          # server client
│   │   └── types.ts                    # tipos gerados/manuais das tabelas
│   └── actions/
│       ├── notas.ts                    # upsert de célula
│       ├── alunos.ts                   # criar/excluir aluno
│       └── colunas.ts                  # criar/renomear/reordenar/excluir coluna
├── db/
│   └── schema.sql                      # SQL das tabelas (mostrado abaixo)
├── scripts/
│   └── seed-from-xlsx.ts               # importador da planilha de referência
├── planilha/                           # (já existe) planilha de referência
├── package.json
├── next.config.ts
├── tsconfig.json
└── .env.local
```

## Task Breakdown

| ID | Tarefa | Agente/Skill | Depende de | Verificação |
|----|--------|---------------|------------|-------------|
| 1 | Scaffold Next.js 16 + TS + Tailwind v4 | frontend-specialist / scaffolding | - | `npm run dev` sobe sem erro |
| 2 | Criar `db/schema.sql` com as 4 tabelas + RLS + triggers | database-architect / database-design | Task 1 | SQL aplicado no Supabase sem erro |
| 3 | Configurar clients Supabase (browser/server) + `.env.local` | backend-specialist | Task 2 | Query de teste retorna dados |
| 4 | Script `scripts/seed-from-xlsx.ts` (lib `xlsx`) — importa 6 turmas | backend-specialist | Task 2, 3 | Linhas em `alunos`/`notas_celulas` batem com a planilha |
| 5 | `PlanilhaGrid` — grid editável, nome read-only, navegação por teclado | frontend-specialist / frontend-architecture | Task 3 | Editar célula persiste e sobrevive a reload |
| 6 | Dropdown de status rápido + campo numérico na célula | frontend-specialist | Task 5 | Selecionar "FALTOU" grava `status_texto`, número grava `valor` |
| 7 | Adicionar/excluir aluno (linha) com modal de confirmação | frontend-specialist | Task 5 | Aluno novo aparece sem reload; exclusão pede confirmação |
| 8 | `GestaoColunasModal` — renomear/reordenar/excluir coluna | frontend-specialist | Task 5 | Alterações refletem no grid de todos os alunos |
| 9 | `AlunoDashboardDrawer` com Recharts (evolução + métricas) | frontend-specialist / dataviz | Task 5 | Gráfico renderiza com dados reais do aluno |
| 10 | Verificação final (lint, build, checklist) | test-engineer | Todas | `npm run build` limpo |

## ✅ PHASE X COMPLETE
- Lint: ✅ Pass (`npm run lint`, exit 0)
- Build: ✅ Pass (`npm run build`, TypeScript + Next.js build limpos)
- Seed: ✅ 6 turmas, 263 alunos, ~1900 células importadas do `.xlsx` real
  - Bug encontrado e corrigido durante QA: coluna fantasma "46191" (célula de data escondida na planilha, não uma atividade) estava sendo importada como coluna real — corrigido no parser para só aceitar cabeçalhos que são texto, dados foram limpos e reimportados
- Teste manual: página `/` e `/turma/[id]` verificadas via `curl`/headless Chrome — renderização confere com os dados da planilha (screenshot conferido), sem erros no console nem no log do servidor dev
- Socratic Gate respeitado (3 perguntas feitas e respondidas antes do código: importação automática, dropdown de status, modo demo sem login)
- Vulnerabilidade de segurança encontrada e corrigida: pacote `xlsx` do npm tinha 2 CVEs altos sem correção — substituído pela build oficial patch da SheetJS (CDN deles)
- Data: 2026-07-25
