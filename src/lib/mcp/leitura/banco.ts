import { z } from "zod";
import { normalizarBusca } from "@/lib/hermes/relatorios";
import { padraoExato } from "@/lib/questoes/busca";
import { AREAS, MATERIAS } from "@/lib/questoes/materias";
import {
  campoEscola, campoTelefone, dataHoraBR, escolasDoPedido, lerPorIds, lerTodas, texto, type Ctx, type EscolaInfo, type Registrar,
} from "./comum";

const ROTULO_MATERIA = MATERIAS as Record<string, { rotulo: string }>;
const rotuloMateria = (m: string) => ROTULO_MATERIA[m]?.rotulo ?? m;

/**
 * Filtro .or() das questões visíveis, igual à tela /banco. Os valores são ids vindos do banco (uuid), nunca texto da Hermes.
 * - professor: geral publicado + da escola (admin/dono da conta: todas da escola; professor comum: publicadas ou as próprias);
 * - dono (servidor do dono): tudo, ou o geral + as escolas pedidas.
 */
function filtroVisiveis(ctx: Ctx, escolas: EscolaInfo[], pediuEscola: boolean): string | null {
  const e = ctx.escopo;
  if (e.tipo === "professor") {
    const admin = e.papel === "admin" || e.papel === "dono";
    return `and(escopo.eq.geral,status.eq.publicada),${admin
      ? `and(escopo.eq.escola,escola_id.eq.${e.escolaId})`
      : `and(escopo.eq.escola,escola_id.eq.${e.escolaId},or(status.eq.publicada,criado_por.eq.${e.professorId}))`}`;
  }
  if (!pediuEscola) return null;
  return `escopo.eq.geral,escola_id.in.(${escolas.map((e) => e.id).join(",")})`;
}

function materiaDoTexto(t: string): string {
  const alvo = normalizarBusca(t);
  const chave = Object.keys(MATERIAS).find((k) => k === alvo.replace(/ /g, "_") || normalizarBusca(ROTULO_MATERIA[k].rotulo) === alvo);
  if (!chave) throw new Error(`Matéria "${t}" não existe. Use uma destas: ${Object.values(ROTULO_MATERIA).map((m) => m.rotulo).join(", ")}.`);
  return chave;
}

const contar = <T,>(lista: T[], chave: (x: T) => string) => {
  const m = new Map<string, number>();
  for (const x of lista) m.set(chave(x), (m.get(chave(x)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};

export const registrarBanco: Registrar = (server, obter) => {
  server.registerTool(
    "buscar_questoes",
    {
      title: "Buscar questões do banco",
      description: "Busca questões no banco por banca, ano, matéria, área, situação (revisao/publicada) e texto do enunciado. Devolve id, origem, matéria, situação e o começo do enunciado.",
      inputSchema: {
        banca: z.string().optional().describe('Ex: "ENEM", "UFMS"'),
        ano: z.number().int().optional(),
        materia: z.string().optional().describe('Ex: "Química", "historia"'),
        area: z.enum(["linguagens", "humanas", "natureza", "matematica"]).optional(),
        situacao: z.enum(["revisao", "publicada"]).optional(),
        texto: z.string().max(200).optional().describe("Trecho do enunciado"),
        limite: z.number().int().min(1).max(100).optional().describe("Padrão 20"),
        ...campoEscola,
        ...campoTelefone,
      },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      const vis = filtroVisiveis(ctx, escolas, !!args.escola?.trim());
      let q = ctx.supabase.from("questoes").select("id, escola_id, banca, ano, numero, caderno, area, materia, status, escopo, enunciado", { count: "exact" });
      if (vis) q = q.or(vis);
      if (args.banca?.trim()) q = q.ilike("banca", padraoExato(args.banca));
      if (args.ano) q = q.eq("ano", args.ano);
      if (args.materia?.trim()) q = q.eq("materia", materiaDoTexto(args.materia));
      if (args.area) q = q.eq("area", args.area);
      if (args.situacao) q = q.eq("status", args.situacao);
      if (args.texto?.trim()) q = q.ilike("enunciado", `%${padraoExato(args.texto)}%`);
      const { data, count, error } = await q.order("banca").order("ano", { ascending: false }).order("numero").limit(args.limite ?? 20);
      if (error) throw new Error(error.message);
      const linhas = (data ?? []) as { id: string; escola_id: string | null; banca: string; ano: number | null; numero: number | null; caderno: string; area: string; materia: string; status: string; escopo: string; enunciado: string }[];
      if (linhas.length === 0) return texto("Nenhuma questão encontrada com esses filtros.");
      const nomeEscola = new Map(escolas.map((e) => [e.id, e.nome]));
      const resumo = (s: string) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > 120 ? `${t.slice(0, 120)}…` : t; };
      return texto([
        `${count ?? linhas.length} questões encontradas (mostrando ${linhas.length}):`,
        ...linhas.map((x) => `- ${x.id} · ${x.banca}${x.ano ? ` ${x.ano}` : ""}${x.numero ? ` nº ${x.numero}` : ""}${x.caderno ? ` (${x.caderno})` : ""} · ${rotuloMateria(x.materia)} · ${x.status === "publicada" ? "publicada" : "em revisão"}${x.escopo === "escola" ? ` · da escola${ctx.escopo.tipo === "dono" ? ` ${nomeEscola.get(x.escola_id ?? "") ?? "?"}` : ""}` : ""} — ${resumo(x.enunciado) || "(sem enunciado)"}`),
      ].join("\n"));
    }
  );

  server.registerTool(
    "estatisticas_banco",
    {
      title: "Estatísticas do banco de questões",
      description: "Números do banco de questões: total, publicadas, em revisão, por área, por matéria e por banca/ano.",
      inputSchema: { ...campoEscola, ...campoTelefone },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      const vis = filtroVisiveis(ctx, escolas, !!args.escola?.trim());
      type Q = { escopo: string; escola_id: string | null; banca: string; ano: number | null; area: string; materia: string; status: string; precisa_revisao: boolean };
      const qs = await lerTodas<Q>((de, ate) => {
        let q = ctx.supabase.from("questoes").select("escopo, escola_id, banca, ano, area, materia, status, precisa_revisao");
        if (vis) q = q.or(vis);
        return q.order("id").range(de, ate);
      });
      if (qs.length === 0) return texto("O banco de questões está vazio.");
      const pub = qs.filter((q) => q.status === "publicada");
      const nomeEscola = new Map(escolas.map((e) => [e.id, e.nome]));
      const saida = [
        `${qs.length} questões: ${pub.length} publicadas · ${qs.length - pub.length} em revisão · ${qs.filter((q) => q.precisa_revisao).length} marcadas para revisar`,
        `Origem: ${contar(qs, (q) => (q.escopo === "geral" ? "banco geral" : nomeEscola.get(q.escola_id ?? "") ?? "escola")).map(([k, n]) => `${k} ${n}`).join(" · ")}`,
        `Publicadas por área: ${contar(pub, (q) => AREAS[q.area as keyof typeof AREAS] ?? q.area).map(([k, n]) => `${k} ${n}`).join(" · ") || "nenhuma"}`,
        `Publicadas por matéria: ${contar(pub, (q) => rotuloMateria(q.materia)).map(([k, n]) => `${k} ${n}`).join(" · ") || "nenhuma"}`,
        "Por banca e ano (publicadas/total):",
        ...contar(qs, (q) => `${q.banca}${q.ano ? ` ${q.ano}` : ""}`).slice(0, 30).map(([k, n]) => `- ${k}: ${pub.filter((q) => `${q.banca}${q.ano ? ` ${q.ano}` : ""}` === k).length}/${n}`),
      ];
      return texto(saida.join("\n"));
    }
  );

  server.registerTool(
    "listar_importacoes",
    {
      title: "Listar importações de questões",
      description: "Últimas importações de provas para o banco de questões (PDF ou enem.dev): situação, páginas lidas, questões geradas e erros.",
      inputSchema: { ...campoEscola, ...campoTelefone },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      let q = ctx.supabase.from("importacoes").select("id, escopo, escola_id, origem, banca, ano, caderno, status, total_paginas, paginas_lidas, erro, created_at");
      if (ctx.escopo.tipo === "professor") q = q.eq("escola_id", ctx.escopo.escolaId);
      else if (args.escola?.trim()) q = q.in("escola_id", escolas.map((e) => e.id));
      const { data, error } = await q.order("created_at", { ascending: false }).limit(30);
      if (error) throw new Error(error.message);
      const imps = (data ?? []) as { id: string; escopo: string; escola_id: string | null; origem: string; banca: string; ano: number | null; caderno: string; status: string; total_paginas: number; paginas_lidas: number; erro: string | null; created_at: string }[];
      if (imps.length === 0) return texto("Nenhuma importação encontrada.");
      const qs = await lerPorIds<{ importacao_id: string; status: string }>(imps.map((i) => i.id), (bloco, de, ate) =>
        ctx.supabase.from("questoes").select("importacao_id, status").in("importacao_id", bloco).order("id").range(de, ate));
      const nomeEscola = new Map(escolas.map((e) => [e.id, e.nome]));
      return texto(imps.map((i) => {
        const minhas = qs.filter((x) => x.importacao_id === i.id);
        const pub = minhas.filter((x) => x.status === "publicada").length;
        const onde = i.escopo === "geral" ? "banco geral" : nomeEscola.get(i.escola_id ?? "") ?? "escola";
        return `- ${i.banca}${i.ano ? ` ${i.ano}` : ""}${i.caderno ? ` (${i.caderno})` : ""} · ${i.origem === "pdf" ? "PDF" : "enem.dev"} · ${onde} — ${i.status}${i.origem === "pdf" ? ` · ${i.paginas_lidas}/${i.total_paginas} páginas` : ""} · ${minhas.length} questões (${pub} publicadas) · ${dataHoraBR(i.created_at)}${i.erro ? ` · erro: ${i.erro.slice(0, 200)}` : ""}`;
      }).join("\n"));
    }
  );
};
