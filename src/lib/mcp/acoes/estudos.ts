import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { gravarMaterial } from "@/lib/estudos/gravar";
import { HOSTS_FOTO } from "@/lib/estudos/fotos";
import {
  acrescentarParecer, aplicarChecagem, ehAmostra, exercicioPedeAtencao, textoReprovadoNaUltima, exercicioMudou, podeCorrigirExercicio, type ParecerChecagem,
} from "@/lib/estudos/situacao";
import type { ExercicioFixacao, ImagemEstudo, MaterialEstudo, SituacaoEstudo } from "@/lib/types";
import { MATERIAS } from "@/lib/questoes/materias";
import { campoTelefone, lerPorIds, lerTodas, texto, type Ctx, type ObterCtx } from "../leitura/comum";
import { materiaDoTexto } from "../leitura/banco";
import { atorDoEscopo, campoId, contaDoDono, falha, registrado, type Perfil } from "./ator";
import { assuntoDaMateria } from "./questoes";

/**
 * Material de reestudo (explicação + 10 exercícios por assunto), escrito pelo Claude e gravado como rascunho.
 * Uma segunda sessão confere às cegas e as regras publicam ou seguram. Só no MCP do dono; nenhuma chama IA paga.
 */

const LETRA = z.enum(["A", "B", "C", "D", "E"]);
const TEXTO = z.string().trim().min(1);

async function atualizarTelas() {
  try {
    (await import("next/cache")).revalidatePath("/banco", "layout");
  } catch {
    // Fora de um pedido do Next (ex.: testes) não há o que atualizar.
  }
}

const numero = (n: number) => n.toLocaleString("pt-BR");
const rotuloMateria = (m: string) => (MATERIAS as Record<string, { rotulo: string }>)[m]?.rotulo ?? m;

function lerOk<T>(r: { data: T | null; error: { message: string } | null }): T | null {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

async function materialDoAssunto(ctx: Ctx, assuntoId: string): Promise<MaterialEstudo | null> {
  return lerOk(await ctx.supabase.from("materiais_estudo").select("*").eq("assunto_id", assuntoId).maybeSingle()) as MaterialEstudo | null;
}

async function exerciciosDoMaterial(ctx: Ctx, materialId: string): Promise<ExercicioFixacao[]> {
  const lista = (lerOk(await ctx.supabase.from("exercicios_fixacao").select("*").eq("material_id", materialId).order("ordem")) ?? []) as ExercicioFixacao[];
  return [...lista].sort((a, b) => a.ordem - b.ordem);
}

async function materialPorId(ctx: Ctx, id: string): Promise<MaterialEstudo> {
  const m = lerOk(await ctx.supabase.from("materiais_estudo").select("*").eq("id", id).maybeSingle()) as MaterialEstudo | null;
  if (!m) throw new Error("Material não encontrado.");
  return m;
}

async function nomesDosAssuntos(ctx: Ctx, ids: string[]): Promise<Map<string, string>> {
  const linhas = await lerPorIds<{ id: string; nome: string }>(ids, (bloco, de, ate) =>
    ctx.supabase.from("assuntos").select("id, nome").in("id", bloco).order("id").range(de, ate));
  return new Map(linhas.map((a) => [a.id, a.nome]));
}

export function registrarAcoesEstudos(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  server.registerTool(
    "assuntos_para_estudo",
    {
      title: "Assuntos para o reestudo",
      description: "Lista os assuntos aprovados de uma matéria com o número de questões publicadas e a situação do material de estudo (sem material, rascunho, retido, em conferência ou publicado). Só leitura. Use para escolher o próximo assunto a escrever.",
      inputSchema: {
        materia: z.string().trim().min(1).max(40).describe('Matéria pelo nome, ex: "Matemática".'),
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        await contaDoDono(ctx);
        const materia = materiaDoTexto(args.materia);
        const assuntos = (lerOk(await ctx.supabase.from("assuntos").select("id, nome").eq("materia", materia).eq("situacao", "aprovado").order("nome").limit(1000)) ?? []) as { id: string; nome: string }[];
        if (assuntos.length === 0) return texto(`${rotuloMateria(materia)} não tem assuntos aprovados.`);
        const ids = assuntos.map((a) => a.id);
        const questoes = await lerPorIds<{ id: string; assunto_id: string }>(ids, (bloco, de, ate) =>
          ctx.supabase.from("questoes").select("id, assunto_id").in("assunto_id", bloco).eq("status", "publicada").order("id").range(de, ate));
        const contagem = new Map<string, number>();
        for (const q of questoes) contagem.set(q.assunto_id, (contagem.get(q.assunto_id) ?? 0) + 1);
        const materiais = await lerPorIds<{ assunto_id: string; situacao: string }>(ids, (bloco, de, ate) =>
          ctx.supabase.from("materiais_estudo").select("assunto_id, situacao").in("assunto_id", bloco).order("assunto_id").range(de, ate));
        const situacao = new Map(materiais.map((m) => [m.assunto_id, m.situacao]));
        const linhas = assuntos.map((a) => `- ${a.nome} — ${numero(contagem.get(a.id) ?? 0)} questões publicadas — ${situacao.get(a.id) ?? "sem material"}`);
        return texto([`${rotuloMateria(materia)}: ${assuntos.length} assuntos aprovados.`, ...linhas].join("\n"));
      } catch (e) {
        return falha("listar os assuntos para estudo", e);
      }
    },
  );

  server.registerTool(
    "salvar_material_estudo",
    {
      title: "Salvar material de estudo",
      description: `Grava como RASCUNHO o material de estudo de um assunto: explicação em blocos, desenhos, fotos e exatamente 10 exercícios A-E com comentário (sem custo, sem IA paga). Só aceita assunto sem material, em rascunho, ou retido que ainda pode ser corrigido (uma vez); o que foi publicado não se regrava por aqui (exercício publicado se corrige no painel). Texto original, sem copiar nem parafrasear de perto nenhum site; no máximo 800 palavras (meta 600). Blocos (tipo): titulo{texto}, paragrafo{texto}, lista{itens[]}, exemplo{enunciado, conta?, conclusao?}, pegadinhas{itens[{titulo,texto}]}, trecho{texto, autor, repare?, imagem_id?}, cartoes{itens[{titulo,subtitulo?,texto}]}, linha_tempo{titulo, legenda?, itens[{ano,nome,destaque?}]}, tabela{linhas[][]}, imagem{imagem_id}. Sem HTML. Em imagem_id (blocos) use a chave curta de um desenho ou foto enviados aqui; o servidor troca pelo id. Desenho: SVG simples (só svg, g, path, line, polyline, polygon, rect, circle, ellipse, text, tspan, title, defs, marker, linearGradient, stop; sem script, href nem on*; até 30 KB) com alt obrigatório. Foto: só de domínio público ou licença livre, com crédito, licença e fonte_url obrigatórios; a url tem de ser de ${HOSTS_FOTO.join(" ou ")} (https); só aparece ao aluno depois de uma pessoa aprovar no painel; sem nudez nem conteúdo impróprio para adolescentes. Exercício: figura (imagem) só pode ser a chave de um desenho. Fórmulas simples em Unicode (x², ½, √). fonte "wikipedia" exige fonte_url de pt.wikipedia.org; "ia" não leva fonte_url. Depois, uma sessão NOVA deve ler às cegas (ler_material_estudo com as_cegas) e registrar a checagem.`,
      inputSchema: {
        assunto: z.string().trim().min(1).max(120).describe("Assunto pelo nome."),
        materia: z.string().trim().min(1).max(40).describe('Matéria pelo nome, ex: "Matemática".'),
        blocos: z.array(z.record(z.string(), z.unknown())).min(1).describe("Blocos da explicação (veja a lista de tipos na descrição)."),
        desenhos: z.array(z.object({
          chave: z.string().trim().min(1).max(40).describe("Chave curta, citada nos blocos e nos exercícios."),
          svg: z.string().min(1).describe("O SVG."),
          alt: TEXTO.max(300).describe("Texto alternativo, obrigatório."),
          legenda: z.string().trim().max(300).optional(),
        })).max(20).default([]),
        fotos: z.array(z.object({
          chave: z.string().trim().min(1).max(40).describe("Chave curta, citada nos blocos."),
          url: z.string().trim().min(1).max(1000).describe(`URL da foto em ${HOSTS_FOTO.join(" ou ")}.`),
          alt: TEXTO.max(300),
          legenda: z.string().trim().max(300).optional(),
          credito: TEXTO.max(300).describe("Autor ou fonte da foto."),
          licenca: TEXTO.max(100).describe('Ex.: "Domínio público", "CC BY-SA 4.0".'),
          fonte_url: z.string().trim().url().max(1000).describe("Página de origem da foto."),
        })).max(10).default([]),
        fonte: z.enum(["wikipedia", "ia"]).describe('"wikipedia" se os fatos foram conferidos em um verbete; senão "ia".'),
        fonte_titulo: z.string().trim().max(200).optional().describe("Título do verbete usado na conferência."),
        fonte_url: z.string().trim().url().max(1000).optional().describe("Link do verbete (https://pt.wikipedia.org/...)."),
        exercicios: z.array(z.object({
          enunciado: TEXTO,
          imagem: z.string().trim().min(1).max(40).optional().describe("Chave de um desenho (nunca de foto)."),
          alternativas: z.array(z.object({ letra: LETRA, texto: TEXTO })).length(5).describe("As 5 alternativas, A a E, nessa ordem."),
          resposta_correta: LETRA,
          comentario: TEXTO.describe("Por que a certa está certa e as outras não."),
        })).describe("Exatamente 10 exercícios."),
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const dono = await contaDoDono(ctx);
        const ator = await atorDoEscopo(ctx, dono.escola_id);
        const materia = materiaDoTexto(args.materia);
        const assuntoId = await assuntoDaMateria(ctx, args.assunto, materia, true);
        if (args.fonte === "wikipedia" && !args.fonte_url?.startsWith("https://pt.wikipedia.org/")) {
          throw new Error('Com fonte "wikipedia", fonte_url deve começar com https://pt.wikipedia.org/.');
        }
        if (args.fonte === "ia" && args.fonte_url) throw new Error('Com fonte "ia" não há fonte_url.');
        const resposta = await registrado(
          perfil, ator, "salvar_material_estudo",
          { assunto: args.assunto, materia, fotos: args.fotos.length, desenhos: args.desenhos.length },
          async () => {
            const { materialId } = await gravarMaterial(ctx.supabase as unknown as SupabaseClient, {
              assuntoId, blocos: args.blocos, desenhos: args.desenhos, fotos: args.fotos,
              fonte: args.fonte, fonte_titulo: args.fonte_titulo, fonte_url: args.fonte_url, exercicios: args.exercicios,
            });
            await atualizarTelas();
            return `Material de ${args.assunto} salvo como rascunho (id ${materialId}), com ${args.exercicios.length} exercícios. Falta a checagem: numa sessão nova, leia com ler_material_estudo (as_cegas: true) e registre com registrar_checagem_estudo.`;
          },
        );
        return texto(resposta);
      } catch (e) {
        return falha("salvar o material de estudo", e);
      }
    },
  );

  server.registerTool(
    "ler_material_estudo",
    {
      title: "Ler material de estudo",
      description: "Lê o material de estudo de um assunto. Com as_cegas: true (use na checagem), devolve só blocos, desenhos e fotos (alt/legenda), e os exercícios sem resposta_correta nem comentário, nem o histórico de checagens: quem confere deve resolver os exercícios por conta própria. Sem as_cegas, devolve tudo, inclusive gabarito, comentários, situação, motivos e o parecer das checagens.",
      inputSchema: {
        assunto: z.string().trim().min(1).max(120).describe("Assunto pelo nome."),
        materia: z.string().trim().min(1).max(40).describe("Matéria pelo nome."),
        as_cegas: z.boolean().default(false).describe("true: sem gabarito, comentários nem histórico."),
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        await contaDoDono(ctx);
        const materia = materiaDoTexto(args.materia);
        const assuntoId = await assuntoDaMateria(ctx, args.assunto, materia);
        const m = await materialDoAssunto(ctx, assuntoId);
        if (!m) return texto(`${args.assunto} ainda não tem material de estudo.`);
        const imagens = (lerOk(await ctx.supabase.from("imagens_estudo").select("*").eq("material_id", m.id)) ?? []) as ImagemEstudo[];
        const exercicios = await exerciciosDoMaterial(ctx, m.id);
        const saida = args.as_cegas
          ? {
              material_id: m.id,
              blocos: m.blocos,
              imagens: imagens.map((i) => ({ id: i.id, tipo: i.tipo, svg: i.svg, alt: i.alt, legenda: i.legenda, credito: i.credito, licenca: i.licenca })),
              exercicios: exercicios.map((x) => ({
                ordem: x.ordem, enunciado: x.enunciado, imagem_id: x.imagem_id, alternativas: x.alternativas, situacao: x.situacao,
              })),
            }
          : { material: m, imagens, exercicios };
        return texto(JSON.stringify(saida, null, 2));
      } catch (e) {
        return falha("ler o material de estudo", e);
      }
    },
  );

  server.registerTool(
    "registrar_checagem_estudo",
    {
      title: "Registrar checagem do material",
      description: "Grava o parecer da checagem às cegas (feita por uma sessão que NÃO escreveu nem corrigiu o material). Informe o verificador (quem conferiu), o parecer do texto {ok, problema?} e, para cada exercício pendente (em rascunho), {ordem, ok, resposta_encontrada (a letra que VOCÊ achou, ou null), problema?}. Um exercício passa só se ok e a resposta encontrada bater com o gabarito. O material é publicado se o texto estiver ok e ao menos 5 exercícios passarem; senão fica retido, e o que reprovou também. Em material já publicado (reconferência de exercícios corrigidos), o parecer do texto é ignorado: um problema de texto em material publicado só se resolve pelo botão \"Encontrei um erro\" ou pelo painel.",
      inputSchema: {
        material: campoId("Id do material (veja em ler_material_estudo)."),
        verificador: TEXTO.max(100).describe("Quem conferiu (nome da sessão ou pessoa)."),
        texto: z.object({ ok: z.boolean(), problema: z.string().trim().max(2000).optional() }).nullable().optional().describe("Parecer do texto; obrigatório, exceto em material já publicado."),
        exercicios: z.array(z.object({
          ordem: z.number().int().min(1).max(10),
          ok: z.boolean(),
          resposta_encontrada: LETRA.nullable(),
          problema: z.string().trim().max(2000).optional(),
        })).max(10).describe("Um item por exercício pendente."),
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const dono = await contaDoDono(ctx);
        const ator = await atorDoEscopo(ctx, dono.escola_id);
        const m = await materialPorId(ctx, args.material);
        const exs = await exerciciosDoMaterial(ctx, m.id);
        const parecer: ParecerChecagem = { verificador: args.verificador, texto: args.texto ?? null, exercicios: args.exercicios };
        const r = aplicarChecagem({ ...m, textoReprovado: textoReprovadoNaUltima(m.checagem) }, exs, parecer);
        if (!r.ok) throw new Error(r.erro);
        const resposta = await registrado(
          perfil, ator, "registrar_checagem_estudo",
          { material: m.id, verificador: args.verificador },
          async () => {
            for (const e of r.exercicios) {
              lerOk(await ctx.supabase.from("exercicios_fixacao")
                .update({ situacao: e.situacao, motivo: e.motivo, checagens: e.checagens })
                .eq("material_id", m.id).eq("ordem", e.ordem));
            }
            const agora = new Date().toISOString();
            const historico = acrescentarParecer(m.checagem, parecer, agora);
            if (m.situacao === "publicado") {
              lerOk(await ctx.supabase.from("materiais_estudo").update({ checagem: historico }).eq("id", m.id));
            } else {
              const publica = r.material.situacao === "publicado";
              lerOk(await ctx.supabase.from("materiais_estudo").update({
                situacao: r.material.situacao,
                motivo: r.material.motivo,
                checagens: r.material.checagens,
                checagem: historico,
                checado_em: agora,
                ...(publica && { amostra: ehAmostra(m.assunto_id) }),
              }).eq("id", m.id));
            }
            await atualizarTelas();
            const aprovados = r.exercicios.filter((e) => e.situacao === "publicado").length;
            const retidos = r.exercicios.filter((e) => e.situacao === "retido");
            return [
              `Material ${r.material.situacao}.`,
              r.material.motivo ? `Motivo: ${r.material.motivo}` : "",
              `${aprovados} exercício(s) aprovados${retidos.length ? `; retidos: ${retidos.map((e) => `${e.ordem} (${e.motivo})`).join("; ")}` : ""}.`,
            ].filter(Boolean).join(" ");
          },
        );
        return texto(resposta);
      } catch (e) {
        return falha("registrar a checagem", e);
      }
    },
  );

  server.registerTool(
    "corrigir_exercicio_estudo",
    {
      title: "Corrigir exercício retido",
      description: "Corrige UM exercício retido que ainda pode ser corrigido (uma vez): troca enunciado, alternativas (as 5, A a E), resposta certa e comentário. O exercício volta a rascunho e precisa de nova checagem às cegas, por uma sessão diferente da que o corrigiu. Mantém a figura que ele já tinha.",
      inputSchema: {
        material: campoId("Id do material."),
        ordem: z.number().int().min(1).max(10),
        enunciado: TEXTO,
        alternativas: z.array(z.object({ letra: LETRA, texto: TEXTO })).length(5).describe("As 5 alternativas, A a E, nessa ordem."),
        resposta_correta: LETRA,
        comentario: TEXTO,
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const dono = await contaDoDono(ctx);
        const ator = await atorDoEscopo(ctx, dono.escola_id);
        if (args.alternativas.map((a) => a.letra).join("") !== "ABCDE") throw new Error("As alternativas devem ser A, B, C, D e E, nessa ordem.");
        const m = await materialPorId(ctx, args.material);
        if (m.situacao === "em_conferencia") throw new Error("Material em conferência: só o dono devolve.");
        const ex = (await exerciciosDoMaterial(ctx, m.id)).find((x) => x.ordem === args.ordem);
        if (!ex) throw new Error(`Exercício ${args.ordem} não encontrado.`);
        if (!podeCorrigirExercicio(ex, { ...m, textoReprovado: textoReprovadoNaUltima(m.checagem) })) throw new Error(`O exercício ${args.ordem} não pode ser corrigido: só um retido que ainda não esgotou as checagens, em material que ainda aceita correção.`);
        const resposta = await registrado(
          perfil, ator, "corrigir_exercicio_estudo", { material: m.id, ordem: args.ordem },
          async () => {
            const depois = { enunciado: args.enunciado, imagem_id: ex.imagem_id, alternativas: args.alternativas, resposta_correta: args.resposta_correta };
            if (exercicioMudou(ex, depois)) lerOk(await ctx.supabase.from("respostas_fixacao").delete().eq("exercicio_id", ex.id));
            lerOk(await ctx.supabase.from("exercicios_fixacao").update({
              enunciado: args.enunciado,
              alternativas: args.alternativas,
              resposta_correta: args.resposta_correta,
              comentario: args.comentario,
              situacao: "rascunho",
              motivo: null,
            }).eq("id", ex.id));
            await atualizarTelas();
            return `Exercício ${args.ordem} corrigido e de volta a rascunho. Falta nova checagem às cegas, por outra sessão.`;
          },
        );
        return texto(resposta);
      } catch (e) {
        return falha("corrigir o exercício", e);
      }
    },
  );

  server.registerTool(
    "avisos_estudo",
    {
      title: "Avisos do reestudo",
      description: "Lista o que pede atenção do dono no reestudo: avisos de erro abertos (só a quantidade; o texto se lê no painel), materiais e exercícios retidos, exercícios corrigidos esperando reconferência, exercícios em conferência sem aviso e fotos esperando aprovação, cada um com o assunto. Só leitura.",
      inputSchema: { ...campoTelefone },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        await contaDoDono(ctx);
        const sb = ctx.supabase;
        const [rel, mat, exe, fts, materiais] = await Promise.all([
          // O texto livre do aluno (`mensagem`) não é lido aqui: este MCP age com poderes de dono.
          lerTodas<{ material_id: string; exercicio_id: string | null }>((de, ate) =>
            sb.from("relatos_erro").select("material_id, exercicio_id").eq("situacao", "aberto").order("id").range(de, ate)),
          lerTodas<{ id: string; assunto_id: string; motivo: string | null }>((de, ate) =>
            sb.from("materiais_estudo").select("id, assunto_id, motivo").eq("situacao", "retido").order("id").range(de, ate)),
          lerTodas<{ id: string; material_id: string; ordem: number; motivo: string | null; situacao: SituacaoEstudo }>((de, ate) =>
            sb.from("exercicios_fixacao").select("id, material_id, ordem, motivo, situacao").in("situacao", ["retido", "rascunho", "em_conferencia"]).order("id").range(de, ate)),
          lerTodas<{ material_id: string; alt: string; credito: string | null }>((de, ate) =>
            sb.from("imagens_estudo").select("material_id, alt, credito").eq("tipo", "foto").is("aprovada_em", null).order("id").range(de, ate)),
          lerTodas<{ id: string; assunto_id: string; situacao: SituacaoEstudo }>((de, ate) =>
            sb.from("materiais_estudo").select("id, assunto_id, situacao").order("id").range(de, ate)),
        ]);
        const situacaoDe = new Map(materiais.map((m) => [m.id, m.situacao]));
        const doMaterial = new Map(materiais.map((m) => [m.id, m.assunto_id])); // material -> assunto
        const nomes = await nomesDosAssuntos(ctx, [...new Set(doMaterial.values())]);
        const assunto = (materialId: string) => nomes.get(doMaterial.get(materialId) ?? "") ?? "assunto desconhecido";
        const comAviso = new Set(rel.flatMap((r) => (r.exercicio_id ? [r.exercicio_id] : [])));
        const atencao = exe.filter((x) => exercicioPedeAtencao(situacaoDe.get(x.material_id) ?? "rascunho", x, comAviso));
        const retidos = atencao.filter((x) => x.situacao === "retido");
        const rascunhos = atencao.filter((x) => x.situacao === "rascunho");
        const semAviso = atencao.filter((x) => x.situacao === "em_conferencia");

        // Um item por assunto e lugar (texto ou exercício), só com a quantidade de avisos.
        const avisos = new Map<string, number>();
        for (const r of rel) {
          const chave = `${assunto(r.material_id)} · ${r.exercicio_id ? "exercício" : "texto"}`;
          avisos.set(chave, (avisos.get(chave) ?? 0) + 1);
        }
        const doExercicio = (x: { material_id: string; ordem: number; motivo: string | null }, motivo: boolean) =>
          `- ${assunto(x.material_id)} · exercício ${x.ordem}${motivo && x.motivo ? ` — ${x.motivo}` : ""}`;

        const secao = (titulo: string, linhas: string[]) => (linhas.length ? [titulo, ...linhas].join("\n") : "");
        const partes = [
          secao(`AVISOS DE ERRO ABERTOS (${rel.length}):`, rel.length ? [...[...avisos].map(([item, n]) => `- ${item} (${n} ${n === 1 ? "aviso" : "avisos"})`), "O texto dos avisos se lê no painel (/banco/estudos)."] : []),
          secao(`MATERIAIS RETIDOS (${mat.length}):`, mat.map((x) => `- ${assunto(x.id)} (${x.id})${x.motivo ? ` — ${x.motivo}` : ""}`)),
          secao(`EXERCÍCIOS RETIDOS (${retidos.length}):`, retidos.map((x) => doExercicio(x, true))),
          secao(`EXERCÍCIOS EM RASCUNHO NUM MATERIAL PUBLICADO, esperando reconferência (${rascunhos.length}):`, rascunhos.map((x) => doExercicio(x, false))),
          secao(`EXERCÍCIOS EM CONFERÊNCIA SEM AVISO ABERTO (${semAviso.length}):`, semAviso.map((x) => doExercicio(x, true))),
          secao(`FOTOS SEM APROVAÇÃO (${fts.length}):`, fts.map((f) => `- ${assunto(f.material_id)} — ${f.alt}${f.credito ? ` (${f.credito})` : ""}`)),
        ].filter(Boolean);
        return texto(partes.length ? partes.join("\n\n") : "Nada pendente no reestudo.");
      } catch (e) {
        return falha("listar os avisos do reestudo", e);
      }
    },
  );
}
