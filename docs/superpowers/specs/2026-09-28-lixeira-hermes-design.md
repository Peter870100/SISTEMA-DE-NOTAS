# Lixeira reversível + liberdade do Hermes para criar e excluir planilhas

Data: 2026-09-28 · Status: desenho aprovado no brainstorming, aguardando revisão da spec

## Objetivo

Deixar o Hermes, o agente de IA que usa o endpoint MCP `/api/mcp`, criar e excluir
planilhas inteiras, alunos e atividades com liberdade, garantindo que **qualquer exclusão
possa ser revertida** por um administrador. Também deixar visível o que o Hermes criou,
para que uma criação indesejada possa ser desfeita excluindo o item, que vai para a lixeira.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| O que é reversível | Exclusão de planilha (turma+bimestre), aluno e atividade (inclui colunas de chamada) |
| De quem | Exclusões do Hermes **e** dos professores na tela: tudo vai para a lixeira |
| Quem vê e restaura | Só administradores, na página `/admin/lixeira` |
| Retenção | Para sempre, até um admin clicar em "Apagar de vez" |
| Criações do Hermes | Selo "Hermes" visível. Desfazer uma criação = excluir, e o item vai para a lixeira |
| Mecanismo | **Lixeira com cópia (snapshot)**: a cópia completa vai para a tabela `lixeira` e o original é apagado. Restaurar recria com os mesmos IDs. As leituras do sistema (66 consultas) não mudam |
| Atomicidade | Excluir e restaurar são **funções Postgres** (uma transação cada): ou tudo acontece, ou nada muda |
| Hermes restaura? | Não. Hermes só exclui; restaurar é exclusivo de humanos admin |

Descartado: *soft delete* (`excluido_em` em cada tabela). Exigiria filtrar as 66 leituras
em 12 arquivos, e um filtro esquecido faria dado excluído aparecer em médias, contagens ou
respostas do Hermes.

## 1. Banco de dados

O schema é manual: o bloco abaixo é colado pelo usuário no SQL Editor do Supabase e também
anexado ao fim de `db/schema.sql`. É idempotente (`if not exists` / `create or replace`).

```sql
-- ===== Lixeira reversível + origem dos registros (2026-09-28) =====

-- Origem de cada registro: criado pela tela ('app') ou pelo agente de IA ('hermes')
alter table turmas             add column if not exists criado_via varchar(10) not null default 'app';
alter table alunos             add column if not exists criado_via varchar(10) not null default 'app';
alter table atividades_colunas add column if not exists criado_via varchar(10) not null default 'app';

-- Cópias completas do que foi excluído. Restaurar recria tudo com os mesmos IDs.
create table if not exists lixeira (
    id uuid primary key default gen_random_uuid(),
    tipo varchar(20) not null check (tipo in ('turma', 'aluno', 'atividade')),
    titulo text not null,                  -- ex: "Ana Souza · 3º Ano A (3º Bimestre)"
    turma_id uuid,                         -- contexto, sem FK: a turma pode não existir mais
    turma_nome text,
    dados jsonb not null,                  -- linhas copiadas (entidade, filhos, notas, histórico)
    resumo jsonb not null default '{}',    -- contagens pra exibir, ex: {"alunos": 32, "notas": 254}
    excluido_por uuid references professores(id) on delete set null,
    excluido_via varchar(10) not null default 'app' check (excluido_via in ('app', 'hermes')),
    excluido_em timestamptz not null default now()
);
create index if not exists idx_lixeira_excluido_em on lixeira(excluido_em desc);

alter table lixeira enable row level security;
drop policy if exists "acesso_total_lixeira" on lixeira;
create policy "acesso_total_lixeira" on lixeira for all using (true) with check (true);

-- Copia pra lixeira e apaga, numa transação só. Devolve o id do item na lixeira.
create or replace function lixeira_excluir(
    p_tipo text,
    p_id uuid,
    p_ator uuid default null,
    p_via text default 'app'
) returns uuid
language plpgsql as $$
declare
    v_turma turmas%rowtype;
    v_aluno alunos%rowtype;
    v_coluna atividades_colunas%rowtype;
    v_dados jsonb;
    v_titulo text;
    v_lixeira_id uuid;
begin
    if p_tipo = 'turma' then
        select * into v_turma from turmas where id = p_id;
        if not found then raise exception 'Planilha não encontrada.'; end if;
        v_titulo := v_turma.nome || ' · ' || v_turma.bimestre;
        v_dados := jsonb_build_object(
            'turma', to_jsonb(v_turma),
            'alunos', coalesce((select jsonb_agg(to_jsonb(a) order by a.ordem) from alunos a where a.turma_id = p_id), '[]'::jsonb),
            'atividades', coalesce((select jsonb_agg(to_jsonb(c) order by c.ordem) from atividades_colunas c where c.turma_id = p_id), '[]'::jsonb),
            'notas', coalesce((select jsonb_agg(to_jsonb(n)) from notas_celulas n
                where n.aluno_id in (select id from alunos where turma_id = p_id)
                   or n.coluna_id in (select id from atividades_colunas where turma_id = p_id)), '[]'::jsonb),
            'historico', coalesce((select jsonb_agg(to_jsonb(h)) from notas_historico h
                where h.aluno_id in (select id from alunos where turma_id = p_id)
                   or h.coluna_id in (select id from atividades_colunas where turma_id = p_id)), '[]'::jsonb)
        );
        insert into lixeira (tipo, titulo, turma_id, turma_nome, dados, resumo, excluido_por, excluido_via)
        values ('turma', v_titulo, v_turma.id, v_turma.nome, v_dados,
            jsonb_build_object(
                'alunos', jsonb_array_length(v_dados->'alunos'),
                'atividades', jsonb_array_length(v_dados->'atividades'),
                'notas', jsonb_array_length(v_dados->'notas')),
            p_ator, p_via)
        returning id into v_lixeira_id;
        delete from turmas where id = p_id;  -- cascata leva alunos, colunas, notas e histórico

    elsif p_tipo = 'aluno' then
        select * into v_aluno from alunos where id = p_id;
        if not found then raise exception 'Aluno não encontrado.'; end if;
        select * into v_turma from turmas where id = v_aluno.turma_id;
        v_titulo := v_aluno.nome || ' · ' || v_turma.nome || ' (' || v_turma.bimestre || ')';
        v_dados := jsonb_build_object(
            'aluno', to_jsonb(v_aluno),
            'notas', coalesce((select jsonb_agg(to_jsonb(n)) from notas_celulas n where n.aluno_id = p_id), '[]'::jsonb),
            'historico', coalesce((select jsonb_agg(to_jsonb(h)) from notas_historico h where h.aluno_id = p_id), '[]'::jsonb)
        );
        insert into lixeira (tipo, titulo, turma_id, turma_nome, dados, resumo, excluido_por, excluido_via)
        values ('aluno', v_titulo, v_turma.id, v_turma.nome, v_dados,
            jsonb_build_object('notas', jsonb_array_length(v_dados->'notas')),
            p_ator, p_via)
        returning id into v_lixeira_id;
        delete from alunos where id = p_id;

    elsif p_tipo = 'atividade' then
        select * into v_coluna from atividades_colunas where id = p_id;
        if not found then raise exception 'Atividade não encontrada.'; end if;
        select * into v_turma from turmas where id = v_coluna.turma_id;
        v_titulo := v_coluna.titulo || ' · ' || v_turma.nome || ' (' || v_turma.bimestre || ')';
        v_dados := jsonb_build_object(
            'atividade', to_jsonb(v_coluna),
            'notas', coalesce((select jsonb_agg(to_jsonb(n)) from notas_celulas n where n.coluna_id = p_id), '[]'::jsonb),
            'historico', coalesce((select jsonb_agg(to_jsonb(h)) from notas_historico h where h.coluna_id = p_id), '[]'::jsonb)
        );
        insert into lixeira (tipo, titulo, turma_id, turma_nome, dados, resumo, excluido_por, excluido_via)
        values ('atividade', v_titulo, v_turma.id, v_turma.nome, v_dados,
            jsonb_build_object('notas', jsonb_array_length(v_dados->'notas')),
            p_ator, p_via)
        returning id into v_lixeira_id;
        delete from atividades_colunas where id = p_id;

    else
        raise exception 'Tipo inválido: %', p_tipo;
    end if;

    return v_lixeira_id;
end;
$$;

-- Recria o item com os mesmos IDs, numa transação só, e remove da lixeira.
-- Notas/histórico que apontam pra aluno ou atividade que não existe mais são pulados.
create or replace function lixeira_restaurar(p_lixeira_id uuid)
returns jsonb
language plpgsql as $$
declare
    r lixeira%rowtype;
    v_total int;
    v_restauradas int;
begin
    select * into r from lixeira where id = p_lixeira_id for update;
    if not found then raise exception 'Este item não está mais na lixeira.'; end if;

    if r.tipo = 'turma' then
        if exists (select 1 from turmas where id = (r.dados->'turma'->>'id')::uuid) then
            raise exception 'A planilha já existe — nada a restaurar.';
        end if;
        insert into turmas select * from jsonb_populate_record(null::turmas, r.dados->'turma');
        insert into alunos select * from jsonb_populate_recordset(null::alunos, r.dados->'alunos');
        insert into atividades_colunas select * from jsonb_populate_recordset(null::atividades_colunas, r.dados->'atividades');

    elsif r.tipo in ('aluno', 'atividade') then
        if not exists (select 1 from turmas where id = r.turma_id) then
            raise exception 'Restaure a planilha "%" primeiro.', r.turma_nome;
        end if;
        if r.tipo = 'aluno' then
            if exists (select 1 from alunos where id = (r.dados->'aluno'->>'id')::uuid) then
                raise exception 'O aluno já existe — nada a restaurar.';
            end if;
            insert into alunos select * from jsonb_populate_record(null::alunos, r.dados->'aluno');
        else
            if exists (select 1 from atividades_colunas where id = (r.dados->'atividade'->>'id')::uuid) then
                raise exception 'A atividade já existe — nada a restaurar.';
            end if;
            insert into atividades_colunas select * from jsonb_populate_record(null::atividades_colunas, r.dados->'atividade');
        end if;
    end if;

    -- Notas: só as que ainda têm aluno e atividade; autor apagado vira null.
    v_total := jsonb_array_length(coalesce(r.dados->'notas', '[]'::jsonb));
    insert into notas_celulas (id, aluno_id, coluna_id, valor, status_texto, atualizado_por, updated_at)
    select n.id, n.aluno_id, n.coluna_id, n.valor, n.status_texto,
           (select p.id from professores p where p.id = n.atualizado_por), n.updated_at
    from jsonb_populate_recordset(null::notas_celulas, coalesce(r.dados->'notas', '[]'::jsonb)) n
    where exists (select 1 from alunos a where a.id = n.aluno_id)
      and exists (select 1 from atividades_colunas c where c.id = n.coluna_id)
    on conflict do nothing;
    get diagnostics v_restauradas = row_count;

    insert into notas_historico (id, aluno_id, coluna_id, valor_anterior, status_anterior, valor_novo, status_novo, alterado_por, created_at)
    select h.id, h.aluno_id, h.coluna_id, h.valor_anterior, h.status_anterior, h.valor_novo, h.status_novo,
           (select p.id from professores p where p.id = h.alterado_por), h.created_at
    from jsonb_populate_recordset(null::notas_historico, coalesce(r.dados->'historico', '[]'::jsonb)) h
    where exists (select 1 from alunos a where a.id = h.aluno_id)
      and exists (select 1 from atividades_colunas c where c.id = h.coluna_id)
    on conflict do nothing;

    delete from lixeira where id = r.id;

    return jsonb_build_object(
        'tipo', r.tipo,
        'turma_id', r.turma_id,
        'notas_restauradas', v_restauradas,
        'notas_puladas', v_total - v_restauradas
    );
end;
$$;
```

Notas sobre o SQL:
- `jsonb_populate_record(null::tabela, …)` + `select *` segue a ordem atual das colunas. Se no futuro uma coluna `NOT NULL` sem valor na cópia for adicionada a `turmas`, `alunos` ou `atividades_colunas`, cópias antigas vão falhar ao restaurar. Quem adicionar a coluna deve ajustar `lixeira_restaurar` com `coalesce`. A mesma observação vai como comentário em `db/schema.sql`.
- Funções `security invoker` (padrão): rodam com a chave anon, sob as mesmas políticas permissivas das outras tabelas. A autorização (quem pode restaurar) fica na camada da aplicação, igual ao resto do sistema.

## 2. Tipos (`src/lib/types.ts`)

- `Turma`, `Aluno`, `AtividadeColuna` ganham `criado_via: "app" | "hermes"`.
- Novo `ItemLixeira` (linha de `lixeira`), com `resumo: { alunos?: number; atividades?: number; notas?: number }` e `dados: unknown`.
- `Database.Tables.lixeira` e `Database.Functions` com `lixeira_excluir` (Args `{ p_tipo; p_id; p_ator?; p_via? }`, Returns `string`) e `lixeira_restaurar` (Args `{ p_lixeira_id }`, Returns `ResultadoRestauracao`).
- `ResultadoRestauracao = { tipo: "turma" | "aluno" | "atividade"; turma_id: string | null; notas_restauradas: number; notas_puladas: number }`.

## 3. Lógica pura (`src/lib/lixeira.ts`, testada)

- `descreverResumo(tipo, resumo)` → `"32 alunos · 8 atividades · 254 notas"`, `"12 notas"`, `"sem notas"` (singular/plural corretos).
- `descreverOrigem(item, nomeProfessor)` → `"Hermes, a pedido de Fulano"`, `"Hermes"`, `"Fulano"`, `"Professor removido"`.
- `mensagemRestauracao(resultado)` → `"Planilha restaurada com 254 notas."` / `"Aluno restaurado. 3 notas foram puladas porque a atividade delas não existe mais."`.
- Testes em `src/lib/lixeira.test.ts`, incluídos no script `npm test`.

## 4. Server actions

Novo `src/actions/lixeira.ts`:
- `listarLixeira(): Promise<(ItemLixeira & { excluido_por_nome: string | null })[]>`: exige admin; mais recentes primeiro; não devolve `dados` (pesado), só as colunas de exibição.
- `restaurarDaLixeira(id): Promise<ResultadoRestauracao>`: exige admin; chama a RPC `lixeira_restaurar`; `revalidatePath` em `/admin/lixeira`, `/` e na turma.
- `apagarDaLixeira(id)`: exige admin; `delete from lixeira where id`.
- `desfazerExclusao(id): Promise<ResultadoRestauracao>`: para o Ctrl+Z do professor. Permitido se o item foi excluído pelo **próprio professor**, pela tela (`excluido_via = 'app'`), há no máximo **30 minutos**; senão erro "Peça a um administrador para restaurar pela lixeira".

Mudanças:
- `deleteAluno(alunoId): Promise<string>`: mantém a checagem de acesso; troca o `delete` por `rpc("lixeira_excluir", { p_tipo: "aluno", p_id, p_ator: professor?.id, p_via: "app" })` e devolve o id da lixeira.
- `restaurarAlunoExcluido`: removida (substituída por `desfazerExclusao`).
- `deleteColuna(colunaId): Promise<string>`: **ganha** `exigirAcessoATurmaId` (hoje não tem) e passa a usar `lixeira_excluir` com `p_tipo: "atividade"`.

## 5. Hermes (`src/lib/mcp-tools.ts`)

- Os cinco pontos de criação (`criar_turma`, `criar_aluno`, `criar_alunos_em_lote`, `criar_atividade` e a criação implícita da coluna em `lancar_presenca_em_lote`) gravam `criado_via: "hermes"`.
- `excluir_aluno` e `excluir_atividade` trocam o `delete` por `rpc("lixeira_excluir", { …, p_ator: professorInfo?.id ?? null, p_via: "hermes" })`. A descrição da ferramenta e a resposta passam a dizer que o item vai para a lixeira e pode ser restaurado por um administrador.
- Nova ferramenta `excluir_turma`: entrada `turma_nome`, `bimestre` (opcional, com a mesma resolução das outras ferramentas) e `professor_telefone`. Respeita `turmasLiberadas`. Resposta: `Planilha "3º Ano A · 3º Bimestre" movida para a lixeira (32 alunos, 8 atividades, 254 notas). Um administrador pode restaurá-la em /admin/lixeira.`
- `listar_turmas` e `ver_planilha` passam a indicar quando o item foi criado pelo Hermes (texto "(criada pelo Hermes)"), para o próprio agente saber o que ele criou.
- Hermes **não** ganha ferramenta de restaurar.

## 6. Telas

- **Planilha, excluir aluno:** `PlanilhaGrid` guarda o id da lixeira devolvido por `deleteAluno`; o Ctrl+Z chama `desfazerExclusao(id)` e recoloca o aluno e as notas no estado local (mesmos IDs, então o snapshot em memória continua válido). Texto do diálogo: "…Todas as notas dele vão junto para a lixeira. Dá pra desfazer com Ctrl+Z logo em seguida, e um administrador pode restaurar pela lixeira."
- **Gerenciar colunas, excluir atividade:** texto do diálogo troca "Essa ação não pode ser desfeita" por "A coluna e as notas vão para a lixeira; um administrador pode restaurá-las."
- **Selo Hermes** (componente `SeloHermes`, ícone `Bot` da lucide, `bg-brand-bright/10 text-brand-bright`, `text-[10px]`, com `title="Criado pelo Hermes"`): no card da turma (home), no cabeçalho da turma (ao lado do título, na faixa azul, versão `bg-white/15 text-white`), na linha do aluno (junto aos selos "editado"/transferido) e no botão do título da coluna.
- **`/admin/lixeira`** (`PageLayout`, crumb "Administração", título "Lixeira"):
  - Filtros: tipo (Todos/Planilhas/Alunos/Atividades) e origem (Todas/Hermes/Professores).
  - Lista em card: ícone do tipo, `titulo`, `descreverResumo`, `descreverOrigem`, data/hora em mono.
  - **Restaurar** (`estilos.botaoSecundario`) com `ConfirmDialog` (`danger={false}`); o resultado aparece em aviso verde com `mensagemRestauracao`; erros da função (ex.: "Restaure a planilha … primeiro") em aviso vermelho.
  - Botão desabilitado com dica quando o item é aluno/atividade e a planilha dele também está na lixeira (`turma_id` presente entre os itens `tipo = 'turma'` da lista).
  - **Apagar de vez** (`text-danger`) com `ConfirmDialog` vermelho: "Isso apaga definitivamente … e não pode ser desfeito."
  - Estado vazio: "A lixeira está vazia."
- **Sidebar:** item "Lixeira" (ícone `Trash2`) para admin, depois de Histórico. **Ctrl+K:** ação "Lixeira" para admin.

## 7. Erros e casos limite

| Situação | Comportamento |
|---|---|
| Hermes exclui planilha inexistente ou sem acesso | Erro já existente de `resolverTurma` |
| Restaurar aluno/atividade com a planilha na lixeira | Erro da função: `Restaure a planilha "X" primeiro.` (e o botão já vem desabilitado) |
| Restaurar algo que já existe (IDs) | Erro: "já existe — nada a restaurar" |
| Notas cuja atividade ou aluno sumiu depois | Puladas e contadas em `notas_puladas` |
| Autor de nota/histórico foi removido | Restaura com `atualizado_por`/`alterado_por` nulo |
| Dois admins restaurando o mesmo item | `for update` na linha: o segundo recebe "não está mais na lixeira" |
| Ctrl+Z após 30 min ou por outro professor | Erro orientando a pedir ao admin |
| Falha no meio de excluir/restaurar | Transação desfaz tudo; nada fica pela metade |

## 8. Verificação

- `npm test` (inclui `lixeira.test.ts`), `npm run build`, `npm run lint`.
- Depois do SQL colado, roteiro manual com uma planilha de teste criada para isso:
  1. Criar pelo Hermes (ou pela tela) a planilha "TESTE LIXEIRA", com 2 alunos, 1 atividade e 2 notas; conferir o selo Hermes quando criada por ele.
  2. Excluir um aluno pela tela → Ctrl+Z → volta com as notas.
  3. Excluir a atividade → aparece em `/admin/lixeira` com "2 notas" → Restaurar → volta com as notas.
  4. Excluir a planilha pelo Hermes (`excluir_turma`) → some da home → aparece na lixeira como "Hermes, a pedido de …" → Restaurar → volta completa.
  5. Excluir de novo e "Apagar de vez" → some da lixeira.

## Fora de escopo

Reverter notas lançadas/alteradas pelo Hermes; limpeza automática da lixeira; botão de
excluir planilha na tela para professores; ferramenta de restaurar para o Hermes.
