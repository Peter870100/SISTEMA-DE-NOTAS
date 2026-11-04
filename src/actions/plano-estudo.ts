"use server";

import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual } from "@/lib/auth";
import { candidatasDoConteudo, carregarPlano, facilidadeDasQuestoes, vistasDaConta, type DadosPlano } from "@/lib/plano/dados";
import { chaveValida } from "@/lib/plano/extras";
import { criarTreinoDoPlanoCom, type DepsTreinoPlano, type ResultadoTreinoPlano } from "@/lib/plano/nucleo";
import { tempoSemanaValido } from "@/lib/plano/regras";
import type { EtapaPlano } from "@/lib/plano/tipos";
import { iniciarTentativa } from "@/actions/simulados-aluno";

type Simples = { ok: true } | { ok: false; erro: string };

export async function criarTreinoDoPlano(entrada: { conteudo: string; etapa: EtapaPlano }): Promise<ResultadoTreinoPlano> {
  try {
    const aluno = await getAlunoAtual();
    if (!aluno) return { ok: false, erro: "Faça login novamente." };
    const agora = new Date();
    let dados: DadosPlano | null = null;
    const ler = async (chave: string) => (dados ??= await carregarPlano({ id: aluno.id, escolaId: aluno.escola_id }, "aluno", agora, chave));
    let vistas: Record<string, string> | null = null;

    const deps: DepsTreinoPlano = {
      conteudo: async (chave) => {
        const d = await ler(chave);
        const plano = [...d.plano.semana, ...d.plano.depois, ...d.plano.concluidos].find((c) => c.chave === chave);
        return plano ? { plano, habilidadeIds: d.habilidadesAlvo[chave] ?? [] } : null;
      },
      candidatas: async (chave) => candidatasDoConteudo(aluno, chave, (vistas ??= await vistasDaConta(aluno.id))),
      facilidade: facilidadeDasQuestoes,
      treinoAberto: async (chave, etapa) => {
        const { data: sims, error } = await supabase.from("simulados").select("id")
          .eq("conta_id", aluno.id).eq("plano_conteudo", chave).eq("plano_etapa", etapa).order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        const ids = (sims ?? []).map((s) => s.id);
        if (ids.length === 0) return null;
        const { data: tents, error: e2 } = await supabase.from("tentativas").select("simulado_id, status").eq("conta_id", aluno.id).in("simulado_id", ids);
        if (e2) throw new Error(e2.message);
        const entregues = new Set((tents ?? []).filter((t) => t.status === "entregue").map((t) => t.simulado_id));
        return ids.find((id) => !entregues.has(id)) ?? null;
      },
      contarTreinos: async (chave, etapa) => {
        const { count, error } = await supabase.from("simulados").select("id", { count: "exact", head: true })
          .eq("conta_id", aluno.id).eq("plano_conteudo", chave).eq("plano_etapa", etapa);
        if (error) throw new Error(error.message);
        return count ?? 0;
      },
      inserirTreino: async (t) => {
        const { data: s, error } = await supabase.from("simulados").insert({
          escola_id: aluno.escola_id, tipo: "treino", conta_id: aluno.id, titulo: t.titulo, duracao_min: null,
          status: "publicado", correcao: "na_hora", embaralhar: false,
          plano_conteudo: t.conteudo, plano_etapa: t.etapa, plano_rodada: t.rodada,
        }).select("id").single();
        if (error || !s) {
          if (error?.code === "23505") return "colisao";
          throw new Error(error?.message ?? "Falha ao criar treino.");
        }
        const { error: e2 } = await supabase.from("simulado_questoes").insert(t.questaoIds.map((questao_id, ordem) => ({ simulado_id: s.id, questao_id, ordem })));
        if (e2) {
          await supabase.from("simulados").delete().eq("id", s.id);
          throw new Error("Não foi possível montar o treino.");
        }
        return { simuladoId: s.id };
      },
      regras: (await ler(entrada.conteudo)).regras,
      agora,
    };

    const r = await criarTreinoDoPlanoCom(deps, entrada);
    if (!r.ok) return r;
    await iniciarTentativa(r.simuladoId);
    return r;
  } catch (e) {
    const msg = e instanceof Error && e.message === "Não foi possível montar o treino." ? e.message : "Não foi possível criar o treino.";
    return { ok: false, erro: msg };
  }
}

export async function marcarRevisado(entrada: { conteudo: string }): Promise<Simples> {
  try {
    const aluno = await getAlunoAtual();
    if (!aluno) return { ok: false, erro: "Faça login novamente." };
    if (!chaveValida(entrada.conteudo)) return { ok: false, erro: "Conteúdo inválido." };
    const { error } = await supabase.from("plano_revisoes")
      .upsert({ conta_id: aluno.id, conteudo: entrada.conteudo, revisado_em: new Date().toISOString() }, { onConflict: "conta_id,conteudo" });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível marcar como revisado." };
  }
}

export async function salvarTempoSemana(entrada: { minutos: number }): Promise<Simples> {
  try {
    const aluno = await getAlunoAtual();
    if (!aluno) return { ok: false, erro: "Faça login novamente." };
    if (!tempoSemanaValido(entrada.minutos)) return { ok: false, erro: "Tempo inválido." };
    const { error } = await supabase.from("planos_estudo")
      .upsert({ conta_id: aluno.id, escola_id: aluno.escola_id, minutos_semana: entrada.minutos, updated_at: new Date().toISOString() }, { onConflict: "conta_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível salvar o tempo." };
  }
}
