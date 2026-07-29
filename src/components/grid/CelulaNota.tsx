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
  onSelectStatus: (status: string) => void;
  cellRef: (el: HTMLDivElement | null) => void;
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
  onSelectStatus,
  cellRef,
}: CelulaNotaProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing && tipo === "presenca") {
    return (
      <div
        ref={cellRef}
        className="relative flex items-center gap-1 border border-blue-500 bg-white px-1 py-1 dark:bg-neutral-900"
      >
        {STATUS_PRESENCA.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSelectStatus(s)}
            className={`flex-1 rounded py-1 text-xs font-semibold ${corPresenca(s)}`}
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
        className="relative flex items-center gap-1 border border-blue-500 bg-white px-1 py-1 dark:bg-neutral-900"
      >
        <input
          ref={inputRef}
          value={editingValue}
          onChange={(e) => onChangeEditingValue(e.target.value)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <select
          value=""
          onChange={(e) => e.target.value && onSelectStatus(e.target.value)}
          className="w-8 shrink-0 rounded border border-neutral-300 bg-white text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
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

  return (
    <div
      ref={cellRef}
      tabIndex={0}
      onFocus={onActivate}
      onClick={onStartEdit}
      onKeyDown={onKeyDown}
      className={`flex min-h-9 items-center justify-between gap-1 rounded border px-2 py-1.5 text-sm outline-none ${
        active
          ? "border-blue-500 bg-white ring-1 ring-blue-500 dark:bg-neutral-900"
          : "border-neutral-200 bg-neutral-50 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/40"
      }`}
    >
      <span>
        {value.status_texto ? (
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              tipo === "presenca" ? corPresenca(value.status_texto) : corStatus()
            }`}
          >
            {value.status_texto}
          </span>
        ) : value.valor !== null ? (
          <span className="tabular-nums">{value.valor}</span>
        ) : null}
      </span>
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onStartEdit();
        }}
        className="shrink-0 text-neutral-400 hover:text-blue-600 dark:text-neutral-600"
        title="Editar"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}
