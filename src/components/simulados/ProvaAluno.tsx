"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { entregar, pausarTreino, pulsoTreino, responder, type ProvaAluno as Prova } from "@/actions/simulados-aluno";
import { fecharSaidaPendente, mesclarPresenca, type Presenca } from "@/lib/hermes/presenca";
import { formatarDuracao, PULSO_SEG, type TemposQuestoes } from "@/lib/simulados/regras";
import type { Letra } from "@/lib/types";
import { ImagemIndisponivel, ImagemQuestao } from "@/components/questoes/ImagemQuestao";
import { ConteudoQuestao, TextoAlternativa } from "@/components/questoes/ConteudoQuestao";
import { estilos } from "@/components/ui/estilos";
import { Modal } from "@/components/ui/Modal";

import css from "./ProvaAluno.module.css";

const LETRAS: Letra[] = ["A", "B", "C", "D", "E"];
type Pendente = { questaoId: string; alternativa: Letra | null };
const chaveLocal = (t: string) => `prova:${t}`;
const chaveTempo = (t: string) => `prova-tempo:${t}`;
const chavePresenca = (t: string) => `prova-presenca:${t}`;
const AVISO_SAIDAS = "A plataforma registra quando você sai desta página durante a prova.";

/** Prova do professor: tempo desde o início, parando no prazo. */
function decorridoProfessor(iniciadaEm: string, prazoEm: string | null, agoraMs: number) {
  const fim = Math.min(agoraMs, prazoEm ? Date.parse(prazoEm) : Infinity);
  return Math.max(0, Math.floor((fim - Date.parse(iniciadaEm)) / 1000));
}

export function ProvaAluno({ prova }: { prova: Prova }) {
  const router = useRouter();
  const [atual, setAtual] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, Letra | null>>(prova.respostas);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [restante, setRestante] = useState<number | null>(prova.restanteSeg);
  const [decorrido, setDecorrido] = useState(() => prova.simulado.tipo === "professor"
    ? decorridoProfessor(prova.iniciadaEm, prova.prazoEm, Date.parse(prova.agoraServidor))
    : prova.usadoSeg);
  // Segundos que cada questão ficou na tela (acumulado; também guardado no aparelho).
  const tempos = useRef<TemposQuestoes>({ ...prova.temposSeg });
  const presenca = useRef<Presenca>({ saidas: 0, tempoForaSeg: 0, eventos: [] });
  const atualRef = useRef(0);
  const fila = useRef<Pendente[]>([]);
  const enviando = useRef(false);
  const encerrando = useRef(false);
  const pulsoRef = useRef<(() => Promise<void>) | null>(null);
  // Diferença entre o relógio do servidor e o do aparelho, para o cronômetro do professor.
  const [desvio] = useState(() => Date.parse(prova.agoraServidor) - Date.now());

  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [erroEntrega, setErroEntrega] = useState<string | null>(null);

  // Backup local = só o que ainda não foi confirmado pelo servidor.
  const backup = useCallback((alterar: (b: Record<string, Letra | null>) => void) => {
    try {
      const b: Record<string, Letra | null> = JSON.parse(localStorage.getItem(chaveLocal(prova.tentativaId)) ?? "{}");
      alterar(b);
      if (Object.keys(b).length) localStorage.setItem(chaveLocal(prova.tentativaId), JSON.stringify(b));
      else localStorage.removeItem(chaveLocal(prova.tentativaId));
    } catch { /* sem armazenamento local */ }
  }, [prova.tentativaId]);

  const terminar = useCallback(async (esperarFila = true) => {
    if (encerrando.current) return;
    encerrando.current = true;
    setErroEntrega(null);
    if (esperarFila) {
      // Espera as respostas pendentes chegarem ao servidor antes de entregar (no máx. ~10 s).
      for (let i = 0; i < 50 && (enviando.current || fila.current.length); i++) await new Promise((ok) => setTimeout(ok, 200));
    }
    try {
      await entregar(prova.tentativaId, { ...tempos.current }, { ...presenca.current });
    } catch {
      encerrando.current = false;
      setErroEntrega("Não foi possível entregar — verifique a conexão e tente de novo.");
      return;
    }
    try { localStorage.removeItem(chaveLocal(prova.tentativaId)); localStorage.removeItem(chaveTempo(prova.tentativaId)); localStorage.removeItem(chavePresenca(prova.tentativaId)); } catch { /* sem armazenamento local */ }
    router.refresh();
  }, [prova.tentativaId, router]);

  // Envia a fila em ordem; se falhar, tenta de novo a cada 3 s (internet caiu).
  const processar = useCallback(async () => {
    if (enviando.current) return;
    enviando.current = true;
    setSalvando(true);
    while (fila.current.length) {
      const p = fila.current[0];
      const esperar = async (msg: string) => { setAviso(msg); await new Promise((ok) => setTimeout(ok, 3000)); };
      try {
        const r = await responder(prova.tentativaId, p.questaoId, p.alternativa, { ...tempos.current }, { ...presenca.current });
        if (r.ok) {
          backup((b) => { if (b[p.questaoId] === p.alternativa) delete b[p.questaoId]; });
          if (fila.current[0] === p) fila.current.shift();
        } else if ("tentarDeNovo" in r && r.tentarDeNovo) {
          await esperar("Sem conexão — suas respostas estão guardadas e serão enviadas assim que voltar.");
        } else if (r.encerrada) {
          setAviso(r.erro); fila.current = [];
          enviando.current = false;
          await terminar(false);
          break;
        } else {
          setAviso(r.erro); // item inválido de vez: descarta
          backup((b) => { delete b[p.questaoId]; });
          if (fila.current[0] === p) fila.current.shift();
        }
      } catch {
        await esperar("Sem conexão — suas respostas estão guardadas e serão enviadas assim que voltar.");
      }
    }
    enviando.current = false;
    setSalvando(false);
    if (!fila.current.length) setAviso((a) => (a?.startsWith("Sem conexão") ? null : a));
  }, [prova.tentativaId, terminar, backup]);

  function marcar(questaoId: string, alternativa: Letra | null) {
    const novo = { ...respostas, [questaoId]: alternativa };
    setRespostas(novo);
    backup((b) => { b[questaoId] = alternativa; });
    fila.current = [...fila.current.filter((p) => p.questaoId !== questaoId), { questaoId, alternativa }];
    void processar();
  }

  // Backup local: lido só após montar (evita divergência de hidratação). Respostas locais
  // que o servidor não tem entram na mesma fila de envio.
  useEffect(() => {
    let local: Record<string, Letra | null> = {};
    try { local = JSON.parse(localStorage.getItem(chaveLocal(prova.tentativaId)) ?? "{}"); } catch { return; }
    const ids = Object.keys(local).filter((id) => prova.questoes.some((q) => q.id === id) && local[id] !== (prova.respostas[id] ?? null));
    if (ids.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o armazenamento local (sistema externo) só após montar
    setRespostas((r) => ({ ...r, ...Object.fromEntries(ids.map((id) => [id, local[id]])) }));
    for (const id of ids) fila.current = [...fila.current.filter((p) => p.questaoId !== id), { questaoId: id, alternativa: local[id] }];
    void processar();
  }, [prova.tentativaId, prova.questoes, prova.respostas, processar]);

  // Tempo por questão: soma 1 s à questão aberta enquanto a página está visível.
  useEffect(() => { atualRef.current = atual; }, [atual]);
  useEffect(() => {
    try {
      const local: unknown = JSON.parse(localStorage.getItem(chaveTempo(prova.tentativaId)) ?? "{}");
      for (const [id, s] of Object.entries(local ?? {})) if (typeof s === "number" && s > (tempos.current[id] ?? 0)) tempos.current[id] = s;
    } catch { /* sem armazenamento local */ }
    try { presenca.current = mesclarPresenca(presenca.current, JSON.parse(localStorage.getItem(chavePresenca(prova.tentativaId)) ?? "null")); presenca.current = fecharSaidaPendente(presenca.current, new Date()); } catch { /* sem armazenamento local */ }
    const guardarPresenca = () => { try { localStorage.setItem(chavePresenca(prova.tentativaId), JSON.stringify(presenca.current)); } catch { /* sem armazenamento local */ } };
    // Saídas da página: conta cada ida para outra aba/janela e o tempo fora.
    const aoMudarVisibilidade = () => {
      const p = presenca.current;
      const ultimo = p.eventos[p.eventos.length - 1];
      if (document.visibilityState === "hidden") {
        if (encerrando.current || (ultimo && ultimo.voltou_em === null)) return; // já entregue ou "hidden" repetido
        p.saidas += 1;
        p.eventos = [...p.eventos, { questao: atualRef.current + 1, saiu_em: new Date().toISOString(), voltou_em: null }];
      } else if (ultimo && ultimo.voltou_em === null) {
        const agora = new Date();
        p.eventos = [...p.eventos.slice(0, -1), { ...ultimo, voltou_em: agora.toISOString() }];
        p.tempoForaSeg += Math.max(0, Math.round((agora.getTime() - Date.parse(ultimo.saiu_em)) / 1000));
      } else return;
      guardarPresenca();
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    const t = setInterval(() => {
      if (document.visibilityState !== "visible" || encerrando.current) return;
      const id = prova.questoes[atualRef.current]?.id;
      if (!id) return;
      tempos.current[id] = (tempos.current[id] ?? 0) + 1;
      try { localStorage.setItem(chaveTempo(prova.tentativaId), JSON.stringify(tempos.current)); } catch { /* sem armazenamento local */ }
    }, 1000);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", aoMudarVisibilidade); };
  }, [prova.tentativaId, prova.questoes]);

  // Cronômetro do professor: prazo do servidor menos o "agora" do servidor estimado.
  useEffect(() => {
    if (prova.simulado.tipo !== "professor") return;
    const prazo = prova.prazoEm ? Date.parse(prova.prazoEm) : null;
    const t = setInterval(() => {
      setDecorrido(decorridoProfessor(prova.iniciadaEm, prova.prazoEm, Date.now() + desvio));
      if (prazo === null) return;
      const r = Math.max(0, Math.floor((prazo - (Date.now() + desvio)) / 1000));
      setRestante(r);
      if (r === 0) void terminar();
    }, 1000);
    return () => clearInterval(t);
  }, [prova.simulado.tipo, prova.prazoEm, prova.iniciadaEm, desvio, terminar]);

  // Treino: pulso a cada 15 s enquanto a página está visível (conta o tempo ativo); contagem local entre pulsos.
  useEffect(() => {
    if (prova.simulado.tipo !== "treino") return;
    const pulso = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await pulsoTreino(prova.tentativaId, { ...tempos.current }, { ...presenca.current });
        setRestante(r.restanteSeg);
        if (r.usadoSeg != null) setDecorrido(r.usadoSeg);
        if (r.encerrada) await terminar();
      } catch { /* tenta no próximo */ }
    };
    pulsoRef.current = pulso;
    const aoMudar = () => { if (document.visibilityState === "hidden") void pausarTreino(prova.tentativaId, { ...tempos.current }, { ...presenca.current }); else void pulso(); };
    const tPulso = setInterval(() => void pulso(), PULSO_SEG * 1000);
    const tLocal = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setRestante((r) => (r == null ? r : Math.max(0, r - 1)));
      setDecorrido((d) => d + 1);
    }, 1000);
    document.addEventListener("visibilitychange", aoMudar);
    void pulso();
    return () => { clearInterval(tPulso); clearInterval(tLocal); document.removeEventListener("visibilitychange", aoMudar); pulsoRef.current = null; };
  }, [prova.simulado.tipo, prova.tentativaId, terminar]);

  // Treino: ao zerar a contagem local, confirma com o servidor na hora (sem esperar o próximo pulso).
  useEffect(() => {
    if (restante === 0 && prova.simulado.tipo === "treino") void pulsoRef.current?.();
  }, [restante, prova.simulado.tipo]);

  const q = prova.questoes[atual];
  const emBranco = prova.questoes.filter((x) => !respostas[x.id]).length;
  const alerta = restante !== null && restante <= 300;

  const respondidas = prova.questoes.length - emBranco;
  function navegar(indice: number) {
    setAtual(indice);
    document.getElementById("caderno-questao")?.scrollIntoView({ block: "start" });
  }

  if (!q) return <p className={css.textoPainel}>Nenhuma questão.</p>;
  return (
    <div className={css.prova} data-prova-aluno>
      {confirmacaoAberta && (
        <div className={css.confirmacao}>
          <Modal open onClose={() => setConfirmacaoAberta(false)} largura="md"
            titulo="Entregar o simulado?"
            descricao={emBranco
              ? `Você deixou ${emBranco} questão(ões) em branco. Deseja entregar mesmo assim?`
              : "Todas as questões foram respondidas. Deseja confirmar a entrega?"}
            rodape={<>
              <button type="button" onClick={() => setConfirmacaoAberta(false)} className={`${estilos.botaoSecundario} ${css.cancelarEntrega}`}>Continuar revisando</button>
              <button type="button" onClick={() => { setConfirmacaoAberta(false); void terminar(); }} className={`${estilos.botaoPrimario} ${css.confirmarEntrega}`}>Confirmar entrega</button>
            </>}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className={css.rotulo}>Caderno de questões</p><h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{prova.simulado.titulo}</h1></div>
        <div className="flex items-center gap-2">
          {restante !== null && <span role="timer" aria-live="off" className={`rounded-control px-3 py-1 font-mono text-lg tabular-nums ${alerta ? "bg-gold/40 text-gold-ink" : "bg-surface-sunken text-ink"}`}>⏱ {formatarDuracao(restante)}</span>}
          {prova.simulado.tipo === "treino" && <button type="button" onClick={async () => { try { await pausarTreino(prova.tentativaId, { ...tempos.current }, { ...presenca.current }); } catch { /* sai mesmo assim */ } router.push("/aluno/simulados"); }} className={`${estilos.botaoFantasma} ${css.acaoDiscreta}`}>Pausar</button>}
          <button type="button" onClick={() => setConfirmacaoAberta(true)} className={`${estilos.botaoPrimario} ${css.acaoPrincipal}`}>Entregar</button>
        </div>
      </div>
      {alerta && restante! > 0 && <p role="status" className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">Faltam menos de 5 minutos. Ao zerar, a prova é entregue automaticamente.</p>}
      {erroEntrega && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erroEntrega}</p>}
      {aviso && <p role="status" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{aviso}</p>}
      <div className={css.layout}><div className="min-w-0"><section id="caderno-questao" className={css.caderno} aria-label={`Questão ${atual + 1}`}>
        <div className={css.cabecalho}><span>Simulado · questões objetivas</span><span>{atual + 1} / {prova.questoes.length}</span></div><div className={css.titulo}><h2>QUESTÃO {String(atual + 1).padStart(2, "0")}</h2><span aria-hidden="true" /></div>
        <ConteudoQuestao doc={q.conteudo} textoAntigo={q.enunciado} imagens={q.imagens} classeTexto={css.texto} classeFigura={css.figura}
          aviso={q.faltaImagem ? <div className={css.figura}><ImagemIndisponivel /></div> : null} />
        {q.comando && <p className={css.comando}>{q.comando}</p>}
        <fieldset className={css.alternativas}>
          <legend className="sr-only">Alternativas</legend>
          {LETRAS.map((l) => (
            <label key={l} className={css.alternativa}>
              <input type="radio" name={`q-${q.id}`} value={l} aria-label={`Alternativa ${l}`} checked={respostas[q.id] === l} onChange={() => marcar(q.id, l)} className={css.radio} />
              <span className={css.letra} aria-hidden="true">{l}</span>
              <div className={css.texto}>{(() => { const alt = q.alternativas.find((a) => a.letra === l); return <TextoAlternativa doc={alt?.conteudo ?? null} texto={alt?.texto ?? ""} markdown />; })()}
                {q.imagens.filter((i) => i.alvo === l).map((i) => <div key={i.id} className={css.figuraAlternativa}><ImagemQuestao imagem={i} /></div>)}</div>
            </label>
          ))}
          {respostas[q.id] && <button type="button" onClick={() => marcar(q.id, null)} className={`${estilos.botaoFantasma} ${css.acaoDiscreta} w-fit text-xs`}>Limpar resposta</button>}
        </fieldset>
      </section>
      <div className="mt-5 flex justify-between gap-3">
        <button type="button" disabled={atual === 0} onClick={() => navegar(atual - 1)} className={`${css.navegacao} ${css.anterior}`}>◀ Anterior</button>
        <button type="button" disabled={atual === prova.questoes.length - 1} onClick={() => navegar(atual + 1)} className={`${css.navegacao} ${css.proxima}`}>Próxima ▶</button>
      </div>
      </div><aside className={css.painel} aria-label="Progresso do simulado">
        <p className={css.rotulo}>Seu progresso</p>
        <p className={css.cronometro} role="timer" aria-live="off" aria-label={`Tempo de prova: ${formatarDuracao(decorrido)}`}>
          <span aria-hidden="true">⏱</span><strong>{formatarDuracao(decorrido)}</strong><span>de prova</span>
        </p>
        <p className={css.contagem}><strong>{respondidas}</strong> de {prova.questoes.length}</p>
        <p className={css.textoPainel}>questões respondidas</p>
        <progress className={css.progresso} value={respondidas} max={prova.questoes.length} aria-label="Questões respondidas" />
        <p className={css.textoPainel}>{AVISO_SAIDAS}</p>
        <p className={css.salvamento} role="status">{salvando ? "Salvando respostas…" : aviso ? "Confira o aviso de salvamento" : "Respostas salvas"}</p>
        <p className={css.resumoQuestoes}>{prova.questoes.length} questões <span>· {emBranco} a responder</span></p>
        <nav aria-label="Ir para a questão" className={css.mapa}>
        {prova.questoes.map((x, i) => (
          <button key={x.id} type="button" onClick={() => navegar(i)} aria-current={i === atual ? "step" : undefined} aria-label={`Questão ${i + 1}${respostas[x.id] ? ", respondida" : ""}`}
            className={`${css.numero} ${respostas[x.id] ? css.respondida : ""}`}>{String(i + 1).padStart(2, "0")}</button>
        ))}
      </nav>
        <div className={css.legenda}><span><i className={css.respondida} />Respondida</span><span><i />Em branco</span></div>
        <p className={css.pendentes}>{emBranco ? `${emBranco} questão(ões) em branco` : "Todas as questões respondidas"}</p>
      </aside></div>
    </div>
  );
}
