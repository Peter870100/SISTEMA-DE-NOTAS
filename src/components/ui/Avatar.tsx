const CORES = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-fuchsia-100 text-fuchsia-700",
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
