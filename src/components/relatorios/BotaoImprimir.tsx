"use client";

import { Printer } from "lucide-react";
import { estilos } from "@/components/ui/estilos";

export function BotaoImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className={estilos.botaoSecundario}>
      <Printer size={15} />
      Imprimir / salvar PDF
    </button>
  );
}
