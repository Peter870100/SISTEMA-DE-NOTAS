import Link from "next/link";
import { cadastrar } from "@/actions/cadastro";

type CadastroPageProps = {
  searchParams: Promise<{ erro?: string; enviado?: string }>;
};

const MENSAGENS_ERRO: Record<string, string> = {
  codigo: "Código de convite inválido.",
  campos: "Preencha nome, email e senha.",
  duplicado: "Esse email já tem uma conta confirmada. Tente entrar em vez de se cadastrar.",
  falha: "Não foi possível criar a conta. Tente novamente.",
  email: "Conta criada, mas não conseguimos enviar o email de confirmação. Tente se cadastrar de novo.",
};

export default async function CadastroPage({ searchParams }: CadastroPageProps) {
  const { erro, enviado } = await searchParams;

  if (enviado) {
    return (
      <main className="flex flex-1 items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-900">Quase lá!</h1>
          <p className="mt-3 text-sm text-neutral-600">
            Enviamos um email de confirmação. Clique no link que chegou na sua caixa de entrada
            pra ativar sua conta.
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
            Voltar para o login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-neutral-100 px-4">
      <form
        action={cadastrar}
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-neutral-900">Criar conta</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Peça o código de convite pra quem administra o sistema.
        </p>

        {erro && (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {MENSAGENS_ERRO[erro] ?? "Não foi possível criar a conta."}
          </p>
        )}

        <input
          name="nome"
          autoFocus
          placeholder="Nome"
          className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          className="mt-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <input
          type="password"
          name="senha"
          placeholder="Senha"
          className="mt-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <input
          name="codigo"
          inputMode="numeric"
          placeholder="Código de convite"
          className="mt-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />

        <button
          type="submit"
          className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700"
        >
          Criar conta
        </button>

        <Link href="/login" className="mt-3 block text-center text-sm text-neutral-500 hover:underline">
          Já tenho conta
        </Link>
      </form>
    </main>
  );
}
