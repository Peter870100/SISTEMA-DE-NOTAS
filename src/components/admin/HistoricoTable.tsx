"use client";

import { useState } from "react";
import { listarHistorico, type HistoricoLinha } from "@/actions/historico";
import { estilos } from "@/components/ui/estilos";

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
    <div className="flex flex-col gap-3">
      <div className={`${estilos.card} flex flex-wrap items-center gap-2 p-3`}>
        <select
          value={turmaId}
          onChange={(e) => {
            setTurmaId(e.target.value);
            aplicarFiltro(e.target.value, professorId);
          }}
          className={estilos.input}
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
          className={estilos.input}
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
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {erro && (
        <div className="flex items-center justify-between rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} className="font-medium underline">
            fechar
          </button>
        </div>
      )}

      {linhas.length === 0 ? (
        <p className="text-sm text-muted">
          {carregando ? "Carregando..." : "Nenhuma alteração encontrada."}
        </p>
      ) : (
        <div className={`${estilos.card} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken">
              <tr>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Quando</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Professor</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Turma</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Aluno</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Atividade</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">De</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Para</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((h) => (
                <tr key={h.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-muted">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-ink">{h.professor_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">{h.turma_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-ink">{h.aluno_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">{h.atividade_titulo ?? "—"}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-danger">
                    {formatarValor(h.valor_anterior, h.status_anterior)}
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold tabular-nums text-ok">
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
          className={`${estilos.botaoSecundario} w-fit`}
        >
          {carregando ? "Carregando..." : "Carregar mais"}
        </button>
      )}
    </div>
  );
}
