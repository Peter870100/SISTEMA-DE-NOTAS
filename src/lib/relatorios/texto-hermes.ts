/**
 * Partes puras das ferramentas relatorio_aluno e relatorio_turma da Hermes (sem Supabase nem MCP):
 * o texto curto que vai no chat, a escolha da turma/linha do link e o alcance do professor.
 */
import { podeVerTurma, type Escopo } from "@/lib/mcp/escopo";
import { agruparAlunoEntreBimestres, formatarNota, formatarPct } from "./calculos";
import type { AcertoMateria, LinhaSimuladoAluno, RelatorioAluno, RelatorioTurma } from "./tipos";

// ---------- texto ----------

const rodape = (link: string) => `Relatório completo (abra logado): ${link}`;

/** Junta itens com " · ", cortando em `max` e avisando quantos ficaram de fora. */
function cortar(itens: string[], max: number): string {
  if (itens.length <= max) return itens.join(" · ");
  return `${itens.slice(0, max).join(" · ")} · e mais ${itens.length - max}`;
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function linhaBimestres(bims: { bimestre: string; media: number | null; encerrado: boolean; vigente: boolean }[]): string {
  if (bims.length === 0) return "Bimestres: nenhum na planilha.";
  return `Bimestres: ${bims.map((b) => {
    const estado = b.encerrado ? " (encerrado)" : b.vigente ? " (em andamento)" : "";
    return `${b.bimestre} ${b.media == null ? "sem notas" : formatarNota(b.media)}${estado}`;
  }).join(" · ")}`;
}

function linhaMaterias(materias: AcertoMateria[], titulo: string): string {
  if (materias.length === 0) return `${titulo}: sem respostas de simulados ainda.`;
  return `${titulo}: ${materias.slice(0, 4).map((m) => `${m.rotulo} ${formatarPct(m.pct)} (${m.total} ${m.total === 1 ? "questão" : "questões"}${m.poucas ? ", poucas" : ""})`).join(" · ")}`;
}

const SITUACAO: Record<LinhaSimuladoAluno["situacao"], string> = {
  fez: "fez",
  fazendo: "fazendo",
  nao_entregou: "não entregou",
  nao_fez: "não fez",
  sem_login: "sem login",
};

function linhaSimuladosAluno(simulados: LinhaSimuladoAluno[], semConta: boolean): string {
  if (semConta) return "Simulados: aluno sem conta de login (simulados e aulas não aparecem).";
  if (simulados.length === 0) return "Simulados: nenhum simulado para a turma ainda.";
  // Os mais recentes primeiro (a lista vem em ordem de abertura).
  const itens = [...simulados].reverse().map((s) =>
    `'${s.titulo}' ${s.situacao === "fez" && s.nota10 != null ? formatarNota(s.nota10) : SITUACAO[s.situacao]}`);
  const saidas = simulados.reduce((t, s) => t + (s.saidas ?? 0), 0);
  return `Simulados: ${cortar(itens, 6)}${saidas > 0 ? ` · saiu da página ${saidas} ${saidas === 1 ? "vez" : "vezes"}` : ""}`;
}

function linhaTreinos(treinos: LinhaSimuladoAluno[]): string {
  if (treinos.length === 0) return "Treinos: nenhum.";
  const notas = treinos.filter((t) => t.situacao === "fez" && t.nota10 != null).map((t) => t.nota10 as number);
  const media = notas.length ? `, média ${formatarNota(notas.reduce((s, n) => s + n, 0) / notas.length)}` : "";
  return `Treinos: ${treinos.length} ${treinos.length === 1 ? "começado" : "começados"}, ${notas.length} ${notas.length === 1 ? "entregue" : "entregues"}${media}.`;
}

function linhaAulas(r: RelatorioAluno, semConta: boolean): string {
  if (!r.aulas) return semConta ? "Aulas: aluno sem conta de login." : "Aulas: nenhum curso ligado à turma.";
  if (r.aulas.total === 0) return "Aulas: nenhuma aula publicada nos cursos da turma.";
  return `Aulas: ${r.aulas.concluidas} de ${r.aulas.total} concluídas, ${r.aulas.comecadas} começadas.`;
}

/** Frase-resumo + 6 ou 7 linhas de detalhe + o link (no máximo 10 linhas, sem NaN). */
export function textoRelatorioAluno(r: RelatorioAluno, link: string): string {
  const semConta = !r.temConta;
  const saida = [
    r.frase,
    linhaBimestres(r.bimestres),
    linhaSimuladosAluno(r.simulados, semConta),
    linhaTreinos(r.treinos),
    linhaMaterias(r.materias, "Matérias (pior primeiro)"),
    linhaAulas(r, semConta),
    `Último acesso: ${r.ultimoAcesso ? dataHora(r.ultimoAcesso) : semConta ? "sem conta de login" : "nunca registrado"}.`,
  ];
  if (r.historicoParcial) saida.push("Histórico parcial: há outro aluno com o mesmo nome na turma e alguns bimestres não foram juntados.");
  saida.push(rodape(link));
  return saida.join("\n");
}

/** Frase-resumo da turma + 6 linhas de detalhe + o link. */
export function textoRelatorioTurma(r: RelatorioTurma, link: string): string {
  const temNotas = r.alunos.some((a) => a.medias.some((m) => m != null));
  const abaixo = !temNotas
    ? "Abaixo da média: sem notas ainda."
    : r.abaixoDaMedia.length === 0
      ? "Abaixo da média: ninguém."
      : `Abaixo da média (${r.abaixoDaMedia.length}): ${cortar(r.abaixoDaMedia.map((a) => `${a.nome} ${formatarNota(a.media)}`), 8)}`;

  // `simulados` já vem em ordem de abertura (o carregador ordena): o último é o mais recente.
  const porData = r.simulados;
  const ultimo = porData.at(-1);
  const simulados = porData.length === 0
    ? "Simulados: nenhum simulado para esta turma ainda."
    : `Simulados (mais recentes primeiro): ${cortar([...porData].reverse().map((s) => `'${s.titulo}' ${s.fizeram} de ${s.total}`), 5)}`;
  const faltaram = !ultimo
    ? null
    : ultimo.naoFizeram.length === 0
      ? `Último simulado ('${ultimo.titulo}'): todos fizeram.`
      : `Não fizeram o último ('${ultimo.titulo}'): ${cortar(ultimo.naoFizeram, 8)}`;

  const comConta = r.alunos.filter((a) => a.temConta).length;
  const saida = [
    r.frase,
    linhaBimestres(r.mediaPorBimestre),
    abaixo,
    simulados,
    ...(faltaram ? [faltaram] : []),
    linhaMaterias(r.materiasFracas, "Matérias mais fracas"),
    r.alunos.length ? `Contas de login: ${comConta} de ${r.alunos.length} alunos.` : "Contas de login: nenhum aluno na planilha.",
    rodape(link),
  ];
  return saida.join("\n");
}

// ---------- qual turma (bimestre) vai no link ----------

export type BimestreDoGrupo = { id: string; bimestre: string; bimestre_vigente: boolean };

const ordemBimestre = (a: BimestreDoGrupo, b: BimestreDoGrupo) =>
  a.bimestre.localeCompare(b.bimestre, "pt-BR", { numeric: true }) || a.id.localeCompare(b.id);

/** Turma do link do relatório da turma: o bimestre vigente; sem vigente, o último. */
export function turmaDoLink<T extends BimestreDoGrupo>(turmas: T[]): T | null {
  const ordenadas = [...turmas].sort(ordemBimestre);
  return ordenadas.find((t) => t.bimestre_vigente) ?? ordenadas.at(-1) ?? null;
}

/**
 * Linha do aluno que vai no link (`/turma/<turmaId>/relatorio/aluno/<alunoId>`): a linha dele no
 * bimestre vigente; se ele não está no vigente, a do último bimestre em que está. Assim o alunoId
 * sempre é uma linha daquela turma.
 */
export function linhaDoLink(turmas: BimestreDoGrupo[], linhas: { turmaId: string; alunoId: string }[]): { turmaId: string; alunoId: string } | null {
  const ordenadas = [...turmas].sort(ordemBimestre);
  const vigente = ordenadas.find((t) => t.bimestre_vigente);
  const naVigente = vigente ? linhas.find((l) => l.turmaId === vigente.id) : undefined;
  if (naVigente) return { turmaId: naVigente.turmaId, alunoId: naVigente.alunoId };
  for (const t of [...ordenadas].reverse()) {
    const l = linhas.find((x) => x.turmaId === t.id);
    if (l) return { turmaId: l.turmaId, alunoId: l.alunoId };
  }
  return null;
}

// ---------- alcance e busca do aluno ----------

/** Turmas que quem pergunta pode ver (aplicado ANTES da busca por nome). */
export function turmasVisiveis<T extends { escola_id: string; nome: string }>(escopo: Escopo, turmas: T[]): T[] {
  return turmas.filter((t) => podeVerTurma(escopo, t.escola_id, t.nome));
}

export type LinhaDoGrupo = { grupo: string; turmaId: string; bimestre: string; alunoId: string; nome: string };

/**
 * Junta as linhas achadas pelo nome em pessoas: a mesma pessoa em vários bimestres de um grupo vira uma
 * só (pelo vínculo da conta ou pelo nome normalizado, como na página); dois com o mesmo nome na mesma
 * turma continuam separados. `vinculadosDe(alunoId)` = linhas ligadas à mesma conta daquela linha.
 */
export function pessoasAchadas(
  todas: LinhaDoGrupo[],
  achadas: LinhaDoGrupo[],
  vinculadosDe: (alunoId: string) => Set<string>,
): { grupo: string; nome: string; alunoIds: Set<string> }[] {
  const pessoas: { grupo: string; nome: string; alunoIds: Set<string> }[] = [];
  for (const a of achadas) {
    if (pessoas.some((p) => p.grupo === a.grupo && p.alunoIds.has(a.alunoId))) continue;
    const doGrupo = todas.filter((l) => l.grupo === a.grupo);
    const { alunoIds } = agruparAlunoEntreBimestres(doGrupo, { alunoId: a.alunoId, nome: a.nome }, vinculadosDe(a.alunoId));
    pessoas.push({ grupo: a.grupo, nome: a.nome, alunoIds: new Set(alunoIds) });
  }
  return pessoas;
}
