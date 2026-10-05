# Loja: venda de cursos e treinos para alunos de fora (Stripe)

Data: 2026-10-05 · Status: desenho aprovado no brainstorming, aguardando revisão da spec

## Objetivo

Vender acesso a alunos sem vínculo com escola: **curso avulso** (ex.: Física) ou **pacote completo**
(todos os cursos à venda + treinos ilimitados com o banco de questões), com pagamento único por
período (Pix ou cartão em até 12x) via **Stripe Checkout**. A plataforma é a única vendedora.

**Sucesso:** no modo de teste do Stripe, uma pessoa entra em `www.statusavalia.com.br/loja`, cria
conta, compra "Física" com cartão de teste, volta e já vê o curso em `/aluno/cursos`; compra o pacote
com Pix de teste e passa a ver todos os cursos à venda e a criar treinos; um reembolso retira o acesso.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Vendedor | **Só a plataforma** (uma conta Stripe; repasse a professores fica por fora) |
| Produtos | **Curso avulso** (só aquele curso) e **pacote completo** (todos os cursos à venda + treinos) |
| Cobrança | **Pagamento único por período** (meses definidos por produto); Pix e cartão até 12x |
| Marca e lugar | Loja em **`www.statusavalia.com.br/loja`** com a marca neutra **Status Avalia** |
| Contas | Alunos de fora pertencem à **escola da plataforma** ("Status Avalia", sem turmas) |
| Liberação | **Só pelo webhook assinado** do Stripe; nunca pela volta do navegador |
| Preço | Lido do banco na hora da compra; o navegador nunca envia preço |
| Renovação | Soma o prazo a partir da validade atual (ou de hoje, se vencida) |
| Reembolso/contestação | Retira o acesso daquela compra automaticamente |
| Progresso | Mantido após vencer; renovar continua de onde parou |

## 1. Banco de dados (o Peter cola no SQL Editor)

```sql
-- ===== Loja (2026-10-05) =====

-- Escola da plataforma: dona das contas de alunos de fora (sem turmas)
insert into escolas (id, nome, slug, logo_url, slogan, nome_remetente_email, codigo_convite_professor, ativa)
select '00000000-0000-0000-0000-000000000002', 'Status Avalia', 'loja', '',
       'Estude no seu ritmo.', 'Status Avalia', encode(gen_random_bytes(9), 'hex'), true
where not exists (select 1 from escolas where id = '00000000-0000-0000-0000-000000000002');

-- Conta criada pela loja
alter table alunos_contas drop constraint if exists alunos_contas_criado_via_check;
alter table alunos_contas add constraint alunos_contas_criado_via_check
    check (criado_via in ('escola', 'convite', 'loja'));

create table if not exists produtos_loja (
    id uuid primary key default gen_random_uuid(),
    tipo varchar(8) not null check (tipo in ('curso', 'completo')),
    curso_id uuid references cursos(id) on delete cascade,
    titulo text not null,
    descricao text,
    preco_centavos integer not null check (preco_centavos between 100 and 10000000),
    meses integer not null check (meses between 1 and 36),
    ativo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((tipo = 'curso') = (curso_id is not null))
);
create unique index if not exists uq_produtos_loja_curso on produtos_loja (curso_id) where curso_id is not null;
create unique index if not exists uq_produtos_loja_completo on produtos_loja (tipo) where tipo = 'completo';

create table if not exists compras (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references alunos_contas(id) on delete cascade,
    produto_id uuid not null references produtos_loja(id) on delete restrict,
    valor_centavos integer not null,
    meses integer not null,
    stripe_session_id text not null unique,
    stripe_payment_intent text,
    status varchar(12) not null default 'pendente' check (status in ('pendente', 'paga', 'reembolsada', 'expirada')),
    acesso_ate timestamptz,
    paga_em timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists idx_compras_conta on compras (conta_id, status);
create index if not exists idx_compras_intent on compras (stripe_payment_intent);

alter table produtos_loja enable row level security;
alter table compras enable row level security;
drop policy if exists "acesso_total_produtos_loja" on produtos_loja;
create policy "acesso_total_produtos_loja" on produtos_loja for all using (true) with check (true);
drop policy if exists "acesso_total_compras" on compras;
create policy "acesso_total_compras" on compras for all using (true) with check (true);
```

`ESCOLA_LOJA_ID = "00000000-0000-0000-0000-000000000002"`; slug `loja` entra na lista de subdomínios
reservados (`src/lib/dominio.ts`). O painel do dono não deixa desativar nem editar o endereço dela.

## 2. Regras puras (testadas) — `src/lib/loja/regras.ts`

- `novaValidade(validadeAtual: Date | null, meses: number, agora: Date): Date` — soma `meses` a
  `max(validadeAtual, agora)` (mês de calendário; dia 31 vira o último dia do mês).
- `acessoVigente(compras, agora)` → `{ completoAte: Date | null; cursos: Map<cursoId, Date> }` a partir
  das compras `paga` com `acesso_ate > agora` (para cada produto, a maior validade).
- `podeVerCursoComprado(cursoId, vigente)` — pacote vigente com o curso à venda, ou curso avulso vigente.
- `podeTreinar(vigente)` — pacote completo vigente.
- `formatarPreco(centavos)` → `"R$ 97,00"`.
- `estadoDaCompra(evento)` — mapeia eventos do Stripe para transições: `checkout.session.completed`
  com `payment_status = 'paid'` e `checkout.session.async_payment_succeeded` → `paga`;
  `checkout.session.async_payment_failed` / `checkout.session.expired` → `expirada`;
  `charge.refunded` (total) e `charge.dispute.created` → `reembolsada`.

## 3. Loja (público) e conta

**`/loja`** (rota pública, marca Status Avalia sempre, independente do endereço): vitrine com o pacote
completo em destaque e os cursos à venda (título, descrição, nº de módulos/aulas, preço, prazo).
**`/loja/[produtoId]`**: detalhes + **Comprar**.

**Comprar sem login** → `/loja/conta?produto=<id>`: criar conta (nome, e-mail, senha) ou entrar.
Cadastro cria `alunos_contas` com `escola_id = ESCOLA_LOJA_ID`, `criado_via = 'loja'` (novo valor no
check, no SQL acima), confirmação de e-mail como no fluxo por código. Depois volta ao produto.

**Login**: contas da escola da plataforma podem entrar em `www`/apex (exceção em `destinoDoLogin`).
Professores/alunos de escola continuam com a regra atual.

**Área do aluno da loja** (`/aluno`): mesma área de hoje com a marca Status Avalia; cartão "Minhas
compras" (validades, renovar). `/aluno/cursos` mostra os cursos comprados (via `podeVerCursoComprado`)
além dos das turmas (alunos de escola não mudam). `/aluno/simulados` para aluno da loja: só "Meus
treinos", e criar treino exige `podeTreinar`; sem pacote, mostra o convite para comprar.

## 4. Pagamento

**`iniciarCompra(produtoId)`** (action, aluno logado da escola da plataforma — alunos de escola não
compram): lê o produto **ativo** do banco; cria a Checkout Session (`mode: 'payment'`,
`payment_method_types: ['card', 'pix']`, `payment_method_options.card.installments.enabled = true`,
`pix.expires_after_seconds = 3600`, `currency: 'brl'`, `line_items` com `price_data` do banco,
`customer_email`, `metadata { compra_id, conta_id, produto_id }`, `success_url
/loja/obrigado?session={CHECKOUT_SESSION_ID}`, `cancel_url /loja/<produto>`); grava `compras`
(`pendente`, valor e meses copiados) e redireciona para a URL do Stripe.

**Webhook `/api/stripe/webhook`** (rota pública, `runtime = 'nodejs'`): lê o corpo cru, verifica a
assinatura com `STRIPE_WEBHOOK_SECRET` (`stripe.webhooks.constructEvent`); assinatura inválida →
400. Eventos tratados conforme `estadoDaCompra`:
- **paga**: update condicional `status = 'paga' where status = 'pendente'` (idempotente); calcula
  `acesso_ate = novaValidade(maior validade vigente do mesmo produto da conta, meses, agora)`; grava
  `paga_em` e `stripe_payment_intent`.
- **expirada**: `pendente → expirada`.
- **reembolsada**: pela `payment_intent` → `status = 'reembolsada'`, `acesso_ate = now()`.
- Eventos desconhecidos → 200 sem efeito. Erro interno → 500 (o Stripe reenvia).

**`/loja/obrigado`**: consulta a compra pela sessão **da própria conta**; mostra "Liberando seu
acesso…" e atualiza a cada 3 s (até 2 min) até `paga`; Pix pendente → "Assim que o Pix for pago, o
acesso é liberado"; expirada → "O Pix expirou" + tentar de novo.

**Chaves** só na Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Sem chave, a loja mostra
"Vendas em breve" e o botão Comprar fica desativado.

## 5. Painel do dono — aba Loja

`/dono/loja`: **Produtos** — pacote completo (título, descrição, preço, meses, ativo) e cursos à venda
(escolher curso de qualquer escola, preço, meses, ativo; desativar não apaga compras). **Vendas** —
lista das compras pagas/reembolsadas (aluno, produto, valor, data, situação), total do mês corrente,
paginado. Reembolsos e saques: no painel do Stripe (link).

## 6. Regras de acesso

- Só contas da escola da plataforma compram; alunos de escola não veem a loja como compradores.
- Curso comprado: aulas e PDFs visíveis só com acesso vigente (mesmas telas e links assinados de hoje).
- Treinos de aluno da loja: só com pacote vigente; questões só `escopo = 'geral'` (já é a regra pela escola).
- Webhook é a única origem de `paga`; actions não confiam em parâmetros da volta do Stripe.
- Dono: produtos e vendas; não vê dados de alunos de escolas.
- Funções que recebem ids sem checar acesso ficam fora de `"use server"`.

**Fora desta parte:** assinatura recorrente, cupons, Stripe Connect/repasse automático, nota fiscal,
afiliados, venda para alunos de escola.

## 7. Testes

Unitários: `novaValidade` (sem validade, vigente, vencida, fim de mês), `acessoVigente` (pago vs
pendente/reembolsado, maior validade, pacote vs curso), `podeVerCursoComprado`, `podeTreinar`,
`formatarPreco`, `estadoDaCompra` (cada evento; `completed` com `unpaid` não libera).

Manual (modo de teste): comprar curso com cartão `4242…`; comprar pacote com Pix de teste; reenviar o
mesmo evento pelo painel do Stripe (sem duplicar); reembolsar e ver o acesso sumir; acesso vencido e
renovação; aluno de escola não consegue comprar; assinatura de webhook inválida → 400.
