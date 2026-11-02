import type { CSSProperties } from "react";
import Link from "next/link";
import { BookOpen, X } from "lucide-react";
import type { QuestaoErrada } from "@/lib/desempenho/dados";
import type { ConteudoDesempenho } from "@/lib/desempenho/tipos";
import { letrasVisiveis } from "@/lib/questoes/materias";
import { enunciadoNaTela } from "@/lib/questoes/markdown";
import { aulasDoTema } from "@/lib/simulados/revisao";
import { ImagemIndisponivel, ImagemQuestao } from "@/components/questoes/ImagemQuestao";
import { ConteudoQuestao, TextoAlternativa } from "@/components/questoes/ConteudoQuestao";
import { TextoQuestao } from "@/components/questoes/TextoQuestao";
import { TreinarAssunto } from "@/components/simulados/TreinarAssunto";
import css from "./PainelDesempenho.module.css";

type Aula = { id: string; titulo: string };

/** Aulas do tema (link só na visão do aluno) ou o aviso de que ainda não há aula. */
export function AulasDoConteudo({ conteudo, aulas, visao }: { conteudo: ConteudoDesempenho; aulas: Aula[]; visao: "aluno" | "escola" }) {
  const doTema = aulasDoTema(conteudo.nome, aulas);
  if (doTema.length === 0) return visao === "aluno" ? <p className={css.semAula}><BookOpen size={17} aria-hidden="true" />Ainda não há aula sobre este assunto</p> : null;
  return (
    <>
      {doTema.map((a) => visao === "aluno"
        ? <Link key={a.id} href={`/aluno/aulas/${a.id}`} className={css.botaoAula}><BookOpen size={17} aria-hidden="true" /><span>{a.titulo}</span></Link>
        : <span key={a.id} className={css.botaoAula}><BookOpen size={17} aria-hidden="true" /><span>{a.titulo}</span></span>)}
    </>
  );
}

/** Conteúdo aberto: questões erradas ou em branco (enunciado, marcada, certa, resolução) e a revisão sugerida. */
export function DetalheConteudo({ conteudo, erradas, aulas, visao, hrefFechar }: {
  conteudo: ConteudoDesempenho; erradas: QuestaoErrada[]; aulas: Aula[]; visao: "aluno" | "escola"; hrefFechar: string;
}) {
  return (
    <section id="detalhe-conteudo" className={css.detalhe} aria-labelledby="titulo-detalhe">
      <div className={css.detalheTopo}>
        <div>
          <p className={css.rotulo}>{conteudo.materiaRotulo}</p>
          <h3 id="titulo-detalhe" className={css.detalheTitulo}>{conteudo.nome}</h3>
          <p className={css.legendaDetalhe}>{conteudo.legenda}</p>
        </div>
        <Link href={hrefFechar} scroll={false} className={css.fechar}><X size={17} aria-hidden="true" />Fechar</Link>
      </div>

      <div className={css.revisaoSugerida}>
        <span className={css.rotulo}>Revisão sugerida</span>
        <div className={css.acoes}>
          <AulasDoConteudo conteudo={conteudo} aulas={aulas} visao={visao} />
          {visao === "aluno" && <TreinarAssunto assuntoId={conteudo.assuntoId} materia={conteudo.materia} nome={conteudo.nome} className={css.botaoTreinar} />}
        </div>
      </div>

      {erradas.length === 0
        ? <p className={css.vazio}>Nenhuma questão errada ou em branco neste conteúdo.</p>
        : (
          <ol className={css.questoes}>
            {erradas.map((e, i) => {
              const q = e.questao;
              const tela = enunciadoNaTela(q.enunciado, q.comando, Array.isArray(q.conteudo?.content), q.imagens.some((im) => im.alvo === "enunciado"));
              const estado = e.marcada ? "errada" : "branco";
              return (
                <li key={q.id} className={css.questao} data-estado={estado} style={{ "--i": Math.min(i, 15) } as CSSProperties}>
                  <div className={css.questaoTopo}>
                    <span className={css.numero}>Q{String(i + 1).padStart(2, "0")}</span>
                    <span className={css.estado}>{estado === "errada" ? "✗ Errou" : "– Em branco"}</span>
                    <span className={css.respostas}>
                      <span>{visao === "aluno" ? "Sua resposta" : "Resposta"} <b className={`${css.selo} ${e.marcada ? css.seloErro : css.seloVazio}`}>{e.marcada ?? "–"}</b></span>
                      <span aria-hidden="true">→</span>
                      <span>Certa <b className={`${css.selo} ${css.seloOk}`}>{e.certa ?? "–"}</b></span>
                    </span>
                    <span className={css.atividade}>{e.atividadeTitulo}</span>
                  </div>
                  <details className={css.verQuestao}>
                    <summary>Ver questão</summary>
                    <div className={css.corpo}>
                      <ConteudoQuestao doc={q.conteudo} textoAntigo={tela.texto} imagens={q.imagens} figurasAntes={tela.figurasAntes} aviso={q.faltaImagem ? <ImagemIndisponivel /> : null} />
                      {tela.comando && <p className={css.comando}>{tela.comando}</p>}
                      <ul className={css.alternativas}>
                        {letrasVisiveis(q.alternativas, new Set(q.imagens.map((im) => im.alvo))).map((l) => {
                          const alt = q.alternativas.find((a) => a.letra === l);
                          const tipo = e.certa === l ? css.altCerta : e.marcada === l ? css.altErrada : "";
                          return (
                            <li key={l} className={`${css.alternativa} ${tipo}`}>
                              <b className={css.letra}>{l}</b>
                              <div className={css.textoAlternativa}>
                                <TextoAlternativa doc={alt?.conteudo ?? null} texto={alt?.texto ?? ""} />
                                {q.imagens.filter((im) => im.alvo === l).map((im) => <ImagemQuestao key={im.id} imagem={im} />)}
                              </div>
                              {e.certa === l && <span className={css.marca}>✓ Correta</span>}
                              {e.certa !== l && e.marcada === l && <span className={css.marca}>✗ {visao === "aluno" ? "Sua resposta" : "Marcada"}</span>}
                            </li>
                          );
                        })}
                      </ul>
                      {e.resolucao && <div className={css.resolucao}><h4>Resolução</h4><TextoQuestao texto={e.resolucao} /></div>}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
    </section>
  );
}
