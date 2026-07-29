"use client";

import { useCallback, useMemo, useState } from "react";
import type { Aluno, AtividadeColuna, NotaCelula, TipoColuna, Turma } from "@/lib/types";
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
  const [aba, setAba] = useState<TipoColuna>("nota");

  const colunasNota = useMemo(() => colunas.filter((c) => c.tipo !== "presenca"), [colunas]);
  const colunasPresenca = useMemo(() => colunas.filter((c) => c.tipo === "presenca"), [colunas]);
  const colunasAba = aba === "presenca" ? colunasPresenca : colunasNota;

  const handleColunasAbaChange = useCallback(
    (subset: AtividadeColuna[]) => {
      setColunas((prev) => [...prev.filter((c) => c.tipo !== aba), ...subset]);
    },
    [aba]
  );

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
          <AnaliseAprendizagem colunas={colunasNota} alunos={alunos} celulas={celulas} />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <FiltrosTurma turma={turma} todasTurmas={todasTurmas} />
          <KpiCards totalAlunos={alunos.length} taxaCritico={taxaCritico} mediaTurma={mediaTurma10} />

          <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => setAba("nota")}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                aba === "nota"
                  ? "border-blue-600 text-blue-700 dark:text-blue-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
              }`}
            >
              Notas
            </button>
            <button
              onClick={() => setAba("presenca")}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                aba === "presenca"
                  ? "border-blue-600 text-blue-700 dark:text-blue-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
              }`}
            >
              Frequência
            </button>
          </div>

          <PlanilhaGrid
            key={aba}
            turmaId={turma.id}
            turmaNome={turma.nome}
            turmaBimestre={turma.bimestre}
            tipoColuna={aba}
            colunas={colunasAba}
            alunos={alunos}
            celulas={celulas}
            onColunasChange={handleColunasAbaChange}
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
