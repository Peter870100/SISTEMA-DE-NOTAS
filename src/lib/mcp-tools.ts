import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export function criarSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createClient(url, key);
}

type Turma = { id: string; nome: string; bimestre: string; ano_letivo: string; criado_via?: string };
type Aluno = { id: string; turma_id: string; nome: string; numero: number | null; ordem: number; criado_via?: string };
type Coluna = { id: string; turma_id: string; titulo: string; ordem: number; tipo?: string; criado_via?: string };
type ProfessorInfo = { id: string; role: string; acesso_restrito: boolean } | null;

const professorTelefoneField = {
  professor_telefone: z
    .string()
    .optional()
    .describe(
      "Telefone de quem está pedindo (se conhecido). Usado pra restringir o acesso quando o professor só pode ver turmas específicas."
    ),
};

function texto(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

/** Remove acentos e caixa pra permitir busca por nome sem depender de acentuação exata. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Registra todas as ferramentas de leitura/escrita da Planilha Viva no servidor MCP informado. */
export function registrarFerramentas(server: McpServer, supabase: SupabaseClient) {
  /** Identifica o professor pelo telefone informado, se algum. */
  async function resolverProfessorInfo(telefone: string | undefined): Promise<ProfessorInfo> {
    if (!telefone?.trim()) return null;
    const { data } = await supabase
      .from("professores")
      .select("id, role, acesso_restrito")
      .eq("telefone", telefone.trim())
      .maybeSingle();
    return data ?? null;
  }

  /** Nomes de turma liberados pro professor, ou null se ele pode ver todas (admin, sem restrição, ou telefone não identificado). */
  async function turmasLiberadas(professor: ProfessorInfo): Promise<Set<string> | null> {
    if (!professor || professor.role === "admin" || !professor.acesso_restrito) return null;
    const { data } = await supabase
      .from("professor_turma_acesso")
      .select("turma_nome")
      .eq("professor_id", professor.id);
    return new Set((data ?? []).map((r) => r.turma_nome));
  }

  /** Upsert de nota_celula que também registra no histórico quando quem alterou é professor comum. */
  async function upsertCelulaComHistorico(
    alunoId: string,
    colunaId: string,
    valor: number | null,
    status: string | null,
    professor: ProfessorInfo
  ) {
    const { data: atual } = await supabase
      .from("notas_celulas")
      .select("valor, status_texto")
      .eq("aluno_id", alunoId)
      .eq("coluna_id", colunaId)
      .maybeSingle();

    const { error } = await supabase.from("notas_celulas").upsert(
      { aluno_id: alunoId, coluna_id: colunaId, valor, status_texto: status, atualizado_por: professor?.id ?? null },
      { onConflict: "aluno_id,coluna_id" }
    );
    if (error) throw new Error(error.message);

    const mudou = (atual?.valor ?? null) !== valor || (atual?.status_texto ?? null) !== status;
    if (professor?.role === "professor" && mudou) {
      await supabase.from("notas_historico").insert({
        aluno_id: alunoId,
        coluna_id: colunaId,
        valor_anterior: atual?.valor ?? null,
        status_anterior: atual?.status_texto ?? null,
        valor_novo: valor,
        status_novo: status,
        alterado_por: professor.id,
      });
    }
  }

  async function resolverTurma(
    nomeQuery: string,
    bimestreQuery?: string,
    liberadas?: Set<string> | null
  ): Promise<Turma> {
    const { data, error } = await supabase.from("turmas").select("*");
    if (error) throw new Error(error.message);
    const alvo = normalizar(nomeQuery);
    let candidatos = (data ?? []).filter((t) => normalizar(t.nome).includes(alvo));
    if (bimestreQuery) {
      const alvoBimestre = normalizar(bimestreQuery);
      candidatos = candidatos.filter((t) => normalizar(t.bimestre).includes(alvoBimestre));
    }
    if (liberadas) {
      candidatos = candidatos.filter((t) => liberadas.has(t.nome));
    }
    if (candidatos.length === 0) {
      throw new Error(
        `Nenhuma turma encontrada com nome parecido com "${nomeQuery}"${liberadas ? " (ou você não tem acesso a ela)" : ""}.`
      );
    }
    if (candidatos.length > 1) {
      const opcoes = candidatos.map((t) => `"${t.nome}" (${t.bimestre})`).join(", ");
      throw new Error(
        `Mais de uma turma encontrada para "${nomeQuery}": ${opcoes}. Informe também o bimestre pra desambiguar.`
      );
    }
    return candidatos[0];
  }

  async function resolverAluno(turmaId: string, nomeQuery: string): Promise<Aluno> {
    const { data, error } = await supabase.from("alunos").select("*").eq("turma_id", turmaId);
    if (error) throw new Error(error.message);
    const alvo = normalizar(nomeQuery);
    const candidatos = (data ?? []).filter((a) => normalizar(a.nome).includes(alvo));
    if (candidatos.length === 0) {
      throw new Error(`Nenhum aluno encontrado com nome parecido com "${nomeQuery}" nessa turma.`);
    }
    if (candidatos.length > 1) {
      const opcoes = candidatos.map((a) => `"${a.nome}"`).join(", ");
      throw new Error(`Mais de um aluno encontrado para "${nomeQuery}": ${opcoes}. Seja mais específico.`);
    }
    return candidatos[0];
  }

  /** Quantas células com nota/status cada coluna tem. */
  async function contarNotasPorColuna(colunaIds: string[]): Promise<Map<string, number>> {
    const contagem = new Map<string, number>();
    if (colunaIds.length === 0) return contagem;
    const { data } = await supabase
      .from("notas_celulas")
      .select("coluna_id, valor, status_texto")
      .in("coluna_id", colunaIds);
    for (const n of data ?? []) {
      if (n.valor === null && !n.status_texto) continue;
      contagem.set(n.coluna_id, (contagem.get(n.coluna_id) ?? 0) + 1);
    }
    return contagem;
  }

  /**
   * Acha a coluna pelo título. Quando há colunas com o mesmo título, `posicao` (1 = primeira coluna da
   * planilha, na ordem do ver_planilha) escolhe qual.
   */
  async function resolverAtividade(turmaId: string, tituloQuery: string, posicao?: number): Promise<Coluna> {
    const { data, error } = await supabase
      .from("atividades_colunas")
      .select("*")
      .eq("turma_id", turmaId)
      .order("ordem")
      .order("id");
    if (error) throw new Error(error.message);
    const alvo = normalizar(tituloQuery);
    const comPosicao = (data ?? []).map((c, i) => ({ coluna: c as Coluna, posicao: i + 1 }));
    let candidatos = comPosicao.filter(({ coluna }) => normalizar(coluna.titulo).includes(alvo));
    if (candidatos.length === 0) {
      throw new Error(`Nenhuma coluna encontrada com título parecido com "${tituloQuery}" nessa turma.`);
    }
    if (posicao !== undefined) {
      candidatos = candidatos.filter((c) => c.posicao === posicao);
      if (candidatos.length === 0) {
        throw new Error(
          `A coluna na posição ${posicao} não tem título parecido com "${tituloQuery}". Confira as posições com ver_planilha.`
        );
      }
    }
    if (candidatos.length > 1) {
      const notas = await contarNotasPorColuna(candidatos.map(({ coluna }) => coluna.id));
      const opcoes = candidatos
        .map(({ coluna, posicao: p }) => `posição ${p}: "${coluna.titulo}" (${notas.get(coluna.id) ?? 0} notas)`)
        .join("; ");
      throw new Error(
        `Mais de uma coluna encontrada para "${tituloQuery}": ${opcoes}. Seja mais específico no título, ou, pra excluir/renomear, informe coluna_posicao com o número da posição.`
      );
    }
    return candidatos[0].coluna;
  }

  const colunaPosicaoField = {
    coluna_posicao: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe(
        "Posição da coluna na planilha (1 = primeira), como mostrada no ver_planilha. Use só quando houver colunas com o mesmo título."
      ),
  };
  /** Manda pra lixeira (restaurável por admin). Devolve o resumo gravado, pra resposta ao agente. */
  async function excluirParaLixeira(
    tipo: "turma" | "aluno" | "atividade",
    id: string,
    professor: ProfessorInfo
  ): Promise<{ alunos?: number; atividades?: number; notas?: number }> {
    const { data: lixeiraId, error } = await supabase.rpc("lixeira_excluir", {
      p_tipo: tipo,
      p_id: id,
      p_ator: professor?.id ?? null,
      p_via: "hermes",
    });
    if (error) throw new Error(error.message);
    const { data: item } = await supabase.from("lixeira").select("resumo").eq("id", lixeiraId).single();
    return (item?.resumo ?? {}) as { alunos?: number; atividades?: number; notas?: number };
  }


  server.registerTool(
    "listar_turmas",
    {
      title: "Listar turmas",
      description:
        "Lista todas as turmas cadastradas (nome, bimestre, ano letivo). Use antes de qualquer outra ferramenta pra saber os nomes exatos disponíveis.",
      inputSchema: { ...professorTelefoneField },
    },
    async ({ professor_telefone }) => {
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const { data, error } = await supabase.from("turmas").select("*").order("nome");
      if (error) throw new Error(error.message);
      const visiveis = liberadas ? (data ?? []).filter((t) => liberadas.has(t.nome)) : data ?? [];
      if (visiveis.length === 0) return texto("Nenhuma turma cadastrada (ou nenhuma liberada pra esse professor).");
      const linhas = visiveis.map(
        (t) => `- ${t.nome} — ${t.bimestre} (${t.ano_letivo})${t.criado_via === "hermes" ? " (criada pelo Hermes)" : ""}`
      );
      return texto(linhas.join("\n"));
    }
  );

  server.registerTool(
    "criar_turma",
    {
      title: "Criar turma (planilha nova)",
      description:
        "Cria uma turma/planilha nova do zero, vazia (sem alunos nem atividades ainda). Use quando não existir nenhuma turma parecida — confira com listar_turmas antes pra não duplicar.",
      inputSchema: {
        nome: z.string().describe('Nome da turma, ex: "1ª série C"'),
        bimestre: z.string().optional().describe('Ex: "2º Bimestre" — se omitido, usa o padrão do sistema'),
        ano_letivo: z.string().optional().describe('Ex: "2026" — se omitido, usa o padrão do sistema'),
      },
    },
    async ({ nome, bimestre, ano_letivo }) => {
      const nomeLimpo = nome.trim();
      if (!nomeLimpo) throw new Error("Informe o nome da turma.");

      const insert: { nome: string; bimestre?: string; ano_letivo?: string; criado_via: string } = { nome: nomeLimpo, criado_via: "hermes" };
      if (bimestre) insert.bimestre = bimestre.trim();
      if (ano_letivo) insert.ano_letivo = ano_letivo.trim();

      const { data, error } = await supabase.from("turmas").insert(insert).select().single();
      if (error) throw new Error(error.message);
      return texto(
        `Turma "${data.nome}" criada (${data.bimestre}, ${data.ano_letivo}). Agora use criar_alunos_em_lote ou criar_aluno pra adicionar os alunos, e criar_atividade pra adicionar as colunas de nota.`
      );
    }
  );
  server.registerTool(
    "excluir_turma",
    {
      title: "Excluir turma (planilha inteira)",
      description:
        "Move uma turma/planilha inteira (de um bimestre) para a lixeira, com todos os alunos, atividades, notas e histórico. Nada é apagado de vez: um administrador pode restaurar pela lixeira do sistema. Para remover só uma coluna, use excluir_coluna.",
      inputSchema: {
        turma_nome: z.string().describe('Nome da turma, ex: "1ª série C"'),
        bimestre: z.string().optional().describe('Ex: "2º Bimestre" — necessário se a turma tiver mais de um bimestre'),
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, bimestre, professor_telefone }) => {
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const resumo = await excluirParaLixeira("turma", turma.id, professor);
      return texto(
        `Planilha "${turma.nome} · ${turma.bimestre}" movida para a lixeira (${resumo.alunos ?? 0} alunos, ${resumo.atividades ?? 0} atividades, ${resumo.notas ?? 0} notas). Um administrador pode restaurá-la em /admin/lixeira.`
      );
    }
  );


  server.registerTool(
    "ver_planilha",
    {
      title: "Ver planilha da turma",
      description:
        "Mostra a planilha completa de uma turma: colunas de atividade e, para cada aluno, o valor/status lançado em cada atividade. Use isso pra ver o estado atual antes de lançar notas.",
      inputSchema: {
        turma_nome: z.string().describe('Nome da turma, ex: "1ª série A"'),
        bimestre: z.string().optional().describe('Opcional, ex: "2º Bimestre" — só necessário se houver ambiguidade'),
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, bimestre, professor_telefone }) => {
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const [{ data: colunas }, { data: alunos }] = await Promise.all([
        supabase.from("atividades_colunas").select("*").eq("turma_id", turma.id).order("ordem").order("id"),
        supabase.from("alunos").select("*").eq("turma_id", turma.id).order("ordem"),
      ]);
      const alunoIds = (alunos ?? []).map((a) => a.id);
      const { data: notas } = alunoIds.length
        ? await supabase.from("notas_celulas").select("*").in("aluno_id", alunoIds)
        : { data: [] };

      const notaPorAlunoColuna = new Map<string, string>();
      const notasPorColuna = new Map<string, number>();
      for (const n of notas ?? []) {
        const valorTexto = n.valor !== null ? String(n.valor) : n.status_texto ?? "";
        notaPorAlunoColuna.set(`${n.aluno_id}:${n.coluna_id}`, valorTexto);
        if (valorTexto) notasPorColuna.set(n.coluna_id, (notasPorColuna.get(n.coluna_id) ?? 0) + 1);
      }

      const cabecalho = `Turma: ${turma.nome} — ${turma.bimestre} (${turma.ano_letivo})${turma.criado_via === "hermes" ? " (criada pelo Hermes)" : ""}`;
      const marca = (via?: string) => (via === "hermes" ? "*" : "");
      const listaColunas = `Colunas (posição. título — notas lançadas): ${
        (colunas ?? [])
          .map((c, i) => `${i + 1}. ${c.titulo}${marca(c.criado_via)} — ${notasPorColuna.get(c.id) ?? 0}`)
          .join(" | ") || "(nenhuma)"
      }`;
      const temMarca = [...(colunas ?? []), ...(alunos ?? [])].some((x) => x.criado_via === "hermes");
      const linhasAlunos = (alunos ?? []).map((a) => {
        const partes = (colunas ?? []).map((c) => {
          const v = notaPorAlunoColuna.get(`${a.id}:${c.id}`);
          return `${c.titulo}: ${v || "—"}`;
        });
        return `${a.numero ?? "?"}. ${a.nome}${marca(a.criado_via)} — ${partes.join(" | ")}`;
      });

      return texto(
        [
          cabecalho,
          listaColunas,
          ...(temMarca ? ["(* = criado pelo Hermes)"] : []),
          "",
          `Alunos (${alunos?.length ?? 0}):`,
          ...linhasAlunos,
        ].join("\n")
      );
    }
  );

  server.registerTool(
    "buscar_aluno",
    {
      title: "Buscar aluno",
      description: "Busca alunos por parte do nome dentro de uma turma. Útil pra confirmar o nome exato antes de lançar uma nota.",
      inputSchema: {
        turma_nome: z.string(),
        busca: z.string().describe('Parte do nome do aluno, ex: "ana"'),
        bimestre: z.string().optional(),
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, busca, bimestre, professor_telefone }) => {
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const { data: todos, error } = await supabase
        .from("alunos")
        .select("*")
        .eq("turma_id", turma.id)
        .order("ordem");
      if (error) throw new Error(error.message);
      const alvo = normalizar(busca);
      const data = (todos ?? []).filter((a) => normalizar(a.nome).includes(alvo));
      if (!data || data.length === 0) return texto(`Nenhum aluno encontrado com "${busca}".`);
      return texto(data.map((a) => `${a.numero ?? "?"}. ${a.nome}`).join("\n"));
    }
  );

  const notaInput = {
    turma_nome: z.string(),
    aluno_nome: z.string(),
    atividade_titulo: z.string(),
    valor: z.number().min(0).max(1000).optional().describe("Nota numérica de 0 a 1000"),
    status: z.string().optional().describe('Status em texto livre, ex: "ok", "NF", "FALTOU"'),
    limpar: z.boolean().optional().describe("true pra apagar a nota/status já lançado, deixando a célula vazia. Não use junto com valor/status."),
    bimestre: z.string().optional(),
    ...professorTelefoneField,
  };

  /** Valida valor/status/limpar e devolve o par final a gravar (null, null se for pra limpar). */
  function resolverValorStatus(
    valor: number | undefined,
    status: string | undefined,
    limpar: boolean | undefined
  ): { valorFinal: number | null; statusFinal: string | null } {
    if (limpar) {
      if (valor !== undefined || status !== undefined) {
        throw new Error("Não informe valor/status junto com limpar — limpar sozinho já apaga a célula.");
      }
      return { valorFinal: null, statusFinal: null };
    }
    if ((valor === undefined) === (status === undefined)) {
      throw new Error(
        "Informe exatamente um dos três: valor (número), status (texto) ou limpar (true), não mais de um nem nenhum."
      );
    }
    return { valorFinal: valor ?? null, statusFinal: status ?? null };
  }

  server.registerTool(
    "lancar_nota",
    {
      title: "Lançar nota",
      description:
        "Lança (ou substitui) a nota/status de um aluno numa atividade específica. Informe exatamente um dos três: valor, status, ou limpar (true) pra apagar o que já estava lançado.",
      inputSchema: notaInput,
    },
    async ({ turma_nome, aluno_nome, atividade_titulo, valor, status, limpar, bimestre, professor_telefone }) => {
      const { valorFinal, statusFinal } = resolverValorStatus(valor, status, limpar);
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const [aluno, atividade] = await Promise.all([
        resolverAluno(turma.id, aluno_nome),
        resolverAtividade(turma.id, atividade_titulo),
      ]);
      await upsertCelulaComHistorico(aluno.id, atividade.id, valorFinal, statusFinal, professor);
      return texto(
        `OK: ${aluno.nome} — ${atividade.titulo} = ${limpar ? "(limpo)" : (valorFinal ?? statusFinal)}`
      );
    }
  );

  server.registerTool(
    "lancar_notas_em_lote",
    {
      title: "Lançar várias notas de uma vez",
      description:
        "Lança várias notas na mesma turma numa chamada só. Cada item precisa de aluno_nome, atividade_titulo e valor, status ou limpar:true. Retorna o resultado item a item (alguns podem falhar sem afetar os outros).",
      inputSchema: {
        turma_nome: z.string(),
        bimestre: z.string().optional(),
        notas: z
          .array(
            z.object({
              aluno_nome: z.string(),
              atividade_titulo: z.string(),
              valor: z.number().min(0).max(1000).optional(),
              status: z.string().optional(),
              limpar: z.boolean().optional(),
            })
          )
          .min(1),
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, bimestre, notas, professor_telefone }) => {
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const resultados: string[] = [];
      for (const item of notas) {
        try {
          const { valorFinal, statusFinal } = resolverValorStatus(item.valor, item.status, item.limpar);
          const [aluno, atividade] = await Promise.all([
            resolverAluno(turma.id, item.aluno_nome),
            resolverAtividade(turma.id, item.atividade_titulo),
          ]);
          await upsertCelulaComHistorico(aluno.id, atividade.id, valorFinal, statusFinal, professor);
          resultados.push(
            `OK: ${aluno.nome} — ${atividade.titulo} = ${item.limpar ? "(limpo)" : (valorFinal ?? statusFinal)}`
          );
        } catch (e) {
          resultados.push(
            `FALHOU: ${item.aluno_nome} — ${item.atividade_titulo}: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
      return texto(resultados.join("\n"));
    }
  );

  server.registerTool(
    "criar_aluno",
    {
      title: "Criar aluno",
      description: "Adiciona um novo aluno a uma turma.",
      inputSchema: {
        turma_nome: z.string(),
        nome: z.string(),
        numero: z.number().optional(),
        bimestre: z.string().optional(),
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, nome, numero, bimestre, professor_telefone }) => {
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const { count } = await supabase
        .from("alunos")
        .select("id", { count: "exact", head: true })
        .eq("turma_id", turma.id);
      const { data, error } = await supabase
        .from("alunos")
        .insert({ turma_id: turma.id, nome: nome.trim(), numero: numero ?? null, ordem: count ?? 0, criado_via: "hermes" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return texto(`Aluno "${data.nome}" criado na turma ${turma.nome}.`);
    }
  );

  server.registerTool(
    "criar_alunos_em_lote",
    {
      title: "Criar vários alunos de uma vez",
      description:
        "Adiciona vários alunos a uma turma numa chamada só — ideal quando os nomes vêm de uma lista ou foto de chamada. Ignora nomes que já existirem na turma (não duplica).",
      inputSchema: {
        turma_nome: z.string(),
        bimestre: z.string().optional(),
        nomes: z.array(z.string()).min(1).describe("Lista de nomes dos alunos a adicionar"),
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, bimestre, nomes, professor_telefone }) => {
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const { data: existentes, count } = await supabase
        .from("alunos")
        .select("nome", { count: "exact" })
        .eq("turma_id", turma.id);
      const nomesExistentes = new Set((existentes ?? []).map((a) => normalizar(a.nome)));

      const resultados: string[] = [];
      let ordem = count ?? 0;
      for (const nomeBruto of nomes) {
        const nome = nomeBruto.trim();
        if (!nome) continue;
        if (nomesExistentes.has(normalizar(nome))) {
          resultados.push(`IGNORADO (já existe): ${nome}`);
          continue;
        }
        const { error } = await supabase.from("alunos").insert({ turma_id: turma.id, nome, ordem, criado_via: "hermes" });
        if (error) {
          resultados.push(`FALHOU: ${nome}: ${error.message}`);
        } else {
          resultados.push(`OK: ${nome}`);
          nomesExistentes.add(normalizar(nome));
          ordem++;
        }
      }
      return texto(resultados.join("\n"));
    }
  );

  server.registerTool(
    "renomear_aluno",
    {
      title: "Renomear aluno (corrigir nome digitado errado)",
      description: "Corrige o nome de um aluno já cadastrado — use quando o nome foi digitado com erro de digitação.",
      inputSchema: {
        turma_nome: z.string(),
        aluno_nome: z.string().describe("Nome atual (ou parte dele) do aluno a renomear"),
        novo_nome: z.string(),
        bimestre: z.string().optional(),
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, aluno_nome, novo_nome, bimestre, professor_telefone }) => {
      const novoNomeLimpo = novo_nome.trim();
      if (!novoNomeLimpo) throw new Error("Informe o novo nome do aluno.");
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const aluno = await resolverAluno(turma.id, aluno_nome);
      const { error } = await supabase
        .from("alunos")
        .update({ nome: novoNomeLimpo, nome_editado_em: new Date().toISOString() })
        .eq("id", aluno.id);
      if (error) throw new Error(error.message);
      return texto(`OK: "${aluno.nome}" agora é "${novoNomeLimpo}" (turma ${turma.nome}).`);
    }
  );

  server.registerTool(
    "excluir_aluno",
    {
      title: "Excluir aluno",
      description:
        "Move um aluno de uma turma para a lixeira, junto com todas as notas dele. Nada é apagado de vez: um administrador pode restaurar pela lixeira do sistema.",
      inputSchema: {
        turma_nome: z.string(),
        aluno_nome: z.string(),
        bimestre: z.string().optional(),
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, aluno_nome, bimestre, professor_telefone }) => {
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const aluno = await resolverAluno(turma.id, aluno_nome);
      const resumo = await excluirParaLixeira("aluno", aluno.id, professor);
      return texto(
        `OK: "${aluno.nome}" movido para a lixeira (${resumo.notas ?? 0} notas), da turma ${turma.nome}. Um administrador pode restaurá-lo em /admin/lixeira.`
      );
    }
  );

  server.registerTool(
    "criar_atividade",
    {
      title: 'Criar atividade (também chamada de "planilha" pelo professor)',
      description:
        'Cria uma nova coluna de atividade/avaliação dentro de uma turma — o professor às vezes chama isso de "criar uma planilha" (ex: "criar uma planilha do texto Terras Raras"). Depois de criar, use lancar_nota ou lancar_notas_em_lote pra lançar as notas dos alunos nela.',
      inputSchema: {
        turma_nome: z.string(),
        titulo: z.string(),
        bimestre: z.string().optional(),
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, titulo, bimestre, professor_telefone }) => {
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const { count } = await supabase
        .from("atividades_colunas")
        .select("id", { count: "exact", head: true })
        .eq("turma_id", turma.id);
      const { data, error } = await supabase
        .from("atividades_colunas")
        .insert({ turma_id: turma.id, titulo: titulo.trim(), ordem: count ?? 0, criado_via: "hermes" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return texto(`Atividade "${data.titulo}" criada na turma ${turma.nome}.`);
    }
  );

  server.registerTool(
    "corrigir_tipo_atividade",
    {
      title: "Corrigir tipo de uma atividade (nota vs presença)",
      description:
        'Corrige o tipo de uma coluna já criada — use quando uma chamada/presença foi lançada por engano como atividade de nota comum (ex: criada com criar_atividade + lancar_nota em vez de lancar_presenca_em_lote), pra recategorizar sem apagar os valores já lançados. Prefira sempre lancar_presenca_em_lote pra presença nova; esta ferramenta é só pra corrigir o que já foi criado errado.',
      inputSchema: {
        turma_nome: z.string(),
        atividade_titulo: z.string(),
        tipo: z.enum(["nota", "presenca"]).describe("Tipo correto pra essa coluna"),
        bimestre: z.string().optional(),
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, atividade_titulo, tipo, bimestre, professor_telefone }) => {
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const atividade = await resolverAtividade(turma.id, atividade_titulo);
      const { error } = await supabase.from("atividades_colunas").update({ tipo }).eq("id", atividade.id);
      if (error) throw new Error(error.message);
      return texto(`OK: "${atividade.titulo}" (${turma.nome}) agora é do tipo "${tipo}".`);
    }
  );

  async function renomearColuna(
    turma_nome: string,
    titulo: string,
    novo_titulo: string,
    bimestre: string | undefined,
    professor_telefone: string | undefined,
    posicao?: number
  ) {
    const novoTituloLimpo = novo_titulo.trim();
    if (!novoTituloLimpo) throw new Error("Informe o novo título da coluna.");
    const professor = await resolverProfessorInfo(professor_telefone);
    const liberadas = await turmasLiberadas(professor);
    const turma = await resolverTurma(turma_nome, bimestre, liberadas);
    const atividade = await resolverAtividade(turma.id, titulo, posicao);
    const { error } = await supabase
      .from("atividades_colunas")
      .update({ titulo: novoTituloLimpo })
      .eq("id", atividade.id);
    if (error) throw new Error(error.message);
    return texto(`OK: coluna "${atividade.titulo}" agora é "${novoTituloLimpo}" (turma ${turma.nome}).`);
  }

  server.registerTool(
    "renomear_coluna",
    {
      title: "Renomear/mudar nome de coluna da planilha",
      description:
        "Renomeia (muda o nome, troca o título, corrige o cabeçalho) de uma coluna da planilha de uma turma — coluna de nota/atividade/prova/trabalho ou de chamada/presença. As notas lançadas nela continuam. Você TEM permissão pra usar esta ferramenta quando o professor pedir. Use ver_planilha antes se não souber o título atual exato. Se houver colunas com o mesmo título, informe coluna_posicao.",
      inputSchema: {
        turma_nome: z.string().describe('Nome da turma, ex: "1ª série C"'),
        coluna_titulo: z.string().describe("Título atual da coluna (ou parte dele), como aparece no cabeçalho"),
        novo_titulo: z.string().describe("Nome novo da coluna"),
        bimestre: z.string().optional().describe('Ex: "2º Bimestre" — necessário se a turma tiver mais de um bimestre'),
        ...colunaPosicaoField,
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, coluna_titulo, novo_titulo, bimestre, coluna_posicao, professor_telefone }) =>
      renomearColuna(turma_nome, coluna_titulo, novo_titulo, bimestre, professor_telefone, coluna_posicao)
  );

  server.registerTool(
    "renomear_atividade",
    {
      title: "Renomear atividade/chamada (coluna)",
      description:
        "Mesmo que renomear_coluna: corrige o título de uma atividade ou data de chamada já criada — mantém as notas já lançadas nela.",
      inputSchema: {
        turma_nome: z.string(),
        atividade_titulo: z.string().describe("Título atual (ou parte dele) da atividade a renomear"),
        novo_titulo: z.string(),
        bimestre: z.string().optional(),
        ...colunaPosicaoField,
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, atividade_titulo, novo_titulo, bimestre, coluna_posicao, professor_telefone }) =>
      renomearColuna(turma_nome, atividade_titulo, novo_titulo, bimestre, professor_telefone, coluna_posicao)
  );

  async function excluirColuna(
    turma_nome: string,
    titulo: string,
    bimestre: string | undefined,
    professor_telefone: string | undefined,
    posicao?: number
  ) {
    const professor = await resolverProfessorInfo(professor_telefone);
    const liberadas = await turmasLiberadas(professor);
    const turma = await resolverTurma(turma_nome, bimestre, liberadas);
    const atividade = await resolverAtividade(turma.id, titulo, posicao);
    const resumo = await excluirParaLixeira("atividade", atividade.id, professor);
    return texto(
      `OK: coluna "${atividade.titulo}" movida para a lixeira (${resumo.notas ?? 0} notas), da turma ${turma.nome}. Um administrador pode restaurá-la em /admin/lixeira.`
    );
  }

  server.registerTool(
    "excluir_coluna",
    {
      title: "Excluir/deletar/apagar coluna da planilha",
      description:
        'Deleta (exclui, apaga, remove) uma coluna da planilha de uma turma — seja coluna de nota/atividade/prova/trabalho ou coluna de chamada/presença — junto com as notas lançadas nela. A coluna vai para a lixeira e um administrador pode restaurar. Você TEM permissão pra usar esta ferramenta quando o professor pedir pra tirar uma coluna. Use ver_planilha antes se não souber o título exato da coluna. Se houver colunas com o mesmo título, informe coluna_posicao (veja no ver_planilha qual tem notas); ao excluir várias, rode ver_planilha de novo entre uma e outra, porque as posições das colunas seguintes diminuem. Para apagar a planilha/turma inteira, use excluir_turma.',
      inputSchema: {
        turma_nome: z.string().describe('Nome da turma, ex: "1ª série C"'),
        coluna_titulo: z.string().describe("Título da coluna (ou parte dele), como aparece no cabeçalho da planilha"),
        bimestre: z.string().optional().describe('Ex: "2º Bimestre" — necessário se a turma tiver mais de um bimestre'),
        ...colunaPosicaoField,
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, coluna_titulo, bimestre, coluna_posicao, professor_telefone }) =>
      excluirColuna(turma_nome, coluna_titulo, bimestre, professor_telefone, coluna_posicao)
  );

  server.registerTool(
    "excluir_atividade",
    {
      title: "Excluir atividade/chamada (coluna)",
      description:
        'Mesmo que excluir_coluna: deleta uma coluna de atividade ou chamada (o professor às vezes chama de "planilha") movendo-a para a lixeira, junto com as notas lançadas nela. Um administrador pode restaurar pela lixeira do sistema.',
      inputSchema: {
        turma_nome: z.string(),
        atividade_titulo: z.string(),
        bimestre: z.string().optional(),
        ...colunaPosicaoField,
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, atividade_titulo, bimestre, coluna_posicao, professor_telefone }) =>
      excluirColuna(turma_nome, atividade_titulo, bimestre, professor_telefone, coluna_posicao)
  );

  server.registerTool(
    "lancar_presenca_em_lote",
    {
      title: "Lançar presença do dia (chamada)",
      description:
        'Registra a chamada de um dia pra uma turma: cria (ou reaproveita, se já existir) a coluna de presença daquela data e lança "P" (presente) ou "F" (falta) pra cada aluno informado. Ideal pra automação diária — rodar de novo pra mesma turma e mesma data reaproveita a coluna existente e sobrescreve os valores, em vez de duplicar. Chame listar_turmas antes se precisar confirmar o nome exato da turma.',
      inputSchema: {
        turma_nome: z.string(),
        data: z.string().describe('Data da chamada, ex: "14/08/26"'),
        bimestre: z.string().optional(),
        presencas: z
          .array(
            z.object({
              aluno_nome: z.string(),
              status: z.string().describe('"P" (presente) ou "F" (falta)'),
            })
          )
          .min(1),
        ...professorTelefoneField,
      },
    },
    async ({ turma_nome, data, bimestre, presencas, professor_telefone }) => {
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const dataLimpa = data.trim();
      if (!dataLimpa) throw new Error('Informe a data da chamada, ex: "14/08/26".');

      const { data: existentes, error: errBusca } = await supabase
        .from("atividades_colunas")
        .select("*")
        .eq("turma_id", turma.id)
        .eq("tipo", "presenca")
        .eq("titulo", dataLimpa);
      if (errBusca) throw new Error(errBusca.message);

      let coluna = existentes?.[0] as Coluna | undefined;
      let colunaCriada = false;
      if (!coluna) {
        const { count } = await supabase
          .from("atividades_colunas")
          .select("id", { count: "exact", head: true })
          .eq("turma_id", turma.id);
        const { data: nova, error: errCriar } = await supabase
          .from("atividades_colunas")
          .insert({ turma_id: turma.id, titulo: dataLimpa, tipo: "presenca", ordem: count ?? 0, criado_via: "hermes" })
          .select()
          .single();
        if (errCriar) throw new Error(errCriar.message);
        coluna = nova;
        colunaCriada = true;
      }

      const resultados: string[] = [];
      for (const item of presencas) {
        try {
          const statusNormalizado = item.status.trim().toUpperCase();
          if (statusNormalizado !== "P" && statusNormalizado !== "F") {
            throw new Error('status deve ser "P" (presente) ou "F" (falta)');
          }
          const aluno = await resolverAluno(turma.id, item.aluno_nome);
          await upsertCelulaComHistorico(aluno.id, coluna!.id, null, statusNormalizado, professor);
          resultados.push(`OK: ${aluno.nome} — ${statusNormalizado}`);
        } catch (e) {
          resultados.push(
            `FALHOU: ${item.aluno_nome}: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
      return texto(
        `Chamada de ${dataLimpa} — ${turma.nome} (coluna ${colunaCriada ? "criada" : "reaproveitada"}):\n${resultados.join("\n")}`
      );
    }
  );
}
