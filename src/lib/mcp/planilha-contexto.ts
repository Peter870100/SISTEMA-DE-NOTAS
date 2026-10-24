import type { SupabaseClient } from "@supabase/supabase-js";
import { ESCOLA_PADRAO_ID } from "@/lib/escola-padrao";
import type { ProfessorRole } from "@/lib/types";
import { contaDoDono } from "./acoes/ator";
import { escopoDoTelefone, type Escopo } from "./escopo";
import { filtrarEscolas, type EscolaInfo } from "./leitura/comum";

/**
 * Em que escola as ferramentas antigas da planilha (listar_turmas, lancar_nota, …) agem, e com quem.
 * - dono: a escola do parâmetro `escola` (mais de uma escola e nenhuma escolhida → pergunta);
 * - professor com telefone: a escola e as turmas do telefone (`escopoDoTelefone`);
 * - professor sem telefone: Colégio Status e todas as turmas, exatamente como antes da etapa C2.
 */
export type ContextoPlanilha = {
  escolaId: string;
  /** Nomes de turma liberados (null = todas as turmas da escola). */
  turmas: Set<string> | null;
  /** Quem grava nota/lixeira (atualizado_por, histórico, p_ator); null = pedido sem telefone, como hoje. */
  ator: { id: string; role: ProfessorRole } | null;
  registro: { perfil: "dono" | "professor"; professorId: string | null };
};

export type ArgsContextoPlanilha = { escola?: string; professor_telefone?: string };

/** O que o contexto lê do banco (injetável para testar sem banco). */
export type DepsContextoPlanilha = {
  escopoDoTelefone(telefone: string): Promise<Escopo>;
  listarEscolas(): Promise<EscolaInfo[]>;
  contaDoDono(): Promise<{ id: string }>;
};

export async function contextoPlanilha(
  perfil: "dono" | "professor",
  args: ArgsContextoPlanilha,
  deps: DepsContextoPlanilha,
): Promise<ContextoPlanilha | { pergunta: string }> {
  if (perfil === "professor") {
    const telefone = args.professor_telefone;
    if (!telefone?.trim()) {
      return { escolaId: ESCOLA_PADRAO_ID, turmas: null, ator: null, registro: { perfil: "professor", professorId: null } };
    }
    const escopo = await deps.escopoDoTelefone(telefone);
    if (escopo.tipo !== "professor") throw new Error("Telefone não cadastrado como professor.");
    return {
      escolaId: escopo.escolaId,
      turmas: escopo.turmas,
      ator: { id: escopo.professorId, role: escopo.papel ?? "professor" },
      registro: { perfil: "professor", professorId: escopo.professorId },
    };
  }
  const todas = await deps.listarEscolas();
  if (todas.length === 0) throw new Error("Nenhuma escola cadastrada.");
  const achadas = filtrarEscolas(todas, args.escola);
  if (achadas.length > 1) return { pergunta: `Diga em qual escola: ${achadas.map((e) => e.nome).join(", ")}. Nada foi feito.` };
  const dono = await deps.contaDoDono();
  return { escolaId: achadas[0].id, turmas: null, ator: { id: dono.id, role: "dono" }, registro: { perfil: "dono", professorId: dono.id } };
}

/** Dependências reais, lendo do banco. */
export function depsDoBanco(supabase: SupabaseClient): DepsContextoPlanilha {
  return {
    escopoDoTelefone: (telefone) => escopoDoTelefone(supabase, telefone),
    async listarEscolas() {
      const { data, error } = await supabase.from("escolas").select("id, nome, slug").order("nome");
      if (error) throw new Error(error.message);
      return (data ?? []) as EscolaInfo[];
    },
    contaDoDono: () => contaDoDono({ supabase, escopo: { tipo: "dono" } }),
  };
}
