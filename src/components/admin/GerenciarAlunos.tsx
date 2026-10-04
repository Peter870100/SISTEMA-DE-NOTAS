"use client";

import { useMemo, useState } from "react";
import { KeyRound, Lock, Unlock, UserPlus, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { estilos } from "@/components/ui/estilos";
import {
  criarContasAluno,
  definirContaAtiva,
  listarContasAluno,
  novaSenhaAlunoPeloAdmin,
  prepararLote,
  type ContaAlunoAdmin,
  type CredencialGerada,
} from "@/actions/contas-aluno";

type Props = { contasIniciais: ContaAlunoAdmin[]; turmas: { id: string; rotulo: string }[] };

async function baixarPlanilha(credenciais: CredencialGerada[]) {
  const XLSX = await import("xlsx");
  const linhas = credenciais.map((c) => ({ Nome: c.nome, Turma: c.turma, Usuário: c.usuario, "Senha provisória": c.senha }));
  const planilha = XLSX.utils.json_to_sheet(linhas);
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, "Acessos");
  XLSX.writeFile(livro, `acessos-alunos-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function GerenciarAlunos({ contasIniciais, turmas }: Props) {
  const [contas, setContas] = useState(contasIniciais);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [loteAberto, setLoteAberto] = useState(false);
  const [turmaId, setTurmaId] = useState(turmas[0]?.id ?? "");
  const [textoNomes, setTextoNomes] = useState("");
  const [previa, setPrevia] = useState<{ nome: string; usuario: string }[] | null>(null);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? contas.filter((c) => [c.nome, c.usuario ?? "", c.email ?? "", ...c.turmas].join(" ").toLowerCase().includes(termo)) : contas;
  }, [contas, busca]);

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
      setContas(await listarContasAluno());
    } finally {
      setOcupado(false);
    }
  }

  function abrirLote() {
    setLoteAberto(true);
    setTextoNomes("");
    setPrevia(null);
  }

  return (
    <div className={`${estilos.card} flex flex-col gap-4 p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, usuário, email ou turma" aria-label="Buscar contas" className={`${estilos.input} max-w-sm`} />
        <button type="button" onClick={abrirLote} disabled={turmas.length === 0} className={`${estilos.botaoPrimario} ml-auto`}>
          <UserPlus size={16} aria-hidden="true" /> Criar contas
        </button>
      </div>

      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">{aviso}</p>}

      {contas.length === 0 ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted"><Users size={16} aria-hidden="true" /> Nenhuma conta de aluno ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={estilos.rotulo}>
              <tr><th className="px-3 py-2">Aluno</th><th className="px-3 py-2">Acesso</th><th className="px-3 py-2">Turmas</th><th className="px-3 py-2">Último acesso</th><th className="px-3 py-2"><span className="sr-only">Ações</span></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtradas.map((c) => (
                <tr key={c.id} className={c.ativo ? "" : "opacity-60"}>
                  <td className="px-3 py-2 font-medium text-ink">{c.nome}{!c.ativo && <span className="ml-2 rounded bg-danger/15 px-1.5 py-0.5 text-xs text-danger">bloqueada</span>}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{c.usuario ?? c.email}</td>
                  <td className="px-3 py-2 text-muted">{c.turmas.join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-muted">{c.ultimo_acesso ? new Date(c.ultimo_acesso).toLocaleDateString("pt-BR") : "nunca"}</td>
                  <td className="flex justify-end gap-1 px-3 py-2">
                    <button type="button" disabled={ocupado} onClick={() => executar(async () => { const senha = await novaSenhaAlunoPeloAdmin(c.id); setAviso(`Nova senha de ${c.nome}: ${senha} (aparece só agora; o aluno troca no próximo acesso).`); })} className={estilos.botaoFantasma}>
                      <KeyRound size={14} aria-hidden="true" /> Nova senha
                    </button>
                    <button type="button" disabled={ocupado} onClick={() => executar(async () => { await definirContaAtiva(c.id, !c.ativo); setContas(await listarContasAluno()); })} className={estilos.botaoFantasma}>
                      {c.ativo ? <><Lock size={14} aria-hidden="true" /> Bloquear</> : <><Unlock size={14} aria-hidden="true" /> Desbloquear</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={loteAberto} onClose={() => setLoteAberto(false)} titulo="Criar contas de aluno" descricao="Um nome por linha. Para criar uma conta só, cole um nome." largura="lg">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Turma
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className={estilos.input}>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
            </select>
          </label>
          {previa === null ? (
            <>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Nomes
                <textarea value={textoNomes} onChange={(e) => setTextoNomes(e.target.value)} rows={10} placeholder={"Ana Souza\nJoão da Silva\n…"} className={estilos.input} />
              </label>
              <button type="button" disabled={ocupado || !textoNomes.trim()} onClick={() => executar(async () => setPrevia(await prepararLote(textoNomes.split("\n"))))} className={estilos.botaoPrimario}>
                Ver prévia
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Confira os usuários. Você pode editar antes de criar.</p>
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {previa.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate text-ink">{p.nome}</span>
                    <input value={p.usuario} aria-label={`Usuário de ${p.nome}`} onChange={(e) => setPrevia(previa.map((q, j) => (j === i ? { ...q, usuario: e.target.value } : q)))} className={`${estilos.input} max-w-48 font-mono text-xs`} />
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPrevia(null)} className={estilos.botaoFantasma}>Voltar</button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => executar(async () => {
                    const credenciais = await criarContasAluno(turmaId, previa);
                    await baixarPlanilha(credenciais);
                    setContas(await listarContasAluno());
                    setLoteAberto(false);
                    setAviso(`${credenciais.length} conta(s) criada(s). A planilha com os usuários e senhas foi baixada — guarde-a, as senhas não aparecem de novo.`);
                  })}
                  className={estilos.botaoPrimario}
                >
                  Criar {previa.length} conta(s) e baixar planilha
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
