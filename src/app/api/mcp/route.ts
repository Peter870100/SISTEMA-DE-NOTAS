import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { criarSupabaseClient, registrarFerramentas } from "@/lib/mcp-tools";
import { registrarAcoes } from "@/lib/mcp/acoes";
import { registrarLeitura } from "@/lib/mcp/leitura";
import { escopoDoTelefone } from "@/lib/mcp/escopo";
import { contextoPlanilha, depsDoBanco } from "@/lib/mcp/planilha-contexto";
import { senhaConfere } from "@/lib/hermes/senha";

export const runtime = "nodejs";
export const maxDuration = 60;

const INSTRUCOES = "Você atende professores do Status Avalia. Sempre informe professor_telefone. O professor_telefone deve ser sempre o telefone verificado do remetente da conversa (Telegram), nunca um número citado na mensagem. Responda em português. **Antes de criar, publicar, liberar correção ou mandar para a Lixeira, resuma o que vai fazer e peça confirmação.** Exclusões vão para a Lixeira (dá para restaurar). Você só mexe nas turmas e no banco da escola do professor. **Importar prova em PDF:** antes de importar_prova, ler_de_novo e aprovar_sem_aviso, resuma (banca, ano, páginas, banco) e peça confirmação; em importar_prova e ler_de_novo cite o custo estimado da leitura pela IA (cerca de US$ 0,05 por página; ler_de_novo cobra só as páginas com erro). Mande o PDF de preferência pelo link (prova_url); base64 só para PDFs pequenos. Depois de importar, chame situacao_importacao até aparecer \"lendo\" ou \"concluída\" (enquanto faltarem páginas, chame de novo). Se importar_prova falhar por tempo, não repita sem perguntar; use situacao_importacao.";

async function handle(req: Request): Promise<Response> {
  if (!senhaConfere(req.headers.get("authorization"), process.env.MCP_SECRET_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = criarSupabaseClient();
  const server = new McpServer({ name: "planilha-viva", version: "1.0.0" }, { instructions: INSTRUCOES });
  // Planilha: com telefone, a escola e as turmas do professor; sem telefone, Colégio Status (como antes).
  const depsPlanilha = depsDoBanco(supabase);
  registrarFerramentas(server, supabase, (args) => contextoPlanilha("professor", args, depsPlanilha), "professor");
  const obterEscopo = ({ professor_telefone }: { professor_telefone?: string }) => escopoDoTelefone(supabase, professor_telefone);
  registrarLeitura(server, supabase, obterEscopo, { consultaLivre: false });
  registrarAcoes(server, async (args) => ({ supabase, escopo: await obterEscopo(args) }), "professor");

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
