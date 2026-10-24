import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configurarProfessorPor, ERRO_PROFESSOR, senhaProvisoriaProfessorPor, telefoneProfessorPor } from "@/lib/professores/nucleo";
import { acharProfessores, escolherProfessor, podeAlterarProfessor, textoAcesso, turmasDoAcesso, type ProfessorAchado } from "@/lib/professores/regras";
import type { ProfessorRole } from "@/lib/types";
import { campoEscola, campoTelefone, escolasDoPedido, lerTodas, texto, type Ctx, type ObterCtx } from "../leitura/comum";
import { atorDoEscopo, campoId, falha, registrado, resolverTurmas, type Perfil } from "./ator";
import type { Rodar } from "./contas";
import { parametrosParaRegistro } from "./contas-regras";

/**
 * Ferramentas de professores da Hermes (só no perfil dono): papel, acesso às turmas, telefone e senha
 * provisória. Chamam o núcleo de `src/lib/professores/nucleo.ts` (o mesmo da tela) com o dono como
 * ator na escola do professor. A conta do dono nunca é alterada; criar e excluir ficam na tela.
 */

// Só colunas seguras: nunca senha_hash nem tokens.
type ProfessorLido = { id: string; nome: string; email: string; role: ProfessorRole; escola_id: string; acesso_restrito: boolean };
type AtorHermes = Awaited<ReturnType<typeof atorDoEscopo>>;

const campoProfessor = {
  professor: z.string().trim().max(120).optional().describe("Nome completo do professor. Nome parcial ou repetido não age: a resposta lista para escolher e você repete com o professor_id."),
  professor_id: campoId("Id do professor (use quando o nome se repetir).").optional(),
  ...campoEscola,
};

/** Acha o professor pelo id ou pelo nome nas escolas do pedido (id de outra escola → "Professor não encontrado."). */
async function acharProfessor(ctx: Ctx, args: { professor?: string; professor_id?: string; escola?: string }): Promise<{ professor: ProfessorAchado & { acessoRestrito: boolean } } | { mensagem: string }> {
  if (!args.professor?.trim() && !args.professor_id) throw new Error("Informe o professor (nome) ou o professor_id.");
  const escolas = await escolasDoPedido(ctx, args.escola);
  const ids = escolas.map((e) => e.id);
  const colunas = "id, nome, email, role, escola_id, acesso_restrito";
  let lidos: ProfessorLido[];
  if (args.professor_id) {
    const { data, error } = await ctx.supabase.from("professores").select(colunas).eq("id", args.professor_id).maybeSingle();
    if (error) throw new Error(error.message);
    const p = data as ProfessorLido | null;
    if (!p || !ids.includes(p.escola_id)) throw new Error(ERRO_PROFESSOR);
    lidos = [p];
  } else {
    const todos = await lerTodas<ProfessorLido>((de, ate) =>
      ctx.supabase.from("professores").select(colunas).in("escola_id", ids).order("nome").order("id").range(de, ate));
    lidos = acharProfessores(todos, args.professor ?? "");
  }
  const nomeEscola = (id: string) => escolas.find((e) => e.id === id)?.nome ?? "?";
  const achados = lidos.map((p) => ({ id: p.id, nome: p.nome, email: p.email, role: p.role, escolaId: p.escola_id, escolaNome: nomeEscola(p.escola_id), acessoRestrito: p.acesso_restrito }));
  const porId = !!args.professor_id;
  return escolherProfessor(achados, (porId ? args.professor_id! : args.professor ?? "").trim(), escolas.length > 1, porId);
}

/** Turmas liberadas hoje para o professor. */
async function turmasLiberadas(ctx: Ctx, professorId: string): Promise<string[]> {
  const linhas = await lerTodas<{ turma_nome: string }>((de, ate) =>
    ctx.supabase.from("professor_turma_acesso").select("turma_nome").eq("professor_id", professorId).order("turma_nome").range(de, ate));
  return linhas.map((l) => l.turma_nome);
}

/**
 * Resolve o professor, recusa a conta do dono antes de qualquer coisa, monta o ator na escola dele e
 * entrega `rodar` (registro sem telefone nem senha, com o `professor_id` resolvido).
 */
function comProfessor<A extends { professor?: string; professor_id?: string; escola?: string; professor_telefone?: string }>(
  obter: ObterCtx, perfil: Perfil, ferramenta: string, verbo: string,
  acao: (ctx: Ctx, ator: AtorHermes, professor: ProfessorAchado & { acessoRestrito: boolean }, args: A, rodar: Rodar) => Promise<string>,
) {
  return async (args: A) => {
    try {
      const ctx = await obter(args);
      const achado = await acharProfessor(ctx, args);
      if ("mensagem" in achado) return texto(achado.mensagem);
      const { professor } = achado;
      const recusa = podeAlterarProfessor(professor.role);
      if (recusa) throw new Error(recusa);
      const ator = await atorDoEscopo(ctx, professor.escolaId, ERRO_PROFESSOR);
      const rodar: Rodar = (fn, extras) => registrado(perfil, ator, ferramenta, { ...parametrosParaRegistro(args), professor_id: professor.id, ...extras }, fn);
      return texto(await acao(ctx, ator, professor, args, rodar));
    } catch (e) {
      return falha(verbo, e);
    }
  };
}

export function registrarAcoesProfessores(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  server.registerTool(
    "configurar_professor",
    {
      title: "Configurar professor (papel e acesso)",
      description: 'Sem papel nem acesso: mostra o papel e as turmas do professor. Com papel (admin ou professor) e/ou acesso ("todas", ou "restrito" com a lista de turmas, que substitui a atual), altera. Admin vê todas as turmas. A conta do dono não pode ser alterada. Antes de alterar, resuma e peça confirmação.',
      inputSchema: {
        ...campoProfessor,
        papel: z.string().trim().max(20).optional().describe('Papel novo: "admin" ou "professor".'),
        acesso: z.enum(["todas", "restrito"]).optional().describe('"todas" = todas as turmas da escola; "restrito" = só as turmas informadas.'),
        turmas: z.array(z.string().trim().min(1).max(100)).max(50).optional().describe('Nomes das turmas liberadas (com acesso: "restrito").'),
        ...campoTelefone,
      },
    },
    comProfessor(obter, perfil, "configurar_professor", "configurar o professor", async (ctx, ator, prof, args, rodar) => {
      const papel = args.papel ? (args.papel.toLowerCase() as ProfessorRole) : undefined;
      const recusa = podeAlterarProfessor(prof.role, papel);
      if (recusa) throw new Error(recusa);
      const acesso = turmasDoAcesso(args.acesso, args.turmas);
      if (papel === undefined && acesso === null) {
        return `${prof.nome} (${prof.escolaNome}): papel ${prof.role}; acesso: ${textoAcesso(prof.role, prof.acessoRestrito, await turmasLiberadas(ctx, prof.id))}.`;
      }
      let nomes: string[] = [];
      if (acesso?.restrito) {
        const turmasEscola = await lerTodas<{ nome: string; ano_letivo: string }>((de, ate) =>
          ctx.supabase.from("turmas").select("nome, ano_letivo").eq("escola_id", prof.escolaId).order("nome").order("ano_letivo").range(de, ate));
        nomes = [...new Set(resolverTurmas(acesso.turmas, turmasEscola, null, { exato: true }).map((t) => t.turma_nome))];
      }
      await rodar(() => configurarProfessorPor(ator, prof.id, { papel, restrito: acesso?.restrito, turmas: nomes }));
      const papelFinal = papel ?? prof.role;
      const restritoFinal = acesso ? acesso.restrito : prof.acessoRestrito;
      const turmasFinais = acesso ? nomes : await turmasLiberadas(ctx, prof.id);
      const partes = [`${prof.nome} (${prof.escolaNome}) atualizado: papel ${papelFinal}; acesso: ${textoAcesso(papelFinal, restritoFinal, turmasFinais)}.`];
      if (papelFinal === "admin" && restritoFinal) partes.push("Como admin, ele vê todas as turmas; a lista restrita fica guardada para se voltar a professor.");
      return partes.join("\n");
    }),
  );

  server.registerTool(
    "telefone_professor",
    {
      title: "Telefone do professor",
      description: "Atualiza o telefone que identifica o professor no Telegram (vazio = remove). Grave no mesmo formato que chega em professor_telefone. Um telefone já usado por outro professor é recusado. A conta do dono não pode ser alterada. Antes, resuma e peça confirmação.",
      inputSchema: {
        ...campoProfessor,
        telefone: z.string().max(30).describe("Telefone novo (vazio remove)."),
        ...campoTelefone,
      },
    },
    comProfessor(obter, perfil, "telefone_professor", "atualizar o telefone", async (_ctx, ator, prof, args, rodar) => {
      const gravado = await rodar(() => telefoneProfessorPor(ator, prof.id, args.telefone));
      return gravado ? `Telefone de ${prof.nome} (${prof.escolaNome}) atualizado para ${gravado}.` : `Telefone de ${prof.nome} (${prof.escolaNome}) removido.`;
    }),
  );

  server.registerTool(
    "senha_provisoria_professor",
    {
      title: "Senha provisória do professor",
      description: "Gera uma senha provisória nova para o professor (a antiga deixa de valer; ele troca no próximo login). A conta do dono não pode ser alterada. Antes, resuma e peça confirmação. A senha só vem nesta resposta: não repita em outras mensagens.",
      inputSchema: { ...campoProfessor, ...campoTelefone },
    },
    comProfessor(obter, perfil, "senha_provisoria_professor", "gerar a senha", async (_ctx, ator, prof, _args, rodar) => {
      const senha = await rodar(() => senhaProvisoriaProfessorPor(ator, prof.id));
      return `Nova senha provisória de ${prof.nome} (${prof.escolaNome}): ${senha}\nEle entra com o e-mail ${prof.email} e essa senha, e troca no próximo login. Passe só ao professor; não repita a senha em outras mensagens.`;
    }),
  );
}
