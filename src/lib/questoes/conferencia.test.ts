import { test } from "node:test";
import assert from "node:assert/strict";
import { justificarAlinhamento } from "./conferencia";

test("justificarAlinhamento", () => {
  assert.equal(justificarAlinhamento("esquerda"), "flex-start");
  assert.equal(justificarAlinhamento("centro"), "center");
  assert.equal(justificarAlinhamento("direita"), "flex-end");
});
