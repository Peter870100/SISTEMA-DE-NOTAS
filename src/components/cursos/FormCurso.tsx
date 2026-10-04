"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { atualizarCurso, criarCurso, type DadosCurso } from "@/actions/cursos";
import { estilos } from "@/components/ui/estilos";

type Props = {
  inicial?: DadosCurso & { id: string };
  turmas: { turma_nome: string; ano_letivo: string }[];
  onSalvo?: () => void;
};

const chave = (t: { turma_nome: string; ano_letivo: string }) => `${t.turma_nome}|${t.ano_letivo}`;

export function FormCurso({ inicial, turmas, onSalvo }: Props) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [disciplina, setDisciplina] = useState(inicial?.disciplina ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [marcadas, setMarcadas] = useState(new Set((inicial?.turmas ?? []).map(chave)));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const dados: DadosCurso = { titulo, disciplina, descricao, turmas: turmas.filter((t) => marcadas.has(chave(t))) };
    try {
      if (inicial) {
        await atualizarCurso(inicial.id, dados);
        router.refresh();
        onSalvo?.();
      } else {
        const id = await criarCurso(dados);
        router.push(`/cursos/${id}`);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      <label className="flex flex-col gap-1 text-xs text-muted">Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Física — 3º ano" className={estilos.input} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Disciplina<input value={disciplina} onChange={(e) => setDisciplina(e.target.value)} required placeholder="Física" className={estilos.input} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Descrição (opcional)<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className={estilos.input} /></label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-muted">Turmas que veem o curso</legend>
        {turmas.length === 0 && <p className="text-sm text-muted">Nenhuma turma disponível.</p>}
        <div className="flex flex-wrap gap-2">
          {turmas.map((t) => {
            const k = chave(t);
            return (
              <label key={k} className="flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1.5 text-sm text-ink">
                <input type="checkbox" checked={marcadas.has(k)} onChange={(e) => {
                  const nova = new Set(marcadas);
                  if (e.target.checked) nova.add(k); else nova.delete(k);
                  setMarcadas(nova);
                }} />
                {t.turma_nome} · {t.ano_letivo}
              </label>
            );
          })}
        </div>
      </fieldset>
      <button type="submit" disabled={salvando} className={estilos.botaoPrimario}>{salvando ? "Salvando…" : inicial ? "Salvar curso" : "Criar curso"}</button>
    </form>
  );
}
