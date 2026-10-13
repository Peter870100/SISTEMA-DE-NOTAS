import { formatarDuracao, tempoDeProvaSeg } from "@/lib/simulados/regras";
import type { Tentativa } from "@/lib/types";
import { formatarPresenca, semMedicaoDePresenca } from "./presenca";

export function normalizarBusca(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ª|º/g, (c) => (c === "ª" ? "a" : "o")).toLowerCase().replace(/\s+/g, " ").trim();
}

type TentResumo = Pick<Tentativa, "status" | "porcentagem" | "acertos" | "total" | "iniciada_em" | "entregue_em" | "prazo_em" | "tempo_usado_seg" | "saidas" | "tempo_fora_seg"> & { eventos_saida?: Tentativa["eventos_saida"] };
export type LinhaAluno = { nome: string; status: "entregue" | "em_andamento" | "nao_comecou"; porcentagem: number | null; acertos: number | null; total: number | null; tempoSeg: number | null; saidas: number | null; tempoForaSeg: number | null };

export function situacaoTurmaNoSimulado(alunos: { contaId: string; nome: string }[], tentativas: Map<string, TentResumo>, tipo: "professor" | "treino"): LinhaAluno[] {
  return alunos.map(({ contaId, nome }): LinhaAluno => {
    const t = tentativas.get(contaId);
    if (!t) return { nome, status: "nao_comecou", porcentagem: null, acertos: null, total: null, tempoSeg: null, saidas: null, tempoForaSeg: null };
    const entregue = t.status === "entregue";
    return { nome, status: entregue ? "entregue" : "em_andamento",
      porcentagem: entregue && t.porcentagem != null ? Number(t.porcentagem) : null, acertos: entregue ? t.acertos : null, total: entregue ? t.total : null,
      tempoSeg: entregue ? tempoDeProvaSeg(tipo, t) : null, saidas: semMedicaoDePresenca(t) ? null : t.saidas ?? null, tempoForaSeg: semMedicaoDePresenca(t) ? null : t.tempo_fora_seg ?? null };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export function textoResultadoSimulado(titulo: string, linhas: LinhaAluno[], maisErradas: { rotulo: string; pct: number; tempoMedioSeg: number | null }[]): string {
  if (linhas.length === 0) return `${titulo}: Nenhum aluno nas turmas deste simulado.`;
  const ent = linhas.filter((l) => l.status === "entregue");
  const notas = ent.map((l) => l.porcentagem).filter((p): p is number => p != null);
  const media = notas.length ? ` · média ${pct(notas.reduce((a, b) => a + b, 0) / notas.length)}` : "";
  const cab = `${titulo}: ${plural(ent.length, "entregou", "entregaram")} · ${linhas.filter((l) => l.status === "em_andamento").length} em andamento · ${plural(linhas.filter((l) => l.status === "nao_comecou").length, "não começou", "não começaram")}${media}`;
  const linhasTxt = linhas.map((l) => {
    if (l.status === "nao_comecou") return `- ${l.nome} — não começou`;
    if (l.status === "em_andamento") return `- ${l.nome} — em andamento · saídas: ${formatarPresenca(l.saidas, l.tempoForaSeg)}`;
    return `- ${l.nome} — ${pct(l.porcentagem ?? 0)} (${l.acertos ?? 0}/${l.total ?? 0}) · ${l.tempoSeg != null ? formatarDuracao(l.tempoSeg) : "—"} · ${formatarPresenca(l.saidas, l.tempoForaSeg)}`;
  });
  const erradas = maisErradas.slice(0, 5).map((q) => `- ${q.rotulo}: ${pct(q.pct)} de acerto${q.tempoMedioSeg != null ? ` · ${formatarDuracao(q.tempoMedioSeg)} em média` : ""}`);
  return [cab, ...linhasTxt, ...(erradas.length ? ["Questões mais erradas:", ...erradas] : [])].join("\n");
}

export function textoProgressoAula(maiorPosicaoSeg: number, duracaoSeg: number | null, tempoAssistidoSeg: number, concluida: boolean, saidas: number, foraSeg: number): string {
  const extras = [tempoAssistidoSeg > 0 ? `${formatarDuracao(tempoAssistidoSeg)} assistidos` : null, saidas > 0 ? formatarPresenca(saidas, foraSeg) : null].filter(Boolean);
  if (concluida) return ["concluída", ...extras].join(" · ");
  if (maiorPosicaoSeg <= 0 && tempoAssistidoSeg <= 0) return "não assistiu";
  const base = duracaoSeg ? `assistiu até ${formatarDuracao(maiorPosicaoSeg)} de ${formatarDuracao(duracaoSeg)} (${Math.min(100, Math.round((100 * maiorPosicaoSeg) / duracaoSeg))}%)` : `assistiu até ${formatarDuracao(maiorPosicaoSeg)}`;
  return [base, ...extras].join(" · ");
}
