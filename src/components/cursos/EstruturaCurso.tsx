"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { contarProgressos, criarAula, criarModulo, excluirAula, excluirModulo, moverAula, moverModulo, renomearModulo } from "@/actions/cursos";
import type { ModuloComAulas } from "@/lib/aulas/consultas";
import { MiniaturaAula } from "./MiniaturaAula";
import { estilos } from "@/components/ui/estilos";

export function EstruturaCurso({ cursoId, modulos }: { cursoId: string; modulos: ModuloComAulas[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novoModulo, setNovoModulo] = useState("");

  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarExclusao(alvo: { moduloId?: string; aulaId?: string }, nome: string) {
    const alunos = await contarProgressos(alvo);
    const aviso = alunos > 0 ? ` ${alunos} aluno(s) já têm progresso aqui e ele será apagado.` : "";
    return window.confirm(`Excluir ${nome}?${aviso}`);
  }

  const iconeBotao = `${estilos.botaoFantasma} px-2`;

  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {modulos.length === 0 && <p className={`${estilos.card} p-4 text-sm text-muted`}>Comece criando o primeiro módulo.</p>}
      {modulos.map((m, i) => (
        <section key={m.id} aria-label={m.titulo} className={`${estilos.card} p-4`}>
          <div className="flex flex-wrap items-center gap-1">
            <h2 className="mr-auto font-semibold text-ink">Módulo {i + 1} — {m.titulo}</h2>
            <button type="button" aria-label="Subir módulo" disabled={ocupado || i === 0} onClick={() => executar(() => moverModulo(m.id, -1))} className={iconeBotao}><ArrowUp size={15} /></button>
            <button type="button" aria-label="Descer módulo" disabled={ocupado || i === modulos.length - 1} onClick={() => executar(() => moverModulo(m.id, 1))} className={iconeBotao}><ArrowDown size={15} /></button>
            <button type="button" aria-label="Renomear módulo" disabled={ocupado} onClick={() => { const t = window.prompt("Novo nome do módulo", m.titulo); if (t) void executar(() => renomearModulo(m.id, t)); }} className={iconeBotao}><Pencil size={15} /></button>
            <button type="button" aria-label="Excluir módulo" disabled={ocupado} onClick={async () => { if (await confirmarExclusao({ moduloId: m.id }, `o módulo "${m.titulo}" e suas aulas`)) void executar(() => excluirModulo(m.id)); }} className={iconeBotao}><Trash2 size={15} /></button>
          </div>
          <ol className="mt-2 divide-y divide-line">
            {m.aulas.map((a, j) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Link href={`/cursos/${cursoId}/aulas/${a.id}`} className="mr-auto flex min-w-0 flex-1 items-center gap-3 font-medium text-ink hover:text-brand hover:underline"><MiniaturaAula caminho={a.capa_caminho} videoId={a.video_id} /><span>{j + 1}. {a.titulo}</span></Link>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${a.publicada ? "bg-ok/15 text-ink" : "bg-surface-sunken text-muted"}`}>{a.publicada ? "Publicada" : "Rascunho"}</span>
                <span className="text-xs text-muted">{[a.video_id ? "vídeo" : null, a.qtd_material + a.qtd_gabarito > 0 ? `${a.qtd_material + a.qtd_gabarito} PDF(s)` : null].filter(Boolean).join(" · ") || "vazia"}</span>
                <button type="button" aria-label="Subir aula" disabled={ocupado || j === 0} onClick={() => executar(() => moverAula(a.id, -1))} className={iconeBotao}><ArrowUp size={14} /></button>
                <button type="button" aria-label="Descer aula" disabled={ocupado || j === m.aulas.length - 1} onClick={() => executar(() => moverAula(a.id, 1))} className={iconeBotao}><ArrowDown size={14} /></button>
                <button type="button" aria-label="Excluir aula" disabled={ocupado} onClick={async () => { if (await confirmarExclusao({ aulaId: a.id }, `a aula "${a.titulo}"`)) void executar(() => excluirAula(a.id)); }} className={iconeBotao}><Trash2 size={14} /></button>
              </li>
            ))}
          </ol>
          <button type="button" disabled={ocupado} onClick={() => { const t = window.prompt("Título da nova aula"); if (t) void executar(async () => { const id = await criarAula(m.id, t); router.push(`/cursos/${cursoId}/aulas/${id}`); }); }} className={`${estilos.botaoSecundario} mt-2`}>
            <Plus size={15} aria-hidden="true" /> Aula
          </button>
        </section>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); if (novoModulo.trim()) void executar(async () => { await criarModulo(cursoId, novoModulo); setNovoModulo(""); }); }} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="novo-modulo">Nome do novo módulo</label>
        <input id="novo-modulo" value={novoModulo} onChange={(e) => setNovoModulo(e.target.value)} placeholder="Nome do novo módulo (ex.: Termodinâmica)" className={`${estilos.input} max-w-sm`} />
        <button type="submit" disabled={ocupado || !novoModulo.trim()} className={estilos.botaoPrimario}><Plus size={15} aria-hidden="true" /> Novo módulo</button>
      </form>
    </div>
  );
}
