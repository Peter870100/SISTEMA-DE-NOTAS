import { z } from "zod";
import { formatarPresenca } from "@/lib/hermes/presenca";
import { textoProgressoAula } from "@/lib/hermes/relatorios";
import { formatarDuracao } from "@/lib/simulados/regras";
import { podeVerTurma } from "../escopo";
import {
  acharPorNome, campoEscola, campoTelefone, contasDasTurmas, escolasDoPedido, lerPorIds, lerTodas, limitarLinhas,
  rotuloEscola, texto, type Ctx, type EscolaInfo, type Registrar, type TurmaAno,
} from "./comum";

type CursoLido = { id: string; escola_id: string; professor_id: string | null; titulo: string; disciplina: string };
export type CursoVisivel = { curso: CursoLido; turmas: TurmaAno[] };
export type AulaLida = { id: string; curso_id: string; modulo_id: string; titulo: string; ordem: number; duracao_seg: number | null; moduloTitulo: string };
export type ProgressoLido = { conta_id: string; aula_id: string; curso_id: string; maior_posicao_seg: number; duracao_seg: number | null; tempo_assistido_seg: number; saidas: number; tempo_fora_seg: number; concluida_em: string | null };
export const COLUNAS_PROGRESSO = "conta_id, aula_id, curso_id, maior_posicao_seg, duracao_seg, tempo_assistido_seg, saidas, tempo_fora_seg, concluida_em";

/** Cursos das escolas pedidas que o escopo enxerga. Professor restrito: os dele ou os ligados a turmas liberadas. */
export async function cursosVisiveis(ctx: Ctx, escolas: EscolaInfo[]): Promise<CursoVisivel[]> {
  const ids = escolas.map((e) => e.id);
  if (ids.length === 0) return [];
  const cursos = await lerTodas<CursoLido>((de, ate) =>
    ctx.supabase.from("cursos").select("id, escola_id, professor_id, titulo, disciplina").in("escola_id", ids).order("titulo").order("id").range(de, ate));
  const ligados = await lerPorIds<TurmaAno & { curso_id: string }>(cursos.map((c) => c.id), (bloco, de, ate) =>
    ctx.supabase.from("curso_turmas").select("curso_id, escola_id, turma_nome, ano_letivo").in("curso_id", bloco).order("curso_id").order("turma_nome").range(de, ate));
  const turmasPor = new Map<string, TurmaAno[]>();
  for (const l of ligados) turmasPor.set(l.curso_id, [...(turmasPor.get(l.curso_id) ?? []), { escola_id: l.escola_id, turma_nome: l.turma_nome, ano_letivo: l.ano_letivo }]);
  const e = ctx.escopo;
  return cursos
    .map((curso) => ({ curso, turmas: turmasPor.get(curso.id) ?? [] }))
    .filter(({ curso, turmas }) => {
      if (e.tipo === "dono") return true;
      if (curso.escola_id !== e.escolaId) return false;
      return e.turmas === null || curso.professor_id === e.professorId || turmas.some((t) => podeVerTurma(e, t.escola_id, t.turma_nome));
    });
}

/** Aulas publicadas dos cursos, na ordem do curso (módulo, depois aula). */
export async function aulasPublicadas(ctx: Ctx, cursoIds: string[]): Promise<AulaLida[]> {
  const modulos = await lerPorIds<{ id: string; titulo: string; ordem: number }>(cursoIds, (bloco, de, ate) =>
    ctx.supabase.from("modulos").select("id, titulo, ordem").in("curso_id", bloco).order("id").range(de, ate));
  const mod = new Map(modulos.map((m) => [m.id, m]));
  const aulas = await lerPorIds<Omit<AulaLida, "moduloTitulo">>(cursoIds, (bloco, de, ate) =>
    ctx.supabase.from("aulas").select("id, curso_id, modulo_id, titulo, ordem, duracao_seg").in("curso_id", bloco).eq("publicada", true).order("id").range(de, ate));
  return aulas
    .map((a) => ({ ...a, moduloTitulo: mod.get(a.modulo_id)?.titulo ?? "" }))
    .sort((a, b) => (mod.get(a.modulo_id)?.ordem ?? 0) - (mod.get(b.modulo_id)?.ordem ?? 0) || a.modulo_id.localeCompare(b.modulo_id) || a.ordem - b.ordem);
}

export async function progressoDasContas(ctx: Ctx, cursoIds: string[], contaIds: string[]): Promise<ProgressoLido[]> {
  if (cursoIds.length === 0 || contaIds.length === 0) return [];
  return lerPorIds<ProgressoLido>(contaIds, (bloco, de, ate) =>
    ctx.supabase.from("aula_progresso").select(COLUNAS_PROGRESSO).in("conta_id", bloco).in("curso_id", cursoIds).order("conta_id").order("aula_id").range(de, ate));
}

/** "4/10 concluídas (40%) · 1:02:00 assistidos · 2 saídas · 1:05 fora" para um aluno num curso. */
export function resumoAlunoNoCurso(aulas: AulaLida[], progresso: ProgressoLido[]): string {
  const ids = new Set(aulas.map((a) => a.id));
  const meus = progresso.filter((p) => ids.has(p.aula_id));
  const concluidas = meus.filter((p) => p.concluida_em).length;
  const iniciadas = meus.filter((p) => !p.concluida_em && (p.maior_posicao_seg > 0 || p.tempo_assistido_seg > 0)).length;
  const assistido = meus.reduce((s, p) => s + (p.tempo_assistido_seg ?? 0), 0);
  const saidas = meus.reduce((s, p) => s + (p.saidas ?? 0), 0);
  const fora = meus.reduce((s, p) => s + (p.tempo_fora_seg ?? 0), 0);
  const pctC = aulas.length ? Math.round((100 * concluidas) / aulas.length) : 0;
  return [
    `${concluidas}/${aulas.length} concluídas (${pctC}%)`,
    iniciadas ? `${iniciadas} começadas` : null,
    assistido > 0 ? `${formatarDuracao(assistido)} assistidos` : null,
    saidas > 0 ? formatarPresenca(saidas, fora) : null,
  ].filter(Boolean).join(" · ");
}

export function progressoAula(aula: AulaLida, p: ProgressoLido | undefined): string {
  if (!p) return "não assistiu";
  return textoProgressoAula(p.maior_posicao_seg ?? 0, aula.duracao_seg ?? p.duracao_seg, p.tempo_assistido_seg ?? 0, !!p.concluida_em, p.saidas ?? 0, p.tempo_fora_seg ?? 0);
}

const nomesTurmas = (ts: TurmaAno[]) => (ts.length ? ts.map((t) => `${t.turma_nome} · ${t.ano_letivo}`).join(", ") : "nenhuma turma");

export const registrarCursos: Registrar = (server, obter) => {
  server.registerTool(
    "listar_cursos",
    {
      title: "Listar cursos",
      description: "Lista os cursos (plataforma de aulas) com disciplina, professor, turmas ligadas e quantas aulas publicadas.",
      inputSchema: { ...campoEscola, ...campoTelefone },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      const lista = await cursosVisiveis(ctx, escolas);
      if (lista.length === 0) return texto("Nenhum curso encontrado.");
      const aulas = await aulasPublicadas(ctx, lista.map((c) => c.curso.id));
      const porCurso = new Map<string, number>();
      for (const a of aulas) porCurso.set(a.curso_id, (porCurso.get(a.curso_id) ?? 0) + 1);
      const profs = await lerPorIds<{ id: string; nome: string }>(lista.map((c) => c.curso.professor_id ?? "").filter(Boolean), (bloco, de, ate) =>
        ctx.supabase.from("professores").select("id, nome").in("id", bloco).order("id").range(de, ate));
      const nomeProf = new Map(profs.map((p) => [p.id, p.nome]));
      const linhas = lista.map(({ curso, turmas }) =>
        `- ${rotuloEscola(escolas, curso.escola_id)}${curso.titulo} (${curso.disciplina}) — prof. ${nomeProf.get(curso.professor_id ?? "") ?? "—"} · ${porCurso.get(curso.id) ?? 0} aulas publicadas · turmas: ${nomesTurmas(turmas.filter((t) => podeVerTurma(ctx.escopo, t.escola_id, t.turma_nome)))}`);
      return texto(limitarLinhas(linhas, 100, "Filtre por escola.").join("\n"));
    }
  );

  server.registerTool(
    "progresso_curso",
    {
      title: "Progresso dos alunos num curso",
      description: "Mostra quanto cada aluno das turmas do curso já assistiu/concluiu (tempo assistido e saídas da página) e quantos concluíram cada aula. Acha o curso pelo título; turma opcional.",
      inputSchema: {
        curso: z.string().describe("Título (ou parte) do curso"),
        turma: z.string().optional().describe("Nome da turma, para ver só ela"),
        ...campoEscola,
        ...campoTelefone,
      },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      const achados = acharPorNome(await cursosVisiveis(ctx, escolas), (c) => c.curso.titulo, args.curso);
      if (achados.length === 0) throw new Error(`Curso "${args.curso}" não encontrado.`);
      if (achados.length > 1) {
        return texto(`Mais de um curso com "${args.curso}". Qual deles?\n${achados.slice(0, 20).map((c) => `- ${rotuloEscola(escolas, c.curso.escola_id)}"${c.curso.titulo}" (${c.curso.disciplina})`).join("\n")}`);
      }
      const { curso } = achados[0];
      let turmas = achados[0].turmas.filter((t) => podeVerTurma(ctx.escopo, t.escola_id, t.turma_nome));
      if (args.turma) {
        turmas = acharPorNome(turmas, (t) => t.turma_nome, args.turma);
        if (turmas.length === 0) throw new Error(`A turma "${args.turma}" não está ligada a este curso (ou você não tem acesso a ela).`);
      }
      if (turmas.length === 0) return texto(`${curso.titulo}: nenhuma turma ligada a este curso que você possa ver.`);
      const [contas, aulas] = await Promise.all([contasDasTurmas(ctx, turmas), aulasPublicadas(ctx, [curso.id])]);
      const progresso = await progressoDasContas(ctx, [curso.id], [...contas.keys()]);
      const porConta = new Map<string, ProgressoLido[]>();
      for (const p of progresso) porConta.set(p.conta_id, [...(porConta.get(p.conta_id) ?? []), p]);
      const alunos = [...contas].sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"));
      const varias = turmas.length > 1;
      const concl = new Set(progresso.filter((p) => p.concluida_em).map((p) => `${p.conta_id}|${p.aula_id}`));
      const media = alunos.length && aulas.length
        ? Math.round(alunos.reduce((s, [id]) => s + aulas.filter((a) => concl.has(`${id}|${a.id}`)).length / aulas.length, 0) * 100 / alunos.length)
        : null;
      const saida = [
        `${curso.titulo} — turmas: ${nomesTurmas(turmas)} · ${aulas.length} aulas publicadas · ${alunos.length} alunos${media != null ? ` · média ${media}% concluído` : ""}`,
        "Alunos:",
        ...alunos.map(([id, c]) => `- ${c.nome}${varias ? ` (${c.turmas.map((t) => t.turma_nome).join(", ")})` : ""}: ${resumoAlunoNoCurso(aulas, porConta.get(id) ?? [])}`),
        "Aulas:",
        ...aulas.map((a) => `- ${a.moduloTitulo ? `${a.moduloTitulo} › ` : ""}${a.titulo}: ${alunos.filter(([id]) => concl.has(`${id}|${a.id}`)).length}/${alunos.length} concluíram`),
      ];
      if (alunos.length * aulas.length <= 150 && alunos.length && aulas.length) {
        saida.push("Detalhe por aluno:");
        for (const [id, c] of alunos) {
          const meus = new Map((porConta.get(id) ?? []).map((p) => [p.aula_id, p]));
          saida.push(`${c.nome}:`, ...aulas.map((a) => `  - ${a.titulo}: ${progressoAula(a, meus.get(a.id))}`));
        }
      } else if (alunos.length && aulas.length) {
        saida.push("(Para ver aula por aula de um aluno, use perfil_aluno.)");
      }
      return texto(saida.join("\n"));
    }
  );
};
