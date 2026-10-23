import { normalizarBusca } from "@/lib/hermes/relatorios";
import { acharPorNome, dataHoraBR, limitarLinhas, type EscolaInfo } from "../leitura/comum";

/**
 * Regras puras das ferramentas de contas e de ajuda ao aluno da Hermes (perfil dono): escolha do
 * aluno, da turma e da tentativa, textos de resposta e parâmetros para o registro. Sem banco, para
 * testar com `tsx --test` (o núcleo cria o cliente do Supabase ao ser importado).
 */

// ---------- registro ----------

const SENSIVEIS = /senha|token|telefone|password/i;

/**
 * Parâmetros para o `hermes_registro`: sem telefone e sem nenhuma chave de senha/token. As senhas
 * geradas vêm no resultado da ação, que nunca é gravado (`executarRegistrado` só guarda os parâmetros).
 */
export function parametrosParaRegistro(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([k, v]) => v !== undefined && !SENSIVEIS.test(k)));
}

// ---------- usuário ----------

const MAX_USUARIO = 60;
const ERRO_USUARIO = "Usuário inválido: use só letras minúsculas, números e ponto.";

/** Usuário de login: minúsculas, números e ponto (o mesmo da tela). Devolve já limpo. */
export function validarUsuario(usuario: string): string {
  const u = usuario.trim().toLowerCase();
  if (!/^[a-z0-9.]+$/.test(u)) throw new Error(ERRO_USUARIO);
  if (u.length > MAX_USUARIO) throw new Error(`Usuário com no máximo ${MAX_USUARIO} caracteres.`);
  return u;
}

// ---------- aluno ----------

export type ContaAchada = {
  id: string; nome: string; escolaId: string; escolaNome: string; usuario: string | null; email: string | null; ativo: boolean;
  /** "1º Ano A · 2026" */
  turmas: string[];
};

/** Toda ferramenta de aluno precisa do nome ou do id da conta. */
export function exigirAluno(args: { aluno?: string; conta_id?: string }): void {
  if (!args.aluno?.trim() && !args.conta_id?.trim()) throw new Error("Informe o aluno (nome) ou o conta_id.");
}

const login = (c: ContaAchada) => (c.usuario ? `usuário ${c.usuario}` : c.email ? `e-mail ${c.email}` : "sem login");

/** "Ana Souza (1A · 2026)", com a escola na frente quando o pedido mistura escolas. */
export function rotuloConta(c: ContaAchada, variasEscolas: boolean): string {
  return `${variasEscolas ? `[${c.escolaNome}] ` : ""}${c.nome} (${c.turmas.join(", ") || "sem turma"})`;
}

/** O nome é o pedido (normalizado), e não só o contém. */
const igual = (nome: string, busca: string) => normalizarBusca(nome) === normalizarBusca(busca);

/**
 * Uma conta entre as achadas pelo nome (ou a do `conta_id`, com `porId`). Nenhuma → erro. Só age
 * com uma conta de nome igual ao pedido: uma só que apenas contém o pedido ("Ana" → "Mariana") ou
 * mais de uma → texto com as opções (turma e conta_id) para a Hermes perguntar; nada é feito.
 */
export function escolherConta(achadas: ContaAchada[], busca: string, variasEscolas: boolean, porId = false): { conta: ContaAchada } | { mensagem: string } {
  if (achadas.length === 0) throw new Error(`Aluno "${busca}" não encontrado.`);
  if (achadas.length === 1) {
    const c = achadas[0];
    if (porId || igual(c.nome, busca)) return { conta: c };
    return { mensagem: `Achei só ${rotuloConta(c, variasEscolas)} para "${busca}". É esse aluno? Nada foi feito; repita com o conta_id ${c.id}.` };
  }
  const opcoes = achadas.map((c) => `- ${rotuloConta(c, variasEscolas)} · ${login(c)}${c.ativo ? "" : " · bloqueada"} · conta_id ${c.id}`);
  return {
    mensagem: `Achei ${achadas.length} alunos com "${busca}". Qual deles? Nada foi feito; repita com o conta_id.\n${limitarLinhas(opcoes, 30, "Use o nome completo.").join("\n")}`,
  };
}

// ---------- turma ----------

export type TurmaLinha = { id: string; escola_id: string; nome: string; ano_letivo: string };

const porAnoDesc = (a: string, b: string) => b.localeCompare(a, undefined, { numeric: true });

/**
 * Turma pelo nome entre as escolas do pedido (igual primeiro; senão quem contém). Mesmo nome em mais
 * de uma escola → pede qual. Sem `ano`, vale o ano letivo mais recente. Devolve uma linha qualquer do
 * grupo (o núcleo acha o bimestre de referência).
 */
export function escolherTurma(turmas: TurmaLinha[], escolas: EscolaInfo[], nome: string, ano?: string): TurmaLinha {
  const nomeEscola = (id: string) => escolas.find((e) => e.id === id)?.nome ?? "?";
  const grupos = [...new Map(turmas.map((t) => [`${t.escola_id}|${t.nome}`, { escola_id: t.escola_id, nome: t.nome }])).values()]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || nomeEscola(a.escola_id).localeCompare(nomeEscola(b.escola_id), "pt-BR"));
  const achados = acharPorNome(grupos, (g) => g.nome, nome);
  if (achados.length === 0) throw new Error(`Turma "${nome}" não encontrada.`);
  if (achados.length > 1) {
    throw new Error(`Mais de uma turma com "${nome}": ${achados.slice(0, 20).map((g) => `${g.nome} [${nomeEscola(g.escola_id)}]`).join(", ")}. Diga qual (ou a escola).`);
  }
  const g = achados[0];
  const doGrupo = turmas.filter((t) => t.escola_id === g.escola_id && t.nome === g.nome);
  const anos = [...new Set(doGrupo.map((t) => t.ano_letivo))].sort(porAnoDesc);
  const alvo = ano?.trim() || anos[0];
  const linha = doGrupo.filter((t) => t.ano_letivo === alvo).sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!linha) throw new Error(`A turma ${g.nome} não tem o ano letivo ${alvo}. Anos: ${anos.join(", ")}.`);
  return linha;
}

export type VinculoConta = { escola_id: string; turma_nome: string; ano_letivo: string };

const rotuloVinculo = (v: VinculoConta) => `${v.turma_nome} · ${v.ano_letivo}`;

/**
 * A turma da conta onde agir. Sem `turma`, só se a conta estiver em exatamente uma; com `turma`, pelo
 * nome (igual primeiro), no ano letivo mais recente.
 */
export function escolherVinculo(vinculos: VinculoConta[], turma?: string): VinculoConta {
  const todas = [...vinculos].sort((a, b) => a.turma_nome.localeCompare(b.turma_nome, "pt-BR") || porAnoDesc(a.ano_letivo, b.ano_letivo));
  if (!turma?.trim()) {
    if (todas.length === 1) return todas[0];
    if (todas.length === 0) throw new Error("A conta não está em nenhuma turma; inclua com turmas_da_conta.");
    throw new Error(`Diga a turma: ${todas.map(rotuloVinculo).join(", ")}.`);
  }
  const achados = acharPorNome(todas, (v) => v.turma_nome, turma);
  if (achados.length === 0) throw new Error(`A conta não está na turma "${turma.trim()}". Turmas da conta: ${todas.map(rotuloVinculo).join(", ") || "nenhuma"}.`);
  const nomes = new Set(achados.map((v) => v.turma_nome));
  if (nomes.size > 1) throw new Error(`Mais de uma turma da conta com "${turma.trim()}": ${[...nomes].join(", ")}. Diga qual.`);
  return achados[0];
}

/**
 * Um item pelo nome (curso, aula, aluno da planilha…) para uma ação. Só devolve o item quando há um
 * só e de nome igual ao pedido; um só que apenas contém o pedido, ou vários → texto para perguntar
 * (nada é feito). Nenhum → erro. `genero` = "o" ou "a" ("não encontrado/a", "o curso"/"a aula").
 */
export function escolherPorNome<T>(lista: T[], nome: (x: T) => string, busca: string, rotulo: string, genero: "o" | "a"): { item: T } | { mensagem: string } {
  const pedido = busca.trim();
  const achados = acharPorNome(lista, nome, pedido);
  if (achados.length === 0) throw new Error(`${rotulo} "${pedido}" não encontrad${genero}.`);
  const minusculo = rotulo.toLowerCase();
  if (achados.length > 1) {
    return { mensagem: `Mais de um${genero === "a" ? "a" : ""} ${minusculo} com "${pedido}": ${achados.slice(0, 20).map(nome).join(", ")}. Nada foi feito; diga qual.` };
  }
  const item = achados[0];
  if (igual(nome(item), pedido)) return { item };
  return { mensagem: `Achei só ${genero} ${minusculo} "${nome(item)}" para "${pedido}". É esse? Nada foi feito; repita com o título completo.` };
}

// ---------- tentativa ----------

export type TentativaAchada = { id: string; simuladoId: string; titulo: string; status: string; iniciadaEm: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const situacao = (t: TentativaAchada) => (t.status === "em_andamento" ? "em andamento" : "entregue");

export type PedidoTentativa = {
  /** Título (ou parte) do simulado; um uuid aqui também vale como id. */
  simulado?: string;
  simuladoId?: string;
  /** Só tentativas neste status (encerrar → em_andamento; recorrigir → entregue; liberar → qualquer). */
  status?: "em_andamento" | "entregue";
};

/**
 * A tentativa do aluno no simulado pedido. Filtra pelo id ou pelo título e depois pelo status que faz
 * sentido para a ação. Só escolhe sozinha quando sobra exatamente uma e o pedido foi o id ou o título
 * igual; senão (mesmo título em dois simulados, como dois "Treino de dd/mm/aaaa", ou título só
 * parecido) devolve as opções com o simulado_id, e nada é feito.
 */
export function escolherTentativa(lista: TentativaAchada[], pedido: PedidoTentativa): { tentativa: TentativaAchada } | { mensagem: string } {
  const texto = pedido.simulado?.trim() ?? "";
  const id = pedido.simuladoId?.trim() || (UUID.test(texto) ? texto : "");
  if (!id && !texto) throw new Error("Informe o simulado (título) ou o simulado_id.");
  const porTitulo = id ? [] : acharPorNome(lista, (t) => t.titulo, texto);
  const doPedido = id ? lista.filter((t) => t.simuladoId.toLowerCase() === id.toLowerCase()) : porTitulo;
  const onde = id ? "nesse simulado" : `no simulado "${texto}"`;
  if (doPedido.length === 0) throw new Error(`O aluno não tem tentativa ${onde}.`);
  const achadas = pedido.status ? doPedido.filter((t) => t.status === pedido.status) : doPedido;
  if (achadas.length === 0) throw new Error(`O aluno não tem tentativa ${pedido.status === "em_andamento" ? "em andamento" : "entregue"} ${onde}.`);
  if (achadas.length === 1) {
    const t = achadas[0];
    if (id || igual(t.titulo, texto)) return { tentativa: t };
    return { mensagem: `Achei só "${t.titulo}" para "${texto}" (${situacao(t)}, iniciada em ${dataHoraBR(t.iniciadaEm)}). É esse? Nada foi feito; repita com o título completo ou o simulado_id ${t.simuladoId}.` };
  }
  const recentes = [...achadas].sort((a, b) => b.iniciadaEm.localeCompare(a.iniciadaEm));
  const opcoes = recentes.map((t) => `- ${t.titulo} · ${situacao(t)} · iniciada em ${dataHoraBR(t.iniciadaEm)} · simulado_id ${t.simuladoId}`);
  return { mensagem: `Qual simulado? Achei ${achadas.length} tentativas com "${texto || id}". Nada foi feito; repita com o simulado_id.\n${limitarLinhas(opcoes, 30, "Use o título completo.").join("\n")}` };
}

// ---------- textos ----------

export type Credencial = { nome: string; usuario: string; senha: string; turma: string };

/** Credenciais geradas, uma por linha (as senhas só vão nesta resposta). */
export function textoCredenciais(credenciais: Credencial[], ignorados: string[] = []): string {
  const partes: string[] = [];
  if (credenciais.length === 0) partes.push("Nenhuma conta foi criada.");
  else {
    const n = credenciais.length;
    const turma = credenciais[0].turma;
    partes.push(`${n} ${n === 1 ? "conta criada" : "contas criadas"} na turma ${turma}. Senhas provisórias (o aluno troca no primeiro acesso); passe a cada aluno e não repita depois:`);
    for (const c of credenciais) partes.push(`- ${c.nome} — usuário ${c.usuario} · senha ${c.senha}`);
  }
  if (ignorados.length > 0) partes.push(`Já tinham conta ligada (ignorados): ${ignorados.join(", ")}.`);
  return partes.join("\n");
}

export type LinhaPrevia = { nome: string; usuario: string; alunoId: string; possivelContaExistente: boolean };

/** Prévia de "criar contas da planilha": quem receberia conta e quem fica de fora por já haver conta com o nome. */
export function textoPreviaPlanilha(turma: string, linhas: LinhaPrevia[]): string {
  if (linhas.length === 0) return `Todos os alunos da planilha de ${turma} já têm conta ligada.`;
  const criar = linhas.filter((l) => !l.possivelContaExistente);
  const fora = linhas.filter((l) => l.possivelContaExistente);
  const partes = [
    criar.length === 0
      ? `Nenhum aluno da planilha de ${turma} receberia conta agora.`
      : `${criar.length} ${criar.length === 1 ? "aluno" : "alunos"} da planilha de ${turma} receberia${criar.length === 1 ? "" : "m"} conta:`,
    ...limitarLinhas(criar.map((l) => `- ${l.nome} (usuário ${l.usuario})`), 100, "A lista continua."),
  ];
  if (fora.length > 0) {
    partes.push(`Ficam de fora (já há conta sem ligação com o mesmo nome): ${fora.map((l) => l.nome).join(", ")}. Use ligar_contas_pelo_nome ou ligar_conta.`);
  }
  if (criar.length > 0) partes.push("Para criar, chame de novo com criar: true (depois de confirmar).");
  return partes.join("\n");
}

export type PreviaLigacoesTexto = {
  ligar: { contaId: string; alunoId: string; nomeConta: string; nomeAluno: string }[];
  repetidos: { nome: string; contas: number; alunos: number }[];
  semPar: string[];
};

/** Prévia (ou resultado) de "ligar pelo nome". */
export function textoPreviaLigacoes(turma: string, p: PreviaLigacoesTexto, aplicado: boolean): string {
  const n = p.ligar.length;
  const partes = [
    n === 0
      ? `Nenhuma conta de ${turma} pode ser ligada pelo nome agora.`
      : aplicado
        ? `${n} ${n === 1 ? "conta ligada" : "contas ligadas"} à planilha de ${turma}:`
        : `${n} ${n === 1 ? "conta seria ligada" : "contas seriam ligadas"} à planilha de ${turma}:`,
    ...limitarLinhas(p.ligar.map((l) => `- ${l.nomeConta} → ${l.nomeAluno}`), 100, "A lista continua."),
  ];
  for (const r of p.repetidos) {
    partes.push(`- ${r.nome} (${r.contas} ${r.contas === 1 ? "conta" : "contas"}, ${r.alunos} ${r.alunos === 1 ? "aluno" : "alunos"}): nome repetido: ligue à mão (ligar_conta).`);
  }
  if (p.semPar.length > 0) partes.push(`Sem par na planilha: ${p.semPar.join(", ")}.`);
  if (!aplicado && n > 0) partes.push("Para ligar, chame de novo com aplicar: true (depois de confirmar).");
  return partes.join("\n");
}
