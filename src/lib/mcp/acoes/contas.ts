import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { limparNome } from "@/lib/contas/ligacao";
import {
  aplicarLigacoesPor, alunosSemContaDoGrupoPor, criarContasDaPlanilhaPor, criarContasPor, definirContaAtivaPor, editarContaPor, ligarContaPor,
  novaSenhaPor, previaContasDaPlanilhaPor, previaLigacoesPorNomePor, sugerirUsuarios, turmasDaContaPor,
} from "@/lib/contas/nucleo";
import { acharPorNome, campoEscola, campoTelefone, escolasDoPedido, lerPorIds, lerTodas, texto, type Ctx, type EscolaInfo, type ObterCtx } from "../leitura/comum";
import { atorDoEscopo, campoId, falha, registrado, resolverTurmas, type Perfil } from "./ator";
import {
  escolherConta, escolherTurma, escolherVinculo, exigirAluno, parametrosParaRegistro, textoCredenciais, textoPreviaLigacoes, textoPreviaPlanilha,
  validarUsuario, type ContaAchada, type TurmaLinha, type VinculoConta,
} from "./contas-regras";

/**
 * Ferramentas de contas de aluno da Hermes (só no perfil dono): criar contas, ligar à planilha,
 * bloquear, senha provisória, corrigir e mudar turmas. Chamam o núcleo de `src/lib/contas/nucleo.ts`
 * (o mesmo da tela) com o dono como ator na escola da conta ou da turma.
 */

export const ERRO_CONTA = "Conta não encontrada.";
// Só colunas seguras: nunca senha_hash, tokens nem código de convite.
const COLUNAS_CONTA = "id, escola_id, nome, usuario, email, ativo";
type ContaLida = { id: string; escola_id: string; nome: string; usuario: string | null; email: string | null; ativo: boolean };

type AtorHermes = Awaited<ReturnType<typeof atorDoEscopo>>;
/** Roda a ação do núcleo com registro; `extras` entram nos parâmetros do registro (ex.: ids resolvidos). */
export type Rodar = <T>(acao: () => Promise<T>, extras?: Record<string, unknown>) => Promise<T>;

export const campoAluno = {
  aluno: z.string().trim().max(120).optional().describe("Nome (ou parte) do aluno. Se houver mais de um, a resposta lista para escolher."),
  conta_id: campoId("Id da conta do aluno (use quando o nome se repetir).").optional(),
  ...campoEscola,
};
const campoTurma = {
  turma: z.string().trim().min(1).max(100).describe('Nome da turma, ex: "1º Ano A".'),
  ano_letivo: z.string().trim().max(10).optional().describe("Ano letivo. Padrão: o mais recente da turma."),
  ...campoEscola,
};

async function vinculosDasContas(ctx: Ctx, ids: string[]): Promise<Map<string, VinculoConta[]>> {
  const linhas = await lerPorIds<VinculoConta & { conta_id: string }>(ids, (bloco, de, ate) =>
    ctx.supabase.from("aluno_turmas").select("conta_id, escola_id, turma_nome, ano_letivo").in("conta_id", bloco).order("conta_id").order("turma_nome").range(de, ate));
  const porConta = new Map<string, VinculoConta[]>();
  for (const { conta_id, ...v } of linhas) porConta.set(conta_id, [...(porConta.get(conta_id) ?? []), v]);
  return porConta;
}

/** Vínculos (turmas) de uma conta. */
export async function vinculosDaConta(ctx: Ctx, contaId: string): Promise<VinculoConta[]> {
  return (await vinculosDasContas(ctx, [contaId])).get(contaId) ?? [];
}

/**
 * Acha a conta pelo `conta_id` ou pelo nome, nas escolas do pedido. Id de conta fora delas →
 * "Conta não encontrada." (sem confirmar que existe). Nome repetido → texto com as opções.
 */
export async function acharConta(ctx: Ctx, args: { aluno?: string; conta_id?: string; escola?: string }): Promise<{ conta: ContaAchada } | { mensagem: string }> {
  exigirAluno(args);
  const escolas = await escolasDoPedido(ctx, args.escola);
  const ids = escolas.map((e) => e.id);
  let contas: ContaLida[];
  if (args.conta_id) {
    const { data, error } = await ctx.supabase.from("alunos_contas").select(COLUNAS_CONTA).eq("id", args.conta_id).maybeSingle();
    if (error) throw new Error(error.message);
    const c = data as ContaLida | null;
    if (!c || !ids.includes(c.escola_id)) throw new Error(ERRO_CONTA);
    contas = [c];
  } else {
    const todas = await lerTodas<ContaLida>((de, ate) =>
      ctx.supabase.from("alunos_contas").select(COLUNAS_CONTA).in("escola_id", ids).order("nome").order("id").range(de, ate));
    contas = acharPorNome(todas, (c) => c.nome, args.aluno ?? "");
  }
  const vinculos = await vinculosDasContas(ctx, contas.map((c) => c.id));
  const nomeEscola = (id: string) => escolas.find((e) => e.id === id)?.nome ?? "?";
  const achadas: ContaAchada[] = contas.map((c) => ({
    id: c.id, nome: c.nome, escolaId: c.escola_id, escolaNome: nomeEscola(c.escola_id), usuario: c.usuario, email: c.email, ativo: c.ativo,
    turmas: (vinculos.get(c.id) ?? []).map((v) => `${v.turma_nome} · ${v.ano_letivo}`),
  }));
  return escolherConta(achadas, (args.aluno ?? args.conta_id ?? "").trim(), escolas.length > 1);
}

/** Turma pelo nome nas escolas do pedido (mesmo nome em duas escolas → pede a escola). */
async function acharTurma(ctx: Ctx, args: { turma: string; ano_letivo?: string; escola?: string }): Promise<{ turma: TurmaLinha; escola: EscolaInfo }> {
  const escolas = await escolasDoPedido(ctx, args.escola);
  const turmas = await lerTodas<TurmaLinha>((de, ate) =>
    ctx.supabase.from("turmas").select("id, escola_id, nome, ano_letivo").in("escola_id", escolas.map((e) => e.id)).order("nome").order("id").range(de, ate));
  const turma = escolherTurma(turmas, escolas, args.turma, args.ano_letivo);
  return { turma, escola: escolas.find((e) => e.id === turma.escola_id)! };
}

/** Um registro de `turmas` (qualquer bimestre) do grupo escola + nome + ano. */
async function turmaIdDoVinculo(ctx: Ctx, v: VinculoConta): Promise<string> {
  const { data, error } = await ctx.supabase.from("turmas").select("id").eq("escola_id", v.escola_id).eq("nome", v.turma_nome).eq("ano_letivo", v.ano_letivo).order("id").limit(1);
  if (error) throw new Error(error.message);
  const id = (data?.[0] as { id: string } | undefined)?.id;
  if (!id) throw new Error(`Turma ${v.turma_nome} · ${v.ano_letivo} não encontrada.`);
  return id;
}

const rotuloTurma = (t: TurmaLinha) => `${t.nome} · ${t.ano_letivo}`;

/**
 * Resolve a conta, monta o ator na escola dela e entrega `rodar` (registro com os parâmetros sem
 * telefone e com o `conta_id` resolvido). Nome repetido → devolve a lista sem agir.
 */
export function comConta<A extends { aluno?: string; conta_id?: string; escola?: string; professor_telefone?: string }>(
  obter: ObterCtx, perfil: Perfil, ferramenta: string, verbo: string,
  acao: (ctx: Ctx, ator: AtorHermes, conta: ContaAchada, args: A, rodar: Rodar) => Promise<string>,
) {
  return async (args: A) => {
    try {
      const ctx = await obter(args);
      const achada = await acharConta(ctx, args);
      if ("mensagem" in achada) return texto(achada.mensagem);
      const { conta } = achada;
      const ator = await atorDoEscopo(ctx, conta.escolaId, ERRO_CONTA);
      const rodar: Rodar = (fn, extras) => registrado(perfil, ator, ferramenta, { ...parametrosParaRegistro(args), conta_id: conta.id, ...extras }, fn);
      return texto(await acao(ctx, ator, conta, args, rodar));
    } catch (e) {
      return falha(verbo, e);
    }
  };
}

/** Resolve a turma, monta o ator na escola dela e entrega `rodar`. */
function comTurma<A extends { turma: string; ano_letivo?: string; escola?: string; professor_telefone?: string }>(
  obter: ObterCtx, perfil: Perfil, ferramenta: string, verbo: string,
  acao: (ctx: Ctx, ator: AtorHermes, turma: TurmaLinha, args: A, rodar: Rodar) => Promise<string>,
) {
  return async (args: A) => {
    try {
      const ctx = await obter(args);
      const { turma } = await acharTurma(ctx, args);
      const ator = await atorDoEscopo(ctx, turma.escola_id);
      const rodar: Rodar = (fn, extras) => registrado(perfil, ator, ferramenta, { ...parametrosParaRegistro(args), turma_id: turma.id, ...extras }, fn);
      return texto(await acao(ctx, ator, turma, args, rodar));
    } catch (e) {
      return falha(verbo, e);
    }
  };
}

const quem = (c: ContaAchada) => `${c.nome}${c.usuario ? ` (usuário ${c.usuario})` : c.email ? ` (e-mail ${c.email})` : ""}`;

export function registrarAcoesContas(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  server.registerTool(
    "criar_contas_aluno",
    {
      title: "Criar contas de aluno",
      description: "Cria contas de aluno (usuário sugerido pelo nome + senha provisória) numa turma. Não liga à planilha: para alunos da planilha, prefira criar_contas_da_planilha. Antes, resuma e peça confirmação. As senhas só vêm nesta resposta.",
      inputSchema: { ...campoTurma, nomes: z.array(z.string().trim().min(1).max(120)).min(1).max(100).describe("Nomes completos dos alunos."), ...campoTelefone },
    },
    comTurma(obter, perfil, "criar_contas_aluno", "criar as contas", async (_ctx, ator, turma, args, rodar) => {
      const nomes = args.nomes.map(limparNome);
      const usuarios = await sugerirUsuarios(nomes);
      const credenciais = await rodar(() => criarContasPor(ator, turma.id, nomes.map((nome, i) => ({ nome, usuario: usuarios[i] }))));
      return textoCredenciais(credenciais);
    }),
  );

  server.registerTool(
    "criar_contas_da_planilha",
    {
      title: "Criar contas da planilha",
      description: "Sem criar: mostra quais alunos da planilha da turma (bimestre vigente) ainda não têm conta. Com criar: true, cria as contas já ligadas à planilha (quem já tem conta é ignorado; quem tem conta sem ligação com o mesmo nome fica de fora). Antes de criar, resuma e peça confirmação. As senhas só vêm nesta resposta.",
      inputSchema: { ...campoTurma, criar: z.boolean().optional().describe("true = cria as contas. Sem ele, só mostra a prévia."), ...campoTelefone },
    },
    comTurma(obter, perfil, "criar_contas_da_planilha", "criar as contas da planilha", async (_ctx, ator, turma, args, rodar) => {
      const previa = await previaContasDaPlanilhaPor(ator, turma.id);
      if (!args.criar) return textoPreviaPlanilha(rotuloTurma(turma), previa);
      const linhas = previa.filter((l) => !l.possivelContaExistente).map((l) => ({ alunoId: l.alunoId, usuario: l.usuario }));
      const fora = previa.filter((l) => l.possivelContaExistente).map((l) => l.nome);
      if (linhas.length === 0) return textoPreviaPlanilha(rotuloTurma(turma), previa);
      const { credenciais, ignorados } = await rodar(() => criarContasDaPlanilhaPor(ator, turma.id, linhas));
      const partes = [textoCredenciais(credenciais, ignorados)];
      if (fora.length > 0) partes.push(`Ficaram de fora (já há conta sem ligação com o mesmo nome): ${fora.join(", ")}. Use ligar_contas_pelo_nome ou ligar_conta.`);
      return partes.join("\n");
    }),
  );

  server.registerTool(
    "ligar_contas_pelo_nome",
    {
      title: "Ligar contas à planilha pelo nome",
      description: "Sem aplicar: mostra quais contas da turma seriam ligadas aos alunos da planilha pelo nome (só nomes únicos dos dois lados; nome repetido = ligar à mão com ligar_conta). Com aplicar: true, grava as ligações (peça confirmação antes).",
      inputSchema: { ...campoTurma, aplicar: z.boolean().optional().describe("true = grava as ligações. Sem ele, só mostra a prévia."), ...campoTelefone },
    },
    comTurma(obter, perfil, "ligar_contas_pelo_nome", "ligar as contas pelo nome", async (_ctx, ator, turma, args, rodar) => {
      const previa = await previaLigacoesPorNomePor(ator, turma.id);
      if (!args.aplicar || previa.ligar.length === 0) return textoPreviaLigacoes(rotuloTurma(turma), previa, false);
      await rodar(() => aplicarLigacoesPor(ator, turma.id, previa.ligar.map(({ contaId, alunoId }) => ({ contaId, alunoId }))), { pares: previa.ligar.length });
      return textoPreviaLigacoes(rotuloTurma(turma), previa, true);
    }),
  );

  server.registerTool(
    "ligar_conta",
    {
      title: "Ligar conta a um aluno da planilha",
      description: "Liga, à mão, a conta do aluno a uma linha da planilha da turma (bimestre vigente), ou desliga com desligar: true. A turma só é necessária se a conta estiver em mais de uma.",
      inputSchema: {
        ...campoAluno,
        turma: z.string().trim().max(100).optional().describe("Turma da conta onde ligar. Padrão: a única turma da conta."),
        aluno_planilha: z.string().trim().max(120).optional().describe("Nome do aluno na planilha (entre os que ainda não têm conta)."),
        desligar: z.boolean().optional().describe("true = desfaz a ligação nesta turma."),
        ...campoTelefone,
      },
    },
    comConta(obter, perfil, "ligar_conta", "ligar a conta", async (ctx, ator, conta, args, rodar) => {
      const v = escolherVinculo(await vinculosDaConta(ctx, conta.id), args.turma);
      const turmaId = await turmaIdDoVinculo(ctx, v);
      const rotulo = `${v.turma_nome} · ${v.ano_letivo}`;
      if (args.desligar) {
        await rodar(() => ligarContaPor(ator, conta.id, turmaId, null), { turma_id: turmaId });
        return `Conta de ${conta.nome} desligada da planilha de ${rotulo}.`;
      }
      if (!args.aluno_planilha?.trim()) throw new Error("Informe aluno_planilha (o nome na planilha) ou desligar: true.");
      const livres = await alunosSemContaDoGrupoPor(ator, turmaId);
      const achados = acharPorNome(livres, (a) => a.nome, args.aluno_planilha);
      if (achados.length === 0) throw new Error(`"${args.aluno_planilha}" não está entre os alunos sem conta da planilha de ${rotulo}.`);
      if (achados.length > 1) throw new Error(`Mais de um aluno da planilha com "${args.aluno_planilha}": ${achados.slice(0, 20).map((a) => a.nome).join(", ")}. Diga o nome completo.`);
      const aluno = achados[0];
      await rodar(() => ligarContaPor(ator, conta.id, turmaId, aluno.alunoId), { turma_id: turmaId, aluno_id: aluno.alunoId });
      return `Conta de ${conta.nome} ligada a ${aluno.nome} na planilha de ${rotulo}.`;
    }),
  );

  for (const [nome, ativo] of [["bloquear_conta", false], ["desbloquear_conta", true]] as const) {
    server.registerTool(
      nome,
      {
        title: ativo ? "Desbloquear conta de aluno" : "Bloquear conta de aluno",
        description: ativo
          ? "Desbloqueia a conta: o aluno volta a conseguir entrar."
          : "Bloqueia a conta: o aluno não consegue mais entrar (os dados ficam). Antes, resuma e peça confirmação.",
        inputSchema: { ...campoAluno, ...campoTelefone },
      },
      comConta(obter, perfil, nome, ativo ? "desbloquear a conta" : "bloquear a conta", async (_ctx, ator, conta, _args, rodar) => {
        const antes = conta.ativo === ativo ? ` (já estava ${ativo ? "desbloqueada" : "bloqueada"})` : "";
        await rodar(() => definirContaAtivaPor(ator, conta.id, ativo));
        return ativo
          ? `Conta de ${quem(conta)} desbloqueada${antes}: o aluno já pode entrar.`
          : `Conta de ${quem(conta)} bloqueada${antes}: o aluno não consegue mais entrar.`;
      }),
    );
  }

  server.registerTool(
    "gerar_senha_provisoria",
    {
      title: "Gerar senha provisória",
      description: "Gera uma senha provisória nova para a conta do aluno (a antiga deixa de valer; o aluno troca no primeiro acesso). Antes, resuma e peça confirmação. A senha só vem nesta resposta: não repita em outras mensagens.",
      inputSchema: { ...campoAluno, ...campoTelefone },
    },
    comConta(obter, perfil, "gerar_senha_provisoria", "gerar a senha", async (_ctx, ator, conta, _args, rodar) => {
      const senha = await rodar(() => novaSenhaPor(ator, conta.id));
      const entra = conta.usuario ? `usuário ${conta.usuario}` : conta.email ? `e-mail ${conta.email}` : "o login dele";
      return `Nova senha provisória de ${conta.nome}: ${senha}\nEle entra com ${entra} e essa senha, e troca no primeiro acesso. Passe só ao aluno; não repita a senha em outras mensagens.`;
    }),
  );

  server.registerTool(
    "corrigir_conta",
    {
      title: "Corrigir nome ou usuário da conta",
      description: "Corrige o nome e/ou o usuário de login da conta do aluno (usuário: letras minúsculas, números e ponto; único).",
      inputSchema: {
        ...campoAluno,
        nome: z.string().trim().min(1).max(120).optional().describe("Nome novo."),
        usuario: z.string().trim().min(1).max(60).optional().describe("Usuário novo (minúsculas, números e ponto)."),
        ...campoTelefone,
      },
    },
    comConta(obter, perfil, "corrigir_conta", "corrigir a conta", async (_ctx, ator, conta, args, rodar) => {
      if (args.nome === undefined && args.usuario === undefined) throw new Error("Nada para alterar: informe o nome ou o usuário.");
      const campos = { nome: args.nome, usuario: args.usuario === undefined ? undefined : validarUsuario(args.usuario) };
      const r = await rodar(() => editarContaPor(ator, conta.id, campos));
      return `Conta corrigida: ${r.nome}${r.usuario ? ` · usuário ${r.usuario}` : ""}.`;
    }),
  );

  server.registerTool(
    "turmas_da_conta",
    {
      title: "Turmas da conta do aluno",
      description: "Sem incluir/remover: mostra as turmas da conta. Com incluir e/ou remover, muda as turmas (trocar de turma = remover uma e incluir outra). Remover desfaz a ligação com a planilha daquela turma.",
      inputSchema: {
        ...campoAluno,
        incluir: z.array(z.string().trim().min(1).max(100)).max(20).optional().describe("Nomes das turmas a incluir (vale o ano letivo mais recente)."),
        remover: z.array(z.string().trim().min(1).max(100)).max(20).optional().describe("Nomes das turmas da conta a remover."),
        ...campoTelefone,
      },
    },
    comConta(obter, perfil, "turmas_da_conta", "mudar as turmas da conta", async (ctx, ator, conta, args, rodar) => {
      const incluirNomes = args.incluir ?? [];
      const removerNomes = args.remover ?? [];
      if (incluirNomes.length === 0 && removerNomes.length === 0) return `${conta.nome} está em: ${conta.turmas.join(", ") || "nenhuma turma"}.`;
      const turmasEscola = await lerTodas<{ nome: string; ano_letivo: string }>((de, ate) =>
        ctx.supabase.from("turmas").select("nome, ano_letivo").eq("escola_id", conta.escolaId).order("nome").order("ano_letivo").range(de, ate));
      const incluir = incluirNomes.length ? resolverTurmas(incluirNomes, turmasEscola, null) : [];
      const vinculos = await vinculosDaConta(ctx, conta.id);
      const remover = removerNomes.map((n) => escolherVinculo(vinculos, n)).map((v) => ({ turma_nome: v.turma_nome, ano_letivo: v.ano_letivo }));
      const r = await rodar(() => turmasDaContaPor(ator, conta.id, { incluir, remover }));
      const partes = [`Turmas de ${conta.nome}:`];
      if (r.incluidas.length) partes.push(`incluída em ${r.incluidas.join(", ")}.`);
      if (r.removidas.length) partes.push(`removida de ${r.removidas.join(", ")}.`);
      if (!r.incluidas.length && !r.removidas.length) partes.push("nada mudou.");
      return [partes.join(" "), ...r.avisos].join("\n");
    }),
  );
}
