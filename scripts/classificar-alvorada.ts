// Classifica o assunto das questões importadas do Alvorada-Bench pela IA (Message Batches: metade do preço).
//
//   npm run classificar-alvorada                 cria o lote com as questões sem assunto e espera terminar
//   npm run classificar-alvorada -- --lote ID    retoma um lote já criado (ex.: se o terminal fechou)
//
// Precisa de ANTHROPIC_API_KEY em .env.local. Só mexe em questões com fonte_id "alvorada:%" e sem assunto;
// não muda o status (publicada continua publicada). Assunto que a IA propõe e não existe vira "proposto"
// (o dono aprova ou junta em Banco → Assuntos).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types";
import { clienteIA, custoDoUso, pedidoClassificacao } from "../src/lib/questoes/ia";
import { ClassificacaoSchema, classificacaoParaAtualizacoes } from "../src/lib/questoes/formato-ia";
import { decidirClassificacao } from "../src/lib/questoes/alvorada";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local");
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
const POR_PEDIDO = 20;

type Questao = { id: string; area: Database["public"]["Tables"]["questoes"]["Row"]["area"]; materia: string; enunciado: string; comando: string; motivo_revisao: string | null };

async function semAssunto(): Promise<Questao[]> {
  const saida: Questao[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from("questoes").select("id, area, materia, enunciado, comando, motivo_revisao")
      .like("fonte_id", "alvorada:%").is("assunto_id", null).order("id").range(de, de + 999);
    if (error) throw new Error(error.message);
    saida.push(...((data ?? []) as Questao[]));
    if ((data ?? []).length < 1000) return saida;
  }
}

/** Reaproveita o assunto (mesma matéria, nome sem diferenciar maiúsculas) ou cria um proposto. */
async function assuntoProposto(materia: string, nome: string): Promise<string | null> {
  const limpo = nome.replace(/\*/g, "").trim();
  if (!limpo) return null;
  const padrao = limpo.replace(/[%_\\]/g, (c) => "\\" + c);
  const { data: achado } = await supabase.from("assuntos").select("id").eq("materia", materia).ilike("nome", padrao).limit(1).maybeSingle();
  if (achado) return achado.id;
  const { data: novo } = await supabase.from("assuntos").insert({ materia, nome: limpo, situacao: "proposto" }).select("id").maybeSingle();
  return novo?.id ?? null;
}

async function esperar(loteId: string) {
  for (;;) {
    const lote = await clienteIA().messages.batches.retrieve(loteId);
    const c = lote.request_counts;
    console.log(`${new Date().toLocaleTimeString("pt-BR")} lote ${lote.processing_status}: ${c.succeeded} prontos, ${c.processing} processando, ${c.errored} com erro`);
    if (lote.processing_status === "ended") return;
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

async function aplicar(loteId: string) {
  const questoes = new Map((await semAssunto()).map((q) => [q.id, q]));
  const { data: aprovados } = await supabase.from("assuntos").select("id, materia").eq("situacao", "aprovado");
  const mapa = new Map((aprovados ?? []).map((a) => [a.id, a.materia]));
  const ids = new Set(questoes.keys());
  let custo = 0, comAssunto = 0, propostos = 0, outraArea = 0, semResposta = 0;
  for await (const r of await clienteIA().messages.batches.results(loteId)) {
    if (r.result.type !== "succeeded") { semResposta++; continue; }
    custo += custoDoUso(r.result.message.usage);
    const bloco = r.result.message.content.find((b) => b.type === "text");
    const analise = ClassificacaoSchema.safeParse((() => { try { return JSON.parse(bloco && bloco.type === "text" ? bloco.text : ""); } catch { return null; } })());
    if (!analise.success) { semResposta++; continue; }
    for (const u of classificacaoParaAtualizacoes(analise.data, mapa, ids)) {
      const q = questoes.get(u.id)!;
      const d = decidirClassificacao(q, u);
      let assunto_id = d.assunto_id;
      if (!assunto_id && d.assuntoNovo) { assunto_id = await assuntoProposto(d.materia, d.assuntoNovo); if (assunto_id) propostos++; }
      if (d.aviso) outraArea++;
      const motivo = d.aviso ? [q.motivo_revisao, d.aviso].filter(Boolean).join(" ") : q.motivo_revisao;
      const { error } = await supabase.from("questoes").update({
        materia: d.materia, area: d.area, assunto_id,
        ...(d.aviso ? { precisa_revisao: true, motivo_revisao: motivo } : {}),
      }).eq("id", u.id).is("assunto_id", null);
      if (error) console.error(`  ${u.id}: ${error.message}`);
      else if (assunto_id) comAssunto++;
    }
  }
  console.log(`\nCom assunto: ${comAssunto} (assuntos novos propostos usados: ${propostos}) · IA apontou outra área: ${outraArea} · pedidos sem resposta válida: ${semResposta}`);
  console.log(`Custo real do lote: US$ ${custo.toFixed(2)}`);
  console.log(`Ainda sem assunto: ${(await semAssunto()).length}`);
}

async function main() {
  const i = process.argv.indexOf("--lote");
  let loteId = i >= 0 ? process.argv[i + 1] : undefined;
  if (!loteId) {
    const lista = await semAssunto();
    if (lista.length === 0) { console.log("Nenhuma questão do Alvorada sem assunto."); return; }
    const { data: assuntos } = await supabase.from("assuntos").select("id, materia, nome").eq("situacao", "aprovado");
    const pedidos = [];
    for (let k = 0; k < lista.length; k += POR_PEDIDO) pedidos.push(pedidoClassificacao(`c${k}`, lista.slice(k, k + POR_PEDIDO), assuntos ?? []));
    const lote = await clienteIA().messages.batches.create({ requests: pedidos });
    loteId = lote.id;
    console.log(`Lote criado: ${loteId} (${lista.length} questões, ${pedidos.length} pedidos).`);
    console.log(`Se o terminal fechar, retome com: npm run classificar-alvorada -- --lote ${loteId}`);
  }
  await esperar(loteId);
  await aplicar(loteId);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
