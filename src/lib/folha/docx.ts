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
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type IRunOptions,
  type ISectionOptions,
} from "docx";
import { markdownParaBlocos, type Segmento } from "@/lib/questoes/markdown";
import type { NoConteudo } from "@/lib/questoes/conteudo";
import { itensGabarito, itensProva, temTexto, type FiguraRef, type ItemFolha, type QuestaoBase } from "./estrutura";
import { numero2, tituloCurto, TRAVESSAO } from "./texto";
import { linhasIdentificacao, SEPARADOR_LINHA_CABECALHO, type CabecalhoProva, type CampoIdentificacao } from "./editar-prova";
import {
  ALTURA_A4,
  AZUL,
  BOLINHA_PX,
  CINZA,
  cm,
  COLUNA_LOGO,
  CORPO,
  CORPO_QUESTAO,
  DISTANCIA_TOPO_RODAPE,
  ESPACO_COLUNAS,
  FAIXA_QUESTAO,
  FIO_CLARO,
  FONTE_QUESTAO,
  FUNDO,
  LARGURA_A4,
  LARGURA_COLUNA,
  LARGURA_TEXTO_CAB,
  LARGURA_UTIL,
  LINHA,
  LOGO_LARGURA_PX,
  MARGEM_CELULA,
  MARGEM_LADO,
  MARGEM_TOPO,
  PEQUENO,
  PRETO,
  RECUO,
  RECUO_ALTERNATIVA,
  SEM_SERIFA,
  TITULO_QUESTAO,
  TWIPS_POR_PX,
  larguraTituloQuestao,
} from "./medidas";

export type { AlvoFigura } from "./estrutura";

/** Figura já carregada (PNG); `png: null` = indisponível. Largura e altura em px. */
export type FiguraFolha = FiguraRef & { png: Buffer | null; largura: number; altura: number };

export type QuestaoFolha = QuestaoBase<FiguraFolha>;

export type LetraBolinha = "A" | "B" | "C" | "D" | "E";

export type DadosFolha = {
  titulo: string;
  /** Linha abaixo do título (ex.: "9º ano · Ensino Fundamental"). */
  subtitulo?: string | null;
  escola: string;
  logo: Buffer | null;
  questoes: QuestaoFolha[];
  /** PNGs das bolinhas das alternativas (padrão ENEM); sem a da letra, usa a letra em caixinha. */
  bolinhas?: Partial<Record<LetraBolinha, Buffer>> | null;
  /** Texto discreto no fim da prova e do gabarito. */
  avisoFinal?: string | null;
  /** Turma, data, valor e instruções da prova (só aparecem na folha do aluno). */
  cabecalho?: CabecalhoProva | null;
  /** Nome do professor na linha "Professor(a)" (já com a matéria, se houver); só na folha do aluno. */
  professor?: string | null;
};


function runs(segmentos: Segmento[], extra: { size?: number; bold?: boolean } = {}): TextRun[] {
  return segmentos.map(
    (s) =>
      new TextRun({
        text: s.texto,
        bold: extra.bold || s.negrito,
        italics: s.italico,
        size: extra.size ?? CORPO_QUESTAO,
        color: PRETO,
        font: FONTE_QUESTAO,
      }),
  );
}

type OpcoesRotulo = { size?: number; bold?: boolean; italics?: boolean; color?: string; characterSpacing?: number };

/** Texto em Calibri (títulos, rótulos, faixas, rodapé). */
function rotulo(text: string, o: OpcoesRotulo = {}): TextRun {
  return new TextRun({ text, font: SEM_SERIFA, ...o });
}

function tab(): TextRun {
  return new TextRun({ children: [new Tab()] });
}

/** Parágrafo do texto-base: justificado, recuo de 1ª linha; o 1º ganha respiro sob o título. */
function paragrafoTexto(segmentos: Segmento[], i: number): Paragraph {
  return new Paragraph({
    children: runs(segmentos),
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: RECUO },
    spacing: { before: i === 0 ? 100 : 0, after: 40 },
  });
}

type OpcoesTexto = Pick<IRunOptions, "size" | "bold" | "italics" | "underline" | "subScript" | "superScript">;

/** Texto em Arial preto (partes da questão que não vêm do markdown). */
function textoQuestao(text: string, o: OpcoesTexto = {}): TextRun {
  return new TextRun({ text, font: FONTE_QUESTAO, color: PRETO, size: CORPO_QUESTAO, ...o });
}

/** Bolinha preta com a letra branca (PNG inline, levemente abaixada para centrar na linha). */
function bolinha(letra: string, bolinhas: DadosFolha["bolinhas"]): ImageRun | null {
  const png = bolinhas?.[letra.trim().toUpperCase() as LetraBolinha];
  if (!png) return null;
  return new ImageRun({
    type: "png",
    data: png,
    transformation: { width: BOLINHA_PX, height: BOLINHA_PX },
    altText: { name: `Alternativa ${letra}`, description: `Alternativa ${letra}`, title: letra },
    run: { position: "-1.5pt" },
  });
}

function marcaLetra(letra: string, bolinhas: DadosFolha["bolinhas"]): ImageRun | TextRun {
  return bolinha(letra, bolinhas) ?? caixaLetra(letra);
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


/** Linha "Rótulo: ____  Rótulo: ____" com tabs de leader sublinhado (fim de cada campo em `ate`). */
function linhaPreencher(campos: CampoIdentificacao[]): Paragraph {
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

/**
 * Linha "Turma: X    Data: dd/mm/aaaa    Valor: Y" com só os campos preenchidos (sem tabs: o Word quebra se não couber).
 * Também serve para o nome longo do professor ("Professor(a): …").
 */
function linhaInformada(itens: { rotulo: string; valor: string }[]): Paragraph {
  const children: TextRun[] = [];
  itens.forEach((it, i) => {
    children.push(rotulo(`${i ? SEPARADOR_LINHA_CABECALHO : ""}${it.rotulo}: `, { bold: true, color: AZUL, size: 18 }));
    children.push(rotulo(it.valor, { size: 18 }));
  });
  return new Paragraph({ children, spacing: { before: 100, after: 0 } });
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
  const cab = comIdentificacao ? (d.cabecalho ?? {}) : {};
  if (comIdentificacao) {
    const linhas = linhasIdentificacao(cab, d.professor);
    textos.push(linhaPreencher(linhas.aluno));
    if (linhas.nomeProfessor.length > 0) textos.push(linhaInformada(linhas.nomeProfessor));
    textos.push(linhaPreencher(linhas.professor));
    if (linhas.informada.length > 0) textos.push(linhaInformada(linhas.informada));
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
    ...(cab.instrucoes ? [instrucoes(cab.instrucoes)] : []),
    new Paragraph({ children: [], spacing: { after: 160 } }),
  ];
}

/** "Instruções: " em negrito azul e o texto logo depois; cada quebra de linha vira quebra no Word. */
function instrucoes(texto: string): Paragraph {
  const children = texto.split(/\r?\n/).map((linha, i) => new TextRun({ text: linha, font: SEM_SERIFA, size: CORPO, break: i ? 1 : undefined }));
  return new Paragraph({
    children: [rotulo("Instruções: ", { bold: true, color: AZUL, size: CORPO }), ...children],
    spacing: { before: 100, after: 0 },
  });
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
      header: DISTANCIA_TOPO_RODAPE,
      footer: DISTANCIA_TOPO_RODAPE,
    },
  };
}

async function montar(
  d: DadosFolha,
  rotuloRodape: string,
  topo: (Paragraph | Table)[],
  corpo: (Paragraph | Table)[],
): Promise<Buffer> {
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
          run: { font: FONTE_QUESTAO, size: CORPO_QUESTAO },
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

/**
 * "QUESTÃO 01" + faixa cinza até o fim da coluna, com linha preta embaixo (caderno do ENEM).
 * Tabela 1 × 2 sem bordas, exceto a inferior; a faixa é um parágrafo sombreado de altura fixa.
 */
function tituloQuestao(n: number, primeiraDoBloco: boolean, valor?: string): Table {
  const texto = `QUESTÃO ${numero2(n)}`;
  const esquerda = larguraTituloQuestao(n, valor);
  const direita = LARGURA_COLUNA - esquerda;
  const linha = { style: BorderStyle.SINGLE, size: 8, color: PRETO } as const; // 1 pt
  return new Table({
    width: { size: LARGURA_COLUNA, type: WidthType.DXA },
    columnWidths: [esquerda, direita],
    layout: TableLayoutType.FIXED,
    borders: {
      top: SEM_BORDA,
      left: SEM_BORDA,
      right: SEM_BORDA,
      insideHorizontal: SEM_BORDA,
      insideVertical: SEM_BORDA,
      bottom: linha,
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: esquerda, type: WidthType.DXA },
            verticalAlign: VerticalAlignTable.BOTTOM,
            margins: { left: 0, right: cm(0.15), top: 0, bottom: 20 },
            children: [
              new Paragraph({
                keepNext: true,
                keepLines: true,
                spacing: { before: primeiraDoBloco ? 60 : 200, after: 0 },
                children: [
                  textoQuestao(texto, { bold: true, size: TITULO_QUESTAO }),
                  ...(valor ? [textoQuestao(` (${valor})`, { size: TITULO_QUESTAO })] : []),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: direita, type: WidthType.DXA },
            verticalAlign: VerticalAlignTable.BOTTOM,
            margins: { left: 0, right: 0, top: 0, bottom: 20 },
            children: [
              new Paragraph({
                keepNext: true,
                keepLines: true,
                shading: { type: ShadingType.CLEAR, fill: FAIXA_QUESTAO, color: "auto" },
                spacing: { before: 0, after: 40, line: 160, lineRule: LineRuleType.EXACT },
                children: [textoQuestao(" ", { size: 12 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

type Bloco = Paragraph | Table;

// ---------- conteúdo formatado (TipTap) e figuras ----------

type Alinhamento = (typeof AlignmentType)[keyof typeof AlignmentType];

const ALINHAMENTO_TEXTO: Record<string, Alinhamento> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};
const ALINHAMENTO_FIGURA: Record<string, Alinhamento> = {
  esquerda: AlignmentType.LEFT,
  centro: AlignmentType.CENTER,
  direita: AlignmentType.RIGHT,
};
const FIO_FINO = { style: BorderStyle.SINGLE, size: 4, color: PRETO } as const; // 0,5 pt

/** Runs dos nós em linha (texto com marcas e quebra); `quebraViraEspaco` deixa tudo numa linha só. */
function runsConteudo(nos: NoConteudo[] | undefined, quebraViraEspaco = false): TextRun[] {
  const saida: TextRun[] = [];
  for (const n of nos ?? []) {
    if (n.type === "hardBreak") {
      saida.push(quebraViraEspaco ? textoQuestao(" ") : new TextRun({ break: 1 }));
    } else if (n.type === "text" && typeof n.text === "string") {
      const marcas = new Set((Array.isArray(n.marks) ? n.marks : []).map((m) => m.type));
      saida.push(
        textoQuestao(n.text, {
          bold: marcas.has("bold") || undefined,
          italics: marcas.has("italic") || undefined,
          underline: marcas.has("underline") ? {} : undefined,
          subScript: marcas.has("subscript") || undefined,
          superScript: marcas.has("superscript") || undefined,
        }),
      );
    }
  }
  return saida;
}

function paragrafoConteudo(no: NoConteudo, primeiro: boolean): Paragraph {
  const ta = no.attrs?.textAlign;
  const r = no.attrs?.recuo;
  const recuo = typeof r === "number" && Number.isFinite(r) ? Math.min(3, Math.max(0, Math.floor(r))) : 0;
  return new Paragraph({
    children: runsConteudo(no.content),
    alignment: typeof ta === "string" && Object.hasOwn(ALINHAMENTO_TEXTO, ta) ? ALINHAMENTO_TEXTO[ta] : AlignmentType.JUSTIFIED,
    indent: recuo ? { left: recuo * RECUO } : undefined,
    spacing: { before: primeiro ? 100 : 0, after: 40 },
  });
}

function avisoFiguraIndisponivel(alinhamento: Alinhamento, recuo: number): Paragraph {
  return new Paragraph({
    alignment: alinhamento,
    indent: recuo ? { left: recuo } : undefined,
    spacing: { before: 60, after: 60 },
    children: [textoQuestao("[Figura indisponível]", { italics: true })],
  });
}

/**
 * Figura em parágrafo próprio: largura limitada ao espaço disponível (coluna menos o recuo),
 * altura proporcional; sem PNG vira aviso em itálico. Legenda opcional logo abaixo.
 */
function paragrafosFigura(
  f: FiguraFolha | undefined,
  o: { alinhamento?: string; legenda?: string; recuo?: number } = {},
): Paragraph[] {
  const chave = o.alinhamento && Object.hasOwn(ALINHAMENTO_FIGURA, o.alinhamento) ? o.alinhamento : (f?.alinhamento ?? "centro");
  const alinhamento = ALINHAMENTO_FIGURA[chave];
  const recuo = o.recuo ?? 0;
  const saida: Paragraph[] = [];
  const info = f?.png ? infoImagem(f.png) : null;
  const largura = f && f.largura > 0 ? f.largura : (info?.largura ?? 0);
  const altura = f && f.altura > 0 ? f.altura : (info?.altura ?? 0);
  if (!f?.png || !largura || !altura) {
    saida.push(avisoFiguraIndisponivel(alinhamento, recuo));
  } else {
    const maximo = Math.floor((LARGURA_COLUNA - recuo) / TWIPS_POR_PX);
    const w = Math.min(largura, maximo);
    const h = Math.max(1, Math.round((altura * w) / largura));
    saida.push(
      new Paragraph({
        alignment: alinhamento,
        indent: recuo ? { left: recuo } : undefined,
        keepLines: true,
        spacing: { before: 60, after: o.legenda ? 20 : 60 },
        children: [
          new ImageRun({
            type: "png",
            data: f.png,
            transformation: { width: w, height: h },
            altText: { name: "Figura", description: o.legenda || "Figura da questão", title: "Figura" },
          }),
        ],
      }),
    );
  }
  if (o.legenda) {
    saida.push(
      new Paragraph({
        alignment: alinhamento,
        indent: recuo ? { left: recuo } : undefined,
        spacing: { after: 60 },
        children: [textoQuestao(o.legenda, { size: PEQUENO })],
      }),
    );
  }
  return saida;
}

/** Parágrafo, linha ou caixa (tabela 1 × 1) do enunciado formatado. */
function blocosNoConteudo(no: NoConteudo, primeiro: boolean): Bloco[] {
  if (no.type === "horizontalRule") {
    return [new Paragraph({ border: { bottom: { ...FIO_FINO, space: 1 } }, spacing: { before: 40, after: 80 }, children: [] })];
  }
  if (no.type === "caixa") {
    return [
      new Table({
        width: { size: LARGURA_COLUNA, type: WidthType.DXA },
        columnWidths: [LARGURA_COLUNA],
        layout: TableLayoutType.FIXED,
        borders: { top: FIO_FINO, bottom: FIO_FINO, left: FIO_FINO, right: FIO_FINO, insideHorizontal: SEM_BORDA, insideVertical: SEM_BORDA },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: LARGURA_COLUNA, type: WidthType.DXA },
                margins: { left: cm(0.15), right: cm(0.15), top: 40, bottom: 40 },
                children: (no.content ?? []).map((p) => paragrafoConteudo(p, false)),
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ children: [], spacing: { after: 40 } }),
    ];
  }
  return [paragrafoConteudo(no, primeiro)];
}

/** "UFMS 2024" em cinza, pequeno, à direita (sozinho; com crédito vai no parágrafo dele). */
function runOrigem(origem: string, quebraAntes: boolean): TextRun {
  return new TextRun({ text: origem, font: FONTE_QUESTAO, size: PEQUENO, color: CINZA, break: quebraAntes ? 1 : undefined });
}

function avisoFinal(texto: string): Paragraph {
  return new Paragraph({ spacing: { before: 240, after: 0 }, children: [rotulo(texto, { size: PEQUENO, italics: true, color: CINZA })] });
}

// ---------- folha do aluno ----------

type Alternativa = QuestaoFolha["alternativas"][number];

/** Texto da alternativa numa linha só (quebras viram espaço); com `conteudo`, os runs do 1º parágrafo. */
function runsAlternativa(a: Alternativa): TextRun[] {
  const primeiro = a.conteudo?.content?.find((n) => n.type === "paragraph");
  if (primeiro && temTexto(primeiro)) return runsConteudo(primeiro.content, true);
  return runs(markdownParaBlocos(a.texto.replace(/\r?\n/g, " "))[0] ?? []);
}

function alternativa(a: Alternativa, bolinhas: DadosFolha["bolinhas"]): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: RECUO_ALTERNATIVA, hanging: RECUO_ALTERNATIVA },
    tabStops: [{ type: TabStopType.LEFT, position: RECUO_ALTERNATIVA }],
    spacing: { after: 60 },
    children: [marcaLetra(a.letra, bolinhas), tab(), ...runsAlternativa(a)],
  });
}

/** Tabela simples com fio fino; a primeira linha (cabeçalho) em negrito. */
function tabelaMarkdown(linhas: string[][]): Table {
  const colunas = Math.max(...linhas.map((l) => l.length));
  const largura = Math.floor(LARGURA_COLUNA / colunas);
  return new Table({
    width: { size: largura * colunas, type: WidthType.DXA },
    columnWidths: Array(colunas).fill(largura),
    layout: TableLayoutType.FIXED,
    borders: TableBorders.NONE,
    rows: linhas.map(
      (l, i) =>
        new TableRow({
          children: Array.from({ length: colunas }, (_, c) =>
            new TableCell({
              width: { size: largura, type: WidthType.DXA },
              borders: { top: FIO_FINO, bottom: FIO_FINO, left: FIO_FINO, right: FIO_FINO },
              shading: i === 0 ? { type: ShadingType.CLEAR, color: "auto", fill: FUNDO } : undefined,
              margins: { left: cm(0.1), right: cm(0.1), top: 20, bottom: 20 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [textoQuestao(l[c] ?? "", { size: PEQUENO + 1, bold: i === 0 })] })],
            }),
          ),
        }),
    ),
  });
}

function credito(texto: string | null, origem: string | null): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      ...(texto ? runs(markdownParaBlocos(texto)[0] ?? [], { size: PEQUENO }) : []),
      ...(origem ? [runOrigem(origem, !!texto)] : []),
    ],
    spacing: { after: 60 },
  });
}

function resposta(letra: string | null, bolinhas: DadosFolha["bolinhas"]): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 40 },
    children: [textoQuestao("Resposta: ", { bold: true }), letra ? marcaLetra(letra, bolinhas) : textoQuestao("—")],
  });
}

/** Desenha um item da estrutura comum (`./estrutura`) com os blocos do Word. */
function blocosItem(item: ItemFolha<FiguraFolha>, bolinhas: DadosFolha["bolinhas"]): Bloco[] {
  switch (item.tipo) {
    case "faixa":
      return [faixaMateria(item.materia, item.de, item.ate, item.primeira)];
    case "titulo":
      return [tituloQuestao(item.numero, item.primeiraDoBloco, item.valor)];
    case "paragrafo":
      return [paragrafoTexto(item.segmentos, item.indice)];
    case "tabela":
      return [tabelaMarkdown(item.linhas), new Paragraph({ children: [], spacing: { after: 40 } })];
    case "noConteudo":
      return blocosNoConteudo(item.no, item.primeiro);
    case "figura":
      return paragrafosFigura(item.figura, {
        alinhamento: item.alinhamento,
        legenda: item.legenda,
        recuo: item.naAlternativa ? RECUO_ALTERNATIVA : undefined,
      });
    case "credito":
      return [credito(item.credito, item.origem)];
    case "comando":
      return [
        new Paragraph({
          children: runs(item.segmentos),
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: item.indice === 0 ? (item.comTexto ? 60 : 100) : 0, after: 60 },
        }),
      ];
    case "alternativa":
      return [alternativa(item, bolinhas)];
    case "resolucao":
      return [
        new Paragraph({
          children: runs(item.segmentos),
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: item.indice === 0 ? 100 : 0, after: 40 },
        }),
      ];
    case "resposta":
      return [resposta(item.letra, bolinhas)];
    case "aviso":
      return [avisoFinal(item.texto)];
  }
}

function desenhar(itens: ItemFolha<FiguraFolha>[], bolinhas: DadosFolha["bolinhas"]): Bloco[] {
  return itens.flatMap((item) => blocosItem(item, bolinhas));
}

export async function folhaAluno(d: DadosFolha): Promise<Buffer> {
  const topo = cabecalho(d, d.subtitulo?.trim() || null, true);
  return montar(d, "caderno de questões", topo, desenhar(itensProva(d.questoes, d.avisoFinal), d.bolinhas));
}

// ---------- gabarito (resoluções) ----------

export async function folhaGabarito(d: DadosFolha): Promise<Buffer> {
  const topo = cabecalho(d, "Gabarito comentado", false);
  return montar(d, "gabarito comentado", topo, desenhar(itensGabarito(d.questoes, d.avisoFinal), d.bolinhas));
}
