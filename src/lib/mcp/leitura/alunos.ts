import { z } from "zod";
import { mediaAluno, paraEscala10 } from "@/lib/analytics";
import { presencaTentativa } from "@/lib/hermes/presenca";
import { normalizarBusca } from "@/lib/hermes/relatorios";
import { formatarDuracao, tempoDeProvaSeg } from "@/lib/simulados/regras";
import type { Tentativa } from "@/lib/types";
import { podeVerTurma } from "../escopo";
import {
  acharPorNome, campoEscola, campoTelefone, dataBR, dataHoraBR, escolasDoPedido, lerPorIds, lerTodas, limitarLinhas,
  nota10, pct, rotuloEscola, texto, type Ctx, type Registrar, type TurmaAno,
} from "./comum";
import { aulasPublicadas, cursosVisiveis, progressoAula, progressoDasContas, resumoAlunoNoCurso } from "./cursos";
import { COLUNAS_TURMA, lerPlanilha, type TurmaLida } from "./turmas";

type ContaLida = { id: string; escola_id: string; nome: string; email: string | null; usuario: string | null; ativo: boolean; ultimo_acesso: string | null; created_at: string };
// Sem senha_hash, tokens nem foto: colunas sempre explícitas.
const COLUNAS_CONTA = "id, escola_id, nome, email, usuario, ativo, ultimo_acesso, created_at";
type Vinculo = TurmaAno & { conta_id: string; aluno_id: string | null };

/** Contas das escolas, cada uma com suas turmas, já filtradas pelo que o escopo vê. */
async function contasVisiveis(ctx: Ctx, escolaIds: string[], nomeBusca?: string): Promise<{ conta: ContaLida; turmas: Vinculo[] }[]> {
  let contas = await lerTodas<ContaLida>((de, ate) =>
    ctx.supabase.from("alunos_contas").select(COLUNAS_CONTA).in("escola_id", escolaIds).order("nome").order("id").range(de, ate));
  const e = ctx.escopo;
  // Professor restrito: o escopo é aplicado antes da busca por nome (como em acharTurma), para o nome não casar com quem ele não vê.
  const buscarAntes = nomeBusca !== undefined && !(e.tipo === "professor" && e.turmas !== null);
  if (buscarAntes) contas = acharPorNome(contas, (c) => c.nome, nomeBusca);
  const vinculos = await lerPorIds<Vinculo>(contas.map((c) => c.id), (bloco, de, ate) =>
    ctx.supabase.from("aluno_turmas").select("conta_id, escola_id, turma_nome, ano_letivo, aluno_id").in("conta_id", bloco).order("conta_id").order("turma_nome").range(de, ate));
  const porConta = new Map<string, Vinculo[]>();
  for (const v of vinculos) porConta.set(v.conta_id, [...(porConta.get(v.conta_id) ?? []), v]);
  const visiveis = contas
    .map((conta) => ({ conta, turmas: porConta.get(conta.id) ?? [] }))
    .filter(({ conta, turmas }) => {
      if (e.tipo === "dono") return true;
      if (conta.escola_id !== e.escolaId) return false;
      return e.turmas === null || turmas.some((t) => podeVerTurma(e, t.escola_id, t.turma_nome));
    });
  if (nomeBusca !== undefined && !buscarAntes) {
    const nomes = new Set(acharPorNome(visiveis, (x) => x.conta.nome, nomeBusca).map((x) => x.conta.id));
    return visiveis.filter((x) => nomes.has(x.conta.id));
  }
  return visiveis;
}

const restrito = (ctx: Ctx) => ctx.escopo.tipo === "professor" && ctx.escopo.turmas !== null;
const login = (c: ContaLida) => [c.usuario ? `usuário ${c.usuario}` : null, c.email].filter(Boolean).join(" · ") || "sem login";
const turmasTxt = (ts: TurmaAno[]) => (ts.length ? ts.map((t) => `${t.turma_nome} · ${t.ano_letivo}`).join(", ") : "sem turma");

async function perfil(ctx: Ctx, conta: ContaLida, todosVinculos: Vinculo[]): Promise<string> {
  const vinculos = todosVinculos.filter((v) => podeVerTurma(ctx.escopo, v.escola_id, v.turma_nome));
  const saida = [
    `${conta.nome} — ${login(conta)}${conta.ativo ? "" : " · CONTA DESATIVADA"}`,
    `Turmas: ${turmasTxt(vinculos)} · último acesso: ${conta.ultimo_acesso ? dataHoraBR(conta.ultimo_acesso) : "nunca entrou"} · conta criada em ${dataBR(conta.created_at)}`,
  ];

  // Notas da planilha: a turma de mesmo nome (todos os bimestres), achando o aluno pelo vínculo ou pelo nome.
  saida.push("", "Planilha:");
  let achouPlanilha = false;
  for (const v of vinculos) {
    const bims = await lerTodas<TurmaLida>((de, ate) =>
      ctx.supabase.from("turmas").select(COLUNAS_TURMA).eq("escola_id", v.escola_id).eq("nome", v.turma_nome).eq("ano_letivo", v.ano_letivo).order("bimestre").range(de, ate));
    for (const b of bims) {
      const { colunas, alunos, celulas } = await lerPlanilha(ctx, b.id);
      const aluno = alunos.find((a) => a.id === v.aluno_id) ?? alunos.find((a) => normalizarBusca(a.nome) === normalizarBusca(conta.nome));
      if (!aluno) continue;
      achouPlanilha = true;
      const minhas = celulas[aluno.id] ?? {};
      const m = mediaAluno(minhas);
      const notas = colunas.filter((c) => c.tipo === "nota").map((c) => {
        const cel = minhas[c.id];
        return `${c.titulo} ${cel?.valor ?? cel?.status_texto ?? "—"}`;
      });
      const pres = colunas.filter((c) => c.tipo === "presenca").map((c) => minhas[c.id]?.status_texto?.trim().toUpperCase());
      const p = pres.filter((s) => s === "P").length, f = pres.filter((s) => s === "F").length;
      saida.push(`- ${b.nome} · ${b.bimestre}: média ${m === null ? "—" : nota10(paraEscala10(m))}${p + f ? ` · presença ${p} P / ${f} F` : ""}${notas.length ? `\n  ${notas.join(" | ")}` : ""}`);
    }
  }
  if (!achouPlanilha) saida.push("- não achei este aluno na planilha das turmas dele");

  type T = Pick<Tentativa, "simulado_id" | "status" | "porcentagem" | "acertos" | "total" | "iniciada_em" | "entregue_em" | "prazo_em" | "tempo_usado_seg" | "saidas" | "tempo_fora_seg" | "eventos_saida">;
  const tents = await lerTodas<T>((de, ate) =>
    ctx.supabase.from("tentativas").select("simulado_id, status, porcentagem, acertos, total, iniciada_em, entregue_em, prazo_em, tempo_usado_seg, saidas, tempo_fora_seg, eventos_saida").eq("conta_id", conta.id).order("iniciada_em", { ascending: false }).range(de, ate));
  const sims = await lerPorIds<{ id: string; titulo: string; tipo: "professor" | "treino" }>(tents.map((t) => t.simulado_id), (bloco, de, ate) =>
    ctx.supabase.from("simulados").select("id, titulo, tipo").in("id", bloco).order("id").range(de, ate));
  const sim = new Map(sims.map((s) => [s.id, s]));
  // Professor restrito: só provas com turma-alvo liberada (treinos são do próprio aluno, que ele já vê).
  let tentsVis = tents;
  if (restrito(ctx)) {
    const alvos = await lerPorIds<{ simulado_id: string; escola_id: string; turma_nome: string }>(sims.filter((s) => s.tipo === "professor").map((s) => s.id), (bloco, de, ate) =>
      ctx.supabase.from("simulado_turmas").select("simulado_id, escola_id, turma_nome").in("simulado_id", bloco).order("simulado_id").order("turma_nome").range(de, ate));
    const liberados = new Set(alvos.filter((a) => podeVerTurma(ctx.escopo, a.escola_id, a.turma_nome)).map((a) => a.simulado_id));
    tentsVis = tents.filter((t) => sim.get(t.simulado_id)?.tipo === "treino" || liberados.has(t.simulado_id));
  }
  saida.push("", `Simulados e treinos (${tentsVis.length}):`);
  if (tentsVis.length === 0) saida.push("- nenhum");
  saida.push(...limitarLinhas(tentsVis.map((t) => {
    const s = sim.get(t.simulado_id);
    const tipo = s?.tipo ?? "professor";
    const nome = `${s?.titulo ?? "?"} (${tipo === "treino" ? "treino" : "prova"})`;
    const presenca = `saídas: ${presencaTentativa(t)}`;
    if (t.status !== "entregue") return `- ${nome}: em andamento desde ${dataHoraBR(t.iniciada_em)} · ${presenca}`;
    const tempo = tempoDeProvaSeg(tipo, t);
    return `- ${nome}: ${pct(Number(t.porcentagem ?? 0))} (${t.acertos ?? 0}/${t.total ?? 0}) · ${tempo != null ? formatarDuracao(tempo) : "—"} · ${presenca} · entregue ${dataHoraBR(t.entregue_em)}`;
  }), 40, "Use consultar_dados para ver todos."));

  // Cursos: os ligados às turmas do aluno e os que ele já começou.
  const ligados = await lerTodas<{ curso_id: string; turma_nome: string; ano_letivo: string }>((de, ate) =>
    ctx.supabase.from("curso_turmas").select("curso_id, turma_nome, ano_letivo").eq("escola_id", conta.escola_id).order("curso_id").range(de, ate));
  const minhasTurmas = new Set(vinculos.map((v) => `${v.turma_nome}|${v.ano_letivo}`));
  const progressoTodos = await lerTodas<{ curso_id: string }>((de, ate) =>
    ctx.supabase.from("aula_progresso").select("curso_id").eq("conta_id", conta.id).order("aula_id").range(de, ate));
  let cursoIds = [...new Set([...ligados.filter((l) => minhasTurmas.has(`${l.turma_nome}|${l.ano_letivo}`)).map((l) => l.curso_id), ...progressoTodos.map((p) => p.curso_id)])];
  if (restrito(ctx)) {
    // Professor restrito: só cursos dele ou ligados a turmas liberadas.
    const visiveis = new Set((await cursosVisiveis(ctx, [{ id: conta.escola_id, nome: "", slug: "" }])).map((c) => c.curso.id));
    cursoIds = cursoIds.filter((id) => visiveis.has(id));
  }
  const cursos = await lerPorIds<{ id: string; titulo: string }>(cursoIds, (bloco, de, ate) =>
    ctx.supabase.from("cursos").select("id, titulo").in("id", bloco).order("titulo").range(de, ate));
  const prog = await progressoDasContas(ctx, cursoIds, [conta.id]);
  const aulas = await aulasPublicadas(ctx, cursoIds);
  saida.push("", `Cursos (${cursos.length}):`);
  if (cursos.length === 0) saida.push("- nenhum");
  for (const c of cursos) {
    const aulasC = aulas.filter((a) => a.curso_id === c.id);
    const meus = new Map(prog.filter((p) => p.curso_id === c.id).map((p) => [p.aula_id, p]));
    saida.push(`- ${c.titulo}: ${resumoAlunoNoCurso(aulasC, [...meus.values()])}`);
    saida.push(...limitarLinhas(aulasC.filter((a) => meus.has(a.id)).map((a) => `  - ${a.titulo}: ${progressoAula(a, meus.get(a.id))}`), 30, "(aulas restantes omitidas)"));
  }
  return saida.join("\n");
}

export const registrarAlunos: Registrar = (server, obter) => {
  server.registerTool(
    "listar_contas_aluno",
    {
      title: "Listar contas de aluno",
      description: "Lista as contas de aluno (login, turmas, último acesso, ativa ou não). Filtre por turma.",
      inputSchema: { ...campoEscola, turma: z.string().optional().describe("Nome da turma"), ...campoTelefone },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      let lista = await contasVisiveis(ctx, escolas.map((e) => e.id));
      if (args.turma) {
        const alvo = normalizarBusca(args.turma);
        lista = lista.filter(({ turmas }) => turmas.some((t) => podeVerTurma(ctx.escopo, t.escola_id, t.turma_nome) && normalizarBusca(t.turma_nome).includes(alvo)));
      }
      if (lista.length === 0) return texto("Nenhuma conta de aluno encontrada.");
      const nunca = lista.filter(({ conta }) => !conta.ultimo_acesso).length;
      const linhas = lista.map(({ conta, turmas }) => {
        const vis = turmas.filter((t) => podeVerTurma(ctx.escopo, t.escola_id, t.turma_nome));
        return `- ${rotuloEscola(escolas, conta.escola_id)}${conta.nome} — ${login(conta)} · ${turmasTxt(vis)} · último acesso: ${conta.ultimo_acesso ? dataBR(conta.ultimo_acesso) : "nunca"}${conta.ativo ? "" : " · desativada"}`;
      });
      return texto([`${lista.length} contas (${nunca} nunca entraram):`, ...limitarLinhas(linhas, 300, "Filtre por turma.")].join("\n"));
    }
  );

  server.registerTool(
    "perfil_aluno",
    {
      title: "Perfil de um aluno",
      description: "Tudo de um aluno: turmas, notas da planilha, simulados e treinos (nota, tempo, saídas da página), progresso nas aulas e último acesso. Acha pelo nome; se houver mais de um, lista para escolher.",
      inputSchema: { nome: z.string().describe("Nome (ou parte) do aluno"), ...campoEscola, ...campoTelefone },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      const achados = await contasVisiveis(ctx, escolas.map((e) => e.id), args.nome);
      if (achados.length === 0) throw new Error(`Aluno "${args.nome}" não encontrado.`);
      if (achados.length > 1) {
        const opcoes = achados.map(({ conta, turmas }) => `- ${rotuloEscola(escolas, conta.escola_id)}${conta.nome} (${turmasTxt(turmas.filter((t) => podeVerTurma(ctx.escopo, t.escola_id, t.turma_nome)))})`);
        return texto(`Achei ${achados.length} alunos com "${args.nome}". Qual deles?\n${limitarLinhas(opcoes, 30, "Use o nome completo.").join("\n")}`);
      }
      return texto(await perfil(ctx, achados[0].conta, achados[0].turmas));
    }
  );
};
