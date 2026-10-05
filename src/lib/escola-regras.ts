export function podeAcessarTurma(professor: { escola_id: string }, turma: { escola_id: string; nome: string }, liberadas: Set<string> | null): boolean {
  return turma.escola_id === professor.escola_id && (liberadas === null || liberadas.has(turma.nome));
}

export function mesmaEscola(a: { escola_id: string | null }, escolaId: string): boolean {
  return !!a.escola_id && a.escola_id === escolaId;
}
