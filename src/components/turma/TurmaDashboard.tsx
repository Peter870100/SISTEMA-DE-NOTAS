"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarCheck2, ClipboardList } from "lucide-react";
import type { Aluno, AtividadeColuna, TipoColuna, Turma } from "@/lib/types";
import { celulasIniciaisDe, type CelulasMap, type NotaCelulaComAutor } from "@/lib/celulas";
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
  notasIniciais: NotaCelulaComAutor[];
  professorNome: string;
};

export function TurmaDashboard({
  turma,
  todasTurmas,
  colunasIniciais,
  alunosIniciais,
  notasIniciais,
  professorNome,
}: TurmaDashboardProps) {
  const [colunas, setColunas] = useState(colunasIniciais);
  const [alunos, setAlunos] = useState(alunosIniciais);
  const [celulas, setCelulas] = useState<CelulasMap>(() => celulasIniciaisDe(notasIniciais));
  const [maximizado, setMaximizado] = useState(false);
  const [aba, setAba] = useState<TipoColuna>("nota");
  const [salvamentosPendentes, setSalvamentosPendentes] = useState(0);
  const handlePendentesChange = useCallback((delta: number) => {
    setSalvamentosPendentes((total) => total + delta);
  }, []);

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
      <TurmaHeader professorNome={professorNome} />
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <FiltrosTurma turma={turma} todasTurmas={todasTurmas} />
          {!maximizado && (
            <details className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer rounded text-sm font-semibold text-blue-700">
                Análise da turma e indicadores
              </summary>
              <div className="mt-4 flex flex-col gap-4">
                <KpiCards totalAlunos={alunos.length} taxaCritico={taxaCritico} mediaTurma={mediaTurma10} />
                <AnaliseAprendizagem colunas={colunasNota} alunos={alunos} celulas={celulas} />
              </div>
            </details>
          )}

          <div className="inline-flex w-fit items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-900">
            <button
              type="button"
              aria-pressed={aba === "nota"}
              disabled={salvamentosPendentes > 0}
              onClick={() => setAba("nota")}
              className={`flex items-center gap-1.5 rounded-md min-h-11 px-3 py-2 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${
                aba === "nota"
                  ? "bg-white text-blue-700 shadow-sm dark:bg-neutral-700 dark:text-blue-300"
                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              <ClipboardList size={15} />
              Notas
            </button>
            <button
              type="button"
              aria-pressed={aba === "presenca"}
              disabled={salvamentosPendentes > 0}
              onClick={() => setAba("presenca")}
              className={`flex items-center gap-1.5 rounded-md min-h-11 px-3 py-2 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${
                aba === "presenca"
                  ? "bg-white text-blue-700 shadow-sm dark:bg-neutral-700 dark:text-blue-300"
                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              <CalendarCheck2 size={15} />
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
            todasTurmas={todasTurmas}
            onColunasChange={handleColunasAbaChange}
            onAlunosChange={setAlunos}
            onCelulasChange={setCelulas}
            onPendentesChange={handlePendentesChange}
            maximizado={maximizado}
            onToggleMaximizar={() => setMaximizado((m) => !m)}
          />
        </div>
      </div>
    </div>
  );
}
