"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarBimestre } from "@/actions/turmas";
import { Modal } from "@/components/ui/Modal";
import { estilos } from "@/components/ui/estilos";

type CriarBimestreModalProps = {
  open: boolean;
  turmaId: string;
  bimestreSugerido: string;
  onClose: () => void;
};

export function CriarBimestreModal({
  open,
  turmaId,
  bimestreSugerido,
  onClose,
}: CriarBimestreModalProps) {
  const [valor, setValor] = useState(bimestreSugerido);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  if (!open) return null;

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!valor.trim() || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const nova = await criarBimestre(turmaId, valor.trim());
      onClose();
      router.push(`/turma/${nova.id}`);
    } catch {
      setErro("Não foi possível criar o bimestre. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titulo="Novo bimestre"
      descricao="Cria um novo bimestre para esta turma, copiando a lista de alunos — sem as atividades e notas do bimestre atual."
    >
      <form onSubmit={handleCriar} className="flex flex-col gap-3">
        <input
          aria-label="Nome do bimestre"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Ex: 3º Bimestre"
          autoFocus
          className={estilos.input}
        />
        {erro && <p role="alert" className="text-xs text-danger">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={estilos.botaoFantasma}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando || !valor.trim()} className={estilos.botaoPrimario}>
            {salvando ? "Criando..." : "Criar bimestre"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
