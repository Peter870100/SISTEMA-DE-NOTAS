import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { gerarSenhaProvisoria, sugerirUsuario } from "@/lib/contas-aluno";
import { normalizarBusca } from "@/lib/hermes/relatorios";
import { mesmaEscola, podeAcessarTurma } from "@/lib/escola-regras";
import type { AtorEscola } from "@/lib/simulados/ator";
import {
  alunosSemConta,
  escolherLinhasParaCriar,
  limparNome,
  linhaDeReferencia,
  nomesDeContasSemLigacao,
  pessoasDaReferencia,
  sugerirLigacoes,
  type SugestaoLigacoes,
} from "./ligacao";

/**
 * Núcleo das contas de aluno com quem age explícito (`AtorEscola`): a tela passa o admin logado e a
 * Hermes passa o dono com a escola do pedido. Toda escola/turma é conferida contra o ator.
 */

export type CredencialGerada = { nome: string; usuario: string; senha: string; turma: string };

type TurmaDoGrupo = { id: string; nome: string; ano_letivo: string; bimestre: string; bimestre_vigente: boolean | null };

/** Turma (escola + nome + ano letivo) com os bimestres e a linha de referência (vigente, senão o último). */
export type GrupoTurma = { escolaId: string; turmaNome: string; anoLetivo: string; bimestres: TurmaDoGrupo[]; referenciaId: string };

/** Pessoa da planilha (linha de referência, não transferida) com as contas ligadas a qualquer linha dela. */
type Pessoa = { alunoId: string; nome: string; contas: string[]; jaLigado: boolean };

const ERRO_TURMA = "Turma não encontrada.";
const ERRO_CONTA = "Conta não encontrada.";
const ERRO_LINHA_OCUPADA = "Esta linha da planilha já está ligada a outra conta.";

/** Rótulo da turma nas credenciais e nas mensagens: "1º Ano A · 2026". */
function rotuloTurma(t: { nome: string; ano_letivo: string }): string {
  return `${t.nome} · ${t.ano_letivo}`;
}

/** Valida que a turma é da escola do ator (e liberada para ele) e devolve o grupo dela. */
export async function grupoDaTurmaId(ator: AtorEscola, turmaId: string): Promise<GrupoTurma> {
  const { data: turma } = await supabase.from("turmas").select("id, escola_id, nome, ano_letivo").eq("id", turmaId).maybeSingle();
  if (!turma || !podeAcessarTurma(ator, turma, ator.turmas)) throw new Error(ERRO_TURMA);
  const { data: bimestres, error } = await supabase
    .from("turmas")
    .select("id, nome, ano_letivo, bimestre, bimestre_vigente")
    .eq("escola_id", turma.escola_id)
    .eq("nome", turma.nome)
    .eq("ano_letivo", turma.ano_letivo)
    .order("bimestre");
  if (error) throw new Error(error.message);
  const lista = (bimestres ?? []) as TurmaDoGrupo[];
  const referenciaId = linhaDeReferencia(lista.map((b) => ({ turmaId: b.id, vigente: !!b.bimestre_vigente, bimestre: b.bimestre }))) ?? turma.id;
  return { escolaId: turma.escola_id, turmaNome: turma.nome, anoLetivo: turma.ano_letivo, bimestres: lista, referenciaId };
}

/**
 * As pessoas da turma (linhas não transferidas do bimestre de referência). "Já tem conta" é decidido
 * por pessoa: conta ligada a qualquer linha dela em qualquer bimestre do grupo.
 */
async function pessoasDoGrupo(grupo: GrupoTurma): Promise<Pessoa[]> {
  const turmaIds = grupo.bimestres.map((b) => b.id);
  if (!turmaIds.includes(grupo.referenciaId)) turmaIds.push(grupo.referenciaId);
  const { data: alunos, error } = await supabase.from("alunos").select("id, turma_id, nome, transferido_em").in("turma_id", turmaIds).order("ordem");
  if (error) throw new Error(error.message);
  const linhas = alunos ?? [];
  const contaPorAluno = new Map<string, string>();
  if (linhas.length > 0) {
    const { data: vinculos, error: erroVinc } = await supabase.from("aluno_turmas").select("conta_id, aluno_id").in("aluno_id", linhas.map((a) => a.id));
    if (erroVinc) throw new Error(erroVinc.message);
    for (const v of vinculos ?? []) if (v.aluno_id) contaPorAluno.set(v.aluno_id as string, v.conta_id as string);
  }
  const transferidos = new Set(linhas.filter((a) => a.transferido_em).map((a) => a.id as string));
  return pessoasDaReferencia(
    linhas.map((a) => ({ turmaId: a.turma_id as string, alunoId: a.id as string, nome: a.nome as string })),
    grupo.referenciaId,
    contaPorAluno,
  )
    .filter((p) => !transferidos.has(p.alunoId))
    .map((p) => ({ ...p, jaLigado: p.contas.length > 0 }));
}

/** Contas (desta escola) que estão na turma do grupo, com a ligação atual. */
async function contasDoGrupo(grupo: GrupoTurma): Promise<{ contaId: string; nome: string; alunoIdAtual: string | null }[]> {
  const { data: vinculos, error } = await supabase
    .from("aluno_turmas")
    .select("conta_id, aluno_id")
    .eq("escola_id", grupo.escolaId)
    .eq("turma_nome", grupo.turmaNome)
    .eq("ano_letivo", grupo.anoLetivo);
  if (error) throw new Error(error.message);
  const ids = (vinculos ?? []).map((v) => v.conta_id as string);
  if (ids.length === 0) return [];
  const { data: contas, error: erroContas } = await supabase.from("alunos_contas").select("id, nome").eq("escola_id", grupo.escolaId).in("id", ids);
  if (erroContas) throw new Error(erroContas.message);
  const nomePorId = new Map((contas ?? []).map((c) => [c.id as string, c.nome as string]));
  return (vinculos ?? [])
    .filter((v) => nomePorId.has(v.conta_id))
    .map((v) => ({ contaId: v.conta_id as string, nome: nomePorId.get(v.conta_id) ?? "", alunoIdAtual: (v.aluno_id as string | null) ?? null }));
}

/** Usuários já tomados que começam igual aos sugeridos — para o sufixo numérico não colidir. */
export async function usuariosExistentes(bases: string[]): Promise<Set<string>> {
  const prefixos = [...new Set(bases.map((b) => b.replace(/\d+$/, "")))];
  const existentes = new Set<string>();
  for (const prefixo of prefixos) {
    const { data } = await supabase.from("alunos_contas").select("usuario").ilike("usuario", `${prefixo}%`);
    for (const linha of data ?? []) if (linha.usuario) existentes.add(linha.usuario);
  }
  return existentes;
}

/** Sugere um usuário para cada nome, sem colidir com os que já existem nem entre si. */
export async function sugerirUsuarios(nomes: string[]): Promise<string[]> {
  const existentes = await usuariosExistentes(nomes.map((n) => sugerirUsuario(n, new Set())));
  return nomes.map((nome) => sugerirUsuario(nome, existentes));
}

/**
 * Cria as contas (senha provisória) e as põe na turma. Valida tudo antes do primeiro insert, para não
 * perder senhas de contas já criadas. `alunoId`, quando vem, grava a ligação com a planilha.
 * Mesmas mensagens de sempre da tela "Contas de alunos".
 */
export async function criarContasNaTurma(
  ator: AtorEscola,
  turma: { nome: string; ano_letivo: string },
  alunos: { nome: string; usuario: string; alunoId?: string }[],
): Promise<CredencialGerada[]> {
  const invalidos: string[] = [];
  const vistos = new Set<string>();
  for (const { nome, usuario } of alunos) {
    const u = usuario.trim().toLowerCase();
    if (!nome.trim() || !/^[a-z0-9.]+$/.test(u) || vistos.has(u)) invalidos.push(nome.trim() || "(sem nome)");
    vistos.add(u);
  }
  if (invalidos.length > 0) throw new Error(`Usuário inválido ou repetido para: ${invalidos.join(", ")}. Nenhuma conta foi criada.`);

  const credenciais: CredencialGerada[] = [];
  for (const { nome, usuario, alunoId } of alunos) {
    const usuarioLimpo = usuario.trim().toLowerCase();
    const senha = gerarSenhaProvisoria();
    const { data: conta, error } = await supabase
      .from("alunos_contas")
      .insert({
        escola_id: ator.escola_id,
        nome: nome.trim(),
        usuario: usuarioLimpo,
        senha_hash: await bcrypt.hash(senha, 10),
        senha_provisoria: true,
        criado_via: ator.via === "hermes" ? "hermes" : "escola",
      })
      .select("id")
      .single();
    if (error?.code === "23505") throw new Error(`O usuário ${usuarioLimpo} já existe. Gere a prévia de novo. ${credenciais.length} conta(s) já foram criadas antes deste.`);
    if (error || !conta) throw new Error(error?.message ?? "Falha ao criar conta.");
    const vinculo = { conta_id: conta.id, escola_id: ator.escola_id, turma_nome: turma.nome, ano_letivo: turma.ano_letivo, ...(alunoId ? { aluno_id: alunoId } : {}) };
    const { error: erroVinculo } = await supabase.from("aluno_turmas").insert(vinculo);
    if (erroVinculo) {
      await supabase.from("alunos_contas").delete().eq("id", conta.id);
      const motivo = alunoId && erroVinculo.code === "23505" ? `${nome.trim()} já tem conta ligada na planilha.` : `Falha ao ligar ${nome.trim()} à turma.`;
      throw new Error(`${motivo} ${credenciais.length} conta(s) já foram criadas antes deste.`);
    }
    credenciais.push({ nome: nome.trim(), usuario: usuarioLimpo, senha, turma: rotuloTurma(turma) });
  }
  return credenciais;
}

export type LinhaPreviaPlanilha = {
  nome: string;
  usuario: string;
  alunoId: string;
  /** Há na turma uma conta sem ligação com o mesmo nome: melhor "Ligar pelo nome" antes de criar. */
  possivelContaExistente: boolean;
};

/** Pessoas da planilha ainda sem conta ligada, com o usuário sugerido. */
export async function previaContasDaPlanilhaPor(ator: AtorEscola, turmaId: string): Promise<LinhaPreviaPlanilha[]> {
  const grupo = await grupoDaTurmaId(ator, turmaId);
  const [pessoas, contas] = await Promise.all([pessoasDoGrupo(grupo), contasDoGrupo(grupo)]);
  const semConta = alunosSemConta(pessoas, new Set(pessoas.filter((p) => p.jaLigado).map((p) => p.alunoId)));
  const nomesContasLivres = nomesDeContasSemLigacao(contas);
  const nomes = semConta.map((p) => limparNome(p.nome));
  const usuarios = await sugerirUsuarios(nomes);
  return semConta.map((p, i) => ({ nome: nomes[i], usuario: usuarios[i], alunoId: p.alunoId, possivelContaExistente: nomesContasLivres.has(normalizarBusca(p.nome)) }));
}

/**
 * Cria as contas dos alunos escolhidos da planilha, com o nome da planilha (o cliente só manda o id e o
 * usuário) e já ligadas à linha de referência. Quem já tem conta ligada é ignorado (`ignorados`).
 */
export async function criarContasDaPlanilhaPor(
  ator: AtorEscola,
  turmaId: string,
  linhas: { alunoId: string; usuario: string }[],
): Promise<{ credenciais: CredencialGerada[]; ignorados: string[] }> {
  const grupo = await grupoDaTurmaId(ator, turmaId);
  const pessoas = await pessoasDoGrupo(grupo);
  const escolha = escolherLinhasParaCriar(linhas, pessoas, new Set(pessoas.filter((p) => p.jaLigado).map((p) => p.alunoId)));
  if (escolha.desconhecidos.length > 0) throw new Error("Aluno não encontrado na planilha desta turma. Gere a prévia de novo. Nenhuma conta foi criada.");
  const credenciais = await criarContasNaTurma(ator, { nome: grupo.turmaNome, ano_letivo: grupo.anoLetivo }, escolha.criar);
  return { credenciais, ignorados: escolha.ignorados };
}

/** Pessoas da planilha da turma sem conta ligada (opções do seletor "Ligar a…"). */
export async function alunosSemContaDoGrupoPor(ator: AtorEscola, turmaId: string): Promise<{ alunoId: string; nome: string }[]> {
  const grupo = await grupoDaTurmaId(ator, turmaId);
  const pessoas = await pessoasDoGrupo(grupo);
  return pessoas.filter((p) => !p.jaLigado).map((p) => ({ alunoId: p.alunoId, nome: limparNome(p.nome) }));
}

export type PreviaLigacoes = Omit<SugestaoLigacoes, "ligar"> & { ligar: { contaId: string; alunoId: string; nomeConta: string; nomeAluno: string }[] };

/** O que "Ligar pelo nome" faria nesta turma (só casamentos únicos dos dois lados). */
export async function previaLigacoesPorNomePor(ator: AtorEscola, turmaId: string): Promise<PreviaLigacoes> {
  const grupo = await grupoDaTurmaId(ator, turmaId);
  const [contas, pessoas] = await Promise.all([contasDoGrupo(grupo), pessoasDoGrupo(grupo)]);
  const sugestao = sugerirLigacoes(contas, pessoas);
  const nomeConta = new Map(contas.map((c) => [c.contaId, c.nome]));
  const nomeAluno = new Map(pessoas.map((p) => [p.alunoId, p.nome]));
  return {
    ...sugestao,
    ligar: sugestao.ligar.map((p) => ({ ...p, nomeConta: nomeConta.get(p.contaId) ?? "", nomeAluno: nomeAluno.get(p.alunoId) ?? "" })),
  };
}

/**
 * Grava (ou limpa, com null) a ligação de uma conta numa turma; traduz a violação do índice único e
 * confere que alguma linha foi mesmo alterada.
 */
async function gravarLigacao(contaId: string, grupo: GrupoTurma, alunoId: string | null): Promise<void> {
  const { data, error } = await supabase
    .from("aluno_turmas")
    .update({ aluno_id: alunoId })
    .eq("conta_id", contaId)
    .eq("escola_id", grupo.escolaId)
    .eq("turma_nome", grupo.turmaNome)
    .eq("ano_letivo", grupo.anoLetivo)
    .select("conta_id");
  if (error?.code === "23505") throw new Error(ERRO_LINHA_OCUPADA);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(`A conta não está na turma ${grupo.turmaNome} · ${grupo.anoLetivo}.`);
}

/**
 * Aplica os pares (conta, aluno) da prévia, revalidando cada um: a conta está nesta turma e sem
 * ligação, o aluno é da linha de referência e a pessoa não tem conta, e nada se repete. Valida tudo
 * antes de gravar.
 */
export async function aplicarLigacoesPor(ator: AtorEscola, turmaId: string, pares: { contaId: string; alunoId: string }[]): Promise<{ ligadas: number }> {
  const grupo = await grupoDaTurmaId(ator, turmaId);
  const [contas, pessoas] = await Promise.all([contasDoGrupo(grupo), pessoasDoGrupo(grupo)]);
  const contaPorId = new Map(contas.map((c) => [c.contaId, c]));
  const pessoaPorId = new Map(pessoas.map((p) => [p.alunoId, p]));
  const contasVistas = new Set<string>();
  const alunosVistos = new Set<string>();
  const problemas: string[] = [];
  for (const { contaId, alunoId } of pares) {
    const conta = contaPorId.get(contaId);
    const pessoa = pessoaPorId.get(alunoId);
    if (!conta) problemas.push("conta que não está nesta turma");
    else if (conta.alunoIdAtual) problemas.push(`${conta.nome} (já está ligada)`);
    else if (!pessoa) problemas.push(`${conta.nome} (aluno não encontrado na planilha desta turma)`);
    else if (pessoa.jaLigado) problemas.push(`${pessoa.nome} (já tem conta ligada)`);
    else if (contasVistas.has(contaId) || alunosVistos.has(alunoId)) problemas.push(`${conta.nome} (repetido no pedido)`);
    contasVistas.add(contaId);
    alunosVistos.add(alunoId);
  }
  if (problemas.length > 0) throw new Error(`Não foi possível ligar: ${problemas.join(", ")}. Gere a prévia de novo. Nada foi ligado.`);

  let ligadas = 0;
  for (const { contaId, alunoId } of pares) {
    try {
      await gravarLigacao(contaId, grupo, alunoId);
    } catch (e) {
      throw new Error(`${(e as Error).message} ${ligadas} ligação(ões) já foram gravadas antes desta.`);
    }
    ligadas++;
  }
  return { ligadas };
}

/**
 * Liga uma conta, à mão, a uma linha da planilha na turma indicada (a linha precisa ser do bimestre de
 * referência), ou desliga só nesta turma com `null`. Se a conta já estava ligada à mesma pessoa numa
 * linha de bimestre antigo, a ligação passa para a linha de referência.
 */
export async function ligarContaPor(ator: AtorEscola, contaId: string, turmaId: string, alunoId: string | null): Promise<void> {
  const { data: conta } = await supabase.from("alunos_contas").select("escola_id").eq("id", contaId).maybeSingle();
  if (!conta || !mesmaEscola(conta, ator.escola_id)) throw new Error(ERRO_CONTA);
  const grupo = await grupoDaTurmaId(ator, turmaId);

  if (alunoId === null) {
    await gravarLigacao(contaId, grupo, null);
    return;
  }

  const pessoa = (await pessoasDoGrupo(grupo)).find((p) => p.alunoId === alunoId);
  if (!pessoa) throw new Error("Ligue a conta a um aluno da planilha desta turma (bimestre vigente).");
  if (pessoa.contas.some((c) => c !== contaId)) throw new Error(ERRO_LINHA_OCUPADA);
  await gravarLigacao(contaId, grupo, alunoId);
}
