import { test } from "node:test";
import assert from "node:assert/strict";
import { executarRegistrado, type GravadorRegistro } from "@/lib/hermes/registro";
import {
  escolherConta, escolherPorNome, escolherTentativa, escolherTurma, escolherVinculo, exigirAluno, parametrosParaRegistro, textoCredenciais, textoPreviaLigacoes,
  textoPreviaPlanilha, validarUsuario, type ContaAchada,
} from "./contas-regras";

const conta = (id: string, nome: string, turmas: string[], escolaNome = "Colégio Status"): ContaAchada => ({
  id, nome, escolaId: escolaNome === "Colégio Status" ? "e1" : "e2", escolaNome, usuario: nome.toLowerCase().replace(/\s+/g, "."), email: null, ativo: true, turmas,
});

// ---------- textos de resposta ----------

test("textoCredenciais: lista nome, usuário e senha de cada conta, sem 'undefined'", () => {
  const t = textoCredenciais([
    { nome: "Ana Souza", usuario: "ana.souza", senha: "AB12CD34", turma: "1º Ano A · 2026" },
    { nome: "Bruno Lima", usuario: "bruno.lima", senha: "ZX98YW76", turma: "1º Ano A · 2026" },
  ]);
  assert.match(t, /2 contas criadas na turma 1º Ano A · 2026/);
  assert.match(t, /- Ana Souza — usuário ana\.souza · senha AB12CD34/);
  assert.match(t, /- Bruno Lima — usuário bruno\.lima · senha ZX98YW76/);
  assert.doesNotMatch(t, /undefined|null/);
});

test("textoCredenciais: uma conta no singular; nenhuma conta avisa", () => {
  assert.match(textoCredenciais([{ nome: "Ana", usuario: "ana", senha: "X1", turma: "1A · 2026" }]), /^1 conta criada na turma 1A · 2026/);
  assert.equal(textoCredenciais([]), "Nenhuma conta foi criada.");
});

test("textoCredenciais: ignorados aparecem sem 'undefined'", () => {
  const t = textoCredenciais([], ["Carla Dias"]);
  assert.match(t, /Nenhuma conta foi criada\./);
  assert.match(t, /Já tinham conta ligada \(ignorados\): Carla Dias\./);
  assert.doesNotMatch(t, /undefined/);
});

test("textoPreviaPlanilha: lista quem receberia conta e separa os nomes que já têm conta sem ligação", () => {
  const t = textoPreviaPlanilha("1A · 2026", [
    { nome: "Ana Souza", usuario: "ana.souza", alunoId: "a1", possivelContaExistente: false },
    { nome: "Bruno Lima", usuario: "bruno.lima", alunoId: "a2", possivelContaExistente: true },
  ]);
  assert.match(t, /1 aluno da planilha de 1A · 2026 receberia conta/);
  assert.match(t, /- Ana Souza \(usuário ana\.souza\)/);
  assert.match(t, /Ficam de fora[^\n]*Bruno Lima[^\n]*ligar_contas_pelo_nome/);
  assert.match(textoPreviaPlanilha("1A · 2026", []), /Todos os alunos da planilha de 1A · 2026 já têm conta ligada\./);
});

test("textoPreviaLigacoes: pares a ligar e 'nome repetido: ligue à mão'", () => {
  const t = textoPreviaLigacoes("1A · 2026", {
    ligar: [{ contaId: "c1", alunoId: "a1", nomeConta: "Ana Souza", nomeAluno: "ANA SOUZA" }],
    repetidos: [{ nome: "joao silva", contas: 1, alunos: 2 }],
    semPar: ["Zeca"],
  }, false);
  assert.match(t, /- Ana Souza → ANA SOUZA/);
  assert.match(t, /joao silva \(1 conta, 2 alunos\): nome repetido: ligue à mão/);
  assert.match(t, /Sem par na planilha: Zeca/);
  assert.match(t, /aplicar: true/);
});

// ---------- escolha do aluno ----------

test("escolherConta: nome repetido → lista para escolher (com turma e conta_id), sem escolher ninguém", () => {
  const r = escolherConta([conta("c1", "Ana Souza", ["1A · 2026"]), conta("c2", "Ana Souza", ["2B · 2026"])], "ana souza", false);
  assert.ok("mensagem" in r);
  assert.match(r.mensagem, /Achei 2 alunos com "ana souza"\. Qual deles\?/);
  assert.match(r.mensagem, /- Ana Souza \(1A · 2026\) · usuário ana\.souza · conta_id c1/);
  assert.match(r.mensagem, /- Ana Souza \(2B · 2026\) · usuário ana\.souza · conta_id c2/);
  assert.match(r.mensagem, /Nada foi feito/);
});

test("escolherConta: várias escolas → mostra a escola de cada um", () => {
  const r = escolherConta([conta("c1", "Ana", [], "Colégio Status"), conta("c2", "Ana", ["3C · 2026"], "Escola Teste")], "ana", true);
  assert.ok("mensagem" in r);
  assert.match(r.mensagem, /\[Colégio Status\] Ana \(sem turma\)/);
  assert.match(r.mensagem, /\[Escola Teste\] Ana \(3C · 2026\)/);
});

test("escolherConta: nome exato único → a conta; pelo conta_id → a conta; nenhum → erro", () => {
  const r = escolherConta([conta("c1", "Ana Souza", ["1A · 2026"])], "ana  souza", false);
  assert.ok("conta" in r && r.conta.id === "c1");
  const porId = escolherConta([conta("c1", "Ana Souza", ["1A · 2026"])], "c1", false, true);
  assert.ok("conta" in porId && porId.conta.id === "c1");
  assert.throws(() => escolherConta([], "Fulano", false), /Aluno "Fulano" não encontrado\./);
});

test("escolherConta: parcial único ('Ana' → só 'Mariana Silva') → pergunta, não age", () => {
  const r = escolherConta([conta("c9", "Mariana Silva", ["1A · 2026"])], "Ana", false);
  assert.ok("mensagem" in r);
  assert.match(r.mensagem, /Achei só Mariana Silva \(1A · 2026\) para "Ana"\. É esse aluno\? Nada foi feito; repita com o conta_id c9\./);
});

test("exigirAluno: precisa do nome ou do conta_id", () => {
  assert.throws(() => exigirAluno({}), /Informe o aluno \(nome\) ou o conta_id\./);
  assert.throws(() => exigirAluno({ aluno: "   " }), /Informe o aluno/);
  assert.doesNotThrow(() => exigirAluno({ conta_id: "c1" }));
});

// ---------- escolha da turma ----------

const escolas = [{ id: "e1", nome: "Colégio Status", slug: "status" }, { id: "e2", nome: "Escola Teste", slug: "teste" }];

test("escolherTurma: vale o ano letivo mais recente; com ano pedido, aquele", () => {
  const turmas = [
    { id: "t1", escola_id: "e1", nome: "1º Ano A", ano_letivo: "2025" },
    { id: "t2", escola_id: "e1", nome: "1º Ano A", ano_letivo: "2026" },
  ];
  assert.equal(escolherTurma(turmas, escolas, "1º ano a").id, "t2");
  assert.equal(escolherTurma(turmas, escolas, "1º ano a", "2025").id, "t1");
  assert.throws(() => escolherTurma(turmas, escolas, "1º ano a", "2024"), /não tem o ano letivo 2024/);
});

test("escolherTurma: mesmo nome em duas escolas → pede a escola", () => {
  const turmas = [
    { id: "t1", escola_id: "e1", nome: "1A", ano_letivo: "2026" },
    { id: "t2", escola_id: "e2", nome: "1A", ano_letivo: "2026" },
  ];
  assert.throws(() => escolherTurma(turmas, escolas, "1A"), /Mais de uma turma com "1A": 1A \[Colégio Status\], 1A \[Escola Teste\]\. Diga qual \(ou a escola\)\./);
  assert.throws(() => escolherTurma(turmas, escolas, "9Z"), /Turma "9Z" não encontrada\./);
});

test("escolherVinculo: sem turma, só vale se a conta estiver em uma; com turma, a do ano mais recente", () => {
  const v = (turma_nome: string, ano_letivo: string) => ({ escola_id: "e1", turma_nome, ano_letivo });
  assert.deepEqual(escolherVinculo([v("1A", "2026")]), v("1A", "2026"));
  assert.throws(() => escolherVinculo([]), /A conta não está em nenhuma turma/);
  assert.throws(() => escolherVinculo([v("1A", "2026"), v("2B", "2026")]), /Diga a turma: 1A · 2026, 2B · 2026\./);
  assert.deepEqual(escolherVinculo([v("1A", "2025"), v("1A", "2026"), v("2B", "2026")], "1a"), v("1A", "2026"));
  assert.throws(() => escolherVinculo([v("1A", "2026")], "3C"), /A conta não está na turma "3C"\. Turmas da conta: 1A · 2026\./);
});

test("escolherPorNome: exato → o item; parcial único ou vários → pergunta; nenhum → erro", () => {
  const cursos = [{ id: "c1", titulo: "Química Geral" }, { id: "c2", titulo: "Química Orgânica" }, { id: "c3", titulo: "Física" }];
  const exato = escolherPorNome(cursos, (c) => c.titulo, "física", "Curso", "o");
  assert.ok("item" in exato && exato.item.id === "c3");
  const varios = escolherPorNome(cursos, (c) => c.titulo, "química", "Curso", "o");
  assert.ok("mensagem" in varios);
  assert.match(varios.mensagem, /Mais de um curso com "química": Química Geral, Química Orgânica\. Nada foi feito; diga qual\./);
  const parcial = escolherPorNome(cursos, (c) => c.titulo, "orgânica", "Curso", "o");
  assert.ok("mensagem" in parcial);
  assert.match(parcial.mensagem, /Achei só o curso "Química Orgânica" para "orgânica"\. É esse\? Nada foi feito; repita com o título completo\./);
  const aula = escolherPorNome([{ titulo: "Aula 1 — Átomos" }], (a) => a.titulo, "átomos", "Aula", "a");
  assert.ok("mensagem" in aula && /Achei só a aula "Aula 1 — Átomos"/.test(aula.mensagem));
  assert.throws(() => escolherPorNome(cursos, (c) => c.titulo, "Biologia", "Aula", "a"), /Aula "Biologia" não encontrada\./);
});

// ---------- escolha da tentativa ----------

const S1 = "11111111-1111-1111-1111-111111111111";
const S2 = "22222222-2222-2222-2222-222222222222";
const S3 = "33333333-3333-3333-3333-333333333333";

test("escolherTentativa: dois treinos com o mesmo título → lista para escolher, não age", () => {
  const lista = [
    { id: "x1", simuladoId: S1, titulo: "Treino de 01/10/2026", status: "entregue", iniciadaEm: "2026-10-01T12:00:00Z" },
    { id: "x2", simuladoId: S2, titulo: "Treino de 01/10/2026", status: "entregue", iniciadaEm: "2026-10-01T15:00:00Z" },
  ];
  const r = escolherTentativa(lista, { simulado: "treino de 01/10/2026" });
  assert.ok("mensagem" in r);
  assert.match(r.mensagem, /Qual simulado\? Achei 2/);
  assert.match(r.mensagem, new RegExp(`Treino de 01/10/2026 · entregue · iniciada em .* · simulado_id ${S1}`));
  assert.match(r.mensagem, new RegExp(`simulado_id ${S2}`));
  assert.match(r.mensagem, /Nada foi feito; repita com o simulado_id\./);
  // com o simulado_id, escolhe
  const porId = escolherTentativa(lista, { simuladoId: S1 });
  assert.ok("tentativa" in porId && porId.tentativa.id === "x1");
});

test("escolherTentativa: o status filtra — encerrar só vê em andamento, recorrigir só entregue", () => {
  const lista = [
    { id: "x1", simuladoId: S1, titulo: "Simulado ENEM", status: "entregue", iniciadaEm: "2026-09-01T12:00:00Z" },
    { id: "x2", simuladoId: S2, titulo: "Simulado ENEM", status: "em_andamento", iniciadaEm: "2026-10-01T12:00:00Z" },
  ];
  const encerrar = escolherTentativa(lista, { simulado: "Simulado ENEM", status: "em_andamento" });
  assert.ok("tentativa" in encerrar && encerrar.tentativa.id === "x2");
  const recorrigir = escolherTentativa(lista, { simulado: "Simulado ENEM", status: "entregue" });
  assert.ok("tentativa" in recorrigir && recorrigir.tentativa.id === "x1");
  // liberar aceita qualquer status → as duas → lista
  assert.ok("mensagem" in escolherTentativa(lista, { simulado: "Simulado ENEM" }));
  // nenhuma no status pedido
  assert.throws(() => escolherTentativa([lista[0]], { simulado: "Simulado ENEM", status: "em_andamento" }), /O aluno não tem tentativa em andamento no simulado "Simulado ENEM"\./);
});

test("escolherTentativa: título parcial com um só resultado → pergunta, não age; exato → age", () => {
  const lista = [{ id: "x1", simuladoId: S1, titulo: "Simulado ENEM 1º dia", status: "entregue", iniciadaEm: "2026-09-01T12:00:00Z" }];
  const parcial = escolherTentativa(lista, { simulado: "enem" });
  assert.ok("mensagem" in parcial);
  assert.match(parcial.mensagem, /Achei só "Simulado ENEM 1º dia" para "enem"/);
  assert.match(parcial.mensagem, new RegExp(`Nada foi feito; repita com o título completo ou o simulado_id ${S1}\\.`));
  const exato = escolherTentativa(lista, { simulado: "simulado enem 1º dia" });
  assert.ok("tentativa" in exato && exato.tentativa.id === "x1");
});

test("escolherTentativa: nenhum → erro; precisa do título ou do id", () => {
  const lista = [{ id: "x1", simuladoId: S1, titulo: "Simulado 1", status: "entregue", iniciadaEm: "2026-09-01T12:00:00Z" }];
  assert.throws(() => escolherTentativa(lista, { simulado: "Química" }), /O aluno não tem tentativa no simulado "Química"\./);
  assert.throws(() => escolherTentativa(lista, { simuladoId: S3 }), /O aluno não tem tentativa nesse simulado\./);
  assert.throws(() => escolherTentativa(lista, {}), /Informe o simulado \(título\) ou o simulado_id\./);
});

// ---------- usuário ----------

test("validarUsuario: minúsculas, números e ponto", () => {
  assert.equal(validarUsuario("  Ana.Souza2 "), "ana.souza2");
  for (const ruim of ["", "   ", "ana souza", "ána", "ana_souza", "ana@x"]) {
    assert.throws(() => validarUsuario(ruim), /Usuário inválido: use só letras minúsculas, números e ponto\./, ruim);
  }
  assert.throws(() => validarUsuario("a".repeat(61)), /no máximo 60/);
});

// ---------- registro sem senha (item 4 da Review Focus) ----------

test("parametrosParaRegistro: tira telefone e qualquer chave de senha/token", () => {
  const p = parametrosParaRegistro({ aluno: "Ana", professor_telefone: "+5567999990000", senha: "AB12CD34", nova_senha: "X", token: "t", escola: "Status" });
  assert.deepEqual(p, { aluno: "Ana", escola: "Status" });
});

test("ferramentas de senha: registro (parâmetros e mensagem) nunca contém a senha gerada", async () => {
  const SENHA = "QW34ER56";
  const gravados: unknown[] = [];
  const g: GravadorRegistro = {
    async iniciar(linha) { gravados.push(linha); return "r1"; },
    async fechar(_id, campos) { gravados.push(campos); },
  };
  const ctx = { perfil: "dono" as const, professorId: "p1", escolaId: "e1" };
  const pedidos: [string, Record<string, unknown>][] = [
    ["criar_contas_aluno", { turma: "1A", nomes: ["Ana Souza", "Bruno Lima"], escola: "Status", professor_telefone: "+55" }],
    ["criar_contas_da_planilha", { turma: "1A", criar: true }],
    ["gerar_senha_provisoria", { aluno: "Ana Souza", conta_id: "c1" }],
  ];
  for (const [ferramenta, args] of pedidos) {
    const r = await executarRegistrado(ctx, ferramenta, parametrosParaRegistro(args), async () => ({ senha: SENHA, credenciais: [{ senha: SENHA }] }), g);
    assert.equal(r.senha, SENHA); // a senha volta só para a resposta
  }
  // erro do núcleo também não leva senha para a mensagem
  await assert.rejects(executarRegistrado(ctx, "gerar_senha_provisoria", parametrosParaRegistro({ conta_id: "c1" }), async () => { throw new Error("Conta não encontrada."); }, g));
  const tudo = JSON.stringify(gravados);
  assert.doesNotMatch(tudo, new RegExp(SENHA));
  assert.doesNotMatch(tudo, /senha"\s*:/);
  assert.doesNotMatch(tudo, /\+55/);
});
