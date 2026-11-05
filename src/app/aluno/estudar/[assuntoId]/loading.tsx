export default function CarregandoEstudo() {
  return (
    <div data-largura-total role="status" aria-label="Carregando o conteúdo" style={{ display: "grid", gap: "1rem" }}>
      <div className="animate-pulse rounded-2xl bg-frame/20" style={{ height: 130 }} />
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {[0, 1, 2].map((i) => <div key={i} className="animate-pulse rounded-2xl bg-frame/20" style={{ height: 70 }} />)}
      </div>
      <div className="animate-pulse rounded-2xl bg-frame/20" style={{ height: 360 }} />
    </div>
  );
}
