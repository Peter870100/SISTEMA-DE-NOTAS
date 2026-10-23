import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ObterCtx } from "./leitura/comum";
import { registrarAcoesAjuda } from "./acoes/ajuda";
import { registrarAcoesContas } from "./acoes/contas";
import { registrarAcoesImportacao } from "./acoes/importacao";
import { registrarAcoesQuestoes } from "./acoes/questoes";
import { registrarAcoesSimulados } from "./acoes/simulados";
import type { Perfil } from "./acoes/ator";

/**
 * Ferramentas de escrita da Hermes (Etapa B): simulados, questões e importação de provas em PDF.
 * Etapa C1, só no perfil dono: contas de aluno e ajuda ao aluno (tentativas e progresso de aula).
 * Cada uma resolve o ator na escola do item (`atorDoEscopo`), registra em `hermes_registro`
 * e chama as mesmas funções do núcleo que a tela usa.
 */
export function registrarAcoes(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  registrarAcoesSimulados(server, obter, perfil);
  registrarAcoesQuestoes(server, obter, perfil);
  registrarAcoesImportacao(server, obter, perfil);
  if (perfil === "dono") {
    registrarAcoesContas(server, obter, perfil);
    registrarAcoesAjuda(server, obter, perfil);
  }
}
