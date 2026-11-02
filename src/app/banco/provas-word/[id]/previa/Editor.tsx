"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, RefreshCw, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { estilos } from "@/components/ui/estilos";
import { LIMITES_CABECALHO, type CabecalhoProva } from "@/lib/folha/editar-prova";
import { moverQuestaoProva, removerQuestaoProva, salvarCabecalhoProva, trocarQuestaoProva } from "../../acoes";
import css from "./Previa.module.css";

export type QuestaoEditor = { indice: number; questaoId: string; rotulo: string; trecho: string };

type Aviso = { secao: "cabecalho" | "questoes"; tipo: "ok" | "erro" | "info"; texto: string } | null;

/** Painel lateral para editar o cabeçalho e as questões da prova; cada ação grava na hora. */
export function Editor({
  provaId,
  titulo,
  cabecalho,
  questoes,
  aoFechar,
}: {
  provaId: string;
  titulo: string;
  cabecalho: CabecalhoProva;
  questoes: QuestaoEditor[];
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Aviso>(null);
  /** Índice da questão cuja troca só acharia questões já usadas (pergunta "Trocar mesmo assim"). */
  const [soUsadas, setSoUsadas] = useState<number | null>(null);
  const [remover, setRemover] = useState<number | null>(null);
  const tituloPainel = useRef<HTMLHeadingElement>(null);

  // Ao abrir, o foco vai para o painel.
  useEffect(() => {
    tituloPainel.current?.focus();
  }, []);

  function salvarCabecalho(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const campo = (nome: string) => String(f.get(nome) ?? "");
    setAviso(null);
    iniciar(async () => {
      const r = await salvarCabecalhoProva({
        provaId,
        titulo: campo("titulo"),
        turma: campo("turma"),
        data: campo("data"),
        valor: campo("valor"),
        instrucoes: campo("instrucoes"),
      });
      if (!r.ok) {
        setAviso({ secao: "cabecalho", tipo: "erro", texto: r.erro });
        return;
      }
      setAviso({ secao: "cabecalho", tipo: "ok", texto: "Cabeçalho salvo." });
      router.refresh();
    });
  }

  function mover(de: number, para: number) {
    setAviso(null);
    setSoUsadas(null);
    iniciar(async () => {
      const r = await moverQuestaoProva({ provaId, de, para });
      if (!r.ok) {
        setAviso({ secao: "questoes", tipo: "erro", texto: r.erro });
        return;
      }
      router.refresh();
    });
  }

  function trocar(indice: number, aceitarUsadas: boolean) {
    setAviso(null);
    setSoUsadas(null);
    iniciar(async () => {
      const r = await trocarQuestaoProva({ provaId, indice, aceitarUsadas });
      if (!r.ok) {
        setAviso({ secao: "questoes", tipo: "erro", texto: r.erro });
        return;
      }
      if (r.trocada) {
        setAviso({ secao: "questoes", tipo: "ok", texto: `Questão ${indice + 1} trocada.` });
        router.refresh();
      } else if (r.motivo === "so-usadas") {
        setSoUsadas(indice);
      } else if (r.motivo === "sem-base") {
        setAviso({ secao: "questoes", tipo: "info", texto: "Não dá para trocar esta questão; remova-a." });
      } else {
        setAviso({ secao: "questoes", tipo: "info", texto: "Não há outra questão deste assunto no banco." });
      }
    });
  }

  function confirmarRemover() {
    const indice = remover;
    setRemover(null);
    if (indice === null) return;
    setAviso(null);
    setSoUsadas(null);
    iniciar(async () => {
      const r = await removerQuestaoProva({ provaId, indice });
      if (!r.ok) {
        setAviso({ secao: "questoes", tipo: "erro", texto: r.erro });
        return;
      }
      setAviso({ secao: "questoes", tipo: "ok", texto: `Questão ${indice + 1} removida.` });
      router.refresh();
    });
  }

  const mensagem = (secao: "cabecalho" | "questoes") =>
    aviso?.secao === secao && (
      <p role={aviso.tipo === "erro" ? "alert" : "status"} className={aviso.tipo === "erro" ? css.editorErro : aviso.tipo === "ok" ? css.editorOk : css.editorInfo}>
        {aviso.texto}
      </p>
    );

  const total = questoes.length;

  return createPortal(
    <aside data-previa-editor="" className={css.editor} aria-labelledby="titulo-editor">
      <div className={css.editorTopo}>
        <h2 id="titulo-editor" ref={tituloPainel} tabIndex={-1} className={css.editorTitulo}>Editar prova</h2>
        <button type="button" className={css.editorFechar} aria-label="Fechar o painel Editar" onClick={aoFechar}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={css.editorCorpo}>
        <section aria-labelledby="editor-cabecalho" className={css.editorSecao}>
          <h3 id="editor-cabecalho" className={css.editorSubtitulo}>Cabeçalho</h3>
          <form key={titulo + JSON.stringify(cabecalho)} onSubmit={salvarCabecalho} className={css.editorForm}>
            <label className={css.editorCampo}>
              Título
              <input name="titulo" required maxLength={LIMITES_CABECALHO.titulo} defaultValue={titulo} className={estilos.input} />
            </label>
            <div className={css.editorDupla}>
              <label className={css.editorCampo}>
                Turma
                <input name="turma" maxLength={LIMITES_CABECALHO.turma} defaultValue={cabecalho.turma ?? ""} className={estilos.input} />
              </label>
              <label className={css.editorCampo}>
                Data
                <input name="data" type="date" defaultValue={cabecalho.data ?? ""} className={estilos.input} />
              </label>
            </div>
            <label className={css.editorCampo}>
              Valor
              <input name="valor" maxLength={LIMITES_CABECALHO.valor} defaultValue={cabecalho.valor ?? ""} placeholder="Ex.: 10,0" className={estilos.input} />
            </label>
            <label className={css.editorCampo}>
              Instruções
              <textarea name="instrucoes" rows={4} maxLength={LIMITES_CABECALHO.instrucoes} defaultValue={cabecalho.instrucoes ?? ""} className={estilos.input} />
            </label>
            <button type="submit" disabled={pendente} className={estilos.botaoPrimario}>Salvar cabeçalho</button>
            {mensagem("cabecalho")}
          </form>
        </section>

        <section aria-labelledby="editor-questoes" className={css.editorSecao}>
          <h3 id="editor-questoes" className={css.editorSubtitulo}>Questões</h3>
          {mensagem("questoes")}
          <ol className={css.editorLista}>
            {questoes.map((q, i) => {
              const n = i + 1;
              return (
                <li key={q.questaoId} className={css.editorQuestao}>
                  <p className={css.editorRotulo}>
                    {n}. {q.rotulo || "Questão"}
                  </p>
                  {q.trecho && <p className={css.editorTrecho}>{q.trecho}</p>}
                  <div className={css.editorAcoes}>
                    <button type="button" className={css.editorBotao} aria-label={`Subir questão ${n}`} disabled={pendente || i === 0} onClick={() => mover(i, i - 1)}>
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className={css.editorBotao} aria-label={`Descer questão ${n}`} disabled={pendente || i === total - 1} onClick={() => mover(i, i + 1)}>
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className={css.editorBotao} aria-label={`Trocar questão ${n}`} disabled={pendente} onClick={() => trocar(i, false)}>
                      <RefreshCw size={15} aria-hidden="true" />
                      Trocar
                    </button>
                    <button type="button" className={`${css.editorBotao} ${css.editorRemover}`} aria-label={`Remover questão ${n}`} disabled={pendente || total <= 1} onClick={() => setRemover(i)}>
                      <Trash2 size={15} aria-hidden="true" />
                      Remover
                    </button>
                  </div>
                  {soUsadas === i && (
                    <div className={css.editorPergunta}>
                      <p role="status">Não há outra inédita deste assunto. Trocar por uma que você já usou?</p>
                      <div className={css.editorAcoes}>
                        <button type="button" className={estilos.botaoPrimario} disabled={pendente} onClick={() => trocar(i, true)}>
                          Trocar mesmo assim
                        </button>
                        <button type="button" className={estilos.botaoSecundario} disabled={pendente} onClick={() => setSoUsadas(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <ConfirmDialog
        open={remover !== null}
        title={`Remover a questão ${(remover ?? 0) + 1}?`}
        message="Ela sai desta prova e as seguintes sobem uma posição."
        confirmLabel="Remover"
        onConfirm={confirmarRemover}
        onCancel={() => setRemover(null)}
      />
    </aside>,
    document.body,
  );
}
