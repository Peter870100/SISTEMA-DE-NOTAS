import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SLUG_PADRAO, urlDaEscola } from "@/lib/dominio";
import { estimarCustoPaginas } from "@/lib/questoes/ia";
import { lerPaginas } from "@/lib/questoes/paginas";
import { podeImportar } from "@/lib/questoes/regras";
import type { SituacaoImportacao } from "@/lib/questoes/importacao-nucleo";
import type { Selecao, TipoArquivo } from "@/lib/questoes/importacao-levas";
import type { AtorEscola } from "@/lib/simulados/ator";
import type { StatusImportacao } from "@/lib/types";
import { campoEscola, campoTelefone, texto, type Ctx, type ObterCtx } from "../leitura/comum";
import { atorDoEscopo, campoId, contaDoDono, escolaParaCriar, falha, registrado, type Perfil } from "./ator";

/**
 * Importação de provas em PDF pela Hermes: as mesmas regras da tela "Importar prova" (núcleo com ator),
 * com o desenho das páginas no servidor em levas (cada chamada cabe no limite de 60 s da Vercel).
 * O núcleo, o storage e o desenho são carregados sob demanda, para os testes das partes puras não
 * precisarem do Supabase.
 */

/** Mesma mensagem da tela para importação de outra escola: não confirma que o id existe. */
export const ERRO_IMPORTACAO = "Importação não encontrada.";
export const ERRO_BANCO_ESCOLA = "Você só pode importar no banco da sua escola.";

const MAX_PAGINAS_ARQUIVO = 60; // o mesmo MAX_PAGINAS do núcleo (sem importar o núcleo aqui)
/** A primeira chamada também baixa e guarda os originais: desenha menos. */
const ORCAMENTO_PRIMEIRA_LEVA_MS = 25000;
/** Se baixar e guardar já levou mais que isso, a primeira chamada não desenha (fica para situacao_importacao). */
const MAX_ANTES_DA_PRIMEIRA_LEVA_MS = 30000;
/** Tempo de trabalho por chamada, com folga para os 60 s da Vercel. */
const LIMITE_CHAMADA_MS = 50000;
/** Outra chamada mudou a importação de "enviando" enquanto esta desenhava (mensagem do núcleo). */
const ERRO_JA_ENVIADA = "Essa importação já foi enviada.";
const NOME: Record<TipoArquivo, string> = { prova: "da prova", gabarito: "do gabarito" };

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------- partes puras ----------

export type FontePdf = { url: string } | { base64: string };
export type PedidoImportacao = {
  escopo: "escola" | "geral";
  banca: string;
  ano: number | null;
  caderno: string;
  prova: FontePdf;
  gabarito: FontePdf | null;
  /** null = todas as páginas. */
  paginasProva: string | null;
  paginasGabarito: string | null;
};

export type ArgsImportar = {
  prova_url?: string; prova_base64?: string; gabarito_url?: string; gabarito_base64?: string;
  paginas_prova?: string; paginas_gabarito?: string;
  banca: string; ano?: number | null; caderno?: string; banco?: "escola" | "geral";
};

/** "todas", vazio ou ausente = todas as páginas (null); senão o texto como na tela ("2-30", "1-20, 23"). Pura. */
export function paginasDoTexto(t: string | undefined): string | null {
  const s = (t ?? "").trim();
  return !s || s.toLowerCase() === "todas" ? null : s;
}

function fonte(url: string | undefined, base64: string | undefined, campo: "prova" | "gabarito"): FontePdf | null {
  const u = url?.trim();
  const b = base64?.trim();
  if (u && b) throw new Error(`Mande o PDF ${NOME[campo]} por ${campo}_url ou ${campo}_base64, não os dois.`);
  if (u) return { url: u };
  if (b) return { base64: b };
  return null;
}

/** Confere os parâmetros de importar_prova (sem rede). Professor só no banco da escola. Pura. */
export function lerPedidoImportacao(args: ArgsImportar, perfil: Perfil): PedidoImportacao {
  const escopo = args.banco ?? "escola";
  if (escopo === "geral" && perfil === "professor") throw new Error(ERRO_BANCO_ESCOLA);
  const banca = (args.banca ?? "").trim();
  if (!banca) throw new Error("Informe a banca.");
  const prova = fonte(args.prova_url, args.prova_base64, "prova");
  if (!prova) throw new Error("Mande o PDF da prova em prova_url (link) ou prova_base64.");
  const gabarito = fonte(args.gabarito_url, args.gabarito_base64, "gabarito");
  if (!gabarito && args.paginas_gabarito?.trim()) throw new Error("Veio paginas_gabarito sem o PDF do gabarito.");
  return {
    escopo, banca, ano: args.ano ?? null, caderno: (args.caderno ?? "").trim(), prova, gabarito,
    paginasProva: paginasDoTexto(args.paginas_prova), paginasGabarito: gabarito ? paginasDoTexto(args.paginas_gabarito) : null,
  };
}

/** Páginas escolhidas de um arquivo com `total` páginas (null = todas), no máximo 60. Pura. */
export function selecionarPaginas(textoPaginas: string | null, total: number, tipo: TipoArquivo): number[] {
  let lista: number[];
  try {
    lista = lerPaginas(textoPaginas ?? "", total);
  } catch (e) {
    throw new Error(`PDF ${NOME[tipo]}: ${mensagem(e)}`);
  }
  if (lista.length === 0) throw new Error(tipo === "prova" ? "Nenhuma página escolhida." : `O PDF ${NOME[tipo]} não tem páginas.`);
  if (lista.length > MAX_PAGINAS_ARQUIVO) {
    throw new Error(textoPaginas === null
      ? `O PDF ${NOME[tipo]} tem ${total} páginas; escolha no máximo ${MAX_PAGINAS_ARQUIVO} (ex.: "1-${MAX_PAGINAS_ARQUIVO}").`
      : `No máximo ${MAX_PAGINAS_ARQUIVO} páginas por arquivo (foram ${lista.length} ${NOME[tipo]}).`);
  }
  return lista;
}

/** Parâmetros para o `hermes_registro`: sem o base64 e sem o token do bot no link do Telegram. Pura. */
export function parametrosParaRegistro(args: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string" && k.endsWith("_base64")) saida[k] = `(PDF em base64, ${Math.round((v.length * 3) / 4 / 1024)} KB)`;
    else if (typeof v === "string" && k.endsWith("_url")) saida[k] = v.split(/[?#]/)[0].replace(/\/bot[^/]+\//i, "/bot***/");
    else saida[k] = v;
  }
  return saida;
}

const dinheiro = (n: number) => `US$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function linhaDesenho(prontas: number, total: number): string {
  const faltam = total - prontas;
  return faltam > 0
    ? `${prontas} de ${total} páginas desenhadas; faltam ${plural(faltam, "página", "páginas")}.`
    : `Todas as ${total} páginas desenhadas.`;
}

/** Resposta de importar_prova. Pura. */
export function textoImportacaoCriada(d: { id: string; rotulo: string; prontas: number; total: number; paginasProva: number; custo: number; link: string; nota?: string }): string {
  const faltam = d.total - d.prontas;
  return [
    `Importação ${d.id} criada (${d.rotulo}).`,
    linhaDesenho(d.prontas, d.total),
    d.nota,
    `Custo estimado da leitura pela IA: ${dinheiro(d.custo)} (${plural(d.paginasProva, "página", "páginas")} da prova).`,
    faltam > 0
      ? `Chame situacao_importacao com importacao_id ${d.id} para desenhar o resto; quando todas estiverem prontas, a leitura pela IA começa sozinha.`
      : `Chame situacao_importacao com importacao_id ${d.id} para começar a leitura pela IA.`,
    `Acompanhar: ${d.link}`,
  ].filter(Boolean).join(" ");
}

const ROTULO_STATUS: Record<StatusImportacao, string> = {
  enviando: "enviando", lendo: "lendo", revisao: "em revisão", concluida: "concluída", erro: "erro",
};

/** Resposta de situacao_importacao. `desenho` só enquanto as páginas ainda estão sendo desenhadas. Pura. */
export function textoSituacao(d: {
  id: string; link: string; situacao: SituacaoImportacao;
  desenho?: { prontas: number; total: number }; leituraIniciada?: boolean; nota?: string;
}): string {
  const s = d.situacao;
  const partes = [`Situação: ${ROTULO_STATUS[s.status]}.`];
  if (d.nota) partes.push(d.nota);
  if (s.status === "enviando" && d.desenho) {
    partes.push(linhaDesenho(d.desenho.prontas, d.desenho.total));
    if (d.desenho.prontas < d.desenho.total) partes.push(`Chame situacao_importacao de novo (importacao_id ${d.id}) para continuar.`);
  }
  if (s.status === "lendo") {
    partes.push(d.leituraIniciada
      ? `A IA começou a ler as ${s.total} páginas da prova (custo estimado ${dinheiro(s.custoEstimado ?? 0)}). Pode levar alguns minutos: consulte situacao_importacao mais tarde.`
      : `A IA está lendo: ${s.lidas} de ${s.total} páginas lidas. Consulte situacao_importacao mais tarde.`);
  }
  if (s.status === "revisao" || s.status === "concluida") {
    partes.push(`${plural(s.questoes, "questão criada", "questões criadas")} (${s.aConferir} a conferir).`);
    if (s.custoReal !== null) partes.push(`Custo da leitura: ${dinheiro(s.custoReal)}.`);
  }
  if (s.erros.length) {
    partes.push(`Páginas com erro na leitura: ${s.erros.map((e) => `Página ${e.pagina}: ${e.erro}`).join("; ")}. Para tentar de novo, use ler_de_novo.`);
  }
  if (s.status === "erro") partes.push(s.avisos.length ? `Erro: ${s.avisos.join(" ")}` : "A importação parou com erro.");
  else partes.push(...s.avisos.map((a) => `Aviso: ${a}`));
  partes.push(`${s.status === "revisao" || s.status === "concluida" ? "Conferência" : "Acompanhar"}: ${d.link}`);
  return partes.join(" ");
}

// ---------- banco e storage (sob demanda) ----------

const nucleo = () => import("@/lib/questoes/importacao-nucleo");
const levas = () => import("@/lib/questoes/importacao-levas");

type ImportacaoAlvo = { id: string; escopo: "geral" | "escola"; escola_id: string | null; status: StatusImportacao; criado_via?: string | null };
type Rodar = <T>(acao: () => Promise<T>) => Promise<T>;

/** Lê só o que decide o alcance; o núcleo confere de novo (`exigirImportacaoPor`). */
async function lerImportacao(ctx: Ctx, id: string): Promise<ImportacaoAlvo> {
  const { data, error } = await ctx.supabase.from("importacoes").select("id, escopo, escola_id, status, criado_via").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(ERRO_IMPORTACAO);
  return data as ImportacaoAlvo;
}

/** Escola onde a ação acontece: a da importação; no banco geral, só o dono (na escola da conta dele). */
async function escolaDaImportacao(ctx: Ctx, imp: ImportacaoAlvo): Promise<string> {
  if (imp.escola_id) return imp.escola_id;
  if (ctx.escopo.tipo === "professor") throw new Error(ERRO_IMPORTACAO);
  return (await contaDoDono(ctx)).escola_id;
}

async function slugDaEscola(ctx: Ctx, escolaId: string): Promise<string> {
  const { data } = await ctx.supabase.from("escolas").select("slug").eq("id", escolaId).maybeSingle();
  return (data as { slug?: string } | null)?.slug ?? SLUG_PADRAO;
}

function linkImportacao(slug: string, id: string, status: StatusImportacao): string {
  return urlDaEscola(slug, status === "revisao" || status === "concluida" ? `/banco/importacoes/${id}/revisar` : `/banco/importacoes/${id}`);
}

async function atualizarTelas() {
  try {
    (await import("next/cache")).revalidatePath("/banco", "layout");
  } catch {
    // Fora de um pedido do Next (ex.: testes) não há o que atualizar.
  }
}

/** Marca a importação com erro sem esconder o erro original se a marcação falhar. */
async function marcarErro(ator: AtorEscola, id: string, msg: string) {
  try {
    await (await nucleo()).marcarErroEnvioPor(ator, id, msg);
  } catch (e) {
    console.error(`importacao ${id}: não foi possível marcar o erro:`, mensagem(e));
  }
}

async function obterPdf(f: FontePdf, tipo: TipoArquivo): Promise<Uint8Array> {
  const [entrada, { erroDoArquivo }] = await Promise.all([import("@/lib/questoes/pdf-entrada"), levas()]);
  try {
    return "url" in f ? await entrada.baixarPdf(f.url) : entrada.decodificarBase64Pdf(f.base64);
  } catch (e) {
    throw new Error(erroDoArquivo(mensagem(e), tipo));
  }
}

/** Abre o PDF só para contar as páginas (e já recusar senha ou arquivo quebrado antes de criar a importação). */
async function contarPaginas(bytes: Uint8Array, tipo: TipoArquivo): Promise<number> {
  const [{ abrirPdfServidor }, { erroDoArquivo }] = await Promise.all([import("@/lib/questoes/pdf-servidor"), levas()]);
  let pdf;
  try {
    pdf = await abrirPdfServidor(bytes);
  } catch (e) {
    throw new Error(erroDoArquivo(mensagem(e), tipo));
  }
  const n = pdf.numPaginas;
  await pdf.fechar().catch(() => {});
  return n;
}

function comImportacao<A extends { importacao_id: string; professor_telefone?: string }>(
  obter: ObterCtx, perfil: Perfil, ferramenta: string, verbo: string,
  acao: (ator: AtorEscola, imp: ImportacaoAlvo, slug: string, rodar: Rodar) => Promise<string>,
) {
  return async (args: A) => {
    try {
      const ctx = await obter(args);
      const imp = await lerImportacao(ctx, args.importacao_id);
      // Importação de outra escola: mesma mensagem da tela, sem confirmar que o id existe
      const ator = await atorDoEscopo(ctx, await escolaDaImportacao(ctx, imp), ERRO_IMPORTACAO);
      const slug = await slugDaEscola(ctx, ator.escola_id);
      const rodar: Rodar = (fn) => registrado(perfil, ator, ferramenta, args, fn);
      const resposta = await acao(ator, imp, slug, rodar);
      await atualizarTelas();
      return texto(resposta);
    } catch (e) {
      return falha(verbo, e);
    }
  };
}

const campoImportacao = { importacao_id: campoId("Id da importação (veja na resposta de importar_prova).") };
const campoPdfUrl = (qual: string) => z.string().trim().max(4000).optional().describe(`Link https do PDF ${qual} (ex.: o link do arquivo no Telegram). Preferível ao base64.`);
const campoPdfBase64 = (qual: string) => z.string().max(42_000_000).optional().describe(`PDF ${qual} em base64, só para arquivos pequenos (até uns 3 MB; o pedido inteiro tem limite de ~4,5 MB). Use o link sempre que puder.`);

export function registrarAcoesImportacao(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  server.registerTool(
    "importar_prova",
    {
      title: "Importar prova em PDF",
      description: "Importa uma prova em PDF para o banco de questões, como a tela \"Importar prova\": a IA lê as páginas e as questões ficam para conferir. Mande o PDF de preferência por prova_url (link https, ex.: o do arquivo no Telegram); prova_base64 só para PDFs pequenos (até ~3 MB). Até 30 MB e 60 páginas por arquivo. A leitura pela IA é paga: antes, resuma (banca, ano, páginas, banco) e peça confirmação citando o custo estimado (cerca de US$ 0,05 por página da prova). Depois, chame situacao_importacao até aparecer \"lendo\".",
      inputSchema: {
        prova_url: campoPdfUrl("da prova"),
        prova_base64: campoPdfBase64("da prova"),
        gabarito_url: campoPdfUrl("do gabarito (opcional)"),
        gabarito_base64: campoPdfBase64("do gabarito (opcional)"),
        paginas_prova: z.string().trim().max(200).optional().describe('Páginas da prova: "todas" (padrão) ou como na tela, ex: "2-30" ou "1-20, 23".'),
        paginas_gabarito: z.string().trim().max(200).optional().describe('Páginas do gabarito: "todas" (padrão) ou ex: "1".'),
        banca: z.string().trim().min(1).max(80).describe('Banca, ex: "UFMS", "ENEM".'),
        ano: z.number().int().min(1900).max(2100).nullable().optional(),
        caderno: z.string().trim().max(80).optional().describe('Caderno (opcional), ex: "1º dia", "Prova 2".'),
        banco: z.enum(["escola", "geral"]).optional().describe('"escola" (padrão) = banco da escola; "geral" = banco geral (só o dono).'),
        ...campoEscola,
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const inicio = Date.now();
        const pedido = lerPedidoImportacao(args, perfil);
        const ctx = await obter(args);
        let ator: AtorEscola;
        let slug: string;
        if (pedido.escopo === "geral") {
          if (ctx.escopo.tipo === "professor") throw new Error(ERRO_BANCO_ESCOLA);
          const dono = await contaDoDono(ctx);
          ator = await atorDoEscopo(ctx, dono.escola_id);
          slug = await slugDaEscola(ctx, dono.escola_id);
        } else {
          const escola = await escolaParaCriar(ctx, args.escola);
          ator = await atorDoEscopo(ctx, escola.id);
          slug = escola.slug;
        }
        if (!podeImportar(ator, pedido.escopo)) throw new Error("Você não pode importar provas nesse banco.");

        const resposta = await registrado(perfil, ator, "importar_prova", parametrosParaRegistro(args), async () => {
          // Tudo o que pode falhar sem custo (download, senha, páginas) acontece antes de criar a importação.
          const [prova, gabarito] = await Promise.all([obterPdf(pedido.prova, "prova"), pedido.gabarito ? obterPdf(pedido.gabarito, "gabarito") : null]);
          const selecao: Selecao = {
            prova: selecionarPaginas(pedido.paginasProva, await contarPaginas(prova, "prova"), "prova"),
            gabarito: gabarito ? selecionarPaginas(pedido.paginasGabarito, await contarPaginas(gabarito, "gabarito"), "gabarito") : [],
          };
          const n = await nucleo();
          const lv = await levas();
          const id = await n.criarImportacaoPor(ator, { escopo: pedido.escopo, banca: pedido.banca, ano: pedido.ano, caderno: pedido.caderno });
          await atualizarTelas();
          try {
            await lv.guardarOriginal(id, "prova", prova);
            if (gabarito) await lv.guardarOriginal(id, "gabarito", gabarito);
            await lv.guardarSelecao(id, selecao);
          } catch (e) {
            await marcarErro(ator, id, mensagem(e));
            throw new Error(`${mensagem(e)} A importação ${id} ficou marcada com erro.`);
          }

          const total = selecao.prova.length + selecao.gabarito.length;
          let leva = { prontas: 0, faltam: total } as Awaited<ReturnType<typeof lv.desenharProximaLeva>>;
          let nota: string | undefined;
          const decorrido = Date.now() - inicio;
          if (decorrido > MAX_ANTES_DA_PRIMEIRA_LEVA_MS) {
            nota = "O download demorou; o desenho das páginas fica para situacao_importacao.";
          } else {
            const orcamento = Math.min(ORCAMENTO_PRIMEIRA_LEVA_MS, LIMITE_CHAMADA_MS - decorrido);
            // Os originais acabaram de ser guardados: a primeira leva usa os bytes em memória.
            const deps = { ...(await lv.depsPadrao()), lerOriginal: async (_id: string, tipo: TipoArquivo) => (tipo === "gabarito" && gabarito ? gabarito : prova) };
            try {
              leva = await lv.desenharProximaLeva(ator, id, selecao, Date.now, deps, orcamento);
            } catch (e) {
              // Falha passageira (ex.: banco): os originais estão guardados e situacao_importacao continua.
              nota = `A primeira leva parou (${mensagem(e)}); situacao_importacao continua de onde parou.`;
            }
            if (leva.erro) {
              await marcarErro(ator, id, leva.erro);
              throw new Error(`${leva.erro} A importação ${id} ficou marcada com erro.`);
            }
          }
          return textoImportacaoCriada({
            id, rotulo: [pedido.banca, pedido.ano, pedido.caderno].filter(Boolean).join(" "), prontas: leva.prontas, total,
            paginasProva: selecao.prova.length, custo: estimarCustoPaginas(selecao.prova.length), link: linkImportacao(slug, id, "enviando"), nota,
          });
        });
        return texto(resposta);
      } catch (e) {
        return falha("importar a prova", e);
      }
    },
  );

  server.registerTool(
    "situacao_importacao",
    {
      title: "Situação da importação",
      description: "Continua e acompanha uma importação de prova: desenha as páginas que faltam (um pouco por chamada), começa a leitura pela IA quando todas estiverem prontas (uma vez só) e, durante a leitura, busca o resultado e grava as questões, como a tela faz ao atualizar. Chame de novo enquanto disser que faltam páginas.",
      inputSchema: { ...campoImportacao, ...campoTelefone },
    },
    comImportacao(obter, perfil, "situacao_importacao", "ver a importação", async (ator, imp, slug, rodar) =>
      rodar(async () => {
        const n = await nucleo();
        let desenho: { prontas: number; total: number } | undefined;
        let leituraIniciada = false;
        let nota: string | undefined;
        if (imp.status === "enviando") {
          const lv = await levas();
          const selecao = await lv.lerSelecao(imp.id);
          if (!selecao && imp.criado_via === "hermes") {
            throw new Error("Não encontrei as páginas escolhidas desta importação. Importe a prova de novo.");
          } else if (!selecao) {
            nota = "Essa importação foi começada pela tela e as páginas estão sendo enviadas por lá.";
          } else {
            let leva: Awaited<ReturnType<typeof lv.desenharProximaLeva>> | null = null;
            try {
              // Falha passageira (storage/banco) lança: a resposta é de erro, a importação continua
              // "enviando" e a próxima chamada refaz a página.
              leva = await lv.desenharProximaLeva(ator, imp.id, selecao);
            } catch (e) {
              if (mensagem(e) !== ERRO_JA_ENVIADA) throw e; // outra chamada já começou a leitura
            }
            if (leva?.erro) await marcarErro(ator, imp.id, leva.erro);
            else if (leva) {
              desenho = { prontas: leva.prontas, total: leva.prontas + leva.faltam };
              if (leva.faltam === 0) {
                try {
                  await n.iniciarLeituraPor(ator, imp.id); // `reservar` garante uma leitura só
                  leituraIniciada = true;
                } catch (e) {
                  if (mensagem(e) !== "Essa importação já está sendo lida.") throw e; // outra chamada começou antes
                }
              }
            }
          }
        }
        const situacao = await n.atualizarImportacaoPor(ator, imp.id);
        return textoSituacao({ id: imp.id, link: linkImportacao(slug, imp.id, situacao.status), situacao, desenho, leituraIniciada, nota });
      })),
  );

  server.registerTool(
    "ler_de_novo",
    {
      title: "Ler de novo as páginas com erro",
      description: "Manda a IA ler de novo as páginas da prova que deram erro na leitura (o mesmo botão da tela). É pago (cerca de US$ 0,05 por página com erro): antes, resuma e peça confirmação. Depois, acompanhe com situacao_importacao.",
      inputSchema: { ...campoImportacao, ...campoTelefone },
    },
    comImportacao(obter, perfil, "ler_de_novo", "ler de novo", async (ator, imp, _slug, rodar) => {
      await rodar(async () => (await nucleo()).lerDeNovoPor(ator, imp.id));
      return `A IA vai ler de novo as páginas com erro da importação ${imp.id}. Consulte situacao_importacao mais tarde.`;
    }),
  );

  server.registerTool(
    "aprovar_sem_aviso",
    {
      title: "Aprovar questões sem aviso",
      description: "Publica as questões da importação que não têm aviso, não precisam de imagem e têm resposta (ou estão anuladas), como o botão da tela. As outras continuam na conferência. Antes, resuma e peça confirmação.",
      inputSchema: { ...campoImportacao, ...campoTelefone },
    },
    comImportacao(obter, perfil, "aprovar_sem_aviso", "aprovar as questões", async (ator, imp, slug, rodar) => {
      const n = await rodar(async () => (await nucleo()).aprovarSemAvisoPor(ator, imp.id));
      return `${plural(n, "questão publicada", "questões publicadas")} da importação ${imp.id}. As que têm aviso, precisam de imagem ou estão sem resposta continuam na conferência: ${linkImportacao(slug, imp.id, "revisao")}`;
    }),
  );
}
