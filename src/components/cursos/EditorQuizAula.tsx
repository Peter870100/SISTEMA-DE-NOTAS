"use client";

import { useState, useTransition } from "react";
import { ClipboardCheck, Pencil, Plus, Save, Send, Sparkles, Trash2 } from "lucide-react";
import { gerarQuizComIA, salvarQuizAula } from "@/actions/quiz-aulas";
import { Modal } from "@/components/ui/Modal";
import type { PedidoQuizIA, PerguntaQuiz, QuizProfessorDados } from "@/lib/aulas/quiz";
import css from "@/components/aulas/QuizAula.module.css";

type Props = { aulaId: string; inicial: QuizProfessorDados | null; iaDisponivel: boolean; avisoInicial?: string };
function novaPergunta(): PerguntaQuiz { return { id: crypto.randomUUID(), enunciado: "", alternativas: ["", "", "", ""], correta: 0, explicacao: "" }; }

export function EditorQuizAula({ aulaId, inicial, iaDisponivel, avisoInicial }: Props) {
  const [perguntas, setPerguntas] = useState(inicial?.rascunho ?? []);
  const [publicado, setPublicado] = useState(inicial?.publicado ?? false);
  const [modo, setModo] = useState<"manual" | "ia">("manual");
  const [fonte, setFonte] = useState("");
  const [quantidade, setQuantidade] = useState(3);
  const [dificuldade, setDificuldade] = useState<PedidoQuizIA["dificuldade"]>("media");
  const [ocupado, startTransition] = useTransition();
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [geradas, setGeradas] = useState<PerguntaQuiz[] | null>(null);
  function alterar(id: string, dados: Partial<PerguntaQuiz>) { setPerguntas(atual => atual.map(p => p.id === id ? { ...p, ...dados } : p)); setAviso(""); }
  function salvar(acao: "rascunho" | "publicar" | "retirar") {
    setErro(""); setAviso("");
    startTransition(async () => {
      try {
        await salvarQuizAula(aulaId, perguntas, acao);
        if (acao !== "rascunho") setPublicado(acao === "publicar");
        setAviso(acao === "publicar" ? "Quiz publicado! Ele aparece depois que o aluno concluir a aula." : acao === "retirar" ? "Quiz retirado da área do aluno. Seu rascunho foi mantido." : "Rascunho salvo. Revise e publique quando estiver pronto.");
      } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    });
  }
  function gerar() {
    setErro(""); setAviso("");
    startTransition(async () => {
      try {
        const novas = await gerarQuizComIA(aulaId, { fonte, quantidade, dificuldade });
        if (perguntas.length) setGeradas(novas); else setPerguntas(novas);
        setAviso("Perguntas geradas como rascunho. Revise o conteúdo, as respostas e as explicações antes de publicar.");
      } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível gerar as perguntas."); }
    });
  }
  return <section className={css.painel} aria-labelledby="titulo-quiz-professor">
    <div className={css.topo}><span className={css.icone}><ClipboardCheck size={22} /></span><div><h2 id="titulo-quiz-professor">Quiz da aula</h2><p className={css.ajuda}>Uma revisão rápida para praticar depois da aula.</p></div></div>
    <span className={css.selo}>{publicado ? "Quiz publicado" : "Ainda não publicado"}</span>
    {avisoInicial && <p role="status" className={css.aviso}>{avisoInicial}</p>}
    <div className={css.abas} aria-label="Forma de criar perguntas">
      <button type="button" className={css.botao} aria-pressed={modo === "manual"} disabled={ocupado} onClick={() => { setModo("manual"); if (!perguntas.length) setPerguntas(Array.from({ length: 3 }, novaPergunta)); }}><Pencil size={17} /> Criar manualmente</button>
      <button type="button" className={css.botao} aria-pressed={modo === "ia"} disabled={ocupado} onClick={() => setModo("ia")}><Sparkles size={17} /> Gerar com IA</button>
    </div>
    {modo === "ia" && <div className={css.gerador}>
      <p className={css.ajuda}>Cole a transcrição do vídeo, um resumo detalhado ou o texto do material de apoio. A IA usa esse conteúdo para criar perguntas; o link do vídeo sozinho não é suficiente.</p>
      {!iaDisponivel && <p className={css.aviso}>A geração por IA precisa ser ativada pelo administrador. Você pode criar perguntas manualmente.</p>}
      <label className={css.campo}>Conteúdo da aula<textarea rows={7} minLength={100} maxLength={30000} value={fonte} disabled={ocupado} onChange={e => setFonte(e.target.value)} placeholder="Cole aqui o conteúdo que servirá de base para as perguntas..." /></label>
      <div className={css.campos}><label className={css.campo}>Quantidade<select value={quantidade} disabled={ocupado} onChange={e => setQuantidade(Number(e.target.value))}>{[3, 4, 5].map(n => <option key={n} value={n}>{n} perguntas</option>)}</select></label>
      <label className={css.campo}>Dificuldade<select value={dificuldade} disabled={ocupado} onChange={e => setDificuldade(e.target.value as PedidoQuizIA["dificuldade"])}><option value="facil">Fácil</option><option value="media">Média</option><option value="desafiadora">Desafiadora</option></select></label></div>
      <button type="button" className={css.amarelo} disabled={ocupado || !iaDisponivel || fonte.trim().length < 100} onClick={gerar}><Sparkles size={18} />{ocupado ? "Preparando..." : "Gerar perguntas"}</button>
    </div>}
    <div className={css.lista}>{perguntas.map((p, i) => <div key={p.id} className={css.pergunta}>
      <div className={css.perguntaTopo}><h3>Pergunta {i + 1}</h3><button type="button" className={css.botao} disabled={ocupado} aria-label={`Excluir pergunta ${i + 1}`} onClick={() => setPerguntas(atual => atual.filter(q => q.id !== p.id))}><Trash2 size={16} /></button></div>
      <label className={css.campo}>Enunciado<textarea rows={3} maxLength={1500} value={p.enunciado} disabled={ocupado} onChange={e => alterar(p.id, { enunciado: e.target.value })} /></label>
      <p className={css.ajuda}>Escreva quatro alternativas e marque a resposta correta.</p>
      {p.alternativas.map((alternativa, j) => <div key={j} className={css.alternativa}>
        <input type="radio" name={`correta-${p.id}`} aria-label={`Alternativa ${String.fromCharCode(65 + j)} correta na pergunta ${i + 1}`} checked={p.correta === j} disabled={ocupado} onChange={() => alterar(p.id, { correta: j })} />
        <label className={css.campo}>Alternativa {String.fromCharCode(65 + j)}<input maxLength={500} value={alternativa} disabled={ocupado} onChange={e => alterar(p.id, { alternativas: p.alternativas.map((a, k) => k === j ? e.target.value : a) })} /></label>
      </div>)}
      <label className={css.campo}>Explicação da resposta<textarea rows={3} maxLength={2000} value={p.explicacao} disabled={ocupado} onChange={e => alterar(p.id, { explicacao: e.target.value })} /></label>
    </div>)}</div>
    {perguntas.length > 0 && perguntas.length < 5 && <button type="button" className={css.botao} disabled={ocupado} onClick={() => setPerguntas(atual => [...atual, novaPergunta()])}><Plus size={17} /> Adicionar pergunta</button>}
    {erro && <p role="alert" className={css.erro}>{erro}</p>}
    {aviso && <p role="status" className={css.aviso}>{aviso}</p>}
    <p className={css.ajuda}>Publique de 3 a 5 perguntas. Salvar o rascunho preserva o quiz que já está publicado. A aula também precisa estar publicada para aparecer ao aluno.</p>
    <div className={`${css.acoes} ${css.rodape}`}><button type="button" className={css.botao} disabled={ocupado} onClick={() => salvar("rascunho")}><Save size={17} /> Salvar rascunho do quiz</button><button type="button" className={css.amarelo} disabled={ocupado || perguntas.length < 3} onClick={() => salvar("publicar")}><Send size={17} />{publicado ? "Publicar alterações do quiz" : "Publicar quiz"}</button>{publicado && <button type="button" className={css.botao} disabled={ocupado} onClick={() => salvar("retirar")}>Retirar quiz do aluno</button>}</div>
    <Modal open={geradas !== null} onClose={() => setGeradas(null)} titulo="Usar as novas perguntas?" descricao="As perguntas geradas substituirão o rascunho que está na tela. O quiz publicado continua igual até você publicar novamente." rodape={<><button type="button" className={css.botao} onClick={() => setGeradas(null)}>Manter rascunho atual</button><button type="button" className={css.amarelo} onClick={() => { if (geradas) setPerguntas(geradas); setGeradas(null); }}>Usar novas perguntas</button></>} />
  </section>;
}
