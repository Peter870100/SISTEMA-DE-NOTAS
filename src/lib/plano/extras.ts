// Materiais, chave do conteúdo e tipos de "extras" do plano de estudo (funções puras).
import { ehMateria } from "@/lib/questoes/materias";
import type { MaterialRevisao } from "@/lib/types";

export type MaterialTela = { id: string; titulo: string; tipo: "aula" | "link"; href: string | null; minutos: number };
export type ExtrasConteudo = {
  materiais: MaterialTela[]; resolucoes: number; disponiveis: number | null;
  prerequisitos: { nome: string; assunto: string }[]; habilidades: { codigo: string | null; descricao: string }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function chaveValida(chave: string): { assuntoId: string } | { materia: string } | null {
  if (UUID.test(chave)) return { assuntoId: chave };
  if (chave.startsWith("materia:")) {
    const m = chave.slice("materia:".length);
    if (ehMateria(m)) return { materia: m };
  }
  return null;
}

/** Minutos de uma aula: duração arredondada para cima de 5 em 5 (mínimo 5); sem duração, o padrão. */
export function minutosDaAula(seg: number | undefined, padrao: number): number {
  if (seg === undefined || seg === null || !(seg > 0)) return padrao;
  return Math.max(5, Math.ceil(seg / 60 / 5) * 5);
}

export function materiaisDoConteudo(e: {
  linhas: MaterialRevisao[]; topicoFocoId: string | null; assuntoId: string | null; escolaId: string;
  aulas: Record<string, { titulo: string; acessivel: boolean }>; aulasDoTema: { id: string; titulo: string }[];
  duracoesSeg: Record<string, number>; visao: "aluno" | "escola"; minutosMaterial: number;
}): MaterialTela[] {
  const daEscola = e.linhas.filter((l) => l.escola_id === null || l.escola_id === e.escolaId);
  const doTopico = e.topicoFocoId ? daEscola.filter((l) => l.topico_id === e.topicoFocoId) : [];
  const doAssunto = e.assuntoId ? daEscola.filter((l) => l.assunto_id === e.assuntoId) : [];
  const saida: MaterialTela[] = [];
  const vistas = new Set<string>();

  const aula = (id: string, tituloPadrao: string) => {
    if (vistas.has(id)) return;
    vistas.add(id);
    const info = e.aulas[id];
    if (e.visao === "aluno" && !info?.acessivel) return;
    saida.push({ id, titulo: info?.titulo ?? tituloPadrao, tipo: "aula", href: e.visao === "aluno" ? `/aluno/aulas/${id}` : null, minutos: minutosDaAula(e.duracoesSeg[id], e.minutosMaterial) });
  };

  for (const l of [...doTopico, ...doAssunto]) {
    if (l.aula_id) aula(l.aula_id, l.titulo ?? "Aula");
    else if (l.url) saida.push({ id: l.id, titulo: l.titulo ?? l.url, tipo: "link", href: l.url, minutos: e.minutosMaterial });
  }
  for (const a of e.aulasDoTema) aula(a.id, a.titulo);
  return saida;
}
