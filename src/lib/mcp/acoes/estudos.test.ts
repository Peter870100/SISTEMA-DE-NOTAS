import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Ctx } from "../leitura/comum";
import { urlDeFotoValida } from "@/lib/estudos/fotos";

// O cliente do Supabase é criado ao importar o módulo; uma URL qualquer basta, nada sai pela rede.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "chave-de-teste";

// ---------- banco falso em memória ----------

type Linha = Record<string, unknown>;
type Tabelas = Record<string, Linha[]>;

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Só o que as funções usadas aqui chamam: filtros simples, insert/update/delete. */
function bancoFalso(tabelas: Tabelas) {
  let seq = 0;
  const from = (nome: string) => {
    const linhas = (tabelas[nome] ??= []);
    const filtros: ((l: Linha) => boolean)[] = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let corpo: unknown;
    let unico: "single" | "maybe" | null = null;
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
      if (op === "delete") {
        for (const l of alvo) linhas.splice(linhas.indexOf(l), 1);
        return { data: null, error: null };
      }
      return resposta(alvo.slice(0, limite));
    };

    const q = {
      select() { return q; },
      eq(c: string, v: unknown) { filtros.push((l) => l[c] === v); return q; },
      in(c: string, vs: unknown[]) { filtros.push((l) => vs.includes(l[c])); return q; },
      is(c: string, v: unknown) { filtros.push((l) => (l[c] ?? null) === v); return q; },
      order() { return q; },
      range() { return q; },
      limit(n: number) { limite = n; return q; },
      single() { unico = "single"; return q; },
      maybeSingle() { unico = "maybe"; return q; },
      insert(v: unknown) { op = "insert"; corpo = v; return q; },
      update(v: unknown) { op = "update"; corpo = v; return q; },
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
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="2"/></svg>';
const COMENTARIO = "Comentario secreto do exercicio";

const alternativas = () => (["A", "B", "C", "D", "E"] as const).map((letra) => ({ letra, texto: `alt ${letra}` }));
const exercicio = (n: number, o: Record<string, unknown> = {}) => ({
  enunciado: `Enunciado ${n}`, alternativas: alternativas(), resposta_correta: "B", comentario: COMENTARIO, ...o,
});
const dez = () => Array.from({ length: 10 }, (_, n) => exercicio(n + 1));
const blocosBase = [{ tipo: "paragrafo", texto: "Texto da explicação." }, { tipo: "imagem", imagem_id: "fig" }];
const entrada = (o: Record<string, unknown> = {}) => ({
  assunto: "Funções", materia: "Matemática", blocos: blocosBase,
  desenhos: [{ chave: "fig", svg: SVG, alt: "Um círculo" }], fotos: [], fonte: "ia", exercicios: dez(), ...o,
});

function cenario(extra: Tabelas = {}) {
  return bancoFalso({
    professores: [{ id: DONO, escola_id: ESCOLA, role: "dono" }],
    assuntos: [
      { id: A1, materia: "matematica", nome: "Funções", situacao: "aprovado" },
      { id: A2, materia: "matematica", nome: "Geometria", situacao: "aprovado" },
    ],
    questoes: [{ id: uid(40), assunto_id: A1, status: "publicada" }],
    materiais_estudo: [], imagens_estudo: [], exercicios_fixacao: [], respostas_fixacao: [], relatos_erro: [],
    hermes_registro: [],
    ...extra,
  });
}

type Resposta = { content: { type: string; text: string }[]; isError?: boolean };
type Ferramenta = { schema: z.ZodObject<z.ZodRawShape>; handler: (args: unknown) => Promise<Resposta> };

async function montar(banco = cenario()) {
  const { supabase } = await import("@/lib/supabase/client");
  (supabase as unknown as { from: unknown }).from = banco.from;
  const { registrarAcoesEstudos } = await import("./estudos");
  const ferramentas = new Map<string, Ferramenta>();
  const servidor = {
    registerTool(nome: string, def: { inputSchema: z.ZodRawShape }, handler: Ferramenta["handler"]) {
      ferramentas.set(nome, { schema: z.object(def.inputSchema), handler });
    },
  } as unknown as McpServer;
  const ctx: Ctx = { supabase: { from: banco.from } as unknown as Ctx["supabase"], escopo: { tipo: "dono" } };
  registrarAcoesEstudos(servidor, async () => ctx, "dono");
  const chamar = async (nome: string, args: unknown) => {
    const f = ferramentas.get(nome);
    assert.ok(f, `ferramenta ${nome} não registrada`);
    return f.handler(f.schema.parse(args));
  };
  return { banco, ferramentas, chamar };
}

type Banco = ReturnType<typeof cenario>;
const textoDe = (r: Resposta) => r.content[0].text;
const materiais = (b: Banco) => b.tabelas.materiais_estudo;
const exercicios = (b: Banco) => b.tabelas.exercicios_fixacao;
const nada = (b: Banco) => assert.deepEqual([materiais(b).length, b.tabelas.imagens_estudo.length, exercicios(b).length], [0, 0, 0]);

const MAT = uid(300);
/** Material já gravado, com 10 exercícios na situação pedida. */
function comMaterial(situacao: string, checagens: number, exSituacao = "rascunho") {
  return cenario({
    materiais_estudo: [{ id: MAT, assunto_id: A1, blocos: [], fonte: "ia", situacao, checagens, motivo: null }],
    exercicios_fixacao: Array.from({ length: 10 }, (_, n) => ({
      id: uid(400 + n), material_id: MAT, ordem: n + 1, enunciado: `E${n + 1}`, imagem_id: null,
      alternativas: alternativas(), resposta_correta: "B", comentario: COMENTARIO, situacao: exSituacao, motivo: null, checagens,
    })),
  });
}
const parecerOk = () =>
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((ordem) => ({ ordem, ok: true, resposta_encontrada: "B" as const }));

// ---------- testes ----------

test("só registra no perfil dono", async () => {
  const { registrarAcoes } = await import("../acoes");
  const nomes = (perfil: "dono" | "professor") => {
    const lista: string[] = [];
    registrarAcoes({ registerTool: (n: string) => { lista.push(n); } } as unknown as McpServer, async () => ({}) as Ctx, perfil);
    return lista;
  };
  assert.ok(nomes("dono").includes("salvar_material_estudo"));
  assert.ok(!nomes("professor").some((n) => n.endsWith("_estudo") || n === "avisos_estudo"));
});

test("salva 10 exercícios como rascunho e troca chave por id nos blocos", async () => {
  const { banco, chamar } = await montar();
  const r = await chamar("salvar_material_estudo", entrada());
  assert.notEqual(r.isError, true, textoDe(r));
  const m = materiais(banco)[0];
  assert.equal(m.situacao, "rascunho");
  assert.equal(m.assunto_id, A1);
  assert.equal(exercicios(banco).length, 10);
  assert.ok(exercicios(banco).every((e) => e.situacao === "rascunho" && e.checagens === 0));
  const imagem = banco.tabelas.imagens_estudo[0];
  assert.equal(imagem.tipo, "desenho");
  assert.equal((m.blocos as { imagem_id?: string }[])[1].imagem_id, imagem.id);
});

test("o exercício pode citar o desenho; chave de foto ou desconhecida é recusada", async () => {
  const { banco, chamar } = await montar();
  const r = await chamar("salvar_material_estudo", entrada({ exercicios: [exercicio(1, { imagem: "fig" }), ...dez().slice(1)] }));
  assert.notEqual(r.isError, true, textoDe(r));
  assert.equal(exercicios(banco)[0].imagem_id, banco.tabelas.imagens_estudo[0].id);

  const b2 = cenario();
  const { chamar: chamar2 } = await montar(b2);
  const r2 = await chamar2("salvar_material_estudo", entrada({ exercicios: [exercicio(1, { imagem: "foto1" }), ...dez().slice(1)] }));
  assert.equal(r2.isError, true);
  assert.match(textoDe(r2), /chave de um desenho/);
  nada(b2);
});

test("recusa número de exercícios diferente de 10", async () => {
  const { banco, chamar } = await montar();
  const r = await chamar("salvar_material_estudo", entrada({ exercicios: dez().slice(0, 9) }));
  assert.equal(r.isError, true);
  assert.match(textoDe(r), /exatamente 10/);
  nada(banco);
});

test("recusa SVG com script e bloco desconhecido, sem gravar nada", async () => {
  const { banco, chamar } = await montar();
  const ruim = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  const r = await chamar("salvar_material_estudo", entrada({ desenhos: [{ chave: "fig", svg: ruim, alt: "x" }] }));
  assert.equal(r.isError, true);
  assert.match(textoDe(r), /script/);
  const r2 = await chamar("salvar_material_estudo", entrada({ blocos: [{ tipo: "video", url: "x" }] }));
  assert.equal(r2.isError, true);
  nada(banco);
});

test("recusa foto de outro site antes de baixar", async () => {
  assert.equal(urlDeFotoValida("https://exemplo.com/a.jpg"), false);
  const { banco, chamar } = await montar();
  const r = await chamar("salvar_material_estudo", entrada({
    fotos: [{ chave: "f", url: "https://exemplo.com/a.jpg", alt: "x", credito: "Fulano", licenca: "CC BY 4.0", fonte_url: "https://commons.wikimedia.org/wiki/File:A.jpg" }],
  }));
  assert.equal(r.isError, true);
  assert.match(textoDe(r), /Foto "f" recusada/);
  nada(banco);
});

test("aceita thumb.wikimedia.org e upload.wikimedia.org só com https", () => {
  assert.equal(urlDeFotoValida("https://upload.wikimedia.org/wikipedia/commons/a/a1/X.jpg"), true);
  assert.equal(urlDeFotoValida("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/X.jpg/800px-X.jpg"), true);
  assert.equal(urlDeFotoValida("http://upload.wikimedia.org/a.jpg"), false);
  assert.equal(urlDeFotoValida("https://upload.wikimedia.org.exemplo.com/a.jpg"), false);
  assert.equal(urlDeFotoValida("https://user@upload.wikimedia.org/a.jpg"), false);
  assert.equal(urlDeFotoValida("nao é url"), false);
});

test("recusa regravar material publicado ou em conferência", async () => {
  for (const situacao of ["publicado", "em_conferencia"]) {
    const banco = comMaterial(situacao, 1, situacao);
    const { chamar } = await montar(banco);
    const r = await chamar("salvar_material_estudo", entrada());
    assert.equal(r.isError, true, situacao);
    assert.match(textoDe(r), /não pode ser regravado/);
    assert.equal(exercicios(banco)[0].enunciado, "E1");
  }
});

test("regravar um retido volta a rascunho, mantém checagens e troca os exercícios", async () => {
  const banco = comMaterial("retido", 1, "retido");
  const { chamar } = await montar(banco);
  const r = await chamar("salvar_material_estudo", entrada());
  assert.notEqual(r.isError, true, textoDe(r));
  assert.equal(materiais(banco).length, 1);
  assert.equal(materiais(banco)[0].situacao, "rascunho");
  assert.equal(materiais(banco)[0].checagens, 1);
  assert.equal(exercicios(banco).length, 10);
  assert.ok(exercicios(banco).every((e) => e.situacao === "rascunho" && e.checagens === 1 && e.material_id === MAT));
  assert.equal(exercicios(banco)[0].enunciado, "Enunciado 1");
});

test("depois da segunda divergência, recusa regravar e corrigir", async () => {
  const banco = comMaterial("retido", 2, "retido");
  const { chamar } = await montar(banco);
  const r = await chamar("salvar_material_estudo", entrada());
  assert.equal(r.isError, true);
  const c = await chamar("corrigir_exercicio_estudo", {
    material: MAT, ordem: 1, enunciado: "Novo", alternativas: alternativas(), resposta_correta: "C", comentario: "c",
  });
  assert.equal(c.isError, true);
  assert.equal(exercicios(banco)[0].enunciado, "E1");
});

test("às cegas não devolve gabarito nem comentário", async () => {
  const banco = comMaterial("rascunho", 0);
  const { chamar } = await montar(banco);
  const cego = textoDe(await chamar("ler_material_estudo", { assunto: "Funções", materia: "Matemática", as_cegas: true }));
  assert.ok(!cego.includes("resposta_correta"));
  assert.ok(!cego.includes(COMENTARIO));
  assert.ok(cego.includes("E1"));
  const cheio = textoDe(await chamar("ler_material_estudo", { assunto: "Funções", materia: "Matemática" }));
  assert.ok(cheio.includes("resposta_correta"));
  assert.ok(cheio.includes(COMENTARIO));
});

test("checagem aprovada publica e marca a amostra", async () => {
  const banco = comMaterial("rascunho", 0);
  const { chamar } = await montar(banco);
  const r = await chamar("registrar_checagem_estudo", { material: MAT, verificador: "Sessão B", texto: { ok: true }, exercicios: parecerOk() });
  assert.notEqual(r.isError, true, textoDe(r));
  const m = materiais(banco)[0];
  assert.equal(m.situacao, "publicado");
  assert.equal(m.checagens, 1);
  const { ehAmostra } = await import("@/lib/estudos/situacao");
  assert.equal(m.amostra, ehAmostra(A1));
  assert.ok(m.checado_em);
  assert.ok(exercicios(banco).every((e) => e.situacao === "publicado" && e.checagens === 1));
});

test("checagem com divergência retém os exercícios e o material sem 5 aprovados", async () => {
  const banco = comMaterial("rascunho", 0);
  const { chamar } = await montar(banco);
  const parecer = parecerOk().map((p) => (p.ordem <= 6 ? { ...p, resposta_encontrada: "C" as const } : p));
  const r = await chamar("registrar_checagem_estudo", { material: MAT, verificador: "B", texto: { ok: true }, exercicios: parecer });
  assert.notEqual(r.isError, true, textoDe(r));
  assert.equal(materiais(banco)[0].situacao, "retido");
  assert.equal(exercicios(banco).filter((e) => e.situacao === "retido").length, 6);
});

test("corrigir volta o exercício retido a rascunho e mantém checagens", async () => {
  const banco = comMaterial("retido", 1, "retido");
  banco.tabelas.respostas_fixacao.push({ conta_id: uid(7), exercicio_id: uid(400), marcada: "A", acertou: false });
  const { chamar } = await montar(banco);
  const r = await chamar("corrigir_exercicio_estudo", {
    material: MAT, ordem: 1, enunciado: "Novo enunciado", alternativas: alternativas(), resposta_correta: "C", comentario: "Novo comentário",
  });
  assert.notEqual(r.isError, true, textoDe(r));
  const e = exercicios(banco)[0];
  assert.equal(e.situacao, "rascunho");
  assert.equal(e.checagens, 1);
  assert.equal(e.enunciado, "Novo enunciado");
  assert.equal(e.resposta_correta, "C");
  assert.equal(banco.tabelas.respostas_fixacao.length, 0);
});

test("material retido com 2 checagens recusa nova checagem mesmo com exercícios em rascunho", async () => {
  const banco = comMaterial("retido", 2, "rascunho");
  const { chamar } = await montar(banco);
  const r = await chamar("registrar_checagem_estudo", { material: MAT, verificador: "C", texto: { ok: true }, exercicios: parecerOk() });
  assert.equal(r.isError, true);
  assert.match(textoDe(r), /já teve duas checagens/);
  assert.equal(materiais(banco)[0].situacao, "retido");
});

test("material retido por texto reprovado só volta a ser checado depois de regravar", async () => {
  const banco = comMaterial("retido", 1, "rascunho");
  materiais(banco)[0].checagem = [{ em: "2026-11-03T00:00:00Z", verificador: "B", texto: { ok: false, problema: "data" }, exercicios: [] }];
  const { chamar } = await montar(banco);
  const r = await chamar("registrar_checagem_estudo", { material: MAT, verificador: "C", texto: { ok: true }, exercicios: parecerOk() });
  assert.equal(r.isError, true);
  assert.match(textoDe(r), /regrave o material/);
  const g = await chamar("salvar_material_estudo", entrada());
  assert.notEqual(g.isError, true, textoDe(g));
  assert.equal(materiais(banco)[0].checagem, null);
  const r2 = await chamar("registrar_checagem_estudo", { material: MAT, verificador: "C", texto: { ok: true }, exercicios: parecerOk() });
  assert.notEqual(r2.isError, true, textoDe(r2));
});

test("material retido sem exercício em rascunho: nada mudou", async () => {
  const banco = comMaterial("retido", 1, "retido");
  const { chamar } = await montar(banco);
  const r = await chamar("registrar_checagem_estudo", { material: MAT, verificador: "C", texto: { ok: true }, exercicios: [] });
  assert.equal(r.isError, true);
  assert.match(textoDe(r), /Nada mudou/);
});

test("não corrige exercício retido(1) de material retido(2)", async () => {
  const banco = comMaterial("retido", 2, "retido");
  exercicios(banco).forEach((e) => { e.checagens = 1; });
  const { chamar } = await montar(banco);
  const c = await chamar("corrigir_exercicio_estudo", {
    material: MAT, ordem: 1, enunciado: "Novo", alternativas: alternativas(), resposta_correta: "C", comentario: "c",
  });
  assert.equal(c.isError, true);
  assert.equal(exercicios(banco)[0].enunciado, "E1");
});

test("o histórico de pareceres guarda um item por chamada, inclusive em material publicado", async () => {
  const banco = comMaterial("rascunho", 0);
  const { chamar } = await montar(banco);
  const ruim = parecerOk().map((p) => (p.ordem <= 6 ? { ...p, resposta_encontrada: "C" as const } : p));
  await chamar("registrar_checagem_estudo", { material: MAT, verificador: "B", texto: { ok: true }, exercicios: ruim });
  const lista1 = materiais(banco)[0].checagem as { verificador: string; em: string; texto: unknown; exercicios: unknown[] }[];
  assert.equal(lista1.length, 1);
  assert.equal(lista1[0].verificador, "B");
  assert.ok(lista1[0].em);
  // corrige os 6 retidos e reconfere
  for (const n of [1, 2, 3, 4, 5, 6]) {
    await chamar("corrigir_exercicio_estudo", { material: MAT, ordem: n, enunciado: "N", alternativas: alternativas(), resposta_correta: "B", comentario: "c" });
  }
  const p2 = [1, 2, 3, 4, 5, 6].map((ordem) => ({ ordem, ok: true, resposta_encontrada: "B" as const }));
  const r = await chamar("registrar_checagem_estudo", { material: MAT, verificador: "C", texto: { ok: true }, exercicios: p2 });
  assert.notEqual(r.isError, true, textoDe(r));
  assert.equal(materiais(banco)[0].situacao, "publicado");
  const lista2 = materiais(banco)[0].checagem as { verificador: string }[];
  assert.deepEqual(lista2.map((x) => x.verificador), ["B", "C"]);
  // publicado: reconferência acrescenta, sem mudar a situação
  exercicios(banco)[0].situacao = "rascunho";
  const r3 = await chamar("registrar_checagem_estudo", { material: MAT, verificador: "D", texto: null, exercicios: [{ ordem: 1, ok: true, resposta_encontrada: "B" }] });
  assert.notEqual(r3.isError, true, textoDe(r3));
  const lista3 = materiais(banco)[0].checagem as { verificador: string }[];
  assert.deepEqual(lista3.map((x) => x.verificador), ["B", "C", "D"]);
  assert.equal(materiais(banco)[0].situacao, "publicado");
});

test("avisos_estudo lista retidos, avisos abertos e fotos pendentes com o assunto", async () => {
  const banco = comMaterial("retido", 1, "retido");
  materiais(banco)[0].motivo = "Texto reprovado";
  banco.tabelas.relatos_erro.push({ material_id: MAT, exercicio_id: null, mensagem: "erro na data", situacao: "aberto" });
  banco.tabelas.imagens_estudo.push({ id: uid(9), material_id: MAT, tipo: "foto", alt: "Retrato", credito: "Autor", aprovada_em: null });
  const { chamar } = await montar(banco);
  const t = textoDe(await chamar("avisos_estudo", {}));
  assert.match(t, /AVISOS DE ERRO ABERTOS \(1\)[\s\S]*Funções · texto \(1 aviso\)/);
  assert.ok(!t.includes("erro na data"), "o texto livre do aluno não sai pelo MCP");
  assert.match(t, /painel/);
  assert.match(t, /MATERIAIS RETIDOS[\s\S]*Funções[\s\S]*Texto reprovado/);
  assert.match(t, /FOTOS SEM APROVAÇÃO[\s\S]*Funções — Retrato/);
});

test("avisos_estudo mostra exercício em rascunho de material publicado e em conferência sem aviso", async () => {
  const banco = comMaterial("publicado", 1, "publicado");
  exercicios(banco)[0].situacao = "rascunho";
  exercicios(banco)[1].situacao = "em_conferencia";
  exercicios(banco)[2].situacao = "em_conferencia";
  banco.tabelas.relatos_erro.push({ material_id: MAT, exercicio_id: exercicios(banco)[2].id, mensagem: "x", situacao: "aberto" });
  const { chamar } = await montar(banco);
  const t = textoDe(await chamar("avisos_estudo", {}));
  assert.match(t, /EM RASCUNHO[\s\S]*Funções · exercício 1/);
  assert.match(t, /EM CONFERÊNCIA SEM AVISO[\s\S]*Funções · exercício 2/);
  assert.ok(!/EM CONFERÊNCIA SEM AVISO[\s\S]*exercício 3/.test(t));
});

test("assuntos_para_estudo mostra questões publicadas e a situação do material", async () => {
  const banco = comMaterial("retido", 1);
  const { chamar } = await montar(banco);
  const t = textoDe(await chamar("assuntos_para_estudo", { materia: "Matemática" }));
  assert.match(t, /Funções — 1 questões publicadas — retido/);
  assert.match(t, /Geometria — 0 questões publicadas — sem material/);
});

// ---------- corrigir só o texto ----------

const blocosNovos = [{ tipo: "paragrafo", texto: "Texto corrigido." }];
/** Os dois últimos pareceres reprovaram o texto (exercícios já aprovados). */
function reprovadoNoTexto(banco: Banco, vezes = 2) {
  materiais(banco)[0].checagem = Array.from({ length: vezes }, (_, n) => ({
    em: `2026-11-0${n + 3}T00:00:00Z`, verificador: `V${n}`, texto: { ok: false, problema: "um artigo" }, exercicios: [],
  }));
}

test("corrigir_texto_estudo troca só o texto do retido duas vezes; a checagem do texto publica", async () => {
  const banco = comMaterial("retido", 2, "publicado");
  reprovadoNoTexto(banco);
  const { chamar } = await montar(banco);
  const r = await chamar("corrigir_texto_estudo", { material: MAT, blocos: blocosNovos, fonte: "ia" });
  assert.notEqual(r.isError, true, textoDe(r));
  const m = materiais(banco)[0];
  assert.equal(m.situacao, "rascunho");
  assert.equal(m.motivo, null);
  assert.equal(m.checagens, 2);
  assert.deepEqual(m.blocos, blocosNovos);
  assert.equal((m.checagem as unknown[]).length, 2, "o histórico de pareceres fica");
  assert.ok(exercicios(banco).every((e) => e.situacao === "publicado" && e.enunciado === `E${e.ordem}`), "exercícios intactos");

  const s = await chamar("salvar_material_estudo", entrada());
  assert.equal(s.isError, true, "texto corrigido não se regrava inteiro");

  const c = await chamar("registrar_checagem_estudo", { material: MAT, verificador: "V2", texto: { ok: true }, exercicios: [] });
  assert.notEqual(c.isError, true, textoDe(c));
  assert.equal(materiais(banco)[0].situacao, "publicado");
  assert.equal(materiais(banco)[0].checagens, 3);
});

test("corrigir_texto_estudo aceita desenho do próprio material e recusa imagem de fora", async () => {
  const banco = comMaterial("retido", 2, "publicado");
  reprovadoNoTexto(banco);
  banco.tabelas.imagens_estudo.push({ id: uid(9), material_id: MAT, tipo: "desenho", svg: SVG, alt: "x" });
  const { chamar } = await montar(banco);
  const fora = await chamar("corrigir_texto_estudo", { material: MAT, blocos: [...blocosNovos, { tipo: "imagem", imagem_id: uid(99) }], fonte: "ia" });
  assert.equal(fora.isError, true);
  assert.equal(materiais(banco)[0].situacao, "retido");
  const dentro = await chamar("corrigir_texto_estudo", { material: MAT, blocos: [...blocosNovos, { tipo: "imagem", imagem_id: uid(9) }], fonte: "ia" });
  assert.notEqual(dentro.isError, true, textoDe(dentro));
  assert.equal(banco.tabelas.imagens_estudo.length, 1, "o desenho continua");
});

test("corrigir_texto_estudo recusa retido por exercícios, publicado, rascunho e quem esgotou a rodada extra", async () => {
  const casos: [string, Banco][] = [];
  const porExercicios = comMaterial("retido", 2, "retido");
  materiais(porExercicios)[0].checagem = [{ em: "x", verificador: "B", texto: { ok: true }, exercicios: [] }];
  casos.push(["retido por exercícios", porExercicios]);
  const publicado = comMaterial("publicado", 1, "publicado");
  reprovadoNoTexto(publicado, 1);
  casos.push(["publicado", publicado]);
  casos.push(["rascunho", comMaterial("rascunho", 0)]);
  const tres = comMaterial("retido", 3, "publicado");
  reprovadoNoTexto(tres, 3);
  casos.push(["três checagens", tres]);
  for (const [nome, banco] of casos) {
    const { chamar } = await montar(banco);
    const antes = JSON.stringify(materiais(banco)[0].blocos);
    const r = await chamar("corrigir_texto_estudo", { material: MAT, blocos: blocosNovos, fonte: "ia" });
    assert.equal(r.isError, true, nome);
    assert.equal(JSON.stringify(materiais(banco)[0].blocos), antes, nome);
  }
});

test("corrigir_texto_estudo confere a fonte como o salvar", async () => {
  const banco = comMaterial("retido", 2, "publicado");
  reprovadoNoTexto(banco);
  const { chamar } = await montar(banco);
  const r = await chamar("corrigir_texto_estudo", { material: MAT, blocos: blocosNovos, fonte: "wikipedia", fonte_url: "https://exemplo.com/x" });
  assert.equal(r.isError, true);
  assert.match(textoDe(r), /pt\.wikipedia\.org/);
});
