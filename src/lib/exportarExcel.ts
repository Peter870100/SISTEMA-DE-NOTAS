import type { Aluno, AtividadeColuna, TipoColuna } from "./types";
import type { CelulasMap } from "./celulas";
import { frequenciaAluno, mediaAluno, paraEscala10 } from "./analytics";
import { partesDaTurma } from "./turmas";
import type { TurmaParaExportar } from "@/actions/exportacao";

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

/** Média do aluno na escala 0-10, com 2 casas, ou "" se ele ainda não tem nota. */
function mediaExportada(celulasAluno: CelulasMap[string] | undefined): number | "" {
  const media = mediaAluno(celulasAluno);
  return media !== null ? Number(paraEscala10(media).toFixed(2)) : "";
}

/** Nome de aba válido no Excel: até 31 caracteres, sem []:*?/\ e sem repetir. */
function nomeDeAba(base: string, usados: Set<string>): string {
  const limpo = base.replace(/[[\]:*?/\\]/g, "").trim().slice(0, 31) || "Turma";
  let nome = limpo;
  for (let n = 2; usados.has(nome.toLowerCase()); n++) {
    const sufixo = ` (${n})`;
    nome = limpo.slice(0, 31 - sufixo.length) + sufixo;
  }
  usados.add(nome.toLowerCase());
  return nome;
}

/**
 * Um Excel só com as notas de todas as turmas de um bimestre: a primeira aba junta
 * todos os alunos com a média; depois vem uma aba por turma com todas as atividades.
 */
export async function exportarExcelBimestre(bimestre: string, turmas: TurmaParaExportar[]) {
  const XLSX = await import("xlsx");
  const livro = montarLivroBimestre(XLSX, turmas);
  const nomeArquivo = `Notas - Todas as turmas - ${bimestre}`.replace(/[\\/:*?"<>|]/g, "").trim();
  XLSX.writeFile(livro, `${nomeArquivo}.xlsx`);
}

export function montarLivroBimestre(XLSX: typeof import("xlsx"), turmas: TurmaParaExportar[]) {
  const livro = XLSX.utils.book_new();
  const abasUsadas = new Set<string>(["todas as turmas"]);

  const ordenadas = [...turmas].sort((a, b) => a.turma.nome.localeCompare(b.turma.nome, "pt-BR", { numeric: true }));

  const geral: (string | number)[][] = [["Turma", "Nº", "Nome do Aluno", "Média"]];
  const abasTurmas: { nome: string; planilha: ReturnType<typeof XLSX.utils.aoa_to_sheet> }[] = [];

  for (const { turma, colunas, alunos, notas } of ordenadas) {
    const celulas: CelulasMap = {};
    for (const n of notas) {
      celulas[n.aluno_id] ??= {};
      celulas[n.aluno_id][n.coluna_id] = { valor: n.valor, status_texto: n.status_texto };
    }

    const cabecalho = ["Nº", "Nome do Aluno", ...colunas.map((c) => c.titulo), "Média"];
    const linhas = alunos.map((aluno, i) => {
      const celulasAluno = celulas[aluno.id];
      const media = mediaExportada(celulasAluno);
      geral.push([turma.nome, aluno.numero ?? i + 1, aluno.nome, media]);
      return [
        aluno.numero ?? i + 1,
        aluno.nome,
        ...colunas.map((c) => {
          const cell = celulasAluno?.[c.id];
          return cell ? (cell.valor ?? cell.status_texto ?? "") : "";
        }),
        media,
      ];
    });

    const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
    planilha["!cols"] = [{ wch: 5 }, { wch: 32 }, ...colunas.map(() => ({ wch: 16 })), { wch: 8 }];
    const { serie, resto } = partesDaTurma(turma.nome);
    const rotulo = resto && serie !== "Outras turmas" ? `${serie.replace(" série", "")} ${resto}` : turma.nome;
    abasTurmas.push({ nome: nomeDeAba(rotulo, abasUsadas), planilha });
  }

  const planilhaGeral = XLSX.utils.aoa_to_sheet(geral);
  planilhaGeral["!cols"] = [{ wch: 18 }, { wch: 5 }, { wch: 32 }, { wch: 8 }];
  planilhaGeral["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: geral.length - 1, c: 3 } }) };
  XLSX.utils.book_append_sheet(livro, planilhaGeral, "Todas as turmas");
  for (const { nome, planilha } of abasTurmas) XLSX.utils.book_append_sheet(livro, planilha, nome);
  return livro;
}
