const CORES = [
  "bg-brand/10 text-brand",
  "bg-brand-bright/10 text-brand-bright",
  "bg-gold/40 text-gold-ink",
  "bg-ok/10 text-ok",
  "bg-warn/10 text-warn",
  "bg-frame/10 text-frame",
];

function corPara(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CORES[Math.abs(hash) % CORES.length];
}

function iniciaisDe(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/);
  const primeiro = partes[0]?.[0] ?? "";
  const ultimo = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeiro + ultimo).toUpperCase();
}

type AvatarProps = {
  nome: string;
  size?: "sm" | "md";
};

export function Avatar({ nome, size = "sm" }: AvatarProps) {
  const dimensao = size === "sm" ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-sm";
  return (
    <span
      className={`flex ${dimensao} shrink-0 items-center justify-center rounded-full font-semibold ${corPara(nome)}`}
    >
      {iniciaisDe(nome)}
    </span>
  );
}
