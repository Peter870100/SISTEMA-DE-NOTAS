import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { normalizarBusca } from "@/lib/hermes/relatorios";
import { AREAS, MATERIAS } from "@/lib/questoes/materias";
import type { DadosSimulado, TurmaSimulado } from "@/lib/simulados/configuracao";
import {
  adicionarQuestaoPor, criarSimuladoPor, excluirSimuladoPor, liberarCorrecaoPor, ordenarQuestoesPor, publicarSimuladoPor,
  removerQuestaoPor, salvarSimuladoPor, sortearQuestoesPor, trocarQuestaoPor,
} from "@/lib/simulados/nucleo";
import type { FiltrosSorteio } from "@/lib/simulados/servidor";
import type { Area } from "@/lib/types";
import { materiaDoTexto } from "../leitura/banco";
import { acharPorNome, campoEscola, campoTelefone, dataHoraBR, lerTodas, texto, type Ctx, type ObterCtx } from "../leitura/comum";
import { atorDoEscopo, campoId, ERRO_SIMULADO, escolaParaCriar, falha, paraIsoSaoPaulo, registrado, resolverTurmas, type Perfil } from "./ator";

type SimuladoAtual = {
  id: string; escola_id: string; tipo: string; titulo: string; duracao_min: number | null; abre_em: string | null; fecha_em: string | null;
  correcao: "na_hora" | "apos_prazo"; embaralhar: boolean; status: string;
};

/** O simulado (só colunas de configuração) e as turmas ligadas. Treinos de aluno não entram. */
async function lerSimulado(ctx: Ctx, id: string): Promise<{ sim: SimuladoAtual; turmas: TurmaSimulado[] }> {
  const { data, error } = await ctx.supabase.from("simulados")
    .select("id, escola_id, tipo, titulo, duracao_min, abre_em, fecha_em, correcao, embaralhar, status").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  const sim = data as SimuladoAtual | null;
  if (!sim || sim.tipo !== "professor") throw new Error(ERRO_SIMULADO);
  const { data: turmas, error: e2 } = await ctx.supabase.from("simulado_turmas").select("turma_nome, ano_letivo").eq("simulado_id", id);
  if (e2) throw new Error(e2.message);
  return { sim, turmas: (turmas ?? []) as TurmaSimulado[] };
}

async function turmasDaEscola(ctx: Ctx, escolaId: string) {
  return lerTodas<{ nome: string; ano_letivo: string }>((de, ate) =>
    ctx.supabase.from("turmas").select("nome, ano_letivo").eq("escola_id", escolaId).order("nome").order("ano_letivo").range(de, ate));
}

const nomesTurmas = (ts: TurmaSimulado[]) => ts.map((t) => `${t.turma_nome} · ${t.ano_letivo}`).join(", ") || "nenhuma";

const ROTULO_AREA = AREAS as Record<string, string>;
function areaDoTexto(t: string): Area {
  const alvo = normalizarBusca(t);
  const chave = Object.keys(AREAS).find((k) => k === alvo || normalizarBusca(ROTULO_AREA[k]) === alvo || normalizarBusca(ROTULO_AREA[k]).endsWith(alvo));
  if (!chave) throw new Error(`Área "${t}" não existe. Use: ${Object.values(AREAS).join(", ")}.`);
  return chave as Area;
}

/** Assunto pelo nome (dentro da matéria, se informada). Devolve o id e a matéria do assunto. */
async function assuntoDoTexto(ctx: Ctx, nome: string, materia?: string): Promise<{ id: string; materia: string }> {
  let q = ctx.supabase.from("assuntos").select("id, nome, materia");
  if (materia) q = q.eq("materia", materia);
  const { data, error } = await q.order("nome").limit(1000);
  if (error) throw new Error(error.message);
  const lista = (data ?? []) as { id: string; nome: string; materia: string }[];
  const achados = acharPorNome(lista, (a) => a.nome, nome);
  const rotulo = (m: string) => (MATERIAS as Record<string, { rotulo: string }>)[m]?.rotulo ?? m;
  if (achados.length === 0) throw new Error(`Assunto "${nome}" não encontrado${materia ? ` em ${rotulo(materia)}` : ""}.`);
  if (achados.length > 1) throw new Error(`Mais de um assunto com "${nome}": ${achados.slice(0, 15).map((a) => `${a.nome} (${rotulo(a.materia)})`).join(", ")}. Seja mais específico${materia ? "" : " ou informe a matéria"}.`);
  return achados[0];
}

const camposFiltro = {
  banca: z.string().trim().max(60).optional().describe('Banca, ex: "ENEM" (sem diferenciar maiúsculas).'),
  ano_de: z.number().int().min(1900).max(2100).optional(),
  ano_ate: z.number().int().min(1900).max(2100).optional(),
  area: z.string().trim().max(40).optional().describe('Área: "Linguagens", "Ciências Humanas", "Ciências da Natureza" ou "Matemática".'),
  materia: z.string().trim().max(40).optional().describe('Matéria pelo nome, ex: "Química".'),
  assunto: z.string().trim().max(120).optional().describe("Assunto pelo nome (de preferência junto com a matéria)."),
  permitir_repetidas: z.boolean().optional().describe("true = aceita questões já aplicadas em simulados publicados destas turmas. Padrão: não repetir."),
};
type ArgsFiltro = { banca?: string; ano_de?: number; ano_ate?: number; area?: string; materia?: string; assunto?: string };

async function filtrosDe(ctx: Ctx, a: ArgsFiltro): Promise<FiltrosSorteio> {
  const f: FiltrosSorteio = { banca: a.banca || undefined, anoDe: a.ano_de, anoAte: a.ano_ate };
  if (a.area) f.area = areaDoTexto(a.area);
  if (a.materia) f.materia = materiaDoTexto(a.materia);
  if (a.assunto) {
    const assunto = await assuntoDoTexto(ctx, a.assunto, f.materia);
    f.assunto_id = assunto.id;
    f.materia ??= assunto.materia;
  }
  return f;
}

const camposConfig = {
  titulo: z.string().trim().min(1).max(160),
  turmas: z.array(z.string().trim().min(1).max(100)).min(1).max(50).describe("Nomes das turmas da escola, ex: [\"1ª série A\"]. Vale o ano letivo mais recente de cada uma."),
  duracao_min: z.number().int().min(1).max(600).describe("Duração da prova em minutos (1 a 600)."),
  abre_em: z.string().trim().min(10).max(40).describe('Abertura: "dd/mm/aaaa hh:mm" (horário de Brasília) ou ISO.'),
  fecha_em: z.string().trim().min(10).max(40).describe('Fechamento: "dd/mm/aaaa hh:mm" (horário de Brasília) ou ISO.'),
  correcao: z.enum(["na_hora", "apos_prazo"]).describe("na_hora = aluno vê a correção ao entregar; apos_prazo = só depois do fechamento."),
  embaralhar: z.boolean().describe("Embaralhar a ordem das questões para cada aluno."),
};

const campoSimulado = { simulado_id: campoId("Id do simulado (veja em listar_simulados ou na resposta de criar_simulado).") };
const campoQuestao = { questao_id: campoId("Id da questão (veja em buscar_questoes).") };

type AtorEscolaHermes = Awaited<ReturnType<typeof atorDoEscopo>>;
type Rodar = <T>(acao: () => Promise<T>) => Promise<T>;

/** Lê o simulado, monta o ator na escola dele e entrega `rodar` (ação do núcleo com registro). */
function comSimulado<A extends { simulado_id: string; professor_telefone?: string }>(
  obter: ObterCtx, perfil: Perfil, ferramenta: string, verbo: string,
  acao: (ctx: Ctx, ator: AtorEscolaHermes, atual: Awaited<ReturnType<typeof lerSimulado>>, args: A, rodar: Rodar) => Promise<string>,
) {
  return async (args: A) => {
    try {
      const ctx = await obter(args);
      const atual = await lerSimulado(ctx, args.simulado_id);
      // Simulado de outra escola: mesma mensagem da tela, sem confirmar que o id existe
      const ator = await atorDoEscopo(ctx, atual.sim.escola_id, ERRO_SIMULADO);
      const rodar: Rodar = (fn) => registrado(perfil, ator, ferramenta, args, fn);
      return texto(await acao(ctx, ator, atual, args, rodar));
    } catch (e) {
      return falha(verbo, e);
    }
  };
}

export function registrarAcoesSimulados(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  server.registerTool(
    "criar_simulado",
    {
      title: "Criar simulado",
      description: "Cria um simulado (rascunho) para turmas da escola. Depois use sortear_questoes ou adicionar_questao e, por fim, publicar_simulado. Antes de criar, resuma e peça confirmação.",
      inputSchema: {
        ...campoEscola,
        ...camposConfig,
        correcao: camposConfig.correcao.optional().describe("Padrão: apos_prazo."),
        embaralhar: camposConfig.embaralhar.optional().describe("Padrão: true."),
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const escola = await escolaParaCriar(ctx, args.escola);
        const ator = await atorDoEscopo(ctx, escola.id);
        const turmas = resolverTurmas(args.turmas, await turmasDaEscola(ctx, escola.id), ator.turmas);
        const d: DadosSimulado = {
          titulo: args.titulo, turmas, duracaoMin: args.duracao_min, abreEm: paraIsoSaoPaulo(args.abre_em), fechaEm: paraIsoSaoPaulo(args.fecha_em),
          correcao: args.correcao ?? "apos_prazo", embaralhar: args.embaralhar ?? true,
        };
        const id = await registrado(perfil, ator, "criar_simulado", args, () => criarSimuladoPor(ator, d));
        return texto(`Simulado criado como rascunho na escola ${escola.nome}. Id: ${id}. Turmas: ${nomesTurmas(turmas)}. Abre ${dataHoraBR(d.abreEm)}, fecha ${dataHoraBR(d.fechaEm)}, ${d.duracaoMin} min. Próximo passo: sortear_questoes e depois publicar_simulado.`);
      } catch (e) {
        return falha("criar o simulado", e);
      }
    },
  );

  server.registerTool(
    "configurar_simulado",
    {
      title: "Configurar simulado",
      description: "Altera título, turmas, duração, abertura, fechamento, correção ou embaralhar de um simulado. Só os campos enviados mudam. Depois que alunos começaram, só dá para mudar título, correção, fechamento e acrescentar turmas.",
      inputSchema: {
        ...campoSimulado,
        titulo: camposConfig.titulo.optional(),
        turmas: camposConfig.turmas.optional().describe("Lista COMPLETA de turmas (substitui a atual)."),
        duracao_min: camposConfig.duracao_min.optional(),
        abre_em: camposConfig.abre_em.optional(),
        fecha_em: camposConfig.fecha_em.optional(),
        correcao: camposConfig.correcao.optional(),
        embaralhar: camposConfig.embaralhar.optional(),
        ...campoTelefone,
      },
    },
    comSimulado(obter, perfil, "configurar_simulado", "configurar o simulado", async (ctx, ator, { sim, turmas: atuais }, args, rodar) => {
      const turmas = args.turmas ? resolverTurmas(args.turmas, await turmasDaEscola(ctx, sim.escola_id), ator.turmas) : atuais;
      const abre = args.abre_em ? paraIsoSaoPaulo(args.abre_em) : sim.abre_em;
      const fecha = args.fecha_em ? paraIsoSaoPaulo(args.fecha_em) : sim.fecha_em;
      if (!abre || !fecha) throw new Error("Informe abertura e fechamento.");
      const d: DadosSimulado = {
        titulo: args.titulo ?? sim.titulo, turmas, duracaoMin: args.duracao_min ?? sim.duracao_min ?? NaN, abreEm: abre, fechaEm: fecha,
        correcao: args.correcao ?? sim.correcao, embaralhar: args.embaralhar ?? sim.embaralhar,
      };
      await rodar(() => salvarSimuladoPor(ator, sim.id, d));
      return `Simulado ${sim.id} atualizado: "${d.titulo.trim()}", turmas ${nomesTurmas(turmas)}, abre ${dataHoraBR(abre)}, fecha ${dataHoraBR(fecha)}, ${Math.round(d.duracaoMin)} min, correção ${d.correcao === "na_hora" ? "na hora" : "após o prazo"}${d.embaralhar ? ", questões embaralhadas" : ""}.`;
    }),
  );

  server.registerTool(
    "sortear_questoes",
    {
      title: "Sortear questões para o simulado",
      description: "Sorteia questões publicadas do banco (geral + da escola) e acrescenta ao simulado. Por padrão não repete questões já aplicadas em simulados publicados das mesmas turmas.",
      inputSchema: { ...campoSimulado, quantidade: z.number().int().min(1).max(200).describe("Quantas questões (1 a 200)."), ...camposFiltro, ...campoTelefone },
    },
    comSimulado(obter, perfil, "sortear_questoes", "sortear as questões", async (ctx, ator, { sim }, args, rodar) => {
      const filtros = await filtrosDe(ctx, args);
      const naoRepetir = !args.permitir_repetidas;
      const r = await rodar(() => sortearQuestoesPor(ator, sim.id, { ...filtros, quantidade: args.quantidade, naoRepetir }));
      const partes = [`${r.adicionadas} de ${r.pedidas} questões sorteadas para o simulado ${sim.id}.`];
      if (r.adicionadas < r.pedidas) partes.push("Não havia mais questões com esses filtros.");
      if (naoRepetir) {
        partes.push(r.semTurmas
          ? "O simulado ainda não tem turmas, então nenhuma questão foi excluída como repetida."
          : r.puladas === 0 ? "Nenhuma questão precisou ser pulada como repetida." : `${r.puladas} ${r.puladas === 1 ? "questão pulada" : "questões puladas"} por já ter${r.puladas === 1 ? "" : "em"} sido aplicada${r.puladas === 1 ? "" : "s"} a estas turmas.`);
      }
      return partes.join(" ");
    }),
  );

  server.registerTool(
    "adicionar_questao",
    { title: "Adicionar questão ao simulado", description: "Acrescenta uma questão publicada (pelo id) ao fim do simulado.", inputSchema: { ...campoSimulado, ...campoQuestao, ...campoTelefone } },
    comSimulado(obter, perfil, "adicionar_questao", "adicionar a questão", async (_ctx, ator, { sim }, args, rodar) => {
      await rodar(() => adicionarQuestaoPor(ator, sim.id, args.questao_id));
      return `Questão ${args.questao_id} está no simulado ${sim.id}.`;
    }),
  );

  server.registerTool(
    "remover_questao",
    { title: "Remover questão do simulado", description: "Tira uma questão do simulado (a questão continua no banco).", inputSchema: { ...campoSimulado, ...campoQuestao, ...campoTelefone } },
    comSimulado(obter, perfil, "remover_questao", "remover a questão", async (_ctx, ator, { sim }, args, rodar) => {
      await rodar(() => removerQuestaoPor(ator, sim.id, args.questao_id));
      return `Questão ${args.questao_id} retirada do simulado ${sim.id}.`;
    }),
  );

  server.registerTool(
    "trocar_questao",
    {
      title: "Trocar questão do simulado",
      description: "Troca uma questão do simulado por outra sorteada com os filtros dados (mesma posição).",
      inputSchema: { ...campoSimulado, ...campoQuestao, ...camposFiltro, ...campoTelefone },
    },
    comSimulado(obter, perfil, "trocar_questao", "trocar a questão", async (ctx, ator, { sim }, args, rodar) => {
      const filtros = await filtrosDe(ctx, args);
      const trocou = await rodar(() => trocarQuestaoPor(ator, sim.id, args.questao_id, { ...filtros, naoRepetir: !args.permitir_repetidas }));
      return trocou
        ? `Questão ${args.questao_id} trocada por outra no simulado ${sim.id}.`
        : `Não há outra questão disponível com esses filtros; a questão ${args.questao_id} continua no simulado.`;
    }),
  );

  server.registerTool(
    "ordenar_questoes",
    {
      title: "Ordenar questões do simulado",
      description: "Define a ordem das questões. `ordem` precisa ter exatamente os ids das questões do simulado, cada um uma vez.",
      inputSchema: { ...campoSimulado, ordem: z.array(campoId("Id da questão")).max(200), ...campoTelefone },
    },
    comSimulado(obter, perfil, "ordenar_questoes", "ordenar as questões", async (_ctx, ator, { sim }, args, rodar) => {
      await rodar(() => ordenarQuestoesPor(ator, sim.id, args.ordem));
      return `Ordem das ${args.ordem.length} questões do simulado ${sim.id} atualizada.`;
    }),
  );

  server.registerTool(
    "publicar_simulado",
    { title: "Publicar simulado", description: "Publica o simulado para as turmas (os alunos passam a vê-lo na abertura). Antes, resuma e peça confirmação.", inputSchema: { ...campoSimulado, ...campoTelefone } },
    comSimulado(obter, perfil, "publicar_simulado", "publicar o simulado", async (_ctx, ator, { sim }, args, rodar) => {
      await rodar(() => publicarSimuladoPor(ator, sim.id));
      return `Simulado "${sim.titulo}" (${sim.id}) publicado.`;
    }),
  );

  server.registerTool(
    "liberar_correcao",
    { title: "Liberar correção", description: "Libera a correção do simulado para os alunos agora (correção passa a 'na hora'). Antes, resuma e peça confirmação.", inputSchema: { ...campoSimulado, ...campoTelefone } },
    comSimulado(obter, perfil, "liberar_correcao", "liberar a correção", async (_ctx, ator, { sim }, args, rodar) => {
      await rodar(() => liberarCorrecaoPor(ator, sim.id));
      return `Correção do simulado "${sim.titulo}" (${sim.id}) liberada para os alunos.`;
    }),
  );

  server.registerTool(
    "mandar_simulado_para_lixeira",
    { title: "Mandar simulado para a Lixeira", description: "Manda o simulado (com questões ligadas e tentativas) para a Lixeira; dá para restaurar. Antes, resuma e peça confirmação.", inputSchema: { ...campoSimulado, ...campoTelefone } },
    comSimulado(obter, perfil, "mandar_simulado_para_lixeira", "mandar o simulado para a Lixeira", async (_ctx, ator, { sim }, args, rodar) => {
      const lixeiraId = await rodar(() => excluirSimuladoPor(ator, sim.id));
      return `Simulado "${sim.titulo}" foi para a Lixeira (item ${lixeiraId}). Dá para restaurar pela Lixeira.`;
    }),
  );
}
