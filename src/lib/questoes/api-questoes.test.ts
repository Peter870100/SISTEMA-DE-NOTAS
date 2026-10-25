import { test } from "node:test";
import assert from "node:assert/strict";
import { lerFiltrosApi, questaoParaApi, tokenApiValido } from "./api-questoes";
import type { Questao } from "@/lib/types";

const filtros = (q: string) => lerFiltrosApi(new URLSearchParams(q));

test("lerFiltrosApi: padrões e listas separadas por vírgula", () => {
  assert.deepEqual(filtros(""), { bancas: [], anos: [], materias: [], area: null, assunto: null, pagina: 1, limite: 50 });
  assert.deepEqual(filtros("banca=ufms, UEMS&ano=2025,2026&materia=matematica,fisica&area=natureza&pagina=2&limite=100"), {
    bancas: ["UFMS", "UEMS"], anos: [2025, 2026], materias: ["matematica", "fisica"], area: "natureza", assunto: null, pagina: 2, limite: 100,
  });
  const id = "6ffb1267-aa2a-404e-ba3f-9ad6184ece15";
  assert.equal((filtros(`assunto=${id}`) as { assunto: string }).assunto, id);
});

test("lerFiltrosApi: valores inválidos viram erro", () => {
  assert.deepEqual(filtros("ano=dois mil"), { erro: "ano inválido: dois mil" });
  assert.deepEqual(filtros("materia=astrologia"), { erro: "materia inválida: astrologia" });
  assert.deepEqual(filtros("area=artes"), { erro: "area inválida: artes" });
  assert.deepEqual(filtros("assunto=1; drop"), { erro: "assunto inválido" });
  assert.deepEqual(filtros("limite=500"), { erro: "limite deve ser de 1 a 100" });
  assert.deepEqual(filtros("pagina=0"), { erro: "pagina deve ser 1 ou mais" });
  assert.deepEqual(filtros("banca=a%2Cb%25"), { erro: "banca inválida: B%" });
});

test("tokenApiValido: exige token próprio, diferente dos da Hermes", () => {
  const env = { QUESTOES_API_TOKEN: "abc", MCP_DONO_TOKEN: "dono", MCP_SECRET_TOKEN: "prof" };
  assert.equal(tokenApiValido("Bearer abc", env), true);
  assert.equal(tokenApiValido("Bearer abd", env), false);
  assert.equal(tokenApiValido(null, env), false);
  assert.equal(tokenApiValido("Bearer abc", { ...env, QUESTOES_API_TOKEN: undefined }), false);
  assert.equal(tokenApiValido("Bearer dono", { ...env, QUESTOES_API_TOKEN: "dono" }), false);
  assert.equal(tokenApiValido("Bearer prof", { ...env, QUESTOES_API_TOKEN: "prof" }), false);
});

test("questaoParaApi: só campos públicos, assunto pelo nome e figuras com link", () => {
  const q = {
    id: "q1", escopo: "geral", escola_id: null, banca: "UFMS", ano: 2026, caderno: "espanhol", numero: 1, area: "linguagens",
    materia: "espanhol", assunto_id: "as1", enunciado: "Texto", conteudo: null, comando: "Assinale", resposta: "E", anulada: false,
    alternativas: [{ letra: "A", texto: "a" }], status: "publicada", precisa_revisao: false, motivo_revisao: null, falta_imagem: false,
    conferida_em: null, origem: "pdf", resolucao: null, geracao_id: null, importacao_id: "imp", pagina_id: "pag", fonte_id: null,
    criado_por: "prof", criado_via: "app", created_at: "c", updated_at: "u",
  } as unknown as Questao;
  const r = questaoParaApi(q, "Compreensão de texto", [
    { alvo: "enunciado", tipo: "recorte", url: "https://x/pagina.jpg", quadro: { x: 0.1, y: 0.2, w: 0.5, h: 0.3 }, largura: 1240, altura: 1754, alinhamento: "centro" },
  ]);
  assert.deepEqual(r, {
    id: "q1", banca: "UFMS", ano: 2026, caderno: "espanhol", numero: 1, area: "linguagens", materia: "espanhol",
    assunto: { id: "as1", nome: "Compreensão de texto" }, enunciado: "Texto", conteudo: null, comando: "Assinale",
    alternativas: [{ letra: "A", texto: "a" }], resposta: "E", anulada: false, resolucao: null, origem: "pdf",
    figuras: [{ alvo: "enunciado", tipo: "recorte", url: "https://x/pagina.jpg", recorte: { x: 0.1, y: 0.2, w: 0.5, h: 0.3 }, largura: 1240, altura: 1754, alinhamento: "centro" }],
    atualizada_em: "u",
  });
  assert.equal(questaoParaApi({ ...q, assunto_id: null }, null, []).assunto, null);
});
