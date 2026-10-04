import { test } from "node:test";
import assert from "node:assert/strict";
import { extrairIdYoutube } from "./youtube";
import { calcularProgresso, estadoAula, gabaritoLiberado, porcentagemAula, porcentagemConjunto } from "./progresso";
import { caminhoArquivo, validarArquivo } from "./arquivos";

const ID = "dQw4w9WgXcQ";

test("youtube: formatos aceitos", () => {
  for (const link of [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=30s`,
    `https://m.youtube.com/watch?feature=share&v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc123`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `  youtu.be/${ID}  `,
  ]) {
    assert.equal(extrairIdYoutube(link), ID, link);
  }
});

test("youtube: links inválidos dão null", () => {
  for (const link of ["", "abc", "https://vimeo.com/123456", `https://www.youtube.com/watch?v=curto`, "https://youtube.com/", `https://evil.com/watch?v=${ID}`]) {
    assert.equal(extrairIdYoutube(link), null, link);
  }
});

const AGORA = 1_800_000_000_000;
const segAtras = (s: number) => new Date(AGORA - s * 1000).toISOString();

test("progresso: primeira gravação limita a 20 s", () => {
  assert.deepEqual(calcularProgresso(null, 15, 600, AGORA), { posicao_seg: 15, maior_posicao_seg: 15, duracao_seg: 600, concluir: false });
  const salto = calcularProgresso(null, 590, 600, AGORA)!;
  assert.equal(salto.maior_posicao_seg, 20);
  assert.equal(salto.posicao_seg, 590); // retomar guarda onde está
  assert.equal(salto.concluir, false);
});

test("progresso: avanço normal é aceito e conclui aos 90%", () => {
  const ant = { maior_posicao_seg: 525, atualizado_em: segAtras(15), concluida_em: null };
  const r = calcularProgresso(ant, 540, 600, AGORA)!;
  assert.equal(r.maior_posicao_seg, 540);
  assert.equal(r.concluir, true);
});

test("progresso: salto até o fim não conclui", () => {
  const ant = { maior_posicao_seg: 60, atualizado_em: segAtras(15), concluida_em: null };
  const r = calcularProgresso(ant, 599, 600, AGORA)!;
  assert.equal(r.maior_posicao_seg, 60 + 15 * 2 + 15);
  assert.equal(r.concluir, false);
});

test("progresso: tempo longe da página não gera crédito além do máximo", () => {
  const ant = { maior_posicao_seg: 10, atualizado_em: segAtras(86400), concluida_em: null };
  const r = calcularProgresso(ant, 599, 600, AGORA)!;
  assert.equal(r.maior_posicao_seg, 10 + 120 + 20);
  assert.equal(r.concluir, false);
});

test("progresso: voltar no vídeo não reduz o maior ponto", () => {
  const ant = { maior_posicao_seg: 300, atualizado_em: segAtras(15), concluida_em: null };
  const r = calcularProgresso(ant, 100, 600, AGORA)!;
  assert.equal(r.maior_posicao_seg, 300);
  assert.equal(r.posicao_seg, 100);
});

test("progresso: duração inválida é recusada; posição fora da faixa é limitada", () => {
  assert.equal(calcularProgresso(null, 10, 0, AGORA), null);
  assert.equal(calcularProgresso(null, 10, 30000, AGORA), null);
  assert.equal(calcularProgresso(null, 10, Number.NaN, AGORA), null);
  assert.equal(calcularProgresso(null, -5, 600, AGORA)!.posicao_seg, 0);
  assert.equal(calcularProgresso(null, 9999, 600, AGORA)!.posicao_seg, 600);
});

test("progresso: aula já concluída não conclui de novo", () => {
  const ant = { maior_posicao_seg: 590, atualizado_em: segAtras(15), concluida_em: segAtras(100) };
  assert.equal(calcularProgresso(ant, 595, 600, AGORA)!.concluir, false);
});

test("progresso: chamadas rápidas não avançam maior", () => {
  let anterior = { maior_posicao_seg: 100, atualizado_em: new Date(AGORA).toISOString(), concluida_em: null };
  for (let i = 0; i < 10; i++) {
    const r = calcularProgresso(anterior, 599, 600, AGORA)!;
    assert.equal(r.maior_posicao_seg, 100, `iteration ${i}`);
    assert.equal(r.concluir, false, `iteration ${i}`);
    anterior = { maior_posicao_seg: r.maior_posicao_seg, atualizado_em: anterior.atualizado_em, concluida_em: null };
  }
});

test("progresso: atualizado_em no futuro não dá crédito extra", () => {
  const ant = { maior_posicao_seg: 100, atualizado_em: new Date(AGORA + 60000).toISOString(), concluida_em: null };
  const r = calcularProgresso(ant, 599, 600, AGORA)!;
  assert.equal(r.maior_posicao_seg, 100);
});

test("progresso: posicao NaN ou Infinity é tratada", () => {
  const ant = { maior_posicao_seg: 100, atualizado_em: segAtras(15), concluida_em: null };
  const rNaN = calcularProgresso(ant, Number.NaN, 600, AGORA)!;
  assert.equal(rNaN.posicao_seg, 0);
  assert(!Number.isNaN(rNaN.posicao_seg));
  const rInf = calcularProgresso(ant, Number.POSITIVE_INFINITY, 600, AGORA)!;
  assert.equal(rInf.posicao_seg, 600);
  assert(Number.isFinite(rInf.posicao_seg));
});

test("youtube: hosts parecidos retornam null", () => {
  const ID = "dQw4w9WgXcQ";
  assert.equal(extrairIdYoutube(`https://youtube.com.evil.com/watch?v=${ID}`), null);
  assert.equal(extrairIdYoutube(`https://youtube.com@evil.com/watch?v=${ID}`), null);
});

test("porcentagens", () => {
  assert.equal(porcentagemAula(null), 0);
  assert.equal(porcentagemAula({ maior_posicao_seg: 300, duracao_seg: 600, concluida_em: null }), 50);
  assert.equal(porcentagemAula({ maior_posicao_seg: 300, duracao_seg: null, concluida_em: null }), 0);
  assert.equal(porcentagemAula({ maior_posicao_seg: 10, duracao_seg: 600, concluida_em: "2026-10-04T10:00:00Z" }), 100);
  assert.equal(porcentagemAula({ maior_posicao_seg: 700, duracao_seg: 600, concluida_em: null }), 100);
  assert.equal(porcentagemConjunto(0, 0), 0);
  assert.equal(porcentagemConjunto(7, 10), 70);
  assert.equal(porcentagemConjunto(1, 3), 33);
  assert.equal(porcentagemConjunto(3, 3), 100);
});

test("estado da aula", () => {
  assert.equal(estadoAula(null), "nao_iniciada");
  assert.equal(estadoAula({ maior_posicao_seg: 0, concluida_em: null }), "nao_iniciada");
  assert.equal(estadoAula({ maior_posicao_seg: 40, concluida_em: null }), "andamento");
  assert.equal(estadoAula({ maior_posicao_seg: 40, concluida_em: "2026-10-04T10:00:00Z" }), "concluida");
});

test("gabarito liberado", () => {
  assert.equal(gabaritoLiberado("junto", null, false, AGORA), true);
  assert.equal(gabaritoLiberado("apos_concluir", null, false, AGORA), false);
  assert.equal(gabaritoLiberado("apos_concluir", null, true, AGORA), true);
  assert.equal(gabaritoLiberado("data", new Date(AGORA + 1000).toISOString(), true, AGORA), false);
  assert.equal(gabaritoLiberado("data", new Date(AGORA).toISOString(), false, AGORA), true);
  assert.equal(gabaritoLiberado("data", null, true, AGORA), false);
});

test("arquivos: só PDF até 25 MB", () => {
  assert.equal(validarArquivo("Lista 1.pdf", 1000), null);
  assert.equal(validarArquivo("LISTA.PDF", 26214400), null);
  assert.match(validarArquivo("foto.png", 1000)!, /PDF/);
  assert.match(validarArquivo("grande.pdf", 26214401)!, /25 MB/);
  assert.match(validarArquivo("vazio.pdf", 0)!, /vazio/);
  assert.equal(caminhoArquivo("e", "c", "a", "u"), "e/c/a/u.pdf");
});
