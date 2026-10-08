import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import * as capas from "./capas";
const arquivo = "11111111-1111-4111-8111-111111111111.jpg";
const caminho = "escola/capas/professor/curso-" + arquivo;
test("capas: rejeita formato, arquivo vazio e tamanho acima do limite", () => {
  for (const [tipo,tamanho] of [["image/svg+xml",100],["image/png",0],["image/jpeg",Infinity],["image/webp",capas.LIMITE_CAPA+1],["constructor",1]] as const) assert.ok(capas.validarCapa(tipo,tamanho));
  for (const tipo of Object.keys(capas.TIPOS_CAPA)) assert.equal(capas.validarCapa(tipo,capas.LIMITE_CAPA),null);
});
test("capas: impede reutilizar imagem de outra escola, professor ou tipo", () => {
  assert.ok(capas.caminhoCapaValido(caminho,"escola","professor","curso"));
  for(const [escola,prof,tipo] of [["outra","professor","curso"],["escola","outro","curso"],["escola","professor","aula"]] as const) assert.equal(capas.caminhoCapaValido(caminho,escola,prof,tipo),false);
  assert.equal(capas.caminhoCapaValido(caminho + "/../logo.png","escola","professor","curso"),false);
});
test("miniatura: personalizada tem prioridade; remover retorna a automática", () => {
  assert.equal(capas.thumbnailAula(caminho,"dQw4w9WgXcQ"),capas.urlCapa(caminho));
  assert.equal(capas.thumbnailAula(null,"dQw4w9WgXcQ"),"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.equal(capas.thumbnailAula(null,null),null);
  assert.equal(capas.thumbnailAula(null,"../x"),null);
});
test("capas: valida assinatura real da imagem", () => {
  assert.ok(capas.assinaturaImagemValida(new Uint8Array([137,80,78,71,13,10,26,10]),"png"));
  assert.ok(capas.assinaturaImagemValida(new Uint8Array([255,216,255]),"jpg"));
  assert.ok(capas.assinaturaImagemValida(new TextEncoder().encode("RIFF1234WEBP"),"webp"));
  for(const ext of ["png","jpg","webp"]) assert.equal(capas.assinaturaImagemValida(new TextEncoder().encode("<svg></svg>"),ext),false);
});
function servidor(blob: Blob | null) {
  const chamadas: string[]=[];
  const exports: Record<string, (...args: unknown[])=>Promise<unknown>>={};
  const storage={download:async(p:string)=>{chamadas.push("ler:"+p);return {data:blob,error:null};},remove:async(p:string[])=>{chamadas.push("remover:"+p.join(","));return {error:null};}};
  const deps:Record<string,unknown>={"./capas":capas,"./capas-armazenamento":{armazenamentoCapas:()=>storage}};
  const js=transpileModule(readFileSync("src/lib/aulas/capas-servidor.ts","utf8"),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022}}).outputText;
  runInNewContext(js,{exports,Uint8Array,require:(n:string)=>{if(!(n in deps))throw Error(n);return deps[n];}});
  return {chamadas,validar:exports.validarCapaEnviada,apagar:exports.apagarCapaAnterior};
}
const professor={escola_id:"escola",id:"professor"};
test("capas: rejeita upload ausente ou falsificado antes de salvar", async()=>{
  const ausente=servidor(null);await assert.rejects(ausente.validar(caminho,null,professor,"curso"),/não foi enviada/);
  const falsa=servidor(new Blob(["<script>x</script>"]));await assert.rejects(falsa.validar(caminho,null,professor,"curso"),/válida/);
  const outra=servidor(null);await assert.rejects(outra.validar(caminho,null,{...professor,escola_id:"outra"},"curso"),/conta/);assert.deepEqual(outra.chamadas,[]);
});
test("capas: aceita upload válido e permite manter ou remover a anterior", async()=>{
  const s=servidor(new Blob([new Uint8Array([255,216,255,0])]));
  assert.equal(await s.validar(caminho,null,professor,"curso"),caminho);
  const manter=servidor(null);assert.equal(await manter.validar(caminho,caminho,{...professor,id:"admin"},"curso"),caminho);assert.deepEqual(manter.chamadas,[]);
  assert.equal(await manter.validar(undefined,caminho,professor,"curso"),undefined);
  assert.equal(await manter.validar(null,caminho,professor,"curso"),null);
  await manter.apagar(caminho,undefined);await manter.apagar(caminho,caminho);assert.deepEqual(manter.chamadas,[]);
  await manter.apagar(caminho,null);assert.deepEqual(manter.chamadas,["remover:"+caminho]);
});

function envio(autenticado: boolean, permitido = true) {
  const chamadas:string[]=[];
  const exports:{prepararEnvioCapa?:(tipo:string,mime:string,tamanho:number,aulaId?:string)=>Promise<unknown>}={};
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{curso_id:"curso"}})};
  const deps:Record<string,unknown>={
    "node:crypto":{randomUUID:()=>"11111111-1111-4111-8111-111111111111"},
    "@/lib/auth":{exigirNaoAluno:async()=>{if(!autenticado)throw Error("login");},getProfessorAtual:async()=>autenticado?professor:null},
    "@/lib/aulas/acesso":{exigirCursoEditavel:async()=>{if(!permitido)throw Error("acesso");}},
    "@/lib/aulas/capas":capas,
    "@/lib/supabase/client":{supabase:{from:()=>query}},
    "@/lib/aulas/capas-armazenamento":{armazenamentoCapas:()=>({createSignedUploadUrl:async(p:string)=>{chamadas.push(p);return {data:{signedUrl:"url"},error:null};}})},
  };
  const js=transpileModule(readFileSync("src/actions/capas.ts","utf8"),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022}}).outputText;
  runInNewContext(js,{exports,require:(n:string)=>{if(!(n in deps))throw Error(n);return deps[n];}});
  return {executar:exports.prepararEnvioCapa!,chamadas};
}
test("envio: não gera URL sem autenticação nem acesso à aula",async()=>{
  for(const s of [envio(false),envio(true,false)]) {assert.equal(((await s.executar("aula","image/jpeg",100,"aula")) as {ok:boolean}).ok,false);assert.deepEqual(s.chamadas,[]);}
});
test("envio: rejeita tipo de capa, MIME e tamanho antes de usar a chave privada",async()=>{
  const s=envio(true);
  for(const args of [["logo","image/jpeg",100],["curso","image/svg+xml",100],["curso","image/jpeg",capas.LIMITE_CAPA+1]] as const) assert.equal(((await s.executar(args[0],args[1],args[2])) as {ok:boolean}).ok,false);
  assert.deepEqual(s.chamadas,[]);
});
test("envio: caminho assinado pertence à escola e ao professor autenticados",async()=>{
  const s=envio(true);assert.deepEqual(JSON.parse(JSON.stringify(await s.executar("curso","image/jpeg",100))),{ok:true,caminho,url:"url"});assert.deepEqual(s.chamadas,[caminho]);
});
test("SQL: migração preserva cursos antigos, é repetível e salva/remova capas",async()=>{
  const {PGlite}=await import("@electric-sql/pglite");const db=new PGlite();
  try {
    await db.exec("create table cursos(id text primary key,titulo text); create table aulas(id text primary key,titulo text); create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); insert into cursos values ('1','Física'); insert into aulas values ('1','Dinâmica');");
    const sql=readFileSync("db/2026-10-05-capas-cursos-aulas.sql","utf8");await db.exec(sql);await db.exec(sql);
    assert.deepEqual((await db.query("select titulo,capa_caminho from cursos")).rows,[{titulo:"Física",capa_caminho:null}]);
    await db.query("update cursos set capa_caminho=$1 where id='1'",[caminho]);assert.equal((await db.query<{capa_caminho:string}>("select capa_caminho from cursos")).rows[0].capa_caminho,caminho);
    await db.exec("update cursos set capa_caminho=null where id='1'");assert.equal((await db.query<{capa_caminho:null}>("select capa_caminho from cursos")).rows[0].capa_caminho,null);
    assert.equal((await db.query<{id:string}>("select id from storage.buckets")).rows[0].id,"capas");
  } finally {await db.close();}
});
