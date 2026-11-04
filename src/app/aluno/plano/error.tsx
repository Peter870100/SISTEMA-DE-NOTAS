"use client";

export default function ErroPlano({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <div data-largura-total role="alert" style={{ display: "grid", gap: "0.75rem", justifyItems: "start", padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Não foi possível carregar seu plano de estudo</h1>
      <button type="button" onClick={() => unstable_retry()} className="rounded-xl bg-frame px-4 py-2 font-semibold text-white">Tentar de novo</button>
    </div>
  );
}
