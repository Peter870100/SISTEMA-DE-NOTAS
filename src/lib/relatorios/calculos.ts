/**
 * Cálculos puros dos relatórios do aluno e da turma (sem Supabase).
 * As páginas e a Hermes usam estas mesmas funções, para dizerem a mesma coisa.
 */
import { normalizarBusca } from "@/lib/hermes/relatorios";
import { MATERIAS } from "@/lib/questoes/materias";
import type {
  AcertoMateria,
  BimestreAluno,
  FaixaDistribuicao,
  LinhaSimuladoAluno,
  RelatorioAluno,
  RelatorioTurma,
  ResultadoQuantoFalta,
  ResumoAulas,
  SituacaoSimulado,
} from "./tipos";

/** Número de bimestres do ano letivo. */
export const BIMESTRES_NO_ANO = 4;
/** Abaixo disso, a matéria aparece com o aviso "poucas questões". */
export const MINIMO_QUESTOES = 5;
const EPS = 1e-9;

// Formatação (cópia do estilo de `src/lib/mcp/leitura/comum.ts`, sem puxar MCP/zod para cá).
/** Nota 0–10 com uma casa e vírgula: 6 → "6,0". */
export const formatarNota = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Percentual inteiro: 37,5 → "38%". */
export const formatarPct = (n: number) => `${Math.round(n)}%`;
/**
 * Nota que precisa tirar, arredondada PARA CIMA em 1 casa: quem tira o número mostrado chega à média
 * (6,41 → "6,5"). O EPS evita que erro de ponto flutuante (7,800000000000001) suba uma casa.
 */
export const formatarNecessaria = (n: number) => formatarNota(Math.ceil(n * 10 - EPS) / 10);

/** Bimestres que contam no "quanto falta": encerrados e com média (encerrado sem nota nenhuma não conta). */
function encerradosQueContam(bimestres: BimestreAluno[]): number[] {
  return bimestres.filter((b) => b.encerrado && b.media != null).map((b) => b.media as number);
}

/**
 * Quanto falta para a média: (media × 4 − soma dos encerrados) ÷ (4 − encerrados).
 * - Bimestre não encerrado não entra, mesmo com notas (aparece no gráfico como "em andamento").
 * - Bimestre encerrado com `media: null` (sem nenhuma nota) também não entra: é tratado como se não
 *   tivesse sido encerrado, e o ano continua com 4 bimestres. Assim uma planilha vazia não vira nota 0.
 */
export function quantoFalta(bimestres: BimestreAluno[], media: number): ResultadoQuantoFalta {
  const notas = encerradosQueContam(bimestres);
  if (notas.length === 0) return { situacao: "sem_dados" };
  const soma = notas.reduce((s, n) => s + n, 0);
  const mediaAtual = soma / notas.length;
  if (notas.length >= BIMESTRES_NO_ANO) {
    return { situacao: mediaAtual + EPS >= media ? "atingiu" : "nao_atingiu", mediaAtual };
  }
  const porBimestre = (media * BIMESTRES_NO_ANO - soma) / (BIMESTRES_NO_ANO - notas.length);
  if (porBimestre <= EPS) return { situacao: "atingiu", mediaAtual };
  if (porBimestre > 10 + EPS) return { situacao: "impossivel", porBimestre, mediaAtual };
  return { situacao: "precisa", porBimestre, mediaAtual };
}

/**
 * Acerto por matéria, do pior para o melhor. Anuladas e questões sem matéria não contam;
 * não respondida (`correta === null`) conta como erro.
 */
export function acertoPorMateria(respostas: { materia: string | null; correta: boolean | null; anulada: boolean }[]): AcertoMateria[] {
  const grupos = new Map<string, { acertos: number; total: number }>();
  for (const r of respostas) {
    if (r.anulada || !r.materia) continue;
    const g = grupos.get(r.materia) ?? { acertos: 0, total: 0 };
    g.total++;
    if (r.correta === true) g.acertos++;
    grupos.set(r.materia, g);
  }
  return [...grupos].map(([materia, { acertos, total }]): AcertoMateria => ({
    materia,
    rotulo: (MATERIAS as Record<string, { rotulo: string }>)[materia]?.rotulo ?? materia,
    acertos,
    total,
    pct: (acertos / total) * 100,
    poucas: total < MINIMO_QUESTOES,
  })).sort((a, b) => a.pct - b.pct || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Situação do aluno num simulado. Em andamento ou vencida sem entrega nunca vira nota 0. */
export function situacaoNoSimulado(t: { status: string; prazo_em: string | null } | null, temConta: boolean, agora: Date): SituacaoSimulado {
  if (!temConta) return "sem_login";
  if (!t) return "nao_fez";
  if (t.status === "entregue") return "fez";
  if (t.status === "em_andamento" && t.prazo_em && new Date(t.prazo_em).getTime() > agora.getTime()) return "fazendo";
  return "nao_entregou";
}

/**
 * Junta as linhas da planilha da mesma pessoa nos vários bimestres (cada turma do grupo é um bimestre).
 * - Na turma do alvo, só o alvo.
 * - Nas outras: as linhas em `vinculados` (ligadas à mesma conta), se houver; senão, pelo nome normalizado.
 * - Nome repetido (na turma do alvo ou na outra) não junta pelo nome, para não misturar dois
 *   "Pedro Henrique": sem vínculo, aquele bimestre fica de fora e `parcial` = true.
 */
export function agruparAlunoEntreBimestres(
  linhas: { turmaId: string; bimestre: string; alunoId: string; nome: string }[],
  alvo: { alunoId: string; nome: string },
  vinculados: Set<string>,
): { alunoIds: string[]; parcial: boolean } {
  const nomeAlvo = normalizarBusca(alvo.nome);
  const turmaAlvo = linhas.find((l) => l.alunoId === alvo.alunoId)?.turmaId;
  const repetidoNaTurmaAlvo = linhas.filter((l) => l.turmaId === turmaAlvo && normalizarBusca(l.nome) === nomeAlvo).length > 1;
  const porTurma = new Map<string, typeof linhas>();
  for (const l of linhas) porTurma.set(l.turmaId, [...(porTurma.get(l.turmaId) ?? []), l]);

  const ids = new Set<string>([alvo.alunoId]);
  let parcial = false;
  for (const [turmaId, doBimestre] of porTurma) {
    if (turmaId === turmaAlvo) continue;
    const ligadas = doBimestre.filter((l) => vinculados.has(l.alunoId));
    if (ligadas.length) {
      for (const l of ligadas) ids.add(l.alunoId);
      continue;
    }
    const mesmoNome = doBimestre.filter((l) => normalizarBusca(l.nome) === nomeAlvo);
    if (mesmoNome.length === 1 && !repetidoNaTurmaAlvo) ids.add(mesmoNome[0].alunoId);
    else if (mesmoNome.length > 0) parcial = true;
  }
  return { alunoIds: linhas.filter((l) => ids.has(l.alunoId)).map((l) => l.alunoId), parcial };
}

/**
 * Ranking da turma, da maior para a menor média; empate em ordem alfabética; sem nota no fim.
 * A chave é a média dos bimestres encerrados (com nota); se a turma não tem nenhum bimestre
 * encerrado, é `vigente` (a média do aluno no bimestre em andamento).
 */
export function rankingTurma<T extends { nome: string; medias: (number | null)[]; encerrados: boolean[]; vigente: number | null }>(
  alunos: T[],
): (T & { mediaRanking: number | null })[] {
  const algumEncerrado = alunos.some((a) => a.encerrados.some(Boolean));
  return alunos.map((a) => {
    let mediaRanking: number | null = a.vigente;
    if (algumEncerrado) {
      const notas = a.medias.filter((m, i): m is number => a.encerrados[i] === true && m != null);
      mediaRanking = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null;
    }
    return { ...a, mediaRanking };
  }).sort((a, b) => {
    if (a.mediaRanking == null || b.mediaRanking == null) {
      if (a.mediaRanking != b.mediaRanking) return a.mediaRanking == null ? 1 : -1;
    } else if (a.mediaRanking !== b.mediaRanking) return b.mediaRanking - a.mediaRanking;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

const FAIXAS = ["0–2", "2–4", "4–6", "6–8", "8–10"];
/** Distribuição das médias em 5 faixas de 2 pontos ([0,2), [2,4) … [8,10]); null fica de fora. */
export function distribuicaoMedias(medias: (number | null)[]): FaixaDistribuicao[] {
  const qtd = FAIXAS.map(() => 0);
  for (const m of medias) {
    if (m == null || !Number.isFinite(m)) continue;
    qtd[Math.min(FAIXAS.length - 1, Math.max(0, Math.floor(m / 2)))]++;
  }
  return FAIXAS.map((faixa, i) => ({ faixa, quantidade: qtd[i] }));
}

export function resumoAulas(aulas: { titulo: string; pct: number; concluida: boolean }[]): ResumoAulas {
  const concluidas = aulas.filter((a) => a.concluida).length;
  const comecadas = aulas.filter((a) => !a.concluida && a.pct > 0).length;
  return { total: aulas.length, concluidas, comecadas, naoComecadas: aulas.length - concluidas - comecadas, aulas };
}

/** "ao 'A'", "ao 'A' e ao 'B'", "ao 'A', ao 'B', ao 'C' e a mais 2". */
function listaFaltas(titulos: string[]): string {
  const itens = titulos.slice(0, 3).map((t) => `ao '${t}'`);
  const resto = titulos.length - itens.length;
  if (resto > 0) itens.push(`a mais ${resto}`);
  return itens.length === 1 ? itens[0] : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

function juntarComE(itens: string[]): string {
  return itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

function textoQuantoFalta(bimestres: BimestreAluno[], q: ResultadoQuantoFalta, media: number): string {
  const alvo = formatarNota(media);
  const atual = q.mediaAtual != null ? formatarNota(q.mediaAtual) : "";
  const restantes = BIMESTRES_NO_ANO - encerradosQueContam(bimestres).length;
  const onde = restantes === 1 ? `no ${BIMESTRES_NO_ANO}º` : `em cada um dos ${restantes} bimestres restantes`;
  switch (q.situacao) {
    case "sem_dados": {
      const vigente = bimestres.find((b) => b.vigente && b.media != null);
      return vigente ? `nenhum bimestre encerrado ainda (${formatarNota(vigente.media as number)} no bimestre em andamento).` : "nenhum bimestre encerrado ainda.";
    }
    case "atingiu":
      return `média ${atual} nos bimestres encerrados; já atingiu a média ${alvo}.`;
    case "nao_atingiu":
      return `média ${atual} nos ${BIMESTRES_NO_ANO} bimestres; ficou abaixo da média ${alvo}.`;
    case "impossivel":
      return `média ${atual} nos bimestres encerrados; não dá mais para chegar a ${alvo} (precisaria de ${formatarNecessaria(q.porBimestre ?? 0)} ${onde}).`;
    case "precisa":
      return `média ${atual} nos bimestres encerrados; precisa de ${formatarNecessaria(q.porBimestre ?? 0)} ${onde} para chegar a ${alvo}.`;
  }
}

function textoSimuladosAluno(simulados: LinhaSimuladoAluno[]): string {
  if (simulados.length === 0) return "Nenhum simulado para a turma ainda.";
  if (simulados.every((s) => s.situacao === "sem_login")) return "Sem conta de login: simulados e aulas não aparecem.";
  const fez = simulados.filter((s) => s.situacao === "fez").length;
  const faltas = simulados.filter((s) => s.situacao === "nao_fez" || s.situacao === "nao_entregou").map((s) => s.titulo);
  const fazendo = simulados.filter((s) => s.situacao === "fazendo").length;
  const extra = [faltas.length ? `faltou ${listaFaltas(faltas)}` : "", fazendo ? `${fazendo} em andamento` : ""].filter(Boolean).join("; ");
  return `Fez ${fez} de ${simulados.length} simulados${extra ? ` (${extra})` : ""}.`;
}

/**
 * Frase-resumo do aluno (Hermes e cabeçalho da página). Ex.: "João Silva (3º A): média 5,4 nos
 * bimestres encerrados; precisa de 7,8 no 4º para chegar a 6,0. Fez 3 de 5 simulados (faltou ao
 * 'Ufms 24' e ao 'Revisão 2'). Mais fraco em Física (38% de acerto). Assistiu 7 de 12 aulas."
 * Partes sem dado são omitidas (nunca "0 de 0" nem "NaN").
 */
export function fraseAluno(r: Omit<RelatorioAluno, "frase">, media: number): string {
  const partes = [`${r.nome} (${r.turmaNome}): ${textoQuantoFalta(r.bimestres, r.quantoFalta, media)}`, textoSimuladosAluno(r.simulados)];
  const fraca = r.materias.find((m) => !m.poucas);
  if (fraca) partes.push(`Mais fraco em ${fraca.rotulo} (${formatarPct(fraca.pct)} de acerto).`);
  if (r.aulas && r.aulas.total > 0) partes.push(`Assistiu ${r.aulas.concluidas} de ${r.aulas.total} aulas.`);
  return partes.join(" ");
}

function mediaDe(valores: number[]): number | null {
  return valores.length ? valores.reduce((s, n) => s + n, 0) / valores.length : null;
}

/**
 * Frase-resumo da turma. Ex.: "3º A (2026): 32 alunos, média 6,4 nos bimestres encerrados; 8 abaixo
 * de 6,0. Último simulado ('Ufms 24'): 25 de 32 fizeram. Matérias mais fracas: Física (38%) e Química (45%)."
 */
export function fraseTurma(r: Omit<RelatorioTurma, "frase">, media: number): string {
  const cab = `${r.turmaNome} (${r.anoLetivo}):`;
  if (r.alunos.length === 0) return `${cab} nenhum aluno na planilha ainda. ${r.simulados.length ? "" : "Nenhum simulado para esta turma ainda."}`.trim();

  const encerrada = mediaDe(r.mediaPorBimestre.filter((b) => b.encerrado && b.media != null).map((b) => b.media as number));
  const vigente = r.mediaPorBimestre.find((b) => b.vigente && b.media != null)?.media ?? null;
  const notas = encerrada != null ? `média ${formatarNota(encerrada)} nos bimestres encerrados`
    : vigente != null ? `média ${formatarNota(vigente)} no bimestre em andamento`
    : "sem notas ainda";
  const alunos = `${r.alunos.length} ${r.alunos.length === 1 ? "aluno" : "alunos"}`;
  const abaixo = encerrada != null || vigente != null ? `; ${r.abaixoDaMedia.length} abaixo de ${formatarNota(media)}` : "";
  const partes = [`${cab} ${alunos}, ${notas}${abaixo}.`];

  const ultimo = [...r.simulados].sort((a, b) => (a.abreEm ?? "").localeCompare(b.abreEm ?? "")).at(-1);
  partes.push(ultimo && ultimo.total > 0 ? `Último simulado ('${ultimo.titulo}'): ${ultimo.fizeram} de ${ultimo.total} fizeram.` : "Nenhum simulado para esta turma ainda.");

  if (r.materiasFracas.length) {
    partes.push(`${r.materiasFracas.length === 1 ? "Matéria mais fraca" : "Matérias mais fracas"}: ${juntarComE(r.materiasFracas.map((m) => `${m.rotulo} (${formatarPct(m.pct)})`))}.`);
  }
  return partes.join(" ");
}
