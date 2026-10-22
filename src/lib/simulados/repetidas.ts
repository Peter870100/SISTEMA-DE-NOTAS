import { emBlocos } from "./regras";

type Turma = { turma_nome: string; ano_letivo: string };

/** Tira dos ids os já aplicados e conta quantos saíram. Pura. */
export function filtrarRepetidas(ids: string[], aplicadas: Set<string>): { ids: string[]; puladas: number } {
  const restantes = ids.filter((id) => !aplicadas.has(id));
  return { ids: restantes, puladas: ids.length - restantes.length };
}

/**
 * Questões de simulados do professor já publicados, da mesma escola e ligados a alguma das mesmas turmas
 * (nome + ano), sem contar o próprio simulado. `semTurmas`: o simulado ainda não tem turmas (nada a excluir).
 */
export async function questoesAplicadas(escolaId: string, simuladoId: string): Promise<{ aplicadas: Set<string>; semTurmas: boolean }> {
  // Import tardio: o teste da função pura não precisa das variáveis do Supabase.
  const { supabase: db } = await import("@/lib/supabase/client");
  async function ler<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
    const linhas: T[] = [];
    for (let de = 0; ; de += 500) {
      const { data, error } = await consulta(de, de + 499);
      if (error) throw new Error(error.message);
      linhas.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) return linhas;
    }
  }
  const turmas = await ler((de, ate) => db.from("simulado_turmas").select("turma_nome, ano_letivo").eq("simulado_id", simuladoId).eq("escola_id", escolaId).order("turma_nome").order("ano_letivo").range(de, ate));
  if (!turmas.length) return { aplicadas: new Set(), semTurmas: true };
  const chave = (t: Turma) => `${t.turma_nome}|${t.ano_letivo}`;
  const alvos = new Set(turmas.map(chave));
  const vinculos = await ler((de, ate) => db.from("simulado_turmas").select("simulado_id, turma_nome, ano_letivo").eq("escola_id", escolaId).order("simulado_id").order("turma_nome").order("ano_letivo").range(de, ate));
  const ids = [...new Set(vinculos.filter((t) => t.simulado_id !== simuladoId && alvos.has(chave(t))).map((t) => t.simulado_id))];
  const publicadas: string[] = [];
  for (const bloco of emBlocos(ids, 100)) {
    const simulados = await ler((de, ate) => db.from("simulados").select("id").eq("escola_id", escolaId).eq("tipo", "professor").eq("status", "publicado").in("id", bloco).order("id").range(de, ate));
    publicadas.push(...simulados.map((s) => s.id));
  }
  const aplicadas = new Set<string>();
  for (const bloco of emBlocos(publicadas, 100)) {
    const questoes = await ler((de, ate) => db.from("simulado_questoes").select("questao_id").in("simulado_id", bloco).order("simulado_id").order("questao_id").range(de, ate));
    questoes.forEach((q) => aplicadas.add(q.questao_id));
  }
  return { aplicadas, semTurmas: false };
}
