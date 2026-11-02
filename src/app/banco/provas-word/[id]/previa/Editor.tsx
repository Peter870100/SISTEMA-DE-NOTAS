"use client";

import { useEffect, useEffectEvent, useRef, useState, useTransition, type FormEvent, type PointerEvent as EventoPonteiro } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, RefreshCw, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { estilos } from "@/components/ui/estilos";
import {
  destinoArraste,
  fendaArraste,
  LIMITE_NOME_PROVA,
  LIMITES_CABECALHO,
  PROVA_MUDOU,
  type CabecalhoProva,
} from "@/lib/folha/editar-prova";
import { moverQuestaoProva, removerQuestaoProva, salvarCabecalhoProva, salvarNomeProva, trocarQuestaoProva } from "../../acoes";
import css from "./Previa.module.css";

export type QuestaoEditor = { indice: number; questaoId: string; rotulo: string; trecho: string };

type Secao = "cabecalho" | "questoes";
type Aviso = { secao: Secao; tipo: "ok" | "erro" | "info"; texto: string } | null;

/** Arraste em andamento: a linha que saiu (`de`) e a fenda (0..n) onde ela cairia. */
type Arraste = { de: number; questaoId: string; fenda: number; y: number; alca: HTMLElement; ponteiro: number };

/** Faixa (px) junto às bordas do painel em que o arraste rola a lista; e o passo máximo por quadro. */
const BORDA_ROLAGEM = 56;
const PASSO_ROLAGEM = 14;

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
  const corpo = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLOListElement>(null);
  /** Dados do arraste lidos nos eventos do ponteiro; o estado `arraste` só redesenha a lista. */
  const arrasteAtual = useRef<Arraste | null>(null);
  const [arraste, setArraste] = useState<{ de: number; fenda: number } | null>(null);
  const arrastando = arraste !== null;

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
      // O "Nome ou apelido do professor" é da conta do professor: vai numa chamada a mais, junto com o cabeçalho.
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

  /** Recalcula a fenda sob o ponteiro (depois de mexer o ponteiro ou de rolar a lista). */
  function acharFenda() {
    const a = arrasteAtual.current;
    if (!a || !lista.current) return;
    const meios = Array.from(lista.current.children, (li) => {
      const r = li.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    const fenda = fendaArraste(meios, a.y);
    if (fenda !== a.fenda) {
      a.fenda = fenda;
      setArraste({ de: a.de, fenda });
    }
  }

  /** Para o arraste sem mover nada (Esc, toque cancelado) ou antes de soltar. */
  function encerrarArraste() {
    const a = arrasteAtual.current;
    arrasteAtual.current = null;
    setArraste(null);
    if (a && a.alca.hasPointerCapture(a.ponteiro)) a.alca.releasePointerCapture(a.ponteiro);
  }

  function comecarArraste(e: EventoPonteiro<HTMLButtonElement>, questaoId: string, de: number) {
    if (pendente || arrasteAtual.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasteAtual.current = { de, questaoId, fenda: de, y: e.clientY, alca: e.currentTarget, ponteiro: e.pointerId };
    setArraste({ de, fenda: de });
  }

  function moverArraste(e: EventoPonteiro<HTMLButtonElement>) {
    const a = arrasteAtual.current;
    if (!a || e.pointerId !== a.ponteiro) return;
    a.y = e.clientY;
    acharFenda();
  }

  /** Soltou: na mesma posição não faz nada; noutra, usa a mesma ação das setas. */
  function soltarArraste(e: EventoPonteiro<HTMLButtonElement>) {
    const a = arrasteAtual.current;
    if (!a || e.pointerId !== a.ponteiro) return;
    a.y = e.clientY;
    acharFenda();
    encerrarArraste();
    const para = destinoArraste(a.de, a.fenda);
    if (para !== a.de) mover(a.questaoId, a.de, para);
  }

  function cancelarArraste(e: EventoPonteiro<HTMLButtonElement>) {
    const a = arrasteAtual.current;
    if (a && e.pointerId === a.ponteiro) encerrarArraste();
  }

  /** Um quadro de rolagem: perto da borda de cima/baixo do painel, a lista rola sozinha. */
  const rolarNaBorda = useEffectEvent(() => {
    const a = arrasteAtual.current;
    const el = corpo.current;
    if (!a || !el) return;
    const r = el.getBoundingClientRect();
    let passo = 0;
    if (a.y < r.top + BORDA_ROLAGEM) passo = -Math.min(PASSO_ROLAGEM, Math.ceil((r.top + BORDA_ROLAGEM - a.y) / 4));
    else if (a.y > r.bottom - BORDA_ROLAGEM) passo = Math.min(PASSO_ROLAGEM, Math.ceil((a.y - r.bottom + BORDA_ROLAGEM) / 4));
    if (passo === 0) return;
    const antes = el.scrollTop;
    el.scrollTop += passo;
    if (el.scrollTop !== antes) acharFenda();
  });

  const teclaNoArraste = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    encerrarArraste();
  });

  // Enquanto arrasta: rolagem nas bordas e Esc para cancelar.
  useEffect(() => {
    if (!arrastando) return;
    let quadro = 0;
    const passo = () => {
      rolarNaBorda();
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    const tecla = (e: KeyboardEvent) => teclaNoArraste(e);
    window.addEventListener("keydown", tecla);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("keydown", tecla);
    };
  }, [arrastando]);

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
  /** Fenda onde aparece a linha de destino; null se não arrasta ou se cairia no mesmo lugar. */
  const fendaVisivel = arraste && destinoArraste(arraste.de, arraste.fenda) !== arraste.de ? arraste.fenda : null;

  return createPortal(
    <aside data-previa-editor="" className={css.editor} aria-labelledby="titulo-editor">
      <div className={css.editorTopo}>
        <h2 id="titulo-editor" ref={tituloPainel} tabIndex={-1} className={css.editorTitulo}>Editar prova</h2>
        <button type="button" className={css.editorFechar} aria-label="Fechar o painel Editar" onClick={aoFechar}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div ref={corpo} className={css.editorCorpo}>
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
                Nome ou apelido do professor
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
          <ol ref={lista} className={arrastando ? `${css.editorLista} ${css.editorListaArrastando}` : css.editorLista}>
            {questoes.map((q, i) => {
              const n = i + 1;
              const classes = [
                css.editorQuestao,
                arraste?.de === i ? css.editorArrastada : "",
                fendaVisivel === i ? css.editorSoltarAntes : "",
                fendaVisivel === total && i === total - 1 ? css.editorSoltarDepois : "",
              ].filter(Boolean).join(" ");
              return (
                <li key={q.questaoId} className={classes}>
                  <div className={css.editorCabecaQuestao}>
                    <button
                      type="button"
                      className={css.editorAlca}
                      aria-label={`Arrastar questão ${n}`}
                      title="Arraste para mudar a ordem"
                      disabled={pendente || total <= 1}
                      onPointerDown={(e) => comecarArraste(e, q.questaoId, i)}
                      onPointerMove={moverArraste}
                      onPointerUp={soltarArraste}
                      onPointerCancel={cancelarArraste}
                      onLostPointerCapture={cancelarArraste}
                    >
                      <GripVertical size={16} aria-hidden="true" />
                    </button>
                    <p className={css.editorRotulo}>
                      {n}. {q.rotulo || "Questão"}
                    </p>
                  </div>
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
