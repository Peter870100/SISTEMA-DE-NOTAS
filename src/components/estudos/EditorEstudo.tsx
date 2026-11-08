"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aprovarFoto, marcarLido, recusarFoto, retirarDoAr, salvarExercicio, semErro } from "@/actions/estudos-dono";
import type { ImagemDono, RelatoAberto } from "@/lib/estudos/dados";
import type { ExercicioFixacao, Letra, SituacaoEstudo } from "@/lib/types";
import css from "./Painel.module.css";

type Resultado = { ok: true } | { ok: false; erro: string };

const LETRAS: Letra[] = ["A", "B", "C", "D", "E"];
const rotulos: Record<SituacaoEstudo, string> = { rascunho: "Rascunho", retido: "Retido", publicado: "Publicado", em_conferencia: "Em conferência" };

export type DadosEditor = {
  materialId: string;
  situacao: SituacaoEstudo;
  motivo: string | null;
  checagem: unknown;
  amostra: boolean;
  lido: boolean;
  imagens: ImagemDono[];
  exercicios: ExercicioFixacao[];
  relatos: RelatoAberto[];
};

/** Executa uma ação do dono, mostra o resultado ao lado do botão e atualiza a página. */
function useAcao() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [mensagens, setMensagens] = useState<Record<string, { ok: boolean; texto: string }>>({});
  function executar(chave: string, fn: () => Promise<Resultado>, textoOk = "Salvo.") {
    iniciar(async () => {
      try {
        const r = await fn();
        setMensagens((m) => ({ ...m, [chave]: r.ok ? { ok: true, texto: textoOk } : { ok: false, texto: r.erro } }));
        if (r.ok) router.refresh();
      } catch {
        setMensagens((m) => ({ ...m, [chave]: { ok: false, texto: "Não foi possível concluir. Tente de novo." } }));
      }
    });
  }
  const aviso = (chave: string) => {
    const m = mensagens[chave];
    return m ? <span role={m.ok ? "status" : "alert"} className={m.ok ? css.ok : css.erro}>{m.texto}</span> : null;
  };
  return { pendente, executar, aviso };
}

function RetirarOuDevolver({ alvo, situacao, chave }: { alvo: { materialId: string; exercicioId: string | null }; situacao: SituacaoEstudo; chave: string }) {
  const { pendente, executar, aviso } = useAcao();
  const [motivo, setMotivo] = useState("");
  if (situacao === "em_conferencia") {
    return (
      <div className={css.linha}>
        <button type="button" className={css.botao} disabled={pendente} onClick={() => executar(chave, () => semErro(alvo), "Voltou ao ar.")}>Não há erro</button>
        {aviso(chave)}
      </div>
    );
  }
  if (situacao !== "publicado") return null;
  return (
    <div className={css.linha}>
      <input className={css.campo} style={{ maxWidth: "22rem" }} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo para retirar do ar" aria-label="Motivo para retirar do ar" />
      <button type="button" className={css.botao} data-perigo disabled={pendente || !motivo.trim()} onClick={() => executar(chave, () => retirarDoAr(alvo, motivo), "Retirado do ar.")}>Retirar do ar</button>
      {aviso(chave)}
    </div>
  );
}

function EditorExercicio({ ex, desenhos }: { ex: ExercicioFixacao; desenhos: ImagemDono[] }) {
  const { pendente, executar, aviso } = useAcao();
  const [enunciado, setEnunciado] = useState(ex.enunciado);
  const [alternativas, setAlternativas] = useState(LETRAS.map((l) => ex.alternativas.find((a) => a.letra === l)?.texto ?? ""));
  const [certa, setCerta] = useState<Letra>(ex.resposta_correta);
  const [comentario, setComentario] = useState(ex.comentario);
  const [imagemId, setImagemId] = useState(ex.imagem_id ?? "");

  return (
    <div className={css.itemEditor} data-situacao={ex.situacao}>
      <div className={css.linha}>
        <strong>Exercício {ex.ordem}</strong>
        <span className={css.selo} data-tom={ex.situacao === "publicado" ? undefined : "ouro"}>{rotulos[ex.situacao]}</span>
      </div>
      {ex.motivo && <p><b>Motivo:</b> {ex.motivo}</p>}
      <label className={css.rotuloCampo}>Enunciado
        <textarea className={css.campo} rows={3} value={enunciado} onChange={(e) => setEnunciado(e.target.value)} />
      </label>
      {LETRAS.map((l, i) => (
        <label key={l} className={css.rotuloCampo}>Alternativa {l}
          <input className={css.campo} value={alternativas[i]} onChange={(e) => setAlternativas((a) => a.map((t, k) => (k === i ? e.target.value : t)))} />
        </label>
      ))}
      <div className={css.linha}>
        <label className={css.rotuloCampo}>Resposta correta
          <select className={css.campo} value={certa} onChange={(e) => setCerta(e.target.value as Letra)}>
            {LETRAS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className={css.rotuloCampo}>Figura (desenho)
          <select className={css.campo} value={imagemId} onChange={(e) => setImagemId(e.target.value)}>
            <option value="">Sem figura</option>
            {desenhos.map((d) => <option key={d.id} value={d.id}>{d.alt.slice(0, 60)}</option>)}
          </select>
        </label>
      </div>
      <label className={css.rotuloCampo}>Comentário
        <textarea className={css.campo} rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} />
      </label>
      <p>Mudar enunciado, figura, alternativas ou resposta correta apaga as respostas dos alunos a este exercício. O comentário não apaga.</p>
      <div className={css.linha}>
        <button
          type="button"
          className={css.botao}
          disabled={pendente}
          onClick={() =>
            executar(`ex-${ex.id}`, () =>
              salvarExercicio(ex.id, {
                enunciado,
                imagem_id: imagemId || null,
                alternativas: LETRAS.map((l, i) => ({ letra: l, texto: alternativas[i] })),
                resposta_correta: certa,
                comentario,
              }), "Corrigido e publicado.")
          }
        >Corrigi e publicar</button>
        {aviso(`ex-${ex.id}`)}
      </div>
      <RetirarOuDevolver alvo={{ materialId: ex.material_id, exercicioId: ex.id }} situacao={ex.situacao} chave={`ret-${ex.id}`} />
    </div>
  );
}

/** Painel do dono: situação, avisos, fotos e exercícios. O texto só se lê, acima. Corrigir um exercício o publica direto. */
export function EditorEstudo({ dados }: { dados: DadosEditor }) {
  const { pendente, executar, aviso } = useAcao();
  const desenhos = dados.imagens.filter((i) => i.tipo === "desenho");
  const fotos = dados.imagens.filter((i) => i.tipo === "foto");
  const alvoTexto = { materialId: dados.materialId, exercicioId: null };

  return (
    <div className={css.grade}>
      <section className={css.cartao} aria-labelledby="ed-estado">
        <h2 id="ed-estado">Situação do material</h2>
        <div className={css.grade}>
          <div className={css.linha}>
            <span className={css.selo} data-tom={dados.situacao === "publicado" ? undefined : "ouro"}>{rotulos[dados.situacao]}</span>
            {dados.amostra && <span className={css.selo}>{dados.lido ? "Amostra lida" : "Amostra para ler"}</span>}
            {dados.amostra && !dados.lido && (
              <>
                <button type="button" className={css.botao} data-sec disabled={pendente} onClick={() => executar("lido", () => marcarLido(dados.materialId), "Marcado como lido.")}>Li</button>
                {aviso("lido")}
              </>
            )}
          </div>
          {dados.motivo && <p><b>Motivo:</b> {dados.motivo}</p>}
          {dados.checagem != null && (
            <details>
              <summary>Pareceres das checagens ({Array.isArray(dados.checagem) ? dados.checagem.length : 1})</summary>
              <pre className={css.parecer}>{JSON.stringify(dados.checagem, null, 2)}</pre>
            </details>
          )}
          <RetirarOuDevolver alvo={alvoTexto} situacao={dados.situacao} chave="ret-texto" />
        </div>
      </section>

      {dados.relatos.length > 0 && (
        <section className={css.cartao} aria-labelledby="ed-avisos">
          <h2 id="ed-avisos">Avisos de erro abertos ({dados.relatos.length})</h2>
          <ul className={css.grade}>
            {dados.relatos.map((r) => {
              const ex = dados.exercicios.find((e) => e.id === r.exercicioId);
              return (
                <li key={r.id}>
                  <b>{ex ? `Exercício ${ex.ordem}` : "Texto"}</b> · {r.quem === "aluno" ? "aluno" : r.quem === "professor" ? "professor" : "?"} · {new Date(r.criadoEm).toLocaleDateString("pt-BR")}
                  {r.mensagem ? <> — {r.mensagem}</> : <> — sem mensagem</>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {fotos.length > 0 && (
        <section className={css.cartao} aria-labelledby="ed-fotos">
          <h2 id="ed-fotos">Fotos</h2>
          <div className={css.grade}>
            {fotos.map((f) => (
              <div key={f.id} className={css.foto}>
                {/* eslint-disable-next-line @next/next/no-img-element -- foto do bucket público. */}
                <img src={f.src} alt={f.alt} />
                <div className={css.grade}>
                  <p>{f.alt}</p>
                  <p>Crédito: {f.credito ?? "—"} · Licença: {f.licenca ?? "—"}</p>
                  <div className={css.linha}>
                    <span className={css.selo} data-tom={f.aprovada ? undefined : "ouro"}>{f.aprovada ? "Aprovada" : "Esperando aprovação"}</span>
                    {!f.aprovada && <button type="button" className={css.botao} disabled={pendente} onClick={() => executar(`foto-${f.id}`, () => aprovarFoto(f.id), "Foto aprovada.")}>Aprovar</button>}
                    <button type="button" className={css.botao} data-perigo disabled={pendente} onClick={() => { if (window.confirm("Recusar apaga a foto e a tira do texto. Continuar?")) executar(`foto-${f.id}`, () => recusarFoto(f.id), "Foto apagada."); }}>Recusar</button>
                    {aviso(`foto-${f.id}`)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={css.cartao} aria-labelledby="ed-exs">
        <h2 id="ed-exs">Exercícios</h2>
        <div className={css.grade}>
          {dados.exercicios.length === 0 && <p>Nenhum exercício.</p>}
          {dados.exercicios.map((ex) => <EditorExercicio key={ex.id} ex={ex} desenhos={desenhos} />)}
        </div>
      </section>
    </div>
  );
}
