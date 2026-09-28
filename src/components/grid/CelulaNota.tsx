"use client";

import { useEffect, useRef } from "react";
import { Pencil } from "lucide-react";
import { STATUS_SUGESTOES, STATUS_PRESENCA, corStatus, corPresenca, type ValorCelula } from "@/lib/status";
import type { TipoColuna } from "@/lib/types";

type CelulaNotaProps = {
  value: ValorCelula;
  tipo: TipoColuna;
  active: boolean;
  editing: boolean;
  editingValue: string;
  onActivate: () => void;
  onStartEdit: () => void;
  onChangeEditingValue: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlurEdicao: () => void;
  onSelectStatus: (status: string) => void;
  cellRef: (el: HTMLDivElement | null) => void;
  recemSalva: boolean;
};

export function CelulaNota({
  value,
  tipo,
  active,
  editing,
  editingValue,
  onActivate,
  onStartEdit,
  onChangeEditingValue,
  onKeyDown,
  onBlurEdicao,
  onSelectStatus,
  cellRef,
  recemSalva,
}: CelulaNotaProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing && tipo === "presenca") {
    return (
      <div
        ref={cellRef}
        data-bloqueia-atalhos
        className="relative flex items-center gap-1 rounded-[6px] border-2 border-brand bg-surface px-1 py-1 shadow-[0_6px_18px_rgb(4_68_160_/_0.2)]"
      >
        {STATUS_PRESENCA.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSelectStatus(s)}
            className={`flex-1 rounded-[6px] py-1 text-xs font-bold ${corPresenca(s)}`}
          >
            {s}
          </button>
        ))}
      </div>
    );
  }

  if (editing) {
    return (
      <div
        ref={cellRef}
        data-bloqueia-atalhos
        onBlur={(e) => {
          // Foco indo pro seletor de status da própria célula não conta como sair do campo.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onBlurEdicao();
        }}
        className="relative flex items-center gap-1 rounded-[6px] border-2 border-brand bg-surface px-1 py-1 shadow-[0_6px_18px_rgb(4_68_160_/_0.2)]"
      >
        <input
          aria-label="Nota ou status da atividade"
          ref={inputRef}
          value={editingValue}
          onChange={(e) => onChangeEditingValue(e.target.value)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none"
        />
        <select
          aria-label="Selecionar status da atividade"
          value=""
          onChange={(e) => e.target.value && onSelectStatus(e.target.value)}
          className="w-8 shrink-0 rounded-[6px] border border-line bg-surface text-xs text-muted"
          title="Status rápido"
        >
          <option value="">•••</option>
          {STATUS_SUGESTOES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const temValor = value.status_texto !== null || value.valor !== null;
  const tituloAutor =
    temValor && value.atualizadoPorNome
      ? `Atualizado por ${value.atualizadoPorNome}${
          value.atualizadoEm ? ` em ${new Date(value.atualizadoEm).toLocaleString("pt-BR")}` : ""
        }`
      : undefined;

  return (
    <div
      ref={cellRef}
      tabIndex={0}
      onFocus={onActivate}
      onClick={onStartEdit}
      onKeyDown={onKeyDown}
      title={tituloAutor}
      className={`group flex min-h-11 items-center justify-between gap-1 px-2 py-1.5 text-sm outline-none transition-colors ${
        active
          ? "bg-brand-bright/5 ring-2 ring-inset ring-brand-bright"
          : "hover:bg-brand-bright/[0.03]"
      } ${recemSalva ? "animate-salvo" : ""}`}
    >
      <span>
        {value.status_texto ? (
          <span
            className={`rounded-[6px] px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
              tipo === "presenca" ? corPresenca(value.status_texto) : corStatus()
            }`}
          >
            {value.status_texto}
          </span>
        ) : value.valor !== null ? (
          <span className="font-mono tabular-nums text-ink">{value.valor}</span>
        ) : null}
      </span>
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onStartEdit();
        }}
        className="shrink-0 text-faint opacity-0 transition group-hover:opacity-100 hover:text-brand"
        title="Editar"
        aria-label="Editar célula"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}
