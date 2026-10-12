"use client";

import { useState, useTransition } from "react";
import { Check, ClipboardCheck, LockKeyhole, Play, RotateCcw, Send } from "lucide-react";
import { responderQuizAula } from "@/actions/quiz-aulas";
import type { QuizAlunoDados, ResultadoQuiz } from "@/lib/aulas/quiz";
import css from "./QuizAula.module.css";

export function QuizAulaAluno({ aulaId, quiz, concluida }: { aulaId: string; quiz: QuizAlunoDados; concluida: boolean }) {
  const [iniciado, setIniciado] = useState(false);
  const [respostas, setRespostas] = useState<(number | null)[]>(quiz.perguntas.map(() => null));
  const [resultado, setResultado] = useState<ResultadoQuiz | null>(quiz.ultimoResultado);
  const [ocupado, startTransition] = useTransition();
  const [erro, setErro] = useState("");
  function enviar() {
    if (respostas.some(r => r === null)) { setErro("Responda todas as perguntas antes de finalizar."); return; }
    setErro("");
    startTransition(async () => {
      try { setResultado(await responderQuizAula(aulaId, quiz.versao, respostas as number[])); }
      catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar as respostas. Tente novamente."); }
    });
  }
  function tentarNovamente() { setResultado(null); setRespostas(quiz.perguntas.map(() => null)); setErro(""); setIniciado(true); }
  return <section className={css.painel} aria-labelledby="titulo-quiz-aluno">
    <div className={css.topo}><span className={css.icone}><ClipboardCheck size={22} /></span><div><h2 id="titulo-quiz-aluno">Vamos praticar?</h2><p className={css.ajuda}>{quiz.perguntas.length} perguntas para revisar o que você aprendeu.</p></div></div>
    {!concluida ? <p className={css.aviso}><LockKeyhole size={16} className="inline" /> Conclua a aula para liberar o quiz. Ele é opcional.</p> : <>
      {!iniciado && <>
        {resultado && <div className={css.resultado}><span className={css.percentual}>{resultado.porcentagem}%</span><div><strong>Seu último resultado</strong><p className={css.ajuda}>{resultado.acertos} de {resultado.total} acertos · salvo no seu perfil</p></div></div>}
        <button type="button" className={css.amarelo} onClick={() => setIniciado(true)}><Play size={17} />{resultado ? "Ver meu resultado" : "Começar quiz"}</button>
      </>}
      {iniciado && (resultado ? <>
        <div role="status" className={css.resultado}><span className={css.percentual}>{resultado.porcentagem}%</span><div><h3>Quiz concluído!</h3><p className={css.ajuda}>{resultado.acertos} de {resultado.total} acertos. Seu resultado foi salvo.</p></div></div>
        <div className={css.lista}>{resultado.itens.map((p, i) => <div key={p.id} className={css.pergunta}>
          <span className={css.selo}>{p.marcada === p.correta ? <><Check size={15} /> Acertou</> : "Vamos revisar"}</span>
          <p className={css.enunciado}>{i + 1}. {p.enunciado}</p>
          <p className={css.ajuda}>Sua resposta: <strong>{String.fromCharCode(65 + p.marcada)}. {p.alternativas[p.marcada]}</strong></p>
          {p.marcada !== p.correta && <p className={css.ajuda}>Resposta correta: <strong>{String.fromCharCode(65 + p.correta)}. {p.alternativas[p.correta]}</strong></p>}
          <p className={css.explicacao}>{p.explicacao}</p>
        </div>)}</div>
        <button type="button" className={css.amarelo} onClick={tentarNovamente}><RotateCcw size={17} /> Tentar novamente</button>
      </> : <form onSubmit={e => { e.preventDefault(); enviar(); }} className={css.lista}>
        {quiz.perguntas.map((p, i) => <fieldset key={p.id} className={css.pergunta} disabled={ocupado}>
          <legend className={css.enunciado}>{i + 1}. {p.enunciado}</legend>
          {p.alternativas.map((alternativa, j) => <label key={j} className={css.alternativa}><input type="radio" required name={`resposta-${p.id}`} value={j} checked={respostas[i] === j} onChange={() => setRespostas(atual => atual.map((r, k) => k === i ? j : r))} /><span><strong>{String.fromCharCode(65 + j)}.</strong> {alternativa}</span></label>)}
        </fieldset>)}
        {erro && <p role="alert" className={css.erro}>{erro}</p>}
        <button type="submit" className={css.amarelo} disabled={ocupado}><Send size={17} />{ocupado ? "Salvando respostas..." : "Finalizar quiz"}</button>
      </form>)}
      <p className={css.ajuda}>Este quiz é uma revisão opcional e não altera o progresso do vídeo.</p>
    </>}
  </section>;
}
