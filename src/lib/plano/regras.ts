import { z } from "zod";
import type { RegrasAprendizagem } from "./tipos";

export const REGRAS_PADRAO: RegrasAprendizagem = {
  minQuestoesPrioridade: 5,
  taxaErroPrioridade: 60,
  questoesPratica: 5,
  questoesDiagnostico: 5,
  questoesRevisao: 3,
  diasRevisao: 7,
  metaAcerto: 60,
  diasSemRepetir: 30,
  minutosPorQuestao: 3,
  minutosMaterial: 15,
};

export const LIMITES: Record<keyof RegrasAprendizagem, { min: number; max: number; rotulo: string; ajuda: string }> = {
  minQuestoesPrioridade: { min: 2, max: 30, rotulo: "Questões para revisão prioritária", ajuda: "Quantas questões distintas o aluno precisa ter respondido num conteúdo para ele virar revisão prioritária." },
  taxaErroPrioridade: { min: 30, max: 95, rotulo: "Erro para revisão prioritária (%)", ajuda: "Porcentagem de erro a partir da qual um conteúdo vira revisão prioritária." },
  questoesPratica: { min: 3, max: 15, rotulo: "Questões na prática", ajuda: "Tamanho da sequência de prática depois da revisão do conteúdo." },
  questoesDiagnostico: { min: 3, max: 15, rotulo: "Questões no diagnóstico", ajuda: "Tamanho do diagnóstico pedido quando ainda faltam respostas para entender o conteúdo." },
  questoesRevisao: { min: 2, max: 10, rotulo: "Questões na revisão posterior", ajuda: "Tamanho da revisão feita alguns dias depois da prática." },
  diasRevisao: { min: 1, max: 60, rotulo: "Dias até a revisão posterior", ajuda: "Dias depois da prática para liberar a revisão posterior." },
  metaAcerto: { min: 30, max: 100, rotulo: "Meta de acerto (%)", ajuda: "Porcentagem de acerto que conclui a prática ou a revisão." },
  diasSemRepetir: { min: 0, max: 365, rotulo: "Dias sem repetir questão", ajuda: "Uma questão vista há menos dias que isso não volta nas sequências." },
  minutosPorQuestao: { min: 1, max: 10, rotulo: "Minutos por questão", ajuda: "Tempo estimado por questão no plano." },
  minutosMaterial: { min: 5, max: 120, rotulo: "Minutos por material", ajuda: "Tempo estimado de um material sem duração conhecida." },
};

const CAMPOS = Object.keys(REGRAS_PADRAO) as (keyof RegrasAprendizagem)[];

function dentro(campo: keyof RegrasAprendizagem, n: unknown): n is number {
  const { min, max } = LIMITES[campo];
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
}

/** Campo a campo: o que não for inteiro dentro dos limites volta ao padrão. */
export function normalizarRegras(v: unknown): RegrasAprendizagem {
  const base = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const r = { ...REGRAS_PADRAO };
  for (const campo of CAMPOS) if (dentro(campo, base[campo])) r[campo] = base[campo];
  return r;
}

function mensagem(campo: keyof RegrasAprendizagem): string {
  const { rotulo, min, max } = LIMITES[campo];
  return `${rotulo}: use um número inteiro de ${min} a ${max}.`;
}

const esquema = z.object(
  Object.fromEntries(
    CAMPOS.map((campo) => [
      campo,
      z
        .number({ error: mensagem(campo) })
        .int({ error: mensagem(campo) })
        .min(LIMITES[campo].min, { error: mensagem(campo) })
        .max(LIMITES[campo].max, { error: mensagem(campo) }),
    ]),
  ) as Record<keyof RegrasAprendizagem, z.ZodNumber>,
);

export function validarRegras(v: unknown): { ok: true; regras: RegrasAprendizagem } | { ok: false; erro: string } {
  const r = esquema.safeParse(v);
  if (r.success) return { ok: true, regras: r.data };
  return { ok: false, erro: r.error.issues[0]?.message ?? "Regras inválidas." };
}

export const TEMPOS_SEMANA = [30, 60, 120, 180, 300, 480] as const;
export const TEMPO_SEMANA_PADRAO = 120;

export function tempoSemanaValido(m: unknown): m is number {
  return typeof m === "number" && (TEMPOS_SEMANA as readonly number[]).includes(m);
}
