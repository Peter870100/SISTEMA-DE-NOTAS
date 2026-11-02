import { MATERIAS, ehMateria } from "@/lib/questoes/materias";
import { REGRAS, textoMaisRespostas, textoRevisar, type Regras } from "./regras";
import type { AtividadeEvolucao, Comparacao, ConteudoDesempenho, MateriaDesempenho, PainelDesempenho, Prioridade, RespostaDesempenho, ResumoGeral } from "./tipos";

const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);
const emBranco = (r: RespostaDesempenho) => r.alternativa == null;
const acerto = (r: RespostaDesempenho) => !emBranco(r) && r.correta === true;
const erro = (r: RespostaDesempenho) => !emBranco(r) && r.correta !== true;
/** Chave do conteúdo: o assunto, ou a matéria quando a questão não tem assunto. */
export const chaveConteudo = (r: Pick<RespostaDesempenho, "assuntoId" | "materia">) => r.assuntoId ?? `materia:${r.materia ?? "sem_materia"}`;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const porErro = (a: ConteudoDesempenho, b: ConteudoDesempenho) => b.taxaErro - a.taxaErro || b.erros - a.erros || a.nome.localeCompare(b.nome, "pt-BR");

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

/** Agrupa as primeiras respostas por assunto (sem assunto, pela matéria). */
export function porConteudo(rs: RespostaDesempenho[], unidade: "questões" | "respostas" = "questões"): ConteudoDesempenho[] {
  const grupos = new Map<string, ConteudoDesempenho>();
  for (const r of primeirasRespostas(rs)) {
    const chave = chaveConteudo(r);
    let g = grupos.get(chave);
    if (!g) {
      const rotulo = rotuloMateria(r.materia);
      const nome = r.assuntoId ? (r.assuntoNome ?? rotulo) : r.materia ? `${rotulo} (sem assunto)` : rotulo;
      g = { chave, materia: r.materia, materiaRotulo: rotulo, assuntoId: r.assuntoId, nome, questoes: 0, acertos: 0, erros: 0, emBranco: 0, taxaErro: 0, legenda: "" };
      grupos.set(chave, g);
    }
    g.questoes += 1;
    if (acerto(r)) g.acertos += 1;
    else if (emBranco(r)) g.emBranco += 1;
    else g.erros += 1;
  }
  return [...grupos.values()].map((g) => {
    const taxaErro = pct(g.erros, g.questoes);
    return { ...g, taxaErro, legenda: legendaErro({ ...g, taxaErro }, unidade) };
  });
}

/** Conteúdos com erro para o gráfico: maior taxa de erro, depois mais erros, depois nome. */
export function maisErro(cs: ConteudoDesempenho[], regras: Regras = REGRAS): ConteudoDesempenho[] {
  return cs.filter((c) => c.erros > 0).sort(porErro).slice(0, regras.maxConteudosGrafico);
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
  const revisar = cs.filter((c) => c.questoes >= regras.minQuestoesPrioridade && c.taxaErro >= regras.taxaErroPrioridade).sort(porErro);
  const poucas = cs.filter((c) => c.questoes < regras.minQuestoesPrioridade && c.erros > 0).sort(porErro);
  return [
    ...revisar.map((conteudo): Prioridade => ({ tipo: "revisar", conteudo, texto: textoRevisar(conteudo) })),
    ...poucas.map((conteudo): Prioridade => ({ tipo: "mais_respostas", conteudo, texto: textoMaisRespostas(conteudo) })),
  ];
}

/** Monta tudo o que a tela mostra. */
export function montarPainel(rs: RespostaDesempenho[], regras: Regras = REGRAS): PainelDesempenho {
  const conteudos = porConteudo(rs);
  const ev = evolucao(rs);
  return {
    resumo: resumoGeral(rs),
    maisErro: maisErro(conteudos, regras),
    materias: porMateria(conteudos),
    evolucao: ev,
    comparacao: comparar(ev),
    prioridades: prioridades(conteudos, regras),
    primeiraAtividade: ev[0]?.entregueEm ?? null,
  };
}
