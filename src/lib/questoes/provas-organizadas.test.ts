import { test } from "node:test";
import assert from "node:assert/strict";
import { acharEdicao, camposCsv, lerIndiceProvas } from "./provas-organizadas";

const INDICE = "﻿instituicao;edicao_vestibular;data_aplicacao;pasta;prova;gabarito_definitivo;situacao;evidencia;observacoes\r\n"
  + 'UFMS;2026;2025-12-07;UFMS/2025-12-07_Vestibular_2026;UFMS/2025-12-07_Vestibular_2026/P.pdf;UFMS/2025-12-07_Vestibular_2026/G.pdf;Completo;"Item 1; do edital";"Usar o ""ANEXO I""."\r\n'
  + "UEMS;2023;2022-12-17;UEMS/2022-12-17_Vestibular_2023;UEMS/2022-12-17_Vestibular_2023/P.pdf;;Sem gabarito;;\r\n";

test("camposCsv: separa por ; e respeita aspas", () => {
  assert.deepEqual(camposCsv('a;"b;c";"d ""e""";'), ["a", "b;c", 'd "e"', ""]);
});

test("lerIndiceProvas e acharEdicao", () => {
  const indice = lerIndiceProvas(INDICE);
  assert.equal(indice.length, 2);
  assert.deepEqual(indice[0], {
    instituicao: "UFMS", edicao: 2026, pasta: "UFMS/2025-12-07_Vestibular_2026", prova: "UFMS/2025-12-07_Vestibular_2026/P.pdf",
    gabarito: "UFMS/2025-12-07_Vestibular_2026/G.pdf", situacao: "Completo", observacoes: 'Usar o "ANEXO I".',
  });
  assert.equal(indice[1].gabarito, "");
  assert.equal(acharEdicao(indice, "public\\Provas_Organizadas\\UFMS\\2025-12-07_Vestibular_2026\\")?.edicao, 2026);
  assert.equal(acharEdicao(indice, "UEMS/2022-12-17_Vestibular_2023")?.instituicao, "UEMS");
  assert.equal(acharEdicao(indice, "UFMS/2025-12-07_Vestibular_20"), null);
  assert.throws(() => lerIndiceProvas("a;b\n1;2"), /instituicao/);
});
