import type { Area, Letra } from "@/lib/types";

export const AREAS: Record<Area, string> = {
  linguagens: "Linguagens",
  humanas: "Ciências Humanas",
  natureza: "Ciências da Natureza",
  matematica: "Matemática",
};

export const MATERIAS = {
  portugues: { rotulo: "Português", area: "linguagens" },
  literatura: { rotulo: "Literatura", area: "linguagens" },
  ingles: { rotulo: "Inglês", area: "linguagens" },
  espanhol: { rotulo: "Espanhol", area: "linguagens" },
  artes: { rotulo: "Artes", area: "linguagens" },
  educacao_fisica: { rotulo: "Educação Física", area: "linguagens" },
  historia: { rotulo: "História", area: "humanas" },
  geografia: { rotulo: "Geografia", area: "humanas" },
  filosofia: { rotulo: "Filosofia", area: "humanas" },
  sociologia: { rotulo: "Sociologia", area: "humanas" },
  fisica: { rotulo: "Física", area: "natureza" },
  quimica: { rotulo: "Química", area: "natureza" },
  biologia: { rotulo: "Biologia", area: "natureza" },
  matematica: { rotulo: "Matemática", area: "matematica" },
} as const satisfies Record<string, { rotulo: string; area: Area }>;

export type Materia = keyof typeof MATERIAS;
export const LETRAS: readonly Letra[] = ["A", "B", "C", "D", "E"];

export function ehMateria(x: string): x is Materia {
  return Object.prototype.hasOwnProperty.call(MATERIAS, x);
}

export function areaDaMateria(m: Materia): Area {
  return MATERIAS[m].area;
}
