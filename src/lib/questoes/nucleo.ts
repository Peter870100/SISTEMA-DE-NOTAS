import { supabase } from "@/lib/supabase/client";
import { exigirEditorQuestaoPor } from "./acesso";
import { aplicarEdicao, type EdicaoQuestao } from "./edicao";
import type { Ator } from "./regras";

/**
 * Regras de questão com o ator explícito: a tela (professor da sessão) e a Hermes usam as mesmas funções.
 * Nada aqui lê cookie. Atualizar as telas (`revalidatePath`) fica com quem chama.
 */

export type { EdicaoQuestao } from "./edicao";
export { documentosAposEdicao } from "./edicao";

/** Altera só os campos enviados, com as mesmas validações da tela. */
export async function editarQuestaoPor(ator: Ator, id: string, e: EdicaoQuestao): Promise<{ avisos: string[] }> {
  const questao = await exigirEditorQuestaoPor(ator, id);
  const { campos, avisos } = aplicarEdicao(questao, e);
  const materia = campos.materia ?? questao.materia;
  if (campos.assunto_id) {
    const { data: assunto, error } = await supabase.from("assuntos").select("materia").eq("id", campos.assunto_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!assunto) throw new Error("Assunto não encontrado.");
    if (assunto.materia !== materia) throw new Error("Esse assunto não é dessa matéria.");
  } else if (campos.assunto_id === undefined && campos.materia && campos.materia !== questao.materia && questao.assunto_id) {
    const { data: assunto, error } = await supabase.from("assuntos").select("materia").eq("id", questao.assunto_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!assunto || assunto.materia !== materia) {
      campos.assunto_id = null;
      avisos.push("O assunto foi retirado porque era de outra matéria.");
    }
  }
  const { error } = await supabase.from("questoes").update({ ...campos, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  return { avisos };
}

/** Publica ou volta para revisão (mesma regra da tela). */
export async function publicarQuestaoPor(ator: Ator, id: string, publicar: boolean): Promise<void> {
  const questao = await exigirEditorQuestaoPor(ator, id);
  if (publicar && !questao.anulada && !questao.resposta) throw new Error("Marque a resposta certa (ou anulada) antes de publicar.");
  const { error } = await supabase
    .from("questoes")
    .update({ status: publicar ? "publicada" : "revisao", precisa_revisao: publicar ? false : questao.precisa_revisao, ...(publicar ? { falta_imagem: false } : {}), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (publicar) await concluirImportacaoSeVazia(questao.importacao_id);
}

/** Marca a importação como concluída quando nenhuma questão dela sobra em revisão. */
export async function concluirImportacaoSeVazia(importacaoId: string | null) {
  if (!importacaoId) return;
  const { count } = await supabase.from("questoes").select("id", { count: "exact", head: true }).eq("importacao_id", importacaoId).eq("status", "revisao");
  if (count === 0) await supabase.from("importacoes").update({ status: "concluida" }).eq("id", importacaoId).eq("status", "revisao");
}

/**
 * Manda a questão para a Lixeira (restaurável, com imagens, vínculos com simulados e respostas dos alunos).
 * Os arquivos do Storage ficam, para a restauração funcionar. Devolve o id do item na Lixeira.
 */
export async function excluirQuestaoPor(ator: Ator, id: string, via: "app" | "hermes"): Promise<string> {
  await exigirEditorQuestaoPor(ator, id);
  const { data, error } = await supabase.rpc("lixeira_excluir", { p_tipo: "questao", p_id: id, p_ator: ator.id, p_via: via });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Não foi possível mandar a questão para a Lixeira.");
  return data as string;
}
