import { MAX_REFAZER } from "@/lib/plano/refazer";
import type { ConteudoPlano, EtapaPlano, RegrasAprendizagem } from "@/lib/plano/tipos";

/** Quantidade de questões pedidas pela etapa. */
export function quantidadeDaEtapa(etapa: EtapaPlano, regras: RegrasAprendizagem, pendentes = 0): number {
  if (etapa === "refazer") return Math.min(pendentes, MAX_REFAZER);
  return etapa === "pratica" ? regras.questoesPratica : etapa === "diagnostico" ? regras.questoesDiagnostico : regras.questoesRevisao;
}

export function rotuloEtapa(etapa: EtapaPlano, regras: RegrasAprendizagem, aberto: boolean, situacao: ConteudoPlano["situacao"], pendentes = 0): string {
  if (aberto) return "Continuar treino";
  if (etapa === "refazer") {
    const n = quantidadeDaEtapa(etapa, regras, pendentes);
    return n === 1 ? "Refazer 1 questão" : `Refazer ${n} questões`;
  }
  if (etapa === "pratica") return situacao === "concluido" ? "Estudar de novo" : `Praticar ${regras.questoesPratica} questões`;
  if (etapa === "diagnostico") return `Fazer diagnóstico (${regras.questoesDiagnostico} questões)`;
  return `Fazer revisão (${regras.questoesRevisao} questões)`;
}

/** dd/mm em America/Sao_Paulo. */
export function dataCurta(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso));
}
