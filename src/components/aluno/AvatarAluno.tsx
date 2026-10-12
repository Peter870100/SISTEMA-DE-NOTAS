"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Smile, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import css from "./AvatarAluno.module.css";

const EMOJIS = ["😊", "😎", "🤓", "🚀", "🌟", "🦁", "🐱", "🐼"];
const fotoValida = (valor: string) => /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(valor) && valor.length < 400000;

export function AvatarAluno({ alunoId, nome }: { alunoId: string; nome: string }) {
  const chave = `status:avatar:${alunoId}`;
  const [avatar, setAvatar] = useState("");
  const [rascunho, setRascunho] = useState("");
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chave) ?? "";
      // Restore browser-only preferences after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (EMOJIS.includes(salvo) || fotoValida(salvo)) setAvatar(salvo);
    } catch { /* O avatar continua disponivel sem armazenamento. */ }
  }, [chave]);
  const iniciais = nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(parte => parte[0]).join("").toUpperCase();
  function imagem(valor: string) {
    // A foto e normalizada para JPEG local; URLs externas nao sao aceitas.
    // eslint-disable-next-line @next/next/no-img-element
    return fotoValida(valor) ? <img src={valor} alt="" /> : <span>{valor || iniciais}</span>;
  }
  async function escolherFoto(file?: File) {
    if (!file) return;
    setErro("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setErro("Escolha uma foto JPG, PNG ou WebP de até 5 MB."); return;
    }
    setCarregando(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
      const contexto = canvas.getContext("2d");
      if (!contexto) throw new Error();
      const lado = Math.min(bitmap.width, bitmap.height);
      contexto.fillStyle = "#ffffff"; contexto.fillRect(0, 0, 256, 256);
      contexto.drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, 256, 256);
      bitmap.close(); setRascunho(canvas.toDataURL("image/jpeg", .85));
    } catch { setErro("Não foi possível abrir essa foto. Tente outra imagem."); }
    finally { setCarregando(false); if (arquivo.current) arquivo.current.value = ""; }
  }
  function salvar() {
    try {
      if (rascunho) localStorage.setItem(chave, rascunho); else localStorage.removeItem(chave);
      setAvatar(rascunho); setAberto(false);
    } catch { setErro("Não foi possível salvar. Verifique o armazenamento do navegador."); }
  }
  return <>
    <button type="button" className={css.avatar} title={nome} aria-label={`Editar foto de perfil de ${nome}`} aria-haspopup="dialog" onClick={() => { setRascunho(avatar); setErro(""); setAberto(true); }}>
      {imagem(avatar)}<Camera size={12} aria-hidden="true" className={css.camera} />
    </button>
    <Modal open={aberto} onClose={() => setAberto(false)} titulo="Seu perfil" descricao="Escolha um emoji ou uma foto para ficar com a sua cara.">
      <div className={css.painel}>
        <div className={css.previa}>{imagem(rascunho)}</div>
        <p className={css.nome}>{nome}</p>
        <p className={css.rotulo}><Smile size={17} aria-hidden="true" /> Escolha seu emoji</p>
        <div className={css.emojis}>{EMOJIS.map(emoji => <button key={emoji} type="button" aria-label={`Usar emoji ${emoji}`} aria-pressed={rascunho === emoji} onClick={() => setRascunho(emoji)}>{emoji}</button>)}</div>
        <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" className={css.arquivo} aria-label="Selecionar foto de perfil" onChange={event => void escolherFoto(event.target.files?.[0])} />
        <button type="button" className={css.foto} disabled={carregando} onClick={() => arquivo.current?.click()}><Camera size={18} />{carregando ? "Preparando foto..." : "Escolher foto"}</button>
        <p className={css.ajuda}>JPG, PNG ou WebP, até 5 MB. Salvo somente neste navegador.</p>
        {erro && <p role="alert" className={css.erro}>{erro}</p>}
        <div className={css.acoes}><button type="button" className={css.remover} disabled={carregando || !rascunho} onClick={() => setRascunho("")}><Trash2 size={16} /> Remover</button><button type="button" className={css.salvar} disabled={carregando} onClick={salvar}><Check size={17} /> Salvar</button></div>
      </div>
    </Modal>
  </>;
}
