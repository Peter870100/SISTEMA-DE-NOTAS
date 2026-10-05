import { LockKeyhole } from "lucide-react";
import type { Turma } from "@/lib/types";

export function SituacaoBimestre({ turma }: { turma: Turma }) {
  if (turma.bimestre_encerrado) {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><LockKeyhole size={12} aria-hidden="true" />Encerrado</span>;
  }
  if (turma.bimestre_vigente) {
    return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgb(16_185_129_/_0.12)]" />Em vigência</span>;
  }
  return <span className="text-xs text-muted">Aberto</span>;
}
