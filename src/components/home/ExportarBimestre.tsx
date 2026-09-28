"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { Turma } from "@/lib/types";
import { dadosExportacaoBimestre } from "@/actions/exportacao";
import { exportarExcelBimestre } from "@/lib/exportarExcel";
import { estilos } from "@/components/ui/estilos";

/** Exporta num Excel só as notas de todas as turmas de UM bimestre (nunca mistura bimestres). */
export function ExportarBimestre({ turmas }: { turmas: Turma[] }) {
  const bimestres = useMemo(
    () =>
      [...new Set(turmas.map((t) => t.bimestre))].sort((a, b) =>
        a.localeCompare(b, "pt-BR", { numeric: true })
      ),
    [turmas]
  );
  const [bimestre, setBimestre] = useState(bimestres[bimestres.length - 1] ?? "");
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (bimestres.length === 0) return null;

  async function handleExportar() {
    if (exportando || !bimestre) return;
    setExportando(true);
    setErro(null);
    try {
      const dados = await dadosExportacaoBimestre(bimestre);
      if (dados.length === 0) {
        setErro(`Nenhuma turma no ${bimestre}.`);
        return;
      }
      await exportarExcelBimestre(bimestre, dados);
    } catch {
      setErro("Não foi possível exportar. Tente novamente.");
    } finally {
      setExportando(false);
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
      <button type="button" onClick={handleExportar} disabled={exportando} className={estilos.botaoPrimario}>
        {exportando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {exportando ? "Exportando…" : "Exportar todas as turmas"}
      </button>
      {erro && <span className="text-sm text-danger">{erro}</span>}
    </div>
  );
}
