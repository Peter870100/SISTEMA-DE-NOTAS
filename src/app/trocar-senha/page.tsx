import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { trocarSenha } from "@/actions/auth";

type TrocarSenhaPageProps = {
  searchParams: Promise<{ erro?: string }>;
};

const MENSAGENS_ERRO: Record<string, string> = {
  "senha-atual": "Senha atual incorreta.",
  curta: "A nova senha precisa ter pelo menos 6 caracteres.",
  confirmacao: "A confirmação não bate com a nova senha.",
  falha: "Não foi possível trocar a senha. Tente novamente.",
};

export default async function TrocarSenhaPage({ searchParams }: TrocarSenhaPageProps) {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");

  const { erro } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center bg-neutral-100 px-4">
      <form
        action={trocarSenha}
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-neutral-900">Trocar senha</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {professor.senha_provisoria
            ? "Sua senha foi definida por um administrador. Escolha uma nova senha pra continuar."
            : "Escolha uma nova senha pra sua conta."}
        </p>

        {erro && (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {MENSAGENS_ERRO[erro] ?? "Não foi possível trocar a senha."}
          </p>
        )}

        <input
          type="password"
          name="senhaAtual"
          autoFocus
          placeholder="Senha atual"
          className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <input
          type="password"
          name="novaSenha"
          placeholder="Nova senha"
          className="mt-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <input
          type="password"
          name="confirmarSenha"
          placeholder="Confirmar nova senha"
          className="mt-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />

        <button
          type="submit"
          className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700"
        >
          Trocar senha
        </button>
      </form>
    </main>
  );
}
