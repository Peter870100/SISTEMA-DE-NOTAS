"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirProfessor } from "@/lib/questoes/acesso";
import { supabase } from "@/lib/supabase/client";
import { MATERIAS } from "@/lib/questoes/materias";
import { LIMITE_QUESTOES_PROVA, materiaRotulo, rotuloPedido, textoPrevia, type Cenario } from "@/lib/folha/provas-word";
import { excluirProva, gerarProva, limparProvas, previaProva, type PedidoProva } from "@/lib/folha/provas-word-servidor";
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
