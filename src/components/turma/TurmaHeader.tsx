"use client";

import { RefreshCw } from "lucide-react";

export function TurmaHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Dashboard de Rendimento Escolar - Peter
      </h1>
      <button
        type="button"
        disabled
        title="Sincronização com Google Sheets — em breve"
        className="flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-400 shadow-sm dark:border-neutral-700 dark:text-neutral-500"
      >
        <RefreshCw size={14} />
        Sincronizar com Google
      </button>
    </div>
  );
}
