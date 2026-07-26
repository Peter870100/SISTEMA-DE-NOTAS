"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, UserPlus, Settings2 } from "lucide-react";
import type { Aluno, AtividadeColuna } from "@/lib/types";
import { parseEntradaCelula, type ValorCelula } from "@/lib/status";
import type { CelulasMap } from "@/lib/celulas";
import { LIMIAR_CRITICO, mediaAluno as calcularMediaAluno, paraEscala10 } from "@/lib/analytics";
import { upsertCelula } from "@/actions/notas";
import { addAluno, deleteAluno } from "@/actions/alunos";
import { CelulaNota } from "./CelulaNota";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GestaoColunasModal } from "./GestaoColunasModal";
import { EstatisticaColunaModal } from "./EstatisticaColunaModal";
import { AlunoDashboardDrawer } from "@/components/aluno/AlunoDashboardDrawer";

type PlanilhaGridProps = {
  turmaId: string;
  colunas: AtividadeColuna[];
  alunos: Aluno[];
  celulas: CelulasMap;
  onColunasChange: (colunas: AtividadeColuna[]) => void;
  onAlunosChange: (alunos: Aluno[]) => void;
  onCelulasChange: (updater: (prev: CelulasMap) => CelulasMap) => void;
};

export function PlanilhaGrid({
  turmaId,
  colunas,
  alunos,
  celulas,
  onColunasChange,
  onAlunosChange,
  onCelulasChange,
}: PlanilhaGridProps) {
  const [active, setActive] = useState<{ row: number; col: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingValue, setEditingValue] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const [novoAlunoNome, setNovoAlunoNome] = useState("");
  const [salvandoAluno, setSalvandoAluno] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [gestaoColunasAberto, setGestaoColunasAberto] = useState(false);
  const [drawerAlunoId, setDrawerAlunoId] = useState<string | null>(null);
  const [colunaEstatistica, setColunaEstatistica] = useState<AtividadeColuna | null>(null);

  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!editing && active) {
      cellRefs.current.get(`${active.row}-${active.col}`)?.focus();
    }
  }, [active, editing]);

  const getCelula = (alunoId: string, colunaId: string): ValorCelula =>
    celulas[alunoId]?.[colunaId] ?? { valor: null, status_texto: null };

  function moveActive(row: number, col: number) {
    if (colunas.length === 0 || alunos.length === 0) return;
    const clampedRow = Math.min(Math.max(row, 0), alunos.length - 1);
    const clampedCol = Math.min(Math.max(col, 0), colunas.length - 1);
    setActive({ row: clampedRow, col: clampedCol });
  }

  function commitEdit(row: number, col: number, raw: string) {
    const aluno = alunos[row];
    const coluna = colunas[col];
    if (!aluno || !coluna) return;

    const patch = parseEntradaCelula(raw);
    const anterior = getCelula(aluno.id, coluna.id);

    onCelulasChange((prev) => ({
      ...prev,
      [aluno.id]: { ...prev[aluno.id], [coluna.id]: patch },
    }));
    setEditing(false);

    upsertCelula(aluno.id, coluna.id, patch).catch(() => {
      onCelulasChange((prev) => ({
        ...prev,
        [aluno.id]: { ...prev[aluno.id], [coluna.id]: anterior },
      }));
      setErro(
        `Não foi possível salvar a célula de "${aluno.nome}" em "${coluna.titulo}". Tente novamente.`
      );
    });
  }

  function iniciarEdicao(row: number, col: number, valorInicial?: string) {
    const aluno = alunos[row];
    const coluna = colunas[col];
    if (!aluno || !coluna) return;
    setActive({ row, col });
    setEditing(true);
    if (valorInicial !== undefined) {
      setEditingValue(valorInicial);
      return;
    }
    const atual = getCelula(aluno.id, coluna.id);
    setEditingValue(atual.status_texto ?? (atual.valor !== null ? String(atual.valor) : ""));
  }

  function handleKeyDown(e: React.KeyboardEvent, row: number, col: number) {
    if (editing) {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit(row, col, editingValue);
        moveActive(row + 1, col);
      } else if (e.key === "Tab") {
        e.preventDefault();
        commitEdit(row, col, editingValue);
        moveActive(row, col + 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditing(false);
        setEditingValue("");
      }
      return;
    }

    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      iniciarEdicao(row, col);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(row + 1, col);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(row - 1, col);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveActive(row, col - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      moveActive(row, col + 1);
    } else if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      iniciarEdicao(row, col, e.key);
    }
  }

  function handleSelectStatus(row: number, col: number, status: string) {
    commitEdit(row, col, status);
    moveActive(row + 1, col);
  }

  async function handleAddAluno(e: React.FormEvent) {
    e.preventDefault();
    const nome = novoAlunoNome.trim();
    if (!nome || salvandoAluno) return;
    setSalvandoAluno(true);
    try {
      const aluno = await addAluno(turmaId, nome, alunos.length);
      onAlunosChange([...alunos, aluno]);
      setNovoAlunoNome("");
    } catch {
      setErro("Não foi possível adicionar o aluno. Tente novamente.");
    } finally {
      setSalvandoAluno(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setConfirmDelete(null);
    try {
      await deleteAluno(id);
      onAlunosChange(alunos.filter((a) => a.id !== id));
      onCelulasChange((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      setErro("Não foi possível excluir o aluno. Tente novamente.");
    }
  }

  const mediaTurma = (() => {
    const valores = Object.values(celulas)
      .flatMap((linha) => Object.values(linha))
      .map((c) => c.valor)
      .filter((v): v is number => v !== null);
    if (valores.length === 0) return null;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
  })();

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <div className="flex items-center justify-between rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} className="font-medium underline">
            fechar
          </button>
        </div>
      )}

      <div className="flex items-center justify-end">
        <button
          onClick={() => setGestaoColunasAberto(true)}
          className="flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 hover:shadow dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Settings2 size={16} />
          Gerenciar colunas
        </button>
      </div>

      <div className="max-h-[65vh] overflow-auto rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800">
        <table className="w-full table-fixed border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 dark:bg-neutral-900">
              <th className="sticky top-0 left-0 z-20 w-12 border border-neutral-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                Nº
              </th>
              <th className="sticky top-0 left-12 z-20 w-48 border border-neutral-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                Nome do Aluno
              </th>
              {colunas.map((c) => (
                <th
                  key={c.id}
                  className="sticky top-0 w-32 border border-neutral-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                >
                  <button
                    onClick={() => setColunaEstatistica(c)}
                    className="hover:text-blue-700 hover:underline"
                    title="Ver estatística desta atividade"
                  >
                    {c.titulo}
                  </button>
                </th>
              ))}
              <th className="sticky top-0 w-20 border border-neutral-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                Média
              </th>
              <th className="sticky top-0 w-10 border border-neutral-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900" />
            </tr>
          </thead>
          <tbody>
            {alunos.map((aluno, row) => {
              const media = calcularMediaAluno(celulas[aluno.id]);
              const media10 = media !== null ? paraEscala10(media) : null;
              const critico = media10 !== null && media10 < LIMIAR_CRITICO;
              const zebra = row % 2 === 1;
              const bgLinha = zebra ? "bg-neutral-50" : "bg-white";
              return (
                <tr key={aluno.id} className={zebra ? "bg-neutral-50" : "bg-white"}>
                  <td
                    className={`sticky left-0 z-[5] border border-neutral-200 ${bgLinha} px-2 py-1.5 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950`}
                  >
                    {aluno.numero ?? row + 1}
                  </td>
                  <td
                    className={`sticky left-12 z-[5] border border-neutral-200 ${bgLinha} px-3 py-1.5 text-sm dark:border-neutral-800 dark:bg-neutral-950`}
                  >
                    <button
                      onClick={() => setDrawerAlunoId(aluno.id)}
                      className="flex items-center gap-2 text-left font-medium text-neutral-800 hover:text-blue-700 dark:text-neutral-200"
                      title="Ver rendimento do aluno"
                    >
                      <Avatar nome={aluno.nome} />
                      <span className="hover:underline">{aluno.nome}</span>
                    </button>
                  </td>
                  {colunas.map((coluna, col) => (
                    <td key={coluna.id} className="p-0">
                      <CelulaNota
                        value={getCelula(aluno.id, coluna.id)}
                        active={active?.row === row && active?.col === col}
                        editing={
                          editing && active?.row === row && active?.col === col
                        }
                        editingValue={editingValue}
                        onActivate={() => !editing && setActive({ row, col })}
                        onStartEdit={() => iniciarEdicao(row, col)}
                        onChangeEditingValue={setEditingValue}
                        onKeyDown={(e) => handleKeyDown(e, row, col)}
                        onSelectStatus={(status) =>
                          handleSelectStatus(row, col, status)
                        }
                        cellRef={(el) => {
                          const key = `${row}-${col}`;
                          if (el) cellRefs.current.set(key, el);
                          else cellRefs.current.delete(key);
                        }}
                      />
                    </td>
                  ))}
                  <td
                    className={`border border-neutral-200 px-2 py-1.5 text-center text-sm font-medium tabular-nums dark:border-neutral-800 ${
                      critico
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-neutral-600 dark:text-neutral-300"
                    }`}
                  >
                    {media10 !== null ? media10.toFixed(2) : "—"}
                  </td>
                  <td className="border border-neutral-200 text-center dark:border-neutral-800">
                    <button
                      onClick={() =>
                        setConfirmDelete({ id: aluno.id, nome: aluno.nome })
                      }
                      className="p-1.5 text-neutral-400 hover:text-rose-600"
                      title="Excluir aluno"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleAddAluno} className="flex items-center gap-2">
        <UserPlus size={16} className="text-neutral-400" />
        <input
          value={novoAlunoNome}
          onChange={(e) => setNovoAlunoNome(e.target.value)}
          placeholder="Nome do novo aluno"
          className="w-64 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={salvandoAluno || !novoAlunoNome.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/40 disabled:opacity-50 disabled:shadow-none"
        >
          Adicionar aluno
        </button>
      </form>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Excluir aluno"
        message={`Tem certeza que deseja excluir "${confirmDelete?.nome}"? Todas as notas dele serão apagadas. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <GestaoColunasModal
        open={gestaoColunasAberto}
        turmaId={turmaId}
        colunas={colunas}
        onClose={() => setGestaoColunasAberto(false)}
        onColunasChange={onColunasChange}
      />

      <AlunoDashboardDrawer
        aluno={alunos.find((a) => a.id === drawerAlunoId) ?? null}
        colunas={colunas}
        celulas={drawerAlunoId ? celulas[drawerAlunoId] ?? {} : {}}
        mediaTurma={mediaTurma}
        onClose={() => setDrawerAlunoId(null)}
      />

      <EstatisticaColunaModal
        coluna={colunaEstatistica}
        alunos={alunos}
        celulas={celulas}
        onClose={() => setColunaEstatistica(null)}
      />
    </div>
  );
}
