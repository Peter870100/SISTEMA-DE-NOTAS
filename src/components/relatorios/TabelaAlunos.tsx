"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AlunoDaTurma } from "@/lib/relatorios/tipos";
import { formatarNecessaria, formatarNota } from "@/lib/relatorios/calculos";
import css from "./Relatorio.module.css";

function mediaGeral(a: AlunoDaTurma): number | null {
  const v = a.medias.filter((m): m is number => m !== null);
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
}

function textoQuantoFalta(q: AlunoDaTurma["quantoFalta"]): string {
  switch (q.situacao) {
    case "atingiu": return "Atingiu a média";
    case "nao_atingiu": return "Não atingiu";
    case "impossivel": return "Impossível";
    case "precisa": return q.porBimestre === undefined ? "—" : `Precisa de ${formatarNecessaria(q.porBimestre)} por bimestre`;
    default: return "Sem dados";
  }
}

type Ordem = "nome" | "media";

type Props = { turmaId: string; alunos: AlunoDaTurma[]; bimestres: string[]; mediaAprovacao: number };

export function TabelaAlunos({ turmaId, alunos, bimestres, mediaAprovacao }: Props) {
  const [ordem, setOrdem] = useState<Ordem>("nome");
  const linhas = useMemo(() => {
    const l = [...alunos];
    if (ordem === "nome") return l.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return l.sort((a, b) => (mediaGeral(a) ?? Infinity) - (mediaGeral(b) ?? Infinity));
  }, [alunos, ordem]);

  if (alunos.length === 0) return <p className="py-4 text-sm text-ink">Nenhum aluno nesta turma ainda.</p>;
  const seta = (o: Ordem) => (ordem === o ? " ▲" : "");
  return (
    <div className={css.rolagem}>
      <table className={css.tabela}>
        <thead>
          <tr>
            <th><button type="button" onClick={() => setOrdem("nome")} className="font-semibold uppercase">Aluno{seta("nome")}</button></th>
            {bimestres.map((b) => <th key={b}>{b}</th>)}
            <th><button type="button" onClick={() => setOrdem("media")} className="font-semibold uppercase">Média{seta("media")}</button></th>
            <th>Quanto falta</th>
            <th>Simulados</th>
            <th>Aulas</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((a) => {
            const m = mediaGeral(a);
            return (
              <tr key={a.alunoId}>
                <td><Link href={`/turma/${turmaId}/relatorio/aluno/${a.alunoId}`} className="font-semibold text-brand-bright hover:underline">{a.nome}</Link></td>
                {a.medias.map((x, i) => <td key={i} className="font-mono tabular-nums text-ink">{x === null ? "—" : formatarNota(x)}</td>)}
                <td className={`font-mono font-semibold tabular-nums ${m !== null && m < mediaAprovacao ? "text-danger" : "text-ink"}`}>{m === null ? "—" : formatarNota(m)}</td>
                <td className="text-ink">{textoQuantoFalta(a.quantoFalta)}</td>
                <td className="text-ink">{a.temConta ? `${a.simuladosFeitos}/${a.simuladosTotal}` : "sem login"}</td>
                <td className="text-ink">{a.aulasConcluidas === null ? "—" : a.aulasConcluidas}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
