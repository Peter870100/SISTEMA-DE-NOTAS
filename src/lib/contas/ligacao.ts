import { normalizarBusca } from "@/lib/hermes/relatorios";

/** Nome como é gravado na conta: sem espaços nas pontas e sem espaços repetidos. */
export function limparNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

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

export type PessoaDaPlanilha = { alunoId: string; nome: string; contas: string[] };

/**
 * As pessoas da turma, uma por linha do bimestre de referência. A pessoa junta a linha de referência
 * com as linhas dos outros bimestres de mesmo nome normalizado (como os relatórios); nome repetido numa
 * turma não junta, para não misturar dois "Pedro". `contas`: contas ligadas a qualquer linha da pessoa
 * (assim, quem foi ligado no 1º bimestre continua "com conta" depois que o 2º vira o vigente).
 */
export function pessoasDaReferencia(
  linhas: { turmaId: string; alunoId: string; nome: string }[],
  referenciaId: string,
  contaPorAluno: Map<string, string>,
): PessoaDaPlanilha[] {
  const chave = (turmaId: string, nome: string) => `${turmaId}|${nome}`;
  const porTurmaENome = new Map<string, string[]>();
  for (const l of linhas) {
    const k = chave(l.turmaId, normalizarBusca(l.nome));
    porTurmaENome.set(k, [...(porTurmaENome.get(k) ?? []), l.alunoId]);
  }
  const outrasTurmas = [...new Set(linhas.map((l) => l.turmaId))].filter((t) => t !== referenciaId);
  return linhas
    .filter((l) => l.turmaId === referenciaId)
    .map((l) => {
      const nome = normalizarBusca(l.nome);
      const ids = [l.alunoId];
      if (nome && (porTurmaENome.get(chave(referenciaId, nome)) ?? []).length === 1) {
        for (const t of outrasTurmas) {
          const mesmoNome = porTurmaENome.get(chave(t, nome)) ?? [];
          if (mesmoNome.length === 1) ids.push(mesmoNome[0]);
        }
      }
      const contas = [...new Set(ids.map((id) => contaPorAluno.get(id)).filter((c): c is string => !!c))];
      return { alunoId: l.alunoId, nome: l.nome, contas };
    });
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
    if (alunosDoNome.length === 0) resultado.semPar.push(...doNome.map((c) => limparNome(c.nome)));
    else if (doNome.length === 1 && alunosDoNome.length === 1) resultado.ligar.push({ contaId: doNome[0].contaId, alunoId: alunosDoNome[0] });
    else resultado.repetidos.push({ nome: limparNome(doNome[0].nome), contas: doNome.length, alunos: alunosDoNome.length });
  }
  return resultado;
}

/** Alunos da planilha que ainda não têm conta ligada. */
export function alunosSemConta<T extends { alunoId: string }>(alunos: T[], ligadosIds: Set<string>): T[] {
  return alunos.filter((a) => !ligadosIds.has(a.alunoId));
}

/** Nomes (normalizados) das contas da turma que ainda não estão ligadas: talvez a pessoa já tenha conta. */
export function nomesDeContasSemLigacao(contas: { nome: string; alunoIdAtual: string | null }[]): Set<string> {
  return new Set(contas.filter((c) => !c.alunoIdAtual).map((c) => normalizarBusca(c.nome)).filter(Boolean));
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
    else if (ligadosIds.has(alunoId)) saida.ignorados.push(limparNome(aluno.nome));
    else saida.criar.push({ alunoId, nome: limparNome(aluno.nome), usuario });
  }
  return saida;
}
