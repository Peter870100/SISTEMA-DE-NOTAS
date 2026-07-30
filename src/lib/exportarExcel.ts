import type { Aluno, AtividadeColuna, TipoColuna } from "./types";
import type { CelulasMap } from "./celulas";
import { frequenciaAluno, mediaAluno, paraEscala10 } from "./analytics";

type ExportarExcelParams = {
  turmaNome: string;
  turmaBimestre: string;
  colunas: AtividadeColuna[];
  alunos: Aluno[];
  celulas: CelulasMap;
  nomeAba?: string;
  tipo?: TipoColuna;
};

export async function exportarExcel({
  turmaNome,
  turmaBimestre,
  colunas,
  alunos,
  celulas,
  nomeAba = "Notas",
  tipo = "nota",
}: ExportarExcelParams) {
  const XLSX = await import("xlsx");

  const cabecalho = [
    "Nº",
    "Nome do Aluno",
    ...colunas.map((c) => c.titulo),
    tipo === "presenca" ? "Frequência (%)" : "Média",
  ];

  const linhas = alunos.map((aluno, i) => {
    const celulasAluno = celulas[aluno.id];
    const resumo =
      tipo === "presenca"
        ? frequenciaAluno(colunas, celulasAluno)
        : (() => {
            const media = mediaAluno(celulasAluno);
            return media !== null ? paraEscala10(media) : null;
          })();
    const valoresColunas = colunas.map((c) => {
      const cell = celulasAluno?.[c.id];
      if (!cell) return "";
      return cell.valor ?? cell.status_texto ?? "";
    });
    return [
      aluno.numero ?? i + 1,
      aluno.nome,
      ...valoresColunas,
      resumo !== null ? Number(resumo.toFixed(tipo === "presenca" ? 0 : 2)) : "",
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
