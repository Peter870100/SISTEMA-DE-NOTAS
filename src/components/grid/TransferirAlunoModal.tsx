"use client";

import { useState } from "react";
import type { Turma } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { estilos } from "@/components/ui/estilos";

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
    <Modal
      open={aluno !== null}
      onClose={fechar}
      titulo={`Transferir ${aluno?.nome ?? ""}`}
      descricao="As notas já lançadas são levadas junto: atividades com o mesmo título na turma de destino recebem a nota dele; as que não existirem lá são criadas automaticamente."
      rodape={
        <>
          <button type="button" onClick={fechar} className={estilos.botaoFantasma}>
            Cancelar
          </button>
          <button type="button" onClick={handleConfirmar} disabled={!turmaDestinoId || enviando} className={estilos.botaoPrimario}>
            {enviando ? "Transferindo..." : "Transferir"}
          </button>
        </>
      }
    >
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      <select aria-label="Turma de destino" value={turmaDestinoId} onChange={(e) => setTurmaDestinoId(e.target.value)} className={estilos.input}>
        <option value="">Selecione a turma de destino</option>
        {opcoes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome} — {t.bimestre} ({t.ano_letivo})
          </option>
        ))}
      </select>
    </Modal>
  );
}
