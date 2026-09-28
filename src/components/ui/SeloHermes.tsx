import { Bot } from "lucide-react";

/** Marca discreta pra itens criados pelo Hermes (agente de IA). `sobreMoldura` = versão pra faixa azul. */
export function SeloHermes({ sobreMoldura = false }: { sobreMoldura?: boolean }) {
  return (
    <span
      title="Criado pelo Hermes"
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-[5px] px-1 py-px text-[10px] font-bold normal-case tracking-normal ${
        sobreMoldura ? "bg-white/15 text-white" : "bg-brand-bright/10 text-brand-bright"
      }`}
    >
      <Bot size={10} aria-hidden="true" />
      Hermes
    </span>
  );
}
