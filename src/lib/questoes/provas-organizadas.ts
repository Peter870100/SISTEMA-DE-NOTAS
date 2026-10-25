// Índice da pasta "Provas_Organizadas" (INDICE_PROVAS.csv): uma linha por edição de vestibular, com os
// caminhos da prova e do gabarito relativos à pasta do índice. Separador ";", aspas no estilo CSV, BOM opcional.

export type EdicaoIndice = {
  instituicao: string;
  edicao: number;
  pasta: string;
  prova: string;
  gabarito: string;
  situacao: string;
  observacoes: string;
};

/** Divide uma linha em campos (";"), respeitando aspas ("" dentro de aspas = uma aspa). Pura. */
export function camposCsv(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") { campos.push(atual); atual = ""; }
    else atual += c;
  }
  campos.push(atual);
  return campos;
}

export function lerIndiceProvas(texto: string): EdicaoIndice[] {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length === 0) return [];
  const cabecalho = camposCsv(linhas[0]);
  const col = (nome: string) => {
    const i = cabecalho.indexOf(nome);
    if (i < 0) throw new Error(`O índice não tem a coluna "${nome}".`);
    return i;
  };
  const c = {
    instituicao: col("instituicao"), edicao: col("edicao_vestibular"), pasta: col("pasta"), prova: col("prova"),
    gabarito: col("gabarito_definitivo"), situacao: col("situacao"), observacoes: col("observacoes"),
  };
  return linhas.slice(1).map((l) => {
    const f = camposCsv(l);
    return {
      instituicao: f[c.instituicao]?.trim() ?? "", edicao: Number(f[c.edicao]), pasta: f[c.pasta]?.trim() ?? "",
      prova: f[c.prova]?.trim() ?? "", gabarito: f[c.gabarito]?.trim() ?? "", situacao: f[c.situacao]?.trim() ?? "",
      observacoes: f[c.observacoes]?.trim() ?? "",
    };
  });
}

/** A edição cuja pasta é `pasta` (aceita o caminho completo, com "\" ou "/" e barra no fim). Pura. */
export function acharEdicao(indice: EdicaoIndice[], pasta: string): EdicaoIndice | null {
  const fim = pasta.replace(/\\/g, "/").replace(/\/+$/, "");
  return indice.find((e) => fim === e.pasta || fim.endsWith(`/${e.pasta}`)) ?? null;
}
