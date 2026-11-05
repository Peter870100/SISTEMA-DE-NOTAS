import type { Letra, SituacaoEstudo } from "../types";
import { exercicioMudou, visivelAoAluno, type CamposExercicio } from "./situacao";

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
/** Aluno logado vale antes do professor; sem nenhum dos dois, não há quem avise. */
export function relatorDaSessao(aluno: { id: string } | null, professor: { id: string } | null): Relator | null {
  if (aluno) return { conta_id: aluno.id };
  if (professor) return { professor_id: professor.id };
  return null;
}

export type EntradaRelato = { materialId: string; exercicioId: string | null; mensagem: string | null };

export type DepsRelato = {
  noAr(materialId: string, exercicioId: string | null): Promise<boolean>;
  relatoAnterior(q: Relator, materialId: string, exercicioId: string | null): Promise<"aberto" | "sem_erro" | null>;
  relatosHoje(q: Relator): Promise<number>;
  inserir(q: Relator, e: EntradaRelato): Promise<void>;
  tirarDoAr(materialId: string, exercicioId: string | null): Promise<void>;
};

export async function relatarErroCom(deps: DepsRelato, q: Relator, e: EntradaRelato): Promise<{ ok: true; saiuDoAr: boolean } | { ok: false; erro: string }> {
  if (e.mensagem !== null && e.mensagem.length > LIMITE_MENSAGEM) {
    return { ok: false, erro: `A mensagem pode ter no máximo ${LIMITE_MENSAGEM} caracteres.` };
  }
  if (!(await deps.noAr(e.materialId, e.exercicioId))) return { ok: true, saiuDoAr: true };
  const anterior = await deps.relatoAnterior(q, e.materialId, e.exercicioId);
  // Já conferido pelo dono como sem erro: o item continua no ar.
  if (anterior === "sem_erro") return { ok: true, saiuDoAr: false };
  if (anterior === "aberto") {
    // O aviso já está gravado; se o item ainda está no ar, uma tentativa anterior falhou ao tirá-lo.
    await deps.tirarDoAr(e.materialId, e.exercicioId);
    return { ok: true, saiuDoAr: true };
  }
  if ((await deps.relatosHoje(q)) >= LIMITE_RELATOS_DIA) {
    return { ok: false, erro: `Você já enviou ${LIMITE_RELATOS_DIA} avisos hoje. Tente de novo amanhã.` };
  }
  await deps.inserir(q, e);
  await deps.tirarDoAr(e.materialId, e.exercicioId);
  return { ok: true, saiuDoAr: true };
}

export type DepsJuntar = { temMaterial(assuntoId: string): Promise<boolean>; mover(de: string, para: string): Promise<void> };

/** Ao juntar assuntos, o material do proposto passa ao destino só se o destino ainda não tiver um. */
export async function moverMaterialAoJuntar(deps: DepsJuntar, propostoId: string, destinoId: string): Promise<void> {
  if (!(await deps.temMaterial(propostoId))) return;
  if (await deps.temMaterial(destinoId)) return;
  await deps.mover(propostoId, destinoId);
}

const LETRAS_ALT = ["A", "B", "C", "D", "E"] as const;

export type CamposEditaveis = CamposExercicio & { comentario: string };

export type DepsExercicio = {
  ler(id: string): Promise<(CamposExercicio & { material_id: string }) | null>;
  /** A figura existe neste material e é um desenho. */
  desenhoDoMaterial(imagemId: string, materialId: string): Promise<boolean>;
  apagarRespostas(exercicioId: string): Promise<void>;
  publicar(exercicioId: string, campos: CamposExercicio & { comentario: string; situacao: "publicado"; motivo: null }): Promise<void>;
  fecharAvisos(materialId: string, exercicioId: string): Promise<void>;
};

/** Corrigi (exercício): publica direto; mudou o que o aluno responde, as respostas dele são apagadas. */
export async function salvarExercicioCom(deps: DepsExercicio, exercicioId: string, campos: CamposEditaveis): Promise<{ ok: true } | { ok: false; erro: string }> {
  const enunciado = typeof campos?.enunciado === "string" ? campos.enunciado.trim() : "";
  const comentario = typeof campos?.comentario === "string" ? campos.comentario.trim() : "";
  if (!enunciado) return { ok: false, erro: "Escreva o enunciado." };
  if (!comentario) return { ok: false, erro: "Escreva o comentário." };
  const alts = campos.alternativas;
  if (!Array.isArray(alts) || alts.length !== 5 || alts.some((a, i) => a?.letra !== LETRAS_ALT[i] || typeof a.texto !== "string" || !a.texto.trim())) {
    return { ok: false, erro: "São 5 alternativas, de A a E, todas com texto." };
  }
  if (!(LETRAS_ALT as readonly string[]).includes(campos.resposta_correta)) return { ok: false, erro: "Escolha a resposta correta." };

  const antes = await deps.ler(exercicioId);
  if (!antes) return { ok: false, erro: "Exercício não encontrado." };

  const imagemId = campos.imagem_id ?? null;
  if (imagemId !== null && !(await deps.desenhoDoMaterial(imagemId, antes.material_id))) {
    return { ok: false, erro: "A figura do exercício precisa ser um desenho deste material." };
  }

  const depois: CamposExercicio = {
    enunciado,
    imagem_id: imagemId,
    alternativas: alts.map((a) => ({ letra: a.letra, texto: a.texto.trim() })),
    resposta_correta: campos.resposta_correta,
  };
  if (exercicioMudou(antes, depois)) await deps.apagarRespostas(exercicioId);
  await deps.publicar(exercicioId, { ...depois, comentario, situacao: "publicado", motivo: null });
  await deps.fecharAvisos(antes.material_id, exercicioId);
  return { ok: true };
}
