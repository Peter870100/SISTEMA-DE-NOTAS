import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  LeaderType,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  SectionType,
  ShadingType,
  Tab,
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

export type DadosFolha = {
  titulo: string;
  /** Linha abaixo do título (ex.: "9º ano · Ensino Fundamental"). */
  subtitulo?: string | null;
  escola: string;
  logo: Buffer | null;
  questoes: QuestaoFolha[];
};

// Medidas em twips (1 cm = 567 twips). Tamanhos de fonte em meio-pontos.
const CM = 567;
const cm = (v: number) => Math.round(v * CM);
const LARGURA_A4 = 11906;
const ALTURA_A4 = 16838;
const MARGEM_LADO = cm(1.5);
const MARGEM_TOPO = cm(1.2);
const LARGURA_UTIL = LARGURA_A4 - 2 * MARGEM_LADO;
const ESPACO_COLUNAS = cm(0.8);
const LARGURA_COLUNA = Math.floor((LARGURA_UTIL - ESPACO_COLUNAS) / 2);
const RECUO = cm(0.6);
const RECUO_ALTERNATIVA = cm(0.55);

const AZUL = "0E3562";
const FUNDO = "E8EEF6";
const CINZA = "595959";
const FIO_CLARO = "B9CBE4";

const SERIFA = "Cambria"; // texto das questões
const SEM_SERIFA = "Calibri"; // títulos e rótulos

const CORPO = 19; // 9,5 pt
const PEQUENO = 15; // 7,5 pt
const LINHA = 252; // entrelinha 1,05

const LOGO_LARGURA_PX = 83; // ~2,2 cm a 96 dpi
const COLUNA_LOGO = cm(2.4);

const TRAVESSAO = /\s+[—–-]\s+/;

function runs(segmentos: Segmento[], extra: { size?: number; bold?: boolean } = {}): TextRun[] {
  return segmentos.map(
    (s) =>
      new TextRun({
        text: s.texto,
        bold: extra.bold || s.negrito,
        italics: s.italico,
        size: extra.size,
        font: SERIFA,
      }),
  );
}

type OpcoesRotulo = { size?: number; bold?: boolean; color?: string; characterSpacing?: number };

/** Texto em Calibri (títulos, rótulos, faixas, rodapé). */
function rotulo(text: string, o: OpcoesRotulo = {}): TextRun {
  return new TextRun({ text, font: SEM_SERIFA, ...o });
}

function tab(): TextRun {
  return new TextRun({ children: [new Tab()] });
}

function blocosNaoVazios(blocos: Segmento[][]): Segmento[][] {
  return blocos.filter((b) => b.some((s) => s.texto.trim()));
}

function paragrafoTexto(segmentos: Segmento[]): Paragraph {
  return new Paragraph({
    children: runs(segmentos),
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: RECUO },
    spacing: { after: 30 },
  });
}

/** Letra dentro de uma caixinha de contorno fino (borda do próprio texto; cantos retos). */
function caixaLetra(letra: string): TextRun {
  return new TextRun({
    text: ` ${letra} `,
    font: SEM_SERIFA,
    bold: true,
    size: 16,
    color: AZUL,
    border: { style: BorderStyle.SINGLE, size: 4, color: AZUL, space: 0 },
  });
}

/** "Tarefa de Matemática — Porcentagem" → "Tarefa de Matemática" (parte antes do travessão). */
function tituloCurto(titulo: string): string {
  return titulo.split(TRAVESSAO)[0].trim() || titulo;
}

function maiusculas(s: string): string {
  return s.toLocaleUpperCase("pt-BR");
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

// ---------- cabeçalho da 1ª página ----------

const LARGURA_TEXTO_CAB = LARGURA_UTIL - COLUNA_LOGO;
const MARGEM_CELULA = cm(0.3);
/** Fim útil das linhas de preencher, medido a partir do início do texto da célula. */
const FIM_LINHA = LARGURA_TEXTO_CAB - 2 * MARGEM_CELULA;

type Campo = { rotulo: string; ate: number | null; depois?: string };

/** Linha "Rótulo: ____  Rótulo: ____" com tabs de leader sublinhado (fim de cada campo em `ate`). */
function linhaPreencher(campos: Campo[]): Paragraph {
  const tabStops = campos
    .filter((c) => c.ate !== null)
    .map((c) => ({ type: TabStopType.LEFT, position: c.ate as number, leader: LeaderType.UNDERSCORE }));
  const children: TextRun[] = [];
  campos.forEach((c, i) => {
    children.push(rotulo(`${i ? "  " : ""}${c.rotulo}: `, { bold: true, color: AZUL, size: 18 }));
    if (c.ate !== null) children.push(tab());
    if (c.depois) children.push(rotulo(c.depois, { size: 18 }));
  });
  return new Paragraph({ tabStops, children, spacing: { before: 100, after: 0 } });
}

const SEM_BORDA = { style: BorderStyle.NONE, size: 0, color: "auto" } as const;
const FIO_VERTICAL = { style: BorderStyle.SINGLE, size: 12, color: AZUL } as const; // 1,5 pt

function cabecalho(d: DadosFolha, subtitulo: string | null, comIdentificacao: boolean): (Paragraph | Table)[] {
  const textos: Paragraph[] = [
    new Paragraph({
      children: [rotulo(maiusculas(d.titulo), { bold: true, color: AZUL, size: 22 })],
      spacing: { after: 20 },
    }),
  ];
  if (subtitulo) {
    textos.push(new Paragraph({ children: [rotulo(subtitulo, { color: CINZA, size: CORPO })], spacing: { after: 20 } }));
  }
  if (comIdentificacao) {
    textos.push(
      linhaPreencher([
        { rotulo: "Aluno(a)", ate: FIM_LINHA - cm(5.2) },
        { rotulo: "Nº", ate: FIM_LINHA - cm(2.6) },
        { rotulo: "Turma", ate: FIM_LINHA },
      ]),
      linhaPreencher([
        { rotulo: "Professor(a)", ate: FIM_LINHA - cm(7.4) },
        { rotulo: "Data", ate: null, depois: "____/____/______" },
        { rotulo: "Nota", ate: FIM_LINHA },
      ]),
    );
  }

  const imagem = d.logo ? logoRun(d.logo) : null;
  const conteudoLogo = imagem
    ? new Paragraph({ alignment: AlignmentType.CENTER, children: [imagem] })
    : new Paragraph({ alignment: AlignmentType.CENTER, children: [rotulo(d.escola, { bold: true, color: AZUL, size: 16 })] });

  return [
    new Table({
      width: { size: LARGURA_UTIL, type: WidthType.DXA },
      columnWidths: [COLUNA_LOGO, LARGURA_TEXTO_CAB],
      borders: TableBorders.NONE,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: COLUNA_LOGO, type: WidthType.DXA },
              verticalAlign: VerticalAlignTable.CENTER,
              margins: { left: 0, right: MARGEM_CELULA, top: 0, bottom: 0 },
              borders: { top: SEM_BORDA, bottom: SEM_BORDA, left: SEM_BORDA, right: FIO_VERTICAL },
              children: [conteudoLogo],
            }),
            new TableCell({
              width: { size: LARGURA_TEXTO_CAB, type: WidthType.DXA },
              verticalAlign: VerticalAlignTable.CENTER,
              margins: { left: MARGEM_CELULA, right: MARGEM_CELULA, top: 0, bottom: 0 },
              borders: { top: SEM_BORDA, bottom: SEM_BORDA, right: SEM_BORDA, left: FIO_VERTICAL },
              children: textos,
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ children: [], spacing: { after: 160 } }),
  ];
}

// ---------- topo das páginas seguintes e rodapé ----------

function topoSeguintes(titulo: string): Header {
  return new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: FIO_CLARO, space: 2 } },
        children: [
          rotulo(maiusculas(titulo.replace(new RegExp(TRAVESSAO.source, "g"), " · ")), {
            size: PEQUENO,
            color: CINZA,
            characterSpacing: 30,
          }),
        ],
      }),
    ],
  });
}

function rodape(texto: string): Footer {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: FIO_CLARO, space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: LARGURA_UTIL }],
        children: [
          rotulo(texto, { size: PEQUENO, color: CINZA }),
          tab(),
          new TextRun({ children: [PageNumber.CURRENT], font: SEM_SERIFA, size: PEQUENO, color: CINZA }),
        ],
      }),
    ],
  });
}

function pagina() {
  return {
    size: { width: LARGURA_A4, height: ALTURA_A4 },
    margin: {
      top: MARGEM_TOPO,
      right: MARGEM_LADO,
      bottom: MARGEM_TOPO,
      left: MARGEM_LADO,
      header: cm(0.6),
      footer: cm(0.6),
    },
  };
}

async function montar(d: DadosFolha, rotuloRodape: string, topo: (Paragraph | Table)[], corpo: Paragraph[]): Promise<Buffer> {
  const footer = rodape(`${tituloCurto(d.titulo)} · ${rotuloRodape}`);
  const header = topoSeguintes(d.titulo);
  const secoes: ISectionOptions[] = [
    // 1ª seção: cabeçalho grande no corpo; o topo de página da 1ª página fica vazio (titlePage).
    {
      properties: { page: pagina(), titlePage: true },
      headers: { default: header, first: new Header({ children: [new Paragraph({})] }) },
      footers: { default: footer, first: footer },
      children: topo,
    },
    // 2ª seção (contínua): questões em duas colunas com fio entre elas; as páginas 2+ usam este topo.
    {
      properties: {
        type: SectionType.CONTINUOUS,
        page: pagina(),
        column: { count: 2, space: ESPACO_COLUNAS, separate: true, equalWidth: true },
      },
      headers: { default: header },
      footers: { default: footer },
      children: corpo.length ? corpo : [new Paragraph({})],
    },
  ];
  const doc = new Document({
    creator: "Status Avalia",
    title: d.titulo,
    styles: {
      default: {
        document: {
          run: { font: SERIFA, size: CORPO },
          paragraph: { spacing: { after: 30, line: LINHA, lineRule: LineRuleType.AUTO } },
        },
      },
    },
    sections: secoes,
  });
  return Packer.toBuffer(doc);
}

// ---------- partes do corpo ----------

/** Faixa da matéria: traço azul à esquerda, fundo suave, "questões 01 a 08" à direita. */
function faixaMateria(materia: string, de: number, ate: number, primeira: boolean): Paragraph {
  const intervalo = de === ate ? `questão ${numero2(de)}` : `questões ${numero2(de)} a ${numero2(ate)}`;
  return new Paragraph({
    keepNext: true,
    keepLines: true,
    shading: { type: ShadingType.CLEAR, fill: FUNDO, color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: AZUL, space: 4 } },
    indent: { left: cm(0.15) },
    tabStops: [{ type: TabStopType.RIGHT, position: LARGURA_COLUNA - cm(0.3) }],
    spacing: { before: primeira ? 0 : 200, after: 80, line: 276, lineRule: LineRuleType.AUTO },
    children: [
      rotulo(maiusculas(materia || "Questões"), { bold: true, color: AZUL, size: 18, characterSpacing: 10 }),
      tab(),
      rotulo(intervalo, { color: CINZA, size: PEQUENO }),
    ],
  });
}

function tituloQuestao(n: number, primeiraDoBloco: boolean): Paragraph {
  return new Paragraph({
    keepNext: true,
    keepLines: true,
    children: [rotulo(`QUESTÃO ${numero2(n)}`, { bold: true, color: AZUL, size: CORPO })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: FIO_CLARO, space: 1 } },
    spacing: { before: primeiraDoBloco ? 60 : 180, after: 60 },
  });
}

type PorQuestao = (q: QuestaoFolha, n: number, primeiraDoBloco: boolean) => Paragraph[];

/** Põe a faixa da matéria antes de cada bloco de questões seguidas da mesma matéria. */
function comFaixas(questoes: QuestaoFolha[], porQuestao: PorQuestao): Paragraph[] {
  const saida: Paragraph[] = [];
  let i = 0;
  while (i < questoes.length) {
    let fim = i;
    while (fim + 1 < questoes.length && questoes[fim + 1].materia === questoes[i].materia) fim++;
    saida.push(faixaMateria(questoes[i].materia, i + 1, fim + 1, i === 0));
    for (let k = i; k <= fim; k++) saida.push(...porQuestao(questoes[k], k + 1, k === i));
    i = fim + 1;
  }
  return saida;
}

// ---------- folha do aluno ----------

function alternativa(letra: string, texto: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: RECUO_ALTERNATIVA, hanging: RECUO_ALTERNATIVA },
    tabStops: [{ type: TabStopType.LEFT, position: RECUO_ALTERNATIVA }],
    spacing: { after: 40 },
    children: [
      caixaLetra(letra),
      tab(),
      // Texto da alternativa numa linha só (quebras viram espaço).
      ...runs(markdownParaBlocos(texto.replace(/\r?\n/g, " "))[0] ?? []),
    ],
  });
}

function paragrafosQuestao(q: QuestaoFolha, n: number, primeiraDoBloco: boolean): Paragraph[] {
  const { corpo, credito } = separarCredito(q.enunciado);
  const saida: Paragraph[] = [tituloQuestao(n, primeiraDoBloco)];
  for (const bloco of blocosNaoVazios(corpo)) saida.push(paragrafoTexto(bloco));
  if (credito) {
    saida.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: runs(markdownParaBlocos(credito)[0] ?? [], { size: PEQUENO }),
        spacing: { after: 60 },
      }),
    );
  }
  for (const bloco of blocosNaoVazios(markdownParaBlocos(q.comando))) {
    saida.push(new Paragraph({ children: runs(bloco), alignment: AlignmentType.JUSTIFIED, spacing: { before: 40, after: 60 } }));
  }
  for (const a of q.alternativas) saida.push(alternativa(a.letra, a.texto));
  return saida;
}

export async function folhaAluno(d: DadosFolha): Promise<Buffer> {
  const topo = cabecalho(d, d.subtitulo?.trim() || null, true);
  return montar(d, "caderno de questões", topo, comFaixas(d.questoes, paragrafosQuestao));
}

// ---------- gabarito (resoluções) ----------

function paragrafosResolucao(q: QuestaoFolha, n: number, primeiraDoBloco: boolean): Paragraph[] {
  const saida: Paragraph[] = [tituloQuestao(n, primeiraDoBloco)];
  for (const bloco of blocosNaoVazios(markdownParaBlocos(q.resolucao ?? ""))) {
    saida.push(new Paragraph({ children: runs(bloco), alignment: AlignmentType.JUSTIFIED, spacing: { after: 30 } }));
  }
  saida.push(
    new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [rotulo("Resposta: ", { bold: true, color: AZUL, size: CORPO }), caixaLetra(q.resposta ?? "—")],
    }),
  );
  return saida;
}

export async function folhaGabarito(d: DadosFolha): Promise<Buffer> {
  const topo = cabecalho(d, "Gabarito comentado", false);
  return montar(d, "gabarito comentado", topo, comFaixas(d.questoes, paragrafosResolucao));
}
