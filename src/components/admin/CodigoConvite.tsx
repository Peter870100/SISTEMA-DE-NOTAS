"use client";

import { useState } from "react";
import { KeyRound, Pencil } from "lucide-react";
import { atualizarCodigoConvite } from "@/actions/configuracoes";
import { estilos } from "@/components/ui/estilos";

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
    <div className={`${estilos.card} flex flex-col gap-2 p-4`}>
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <KeyRound size={15} />
        Código de convite
      </h2>
      <p className="text-xs text-muted">
        Exigido na tela pública de cadastro (<code>/cadastro</code>). Passe pra quem for se cadastrar.
      </p>

      {erro && (
        <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      {editando ? (
        <form onSubmit={handleSalvar} className="flex items-center gap-2">
          <input
            value={novoCodigo}
            onChange={(e) => setNovoCodigo(e.target.value)}
            autoFocus
            className={`${estilos.input} min-w-0 flex-1`}
          />
          <button
            type="submit"
            disabled={salvando}
            className={estilos.botaoPrimario}
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
            className={estilos.botaoFantasma}
          >
            Cancelar
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <span className="rounded-control bg-surface-sunken px-3 py-1.5 font-mono text-lg tracking-widest text-brand">
            {codigo}
          </span>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex items-center gap-1 text-sm text-brand hover:underline"
          >
            <Pencil size={13} />
            Trocar
          </button>
        </div>
      )}
    </div>
  );
}
