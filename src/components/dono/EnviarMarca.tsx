"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmarMarca, urlEnvioMarca } from "@/actions/dono";
import { estilos } from "@/components/ui/estilos";

type Props = { escolaId: string; tipo: "logo" | "login"; titulo: string; urlAtual: string | null };

export function EnviarMarca({ escolaId, tipo, titulo, urlAtual }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function aoEscolher(ev: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = ev.target.files?.[0];
    ev.target.value = "";
    if (!arquivo) return;
    setOcupado(true); setErro(null); setAviso(null);
    try {
      const { caminho, url } = await urlEnvioMarca(escolaId, tipo, arquivo.type, arquivo.size);
      const corpo = new FormData();
      corpo.append("cacheControl", "3600");
      corpo.append("", arquivo, arquivo.name);
      const r = await fetch(url, { method: "PUT", body: corpo, headers: { "x-upsert": "false" } });
      if (!r.ok) throw new Error("Falha ao enviar a imagem.");
      await confirmarMarca(escolaId, tipo, caminho);
      setAviso("Imagem atualizada.");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className={`${estilos.card} space-y-3 p-5`}>
      <h3 className="font-display text-base font-semibold text-ink">{titulo}</h3>
      {urlAtual ? (
        <div className="relative h-32 w-full overflow-hidden rounded-control border border-line bg-surface-sunken">
          <Image src={urlAtual} alt={`Prévia: ${titulo}`} fill sizes="320px" className="object-contain" />
        </div>
      ) : (
        <p className="text-sm text-muted">Nenhuma imagem enviada.</p>
      )}
      <label className={`${estilos.botaoSecundario} cursor-pointer ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
        {ocupado ? "Enviando…" : "Escolher imagem"}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={aoEscolher} disabled={ocupado} />
      </label>
      <p className="text-xs text-muted">PNG, JPG ou WebP, até 2 MB.</p>
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="text-sm text-muted">{aviso}</p>}
    </div>
  );
}
