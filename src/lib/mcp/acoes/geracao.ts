import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { after } from "next/server";
import { z } from "zod";
import { SLUG_PADRAO, urlDaEscola } from "@/lib/dominio";
import { MATERIAS } from "@/lib/questoes/materias";
import { comecarGeracaoPor, concluirGeracaoPor, restanteHojePara } from "@/lib/questoes/geracao-servidor";
import type { AtorEscola } from "@/lib/simulados/ator";
import { campoEscola, campoTelefone, texto, type Ctx, type ObterCtx } from "../leitura/comum";
import { atorDoEscopo, campoId, contaDoDono, escolaParaCriar, falha, registrado, type Perfil } from "./ator";
import {
  criteriosGeracaoRepetida, ERRO_BANCO_ESCOLA_GERACAO, ERRO_GERACAO, escolherNumero, gerandoParou, lerPedidoGeracao,
  MSG_PAROU, textoGeracaoIniciada, textoQuestaoCompleta, textoSituacaoGeracao, type LinhaGerada,
} from "./geracao-hermes";
import { assuntoDaMateria } from "./questoes";

/**
 * Geração de questões por IA pela Hermes: as mesmas regras da tela "Gerar questões" (núcleo com ator).
 * O pedido é registrado na hora e a IA trabalha depois da resposta (`after`); situacao_geracao acompanha.
 */

const ROTULO_DIFICULDADE = { facil: "fácil", media: "média", dificil: "difícil" } as const;

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function slugDaEscola(ctx: Ctx, escolaId: string): Promise<string> {
  const { data } = await ctx.supabase.from("escolas").select("slug").eq("id", escolaId).maybeSingle();
  return (data as { slug?: string } | null)?.slug ?? SLUG_PADRAO;
}

async function atualizarTelas() {
  try {
    (await import("next/cache")).revalidatePath("/banco", "layout");
  } catch {
    // Fora de um pedido do Next (ex.: testes) não há o que atualizar.
  }
}

type Criterios = ReturnType<typeof criteriosGeracaoRepetida>;

/** Id de uma geração igual ainda "gerando", pedida nos últimos 15 minutos, ou null. */
async function geracaoEmAndamento(ctx: Ctx, c: Criterios, comAssunto: boolean): Promise<string | null> {
  let q = ctx.supabase.from("geracoes_ia").select("id")
    .eq("escola_id", c.escola_id).eq("professor_id", c.professor_id).eq("status", c.status)
    .eq("materia", c.materia).eq("dificuldade", c.dificuldade).eq("quantidade_pedida", c.quantidade_pedida)
    .eq("orientacao", c.orientacao).eq("escopo", c.escopo).gte("created_at", c.desde);
  if (comAssunto) q = c.assunto_id === null ? q.is("assunto_id", null) : q.eq("assunto_id", c.assunto_id);
  q = c.questao_base_id === null ? q.is("questao_base_id", null) : q.eq("questao_base_id", c.questao_base_id);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  return (data as { id: string }[] | null)?.[0]?.id ?? null;
}

type LinhaGeracao = {
  id: string; escola_id: string; status: "gerando" | "concluida" | "erro"; erro: string | null; created_at: string;
  custo_usd: number | null; quantidade_pedida: number; quantidade_gerada: number | null; materia: string;
};

type LinhaQuestao = LinhaGerada & { comando: string; alternativas: { letra: string; texto: string }[]; resolucao: string | null };

export function registrarAcoesGeracao(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  server.registerTool(
    "gerar_questoes",
    {
      title: "Gerar questões por IA",
      description: "Gera questões novas com a IA, como a tela \"Gerar questões\" (de 1 a 10 por pedido, com matéria e dificuldade; assunto, orientação e questão modelo são opcionais). As questões entram em revisão. A IA é paga (alguns centavos de dólar por pedido) e há cota diária por escola: antes, resuma o pedido (matéria, assunto, dificuldade, quantidade) e peça confirmação. A resposta volta na hora e a IA leva alguns minutos: depois, chame situacao_geracao com o geracao_id.",
      inputSchema: {
        materia: z.string().trim().max(40).optional().describe('Matéria pelo nome, ex: "Química". Pode faltar se vier questao_modelo_id.'),
        assunto: z.string().trim().max(120).optional().describe("Assunto pelo nome (opcional)."),
        dificuldade: z.enum(["facil", "media", "dificil"]).describe("facil, media ou dificil."),
        quantidade: z.number().int().min(1).max(10).describe("Quantas questões (1 a 10)."),
        orientacao: z.string().trim().max(500).optional().describe("Orientação extra para a IA (opcional, até 500 caracteres)."),
        questao_modelo_id: campoId("Questão modelo: a IA gera parecidas com ela (opcional).").optional(),
        banco: z.enum(["escola", "geral"]).optional().describe('Omita: o padrão já é o certo ("geral" para o dono, "escola" para professor) — não pergunte ao usuário. "escola" = banco da escola; "geral" = banco geral (só o dono).'),
        ...campoEscola,
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const pedido = lerPedidoGeracao(args, perfil);
        const ctx = await obter(args);
        let ator: AtorEscola;
        if (pedido.escopo === "geral") {
          if (ctx.escopo.tipo === "professor") throw new Error(ERRO_BANCO_ESCOLA_GERACAO);
          const dono = await contaDoDono(ctx);
          ator = await atorDoEscopo(ctx, dono.escola_id);
        } else {
          const escola = await escolaParaCriar(ctx, args.escola);
          ator = await atorDoEscopo(ctx, escola.id);
        }

        // Matéria: a do texto ou, só com a questão modelo, a da própria modelo (o núcleo confere a visibilidade).
        let materia = pedido.materia;
        if (!materia && pedido.modeloId) {
          const { data, error } = await ctx.supabase.from("questoes").select("id, materia").eq("id", pedido.modeloId).maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) throw new Error("Questão modelo não encontrada.");
          materia = (data as { materia: string }).materia;
        }
        if (!materia) throw new Error("Diga a matéria (ou a questão modelo).");
        const assuntoId = pedido.assunto ? await assuntoDaMateria(ctx, pedido.assunto, materia, true) : null;

        const bruto = {
          materia, assunto_id: assuntoId, quantidade: pedido.quantidade, dificuldade: pedido.dificuldade,
          orientacao: pedido.orientacao, escopo: pedido.escopo, base_id: pedido.modeloId,
        };
        const rotuloMateria = (MATERIAS as Record<string, { rotulo: string }>)[materia]?.rotulo ?? materia;
        const rotulo = `${rotuloMateria}${pedido.assunto ? ` · ${pedido.assunto}` : ""} (${ROTULO_DIFICULDADE[pedido.dificuldade]})`;

        const resposta = await registrado(perfil, ator, "gerar_questoes", args, async () => {
          // A Hermes pode repetir o pedido depois de um tempo esgotado: não cria (nem cobra) outra igual.
          // Com modelo e sem assunto pedido, o núcleo usa o assunto da modelo: então não filtra por assunto.
          const criterios = criteriosGeracaoRepetida(bruto, ator.escola_id, ator.id, Date.now());
          const repetida = await geracaoEmAndamento(ctx, criterios, !(pedido.modeloId && !pedido.assunto));
          if (repetida) return `Já estou gerando essas questões (geração ${repetida}); use situacao_geracao.`;

          const g = await comecarGeracaoPor(ator, bruto);
          after(async () => {
            try {
              await concluirGeracaoPor(ator, g);
            } catch (e) {
              console.error(`geração ${g.geracaoId}:`, mensagem(e)); // o núcleo já marcou a geração com erro
            }
            await atualizarTelas();
          });
          // A geração já foi registrada: falha ao ler a cota não pode virar erro na resposta.
          const restante = await restanteHojePara(ator).catch(() => null);
          return textoGeracaoIniciada({ id: g.geracaoId, rotulo, quantidade: g.pedido.quantidade, restante });
        });
        return texto(resposta);
      } catch (e) {
        return falha("gerar as questões", e);
      }
    },
  );

  server.registerTool(
    "situacao_geracao",
    {
      title: "Situação da geração de questões",
      description: "Acompanha uma geração de questões por IA (o geracao_id vem na resposta de gerar_questoes): diz se ainda está gerando, se deu erro, ou lista as questões geradas (em revisão), o custo e o link para revisar. Com numero, mostra a questão inteira (enunciado, alternativas, resposta e resolução).",
      inputSchema: {
        geracao_id: campoId("Id da geração (veja na resposta de gerar_questoes)."),
        numero: z.number().int().min(1).optional().describe("Número da questão na lista (1, 2, ...) para ver ela inteira."),
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const { data, error } = await ctx.supabase.from("geracoes_ia")
          .select("id, escola_id, status, erro, created_at, custo_usd, quantidade_pedida, quantidade_gerada, materia")
          .eq("id", args.geracao_id).maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error(ERRO_GERACAO);
        const g = data as LinhaGeracao;
        // Geração de outra escola: mesma mensagem da tela, sem confirmar que o id existe
        const ator = await atorDoEscopo(ctx, g.escola_id, ERRO_GERACAO);
        const agora = Date.now();

        const resposta = await registrado(perfil, ator, "situacao_geracao", args, async () => {
          let status = g.status;
          let erroMsg = g.erro;
          if (status === "gerando" && gerandoParou(g.created_at, agora)) {
            // Só se ainda estiver "gerando": a geração pode ter terminado entre a leitura e agora.
            const { error: erroAtualizar } = await ctx.supabase.from("geracoes_ia")
              .update({ status: "erro", erro: MSG_PAROU }).eq("id", g.id).eq("status", "gerando");
            if (erroAtualizar) throw new Error(erroAtualizar.message);
            status = "erro";
            erroMsg = MSG_PAROU;
          }
          if (status !== "concluida") {
            if (status === "erro") return textoSituacaoGeracao({ id: g.id, status, erro: erroMsg });
            if (args.numero !== undefined) return "A geração ainda não terminou.";
            const minutos = Math.floor((agora - Date.parse(g.created_at)) / 60000);
            return textoSituacaoGeracao({ id: g.id, status, minutos: Number.isNaN(minutos) ? undefined : Math.max(0, minutos) });
          }
          const { data: linhas, error: erroQuestoes } = await ctx.supabase.from("questoes")
            .select("id, enunciado, comando, alternativas, resposta, resolucao, status")
            .eq("geracao_id", g.id).order("created_at");
          if (erroQuestoes) throw new Error(erroQuestoes.message);
          const questoes = (linhas ?? []) as LinhaQuestao[];
          if (args.numero !== undefined) return textoQuestaoCompleta(escolherNumero(questoes, args.numero), args.numero);
          const slug = await slugDaEscola(ctx, g.escola_id);
          return textoSituacaoGeracao({
            id: g.id, status, questoes,
            descartadas: Math.max(0, g.quantidade_pedida - (g.quantidade_gerada ?? 0)),
            custo: g.custo_usd,
            link: urlDaEscola(slug, `/banco?origem=ia&status=revisao&materia=${g.materia}`),
          });
        });
        return texto(resposta);
      } catch (e) {
        return falha("ver a geração", e);
      }
    },
  );
}
