export default function CarregandoPlano() {
  return (
    <div data-largura-total role="status" aria-label="Carregando seu plano de estudo" style={{ display: "grid", gap: "1rem" }}>
      <div className="animate-pulse rounded-2xl bg-frame/20" style={{ height: 110 }} />
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="animate-pulse rounded-2xl bg-frame/20" style={{ height: 96 }} />)}
      </div>
      <div className="animate-pulse rounded-2xl bg-frame/20" style={{ height: 260 }} />
    </div>
  );
}
