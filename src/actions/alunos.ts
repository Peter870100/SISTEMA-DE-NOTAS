"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirAcessoATurmaId, getProfessorAtual, professorTemAcessoATurma } from "@/lib/auth";
import type { Aluno } from "@/lib/types";
import type { ValorCelula } from "@/lib/status";

/** Remove acentos e caixa pra comparar títulos de atividade entre turmas diferentes. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Transfere um aluno pra outra turma sem perder as notas: pra cada nota já lançada,
 * procura uma atividade com o mesmo título (e tipo) na turma de destino — cria se não
 * existir — e move a nota pra lá. O aluno some da turma de origem e aparece na de destino
 * já com o que tinha lançado.
 */
export async function transferirAluno(alunoId: string, turmaDestinoId: string): Promise<void> {
  const [{ data: aluno }, { data: turmaDestino }] = await Promise.all([
    supabase.from("alunos").select("*").eq("id", alunoId).single(),
    supabase.from("turmas").select("*").eq("id", turmaDestinoId).single(),
  ]);
  if (!aluno) throw new Error("Aluno não encontrado.");
  if (!turmaDestino) throw new Error("Turma de destino não encontrada.");
  if (aluno.turma_id === turmaDestinoId) throw new Error("O aluno já está nessa turma.");

  const professor = await getProfessorAtual();
  if (professor && professor.role !== "admin") {
    const { data: turmaOrigem } = await supabase
      .from("turmas")
      .select("nome")
      .eq("id", aluno.turma_id)
      .single();
    const podeOrigem = turmaOrigem ? await professorTemAcessoATurma(professor, turmaOrigem.nome) : false;
    const podeDestino = await professorTemAcessoATurma(professor, turmaDestino.nome);
    if (!podeOrigem || !podeDestino) {
      throw new Error("Você não tem acesso a uma dessas turmas.");
    }
  }

  const [{ data: notasAluno }, { data: colunasOrigem }, { data: colunasDestino }] = await Promise.all([
    supabase.from("notas_celulas").select("*").eq("aluno_id", alunoId),
    supabase.from("atividades_colunas").select("*").eq("turma_id", aluno.turma_id),
    supabase.from("atividades_colunas").select("*").eq("turma_id", turmaDestinoId),
  ]);

  const colunaOrigemPorId = new Map((colunasOrigem ?? []).map((c) => [c.id, c]));
  const colunaDestinoPorChave = new Map(
    (colunasDestino ?? []).map((c) => [`${normalizar(c.titulo)}:${c.tipo}`, c])
  );
  let proximaOrdemDestino = (colunasDestino ?? []).reduce((max, c) => Math.max(max, c.ordem), -1) + 1;

  for (const nota of notasAluno ?? []) {
    const colunaOrigem = colunaOrigemPorId.get(nota.coluna_id);
    if (!colunaOrigem) continue;

    const chave = `${normalizar(colunaOrigem.titulo)}:${colunaOrigem.tipo}`;
    let colunaDestino = colunaDestinoPorChave.get(chave);
    if (!colunaDestino) {
      const { data: nova, error } = await supabase
        .from("atividades_colunas")
        .insert({
          turma_id: turmaDestinoId,
          titulo: colunaOrigem.titulo,
          tema: colunaOrigem.tema,
          peso: colunaOrigem.peso,
          tipo: colunaOrigem.tipo,
          ordem: proximaOrdemDestino,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      colunaDestino = nova;
      colunaDestinoPorChave.set(chave, colunaDestino);
      proximaOrdemDestino++;
    }

    const { error: erroUpsert } = await supabase.from("notas_celulas").upsert(
      {
        aluno_id: alunoId,
        coluna_id: colunaDestino.id,
        valor: nota.valor,
        status_texto: nota.status_texto,
        atualizado_por: nota.atualizado_por,
      },
      { onConflict: "aluno_id,coluna_id" }
    );
    if (erroUpsert) throw new Error(erroUpsert.message);

    if (nota.coluna_id !== colunaDestino.id) {
      await supabase.from("notas_celulas").delete().eq("id", nota.id);
    }
  }

  const { count } = await supabase
    .from("alunos")
    .select("id", { count: "exact", head: true })
    .eq("turma_id", turmaDestinoId);

  const { error: erroMove } = await supabase
    .from("alunos")
    .update({
      turma_id: turmaDestinoId,
      ordem: count ?? 0,
      transferido_em: new Date().toISOString(),
    })
    .eq("id", alunoId);
  if (erroMove) throw new Error(erroMove.message);
}

export async function addAluno(
  turmaId: string,
  nome: string,
  ordem: number
): Promise<Aluno> {
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) throw new Error("Nome do aluno não pode ser vazio");

  const professor = await getProfessorAtual();
  await exigirAcessoATurmaId(professor, turmaId);

  const { data, error } = await supabase
    .from("alunos")
    .insert({ turma_id: turmaId, nome: nomeLimpo, ordem })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar aluno");
  return data;
}

/** Adiciona vários alunos de uma vez (um nome por linha, colados na tela). */
export async function adicionarAlunos(
  turmaId: string,
  nomes: string[],
  ordemInicial: number
): Promise<Aluno[]> {
  const limpos = nomes.map((n) => n.trim()).filter(Boolean);
  if (limpos.length === 0) throw new Error("Nenhum nome informado.");

  const professor = await getProfessorAtual();
  await exigirAcessoATurmaId(professor, turmaId);

  const { data, error } = await supabase
    .from("alunos")
    .insert(limpos.map((nome, i) => ({ turma_id: turmaId, nome, ordem: ordemInicial + i })))
    .select();
  if (error || !data) throw new Error(error?.message ?? "Falha ao adicionar alunos");
  return data;
}

export async function deleteAluno(alunoId: string): Promise<void> {
  const professor = await getProfessorAtual();
  if (professor) {
    const { data: aluno } = await supabase
      .from("alunos")
      .select("turma_id")
      .eq("id", alunoId)
      .single();
    if (!aluno) throw new Error("Aluno não encontrado.");
    await exigirAcessoATurmaId(professor, aluno.turma_id);
  }

  const { error } = await supabase.from("alunos").delete().eq("id", alunoId);
  if (error) throw new Error(error.message);
}

/**
 * Desfaz uma exclusão: recria o aluno com o mesmo id e devolve as notas que ele tinha,
 * pra Ctrl+Z logo após excluir não perder nada. Só funciona enquanto a tela não foi
 * recarregada — a lista de notas vem da memória do navegador, não de um backup no banco.
 */
export async function restaurarAlunoExcluido(
  aluno: Aluno,
  celulas: { colunaId: string; valor: ValorCelula }[]
): Promise<Aluno> {
  const professor = await getProfessorAtual();
  await exigirAcessoATurmaId(professor, aluno.turma_id);

  const { data, error } = await supabase
    .from("alunos")
    .insert({
      turma_id: aluno.turma_id,
      numero: aluno.numero,
      nome: aluno.nome,
      ordem: aluno.ordem,
      nome_editado_em: aluno.nome_editado_em,
      transferido_em: aluno.transferido_em,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao restaurar aluno");

  if (celulas.length > 0) {
    const { error: erroNotas } = await supabase.from("notas_celulas").insert(
      celulas.map(({ colunaId, valor }) => ({
        aluno_id: data.id,
        coluna_id: colunaId,
        valor: valor.valor,
        status_texto: valor.status_texto,
      }))
    );
    if (erroNotas) throw new Error(erroNotas.message);
  }

  return data;
}

/**
 * Grava a nova ordem da turma (arrastar uma linha ou ordenar A–Z). O `numero` de
 * chamada acompanha a posição, que é como a escola numera: 1 é o primeiro da lista.
 * Vai em paralelo porque uma turma passa fácil de 40 alunos.
 */
export async function reordenarAlunos(
  turmaId: string,
  ordens: { id: string; ordem: number; numero: number | null }[]
): Promise<void> {
  const professor = await getProfessorAtual();
  await exigirAcessoATurmaId(professor, turmaId);

  const resultados = await Promise.all(
    ordens.map(({ id, ordem, numero }) =>
      supabase.from("alunos").update({ ordem, numero }).eq("id", id)
    )
  );
  const falha = resultados.find((r) => r.error);
  if (falha?.error) throw new Error(falha.error.message);
}

/**
 * Renomeia o aluno e marca quando foi editado, pra planilha mostrar o selo "editado".
 * `nomeEditadoEm` deixa passar por cima da data automática — usado só pelo Ctrl+Z, que
 * restaura o valor de antes (ou limpa, se essa era a primeira edição) em vez de gravar "agora".
 */
export async function renomearAluno(
  alunoId: string,
  nome: string,
  opts?: { nomeEditadoEm?: string | null }
): Promise<Aluno> {
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) throw new Error("Nome do aluno não pode ser vazio");

  const professor = await getProfessorAtual();
  if (professor) {
    const { data: aluno } = await supabase
      .from("alunos")
      .select("turma_id")
      .eq("id", alunoId)
      .single();
    if (!aluno) throw new Error("Aluno não encontrado.");
    await exigirAcessoATurmaId(professor, aluno.turma_id);
  }

  const nome_editado_em = opts?.nomeEditadoEm !== undefined ? opts.nomeEditadoEm : new Date().toISOString();

  const { data, error } = await supabase
    .from("alunos")
    .update({ nome: nomeLimpo, nome_editado_em })
    .eq("id", alunoId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao renomear aluno");
  return data;
}
