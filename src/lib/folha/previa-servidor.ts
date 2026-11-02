import sharp from "sharp";
import type { DadosFolha } from "./docx";
import type { DadosPrevia, FiguraTela } from "./previa";

const LARGURA_MAX = 1100;

function dataUrl(imagem: Buffer, tipo: "png" | "jpeg" = "png"): string {
  return `data:image/${tipo};base64,${imagem.toString("base64")}`;
}

/**
 * Reduz para no máximo 1100 px de largura (sem ampliar) e devolve a menor entre PNG com paleta
 * (desenhos e gráficos ficam nítidos e leves) e JPEG sobre fundo branco (fotos), em data URL.
 * Mantém o HTML de uma prova de 60 questões com figuras num tamanho aceitável.
 */
async function reduzida(png: Buffer): Promise<string | null> {
  try {
    const base = sharp(png).resize({ width: LARGURA_MAX, withoutEnlargement: true });
    const [paleta, jpeg] = await Promise.all([
      base.clone().png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer(),
      base.clone().flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
    ]);
    return paleta.length <= jpeg.length ? dataUrl(paleta) : dataUrl(jpeg, "jpeg");
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
    cabecalho: dados.cabecalho ?? {},
    professor: dados.professor ?? null,
  };
}
