import type { Letra, SituacaoEstudo } from "../types";

export const MIN_EXERCICIOS = 5;
export const MAX_CHECAGENS = 2;

export type ParecerChecagem = {
  verificador: string;
  texto: { ok: boolean; problema?: string } | null;
  exercicios: { ordem: number; ok: boolean; resposta_encontrada: Letra | null; problema?: string }[];
};

/** Um item do histórico guardado em `materiais_estudo.checagem` (jsonb): um por chamada. */
export type ItemChecagem = ParecerChecagem & { em: string };

export function listaDeChecagens(checagem: unknown): ItemChecagem[] {
  return Array.isArray(checagem) ? (checagem as ItemChecagem[]) : [];
}

/** O último parecer gravado reprovou o texto. */
export function textoReprovadoNaUltima(checagem: unknown): boolean {
  const ultimo = listaDeChecagens(checagem).at(-1);
  return ultimo?.texto?.ok === false;
}

export function acrescentarParecer(checagem: unknown, p: ParecerChecagem, em: string): ItemChecagem[] {
  return [...listaDeChecagens(checagem), { em, verificador: p.verificador, texto: p.texto, exercicios: p.exercicios }];
}

type ExercicioEntrada = { ordem: number; resposta_correta: Letra; situacao: SituacaoEstudo; checagens: number };
type ExercicioSaida = { ordem: number; situacao: SituacaoEstudo; motivo: string | null; checagens: number };

export type ResultadoChecagem =
  | { ok: false; erro: string }
  | {
      ok: true;
      material: { situacao: SituacaoEstudo; motivo: string | null; checagens: number };
      exercicios: ExercicioSaida[];
    };

/** Decide o que a segunda checagem faz com o material e com cada exercício pendente (em rascunho). */
export function aplicarChecagem(
  m: { situacao: SituacaoEstudo; checagens: number; textoReprovado?: boolean },
  exs: ExercicioEntrada[],
  p: ParecerChecagem,
): ResultadoChecagem {
  if (m.situacao === "em_conferencia") return { ok: false, erro: "Material em conferência: só o dono devolve." };
  if (m.situacao === "retido") {
    if (m.checagens >= MAX_CHECAGENS) return { ok: false, erro: "Este material já teve duas checagens e espera uma pessoa." };
    if (m.textoReprovado) return { ok: false, erro: "O texto foi reprovado: regrave o material antes de nova checagem." };
    if (!exs.some((e) => e.situacao === "rascunho")) return { ok: false, erro: "Nada mudou desde a última checagem." };
  }
  if (!p.verificador.trim()) return { ok: false, erro: "Informe quem fez a checagem (verificador)." };
  if (m.situacao !== "publicado" && !p.texto) return { ok: false, erro: "Falta o parecer do texto." };

  const pendentes = exs.filter((e) => e.situacao === "rascunho");
  const ordensPendentes = new Set(pendentes.map((e) => e.ordem));
  const porOrdem = new Map<number, ParecerChecagem["exercicios"][number]>();
  for (const pe of p.exercicios) {
    if (!ordensPendentes.has(pe.ordem)) return { ok: false, erro: `Exercício ${pe.ordem} não está pendente de checagem.` };
    if (porOrdem.has(pe.ordem)) return { ok: false, erro: `Parecer repetido para o exercício ${pe.ordem}.` };
    porOrdem.set(pe.ordem, pe);
  }
  for (const e of pendentes) {
    if (!porOrdem.has(e.ordem)) return { ok: false, erro: `Falta o parecer do exercício ${e.ordem}.` };
  }

  const exercicios: ExercicioSaida[] = pendentes.map((e) => {
    const pe = porOrdem.get(e.ordem)!;
    const passou = pe.ok && pe.resposta_encontrada === e.resposta_correta;
    let motivo: string | null = null;
    if (!passou) {
      motivo = pe.problema?.trim()
        || (pe.ok ? `Resposta encontrada (${pe.resposta_encontrada ?? "nenhuma"}) difere do gabarito (${e.resposta_correta}).` : "Reprovado na checagem.");
    }
    return { ordem: e.ordem, situacao: passou ? "publicado" : "retido", motivo, checagens: e.checagens + 1 };
  });

  if (m.situacao === "publicado") {
    return { ok: true, material: { situacao: "publicado", motivo: null, checagens: m.checagens }, exercicios };
  }

  const novos = new Map(exercicios.map((e) => [e.ordem, e.situacao]));
  const publicados = exs.filter((e) => (novos.get(e.ordem) ?? e.situacao) === "publicado").length;
  const textoOk = p.texto!.ok;
  const motivos: string[] = [];
  if (!textoOk) motivos.push(`Texto reprovado: ${p.texto!.problema?.trim() || "sem detalhes"}`);
  if (publicados < MIN_EXERCICIOS) motivos.push(`Só ${publicados} exercício(s) passaram (mínimo ${MIN_EXERCICIOS}).`);
  const publica = motivos.length === 0;
  return {
    ok: true,
    material: { situacao: publica ? "publicado" : "retido", motivo: publica ? null : motivos.join(" "), checagens: m.checagens + 1 },
    exercicios,
  };
}

/** Regravar o material só vale antes de publicar e com correções disponíveis. */
export function podeRegravar(m: { situacao: SituacaoEstudo; checagens: number } | null): boolean {
  if (!m) return true;
  if (m.situacao === "rascunho") return true;
  return m.situacao === "retido" && m.checagens < MAX_CHECAGENS;
}

export function podeCorrigirExercicio(
  e: { situacao: SituacaoEstudo; checagens: number },
  m: { situacao: SituacaoEstudo; checagens: number; textoReprovado?: boolean },
): boolean {
  if (m.situacao === "retido" && (m.checagens >= MAX_CHECAGENS || m.textoReprovado)) return false;
  return e.situacao === "retido" && e.checagens < MAX_CHECAGENS;
}

export function visivelAoAluno(materialSituacao: SituacaoEstudo, exercicioSituacao: SituacaoEstudo): boolean {
  return materialSituacao === "publicado" && exercicioSituacao === "publicado";
}

/** Cerca de 1 em cada 5 assuntos: soma dos dígitos hexadecimais do id, módulo 5. */
export function ehAmostra(assuntoId: string): boolean {
  let soma = 0;
  for (const c of assuntoId.toLowerCase()) {
    const v = parseInt(c, 16);
    if (!Number.isNaN(v)) soma += v;
  }
  return soma % 5 === 0;
}

export type CamposExercicio = {
  enunciado: string;
  imagem_id: string | null;
  alternativas: { letra: Letra; texto: string }[];
  resposta_correta: Letra;
};

/** Mudou algo que o aluno responde (o comentário não conta). */
export function exercicioMudou(antes: CamposExercicio, depois: CamposExercicio): boolean {
  const f = (c: CamposExercicio) =>
    JSON.stringify([c.enunciado, c.imagem_id, c.alternativas.map((a) => [a.letra, a.texto]), c.resposta_correta]);
  return f(antes) !== f(depois);
}

/** Hoje todo mundo estuda; a loja restringe aqui. */
export function podeEstudar(): boolean {
  return true;
}

/** Desenho vai ao ar com o material; foto só depois de aprovada por uma pessoa. */
export function imagemDisponivel(i: { tipo: "desenho" | "foto"; aprovada_em: string | null }): boolean {
  return i.tipo === "desenho" || i.aprovada_em !== null;
}
