import { test } from "node:test";
import assert from "node:assert/strict";
import { baixarPdf, decodificarBase64Pdf, LIMITE_PDF_BYTES, validarBytesPdf, validarUrlPdf } from "./pdf-entrada";

const PDF = new TextEncoder().encode("%PDF-1.7\nconteudo");

test("validarUrlPdf: só https", () => {
  assert.match(validarUrlPdf("http://exemplo.com/x.pdf") ?? "", /https/);
  assert.match(validarUrlPdf("ftp://exemplo.com/x.pdf") ?? "", /https/);
  assert.equal(validarUrlPdf("isso não é link"), "Link do PDF inválido.");
});

test("validarUrlPdf: recusa localhost, loopback e redes privadas", () => {
  for (const url of [
    "https://localhost/x.pdf",
    "https://LOCALHOST./x.pdf",
    "https://app.localhost/x.pdf",
    "https://127.0.0.1/a",
    "https://2130706433/a", // 127.0.0.1 em decimal
    "https://0.0.0.0/a",
    "https://10.0.0.5/a",
    "https://172.16.0.1/a",
    "https://172.31.255.255/a",
    "https://192.168.1.2/a",
    "https://169.254.169.254/latest/meta-data",
    "https://100.64.0.1/a",
    "https://[::1]/a",
    "https://[::]/a",
    "https://[::ffff:127.0.0.1]/a",
    "https://[::ffff:10.0.0.1]/a",
    "https://[fc00::1]/a",
    "https://[fd12:3456::1]/a",
    "https://[fe80::1]/a",
    "https://usuario:senha@exemplo.com/a",
  ]) {
    assert.equal(validarUrlPdf(url), "Esse endereço não é permitido.", url);
  }
});

test("validarUrlPdf: aceita link público (Telegram)", () => {
  assert.equal(validarUrlPdf("https://api.telegram.org/file/bot123:ABC/documents/file_1.pdf"), null);
  assert.equal(validarUrlPdf("https://172.32.0.1/a"), null);
  assert.equal(validarUrlPdf("https://[2001:db8::1]/a"), null);
});

test("validarBytesPdf", () => {
  assert.equal(validarBytesPdf(PDF), null);
  assert.equal(validarBytesPdf(new TextEncoder().encode("<html>")), "O arquivo não é um PDF.");
  assert.equal(validarBytesPdf(new Uint8Array(0)), "O arquivo não é um PDF.");
  const grande = new Uint8Array(LIMITE_PDF_BYTES + 1);
  grande.set(PDF);
  assert.equal(validarBytesPdf(grande), "O PDF passa de 30 MB.");
});

test("decodificarBase64Pdf: aceita com ou sem prefixo data:", () => {
  const b64 = Buffer.from(PDF).toString("base64");
  assert.deepEqual([...decodificarBase64Pdf(b64)], [...PDF]);
  assert.deepEqual([...decodificarBase64Pdf(`data:application/pdf;base64,${b64}\n`)], [...PDF]);
});

test("decodificarBase64Pdf: recusa lixo, não-PDF e acima do limite", () => {
  assert.throws(() => decodificarBase64Pdf("@@@"), /base64 inválido/);
  assert.throws(() => decodificarBase64Pdf(Buffer.from("<html>").toString("base64")), /O arquivo não é um PDF\./);
  assert.throws(() => decodificarBase64Pdf("A".repeat(Math.ceil((LIMITE_PDF_BYTES * 4) / 3) + 8)), /O PDF passa de 30 MB\./);
});

/** Troca o fetch global durante um teste. */
async function comFetch(falso: (url: string, init: RequestInit) => Promise<Response>, corpo: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = ((u: string | URL, init?: RequestInit) => falso(String(u), init ?? {})) as typeof fetch;
  try {
    await corpo();
  } finally {
    globalThis.fetch = original;
  }
}

test("baixarPdf: baixa um PDF público", async () => {
  await comFetch(async () => new Response(PDF), async () => {
    assert.deepEqual([...(await baixarPdf("https://api.telegram.org/file/x.pdf"))], [...PDF]);
  });
});

test("baixarPdf: recusa URL privada sem chamar a rede", async () => {
  let chamou = false;
  await comFetch(async () => { chamou = true; return new Response(PDF); }, async () => {
    await assert.rejects(baixarPdf("https://127.0.0.1/x.pdf"), /Esse endereço não é permitido\./);
  });
  assert.equal(chamou, false);
});

test("baixarPdf: redirecionamento para host privado é recusado", async () => {
  const pedidos: string[] = [];
  await comFetch(async (url, init) => {
    pedidos.push(url);
    assert.equal(init.redirect, "manual");
    return new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest" } });
  }, async () => {
    await assert.rejects(baixarPdf("https://exemplo.com/x.pdf"), /Esse endereço não é permitido\./);
  });
  assert.deepEqual(pedidos, ["https://exemplo.com/x.pdf"]);
});

test("baixarPdf: segue redirecionamento público", async () => {
  await comFetch(async (url) => url.endsWith("/a")
    ? new Response(null, { status: 301, headers: { location: "/b" } })
    : new Response(PDF), async () => {
    assert.deepEqual([...(await baixarPdf("https://exemplo.com/a"))], [...PDF]);
  });
});

test("baixarPdf: content-length acima do limite é recusado", async () => {
  await comFetch(async () => new Response(PDF, { headers: { "content-length": "999999999" } }), async () => {
    await assert.rejects(baixarPdf("https://exemplo.com/x.pdf"), /O PDF passa de 30 MB\./);
  });
});

test("baixarPdf: aborta a leitura ao passar do limite (sem content-length)", async () => {
  let enviados = 0;
  let cancelado = false;
  const corpo = new ReadableStream<Uint8Array>({
    pull(c) {
      enviados++;
      if (enviados > 1000) { c.close(); return; }
      c.enqueue(enviados === 1 ? PDF : new Uint8Array(64));
    },
    cancel() { cancelado = true; },
  });
  await comFetch(async () => new Response(corpo), async () => {
    await assert.rejects(baixarPdf("https://exemplo.com/x.pdf", 1000), /O PDF passa de 30 MB\./);
  });
  assert.ok(enviados < 100, `leu ${enviados} pedaços`);
  assert.equal(cancelado, true);
});

test("baixarPdf: erro HTTP e não-PDF", async () => {
  await comFetch(async () => new Response("não", { status: 404 }), async () => {
    await assert.rejects(baixarPdf("https://exemplo.com/x.pdf"), /Não consegui baixar o PDF \(erro 404\)\./);
  });
  await comFetch(async () => new Response("<html>"), async () => {
    await assert.rejects(baixarPdf("https://exemplo.com/x.pdf"), /O arquivo não é um PDF\./);
  });
});

test("baixarPdf: tempo esgotado", async () => {
  await comFetch((_url, init) => new Promise((_r, rejeitar) => {
    init.signal?.addEventListener("abort", () => rejeitar(init.signal?.reason ?? new Error("abort")));
  }), async () => {
    await assert.rejects(baixarPdf("https://exemplo.com/x.pdf", LIMITE_PDF_BYTES, 20), /O download do PDF demorou demais/);
  });
});
