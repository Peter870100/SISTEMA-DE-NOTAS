import { z } from "zod";
import { LIMITE_MAXIMO, TABELAS_LIVRES, validarConsultaLivre, type ConsultaLivreValida } from "@/lib/hermes/consulta-livre";
import { campoTelefone, texto, type Ctx, type Registrar } from "./comum";

const MAX_CARACTERES = 60_000;
const primitivo = z.union([z.string(), z.number(), z.boolean()]);

/** Executa a consulta já validada com o supabase-js (só select; nada de SQL vindo da Hermes). */
async function executar(ctx: Ctx, c: ConsultaLivreValida) {
  let q = ctx.supabase.from(c.tabela).select(c.colunas.join(","), { count: "exact" });
  for (const f of c.filtros) {
    switch (f.op) {
      case "eq": q = q.eq(f.coluna, f.valor); break;
      case "neq": q = q.neq(f.coluna, f.valor); break;
      case "gt": q = q.gt(f.coluna, f.valor); break;
      case "gte": q = q.gte(f.coluna, f.valor); break;
      case "lt": q = q.lt(f.coluna, f.valor); break;
      case "lte": q = q.lte(f.coluna, f.valor); break;
      case "ilike": q = q.ilike(f.coluna, String(f.valor)); break;
      case "in": q = q.in(f.coluna, f.valor as (string | number | boolean)[]); break;
      case "is_null": q = q.is(f.coluna, null); break;
      case "not_null": q = q.not(f.coluna, "is", null); break;
    }
  }
  if (c.ordem) q = q.order(c.ordem.coluna, { ascending: c.ordem.asc });
  const { data, count, error } = await q.limit(c.limite);
  if (error) throw new Error(error.message);
  return { total: count, linhas: data ?? [] };
}

export const registrarConsulta: Registrar = (server, obter) => {
  server.registerTool(
    "consultar_dados",
    {
      title: "Consultar dados (consulta estruturada, só leitura)",
      description: `Lê qualquer tabela permitida quando as outras ferramentas não bastam. Escolha tabela, colunas, filtros (op: eq, neq, gt, gte, lt, lte, ilike, in, is_null, not_null), ordem e limite (1–${LIMITE_MAXIMO}, padrão 100). Tabelas: ${Object.keys(TABELAS_LIVRES).join(", ")}. Devolve JSON.`,
      inputSchema: {
        tabela: z.string(),
        colunas: z.array(z.string()).optional().describe("Omitido = todas as colunas permitidas"),
        filtros: z.array(z.object({
          coluna: z.string(),
          op: z.string(),
          valor: z.union([primitivo, z.array(primitivo)]).optional().describe("Lista para 'in'; vazio para is_null/not_null; use % no ilike"),
        })).optional(),
        ordem: z.object({ coluna: z.string(), asc: z.boolean().optional() }).optional(),
        limite: z.number().optional(),
        ...campoTelefone,
      },
    },
    async (args) => {
      const ctx = await obter(args);
      // Defesa extra: a ferramenta só é registrada no servidor do dono, mas nunca roda para professor.
      if (ctx.escopo.tipo !== "dono") throw new Error("Consulta livre disponível só para o dono.");
      const valida = validarConsultaLivre({ tabela: args.tabela, colunas: args.colunas, filtros: args.filtros, ordem: args.ordem, limite: args.limite });
      if ("erro" in valida) throw new Error(valida.erro);
      const { total, linhas } = await executar(ctx, valida);
      const json = JSON.stringify({ tabela: valida.tabela, total, linhas: linhas.length, dados: linhas }, null, 2);
      if (json.length <= MAX_CARACTERES) return texto(json);
      return texto(`${json.slice(0, MAX_CARACTERES)}\n…\n[Resultado truncado em 60 000 caracteres. Peça menos colunas, filtre mais ou baixe o limite.]`);
    }
  );
};
