import { test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://teste.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "teste-local";

const turma = { id: "00000000-0000-4000-8000-000000000001", nome: "1ª série A", escola_id: "escola-1", ano_letivo:"2026", bimestre:"2º Bimestre", criado_via:"app" as const, created_at:"2026-01-01" };

test("lista mantém bimestres encerrados navegáveis e oferece reabertura", async () => {
  const { TurmasLista } = await import("@/components/home/TurmasLista");
  const html = renderToStaticMarkup(React.createElement(TurmasLista, { turmas:[{...turma,bimestre_encerrado:true}],contagemPorTurma:{} }));
  assert.ok(html.includes('href="/turma/' + turma.id + '"'));
  assert.ok(html.includes("Encerrado")); assert.ok(html.includes("Reabrir"));
  assert.ok(!html.includes("Definir vigente")); assert.ok(!html.includes("bg-emerald-500"));
});
test("vigente tem bolinha verde e encerramento disponível", async () => {
  const { TurmasLista } = await import("@/components/home/TurmasLista");
  const html = renderToStaticMarkup(React.createElement(TurmasLista, { turmas:[{...turma,bimestre_vigente:true}],contagemPorTurma:{} }));
  assert.ok(html.includes("Em vigência")); assert.ok(html.includes("bg-emerald-500")); assert.ok(html.includes("Encerrar")); assert.ok(!html.includes("Definir vigente"));
});
test("aberto permite definir vigente e encerrar", async () => {
  const { TurmasLista } = await import("@/components/home/TurmasLista");
  const html = renderToStaticMarkup(React.createElement(TurmasLista, { turmas:[turma],contagemPorTurma:{} }));
  assert.ok(html.includes("Aberto")); assert.ok(html.includes("Definir vigente")); assert.ok(html.includes("Encerrar"));
});
test("célula encerrada mostra valor e remove editor mesmo com edição antiga", async () => {
  const { CelulaNota } = await import("@/components/grid/CelulaNota");
  const noop = () => {};
  const html = renderToStaticMarkup(React.createElement(CelulaNota, { somenteLeitura:true,value:{valor:700,status_texto:null},tipo:"nota",active:false,editing:true,editingValue:"800",onActivate:noop,onStartEdit:noop,onChangeEditingValue:noop,onKeyDown:noop,onBlurEdicao:noop,onSelectStatus:noop,cellRef:noop,recemSalva:false }));
  assert.ok(html.includes("700")); assert.ok(!html.includes("<input")); assert.ok(!html.includes("Editar célula"));
});
