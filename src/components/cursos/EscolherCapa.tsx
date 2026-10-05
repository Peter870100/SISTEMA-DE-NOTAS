"use client";
import { useId, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { prepararEnvioCapa } from "@/actions/capas";
import { validarCapa, type TipoCapa } from "@/lib/aulas/capas";
import { estilos } from "@/components/ui/estilos";
type Props = { tipo: TipoCapa; aulaId?: string; caminho: string | null; onChange: (caminho: string | null) => void; onOcupado: (ocupado: boolean) => void; disabled?: boolean };
export function EscolherCapa({ tipo, aulaId, caminho, onChange, onOcupado, disabled }: Props) {
  const id = useId();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function escolher(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo) return;
    const invalida = validarCapa(arquivo.type, arquivo.size);
    setErro(invalida);
    if (invalida) return;
    setEnviando(true); onOcupado(true);
    try {
      const { caminho: novo, url } = await prepararEnvioCapa(tipo, arquivo.type, arquivo.size, aulaId);
      const corpo = new FormData();
      corpo.append("cacheControl", "3600"); corpo.append("", arquivo, arquivo.name);
      const resposta = await fetch(url, { method: "PUT", body: corpo, headers: { "x-upsert": "false" } });
      if (!resposta.ok) throw new Error("Não foi possível enviar a imagem. Tente novamente.");
      onChange(novo);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha no envio da imagem."); }
    finally { setEnviando(false); onOcupado(false); }
  }
  return <div className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-2">
      <label htmlFor={id} className={estilos.botaoSecundario + " relative cursor-pointer " + (disabled || enviando ? "pointer-events-none opacity-50" : "")}>
        <ImagePlus size={16} aria-hidden="true" /> {enviando ? "Enviando imagem…" : caminho ? "Trocar imagem" : "Escolher imagem"}
        <input id={id} type="file" accept="image/png,image/jpeg,image/webp" className="absolute inset-0 w-full cursor-pointer opacity-0" aria-label={tipo === "curso" ? "Escolher capa do curso" : "Escolher miniatura da aula"} disabled={disabled || enviando} onChange={escolher} />
      </label>
      {caminho && <button type="button" disabled={disabled || enviando} onClick={() => { onChange(null); setErro(null); }} className={estilos.botaoFantasma}><X size={15} aria-hidden="true" /> {tipo === "aula" ? "Usar automática" : "Remover"}</button>}
    </div>
    <p className="text-xs text-muted">PNG, JPG ou WebP, até 2 MB. {tipo === "curso" ? "Prefira uma capa vertical (2:3)." : "Formato horizontal (16:9). Sem imagem própria, usamos a miniatura do vídeo."}</p>
    {erro && <p role="alert" className="text-xs text-danger">{erro}</p>}
    {enviando && <p role="status" className="text-xs text-muted">Enviando sua imagem…</p>}
  </div>;
}
