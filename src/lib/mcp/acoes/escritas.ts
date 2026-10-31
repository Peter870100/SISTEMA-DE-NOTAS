import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SLUG_PADRAO, urlDaEscola } from "@/lib/dominio";
import { textoQuestoesSalvas } from "@/lib/questoes/escritas";
import { salvarQuestoesEscritasPor } from "@/lib/questoes/geracao-servidor";
import type { Materia } from "@/lib/questoes/materias";
import { campoEscola, campoTelefone, texto, type ObterCtx } from "../leitura/comum";
import { materiaDoTexto } from "../leitura/banco";
import { atorDoEscopo, contaDoDono, falha, registrado, type Perfil } from "./ator";
import { assuntoDaMateria } from "./questoes";

/** Questões escritas pelo próprio Claude (assinatura), gravadas sem IA paga. Só no MCP do dono. */

const LETRA = z.enum(["A", "B", "C", "D", "E"]);
const TEXTO = z.string().trim().min(1);

async function atualizarTelas() {
  try {
    (await import("next/cache")).revalidatePath("/banco", "layout");
  } catch {
    // Fora de um pedido do Next (ex.: testes) não há o que atualizar.
  }
}

export function registrarAcoesEscritas(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  server.registerTool(
    "salvar_questoes",
    {
      title: "Salvar questões escritas por você",
      description: "Grava questões que VOCÊ já escreveu (não chama IA, sem custo) no banco geral, em revisão. Use só quando o Peter pedir questões escritas por você; para a IA do site use gerar_questoes. De 1 a 10 por chamada, cada uma com enunciado, comando, 5 alternativas (A a E, todas diferentes), resposta e resolução. Fórmulas em texto Unicode (x², ½, √, ×), nunca LaTeX; negrito **assim** e itálico *assim*; créditos do texto (autor, \"Disponível em:\") no último parágrafo do enunciado. Devolve os ids na ordem enviada.",
      inputSchema: {
        materia: z.string().trim().max(40).describe('Matéria pelo nome, ex: "Química".'),
        assunto: z.string().trim().max(120).optional().describe("Assunto pelo nome (opcional)."),
        dificuldade: z.enum(["facil", "media", "dificil"]).describe("facil, media ou dificil."),
        questoes: z.array(z.object({
          enunciado: TEXTO.describe("Enunciado (texto-base incluso)."),
          comando: TEXTO.describe("A pergunta final."),
          alternativas: z.array(z.object({ letra: LETRA, texto: z.string() })).describe("As 5 alternativas, A a E."),
          resposta: LETRA.describe("Letra da alternativa certa."),
          resolucao: TEXTO.describe("Resolução comentada."),
        })).min(1).max(10).describe("De 1 a 10 questões."),
        ...campoEscola,
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const dono = await contaDoDono(ctx);
        const ator = await atorDoEscopo(ctx, dono.escola_id);
        const materia = materiaDoTexto(args.materia) as Materia;
        const assuntoId = args.assunto ? await assuntoDaMateria(ctx, args.assunto, materia, true) : null;

        const resposta = await registrado(
          perfil, ator, "salvar_questoes",
          { materia, assunto: args.assunto, dificuldade: args.dificuldade, quantidade: args.questoes.length },
          async () => {
            const r = await salvarQuestoesEscritasPor(ator, {
              materia, assunto_id: assuntoId, dificuldade: args.dificuldade, questoes: args.questoes,
            });
            await atualizarTelas();
            const { data } = await ctx.supabase.from("escolas").select("slug").eq("id", ator.escola_id).maybeSingle();
            const slug = (data as { slug?: string } | null)?.slug ?? SLUG_PADRAO;
            return textoQuestoesSalvas({ ...r, link: urlDaEscola(slug, `/banco?origem=ia&status=revisao&materia=${materia}`) });
          },
        );
        return texto(resposta);
      } catch (e) {
        return falha("salvar as questões", e);
      }
    },
  );
}
