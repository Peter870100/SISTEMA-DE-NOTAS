// Zoom da pré-visualização: só muda a escala da folha na tela (nunca a medição, a paginação ou a impressão).

/** Largura de uma folha A4 em px CSS (210 mm a 96 dpi). */
export const LARGURA_FOLHA_PX = (210 * 96) / 25.4;
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_PASSO = 10;

/** "auto": como sempre foi (cabe na tela estreita, 100% nas largas); "ajustar": largura da folha = da janela; número: %. */
export type ModoZoom = "auto" | "ajustar" | number;

/** Folga lateral da área das folhas (padding) e, no "ajustar", espaço da barra de rolagem. */
const FOLGA = 32;
const BARRA_ROLAGEM = 18;

/** Escala da folha na tela (1 = 100%). */
export function escalaDaTela(modo: ModoZoom, larguraJanela: number): number {
  if (modo === "auto") return Math.min(1, Math.max(0.2, (larguraJanela - FOLGA) / LARGURA_FOLHA_PX));
  if (modo === "ajustar") return Math.min(ZOOM_MAX / 100, Math.max(0.2, (larguraJanela - FOLGA - BARRA_ROLAGEM) / LARGURA_FOLHA_PX));
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, modo)) / 100;
}

/** Próximo zoom (%) ao apertar − (-1) ou + (+1), no múltiplo de 10 seguinte, dentro de 50%–200%. */
export function passoZoom(escala: number, direcao: 1 | -1): number {
  const atual = escala * 100;
  const proximo = direcao > 0 ? Math.floor(atual / ZOOM_PASSO + 1e-6) * ZOOM_PASSO + ZOOM_PASSO : Math.ceil(atual / ZOOM_PASSO - 1e-6) * ZOOM_PASSO - ZOOM_PASSO;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, proximo));
}
