import Link from "next/link";
import { ArrowLeft, BookOpenText, ExternalLink, ListChecks, PlayCircle, Timer } from "lucide-react";
import { BotaoJaRevisei } from "@/components/plano/BotaoJaRevisei";
import { BotaoTreinoPlano } from "@/components/plano/BotaoTreinoPlano";
import { dataCurta, quantidadeDaEtapa, rotuloEtapa } from "@/components/plano/rotulos";
import { TreinarAssunto } from "@/components/simulados/TreinarAssunto";
import type { EstudoTela } from "@/lib/estudos/dados";
import type { ExtrasConteudo } from "@/lib/plano/extras";
import { etapaDeTreino } from "@/lib/plano/plano";
import { textoQuestoesDisponiveis } from "@/lib/plano/textos";
import type { ConteudoPlano, RegrasAprendizagem } from "@/lib/plano/tipos";
import { Blocos } from "./Blocos";
import { BotaoRelatarErro } from "./BotaoRelatarErro";
import { ExerciciosFixacao } from "./ExerciciosFixacao";
import css from "./PaginaEstudo.module.css";

const ehHttp = (u: string | null | undefined): u is string => !!u && /^https?:\/\//i.test(u);

/** Estudo ainda sem texto no ar, ou em conferência. */
export function SemEstudo({ estado }: { estado: "sem_material" | "em_conferencia" }) {
  return (
    <div className={css.pagina} data-largura-total>
      <section className={css.cartao}>
        <Link href="/aluno/plano" className={css.voltar}><ArrowLeft size={15} aria-hidden="true" />Voltar ao plano</Link>
        <h1 className={css.titulo}>
          <span className={css.icone} data-icone aria-hidden="true"><BookOpenText size={22} /></span>
          {estado === "sem_material" ? "Ainda não há explicação para este conteúdo" : "Este conteúdo está sendo conferido e volta em breve"}
        </h1>
      </section>
    </div>
  );
}

type LinkTela = { id: string; titulo: string; href: string; externo: boolean };

function linksDoEstudo(estudo: EstudoTela, extras: ExtrasConteudo | undefined): LinkTela[] {
  const vistos = new Set<string>();
  const saida: LinkTela[] = [];
  for (const l of estudo.links) {
    if (vistos.has(l.id) || !ehHttp(l.href)) continue;
    vistos.add(l.id);
    saida.push({ id: l.id, titulo: l.titulo, href: l.href, externo: true });
  }
  for (const m of extras?.materiais ?? []) {
    if (vistos.has(m.id) || !m.href) continue;
    const externo = m.tipo === "link";
    if (externo && !ehHttp(m.href)) continue;
    vistos.add(m.id);
    saida.push({ id: m.id, titulo: m.titulo, href: m.href, externo });
  }
  return saida;
}

function Cartao({ titulo, texto, aviso, children }: { titulo: string; texto: string; aviso?: string | null; children: React.ReactNode }) {
  return (
    <section className={`${css.cartao} ${css.proximo}`} aria-labelledby="proximo-passo">
      <div className={css.proximoTexto}>
        <p className={css.rotulo}>Próximo passo</p>
        <h2 id="proximo-passo" className={css.proximoTitulo}>{titulo}</h2>
        <p>{texto}</p>
        {aviso && <p className={css.aviso}>{aviso}</p>}
      </div>
      <div className={css.acoes}>{children}</div>
    </section>
  );
}

function ProximoPasso({ estudo, plano, extras, regras }: { estudo: EstudoTela; plano: ConteudoPlano | null; extras: ExtrasConteudo | undefined; regras: RegrasAprendizagem | null }) {
  if (!plano || !regras) {
    return (
      <Cartao titulo="Treine este assunto" texto={`10 questões do banco sobre ${estudo.assuntoNome}.`}>
        <TreinarAssunto assuntoId={estudo.assuntoId} materia={estudo.materia} nome={estudo.assuntoNome} className={css.botao} />
      </Cartao>
    );
  }

  const revisar = plano.etapas.find((e) => e.tipo === "revisar");
  const jaEstudei = revisar && revisar.estado !== "feita" ? <BotaoJaRevisei conteudo={estudo.assuntoId} /> : null;
  const etapa = etapaDeTreino(plano);
  const dados = etapa ? plano.etapas.find((e) => e.tipo === etapa) : null;
  const aberto = dados?.treinoAberto ?? null;
  const n = etapa ? quantidadeDaEtapa(etapa, regras) : 0;
  const aviso = etapa && extras && extras.disponiveis !== null && !aberto ? textoQuestoesDisponiveis(plano.nome, extras.disponiveis, n) : null;
  const esconder = extras?.disponiveis === 0 && !aberto;
  const botao = etapa && !esconder ? (
    <BotaoTreinoPlano conteudo={plano.chave} etapa={etapa} treinoAberto={aberto} rotulo={rotuloEtapa(etapa, regras, aberto !== null, plano.situacao)} className={css.botao} />
  ) : null;

  let titulo = "Agora pratique com questões reais";
  let texto = `${n} questões reais do banco sobre ${plano.nome}.`;
  if (plano.situacao === "mais_respostas") {
    titulo = "Faça um diagnóstico";
    texto = `Responda ${n} questões para o plano entender como você está em ${plano.nome}.`;
  } else if (plano.situacao === "concluido") {
    titulo = "Você já concluiu este conteúdo";
    texto = "Se quiser, estude de novo e treine mais.";
  } else if (!etapa) {
    const data = plano.etapas.find((e) => e.tipo === "revisao")?.disponivelEm;
    titulo = "Sua revisão vem depois";
    texto = data ? `A revisão fica disponível em ${dataCurta(data)}.` : "A revisão fica disponível alguns dias depois da prática.";
  }

  return (
    <Cartao titulo={titulo} texto={texto} aviso={aviso}>
      {jaEstudei}
      {botao}
    </Cartao>
  );
}

/** Tela "Estudar este conteúdo": explicação, exercícios de fixação e o próximo passo do plano. */
export function PaginaEstudo({ estudo, plano, extras, regras }: {
  estudo: EstudoTela; plano: ConteudoPlano | null; extras: ExtrasConteudo | undefined; regras: RegrasAprendizagem | null;
}) {
  const links = linksDoEstudo(estudo, extras);
  const estado = (t: "pratica" | "revisao") => plano?.etapas.find((e) => e.tipo === t)?.estado;
  const mostrarFaixa = plano?.situacao === "revisar" && regras !== null;
  const descricao = plano
    ? `No simulado: ${plano.inicial.legenda}. Leia a explicação e confira se entendeu nos exercícios.`
    : "Leia a explicação e confira se entendeu nos exercícios.";

  return (
    <div className={css.pagina} data-largura-total>
      <section className={`${css.cartao} cartao-interativo`}>
        <Link href="/aluno/plano" className={css.voltar}><ArrowLeft size={15} aria-hidden="true" />Voltar ao plano</Link>
        <div className={css.cabecalho}>
          <div className={css.cabecalhoTexto}>
            <p className={css.rotulo}>{estudo.materiaRotulo} · Estudar este conteúdo</p>
            <h1 className={css.titulo}>
              <span className={css.icone} data-icone aria-hidden="true"><BookOpenText size={22} /></span>
              {estudo.assuntoNome}
            </h1>
            <p className={css.descricao}>{descricao}</p>
          </div>
          <span className={css.chip}><Timer size={17} aria-hidden="true" />≈ {estudo.minutos} min</span>
        </div>
      </section>

      {mostrarFaixa && regras && (
        <ol className={css.passos} aria-label="Etapas deste conteúdo no plano">
          <li className={css.passo} data-agora><b>1</b><span><strong>Estudar</strong><small>Você está aqui</small></span></li>
          <li className={css.passo} data-feito={estado("pratica") === "feita" ? "" : undefined}>
            <b>2</b><span><strong>Praticar</strong><small>{regras.questoesPratica} questões reais do banco</small></span>
          </li>
          <li className={css.passo} data-feito={estado("revisao") === "feita" ? "" : undefined}>
            <b>3</b><span><strong>Revisão</strong><small>{regras.diasRevisao} dias depois da prática</small></span>
          </li>
        </ol>
      )}

      <div className={css.colunas}>
        <article className={css.cartao}>
          <h2 className={css.tituloSecao}><span className={css.iconeSecao} aria-hidden="true"><BookOpenText size={18} /></span>Explicação</h2>
          <Blocos blocos={estudo.blocos} imagens={estudo.imagens} />
          <div className={css.extras}>
            <span>
              Texto escrito com apoio de IA.
              {estudo.fonte === "wikipedia" && (
                <>{" "}Fatos conferidos na Wikipédia: {ehHttp(estudo.fonteUrl) ? <a href={estudo.fonteUrl} target="_blank" rel="noopener noreferrer">{estudo.fonteTitulo ?? "Wikipédia"}</a> : (estudo.fonteTitulo ?? "Wikipédia")}.</>
              )}
            </span>
            {links.length > 0 && (
              <ul className={css.links}>
                {links.map((l) => (
                  <li key={l.id}>
                    {l.externo
                      ? <a href={l.href} target="_blank" rel="noopener noreferrer"><PlayCircle size={15} aria-hidden="true" />{l.titulo}<ExternalLink size={13} aria-hidden="true" /></a>
                      : <Link href={l.href}><PlayCircle size={15} aria-hidden="true" />{l.titulo}</Link>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={css.relatar}><BotaoRelatarErro materialId={estudo.materialId} exercicioId={null} /></div>
        </article>

        <section className={`${css.cartao} ${css.lateral}`} aria-label="Exercícios de fixação">
          <h2 className={css.tituloSecao}><span className={css.iconeSecao} aria-hidden="true"><ListChecks size={18} /></span>Confira se entendeu</h2>
          <ExerciciosFixacao materialId={estudo.materialId} exercicios={estudo.exercicios} />
        </section>
      </div>

      <ProximoPasso estudo={estudo} plano={plano} extras={extras} regras={regras} />
    </div>
  );
}
