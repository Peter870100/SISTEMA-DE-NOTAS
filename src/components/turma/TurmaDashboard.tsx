"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarCheck2, ClipboardList } from "lucide-react";
import type { Aluno, AtividadeColuna, TipoColuna, Turma } from "@/lib/types";
import { celulasIniciaisDe, type CelulasMap, type NotaCelulaComAutor } from "@/lib/celulas";
import { mediaAluno, mediaDeValores, paraEscala10 } from "@/lib/analytics";
import { PlanilhaGrid } from "@/components/grid/PlanilhaGrid";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";
import { BimestreAbas } from "./BimestreAbas";
import { CodigoAlunos } from "./CodigoAlunos";
import { KpiCards } from "./KpiCards";
import { SeloHermes } from "@/components/ui/SeloHermes";
import { AnaliseAprendizagem } from "./AnaliseAprendizagem";

type TurmaDashboardProps = {
  turma: Turma;
  todasTurmas: Turma[];
  colunasIniciais: AtividadeColuna[];
  alunosIniciais: Aluno[];
  notasIniciais: NotaCelulaComAutor[];
  /** Vem de ?aluno=<id>&t=<nonce> (Ctrl+K). `chave` muda a cada pedido, mesmo pro mesmo aluno. */
  alunoFoco: { id: string; chave: string } | null;
};

export function TurmaDashboard({
  turma,
  todasTurmas,
  colunasIniciais,
  alunosIniciais,
  notasIniciais,
  alunoFoco,
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

  // Pedido de abrir o drawer de um aluno: guardado até o grid consumir, e renovado quando a chave muda.
  const [alunoFocoId, setAlunoFocoId] = useState<string | null>(alunoFoco?.id ?? null);
  const [chaveFocoAnterior, setChaveFocoAnterior] = useState(alunoFoco?.chave ?? null);
  if ((alunoFoco?.chave ?? null) !== chaveFocoAnterior) {
    setChaveFocoAnterior(alunoFoco?.chave ?? null);
    setAlunoFocoId(alunoFoco?.id ?? null);
  }

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

  const abaClasse = (ativa: boolean) =>
    `flex min-h-10 items-center gap-1.5 rounded-[8px] px-3 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
      ativa ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"
    }`;

  return (
    <PageLayout
      crumb={`Turmas / Redação · ${turma.ano_letivo}`}
      titulo={turma.nome}
      subtitulo={turma.criado_via === "hermes" ? <SeloHermes sobreMoldura /> : undefined}
      acoes={
        <>
          <BimestreAbas turma={turma} todasTurmas={todasTurmas} />
          <CodigoAlunos turmaId={turma.id} />
        </>
      }
    >
      {!maximizado && (
        <KpiCards totalAlunos={alunos.length} taxaCritico={taxaCritico} mediaTurma={mediaTurma10} />
      )}

      {!maximizado && (
        <details className={`${estilos.card} p-4`}>
          <summary className="cursor-pointer rounded text-sm font-semibold text-brand">
            Análise da turma
          </summary>
          <div className="mt-4">
            <AnaliseAprendizagem colunas={colunasNota} alunos={alunos} celulas={celulas} />
          </div>
        </details>
      )}

      <div className="inline-flex w-fit items-center gap-1 rounded-control border border-line bg-surface-sunken p-1">
        <button type="button" aria-pressed={aba === "nota"} disabled={salvamentosPendentes > 0} onClick={() => setAba("nota")} className={abaClasse(aba === "nota")}>
          <ClipboardList size={15} />
          Notas
        </button>
        <button type="button" aria-pressed={aba === "presenca"} disabled={salvamentosPendentes > 0} onClick={() => setAba("presenca")} className={abaClasse(aba === "presenca")}>
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
        alunoFocoId={alunoFocoId}
        onAlunoFocoConsumido={() => setAlunoFocoId(null)}
      />
    </PageLayout>
  );
}
