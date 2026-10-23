// Entrada de PDFs vindos de fora (Hermes): link https público ou base64. Validação pura + download
// com limite de tamanho e de tempo. Sem Supabase aqui, para poder testar sem rede.
import { isIP } from "node:net";

export const LIMITE_PDF_BYTES = 31457280; // 30 MB
export const TIMEOUT_DOWNLOAD_MS = 30000;
const MAX_REDIRECIONAMENTOS = 3;

const ERRO_ENDERECO = "Esse endereço não é permitido.";
const ERRO_GRANDE = "O PDF passa de 30 MB.";
const ERRO_NAO_PDF = "O arquivo não é um PDF.";

function ipv4Proibido(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || // 0.0.0.0/8 ("este host")
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / metadados da nuvem
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast e reservados
  );
}

/** Expande um IPv6 (já validado por `isIP`) em 8 grupos de 16 bits. */
function gruposIpv6(ip: string): number[] {
  let texto = ip;
  const v4 = texto.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    texto = texto.slice(0, -v4[0].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const parte = (s: string) => (s ? s.split(":").map((g) => parseInt(g, 16)) : []);
  if (!texto.includes("::")) return parte(texto);
  const [esq, dir] = texto.split("::");
  const inicio = parte(esq);
  const fim = parte(dir);
  return [...inicio, ...Array(Math.max(8 - inicio.length - fim.length, 0)).fill(0), ...fim];
}

function ipv6Proibido(ip: string): boolean {
  const g = gruposIpv6(ip);
  if (g.length !== 8) return true; // não deu para entender: recusa
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    // ::ffff:a.b.c.d (mapeado) e ::a.b.c.d (compatível): vale a regra do IPv4.
    const v4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
    return ipv4Proibido(v4);
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 (locais únicos)
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  return false;
}

/**
 * Confere o link do PDF: só https, sem usuário/senha, sem localhost nem IP literal privado ou de loopback.
 * Não resolve DNS: um nome público que aponta para IP privado não é pego aqui.
 */
export function validarUrlPdf(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return "Link do PDF inválido.";
  }
  if (u.protocol !== "https:") return "O link do PDF precisa começar com https://.";
  if (u.username || u.password) return ERRO_ENDERECO;
  const host = u.hostname.toLowerCase().replace(/\.+$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) return ERRO_ENDERECO;
  const semColchetes = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const tipoIp = isIP(semColchetes);
  if (tipoIp === 4 && ipv4Proibido(semColchetes)) return ERRO_ENDERECO;
  if (tipoIp === 6 && ipv6Proibido(semColchetes)) return ERRO_ENDERECO;
  return null;
}

/** Confere tamanho e assinatura `%PDF` dos bytes. */
export function validarBytesPdf(b: Uint8Array, limiteBytes = LIMITE_PDF_BYTES): string | null {
  if (b.byteLength > limiteBytes) return ERRO_GRANDE;
  if (b.byteLength < 4 || b[0] !== 0x25 || b[1] !== 0x50 || b[2] !== 0x44 || b[3] !== 0x46) return ERRO_NAO_PDF;
  return null;
}

function exigirPdf(b: Uint8Array, limiteBytes: number): Uint8Array {
  const erro = validarBytesPdf(b, limiteBytes);
  if (erro) throw new Error(erro);
  return b;
}

/** Decodifica um PDF em base64 (aceita prefixo `data:...;base64,`), com o mesmo limite do download. */
export function decodificarBase64Pdf(s: string, limiteBytes = LIMITE_PDF_BYTES): Uint8Array {
  const limpo = s.replace(/^\s*data:[^,]*;base64,/i, "").replace(/\s+/g, "");
  // Confere o tamanho antes de decodificar, para não alocar um arquivo enorme.
  if (Math.floor((limpo.length * 3) / 4) - 2 > limiteBytes) throw new Error(ERRO_GRANDE);
  if (!limpo || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(limpo) || limpo.length % 4 === 1) throw new Error("PDF em base64 inválido.");
  return exigirPdf(new Uint8Array(Buffer.from(limpo, "base64")), limiteBytes);
}

async function lerComLimite(res: Response, limiteBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(0);
  const leitor = res.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limiteBytes) {
      await leitor.cancel().catch(() => {});
      throw new Error(ERRO_GRANDE);
    }
    pedacos.push(value);
  }
  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const p of pedacos) {
    bytes.set(p, pos);
    pos += p.byteLength;
  }
  return bytes;
}

/**
 * Baixa o PDF por stream, abortando ao passar do limite ou do tempo. Redirecionamentos são seguidos à
 * mão (no máximo 3) e cada destino passa de novo por `validarUrlPdf`.
 */
export async function baixarPdf(url: string, limiteBytes = LIMITE_PDF_BYTES, timeoutMs = TIMEOUT_DOWNLOAD_MS): Promise<Uint8Array> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), timeoutMs);
  try {
    let atual = url.trim();
    for (let saltos = 0; ; saltos++) {
      const erro = validarUrlPdf(atual);
      if (erro) throw new Error(erro);
      const res = await fetch(atual, { redirect: "manual", signal: controle.signal });
      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel().catch(() => {});
        const destino = res.headers.get("location");
        if (!destino) throw new Error(`Não consegui baixar o PDF (erro ${res.status}).`);
        if (saltos >= MAX_REDIRECIONAMENTOS) throw new Error("O link do PDF redireciona demais.");
        atual = new URL(destino, atual).toString();
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        throw new Error(`Não consegui baixar o PDF (erro ${res.status}).`);
      }
      const tamanho = Number(res.headers.get("content-length"));
      if (Number.isFinite(tamanho) && tamanho > limiteBytes) {
        await res.body?.cancel().catch(() => {});
        throw new Error(ERRO_GRANDE);
      }
      return exigirPdf(await lerComLimite(res, limiteBytes), limiteBytes);
    }
  } catch (e) {
    if (controle.signal.aborted) throw new Error(`O download do PDF demorou demais (mais de ${Math.ceil(timeoutMs / 1000)} s).`);
    throw e;
  } finally {
    clearTimeout(relogio);
  }
}
