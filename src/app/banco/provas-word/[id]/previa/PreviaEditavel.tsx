"use client";

import { useState } from "react";
import type { CabecalhoProva } from "@/lib/folha/editar-prova";
import type { DadosPrevia } from "@/lib/folha/previa";
import { Editor, type QuestaoEditor } from "./Editor";
import type { Qual } from "./Folha";
import { Previa } from "./Previa";

/**
 * Prévia + painel "Editar". A `key` da prévia muda quando os dados salvos mudam: depois do
 * `router.refresh()` ela remonta e refaz a paginação. O painel fica fora da `key` e mantém estado e rolagem.
 */
export function PreviaEditavel({
  editor,
  ...props
}: {
  dados: DadosPrevia;
  provaId: string;
  nomeBase: string;
  qual: Qual;
  imprimir: boolean;
  /** `nomeProva`: apelido atual de quem vê, ou null quando quem vê não é o professor da prova (sem o campo). */
  editor: { titulo: string; cabecalho: CabecalhoProva; questoes: QuestaoEditor[]; nomeProva: string | null };
}) {
  const [aberto, setAberto] = useState(false);
  const versao = editor.titulo + JSON.stringify(editor.cabecalho) + editor.questoes.map((q) => q.questaoId).join() + (props.dados.professor ?? "");

  return (
    <>
      <Previa key={versao} {...props} editorAberto={aberto} aoAlternarEditor={() => setAberto((v) => !v)} />
      {aberto && (
        <Editor
          provaId={props.provaId}
          titulo={editor.titulo}
          cabecalho={editor.cabecalho}
          nomeProva={editor.nomeProva}
          questoes={editor.questoes}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}
