"use client";

import { useState } from "react";
import type { Turma } from "@/lib/types";

type TransferirAlunoModalProps = {
  aluno: { id: string; nome: string } | null;
  turmaAtualId: string;
  turmasDisponiveis: Turma[];
  onClose: () => void;
  onConfirmar: (turmaDestinoId: string) => Promise<void>;
};

export function TransferirAlunoModal({
  aluno,
  turmaAtualId,
  turmasDisponiveis,
  onClose,
  onConfirmar,
}: TransferirAlunoModalProps) {
  const [turmaDestinoId, setTurmaDestinoId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aluno) return null;

  const opcoes = turmasDisponiveis.filter((t) => t.id !== turmaAtualId);

  function fechar() {
    setTurmaDestinoId("");
    setErro(null);
    onClose();
  }

  async function handleConfirmar() {
    if (!turmaDestinoId || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar(turmaDestinoId);
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível transferir o aluno.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={fechar}>
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Transferir {aluno.nome}
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          As notas já lançadas são levadas junto: atividades com o mesmo título na turma de
          destino recebem a nota dele; as que não existirem lá são criadas automaticamente.
        </p>

        {erro && (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {erro}
          </p>
        )}

        <select
          value={turmaDestinoId}
          onChange={(e) => setTurmaDestinoId(e.target.value)}
          className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="">Selecione a turma de destino</option>
          {opcoes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome} — {t.bimestre} ({t.ano_letivo})
            </option>
          ))}
        </select>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={fechar}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!turmaDestinoId || enviando}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {enviando ? "Transferindo..." : "Transferir"}
          </button>
        </div>
      </div>
    </div>
  );
}
