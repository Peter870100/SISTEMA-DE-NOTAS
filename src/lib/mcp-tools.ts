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

type Turma = { id: string; nome: string; bimestre: string; ano_letivo: string };
type Aluno = { id: string; turma_id: string; nome: string; numero: number | null; ordem: number };
type Coluna = { id: string; turma_id: string; titulo: string; ordem: number; tipo?: string };
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

  async function resolverAtividade(turmaId: string, tituloQuery: string): Promise<Coluna> {
    const { data, error } = await supabase.from("atividades_colunas").select("*").eq("turma_id", turmaId);
    if (error) throw new Error(error.message);
    const alvo = normalizar(tituloQuery);
    const candidatos = (data ?? []).filter((c) => normalizar(c.titulo).includes(alvo));
    if (candidatos.length === 0) {
      throw new Error(`Nenhuma atividade encontrada com título parecido com "${tituloQuery}" nessa turma.`);
    }
    if (candidatos.length > 1) {
      const opcoes = candidatos.map((c) => `"${c.titulo}"`).join(", ");
      throw new Error(`Mais de uma atividade encontrada para "${tituloQuery}": ${opcoes}. Seja mais específico.`);
    }
    return candidatos[0];
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
      const linhas = visiveis.map((t) => `- ${t.nome} — ${t.bimestre} (${t.ano_letivo})`);
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

      const insert: { nome: string; bimestre?: string; ano_letivo?: string } = { nome: nomeLimpo };
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
        supabase.from("atividades_colunas").select("*").eq("turma_id", turma.id).order("ordem"),
        supabase.from("alunos").select("*").eq("turma_id", turma.id).order("ordem"),
      ]);
      const alunoIds = (alunos ?? []).map((a) => a.id);
      const { data: notas } = alunoIds.length
        ? await supabase.from("notas_celulas").select("*").in("aluno_id", alunoIds)
        : { data: [] };

      const notaPorAlunoColuna = new Map<string, string>();
      for (const n of notas ?? []) {
        const valorTexto = n.valor !== null ? String(n.valor) : n.status_texto ?? "";
        notaPorAlunoColuna.set(`${n.aluno_id}:${n.coluna_id}`, valorTexto);
      }

      const cabecalho = `Turma: ${turma.nome} — ${turma.bimestre} (${turma.ano_letivo})`;
      const listaColunas = `Atividades: ${(colunas ?? []).map((c) => c.titulo).join(", ") || "(nenhuma)"}`;
      const linhasAlunos = (alunos ?? []).map((a) => {
        const partes = (colunas ?? []).map((c) => {
          const v = notaPorAlunoColuna.get(`${a.id}:${c.id}`);
          return `${c.titulo}: ${v || "—"}`;
        });
        return `${a.numero ?? "?"}. ${a.nome} — ${partes.join(" | ")}`;
      });

      return texto([cabecalho, listaColunas, "", `Alunos (${alunos?.length ?? 0}):`, ...linhasAlunos].join("\n"));
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
    bimestre: z.string().optional(),
    ...professorTelefoneField,
  };

  server.registerTool(
    "lancar_nota",
    {
      title: "Lançar nota",
      description:
        "Lança (ou substitui) a nota/status de um aluno numa atividade específica. Informe exatamente um dos dois: valor OU status.",
      inputSchema: notaInput,
    },
    async ({ turma_nome, aluno_nome, atividade_titulo, valor, status, bimestre, professor_telefone }) => {
      if ((valor === undefined) === (status === undefined)) {
        throw new Error("Informe exatamente um dos dois: valor (número) OU status (texto), não ambos nem nenhum.");
      }
      const professor = await resolverProfessorInfo(professor_telefone);
      const liberadas = await turmasLiberadas(professor);
      const turma = await resolverTurma(turma_nome, bimestre, liberadas);
      const [aluno, atividade] = await Promise.all([
        resolverAluno(turma.id, aluno_nome),
        resolverAtividade(turma.id, atividade_titulo),
      ]);
      await upsertCelulaComHistorico(aluno.id, atividade.id, valor ?? null, status ?? null, professor);
      return texto(`OK: ${aluno.nome} — ${atividade.titulo} = ${valor ?? status}`);
    }
  );

  server.registerTool(
    "lancar_notas_em_lote",
    {
      title: "Lançar várias notas de uma vez",
      description:
        "Lança várias notas na mesma turma numa chamada só. Cada item precisa de aluno_nome, atividade_titulo e valor OU status. Retorna o resultado item a item (alguns podem falhar sem afetar os outros).",
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
          if ((item.valor === undefined) === (item.status === undefined)) {
            throw new Error("informe exatamente um dos dois: valor OU status");
          }
          const [aluno, atividade] = await Promise.all([
            resolverAluno(turma.id, item.aluno_nome),
            resolverAtividade(turma.id, item.atividade_titulo),
          ]);
          await upsertCelulaComHistorico(aluno.id, atividade.id, item.valor ?? null, item.status ?? null, professor);
          resultados.push(`OK: ${aluno.nome} — ${atividade.titulo} = ${item.valor ?? item.status}`);
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
        .insert({ turma_id: turma.id, nome: nome.trim(), numero: numero ?? null, ordem: count ?? 0 })
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
        const { error } = await supabase.from("alunos").insert({ turma_id: turma.id, nome, ordem });
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
        .insert({ turma_id: turma.id, titulo: titulo.trim(), ordem: count ?? 0 })
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
          .insert({ turma_id: turma.id, titulo: dataLimpa, tipo: "presenca", ordem: count ?? 0 })
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
