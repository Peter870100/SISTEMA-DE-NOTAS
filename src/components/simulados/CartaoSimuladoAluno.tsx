import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Clock3, Hourglass, Play, Timer } from "lucide-react";
import type { CSSProperties } from "react";
import type { Simulado, Tentativa } from "@/lib/types";
import { correcaoLiberada, formatarDuracao, situacaoSimulado, tempoDeProvaSeg } from "@/lib/simulados/regras";
import { ComecarTentativa } from "./ComecarTentativa";
import css from "./CartaoSimuladoAluno.module.css";

type Tent = Pick<Tentativa, "simulado_id" | "status" | "porcentagem" | "total"> & Partial<Pick<Tentativa, "iniciada_em" | "entregue_em" | "prazo_em" | "tempo_usado_seg">>;
const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function CartaoSimuladoAluno({ simulado: s, tentativa: t, agora }: { simulado: Simulado; tentativa?: Tent; agora: Date }) {
  const entregue = t?.status === "entregue";
  const liberada = entregue && correcaoLiberada(s, agora);
  const nota = liberada && t?.porcentagem != null ? Math.max(0, Math.min(100, Number(t.porcentagem))) : null;
  const situacao = situacaoSimulado(s, agora);
  const status = entregue ? "Entregue" : t ? "Em andamento" : situacao === "aberto" ? "Disponível" : situacao === "agendado" ? "Agendado" : "Encerrado";
  const Icone = s.tipo === "treino" ? Timer : ClipboardList;
  const tempo = entregue && t?.iniciada_em ? tempoDeProvaSeg(s.tipo, { iniciada_em: t.iniciada_em, entregue_em: t.entregue_em ?? null, prazo_em: t.prazo_em ?? null, tempo_usado_seg: t.tempo_usado_seg ?? 0 }) : null;
  return <article className={css.cartao} aria-labelledby={`simulado-${s.id}`}>
    <div className={css.visual}>
      {nota !== null ? <div className={css.nota} style={{ "--nota": `${nota}%` } as CSSProperties}>
        <div><strong>{nota.toLocaleString("pt-BR")}<small>%</small></strong><span>de acerto</span></div>
      </div> : <Icone size={44} strokeWidth={1.6} aria-hidden="true" />}
      <span>{nota !== null ? "Seu resultado" : s.tipo === "treino" ? "Treino pessoal" : "Simulado da turma"}</span>
    </div>
    <div className={css.conteudo}>
      <div className={css.cabecalho}><span className={css.tipo}>{s.tipo === "treino" ? "Prática individual" : "Avaliação da turma"}</span><span className={css.status}>{entregue && <CheckCircle2 size={15} aria-hidden="true" />}{status}</span></div>
      <h3 id={`simulado-${s.id}`} className={css.titulo}>{s.titulo}</h3>
      <div className={css.metadados}>
        <span><Clock3 size={17} aria-hidden="true" />{s.duracao_min ? `${s.duracao_min} minutos` : "Sem limite de tempo"}</span>
        {s.fecha_em && <span><CalendarDays size={17} aria-hidden="true" />Fecha em {fmt(s.fecha_em)}</span>}
        {t?.total != null && <span><ClipboardList size={17} aria-hidden="true" />{t.total} questões</span>}
        {tempo != null && <span><Hourglass size={17} aria-hidden="true" />Você levou {formatarDuracao(tempo)}</span>}
      </div>
      <div className={css.rodape}>
        <p className={css.mensagem}>{entregue
          ? liberada ? "Confira sua correção e revise as questões." : `Correção em ${s.fecha_em ? fmt(s.fecha_em) : "breve"}`
          : t ? "Continue de onde parou." : situacao === "agendado" ? `Abre em ${s.abre_em ? fmt(s.abre_em) : "breve"}` : situacao === "aberto" ? "Pronto para começar?" : "Período de realização encerrado."}</p>
        <div className={css.acoes}>
          {entregue ? <Link href={`/aluno/simulados/${s.id}`} className={css.resultado}>Ver resultado<ArrowRight size={17} aria-hidden="true" /></Link>
            : t ? <Link href={`/aluno/simulados/${s.id}`} className={css.continuar}><Play size={17} aria-hidden="true" />Continuar<ArrowRight size={17} aria-hidden="true" /></Link>
            : situacao === "aberto" ? <ComecarTentativa simuladoId={s.id} rotulo="Começar simulado" /> : null}
        </div>
      </div>
    </div>
  </article>;
}
