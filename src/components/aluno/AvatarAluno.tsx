"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Camera, Check, Crop, Smile, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { RecorteAvatar } from "./RecorteAvatar";
import css from "./AvatarAluno.module.css";

import { salvarAvatarAluno } from "@/actions/perfil-aluno";
import { EMOJIS_ALUNO as EMOJIS, fotoAvatarValida as fotoValida, avatarValido } from "@/lib/avatar-aluno";

export function AvatarAluno({ alunoId, nome, avatarInicial }: { alunoId: string; nome: string; avatarInicial: string }) {
  const nomeId = useId();
  const [ocultarNome, setOcultarNome] = useState(false);
  const chave = `status:avatar:${alunoId}`;
  const [avatar, setAvatar] = useState(avatarValido(avatarInicial) ? avatarInicial : "");
  const [salvando, startTransition] = useTransition();
  const [rascunho, setRascunho] = useState("");
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [fotoOriginal, setFotoOriginal] = useState("");
  const [recortando, setRecortando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const iniciais = nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(parte => parte[0]).join("").toUpperCase();
  function imagem(valor: string) {
    // A foto e normalizada para JPEG; URLs externas nao sao aceitas.
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
      const original = document.createElement("canvas");
      const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      original.width = Math.max(1, Math.round(bitmap.width * escala)); original.height = Math.max(1, Math.round(bitmap.height * escala));
      const contextoOriginal = original.getContext("2d");
      if (!contextoOriginal) throw new Error();
      contextoOriginal.fillStyle = "#ffffff"; contextoOriginal.fillRect(0, 0, original.width, original.height);
      contextoOriginal.drawImage(bitmap, 0, 0, original.width, original.height);
      setFotoOriginal(original.toDataURL("image/jpeg", .92));
      bitmap.close(); setRascunho(canvas.toDataURL("image/jpeg", .85));
    } catch { setErro("Não foi possível abrir essa foto. Tente outra imagem."); }
    finally { setCarregando(false); if (arquivo.current) arquivo.current.value = ""; }
  }
  function abrirPerfil() {
    let anterior = avatar;
    // Offer the previous browser-only image as a draft; saving migrates it to the account.
    if (!anterior) {
      try { const local = localStorage.getItem(chave); if (local && avatarValido(local)) anterior = local; } catch { /* The account profile works without browser storage. */ }
    }
    setFotoOriginal(""); setRecortando(false);
    setRascunho(anterior); setErro(""); setAberto(true);
  }
  function salvar() {
    setErro("");
    startTransition(async () => {
      try {
        const resultado = await salvarAvatarAluno(rascunho);
        if (resultado.erro) { setErro(resultado.erro); return; }
        setAvatar(resultado.avatar ?? "");
        try { localStorage.removeItem(chave); } catch { /* The database remains the source of truth. */ }
        setAberto(false);
      } catch { setErro("Não foi possível salvar. Verifique sua conexão e tente novamente."); }
    });
  }
  return <>
    <div className={css.perfil} onMouseEnter={() => setOcultarNome(false)} onFocus={() => setOcultarNome(false)} onKeyDown={event => { if (event.key === "Escape") setOcultarNome(true); }}>
    <button type="button" className={css.avatar} aria-describedby={nomeId} aria-label={`Editar foto de perfil de ${nome}`} aria-haspopup="dialog" onClick={abrirPerfil}>
      {imagem(avatar)}<Camera size={12} aria-hidden="true" className={css.camera} />
    </button>
      <div id={nomeId} role="tooltip" className={css.dica} data-oculto={ocultarNome || aberto}>{nome}</div>
    </div>
    <Modal open={aberto} onClose={() => { if (!salvando) setAberto(false); }} titulo="Seu perfil" descricao="Escolha um emoji ou uma foto para ficar com a sua cara.">
      <div className={css.painel}>
        {recortando ? <RecorteAvatar foto={fotoOriginal || rascunho} onCancelar={() => setRecortando(false)} onAplicar={foto => { setRascunho(foto); setRecortando(false); }} /> : <>

        <div className={css.previa}>{imagem(rascunho)}</div>
        <p className={css.nome}>{nome}</p>
        <p className={css.rotulo}><Smile size={17} aria-hidden="true" /> Escolha seu emoji</p>
        <div className={css.emojis}>{EMOJIS.map(emoji => <button key={emoji} type="button" aria-label={`Usar emoji ${emoji}`} aria-pressed={rascunho === emoji} disabled={salvando || carregando} onClick={() => setRascunho(emoji)}>{emoji}</button>)}</div>
        <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" className={css.arquivo} aria-label="Selecionar foto de perfil" onChange={event => void escolherFoto(event.target.files?.[0])} />
        <button type="button" className={css.foto} disabled={carregando || salvando} onClick={() => arquivo.current?.click()}><Camera size={18} />{carregando ? "Preparando foto..." : "Escolher foto"}</button>
        {fotoValida(rascunho) && <button type="button" className={css.foto} disabled={carregando || salvando} onClick={() => setRecortando(true)}><Crop size={18} /> Recortar foto</button>}
        <p className={css.ajuda}>JPG, PNG ou WebP, até 5 MB. Seu perfil fica sincronizado em todos os dispositivos.</p>
        {erro && <p role="alert" className={css.erro}>{erro}</p>}
        <div className={css.acoes}><button type="button" className={css.remover} disabled={carregando || salvando || !rascunho} onClick={() => setRascunho("")}><Trash2 size={16} /> Remover</button><button type="button" className={css.salvar} disabled={carregando || salvando} onClick={salvar}><Check size={17} /> {salvando ? "Salvando..." : "Salvar"}</button></div>
        </>}
      </div>
    </Modal>
  </>;
}
