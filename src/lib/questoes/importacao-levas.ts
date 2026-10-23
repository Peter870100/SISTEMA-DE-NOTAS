// Desenho das páginas de uma importação da Hermes em "levas" que cabem no limite de 60 s da Vercel.
// Cada chamada desenha o que der em 40 s a partir dos PDFs originais guardados no storage (nunca do
// link, que pode expirar) e para; a próxima continua de onde parou. Não inicia a leitura: isso é com
// quem chama (`iniciarLeituraPor`, protegido por `reservar`).
//
// Duas chamadas ao mesmo tempo (ou uma nova tentativa depois de falhar no registro) podem desenhar a
// mesma página: o envio ao storage é com upsert e `registrarPaginaPor` faz upsert em
// `importacao_paginas`, então o resultado é o mesmo. O upsert sobre um arquivo que já existe precisa
// da policy de UPDATE "questoes_servidor_atualizar" (db/2026-10-23-hermes-importacao.sql).
import type { AtorEscola } from "@/lib/simulados/ator";
import type { PdfServidor } from "@/lib/questoes/pdf-servidor";

export type TipoArquivo = "prova" | "gabarito";
export type Selecao = { prova: number[]; gabarito: number[] };
export type ResultadoLeva = { prontas: number; faltam: number; erro?: string };

export const ORCAMENTO_LEVA_MS = 40000;
const LEVA_INICIAL = 5;
const MAX_PAGINAS_ARQUIVO = 60; // o mesmo MAX_PAGINAS do núcleo (sem importar o núcleo aqui)

const NOME: Record<TipoArquivo, string> = { prova: "da prova", gabarito: "do gabarito" };

/** Quantas das páginas pendentes cabem no orçamento. Sem média, começa com 5. Sempre pelo menos 1. */
export function planejarLeva(pendentes: number[], tempoMedioMs: number | null, orcamentoMs = ORCAMENTO_LEVA_MS): number[] {
  if (pendentes.length === 0) return [];
  const cabem = tempoMedioMs === null ? LEVA_INICIAL : Math.floor(orcamentoMs / Math.max(tempoMedioMs, 1));
  return pendentes.slice(0, Math.max(1, cabem));
}

/** Põe o arquivo ("da prova"/"do gabarito") nas mensagens de erro do PDF. */
export function erroDoArquivo(mensagem: string, tipo: TipoArquivo): string {
  if (mensagem.startsWith("O PDF ")) return `O PDF ${NOME[tipo]} ${mensagem.slice("O PDF ".length)}`;
  if (mensagem.endsWith(" o PDF.")) return `${mensagem.slice(0, -1)} ${NOME[tipo]}.`;
  return `PDF ${NOME[tipo]}: ${mensagem}`;
}

export function validarSelecao(s: Selecao): string | null {
  if (s.prova.length === 0) return "Nenhuma página escolhida.";
  for (const lista of [s.prova, s.gabarito]) {
    if (lista.some((n) => !Number.isInteger(n) || n < 1)) return "Página inválida.";
    if (lista.length > MAX_PAGINAS_ARQUIVO) return `No máximo ${MAX_PAGINAS_ARQUIVO} páginas por arquivo.`;
    if (new Set(lista).size !== lista.length) return "Página repetida na seleção.";
  }
  return null;
}

export type DepsLeva = {
  /** Confere que o ator pode mexer na importação (lança se não puder). */
  exigir(ator: AtorEscola, importacaoId: string): Promise<void>;
  paginasProntas(importacaoId: string): Promise<{ tipo: TipoArquivo; numero: number }[]>;
  lerOriginal(importacaoId: string, tipo: TipoArquivo): Promise<Uint8Array>;
  abrirPdf(bytes: Uint8Array): Promise<PdfServidor>;
  enviarPagina(importacaoId: string, tipo: TipoArquivo, numero: number, jpeg: Buffer): Promise<void>;
  registrarPagina(ator: AtorEscola, importacaoId: string, tipo: TipoArquivo, numero: number, largura: number, altura: number): Promise<void>;
};

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** O original guardado não existe no storage (não se resolve tentando de novo). */
export class OriginalNaoEncontrado extends Error {}

/** Mesmo limite de `registrarPaginaPor` (lá vira "Página inválida."): depende só do PDF. */
const LADO_MINIMO = 100;

/**
 * Desenha a próxima leva: as páginas escolhidas que ainda não têm linha em `importacao_paginas`, a
 * partir do original guardado. Para antes de passar do orçamento (média por página medida nesta chamada).
 * `erro` só para problemas do próprio PDF, que não se resolvem tentando de novo (seleção inválida, PDF que
 * não abre, original que sumiu do storage, página que não existe, não desenha ou sai menor que 100 px).
 * Outras falhas de storage/banco lançam: são passageiras.
 */
export async function desenharProximaLeva(
  ator: AtorEscola,
  importacaoId: string,
  selecao: Selecao,
  agora: () => number = Date.now,
  deps?: DepsLeva,
  /** Menor na primeira chamada, que também baixa e guarda o original (por exemplo 25 000). */
  orcamentoMs = ORCAMENTO_LEVA_MS,
): Promise<ResultadoLeva> {
  const total = selecao.prova.length + selecao.gabarito.length;
  const invalida = validarSelecao(selecao);
  if (invalida) return { prontas: 0, faltam: total, erro: invalida };
  const d = deps ?? (await depsPadrao());
  const inicio = agora();
  await d.exigir(ator, importacaoId);

  const feitas = new Set((await d.paginasProntas(importacaoId)).map((p) => `${p.tipo}-${p.numero}`));
  const escolhidas: { tipo: TipoArquivo; numero: number }[] = [
    ...selecao.prova.map((numero) => ({ tipo: "prova" as const, numero })),
    ...selecao.gabarito.map((numero) => ({ tipo: "gabarito" as const, numero })),
  ];
  const contarProntas = () => escolhidas.filter((p) => feitas.has(`${p.tipo}-${p.numero}`)).length;
  const restantes = escolhidas.filter((p) => !feitas.has(`${p.tipo}-${p.numero}`));
  const resultado = (erro?: string): ResultadoLeva => {
    const prontas = contarProntas();
    return erro ? { prontas, faltam: total - prontas, erro } : { prontas, faltam: total - prontas };
  };
  if (restantes.length === 0) return resultado();

  const abertos = new Map<TipoArquivo, PdfServidor>();
  /** Ler o original (storage) pode falhar por um soluço: lança. Só o PDF que não abre vira `erro`. */
  const abrir = async (tipo: TipoArquivo): Promise<PdfServidor | { erro: string }> => {
    let pdf = abertos.get(tipo);
    if (!pdf) {
      let bytes: Uint8Array;
      try {
        bytes = await d.lerOriginal(importacaoId, tipo);
      } catch (e) {
        if (e instanceof OriginalNaoEncontrado) return { erro: e.message };
        throw e; // falha passageira do storage
      }
      try {
        pdf = await d.abrirPdf(bytes);
      } catch (e) {
        return { erro: erroDoArquivo(mensagem(e), tipo) };
      }
      abertos.set(tipo, pdf);
    }
    return pdf;
  };

  let desenhadas = 0;
  let decorridoDesenho = 0; // tempo gasto desenhando, para a média (sem abrir o PDF)
  try {
    const mediaAtual = () => (desenhadas > 0 ? decorridoDesenho / desenhadas : null);
    /** Para antes de começar uma página que, pela média desta chamada, passaria do orçamento. */
    const cabeMaisUma = () => {
      const decorrido = agora() - inicio;
      const media = mediaAtual();
      return decorrido < orcamentoMs && (media === null || decorrido + media <= orcamentoMs);
    };
    while (restantes.length > 0 && cabeMaisUma()) {
      const leva = planejarLeva(restantes.map((_, i) => i), mediaAtual(), orcamentoMs - (agora() - inicio)).length;
      for (let k = 0; k < leva && restantes.length > 0; k++) {
        if (!cabeMaisUma()) break;
        const pagina = restantes[0];
        const pdf = await abrir(pagina.tipo);
        if ("erro" in pdf) return resultado(pdf.erro);
        if (pagina.numero > pdf.numPaginas) {
          return resultado(`O PDF ${NOME[pagina.tipo]} tem ${pdf.numPaginas} páginas; a página ${pagina.numero} não existe.`);
        }
        const antes = agora();
        let desenho: Awaited<ReturnType<PdfServidor["desenhar"]>>;
        try {
          desenho = await pdf.desenhar(pagina.numero);
        } catch (e) {
          return resultado(`Não consegui desenhar a página ${pagina.numero} ${NOME[pagina.tipo]}: ${mensagem(e)}`);
        }
        if (desenho.largura < LADO_MINIMO || desenho.altura < LADO_MINIMO) {
          return resultado(`A página ${pagina.numero} ${NOME[pagina.tipo]} é pequena demais (${desenho.largura}×${desenho.altura} px; o mínimo é ${LADO_MINIMO} px de cada lado).`);
        }
        // Storage e banco podem falhar por um soluço: lançam (quem chama trata como passageiro e a
        // próxima chamada refaz esta página; o upsert torna isso seguro).
        await d.enviarPagina(importacaoId, pagina.tipo, pagina.numero, desenho.jpeg);
        await d.registrarPagina(ator, importacaoId, pagina.tipo, pagina.numero, desenho.largura, desenho.altura);
        restantes.shift();
        feitas.add(`${pagina.tipo}-${pagina.numero}`);
        desenhadas++;
        decorridoDesenho += agora() - antes;
      }
    }
    return resultado();
  } finally {
    for (const pdf of abertos.values()) await pdf.fechar().catch(() => {});
  }
}

// ---------- Storage e banco (carregados sob demanda, para os testes não precisarem do Supabase) ----------

/** Opções de envio ao storage: sempre upsert (refazer uma página ou chamadas simultâneas sobrescrevem). */
export const ENVIO_JPEG = { contentType: "image/jpeg", upsert: true } as const;
export const ENVIO_PDF = { contentType: "application/pdf", upsert: true } as const;
export const ENVIO_JSON = { contentType: "application/json", upsert: true } as const;

function idSeguro(importacaoId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(importacaoId)) throw new Error("Importação inválida.");
  return importacaoId;
}
export const caminhoOriginal = (importacaoId: string, tipo: TipoArquivo) => `${idSeguro(importacaoId)}/original-${tipo}.pdf`;
export const caminhoSelecao = (importacaoId: string) => `${idSeguro(importacaoId)}/selecao.json`;

async function armazenamento() {
  const [{ supabase }, { BUCKET }] = await Promise.all([import("@/lib/supabase/client"), import("@/lib/questoes/storage")]);
  return { supabase, bucket: supabase.storage.from(BUCKET) };
}

/** Guarda o PDF original na mesma pasta das páginas (`<id>/original-<tipo>.pdf`). */
export async function guardarOriginal(importacaoId: string, tipo: TipoArquivo, bytes: Uint8Array): Promise<void> {
  const { bucket } = await armazenamento();
  const { error } = await bucket.upload(caminhoOriginal(importacaoId, tipo), Buffer.from(bytes), ENVIO_PDF);
  if (error) throw new Error(`Não consegui guardar o PDF ${NOME[tipo]}: ${error.message}`);
}

export async function lerOriginal(importacaoId: string, tipo: TipoArquivo): Promise<Uint8Array> {
  const { bucket } = await armazenamento();
  const { data, error } = await bucket.download(caminhoOriginal(importacaoId, tipo));
  if (error && !ehNaoEncontrado(error)) throw new Error(`Falha ao ler o PDF ${NOME[tipo]} guardado: ${error.message}`);
  if (error || !data) throw new OriginalNaoEncontrado(`Não encontrei o PDF ${NOME[tipo]} guardado. Importe a prova de novo.`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Guarda as páginas escolhidas, para as chamadas seguintes não dependerem da Hermes repetir. */
export async function guardarSelecao(importacaoId: string, selecao: Selecao): Promise<void> {
  const { bucket } = await armazenamento();
  const corpo = Buffer.from(JSON.stringify({ prova: selecao.prova, gabarito: selecao.gabarito }));
  const { error } = await bucket.upload(caminhoSelecao(importacaoId), corpo, ENVIO_JSON);
  if (error) throw new Error(`Não consegui guardar as páginas escolhidas: ${error.message}`);
}

/** O storage diz que o arquivo não existe (e não uma falha passageira)? */
export function ehNaoEncontrado(error: unknown): boolean {
  const e = error as { status?: unknown; statusCode?: unknown; message?: unknown } | null;
  if (!e) return false;
  return Number(e.status) === 404 || String(e.statusCode) === "404" || /not[ _-]?found/i.test(String(e.message ?? ""));
}

/** As páginas escolhidas guardadas, ou null se não houver (importação feita pela tela). Outras falhas lançam. */
export async function lerSelecao(importacaoId: string): Promise<Selecao | null> {
  const { bucket } = await armazenamento();
  const { data, error } = await bucket.download(caminhoSelecao(importacaoId));
  if (error) {
    if (ehNaoEncontrado(error)) return null;
    throw new Error(`Não consegui ler as páginas escolhidas: ${error.message}`);
  }
  if (!data) return null;
  try {
    const j = JSON.parse(await data.text()) as Partial<Selecao>;
    const numeros = (v: unknown) => (Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : []);
    return { prova: numeros(j.prova), gabarito: numeros(j.gabarito) };
  } catch {
    return null;
  }
}

/** Dependências reais (Supabase, storage, pdfjs). Exportada para trocar uma delas (ex.: original já em memória). */
export async function depsPadrao(): Promise<DepsLeva> {
  const [{ supabase, bucket }, nucleo, acesso, pdf] = await Promise.all([
    armazenamento(),
    import("@/lib/questoes/importacao-nucleo"),
    import("@/lib/questoes/acesso"),
    import("@/lib/questoes/pdf-servidor"),
  ]);
  return {
    exigir: async (ator, id) => { await acesso.exigirImportacaoPor(ator, id); },
    paginasProntas: async (id) => {
      const { data, error } = await supabase.from("importacao_paginas").select("tipo, numero").eq("importacao_id", id);
      if (error) throw new Error(error.message);
      return (data ?? []).map((p) => ({ tipo: p.tipo as TipoArquivo, numero: p.numero }));
    },
    lerOriginal,
    abrirPdf: pdf.abrirPdfServidor,
    enviarPagina: async (id, tipo, numero, jpeg) => {
      const { error } = await bucket.upload(nucleo.caminhoPagina(id, tipo, numero), jpeg, ENVIO_JPEG);
      if (error) throw new Error(error.message);
    },
    registrarPagina: nucleo.registrarPaginaPor,
  };
}
