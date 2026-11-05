"use client";

import { useState } from "react";
import { responderExercicio } from "@/actions/estudos";
import type { ExercicioTela } from "@/lib/estudos/dados";
import type { Letra } from "@/lib/types";
import { BotaoRelatarErro } from "./BotaoRelatarErro";
import { Texto } from "./Texto";
import css from "./PaginaEstudo.module.css";

type Resposta = NonNullable<ExercicioTela["resposta"]>;

/** Um exercício por vez. A correção vem do servidor; estes exercícios não contam no desempenho. */
export function ExerciciosFixacao({ materialId, exercicios }: { materialId: string; exercicios: ExercicioTela[] }) {
  const [saiu, setSaiu] = useState<ReadonlySet<string>>(new Set());
  const [respostas, setRespostas] = useState<Record<string, Resposta>>(() =>
    Object.fromEntries(exercicios.flatMap((e) => (e.resposta ? [[e.id, e.resposta]] : []))),
  );
  const [atual, setAtual] = useState(0);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const lista = exercicios.filter((e) => !saiu.has(e.id));
  if (lista.length === 0) return <p className={css.vazioEx}>Nenhum exercício disponível agora</p>;

  const indice = Math.min(atual, lista.length - 1);
  const ex = lista[indice];
  const resp = respostas[ex.id];
  const feitos = lista.filter((e) => respostas[e.id]).length;
  const acertos = lista.filter((e) => respostas[e.id]?.acertou).length;
  const terminou = feitos === lista.length;

  function irPara(i: number) {
    setAtual(i);
    setErro(null);
  }

  async function marcar(letra: Letra) {
    if (pendente || resp) return;
    setPendente(true);
    setErro(null);
    try {
      const r = await responderExercicio({ exercicioId: ex.id, marcada: letra });
      if (r.ok) setRespostas((antes) => ({ ...antes, [ex.id]: { marcada: r.marcada, acertou: r.acertou, certa: r.certa, comentario: r.comentario } }));
      else setErro(r.erro);
    } catch {
      setErro("Não foi possível registrar a resposta. Tente de novo.");
    } finally {
      setPendente(false);
    }
  }

  function tirar(id: string) {
    setSaiu((antes) => new Set([...antes, id]));
    setErro(null);
  }

  return (
    <div className={css.exercicios}>
      <p className={css.contagem}><span>{feitos} de {lista.length}</span></p>
      <div className={css.barraEx} role="progressbar" aria-label="Exercícios respondidos" aria-valuemin={0} aria-valuemax={lista.length} aria-valuenow={feitos}>
        <span style={{ transform: `scaleX(${feitos / lista.length})` }} />
      </div>
      <div className={css.bolinhas} role="group" aria-label="Escolher exercício">
        {lista.map((e, i) => {
          const r = respostas[e.id];
          return (
            <button key={e.id} type="button" onClick={() => irPara(i)} aria-current={i === indice ? "true" : undefined}
              data-r={r ? (r.acertou ? "ok" : "erro") : undefined}
              aria-label={`Exercício ${i + 1}${r ? (r.acertou ? ", acertou" : ", errou") : ""}`}>{i + 1}</button>
          );
        })}
      </div>

      <div key={ex.id} className={css.exercicio}>
        <div className={css.enunciado}><b>{indice + 1}.</b><span><Texto texto={ex.enunciado} /></span></div>
        {ex.imagem && (
          <figure className={css.figuraEx}>
            {/* eslint-disable-next-line @next/next/no-img-element -- desenho em data URL. */}
            <img src={ex.imagem.src} alt={ex.imagem.alt} />
          </figure>
        )}
        <div role="group" aria-label="Alternativas">
          {ex.alternativas.map((a) => {
            const estado = resp ? (a.letra === resp.certa ? "certa" : a.letra === resp.marcada ? "errada" : undefined) : undefined;
            return (
              <button key={a.letra} type="button" className={css.alt} data-estado={estado} data-feito={resp ? "" : undefined}
                disabled={pendente || !!resp} aria-pressed={resp ? a.letra === resp.marcada : undefined} onClick={() => void marcar(a.letra)}>
                <i aria-hidden="true">{a.letra}</i><span><Texto texto={a.texto} /></span>
              </button>
            );
          })}
        </div>
        {pendente && <p role="status" className={css.aguarde}>Conferindo…</p>}
        {erro && <p role="alert" className={css.erro}>{erro}</p>}
        {resp && (
          <div className={css.comentario} data-r={resp.acertou ? "ok" : "erro"} role="status">
            <strong>{resp.acertou ? "Você acertou" : `Resposta certa: ${resp.certa}`}</strong>
            <Texto texto={resp.comentario} />
          </div>
        )}
        <div className={css.relatar}>
          <BotaoRelatarErro key={ex.id} materialId={materialId} exercicioId={ex.id} aoRelatar={() => tirar(ex.id)} />
        </div>
      </div>

      <div className={css.navEx}>
        <button type="button" className={css.botaoSec} onClick={() => irPara(indice - 1)} disabled={indice === 0 || pendente}>Anterior</button>
        <button type="button" className={css.botao} onClick={() => irPara(indice + 1)} disabled={indice === lista.length - 1 || pendente}>Próxima</button>
      </div>

      {terminou && (
        <p className={css.resumoEx} role="status">
          Você acertou {acertos} de {lista.length}. Esses exercícios não contam no seu desempenho.
        </p>
      )}
    </div>
  );
}
