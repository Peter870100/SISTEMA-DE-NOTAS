import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { dadosFolhaProva, lerProva } from "@/lib/folha/provas-word-servidor";
import { dadosPrevia } from "@/lib/folha/previa-servidor";
import { Previa } from "./Previa";

export const dynamic = "force-dynamic";
// Carrega as questões e recorta/reduz as figuras com sharp.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pré-visualização da prova em Word (e do gabarito) para imprimir ou salvar em PDF. */
export default async function PreviaProvaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  // Mesma regra do download: dono da prova ou papel `dono`. Confere antes de carregar as figuras.
  const prova = await lerProva(id);
  if (!prova || prova.excluida || (professor.id !== prova.professor_id && professor.role !== "dono")) notFound();

  const carregada = await dadosFolhaProva(id);
  if (!carregada || carregada.prova.excluida) notFound();

  const busca = await searchParams;
  const qual = busca.qual === "gabarito" ? "gabarito" : "prova";
  const imprimir = busca.imprimir === "1";
  const dados = await dadosPrevia(carregada.dados);

  return <Previa dados={dados} provaId={id} nomeBase={carregada.nomeBase} qual={qual} imprimir={imprimir} />;
}
