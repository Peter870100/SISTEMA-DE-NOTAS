const ID_VALIDO = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be"]);

/** Código do vídeo a partir de um link do YouTube (watch, youtu.be, shorts, embed), ou null. */
export function extrairIdYoutube(link: string): string | null {
  const texto = link.trim();
  if (!texto) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;

  let candidato: string | null = null;
  if (url.hostname.toLowerCase() === "youtu.be") {
    candidato = url.pathname.split("/")[1] ?? null;
  } else if (url.pathname === "/watch") {
    candidato = url.searchParams.get("v");
  } else {
    const [, tipo, id] = url.pathname.split("/");
    if (tipo === "shorts" || tipo === "embed") candidato = id ?? null;
  }
  return candidato && ID_VALIDO.test(candidato) ? candidato : null;
}
