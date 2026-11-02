import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { dadosFolhaProva, lerProva, questoesDoEditor } from "@/lib/folha/provas-word-servidor";
import { dadosPrevia } from "@/lib/folha/previa-servidor";
import { lerNomesProfessor } from "@/lib/professores/nome-prova";
import { PreviaEditavel } from "./PreviaEditavel";

export const dynamic = "force-dynamic";
// Carrega as questões e recorta/reduz as figuras com sharp (mesmo limite do download em Word).
export const maxDuration = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TITULO_GENERICO = "Pré-visualização";

/** Mesma regra do download: dono da prova ou papel `dono`; prova excluída não aparece. */
function podeVer(professor: { id: string; role?: string | null }, prova: { professor_id: string; excluida: boolean }): boolean {
  return !prova.excluida && (professor.id === prova.professor_id || professor.role === "dono");
}

/** Título da aba: o da prova só para quem pode ver a prova; senão um título genérico. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const generico = { title: TITULO_GENERICO };
  const professor = await getProfessorAtual();
  if (!professor) return generico;
  const { id } = await params;
  if (!UUID.test(id)) return generico;
  const prova = await lerProva(id);
  if (!prova || !podeVer(professor, prova)) return generico;
  return { title: `${prova.titulo} · ${TITULO_GENERICO}` };
}

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
  // Uma leitura só da prova; a conferência de dono roda antes de carregar questões e figuras.
  const carregada = await dadosFolhaProva(id, (prova) => podeVer(professor, prova));
  if (!carregada) notFound();

  const busca = await searchParams;
  const qual = busca.qual === "gabarito" ? "gabarito" : "prova";
  const imprimir = busca.imprimir === "1";
  // Só depois da conferência de acesso acima: quem pode ver a prova pode editá-la (dono dela ou papel `dono`).
  // O campo "Nome ou apelido do professor" só aparece para o próprio professor da prova (o dono não muda o apelido de outro).
  const ehDaProva = professor.id === carregada.prova.professor_id;
  const [dados, { questoes, aviso: avisoValores }, nomes] = await Promise.all([
    dadosPrevia(carregada.dados),
    questoesDoEditor(id),
    ehDaProva ? lerNomesProfessor(professor.id) : Promise.resolve(null),
  ]);

  return (
    <PreviaEditavel
      dados={dados}
      provaId={id}
      nomeBase={carregada.nomeBase}
      qual={qual}
      imprimir={imprimir}
      editor={{ titulo: dados.titulo, cabecalho: dados.cabecalho, questoes, avisoValores, nomeProva: ehDaProva ? (nomes?.nome_prova ?? "") : null }}
    />
  );
}
