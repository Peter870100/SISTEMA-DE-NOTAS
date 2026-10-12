"use client";

import { FileText, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import base from "@/components/admin/ContasAdmin.module.css";
import css from "./ConfirmarImportacao.module.css";

type Props = {
  open: boolean;
  paginas: number;
  paginasGabarito: number;
  custo: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmarImportacao({ open, paginas, paginasGabarito, custo, onConfirm, onCancel }: Props) {
  return (
    <Modal open={open} onClose={onCancel} largura="md"
      titulo={<span className={css.heading}><span className={base.icon}><FileText size={23} aria-hidden="true" /></span><span>Confirmar importação</span></span>}
      descricao="Confira o resumo antes de iniciar a leitura com IA."
      rodape={<div className={css.actions}><button type="button" onClick={onCancel} className={base.secondary}>Cancelar</button><button type="button" onClick={onConfirm} className={base.primary}><Send size={17} aria-hidden="true" />Confirmar e enviar</button></div>}
    >
      <dl className={css.summary}>
        <div><dt>Páginas da prova</dt><dd>{paginas}</dd></div>
        {paginasGabarito > 0 && <div><dt>Páginas do gabarito</dt><dd>{paginasGabarito}</dd></div>}
        <div className={css.cost}><dt>Custo estimado da leitura</dt><dd>≈ US$ {custo.toFixed(2)}</dd></div>
      </dl>
      <p className={css.note}>O custo é uma estimativa. A importação só começa após sua confirmação.</p>
    </Modal>
  );
}
