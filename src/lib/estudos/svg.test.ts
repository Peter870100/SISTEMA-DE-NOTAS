import test from "node:test";
import assert from "node:assert/strict";
import { validarSvg, dataUrlDoSvg, LIMITE_SVG } from "./svg";

const base = '<svg viewBox="0 0 10 10"><line x1="0" y1="0" x2="1" y2="1" stroke="#000"/><text x="1" y="1">A</text></svg>';

test("aceita desenho simples", () => assert.equal(validarSvg(base).ok, true));
test("aceita xmlns na raiz", () =>
  assert.equal(validarSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>').ok, true));
test("recusa xmlns:xlink", () =>
  assert.equal(validarSvg('<svg xmlns:xlink="http://www.w3.org/1999/xlink"></svg>').ok, false));
test("aceita gradiente por url(#id)", () =>
  assert.equal(validarSvg('<svg><defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs><rect fill="url(#g)"/></svg>').ok, true));
test("aceita marker-end e '>' dentro de aspas", () =>
  assert.equal(validarSvg('<svg><defs><marker id="m"><path d="M0 0L1 1"/></marker></defs><line marker-end="url(#m)" stroke="a>b"/></svg>').ok, true));
for (const [nome, s] of [
  ["script", "<svg><script>alert(1)</script></svg>"],
  ["on*", '<svg onload="x()"></svg>'],
  ["foreignObject", "<svg><foreignObject/></svg>"],
  ["image", '<svg><image href="http://x"/></svg>'],
  ["href", '<svg><a href="http://x"><text>a</text></a></svg>'],
  ["xlink", '<svg><path xlink:href="#a"/></svg>'],
  ["style com url", '<svg><rect style="fill:url(http://x)"/></svg>'],
  ["url externa", '<svg><rect fill="url(http://x)"/></svg>'],
  ["comentário", "<svg><!-- x --></svg>"],
  ["CDATA", "<svg><![CDATA[x]]></svg>"],
  ["doctype", "<!DOCTYPE svg><svg></svg>"],
  ["não é svg", "<div></div>"],
  ["tag sem fechar", '<svg><rect fill="red"</svg>'],
] as const) test(`recusa ${nome}`, () => assert.equal(validarSvg(s).ok, false));
test("recusa acima de 30 KB", () => {
  assert.equal(LIMITE_SVG, 30 * 1024);
  assert.equal(validarSvg(`<svg><title>${"a".repeat(31 * 1024)}</title></svg>`).ok, false);
});
test("dataUrlDoSvg", () => assert.ok(dataUrlDoSvg(base).startsWith("data:image/svg+xml;base64,")));

function decodificar(url: string) {
  return Buffer.from(url.split(",")[1], "base64").toString("utf8");
}
test("dataUrlDoSvg acrescenta xmlns quando falta", () => {
  assert.match(decodificar(dataUrlDoSvg(base)), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox/);
});
test("dataUrlDoSvg mantém o svg que já tem xmlns", () => {
  const s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>';
  assert.equal(decodificar(dataUrlDoSvg(s)), s);
});
