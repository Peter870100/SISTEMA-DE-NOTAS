"use client";

import { useEffect } from "react";

/**
 * Links como "/aluno/plano#conteudo-<chave>" apontam para um conteúdo que pode estar
 * dentro de uma matéria recolhida: abre a matéria e rola até o conteúdo.
 */
export function AbrirConteudoDoLink() {
  useEffect(() => {
    function abrir() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith("conteudo-")) return;
      const alvo = document.getElementById(id);
      if (!alvo) return;
      let grupo = alvo.closest("details");
      while (grupo) {
        grupo.open = true;
        grupo = grupo.parentElement?.closest("details") ?? null;
      }
      alvo.scrollIntoView({ block: "start" });
    }
    abrir();
    window.addEventListener("hashchange", abrir);
    return () => window.removeEventListener("hashchange", abrir);
  }, []);
  return null;
}
