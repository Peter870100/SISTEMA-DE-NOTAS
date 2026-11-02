import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Ctx } from "../leitura/comum";

// O cliente do Supabase é criado ao importar o módulo; uma URL qualquer basta, nada sai pela rede.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "chave-de-teste";

// ---------- banco falso em memória ----------

type Linha = Record<string, unknown>;
type Tabelas = Record<string, Linha[]>;

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Só o que as funções usadas aqui chamam: filtros simples, insert/update/upsert/delete e contagem. */
function bancoFalso(tabelas: Tabelas) {
  let seq = 0;
  const from = (nome: string) => {
    const linhas = (tabelas[nome] ??= []);
    const filtros: ((l: Linha) => boolean)[] = [];
    let op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
    let corpo: unknown;
    let unico: "single" | "maybe" | null = null;
    let contagem = false;
    let limite = Infinity;

    const resposta = (dados: Linha[]) => {
      if (unico === "single") return dados[0] ? { data: dados[0], error: null } : { data: null, error: { message: "Linha não encontrada." } };
      if (unico === "maybe") return { data: dados[0] ?? null, error: null };
      return { data: dados, error: null };
    };
    const executar = () => {
      const alvo = linhas.filter((l) => filtros.every((f) => f(l)));
      if (op === "insert") {
        const novas = (Array.isArray(corpo) ? corpo : [corpo]).map((c) => ({ id: uid(5000 + ++seq), created_at: "2026-11-02T00:00:00Z", ...(c as Linha) }));
        linhas.push(...novas);
        return resposta(novas);
      }
      if (op === "update") {
        for (const l of alvo) Object.assign(l, corpo);
        return { data: alvo, error: null };
      }
      if (op === "upsert") {
        for (const n of corpo as Linha[]) {
          if (!linhas.some((l) => l.questao_id === n.questao_id && l.habilidade_id === n.habilidade_id)) linhas.push({ ...n });
        }
        return { data: null, error: null };
      }
      if (op === "delete") {
        for (const l of alvo) linhas.splice(linhas.indexOf(l), 1);
        return { data: null, error: null };
      }
      if (contagem) return { data: null, count: alvo.length, error: null };
      return resposta(alvo.slice(0, limite));
    };

    const q = {
      select(_colunas?: string, opcoes?: { head?: boolean }) { if (opcoes?.head) contagem = true; return q; },
      eq(c: string, v: unknown) { filtros.push((l) => l[c] === v); return q; },
      in(c: string, vs: unknown[]) { filtros.push((l) => vs.includes(l[c])); return q; },
      is(c: string, v: unknown) { filtros.push((l) => (l[c] ?? null) === v); return q; },
      not(c: string, _operador: string, v: unknown) { filtros.push((l) => (l[c] ?? null) !== v); return q; },
      gt(c: string, v: unknown) { filtros.push((l) => String(l[c]) > String(v)); return q; },
      order() { return q; },
      range() { return q; },
      limit(n: number) { limite = n; return q; },
      single() { unico = "single"; return q; },
      maybeSingle() { unico = "maybe"; return q; },
      insert(v: unknown) { op = "insert"; corpo = v; return q; },
      update(v: unknown) { op = "update"; corpo = v; return q; },
      upsert(v: unknown) { op = "upsert"; corpo = v; return q; },
      delete() { op = "delete"; return q; },
      then(ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) { return Promise.resolve(executar()).then(ok, falha); },
    };
    return q;
  };
  return { from, tabelas };
}

// ---------- dados ----------

const ESCOLA = uid(1);
const DONO = uid(2);
const A1 = uid(10); // Funções
const A2 = uid(11); // Geometria
const T1 = uid(20); // de A1
const T2 = uid(21); // de A2
const H1 = uid(30); // matemática, H1
const H2 = uid(31); // humanas
const H3 = uid(32); // matemática, sem código
const Q1 = uid(40);
const Q2 = uid(41);
const Q3 = uid(42); // assunto A2
const Q4 = uid(43); // já tem tópico
const SEM_ASSUNTO = uid(44);
const INEXISTENTE = uid(99);

const alternativas = (prefixo: string) => (["A", "B", "C", "D", "E"] as const).map((letra) => ({ letra, texto: `${prefixo} ${letra}` }));
const questao = (id: string, o: Linha = {}): Linha => ({
  id, escopo: "geral", escola_id: null, criado_por: null, materia: "matematica", area: "matematica", assunto_id: A1, topico_id: null,
  enunciado: `Enunciado ${id}`, comando: "Qual é o valor?", alternativas: alternativas("alt"), ...o,
});

function cenario() {
  const banco = bancoFalso({
    professores: [{ id: DONO, escola_id: ESCOLA, role: "dono" }],
    assuntos: [
      { id: A1, materia: "matematica", nome: "Funções", situacao: "aprovado" },
      { id: A2, materia: "matematica", nome: "Geometria", situacao: "aprovado" },
    ],
    topicos: [
      { id: T1, assunto_id: A1, nome: "Função afim", situacao: "aprovado" },
      { id: T2, assunto_id: A2, nome: "Áreas", situacao: "proposto" },
    ],
    habilidades: [
      { id: H1, area: "matematica", codigo: "H1", descricao: "Reconhecer números", situacao: "aprovado" },
      { id: H2, area: "humanas", codigo: "H5", descricao: "Identificar processos históricos", situacao: "aprovado" },
      { id: H3, area: "matematica", codigo: null, descricao: "Interpretar gráficos", situacao: "aprovado" },
    ],
    questoes: [
      questao(Q1), questao(Q2), questao(Q3, { assunto_id: A2 }), questao(Q4, { topico_id: T1 }),
      questao(SEM_ASSUNTO, { assunto_id: null }),
    ],
    questao_habilidades: [],
    hermes_registro: [],
  });
  return banco;
}

type Resposta = { content: { type: string; text: string }[]; isError?: boolean };
type Ferramenta = { schema: z.ZodObject<z.ZodRawShape>; descricao: string; handler: (args: unknown) => Promise<Resposta> };

/** Registra as ferramentas num servidor falso e aponta o cliente global do Supabase para o banco falso. */
async function montar(banco = cenario()) {
  const { supabase } = await import("@/lib/supabase/client");
  (supabase as unknown as { from: unknown }).from = banco.from;
  const { registrarAcoesClassificacao } = await import("./classificacao");
  const ferramentas = new Map<string, Ferramenta>();
  const servidor = {
    registerTool(nome: string, def: { description: string; inputSchema: z.ZodRawShape }, handler: Ferramenta["handler"]) {
      ferramentas.set(nome, { schema: z.object(def.inputSchema), descricao: def.description, handler });
    },
  } as unknown as McpServer;
  const ctx: Ctx = { supabase: { from: banco.from } as unknown as Ctx["supabase"], escopo: { tipo: "dono" } };
  registrarAcoesClassificacao(servidor, async () => ctx, "dono");
  /** Como o SDK: valida (e aplica os padrões) antes de chamar a ferramenta. */
  const chamar = async (nome: string, args: unknown) => {
    const f = ferramentas.get(nome);
    assert.ok(f, `ferramenta ${nome} não registrada`);
    return f.handler(f.schema.parse(args));
  };
  return { banco, ferramentas, chamar };
}

const textoDe = (r: Resposta) => r.content[0].text;
const linhaDe = (banco: ReturnType<typeof cenario>, tabela: string, id: string) => banco.tabelas[tabela].find((l) => l.id === id)!;

// ---------- classificar_questoes ----------

test("classificar_questoes: tópico de outro assunto é recusado e os outros itens gravam", async () => {
  const { banco, chamar } = await montar();
  const r = await chamar("classificar_questoes", {
    itens: [
      { questao_id: Q1, topico_id: T1 },
      { questao_id: Q2, topico_id: T2 }, // T2 é de Geometria, Q2 é de Funções
      { questao_id: Q3, topico_id: T2 },
    ],
  });
  assert.notEqual(r.isError, true);
  assert.match(textoDe(r), /2 classificadas/);
  assert.match(textoDe(r), new RegExp(`${Q2}.*O tópico é de outro assunto`));
  assert.equal(linhaDe(banco, "questoes", Q1).topico_id, T1);
  assert.equal(linhaDe(banco, "questoes", Q3).topico_id, T2);
  assert.equal(linhaDe(banco, "questoes", Q2).topico_id, null);
});

test("classificar_questoes: id inexistente é recusado e os outros itens gravam", async () => {
  const { banco, chamar } = await montar();
  const r = await chamar("classificar_questoes", {
    itens: [{ questao_id: INEXISTENTE, topico_id: T1 }, { questao_id: Q1, topico_id: T1 }],
  });
  assert.match(textoDe(r), /1 classificada\b/);
  assert.match(textoDe(r), new RegExp(`${INEXISTENTE}.*Questão não encontrada`));
  assert.equal(linhaDe(banco, "questoes", Q1).topico_id, T1);
});

test("classificar_questoes: topico_novo cria o tópico como proposto, no assunto da questão, e não repete", async () => {
  const { banco, chamar } = await montar();
  const antes = banco.tabelas.topicos.length;
  const r = await chamar("classificar_questoes", {
    itens: [
      { questao_id: Q1, topico_novo: "Função  quadrática" },
      { questao_id: Q2, topico_novo: "função Quadrática" },
      { questao_id: Q3, topico_novo: "Triângulos" },
    ],
  });
  assert.match(textoDe(r), /3 classificadas/);
  assert.equal(banco.tabelas.topicos.length, antes + 2);
  const quadratica = banco.tabelas.topicos.find((t) => t.assunto_id === A1 && t.id !== T1)!;
  assert.equal(quadratica.nome, "Função quadrática");
  assert.equal(quadratica.situacao, "proposto"); // o dono também propõe: quem aprova é ele, depois
  const triangulos = banco.tabelas.topicos.find((t) => t.nome === "Triângulos")!;
  assert.equal(triangulos.assunto_id, A2);
  assert.equal(triangulos.situacao, "proposto");
  assert.equal(linhaDe(banco, "questoes", Q1).topico_id, quadratica.id);
  assert.equal(linhaDe(banco, "questoes", Q2).topico_id, quadratica.id);
  assert.equal(linhaDe(banco, "questoes", Q3).topico_id, triangulos.id);
  assert.match(textoDe(r), /Função quadrática/);
});

test("classificar_questoes: topico_novo de questão inexistente ou sem assunto não cria nada", async () => {
  const { banco, chamar } = await montar();
  const antes = banco.tabelas.topicos.length;
  const r = await chamar("classificar_questoes", {
    itens: [{ questao_id: INEXISTENTE, topico_novo: "Fantasma" }, { questao_id: SEM_ASSUNTO, topico_novo: "Solto" }],
  });
  assert.match(textoDe(r), /0 classificadas/);
  assert.match(textoDe(r), new RegExp(`${INEXISTENTE}.*Questão não encontrada`));
  assert.match(textoDe(r), new RegExp(`${SEM_ASSUNTO}.*sem assunto`));
  assert.equal(banco.tabelas.topicos.length, antes);
});

test("classificar_questoes: habilidades_novas entram como proposto na área da questão e reaproveitam a que já existe", async () => {
  const { banco, chamar } = await montar();
  const antes = banco.tabelas.habilidades.length;
  const r = await chamar("classificar_questoes", {
    itens: [{
      questao_id: Q1,
      habilidade_ids: [H1],
      habilidades_novas: [{ codigo: "H9", descricao: "Resolver problemas com porcentagem" }, { descricao: "interpretar  GRÁFICOS" }],
    }, {
      questao_id: Q2,
      habilidades_novas: [{ descricao: "Resolver problemas com porcentagem" }],
    }],
  });
  assert.match(textoDe(r), /2 classificadas/);
  assert.equal(banco.tabelas.habilidades.length, antes + 1); // H3 foi reaproveitada; a nova só uma vez
  const nova = banco.tabelas.habilidades.find((h) => h.codigo === "H9")!;
  assert.equal(nova.area, "matematica");
  assert.equal(nova.situacao, "proposto");
  const ligadas = (q: string) => banco.tabelas.questao_habilidades.filter((l) => l.questao_id === q).map((l) => l.habilidade_id).sort();
  assert.deepEqual(ligadas(Q1), [H1, H3, nova.id as string].sort());
  assert.deepEqual(ligadas(Q2), [nova.id as string]);
  assert.match(textoDe(r), /Resolver problemas com porcentagem/);
});

test("classificar_questoes: habilidade de outra área é recusada", async () => {
  const { banco, chamar } = await montar();
  const r = await chamar("classificar_questoes", { itens: [{ questao_id: Q1, habilidade_ids: [H2] }, { questao_id: Q2, habilidade_ids: [H1] }] });
  assert.match(textoDe(r), /1 classificada\b/);
  assert.match(textoDe(r), new RegExp(`${Q1}.*outra área`));
  assert.deepEqual(banco.tabelas.questao_habilidades.map((l) => l.questao_id), [Q2]);
});

test("classificar_questoes: modo padrão é trocar; adicionar mantém as habilidades atuais", async () => {
  const { banco, chamar, ferramentas } = await montar();
  banco.tabelas.questao_habilidades.push({ questao_id: Q1, habilidade_id: H1 }, { questao_id: Q2, habilidade_id: H1 });
  assert.equal(ferramentas.get("classificar_questoes")!.schema.parse({ itens: [{ questao_id: Q1 }] }).modo, "trocar");
  await chamar("classificar_questoes", { itens: [{ questao_id: Q1, habilidade_ids: [H3] }] });
  await chamar("classificar_questoes", { itens: [{ questao_id: Q2, habilidade_ids: [H3] }], modo: "adicionar" });
  const ligadas = (q: string) => banco.tabelas.questao_habilidades.filter((l) => l.questao_id === q).map((l) => l.habilidade_id).sort();
  assert.deepEqual(ligadas(Q1), [H3]);
  assert.deepEqual(ligadas(Q2), [H1, H3].sort());
});

test("classificar_questoes: item sem nada a gravar, ou com topico_id e topico_novo, é recusado", async () => {
  const { banco, chamar } = await montar();
  const antes = banco.tabelas.topicos.length;
  const r = await chamar("classificar_questoes", {
    itens: [{ questao_id: Q1 }, { questao_id: Q2, topico_id: T1, topico_novo: "Outro" }, { questao_id: Q4, topico_id: T1 }],
  });
  assert.match(textoDe(r), /1 classificada\b/);
  assert.match(textoDe(r), new RegExp(`${Q1}.*Informe`));
  assert.match(textoDe(r), new RegExp(`${Q2}.*topico_id ou topico_novo`));
  assert.equal(banco.tabelas.topicos.length, antes);
  assert.equal(linhaDe(banco, "questoes", Q2).topico_id, null);
});

test("classificar_questoes: 51 itens são rejeitados; 50 passam", async () => {
  const { ferramentas, banco, chamar } = await montar();
  const { schema } = ferramentas.get("classificar_questoes")!;
  const itens = (n: number) => Array.from({ length: n }, (_, i) => ({ questao_id: uid(1000 + i), topico_id: T1 }));
  assert.equal(schema.safeParse({ itens: itens(51) }).success, false);
  assert.equal(schema.safeParse({ itens: itens(50) }).success, true);
  assert.equal(schema.safeParse({ itens: [] }).success, false);
  await assert.rejects(chamar("classificar_questoes", { itens: itens(51) }));
  assert.equal(banco.tabelas.hermes_registro.length, 0); // nem chegou a registrar
});

test("classificar_questoes: registra a ação na Hermes e não muda o status da questão", async () => {
  const { banco, chamar } = await montar();
  linhaDe(banco, "questoes", Q1).status = "publicada";
  await chamar("classificar_questoes", { itens: [{ questao_id: Q1, topico_id: T1 }] });
  assert.equal(banco.tabelas.hermes_registro.length, 1);
  assert.equal(banco.tabelas.hermes_registro[0].ferramenta, "classificar_questoes");
  assert.equal(banco.tabelas.hermes_registro[0].perfil, "dono");
  assert.equal(banco.tabelas.hermes_registro[0].situacao, "concluida");
  assert.equal(linhaDe(banco, "questoes", Q1).status, "publicada");
});

// ---------- questoes_para_classificar ----------

test("questoes_para_classificar: um bloco por questão, só as sem tópico, com tópicos e habilidades da área no fim", async () => {
  const { banco, chamar } = await montar();
  linhaDe(banco, "questoes", Q1).enunciado = "x".repeat(600);
  banco.tabelas.questao_habilidades.push({ questao_id: Q2, habilidade_id: H1 });
  const r = await chamar("questoes_para_classificar", { materia: "Matemática" });
  assert.notEqual(r.isError, true);
  const t = textoDe(r);
  // blocos: Q1, Q2 e Q3 (Q4 já tem tópico; SEM_ASSUNTO não tem o que classificar)
  for (const id of [Q1, Q2, Q3]) assert.ok(t.includes(id), `falta ${id}`);
  assert.ok(!t.includes(Q4));
  assert.ok(!t.includes(SEM_ASSUNTO));
  // enunciado até 400 caracteres
  assert.ok(t.includes(`${"x".repeat(400)}…`));
  assert.ok(!t.includes("x".repeat(401)));
  // assunto, alternativas e classificação atual
  assert.match(t, /Assunto: Funções/);
  assert.match(t, /A\) alt A/);
  assert.match(t, /E\) alt E/);
  assert.match(t, /Tópico atual: nenhum/);
  assert.match(t, new RegExp(`Habilidades atuais: .*${H1}`));
  // lista de tópicos dos assuntos envolvidos (id — nome)
  assert.match(t, new RegExp(`${T1} — Função afim`));
  assert.match(t, new RegExp(`${T2} — Áreas`));
  // habilidades da área (id — código — descrição), sem as de outras áreas
  assert.match(t, new RegExp(`${H1} — H1 — Reconhecer números`));
  assert.match(t, new RegExp(`${H3} — sem código — Interpretar gráficos`));
  assert.ok(!t.includes(H2));
});

test("questoes_para_classificar: so_sem_topico=false traz as classificadas e mostra o tópico atual", async () => {
  const { chamar } = await montar();
  const r = await chamar("questoes_para_classificar", { materia: "matematica", so_sem_topico: false });
  const t = textoDe(r);
  assert.ok(t.includes(Q4));
  assert.match(t, new RegExp(`Tópico atual: Função afim \\(${T1}\\)`));
});

test("questoes_para_classificar: assunto filtra pelo nome e limite corta", async () => {
  const { chamar } = await montar();
  const geometria = textoDe(await chamar("questoes_para_classificar", { materia: "Matemática", assunto: "Geometria" }));
  assert.ok(geometria.includes(Q3));
  assert.ok(!geometria.includes(Q1));
  const uma = textoDe(await chamar("questoes_para_classificar", { materia: "Matemática", limite: 1 }));
  assert.equal([Q1, Q2, Q3].filter((id) => uma.includes(id)).length, 1);
});

test("questoes_para_classificar: limite acima de 50 é rejeitado; sem questões, avisa", async () => {
  const { ferramentas, chamar, banco } = await montar();
  const { schema } = ferramentas.get("questoes_para_classificar")!;
  assert.equal(schema.safeParse({ materia: "Matemática", limite: 51 }).success, false);
  assert.equal(schema.safeParse({ materia: "Matemática", limite: 50 }).success, true);
  assert.equal(schema.parse({ materia: "Matemática" }).so_sem_topico, true);
  banco.tabelas.questoes.length = 0;
  assert.match(textoDe(await chamar("questoes_para_classificar", { materia: "Matemática" })), /Nenhuma questão/);
});

test("questoes_para_classificar: matéria desconhecida e assunto desconhecido voltam como erro", async () => {
  const { chamar } = await montar();
  const m = await chamar("questoes_para_classificar", { materia: "Astrologia" });
  assert.equal(m.isError, true);
  assert.match(textoDe(m), /Matéria "Astrologia" não existe/);
  const a = await chamar("questoes_para_classificar", { materia: "Matemática", assunto: "Culinária" });
  assert.equal(a.isError, true);
  assert.match(textoDe(a), /Assunto "Culinária" não encontrado/);
});

// ---------- rodada de correções ----------

const ligadas = (banco: ReturnType<typeof cenario>, q: string) =>
  banco.tabelas.questao_habilidades.filter((l) => l.questao_id === q).map((l) => l.habilidade_id).sort();

test("classificar_questoes: habilidade_ids e habilidades_novas vazios não contam como informados", async () => {
  const { banco, chamar } = await montar();
  banco.tabelas.questao_habilidades.push({ questao_id: Q1, habilidade_id: H1 }, { questao_id: Q2, habilidade_id: H1 });
  const r = await chamar("classificar_questoes", {
    itens: [
      { questao_id: Q1, habilidade_ids: [] },
      { questao_id: Q3, habilidade_ids: [], habilidades_novas: [] },
      { questao_id: Q2, topico_id: T1, habilidade_ids: [] },
    ],
  });
  assert.match(textoDe(r), /1 classificada\b/);
  assert.match(textoDe(r), new RegExp(`${Q1}.*Informe`));
  assert.match(textoDe(r), new RegExp(`${Q3}.*Informe`));
  // o modo padrão é trocar, mas lista vazia não apaga nada
  assert.deepEqual(ligadas(banco, Q1), [H1]);
  assert.deepEqual(ligadas(banco, Q2), [H1]);
  assert.equal(linhaDe(banco, "questoes", Q2).topico_id, T1);
});

test("classificar_questoes: topico_id e habilidade_id inexistentes são recusados com o motivo certo", async () => {
  const { banco, chamar } = await montar();
  const r = await chamar("classificar_questoes", {
    itens: [
      { questao_id: Q1, topico_id: uid(777) },
      { questao_id: Q2, habilidade_ids: [uid(778)] },
      { questao_id: Q3, topico_id: T2 },
    ],
  });
  assert.match(textoDe(r), /1 classificada\b/);
  assert.match(textoDe(r), new RegExp(`${Q1}: Tópico não encontrado\.`));
  assert.match(textoDe(r), new RegExp(`${Q2}: Habilidade não encontrada\.`));
  assert.equal(linhaDe(banco, "questoes", Q1).topico_id, null);
  assert.equal(linhaDe(banco, "questoes", Q3).topico_id, T2);
  assert.deepEqual(banco.tabelas.questao_habilidades, []);
});

test("classificar_questoes: item condenado por habilidade_ids inválida não deixa tópico nem habilidade propostos", async () => {
  const { banco, chamar } = await montar();
  const topicos = banco.tabelas.topicos.length;
  const habilidades = banco.tabelas.habilidades.length;
  const r = await chamar("classificar_questoes", {
    itens: [
      { questao_id: Q1, topico_novo: "Fantasma", habilidade_ids: [uid(778)] }, // não existe
      { questao_id: Q2, habilidades_novas: [{ descricao: "Órfã" }], habilidade_ids: [H2] }, // é de humanas
      { questao_id: Q3, topico_novo: "Triângulos", habilidade_ids: [H1] }, // este é válido
    ],
  });
  assert.match(textoDe(r), /1 classificada\b/);
  assert.match(textoDe(r), new RegExp(`${Q1}: Habilidade não encontrada\.`));
  assert.match(textoDe(r), new RegExp(`${Q2}: A habilidade é de outra área\.`));
  assert.equal(banco.tabelas.topicos.length, topicos + 1); // só o de Q3
  assert.equal(banco.tabelas.habilidades.length, habilidades);
  assert.ok(!textoDe(r).includes("Fantasma"));
  assert.ok(!textoDe(r).includes("Órfã"));
});

test("classificar_questoes: topico_novo reaproveita o tópico existente de mesmo nome e repetir a chamada não cria nada", async () => {
  const { banco, chamar } = await montar();
  const antes = banco.tabelas.topicos.length;
  const existente = await chamar("classificar_questoes", { itens: [{ questao_id: Q1, topico_novo: "  FUNÇÃO   afim " }] });
  assert.match(textoDe(existente), /1 classificada\b/);
  assert.equal(banco.tabelas.topicos.length, antes);
  assert.equal(linhaDe(banco, "questoes", Q1).topico_id, T1); // o tópico que já existia, ainda aprovado
  assert.equal(linhaDe(banco, "topicos", T1).situacao, "aprovado");
  assert.ok(!/Criados/.test(textoDe(existente)));

  const primeira = await chamar("classificar_questoes", { itens: [{ questao_id: Q2, topico_novo: "Função quadrática" }] });
  assert.match(textoDe(primeira), /Criados como proposto.*Função quadrática/);
  assert.equal(banco.tabelas.topicos.length, antes + 1);

  const repetida = await chamar("classificar_questoes", { itens: [{ questao_id: Q2, topico_novo: "função quadrática" }] });
  assert.match(textoDe(repetida), /1 classificada\b/);
  assert.ok(!/Criados/.test(textoDe(repetida)));
  assert.equal(banco.tabelas.topicos.length, antes + 1);
});

test("questoes_para_classificar: depois_de pagina a lista e a dica traz o id da última", async () => {
  const { chamar } = await montar();
  const p1 = textoDe(await chamar("questoes_para_classificar", { materia: "Matemática", so_sem_topico: false, limite: 1 }));
  assert.ok(p1.includes(Q1) && !p1.includes(Q2));
  assert.match(p1, new RegExp(`depois_de: ${Q1}`));
  const p2 = textoDe(await chamar("questoes_para_classificar", { materia: "Matemática", so_sem_topico: false, limite: 1, depois_de: Q1 }));
  assert.ok(p2.includes(Q2) && !p2.includes(Q1));
  assert.match(p2, new RegExp(`depois_de: ${Q2}`));
  // última página: sobraram Q3 e Q4 (a sem assunto não entra) e não há dica de continuação
  const p3 = textoDe(await chamar("questoes_para_classificar", { materia: "Matemática", so_sem_topico: false, limite: 10, depois_de: Q2 }));
  assert.ok(p3.includes(Q3) && p3.includes(Q4) && !p3.includes(Q2));
  assert.ok(!p3.includes("Pode haver mais"));
});

test("questoes_para_classificar: a descrição da habilidade na lista é cortada em 160 caracteres", async () => {
  const { banco, chamar } = await montar();
  linhaDe(banco, "habilidades", H3).descricao = "y".repeat(300);
  const t = textoDe(await chamar("questoes_para_classificar", { materia: "Matemática" }));
  assert.ok(t.includes(`${"y".repeat(160)}…`));
  assert.ok(!t.includes("y".repeat(161)));
});

test("registrarAcoes: o perfil professor não recebe as ferramentas de classificação; o dono recebe", async () => {
  await montar(); // aponta o cliente global para o banco falso antes de carregar os módulos
  const { registrarAcoes } = await import("../acoes");
  const nomes = (perfil: "dono" | "professor") => {
    const registradas: string[] = [];
    const servidor = { registerTool(nome: string) { registradas.push(nome); } } as unknown as McpServer;
    registrarAcoes(servidor, async () => { throw new Error("não deveria ser chamado"); }, perfil);
    return registradas;
  };
  const professor = nomes("professor");
  assert.ok(professor.length > 0);
  assert.ok(!professor.includes("questoes_para_classificar"));
  assert.ok(!professor.includes("classificar_questoes"));
  const dono = nomes("dono");
  assert.ok(dono.includes("questoes_para_classificar"));
  assert.ok(dono.includes("classificar_questoes"));
});
