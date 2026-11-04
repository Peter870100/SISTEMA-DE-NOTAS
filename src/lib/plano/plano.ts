// Plano de estudo derivado (função pura): etapas, rodadas, ordem, tempo da semana e progresso.
// Ver "Etapas do plano" em docs/superpowers/specs/2026-11-03-plano-de-estudo-design.md.

import type { ConteudoDesempenho, Prioridade } from "@/lib/desempenho/tipos";
import { TEMPO_SEMANA_PADRAO } from "./regras";
import { textoCriterio, textoRecomendacao } from "./textos";
import type { ConteudoPlano, EntradaPlano, Etapa, EtapaPlano, Plano, RegrasAprendizagem, TreinoDoPlano } from "./tipos";

const DIA_MS = 24 * 60 * 60 * 1000;
const AVISO_NOVA_RODADA = "Vamos de novo: revise e pratique com questões novas.";

const ms = (iso: string) => new Date(iso).getTime();

function passou(t: TreinoDoPlano, r: RegrasAprendizagem): boolean {
  const pct = t.total != null && t.total > 0 && t.acertos != null ? (t.acertos / t.total) * 100 : 0;
  return pct >= r.metaAcerto;
}

const entregues = (ts: TreinoDoPlano[]) =>
  ts.filter((t) => t.entregueEm != null).sort((a, b) => ms(a.entregueEm!) - ms(b.entregueEm!));

/** O treino criado e não entregue daquela etapa (o mais recente, se houver mais de um). */
function aberto(ts: TreinoDoPlano[], etapa: EtapaPlano): TreinoDoPlano | null {
  const abertos = ts.filter((t) => t.etapa === etapa && t.entregueEm == null).sort((a, b) => ms(a.criadoEm) - ms(b.criadoEm));
  return abertos.at(-1) ?? null;
}

/** Acertos do último treino entregue daquela etapa, em qualquer rodada. */
function ultimoResultado(ts: TreinoDoPlano[], etapa: EtapaPlano): { acertos: number; total: number } | null {
  const t = entregues(ts.filter((x) => x.etapa === etapa)).at(-1);
  return t ? { acertos: t.acertos ?? 0, total: t.total ?? 0 } : null;
}

type Rodada = { rodada: number; inicioRodada: string | null; praticaOk: string | null; concluido: boolean };

/** Percorre as práticas e revisões entregues, em ordem de entrega. */
function percorrer(ts: TreinoDoPlano[], r: RegrasAprendizagem): Rodada {
  const s: Rodada = { rodada: 1, inicioRodada: null, praticaOk: null, concluido: false };
  const novaRodada = (quando: string) => {
    s.rodada += 1;
    s.inicioRodada = quando;
    s.praticaOk = null;
    s.concluido = false;
  };
  for (const t of entregues(ts.filter((x) => x.etapa === "pratica" || x.etapa === "revisao"))) {
    const quando = t.entregueEm!;
    if (t.etapa === "pratica") {
      // "Estudar de novo": a rodada nova começa quando a prática foi criada, não quando foi entregue.
      if (s.concluido) {
        s.concluido = false;
        s.rodada += 1;
        s.inicioRodada = t.criadoEm;
      }
      if (passou(t, r)) s.praticaOk = quando;
      else novaRodada(quando);
    } else if (s.praticaOk != null) {
      if (passou(t, r)) s.concluido = true;
      else novaRodada(quando);
    }
  }
  // "Estudar de novo": uma prática aberta depois de concluído começa outra rodada, do zero.
  const praticaAberta = aberto(ts, "pratica");
  if (s.concluido && praticaAberta) {
    s.concluido = false;
    s.rodada += 1;
    s.inicioRodada = praticaAberta.criadoEm;
    s.praticaOk = null;
  }
  return s;
}

function etapasRevisar(chave: string, ts: TreinoDoPlano[], s: Rodada, e: EntradaPlano): Etapa[] {
  const r = e.regras;
  const revisado = e.revisadoEm[chave];
  const revisou = revisado != null && (s.inicioRodada == null || ms(revisado) > ms(s.inicioRodada));
  let disponivelEm: string | null = null;
  let revisaoLiberada = false;
  if (s.praticaOk != null) {
    const quando = ms(s.praticaOk) + r.diasRevisao * DIA_MS;
    disponivelEm = new Date(quando).toISOString();
    revisaoLiberada = e.agora.getTime() >= quando;
  }
  const feita = (v: boolean, senao: Etapa["estado"]): Etapa["estado"] => (s.concluido || v ? "feita" : senao);
  return [
    {
      tipo: "revisar", estado: feita(revisou, "disponivel"), minutos: e.minutosRevisar[chave] ?? r.minutosMaterial,
      disponivelEm: null, treinoAberto: null, resultado: null,
    },
    {
      tipo: "pratica", estado: feita(s.praticaOk != null, "disponivel"), minutos: r.questoesPratica * r.minutosPorQuestao,
      disponivelEm: null, treinoAberto: aberto(ts, "pratica")?.simuladoId ?? null, resultado: ultimoResultado(ts, "pratica"),
    },
    {
      tipo: "revisao", estado: feita(false, revisaoLiberada ? "disponivel" : "aguardando"), minutos: r.questoesRevisao * r.minutosPorQuestao,
      disponivelEm, treinoAberto: aberto(ts, "revisao")?.simuladoId ?? null, resultado: ultimoResultado(ts, "revisao"),
    },
  ];
}

/** Soma das etapas disponíveis ainda não feitas, em ordem, até a primeira que aguarda data. */
function minutosProximos(etapas: Etapa[]): number {
  let soma = 0;
  for (const et of etapas) {
    if (et.estado === "feita") continue;
    if (et.estado === "aguardando") break;
    soma += et.minutos;
  }
  return soma;
}

function montarConteudo(inicial: ConteudoDesempenho, prioridade: Prioridade | undefined, ts: TreinoDoPlano[], e: EntradaPlano): ConteudoPlano {
  const r = e.regras;
  const temPlano = ts.some((t) => t.etapa === "pratica" || t.etapa === "revisao");
  let situacao: ConteudoPlano["situacao"];
  let rodada = 1;
  let etapas: Etapa[];
  if (!temPlano && prioridade?.tipo === "mais_respostas") {
    situacao = "mais_respostas";
    etapas = [{
      tipo: "diagnostico", estado: "disponivel", minutos: r.questoesDiagnostico * r.minutosPorQuestao,
      disponivelEm: null, treinoAberto: aberto(ts, "diagnostico")?.simuladoId ?? null, resultado: ultimoResultado(ts, "diagnostico"),
    }];
  } else {
    const s = percorrer(ts, r);
    situacao = s.concluido ? "concluido" : "revisar";
    rodada = s.rodada;
    etapas = etapasRevisar(inicial.chave, ts, s, e);
  }

  let etiqueta: string;
  if (situacao === "concluido") etiqueta = "Concluído";
  else if (etapas.some((et) => et.tipo === "revisao" && et.estado === "disponivel")) etiqueta = "Revisão posterior liberada";
  else if (rodada >= 2) etiqueta = `Rodada ${rodada}`;
  else etiqueta = situacao === "mais_respostas" ? "Precisamos de mais respostas" : "Revisão prioritária";

  const depoisDoEstudo = entregues(ts.filter((t) => t.etapa === "pratica" || t.etapa === "revisao"));
  const contar = (etapa: EtapaPlano) => ts.filter((t) => t.etapa === etapa && t.entregueEm != null).length;

  return {
    chave: inicial.chave, materia: inicial.materia, materiaRotulo: inicial.materiaRotulo, assuntoId: inicial.assuntoId, nome: inicial.nome,
    situacao, etiqueta, rodada,
    texto: textoRecomendacao(
      { tipo: situacao === "mais_respostas" ? "mais_respostas" : "revisar", nome: inicial.nome, erros: inicial.erros, questoes: inicial.questoes, foco: inicial.foco },
      r,
    ),
    aviso: rodada >= 2 && situacao !== "concluido" ? AVISO_NOVA_RODADA : null,
    inicial, foco: inicial.foco, etapas,
    feitas: etapas.filter((et) => et.estado === "feita").length, total: etapas.length,
    depois: depoisDoEstudo.length
      ? { acertos: depoisDoEstudo.reduce((n, t) => n + (t.acertos ?? 0), 0), total: depoisDoEstudo.reduce((n, t) => n + (t.total ?? 0), 0) }
      : null,
    historico: { diagnosticos: contar("diagnostico"), praticas: contar("pratica"), revisoes: contar("revisao") },
    minutosProximos: minutosProximos(etapas),
  };
}

/** 1 revisão posterior liberada; 2 em andamento; 3 revisar; 4 diagnóstico. */
function grupo(c: ConteudoPlano): number {
  if (c.etapas.some((et) => et.tipo === "revisao" && et.estado === "disponivel")) return 1;
  if (c.rodada >= 2 || c.etapas.some((et) => et.estado === "feita" || et.treinoAberto != null)) return 2;
  return c.situacao === "mais_respostas" ? 4 : 3;
}

/**
 * Cada pré-requisito que aparece depois sobe para logo antes do primeiro conteúdo que depende dele.
 * Uma passada, na ordem recebida; laços não travam (cada chave sai uma vez).
 */
export function ordenarComPrerequisitos(chaves: string[], prereqs: Record<string, string[]>): string[] {
  const lista = [...new Set(chaves)];
  const depende = (d: string, p: string) => {
    const ps = prereqs[d];
    return d !== p && Array.isArray(ps) && ps.includes(p);
  };
  for (const p of [...lista]) {
    const iDependente = lista.findIndex((d) => depende(d, p));
    const iPre = lista.indexOf(p);
    if (iDependente >= 0 && iDependente < iPre) {
      lista.splice(iPre, 1);
      lista.splice(iDependente, 0, p);
    }
  }
  return lista;
}

export function montarPlano(e: EntradaPlano): Plano {
  const porChave = new Map(e.conteudos.map((c) => [c.chave, c]));
  const prioridade = new Map<string, { p: Prioridade; indice: number }>();
  e.prioridades.forEach((p, indice) => {
    if (!prioridade.has(p.conteudo.chave)) prioridade.set(p.conteudo.chave, { p, indice });
  });
  const treinosPorChave = new Map<string, TreinoDoPlano[]>();
  for (const t of e.treinos) treinosPorChave.set(t.conteudo, [...(treinosPorChave.get(t.conteudo) ?? []), t]);
  const comPraticaOuRevisao = e.treinos.filter((t) => t.etapa === "pratica" || t.etapa === "revisao").map((t) => t.conteudo);

  const itens: ConteudoPlano[] = [];
  for (const chave of new Set([...prioridade.keys(), ...comPraticaOuRevisao])) {
    const inicial = porChave.get(chave) ?? prioridade.get(chave)?.p.conteudo;
    if (!inicial) continue;
    itens.push(montarConteudo(inicial, prioridade.get(chave)?.p, treinosPorChave.get(chave) ?? [], e));
  }

  // Ordem base: as prioridades na ordem recebida; as que só têm treino do plano depois, pelo nome.
  const base = (a: ConteudoPlano, b: ConteudoPlano) => {
    const ia = prioridade.get(a.chave)?.indice ?? Infinity;
    const ib = prioridade.get(b.chave)?.indice ?? Infinity;
    if (ia !== ib) return ia < ib ? -1 : 1;
    return ia === Infinity ? a.nome.localeCompare(b.nome, "pt-BR") : 0;
  };
  const concluidos = itens.filter((c) => c.situacao === "concluido").sort(base);
  const abertos = itens.filter((c) => c.situacao !== "concluido").sort((a, b) => grupo(a) - grupo(b) || base(a, b));
  const porChavePlano = new Map(abertos.map((c) => [c.chave, c]));
  const ordenados = ordenarComPrerequisitos(abertos.map((c) => c.chave), e.prerequisitos).map((k) => porChavePlano.get(k)!);

  const minutosSemana = e.minutosSemana ?? TEMPO_SEMANA_PADRAO;
  const semana: ConteudoPlano[] = [];
  const depois: ConteudoPlano[] = [];
  let soma = 0;
  let cortou = false;
  for (const c of ordenados) {
    if (cortou || c.minutosProximos === 0) {
      depois.push(c);
    } else if (semana.length === 0 || soma + c.minutosProximos <= minutosSemana) {
      semana.push(c);
      soma += c.minutosProximos;
    } else {
      cortou = true;
      depois.push(c);
    }
  }

  const feitas = itens.reduce((n, c) => n + c.feitas, 0);
  const total = itens.reduce((n, c) => n + c.total, 0);
  return {
    semana, depois, concluidos,
    progresso: { feitas, total, pct: total ? Math.round((feitas / total) * 100) : 0 },
    minutosSemana, tempoEscolhido: e.minutosSemana != null, minutosDaSemana: soma, criterio: textoCriterio(e.regras),
  };
}
