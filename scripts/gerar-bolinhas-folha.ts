import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Gera as bolinhas das alternativas da folha de tarefa (padrão do caderno do ENEM):
// círculo preto preenchido com a letra branca em negrito, fundo transparente, 96×96 px.
// Uso: npx tsx scripts/gerar-bolinhas-folha.ts  → public/folha/alternativa-A.png … -E.png

const TAMANHO = 96;

function svg(letra: string): string {
  const r = TAMANHO / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TAMANHO}" height="${TAMANHO}" viewBox="0 0 ${TAMANHO} ${TAMANHO}">
  <circle cx="${r}" cy="${r}" r="${r - 1}" fill="#000000"/>
  <text x="${r}" y="${r + 21}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="60" fill="#FFFFFF">${letra}</text>
</svg>`;
}

async function main() {
  const pasta = join(process.cwd(), "public", "folha");
  mkdirSync(pasta, { recursive: true });
  for (const letra of ["A", "B", "C", "D", "E"]) {
    const destino = join(pasta, `alternativa-${letra}.png`);
    await sharp(Buffer.from(svg(letra))).png().toFile(destino);
    console.log(destino);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
