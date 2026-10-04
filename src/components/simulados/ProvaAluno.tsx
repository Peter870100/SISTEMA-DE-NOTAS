"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { entregar, pausarTreino, pulsoTreino, responder, type ProvaAluno as Prova } from "@/actions/simulados-aluno";
import { PULSO_SEG } from "@/lib/simulados/regras";
import type { Letra } from "@/lib/types";
import { ImagemQuestao } from "@/components/questoes/ImagemQuestao";
import { TextoQuestao } from "@/components/questoes/TextoQuestao";
import { estilos } from "@/components/ui/estilos";

const LETRAS: Letra[] = ["A", "B", "C", "D", "E"];
type Pendente = { questaoId: string; alternativa: Letra | null };
const chaveLocal = (t: string) => `prova:${t}`;

function formatar(seg: number) {
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

export function ProvaAluno({ prova }: { prova: Prova }) {
  const router = useRouter();
  const [atual, setAtual] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, Letra | null>>(prova.respostas);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [restante, setRestante] = useState<number | null>(prova.restanteSeg);
  const fila = useRef<Pendente[]>([]);
  const enviando = useRef(false);
  const encerrando = useRef(false);
  // Diferença entre o relógio do servidor e o do aparelho, para o cronômetro do professor.
  const [desvio] = useState(() => Date.parse(prova.agoraServidor) - Date.now());

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
      await entregar(prova.tentativaId);
    } catch {
      encerrando.current = false;
      setErroEntrega("Não foi possível entregar — verifique a conexão e tente de novo.");
      return;
    }
    try { localStorage.removeItem(chaveLocal(prova.tentativaId)); } catch { /* sem armazenamento local */ }
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
        const r = await responder(prova.tentativaId, p.questaoId, p.alternativa);
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

  // Cronômetro do professor: prazo do servidor menos o "agora" do servidor estimado.
  useEffect(() => {
    if (prova.simulado.tipo !== "professor" || !prova.prazoEm) return;
    const prazo = Date.parse(prova.prazoEm);
    const t = setInterval(() => {
      const r = Math.max(0, Math.floor((prazo - (Date.now() + desvio)) / 1000));
      setRestante(r);
      if (r === 0) void terminar();
    }, 1000);
    return () => clearInterval(t);
  }, [prova.simulado.tipo, prova.prazoEm, desvio, terminar]);

  // Treino com tempo: pulso a cada 15 s enquanto a página está visível; contagem local entre pulsos.
  useEffect(() => {
    if (prova.simulado.tipo !== "treino" || !prova.simulado.duracaoMin) return;
    const pulso = async () => {
      if (document.visibilityState !== "visible") return;
      try { const r = await pulsoTreino(prova.tentativaId); setRestante(r.restanteSeg); if (r.encerrada) await terminar(); } catch { /* tenta no próximo */ }
    };
    const aoMudar = () => { if (document.visibilityState === "hidden") void pausarTreino(prova.tentativaId); else void pulso(); };
    const tPulso = setInterval(() => void pulso(), PULSO_SEG * 1000);
    const tLocal = setInterval(() => { if (document.visibilityState === "visible") setRestante((r) => (r == null ? r : Math.max(0, r - 1))); }, 1000);
    document.addEventListener("visibilitychange", aoMudar);
    void pulso();
    return () => { clearInterval(tPulso); clearInterval(tLocal); document.removeEventListener("visibilitychange", aoMudar); };
  }, [prova.simulado.tipo, prova.simulado.duracaoMin, prova.tentativaId, terminar]);

  const q = prova.questoes[atual];
  const emBranco = prova.questoes.filter((x) => !respostas[x.id]).length;
  const alerta = restante !== null && restante <= 300;

  if (!q) return <p className="text-sm text-muted">Nenhuma questão.</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-semibold text-ink">{prova.simulado.titulo}</h1>
        <div className="flex items-center gap-2">
          {restante !== null && <span role="timer" aria-live="off" className={`rounded-control px-3 py-1 font-mono text-lg tabular-nums ${alerta ? "bg-gold/40 text-gold-ink" : "bg-surface-sunken text-ink"}`}>⏱ {formatar(restante)}</span>}
          {prova.simulado.tipo === "treino" && <button type="button" onClick={async () => { try { await pausarTreino(prova.tentativaId); } catch { /* sai mesmo assim */ } router.push("/aluno/simulados"); }} className={estilos.botaoFantasma}>Pausar</button>}
          <button type="button" onClick={() => { if (window.confirm(emBranco ? `Você deixou ${emBranco} questão(ões) em branco. Entregar mesmo assim?` : "Entregar o simulado?")) void terminar(); }} className={estilos.botaoPrimario}>Entregar</button>
        </div>
      </div>
      {alerta && restante! > 0 && <p role="status" className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">Faltam menos de 5 minutos. Ao zerar, a prova é entregue automaticamente.</p>}
      {erroEntrega && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erroEntrega}</p>}
      {aviso && <p role="status" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{aviso}</p>}
      <section className={`${estilos.card} flex flex-col gap-3 p-4`} aria-label={`Questão ${atual + 1}`}>
        <p className="text-xs text-muted">Questão {atual + 1} de {prova.questoes.length} · <span aria-live="polite">{salvando ? "salvando…" : "salvo ✓"}</span></p>
        <TextoQuestao texto={q.enunciado} />
        {q.imagens.filter((i) => i.alvo === "enunciado").map((i) => <ImagemQuestao key={i.id} imagem={i} />)}
        {q.comando && <p className="text-sm font-medium text-ink">{q.comando}</p>}
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Alternativas</legend>
          {LETRAS.map((l) => (
            <label key={l} className={`flex cursor-pointer items-start gap-2 rounded-control border p-2 text-sm ${respostas[q.id] === l ? "border-brand bg-brand/10" : "border-line"}`}>
              <input type="radio" name={`q-${q.id}`} checked={respostas[q.id] === l} onChange={() => marcar(q.id, l)} className="mt-1" />
              <span className="flex-1"><strong>{l})</strong> {q.alternativas.find((a) => a.letra === l)?.texto}
                {q.imagens.filter((i) => i.alvo === l).map((i) => <ImagemQuestao key={i.id} imagem={i} />)}</span>
            </label>
          ))}
          {respostas[q.id] && <button type="button" onClick={() => marcar(q.id, null)} className={`${estilos.botaoFantasma} w-fit text-xs`}>Limpar resposta</button>}
        </fieldset>
      </section>
      <div className="flex justify-between">
        <button type="button" disabled={atual === 0} onClick={() => setAtual(atual - 1)} className={estilos.botaoSecundario}>◀ Anterior</button>
        <button type="button" disabled={atual === prova.questoes.length - 1} onClick={() => setAtual(atual + 1)} className={estilos.botaoSecundario}>Próxima ▶</button>
      </div>
      <nav aria-label="Ir para a questão" className="flex flex-wrap gap-1">
        {prova.questoes.map((x, i) => (
          <button key={x.id} type="button" onClick={() => setAtual(i)} aria-current={i === atual ? "step" : undefined} aria-label={`Questão ${i + 1}${respostas[x.id] ? ", respondida" : ""}`}
            className={`h-9 w-9 rounded-control text-sm font-semibold ${i === atual ? "ring-2 ring-brand" : ""} ${respostas[x.id] ? "bg-brand text-white" : "bg-surface-sunken text-ink"}`}>{i + 1}</button>
        ))}
      </nav>
    </div>
  );
}
