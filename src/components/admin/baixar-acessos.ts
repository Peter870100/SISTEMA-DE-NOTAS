import type { CredencialGerada } from "@/actions/contas-aluno";

/** Planilha Excel de acessos (nome, turma, usuário, senha provisória), igual para todas as formas de criar contas. */
export async function baixarPlanilha(credenciais: CredencialGerada[]) {
  const XLSX = await import("xlsx");
  const linhas = credenciais.map((c) => ({ Nome: c.nome, Turma: c.turma, Usuário: c.usuario, "Senha provisória": c.senha }));
  const planilha = XLSX.utils.json_to_sheet(linhas);
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, "Acessos");
  XLSX.writeFile(livro, `acessos-alunos-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
