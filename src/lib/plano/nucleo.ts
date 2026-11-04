// Núcleo do treino do plano de estudo (sem acesso a banco: tudo entra por `deps`).
import { chaveValida } from "./extras";
import { ordenarPorFacilidade, selecionarQuestoes, type Candidata } from "./selecao";
import { textoQuestoesDisponiveis, tituloTreino } from "./textos";
import type { ConteudoPlano, EtapaPlano, RegrasAprendizagem } from "./tipos";

export type DepsTreinoPlano = {
  conteudo(chave: string): Promise<{ plano: ConteudoPlano; habilidadeIds: string[] } | null>;
  candidatas(chave: string): Promise<Candidata[]>;
  facilidade(ids: string[]): Promise<Record<string, number | null>>;
  /** Só usado depois de uma colisão do insert, para achar o treino criado pela outra chamada. */
  treinoAberto(chave: string, etapa: EtapaPlano): Promise<string | null>;
  contarTreinos(chave: string, etapa: EtapaPlano): Promise<number>;
  inserirTreino(t: { titulo: string; conteudo: string; etapa: EtapaPlano; rodada: number; questaoIds: string[] }): Promise<{ simuladoId: string } | "colisao">;
  regras: RegrasAprendizagem;
  agora: Date;
  sortear?: () => number;
};

export type ResultadoTreinoPlano = { ok: true; simuladoId: string; aviso: string | null } | { ok: false; erro: string };

const ETAPAS: EtapaPlano[] = ["diagnostico", "pratica", "revisao"];

function etapaPermitida(plano: ConteudoPlano, etapa: EtapaPlano): boolean {
  if (etapa === "diagnostico") return plano.situacao === "mais_respostas";
  if (etapa === "pratica") return plano.situacao === "revisar" || plano.situacao === "concluido";
  return plano.etapas.some((e) => e.tipo === "revisao" && e.estado === "disponivel");
}

export async function criarTreinoDoPlanoCom(deps: DepsTreinoPlano, entrada: { conteudo: string; etapa: EtapaPlano }): Promise<ResultadoTreinoPlano> {
  const { conteudo: chave, etapa } = entrada;
  if (!chaveValida(chave)) return { ok: false, erro: "Conteúdo inválido." };
  if (!ETAPAS.includes(etapa)) return { ok: false, erro: "Etapa inválida." };

  const c = await deps.conteudo(chave);
  if (!c) return { ok: false, erro: "Este conteúdo não está no seu plano." };
  const { plano, habilidadeIds } = c;
  if (!etapaPermitida(plano, etapa)) return { ok: false, erro: "Esta etapa ainda não está disponível." };

  // Só o treino aberto que o estado do plano enxerga: treinos antigos ficam escondidos de propósito.
  const aberto = plano.etapas.find((e) => e.tipo === etapa)?.treinoAberto ?? null;
  if (aberto) return { ok: true, simuladoId: aberto, aviso: null };

  const r = deps.regras;
  const q = etapa === "diagnostico" ? r.questoesDiagnostico : etapa === "pratica" ? r.questoesPratica : r.questoesRevisao;
  const sel = selecionarQuestoes({
    candidatas: await deps.candidatas(chave), quantidade: q, focoTopicoId: plano.foco?.topicoId ?? null,
    habilidadeIds, agora: deps.agora, diasSemRepetir: r.diasSemRepetir, sortear: deps.sortear,
  });
  if (sel.ids.length === 0) return { ok: false, erro: textoQuestoesDisponiveis(plano.nome, 0, q)! };
  const ids = ordenarPorFacilidade(sel.ids, await deps.facilidade(sel.ids));

  const rodada = (await deps.contarTreinos(chave, etapa)) + 1;
  const res = await deps.inserirTreino({ titulo: tituloTreino(etapa, plano.nome), conteudo: chave, etapa, rodada, questaoIds: ids });
  if (res === "colisao") {
    const outro = await deps.treinoAberto(chave, etapa);
    return outro ? { ok: true, simuladoId: outro, aviso: null } : { ok: false, erro: "Tente de novo." };
  }
  return { ok: true, simuladoId: res.simuladoId, aviso: sel.faltaram > 0 ? textoQuestoesDisponiveis(plano.nome, ids.length, q) : null };
}
