// Medidas e cores da folha, usadas pelo .docx (`./docx`) e pela pré-visualização no navegador.
// Puro: sem a biblioteca `docx`. Medidas em twips (1 cm = 567 twips; 1 px a 96 dpi = 15 twips);
// tamanhos de fonte em meio-pontos, como no Word.

export const CM = 567;
export const cm = (v: number) => Math.round(v * CM);
export const LARGURA_A4 = 11906;
export const ALTURA_A4 = 16838;
export const MARGEM_LADO = cm(1.5);
export const MARGEM_TOPO = cm(1.2);
/** Distância do topo de página e do rodapé até a borda do papel. */
export const DISTANCIA_TOPO_RODAPE = cm(0.6);
export const LARGURA_UTIL = LARGURA_A4 - 2 * MARGEM_LADO;
export const ESPACO_COLUNAS = cm(0.8);
export const LARGURA_COLUNA = Math.floor((LARGURA_UTIL - ESPACO_COLUNAS) / 2);
export const RECUO = cm(0.6);
export const RECUO_ALTERNATIVA = cm(0.6);
export const TWIPS_POR_PX = 15; // 96 dpi

export const AZUL = "0E3562";
export const FUNDO = "E8EEF6";
export const CINZA = "595959";
export const FIO_CLARO = "B9CBE4";
export const PRETO = "000000";
export const FAIXA_QUESTAO = "D9D9D9";

export const FONTE_QUESTAO = "Arial"; // questões no padrão do caderno do ENEM
export const SEM_SERIFA = "Calibri"; // cabeçalho, faixas e rodapé

export const CORPO = 19; // 9,5 pt
export const CORPO_QUESTAO = 18; // 9 pt
export const TITULO_QUESTAO = 21; // 10,5 pt
export const BOLINHA_PX = 14; // ~0,36 cm a 96 dpi
export const PEQUENO = 15; // 7,5 pt
export const LINHA = 252; // entrelinha 1,05

export const LOGO_LARGURA_PX = 83; // ~2,2 cm a 96 dpi
export const COLUNA_LOGO = cm(2.4);

export const MARGEM_CELULA = cm(0.3);
/** Folga antes da borda da célula: um tab no limite exato faz o Word quebrar a linha. */
export const FOLGA_LINHA = cm(0.3);
export const LARGURA_TEXTO_CAB = LARGURA_UTIL - COLUNA_LOGO;
/**
 * Fim útil das linhas de preencher, medido a partir do início do texto da célula:
 * largura da célula menos as margens internas e a folga.
 */
export const FIM_LINHA = LARGURA_TEXTO_CAB - 2 * MARGEM_CELULA - FOLGA_LINHA;

/** Twips em px CSS (96 dpi). */
export const px = (twips: number) => twips / TWIPS_POR_PX;
/** Twips em pontos. */
export const pt = (twips: number) => twips / 20;

/** Largura da coluna do "QUESTÃO NN"; com valor ("(10,0)") alarga o bastante para não quebrar a linha. */
export function larguraTituloQuestao(numero: number, valor?: string): number {
  const base = numero >= 100 ? cm(2.85) : cm(2.6);
  return valor ? base + Math.round(cm(0.19) * (valor.length + 3)) : base;
}
