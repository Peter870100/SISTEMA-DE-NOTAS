import { test } from "node:test";
import assert from "node:assert/strict";
import { desenharProximaLeva, erroDoArquivo, planejarLeva, validarSelecao, type DepsLeva, type TipoArquivo } from "./importacao-levas";
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
  assert.deepEqual(r, { prontas: 4, faltam: 0 });
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
  assert.deepEqual(r, { prontas: 1, faltam: 0 });
  assert.equal(m.originaisLidos.length, lidos);
});

test("página que falha → erro citando o número e o arquivo; as anteriores ficam prontas", async () => {
  const m = mundo({ falhaEm: { tipo: "prova", numero: 3 } });
  const r = await desenharProximaLeva(ator, "imp", { prova: [1, 2, 3, 4], gabarito: [] }, m.agora, m.deps);
  assert.equal(r.prontas, 2);
  assert.equal(r.faltam, 2);
  assert.match(r.erro ?? "", /página 3 da prova/);
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
  assert.deepEqual(r, { prontas: 0, faltam: 1, erro: "O PDF da prova está protegido por senha." });
});

test("nenhuma página escolhida → erro, sem ler nada", async () => {
  const m = mundo();
  const r = await desenharProximaLeva(ator, "imp", { prova: [], gabarito: [] }, m.agora, m.deps);
  assert.deepEqual(r, { prontas: 0, faltam: 0, erro: "Nenhuma página escolhida." });
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
  assert.deepEqual(r, { prontas: 5, faltam: 0 });
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
  assert.deepEqual(r, { prontas: 2, faltam: 0 });
  assert.equal(jpegs.length, 2);
  assert.deepEqual([...jpegs[0].subarray(0, 2)], [0xff, 0xd8]);
  const p1 = m.prontas.get("prova-1")!;
  assert.ok(p1.largura <= 1600 && p1.altura > p1.largura);
});
