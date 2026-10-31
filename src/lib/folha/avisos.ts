// Avisos para o professor sobre questões que o .docx não reproduz por inteiro.
export function avisosDaQuestao(
  q: { id: string; temImagem: boolean; temConteudo: boolean },
  n: number
): string[] {
  const avisos: string[] = [];
  if (q.temImagem) {
    avisos.push(`Questão ${n} (${q.id}) tem figura: o .docx não leva a imagem, inclua à mão.`);
  }
  if (q.temConteudo) {
    avisos.push(`Questão ${n} (${q.id}) tem formatação especial (tabela/fórmula): confira no .docx.`);
  }
  return avisos;
}
