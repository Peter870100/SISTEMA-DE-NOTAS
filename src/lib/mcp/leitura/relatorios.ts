import { z } from "zod";
import { urlDaEscola } from "@/lib/dominio";
import { carregarRelatorioAluno, carregarRelatorioTurma, grupoDaTurma, podeVerGrupo } from "@/lib/relatorios/dados";
import {
  linhaDoLink, pessoasAchadas, textoRelatorioAluno, textoRelatorioTurma, turmaDoLink, turmasVisiveis, type LinhaDoGrupo,
} from "@/lib/relatorios/texto-hermes";
import {
  acharPorNome, campoEscola, campoTelefone, escolasDoPedido, lerPorIds, lerTodas, limitarLinhas, rotuloEscola, texto,
  type Ctx, type EscolaInfo, type Registrar,
} from "./comum";
import { acharTurma, COLUNAS_TURMA, type TurmaLida } from "./turmas";

const NAO_ACHEI_ALUNO = "Não encontrei esse aluno nas turmas que você pode ver.";
const NAO_ACHEI_TURMA = "Não encontrei essa turma nas turmas que você pode ver.";

const chaveGrupo = (t: TurmaLida) => `${t.escola_id}|${t.nome}|${t.ano_letivo}`;

function slugDa(escolas: EscolaInfo[], escolaId: string): string {
  const e = escolas.find((x) => x.id === escolaId);
  if (!e) throw new Error("Escola da turma não encontrada.");
  return e.slug;
}

/** Linhas de outras planilhas ligadas à mesma conta de cada linha achada (aluno_turmas.aluno_id). */
async function vinculosDasLinhas(ctx: Ctx, alunoIds: string[]): Promise<(id: string) => Set<string>> {
  type V = { conta_id: string; aluno_id: string | null };
  const diretos = await lerPorIds<V>(alunoIds, (bloco, de, ate) =>
    ctx.supabase.from("aluno_turmas").select("conta_id, aluno_id").in("aluno_id", bloco).order("conta_id").order("turma_nome").range(de, ate));
  const daConta = await lerPorIds<V>(diretos.map((v) => v.conta_id), (bloco, de, ate) =>
    ctx.supabase.from("aluno_turmas").select("conta_id, aluno_id").in("conta_id", bloco).order("conta_id").order("turma_nome").range(de, ate));
  const porConta = new Map<string, Set<string>>();
  for (const v of daConta) if (v.aluno_id) porConta.set(v.conta_id, (porConta.get(v.conta_id) ?? new Set()).add(v.aluno_id));
  return (id) => {
    const ids = new Set<string>();
    for (const v of diretos) if (v.aluno_id === id) for (const x of porConta.get(v.conta_id) ?? []) ids.add(x);
    return ids;
  };
}

export const registrarRelatorios: Registrar = (server, obter) => {
  server.registerTool(
    "relatorio_aluno",
    {
      title: "Relatório de um aluno",
      description: "Resumo curto do relatório de um aluno (média por bimestre, quanto falta para a média, simulados feitos e não feitos, matérias mais fracas, aulas) com o link da página completa com gráficos. Acha o aluno pelo nome na planilha das turmas; se houver mais de um, lista para escolher.",
      inputSchema: {
        aluno: z.string().describe("Nome (ou parte) do aluno"),
        turma: z.string().optional().describe('Nome da turma, para desempatar. Ex: "3º A"'),
        ...campoEscola,
        ...campoTelefone,
      },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      const todas = await lerTodas<TurmaLida>((de, ate) =>
        ctx.supabase.from("turmas").select(COLUNAS_TURMA).in("escola_id", escolas.map((e) => e.id)).order("nome").order("bimestre").order("id").range(de, ate));
      // Alcance primeiro (professor restrito), depois o filtro de turma e a busca pelo nome.
      let visiveis = turmasVisiveis(ctx.escopo, todas);
      if (args.turma?.trim()) visiveis = acharPorNome(visiveis, (t) => t.nome, args.turma);
      if (visiveis.length === 0) return texto(NAO_ACHEI_ALUNO);

      const turmaPorId = new Map(visiveis.map((t) => [t.id, t]));
      const lidos = await lerPorIds<{ id: string; turma_id: string; nome: string }>(visiveis.map((t) => t.id), (bloco, de, ate) =>
        ctx.supabase.from("alunos").select("id, turma_id, nome").in("turma_id", bloco).order("id").range(de, ate));
      const linhas: LinhaDoGrupo[] = lidos.flatMap((a) => {
        const t = turmaPorId.get(a.turma_id);
        return t ? [{ grupo: chaveGrupo(t), turmaId: t.id, bimestre: t.bimestre, alunoId: a.id, nome: a.nome }] : [];
      });
      const achadas = acharPorNome(linhas, (l) => l.nome, args.aluno);
      if (achadas.length === 0) return texto(NAO_ACHEI_ALUNO);

      const vinculadosDe = await vinculosDasLinhas(ctx, achadas.map((a) => a.alunoId));
      const pessoas = pessoasAchadas(linhas, achadas, vinculadosDe).map((p) => {
        const bimestres = visiveis.filter((t) => chaveGrupo(t) === p.grupo);
        const alvo = linhaDoLink(bimestres, linhas.filter((l) => p.alunoIds.has(l.alunoId)));
        const turma = alvo ? turmaPorId.get(alvo.turmaId) : undefined;
        if (!alvo || !turma) throw new Error("Não achei a linha do aluno na planilha.");
        return { ...p, alvo, turma, link: urlDaEscola(slugDa(escolas, turma.escola_id), `/turma/${turma.id}/relatorio/aluno/${alvo.alunoId}`) };
      });

      if (pessoas.length > 1) {
        const rotulo = (p: (typeof pessoas)[number]) => `${rotuloEscola(escolas, p.turma.escola_id)}${p.nome} (${p.turma.nome} · ${p.turma.ano_letivo})`;
        const contagem = new Map<string, number>();
        for (const p of pessoas) contagem.set(rotulo(p), (contagem.get(rotulo(p)) ?? 0) + 1);
        // Nome igual na mesma turma: o nome não desempata, então vai o link de cada um.
        const opcoes = pessoas.map((p) => `- ${rotulo(p)}${(contagem.get(rotulo(p)) ?? 0) > 1 ? ` — ${p.link}` : ""}`);
        return texto(`Achei ${pessoas.length} alunos com "${args.aluno}". Qual deles?\n${limitarLinhas(opcoes, 30, "Use o nome completo ou informe a turma.").join("\n")}`);
      }

      const p = pessoas[0];
      const g = grupoDaTurma(p.turma);
      if (!podeVerGrupo(ctx.escopo, g)) return texto(NAO_ACHEI_ALUNO);
      const r = await carregarRelatorioAluno(g, p.alvo.alunoId);
      return texto(`${rotuloEscola(escolas, p.turma.escola_id)}${textoRelatorioAluno(r, p.link)}`);
    }
  );

  server.registerTool(
    "relatorio_turma",
    {
      title: "Relatório de uma turma",
      description: "Resumo curto do relatório de uma turma (médias por bimestre, quem está abaixo da média, quem fez cada simulado, matérias mais fracas) com o link da página completa com gráficos.",
      inputSchema: {
        turma: z.string().describe('Nome da turma, ex: "3º A"'),
        ano_letivo: z.string().optional().describe('Ex: "2026" — só se houver a mesma turma em anos diferentes'),
        ...campoEscola,
        ...campoTelefone,
      },
    },
    async (args) => {
      const ctx = await obter(args);
      const escolas = await escolasDoPedido(ctx, args.escola);
      // acharTurma já filtra pelo alcance antes de casar o nome.
      const grupos = await acharTurma(ctx, escolas.map((e) => e.id), args.turma, args.ano_letivo);
      if (grupos.length === 0) return texto(NAO_ACHEI_TURMA);
      if (grupos.length > 1) {
        return texto(`Mais de uma turma com "${args.turma}". Qual delas?\n${grupos.slice(0, 20).map((g) => `- ${rotuloEscola(escolas, g[0].escola_id)}${g[0].nome} · ${g[0].ano_letivo}`).join("\n")}`);
      }
      const turma = turmaDoLink(grupos[0]);
      if (!turma) return texto(NAO_ACHEI_TURMA);
      const g = grupoDaTurma(turma);
      if (!podeVerGrupo(ctx.escopo, g)) return texto(NAO_ACHEI_TURMA);
      const r = await carregarRelatorioTurma(g);
      const link = urlDaEscola(slugDa(escolas, turma.escola_id), `/turma/${turma.id}/relatorio`);
      return texto(`${rotuloEscola(escolas, turma.escola_id)}${textoRelatorioTurma(r, link)}`);
    }
  );
};
