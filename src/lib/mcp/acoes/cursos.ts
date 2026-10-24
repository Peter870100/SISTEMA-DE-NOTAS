import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { publicarAulaPor, turmasDoCursoPor } from "@/lib/aulas/cursos-nucleo";
import { campoEscola, campoTelefone, escolasDoPedido, lerTodas, texto, type Ctx, type ObterCtx } from "../leitura/comum";
import { atorDoEscopo, campoId, falha, registrado, type Perfil } from "./ator";
import { parametrosParaRegistro } from "./contas-regras";
import { escolherAula, escolherCurso, rotuloTurma, turmasFinaisDoCurso, type AulaLida, type CursoLido } from "./cursos-regras";

/**
 * Ferramentas de cursos da Hermes (só no perfil dono): publicar/despublicar aula e escolher as turmas
 * do curso. Chamam o núcleo de `src/lib/aulas/cursos-nucleo.ts` (o mesmo da tela) com o dono como
 * ator na escola do curso.
 */

const campoCurso = {
  curso: z.string().trim().max(200).optional().describe("Título do curso. Título parcial ou repetido não age: a resposta lista para escolher e você repete com o curso_id."),
  curso_id: campoId("Id do curso (use quando o título se repetir).").optional(),
  ...campoEscola,
};

/** Acha o curso pelo id ou título nas escolas do pedido. */
async function acharCurso(ctx: Ctx, args: { curso?: string; curso_id?: string; escola?: string }): Promise<{ curso: CursoLido } | { mensagem: string }> {
  const escolas = await escolasDoPedido(ctx, args.escola);
  const ids = escolas.map((e) => e.id);
  const linhas = await lerTodas<{ id: string; titulo: string; escola_id: string }>((de, ate) =>
    ctx.supabase.from("cursos").select("id, titulo, escola_id").in("escola_id", ids).order("titulo").order("id").range(de, ate));
  const lista: CursoLido[] = linhas.map((c) => ({ id: c.id, titulo: c.titulo, escolaId: c.escola_id, escolaNome: escolas.find((e) => e.id === c.escola_id)?.nome ?? "?" }));
  const r = escolherCurso(lista, { nome: args.curso, id: args.curso_id }, escolas.length > 1);
  return "item" in r ? { curso: r.item } : r;
}

export function registrarAcoesCursos(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  server.registerTool(
    "publicar_aula",
    {
      title: "Publicar ou despublicar aula",
      description: "Publica (publicar: true) ou despublica (false) uma aula de um curso, com as mesmas regras da tela: aula de vídeo só publica com a duração registrada. Curso e aula pelo título exato; título parcial ou repetido só lista as opções. Antes, resuma e peça confirmação.",
      inputSchema: {
        ...campoCurso,
        aula: z.string().trim().max(200).optional().describe("Título da aula."),
        aula_id: campoId("Id da aula (use quando o título se repetir).").optional(),
        publicar: z.boolean().describe("true publica; false despublica."),
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const achado = await acharCurso(ctx, args);
        if ("mensagem" in achado) return texto(achado.mensagem);
        const { curso } = achado;
        const modulos = await lerTodas<{ id: string; titulo: string }>((de, ate) =>
          ctx.supabase.from("modulos").select("id, titulo").eq("curso_id", curso.id).order("id").range(de, ate));
        const aulasLidas = await lerTodas<{ id: string; titulo: string; modulo_id: string; publicada: boolean }>((de, ate) =>
          ctx.supabase.from("aulas").select("id, titulo, modulo_id, publicada").eq("curso_id", curso.id).order("ordem").order("id").range(de, ate));
        const aulas: AulaLida[] = aulasLidas.map((a) => ({ id: a.id, titulo: a.titulo, moduloTitulo: modulos.find((m) => m.id === a.modulo_id)?.titulo ?? "?", publicada: a.publicada }));
        const escolhida = escolherAula(aulas, { nome: args.aula, id: args.aula_id });
        if ("mensagem" in escolhida) return texto(escolhida.mensagem);
        const { item: aula } = escolhida;
        const ator = await atorDoEscopo(ctx, curso.escolaId);
        await registrado(perfil, ator, "publicar_aula", { ...parametrosParaRegistro(args), curso_id: curso.id, aula_id: aula.id }, () => publicarAulaPor(ator, aula.id, args.publicar));
        return texto(`Aula "${aula.titulo}" (curso ${curso.titulo}) ${args.publicar ? "publicada" : "despublicada"}.`);
      } catch (e) {
        return falha("alterar a publicação da aula", e);
      }
    },
  );

  server.registerTool(
    "turmas_do_curso",
    {
      title: "Turmas do curso",
      description: 'Muda as turmas para as quais o curso aparece. modo "adicionar" (padrão) junta as turmas informadas às atuais; "remover" tira; "substituir" troca a lista inteira. Lista vazia é recusada, a menos que desvincular_todas: true (o curso some para os alunos). Só turmas da escola do curso, por nome exato; sem ano_letivo vale o mais recente daquele nome. Curso pelo título exato; título parcial ou repetido só lista as opções. A resposta mostra antes e depois. Antes, resuma e peça confirmação.',
      inputSchema: {
        ...campoCurso,
        turmas: z.array(z.object({
          nome: z.string().trim().min(1).max(100),
          ano_letivo: z.string().trim().max(10).optional(),
        })).max(50).describe("Turmas a adicionar, remover ou que formam a nova lista, conforme o modo."),
        modo: z.enum(["substituir", "adicionar", "remover"]).optional().describe('"adicionar" (padrão), "remover" ou "substituir" (troca a lista inteira).'),
        desvincular_todas: z.boolean().optional().describe("Só com turmas vazia: confirma desvincular o curso de todas as turmas."),
        ...campoTelefone,
      },
    },
    async (args) => {
      try {
        const ctx = await obter(args);
        const achado = await acharCurso(ctx, args);
        if ("mensagem" in achado) return texto(achado.mensagem);
        const { curso } = achado;
        const turmasEscola = await lerTodas<{ nome: string; ano_letivo: string }>((de, ate) =>
          ctx.supabase.from("turmas").select("nome, ano_letivo").eq("escola_id", curso.escolaId).order("nome").order("ano_letivo").range(de, ate));
        const atuaisLidas = await lerTodas<{ turma_nome: string; ano_letivo: string }>((de, ate) =>
          ctx.supabase.from("curso_turmas").select("turma_nome, ano_letivo").eq("curso_id", curso.id).order("turma_nome").order("ano_letivo").range(de, ate));
        const atuais = atuaisLidas.map((t) => ({ turma_nome: t.turma_nome, ano_letivo: t.ano_letivo }));
        const modo = args.modo ?? "adicionar";
        const { final, implicitas } = turmasFinaisDoCurso(atuais, args.turmas, turmasEscola, modo, args.desvincular_todas);
        const ator = await atorDoEscopo(ctx, curso.escolaId);
        // `turmas_antes` no registro permite restaurar a lista anterior.
        await registrado(perfil, ator, "turmas_do_curso", { ...parametrosParaRegistro(args), curso_id: curso.id, modo, turmas_antes: atuais }, () => turmasDoCursoPor(ator, curso.id, final));
        const lista = (ts: { turma_nome: string; ano_letivo: string }[]) => ts.map(rotuloTurma).join(", ") || "nenhuma";
        const aviso = implicitas.length ? `\nAno letivo mais recente usado em: ${lista(implicitas)}.` : "";
        return texto(`Curso ${curso.titulo} (${curso.escolaNome}), modo ${modo}.\nAntes: ${lista(atuais)}.\nDepois: ${lista(final)}.${aviso}`);
      } catch (e) {
        return falha("definir as turmas do curso", e);
      }
    },
  );
}
