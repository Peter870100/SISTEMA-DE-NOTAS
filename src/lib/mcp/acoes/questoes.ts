import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { editarQuestaoPor, excluirQuestaoPor, publicarQuestaoPor, type EdicaoQuestao } from "@/lib/questoes/nucleo";
import { MATERIAS } from "@/lib/questoes/materias";
import type { AtorEscola } from "@/lib/simulados/ator";
import { materiaDoTexto } from "../leitura/banco";
import { acharPorNome, campoTelefone, texto, type Ctx, type ObterCtx } from "../leitura/comum";
import { atorDoEscopo, campoId, contaDoDono, ERRO_OUTRA_ESCOLA, falha, registrado, type Perfil } from "./ator";

type QuestaoAlvo = { id: string; escopo: "geral" | "escola"; escola_id: string | null; materia: string };
type Rodar = <T>(acao: () => Promise<T>) => Promise<T>;

/** Lê só o que decide o alcance; o núcleo confere de novo se o ator pode editar. */
async function lerQuestao(ctx: Ctx, id: string): Promise<QuestaoAlvo> {
  const { data, error } = await ctx.supabase.from("questoes").select("id, escopo, escola_id, materia").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Questão não encontrada.");
  return data as QuestaoAlvo;
}

/** Escola onde a ação acontece: a da questão; no banco geral (sem escola), só o dono, na escola da conta dele. */
async function escolaDaQuestao(ctx: Ctx, q: QuestaoAlvo): Promise<string> {
  if (q.escola_id) return q.escola_id;
  if (ctx.escopo.tipo === "professor") throw new Error(`${ERRO_OUTRA_ESCOLA} Questões do banco geral só o dono altera.`);
  return (await contaDoDono(ctx)).escola_id;
}

function atualizarTelas() {
  try {
    revalidatePath("/banco", "layout");
  } catch {
    // Fora de um pedido do Next (ex.: testes) não há o que atualizar.
  }
}

function comQuestao<A extends { questao_id: string; professor_telefone?: string }>(
  obter: ObterCtx, perfil: Perfil, ferramenta: string, verbo: string,
  acao: (ctx: Ctx, ator: AtorEscola, q: QuestaoAlvo, args: A, rodar: Rodar) => Promise<string>,
) {
  return async (args: A) => {
    try {
      const ctx = await obter(args);
      const q = await lerQuestao(ctx, args.questao_id);
      const ator = await atorDoEscopo(ctx, await escolaDaQuestao(ctx, q));
      const rodar: Rodar = (fn) => registrado(perfil, ator, ferramenta, args, fn);
      const resposta = await acao(ctx, ator, q, args, rodar);
      atualizarTelas();
      return texto(resposta);
    } catch (e) {
      return falha(verbo, e);
    }
  };
}

/** Assunto pelo nome dentro da matéria. */
async function assuntoDaMateria(ctx: Ctx, nome: string, materia: string): Promise<string> {
  const { data, error } = await ctx.supabase.from("assuntos").select("id, nome").eq("materia", materia).order("nome").limit(1000);
  if (error) throw new Error(error.message);
  const lista = (data ?? []) as { id: string; nome: string }[];
  const achados = acharPorNome(lista, (a) => a.nome, nome);
  const rotulo = (MATERIAS as Record<string, { rotulo: string }>)[materia]?.rotulo ?? materia;
  if (achados.length === 0) throw new Error(`Assunto "${nome}" não encontrado em ${rotulo}.${lista.length ? ` Assuntos: ${lista.slice(0, 30).map((a) => a.nome).join(", ")}${lista.length > 30 ? "…" : ""}.` : ""}`);
  if (achados.length > 1) throw new Error(`Mais de um assunto com "${nome}": ${achados.slice(0, 15).map((a) => a.nome).join(", ")}. Seja mais específico.`);
  return achados[0].id;
}

const letra = z.enum(["A", "B", "C", "D", "E"]);

export function registrarAcoesQuestoes(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  server.registerTool(
    "editar_questao",
    {
      title: "Editar questão",
      description: "Altera só os campos enviados de uma questão (com as mesmas validações da tela). No texto, **negrito** e *itálico* usam asteriscos (são formatação, não texto). Trocar o enunciado de uma questão com formatação reinicia a formatação do enunciado, e as figuras que estavam no meio do texto vão para o fim. Os avisos voltam na resposta.",
      inputSchema: {
        questao_id: campoId("Id da questão (veja em buscar_questoes)."),
        enunciado: z.string().max(20000).optional().describe("Texto-base/enunciado. **negrito**, *itálico*."),
        comando: z.string().max(5000).optional().describe("Comando da questão (a pergunta)."),
        alternativas: z.array(z.object({ letra, texto: z.string().max(5000) })).min(1).max(5).optional().describe("Só as alternativas que mudam (as outras ficam)."),
        resposta: letra.nullable().optional().describe("Letra certa (A–E) ou null para nenhuma."),
        anulada: z.boolean().optional(),
        materia: z.string().trim().min(1).max(40).optional().describe('Matéria pelo nome, ex: "Química".'),
        assunto: z.string().trim().max(120).nullable().optional().describe("Assunto pelo nome (da matéria nova ou atual); null tira o assunto."),
        ...campoTelefone,
      },
    },
    comQuestao(obter, perfil, "editar_questao", "editar a questão", async (ctx, ator, q, args, rodar) => {
      const e: EdicaoQuestao = {};
      if (args.enunciado !== undefined) e.enunciado = args.enunciado;
      if (args.comando !== undefined) e.comando = args.comando;
      if (args.alternativas !== undefined) e.alternativas = args.alternativas;
      if (args.resposta !== undefined) e.resposta = args.resposta;
      if (args.anulada !== undefined) e.anulada = args.anulada;
      if (args.materia !== undefined) e.materia = materiaDoTexto(args.materia);
      if (args.assunto === null || args.assunto === "") e.assunto_id = null;
      else if (args.assunto !== undefined) e.assunto_id = await assuntoDaMateria(ctx, args.assunto, e.materia ?? q.materia);
      if (Object.keys(e).length === 0) throw new Error("Diga o que mudar.");
      const { avisos } = await rodar(() => editarQuestaoPor(ator, q.id, e));
      return [`Questão ${q.id} atualizada (${Object.keys(e).join(", ")}).`, ...avisos.map((a) => `Aviso: ${a}`)].join(" ");
    }),
  );

  server.registerTool(
    "publicar_questao",
    {
      title: "Publicar questão",
      description: "publicar: true publica a questão (precisa de resposta certa ou ser anulada); false volta para revisão. Antes de publicar, resuma e peça confirmação.",
      inputSchema: { questao_id: campoId("Id da questão."), publicar: z.boolean(), ...campoTelefone },
    },
    comQuestao(obter, perfil, "publicar_questao", "mudar a situação da questão", async (_ctx, ator, q, args, rodar) => {
      await rodar(() => publicarQuestaoPor(ator, q.id, args.publicar));
      return args.publicar ? `Questão ${q.id} publicada.` : `Questão ${q.id} voltou para revisão.`;
    }),
  );

  server.registerTool(
    "mandar_questao_para_lixeira",
    {
      title: "Mandar questão para a Lixeira",
      description: "Manda a questão para a Lixeira (com imagens, vínculos com simulados e respostas dos alunos); dá para restaurar. Antes, resuma e peça confirmação.",
      inputSchema: { questao_id: campoId("Id da questão."), ...campoTelefone },
    },
    comQuestao(obter, perfil, "mandar_questao_para_lixeira", "mandar a questão para a Lixeira", async (_ctx, ator, q, _args, rodar) => {
      const lixeiraId = await rodar(() => excluirQuestaoPor(ator, q.id, "hermes"));
      return `Questão ${q.id} foi para a Lixeira (item ${lixeiraId}). Dá para restaurar pela Lixeira.`;
    }),
  );
}
