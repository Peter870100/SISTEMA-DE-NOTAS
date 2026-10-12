import { Star, TrendingDown, Users } from "lucide-react";
import { PainelResumo } from "@/components/ui/PainelResumo";

type KpiCardsProps = {
  totalAlunos: number;
  taxaCritico: number;
  mediaTurma: number | null;
};

/** Indicadores da turma no mesmo painel de números das outras telas. */
export function KpiCards({ totalAlunos, taxaCritico, mediaTurma }: KpiCardsProps) {
  return (
    <PainelResumo
      itens={[
        { rotulo: "Total de alunos", valor: String(totalAlunos), detalhe: "nesta turma", Icone: Users },
        { rotulo: "Rendimento crítico", valor: `${taxaCritico.toFixed(0)}%`, detalhe: "dos alunos com média abaixo de 6", Icone: TrendingDown },
        { rotulo: "Média da turma", valor: mediaTurma !== null ? mediaTurma.toFixed(2) : "—", detalhe: "de 0 a 10", Icone: Star },
      ]}
    />
  );
}
