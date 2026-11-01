import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { folhaAluno, folhaGabarito } from "./docx";
import { documentoXml } from "./documento-xml";
import { CASOS } from "./referencia/casos";

const PASTA = join(__dirname, "referencia");

/** O `docx` numera as figuras (`wp:docPr id`) com um contador do processo: renumera na ordem em que aparecem. */
function normalizar(xml: string): string {
  let n = 0;
  return xml.replace(/<wp:docPr id="\d+"/g, () => `<wp:docPr id="${++n}"`);
}

for (const [nome, d] of Object.entries(CASOS)) {
  test(`referência ${nome}: prova igual ao XML gravado`, async () => {
    const esperado = readFileSync(join(PASTA, `${nome}-prova.xml`), "utf8");
    assert.equal(normalizar(await documentoXml(await folhaAluno(d))), normalizar(esperado));
  });
  test(`referência ${nome}: gabarito igual ao XML gravado`, async () => {
    const esperado = readFileSync(join(PASTA, `${nome}-gabarito.xml`), "utf8");
    assert.equal(normalizar(await documentoXml(await folhaGabarito(d))), normalizar(esperado));
  });
}
