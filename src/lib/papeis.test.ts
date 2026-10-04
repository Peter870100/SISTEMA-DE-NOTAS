import { test } from "node:test";
import assert from "node:assert/strict";
import { ehAdmin } from "./papeis";

test("dono e admin passam como admin; professor não", () => {
  assert.equal(ehAdmin("dono"), true);
  assert.equal(ehAdmin("admin"), true);
  assert.equal(ehAdmin("professor"), false);
});
