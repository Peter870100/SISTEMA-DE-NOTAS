import type { NotaCelula } from "./types";
import type { ValorCelula } from "./status";

export type CelulasMap = Record<string, Record<string, ValorCelula>>;

export type NotaCelulaComAutor = NotaCelula & { professor_nome?: string | null };

export function celulasIniciaisDe(notas: NotaCelulaComAutor[]): CelulasMap {
  const map: CelulasMap = {};
  for (const n of notas) {
    map[n.aluno_id] ??= {};
    map[n.aluno_id][n.coluna_id] = {
      valor: n.valor,
      status_texto: n.status_texto,
      atualizadoPorNome: n.professor_nome ?? null,
      atualizadoEm: n.updated_at,
    };
  }
  return map;
}
