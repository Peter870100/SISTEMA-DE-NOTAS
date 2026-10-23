import { test } from "node:test";
import assert from "node:assert/strict";
import { caminhoOriginal, ehDesenhoIndisponivel, caminhoSelecao, desenharProximaLeva, ehNaoEncontrado, OriginalNaoEncontrado, ENVIO_JPEG, ENVIO_JSON, ENVIO_PDF, erroDoArquivo, planejarLeva, validarSelecao, type DepsLeva, type TipoArquivo } from "./importacao-levas";
import type { AtorEscola } from "@/lib/simulados/ator";

const ator: AtorEscola = { id: "p1", role: "professor", escola_id: "e1", turmas: null, via: "hermes" };
const faixa = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test("planejarLeva: cabe no orçamento de 40 s", () => {
  assert.equal(planejarLeva(faixa(60), 900).length, 44);
  assert.deepEqual(planejarLeva(faixa(60), 900).slice(0, 3), [1, 2, 3]);
  assert.deepEqual(planejarLeva(faixa(60), null), [1, 2, 3, 4, 5]);
  assert.deepEqual(planejarLeva([7, 8], null), [7, 8]);
  assert.deepEqual(planejarLeva(faixa(60), 50000), [1]);
  assert.deepEqual(planejarLeva([], 900), []);
  assert.deepEqual(planejarLeva([], null), []);
  assert.equal(planejarLeva(faixa(10), 900, 3000).length, 3);
});

test("erroDoArquivo: cita o arquivo nas mensagens do PDF", () => {
  assert.equal(erroDoArquivo("O PDF está protegido por senha.", "prova"), "O PDF da prova está protegido por senha.");
  assert.equal(erroDoArquivo("Não consegui abrir o PDF.", "gabarito"), "Não consegui abrir o PDF do gabarito.");
  assert.equal(erroDoArquivo("Falhou a rede.", "prova"), "PDF da prova: Falhou a rede.");
});

test("validarSelecao", () => {
  assert.equal(validarSelecao({ prova: [], gabarito: [1] }), "Nenhuma página escolhida.");
  assert.equal(validarSelecao({ prova: [1, 2], gabarito: [] }), null);
  assert.equal(validarSelecao({ prova: [0], gabarito: [] }), "Página inválida.");
  assert.equal(validarSelecao({ prova: [1.5], gabarito: [] }), "Página inválida.");
  assert.equal(validarSelecao({ prova: faixa(61), gabarito: [] }), "No máximo 60 páginas por arquivo.");
  assert.equal(validarSelecao({ prova: [1, 1], gabarito: [] }), "Página repetida na seleção.");
});

/** Mundo falso: storage, tabela de páginas e relógio, sem rede nem banco. */
function mundo(opcoes: { paginasPdf?: Partial<Record<TipoArquivo, number>>; msPorPagina?: number; falhaEm?: { tipo: TipoArquivo; numero: number }; erroAbrir?: string } = {}) {
  let relogio = 0;
  const prontas = new Map<string, { largura: number; altura: number }>();
  const desenhos: string[] = [];
  const envios: string[] = [];
  const originaisLidos: TipoArquivo[] = [];
  let fechados = 0;
  const deps: DepsLeva = {
    exigir: async () => {},
    paginasProntas: async () => [...prontas.keys()].map((k) => { const [tipo, n] = k.split("-"); return { tipo: tipo as TipoArquivo, numero: Number(n) }; }),
    lerOriginal: async (_id, tipo) => { originaisLidos.push(tipo); return new TextEncoder().encode(`%PDF-${tipo}`); },
    abrirPdf: async (bytes) => {
      if (opcoes.erroAbrir) throw new Error(opcoes.erroAbrir);
      const tipo = new TextDecoder().decode(bytes).slice(5) as TipoArquivo;
      return {
        numPaginas: opcoes.paginasPdf?.[tipo] ?? 60,
        async desenhar(n) {
          relogio += opcoes.msPorPagina ?? 100;
          if (opcoes.falhaEm && opcoes.falhaEm.tipo === tipo && opcoes.falhaEm.numero === n) throw new Error("pdfjs explodiu");
          desenhos.push(`${tipo}-${n}`);
          return { jpeg: Buffer.from([0xff, 0xd8]), largura: 1240, altura: 1754 };
        },
        async fechar() { fechados++; },
      };
    },
    enviarPagina: async (_id, tipo, numero) => { envios.push(`${tipo}-${numero}`); },
    registrarPagina: async (_ator, _id, tipo, numero, largura, altura) => { prontas.set(`${tipo}-${numero}`, { largura, altura }); },
  };
  return { deps, prontas, desenhos, envios, originaisLidos, agora: () => relogio, fechados: () => fechados };
}

test("desenha tudo numa chamada quando cabe, e registra largura e altura reais", async () => {
  const m = mundo();
  const r = await desenharProximaLeva(ator, "imp", { prova: [1, 2, 3], gabarito: [1] }, m.agora, m.deps);
  assert.deepEqual(r, { prontas: 4, faltam: 0, desenhadas: 4 });
  assert.deepEqual(m.desenhos, ["prova-1", "prova-2", "prova-3", "gabarito-1"]);
  assert.deepEqual(m.prontas.get("prova-2"), { largura: 1240, altura: 1754 });
  assert.equal(m.fechados(), 2);
});

test("60 páginas lentas: divide em levas, para antes do orçamento e nunca redesenha página pronta", async () => {
  const m = mundo({ msPorPagina: 3000 });
  const sel = { prova: faixa(60), gabarito: [] };
  const r1 = await desenharProximaLeva(ator, "imp", sel, m.agora, m.deps);
  assert.ok(r1.prontas > 0 && r1.prontas <= 13, `prontas ${r1.prontas}`);
  assert.equal(r1.faltam, 60 - r1.prontas);
  assert.equal(r1.erro, undefined);
  const desenhadas1 = m.desenhos.length;
  // O relógio deste mundo só anda ao desenhar: a primeira chamada usou no máximo 40 s.
  assert.ok(m.agora() <= 40000, `usou ${m.agora()} ms`);

  let chamadas = 1;
  let r = r1;
  while (r.faltam > 0 && chamadas < 20) {
    r = await desenharProximaLeva(ator, "imp", sel, m.agora, m.deps);
    chamadas++;
  }
  assert.equal(r.faltam, 0);
  assert.equal(r.prontas, 60);
  assert.ok(chamadas >= 5, `chamadas ${chamadas}`);
  assert.equal(m.desenhos.length, 60, "nenhuma página desenhada duas vezes");
  assert.equal(new Set(m.desenhos).size, 60);
  assert.ok(desenhadas1 < 60);
});

test("as levas seguintes leem o original guardado, nunca a URL (o link pode ter expirado)", async () => {
  const m = mundo({ msPorPagina: 20000 });
  const sel = { prova: [1, 2, 3], gabarito: [] };
  await desenharProximaLeva(ator, "imp", sel, m.agora, m.deps);
  await desenharProximaLeva(ator, "imp", sel, m.agora, m.deps);
  // As dependências não têm como baixar nada: a única fonte é lerOriginal.
  assert.ok(m.originaisLidos.length >= 2);
  assert.ok(m.originaisLidos.every((t) => t === "prova"));
  assert.ok(!("baixar" in m.deps));
});

test("chamada sem nada a fazer não lê o original", async () => {
  const m = mundo();
  const sel = { prova: [1], gabarito: [] };
  await desenharProximaLeva(ator, "imp", sel, m.agora, m.deps);
  const lidos = m.originaisLidos.length;
  const r = await desenharProximaLeva(ator, "imp", sel, m.agora, m.deps);
  assert.deepEqual(r, { prontas: 1, faltam: 0, desenhadas: 0 });
  assert.equal(m.originaisLidos.length, lidos);
});

test("página que falha → erro citando o número e o arquivo; as anteriores ficam prontas", async () => {
  const m = mundo({ falhaEm: { tipo: "prova", numero: 3 } });
  const r = await desenharProximaLeva(ator, "imp", { prova: [1, 2, 3, 4], gabarito: [] }, m.agora, m.deps);
  assert.equal(r.prontas, 2);
  assert.equal(r.faltam, 2);
  assert.match(r.erro ?? "", /página 3 da prova \(página 3 do PDF\)/);
  assert.equal(m.fechados(), 1, "fecha o PDF mesmo com erro");
});

test("página além do fim do PDF → erro claro", async () => {
  const m = mundo({ paginasPdf: { gabarito: 2 } });
  const r = await desenharProximaLeva(ator, "imp", { prova: [1], gabarito: [5] }, m.agora, m.deps);
  assert.equal(r.prontas, 1);
  assert.equal(r.erro, "O PDF do gabarito tem 2 páginas; a página 5 não existe.");
});

test("PDF protegido por senha → mensagem com o arquivo", async () => {
  const m = mundo({ erroAbrir: "O PDF está protegido por senha." });
  const r = await desenharProximaLeva(ator, "imp", { prova: [1], gabarito: [] }, m.agora, m.deps);
  assert.deepEqual(r, { prontas: 0, faltam: 1, desenhadas: 0, erro: "O PDF da prova está protegido por senha." });
});

test("nenhuma página escolhida → erro, sem ler nada", async () => {
  const m = mundo();
  const r = await desenharProximaLeva(ator, "imp", { prova: [], gabarito: [] }, m.agora, m.deps);
  assert.deepEqual(r, { prontas: 0, faltam: 0, desenhadas: 0, erro: "Nenhuma página escolhida." });
  assert.equal(m.originaisLidos.length, 0);
});

test("duas chamadas ao mesmo tempo: no fim cada página está registrada uma vez, sem erro", async () => {
  const m = mundo();
  const sel = { prova: [1, 2, 3], gabarito: [1, 2] };
  const [a, b] = await Promise.all([
    desenharProximaLeva(ator, "imp", sel, m.agora, m.deps),
    desenharProximaLeva(ator, "imp", sel, m.agora, m.deps),
  ]);
  assert.equal(a.erro, undefined);
  assert.equal(b.erro, undefined);
  assert.equal(m.prontas.size, 5);
  // Podem ter desenhado a mesma página (upsert no storage e na tabela), mas nada além da seleção.
  assert.ok(m.envios.every((e) => ["prova-1", "prova-2", "prova-3", "gabarito-1", "gabarito-2"].includes(e)));
  const r = await desenharProximaLeva(ator, "imp", sel, m.agora, m.deps);
  assert.deepEqual(r, { prontas: 5, faltam: 0, desenhadas: 0 });
});

test("com o desenhador de verdade (fixture de 2 páginas): envia JPEG e registra o tamanho real", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { abrirPdfServidor } = await import("./pdf-servidor");
  const bytes = new Uint8Array(readFileSync(join(__dirname, "__fixtures__", "prova-2-paginas.pdf")));
  const m = mundo();
  const jpegs: Buffer[] = [];
  const deps: DepsLeva = { ...m.deps, lerOriginal: async () => bytes, abrirPdf: abrirPdfServidor, enviarPagina: async (_i, _t, _n, jpeg) => { jpegs.push(jpeg); } };
  const r = await desenharProximaLeva(ator, "imp", { prova: [1, 2], gabarito: [] }, Date.now, deps);
  assert.deepEqual(r, { prontas: 2, faltam: 0, desenhadas: 2 });
  assert.equal(jpegs.length, 2);
  assert.deepEqual([...jpegs[0].subarray(0, 2)], [0xff, 0xd8]);
  const p1 = m.prontas.get("prova-1")!;
  assert.ok(p1.largura <= 1600 && p1.altura > p1.largura);
});

test("páginas de 9 s: para antes de passar dos 40 s, mesmo na primeira leva (sem média)", async () => {
  const m = mundo({ msPorPagina: 9000 });
  const r = await desenharProximaLeva(ator, "imp", { prova: faixa(20), gabarito: [] }, m.agora, m.deps);
  assert.equal(r.prontas, 4);
  assert.ok(m.agora() <= 40000, `usou ${m.agora()} ms`);
});

test("orçamento menor (primeira chamada, que também baixa o original)", async () => {
  const m = mundo({ msPorPagina: 3000 });
  const r = await desenharProximaLeva(ator, "imp", { prova: faixa(60), gabarito: [] }, m.agora, m.deps, 25000);
  assert.equal(r.prontas, 8);
  assert.ok(m.agora() <= 25000, `usou ${m.agora()} ms`);
});

test("nova tentativa depois de falhar no registro: reenvia a mesma página por cima (upsert)", async () => {
  const m = mundo();
  const storage = new Map<string, number>(); // caminho → quantas vezes foi escrito
  let falharRegistro = true;
  const deps: DepsLeva = {
    ...m.deps,
    enviarPagina: async (_i, tipo, numero) => { const k = `${tipo}-${numero}`; storage.set(k, (storage.get(k) ?? 0) + 1); },
    registrarPagina: async (...a) => {
      if (falharRegistro) { falharRegistro = false; throw new Error("rede caiu"); }
      return m.deps.registrarPagina(...a);
    },
  };
  // Falha no banco é passageira: lança (a importação não vira "erro") e a próxima chamada refaz.
  await assert.rejects(desenharProximaLeva(ator, "imp", { prova: [1, 2], gabarito: [] }, m.agora, deps), /rede caiu/);
  const r2 = await desenharProximaLeva(ator, "imp", { prova: [1, 2], gabarito: [] }, m.agora, deps);
  assert.deepEqual(r2, { prontas: 2, faltam: 0, desenhadas: 2 });
  assert.equal(storage.get("prova-1"), 2, "o JPEG da página 1 foi escrito por cima");
  // O storage real só aceita escrever por cima com upsert (e a policy de UPDATE do SQL da B2).
  assert.equal(ENVIO_JPEG.upsert, true);
  assert.equal(ENVIO_PDF.upsert, true);
  assert.equal(ENVIO_JSON.upsert, true);
  assert.equal(ENVIO_PDF.contentType, "application/pdf");
});

test("envio ao storage que falha uma vez: lança, e a próxima chamada envia e registra a página", async () => {
  const m = mundo();
  let falhar = true;
  const deps: DepsLeva = {
    ...m.deps,
    enviarPagina: async (...a) => {
      if (falhar) { falhar = false; throw new Error("storage fora do ar"); }
      return m.deps.enviarPagina(...a);
    },
  };
  const sel = { prova: [1, 2], gabarito: [] };
  await assert.rejects(desenharProximaLeva(ator, "imp", sel, m.agora, deps), /storage fora do ar/);
  assert.equal(m.prontas.size, 0, "a página que falhou não foi registrada");
  const r = await desenharProximaLeva(ator, "imp", sel, m.agora, deps);
  assert.deepEqual(r, { prontas: 2, faltam: 0, desenhadas: 2 });
  assert.deepEqual(m.envios, ["prova-1", "prova-2"]);
  assert.ok(m.prontas.has("prova-1"));
});

test("ler o original guardado que falha: lança (passageiro), não vira erro do PDF", async () => {
  const m = mundo();
  const deps: DepsLeva = { ...m.deps, lerOriginal: async () => { throw new Error("download do storage falhou"); } };
  await assert.rejects(desenharProximaLeva(ator, "imp", { prova: [1], gabarito: [] }, m.agora, deps), /download do storage falhou/);
});

test("original que sumiu do storage → erro claro (não tenta de novo para sempre)", async () => {
  const m = mundo();
  const deps: DepsLeva = { ...m.deps, lerOriginal: async () => { throw new OriginalNaoEncontrado("Não encontrei o PDF da prova guardado. Importe a prova de novo."); } };
  const r = await desenharProximaLeva(ator, "imp", { prova: [1], gabarito: [] }, m.agora, deps);
  assert.deepEqual(r, { prontas: 0, faltam: 1, desenhadas: 0, erro: "Não encontrei o PDF da prova guardado. Importe a prova de novo." });
});

test("página desenhada menor que 100 px → erro citando página e arquivo, sem enviar", async () => {
  const m = mundo();
  const deps: DepsLeva = {
    ...m.deps,
    abrirPdf: async () => ({
      numPaginas: 2,
      desenhar: async (n) => ({ jpeg: Buffer.from([0xff]), largura: n === 2 ? 80 : 1240, altura: 1754 }),
      fechar: async () => {},
    }),
  };
  const r2 = await desenharProximaLeva(ator, "imp", { prova: [1, 2], gabarito: [] }, m.agora, deps);
  assert.equal(r2.prontas, 1);
  assert.match(r2.erro ?? "", /página 2 da prova \(página 2 do PDF\) é pequena demais \(80×1754 px/);
  assert.deepEqual(m.envios, ["prova-1"], "a página pequena não foi enviada");
});

test("ehNaoEncontrado: só 'não existe' do storage, não outras falhas", () => {
  assert.equal(ehNaoEncontrado({ status: 400, statusCode: "404", message: "Object not found" }), true);
  assert.equal(ehNaoEncontrado({ status: 404, message: "x" }), true);
  assert.equal(ehNaoEncontrado({ status: 500, statusCode: "500", message: "Internal" }), false);
  assert.equal(ehNaoEncontrado({ message: "fetch failed" }), false);
});

test("caminhos do original e da seleção: só com id uuid, na pasta das páginas", () => {
  const id = "0b5c2f9e-1d2a-4c3b-9a8e-123456789abc";
  assert.equal(caminhoOriginal(id, "gabarito"), `${id}/original-gabarito.pdf`);
  assert.equal(caminhoSelecao(id), `${id}/selecao.json`);
  assert.throws(() => caminhoOriginal("../outra/escola", "prova"), /Importação inválida\./);
  assert.throws(() => caminhoSelecao("x"), /Importação inválida\./);
});

test("numera como a tela: seleção [61, 62] registra as páginas 1 e 2 e desenha as 61 e 62 do PDF", async () => {
  const m = mundo({ paginasPdf: { prova: 90, gabarito: 70 } });
  const r = await desenharProximaLeva(ator, "imp", { prova: [61, 62], gabarito: [64] }, m.agora, m.deps);
  assert.deepEqual(r, { prontas: 3, faltam: 0, desenhadas: 3 });
  assert.deepEqual(m.desenhos, ["prova-61", "prova-62", "gabarito-64"]);
  assert.deepEqual(m.envios, ["prova-1", "prova-2", "gabarito-1"]);
  assert.deepEqual([...m.prontas.keys()], ["prova-1", "prova-2", "gabarito-1"]);
});

test("seleção com buracos: retomada depois de uma leva parcial continua pela posição certa", async () => {
  const m = mundo({ msPorPagina: 20000, paginasPdf: { prova: 90 } });
  const sel = { prova: [2, 5, 30, 61], gabarito: [] };
  const r1 = await desenharProximaLeva(ator, "imp", sel, m.agora, m.deps);
  assert.ok(r1.faltam > 0 && r1.prontas > 0, JSON.stringify(r1));
  let r = r1;
  for (let i = 0; i < 10 && r.faltam > 0; i++) r = await desenharProximaLeva(ator, "imp", sel, m.agora, m.deps);
  assert.deepEqual({ prontas: r.prontas, faltam: r.faltam, erro: r.erro }, { prontas: 4, faltam: 0, erro: undefined });
  assert.deepEqual(m.desenhos, ["prova-2", "prova-5", "prova-30", "prova-61"], "cada página do PDF uma vez, na ordem");
  assert.deepEqual(m.envios, ["prova-1", "prova-2", "prova-3", "prova-4"]);
});

test("página que não existe no PDF cita a página do PDF", async () => {
  const m = mundo({ paginasPdf: { prova: 62 } });
  const r = await desenharProximaLeva(ator, "imp", { prova: [61, 63], gabarito: [] }, m.agora, m.deps);
  assert.equal(r.erro, "O PDF da prova tem 62 páginas; a página 63 não existe.");
  assert.deepEqual(m.envios, ["prova-1"]);
});

test("página grande demais → erro do PDF (não passageiro), com a posição e a página do PDF", async () => {
  const m = mundo({ paginasPdf: { prova: 90 } });
  const deps: DepsLeva = { ...m.deps, abrirPdf: async () => ({
    numPaginas: 90,
    desenhar: async () => { throw Object.assign(new Error("A página 70 do PDF é grande demais para desenhar."), { name: "PaginaGrandeDemais" }); },
    fechar: async () => {},
  }) };
  const r = await desenharProximaLeva(ator, "imp", { prova: [70], gabarito: [] }, m.agora, deps);
  assert.equal(r.erro, "A página 1 da prova (página 70 do PDF) é grande demais para desenhar.");
});

test("desenho indisponível no servidor lança (passageiro), ao abrir ou ao desenhar", async () => {
  const indisponivel = () => Object.assign(new Error("O desenho de PDF não está disponível no servidor (x)."), { name: "DesenhoIndisponivel" });
  assert.equal(ehDesenhoIndisponivel(indisponivel()), true);
  assert.equal(ehDesenhoIndisponivel(new Error("y")), false);
  const m = mundo();
  await assert.rejects(desenharProximaLeva(ator, "imp", { prova: [1], gabarito: [] }, m.agora, { ...m.deps, abrirPdf: async () => { throw indisponivel(); } }), /não está disponível no servidor/);
  const m2 = mundo();
  const deps: DepsLeva = { ...m2.deps, abrirPdf: async () => ({ numPaginas: 5, desenhar: async () => { throw indisponivel(); }, fechar: async () => {} }) };
  await assert.rejects(desenharProximaLeva(ator, "imp", { prova: [1], gabarito: [] }, m2.agora, deps), /não está disponível no servidor/);
});
