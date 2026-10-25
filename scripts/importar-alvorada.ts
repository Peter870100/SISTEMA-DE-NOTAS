// Importa o dataset Alvorada-Bench (vestibulares) para o banco geral de questões.
//
//   curl -L -o questions_data.csv https://huggingface.co/datasets/HenriqueGodoy/Alvorada-bench/resolve/main/questions_data.csv
//   npm run importar-alvorada -- questions_data.csv            (só simula: mostra o que entraria)
//   npm run importar-alvorada -- questions_data.csv --gravar   (backup da tabela questoes + gravação)
//
// Pode rodar de novo: pula o que já tem o mesmo fonte_id (alvorada:<question_id>) ou a mesma
// banca/ano/caderno/número. ENEM: só entra o que ainda não existe no banco (o ENEM 2009–2023 já veio do enem.dev).
// Nada que já existe é alterado. Para desfazer: as questões importadas têm fonte_id começando com "alvorada:".
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types";
import { converterLinha, lerCsv, separarRepetidas, type Convertida, type LinhaAlvorada } from "../src/lib/questoes/alvorada";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local");
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

const args = process.argv.slice(2);
const arquivo = args.find((a) => !a.startsWith("--"));
const gravar = args.includes("--gravar");
const LOTE = 200;

const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

async function todas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const saida: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) throw new Error(error.message);
    saida.push(...(data ?? []));
    if ((data ?? []).length < 1000) return saida;
  }
}

function contar<T>(lista: T[], chave: (x: T) => string): Record<string, number> {
  const c: Record<string, number> = {};
  for (const x of lista) c[chave(x)] = (c[chave(x)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)));
}

/** Motivo resumido para a contagem (o texto completo fica na questão). */
const tipoDoMotivo = (m: string) => m.replace(/\(.*?\)|"[^"]*"|\d+/g, "").split(":")[0].replace(/\s+/g, " ").trim();

async function main() {
  if (!arquivo) throw new Error("Uso: npm run importar-alvorada -- <questions_data.csv> [--gravar]");
  const linhas = lerCsv(readFileSync(arquivo, "utf8")) as unknown as LinhaAlvorada[];
  const convertidas = separarRepetidas(linhas.map(converterLinha).filter((c): c is Convertida => c !== null));

  const existentes = await todas((de, ate) => supabase.from("questoes").select("banca, ano, caderno, numero, fonte_id, enunciado").eq("escopo", "geral").range(de, ate));
  const chaves = new Set(existentes.filter((q) => q.numero != null).map((q) => `${q.banca}|${q.ano}|${q.caderno}|${q.numero}`));
  const fontes = new Set(existentes.map((q) => q.fonte_id).filter(Boolean));
  const textosEnem = new Set(existentes.filter((q) => q.banca === "ENEM").map((q) => normalizar(q.enunciado)));
  // ENEM: o caderno de língua estrangeira não bate entre o dataset e o banco; na dúvida não entra.
  // Só entra número de prova que o banco ainda não tem em nenhum caderno.
  const numerosEnem = new Set(existentes.filter((q) => q.banca === "ENEM").map((q) => `${q.ano}|${q.numero}`));

  const novas: Convertida[] = [];
  const puladas: Record<string, number> = {};
  for (const c of convertidas) {
    const enem = c.linha.banca === "ENEM";
    const jaTem = fontes.has(c.linha.fonte_id!) || chaves.has(c.chave)
      || (enem && (textosEnem.has(normalizar(c.linha.enunciado as string)) || numerosEnem.has(`${c.linha.ano}|${c.linha.numero}`)));
    if (jaTem) { puladas[c.linha.banca] = (puladas[c.linha.banca] ?? 0) + 1; continue; }
    novas.push(c);
    chaves.add(c.chave);
  }

  console.log(`Linhas no CSV: ${linhas.length} · convertidas (bancas conhecidas): ${convertidas.length}`);
  console.log("Puladas (já existiam no banco):", puladas);
  console.log("A importar por banca:", contar(novas, (c) => c.linha.banca));
  console.log("A importar por banca e matéria:", contar(novas, (c) => `${c.linha.banca} · ${c.linha.materia}`));
  console.log("Publicadas / em revisão:", contar(novas, (c) => c.linha.status!));
  console.log("Motivos de revisão:", contar(novas.flatMap((c) => c.motivos), tipoDoMotivo));

  if (!gravar) { console.log("\nSó simulação. Para gravar, rode de novo com --gravar."); return; }

  const pasta = join(process.cwd(), "backups");
  mkdirSync(pasta, { recursive: true });
  const backup = join(pasta, `questoes-antes-alvorada-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const tudo = await todas((de, ate) => supabase.from("questoes").select("*").order("id").range(de, ate));
  writeFileSync(backup, JSON.stringify(tudo));
  console.log(`\nBackup da tabela questoes (${tudo.length} linhas): ${backup}`);

  let gravadas = 0;
  const falhas: string[] = [];
  for (let i = 0; i < novas.length; i += LOTE) {
    const lote = novas.slice(i, i + LOTE).map((c) => c.linha);
    const { error } = await supabase.from("questoes").insert(lote);
    if (!error) { gravadas += lote.length; continue; }
    // Um lote falha inteiro: tenta uma a uma para gravar as boas e listar as que deram erro.
    for (const q of lote) {
      const { error: e } = await supabase.from("questoes").insert(q);
      if (e) falhas.push(`${q.fonte_id}: ${e.message}`); else gravadas++;
    }
  }
  console.log(`Gravadas: ${gravadas} · com erro: ${falhas.length}`);
  for (const f of falhas.slice(0, 20)) console.log("  ", f);

  const amostra = await todas((de, ate) => supabase.from("questoes").select("banca, ano, numero, materia, status, enunciado, alternativas, resposta").like("fonte_id", "alvorada:%").range(de, ate));
  console.log(`\nNo banco com fonte_id alvorada: ${amostra.length}`);
  for (const q of [...amostra].sort(() => Math.random() - 0.5).slice(0, 5)) {
    console.log(`\n--- ${q.banca} ${q.ano} nº ${q.numero ?? "—"} · ${q.materia} · ${q.status} · gabarito ${q.resposta}`);
    console.log(q.enunciado.slice(0, 500));
    for (const a of q.alternativas) if (a.texto) console.log(`  ${a.letra}) ${a.texto.slice(0, 120)}`);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
