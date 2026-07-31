import Link from "next/link";
import { login } from "@/actions/auth";

type LoginPageProps = {
  searchParams: Promise<{ erro?: string }>;
};

const MENSAGENS_ERRO: Record<string, string> = {
  "1": "Email ou senha incorretos. Tente novamente.",
  "nao-verificado": "Confirme seu email antes de entrar — veja sua caixa de entrada.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { erro } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center bg-neutral-100 px-4">
      <form
        action={login}
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-neutral-900">Planilha Viva</h1>
        <p className="mt-1 text-sm text-neutral-500">Entre com seu email e senha.</p>

        {erro && (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {MENSAGENS_ERRO[erro] ?? "Não foi possível entrar. Tente novamente."}
          </p>
        )}

        <input
          type="email"
          name="email"
          autoFocus
          placeholder="Email"
          className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />

        <input
          type="password"
          name="senha"
          placeholder="Senha"
          className="mt-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />

        <button
          type="submit"
          className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700"
        >
          Entrar
        </button>

        <Link href="/cadastro" className="mt-3 block text-center text-sm text-neutral-500 hover:underline">
          Não tem conta? Cadastre-se
        </Link>
      </form>
    </main>
  );
}
