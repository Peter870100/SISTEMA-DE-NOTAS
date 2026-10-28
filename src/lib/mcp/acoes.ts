import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ObterCtx } from "./leitura/comum";
import { registrarAcoesAjuda } from "./acoes/ajuda";
import { registrarAcoesContas } from "./acoes/contas";
import { registrarAcoesCursos } from "./acoes/cursos";
import { registrarAcoesGeracao } from "./acoes/geracao";
import { registrarAcoesImportacao } from "./acoes/importacao";
import { registrarAcoesProfessores } from "./acoes/professores";
import { registrarAcoesQuestoes } from "./acoes/questoes";
import { registrarAcoesSimulados } from "./acoes/simulados";
import type { Perfil } from "./acoes/ator";

/**
 * Ferramentas de escrita da Hermes (Etapa B): simulados, questões e importação de provas em PDF.
 * Etapa C1, só no perfil dono: contas de aluno e ajuda ao aluno (tentativas e progresso de aula).
 * Etapa C2, só no perfil dono: professores (papel, acesso às turmas, telefone e senha provisória).
 * Também no dono: cursos (publicar aula e turmas do curso).
 * Cada uma resolve o ator na escola do item (`atorDoEscopo`), registra em `hermes_registro`
 * e chama as mesmas funções do núcleo que a tela usa.
 */
export function registrarAcoes(server: McpServer, obter: ObterCtx, perfil: Perfil) {
  registrarAcoesSimulados(server, obter, perfil);
  registrarAcoesQuestoes(server, obter, perfil);
  registrarAcoesImportacao(server, obter, perfil);
  registrarAcoesGeracao(server, obter, perfil);
  if (perfil === "dono") {
    registrarAcoesContas(server, obter, perfil);
    registrarAcoesAjuda(server, obter, perfil);
    registrarAcoesProfessores(server, obter, perfil);
    registrarAcoesCursos(server, obter, perfil);
  }
}
