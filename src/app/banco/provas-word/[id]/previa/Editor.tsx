"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, RefreshCw, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { estilos } from "@/components/ui/estilos";
import { LIMITE_NOME_PROVA, LIMITES_CABECALHO, PROVA_MUDOU, type CabecalhoProva } from "@/lib/folha/editar-prova";
import { moverQuestaoProva, removerQuestaoProva, salvarCabecalhoProva, salvarNomeProva, trocarQuestaoProva } from "../../acoes";
import css from "./Previa.module.css";

export type QuestaoEditor = { indice: number; questaoId: string; rotulo: string; trecho: string };

type Secao = "cabecalho" | "questoes";
type Aviso = { secao: Secao; tipo: "ok" | "erro" | "info"; texto: string } | null;

/** Quando a ação do servidor nem responde (rede caiu, deploy novo): a pré-visualização continua na tela. */
const ERRO_REDE = "Não foi possível salvar. Recarregue a página.";

/** Painel lateral para editar o cabeçalho e as questões da prova; cada ação grava na hora. */
export function Editor({
  provaId,
  titulo,
  cabecalho,
  nomeProva,
  questoes,
  aoFechar,
}: {
  provaId: string;
  titulo: string;
  cabecalho: CabecalhoProva;
  /** Apelido atual de quem vê; null = quem vê não é o professor da prova (o campo não aparece). */
  nomeProva: string | null;
  questoes: QuestaoEditor[];
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Aviso>(null);
  /** Índice da questão cuja troca só acharia questões já usadas (pergunta "Trocar mesmo assim"). */
  const [soUsadas, setSoUsadas] = useState<number | null>(null);
  const [remover, setRemover] = useState<{ indice: number; questaoId: string } | null>(null);
  const tituloPainel = useRef<HTMLHeadingElement>(null);

  // Ao abrir, o foco vai para o painel.
  useEffect(() => {
    tituloPainel.current?.focus();
  }, []);

  /** Mostra o erro; se a prova mudou em outra aba, recarrega a lista. */
  function falhou(secao: Secao, erro: string) {
    setAviso({ secao, tipo: "erro", texto: erro });
    if (erro === PROVA_MUDOU) router.refresh();
  }

  /** Roda a ação na transição; se a chamada ao servidor falhar (rejeitar), mostra o aviso em vez de quebrar a tela. */
  function executar(secao: Secao, acao: () => Promise<void>) {
    iniciar(async () => {
      try {
        await acao();
      } catch {
        setAviso({ secao, tipo: "erro", texto: ERRO_REDE });
      }
    });
  }

  function salvarCabecalho(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const campo = (nome: string) => String(f.get(nome) ?? "");
    setAviso(null);
    executar("cabecalho", async () => {
      // O "Nome na prova" é da conta do professor: vai numa chamada a mais, junto com o cabeçalho.
      const [r, rNome] = await Promise.all([
        salvarCabecalhoProva({
          provaId,
          titulo: campo("titulo"),
          turma: campo("turma"),
          data: campo("data"),
          valor: campo("valor"),
          instrucoes: campo("instrucoes"),
        }),
        nomeProva !== null ? salvarNomeProva(campo("nomeProva")) : Promise.resolve({ ok: true as const }),
      ]);
      const falha = !r.ok ? r : !rNome.ok ? rNome : null;
      if (falha) {
        setAviso({ secao: "cabecalho", tipo: "erro", texto: falha.erro });
        // O que foi salvo aparece na prévia mesmo assim.
        if (r.ok || rNome.ok) router.refresh();
        return;
      }
      setAviso({ secao: "cabecalho", tipo: "ok", texto: "Cabeçalho salvo." });
      router.refresh();
    });
  }

  function mover(questaoId: string, de: number, para: number) {
    setAviso(null);
    setSoUsadas(null);
    executar("questoes", async () => {
      const r = await moverQuestaoProva({ provaId, questaoId, de, para });
      if (!r.ok) {
        falhou("questoes", r.erro);
        return;
      }
      router.refresh();
    });
  }

  function trocar(questaoId: string, indice: number, aceitarUsadas: boolean) {
    setAviso(null);
    setSoUsadas(null);
    executar("questoes", async () => {
      const r = await trocarQuestaoProva({ provaId, questaoId, indice, aceitarUsadas });
      if (!r.ok) {
        falhou("questoes", r.erro);
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
    const alvo = remover;
    setRemover(null);
    if (alvo === null) return;
    const { indice, questaoId } = alvo;
    setAviso(null);
    setSoUsadas(null);
    executar("questoes", async () => {
      const r = await removerQuestaoProva({ provaId, questaoId, indice });
      if (!r.ok) {
        falhou("questoes", r.erro);
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
          <form key={titulo + JSON.stringify(cabecalho) + (nomeProva ?? "")} onSubmit={salvarCabecalho} className={css.editorForm}>
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
            {nomeProva !== null && (
              <label className={css.editorCampo}>
                Nome na prova
                <input name="nomeProva" maxLength={LIMITE_NOME_PROVA} defaultValue={nomeProva} placeholder="Ex.: Cenoura" aria-describedby="editor-nome-prova-ajuda" className={estilos.input} />
                <span id="editor-nome-prova-ajuda" className={css.editorAjuda}>Vale para todas as suas provas. Em branco, sai o seu nome.</span>
              </label>
            )}
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
                    <button type="button" className={css.editorBotao} aria-label={`Subir questão ${n}`} disabled={pendente || i === 0} onClick={() => mover(q.questaoId, i, i - 1)}>
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className={css.editorBotao} aria-label={`Descer questão ${n}`} disabled={pendente || i === total - 1} onClick={() => mover(q.questaoId, i, i + 1)}>
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className={css.editorBotao} aria-label={`Trocar questão ${n}`} disabled={pendente} onClick={() => trocar(q.questaoId, i, false)}>
                      <RefreshCw size={15} aria-hidden="true" />
                      Trocar
                    </button>
                    <button type="button" className={`${css.editorBotao} ${css.editorRemover}`} aria-label={`Remover questão ${n}`} disabled={pendente || total <= 1} onClick={() => setRemover({ indice: i, questaoId: q.questaoId })}>
                      <Trash2 size={15} aria-hidden="true" />
                      Remover
                    </button>
                  </div>
                  {soUsadas === i && (
                    <div className={css.editorPergunta}>
                      <p role="status">Não há outra inédita deste assunto. Trocar por uma que você já usou?</p>
                      <div className={css.editorAcoes}>
                        <button type="button" className={estilos.botaoPrimario} disabled={pendente} onClick={() => trocar(q.questaoId, i, true)}>
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
        title={`Remover a questão ${(remover?.indice ?? 0) + 1}?`}
        message="Ela sai desta prova e as seguintes sobem uma posição."
        confirmLabel="Remover"
        onConfirm={confirmarRemover}
        onCancel={() => setRemover(null)}
      />
    </aside>,
    document.body,
  );
}
