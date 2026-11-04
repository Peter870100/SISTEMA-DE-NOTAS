// Escolha das questões do banco para diagnóstico, prática e revisão (função pura).

export type Candidata = { id: string; topicoId: string | null; habilidadeIds: string[]; ultimaVez: string | null };
export type PedidoSelecao = {
  candidatas: Candidata[];
  quantidade: number;
  focoTopicoId: string | null;
  habilidadeIds: string[];
  agora: Date;
  diasSemRepetir: number;
  sortear?: () => number;
};

const DIA_MS = 24 * 60 * 60 * 1000;

function recente(c: Candidata, agora: Date, diasSemRepetir: number): boolean {
  if (!c.ultimaVez) return false;
  return agora.getTime() - new Date(c.ultimaVez).getTime() < diasSemRepetir * DIA_MS;
}

export function contarDisponiveis(candidatas: Candidata[], agora: Date, diasSemRepetir: number): number {
  return candidatas.filter((c) => !recente(c, agora, diasSemRepetir)).length;
}

export function selecionarQuestoes(p: PedidoSelecao): { ids: string[]; faltaram: number; repetidas: number } {
  const sortear = p.sortear ?? Math.random;
  const alvo = new Set(p.habilidadeIds);
  const disponiveis = p.candidatas.filter((c) => !recente(c, p.agora, p.diasSemRepetir));

  const relevancia = (c: Candidata): number => {
    const foco = p.focoTopicoId !== null && c.topicoId === p.focoTopicoId;
    const hab = c.habilidadeIds.some((h) => alvo.has(h));
    return foco && hab ? 0 : foco ? 1 : hab ? 2 : 3;
  };

  // Grupo 0 (nunca vistas): embaralha e depois ordena por relevância (estável).
  const novas = disponiveis.filter((c) => !c.ultimaVez);
  for (let i = novas.length - 1; i >= 1; i--) {
    const j = Math.floor(sortear() * (i + 1));
    [novas[i], novas[j]] = [novas[j], novas[i]];
  }
  novas.sort((a, b) => relevancia(a) - relevancia(b));

  const antigas = disponiveis
    .filter((c) => c.ultimaVez)
    .sort((a, b) => relevancia(a) - relevancia(b) || new Date(a.ultimaVez!).getTime() - new Date(b.ultimaVez!).getTime());

  const escolhidas = [...novas, ...antigas].slice(0, Math.max(0, p.quantidade));
  return {
    ids: escolhidas.map((c) => c.id),
    faltaram: p.quantidade - escolhidas.length,
    repetidas: escolhidas.filter((c) => c.ultimaVez).length,
  };
}

export function ordenarPorFacilidade(ids: string[], facilidade: Record<string, number | null>): string[] {
  const f = (id: string) => facilidade[id] ?? 50;
  return ids
    .map((id, i) => ({ id, i }))
    .sort((a, b) => f(b.id) - f(a.id) || a.i - b.i)
    .map((x) => x.id);
}

export function facilidadeDe(
  contagem: { acertos: number; total: number } | null,
  dificuldadeGeracao: "facil" | "media" | "dificil" | null,
): number | null {
  if (contagem && contagem.total >= 5) return Math.round((contagem.acertos / contagem.total) * 100);
  if (dificuldadeGeracao === "facil") return 80;
  if (dificuldadeGeracao === "media") return 50;
  if (dificuldadeGeracao === "dificil") return 20;
  return null;
}
