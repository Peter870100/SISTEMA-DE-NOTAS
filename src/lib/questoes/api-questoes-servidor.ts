// Consultas da API de leitura do banco geral (/api/questoes). Só questões publicadas do banco geral.
// Sem "use server": só as rotas da API chamam, depois de conferir a chave.
import { supabase } from "@/lib/supabase/client";
import { imagensParaTela } from "@/lib/questoes/consultas";
import { questaoParaApi, type FiltrosApi, type QuestaoApi } from "./api-questoes";
import type { Questao } from "@/lib/types";

/** Validade dos links das figuras. */
const LINK_SEG = 3600;

const doBancoGeral = () => supabase.from("questoes").select("*", { count: "exact" }).eq("escopo", "geral").eq("status", "publicada");

async function formatar(questoes: Questao[]): Promise<QuestaoApi[]> {
  const ids = questoes.map((q) => q.id);
  const assuntoIds = [...new Set(questoes.map((q) => q.assunto_id).filter((a): a is string => !!a))];
  const [{ data: assuntos, error }, imagens] = await Promise.all([
    assuntoIds.length ? supabase.from("assuntos").select("id, nome").in("id", assuntoIds) : Promise.resolve({ data: [], error: null }),
    imagensParaTela(ids, LINK_SEG),
  ]);
  if (error) throw new Error(error.message);
  const nomes = new Map((assuntos ?? []).map((a) => [a.id, a.nome]));
  return questoes.map((q) => questaoParaApi(q, q.assunto_id ? nomes.get(q.assunto_id) ?? null : null, imagens.get(q.id) ?? []));
}

export async function listarQuestoesApi(f: FiltrosApi) {
  let consulta = doBancoGeral();
  if (f.bancas.length) consulta = consulta.in("banca", f.bancas);
  if (f.anos.length) consulta = consulta.in("ano", f.anos);
  if (f.materias.length) consulta = consulta.in("materia", f.materias);
  if (f.area) consulta = consulta.eq("area", f.area);
  if (f.assunto) consulta = consulta.eq("assunto_id", f.assunto);
  const de = (f.pagina - 1) * f.limite;
  const { data, count, error } = await consulta
    .order("banca").order("ano", { ascending: false }).order("caderno").order("numero").order("id")
    .range(de, de + f.limite - 1);
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return { total, pagina: f.pagina, limite: f.limite, tem_mais: de + f.limite < total, questoes: await formatar((data ?? []) as Questao[]) };
}

export async function questaoApiPorId(id: string): Promise<QuestaoApi | null> {
  const { data, error } = await doBancoGeral().eq("id", id).limit(1);
  if (error) throw new Error(error.message);
  const q = (data ?? [])[0] as Questao | undefined;
  return q ? (await formatar([q]))[0] : null;
}

/** Quantas questões publicadas há por banca e ano (para saber o que filtrar). */
export async function resumoApi() {
  const contagem = new Map<string, { banca: string; ano: number | null; questoes: number }>();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from("questoes").select("banca, ano").eq("escopo", "geral").eq("status", "publicada").order("id").range(de, de + 999);
    if (error) throw new Error(error.message);
    for (const q of data ?? []) {
      const chave = `${q.banca}|${q.ano}`;
      const atual = contagem.get(chave) ?? { banca: q.banca, ano: q.ano, questoes: 0 };
      atual.questoes++;
      contagem.set(chave, atual);
    }
    if ((data ?? []).length < 1000) break;
  }
  const edicoes = [...contagem.values()].sort((a, b) => a.banca.localeCompare(b.banca) || (b.ano ?? 0) - (a.ano ?? 0));
  return { total: edicoes.reduce((s, e) => s + e.questoes, 0), edicoes };
}
