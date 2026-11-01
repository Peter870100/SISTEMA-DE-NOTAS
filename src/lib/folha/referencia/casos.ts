// Casos fixos da folha cujo `word/document.xml` foi gravado em `referencia/*.xml` antes do refator
// da estrutura comum; o teste de referência confere que o .docx continua idêntico.
import type { DadosFolha, FiguraFolha, QuestaoFolha } from "../docx";

// PNG mínimo válido (1×1).
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const BOLINHAS = { A: PNG_1X1, B: PNG_1X1, C: PNG_1X1, D: PNG_1X1, E: PNG_1X1 };

function figura(id: string, alvo: FiguraFolha["alvo"], o: Partial<FiguraFolha> = {}): FiguraFolha {
  return { id, alvo, png: PNG_1X1, largura: 800, altura: 400, alinhamento: "centro", ...o };
}

function questao(enunciado: string, o: Partial<QuestaoFolha> = {}): QuestaoFolha {
  return {
    id: "q1",
    enunciado,
    comando: "Assinale a alternativa correta.",
    alternativas: [
      { letra: "A", texto: "2" },
      { letra: "B", texto: "4" },
      { letra: "C", texto: "6" },
      { letra: "D", texto: "8" },
      { letra: "E", texto: "16" },
    ],
    resposta: "B",
    resolucao: "2² = 2 · 2 = 4.\nLogo, a resposta é **B**.",
    materia: "Matemática",
    ...o,
  };
}

function folha(questoes: QuestaoFolha[], o: Partial<DadosFolha> = {}): DadosFolha {
  return { titulo: "Tarefa de Matemática — Porcentagem", subtitulo: "9º ano", escola: "Colégio Status", logo: null, questoes, ...o };
}

const TABELA = ["A tabela mostra os dados.", "| Trecho | Tempo |", "|---|---|", "| 0 a 1 km | 06:30 |", "Texto depois."].join("\n");

export const CASOS: Record<string, DadosFolha> = {
  conteudo: folha([
    questao("texto antigo", {
      conteudo: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Veja o " }, { type: "text", text: "forte", marks: [{ type: "bold" }] }, { type: "hardBreak" }, { type: "text", text: "e mais." }] },
          { type: "paragraph", attrs: { textAlign: "center", recuo: 1 }, content: [{ type: "text", text: "Centrado", marks: [{ type: "italic" }] }] },
          { type: "horizontalRule" },
          { type: "caixa", content: [{ type: "paragraph", content: [{ type: "text", text: "Dentro da caixa." }] }] },
          { type: "figura", attrs: { imagemId: "f1", alinhamento: "direita", legenda: "Figura 1" } },
          { type: "paragraph", content: [{ type: "text", text: "Depois da figura." }] },
        ],
      },
      alternativas: [
        { letra: "A", texto: "H2O", conteudo: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "H" }, { type: "text", text: "2", marks: [{ type: "subscript" }] }, { type: "text", text: "O" }] }] } },
        { letra: "B", texto: "CO2" },
        { letra: "C", texto: "NaCl" },
        { letra: "D", texto: "O2" },
        { letra: "E", texto: "N2" },
      ],
      figuras: [figura("f1", "enunciado"), figura("f2", "enunciado", { largura: 4000, altura: 1000 })],
    }),
  ]),
  tabela: folha([questao(TABELA, { comando: "" })]),
  "tabela-figura": folha([questao(TABELA, { figuras: [figura("f1", "enunciado", { largura: 100, altura: 50 })] })]),
  "figura-alternativa": folha([
    questao("Observe a figura.", { figuras: [figura("f1", "enunciado", { png: null }), figura("fb", "B", { alinhamento: "direita" })] }),
  ]),
  "comando-credito": folha([
    questao("Um texto. Assinale a alternativa correta.\nSILVA, J. Livro. Disponível em: www.exemplo.com. Acesso em: 1 jan. 2024.", { origem: "UFMS 2024" }),
    questao("Outro texto.\nSILVA, J. Livro. Acesso em: 2 jan. 2024.", { comando: "Qual **é** a resposta?\nEscolha uma." }),
    questao("Só a origem.", { origem: "ENEM 2023", resposta: null, resolucao: null }),
  ]),
  "materias-aviso": folha(
    [
      questao("Quanto é 2²?"),
      questao("Quanto é 3²?"),
      questao("Leia o texto.", { materia: "Português", resposta: "  c " }),
    ],
    { bolinhas: BOLINHAS, avisoFinal: "Prova gerada pelo Status Avalia", subtitulo: null },
  ),
};
