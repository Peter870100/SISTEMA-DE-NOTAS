"use client";

import { useMemo, useState } from "react";
import { Bot, ClipboardList, GraduationCap, RotateCcw, Trash2, User } from "lucide-react";
import type { ItemLixeira, TipoLixeira } from "@/lib/types";
import { apagarDaLixeira, restaurarDaLixeira } from "@/actions/lixeira";
import { descreverOrigem, descreverResumo, mensagemRestauracao } from "@/lib/lixeira";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { estilos } from "@/components/ui/estilos";

type Item = ItemLixeira & { excluido_por_nome: string | null };

const ICONE: Record<TipoLixeira, typeof GraduationCap> = { turma: GraduationCap, aluno: User, atividade: ClipboardList };
const NOME_TIPO: Record<TipoLixeira, string> = { turma: "Planilha", aluno: "Aluno", atividade: "Atividade" };

export function LixeiraLista({ itensIniciais }: { itensIniciais: Item[] }) {
  const [itens, setItens] = useState(itensIniciais);
  const [tipo, setTipo] = useState<TipoLixeira | "todos">("todos");
  const [origem, setOrigem] = useState<"todas" | "hermes" | "app">("todas");
  const [confirmar, setConfirmar] = useState<{ item: Item; acao: "restaurar" | "apagar" } | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const turmasNaLixeira = useMemo(
    () => new Set(itens.filter((i) => i.tipo === "turma").map((i) => i.turma_id)),
    [itens]
  );

  const visiveis = itens.filter(
    (i) => (tipo === "todos" || i.tipo === tipo) && (origem === "todas" || i.excluido_via === origem)
  );

  async function executar() {
    if (!confirmar) return;
    const { item, acao } = confirmar;
    setConfirmar(null);
    setOcupado(item.id);
    setAviso(null);
    try {
      if (acao === "restaurar") {
        const r = await restaurarDaLixeira(item.id);
        if (!r.ok) {
          setAviso({ tipo: "erro", texto: r.erro });
          return;
        }
        setAviso({ tipo: "ok", texto: mensagemRestauracao(r.dados) });
      } else {
        const r = await apagarDaLixeira(item.id);
        if (!r.ok) {
          setAviso({ tipo: "erro", texto: r.erro });
          return;
        }
        setAviso({ tipo: "ok", texto: `"${item.titulo}" foi apagado definitivamente.` });
      }
      setItens((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      setAviso({ tipo: "erro", texto: "Não foi possível concluir. Tente novamente." });
    } finally {
      setOcupado(null);
    }
  }

  const filtro = (ativo: boolean) =>
    `rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${ativo ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className={`${estilos.card} flex flex-wrap items-center gap-3 p-3`}>
        <div className="inline-flex items-center gap-0.5 rounded-control border border-line bg-surface-sunken p-0.5" role="group" aria-label="Filtrar por tipo">
          {(["todos", "turma", "aluno", "atividade"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)} className={filtro(tipo === t)}>
              {t === "todos" ? "Todos" : `${NOME_TIPO[t]}s`}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-control border border-line bg-surface-sunken p-0.5" role="group" aria-label="Filtrar por origem">
          {(["todas", "hermes", "app"] as const).map((o) => (
            <button key={o} type="button" aria-pressed={origem === o} onClick={() => setOrigem(o)} className={filtro(origem === o)}>
              {o === "todas" ? "Todas as origens" : o === "hermes" ? "Hermes" : "Professores"}
            </button>
          ))}
        </div>
      </div>

      {aviso && (
        <p
          role={aviso.tipo === "erro" ? "alert" : "status"}
          className={`rounded-control border px-3 py-2 text-sm ${aviso.tipo === "erro" ? "border-danger/20 bg-danger/10 text-danger" : "border-ok/20 bg-ok/10 text-ok"}`}
        >
          {aviso.texto}
        </p>
      )}

      <div className={`${estilos.card} overflow-hidden`}>
        {visiveis.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {itens.length === 0 ? "A lixeira está vazia." : "Nada na lixeira com esses filtros."}
          </p>
        ) : (
          <ul>
            {visiveis.map((item) => {
              const Icone = ICONE[item.tipo];
              const bloqueado = item.tipo !== "turma" && turmasNaLixeira.has(item.turma_id);
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 border-t border-line-soft px-4 py-3 first:border-t-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-sunken text-muted" title={NOME_TIPO[item.tipo]}>
                    <Icone size={17} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{item.titulo}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <span>{descreverResumo(item.tipo, item.resumo)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        {item.excluido_via === "hermes" && <Bot size={12} className="text-brand-bright" aria-hidden="true" />}
                        {descreverOrigem(item.excluido_via, item.excluido_por_nome, item.excluido_por !== null)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{new Date(item.excluido_em).toLocaleString("pt-BR")}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={bloqueado || ocupado === item.id}
                      title={bloqueado ? `Restaure a planilha "${item.turma_nome}" primeiro` : undefined}
                      onClick={() => setConfirmar({ item, acao: "restaurar" })}
                      className={`${estilos.botaoSecundario} min-h-9 py-1.5`}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      Restaurar
                    </button>
                    <button
                      type="button"
                      disabled={ocupado === item.id}
                      onClick={() => setConfirmar({ item, acao: "apagar" })}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-2.5 py-1.5 text-sm font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Apagar de vez
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmar !== null}
        title={confirmar?.acao === "apagar" ? "Apagar de vez" : "Restaurar"}
        message={
          confirmar?.acao === "apagar"
            ? `Isso apaga definitivamente "${confirmar.item.titulo}" (${descreverResumo(confirmar.item.tipo, confirmar.item.resumo)}) e não pode ser desfeito.`
            : `Restaurar "${confirmar?.item.titulo}"? Tudo volta exatamente como estava, com as notas.`
        }
        confirmLabel={confirmar?.acao === "apagar" ? "Apagar de vez" : "Restaurar"}
        danger={confirmar?.acao === "apagar"}
        onConfirm={executar}
        onCancel={() => setConfirmar(null)}
      />
    </div>
  );
}
