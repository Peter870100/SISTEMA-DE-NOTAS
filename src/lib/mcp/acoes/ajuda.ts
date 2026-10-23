import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zerarProgressoAulaPor } from "@/lib/aulas/ajuda";
import { encerrarTentativaPor, liberarNovaTentativaPor, recorrigirTentativaPor } from "@/lib/simulados/ajuda";
import { campoTelefone, lerPorIds, lerTodas, pct, type Ctx, type ObterCtx } from "../leitura/comum";
import { campoId, type Perfil } from "./ator";
import { campoAluno, comConta } from "./contas";
import { escolherPorNome, escolherTentativa, type ContaAchada, type PedidoTentativa, type TentativaAchada } from "./contas-regras";

/**
 * Ferramentas de ajuda ao aluno da Hermes (só no perfil dono): nova tentativa, encerrar ou
 * recorrigir uma tentativa e zerar o progresso de uma aula. O aluno é achado pelo nome ou conta_id;
 * o simulado, entre os que o aluno tem tentativa (título igual ou simulado_id). Nome só parecido ou
 * repetido → a resposta lista as opções e nada é feito.
 */

const campoSimulado = {
  simulado: z.string().trim().max(160).optional().describe("Título completo do simulado (título parcial ou repetido só lista as opções)."),
  simulado_id: campoId("Id do simulado (use quando o título se repetir, ex.: dois \"Treino de dd/mm/aaaa\").").optional(),
};

/** As tentativas da conta, com o título do simulado. */
async function tentativasDaConta(ctx: Ctx, contaId: string): Promise<TentativaAchada[]> {
  const ts = await lerTodas<{ id: string; simulado_id: string; status: string; iniciada_em: string }>((de, ate) =>
    ctx.supabase.from("tentativas").select("id, simulado_id, status, iniciada_em").eq("conta_id", contaId).order("iniciada_em").order("id").range(de, ate));
  const sims = await lerPorIds<{ id: string; titulo: string }>(ts.map((t) => t.simulado_id), (bloco, de, ate) =>
    ctx.supabase.from("simulados").select("id, titulo").in("id", bloco).order("id").range(de, ate));
  const titulo = new Map(sims.map((s) => [s.id, s.titulo]));
  return ts.map((t) => ({ id: t.id, simuladoId: t.simulado_id, titulo: titulo.get(t.simulado_id) ?? "(sem título)", status: t.status, iniciadaEm: t.iniciada_em }));
}

async function acharTentativa(ctx: Ctx, conta: ContaAchada, args: { simulado?: string; simulado_id?: string }, status?: PedidoTentativa["status"]) {
  return escolherTentativa(await tentativasDaConta(ctx, conta.id), { simulado: args.simulado, simuladoId: args.simulado_id, status });
}

async function notaDaTentativa(ctx: Ctx, id: string): Promise<string> {
  const { data } = await ctx.supabase.from("tentativas").select("acertos, total, porcentagem").eq("id", id).maybeSingle();
  const t = data as { acertos: number | null; total: number | null; porcentagem: number | null } | null;
  return t && t.total ? ` Resultado: ${t.acertos ?? 0} de ${t.total} (${pct(Number(t.porcentagem ?? 0))}).` : "";
}

export function registrarAcoesAjuda(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  server.registerTool(
    "liberar_nova_tentativa",
    {
      title: "Liberar nova tentativa",
      description: "Manda a tentativa do aluno no simulado para a Lixeira (dá para restaurar) para ele poder fazer de novo. Se o aluno estiver fazendo a prova agora, recusa, a menos que mesmo_em_andamento: true. Antes, resuma e peça confirmação.",
      inputSchema: {
        ...campoAluno, ...campoSimulado,
        mesmo_em_andamento: z.boolean().optional().describe("true = libera mesmo com a prova em andamento (só com pedido explícito)."),
        ...campoTelefone,
      },
    },
    comConta(obter, perfil, "liberar_nova_tentativa", "liberar nova tentativa", async (ctx, ator, conta, args, rodar) => {
      const r = await acharTentativa(ctx, conta, args);
      if ("mensagem" in r) return r.mensagem;
      const t = r.tentativa;
      const lixeiraId = await rodar(() => liberarNovaTentativaPor(ator, t.id, args.mesmo_em_andamento === true), { tentativa_id: t.id });
      return `Tentativa de ${conta.nome} em "${t.titulo}" foi para a Lixeira (item ${lixeiraId}); ele já pode fazer de novo. Dá para restaurar pela Lixeira da escola ${conta.escolaNome}.`;
    }),
  );

  server.registerTool(
    "encerrar_tentativa",
    {
      title: "Encerrar tentativa travada",
      description: "Entrega e corrige agora uma tentativa em andamento do aluno (ex.: a prova travou). Antes, resuma e peça confirmação.",
      inputSchema: { ...campoAluno, ...campoSimulado, ...campoTelefone },
    },
    comConta(obter, perfil, "encerrar_tentativa", "encerrar a tentativa", async (ctx, ator, conta, args, rodar) => {
      const r = await acharTentativa(ctx, conta, args, "em_andamento");
      if ("mensagem" in r) return r.mensagem;
      const t = r.tentativa;
      await rodar(() => encerrarTentativaPor(ator, t.id), { tentativa_id: t.id });
      return `Tentativa de ${conta.nome} em "${t.titulo}" entregue e corrigida.${await notaDaTentativa(ctx, t.id)}`;
    }),
  );

  server.registerTool(
    "recorrigir_tentativa",
    {
      title: "Corrigir tentativa de novo",
      description: "Corrige de novo uma tentativa entregue do aluno (ex.: depois de mudar o gabarito ou anular uma questão).",
      inputSchema: { ...campoAluno, ...campoSimulado, ...campoTelefone },
    },
    comConta(obter, perfil, "recorrigir_tentativa", "corrigir a tentativa de novo", async (ctx, ator, conta, args, rodar) => {
      const r = await acharTentativa(ctx, conta, args, "entregue");
      if ("mensagem" in r) return r.mensagem;
      const t = r.tentativa;
      await rodar(() => recorrigirTentativaPor(ator, t.id), { tentativa_id: t.id });
      return `Tentativa de ${conta.nome} em "${t.titulo}" corrigida de novo.${await notaDaTentativa(ctx, t.id)}`;
    }),
  );

  server.registerTool(
    "zerar_progresso_aula",
    {
      title: "Zerar progresso de uma aula",
      description: "Zera o progresso do aluno numa aula (o registro vai para a Lixeira; dá para restaurar). Use os títulos completos (título parcial só lista as opções). Antes, resuma e peça confirmação.",
      inputSchema: {
        ...campoAluno,
        curso: z.string().trim().min(1).max(160).describe("Título completo do curso."),
        aula: z.string().trim().min(1).max(160).describe("Título completo da aula."),
        ...campoTelefone,
      },
    },
    comConta(obter, perfil, "zerar_progresso_aula", "zerar o progresso da aula", async (ctx, ator, conta, args, rodar) => {
      const cursos = await lerTodas<{ id: string; titulo: string }>((de, ate) =>
        ctx.supabase.from("cursos").select("id, titulo").eq("escola_id", conta.escolaId).order("titulo").order("id").range(de, ate));
      const c = escolherPorNome(cursos, (x) => x.titulo, args.curso, "Curso", "o");
      if ("mensagem" in c) return c.mensagem;
      const curso = c.item;
      const aulas = await lerTodas<{ id: string; titulo: string }>((de, ate) =>
        ctx.supabase.from("aulas").select("id, titulo").eq("curso_id", curso.id).order("ordem").order("id").range(de, ate));
      const a = escolherPorNome(aulas, (x) => x.titulo, args.aula, "Aula", "a");
      if ("mensagem" in a) return a.mensagem;
      const aula = a.item;
      const lixeiraId = await rodar(() => zerarProgressoAulaPor(ator, conta.id, aula.id), { aula_id: aula.id });
      return `Progresso de ${conta.nome} na aula "${aula.titulo}" (${curso.titulo}) zerado; o registro foi para a Lixeira (item ${lixeiraId}). Dá para restaurar pela Lixeira da escola ${conta.escolaNome}.`;
    }),
  );
}
