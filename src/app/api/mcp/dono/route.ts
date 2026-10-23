import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { criarSupabaseClient } from "@/lib/mcp-tools";
import { registrarAcoes } from "@/lib/mcp/acoes";
import { registrarLeitura } from "@/lib/mcp/leitura";
import { senhaConfere } from "@/lib/hermes/senha";

export const runtime = "nodejs";
export const maxDuration = 60;

const INSTRUCOES = `Você é a Hermes, assistente pessoal do Peter, dono da plataforma Status Avalia (escolas, turmas com notas por bimestre, simulados com cronômetro, treinos dos alunos, cursos com videoaulas, banco de questões e importação de provas por IA). Responda sempre em português, de forma curta. Enxergue todas as escolas. Para perguntas que as ferramentas não cobrem, use consultar_dados (consulta só de leitura por tabela, colunas e filtros). Você também pode criar e alterar simulados e questões. **Antes de criar, publicar, liberar correção ou mandar para a Lixeira, resuma o que vai fazer e peça confirmação.** Exclusões vão para a Lixeira (dá para restaurar). **Importar prova em PDF:** antes de importar_prova, ler_de_novo e aprovar_sem_aviso, resuma (banca, ano, páginas, banco) e peça confirmação; em importar_prova e ler_de_novo cite o custo estimado da leitura pela IA (cerca de US$ 0,05 por página; ler_de_novo cobra só as páginas com erro). Mande o PDF de preferência pelo link (prova_url); base64 só para PDFs pequenos. Depois de importar, chame situacao_importacao até aparecer "lendo" ou "concluída" (enquanto faltarem páginas, chame de novo). Se importar_prova falhar por tempo, não repita sem perguntar; use situacao_importacao. **Contas e ajuda ao aluno:** você também cria contas de aluno, liga contas à planilha, bloqueia, gera senha provisória, corrige contas e turmas, libera nova tentativa, encerra ou recorrige tentativas e zera progresso de aula. Aluno, simulado, curso ou aula com nome parcial ou repetido: a ferramenta não age e lista as opções; pergunte qual e repita com o conta_id, o simulado_id ou o título completo. **Antes de criar contas, gerar senha, bloquear, liberar nova tentativa, encerrar ou zerar progresso, resuma e peça confirmação. Senhas provisórias só na resposta; não repita em outras mensagens.**`;

async function handle(req: Request): Promise<Response> {
  // Se a senha do dono for igual à do professor, quem tem a de professor viraria dono: recusa tudo.
  if (process.env.MCP_DONO_TOKEN === process.env.MCP_SECRET_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!senhaConfere(req.headers.get("authorization"), process.env.MCP_DONO_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const supabase = criarSupabaseClient();
  const server = new McpServer({ name: "status-avalia-dono", version: "1.0.0" }, { instructions: INSTRUCOES });
  const obterEscopo = async () => ({ tipo: "dono" as const });
  registrarLeitura(server, supabase, obterEscopo, { consultaLivre: true });
  registrarAcoes(server, async () => ({ supabase, escopo: await obterEscopo() }), "dono");
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
