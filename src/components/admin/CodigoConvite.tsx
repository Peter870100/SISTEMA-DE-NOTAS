"use client";

import { useState } from "react";
import { KeyRound, Pencil } from "lucide-react";
import { atualizarCodigoConvite } from "@/actions/configuracoes";
import styles from "./ContasAdmin.module.css";

type CodigoConviteProps = {
  codigoInicial: string;
};

export function CodigoConvite({ codigoInicial }: CodigoConviteProps) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [editando, setEditando] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState(codigoInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    if (!novoCodigo.trim()) {
      setErro("Informe um código.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await atualizarCodigoConvite(novoCodigo.trim());
      setCodigo(novoCodigo.trim());
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar o código.");
    } finally {
      setSalvando(false);
    }
  }

    return (<section className={`${styles.card} ${styles.invite}`} aria-labelledby="convite-titulo">
      <div className={styles.sectionTitle}><span className={styles.icon}><KeyRound size={23}/></span><div><p className={styles.eyebrow}>CONVIDE SUA EQUIPE</p><h2 id="convite-titulo">Código de convite</h2><p>Compartilhe este código para o professor se cadastrar na escola.</p></div></div>
      {erro && <p role="alert" className={styles.error}>{erro}</p>}
      {editando ? <form onSubmit={handleSalvar} className={styles.inviteEdit}><label>Novo código<input required value={novoCodigo} onChange={(e) => setNovoCodigo(e.target.value)} autoFocus/></label><button type="submit" disabled={salvando} className={styles.primary}>{salvando ? "Salvando..." : "Salvar"}</button><button type="button" disabled={salvando} onClick={() => { setEditando(false); setNovoCodigo(codigo); setErro(null); }} className={styles.secondary}>Cancelar</button></form> : <div className={styles.inviteEdit}><span className={styles.code}>{codigo}</span><button type="button" onClick={() => setEditando(true)} className={styles.secondary}><Pencil size={16}/>Alterar código</button></div>}
    </section>);
}
