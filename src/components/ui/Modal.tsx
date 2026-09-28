"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  largura?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  rodape?: React.ReactNode;
};

const LARGURAS = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" } as const;

/** Casca de modal do tema: <dialog> nativo (Esc e foco preso de graça), overlay azul com blur. */
export function Modal({ open, onClose, titulo, descricao, largura = "sm", children, rodape }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const descricaoId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const anterior = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={tituloId}
      aria-describedby={descricao ? descricaoId : undefined}
      className={`fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] ${LARGURAS[largura]} overflow-auto overscroll-contain rounded-float border border-white bg-surface p-0 text-ink shadow-float backdrop:bg-frame-deep/40 backdrop:backdrop-blur-sm`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const r = event.currentTarget.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose();
      }}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={tituloId} className="font-display text-lg font-semibold tracking-tight text-ink">
              {titulo}
            </h2>
            {descricao && (
              <p id={descricaoId} className="mt-1 text-sm text-muted">
                {descricao}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-control p-1.5 text-faint hover:bg-surface-sunken hover:text-ink">
            <X size={18} />
          </button>
        </div>
        {children}
        {rodape && <div className="flex justify-end gap-2 pt-1">{rodape}</div>}
      </div>
    </dialog>
  );
}
