import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LIMITE_LOTE, nomeNormalizado, type ItemLote, type Recusa } from "@/lib/questoes/classificacao";
import {
  classificacaoDasQuestoes, classificarQuestoesPor, criarHabilidadePor, listarHabilidades, listarTopicos,
  proporTopicoPor, questoesParaClassificar,
} from "@/lib/questoes/classificacao-servidor";
import { AREAS, letrasVisiveis, MATERIAS } from "@/lib/questoes/materias";
import type { Ator } from "@/lib/questoes/regras";
import type { Area, Habilidade, Questao, Topico } from "@/lib/types";
import { campoTelefone, lerPorIds, texto, type Ctx, type ObterCtx } from "../leitura/comum";
import { materiaDoTexto } from "../leitura/banco";
import { atorDoEscopo, campoId, contaDoDono, falha, registrado, type Perfil } from "./ator";
import { assuntoDaMateria } from "./questoes";

/**
 * Classificação fina (tópico e habilidades) em lote, feita pelo próprio Claude, sem IA paga. Só no MCP do dono.
 * A validação é a da tela (`classificarQuestoesPor`); aqui só se lê, se resolve o que é novo e se escreve o resumo.
 */

const MAX_ENUNCIADO = 400;
const MAX_COMANDO = 200;
const MAX_ALTERNATIVA = 70;
const MAX_HABILIDADE = 160;

async function atualizarTelas() {
  try {
    (await import("next/cache")).revalidatePath("/banco", "layout");
  } catch {
    // Fora de um pedido do Next (ex.: testes) não há o que atualizar.
  }
}

/** Uma linha só, sem excesso de espaços, cortada em `max` caracteres. */
function resumir(s: string, max: number): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

const numero = (n: number) => n.toLocaleString("pt-BR");
/** Mesma ideia da unicidade do banco, mais folgada: sem acento, caixa nem espaços repetidos. */
const chaveNome = (s: string) => nomeNormalizado(s.replace(/\s+/g, " "));
const marca = (situacao: string) => (situacao === "proposto" ? " (proposto)" : "");

// ---------- questoes_para_classificar ----------

type Lista = {
  rotulo: string;
  total: number;
  classificadas: number;
  questoes: Questao[];
  soSemTopico: boolean;
  limite: number;
  assuntos: Map<string, string>;
  topicos: Topico[];
  habilidades: Habilidade[];
  atuais: Map<string, { topicoId: string | null; habilidadeIds: string[] }>;
};

function textoQuestoesParaClassificar(l: Lista): string {
  const topicoPorId = new Map(l.topicos.map((t) => [t.id, t]));
  const habilidadePorId = new Map(l.habilidades.map((h) => [h.id, h]));
  const nomeAssunto = (id: string | null) => (id && l.assuntos.get(id)) || "sem assunto";

  const blocos = l.questoes.map((q, n) => {
    const atual = l.atuais.get(q.id);
    const topico = atual?.topicoId ? topicoPorId.get(atual.topicoId) : undefined;
    const habilidades = (atual?.habilidadeIds ?? []).map((id) => `${id} — ${habilidadePorId.get(id)?.codigo ?? "sem código"}`);
    const alternativas = letrasVisiveis(q.alternativas ?? []).map((letra) => {
      const a = (q.alternativas ?? []).find((x) => x.letra === letra);
      return `${letra}) ${resumir(a?.texto ?? "", MAX_ALTERNATIVA) || "(sem texto)"}`;
    });
    return [
      `${n + 1}. Questão ${q.id}`,
      `Assunto: ${nomeAssunto(q.assunto_id)}`,
      `Enunciado: ${resumir(q.enunciado, MAX_ENUNCIADO) || "(sem enunciado)"}`,
      ...(q.comando?.trim() ? [`Comando: ${resumir(q.comando, MAX_COMANDO)}`] : []),
      ...alternativas,
      `Tópico atual: ${atual?.topicoId ? (topico ? `${topico.nome} (${topico.id})` : atual.topicoId) : "nenhum"}`,
      `Habilidades atuais: ${habilidades.length ? habilidades.join("; ") : "nenhuma"}`,
    ].join("\n");
  });

  const assuntoIds = [...new Set(l.questoes.map((q) => q.assunto_id).filter((a): a is string => !!a))];
  const porAssunto = assuntoIds.map((id) => {
    const lista = l.topicos.filter((t) => t.assunto_id === id);
    return [
      `${nomeAssunto(id)}:`,
      ...(lista.length ? lista.map((t) => `- ${t.id} — ${t.nome}${marca(t.situacao)}`) : ["- (nenhum tópico ainda; use topico_novo)"]),
    ].join("\n");
  });

  const areas = [...new Set(l.questoes.map((q) => q.area))];
  const porArea = areas.map((area) => {
    const lista = l.habilidades.filter((h) => h.area === area);
    return [
      `Área ${AREAS[area]}:`,
      ...(lista.length ? lista.map((h) => `- ${h.id} — ${h.codigo ?? "sem código"} — ${resumir(h.descricao, MAX_HABILIDADE)}${marca(h.situacao)}`) : ["- (nenhuma habilidade ainda; use habilidades_novas)"]),
    ].join("\n");
  });

  const semTopico = l.total - l.classificadas;
  const ultima = l.questoes[l.questoes.length - 1];
  return [
    `${l.rotulo}: ${numero(l.total)} questões com assunto, ${numero(l.classificadas)} já com tópico, ${numero(semTopico)} sem tópico. Mostrando ${l.questoes.length}${l.soSemTopico ? " (só as sem tópico)" : ""}.`,
    blocos.join("\n\n"),
    `TÓPICOS DOS ASSUNTOS (id — nome):\n${porAssunto.join("\n")}`,
    `HABILIDADES (id — código — descrição):\n${porArea.join("\n")}`,
    [
      "Para gravar, use classificar_questoes (até 50 itens): topico_id ou topico_novo e habilidade_ids ou habilidades_novas. Prefira os da lista; só crie novo quando nenhum servir.",
      l.questoes.length >= l.limite ? `Pode haver mais: para ver as seguintes, chame de novo${l.soSemTopico ? " (as já classificadas somem da lista)" : ` com depois_de: ${ultima.id}`}.` : "",
    ].filter(Boolean).join(" "),
  ].join("\n\n");
}

// ---------- classificar_questoes ----------

type EntradaItem = {
  questao_id: string;
  topico_id?: string;
  topico_novo?: string;
  habilidade_ids?: string[];
  habilidades_novas?: { codigo?: string; descricao: string }[];
};

type Preparo = { itens: ItemLote[]; recusados: Recusa[]; novos: string[] };

/**
 * Traduz os itens do pedido para o formato do núcleo: resolve `topico_novo` (proposto, no assunto da questão) e
 * `habilidades_novas` (propostas, na área da questão), reaproveitando o que já existe com o mesmo nome. Um item
 * que não dá para resolver é recusado, e os outros seguem.
 */
async function prepararItens(ctx: Ctx, ator: Ator, entrada: EntradaItem[]): Promise<Preparo> {
  const recusados: Recusa[] = [];
  const novos: string[] = [];
  const itens: ItemLote[] = [];

  const idsComNovo = entrada.filter((i) => i.topico_novo !== undefined || i.habilidades_novas?.length).map((i) => i.questao_id);
  const lidas = await lerPorIds<{ id: string; assunto_id: string | null; area: Area }>(idsComNovo, (bloco, de, ate) =>
    ctx.supabase.from("questoes").select("id, assunto_id, area").in("id", bloco).order("id").range(de, ate));
  const questoes = new Map(lidas.map((q) => [q.id, q]));

  const assuntosDosNovos = [...new Set(entrada.filter((i) => i.topico_novo !== undefined).map((i) => questoes.get(i.questao_id)?.assunto_id).filter((a): a is string => !!a))];
  const topicosQueJaExistiam = new Set((assuntosDosNovos.length ? await listarTopicos(assuntosDosNovos) : []).map((t) => t.id));
  const topicosResolvidos = new Map<string, Topico>();
  // Todas as habilidades (são poucas), lidas só quando um item precisa: para conferir os ids e achar as da área.
  let todasHabilidades: Habilidade[] | null = null;
  const habilidades = async () => (todasHabilidades ??= await listarHabilidades());

  for (const item of entrada) {
    const recusar = (motivo: string) => recusados.push({ questaoId: item.questao_id, motivo });
    const mexeTopico = item.topico_id !== undefined || item.topico_novo !== undefined;
    // Lista vazia é "nada": no modo trocar, não pode apagar as habilidades da questão.
    const mexeHabilidades = (item.habilidade_ids?.length ?? 0) > 0 || (item.habilidades_novas?.length ?? 0) > 0;
    if (!mexeTopico && !mexeHabilidades) {
      recusar("Informe tópico ou habilidades para esta questão (topico_id, topico_novo, habilidade_ids ou habilidades_novas).");
      continue;
    }
    if (item.topico_id !== undefined && item.topico_novo !== undefined) {
      recusar("Informe topico_id ou topico_novo, não os dois.");
      continue;
    }

    let topicoId = item.topico_id;
    const habilidadeIds = [...(item.habilidade_ids ?? [])];
    if (item.topico_novo !== undefined || item.habilidades_novas?.length) {
      const q = questoes.get(item.questao_id);
      if (!q) { recusar("Questão não encontrada."); continue; }
      if (item.topico_novo !== undefined && !q.assunto_id) {
        recusar("A questão está sem assunto; defina o assunto antes de dar um tópico.");
        continue;
      }
      try {
        // Item que o núcleo recusaria por habilidade_ids inválida não pode deixar proposto órfão: confere antes de criar.
        const todas = await habilidades();
        for (const id of habilidadeIds) {
          const h = todas.find((x) => x.id === id);
          const motivo = !h ? "Habilidade não encontrada." : h.area !== q.area ? "A habilidade é de outra área." : null;
          if (motivo) throw new Error(motivo);
        }
        for (const nova of item.habilidades_novas ?? []) {
          let h = todas.find((x) => x.area === q.area && chaveNome(x.descricao) === chaveNome(nova.descricao));
          if (!h) {
            h = await criarHabilidadePor(ator, q.area, nova.descricao, nova.codigo ?? null, "proposto");
            todas.push(h);
            novos.push(`habilidade "${h.descricao}" (${AREAS[q.area]})`);
          }
          habilidadeIds.push(h.id);
        }
        if (item.topico_novo !== undefined && q.assunto_id) {
          const chave = `${q.assunto_id}|${chaveNome(item.topico_novo)}`;
          let t = topicosResolvidos.get(chave);
          if (!t) {
            t = await proporTopicoPor(ator, q.assunto_id, item.topico_novo, "proposto");
            topicosResolvidos.set(chave, t);
            if (!topicosQueJaExistiam.has(t.id)) {
              topicosQueJaExistiam.add(t.id);
              novos.push(`tópico "${t.nome}"`);
            }
          }
          topicoId = t.id;
        }
      } catch (e) {
        recusar(e instanceof Error ? e.message : String(e));
        continue;
      }
    }
    itens.push({
      questaoId: item.questao_id,
      ...(topicoId !== undefined && { topicoId }),
      ...(mexeHabilidades && { habilidadeIds }),
    });
  }
  return { itens, recusados, novos };
}

function textoClassificadas(salvas: number, recusados: Recusa[], novos: string[]): string {
  return [
    `${numero(salvas)} ${salvas === 1 ? "classificada" : "classificadas"}.`,
    novos.length ? `Criados como proposto (o dono aprova em Classificação): ${novos.join("; ")}.` : "",
    recusados.length ? `${numero(recusados.length)} ${recusados.length === 1 ? "recusada" : "recusadas"}:\n${recusados.map((r) => `- ${r.questaoId}: ${r.motivo}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

// ---------- registro das ferramentas ----------

export function registrarAcoesClassificacao(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  server.registerTool(
    "questoes_para_classificar",
    {
      title: "Questões para classificar",
      description: "Lista questões do banco para você classificar em tópico e habilidades (só leitura; não grava nada). Informe a matéria e, se quiser, o assunto; por padrão só vêm as ainda sem tópico (so_sem_topico: true). Até 50 por chamada (limite). Cada questão traz id, assunto, início do enunciado (400 caracteres), comando, alternativas curtas e a classificação atual; no fim vêm os tópicos (id — nome) dos assuntos listados e as habilidades (id — código — descrição) da área. Depois grave com classificar_questoes. Com so_sem_topico: false, passe depois_de com o id da última para ver as seguintes.",
      inputSchema: {
        materia: z.string().trim().min(1).max(40).describe('Matéria pelo nome, ex: "Matemática".'),
        assunto: z.string().trim().max(120).optional().describe("Assunto pelo nome (opcional)."),
        so_sem_topico: z.boolean().default(true).describe("true (padrão): só as questões sem tópico. false: também as já classificadas."),
        limite: z.number().int().min(1).max(LIMITE_LOTE).default(20).describe(`Quantas questões trazer, de 1 a ${LIMITE_LOTE} (padrão 20).`),
        depois_de: campoId("Só as questões com id depois deste (para a página seguinte).").optional(),
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const dono = await contaDoDono(ctx);
        const ator = await atorDoEscopo(ctx, dono.escola_id);
        const materia = materiaDoTexto(args.materia);
        const assuntoId = args.assunto ? await assuntoDaMateria(ctx, args.assunto, materia) : undefined;
        const rotulo = (MATERIAS as Record<string, { rotulo: string }>)[materia]?.rotulo ?? materia;

        const { questoes, total, classificadas } = await questoesParaClassificar(ator, {
          materia, assuntoId, soSemTopico: args.so_sem_topico, limite: args.limite, depoisDe: args.depois_de,
        });
        if (questoes.length === 0) {
          return texto(`Nenhuma questão para classificar com esses filtros (${numero(total)} com assunto, ${numero(classificadas)} já com tópico).`);
        }

        const assuntoIds = [...new Set(questoes.map((q) => q.assunto_id).filter((a): a is string => !!a))];
        const areas = [...new Set(questoes.map((q) => q.area))];
        const [assuntos, topicos, habilidades, atuais] = await Promise.all([
          lerPorIds<{ id: string; nome: string }>(assuntoIds, (bloco, de, ate) =>
            ctx.supabase.from("assuntos").select("id, nome").in("id", bloco).order("id").range(de, ate)),
          listarTopicos(assuntoIds),
          Promise.all(areas.map((a) => listarHabilidades(a))).then((l) => l.flat()),
          classificacaoDasQuestoes(questoes.map((q) => q.id)),
        ]);

        return texto(textoQuestoesParaClassificar({
          rotulo: args.assunto ? `${rotulo} · ${assuntos.length === 1 ? assuntos[0].nome : args.assunto}` : rotulo,
          total, classificadas, questoes, soSemTopico: args.so_sem_topico, limite: args.limite,
          assuntos: new Map(assuntos.map((a) => [a.id, a.nome])), topicos, habilidades, atuais,
        }));
      } catch (e) {
        return falha("listar as questões para classificar", e);
      }
    },
  );

  server.registerTool(
    "classificar_questoes",
    {
      title: "Classificar questões",
      description: "Grava o tópico e as habilidades de até 50 questões por chamada, sem IA paga. Para cada questão: topico_id (da lista de questoes_para_classificar; tem de ser do assunto da questão) ou topico_novo (nome; cria como proposto no assunto da questão, ou usa o que já existe com esse nome); habilidade_ids (da área da questão) e/ou habilidades_novas ({codigo?, descricao}; cria como proposta na área da questão, ou usa a que já existe com essa descrição). Prefira sempre os da lista; só crie novo quando nenhum servir. O tópico enviado sempre substitui o atual. modo \"trocar\" (padrão) substitui as habilidades atuais pelas enviadas; \"adicionar\" mantém as atuais e soma as novas. Não muda o status da questão. Item inválido é recusado com o motivo e os outros gravam. Os propostos ficam esperando o dono aprovar em Classificação.",
      inputSchema: {
        itens: z.array(z.object({
          questao_id: campoId("Id da questão."),
          topico_id: campoId("Id de um tópico do assunto da questão (veja em questoes_para_classificar).").optional(),
          topico_novo: z.string().trim().min(1).max(120).optional().describe("Nome de um tópico novo no assunto da questão; use só se nenhum da lista servir."),
          habilidade_ids: z.array(campoId("Id de uma habilidade da área da questão.")).max(10).optional().describe("Ids de habilidades da área da questão (até 10). Lista vazia = não mexe nas habilidades."),
          habilidades_novas: z.array(z.object({
            codigo: z.string().trim().max(20).optional().describe("Código, ex.: H5 (opcional)."),
            descricao: z.string().trim().min(1).max(500).describe("Descrição da habilidade."),
          })).max(10).optional().describe("Habilidades novas na área da questão; use só se nenhuma da lista servir."),
        })).min(1).max(LIMITE_LOTE).describe(`De 1 a ${LIMITE_LOTE} itens, um por questão.`),
        modo: z.enum(["adicionar", "trocar"]).default("trocar").describe('"trocar" (padrão) substitui as habilidades atuais; "adicionar" mantém.'),
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const dono = await contaDoDono(ctx);
        const ator = await atorDoEscopo(ctx, dono.escola_id);

        const resposta = await registrado(
          perfil, ator, "classificar_questoes",
          { modo: args.modo, quantidade: args.itens.length },
          async () => {
            const preparo = await prepararItens(ctx, ator, args.itens);
            const r = preparo.itens.length > 0
              ? await classificarQuestoesPor(ator, preparo.itens, args.modo)
              : { salvas: 0, recusados: [] as Recusa[] };
            if (r.salvas > 0) await atualizarTelas();
            const ordem = new Map(args.itens.map((i, n) => [i.questao_id, n]));
            const recusados = [...preparo.recusados, ...r.recusados].sort((a, b) => (ordem.get(a.questaoId) ?? 0) - (ordem.get(b.questaoId) ?? 0));
            return textoClassificadas(r.salvas, recusados, preparo.novos);
          },
        );
        return texto(resposta);
      } catch (e) {
        return falha("classificar as questões", e);
      }
    },
  );
}
