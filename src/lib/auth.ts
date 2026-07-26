import { createHash } from "node:crypto";

export const COOKIE_NOME = "app_auth";

export function tokenEsperado(): string {
  return createHash("sha256").update(process.env.APP_PASSWORD ?? "").digest("hex");
}
