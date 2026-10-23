import { normalizarBusca } from "@/lib/hermes/relatorios";

/**
 * Linha da planilha que a conta do aluno aponta (`aluno_turmas.aluno_id`): a turma do bimestre
 * vigente do grupo; sem vigente, a do último bimestre (ordem natural do nome: "1º" < "2º" < …).
 */
export function linhaDeReferencia(bimestres: { turmaId: string; vigente: boolean; bimestre: string }[]): string | null {
  const vigente = bimestres.find((b) => b.vigente);
  if (vigente) return vigente.turmaId;
  const ordenados = [...bimestres].sort((a, b) => a.bimestre.localeCompare(b.bimestre, "pt-BR", { numeric: true }));
  return ordenados.at(-1)?.turmaId ?? null;
}

export type SugestaoLigacoes = {
  ligar: { contaId: string; alunoId: string }[];
  /** Nome que casa com mais de uma conta ou mais de um aluno: ligar à mão. */
  repetidos: { nome: string; contas: number; alunos: number }[];
  /** Contas sem ligação cujo nome não aparece entre os alunos sem conta. */
  semPar: string[];
};

/**
 * Casa contas sem ligação com alunos sem conta da mesma turma pelo nome normalizado. Só liga quando o
 * nome é único dos dois lados; contas e alunos já ligados ficam de fora.
 */
export function sugerirLigacoes(
  contas: { contaId: string; nome: string; alunoIdAtual: string | null }[],
  alunos: { alunoId: string; nome: string; jaLigado: boolean }[],
): SugestaoLigacoes {
  const contasPorNome = new Map<string, { contaId: string; nome: string }[]>();
  for (const c of contas) {
    if (c.alunoIdAtual) continue;
    const chave = normalizarBusca(c.nome);
    if (!chave) continue;
    contasPorNome.set(chave, [...(contasPorNome.get(chave) ?? []), c]);
  }
  const alunosPorNome = new Map<string, string[]>();
  for (const a of alunos) {
    if (a.jaLigado) continue;
    const chave = normalizarBusca(a.nome);
    if (!chave) continue;
    alunosPorNome.set(chave, [...(alunosPorNome.get(chave) ?? []), a.alunoId]);
  }

  const resultado: SugestaoLigacoes = { ligar: [], repetidos: [], semPar: [] };
  for (const [chave, doNome] of contasPorNome) {
    const alunosDoNome = alunosPorNome.get(chave) ?? [];
    const nome = doNome[0].nome.trim().replace(/\s+/g, " ");
    if (alunosDoNome.length === 0) resultado.semPar.push(...doNome.map((c) => c.nome.trim().replace(/\s+/g, " ")));
    else if (doNome.length === 1 && alunosDoNome.length === 1) resultado.ligar.push({ contaId: doNome[0].contaId, alunoId: alunosDoNome[0] });
    else resultado.repetidos.push({ nome, contas: doNome.length, alunos: alunosDoNome.length });
  }
  return resultado;
}

/** Alunos da planilha que ainda não têm conta ligada. */
export function alunosSemConta<T extends { alunoId: string }>(alunos: T[], ligadosIds: Set<string>): T[] {
  return alunos.filter((a) => !ligadosIds.has(a.alunoId));
}

/**
 * O que "Criar contas da planilha" vai criar: o nome sempre vem da planilha (nunca do cliente), quem já
 * tem conta ligada é ignorado (rodar duas vezes não duplica) e id repetido no pedido conta uma vez só.
 * `desconhecidos`: ids que não são alunos da linha de referência da turma.
 */
export function escolherLinhasParaCriar(
  pedidas: { alunoId: string; usuario: string }[],
  alunos: { alunoId: string; nome: string }[],
  ligadosIds: Set<string>,
): { criar: { alunoId: string; nome: string; usuario: string }[]; ignorados: string[]; desconhecidos: string[] } {
  const porId = new Map(alunos.map((a) => [a.alunoId, a]));
  const vistos = new Set<string>();
  const saida = { criar: [] as { alunoId: string; nome: string; usuario: string }[], ignorados: [] as string[], desconhecidos: [] as string[] };
  for (const { alunoId, usuario } of pedidas) {
    if (vistos.has(alunoId)) continue;
    vistos.add(alunoId);
    const aluno = porId.get(alunoId);
    if (!aluno) saida.desconhecidos.push(alunoId);
    else if (ligadosIds.has(alunoId)) saida.ignorados.push(aluno.nome);
    else saida.criar.push({ alunoId, nome: aluno.nome.trim().replace(/\s+/g, " "), usuario });
  }
  return saida;
}
