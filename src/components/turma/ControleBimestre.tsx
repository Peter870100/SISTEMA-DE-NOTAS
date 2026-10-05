"use client";

import { useState, useTransition } from "react";
import { CircleCheck, LockKeyhole, LockKeyholeOpen } from "lucide-react";
import type { Turma } from "@/lib/types";
import { alterarBimestre } from "@/actions/bimestres";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function ControleBimestre({ turma, disabled = false }: { turma: Turma; disabled?: boolean }) {
  const [pendente, startTransition] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const bloqueado = disabled || pendente;
  const classe = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50";

  function alterar(acao: "encerrar" | "reabrir" | "ativar") {
    if (bloqueado) return;
    setConfirmar(false);
    setErro(null);
    startTransition(async () => {
      try { await alterarBimestre(turma.id, acao); }
      catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível alterar o bimestre."); }
    });
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2" aria-busy={pendente}>
        {!turma.bimestre_encerrado && !turma.bimestre_vigente && (
          <button type="button" disabled={bloqueado} onClick={() => alterar("ativar")} aria-label={`Definir ${turma.bimestre} de ${turma.nome} como vigente`} className={`${classe} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}><CircleCheck size={14} aria-hidden="true" />Definir vigente</button>
        )}
        <button type="button" disabled={bloqueado} onClick={() => turma.bimestre_encerrado ? alterar("reabrir") : setConfirmar(true)} aria-label={`${turma.bimestre_encerrado ? "Reabrir" : "Encerrar"} ${turma.bimestre} de ${turma.nome}`} className={`${classe} ${turma.bimestre_encerrado ? "border-line bg-white text-brand hover:bg-surface-sunken" : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"}`}>
          {turma.bimestre_encerrado ? <LockKeyholeOpen size={14} aria-hidden="true" /> : <LockKeyhole size={14} aria-hidden="true" />}
          {pendente ? "Salvando…" : turma.bimestre_encerrado ? "Reabrir" : "Encerrar"}
        </button>
      </div>
      {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
      <ConfirmDialog open={confirmar} title={`Encerrar ${turma.bimestre}?`} message={`As notas e a frequência de ${turma.nome} continuarão disponíveis para consulta, mas novos lançamentos ficarão bloqueados. Você poderá reabrir este bimestre quando quiser.`} confirmLabel="Encerrar bimestre" onConfirm={() => alterar("encerrar")} onCancel={() => setConfirmar(false)} />
    </div>
  );
}
