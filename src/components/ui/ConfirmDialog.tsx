"use client";

import { Modal } from "./Modal";
import { estilos } from "./estilos";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      titulo={title}
      descricao={message}
      rodape={
        <>
          <button type="button" onClick={onCancel} className={estilos.botaoFantasma}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} className={danger ? estilos.botaoPerigo : estilos.botaoPrimario}>
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}
