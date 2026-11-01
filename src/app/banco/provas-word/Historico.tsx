"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Send, Globe, School, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { estilos } from "@/components/ui/estilos";
import { excluirProvaWord, limparProvasWord } from "./acoes";
import css from "./ProvasWord.module.css";

export type ItemHistorico = { id: string; data: string; titulo: string; total: number; origem: "hermes" | "site"; escola: string | null };

type Confirmar = { tipo: "uma"; item: ItemHistorico } | { tipo: "todas" } | null;

/** Histórico das provas em Word do professor: baixar, excluir e limpar tudo. */
export function Historico({ provas }: { provas: ItemHistorico[] }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState<Confirmar>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  function executar() {
    const alvo = confirmar;
    setConfirmar(null);
    if (!alvo) return;
    setAviso(null);
    iniciar(async () => {
      if (alvo.tipo === "uma") {
        const r = await excluirProvaWord(alvo.item.id);
        setAviso(r.ok ? { tipo: "ok", texto: `"${alvo.item.titulo}" saiu do histórico.` } : { tipo: "erro", texto: r.erro });
      } else {
        const r = await limparProvasWord();
        setAviso(r.ok ? { tipo: "ok", texto: `${r.excluidas} ${r.excluidas === 1 ? "prova saiu" : "provas saíram"} do histórico.` } : { tipo: "erro", texto: r.erro });
      }
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="titulo-historico" className="flex flex-col gap-3">
      <div className={css.cabecalhoLista}>
        <h2 id="titulo-historico" className={css.tituloSecao}><FileText size={22} aria-hidden="true" />Provas geradas<span>{provas.length}</span></h2>
        {provas.length > 0 && (
          <button type="button" disabled={ocupado} onClick={() => setConfirmar({ tipo: "todas" })} className={estilos.botaoSecundario}>
            <Trash2 size={16} aria-hidden="true" />Limpar tudo
          </button>
        )}
      </div>
      {aviso && <p role={aviso.tipo === "erro" ? "alert" : "status"} className={aviso.tipo === "erro" ? css.erro : css.ok}>{aviso.texto}</p>}
      {provas.length === 0 ? (
        <p className={css.vazio}>Nenhuma prova em Word ainda. Gere uma acima ou peça para a Hermes no Telegram.</p>
      ) : (
        <ul className={css.lista}>
          {provas.map((p, i) => (
            <li key={p.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <article className={`${css.cartao} cartao-interativo`}>
                <div className={css.topo}>
                  <span className={css.data} data-icone>{p.data}</span>
                  <span className={css.selo}>{p.origem === "hermes" ? <><Send size={13} aria-hidden="true" />Telegram</> : <><Globe size={13} aria-hidden="true" />Site</>}</span>
                  <span className={css.selo}>{p.total} {p.total === 1 ? "questão" : "questões"}</span>
                  {p.escola && <span className={css.selo}><School size={13} aria-hidden="true" />{p.escola}</span>}
                </div>
                <h3 className={css.nome}>{p.titulo}</h3>
                <div className={css.rodape}>
                  <a href={`/api/provas-word/${p.id}/prova`} className={estilos.botaoPrimario}><Download size={16} aria-hidden="true" />Baixar prova</a>
                  <a href={`/api/provas-word/${p.id}/gabarito`} className={estilos.botaoSecundario}><Download size={16} aria-hidden="true" />Baixar gabarito</a>
                  <button type="button" disabled={ocupado} onClick={() => setConfirmar({ tipo: "uma", item: p })} className={`${estilos.botaoFantasma} ${css.excluir}`}>
                    <Trash2 size={16} aria-hidden="true" />Excluir
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirmar !== null}
        title={confirmar?.tipo === "todas" ? "Limpar todo o histórico?" : "Excluir esta prova?"}
        message={
          confirmar?.tipo === "uma"
            ? `"${confirmar.item.titulo}" some da lista e os links dela deixam de abrir. As questões continuam contando como já usadas.`
            : "As provas somem da lista, mas as questões continuam contando como já usadas."
        }
        confirmLabel={confirmar?.tipo === "todas" ? "Limpar tudo" : "Excluir"}
        onConfirm={executar}
        onCancel={() => setConfirmar(null)}
      />
    </section>
  );
}
