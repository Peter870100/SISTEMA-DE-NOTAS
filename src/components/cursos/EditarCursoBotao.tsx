"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { DadosCurso } from "@/actions/cursos";
import { Modal } from "@/components/ui/Modal";
import { estilos } from "@/components/ui/estilos";
import { FormCurso } from "./FormCurso";

export function EditarCursoBotao({ inicial, turmas }: { inicial: DadosCurso & { id: string }; turmas: { turma_nome: string; ano_letivo: string }[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={estilos.botaoSecundario}><Pencil size={16} aria-hidden="true" /> Editar curso</button>
      <Modal open={aberto} onClose={() => setAberto(false)} titulo="Editar curso" largura="md">
        <FormCurso inicial={inicial} turmas={turmas} onSalvo={() => setAberto(false)} />
      </Modal>
    </>
  );
}
