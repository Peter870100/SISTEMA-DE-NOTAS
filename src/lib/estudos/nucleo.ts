import type { Letra, SituacaoEstudo } from "../types";
import { visivelAoAluno } from "./situacao";

export const LIMITE_RELATOS_DIA = 5;
const LIMITE_MENSAGEM = 500;

export type ResultadoResposta =
  | { ok: true; marcada: Letra; acertou: boolean; certa: Letra; comentario: string }
  | { ok: false; erro: string };

export type DepsResposta = {
  exercicio(id: string): Promise<{ resposta_correta: Letra; comentario: string; situacao: SituacaoEstudo; material_situacao: SituacaoEstudo } | null>;
  /** Upsert com `ignoreDuplicates`; devolve a linha que ficou (a primeira resposta vale). */
  gravar(contaId: string, exercicioId: string, marcada: Letra, acertou: boolean): Promise<{ marcada: Letra; acertou: boolean }>;
};

export async function responderExercicioCom(
  deps: DepsResposta,
  contaId: string,
  e: { exercicioId: string; marcada: Letra },
): Promise<ResultadoResposta> {
  const ex = await deps.exercicio(e.exercicioId);
  if (!ex || !visivelAoAluno(ex.material_situacao, ex.situacao)) {
    return { ok: false, erro: "Este exercício saiu do ar para conferência." };
  }
  const ficou = await deps.gravar(contaId, e.exercicioId, e.marcada, e.marcada === ex.resposta_correta);
  return { ok: true, marcada: ficou.marcada, acertou: ficou.acertou, certa: ex.resposta_correta, comentario: ex.comentario };
}

export type Relator = { conta_id: string } | { professor_id: string };
export type EntradaRelato = { materialId: string; exercicioId: string | null; mensagem: string | null };

export type DepsRelato = {
  noAr(materialId: string, exercicioId: string | null): Promise<boolean>;
  relatoAnterior(q: Relator, materialId: string, exercicioId: string | null): Promise<"aberto" | "sem_erro" | null>;
  relatosHoje(q: Relator): Promise<number>;
  inserir(q: Relator, e: EntradaRelato): Promise<void>;
  tirarDoAr(materialId: string, exercicioId: string | null): Promise<void>;
};

export async function relatarErroCom(deps: DepsRelato, q: Relator, e: EntradaRelato): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (e.mensagem !== null && e.mensagem.length > LIMITE_MENSAGEM) {
    return { ok: false, erro: `A mensagem pode ter no máximo ${LIMITE_MENSAGEM} caracteres.` };
  }
  if (!(await deps.noAr(e.materialId, e.exercicioId))) return { ok: true };
  const anterior = await deps.relatoAnterior(q, e.materialId, e.exercicioId);
  if (anterior === "sem_erro") return { ok: true };
  if (anterior === "aberto") {
    // O aviso já está gravado; se o item ainda está no ar, uma tentativa anterior falhou ao tirá-lo.
    await deps.tirarDoAr(e.materialId, e.exercicioId);
    return { ok: true };
  }
  if ((await deps.relatosHoje(q)) >= LIMITE_RELATOS_DIA) {
    return { ok: false, erro: `Você já enviou ${LIMITE_RELATOS_DIA} avisos hoje. Tente de novo amanhã.` };
  }
  await deps.inserir(q, e);
  await deps.tirarDoAr(e.materialId, e.exercicioId);
  return { ok: true };
}

export type DepsJuntar = { temMaterial(assuntoId: string): Promise<boolean>; mover(de: string, para: string): Promise<void> };

/** Ao juntar assuntos, o material do proposto passa ao destino só se o destino ainda não tiver um. */
export async function moverMaterialAoJuntar(deps: DepsJuntar, propostoId: string, destinoId: string): Promise<void> {
  if (!(await deps.temMaterial(propostoId))) return;
  if (await deps.temMaterial(destinoId)) return;
  await deps.mover(propostoId, destinoId);
}
