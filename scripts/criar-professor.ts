import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { Database } from "../src/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local");
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

const [nome, emailBruto, senha, roleBruto = "admin"] = process.argv.slice(2);

async function main() {
  if (!nome || !emailBruto || !senha) {
    console.error(
      'Uso: npm run criar-professor -- "Nome Completo" "email@exemplo.com" "senha" [admin|professor]'
    );
    process.exit(1);
  }
  const email = emailBruto.trim().toLowerCase();
  const role = roleBruto.trim();
  if (role !== "admin" && role !== "professor") {
    throw new Error('Papel precisa ser "admin" ou "professor".');
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const { data, error } = await supabase
    .from("professores")
    .insert({ nome: nome.trim(), email, senha_hash: senhaHash, role })
    .select("id, nome, email, role")
    .single();

  if (error) throw new Error(error.message);
  console.log(`Professor criado: ${data.nome} <${data.email}> (${data.role})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
