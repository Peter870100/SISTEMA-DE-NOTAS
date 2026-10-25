// Importa uma prova em PDF (prova + gabarito) do computador para o banco geral, pelo mesmo caminho da
// tela "Importar prova" e da Hermes: desenha as páginas, manda o lote para a IA e grava as questões em revisão.
// A conferência continua em /banco/importacoes/<id>/revisar.
//
//   npm run importar-prova -- public/Provas_Organizadas/UFMS/2025-12-07_Vestibular_2026 --paginas-gabarito 3
//       pasta de uma edição do INDICE_PROVAS.csv (banca, ano e PDFs vêm do índice); só simula
//   ... --paginas-prova 2-22     escolhe as páginas da prova (padrão: todas; o mesmo formato da tela)
//   ... --gravar                 cria a importação de verdade e espera a leitura (paga)
//   npm run importar-prova -- --banca UEMS --ano 2024 --prova p.pdf --gabarito g.pdf [--gravar]
//       sem índice: arquivos e dados informados à mão
//
// Recusa se já houver questões dessa banca/ano no banco geral ou uma importação dela em andamento.
// Se o terminal fechar durante a leitura, abra o link da importação: a página continua de onde parou.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { supabase } from "@/lib/supabase/client";
import { lerPaginas } from "@/lib/questoes/paginas";
import { PRECO_ENTRADA_LOTE, PRECO_SAIDA_LOTE } from "@/lib/questoes/ia";
import { acharEdicao, lerIndiceProvas } from "@/lib/questoes/provas-organizadas";
import { abrirPdfServidor } from "@/lib/questoes/pdf-servidor";
import { depsPadrao, desenharProximaLeva, guardarOriginal, type Selecao, type TipoArquivo } from "@/lib/questoes/importacao-levas";
import { atualizarImportacaoPor, criarImportacaoPor, iniciarLeituraPor, marcarErroEnvioPor } from "@/lib/questoes/importacao-nucleo";
import type { AtorEscola } from "@/lib/simulados/ator";

const SITE = "https://www.statusavalia.com.br";
const ESPERA_MS = 60_000;

const args = process.argv.slice(2);
const opcao = (nome: string) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const gravar = args.includes("--gravar");
const COM_VALOR = new Set(["--banca", "--ano", "--prova", "--gabarito", "--paginas-prova", "--paginas-gabarito"]);
const pasta = args.find((a, i) => !a.startsWith("--") && !COM_VALOR.has(args[i - 1]));

/** Procura o INDICE_PROVAS.csv na pasta da edição e acima dela. */
function acharIndice(de: string): string | null {
  let atual = resolve(de);
  for (let i = 0; i < 4; i++) {
    const candidato = join(atual, "INDICE_PROVAS.csv");
    if (existsSync(candidato)) return candidato;
    atual = dirname(atual);
  }
  return null;
}

type Pedido = { banca: string; ano: number; prova: string; gabarito: string | null; observacoes: string };

function lerPedido(): Pedido {
  if (pasta) {
    const indice = acharIndice(pasta);
    if (!indice) throw new Error(`Não achei o INDICE_PROVAS.csv acima de ${pasta}.`);
    const edicao = acharEdicao(lerIndiceProvas(readFileSync(indice, "utf8")), resolve(pasta));
    if (!edicao) throw new Error(`A pasta ${pasta} não está no índice ${indice}.`);
    if (!edicao.prova) throw new Error(`O índice diz que essa edição não tem prova (${edicao.situacao}).`);
    const raiz = dirname(indice);
    return {
      banca: opcao("banca") ?? edicao.instituicao, ano: Number(opcao("ano") ?? edicao.edicao),
      prova: join(raiz, edicao.prova), gabarito: edicao.gabarito ? join(raiz, edicao.gabarito) : null, observacoes: edicao.observacoes,
    };
  }
  const banca = opcao("banca");
  const ano = Number(opcao("ano"));
  const prova = opcao("prova");
  if (!banca || !Number.isInteger(ano) || !prova) throw new Error("Informe a pasta da edição, ou --banca, --ano e --prova (e --gabarito).");
  return { banca, ano, prova, gabarito: opcao("gabarito") ?? null, observacoes: "" };
}

/** Estimativa no preço de lote: cada página da prova vai com a seguinte e com as páginas do gabarito. */
function estimarCusto(paginasProva: number, paginasGabarito: number): number {
  const entrada = 9000 + paginasGabarito * 1600;
  return paginasProva * (entrada * PRECO_ENTRADA_LOTE + 3000 * PRECO_SAIDA_LOTE);
}

async function atorDono(): Promise<AtorEscola> {
  const { data, error } = await supabase.from("professores").select("id, role, escola_id").eq("role", "dono").limit(1).maybeSingle();
  if (error || !data) throw new Error(`Não achei a conta do dono: ${error?.message ?? "nenhuma"}.`);
  return { id: data.id, role: data.role, escola_id: data.escola_id, turmas: null, via: "app" };
}

async function jaNoBanco(banca: string, ano: number): Promise<number> {
  const { count, error } = await supabase.from("questoes").select("id", { count: "exact" }).eq("escopo", "geral").eq("banca", banca).eq("ano", ano).limit(1);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function emAndamento(banca: string, ano: number): Promise<string | null> {
  const { data, error } = await supabase.from("importacoes").select("id").eq("escopo", "geral").eq("banca", banca).eq("ano", ano).in("status", ["enviando", "lendo"]).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.id ?? null;
}

async function main() {
  const p = lerPedido();
  const bytes: Record<TipoArquivo, Uint8Array | null> = {
    prova: new Uint8Array(readFileSync(p.prova)),
    gabarito: p.gabarito ? new Uint8Array(readFileSync(p.gabarito)) : null,
  };
  const total = async (b: Uint8Array) => { const pdf = await abrirPdfServidor(b); const n = pdf.numPaginas; await pdf.fechar(); return n; };
  const totalProva = await total(bytes.prova!);
  const totalGabarito = bytes.gabarito ? await total(bytes.gabarito) : 0;
  const selecao: Selecao = {
    prova: lerPaginas(opcao("paginas-prova") ?? "", totalProva),
    gabarito: bytes.gabarito ? lerPaginas(opcao("paginas-gabarito") ?? "", totalGabarito) : [],
  };

  console.log(`${p.banca} ${p.ano} — banco geral`);
  console.log(`  prova:    ${p.prova} (${totalProva} páginas; usando ${selecao.prova.length}: ${opcao("paginas-prova") ?? "todas"})`);
  console.log(p.gabarito
    ? `  gabarito: ${p.gabarito} (${totalGabarito} páginas; usando ${selecao.gabarito.length}: ${opcao("paginas-gabarito") ?? "todas"})`
    : "  gabarito: nenhum — as respostas ficam em branco e as questões vão para revisão");
  if (p.observacoes) console.log(`  índice:   ${p.observacoes}`);
  console.log(`  custo estimado: US$ ${estimarCusto(selecao.prova.length, selecao.gabarito.length).toFixed(2)}`);

  const existentes = await jaNoBanco(p.banca, p.ano);
  const andamento = await emAndamento(p.banca, p.ano);
  if (existentes > 0) console.log(`  ATENÇÃO: já há ${existentes} questões ${p.banca} ${p.ano} no banco geral.`);
  if (andamento) console.log(`  ATENÇÃO: já há uma importação ${p.banca} ${p.ano} em andamento: ${SITE}/banco/importacoes/${andamento}`);
  if (!gravar) {
    console.log("\nSimulação: nada foi gravado. Confira as páginas e rode de novo com --gravar.");
    return;
  }
  if (existentes > 0 || andamento) throw new Error("Importação recusada (veja os avisos acima).");

  const ator = await atorDono();
  const id = await criarImportacaoPor(ator, { escopo: "geral", banca: p.banca, ano: p.ano, caderno: "" });
  const link = `${SITE}/banco/importacoes/${id}`;
  console.log(`\nImportação criada: ${link}`);
  try {
    for (const tipo of ["prova", "gabarito"] as const) if (bytes[tipo]) await guardarOriginal(id, tipo, bytes[tipo]!);
    const deps = { ...(await depsPadrao()), lerOriginal: async (_: string, tipo: TipoArquivo) => bytes[tipo]! };
    for (;;) {
      const leva = await desenharProximaLeva(ator, id, selecao, Date.now, deps, 10 * 60_000);
      if (leva.erro) throw new Error(leva.erro);
      console.log(`  páginas desenhadas: ${leva.prontas} de ${leva.prontas + leva.faltam}`);
      if (leva.faltam === 0) break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await marcarErroEnvioPor(ator, id, msg).catch(() => {});
    throw new Error(`Falha ao preparar as páginas: ${msg}`);
  }

  await iniciarLeituraPor(ator, id);
  console.log("Lote enviado para a IA. Esperando a leitura (pode levar até 1 h; se fechar o terminal, abra o link acima).");
  for (;;) {
    await new Promise((r) => setTimeout(r, ESPERA_MS));
    const s = await atualizarImportacaoPor(ator, id);
    if (s.status === "lendo") {
      console.log(`  ${new Date().toLocaleTimeString("pt-BR")} lendo: ${s.lidas} de ${s.total} páginas`);
      continue;
    }
    console.log(`\nLeitura terminada (${s.status}): ${s.questoes} questões gravadas em revisão, ${s.aConferir} a conferir.`);
    if (s.erros.length) console.log(`Páginas com erro: ${s.erros.map((x) => `${x.pagina} (${x.erro})`).join("; ")}`);
    if (s.avisos.length) console.log(`Avisos:\n  ${s.avisos.join("\n  ")}`);
    console.log(`Custo real: US$ ${(s.custoReal ?? 0).toFixed(2)}`);
    console.log(`Conferir: ${link}/revisar`);
    return;
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
