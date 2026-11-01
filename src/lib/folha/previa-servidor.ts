import sharp from "sharp";
import type { DadosFolha } from "./docx";
import type { DadosPrevia, FiguraTela } from "./previa";

const LARGURA_MAX = 1100;

function dataUrl(png: Buffer): string {
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** Reduz para no máximo 1100 px de largura (sem ampliar) e devolve PNG em data URL. */
async function reduzida(png: Buffer): Promise<string | null> {
  try {
    const saida = await sharp(png).resize({ width: LARGURA_MAX, withoutEnlargement: true }).png().toBuffer();
    return dataUrl(saida);
  } catch (e) {
    console.error("dadosPrevia: figura ilegível, vai como indisponível", e);
    return null;
  }
}

/** Converte os dados da folha (Buffers) em dados serializáveis para a pré-visualização. */
export async function dadosPrevia(dados: DadosFolha): Promise<DadosPrevia> {
  const questoes = await Promise.all(
    dados.questoes.map(async (q) => {
      const figuras: FiguraTela[] | undefined = q.figuras
        ? await Promise.all(
            q.figuras.map(async ({ png, ...resto }) => ({ ...resto, src: png ? await reduzida(png) : null })),
          )
        : undefined;
      return { ...q, figuras };
    }),
  );
  const bolinhas: DadosPrevia["bolinhas"] = {};
  for (const [letra, png] of Object.entries(dados.bolinhas ?? {})) {
    if (png) bolinhas[letra as keyof DadosPrevia["bolinhas"]] = dataUrl(png);
  }
  return {
    titulo: dados.titulo,
    escola: dados.escola,
    logo: dados.logo ? dataUrl(dados.logo) : null,
    bolinhas,
    questoes,
    avisoFinal: dados.avisoFinal ?? null,
  };
}
