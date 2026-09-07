"use client";

import { useState } from "react";
import { listarHistorico, type HistoricoLinha } from "@/actions/historico";

function formatarValor(valor: number | null, status: string | null): string {
  if (valor !== null) return String(valor);
  if (status !== null) return status;
  return "—";
}

type HistoricoTableProps = {
  linhasIniciais: HistoricoLinha[];
  cursorInicial: string | null;
  turmas: { id: string; nome: string }[];
  professores: { id: string; nome: string }[];
};

export function HistoricoTable({
  linhasIniciais,
  cursorInicial,
  turmas,
  professores,
}: HistoricoTableProps) {
  const [linhas, setLinhas] = useState(linhasIniciais);
  const [cursor, setCursor] = useState(cursorInicial);
  const [turmaId, setTurmaId] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aplicarFiltro(novoTurmaId: string, novoProfessorId: string) {
    setCarregando(true);
    setErro(null);
    try {
      const pagina = await listarHistorico({
        turmaId: novoTurmaId || undefined,
        professorId: novoProfessorId || undefined,
      });
      setLinhas(pagina.linhas);
      setCursor(pagina.proximoCursor);
    } catch {
      setErro("Não foi possível carregar o histórico. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarMais() {
    if (!cursor || carregando) return;
    setCarregando(true);
    setErro(null);
    try {
      const pagina = await listarHistorico({
        turmaId: turmaId || undefined,
        professorId: professorId || undefined,
        cursor,
      });
      setLinhas((prev) => [...prev, ...pagina.linhas]);
      setCursor(pagina.proximoCursor);
    } catch {
      setErro("Não foi possível carregar mais linhas. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={turmaId}
          onChange={(e) => {
            setTurmaId(e.target.value);
            aplicarFiltro(e.target.value, professorId);
          }}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="">Todas as turmas</option>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <select
          value={professorId}
          onChange={(e) => {
            setProfessorId(e.target.value);
            aplicarFiltro(turmaId, e.target.value);
          }}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="">Todos os professores</option>
          {professores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        {(turmaId || professorId) && (
          <button
            onClick={() => {
              setTurmaId("");
              setProfessorId("");
              aplicarFiltro("", "");
            }}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {erro && (
        <div className="flex items-center justify-between rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} className="font-medium underline">
            fechar
          </button>
        </div>
      )}

      {linhas.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {carregando ? "Carregando..." : "Nenhuma alteração encontrada."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Quando</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Professor</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Turma</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Aluno</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Atividade</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">De</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Para</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((h) => (
                <tr key={h.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-500 dark:text-neutral-400">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{h.professor_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{h.turma_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{h.aluno_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{h.atividade_titulo ?? "—"}</td>
                  <td className="px-3 py-2 text-rose-600 dark:text-rose-400">
                    {formatarValor(h.valor_anterior, h.status_anterior)}
                  </td>
                  <td className="px-3 py-2 font-medium text-emerald-600 dark:text-emerald-400">
                    {formatarValor(h.valor_novo, h.status_novo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cursor && (
        <button
          onClick={carregarMais}
          disabled={carregando}
          className="w-fit rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {carregando ? "Carregando..." : "Carregar mais"}
        </button>
      )}
    </div>
  );
}
