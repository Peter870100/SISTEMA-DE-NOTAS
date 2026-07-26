import { login } from "@/actions/auth";

type LoginPageProps = {
  searchParams: Promise<{ erro?: string }>;
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
        <p className="mt-1 text-sm text-neutral-500">Digite a senha de acesso.</p>

        {erro && (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Senha incorreta. Tente novamente.
          </p>
        )}

        <input
          type="password"
          name="senha"
          autoFocus
          placeholder="Senha"
          className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />

        <button
          type="submit"
          className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
