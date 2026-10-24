import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ERRO_DONO_HERMES, escolherProfessor, normalizarTelefone, podeAlterarNaTela, podeAlterarProfessor, textoAcesso, turmasDoAcesso,
  type ProfessorAchado,
} from "./regras";
import { parametrosParaRegistro } from "@/lib/mcp/acoes/contas-regras";

// ---------- não mexer no dono ----------

test("podeAlterarProfessor: alvo dono → recusa, com ou sem papel novo", () => {
  assert.equal(podeAlterarProfessor("dono"), ERRO_DONO_HERMES);
  assert.equal(podeAlterarProfessor("dono", "professor"), ERRO_DONO_HERMES);
  assert.equal(ERRO_DONO_HERMES, "A conta do dono não pode ser alterada pela Hermes.");
});

test("podeAlterarProfessor: tornar alguém dono → recusa", () => {
  assert.equal(podeAlterarProfessor("admin", "dono"), ERRO_DONO_HERMES);
  assert.equal(podeAlterarProfessor("professor", "dono"), ERRO_DONO_HERMES);
});

test("podeAlterarProfessor: admin ↔ professor e sem papel → ok", () => {
  assert.equal(podeAlterarProfessor("admin", "professor"), null);
  assert.equal(podeAlterarProfessor("professor", "admin"), null);
  assert.equal(podeAlterarProfessor("professor"), null);
  assert.equal(podeAlterarProfessor("admin", "admin"), null);
});

test("podeAlterarProfessor: papel desconhecido → recusa", () => {
  assert.match(podeAlterarProfessor("professor", "chefe" as never) ?? "", /Papel inválido/);
});

test("podeAlterarNaTela: só o dono mexe na conta do dono (regra da tela)", () => {
  assert.equal(podeAlterarNaTela("admin", "dono"), "Apenas o dono pode alterar a conta do dono.");
  assert.equal(podeAlterarNaTela("dono", "dono"), null);
  assert.equal(podeAlterarNaTela("admin", "professor"), null);
});

// ---------- telefone ----------

test("normalizarTelefone: igual à tela (apara; vazio = sem telefone)", () => {
  assert.equal(normalizarTelefone("  5567999998888 "), "5567999998888");
  assert.equal(normalizarTelefone("(67) 99999-8888"), "(67) 99999-8888");
  assert.equal(normalizarTelefone("   "), null);
  assert.equal(normalizarTelefone(""), null);
});

test("normalizarTelefone: mais de 20 caracteres → erro claro", () => {
  assert.throws(() => normalizarTelefone("1".repeat(21)), /no máximo 20/);
  assert.equal(normalizarTelefone("1".repeat(20)), "1".repeat(20));
});

// ---------- acesso ----------

test("turmasDoAcesso: todas → sem lista; restrito exige turmas; todas com turmas → erro", () => {
  assert.deepEqual(turmasDoAcesso("todas", undefined), { restrito: false, turmas: [] });
  assert.deepEqual(turmasDoAcesso("restrito", ["1A", "1B", "1A"]), { restrito: true, turmas: ["1A", "1B"] });
  assert.throws(() => turmasDoAcesso("restrito", []), /Informe as turmas/);
  assert.throws(() => turmasDoAcesso("restrito", undefined), /Informe as turmas/);
  assert.throws(() => turmasDoAcesso("todas", ["1A"]), /não informe turmas/);
  assert.equal(turmasDoAcesso(undefined, undefined), null);
  assert.throws(() => turmasDoAcesso(undefined, ["1A"]), /acesso: "restrito"/);
});

test("textoAcesso: admin vê todas; restrito lista as turmas", () => {
  assert.equal(textoAcesso("admin", true, ["1A"]), "todas as turmas (admin)");
  assert.equal(textoAcesso("professor", false, []), "todas as turmas");
  assert.equal(textoAcesso("professor", true, ["1B", "1A"]), "só 1A, 1B");
  assert.equal(textoAcesso("professor", true, []), "nenhuma turma liberada");
});

// ---------- escolha pelo nome ----------

const prof = (id: string, nome: string, escolaNome = "Colégio Status"): ProfessorAchado => ({
  id, nome, email: `${id}@x.com`, role: "professor", escolaId: "e1", escolaNome,
});

test("escolherProfessor: nome igual → age; só parecido → pergunta; vários → lista", () => {
  assert.deepEqual(escolherProfessor([prof("p1", "Maria Lima")], "maria lima", false), { professor: prof("p1", "Maria Lima") });
  const parcial = escolherProfessor([prof("p1", "Maria Lima")], "Maria", false);
  assert.ok("mensagem" in parcial && /Nada foi feito/.test(parcial.mensagem) && parcial.mensagem.includes("p1"));
  const varios = escolherProfessor([prof("p1", "Maria Lima"), prof("p2", "Maria Souza", "HARMONIA")], "Maria", true);
  assert.ok("mensagem" in varios && varios.mensagem.includes("p2") && varios.mensagem.includes("[HARMONIA]"));
  assert.deepEqual(escolherProfessor([prof("p1", "Ana"), prof("p2", "Ana Paula")], "Ana", false), { professor: prof("p1", "Ana") });
  assert.throws(() => escolherProfessor([], "Zé", false), /não encontrado/);
});

test("escolherProfessor: dois com o mesmo nome → lista, mesmo sendo iguais", () => {
  const r = escolherProfessor([prof("p1", "Ana"), prof("p2", "Ana")], "Ana", false);
  assert.ok("mensagem" in r && r.mensagem.includes("p1") && r.mensagem.includes("p2"));
});

test("registro de telefone_professor e senha_provisoria_professor: sem telefone nem senha", () => {
  const p = parametrosParaRegistro({ professor: "Maria Lima", telefone: "5567999998888", professor_telefone: "6799", senha: "x", escola: "HARMONIA" });
  assert.deepEqual(p, { professor: "Maria Lima", escola: "HARMONIA" });
});

test("escolherProfessor: pelo id → age mesmo com nome diferente", () => {
  assert.deepEqual(escolherProfessor([prof("p1", "Maria Lima")], "p1", false, true), { professor: prof("p1", "Maria Lima") });
});
