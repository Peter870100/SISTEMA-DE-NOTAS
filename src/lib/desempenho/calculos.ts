import { MATERIAS, ehMateria } from "@/lib/questoes/materias";
import { textoCriterio, textoRecomendacao } from "@/lib/plano/textos";
import type { Foco } from "@/lib/plano/tipos";
import { REGRAS, type Regras } from "./regras";
import type { AtividadeEvolucao, Comparacao, ConteudoDesempenho, MateriaDesempenho, PainelDesempenho, Prioridade, RespostaDesempenho, ResumoGeral, TopicoDesempenho } from "./tipos";

const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);
const emBranco = (r: RespostaDesempenho) => r.alternativa == null;
const acerto = (r: RespostaDesempenho) => !emBranco(r) && r.correta === true;
const erro = (r: RespostaDesempenho) => !emBranco(r) && r.correta !== true;
/** Chave do conteúdo: o assunto, ou a matéria quando a questão não tem assunto. */
export const chaveConteudo = (r: Pick<RespostaDesempenho, "assuntoId" | "materia">) => r.assuntoId ?? `materia:${r.materia ?? "sem_materia"}`;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const porErro = (a: ConteudoDesempenho, b: ConteudoDesempenho) => b.taxaErro - a.taxaErro || b.erros - a.erros || a.nome.localeCompare(b.nome, "pt-BR");

/** Prática e revisão do plano de estudo: treinos feitos depois do desempenho inicial. */
export const ehTreinoDepois = (r: Pick<RespostaDesempenho, "planoEtapa">): boolean => r.planoEtapa === "pratica" || r.planoEtapa === "revisao";

/** Respostas que valem como desempenho inicial (sem prática e revisão do plano). */
export const respostasIniciais = (rs: RespostaDesempenho[]): RespostaDesempenho[] => rs.filter((r) => !ehTreinoDepois(r));

/** Tópico com mais erros entre as primeiras respostas de um conteúdo (mínimo 2 erros; empate: maior taxa, depois nome). */
export function focoDoConteudo(primeiras: RespostaDesempenho[]): Foco | null {
  const mapa = new Map<string, Foco>();
  for (const r of primeiras) {
    if (!r.topicoId) continue;
    const f = mapa.get(r.topicoId) ?? { topicoId: r.topicoId, nome: r.topicoNome ?? "Tópico", erros: 0, questoes: 0 };
    f.questoes += 1;
    if (erro(r)) f.erros += 1;
    mapa.set(r.topicoId, f);
  }
  const taxa = (f: Foco) => f.erros / f.questoes;
  const melhores = [...mapa.values()].filter((f) => f.erros >= 2)
    .sort((a, b) => b.erros - a.erros || taxa(b) - taxa(a) || a.nome.localeCompare(b.nome, "pt-BR"));
  return melhores[0] ?? null;
}

/** Primeira resposta de cada conta a cada questão (menor entregueEm; empate: tentativaId). Sem anuladas. */
export function primeirasRespostas(rs: RespostaDesempenho[]): RespostaDesempenho[] {
  const mapa = new Map<string, RespostaDesempenho>();
  for (const r of rs) {
    if (r.anulada) continue;
    const k = `${r.contaId}|${r.questaoId}`;
    const atual = mapa.get(k);
    if (!atual || cmp(r.entregueEm, atual.entregueEm) < 0 || (r.entregueEm === atual.entregueEm && cmp(r.tentativaId, atual.tentativaId) < 0)) mapa.set(k, r);
  }
  return [...mapa.values()];
}

/** Painel de números sobre as primeiras respostas; refeitas = respostas não anuladas descartadas. */
export function resumoGeral(rs: RespostaDesempenho[]): ResumoGeral {
  const primeiras = primeirasRespostas(rs);
  const acertos = primeiras.filter(acerto).length;
  return {
    respondidas: primeiras.length,
    acertos,
    erros: primeiras.filter(erro).length,
    emBranco: primeiras.filter(emBranco).length,
    taxaAcerto: pct(acertos, primeiras.length),
    refeitas: rs.filter((r) => !r.anulada).length - primeiras.length,
  };
}

/** "70% de erro — 7 erros em 10 questões (2 em branco)". */
export function legendaErro(c: Pick<ConteudoDesempenho, "taxaErro" | "erros" | "questoes" | "emBranco">, unidade: "questões" | "respostas" = "questões"): string {
  const singular = unidade === "questões" ? "questão" : "resposta";
  const brancos = c.emBranco > 0 ? ` (${c.emBranco} em branco)` : "";
  return `${c.taxaErro}% de erro — ${c.erros} ${c.erros === 1 ? "erro" : "erros"} em ${c.questoes} ${c.questoes === 1 ? singular : unidade}${brancos}`;
}

function rotuloMateria(m: string | null): string {
  if (!m) return "Sem matéria";
  return ehMateria(m) ? MATERIAS[m].rotulo : m;
}

function topicosDe(primeiras: RespostaDesempenho[], unidade: "questões" | "respostas"): TopicoDesempenho[] {
  const mapa = new Map<string, TopicoDesempenho>();
  for (const r of primeiras) {
    if (!r.topicoId) continue;
    const t = mapa.get(r.topicoId) ?? { topicoId: r.topicoId, nome: r.topicoNome ?? "Tópico", questoes: 0, acertos: 0, erros: 0, emBranco: 0, taxaErro: 0, legenda: "" };
    t.questoes += 1;
    if (acerto(r)) t.acertos += 1;
    else if (emBranco(r)) t.emBranco += 1;
    else t.erros += 1;
    mapa.set(r.topicoId, t);
  }
  return [...mapa.values()].map((t) => {
    const taxaErro = pct(t.erros, t.questoes);
    return { ...t, taxaErro, legenda: legendaErro({ ...t, taxaErro }, unidade) };
  }).sort((a, b) => b.taxaErro - a.taxaErro || b.erros - a.erros || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Agrupa as primeiras respostas por assunto (sem assunto, pela matéria), com foco e tópicos. */
export function porConteudo(rs: RespostaDesempenho[], unidade: "questões" | "respostas" = "questões"): ConteudoDesempenho[] {
  const grupos = new Map<string, { c: ConteudoDesempenho; primeiras: RespostaDesempenho[] }>();
  for (const r of primeirasRespostas(rs)) {
    const chave = chaveConteudo(r);
    let g = grupos.get(chave);
    if (!g) {
      const rotulo = rotuloMateria(r.materia);
      const nome = r.assuntoId ? (r.assuntoNome ?? rotulo) : r.materia ? `${rotulo} (sem assunto)` : rotulo;
      g = { c: { chave, materia: r.materia, materiaRotulo: rotulo, assuntoId: r.assuntoId, nome, questoes: 0, acertos: 0, erros: 0, emBranco: 0, taxaErro: 0, legenda: "", foco: null, topicos: [] }, primeiras: [] };
      grupos.set(chave, g);
    }
    g.primeiras.push(r);
    g.c.questoes += 1;
    if (acerto(r)) g.c.acertos += 1;
    else if (emBranco(r)) g.c.emBranco += 1;
    else g.c.erros += 1;
  }
  return [...grupos.values()].map(({ c: g, primeiras }) => {
    const taxaErro = pct(g.erros, g.questoes);
    return { ...g, taxaErro, legenda: legendaErro({ ...g, taxaErro }, unidade), foco: focoDoConteudo(primeiras), topicos: topicosDe(primeiras, unidade) };
  });
}

/** Conteúdo que já vale como "Revisão prioritária": questões suficientes e taxa de erro no limite ou acima. */
export function ehPrioritario(c: Pick<ConteudoDesempenho, "questoes" | "taxaErro">, regras: Regras = REGRAS): boolean {
  return c.questoes >= regras.minQuestoesPrioridade && c.taxaErro >= regras.taxaErroPrioridade;
}

/**
 * Conteúdos para o gráfico de erros: primeiro os com questões suficientes (pior taxa primeiro), depois os de
 * poucas respostas, para um 100% em 1 questão não passar na frente de 6 erros em 8. Até `maxConteudosGrafico`.
 */
export function maisErro(cs: ConteudoDesempenho[], regras: Regras = REGRAS): ConteudoDesempenho[] {
  const poucas = (c: ConteudoDesempenho) => Number(c.questoes < regras.minQuestoesPrioridade);
  return cs.filter((c) => c.erros > 0).sort((a, b) => poucas(a) - poucas(b) || porErro(a, b)).slice(0, regras.maxConteudosGrafico);
}

/** Matérias com seus conteúdos, a de pior aproveitamento primeiro. */
export function porMateria(cs: ConteudoDesempenho[]): MateriaDesempenho[] {
  const grupos = new Map<string, MateriaDesempenho>();
  for (const c of cs) {
    const chave = c.materia ?? "sem_materia";
    const g = grupos.get(chave) ?? { materia: chave, rotulo: c.materiaRotulo, questoes: 0, acertos: 0, erros: 0, emBranco: 0, taxaAcerto: 0, conteudos: [] };
    g.questoes += c.questoes;
    g.acertos += c.acertos;
    g.erros += c.erros;
    g.emBranco += c.emBranco;
    g.conteudos.push(c);
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, taxaAcerto: pct(g.acertos, g.questoes), conteudos: [...g.conteudos].sort(porErro) }))
    .sort((a, b) => a.taxaAcerto - b.taxaAcerto || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Uma entrada por atividade, com todas as respostas não anuladas dela, por data de entrega. */
export function evolucao(rs: RespostaDesempenho[]): AtividadeEvolucao[] {
  const grupos = new Map<string, AtividadeEvolucao>();
  for (const r of rs) {
    if (r.anulada) continue;
    const g = grupos.get(r.atividadeId) ?? { atividadeId: r.atividadeId, titulo: r.atividadeTitulo, entregueEm: r.entregueEm, acertos: 0, total: 0, pct: 0 };
    g.total += 1;
    if (acerto(r)) g.acertos += 1;
    if (r.entregueEm > g.entregueEm) g.entregueEm = r.entregueEm;
    grupos.set(r.atividadeId, g);
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, pct: pct(g.acertos, g.total) }))
    .sort((a, b) => cmp(a.entregueEm, b.entregueEm) || cmp(a.atividadeId, b.atividadeId));
}

const diaMes = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso));

/** Compara as duas últimas atividades dizendo quais são. */
export function comparar(ev: AtividadeEvolucao[]): Comparacao | null {
  if (ev.length < 2) return null;
  const atual = ev[ev.length - 1];
  const anterior = ev[ev.length - 2];
  const diferenca = atual.pct - anterior.pct;
  const quais = `${atual.titulo} (${diaMes(atual.entregueEm)}) comparado com ${anterior.titulo} (${diaMes(anterior.entregueEm)})`;
  const abs = Math.abs(diferenca);
  const texto = diferenca === 0 ? `= mesma taxa: ${quais}` : `${diferenca > 0 ? "↑" : "↓"} ${abs} ${abs === 1 ? "ponto" : "pontos"}: ${quais}`;
  return { atual, anterior, diferenca, texto };
}

/** "Revisar" (questões suficientes e muito erro) primeiro; depois os que pedem mais respostas. */
export function prioridades(cs: ConteudoDesempenho[], regras: Regras = REGRAS): Prioridade[] {
  const revisar = cs.filter((c) => ehPrioritario(c, regras)).sort(porErro);
  const poucas = cs.filter((c) => c.questoes < regras.minQuestoesPrioridade && c.erros > 0).sort(porErro);
  return [
    ...revisar.map((conteudo): Prioridade => ({ tipo: "revisar", conteudo, texto: textoRecomendacao({ tipo: "revisar", nome: conteudo.nome, erros: conteudo.erros, questoes: conteudo.questoes, foco: conteudo.foco }, regras) })),
    ...poucas.map((conteudo): Prioridade => ({ tipo: "mais_respostas", conteudo, texto: textoRecomendacao({ tipo: "mais_respostas", nome: conteudo.nome, erros: conteudo.erros, questoes: conteudo.questoes, foco: conteudo.foco }, regras) })),
  ];
}

/** Monta tudo o que a tela mostra: números e conteúdos do desempenho inicial; evolução com todas as atividades. */
export function montarPainel(rs: RespostaDesempenho[], regras: Regras = REGRAS): PainelDesempenho {
  const iniciais = respostasIniciais(rs);
  const conteudos = porConteudo(iniciais);
  const ev = evolucao(rs);
  return {
    resumo: resumoGeral(iniciais),
    maisErro: maisErro(conteudos, regras),
    materias: porMateria(conteudos),
    evolucao: ev,
    comparacao: comparar(ev),
    prioridades: prioridades(conteudos, regras),
    primeiraAtividade: ev[0]?.entregueEm ?? null,
    conteudos,
    criterio: textoCriterio(regras),
  };
}
