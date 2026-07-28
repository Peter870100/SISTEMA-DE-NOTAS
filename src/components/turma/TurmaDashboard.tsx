"use client";

import { useMemo, useState } from "react";
import type { Aluno, AtividadeColuna, NotaCelula, Turma } from "@/lib/types";
import { celulasIniciaisDe, type CelulasMap } from "@/lib/celulas";
import { mediaAluno, mediaDeValores, paraEscala10 } from "@/lib/analytics";
import { PlanilhaGrid } from "@/components/grid/PlanilhaGrid";
import { TurmaHeader } from "./TurmaHeader";
import { FiltrosTurma } from "./FiltrosTurma";
import { KpiCards } from "./KpiCards";
import { AnaliseAprendizagem } from "./AnaliseAprendizagem";

type TurmaDashboardProps = {
  turma: Turma;
  todasTurmas: Turma[];
  colunasIniciais: AtividadeColuna[];
  alunosIniciais: Aluno[];
  notasIniciais: NotaCelula[];
};

export function TurmaDashboard({
  turma,
  todasTurmas,
  colunasIniciais,
  alunosIniciais,
  notasIniciais,
}: TurmaDashboardProps) {
  const [colunas, setColunas] = useState(colunasIniciais);
  const [alunos, setAlunos] = useState(alunosIniciais);
  const [celulas, setCelulas] = useState<CelulasMap>(() => celulasIniciaisDe(notasIniciais));
  const [maximizado, setMaximizado] = useState(false);

  const mediaTurma10 = useMemo(() => {
    const valores = Object.values(celulas)
      .flatMap((linha) => Object.values(linha))
      .map((c) => c.valor)
      .filter((v): v is number => v !== null);
    const media = mediaDeValores(valores);
    return media !== null ? paraEscala10(media) : null;
  }, [celulas]);

  const taxaCritico = useMemo(() => {
    if (alunos.length === 0) return 0;
    const criticos = alunos.filter((a) => {
      const media = mediaAluno(celulas[a.id]);
      return media !== null && paraEscala10(media) < 6;
    }).length;
    return (criticos / alunos.length) * 100;
  }, [alunos, celulas]);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <TurmaHeader />
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
        {!maximizado && (
          <AnaliseAprendizagem colunas={colunas} alunos={alunos} celulas={celulas} />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <FiltrosTurma turma={turma} todasTurmas={todasTurmas} />
          <KpiCards totalAlunos={alunos.length} taxaCritico={taxaCritico} mediaTurma={mediaTurma10} />
          <PlanilhaGrid
            turmaId={turma.id}
            turmaNome={turma.nome}
            turmaBimestre={turma.bimestre}
            colunas={colunas}
            alunos={alunos}
            celulas={celulas}
            onColunasChange={setColunas}
            onAlunosChange={setAlunos}
            onCelulasChange={setCelulas}
            maximizado={maximizado}
            onToggleMaximizar={() => setMaximizado((m) => !m)}
          />
        </div>
      </div>
    </div>
  );
}
