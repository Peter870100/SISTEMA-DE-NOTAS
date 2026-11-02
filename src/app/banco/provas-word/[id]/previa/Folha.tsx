// Desenho da folha da prova em HTML, imitando o .docx (`src/lib/folha/docx.ts`) item por item.
// Medidas: twips do Word convertidos com `px`/`pt` de `medidas.ts`. Sem a biblioteca `docx`.
import type { CSSProperties, ReactNode } from "react";
import { markdownParaBlocos, type Segmento } from "@/lib/questoes/markdown";
import type { MarcaConteudo, NoConteudo } from "@/lib/questoes/conteudo";
import { temTexto, type ItemFolha } from "@/lib/folha/estrutura";
import type { ParteTexto } from "@/lib/folha/dividir";
import type { DadosPrevia, FiguraTela } from "@/lib/folha/previa";
import { numero2, tituloCurto, TRAVESSAO } from "@/lib/folha/texto";
import { linhasIdentificacao, SEPARADOR_LINHA_CABECALHO, type CampoIdentificacao } from "@/lib/folha/editar-prova";
import {
  AZUL,
  BOLINHA_PX,
  CINZA,
  cm,
  COLUNA_LOGO,
  ESPACO_COLUNAS,
  FAIXA_QUESTAO,
  CAIXA_NOTA,
  COLUNA_NOTA,
  FIM_LINHA,
  FIO_CLARO,
  FUNDO,
  LARGURA_COLUNA,
  LARGURA_UTIL,
  larguraTituloQuestao,
  LOGO_LARGURA_PX,
  MARGEM_CELULA,
  px,
  pt,
  RECUO,
  RECUO_ALTERNATIVA,
} from "@/lib/folha/medidas";
import css from "./Previa.module.css";

export type Qual = "prova" | "gabarito";
type Bolinhas = DadosPrevia["bolinhas"];

const p = (twips: number) => `${pt(twips)}pt`;
const x = (twips: number) => `${px(twips)}px`;

/** Cores e medidas da folha como variáveis CSS (vêm das constantes do .docx). */
export const VARIAVEIS_FOLHA = {
  "--folha-azul": `#${AZUL}`,
  "--folha-fundo": `#${FUNDO}`,
  "--folha-cinza": `#${CINZA}`,
  "--folha-fio-claro": `#${FIO_CLARO}`,
  "--folha-faixa-questao": `#${FAIXA_QUESTAO}`,
  "--folha-coluna": x(LARGURA_COLUNA),
  "--folha-espaco-colunas": x(ESPACO_COLUNAS),
  "--folha-largura-util": x(LARGURA_UTIL),
} as CSSProperties;

// ---------- texto ----------

function Segmentos({ segmentos }: { segmentos: Segmento[] }) {
  return (
    <>
      {segmentos.map((s, i) => {
        let no: ReactNode = s.texto;
        if (s.italico) no = <em>{no}</em>;
        if (s.negrito) no = <strong>{no}</strong>;
        return <span key={i}>{no}</span>;
      })}
    </>
  );
}

function comMarcas(texto: ReactNode, marks: MarcaConteudo[] | undefined): ReactNode {
  let no = texto;
  for (const m of marks ?? []) {
    if (m.type === "bold") no = <strong>{no}</strong>;
    else if (m.type === "italic") no = <em>{no}</em>;
    else if (m.type === "underline") no = <u>{no}</u>;
    else if (m.type === "subscript") no = <sub>{no}</sub>;
    else if (m.type === "superscript") no = <sup>{no}</sup>;
  }
  return no;
}

/** Nós em linha do TipTap; `quebraViraEspaco` deixa tudo numa linha só (como `runsConteudo`). */
function EmLinha({ nos, quebraViraEspaco = false }: { nos: NoConteudo[] | undefined; quebraViraEspaco?: boolean }) {
  return (
    <>
      {(nos ?? []).map((n, i) => {
        if (n.type === "hardBreak") return quebraViraEspaco ? <span key={i}> </span> : <br key={i} />;
        if (n.type === "text" && typeof n.text === "string") {
          return <span key={i}>{comMarcas(n.text, Array.isArray(n.marks) ? n.marks : undefined)}</span>;
        }
        return null;
      })}
    </>
  );
}

const ALINHAMENTO_TEXTO: Record<string, CSSProperties["textAlign"]> = {
  left: "left",
  center: "center",
  right: "right",
  justify: "justify",
};
const ALINHAMENTO_FIGURA: Record<string, CSSProperties["textAlign"]> = {
  esquerda: "left",
  centro: "center",
  direita: "right",
};

/**
 * Estilo de um parágrafo de texto (twips antes/depois e recuo de 1ª linha). Num pedaço de parágrafo
 * dividido, só o primeiro tem recuo e espaço antes, só o último tem espaço depois, e os do meio
 * terminam com a última linha justificada (o parágrafo parece contínuo).
 */
function estiloTexto(
  o: { antes: number; depois: number; recuo?: number; alinhamento?: CSSProperties["textAlign"] },
  parte: ParteTexto | undefined,
): CSSProperties {
  const alinhamento = o.alinhamento ?? "justify";
  const primeira = parte?.primeira ?? true;
  const ultima = parte?.ultima ?? true;
  return {
    textAlign: alinhamento,
    textAlignLast: !ultima && alinhamento === "justify" ? "justify" : undefined,
    textIndent: o.recuo && primeira ? x(o.recuo) : undefined,
    paddingTop: primeira ? p(o.antes) : 0,
    paddingBottom: ultima ? p(o.depois) : 0,
  };
}

function ParagrafoConteudo({ no, primeiro, parte }: { no: NoConteudo; primeiro: boolean; parte?: ParteTexto }) {
  const ta = no.attrs?.textAlign;
  const r = no.attrs?.recuo;
  const recuo = typeof r === "number" && Number.isFinite(r) ? Math.min(3, Math.max(0, Math.floor(r))) : 0;
  return (
    <div
      className={css.texto}
      style={{
        ...estiloTexto(
          { antes: primeiro ? 100 : 0, depois: 40, alinhamento: typeof ta === "string" && Object.hasOwn(ALINHAMENTO_TEXTO, ta) ? ALINHAMENTO_TEXTO[ta] : "justify" },
          parte,
        ),
        paddingLeft: recuo ? x(recuo * RECUO) : undefined,
      }}
    >
      <EmLinha nos={no.content} />
    </div>
  );
}

/** Parágrafo vazio do Word (uma linha de altura) com espaço depois. */
function Vazio({ depois }: { depois: number }) {
  return <div className={css.vazio} style={{ paddingBottom: p(depois) }} aria-hidden="true" />;
}

function NoDoConteudo({ no, primeiro, parte }: { no: NoConteudo; primeiro: boolean; parte?: ParteTexto }) {
  if (no.type === "horizontalRule") {
    return (
      <div style={{ paddingTop: p(40), paddingBottom: p(80) }}>
        <div className={css.linhaHorizontal} />
      </div>
    );
  }
  if (no.type === "caixa" && parte) {
    // Pedaço de uma caixa dividida (um parágrafo dela): bordas laterais; topo só no 1º, base só no último.
    const fio = ".5pt solid #000";
    return (
      <div>
        <div
          style={{
            borderLeft: fio,
            borderRight: fio,
            borderTop: parte.primeira ? fio : undefined,
            borderBottom: parte.ultima ? fio : undefined,
            padding: `${parte.primeira ? p(40) : 0} ${x(cm(0.15))} ${parte.ultima ? p(40) : 0}`,
          }}
        >
          {(no.content ?? []).map((n, i) => <ParagrafoConteudo key={i} no={n} primeiro={false} />)}
        </div>
        {parte.ultima && <Vazio depois={40} />}
      </div>
    );
  }
  if (no.type === "caixa") {
    return (
      <div>
        <div className={css.caixa} style={{ padding: `${p(40)} ${x(cm(0.15))}` }}>
          {(no.content ?? []).map((n, i) => <ParagrafoConteudo key={i} no={n} primeiro={false} />)}
        </div>
        <Vazio depois={40} />
      </div>
    );
  }
  return <ParagrafoConteudo no={no} primeiro={primeiro} parte={parte} />;
}

// ---------- marcas das alternativas ----------

function MarcaLetra({ letra, bolinhas }: { letra: string; bolinhas: Bolinhas }) {
  const src = bolinhas[letra.trim().toUpperCase() as keyof Bolinhas];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- data URL da folha; next/image não ajuda aqui.
    return <img src={src} alt={`Alternativa ${letra}`} width={BOLINHA_PX} height={BOLINHA_PX} className={css.bolinha} />;
  }
  return <span className={css.caixaLetra}>{letra}</span>;
}

// ---------- figura ----------

function Figura({
  item,
  alturaMaxima,
}: {
  item: Extract<ItemFolha<FiguraTela>, { tipo: "figura" }>;
  alturaMaxima?: number;
}) {
  const f = item.figura;
  const chave = item.alinhamento && Object.hasOwn(ALINHAMENTO_FIGURA, item.alinhamento) ? item.alinhamento : (f?.alinhamento ?? "centro");
  const recuo = item.naAlternativa ? RECUO_ALTERNATIVA : 0;
  const maximo = Math.floor((LARGURA_COLUNA - recuo) / 15);
  const comum: CSSProperties = { textAlign: ALINHAMENTO_FIGURA[chave], paddingLeft: recuo ? x(recuo) : undefined };
  const legenda = item.legenda ? (
    <div className={css.legenda} style={{ ...comum, paddingBottom: p(60) }}>{item.legenda}</div>
  ) : null;

  if (!f?.src) {
    return (
      <div>
        <div className={css.texto} style={{ ...comum, paddingTop: p(60), paddingBottom: p(60) }}><em>[Figura indisponível]</em></div>
        {legenda}
      </div>
    );
  }
  // Largura e altura 0 = desconhecidas: vale o tamanho natural da imagem, até a largura da coluna.
  const largura = f.largura > 0 ? Math.min(f.largura, maximo) : undefined;
  const estilo: CSSProperties =
    alturaMaxima !== undefined
      ? { maxWidth: largura ?? maximo, maxHeight: Math.max(1, alturaMaxima), width: "auto", height: "auto", objectFit: "contain" }
      : { width: largura, maxWidth: maximo, height: "auto" };
  return (
    <div>
      <div className={css.figura} style={{ ...comum, paddingTop: p(60), paddingBottom: p(item.legenda ? 20 : 60) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL da folha; next/image não ajuda aqui. */}
        <img src={f.src} alt={item.legenda || "Figura da questão"} data-figura="" style={estilo} />
      </div>
      {legenda}
    </div>
  );
}

// ---------- itens ----------

function Faixa({ item }: { item: Extract<ItemFolha<FiguraTela>, { tipo: "faixa" }> }) {
  const intervalo = item.de === item.ate ? `questão ${numero2(item.de)}` : `questões ${numero2(item.de)} a ${numero2(item.ate)}`;
  return (
    <div style={{ paddingTop: p(item.primeira ? 0 : 200), paddingBottom: p(80) }}>
      <div className={css.faixa} style={{ paddingRight: x(cm(0.3)) }}>
        <span className={css.faixaMateria}>{(item.materia || "Questões").toLocaleUpperCase("pt-BR")}</span>
        <span className={css.faixaIntervalo}>{intervalo}</span>
      </div>
    </div>
  );
}

function TituloQuestao({ numero, primeiraDoBloco, valor }: { numero: number; primeiraDoBloco: boolean; valor?: string }) {
  const esquerda = larguraTituloQuestao(numero, valor);
  return (
    <div className={css.tituloQuestao}>
      <div className={css.tituloTexto} style={{ width: x(esquerda), paddingTop: p(primeiraDoBloco ? 60 : 200), paddingRight: x(cm(0.15)) }}>
        QUESTÃO {numero2(numero)}
        {valor ? <span style={{ fontWeight: 400 }}> ({valor})</span> : null}
      </div>
      <div className={css.tituloFaixa}>
        <div />
      </div>
    </div>
  );
}

function Alternativa({ item, bolinhas }: { item: Extract<ItemFolha<FiguraTela>, { tipo: "alternativa" }>; bolinhas: Bolinhas }) {
  const primeiro = item.conteudo?.content?.find((n) => n.type === "paragraph");
  const texto =
    primeiro && temTexto(primeiro) ? (
      <EmLinha nos={primeiro.content} quebraViraEspaco />
    ) : (
      <Segmentos segmentos={markdownParaBlocos(item.texto.replace(/\r?\n/g, " "))[0] ?? []} />
    );
  return (
    <div className={css.alternativa} style={{ paddingLeft: x(RECUO_ALTERNATIVA), paddingBottom: p(60) }}>
      <span className={css.marca} style={{ width: x(RECUO_ALTERNATIVA) }}>
        <MarcaLetra letra={item.letra} bolinhas={bolinhas} />
      </span>
      {texto}
    </div>
  );
}

function Tabela({ linhas }: { linhas: string[][] }) {
  const colunas = Math.max(...linhas.map((l) => l.length));
  const largura = Math.floor(LARGURA_COLUNA / colunas);
  return (
    <div>
      <table className={css.tabela} style={{ width: x(largura * colunas) }}>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className={i === 0 ? css.tabelaCabeca : undefined}>
              {Array.from({ length: colunas }, (_, c) => (
                <td key={c} style={{ width: x(largura), padding: `${p(20)} ${x(cm(0.1))}` }}>{l[c] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Vazio depois={40} />
    </div>
  );
}

function Credito({ credito, origem }: { credito: string | null; origem: string | null }) {
  return (
    <div className={css.credito} style={{ paddingBottom: p(60) }}>
      {credito && <Segmentos segmentos={markdownParaBlocos(credito)[0] ?? []} />}
      {credito && origem && <br />}
      {origem && <span className={css.origem}>{origem}</span>}
    </div>
  );
}

/**
 * Um item da estrutura comum desenhado como bloco; `alturaMaximaFigura` reduz a figura para caber;
 * `parte` marca um pedaço de texto dividido (`src/lib/folha/dividir.ts`).
 */
export function Bloco({
  item,
  bolinhas,
  alturaMaximaFigura,
  parte,
}: {
  item: ItemFolha<FiguraTela>;
  bolinhas: Bolinhas;
  alturaMaximaFigura?: number;
  parte?: ParteTexto;
}) {
  switch (item.tipo) {
    case "faixa":
      return <Faixa item={item} />;
    case "titulo":
      return <TituloQuestao numero={item.numero} primeiraDoBloco={item.primeiraDoBloco} valor={item.valor} />;
    case "paragrafo":
      return (
        <div className={css.texto} style={estiloTexto({ antes: item.indice === 0 ? 100 : 0, depois: 40, recuo: RECUO }, parte)}>
          <Segmentos segmentos={item.segmentos} />
        </div>
      );
    case "tabela":
      return <Tabela linhas={item.linhas} />;
    case "noConteudo":
      return <NoDoConteudo no={item.no} primeiro={item.primeiro} parte={parte} />;
    case "figura":
      return <Figura item={item} alturaMaxima={alturaMaximaFigura} />;
    case "credito":
      return <Credito credito={item.credito} origem={item.origem} />;
    case "comando":
      return (
        <div className={css.texto} style={estiloTexto({ antes: item.indice === 0 ? (item.comTexto ? 60 : 100) : 0, depois: 60 }, parte)}>
          <Segmentos segmentos={item.segmentos} />
        </div>
      );
    case "alternativa":
      return <Alternativa item={item} bolinhas={bolinhas} />;
    case "resolucao":
      return (
        <div className={css.texto} style={estiloTexto({ antes: item.indice === 0 ? 100 : 0, depois: 40 }, parte)}>
          <Segmentos segmentos={item.segmentos} />
        </div>
      );
    case "resposta":
      return (
        <div className={css.texto} style={{ paddingTop: p(60), paddingBottom: p(40) }}>
          <strong>Resposta: </strong>
          {item.letra ? <MarcaLetra letra={item.letra} bolinhas={bolinhas} /> : "—"}
        </div>
      );
    case "aviso":
      return <div className={css.avisoFinal} style={{ paddingTop: p(240) }}>{item.texto}</div>;
  }
}

// ---------- cabeçalho, topo e rodapé ----------

/** Linha "Rótulo: ____  Rótulo: ____"; o último campo vai até o fim da linha. */
function LinhaPreencher({ campos }: { campos: CampoIdentificacao[] }) {
  // Início de cada campo: fim do último campo anterior que tem linha (0 no primeiro).
  const inicios = campos.map((_, i) => campos.slice(0, i).reduce((fim, c) => c.ate ?? fim, 0));
  return (
    <div className={css.linhaPreencher} style={{ width: x(FIM_LINHA), paddingTop: p(100) }}>
      {campos.map((c, i) => {
        const ultimo = i === campos.length - 1;
        const estilo: CSSProperties = ultimo ? { flex: 1 } : c.ate !== null ? { width: x(c.ate - inicios[i]), flex: "none" } : { flex: "none" };
        return (
          <span key={c.rotulo} className={css.campo} style={estilo}>
            <span className={css.rotuloCampo}>{`${i ? "  " : ""}${c.rotulo}: `}</span>
            {c.ate !== null && <span className={css.traco} />}
            {c.depois && <span className={css.depois}>{c.depois}</span>}
          </span>
        );
      })}
    </div>
  );
}

/** Linha "Turma: X    Data: dd/mm/aaaa    Valor: Y" (só os preenchidos) ou o nome longo do professor; quebra em vez de vazar, como no Word. */
function LinhaInformada({ itens }: { itens: { rotulo: string; valor: string }[] }) {
  if (itens.length === 0) return null;
  return (
    <div className={css.linhaInformada} style={{ width: x(FIM_LINHA), paddingTop: p(100) }}>
      {itens.map((it, i) => (
        <span key={it.rotulo}>
          <span className={css.rotuloCampo}>{`${i ? SEPARADOR_LINHA_CABECALHO : ""}${it.rotulo}: `}</span>
          <span className={css.depois}>{it.valor}</span>
        </span>
      ))}
    </div>
  );
}

/** Cabeçalho da 1ª página: logo (ou nome da escola) | título e linhas de identificação. */
export function Cabecalho({ dados, qual }: { dados: DadosPrevia; qual: Qual }) {
  const cab = qual === "prova" ? dados.cabecalho : {};
  const prova = qual === "prova";
  const linhas = linhasIdentificacao(cab, prova ? dados.professor : null, prova ? dados.disciplina : null);
  return (
    <div>
      <div className={css.cabecalho}>
        <div className={css.cabecalhoLogo} style={{ width: x(COLUNA_LOGO), paddingRight: x(MARGEM_CELULA) }}>
          {dados.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL da folha; next/image não ajuda aqui.
            <img src={dados.logo} alt={dados.escola} style={{ width: LOGO_LARGURA_PX, height: "auto" }} />
          ) : (
            <span className={css.cabecalhoEscola}>{dados.escola}</span>
          )}
        </div>
        <div className={css.cabecalhoTexto} style={{ paddingLeft: x(MARGEM_CELULA), paddingRight: x(MARGEM_CELULA) }}>
          <div className={css.cabecalhoTitulo}>{dados.titulo.toLocaleUpperCase("pt-BR")}</div>
          {qual === "gabarito" ? (
            <div className={css.cabecalhoSubtitulo}>Gabarito comentado</div>
          ) : (
            <>
              <LinhaPreencher campos={linhas.aluno} />
              <LinhaInformada itens={linhas.nomeProfessor} />
              {linhas.professor.length > 0 && <LinhaPreencher campos={linhas.professor} />}
              <LinhaInformada itens={linhas.informada} />
            </>
          )}
        </div>
        {prova && (
          <div className={css.cabecalhoNota} style={{ width: x(COLUNA_NOTA) }}>
            <span className={css.rotuloNota}>NOTA</span>
            <span className={css.caixaNota} style={{ width: x(CAIXA_NOTA.largura), height: x(CAIXA_NOTA.altura) }}>
              {linhas.notaDe && <span className={css.notaDe}>de {linhas.notaDe}</span>}
            </span>
          </div>
        )}
      </div>
      {cab.instrucoes && (
        <div className={css.instrucoes} style={{ paddingTop: p(100) }}>
          <span className={css.rotuloCampo}>Instruções: </span>
          {cab.instrucoes}
        </div>
      )}
      <Vazio depois={160} />
    </div>
  );
}

export function TopoSeguintes({ titulo }: { titulo: string }) {
  return (
    <div className={css.topo}>
      {titulo.replace(new RegExp(TRAVESSAO.source, "g"), " · ").toLocaleUpperCase("pt-BR")}
    </div>
  );
}

export function Rodape({ titulo, qual, numero }: { titulo: string; qual: Qual; numero: number }) {
  return (
    <div className={css.rodape}>
      <span>{`${tituloCurto(titulo)} · ${qual === "gabarito" ? "gabarito comentado" : "caderno de questões"}`}</span>
      <span>{numero}</span>
    </div>
  );
}
