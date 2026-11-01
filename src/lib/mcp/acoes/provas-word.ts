import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BASE_LINKS_PROVA, gerarProva, lerProva, linksProva, listarProvas, previaProva } from "@/lib/folha/provas-word-servidor";
import { LIMITE_QUESTOES_PROVA, type Cenario } from "@/lib/folha/provas-word";
import { AREAS, MATERIAS } from "@/lib/questoes/materias";
import type { FiltrosSorteio } from "@/lib/simulados/servidor";
import { campoEscola, campoTelefone, dataBR, texto, type Ctx, type ObterCtx } from "../leitura/comum";
import { atorDoEscopo, campoId, contaDoDono, escolaParaCriar, falha, registrado, type Perfil } from "./ator";
import { camposFiltro, filtrosComAssunto, type ArgsFiltro } from "./simulados";

/**
 * Prova em Word pela Hermes: prévia de inéditas, gerar (prova + gabarito por link), histórico e reenvio dos links.
 * As regras ficam no núcleo (`provas-word-servidor`), o mesmo que a página do site usa.
 */

const ERRO_PROVA = "Prova não encontrada.";
const MAX_LISTA = 20;

/** Rótulo da matéria para o título: a matéria; sem ela, a área; senão "Questões". */
function materiaRotulo(f: FiltrosSorteio): string {
  if (f.materia) return (MATERIAS as Record<string, { rotulo: string }>)[f.materia]?.rotulo ?? f.materia;
  if (f.area) return AREAS[f.area];
  return "Questões";
}

/** Professor e escola do pedido (previa/gerar): professor = ele e a escola dele; dono = a conta do dono e a escola pedida. */
async function autorDoPedido(ctx: Ctx, escola?: string) {
  const info = await escolaParaCriar(ctx, escola);
  const ator = await atorDoEscopo(ctx, info.id);
  return { ator, escola: info };
}

/** Quem é o professor nas ferramentas de histórico (sem escola). */
async function professorDoPedido(ctx: Ctx): Promise<string> {
  return ctx.escopo.tipo === "professor" ? ctx.escopo.professorId : (await contaDoDono(ctx)).id;
}

async function pedidoDe(ctx: Ctx, args: ArgsFiltro & { quantidade: number; escola?: string }) {
  const { ator, escola } = await autorDoPedido(ctx, args.escola);
  const { filtros, assuntoNome } = await filtrosComAssunto(ctx, args);
  return {
    ator,
    escola,
    pedido: { escolaId: escola.id, professorId: ator.id, filtros, quantidade: args.quantidade, materiaRotulo: materiaRotulo(filtros), assuntoNome },
  };
}

function rotuloPedido(materia: string, assunto: string | null, banca?: string): string {
  const b = banca?.trim();
  return `${materia}${assunto ? ` · ${assunto}` : ""}${b ? ` (${b.toUpperCase()})` : ""}`;
}

/** Texto da prévia. Pura. */
export function textoPrevia(rotulo: string, c: Cenario): string {
  if (c.elegiveis === 0) return `${rotulo}: nenhuma questão no banco com esses filtros (com figuras e publicadas). Tente outros filtros.`;
  const base = `${rotulo}: ${c.elegiveis} ${c.elegiveis === 1 ? "questão" : "questões"} no banco; você já usou ${c.usadas}; ${c.ineditas} ${c.ineditas === 1 ? "inédita" : "inéditas"}. Pedidas: ${c.pedidas}`;
  if (c.cabeEmIneditas) return `${base} — cabem só em inéditas.`;
  const partes = [`${base} — só há ${c.ineditas} ${c.ineditas === 1 ? "inédita" : "inéditas"} para ${c.pedidas} pedidas.`];
  if (c.elegiveis < c.pedidas) partes.push(`Mesmo completando com já usadas, a prova terá no máximo ${c.elegiveis} ${c.elegiveis === 1 ? "questão" : "questões"}.`);
  return partes.join(" ");
}

function blocoLinks(id: string): string {
  const l = linksProva(id, BASE_LINKS_PROVA);
  return `Prova: ${l.prova}\nGabarito: ${l.gabarito}`;
}

export function registrarAcoesProvasWord(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  const campoQuantidade = {
    quantidade: z.number().int().min(1).max(LIMITE_QUESTOES_PROVA).describe(`Quantas questões (1 a ${LIMITE_QUESTOES_PROVA}).`),
  };
  const escolaDoDono = perfil === "dono" ? campoEscola : {};

  server.registerTool(
    "previa_prova_word",
    {
      title: "Prévia da prova em Word",
      description: "Mostra quantas questões do banco servem para uma prova em Word (com figuras, só publicadas) e quantas o professor ainda não usou. SEMPRE chame antes de gerar_prova_word e, numa única mensagem, conte ao professor o cenário (total, já usadas, inéditas) e pergunte: se faltarem inéditas, se completa com já usadas ou faz uma prova menor; e, se ele não disse, se é atividade de fixação ou simulado.",
      inputSchema: { ...camposFiltro, ...campoQuantidade, ...escolaDoDono, ...campoTelefone },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const { pedido } = await pedidoDe(ctx, args);
        const cenario = await previaProva(pedido);
        return texto(textoPrevia(rotuloPedido(pedido.materiaRotulo, pedido.assuntoNome, args.banca), cenario));
      } catch (e) {
        return falha("ver as questões disponíveis", e);
      }
    },
  );

  server.registerTool(
    "gerar_prova_word",
    {
      title: "Gerar prova em Word",
      description: "Gera a prova em Word e o gabarito (arquivos separados) e devolve os dois links para o professor baixar. Só chame depois de previa_prova_word e da resposta do professor. Mande os links como vieram.",
      inputSchema: {
        ...camposFiltro,
        ...campoQuantidade,
        tipo: z.enum(["fixacao", "simulado"]).describe("fixacao = Atividade de Fixação; simulado = Simulado (só muda o título)."),
        permitir_repetidas: z.boolean().optional().describe("true = completa com questões que o professor já usou em provas em Word, se faltarem inéditas. Padrão: false (só inéditas)."),
        ...escolaDoDono,
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const { ator, pedido } = await pedidoDe(ctx, args);
        const r = await registrado(perfil, ator, "gerar_prova_word", args, () =>
          gerarProva({ ...pedido, tipo: args.tipo, permitirRepetidas: args.permitir_repetidas ?? false, origem: "hermes" }));
        const extras: string[] = [];
        if (r.repetidas > 0) extras.push(`${r.repetidas} já ${r.repetidas === 1 ? "usada" : "usadas"} antes`);
        if (r.total < pedido.quantidade) extras.push(`pedidas ${pedido.quantidade}; não havia mais`);
        const detalhe = extras.length ? ` (${extras.join("; ")})` : "";
        return texto(`Prova "${r.titulo}" com ${r.total} ${r.total === 1 ? "questão" : "questões"}${detalhe}.\n${blocoLinks(r.id)}`);
      } catch (e) {
        return falha("gerar a prova", e);
      }
    },
  );

  server.registerTool(
    "listar_provas_word",
    {
      title: "Listar provas em Word",
      description: "Lista as provas em Word que o professor já gerou (histórico). Use quando ele pedir para reenviar uma prova antiga: se houver mais de uma candidata, mostre título e data e pergunte qual.",
      inputSchema: {
        busca: z.string().trim().max(120).optional().describe('Texto do título, ex: "Biologia" ou "Genética" (opcional).'),
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const provas = await listarProvas(await professorDoPedido(ctx), args.busca);
        if (provas.length === 0) return texto(args.busca?.trim() ? `Nenhuma prova em Word com "${args.busca.trim()}" no histórico.` : "Nenhuma prova em Word no histórico.");
        const linhas = provas.slice(0, MAX_LISTA).map((p) => `${dataBR(p.created_at)} · ${p.titulo} · ${p.total} ${p.total === 1 ? "questão" : "questões"} · id ${p.id}`);
        if (provas.length > MAX_LISTA) linhas.push(`… e mais ${provas.length - MAX_LISTA} mais antigas (use busca para achar).`);
        return texto(linhas.join("\n"));
      } catch (e) {
        return falha("listar as provas", e);
      }
    },
  );

  server.registerTool(
    "links_prova_word",
    {
      title: "Links de uma prova em Word",
      description: "Devolve de novo os links da prova e do gabarito de uma prova do histórico, sem gerar outra.",
      inputSchema: { prova_id: campoId("Id da prova (veja em listar_provas_word)."), ...campoTelefone },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const prova = await lerProva(args.prova_id);
        // Prova de outro professor: mesma mensagem, sem confirmar que o id existe. O dono vê todas.
        if (!prova || prova.excluida) throw new Error(ERRO_PROVA);
        if (ctx.escopo.tipo === "professor" && prova.professor_id !== ctx.escopo.professorId) throw new Error(ERRO_PROVA);
        return texto(`Prova "${prova.titulo}".\n${blocoLinks(prova.id)}`);
      } catch (e) {
        return falha("buscar os links da prova", e);
      }
    },
  );
}
