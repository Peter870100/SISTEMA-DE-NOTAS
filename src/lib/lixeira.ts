/** Textos da lixeira (puro, sem Supabase) — testado em lixeira.test.ts. */
import type { OrigemRegistro, ResultadoRestauracao, ResumoLixeira, TipoLixeira } from "./types";

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

export function descreverResumo(tipo: TipoLixeira, resumo: ResumoLixeira): string {
  if (tipo === "turma") {
    const alunos = resumo.alunos ?? 0;
    const atividades = resumo.atividades ?? 0;
    const notas = resumo.notas ?? 0;
    if (alunos + atividades + notas === 0) return "planilha vazia";
    return [
      plural(alunos, "aluno", "alunos"),
      plural(atividades, "atividade", "atividades"),
      plural(notas, "nota", "notas"),
    ].join(" · ");
  }
  const notas = resumo.notas ?? 0;
  return notas === 0 ? "sem notas" : plural(notas, "nota", "notas");
}

/** `temAutor` = a linha tinha `excluido_por` preenchido (mesmo que o professor tenha sido removido depois). */
export function descreverOrigem(via: OrigemRegistro, nomeProfessor: string | null, temAutor: boolean): string {
  if (via === "hermes") return nomeProfessor ? `Hermes, a pedido de ${nomeProfessor}` : "Hermes";
  if (nomeProfessor) return nomeProfessor;
  return temAutor ? "Professor removido" : "Desconhecido";
}

const ROTULO: Record<TipoLixeira, string> = {
  turma: "Planilha restaurada",
  aluno: "Aluno restaurado",
  atividade: "Atividade restaurada",
};

export function mensagemRestauracao(r: ResultadoRestauracao): string {
  const base = r.notas_restauradas > 0 ? `${ROTULO[r.tipo]} com ${plural(r.notas_restauradas, "nota", "notas")}.` : `${ROTULO[r.tipo]}.`;
  if (r.notas_puladas === 0) return base;
  const pulada =
    r.notas_puladas === 1
      ? "1 nota foi pulada porque a atividade ou o aluno dela não existe mais."
      : `${r.notas_puladas} notas foram puladas porque a atividade ou o aluno delas não existe mais.`;
  return `${base} ${pulada}`;
}
