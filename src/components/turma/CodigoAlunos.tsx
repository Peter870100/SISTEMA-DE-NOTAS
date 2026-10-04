"use client";

import { useState } from "react";
import { Copy, KeyRound, Ticket } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { estilos } from "@/components/ui/estilos";
import { formatarCodigo } from "@/lib/codigo-convite";
import {
  desativarConviteTurma,
  gerarConviteTurma,
  novaSenhaAlunoPeloProfessor,
  obterPainelCodigoTurma,
  type PainelCodigoTurma,
} from "@/actions/convites";

export function CodigoAlunos({ turmaId }: { turmaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [painel, setPainel] = useState<PainelCodigoTurma | null>(null);
  const [validade, setValidade] = useState<"7" | "30" | "sem">("30");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<{ nome: string; senha: string } | null>(null);

  async function executar(acao: () => Promise<PainelCodigoTurma | void>) {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await acao();
      if (resultado) setPainel(resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  function abrir() {
    setAberto(true);
    setSenhaGerada(null);
    void executar(() => obterPainelCodigoTurma(turmaId));
  }

  const convite = painel?.convite ?? null;

  return (
    <>
      <button type="button" onClick={abrir} className={estilos.botaoSecundario}>
        <Ticket size={16} aria-hidden="true" /> Código para alunos
      </button>
      <Modal open={aberto} onClose={() => setAberto(false)} titulo="Código para alunos" descricao="O aluno usa este código em “Sou aluno e tenho um código”, na tela de login." largura="md">
        <div className="flex flex-col gap-4">
          {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}

          {convite ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-control bg-surface-sunken px-4 py-2 font-mono text-2xl tracking-widest text-brand">{formatarCodigo(convite.codigo)}</span>
              <button type="button" onClick={() => navigator.clipboard.writeText(formatarCodigo(convite.codigo))} className={estilos.botaoFantasma}>
                <Copy size={15} aria-hidden="true" /> Copiar
              </button>
              <p className="w-full text-xs text-muted">
                {convite.usos} {convite.usos === 1 ? "aluno entrou" : "alunos entraram"} ·{" "}
                {convite.expira_em ? `vale até ${new Date(convite.expira_em).toLocaleDateString("pt-BR")}` : "sem validade"}
              </p>
            </div>
          ) : (
            painel && <p className="text-sm text-muted">Nenhum código ativo para esta turma.</p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Validade
              <select value={validade} onChange={(e) => setValidade(e.target.value as "7" | "30" | "sem")} className={estilos.input}>
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
                <option value="sem">Sem validade</option>
              </select>
            </label>
            <button type="button" disabled={ocupado} onClick={() => executar(() => gerarConviteTurma(turmaId, validade === "sem" ? null : (Number(validade) as 7 | 30)))} className={estilos.botaoPrimario}>
              {convite ? "Gerar novo código" : "Gerar código"}
            </button>
            {convite && (
              <button type="button" disabled={ocupado} onClick={() => executar(() => desativarConviteTurma(turmaId))} className={estilos.botaoFantasma}>
                Desativar
              </button>
            )}
          </div>

          {senhaGerada && (
            <p role="status" className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">
              Nova senha de <strong>{senhaGerada.nome}</strong>: <span className="font-mono">{senhaGerada.senha}</span>. Ela aparece só agora; o aluno troca no próximo acesso.
            </p>
          )}

          <div>
            <h3 className={estilos.rotulo}>Alunos com conta nesta turma</h3>
            {painel && painel.contas.length === 0 && <p className="mt-2 text-sm text-muted">Ninguém ainda.</p>}
            <ul className="mt-2 divide-y divide-line">
              {painel?.contas.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-ink">{c.nome}</span>
                    <span className="block truncate text-xs text-muted">{c.usuario ?? c.email}{c.ativo ? "" : " · bloqueado"}</span>
                  </span>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => executar(async () => setSenhaGerada({ nome: c.nome, senha: await novaSenhaAlunoPeloProfessor(turmaId, c.id) }))}
                    className={estilos.botaoFantasma}
                  >
                    <KeyRound size={14} aria-hidden="true" /> Nova senha
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>
    </>
  );
}
