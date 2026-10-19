"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { criarTreino, iniciarTentativa } from "@/actions/simulados-aluno";

/** Cria e abre um treino de 10 questões só do assunto (ou da matéria, quando a questão não tem assunto). */
export function TreinarAssunto({ assuntoId, materia, nome, className }: { assuntoId: string | null; materia: string | null; nome: string; className?: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function treinar() {
    setOcupado(true); setErro(null);
    try {
      const r = await criarTreino({ assunto_id: assuntoId ?? undefined, materia: assuntoId ? undefined : materia ?? undefined, quantidade: 10, duracaoMin: null, titulo: `Revisão: ${nome}` });
      await iniciarTentativa(r.simuladoId);
      router.push(`/aluno/simulados/${r.simuladoId}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o treino.");
      setOcupado(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => void treinar()} disabled={ocupado} className={className}>
        <Play size={17} aria-hidden="true" />{ocupado ? "Montando treino…" : "Treinar este assunto"}
      </button>
      {erro && <p role="alert" style={{ color: "var(--color-danger)", fontSize: ".85rem", fontWeight: 600 }}>{erro}</p>}
    </>
  );
}
