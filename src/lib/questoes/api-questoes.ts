// API de leitura do banco geral (/api/questoes): filtros, chave e formato de saída. Puro: a consulta
// ao banco fica em api-questoes-servidor.ts.
import { createHash, timingSafeEqual } from "node:crypto";
import { ehMateria } from "./materias";
import type { Alinhamento, AlvoImagem, Area, Questao } from "@/lib/types";

export const LIMITE_PADRAO = 50;
export const LIMITE_MAX = 100;
const AREAS: Area[] = ["linguagens", "humanas", "natureza", "matematica"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FiltrosApi = {
  bancas: string[];
  anos: number[];
  materias: string[];
  area: Area | null;
  assunto: string | null;
  pagina: number;
  limite: number;
};

const lista = (v: string | null) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Lê os filtros da URL. Listas separadas por vírgula (banca=UFMS,UEMS). Pura. */
export function lerFiltrosApi(p: URLSearchParams): FiltrosApi | { erro: string } {
  const bancas = lista(p.get("banca")).map((b) => b.toUpperCase());
  const bancaRuim = bancas.find((b) => !/^[\p{L}\d .-]{1,40}$/u.test(b));
  if (bancaRuim) return { erro: `banca inválida: ${bancaRuim}` };
  const textoAnos = lista(p.get("ano"));
  const anoRuim = textoAnos.find((a) => !/^\d{4}$/.test(a));
  if (anoRuim) return { erro: `ano inválido: ${anoRuim}` };
  const materias = lista(p.get("materia")).map((m) => m.toLowerCase());
  const materiaRuim = materias.find((m) => !ehMateria(m));
  if (materiaRuim) return { erro: `materia inválida: ${materiaRuim}` };
  const area = p.get("area")?.trim().toLowerCase() || null;
  if (area && !AREAS.includes(area as Area)) return { erro: `area inválida: ${area}` };
  const assunto = p.get("assunto")?.trim() || null;
  if (assunto && !UUID.test(assunto)) return { erro: "assunto inválido" };
  const pagina = Number(p.get("pagina") ?? 1);
  if (!Number.isInteger(pagina) || pagina < 1) return { erro: "pagina deve ser 1 ou mais" };
  const limite = Number(p.get("limite") ?? LIMITE_PADRAO);
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAX) return { erro: `limite deve ser de 1 a ${LIMITE_MAX}` };
  return { bancas, anos: textoAnos.map(Number), materias, area: area as Area | null, assunto, pagina, limite };
}

type Env = { QUESTOES_API_TOKEN?: string; MCP_DONO_TOKEN?: string; MCP_SECRET_TOKEN?: string };

/**
 * Confere "Authorization: Bearer <QUESTOES_API_TOKEN>" em tempo constante. Recusa se a chave não estiver
 * configurada ou for igual a uma das senhas da Hermes (quem tem uma não ganha a outra). Pura.
 */
export function tokenApiValido(cabecalho: string | null, env: Env = process.env as Env): boolean {
  const esperada = env.QUESTOES_API_TOKEN;
  if (!esperada || !cabecalho) return false;
  if (esperada === env.MCP_DONO_TOKEN || esperada === env.MCP_SECRET_TOKEN) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(cabecalho), h(`Bearer ${esperada}`));
}

export type FiguraEntrada = {
  alvo: AlvoImagem;
  tipo: "recorte" | "arquivo";
  url: string;
  quadro: { x: number; y: number; w: number; h: number } | null;
  largura: number | null;
  altura: number | null;
  alinhamento: Alinhamento;
};

/**
 * Formato público da questão: sem dados internos (escola, autor, importação, revisão).
 * Figura "recorte": `url` é a página inteira e `recorte` o quadro em frações dela (x, y, w, h).
 */
export function questaoParaApi(q: Questao, nomeAssunto: string | null, figuras: FiguraEntrada[]) {
  return {
    id: q.id,
    banca: q.banca,
    ano: q.ano,
    caderno: q.caderno,
    numero: q.numero,
    area: q.area,
    materia: q.materia,
    assunto: q.assunto_id ? { id: q.assunto_id, nome: nomeAssunto } : null,
    enunciado: q.enunciado,
    conteudo: q.conteudo,
    comando: q.comando,
    alternativas: q.alternativas,
    resposta: q.resposta,
    anulada: q.anulada,
    resolucao: q.resolucao,
    origem: q.origem,
    figuras: figuras.map((f) => ({
      alvo: f.alvo, tipo: f.tipo, url: f.url, recorte: f.quadro, largura: f.largura, altura: f.altura, alinhamento: f.alinhamento,
    })),
    atualizada_em: q.updated_at,
  };
}

export type QuestaoApi = ReturnType<typeof questaoParaApi>;
