"use client";

import { useState } from "react";
import { KeyRound, Pencil } from "lucide-react";
import { atualizarCodigoConvite } from "@/actions/configuracoes";

type CodigoConviteProps = {
  codigoInicial: string;
};

export function CodigoConvite({ codigoInicial }: CodigoConviteProps) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [editando, setEditando] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState(codigoInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    if (!novoCodigo.trim()) {
      setErro("Informe um código.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await atualizarCodigoConvite(novoCodigo.trim());
      setCodigo(novoCodigo.trim());
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar o código.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
        <KeyRound size={15} />
        Código de convite
      </h2>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Exigido na tela pública de cadastro (<code>/cadastro</code>). Passe pra quem for se cadastrar.
      </p>

      {erro && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {erro}
        </p>
      )}

      {editando ? (
        <form onSubmit={handleSalvar} className="flex items-center gap-2">
          <input
            value={novoCodigo}
            onChange={(e) => setNovoCodigo(e.target.value)}
            autoFocus
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
          <button
            type="submit"
            disabled={salvando}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditando(false);
              setNovoCodigo(codigo);
              setErro(null);
            }}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-neutral-100 px-3 py-1.5 font-mono text-sm text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
            {codigo}
          </span>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <Pencil size={13} />
            Trocar
          </button>
        </div>
      )}
    </div>
  );
}
