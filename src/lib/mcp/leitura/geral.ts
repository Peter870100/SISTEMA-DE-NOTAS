import { podeVerTurma } from "../escopo";
import {
  campoEscola, campoTelefone, dataBR, escolasDoPedido, lerPorIds, lerTodas, rotuloEscola, texto, type Ctx, type EscolaInfo, type Registrar,
} from "./comum";
import { cursosVisiveis } from "./cursos";
import { simuladosVisiveis } from "./simulados";

async function contagem(q: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function resumoEscola(ctx: Ctx, escola: EscolaInfo): Promise<string> {
  const { supabase, escopo } = ctx;
  const turmas = await lerTodas<{ nome: string; ano_letivo: string }>((de, ate) =>
    supabase.from("turmas").select("nome, ano_letivo").eq("escola_id", escola.id).order("id").range(de, ate));
  const distintas = new Set(turmas.filter((t) => podeVerTurma(escopo, escola.id, t.nome)).map((t) => `${t.nome}|${t.ano_letivo}`));
  let contas: number;
  if (escopo.tipo === "professor" && escopo.turmas !== null) {
    const nomes = [...escopo.turmas];
    const vinc = nomes.length
      ? await lerTodas<{ conta_id: string }>((de, ate) => supabase.from("aluno_turmas").select("conta_id").eq("escola_id", escola.id).in("turma_nome", nomes).order("conta_id").range(de, ate))
      : [];
    contas = new Set(vinc.map((v) => v.conta_id)).size;
  } else {
    contas = await contagem(supabase.from("alunos_contas").select("id", { count: "exact", head: true }).eq("escola_id", escola.id));
  }
  const [professores, sims, cursos, questoes] = await Promise.all([
    contagem(supabase.from("professores").select("id", { count: "exact", head: true }).eq("escola_id", escola.id)),
    simuladosVisiveis(ctx, [escola], "professor"),
    cursosVisiveis(ctx, [escola]),
    contagem(supabase.from("questoes").select("id", { count: "exact", head: true }).eq("status", "publicada").or(`escopo.eq.geral,escola_id.eq.${escola.id}`)),
  ]);
  const abertos = sims.filter((s) => s.situacao === "aberto").length;
  const agendados = sims.filter((s) => s.situacao === "agendado").length;
  return `${escola.nome} (${escola.slug}): ${professores} professores · ${distintas.size} turmas · ${contas} contas de aluno · ${abertos} simulados abertos (${agendados} agendados, ${sims.length} no total) · ${cursos.length} cursos · ${questoes} questões publicadas disponíveis`;
}

export const registrarGeral: Registrar = (server, obter) => {
  server.registerTool(
    "visao_geral",
    {
      title: "Visão geral",
      description: "Números gerais por escola: professores, turmas, contas de aluno, simulados abertos, cursos e questões publicadas disponíveis.",
      inputSchema: { ...campoEscola, ...campoTelefone },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      const linhas: string[] = [];
      for (const e of escolas) linhas.push(`- ${await resumoEscola(ctx, e)}`);
      return texto(linhas.join("\n") || "Nenhuma escola encontrada.");
    }
  );

  server.registerTool(
    "listar_professores",
    {
      title: "Listar professores",
      description: "Lista os professores (papel, e-mail, se tem acesso só a algumas turmas e quais, último acesso).",
      inputSchema: { ...campoEscola, ...campoTelefone },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      // Colunas explícitas: nunca senha_hash nem tokens.
      type P = { id: string; escola_id: string; nome: string; email: string; role: string; telefone: string | null; acesso_restrito: boolean; email_verificado: boolean; ultimo_acesso: string | null };
      const profs = await lerTodas<P>((de, ate) =>
        ctx.supabase.from("professores").select("id, escola_id, nome, email, role, telefone, acesso_restrito, email_verificado, ultimo_acesso")
          .in("escola_id", escolas.map((e) => e.id)).order("nome").order("id").range(de, ate));
      if (profs.length === 0) return texto("Nenhum professor encontrado.");
      const acessos = await lerPorIds<{ professor_id: string; turma_nome: string }>(profs.filter((p) => p.acesso_restrito).map((p) => p.id), (bloco, de, ate) =>
        ctx.supabase.from("professor_turma_acesso").select("professor_id, turma_nome").in("professor_id", bloco).order("professor_id").order("turma_nome").range(de, ate));
      const dono = ctx.escopo.tipo === "dono";
      return texto(profs.map((p) => {
        const turmas = acessos.filter((a) => a.professor_id === p.id).map((a) => a.turma_nome);
        const alcance = p.role === "professor" && p.acesso_restrito ? `só ${turmas.join(", ") || "nenhuma turma"}` : "todas as turmas";
        // O telefone só aparece para o dono.
        return `- ${rotuloEscola(escolas, p.escola_id)}${p.nome} — ${p.role} · ${p.email}${p.email_verificado ? "" : " (e-mail não confirmado)"}${dono && p.telefone ? ` · tel. ${p.telefone}` : ""} · ${alcance} · último acesso: ${p.ultimo_acesso ? dataBR(p.ultimo_acesso) : "nunca"}`;
      }).join("\n"));
    }
  );
};
