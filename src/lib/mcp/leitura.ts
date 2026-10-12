import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Escopo } from "./escopo";
import type { ObterCtx } from "./leitura/comum";
import { registrarAlunos } from "./leitura/alunos";
import { registrarBanco } from "./leitura/banco";
import { registrarConsulta } from "./leitura/consulta";
import { registrarCursos } from "./leitura/cursos";
import { registrarGeral } from "./leitura/geral";
import { registrarSimulados } from "./leitura/simulados";
import { registrarTurmas } from "./leitura/turmas";

/**
 * Registra as ferramentas de leitura da Hermes (Etapa A: nada aqui altera dados).
 * `obterEscopo` decide o alcance a cada chamada: no servidor do dono devolve { tipo: "dono" };
 * no dos professores, resolve o professor pelo telefone (escopoDoTelefone).
 * `consultaLivre` liga a consulta estruturada consultar_dados (só no servidor do dono).
 */
export function registrarLeitura(
  server: McpServer,
  supabase: SupabaseClient,
  obterEscopo: (args: { professor_telefone?: string }) => Promise<Escopo>,
  opcoes: { consultaLivre: boolean },
) {
  const obter: ObterCtx = async (args) => ({ supabase, escopo: await obterEscopo(args) });
  registrarGeral(server, obter);
  registrarSimulados(server, obter);
  registrarTurmas(server, obter);
  registrarCursos(server, obter);
  registrarBanco(server, obter);
  registrarAlunos(server, obter);
  if (opcoes.consultaLivre) registrarConsulta(server, obter);
}
