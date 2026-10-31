import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { avisosDaQuestao } from "../src/lib/folha/avisos";
import { folhaAluno, folhaGabarito, type QuestaoFolha } from "../src/lib/folha/docx";

// Carrega .env.local sem imprimir nada (só linhas CHAVE=valor).
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const linha of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function slug(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "tarefa"
  );
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local");
  const supabase = createClient(url, chave);

  const titulo = arg("titulo");
  const idsArg = arg("ids");
  const geracao = arg("geracao");
  if (!titulo || (!idsArg && !geracao)) {
    console.error('Uso: npx tsx scripts/folha-tarefa.ts --titulo "Título" (--ids id1,id2,... | --geracao <id>)');
    process.exit(1);
  }

  let ids: string[];
  if (idsArg) {
    ids = idsArg.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    const { data, error } = await supabase
      .from("questoes")
      .select("id")
      .eq("geracao_id", geracao!)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    ids = (data ?? []).map((r: { id: string }) => r.id);
  }
  if (ids.length === 0) throw new Error("Nenhuma questão encontrada.");

  const { data: linhas, error } = await supabase
    .from("questoes")
    .select("id, enunciado, comando, alternativas, resposta, resolucao, materia, conteudo")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const porId = new Map((linhas ?? []).map((r) => [r.id as string, r] as const));
  const faltando = ids.filter((id) => !porId.has(id));
  if (faltando.length > 0) {
    console.error(`Questões não encontradas: ${faltando.join(", ")}`);
    process.exit(1);
  }

  const { data: imgs, error: errImg } = await supabase.from("questao_imagens").select("questao_id").in("questao_id", ids);
  if (errImg) throw new Error(errImg.message);
  const comImagem = new Set((imgs ?? []).map((r: { questao_id: string }) => r.questao_id));

  const questoes: QuestaoFolha[] = [];
  ids.forEach((id, i) => {
    const r = porId.get(id)!;
    questoes.push({
      id: r.id,
      enunciado: r.enunciado ?? "",
      comando: r.comando ?? "",
      alternativas: r.alternativas ?? [],
      resposta: r.resposta ?? null,
      resolucao: r.resolucao ?? null,
      materia: r.materia ?? "",
    });
    for (const a of avisosDaQuestao({ id, temImagem: comImagem.has(id), temConteudo: r.conteudo != null }, i + 1)) {
      console.warn(`AVISO: ${a}`);
    }
  });

  const logoPath = join(process.cwd(), "public", "LOGO2025_CURVAS.png");
  const logo = existsSync(logoPath) ? readFileSync(logoPath) : null;
  const dados = { titulo, escola: "Colégio Status", logo, questoes };

  const pasta = join(process.cwd(), "folhas");
  mkdirSync(pasta, { recursive: true });
  const base = `${new Date().toISOString().slice(0, 10)}-${slug(titulo)}`;
  const caminhoAluno = join(pasta, `${base}.docx`);
  const caminhoGabarito = join(pasta, `${base}-gabarito.docx`);
  writeFileSync(caminhoAluno, await folhaAluno(dados));
  writeFileSync(caminhoGabarito, await folhaGabarito(dados));
  console.log(caminhoAluno);
  console.log(caminhoGabarito);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
