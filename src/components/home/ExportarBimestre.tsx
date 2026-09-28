"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import type { Turma } from "@/lib/types";
import { dadosExportacao } from "@/actions/exportacao";
import { exportarExcelTurmas } from "@/lib/exportarExcel";
import { estilos } from "@/components/ui/estilos";

/**
 * Exporta num Excel só as notas de todas as turmas: de um bimestre escolhido, ou de
 * todos ("Exportar tudo"), com cada bimestre nas suas próprias abas — nunca misturados.
 */
export function ExportarBimestre({ turmas }: { turmas: Turma[] }) {
  const bimestres = useMemo(
    () =>
      [...new Set(turmas.map((t) => t.bimestre))].sort((a, b) =>
        a.localeCompare(b, "pt-BR", { numeric: true })
      ),
    [turmas]
  );
  const [bimestre, setBimestre] = useState(bimestres[bimestres.length - 1] ?? "");
  const [exportando, setExportando] = useState<"bimestre" | "tudo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (bimestres.length === 0) return null;

  async function exportar(qual: "bimestre" | "tudo") {
    if (exportando || (qual === "bimestre" && !bimestre)) return;
    setExportando(qual);
    setErro(null);
    try {
      const dados = await dadosExportacao(qual === "tudo" ? null : bimestre);
      if (dados.length === 0) {
        setErro(qual === "tudo" ? "Nenhuma turma para exportar." : `Nenhuma turma no ${bimestre}.`);
        return;
      }
      await exportarExcelTurmas(qual === "tudo" ? "Todas as turmas - Todos os bimestres" : `Todas as turmas - ${bimestre}`, dados);
    } catch {
      setErro("Não foi possível exportar. Tente novamente.");
    } finally {
      setExportando(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Bimestre para exportar"
        value={bimestre}
        onChange={(e) => setBimestre(e.target.value)}
        className={`${estilos.input} w-auto`}
      >
        {bimestres.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => exportar("bimestre")} disabled={!!exportando} className={estilos.botaoSecundario}>
        {exportando === "bimestre" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {exportando === "bimestre" ? "Exportando…" : "Exportar bimestre"}
      </button>
      <button type="button" onClick={() => exportar("tudo")} disabled={!!exportando} className={estilos.botaoPrimario}>
        {exportando === "tudo" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
        {exportando === "tudo" ? "Exportando…" : "Exportar tudo"}
      </button>
      {erro && <span className="text-sm text-danger">{erro}</span>}
    </div>
  );
}
