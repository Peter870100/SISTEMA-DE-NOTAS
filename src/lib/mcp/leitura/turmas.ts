import { z } from "zod";
import { mediaAluno, mediaDeValores, paraEscala10 } from "@/lib/analytics";
import { situacaoTurmaNoSimulado } from "@/lib/hermes/relatorios";
import { situacaoSimulado, type Situacao } from "@/lib/simulados/regras";
import type { ValorCelula } from "@/lib/status";
import type { Tentativa } from "@/lib/types";
import { podeVerTurma } from "../escopo";
import {
  acharPorNome, campoEscola, campoTelefone, contasDasTurmas, escolasDoPedido, lerPorIds, lerTodas, nota10,
  rotuloEscola, texto, type Ctx, type Registrar, type TurmaAno,
} from "./comum";
import { aulasPublicadas, progressoDasContas, resumoAlunoNoCurso, type ProgressoLido } from "./cursos";
import { resumoSimuladoNaTurma } from "./simulados";

export type TurmaLida = { id: string; escola_id: string; nome: string; bimestre: string; ano_letivo: string; bimestre_vigente: boolean; bimestre_encerrado: boolean };
export const COLUNAS_TURMA = "id, escola_id, nome, bimestre, ano_letivo, bimestre_vigente, bimestre_encerrado";
type ColunaLida = { id: string; titulo: string; tipo: "nota" | "presenca"; ordem: number };
type AlunoLido = { id: string; nome: string; numero: number | null; ordem: number };

/** Planilha de um bimestre (mesmos dados da tela da turma). */
export async function lerPlanilha(ctx: Ctx, turmaId: string, alunoIds?: string[]) {
  const [colunas, alunos] = await Promise.all([
    lerTodas<ColunaLida>((de, ate) => ctx.supabase.from("atividades_colunas").select("id, titulo, tipo, ordem").eq("turma_id", turmaId).order("ordem").order("id").range(de, ate)),
    lerTodas<AlunoLido>((de, ate) => ctx.supabase.from("alunos").select("id, nome, numero, ordem").eq("turma_id", turmaId).order("ordem").order("id").range(de, ate)),
  ]);
  const alvos = alunoIds ? alunos.filter((a) => alunoIds.includes(a.id)) : alunos;
  const notas = await lerPorIds<{ aluno_id: string; coluna_id: string; valor: number | null; status_texto: string | null }>(alvos.map((a) => a.id), (bloco, de, ate) =>
    ctx.supabase.from("notas_celulas").select("aluno_id, coluna_id, valor, status_texto").in("aluno_id", bloco).order("id").range(de, ate));
  const celulas: Record<string, Record<string, ValorCelula>> = {};
  for (const n of notas) (celulas[n.aluno_id] ??= {})[n.coluna_id] = { valor: n.valor === null ? null : Number(n.valor), status_texto: n.status_texto };
  return { colunas, alunos: alvos, celulas };
}

const media10 = (m: number | null) => (m === null ? "—" : nota10(paraEscala10(m)));

/** Turmas (bimestres) visíveis com nome parecido; devolve os grupos escola+nome+ano encontrados. */
export async function acharTurma(ctx: Ctx, escolaIds: string[], busca: string, anoLetivo?: string): Promise<TurmaLida[][]> {
  const todas = await lerTodas<TurmaLida>((de, ate) =>
    ctx.supabase.from("turmas").select(COLUNAS_TURMA).in("escola_id", escolaIds).order("nome").order("bimestre").order("id").range(de, ate));
  const visiveis = todas.filter((t) => podeVerTurma(ctx.escopo, t.escola_id, t.nome) && (!anoLetivo || t.ano_letivo === anoLetivo.trim()));
  const grupos = new Map<string, TurmaLida[]>();
  for (const t of acharPorNome(visiveis, (x) => x.nome, busca)) {
    const k = `${t.escola_id}|${t.nome}|${t.ano_letivo}`;
    grupos.set(k, [...(grupos.get(k) ?? []), t]);
  }
  return [...grupos.values()];
}

export const registrarTurmas: Registrar = (server, obter) => {
  server.registerTool(
    "desempenho_turma",
    {
      title: "Desempenho de uma turma",
      description: "Resumo de uma turma: médias da planilha por bimestre (escala 0–10, como na tela da turma), situação dos simulados da turma (quem entregou, média, quem não começou) e progresso nos cursos ligados a ela.",
      inputSchema: {
        turma: z.string().describe('Nome da turma, ex: "3ª série A"'),
        ano_letivo: z.string().optional().describe('Ex: "2026" — só se houver a mesma turma em anos diferentes'),
        ...campoEscola,
        ...campoTelefone,
      },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      const grupos = await acharTurma(ctx, escolas.map((e) => e.id), args.turma, args.ano_letivo);
      if (grupos.length === 0) throw new Error(`Turma "${args.turma}" não encontrada (ou você não tem acesso a ela).`);
      if (grupos.length > 1) {
        return texto(`Mais de uma turma com "${args.turma}". Qual delas?\n${grupos.slice(0, 20).map((g) => `- ${rotuloEscola(escolas, g[0].escola_id)}${g[0].nome} · ${g[0].ano_letivo}`).join("\n")}`);
      }
      const bimestres = grupos[0];
      const { escola_id, nome, ano_letivo } = bimestres[0];
      const alvo: TurmaAno = { escola_id, turma_nome: nome, ano_letivo };
      const saida = [`${rotuloEscola(escolas, escola_id)}${nome} · ${ano_letivo}`, "", "Planilha (média 0–10 por aluno):"];

      for (const b of bimestres) {
        const { alunos, celulas } = await lerPlanilha(ctx, b.id);
        const valores = Object.values(celulas).flatMap((l) => Object.values(l)).map((c) => c.valor).filter((v): v is number => v !== null);
        const medias = alunos.map((a) => ({ nome: a.nome, m: mediaAluno(celulas[a.id]) }));
        const criticos = medias.filter((x) => x.m !== null && paraEscala10(x.m) < 6).length;
        const estado = b.bimestre_vigente ? " (vigente)" : b.bimestre_encerrado ? " (encerrado)" : "";
        saida.push(`${b.bimestre}${estado}: ${alunos.length} alunos · média da turma ${media10(mediaDeValores(valores))} · abaixo de 6: ${criticos}`);
        if (alunos.length) saida.push(`  ${medias.map((x) => `${x.nome} ${media10(x.m)}`).join(" | ")}`);
      }

      const contas = await contasDasTurmas(ctx, [alvo]);
      const contaIds = [...contas.keys()];
      const alunosContas = [...contas].map(([contaId, c]) => ({ contaId, nome: c.nome }));

      const { data: sts, error: eS } = await ctx.supabase.from("simulado_turmas").select("simulado_id").eq("escola_id", escola_id).eq("turma_nome", nome).eq("ano_letivo", ano_letivo);
      if (eS) throw new Error(eS.message);
      const sims = await lerPorIds<{ id: string; titulo: string; tipo: "professor" | "treino"; status: "rascunho" | "publicado"; abre_em: string | null; fecha_em: string | null; created_at: string }>(
        (sts ?? []).map((s: { simulado_id: string }) => s.simulado_id), (bloco, de, ate) =>
          ctx.supabase.from("simulados").select("id, titulo, tipo, status, abre_em, fecha_em, created_at").in("id", bloco).eq("tipo", "professor").order("id").range(de, ate));
      sims.sort((a, b) => b.created_at.localeCompare(a.created_at));
      saida.push("", `Simulados (${sims.length}; ${contaIds.length} contas de aluno na turma):`);
      if (sims.length === 0) saida.push("- nenhum simulado para esta turma");
      if (sims.length) {
        type T = Pick<Tentativa, "simulado_id" | "conta_id" | "status" | "porcentagem" | "acertos" | "total" | "iniciada_em" | "entregue_em" | "prazo_em" | "tempo_usado_seg" | "saidas" | "tempo_fora_seg" | "eventos_saida">;
        const tents = await lerPorIds<T>(sims.map((s) => s.id), (bloco, de, ate) =>
          ctx.supabase.from("tentativas").select("simulado_id, conta_id, status, porcentagem, acertos, total, iniciada_em, entregue_em, prazo_em, tempo_usado_seg, saidas, tempo_fora_seg, eventos_saida").in("simulado_id", bloco).order("id").range(de, ate));
        const agora = new Date();
        for (const s of sims) {
          const mapa = new Map(tents.filter((t) => t.simulado_id === s.id && contas.has(t.conta_id)).map((t) => [t.conta_id, t]));
          const situacao: Situacao = situacaoSimulado(s, agora);
          saida.push(resumoSimuladoNaTurma(s.titulo, situacao, situacaoTurmaNoSimulado(alunosContas, mapa, "professor")));
        }
      }

      const { data: cts, error: eC } = await ctx.supabase.from("curso_turmas").select("curso_id").eq("escola_id", escola_id).eq("turma_nome", nome).eq("ano_letivo", ano_letivo);
      if (eC) throw new Error(eC.message);
      const cursoIds = (cts ?? []).map((c: { curso_id: string }) => c.curso_id);
      const cursos = await lerPorIds<{ id: string; titulo: string }>(cursoIds, (bloco, de, ate) =>
        ctx.supabase.from("cursos").select("id, titulo").in("id", bloco).order("titulo").range(de, ate));
      saida.push("", `Cursos ligados (${cursos.length}):`);
      if (cursos.length === 0) saida.push("- nenhum curso ligado a esta turma");
      if (cursos.length) {
        const [aulas, progresso] = await Promise.all([aulasPublicadas(ctx, cursoIds), progressoDasContas(ctx, cursoIds, contaIds)]);
        for (const c of cursos) {
          const aulasC = aulas.filter((a) => a.curso_id === c.id);
          saida.push(`- ${c.titulo} (${aulasC.length} aulas publicadas):`);
          const porConta = new Map<string, ProgressoLido[]>();
          for (const p of progresso) if (p.curso_id === c.id) porConta.set(p.conta_id, [...(porConta.get(p.conta_id) ?? []), p]);
          const ordenados = [...alunosContas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
          for (const a of ordenados) saida.push(`  ${a.nome}: ${resumoAlunoNoCurso(aulasC, porConta.get(a.contaId) ?? [])}`);
        }
      }
      return texto(saida.join("\n"));
    }
  );
};
