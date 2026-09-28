"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import type { Turma } from "@/lib/types";
import { dadosExportacao } from "@/actions/exportacao";
import { exportarExcelTurmas } from "@/lib/exportarExcel";
import { estilos } from "@/components/ui/estilos";

const TODOS = "__todos__";

/**
 * "Exportar tudo": todas as turmas do bimestre escolhido num Excel só. A opção
 * "Todos os bimestres" junta tudo, mas cada bimestre fica nas suas próprias abas.
 */
export function ExportarBimestre({ turmas }: { turmas: Turma[] }) {
  const bimestres = useMemo(
    () =>
      [...new Set(turmas.map((t) => t.bimestre))].sort((a, b) =>
        a.localeCompare(b, "pt-BR", { numeric: true })
      ),
    [turmas]
  );
  const [escolha, setEscolha] = useState(bimestres[bimestres.length - 1] ?? TODOS);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (bimestres.length === 0) return null;

  async function handleExportar() {
    if (exportando) return;
    setExportando(true);
    setErro(null);
    const todos = escolha === TODOS;
    try {
      const dados = await dadosExportacao(todos ? null : escolha);
      if (dados.length === 0) {
        setErro(todos ? "Nenhuma turma para exportar." : `Nenhuma turma no ${escolha}.`);
        return;
      }
      await exportarExcelTurmas(`Todas as turmas - ${todos ? "Todos os bimestres" : escolha}`, dados);
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
        value={escolha}
        onChange={(e) => setEscolha(e.target.value)}
        className={`${estilos.input} w-auto`}
      >
        {bimestres.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
        {bimestres.length > 1 && <option value={TODOS}>Todos os bimestres</option>}
      </select>
      <button type="button" onClick={handleExportar} disabled={exportando} className={estilos.botaoPrimario}>
        {exportando ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
        {exportando ? "Exportando…" : "Exportar tudo"}
      </button>
      {erro && <span className="text-sm text-danger">{erro}</span>}
    </div>
  );
}
