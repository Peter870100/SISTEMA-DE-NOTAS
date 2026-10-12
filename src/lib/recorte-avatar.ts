/** Coordinates within the original image; 0..100 positions never leave its bounds. */
export function areaRecorte(largura: number, altura: number, zoom: number, horizontal: number, vertical: number) {
  const lado = Math.min(largura, altura) / Math.max(1, Math.min(3, zoom));
  return {
    x: (largura - lado) * Math.max(0, Math.min(100, horizontal)) / 100,
    y: (altura - lado) * Math.max(0, Math.min(100, vertical)) / 100,
    lado,
  };
}
