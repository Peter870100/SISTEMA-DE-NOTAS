import { z } from "zod";
import { situacaoTurmaNoSimulado, textoResultadoSimulado } from "@/lib/hermes/relatorios";
import { formatarPresenca } from "@/lib/hermes/presenca";
import { MATERIAS } from "@/lib/questoes/materias";
import { formatarDuracao, situacaoSimulado, type Situacao } from "@/lib/simulados/regras";
import type { Simulado, Tentativa } from "@/lib/types";
import { podeVerTurma } from "../escopo";
import {
  acharPorNome, campoEscola, campoTelefone, contasDasTurmas, dataHoraBR, escolasDoPedido, lerPorIds, lerTodas,
  limitarLinhas, pct, rotuloEscola, texto, type Ctx, type EscolaInfo, type TurmaAno,
} from "./comum";
import type { Registrar } from "./comum";

const ROTULO_SITUACAO: Record<Situacao, string> = { rascunho: "rascunho", agendado: "agendado", aberto: "aberto", encerrado: "encerrado" };
const COLUNAS_SIMULADO = "id, escola_id, tipo, professor_id, conta_id, titulo, duracao_min, abre_em, fecha_em, correcao, status, created_at";
type SimuladoLido = Pick<Simulado, "id" | "escola_id" | "tipo" | "professor_id" | "conta_id" | "titulo" | "duracao_min" | "abre_em" | "fecha_em" | "correcao" | "status" | "created_at">;
export type SimuladoVisivel = { sim: SimuladoLido; turmas: TurmaAno[]; situacao: Situacao };

/** Contas que um professor restrito pode ver (alunos das turmas liberadas); null = sem restrição. */
export async function contasPermitidas(ctx: Ctx): Promise<Set<string> | null> {
  const e = ctx.escopo;
  if (e.tipo === "dono" || e.turmas === null) return null;
  const nomes = [...e.turmas];
  if (nomes.length === 0) return new Set();
  const linhas = await lerTodas<{ conta_id: string }>((de, ate) =>
    ctx.supabase.from("aluno_turmas").select("conta_id").eq("escola_id", e.escolaId).in("turma_nome", nomes).order("conta_id").range(de, ate));
  return new Set(linhas.map((l) => l.conta_id));
}

/** Simulados das escolas pedidas que o escopo enxerga, com as turmas-alvo e a situação de agora. */
export async function simuladosVisiveis(ctx: Ctx, escolas: EscolaInfo[], tipo: "professor" | "treino"): Promise<SimuladoVisivel[]> {
  const ids = escolas.map((e) => e.id);
  if (ids.length === 0) return [];
  const sims = await lerTodas<SimuladoLido>((de, ate) =>
    ctx.supabase.from("simulados").select(COLUNAS_SIMULADO).in("escola_id", ids).eq("tipo", tipo)
      .order("created_at", { ascending: false }).order("id").range(de, ate));
  const alvos = await lerPorIds<TurmaAno & { simulado_id: string }>(sims.map((s) => s.id), (bloco, de, ate) =>
    ctx.supabase.from("simulado_turmas").select("simulado_id, escola_id, turma_nome, ano_letivo").in("simulado_id", bloco)
      .order("simulado_id").order("turma_nome").range(de, ate));
  const turmasPor = new Map<string, TurmaAno[]>();
  for (const a of alvos) turmasPor.set(a.simulado_id, [...(turmasPor.get(a.simulado_id) ?? []), { escola_id: a.escola_id, turma_nome: a.turma_nome, ano_letivo: a.ano_letivo }]);
  const permitidas = tipo === "treino" ? await contasPermitidas(ctx) : null;
  const agora = new Date();
  return sims
    .map((sim) => ({ sim, turmas: turmasPor.get(sim.id) ?? [], situacao: situacaoSimulado(sim, agora) }))
    .filter(({ sim, turmas }) => {
      if (ctx.escopo.tipo === "dono") return true;
      if (sim.escola_id !== ctx.escopo.escolaId) return false;
      if (tipo === "treino") return permitidas === null || (!!sim.conta_id && permitidas.has(sim.conta_id));
      return ctx.escopo.turmas === null || turmas.some((t) => podeVerTurma(ctx.escopo, t.escola_id, t.turma_nome));
    });
}

const nomesTurmas = (ts: TurmaAno[]) => (ts.length ? ts.map((t) => `${t.turma_nome} · ${t.ano_letivo}`).join(", ") : "sem turma");

type TentLida = Pick<Tentativa, "id" | "conta_id" | "status" | "porcentagem" | "acertos" | "total" | "iniciada_em" | "entregue_em" | "prazo_em" | "tempo_usado_seg" | "saidas" | "tempo_fora_seg" | "tempo_questoes">;
const COLUNAS_TENTATIVA = "id, conta_id, status, porcentagem, acertos, total, iniciada_em, entregue_em, prazo_em, tempo_usado_seg, saidas, tempo_fora_seg, tempo_questoes";

async function resultado(ctx: Ctx, v: SimuladoVisivel): Promise<string> {
  const { sim } = v;
  const turmas = v.turmas.filter((t) => podeVerTurma(ctx.escopo, t.escola_id, t.turma_nome));
  const contas = await contasDasTurmas(ctx, turmas);
  const tents = await lerTodas<TentLida>((de, ate) =>
    ctx.supabase.from("tentativas").select(COLUNAS_TENTATIVA).eq("simulado_id", sim.id).order("id").range(de, ate));
  const porConta = new Map(tents.filter((t) => contas.has(t.conta_id)).map((t) => [t.conta_id, t]));
  const variasTurmas = turmas.length > 1;
  const alunos = [...contas].map(([contaId, c]) => ({
    contaId,
    nome: variasTurmas ? `${c.nome} (${c.turmas.filter((t) => turmas.some((x) => x.turma_nome === t.turma_nome && x.ano_letivo === t.ano_letivo)).map((t) => t.turma_nome).join(", ")})` : c.nome,
  }));
  const linhas = situacaoTurmaNoSimulado(alunos, porConta, sim.tipo);

  // Questões mais erradas: entre as tentativas entregues que o escopo vê.
  const entregues = [...porConta.values()].filter((t) => t.status === "entregue");
  const maisErradas: { rotulo: string; pct: number; tempoMedioSeg: number | null }[] = [];
  if (entregues.length) {
    const { data: sq, error } = await ctx.supabase.from("simulado_questoes").select("questao_id, ordem").eq("simulado_id", sim.id).order("ordem");
    if (error) throw new Error(error.message);
    const ordem = (sq ?? []) as { questao_id: string; ordem: number }[];
    const questoes = await lerPorIds<{ id: string; banca: string; ano: number | null; numero: number | null; materia: string }>(ordem.map((q) => q.questao_id), (bloco, de, ate) =>
      ctx.supabase.from("questoes").select("id, banca, ano, numero, materia").in("id", bloco).order("id").range(de, ate));
    const infoQ = new Map(questoes.map((q) => [q.id, q]));
    const respostas = await lerPorIds<{ tentativa_id: string; questao_id: string; correta: boolean | null }>(entregues.map((t) => t.id), (bloco, de, ate) =>
      ctx.supabase.from("tentativa_respostas").select("tentativa_id, questao_id, correta").in("tentativa_id", bloco).order("tentativa_id").order("questao_id").range(de, ate));
    const acertos = new Map<string, number>();
    for (const r of respostas) if (r.correta) acertos.set(r.questao_id, (acertos.get(r.questao_id) ?? 0) + 1);
    ordem.forEach((q, i) => {
      const info = infoQ.get(q.questao_id);
      const tempos = entregues.map((t) => t.tempo_questoes?.[q.questao_id]).filter((s): s is number => typeof s === "number" && s > 0);
      const materia = info ? (MATERIAS as Record<string, { rotulo: string }>)[info.materia]?.rotulo ?? info.materia : "";
      const origem = info ? `${info.banca}${info.ano ? ` ${info.ano}` : ""}${info.numero ? ` nº ${info.numero}` : ""}` : "";
      maisErradas.push({
        rotulo: `Questão ${i + 1}${info ? ` (${[origem, materia].filter(Boolean).join(" · ")})` : ""}`,
        pct: (100 * (acertos.get(q.questao_id) ?? 0)) / entregues.length,
        tempoMedioSeg: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null,
      });
    });
    maisErradas.sort((a, b) => a.pct - b.pct);
  }

  const prazo = [sim.abre_em ? `abre ${dataHoraBR(sim.abre_em)}` : null, sim.fecha_em ? `fecha ${dataHoraBR(sim.fecha_em)}` : null, sim.duracao_min ? `${sim.duracao_min} min` : null].filter(Boolean).join(" · ");
  const cab = `Situação: ${ROTULO_SITUACAO[v.situacao]}${prazo ? ` · ${prazo}` : ""} · turmas: ${nomesTurmas(turmas)}`;
  return `${cab}\n${textoResultadoSimulado(sim.titulo, linhas, maisErradas)}`;
}

export const registrarSimulados: Registrar = (server, obter) => {
  server.registerTool(
    "listar_simulados",
    {
      title: "Listar simulados",
      description: "Lista simulados com situação (aberto, agendado, encerrado, rascunho), turmas e quantos alunos começaram/entregaram. tipo 'professor' = provas dos professores (padrão); 'treino' = treinos dos alunos.",
      inputSchema: {
        ...campoEscola,
        situacao: z.enum(["aberto", "agendado", "encerrado", "rascunho"]).optional(),
        tipo: z.enum(["professor", "treino"]).optional(),
        ...campoTelefone,
      },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      const tipo = args.tipo ?? "professor";
      let lista = await simuladosVisiveis(ctx, escolas, tipo);
      if (args.situacao) lista = lista.filter((v) => v.situacao === args.situacao);
      if (lista.length === 0) return texto("Nenhum simulado encontrado com esses filtros.");
      lista = lista.slice(0, 60);
      const tents = await lerPorIds<{ simulado_id: string; conta_id: string; status: string; porcentagem: number | null }>(lista.map((v) => v.sim.id), (bloco, de, ate) =>
        ctx.supabase.from("tentativas").select("simulado_id, conta_id, status, porcentagem").in("simulado_id", bloco).order("id").range(de, ate));
      const cont = new Map<string, { comecaram: number; entregaram: number; porcentagem: number | null }>();
      // Professor restrito: só conta alunos das turmas liberadas.
      const alcance = await contasPermitidas(ctx);
      for (const t of tents) {
        if (alcance && !alcance.has(t.conta_id)) continue;
        const c = cont.get(t.simulado_id) ?? { comecaram: 0, entregaram: 0, porcentagem: null };
        c.comecaram++;
        if (t.status === "entregue") { c.entregaram++; c.porcentagem = t.porcentagem; }
        cont.set(t.simulado_id, c);
      }
      const donos = new Map<string, string>();
      if (tipo === "treino") {
        const contas = await lerPorIds<{ id: string; nome: string }>(lista.map((v) => v.sim.conta_id ?? "").filter(Boolean), (bloco, de, ate) =>
          ctx.supabase.from("alunos_contas").select("id, nome").in("id", bloco).order("id").range(de, ate));
        for (const c of contas) donos.set(c.id, c.nome);
      }
      const linhas = lista.map(({ sim, turmas, situacao }) => {
        const c = cont.get(sim.id) ?? { comecaram: 0, entregaram: 0, porcentagem: null };
        const pre = rotuloEscola(escolas, sim.escola_id);
        if (tipo === "treino") {
          const nota = c.entregaram && c.porcentagem != null ? `entregue, ${pct(Number(c.porcentagem))}` : c.comecaram ? "em andamento" : "não começou";
          return `- ${pre}${sim.titulo} — aluno: ${donos.get(sim.conta_id ?? "") ?? "?"} · ${nota} · criado ${dataHoraBR(sim.created_at)}`;
        }
        const visiveis = turmas.filter((t) => podeVerTurma(ctx.escopo, t.escola_id, t.turma_nome));
        const prazo = sim.fecha_em ? ` · fecha ${dataHoraBR(sim.fecha_em)}` : "";
        return `- ${pre}${sim.titulo} — ${ROTULO_SITUACAO[situacao]}${prazo} · turmas: ${nomesTurmas(visiveis)} · ${c.entregaram} entregaram, ${c.comecaram} começaram`;
      });
      return texto(linhas.join("\n") + (lista.length === 60 ? "\n(mostrando os 60 mais recentes; filtre por situação ou escola para ver outros)" : ""));
    }
  );

  server.registerTool(
    "resultado_simulado",
    {
      title: "Resultado de um simulado",
      description: "Mostra, aluno por aluno, quem entregou (nota, tempo, saídas da página), quem está fazendo e quem não começou, mais as questões mais erradas. Acha o simulado pelo título.",
      inputSchema: { simulado: z.string().describe("Título (ou parte) do simulado"), ...campoEscola, ...campoTelefone },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      const candidatos = acharPorNome(await simuladosVisiveis(ctx, escolas, "professor"), (v) => v.sim.titulo, args.simulado);
      if (candidatos.length === 0) throw new Error(`Simulado "${args.simulado}" não encontrado.`);
      if (candidatos.length > 1) {
        const opcoes = limitarLinhas(candidatos.map((v) => `- ${rotuloEscola(escolas, v.sim.escola_id)}"${v.sim.titulo}" (${ROTULO_SITUACAO[v.situacao]}, ${nomesTurmas(v.turmas.filter((t) => podeVerTurma(ctx.escopo, t.escola_id, t.turma_nome)))})`), 20, "Use um título mais completo.");
        return texto(`Mais de um simulado com "${args.simulado}". Qual deles?\n${opcoes.join("\n")}`);
      }
      return texto(await resultado(ctx, candidatos[0]));
    }
  );
};

/** Resumo de cada simulado numa turma (usado em desempenho_turma). */
export function resumoSimuladoNaTurma(titulo: string, situacao: Situacao, linhas: ReturnType<typeof situacaoTurmaNoSimulado>): string {
  const ent = linhas.filter((l) => l.status === "entregue");
  const notas = ent.map((l) => l.porcentagem).filter((p): p is number => p != null);
  const media = notas.length ? ` · média ${pct(notas.reduce((a, b) => a + b, 0) / notas.length)}` : "";
  const nao = linhas.filter((l) => l.status === "nao_comecou").map((l) => l.nome);
  const andamento = linhas.filter((l) => l.status === "em_andamento").length;
  const tempos = ent.map((l) => l.tempoSeg).filter((s): s is number => s != null);
  const tempo = tempos.length ? ` · tempo médio ${formatarDuracao(tempos.reduce((a, b) => a + b, 0) / tempos.length)}` : "";
  const saidas = ent.reduce((s, l) => s + (l.saidas ?? 0), 0);
  const fora = ent.reduce((s, l) => s + (l.tempoForaSeg ?? 0), 0);
  const presenca = ent.some((l) => l.saidas != null) ? ` · saídas somadas: ${formatarPresenca(saidas, fora)}` : "";
  return `- ${titulo} (${ROTULO_SITUACAO[situacao]}): ${ent.length} ${ent.length === 1 ? "entregou" : "entregaram"}, ${andamento} em andamento, ${nao.length} ${nao.length === 1 ? "não começou" : "não começaram"}${media}${tempo}${presenca}${nao.length ? `\n  não começaram: ${nao.join(", ")}` : ""}`;
}

export { ROTULO_SITUACAO };
