import type { AlvoImagem, Area, Database, Letra } from "@/lib/types";

export type EnemDevQuestao = {
  title: string;
  index: number;
  discipline: string;
  language: string | null;
  year: number;
  context: string | null;
  files: string[];
  correctAlternative: string;
  alternativesIntroduction: string | null;
  alternatives: { letter: string; text: string | null; file: string | null; isCorrect: boolean }[];
};

const AREA: Record<string, Area> = { linguagens: "linguagens", "ciencias-humanas": "humanas", "ciencias-natureza": "natureza", matematica: "matematica" };
const MATERIA_PROVISORIA: Record<Area, string> = { linguagens: "portugues", humanas: "historia", natureza: "fisica", matematica: "matematica" };
const IMG_MD = /!\[[^\]]*\]\(([^)\s]+)\)/g;
const quebrada = (url: string) => url.includes("broken-image");

/** Separa as imagens markdown do texto. */
function extrairImagens(texto: string | null): { texto: string; urls: string[] } {
  const urls: string[] = [];
  const limpo = (texto ?? "").replace(IMG_MD, (_m, url: string) => { urls.push(url); return ""; });
  return { texto: limpo.replace(/\n{3,}/g, "\n\n").trim(), urls };
}

export function enemDevParaQuestao(q: EnemDevQuestao) {
  const motivos: string[] = [];
  const imagens: { alvo: AlvoImagem; url: string }[] = [];
  const area = AREA[q.discipline] ?? "linguagens";

  const ctx = extrairImagens(q.context);
  for (const url of [...ctx.urls, ...(q.files ?? [])]) {
    if (quebrada(url)) motivos.push("Imagem do enunciado indisponível no enem.dev.");
    else if (!imagens.some((i) => i.alvo === "enunciado" && i.url === url)) imagens.push({ alvo: "enunciado", url });
  }

  const alternativas = q.alternatives.map((a) => {
    const letra = a.letter as Letra;
    const t = extrairImagens(a.text);
    for (const url of [...t.urls, ...(a.file ? [a.file] : [])]) {
      if (quebrada(url)) motivos.push(`Imagem da alternativa ${letra} indisponível no enem.dev.`);
      else imagens.push({ alvo: letra, url });
    }
    if (!t.texto && !a.file && t.urls.length === 0) motivos.push(`Alternativa ${letra} sem conteúdo.`);
    return { letra, texto: t.texto };
  });

  const letras = alternativas.map((a) => a.letra).join("");
  if (alternativas.length !== 5 || letras !== "ABCDE") motivos.push("A questão precisa ter 5 alternativas (A a E).");
  const resposta = ["A", "B", "C", "D", "E"].includes(q.correctAlternative) ? (q.correctAlternative as Letra) : null;
  if (!resposta) motivos.push("Resposta inválida no enem.dev.");

  const linha: Database["public"]["Tables"]["questoes"]["Insert"] = {
    escopo: "geral",
    escola_id: null,
    banca: "ENEM",
    ano: q.year,
    caderno: q.language ?? "",
    numero: q.index,
    area,
    materia: MATERIA_PROVISORIA[area],
    enunciado: ctx.texto,
    comando: (q.alternativesIntroduction ?? "").trim(),
    alternativas,
    resposta,
    anulada: false,
    status: "revisao",
    precisa_revisao: motivos.length > 0,
    motivo_revisao: motivos.length ? [...new Set(motivos)].join(" ") : null,
    origem: "enemdev",
    fonte_id: `${q.year}-${q.language ?? "geral"}-${q.index}`,
  };
  return { linha, imagens };
}

/** Só baixamos imagens servidas por https://enem.dev (evita SSRF). */
export function urlImagemPermitida(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "enem.dev";
  } catch {
    return false;
  }
}
