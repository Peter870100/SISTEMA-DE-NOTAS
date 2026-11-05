import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Só estes sites: domínio público e licença livre, com crédito. */
export const HOSTS_FOTO = ["upload.wikimedia.org", "thumb.wikimedia.org"];
export const BUCKET_ESTUDOS = "estudos";
const LIMITE_BYTES = 10 * 1024 * 1024;
const LARGURA_MAXIMA = 900;

export function urlDeFotoValida(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && HOSTS_FOTO.includes(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Lê o corpo parando no limite, sem confiar no Content-Length. */
async function lerLimitado(resposta: Response): Promise<Buffer> {
  const partes: Uint8Array[] = [];
  let total = 0;
  const leitor = resposta.body?.getReader();
  if (!leitor) throw new Error("A foto veio vazia.");
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > LIMITE_BYTES) {
      await leitor.cancel();
      throw new Error("A foto passa de 10 MB.");
    }
    partes.push(value);
  }
  return Buffer.concat(partes);
}

/** Baixa a foto, converte para WebP (largura até 900 px, sem metadados) e grava no bucket. Devolve o `storage_path`. */
export async function gravarFoto(supabase: SupabaseClient, url: string, materialId: string): Promise<string> {
  if (!urlDeFotoValida(url)) throw new Error(`Foto recusada: só ${HOSTS_FOTO.join(" e ")} (https) são aceitos.`);
  const resposta = await fetch(url, { headers: { "User-Agent": "StatusAvalia/1.0" }, redirect: "error" });
  if (!resposta.ok) throw new Error(`Não foi possível baixar a foto (${resposta.status}).`);
  const webp = await sharp(await lerLimitado(resposta))
    .rotate() // aplica a orientação do EXIF antes de apagar os metadados
    .resize({ width: LARGURA_MAXIMA, withoutEnlargement: true })
    .webp()
    .toBuffer();
  const caminho = `${materialId}/${randomUUID()}.webp`;
  const { error } = await supabase.storage.from(BUCKET_ESTUDOS).upload(caminho, webp, { contentType: "image/webp" });
  if (error) throw new Error(`Não foi possível guardar a foto: ${error.message}`);
  return caminho;
}
