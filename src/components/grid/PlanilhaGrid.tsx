"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, UserPlus, Settings2, FileSpreadsheet, Maximize2, Minimize2, ArrowRightLeft, Pencil, CalendarDays, GripVertical, ArrowDownAZ, Search, X, ListPlus, Undo2 } from "lucide-react";
import type { Aluno, AtividadeColuna, TipoColuna, Turma } from "@/lib/types";
import { parseEntradaCelula, type ValorCelula } from "@/lib/status";
import type { CelulasMap } from "@/lib/celulas";
import {
  LIMIAR_CRITICO,
  frequenciaAluno,
  mediaAluno as calcularMediaAluno,
  paraEscala10,
} from "@/lib/analytics";
import { exportarExcel } from "@/lib/exportarExcel";
import { normalizar } from "@/lib/comandos";
import { estilos } from "@/components/ui/estilos";
import { upsertCelula } from "@/actions/notas";
import {
  addAluno,
  adicionarAlunos,
  deleteAluno,
  renomearAluno,
  reordenarAlunos,
  restaurarAlunoExcluido,
  transferirAluno,
} from "@/actions/alunos";
import { CelulaNota } from "./CelulaNota";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GestaoColunasModal } from "./GestaoColunasModal";
import { EstatisticaColunaModal } from "./EstatisticaColunaModal";
import { TransferirAlunoModal } from "./TransferirAlunoModal";
import { AlunoDashboardDrawer } from "@/components/aluno/AlunoDashboardDrawer";

/** Título que é só uma data ("03/08", "21-05", "14/08/26") — a coluna ganha destaque de chamada. */
const RE_TITULO_DATA = /^\d{1,2}[/\-.]\d{1,2}([/\-.]\d{2,4})?$/;

type PlanilhaGridProps = {
  turmaId: string;
  turmaNome: string;
  turmaBimestre: string;
  tipoColuna: TipoColuna;
  colunas: AtividadeColuna[];
  alunos: Aluno[];
  celulas: CelulasMap;
  todasTurmas: Turma[];
  onColunasChange: (colunas: AtividadeColuna[]) => void;
  onAlunosChange: (alunos: Aluno[]) => void;
  onCelulasChange: (updater: (prev: CelulasMap) => CelulasMap) => void;
  onPendentesChange: (delta: number) => void;
  maximizado: boolean;
  onToggleMaximizar: () => void;
  alunoFocoId: string | null;
  onAlunoFocoConsumido: () => void;
};

export function PlanilhaGrid({
  turmaId,
  turmaNome,
  turmaBimestre,
  tipoColuna,
  colunas,
  alunos,
  celulas,
  todasTurmas,
  onColunasChange,
  onAlunosChange,
  onCelulasChange,
  onPendentesChange,
  maximizado,
  onToggleMaximizar,
  alunoFocoId,
  onAlunoFocoConsumido,
}: PlanilhaGridProps) {
  const [active, setActive] = useState<{ row: number; col: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingValue, setEditingValue] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [pendentes, setPendentes] = useState(0);
  const pendentesRef = useRef(0);
  const [houveEdicao, setHouveEdicao] = useState(false);
  const [falhaSalvamento, setFalhaSalvamento] = useState(false);
  const falhasPorCelula = useRef(new Set<string>());

  useEffect(() => {
    if (pendentes === 0) return;
    const avisar = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [pendentes]);

  const [novoAlunoNome, setNovoAlunoNome] = useState("");
  const [salvandoAluno, setSalvandoAluno] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [gestaoColunasAberto, setGestaoColunasAberto] = useState(false);
  const [drawerEscolhidoId, setDrawerEscolhidoId] = useState<string | null>(null);
  // O drawer abre pelo clique no nome ou por um pedido de foco vindo do Ctrl+K (?aluno=).
  const drawerAlunoId = drawerEscolhidoId ?? alunoFocoId;
  const [colunaEstatistica, setColunaEstatistica] = useState<AtividadeColuna | null>(null);
  const [transferindo, setTransferindo] = useState<{ id: string; nome: string } | null>(null);
  const [editandoNome, setEditandoNome] = useState<{ id: string; valor: string } | null>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [linhaAlvo, setLinhaAlvo] = useState<number | null>(null);
  const [podeArrastar, setPodeArrastar] = useState(false);
  const [reordenando, setReordenando] = useState(false);
  const [busca, setBusca] = useState("");
  const [modoVarios, setModoVarios] = useState(false);
  const [textoVarios, setTextoVarios] = useState("");
  const [salvandoVarios, setSalvandoVarios] = useState(false);
  const [ultimaAcao, setUltimaAcao] = useState<{
    label: string;
    desfazer: () => Promise<void>;
  } | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);
  const [recemSalvas, setRecemSalvas] = useState<Set<string>>(() => new Set());

  const alunosRef = useRef(alunos);
  useEffect(() => {
    alunosRef.current = alunos;
  }, [alunos]);

  function registrarUndo(label: string, desfazer: () => Promise<void>) {
    setUltimaAcao({ label, desfazer });
  }

  const desfazerUltimaAcao = useCallback(async () => {
    if (!ultimaAcao || desfazendo) return;
    setDesfazendo(true);
    try {
      await ultimaAcao.desfazer();
      setUltimaAcao(null);
    } catch {
      setErro("Não foi possível desfazer. Tente novamente.");
    } finally {
      setDesfazendo(false);
    }
  }, [ultimaAcao, desfazendo]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!ultimaAcao || desfazendo) return;
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      e.preventDefault();
      desfazerUltimaAcao();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ultimaAcao, desfazendo, desfazerUltimaAcao]);

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

    const chaveCelula = `${aluno.id}:${coluna.id}`;
    pendentesRef.current += 1;
    setPendentes(pendentesRef.current);
    setHouveEdicao(true);
    onPendentesChange(1);
    upsertCelula(aluno.id, coluna.id, patch)
      .then(({ atualizadoPorNome, atualizadoEm }) => {
        if (falhasPorCelula.current.delete(chaveCelula)) {
          setFalhaSalvamento(falhasPorCelula.current.size > 0);
          if (falhasPorCelula.current.size === 0) setErro(null);
        }
        onCelulasChange((prev) => ({
          ...prev,
          [aluno.id]: {
            ...prev[aluno.id],
            [coluna.id]: { ...patch, atualizadoPorNome, atualizadoEm },
          },
        }));
        setRecemSalvas((prev) => new Set(prev).add(chaveCelula));
        setTimeout(() => {
          setRecemSalvas((prev) => {
            const next = new Set(prev);
            next.delete(chaveCelula);
            return next;
          });
        }, 1200);
      })
      .catch(() => {
        falhasPorCelula.current.add(chaveCelula);
        setFalhaSalvamento(true);
        onCelulasChange((prev) => ({
          ...prev,
          [aluno.id]: { ...prev[aluno.id], [coluna.id]: anterior },
        }));
        setErro(
          `Não foi possível salvar a célula de "${aluno.nome}" em "${coluna.titulo}". Tente novamente.`
        );
      })
      .finally(() => {
        pendentesRef.current -= 1;
        setPendentes(pendentesRef.current);
        onPendentesChange(-1);
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
    if (!editing && colunas[col]?.tipo === "presenca" && /^[pPfF]$/.test(e.key)) {
      e.preventDefault();
      handleSelectStatus(row, col, e.key.toUpperCase());
      return;
    }

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
      registrarUndo(`"${aluno.nome}" adicionado`, async () => {
        await deleteAluno(aluno.id);
        onAlunosChange(alunosRef.current.filter((a) => a.id !== aluno.id));
      });
    } catch {
      setErro("Não foi possível adicionar o aluno. Tente novamente.");
    } finally {
      setSalvandoAluno(false);
    }
  }

  const nomesVarios = textoVarios
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);

  async function handleAddVarios() {
    if (nomesVarios.length === 0 || salvandoVarios) return;
    setSalvandoVarios(true);
    try {
      const novos = await adicionarAlunos(turmaId, nomesVarios, alunos.length);
      onAlunosChange([...alunos, ...novos]);
      setTextoVarios("");
      setModoVarios(false);
      const idsNovos = new Set(novos.map((n) => n.id));
      registrarUndo(
        `${novos.length} ${novos.length === 1 ? "aluno adicionado" : "alunos adicionados"}`,
        async () => {
          await Promise.all(novos.map((n) => deleteAluno(n.id)));
          onAlunosChange(alunosRef.current.filter((a) => !idsNovos.has(a.id)));
        }
      );
    } catch {
      setErro("Não foi possível adicionar os alunos. Tente novamente.");
    } finally {
      setSalvandoVarios(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    const alunoRemovido = alunos.find((a) => a.id === id);
    const celulasRemovidas = celulas[id] ?? {};
    setConfirmDelete(null);
    try {
      await deleteAluno(id);
      onAlunosChange(alunos.filter((a) => a.id !== id));
      onCelulasChange((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (alunoRemovido) {
        registrarUndo(`"${alunoRemovido.nome}" excluído`, async () => {
          const restaurado = await restaurarAlunoExcluido(
            alunoRemovido,
            Object.entries(celulasRemovidas).map(([colunaId, valor]) => ({ colunaId, valor }))
          );
          onAlunosChange(
            [...alunosRef.current, restaurado].sort((a, b) => a.ordem - b.ordem)
          );
          onCelulasChange((prev) => ({ ...prev, [restaurado.id]: celulasRemovidas }));
        });
      }
    } catch {
      setErro("Não foi possível excluir o aluno. Tente novamente.");
    }
  }

  /** Salva a lista na ordem recebida, renumerando a chamada (1 = primeiro da lista). */
  async function aplicarNovaOrdem(lista: Aluno[], label: string) {
    const anterior = alunos;
    const comOrdem = lista.map((a, i) => ({ ...a, ordem: i, numero: i + 1 }));

    setActive(null);
    setEditing(false);
    onAlunosChange(comOrdem);
    setReordenando(true);
    try {
      await reordenarAlunos(
        turmaId,
        comOrdem.map((a) => ({ id: a.id, ordem: a.ordem, numero: a.numero }))
      );
      registrarUndo(label, async () => {
        onAlunosChange(anterior);
        await reordenarAlunos(
          turmaId,
          anterior.map((a) => ({ id: a.id, ordem: a.ordem, numero: a.numero }))
        );
      });
    } catch {
      onAlunosChange(anterior);
      setErro("Não foi possível salvar a nova ordem. Tente novamente.");
    } finally {
      setReordenando(false);
    }
  }

  function ordenarAlfabeticamente() {
    const ordenados = [...alunos].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
    );
    if (ordenados.every((a, i) => a.id === alunos[i].id)) return;
    aplicarNovaOrdem(ordenados, "Turma ordenada A–Z");
  }

  function soltarLinha(destino: number) {
    const origem = arrastando;
    setArrastando(null);
    setLinhaAlvo(null);
    setPodeArrastar(false);
    if (origem === null || origem === destino) return;

    const lista = [...alunos];
    const [movido] = lista.splice(origem, 1);
    lista.splice(destino, 0, movido);
    aplicarNovaOrdem(lista, `"${movido.nome}" reordenado`);
  }

  async function salvarNome() {
    if (!editandoNome) return;
    const { id, valor } = editandoNome;
    const alunoAtual = alunos.find((a) => a.id === id);
    setEditandoNome(null);

    const nome = valor.trim();
    if (!alunoAtual || !nome || nome === alunoAtual.nome) return;

    onAlunosChange(alunos.map((a) => (a.id === id ? { ...a, nome } : a)));
    try {
      const atualizado = await renomearAluno(id, nome);
      onAlunosChange(alunos.map((a) => (a.id === id ? atualizado : a)));
      registrarUndo(`Nome de "${alunoAtual.nome}" alterado`, async () => {
        const restaurado = await renomearAluno(id, alunoAtual.nome, {
          nomeEditadoEm: alunoAtual.nome_editado_em,
        });
        onAlunosChange(alunosRef.current.map((a) => (a.id === id ? restaurado : a)));
      });
    } catch {
      onAlunosChange(alunos.map((a) => (a.id === id ? alunoAtual : a)));
      setErro("Não foi possível renomear o aluno. Tente novamente.");
    }
  }

  async function handleTransferir(turmaDestinoId: string) {
    if (!transferindo) return;
    const { id } = transferindo;
    await transferirAluno(id, turmaDestinoId);
    onAlunosChange(alunos.filter((a) => a.id !== id));
    onCelulasChange((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleExportar() {
    if (exportando) return;
    setExportando(true);
    try {
      await exportarExcel({
        turmaNome,
        turmaBimestre,
        colunas,
        alunos,
        celulas,
        nomeAba: tipoColuna === "presenca" ? "Frequência" : "Notas",
        tipo: tipoColuna,
      });
    } catch {
      setErro("Não foi possível exportar a planilha. Tente novamente.");
    } finally {
      setExportando(false);
    }
  }

  const buscaLimpa = busca.trim();
  const alunosFiltrados = buscaLimpa
    ? alunos.filter((a) => normalizar(a.nome).includes(normalizar(buscaLimpa)))
    : alunos;

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
        <div role="alert" className="flex items-center justify-between rounded-control border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} className="font-medium underline">
            fechar
          </button>
        </div>
      )}

      {ultimaAcao && (
        <div className="flex items-center justify-between rounded-control border border-brand/15 bg-brand/5 px-3 py-2 text-sm text-brand">
          <span>{ultimaAcao.label}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={desfazerUltimaAcao}
              disabled={desfazendo}
              className="flex items-center gap-1 font-medium underline disabled:opacity-50"
            >
              <Undo2 size={13} />
              {desfazendo ? "Desfazendo..." : "Desfazer (Ctrl+Z)"}
            </button>
            <button
              onClick={() => setUltimaAcao(null)}
              className="text-brand/60 hover:text-brand"
              title="Dispensar"
              aria-label="Dispensar aviso"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className={`${estilos.card} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <div className="relative w-full max-w-56">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            aria-label="Buscar aluno"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setActive(null);
              setEditing(false);
            }}
            placeholder="Buscar aluno…"
            className={`${estilos.input} border-transparent bg-surface-sunken py-1.5 pl-8 pr-7`}
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
              title="Limpar busca"
              aria-label="Limpar busca de alunos"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <p role="status" aria-live="polite" aria-atomic="true" className={`flex items-center gap-1.5 text-xs ${falhaSalvamento && pendentes === 0 ? "text-danger" : "text-muted"}`}>
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${
              pendentes > 0 ? "animate-pulse bg-gold" : falhaSalvamento ? "bg-danger" : "bg-ok shadow-[0_0_0_3px_rgb(14_159_110_/_0.15)]"
            }`}
          />
          {pendentes > 0
            ? `Salvando… (${pendentes} ${pendentes === 1 ? "alteração pendente" : "alterações pendentes"})`
            : falhaSalvamento
              ? "Uma alteração não foi salva. Confira a mensagem acima e tente novamente."
              : houveEdicao ? "Tudo salvo" : "Salvamento automático"}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          onClick={ordenarAlfabeticamente}
          disabled={reordenando || alunos.length < 2}
          className={`${estilos.botaoSecundario} min-h-9 py-1.5`}
          title="Coloca a turma em ordem alfabética e renumera a chamada"
        >
          <ArrowDownAZ size={16} />
          {reordenando ? "Ordenando..." : "Ordenar A–Z"}
        </button>
        <button
          onClick={onToggleMaximizar}
          className={`${estilos.botaoSecundario} min-h-9 py-1.5`}
        >
          {maximizado ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          {maximizado ? "Restaurar" : "Maximizar"}
        </button>
        <button
          onClick={handleExportar}
          disabled={exportando}
          className={`${estilos.botaoSecundario} min-h-9 py-1.5`}
        >
          <FileSpreadsheet size={16} />
          {exportando ? "Exportando..." : "Exportar Excel"}
        </button>
        <button
          onClick={() => setGestaoColunasAberto(true)}
          className={`${estilos.botaoPrimario} min-h-9 py-1.5`}
        >
          <Settings2 size={16} className="text-gold" />
          {tipoColuna === "presenca" ? "Gerenciar chamadas" : "Gerenciar atividades"}
        </button>
        </div>
      </div>

      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full table-fixed border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky top-0 left-0 z-20 w-12 sm:w-16 border-b border-line bg-surface-sunken px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                Nº
              </th>
              <th className="sticky top-0 left-12 sm:left-16 z-20 w-32 sm:w-48 border-b border-line bg-surface-sunken px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted px-3 text-left">
                Nome do Aluno
              </th>
              {colunas.map((c) => {
                const ehData = RE_TITULO_DATA.test(c.titulo.trim());
                return (
                  <th
                    key={c.id}
                    className="sticky top-0 w-32 border-b border-line bg-surface-sunken px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted"
                  >
                    <button
                      onClick={() => setColunaEstatistica(c)}
                      className={`inline-flex max-w-full items-center justify-center gap-1 rounded-[6px] border bg-surface px-2 py-1 normal-case tracking-normal transition active:scale-95 hover:border-brand-bright/50 hover:text-brand ${
                        ehData
                          ? "border-dashed border-line text-muted"
                          : "border-line text-ink"
                      }`}
                      title={
                        ehData
                          ? `${c.titulo} — ver estatística desta data`
                          : tipoColuna === "presenca"
                            ? "Chamada — ver estatística"
                            : "Ver estatística desta atividade"
                      }
                    >
                      {ehData && <CalendarDays size={12} className="shrink-0 opacity-70" />}
                      <span className="truncate">{c.titulo}</span>
                    </button>
                  </th>
                );
              })}
              <th className="sticky top-0 w-20 border-b border-line bg-surface-sunken px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted border-l">
                {tipoColuna === "presenca" ? "Frequência" : "Média"}
              </th>
              <th className="sticky top-0 w-24 border-b border-line bg-surface-sunken" />
            </tr>
          </thead>
          <tbody>
            {alunosFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan={colunas.length + 4}
                  className="px-3 py-6 text-center text-sm text-faint"
                >
                  Nenhum aluno encontrado pra &quot;{buscaLimpa}&quot;.
                </td>
              </tr>
            )}
            {alunosFiltrados.map((aluno, posicaoVisivel) => {
              const row = alunos.indexOf(aluno);
              const media = calcularMediaAluno(celulas[aluno.id]);
              const media10 = media !== null ? paraEscala10(media) : null;
              const frequencia = frequenciaAluno(colunas, celulas[aluno.id]);
              const valorResumo = tipoColuna === "presenca" ? frequencia : media10;
              const critico =
                tipoColuna === "presenca"
                  ? frequencia !== null && frequencia < 75
                  : media10 !== null && media10 < LIMIAR_CRITICO;
              const zebra = posicaoVisivel % 2 === 1;
              const bgLinha = zebra ? "bg-zebra" : "bg-surface";
              return (
                <tr
                  key={aluno.id}
                  draggable={podeArrastar && !buscaLimpa}
                  onDragStart={() => setArrastando(row)}
                  onDragOver={(e) => {
                    if (arrastando === null) return;
                    e.preventDefault();
                    setLinhaAlvo(row);
                  }}
                  onDrop={() => soltarLinha(row)}
                  onDragEnd={() => {
                    setArrastando(null);
                    setLinhaAlvo(null);
                    setPodeArrastar(false);
                  }}
                  className={`group ${bgLinha} ${
                    arrastando === row ? "opacity-40" : ""
                  } ${
                    linhaAlvo === row && arrastando !== row
                      ? "outline-2 -outline-offset-2 outline-brand-bright"
                      : ""
                  }`}
                >
                  <td
                    className={`sticky left-0 z-[5] border-t border-line-soft ${bgLinha} px-1 py-1.5 text-center font-mono text-[11px] tabular-nums text-faint`}
                  >
                    <span className="flex items-center justify-center gap-0.5">
                      <span
                        onMouseDown={() => !buscaLimpa && setPodeArrastar(true)}
                        onMouseUp={() => setPodeArrastar(false)}
                        className={`text-faint opacity-0 transition-opacity group-hover:opacity-100 ${
                          buscaLimpa
                            ? "cursor-not-allowed"
                            : "cursor-grab active:cursor-grabbing"
                        }`}
                        title={
                          buscaLimpa
                            ? "Limpe a busca pra reordenar"
                            : "Arraste pra mudar a ordem"
                        }
                      >
                        <GripVertical size={13} />
                      </span>
                      {aluno.numero ?? row + 1}
                    </span>
                  </td>
                  <td
                    className={`sticky left-12 sm:left-16 z-[5] border-t border-line-soft ${bgLinha} px-3 py-1.5 text-sm`}
                  >
                    {editandoNome?.id === aluno.id ? (
                      <input
                        autoFocus
                        value={editandoNome.valor}
                        onChange={(e) =>
                          setEditandoNome({ id: aluno.id, valor: e.target.value })
                        }
                        onBlur={salvarNome}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            salvarNome();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setEditandoNome(null);
                          }
                        }}
                        className="w-full rounded-[6px] border border-brand bg-surface px-1.5 py-0.5 text-sm outline-none ring-2 ring-brand/15"
                      />
                    ) : (
                      <button
                        onClick={() => setDrawerEscolhidoId(aluno.id)}
                        className="flex w-full items-center gap-2 text-left font-semibold text-ink hover:text-brand"
                        title="Ver rendimento do aluno"
                      >
                        <Avatar nome={aluno.nome} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate hover:underline">
                            {aluno.nome}
                          </span>
                          {(aluno.nome_editado_em || aluno.transferido_em) && (
                            <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] font-normal leading-tight">
                              {aluno.nome_editado_em && (
                                <span
                                  className="rounded px-1 py-px text-muted ring-1 ring-line"
                                  title={`Nome editado em ${new Date(
                                    aluno.nome_editado_em
                                  ).toLocaleString("pt-BR")}`}
                                >
                                  editado
                                </span>
                              )}
                              {aluno.transferido_em && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded bg-warn/10 px-1 py-px font-bold text-warn"
                                  title={`Transferido pra esta turma em ${new Date(
                                    aluno.transferido_em
                                  ).toLocaleString("pt-BR")}`}
                                >
                                  <ArrowRightLeft size={9} className="shrink-0" />
                                  {new Date(aluno.transferido_em).toLocaleDateString(
                                    "pt-BR",
                                    { day: "2-digit", month: "2-digit", year: "2-digit" }
                                  )}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                    )}
                  </td>
                  {colunas.map((coluna, col) => (
                    <td key={coluna.id} className="border-t border-line-soft p-0">
                      <CelulaNota
                        value={getCelula(aluno.id, coluna.id)}
                        tipo={coluna.tipo}
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
                        recemSalva={recemSalvas.has(`${aluno.id}:${coluna.id}`)}
                        cellRef={(el) => {
                          const key = `${row}-${col}`;
                          if (el) cellRefs.current.set(key, el);
                          else cellRefs.current.delete(key);
                        }}
                      />
                    </td>
                  ))}
                  <td
                    className={`border-t border-l border-line-soft border-l-line bg-surface-sunken px-2 py-1.5 text-center font-mono text-sm font-bold tabular-nums ${
                      critico ? "text-danger" : "text-ink"
                    }`}
                  >
                    {valorResumo !== null ? (
                      <>
                        {critico && <span aria-hidden="true" className="mr-0.5 align-[2px] text-[8px]">▼</span>}
                        {critico && <span className="sr-only">Crítico: </span>}
                        {tipoColuna === "presenca" ? `${valorResumo.toFixed(0)}%` : valorResumo.toFixed(2)}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border-t border-line-soft text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() =>
                          setEditandoNome({ id: aluno.id, valor: aluno.nome })
                        }
                        className="rounded-control p-1.5 text-faint transition hover:bg-surface-sunken active:scale-90 hover:text-brand"
                        title="Editar nome"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setTransferindo({ id: aluno.id, nome: aluno.nome })}
                        className="rounded-control p-1.5 text-faint transition hover:bg-surface-sunken active:scale-90 hover:text-warn"
                        title="Transferir pra outra turma"
                      >
                        <ArrowRightLeft size={15} />
                      </button>
                      <button
                        onClick={() =>
                          setConfirmDelete({ id: aluno.id, nome: aluno.nome })
                        }
                        className="rounded-control p-1.5 text-faint transition hover:bg-surface-sunken active:scale-90 hover:text-danger"
                        title="Excluir aluno"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      {modoVarios ? (
        <div className={`${estilos.card} flex flex-col gap-2 p-3`}>
          <label className={estilos.rotulo}>
            Um nome por linha — cole a lista da chamada direto aqui
          </label>
          <textarea
            autoFocus
            value={textoVarios}
            onChange={(e) => setTextoVarios(e.target.value)}
            rows={6}
            placeholder={"Ana Beatriz\nBruno Silva\nCarla Souza..."}
            className={`${estilos.input} resize-y`}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddVarios}
              disabled={salvandoVarios || nomesVarios.length === 0}
              className={estilos.botaoPrimario}
            >
              {salvandoVarios
                ? "Adicionando..."
                : `Adicionar ${nomesVarios.length || ""} ${nomesVarios.length === 1 ? "aluno" : "alunos"}`}
            </button>
            <button
              onClick={() => {
                setModoVarios(false);
                setTextoVarios("");
              }}
              className={estilos.botaoFantasma}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleAddAluno} className={`${estilos.card} flex flex-wrap items-center gap-2 p-3`}>
          <UserPlus size={16} className="text-faint" />
          <input
            value={novoAlunoNome}
            onChange={(e) => setNovoAlunoNome(e.target.value)}
            placeholder="Nome do novo aluno"
            aria-label="Nome do novo aluno"
            className={`${estilos.input} w-64 max-w-full`}
          />
          <button
            type="submit"
            disabled={salvandoAluno || !novoAlunoNome.trim()}
            className={estilos.botaoPrimario}
          >
            Adicionar aluno
          </button>
          <button
            type="button"
            onClick={() => setModoVarios(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand"
          >
            <ListPlus size={15} />
            adicionar vários de uma vez
          </button>
        </form>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Excluir aluno"
        message={`Tem certeza que deseja excluir "${confirmDelete?.nome}"? Todas as notas dele vão junto. Dá pra desfazer com Ctrl+Z logo em seguida — mas não depois de sair ou recarregar a página.`}
        confirmLabel="Excluir"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <GestaoColunasModal
        open={gestaoColunasAberto}
        turmaId={turmaId}
        tipo={tipoColuna}
        colunas={colunas}
        onClose={() => setGestaoColunasAberto(false)}
        onColunasChange={onColunasChange}
      />

      <AlunoDashboardDrawer
        aluno={alunos.find((a) => a.id === drawerAlunoId) ?? null}
        colunas={colunas}
        celulas={drawerAlunoId ? celulas[drawerAlunoId] ?? {} : {}}
        mediaTurma={mediaTurma}
        onClose={() => {
          setDrawerEscolhidoId(null);
          onAlunoFocoConsumido();
        }}
      />

      <EstatisticaColunaModal
        coluna={colunaEstatistica}
        alunos={alunos}
        celulas={celulas}
        onClose={() => setColunaEstatistica(null)}
      />

      <TransferirAlunoModal
        aluno={transferindo}
        turmaAtualId={turmaId}
        turmasDisponiveis={todasTurmas}
        onClose={() => setTransferindo(null)}
        onConfirmar={handleTransferir}
      />
    </div>
  );
}
