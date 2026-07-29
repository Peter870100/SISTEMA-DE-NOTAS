"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2, X } from "lucide-react";
import type { AtividadeColuna, TipoColuna } from "@/lib/types";
import { addColuna, deleteColuna, renameColuna, reordenarColunas } from "@/actions/colunas";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/** Data de hoje no formato usado pelas colunas de chamada, ex: "14/08/26". */
function dataDeHoje(): string {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, "0");
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const ano = String(hoje.getFullYear()).slice(-2);
  return `${dia}/${mes}/${ano}`;
}

type GestaoColunasModalProps = {
  open: boolean;
  turmaId: string;
  tipo: TipoColuna;
  colunas: AtividadeColuna[];
  onClose: () => void;
  onColunasChange: (colunas: AtividadeColuna[]) => void;
};

export function GestaoColunasModal({
  open,
  turmaId,
  tipo,
  colunas,
  onClose,
  onColunasChange,
}: GestaoColunasModalProps) {
  const [novoTitulo, setNovoTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AtividadeColuna | null>(null);

  if (!open) return null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const titulo = novoTitulo.trim();
    if (!titulo || salvando) return;
    setSalvando(true);
    try {
      const coluna = await addColuna(turmaId, titulo, colunas.length, tipo);
      onColunasChange([...colunas, coluna]);
      setNovoTitulo("");
    } finally {
      setSalvando(false);
    }
  }

  async function handleRename(coluna: AtividadeColuna, titulo: string) {
    if (titulo.trim() === coluna.titulo || !titulo.trim()) return;
    onColunasChange(
      colunas.map((c) => (c.id === coluna.id ? { ...c, titulo: titulo.trim() } : c))
    );
    await renameColuna(coluna.id, titulo.trim());
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const alvo = confirmDelete;
    setConfirmDelete(null);
    onColunasChange(colunas.filter((c) => c.id !== alvo.id));
    await deleteColuna(alvo.id);
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const alvo = index + direction;
    if (alvo < 0 || alvo >= colunas.length) return;
    const reordenadas = [...colunas];
    [reordenadas[index], reordenadas[alvo]] = [reordenadas[alvo], reordenadas[index]];
    const comOrdem = reordenadas.map((c, i) => ({ ...c, ordem: i }));
    onColunasChange(comOrdem);
    await reordenarColunas(comOrdem.map((c) => ({ id: c.id, ordem: c.ordem })));
  }

  const ehPresenca = tipo === "presenca";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {ehPresenca ? "Gerenciar chamadas" : "Gerenciar atividades"}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={18} />
          </button>
        </div>

        <ul className="mt-4 flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {colunas.map((coluna, index) => (
            <li
              key={coluna.id}
              className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1.5 dark:border-neutral-800"
            >
              <input
                defaultValue={coluna.titulo}
                onBlur={(e) => handleRename(coluna, e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                onClick={() => handleMove(index, -1)}
                disabled={index === 0}
                className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                title="Mover para esquerda"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                onClick={() => handleMove(index, 1)}
                disabled={index === colunas.length - 1}
                className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                title="Mover para direita"
              >
                <ArrowRight size={14} />
              </button>
              <button
                onClick={() => setConfirmDelete(coluna)}
                className="p-1 text-neutral-400 hover:text-rose-600"
                title="Excluir coluna"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
          {colunas.length === 0 && (
            <li className="py-4 text-center text-sm text-neutral-400">
              {ehPresenca ? "Nenhuma chamada lançada ainda." : "Nenhuma coluna ainda."}
            </li>
          )}
        </ul>

        <form onSubmit={handleAdd} className="mt-4 flex items-center gap-2">
          <input
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            onFocus={() => {
              if (ehPresenca && !novoTitulo.trim()) setNovoTitulo(dataDeHoje());
            }}
            placeholder={ehPresenca ? "Data da chamada (ex: 14/08/26)" : "Nova coluna (ex: SIMULADO)"}
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
          <button
            type="submit"
            disabled={salvando || !novoTitulo.trim()}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/40 disabled:opacity-50 disabled:shadow-none"
          >
            <Plus size={15} />
            Adicionar
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Excluir coluna"
        message={`Tem certeza que deseja excluir a coluna "${confirmDelete?.titulo}"? Todas as notas lançadas nela serão apagadas. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
