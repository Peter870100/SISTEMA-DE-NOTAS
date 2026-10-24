import { normalizarBusca } from "@/lib/hermes/relatorios";
import { acharPorNome, limitarLinhas } from "@/lib/mcp/leitura/comum";
import { ehAdmin } from "@/lib/papeis";
import type { ProfessorRole } from "@/lib/types";

/**
 * Regras puras da gestão de professores (tela e Hermes): quem pode ser alterado, telefone, acesso a
 * turmas e escolha do professor pelo nome. Sem banco, para testar com `tsx --test`.
 */

export const ERRO_DONO_HERMES = "A conta do dono não pode ser alterada pela Hermes.";
const ERRO_DONO_TELA = "Apenas o dono pode alterar a conta do dono.";
const PAPEIS_DA_HERMES: ProfessorRole[] = ["admin", "professor"];

/**
 * Regra da Hermes: nunca mexe na conta do dono, e o papel `dono` não é dado nem tirado por ela.
 * Só aceita `admin` e `professor`. Devolve a mensagem de recusa, ou null.
 */
export function podeAlterarProfessor(alvoRole: ProfessorRole, novoPapel?: ProfessorRole): string | null {
  if (alvoRole === "dono" || novoPapel === "dono") return ERRO_DONO_HERMES;
  if (novoPapel !== undefined && !PAPEIS_DA_HERMES.includes(novoPapel)) return "Papel inválido: use admin ou professor.";
  return null;
}

/** Regra da tela (`exigirPoderSobreAlvo`): só o dono mexe em outra conta de dono. */
export function podeAlterarNaTela(atorRole: ProfessorRole, alvoRole: ProfessorRole): string | null {
  if (atorRole !== "dono" && alvoRole === "dono") return ERRO_DONO_TELA;
  return null;
}

const MAX_TELEFONE = 20; // professores.telefone é varchar(20)

/**
 * Telefone como a tela grava: aparado; vazio = sem telefone (null). Sem trocar o formato, porque o
 * escopo da Hermes procura o professor pelo telefone exatamente como foi gravado.
 */
export function normalizarTelefone(telefone: string): string | null {
  const limpo = telefone.trim();
  if (limpo.length > MAX_TELEFONE) throw new Error(`Telefone com no máximo ${MAX_TELEFONE} caracteres.`);
  return limpo || null;
}

/**
 * `acesso` + `turmas` da ferramenta → o que o núcleo grava. null = não mexer no acesso. Restrito
 * exige ao menos uma turma (para não tirar todo o acesso por engano); "todas" não leva lista.
 */
export function turmasDoAcesso(acesso: "todas" | "restrito" | undefined, turmas: string[] | undefined): { restrito: boolean; turmas: string[] } | null {
  const lista = [...new Set((turmas ?? []).map((t) => t.trim()).filter(Boolean))];
  if (acesso === undefined) {
    if (lista.length > 0) throw new Error('Para liberar turmas, use acesso: "restrito" com a lista de turmas.');
    return null;
  }
  if (acesso === "todas") {
    if (lista.length > 0) throw new Error("Com acesso a todas as turmas, não informe turmas.");
    return { restrito: false, turmas: [] };
  }
  if (lista.length === 0) throw new Error("Informe as turmas liberadas para o acesso restrito.");
  return { restrito: true, turmas: lista };
}

/** Acesso efetivo, em texto (admin e dono veem todas as turmas, mesmo com acesso restrito gravado). */
export function textoAcesso(role: ProfessorRole, restrito: boolean, turmas: string[]): string {
  if (ehAdmin(role)) return "todas as turmas (admin)";
  if (!restrito) return "todas as turmas";
  if (turmas.length === 0) return "nenhuma turma liberada";
  return `só ${[...turmas].sort((a, b) => a.localeCompare(b, "pt-BR")).join(", ")}`;
}

// ---------- escolha pelo nome ----------

export type ProfessorAchado = { id: string; nome: string; email: string; role: ProfessorRole; escolaId: string; escolaNome: string };

const igual = (nome: string, busca: string) => normalizarBusca(nome) === normalizarBusca(busca);
const rotulo = (p: ProfessorAchado, variasEscolas: boolean) => `${variasEscolas ? `[${p.escolaNome}] ` : ""}${p.nome} (${p.email} · ${p.role})`;

/**
 * Um professor entre os achados pelo nome (ou o do `professor_id`, com `porId`). Mesma regra da C1:
 * só age com um único professor de nome igual ao pedido; um só parecido ou vários → texto com as
 * opções e o professor_id para a Hermes perguntar (nada é feito). Nenhum → erro.
 */
export function escolherProfessor<T extends ProfessorAchado>(achados: T[], busca: string, variasEscolas: boolean, porId = false): { professor: T } | { mensagem: string } {
  if (achados.length === 0) throw new Error(`Professor "${busca}" não encontrado.`);
  if (achados.length > 1 && !porId) {
    const iguais = achados.filter((p) => igual(p.nome, busca));
    if (iguais.length === 1) return { professor: iguais[0] };
  }
  if (achados.length === 1) {
    const p = achados[0];
    if (porId || igual(p.nome, busca)) return { professor: p };
    return { mensagem: `Achei só ${rotulo(p, variasEscolas)} para "${busca}". É esse professor? Nada foi feito; repita com o professor_id ${p.id}.` };
  }
  const opcoes = achados.map((p) => `- ${rotulo(p, variasEscolas)} · professor_id ${p.id}`);
  return { mensagem: `Achei ${achados.length} professores com "${busca}". Qual deles? Nada foi feito; repita com o professor_id.\n${limitarLinhas(opcoes, 30, "Use o nome completo.").join("\n")}` };
}

/** Filtro por nome usado antes de `escolherProfessor` (igual primeiro; senão quem contém). */
export function acharProfessores<T extends { nome: string }>(lista: T[], busca: string): T[] {
  return acharPorNome(lista, (p) => p.nome, busca);
}
