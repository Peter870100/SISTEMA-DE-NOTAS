import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { criarSupabaseClient, registrarFerramentas } from "../src/lib/mcp-tools";

const supabase = criarSupabaseClient();
const server = new McpServer({ name: "planilha-viva", version: "1.0.0" });
registrarFerramentas(server, supabase);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
