import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import type { Database } from "../src/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local"
  );
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

const XLSX_PATH = resolve(
  __dirname,
  "..",
  "planilha",
  "2ª BIMESTRE STATUS - REDAÇÃO - PROF. PETER (3).xlsx"
);

const BIMESTRE = "2º Bimestre";
const ANO_LETIVO = "2026";

// Abas sem dados de turma (planilhas auxiliares vazias) são ignoradas automaticamente
// quando nenhuma linha de header ("Nº" + "Nome do Aluno") é encontrada.

function nomeTurmaFromSheet(sheetName: string): string {
  const match = sheetName.match(/(\d)\s*ª?\s*([A-Za-z])/);
  if (!match) return sheetName.trim();
  const [, serie, letra] = match;
  return `${serie}ª série ${letra.toUpperCase()}`;
}

function acharLinhaHeader(rows: unknown[][]): number {
  return rows.findIndex((row) => {
    const textos = row.map((c) => String(c ?? "").trim().toLowerCase());
    return textos.includes("nº") && textos.includes("nome do aluno");
  });
}

async function importarAba(sheet: XLSX.WorkSheet, sheetName: string) {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  const headerIdx = acharLinhaHeader(rows);
  if (headerIdx === -1) {
    console.log(`  [pular] aba "${sheetName}" não tem cabeçalho de turma`);
    return;
  }

  const headerRaw = rows[headerIdx];
  const header = headerRaw.map((c) => String(c ?? "").trim());
  const colNumero = header.findIndex((h) => h.toLowerCase() === "nº");
  const colNome = header.findIndex((h) => h.toLowerCase() === "nome do aluno");

  // Só considera coluna de atividade se o cabeçalho for texto de verdade —
  // algumas planilhas têm colunas escondidas com resíduos (ex: número de
  // data do Excel) que não são atividades reais.
  const colunasAtividade = headerRaw
    .map((titulo, idx) => ({ titulo, idx }))
    .filter(
      ({ titulo, idx }) =>
        typeof titulo === "string" &&
        titulo.trim() !== "" &&
        idx !== colNumero &&
        idx !== colNome
    )
    .map(({ titulo, idx }) => ({ titulo: String(titulo).trim(), idx }));

  const nomeTurma = nomeTurmaFromSheet(sheetName);

  const { data: existente } = await supabase
    .from("turmas")
    .select("id")
    .eq("nome", nomeTurma)
    .eq("bimestre", BIMESTRE)
    .eq("ano_letivo", ANO_LETIVO)
    .maybeSingle();

  if (existente) {
    console.log(`  [pular] turma "${nomeTurma}" já importada (id=${existente.id})`);
    return;
  }

  const { data: turma, error: turmaError } = await supabase
    .from("turmas")
    .insert({ nome: nomeTurma, bimestre: BIMESTRE, ano_letivo: ANO_LETIVO })
    .select()
    .single();
  if (turmaError || !turma) throw turmaError;

  const colunaIdPorIndice = new Map<number, string>();
  for (const [ordem, { titulo, idx }] of colunasAtividade.entries()) {
    const { data: coluna, error } = await supabase
      .from("atividades_colunas")
      .insert({ turma_id: turma.id, titulo, ordem })
      .select()
      .single();
    if (error || !coluna) throw error;
    colunaIdPorIndice.set(idx, coluna.id);
  }

  let totalAlunos = 0;
  let totalCelulas = 0;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const nome = String(row?.[colNome] ?? "").trim();
    if (!nome) continue;

    const numeroRaw = row[colNumero];
    const numero = typeof numeroRaw === "number" ? numeroRaw : null;

    const { data: aluno, error: alunoError } = await supabase
      .from("alunos")
      .insert({ turma_id: turma.id, nome, numero, ordem: totalAlunos })
      .select()
      .single();
    if (alunoError || !aluno) throw alunoError;
    totalAlunos++;

    const celulas: Database["public"]["Tables"]["notas_celulas"]["Insert"][] = [];
    for (const [idx, colunaId] of colunaIdPorIndice) {
      const raw = row[idx];
      if (raw === null || raw === undefined || raw === "") continue;
      if (typeof raw === "number") {
        celulas.push({ aluno_id: aluno.id, coluna_id: colunaId, valor: raw });
      } else {
        celulas.push({
          aluno_id: aluno.id,
          coluna_id: colunaId,
          status_texto: String(raw).trim(),
        });
      }
    }
    if (celulas.length > 0) {
      const { error: celulasError } = await supabase
        .from("notas_celulas")
        .insert(celulas);
      if (celulasError) throw celulasError;
      totalCelulas += celulas.length;
    }
  }

  console.log(
    `  [ok] turma "${nomeTurma}": ${colunasAtividade.length} colunas, ${totalAlunos} alunos, ${totalCelulas} células`
  );
}

async function main() {
  console.log(`Lendo planilha: ${XLSX_PATH}`);
  const buf = readFileSync(XLSX_PATH);
  const workbook = XLSX.read(buf, { type: "buffer" });

  for (const sheetName of workbook.SheetNames) {
    console.log(`Aba: ${sheetName}`);
    await importarAba(workbook.Sheets[sheetName], sheetName);
  }

  console.log("Importação concluída.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
