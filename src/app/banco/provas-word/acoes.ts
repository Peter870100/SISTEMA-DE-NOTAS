"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirProfessor } from "@/lib/questoes/acesso";
import { supabase } from "@/lib/supabase/client";
import { MATERIAS } from "@/lib/questoes/materias";
import { LIMITE_QUESTOES_PROVA, materiaRotulo, rotuloPedido, textoPrevia, type Cenario } from "@/lib/folha/provas-word";
import {
  excluirProva,
  gerarProva,
  limparProvas,
  moverQuestao,
  previaProva,
  removerQuestao,
  salvarCabecalho,
  salvarNomeProva as gravarNomeProvaDe,
  trocarQuestao,
  type PedidoProva,
} from "@/lib/folha/provas-word-servidor";
import { assuntoDoTexto } from "@/lib/mcp/acoes/simulados";
import type { FiltrosSorteio } from "@/lib/simulados/servidor";

/**
 * Ações da página "Provas em Word". Cada uma confere de novo o professor da sessão: o cliente só manda os
 * filtros; escola e professor saem do servidor. Devolvem `{ ok: false, erro }` em vez de lançar, porque em
 * produção o Next esconde a mensagem dos erros lançados.
 */

type Falha = { ok: false; erro: string };
const CAMINHO = "/banco/provas-word";

const esquemaPedido = z
  .object({
    banca: z.string().trim().max(60).optional(),
    materia: z.enum(Object.keys(MATERIAS) as [keyof typeof MATERIAS, ...(keyof typeof MATERIAS)[]], { message: "Escolha a matéria." }),
    assunto: z.string().trim().max(120).optional(),
    anoDe: z.number().int().min(1900).max(2100).nullable().optional(),
    anoAte: z.number().int().min(1900).max(2100).nullable().optional(),
    quantidade: z
      .number({ message: `A quantidade de questões deve ser de 1 a ${LIMITE_QUESTOES_PROVA}.` })
      .int()
      .min(1, `A quantidade de questões deve ser de 1 a ${LIMITE_QUESTOES_PROVA}.`)
      .max(LIMITE_QUESTOES_PROVA, `A quantidade de questões deve ser de 1 a ${LIMITE_QUESTOES_PROVA}.`),
  })
  .refine((p) => !p.anoDe || !p.anoAte || p.anoDe <= p.anoAte, { message: "O ano inicial não pode ser depois do ano final." });

const esquemaGerar = z.object({
  pedido: z.unknown(),
  tipo: z.enum(["fixacao", "simulado"]),
  permitirRepetidas: z.boolean(),
});

const UUID = z.uuid();

function mensagem(e: unknown, padrao: string): string {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? padrao;
  return e instanceof Error && e.message ? e.message : padrao;
}

/** Pedido do núcleo a partir do formulário, com a escola e o professor da sessão. */
async function montarPedido(entrada: unknown): Promise<{ pedido: PedidoProva; rotulo: string }> {
  const professor = await exigirProfessor();
  const f = esquemaPedido.parse(entrada);
  const filtros: FiltrosSorteio = { materia: f.materia, banca: f.banca || undefined, anoDe: f.anoDe ?? undefined, anoAte: f.anoAte ?? undefined };
  let assuntoNome: string | null = null;
  if (f.assunto) {
    const assunto = await assuntoDoTexto({ supabase }, f.assunto, f.materia);
    filtros.assunto_id = assunto.id;
    assuntoNome = assunto.nome;
  }
  const rotuloMateria = materiaRotulo(filtros);
  // Dono: a escola atual da conta dele (a mesma do resto do site).
  const pedido: PedidoProva = { escolaId: professor.escola_id, professorId: professor.id, filtros, quantidade: f.quantidade, materiaRotulo: rotuloMateria, assuntoNome };
  return { pedido, rotulo: rotuloPedido(rotuloMateria, assuntoNome, f.banca) };
}

export async function previaProvaWord(entrada: unknown): Promise<{ ok: true; texto: string; cenario: Cenario } | Falha> {
  try {
    const { pedido, rotulo } = await montarPedido(entrada);
    const cenario = await previaProva(pedido);
    return { ok: true, texto: textoPrevia(rotulo, cenario), cenario };
  } catch (e) {
    return { ok: false, erro: mensagem(e, "Não foi possível ver as questões disponíveis.") };
  }
}

export async function gerarProvaWord(
  entrada: unknown,
): Promise<{ ok: true; id: string; titulo: string; total: number; repetidas: number; pedidas: number } | Falha> {
  try {
    const g = esquemaGerar.parse(entrada);
    const { pedido } = await montarPedido(g.pedido);
    const r = await gerarProva({ ...pedido, tipo: g.tipo, permitirRepetidas: g.permitirRepetidas, origem: "site" });
    revalidatePath(CAMINHO);
    return { ok: true, ...r, pedidas: pedido.quantidade };
  } catch (e) {
    return { ok: false, erro: mensagem(e, "Não foi possível gerar a prova.") };
  }
}

/** Exclui do histórico só se a prova for do professor da sessão (o núcleo filtra pelo professor). */
export async function excluirProvaWord(id: unknown): Promise<{ ok: true } | Falha> {
  try {
    const professor = await exigirProfessor();
    const provaId = UUID.parse(id);
    await excluirProva(professor.id, provaId);
    revalidatePath(CAMINHO);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof z.ZodError ? "Prova não encontrada." : mensagem(e, "Não foi possível excluir a prova.") };
  }
}

export async function limparProvasWord(): Promise<{ ok: true; excluidas: number } | Falha> {
  try {
    const professor = await exigirProfessor();
    const excluidas = await limparProvas(professor.id);
    revalidatePath(CAMINHO);
    return { ok: true, excluidas };
  } catch (e) {
    return { ok: false, erro: mensagem(e, "Não foi possível limpar o histórico.") };
  }
}

const esquemaCabecalho = z.object({
  provaId: UUID,
  titulo: z.string().max(1000),
  turma: z.string().max(1000).optional(),
  data: z.string().max(1000).optional(),
  valor: z.string().max(1000).optional(),
  instrucoes: z.string().max(1000).optional(),
});
// `questaoId` é a questão em que o professor clicou: o núcleo recusa se ela não estiver mais no índice.
const esquemaMover = z.object({ provaId: UUID, questaoId: UUID, de: z.number().int().min(0), para: z.number().int().min(0) });
const esquemaIndice = z.object({ provaId: UUID, questaoId: UUID, indice: z.number().int().min(0) });
const esquemaTroca = z.object({ provaId: UUID, questaoId: UUID, indice: z.number().int().min(0), aceitarUsadas: z.boolean() });

function atualizar(provaId: string): void {
  revalidatePath(`/banco/provas-word/${provaId}/previa`);
  revalidatePath(CAMINHO);
}

/** Erros de formato (zod) viram a mensagem padrão; os do núcleo já vêm escritos para o professor. */
function erroEdicao(e: unknown, padrao: string): Falha {
  return { ok: false, erro: e instanceof z.ZodError ? padrao : mensagem(e, padrao) };
}

export async function salvarCabecalhoProva(entrada: unknown): Promise<{ ok: true } | Falha> {
  try {
    const professor = await exigirProfessor();
    const { provaId, ...campos } = esquemaCabecalho.parse(entrada);
    await salvarCabecalho(professor, provaId, campos);
    atualizar(provaId);
    return { ok: true };
  } catch (e) {
    return erroEdicao(e, "Não foi possível salvar o cabeçalho.");
  }
}

/**
 * Grava o "Nome ou apelido" do professor da sessão: o id sai da sessão, nunca do cliente, então
 * ninguém muda o apelido de outro professor. Vale para todas as provas dele.
 */
export async function salvarNomeProva(texto: unknown): Promise<{ ok: true; nomeProva: string | null } | Falha> {
  try {
    const professor = await exigirProfessor();
    const nomeProva = await gravarNomeProvaDe(professor, z.string().max(1000).parse(texto));
    revalidatePath("/configuracoes");
    revalidatePath(CAMINHO, "layout");
    return { ok: true, nomeProva };
  } catch (e) {
    return erroEdicao(e, "Não foi possível salvar o nome do professor.");
  }
}

export async function moverQuestaoProva(entrada: unknown): Promise<{ ok: true } | Falha> {
  try {
    const professor = await exigirProfessor();
    const { provaId, questaoId, de, para } = esquemaMover.parse(entrada);
    await moverQuestao(professor, provaId, de, para, questaoId);
    atualizar(provaId);
    return { ok: true };
  } catch (e) {
    return erroEdicao(e, "Não foi possível mudar a ordem.");
  }
}

export async function removerQuestaoProva(entrada: unknown): Promise<{ ok: true } | Falha> {
  try {
    const professor = await exigirProfessor();
    const { provaId, questaoId, indice } = esquemaIndice.parse(entrada);
    await removerQuestao(professor, provaId, indice, questaoId);
    atualizar(provaId);
    return { ok: true };
  } catch (e) {
    return erroEdicao(e, "Não foi possível remover a questão.");
  }
}

export async function trocarQuestaoProva(
  entrada: unknown,
): Promise<{ ok: true; trocada: boolean; usada?: boolean; motivo?: "so-usadas" | "nenhuma" | "sem-base" } | Falha> {
  try {
    const professor = await exigirProfessor();
    const { provaId, questaoId, indice, aceitarUsadas } = esquemaTroca.parse(entrada);
    const r = await trocarQuestao(professor, provaId, indice, questaoId, aceitarUsadas);
    atualizar(provaId);
    return r.trocada ? { ok: true, trocada: true, usada: r.usada } : { ok: true, trocada: false, motivo: r.motivo };
  } catch (e) {
    return erroEdicao(e, "Não foi possível trocar a questão.");
  }
}
