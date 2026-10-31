import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  LeaderType,
  Packer,
  PageNumber,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type ISectionOptions,
} from "docx";
import { markdownParaBlocos, type Segmento } from "@/lib/questoes/markdown";
import { numero2, separarCredito } from "./texto";

export type QuestaoFolha = {
  id: string;
  enunciado: string;
  comando: string;
  alternativas: { letra: string; texto: string }[];
  resposta: string | null;
  resolucao: string | null;
  materia: string;
};

export type DadosFolha = { titulo: string; escola: string; logo: Buffer | null; questoes: QuestaoFolha[] };

// Medidas em twips (1 cm = 567 twips).
const CM = 567;
const MARGEM = Math.round(1.27 * CM);
const LARGURA_A4 = 11906;
const ALTURA_A4 = 16838;
const LARGURA_UTIL = LARGURA_A4 - 2 * MARGEM;
const RECUO = Math.round(0.6 * CM);
const FONTE = "Arial";
const CORPO = 22; // meio-pontos: 11 pt
const CREDITO = 16; // 8 pt
const TITULO = 28; // 14 pt
const LOGO_LARGURA_PX = 170; // ~4,5 cm a 96 dpi

function runs(segmentos: Segmento[], extra: { size?: number; bold?: boolean } = {}): TextRun[] {
  return segmentos.map(
    (s) => new TextRun({ text: s.texto, bold: extra.bold || s.negrito, italics: s.italico, size: extra.size }),
  );
}

function blocosNaoVazios(blocos: Segmento[][]): Segmento[][] {
  return blocos.filter((b) => b.some((s) => s.texto.trim()));
}

function paragrafoTexto(segmentos: Segmento[], primeiraLinha = true): Paragraph {
  return new Paragraph({
    children: runs(segmentos),
    alignment: AlignmentType.JUSTIFIED,
    indent: primeiraLinha ? { firstLine: RECUO } : undefined,
    spacing: { after: 40 },
  });
}

// ---------- logo ----------

type InfoImagem = { tipo: "png" | "jpg"; largura: number; altura: number };

/** Lê tipo e tamanho de um PNG ou JPEG sem dependências. */
function infoImagem(b: Buffer): InfoImagem | null {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { tipo: "png", largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marcador = b[i + 1];
      const tamanho = b.readUInt16BE(i + 2);
      const ehSOF = marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc;
      if (ehSOF) return { tipo: "jpg", altura: b.readUInt16BE(i + 5), largura: b.readUInt16BE(i + 7) };
      i += 2 + tamanho;
    }
    return { tipo: "jpg", largura: 1, altura: 1 };
  }
  return null;
}

function logoRun(logo: Buffer): ImageRun | null {
  const info = infoImagem(logo);
  if (!info || !info.largura || !info.altura) return null;
  const altura = Math.round((LOGO_LARGURA_PX * info.altura) / info.largura);
  return new ImageRun({ type: info.tipo, data: logo, transformation: { width: LOGO_LARGURA_PX, height: altura } });
}

// ---------- partes comuns ----------

function cabecalho(d: DadosFolha, titulo: string): (Paragraph | Table)[] {
  const textos = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: titulo, bold: true, size: TITULO })],
      spacing: { after: 60 },
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: d.escola })] }),
  ];
  const imagem = d.logo ? logoRun(d.logo) : null;
  if (!imagem) return [...textos, new Paragraph({ children: [], spacing: { after: 120 } })];
  const colunaLogo = Math.round(5 * CM);
  return [
    new Table({
      width: { size: LARGURA_UTIL, type: WidthType.DXA },
      columnWidths: [colunaLogo, LARGURA_UTIL - 2 * colunaLogo, colunaLogo],
      borders: TableBorders.NONE,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: colunaLogo, type: WidthType.DXA },
              verticalAlign: VerticalAlignTable.CENTER,
              children: [new Paragraph({ children: [imagem] })],
            }),
            new TableCell({
              width: { size: LARGURA_UTIL - 2 * colunaLogo, type: WidthType.DXA },
              verticalAlign: VerticalAlignTable.CENTER,
              children: textos,
            }),
            // Coluna vazia do mesmo tamanho do logo: mantém o título no centro da página.
            new TableCell({ width: { size: colunaLogo, type: WidthType.DXA }, children: [new Paragraph({})] }),
          ],
        }),
      ],
    }),
    new Paragraph({ children: [], spacing: { after: 120 } }),
  ];
}

function linhaHorizontal(): Paragraph {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000", space: 1 } },
    spacing: { after: 160 },
  });
}

function linhasIdentificacao(): Paragraph {
  const p = (cm: number) => Math.round(cm * CM);
  return new Paragraph({
    tabStops: [
      { type: TabStopType.LEFT, position: p(8.6), leader: LeaderType.UNDERSCORE },
      { type: TabStopType.LEFT, position: p(11.8), leader: LeaderType.UNDERSCORE },
      { type: TabStopType.LEFT, position: p(13.4), leader: LeaderType.UNDERSCORE },
    ],
    children: [
      new TextRun({ text: "Nome: ", bold: true }),
      new TextRun({ text: "\t" }),
      new TextRun({ text: "  Turma: ", bold: true }),
      new TextRun({ text: "\t" }),
      new TextRun({ text: "  Nº: ", bold: true }),
      new TextRun({ text: "\t" }),
      new TextRun({ text: "  Data: ", bold: true }),
      new TextRun({ text: "___/___/____" }),
    ],
    spacing: { before: 120, after: 60 },
  });
}

function rodape(titulo: string): Footer {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 8, color: "000000", space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: LARGURA_UTIL }],
        children: [
          new TextRun({ text: titulo, size: 18 }),
          new TextRun({ text: "\t", size: 18 }),
          new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
        ],
      }),
    ],
  });
}

function pagina() {
  return {
    size: { width: LARGURA_A4, height: ALTURA_A4 },
    margin: { top: MARGEM, right: MARGEM, bottom: MARGEM, left: MARGEM, header: MARGEM / 2, footer: MARGEM / 2 },
  };
}

async function montar(titulo: string, topo: (Paragraph | Table)[], corpo: Paragraph[]): Promise<Buffer> {
  const footers = { default: rodape(titulo) };
  const secoes: ISectionOptions[] = [
    { properties: { page: pagina() }, footers, children: topo },
    {
      properties: {
        type: SectionType.CONTINUOUS,
        page: pagina(),
        column: { count: 2, space: Math.round(0.8 * CM), separate: true, equalWidth: true },
      },
      footers,
      children: corpo.length ? corpo : [new Paragraph({})],
    },
  ];
  const doc = new Document({
    creator: "Status Avalia",
    title: titulo,
    styles: { default: { document: { run: { font: FONTE, size: CORPO } } } },
    sections: secoes,
  });
  return Packer.toBuffer(doc);
}

// ---------- folha do aluno ----------

function tituloQuestao(n: number): Paragraph {
  return new Paragraph({
    keepNext: true,
    keepLines: true,
    children: [new TextRun({ text: `QUESTÃO ${n}`, bold: true })],
    border: { bottom: { style: BorderStyle.DOUBLE, size: 12, color: "000000", space: 1 } },
    spacing: { before: 200, after: 100 },
  });
}

function alternativa(letra: string, texto: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: RECUO, hanging: RECUO },
    tabStops: [{ type: TabStopType.LEFT, position: RECUO }],
    spacing: { after: 40 },
    children: [
      new TextRun({
        text: ` ${letra} `,
        bold: true,
        color: "FFFFFF",
        shading: { type: ShadingType.CLEAR, fill: "000000", color: "auto" },
        size: 18,
      }),
      new TextRun({ text: "\t" }),
      // Texto da alternativa numa linha só (quebras viram espaço).
      ...runs(markdownParaBlocos(texto.replace(/\r?\n/g, " "))[0] ?? []),
    ],
  });
}

function paragrafosQuestao(q: QuestaoFolha, n: number): Paragraph[] {
  const { corpo, credito } = separarCredito(q.enunciado);
  const saida: Paragraph[] = [tituloQuestao(n)];
  for (const bloco of blocosNaoVazios(corpo)) saida.push(paragrafoTexto(bloco));
  if (credito) {
    saida.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: runs(markdownParaBlocos(credito)[0] ?? [], { size: CREDITO }),
        spacing: { after: 80 },
      }),
    );
  }
  for (const bloco of blocosNaoVazios(markdownParaBlocos(q.comando))) {
    saida.push(new Paragraph({ children: runs(bloco), alignment: AlignmentType.JUSTIFIED, spacing: { before: 60, after: 60 } }));
  }
  for (const a of q.alternativas) saida.push(alternativa(a.letra, a.texto));
  return saida;
}

export async function folhaAluno(d: DadosFolha): Promise<Buffer> {
  const topo = [...cabecalho(d, d.titulo), linhasIdentificacao(), linhaHorizontal()];
  const corpo = d.questoes.flatMap((q, i) => paragrafosQuestao(q, i + 1));
  return montar(d.titulo, topo, corpo);
}

// ---------- gabarito (resoluções) ----------

function paragrafosResolucao(q: QuestaoFolha, n: number, primeiraDaMateria: boolean): Paragraph[] {
  const saida: Paragraph[] = [];
  const blocos = blocosNaoVazios(markdownParaBlocos(q.resolucao ?? ""));
  const numero = new TextRun({ text: `${numero2(n)} `, bold: true });
  const espacoAntes = primeiraDaMateria ? 60 : 200;
  if (!blocos.length) {
    saida.push(new Paragraph({ children: [numero], keepNext: true, spacing: { before: espacoAntes, after: 40 } }));
  } else {
    blocos.forEach((bloco, i) => {
      saida.push(
        new Paragraph({
          children: i === 0 ? [numero, ...runs(bloco)] : runs(bloco),
          alignment: AlignmentType.JUSTIFIED,
          keepNext: true,
          keepLines: true,
          spacing: { before: i === 0 ? espacoAntes : 0, after: 40 },
        }),
      );
    });
  }
  saida.push(
    new Paragraph({
      children: [new TextRun({ text: `Resposta: ${q.resposta ?? "—"}`, bold: true })],
      spacing: { after: 40 },
    }),
  );
  return saida;
}

export async function folhaGabarito(d: DadosFolha): Promise<Buffer> {
  const titulo = `${d.titulo} — Resoluções`;
  const topo = [...cabecalho(d, titulo), linhaHorizontal()];
  const variasMaterias = new Set(d.questoes.map((q) => q.materia)).size > 1;
  const corpo: Paragraph[] = [];
  let materiaAtual: string | null = null;
  d.questoes.forEach((q, i) => {
    let primeira = false;
    if (variasMaterias && q.materia !== materiaAtual) {
      materiaAtual = q.materia;
      primeira = true;
      corpo.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          keepNext: true,
          children: [new TextRun({ text: q.materia, bold: true, size: 24 })],
          spacing: { before: corpo.length ? 240 : 0, after: 60 },
        }),
      );
    }
    corpo.push(...paragrafosResolucao(q, i + 1, primeira));
  });
  return montar(titulo, topo, corpo);
}
