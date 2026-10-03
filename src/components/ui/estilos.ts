/** Classes compartilhadas do tema — use estas em vez de repetir utilitários de botão/input. */
const baseBotao =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-control px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export const estilos = {
  botaoPrimario: `${baseBotao} bg-brand text-white shadow-[0_4px_14px_rgb(4_68_160_/_0.3)] hover:bg-brand-bright`,
  botaoSecundario: `${baseBotao} border border-line bg-surface text-ink hover:border-brand-bright/40 hover:bg-surface-sunken`,
  botaoFantasma: `${baseBotao} text-muted hover:bg-surface-sunken hover:text-ink`,
  botaoPerigo: `${baseBotao} bg-danger text-white hover:bg-danger/90`,
  input:
    "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-brand-bright focus:ring-2 focus:ring-brand-bright/15",
  card: "rounded-card border border-line bg-surface shadow-card",
  rotulo: "text-xs font-semibold uppercase tracking-[0.1em] text-muted",
} as const;
