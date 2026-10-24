import { normalizarBusca } from "@/lib/hermes/relatorios";
import type { TurmaSimulado } from "@/lib/simulados/configuracao";
import { acharPorNome } from "../leitura/comum";
import { resolverTurmas } from "./ator";

/**
 * Regras puras das ferramentas de cursos da Hermes (perfil dono): escolha do curso e da aula pelo
 * título (exato, ou pergunta) e das turmas do curso. Sem banco, para testar com `tsx --test`.
 */

type Opcoes<T> = {
  /** "Curso", "Aula" */
  rotulo: string;
  genero: "o" | "a";
  titulo: (x: T) => string;
  /** O que ajuda a distinguir dois itens de mesmo título (escola, módulo). */
  detalhe: (x: T) => string;
  /** Nome do parâmetro de id, para orientar a repetição do pedido. */
  campoId: string;
};

/**
 * Um item pelo id, ou pelo título. Título exato único → o item. Título só parecido, ou repetido →
 * `mensagem` com as opções (e os ids), e nada é feito. Nenhum → erro. Pura.
 */
export function escolherPorTitulo<T extends { id: string }>(lista: T[], pedido: { nome?: string; id?: string }, o: Opcoes<T>): { item: T } | { mensagem: string } {
  const nao = `${o.rotulo} não encontrad${o.genero}.`;
  if (pedido.id) {
    const item = lista.find((x) => x.id === pedido.id);
    if (!item) throw new Error(nao);
    return { item };
  }
  const nome = pedido.nome?.trim() ?? "";
  if (!nome) throw new Error(`Informe ${o.genero === "o" ? "o" : "a"} ${o.rotulo.toLowerCase()} (título) ou o ${o.campoId}.`);
  const achados = acharPorNome(lista, o.titulo, nome);
  if (achados.length === 0) throw new Error(`${o.rotulo} "${nome}" não encontrad${o.genero}.`);
  const iguais = achados.filter((x) => normalizarBusca(o.titulo(x)) === normalizarBusca(nome));
  if (iguais.length === 1) return { item: iguais[0] };
  const opcoes = (iguais.length ? iguais : achados).slice(0, 20).map((x) => `${o.titulo(x)} (${o.detalhe(x)}; ${o.campoId}: ${x.id})`).join("; ");
  if (iguais.length === 0 && achados.length === 1) {
    return { mensagem: `Achei só ${o.genero} ${o.rotulo.toLowerCase()} ${opcoes} para "${nome}". É ${o.genero === "o" ? "esse" : "essa"}? Nada foi feito; repita com o título completo.` };
  }
  return { mensagem: `Mais de ${o.genero === "o" ? "um" : "uma"} ${o.rotulo.toLowerCase()} com "${nome}": ${opcoes}. Nada foi feito; repita com o ${o.campoId}.` };
}

export type CursoLido = { id: string; titulo: string; escolaId: string; escolaNome: string };
export type AulaLida = { id: string; titulo: string; moduloTitulo: string; publicada: boolean };

export const escolherCurso = (lista: CursoLido[], pedido: { nome?: string; id?: string }, variasEscolas: boolean) =>
  escolherPorTitulo(lista, pedido, { rotulo: "Curso", genero: "o", titulo: (c) => c.titulo, detalhe: (c) => (variasEscolas ? c.escolaNome : "curso"), campoId: "curso_id" });

export const escolherAula = (lista: AulaLida[], pedido: { nome?: string; id?: string }) =>
  escolherPorTitulo(lista, pedido, { rotulo: "Aula", genero: "a", titulo: (a) => a.titulo, detalhe: (a) => `módulo ${a.moduloTitulo}`, campoId: "aula_id" });

export type ModoTurmas = "substituir" | "adicionar" | "remover";

const chave = (t: TurmaSimulado) => `${t.turma_nome}|${t.ano_letivo}`;
export const rotuloTurma = (t: TurmaSimulado) => `${t.turma_nome} · ${t.ano_letivo}`;

/**
 * Lista final de turmas do curso. `adicionar` junta aos vínculos atuais; `remover` tira (nome sem ano
 * tira todos os anos daquele nome entre os vínculos atuais); `substituir` usa só as pedidas. Lista
 * pedida vazia, ou `remover` que tiraria todas as turmas, só vale com `desvincularTodas`. `implicitas` = turmas cujo ano
 * foi escolhido pelo sistema (o mais recente), para avisar na resposta. Pura.
 */
export function turmasFinaisDoCurso(
  atuais: TurmaSimulado[],
  pedidos: PedidoTurmaCurso[],
  turmasEscola: { nome: string; ano_letivo: string }[],
  modo: ModoTurmas,
  desvincularTodas = false,
): { final: TurmaSimulado[]; implicitas: TurmaSimulado[] } {
  if (pedidos.length === 0) {
    if (!desvincularTodas) throw new Error("Lista de turmas vazia desvincularia o curso de todas as turmas e o esconderia dos alunos. Se é isso mesmo, repita com desvincular_todas: true.");
    return { final: [], implicitas: [] };
  }
  if (modo === "remover") {
    const sobra = new Map(atuais.map((t) => [chave(t), t]));
    for (const p of pedidos) {
      const ano = p.ano_letivo?.trim();
      const alvos = atuais.filter((t) => normalizarBusca(t.turma_nome) === normalizarBusca(p.nome) && (!ano || t.ano_letivo === ano));
      if (alvos.length === 0) throw new Error(`O curso não está ligado à turma "${p.nome}"${ano ? ` em ${ano}` : ""}. Turmas atuais: ${atuais.map(rotuloTurma).join(", ") || "nenhuma"}.`);
      for (const t of alvos) sobra.delete(chave(t));
    }
    if (sobra.size === 0 && !desvincularTodas) {
      throw new Error("Remover essas turmas desvincularia o curso de todas as turmas e o esconderia dos alunos. Se é isso mesmo, repita com desvincular_todas: true.");
    }
    return { final: [...sobra.values()], implicitas: [] };
  }
  const resolvidas = turmasDoCursoPedidas(pedidos, turmasEscola);
  const implicitas = pedidos.filter((p) => !p.ano_letivo?.trim())
    .flatMap((p) => resolvidas.filter((t) => normalizarBusca(t.turma_nome) === normalizarBusca(p.nome)));
  const base = modo === "adicionar" ? atuais : [];
  const mapa = new Map([...base, ...resolvidas].map((t) => [chave(t), t]));
  return { final: [...mapa.values()], implicitas };
}

export type PedidoTurmaCurso ={ nome: string; ano_letivo?: string };

/**
 * Turmas pedidas → turma + ano letivo, só da escola do curso. Nome exato (um nome só parecido vira
 * `Pergunta`); sem ano, o mais recente daquele nome; nome ou ano que não existem → erro com a lista
 * de turmas da escola. Pura.
 */
export function turmasDoCursoPedidas(pedidos: PedidoTurmaCurso[], turmasEscola: { nome: string; ano_letivo: string }[]): TurmaSimulado[] {
  const saida = new Map<string, TurmaSimulado>();
  for (const p of pedidos) {
    const ano = p.ano_letivo?.trim();
    const achadas = ano
      ? turmasEscola.filter((t) => normalizarBusca(t.nome) === normalizarBusca(p.nome) && t.ano_letivo === ano)
      : [];
    const resolvidas = ano
      ? (() => {
          if (achadas.length === 0) {
            const nomes = [...new Set(turmasEscola.map((t) => `${t.nome} · ${t.ano_letivo}`))].sort((a, b) => a.localeCompare(b, "pt-BR"));
            throw new Error(`Turma não encontrada: "${p.nome}" em ${ano}. Turmas da escola: ${nomes.join(", ") || "nenhuma"}.`);
          }
          return [{ turma_nome: achadas[0].nome, ano_letivo: achadas[0].ano_letivo }];
        })()
      : resolverTurmas([p.nome], turmasEscola, null, { exato: true });
    for (const t of resolvidas) saida.set(`${t.turma_nome}|${t.ano_letivo}`, t);
  }
  return [...saida.values()];
}
