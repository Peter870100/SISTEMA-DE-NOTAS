/** Só para testes: abre o .docx (zip) e devolve o `word/document.xml`. */
export async function documentoXml(b: Buffer): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(b);
  const arquivo = zip.file("word/document.xml");
  if (!arquivo) throw new Error("word/document.xml ausente");
  return arquivo.async("string");
}
