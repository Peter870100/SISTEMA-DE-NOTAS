import type { Aluno, AtividadeColuna } from "./types";
import type { CelulasMap } from "./celulas";
import { mediaAluno, paraEscala10 } from "./analytics";

type ExportarExcelParams = {
  turmaNome: string;
  turmaBimestre: string;
  colunas: AtividadeColuna[];
  alunos: Aluno[];
  celulas: CelulasMap;
  nomeAba?: string;
};

export async function exportarExcel({
  turmaNome,
  turmaBimestre,
  colunas,
  alunos,
  celulas,
  nomeAba = "Notas",
}: ExportarExcelParams) {
  const XLSX = await import("xlsx");

  const cabecalho = [
    "Nº",
    "Nome do Aluno",
    ...colunas.map((c) => c.titulo),
    "Média",
  ];

  const linhas = alunos.map((aluno, i) => {
    const celulasAluno = celulas[aluno.id];
    const media = mediaAluno(celulasAluno);
    const valoresColunas = colunas.map((c) => {
      const cell = celulasAluno?.[c.id];
      if (!cell) return "";
      return cell.valor ?? cell.status_texto ?? "";
    });
    return [
      aluno.numero ?? i + 1,
      aluno.nome,
      ...valoresColunas,
      media !== null ? Number(paraEscala10(media).toFixed(2)) : "",
    ];
  });

  const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
  planilha["!cols"] = [
    { wch: 5 },
    { wch: 32 },
    ...colunas.map(() => ({ wch: 16 })),
    { wch: 8 },
  ];

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, nomeAba);

  const nomeArquivo = `${turmaNome} - ${turmaBimestre}`.replace(/[\\/:*?"<>|]/g, "").trim();
  XLSX.writeFile(livro, `${nomeArquivo}.xlsx`);
}
