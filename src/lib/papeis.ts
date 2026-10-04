import type { ProfessorRole } from "./types";

/** Admin da escola ou dono da plataforma: o dono passa em toda checagem de admin. */
export function ehAdmin(role: ProfessorRole): boolean {
  return role === "admin" || role === "dono";
}
