"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { criarTurma } from "@/actions/turmas";
import { estilos } from "@/components/ui/estilos";

const BIMESTRES = ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"];

export function NovaTurma({ destaque = false }: { destaque?: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(destaque);
  const [nome, setNome] = useState("");
  const [bimestre, setBimestre] = useState(BIMESTRES[0]);
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      try {
        const id = await criarTurma(nome, bimestre, ano);
        router.push(`/turma/${id}`);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Não foi possível criar a turma.");
      }
    });
  }

  if (!aberto) {
    return (
      <div>
        <button type="button" onClick={() => setAberto(true)} className={estilos.botaoSecundario}>
          <Plus size={16} aria-hidden="true" /> Nova turma
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className={`${estilos.card} flex flex-col gap-4 p-4`}>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className={estilos.rotulo}>Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="1ª série A"
            maxLength={255}
            required
            className={estilos.input}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={estilos.rotulo}>Bimestre</span>
          <select value={bimestre} onChange={(e) => setBimestre(e.target.value)} className={estilos.input}>
            {BIMESTRES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={estilos.rotulo}>Ano letivo</span>
          <input
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            inputMode="numeric"
            maxLength={4}
            required
            className={estilos.input}
          />
        </label>
      </div>
      {erro && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pendente} className={estilos.botaoPrimario}>
          {pendente ? "Criando…" : "Criar turma"}
        </button>
        {!destaque && (
          <button type="button" onClick={() => setAberto(false)} className={estilos.botaoFantasma}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
