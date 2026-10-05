"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirAdminDaEscola, exigirProfessorLogado, exigirTurmaDaEscola, turmasDaEscola } from "@/lib/escola-acesso";
import type { Turma } from "@/lib/types";

/** Turmas visíveis pro professor logado — da escola dele, todas ou só as liberadas se ele tiver acesso restrito. */
export async function listarTurmasAcessiveis(): Promise<Turma[]> {
  return turmasDaEscola(await exigirProfessorLogado());
}

/** Nomes distintos de turma (ex: "1ª série A"), pra montar a lista de acesso no admin. */
export async function listarNomesTurmas(): Promise<string[]> {
  const professor = await exigirAdminDaEscola();
  const { data, error } = await supabase.from("turmas").select("nome").eq("escola_id", professor.escola_id).order("nome");
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((t) => t.nome))];
}

/** Cria a turma (primeira de um bimestre) na escola do admin logado. Devolve o id. */
export async function criarTurma(nome: string, bimestre: string, anoLetivo: string): Promise<string> {
  const admin = await exigirAdminDaEscola();
  const n = String(nome ?? "").trim();
  const b = String(bimestre ?? "").trim();
  const a = String(anoLetivo ?? "").trim();
  if (n.length < 1 || n.length > 255) throw new Error("Informe o nome da turma (até 255 caracteres).");
  if (b.length < 1 || b.length > 50) throw new Error("Informe o bimestre (até 50 caracteres).");
  if (!/^\d{4}$/.test(a)) throw new Error("Informe o ano letivo com 4 dígitos.");

  const { data: existente, error: erroBusca } = await supabase
    .from("turmas")
    .select("id")
    .eq("escola_id", admin.escola_id)
    .eq("nome", n)
    .eq("bimestre", b)
    .eq("ano_letivo", a)
    .limit(1);
  if (erroBusca) throw new Error(erroBusca.message);
  if (existente && existente.length > 0) throw new Error("Já existe essa turma nesse bimestre.");

  const { data, error } = await supabase
    .from("turmas")
    .insert({ nome: n, bimestre: b, ano_letivo: a, escola_id: admin.escola_id })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar a turma.");
  return data.id;
}

/**
 * Cria um novo bimestre para a mesma turma (mesmo nome/ano letivo), copiando
 * a lista de alunos — mas sem as atividades e notas do bimestre atual, já que
 * é um período de avaliação novo.
 */
export async function criarBimestre(
  turmaAtualId: string,
  novoBimestre: string
): Promise<Turma> {
  const professor = await exigirProfessorLogado();
  const turmaAtual = await exigirTurmaDaEscola(professor, turmaAtualId);

  const label = novoBimestre.trim();
  if (!label) throw new Error("Informe o nome do bimestre");

  const { data: novaTurma, error: erroNovaTurma } = await supabase
    .from("turmas")
    .insert({ nome: turmaAtual.nome, bimestre: label, ano_letivo: turmaAtual.ano_letivo, escola_id: professor.escola_id })
    .select()
    .single();
  if (erroNovaTurma || !novaTurma) {
    throw new Error(erroNovaTurma?.message ?? "Falha ao criar bimestre");
  }

  const { data: alunosAtuais, error: erroAlunos } = await supabase
    .from("alunos")
    .select("nome, numero, ordem")
    .eq("turma_id", turmaAtualId)
    .order("ordem");
  if (erroAlunos) throw new Error(erroAlunos.message);

  if (alunosAtuais && alunosAtuais.length > 0) {
    const novosAlunos = alunosAtuais.map((a) => ({
      turma_id: novaTurma.id,
      nome: a.nome,
      numero: a.numero,
      ordem: a.ordem,
    }));
    const { error: erroInsereAlunos } = await supabase.from("alunos").insert(novosAlunos);
    if (erroInsereAlunos) throw new Error(erroInsereAlunos.message);
  }

  return novaTurma;
}
