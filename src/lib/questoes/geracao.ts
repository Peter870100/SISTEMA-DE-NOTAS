// src/lib/questoes/geracao.ts
// Funções puras do gerador de questões por IA (sem imports de servidor).
import { z } from "zod";
import type { Database, Dificuldade, Escopo, Letra, ProfessorRole } from "@/lib/types";
import { LETRAS, areaDaMateria, ehMateria, type Materia } from "./materias";

const LETRA = z.enum(["A", "B", "C", "D", "E"]);

export const GeracaoSchema = z.object({
  questoes: z.array(z.object({
    enunciado: z.string(),
    comando: z.string(),
    alternativas: z.array(z.object({ letra: LETRA, texto: z.string() })),
    resposta: LETRA,
    resolucao: z.string(),
    assunto_id: z.string().nullable(),
  })),
});
export type RespostaGeracao = z.infer<typeof GeracaoSchema>;

export const LIMIAR_PARECENCA = 0.55;

export type Referencia = { rotulo: string; texto: string };

export type ContextoGeradas = {
  escopo: Escopo;
  escola_id: string | null;
  materia: Materia;
  assuntoPedido: string | null;
  assuntosValidos: Set<string>;
  referencias: Referencia[];
  geracao_id: string;
  criado_por: string;
  ano: number;
};

function trigramas(texto: string): Set<string> {
  const palavras = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 2 < palavras.length; i++) out.add(palavras.slice(i, i + 3).join(" "));
  return out;
}

// Jaccard de trigramas de palavras; menos de 3 palavras em qualquer lado → 0.
export function parecenca(a: string, b: string): number {
  const ta = trigramas(a);
  const tb = trigramas(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let comuns = 0;
  for (const t of ta) if (tb.has(t)) comuns++;
  return comuns / (ta.size + tb.size - comuns);
}

type Insert = Database["public"]["Tables"]["questoes"]["Insert"];

export function respostaParaGeradas(r: RespostaGeracao, ctx: ContextoGeradas): { linhas: Insert[]; descartadas: number } {
  const linhas: Insert[] = [];
  const textosAnteriores: string[] = [];
  let descartadas = 0;

  for (const q of r.questoes) {
    const letras = q.alternativas.map((a) => a.letra).sort().join("");
    const valida =
      q.enunciado.trim() !== "" &&
      q.alternativas.length === LETRAS.length &&
      letras === LETRAS.join("") &&
      q.alternativas.every((a) => a.texto.trim() !== "") &&
      new Set(q.alternativas.map((a) => a.texto.trim().toLowerCase())).size === LETRAS.length;
    if (!valida) {
      descartadas++;
      continue;
    }

    const texto = `${q.enunciado} ${q.comando}`;
    let motivo: string | null = null;
    const ref = ctx.referencias.find((x) => parecenca(texto, x.texto) >= LIMIAR_PARECENCA);
    if (ref) motivo = `Parecida demais com ${ref.rotulo}.`;
    else if (textosAnteriores.some((t) => parecenca(texto, t) >= LIMIAR_PARECENCA)) motivo = "Parecida demais com outra questão gerada.";
    textosAnteriores.push(texto);

    const assunto_id = q.assunto_id && ctx.assuntosValidos.has(q.assunto_id) ? q.assunto_id : ctx.assuntoPedido;
    const porLetra = new Map(q.alternativas.map((a) => [a.letra, a.texto.trim()]));
    linhas.push({
      escopo: ctx.escopo,
      escola_id: ctx.escola_id,
      banca: "Gerada por IA",
      ano: ctx.ano,
      caderno: "",
      numero: null,
      area: areaDaMateria(ctx.materia),
      materia: ctx.materia,
      assunto_id,
      enunciado: q.enunciado.trim(),
      comando: q.comando.trim(),
      alternativas: LETRAS.map((letra) => ({ letra, texto: porLetra.get(letra) ?? "" })),
      resposta: q.resposta,
      anulada: false,
      status: "revisao",
      precisa_revisao: motivo !== null,
      motivo_revisao: motivo,
      origem: "ia",
      resolucao: q.resolucao.trim(),
      geracao_id: ctx.geracao_id,
      criado_por: ctx.criado_por,
    });
  }
  return { linhas, descartadas };
}

// ---------- Pedido ----------

const MSG_QUANTIDADE = "Escolha de 1 a 10 questões.";
const idOuNulo = (v: unknown) => (v === "" || v === undefined ? null : v);

export const PedidoGeracaoSchema = z.object({
  materia: z.string({ error: "Escolha uma matéria." }).refine(ehMateria, "Escolha uma matéria."),
  assunto_id: z.preprocess(idOuNulo, z.string().nullable()),
  quantidade: z.number({ error: MSG_QUANTIDADE }).int(MSG_QUANTIDADE).min(1, MSG_QUANTIDADE).max(10, MSG_QUANTIDADE),
  dificuldade: z.enum(["facil", "media", "dificil"], { error: "Escolha a dificuldade." }),
  orientacao: z.string().trim().max(500, "A orientação pode ter até 500 caracteres."),
  escopo: z.enum(["geral", "escola"], { error: "Escolha onde guardar as questões." }),
  base_id: z.preprocess(idOuNulo, z.string().nullable()),
});
export type PedidoGeracao = {
  materia: string;
  assunto_id: string | null;
  quantidade: number;
  dificuldade: Dificuldade;
  orientacao: string;
  escopo: Escopo;
  base_id: string | null;
};

export function validarPedido(bruto: unknown, ator: { role: ProfessorRole }, assuntosDaMateria: Set<string>): PedidoGeracao {
  const r = PedidoGeracaoSchema.safeParse(bruto);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Pedido inválido.");
  const pedido = r.data as PedidoGeracao;
  if (pedido.assunto_id !== null && !assuntosDaMateria.has(pedido.assunto_id)) {
    throw new Error("Esse assunto não é da matéria escolhida.");
  }
  return { ...pedido, escopo: ator.role === "dono" ? pedido.escopo : "escola" };
}

// ---------- Limite diário ----------

export const LIMITE_DIARIO = 60;
const FUSO = "America/Campo_Grande";

// 00:00 do dia de `agora` no fuso de Campo Grande, como instante UTC.
export function inicioDoDia(agora: Date): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(agora);
  const n = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  const localComoUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  const desvio = localComoUtc - Math.floor(agora.getTime() / 1000) * 1000;
  return new Date(Date.UTC(n("year"), n("month") - 1, n("day")) - desvio);
}

// Ano de `agora` no fuso de Campo Grande.
export function anoLocal(agora: Date): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric" }).format(agora));
}

// null = sem limite (dono).
export function restanteHoje(pedidasHoje: number, role: ProfessorRole): number | null {
  if (role === "dono") return null;
  return Math.max(0, LIMITE_DIARIO - pedidasHoje);
}

// ---------- Exemplos ----------

export type CandidataExemplo = {
  id: string;
  rotulo: string;
  assunto_id: string | null;
  enunciado: string;
  comando: string;
  alternativas: { letra: Letra; texto: string }[];
  resposta: Letra | null;
  temImagem: boolean;
};

const MAX_EXEMPLOS = 6;
const MIN_DO_ASSUNTO = 3;
const MAX_ENUNCIADO = 2500;

// Tira itens ao acaso, um a um (com sortear = 0 mantém a ordem).
function embaralhar<T>(lista: T[], sortear: (n: number) => number): T[] {
  const resto = [...lista];
  const out: T[] = [];
  while (resto.length > 0) out.push(resto.splice(sortear(resto.length), 1)[0]);
  return out;
}

export function escolherExemplos(
  candidatas: CandidataExemplo[],
  assuntoId: string | null,
  sortear: (n: number) => number = (n) => Math.floor(Math.random() * n),
): CandidataExemplo[] {
  const doAssunto = candidatas.filter((c) => assuntoId === null || c.assunto_id === assuntoId);
  const outros = candidatas.filter((c) => assuntoId !== null && c.assunto_id !== assuntoId);
  const grupo = (lista: CandidataExemplo[], imagem: boolean) => embaralhar(lista.filter((c) => c.temImagem === imagem), sortear);

  const ordem = [grupo(doAssunto, false), grupo(doAssunto, true)];
  if (doAssunto.length < MIN_DO_ASSUNTO) ordem.push(grupo(outros, false), grupo(outros, true));

  return ordem.flat().slice(0, MAX_EXEMPLOS).map((c) => ({ ...c, enunciado: c.enunciado.slice(0, MAX_ENUNCIADO) }));
}

// ---------- Instruções para a IA ----------

const ROTULO_DIFICULDADE: Record<Dificuldade, string> = { facil: "fácil", media: "média", dificil: "difícil" };

function blocoQuestao(titulo: string, c: CandidataExemplo): string {
  const alternativas = c.alternativas.map((a) => `${a.letra}) ${a.texto}`).join("\n");
  return [
    `### ${titulo}`,
    `Enunciado: ${c.enunciado.slice(0, MAX_ENUNCIADO)}`,
    `Comando: ${c.comando}`,
    alternativas,
    `Resposta correta: ${c.resposta ?? "não informada"}`,
  ].join("\n");
}

export function instrucoesGeracao(p: {
  pedido: PedidoGeracao;
  materiaRotulo: string;
  assuntoNome: string | null;
  assuntos: { id: string; nome: string }[];
  exemplos: CandidataExemplo[];
  base: CandidataExemplo | null;
  recentes: string[];
}): string {
  const { pedido } = p;
  const partes: string[] = [
    "Você é um professor elaborador de itens de múltipla escolha no padrão do ENEM e dos vestibulares brasileiros.",
    `Crie ${pedido.quantidade} ${pedido.quantidade === 1 ? "questão" : "questões"} de ${p.materiaRotulo}` +
      (p.assuntoNome ? `, assunto "${p.assuntoNome}"` : "") +
      `, com dificuldade ${ROTULO_DIFICULDADE[pedido.dificuldade]}.`,
    [
      "Regras:",
      "- As questões devem ser inéditas: não copie nem parafraseie os exemplos; use outro contexto, outros números e outros textos.",
      "- Texto-base autoral ou de domínio público; nunca invente citações atribuídas a autores reais, obras ou dados de fontes reais.",
      "- Exatamente 5 alternativas (A a E), plausíveis, com uma única correta. Não use \"todas as anteriores\" nem \"nenhuma das anteriores\".",
      "- Distribua a letra da resposta correta entre as questões, sem favorecer uma letra.",
      "- Não dependa de figura, gráfico ou tabela em imagem; se precisar de dados, descreva-os em texto.",
      "- Escreva fórmulas e símbolos em Unicode (por exemplo x², H₂O, √, ≤), sem LaTeX.",
      "- Escreva em português do Brasil.",
      "- Em \"resolucao\", explique de forma breve por que a alternativa correta está certa.",
      "- Classifique cada questão com um assunto_id da lista abaixo, ou null se nenhum servir.",
    ].join("\n"),
  ];

  if (pedido.orientacao) partes.push(`Orientação do professor: ${pedido.orientacao}`);
  if (p.assuntos.length > 0) {
    partes.push(["Assuntos da matéria (id | nome):", ...p.assuntos.map((a) => `${a.id} | ${a.nome}`)].join("\n"));
  }
  if (p.base) {
    partes.push("Use esta questão como MODELO PRINCIPAL: siga o estilo e a estrutura, sem copiá-la.\n" + blocoQuestao("MODELO PRINCIPAL", p.base));
  }
  if (p.exemplos.length > 0) {
    partes.push(["Exemplos do banco (só referência de estilo; não reproduza):", ...p.exemplos.map((e, i) => blocoQuestao(`Exemplo ${i + 1} (${e.rotulo})`, e))].join("\n\n"));
  }
  if (p.recentes.length > 0) {
    partes.push(["Já geradas (não repita):", ...p.recentes.map((r) => `- ${r}`)].join("\n"));
  }
  return partes.join("\n\n");
}

/** Rótulo curto de uma questão (banca, ano e número), sem as partes vazias. */
export function rotuloQuestao(q: { banca: string; ano: number | null; numero: number | null }): string {
  return [q.banca, q.ano ? String(q.ano) : "", q.numero !== null ? `nº ${q.numero}` : ""].filter(Boolean).join(" ");
}

/** Gerações "gerando" há mais que isso são tidas como mortas (função encerrada) e não seguram a cota. */
export const MAX_GERANDO_MS = 10 * 60 * 1000;

/** Se uma linha de geracoes_ia entra na cota do dia: não é do dono, não deu erro e não está travada. */
export function contaNaCota(
  g: { status: string; created_at: string; professor_id: string | null },
  donoIds: Set<string>,
  agora: Date,
): boolean {
  if (g.professor_id && donoIds.has(g.professor_id)) return false;
  if (g.status === "concluida") return true;
  if (g.status !== "gerando") return false;
  return agora.getTime() - new Date(g.created_at).getTime() <= MAX_GERANDO_MS;
}

/** Assunto inicial vindo da questão modelo: só vale se for um assunto aprovado da matéria. */
export function assuntoDaBase(assuntoId: string | null, aprovados: Set<string>): string | null {
  return assuntoId && aprovados.has(assuntoId) ? assuntoId : null;
}
