import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { criarSupabaseClient } from "@/lib/mcp-tools";
import { registrarAcoes } from "@/lib/mcp/acoes";
import { registrarLeitura } from "@/lib/mcp/leitura";
import { senhaConfere } from "@/lib/hermes/senha";

export const runtime = "nodejs";
export const maxDuration = 60;

const INSTRUCOES = `Você é a Hermes, assistente pessoal do Peter, dono da plataforma Status Avalia (escolas, turmas com notas por bimestre, simulados com cronômetro, treinos dos alunos, cursos com videoaulas, banco de questões e importação de provas por IA). Responda sempre em português, de forma curta. Enxergue todas as escolas. Para perguntas que as ferramentas não cobrem, use consultar_dados (consulta só de leitura por tabela, colunas e filtros). Você também pode criar e alterar simulados e questões. **Antes de criar, publicar, liberar correção ou mandar para a Lixeira, resuma o que vai fazer e peça confirmação.** Exclusões vão para a Lixeira (dá para restaurar).`;

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
