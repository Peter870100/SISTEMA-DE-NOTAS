"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { criarBimestre } from "@/actions/turmas";

type CriarBimestreModalProps = {
  open: boolean;
  turmaId: string;
  bimestreSugerido: string;
  onClose: () => void;
};

export function CriarBimestreModal({
  open,
  turmaId,
  bimestreSugerido,
  onClose,
}: CriarBimestreModalProps) {
  const [valor, setValor] = useState(bimestreSugerido);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  if (!open) return null;

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!valor.trim() || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const nova = await criarBimestre(turmaId, valor.trim());
      onClose();
      router.push(`/turma/${nova.id}`);
    } catch {
      setErro("Não foi possível criar o bimestre. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Novo bimestre
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Cria um novo bimestre para esta turma, copiando a lista de alunos — sem as
          atividades e notas do bimestre atual.
        </p>
        <form onSubmit={handleCriar} className="mt-4 flex flex-col gap-3">
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ex: 3º Bimestre"
            autoFocus
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
          {erro && <p className="text-xs text-rose-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !valor.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-50"
            >
              {salvando ? "Criando..." : "Criar bimestre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
