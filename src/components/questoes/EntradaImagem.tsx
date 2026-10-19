"use client";

import { ImagePlus } from "lucide-react";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { CortarImagem } from "./CortarImagem";
import estilos from "./EntradaImagem.module.css";

// Mesmo limite de TAMANHO_MAXIMO em src/actions/questoes.ts (arquivo "use server": não dá para importar).
const TAMANHO_MAXIMO = 5242880;
const TIPOS = ["image/png", "image/jpeg", "image/webp"];
const MSG_TIPO = "Use uma imagem PNG, JPG ou WebP.";

/** Permite a quem hospeda a entrada mandar uma imagem colada em outro campo para o mesmo fluxo (corte + envio). */
export type EntradaImagemRef = { receber: (arquivo: File) => void };

export function EntradaImagem({
  rotulo,
  aoEscolher,
  desabilitado = false,
  ref,
}: {
  rotulo: string;
  aoEscolher: (arquivo: File) => Promise<void>;
  desabilitado?: boolean;
  ref?: Ref<EntradaImagemRef>;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [cortando, setCortando] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const off = desabilitado || enviando;

  function receber(arquivo: File | null | undefined) {
    if (!arquivo) return;
    if (!TIPOS.includes(arquivo.type)) {
      setErro(MSG_TIPO);
      return;
    }
    setErro(null);
    setCortando(arquivo);
  }

  useImperativeHandle(ref, () => ({
    receber(arquivo: File) {
      if (!off) receber(arquivo);
    },
  }));

  function colar(e: React.ClipboardEvent) {
    if (off) return;
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === "file" && i.type.startsWith("image/"));
    if (!item) return; // texto: deixa o colar normal funcionar
    e.preventDefault();
    receber(item.getAsFile());
  }

  function soltar(e: React.DragEvent) {
    e.preventDefault();
    setArrastando(false);
    if (off) return;
    receber(e.dataTransfer.files?.[0]);
  }

  async function usar(cortado: File) {
    setCortando(null);
    if (cortado.size > TAMANHO_MAXIMO) {
      setErro("A imagem precisa ter até 5 MB.");
      return;
    }
    setEnviando(true);
    try {
      await aoEscolher(cortado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar a imagem.");
    } finally {
      setEnviando(false);
    }
  }

  function abrirSeletor() {
    if (!off) entrada.current?.click();
  }

  return (
    <div>
      <div
        tabIndex={off ? -1 : 0}
        role="group"
        aria-label={rotulo}
        aria-disabled={off}
        className={`${estilos.zona} ${arrastando ? estilos.zonaAtiva : ""} ${off ? estilos.zonaOff : ""}`}
        onPaste={colar}
        onDragOver={(e) => { e.preventDefault(); if (!off) setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={soltar}
        // Clicar na zona só a deixa pronta para o Ctrl+V; o seletor abre pelo botão (ou Enter/Espaço).
        onClick={(e) => { if (!off) e.currentTarget.focus(); }}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            abrirSeletor();
          }
        }}
      >
        <ImagePlus size={28} aria-hidden="true" />
        <p className={estilos.rotulo}>{enviando ? "Enviando…" : rotulo}</p>
        <p className={estilos.dica}>
          Clique aqui e cole um print (Ctrl+V) · arraste o arquivo aqui ·{" "}
          <button type="button" className={estilos.link} disabled={off} onClick={(e) => { e.stopPropagation(); abrirSeletor(); }}>escolher do computador</button>
        </p>
        <input
          ref={entrada}
          type="file"
          accept={TIPOS.join(",")}
          className={estilos.oculto}
          tabIndex={-1}
          disabled={off}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { receber(e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>
      {erro && <p role="alert" className={estilos.erro}>{erro}</p>}
      {cortando && <CortarImagem arquivo={cortando} aoUsar={(f) => void usar(f)} aoCancelar={() => setCortando(null)} />}
    </div>
  );
}
