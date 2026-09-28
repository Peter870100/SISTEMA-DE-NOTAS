"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import type { AtividadeColuna, TipoColuna } from "@/lib/types";
import { addColuna, deleteColuna, renameColuna, reordenarColunas } from "@/actions/colunas";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { estilos } from "@/components/ui/estilos";

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
  const [erro, setErro] = useState<string | null>(null);

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
    } catch {
      setErro("Não foi possível adicionar a coluna. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleRename(coluna: AtividadeColuna, titulo: string) {
    if (titulo.trim() === coluna.titulo || !titulo.trim()) return;
    onColunasChange(
      colunas.map((c) => (c.id === coluna.id ? { ...c, titulo: titulo.trim() } : c))
    );
    try {
      await renameColuna(coluna.id, titulo.trim());
    } catch {
      onColunasChange(colunas.map((c) => (c.id === coluna.id ? coluna : c)));
      setErro(`Não foi possível renomear "${coluna.titulo}". Tente novamente.`);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const alvo = confirmDelete;
    setConfirmDelete(null);
    onColunasChange(colunas.filter((c) => c.id !== alvo.id));
    try {
      await deleteColuna(alvo.id);
    } catch {
      onColunasChange(colunas);
      setErro(`Não foi possível excluir "${alvo.titulo}". Tente novamente.`);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const alvo = index + direction;
    if (alvo < 0 || alvo >= colunas.length) return;
    const anterior = colunas;
    const reordenadas = [...colunas];
    [reordenadas[index], reordenadas[alvo]] = [reordenadas[alvo], reordenadas[index]];
    const comOrdem = reordenadas.map((c, i) => ({ ...c, ordem: i }));
    onColunasChange(comOrdem);
    try {
      await reordenarColunas(comOrdem.map((c) => ({ id: c.id, ordem: c.ordem })));
    } catch {
      onColunasChange(anterior);
      setErro("Não foi possível reordenar as colunas. Tente novamente.");
    }
  }

  const ehPresenca = tipo === "presenca";

  return (
    <>
      <Modal open onClose={onClose} titulo={ehPresenca ? "Gerenciar chamadas" : "Gerenciar atividades"} largura="md">
        {erro && (
          <div role="alert" className="flex items-center justify-between rounded-control border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
            <span>{erro}</span>
            <button onClick={() => setErro(null)} className="font-medium underline">
              fechar
            </button>
          </div>
        )}

        <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {colunas.map((coluna, index) => (
            <li
              key={coluna.id}
              className="flex items-center gap-1.5 rounded-control border border-line bg-surface px-2 py-1.5 focus-within:border-brand-bright"
            >
              <input
                aria-label={`Título da coluna ${coluna.titulo}`}
                defaultValue={coluna.titulo}
                onBlur={(e) => handleRename(coluna, e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
              />
              <button
                onClick={() => handleMove(index, -1)}
                disabled={index === 0}
                className="rounded-[6px] p-1 text-faint hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
                title="Mover para esquerda"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                onClick={() => handleMove(index, 1)}
                disabled={index === colunas.length - 1}
                className="rounded-[6px] p-1 text-faint hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
                title="Mover para direita"
              >
                <ArrowRight size={14} />
              </button>
              <button
                onClick={() => setConfirmDelete(coluna)}
                className="rounded-[6px] p-1 text-faint hover:bg-danger/10 hover:text-danger"
                title="Excluir coluna"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
          {colunas.length === 0 && (
            <li className="py-4 text-center text-sm text-faint">
              {ehPresenca ? "Nenhuma chamada lançada ainda." : "Nenhuma coluna ainda."}
            </li>
          )}
        </ul>

        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            aria-label={ehPresenca ? "Data da nova chamada" : "Título da nova coluna"}
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            onFocus={() => {
              if (ehPresenca && !novoTitulo.trim()) setNovoTitulo(dataDeHoje());
            }}
            placeholder={ehPresenca ? "Data da chamada (ex: 14/08/26)" : "Nova coluna (ex: SIMULADO)"}
            className={`${estilos.input} min-w-0 flex-1`}
          />
          <button type="submit" disabled={salvando || !novoTitulo.trim()} className={estilos.botaoPrimario}>
            <Plus size={15} className="text-gold" />
            Adicionar
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Excluir coluna"
        message={`Excluir a coluna "${confirmDelete?.titulo}"? Ela e as notas lançadas nela vão para a lixeira; um administrador pode restaurá-las.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
