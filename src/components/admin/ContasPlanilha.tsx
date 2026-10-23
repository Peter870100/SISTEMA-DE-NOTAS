"use client";

import { useRef, useState } from "react";
import { Link2, Link2Off, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { estilos } from "@/components/ui/estilos";
import styles from "./ContasAdmin.module.css";
import { baixarPlanilha } from "./baixar-acessos";
import {
  alunosSemContaDaTurma,
  aplicarLigacoes,
  criarContasDaPlanilha,
  ligarConta,
  previaContasDaPlanilha,
  previaLigacoesPorNome,
  type ContaAlunoAdmin,
  type CredencialGerada,
} from "@/actions/contas-aluno";
import type { PreviaLigacoes } from "@/lib/contas/nucleo";
import { dadosOuErro } from "@/lib/resposta";

type Turma = { id: string; rotulo: string };
type ModalProps = { open: boolean; onClose: () => void; turmas: Turma[]; onConcluido: (aviso?: string) => Promise<void> };

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : "Algo deu errado. Tente de novo.";
}

/** Executa uma ação com estado de ocupado e erro local do modal. */
function useAcao() {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  }
  return { ocupado, erro, setErro, executar };
}

type LinhaCriar = { alunoId: string; nome: string; usuario: string; possivelContaExistente: boolean; marcada: boolean };

const ERRO_LISTA_CONTAS = "As contas foram criadas, mas a lista não atualizou; recarregue a página.";

function CorpoCriarDaPlanilha({ turmas, onClose, onConcluido, atualizarAoFecharRef }: Omit<ModalProps, "open"> & { atualizarAoFecharRef: { current: boolean } }) {
  const { ocupado, erro, setErro, executar } = useAcao();

  /** Contas já criadas: se a lista não atualizar, o erro é desse passo, não da criação. */
  async function concluir(aviso: string, erroLista: string) {
    try {
      await onConcluido(aviso);
    } catch {
      throw new Error(erroLista);
    }
    atualizarAoFecharRef.current = false;
    onClose();
  }
  const [turmaId, setTurmaId] = useState(turmas[0]?.id ?? "");
  const [linhas, setLinhas] = useState<LinhaCriar[] | null>(null);
  const [pendentes, setPendentes] = useState<CredencialGerada[] | null>(null);
  const [ignorados, setIgnorados] = useState<string[]>([]);

  const marcadas = (linhas ?? []).filter((l) => l.marcada);

  function mudar(i: number, parcial: Partial<LinhaCriar>) {
    setLinhas((atual) => (atual ? atual.map((l, j) => (j === i ? { ...l, ...parcial } : l)) : atual));
  }

  const rotuloIgnorados = (n: number) => `${n} já tinha conta`;

  return (
    <div className={styles.modalBody}>
      {erro && <p role="alert" className={styles.error}>{erro}</p>}
      {pendentes ? (
        <>
          <p className={styles.error} role="alert">Contas criadas, mas a planilha não baixou. Anote agora: as senhas não serão mostradas de novo.</p>
          {ignorados.length > 0 && <p className={styles.notice}>{rotuloIgnorados(ignorados.length)}: {ignorados.join(", ")}.</p>}
          <ul className={styles.modalList}>
            {pendentes.map((c, i) => (
              <li key={i} className={styles.credRow}>
                <span>{c.nome}</span>
                <span>{c.turma}</span>
                <span className={styles.mono}>{c.usuario}</span>
                <span className={styles.mono}>{c.senha}</span>
              </li>
            ))}
          </ul>
          <div className={styles.modalActions}>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => executar(async () => { await baixarPlanilha(pendentes); await concluir(`${pendentes.length} conta(s) criada(s).`, ERRO_LISTA_CONTAS); })}
              className={styles.primary}
            >
              Tentar baixar de novo
            </button>
            <button type="button" onClick={onClose} className={styles.secondary}>Fechar</button>
          </div>
        </>
      ) : (
        <>
          <label className={styles.modalField}>
            Turma
            <select value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setLinhas(null); }} className={estilos.input}>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
            </select>
          </label>
          {linhas === null ? (
            <button
              type="button"
              disabled={ocupado || !turmaId}
              onClick={() => executar(async () => {
                const previa = dadosOuErro(await previaContasDaPlanilha(turmaId));
                setLinhas(previa.map((p) => ({ ...p, marcada: !p.possivelContaExistente })));
              })}
              className={styles.primary}
            >
              Ver alunos sem conta
            </button>
          ) : linhas.length === 0 ? (
            <>
              <p className={styles.help}>Todos os alunos desta turma já têm conta ligada à planilha.</p>
              <div className={styles.modalActions}><button type="button" onClick={onClose} className={styles.secondary}>Fechar</button></div>
            </>
          ) : (
            <>
              <p className={styles.modalHint}>Alunos da planilha sem conta. Confira os usuários (pode editar) e desmarque quem não deve ganhar conta.</p>
              <ul className={styles.modalList}>
                {linhas.map((l, i) => (
                  <li key={l.alunoId} className={styles.planRow}>
                    <label className={styles.check}>
                      <input type="checkbox" checked={l.marcada} onChange={(e) => mudar(i, { marcada: e.target.checked })} aria-label={`Criar conta para ${l.nome}`} />
                      <span className={styles.planNome}>{l.nome}</span>
                    </label>
                    <input value={l.usuario} disabled={!l.marcada} aria-label={`Usuário de ${l.nome}`} onChange={(e) => mudar(i, { usuario: e.target.value })} className={`${estilos.input} ${styles.mono} ${styles.userInput}`} />
                    {l.possivelContaExistente && (
                      <p className={styles.rowWarning}><TriangleAlert size={15} aria-hidden="true" />Já existe uma conta com esse nome sem ligação — use &quot;Ligar pelo nome&quot;.</p>
                    )}
                  </li>
                ))}
              </ul>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setLinhas(null)} className={styles.secondary}>Voltar</button>
                <button
                  type="button"
                  disabled={ocupado || marcadas.length === 0}
                  onClick={() => executar(async () => {
                    const r = await criarContasDaPlanilha(turmaId, marcadas.map(({ alunoId, usuario }) => ({ alunoId, usuario })));
                    // Lote que parou no meio pode ter criado contas: a lista atualiza ao fechar.
                    if (!r.ok) atualizarAoFecharRef.current = true;
                    const { credenciais, ignorados: jaTinham } = dadosOuErro(r);
                    const sufixo = jaTinham.length > 0 ? ` ${rotuloIgnorados(jaTinham.length)}: ${jaTinham.join(", ")}.` : "";
                    if (credenciais.length === 0) {
                      await concluir(`Nenhuma conta nova.${sufixo}`, ERRO_LISTA_CONTAS);
                      return;
                    }
                    try {
                      await baixarPlanilha(credenciais);
                    } catch {
                      atualizarAoFecharRef.current = true;
                      setIgnorados(jaTinham);
                      setPendentes(credenciais);
                      setLinhas(null);
                      setErro("As contas foram criadas, mas a planilha não baixou. Anote as senhas abaixo ou tente baixar de novo.");
                      return;
                    }
                    await concluir(`${credenciais.length} conta(s) criada(s) e ligadas à planilha. A planilha com os usuários e senhas foi baixada — guarde-a, as senhas não aparecem de novo.${sufixo}`, ERRO_LISTA_CONTAS);
                  })}
                  className={styles.primary}
                >
                  Criar {marcadas.length} conta(s) e baixar planilha
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function ModalCriarDaPlanilha({ open, onClose, turmas, onConcluido }: ModalProps) {
  // Fechar (Esc, X ou botão) com contas já criadas e lista ainda velha: atualiza a lista.
  const atualizarAoFecharRef = useRef(false);
  function fechar() {
    if (atualizarAoFecharRef.current) {
      atualizarAoFecharRef.current = false;
      onConcluido().catch(() => {});
    }
    onClose();
  }
  return (
    <Modal open={open} onClose={fechar} titulo="Criar contas da planilha" descricao="Cria a conta de cada aluno da planilha da turma que ainda não tem conta, já ligada ao nome da planilha." largura="lg">
      <CorpoCriarDaPlanilha turmas={turmas} onClose={fechar} onConcluido={onConcluido} atualizarAoFecharRef={atualizarAoFecharRef} />
    </Modal>
  );
}

type Previa = PreviaLigacoes;

function CorpoLigarPorNome({ turmas, onClose, onConcluido }: Omit<ModalProps, "open">) {
  const { ocupado, erro, executar } = useAcao();
  const [turmaId, setTurmaId] = useState(turmas[0]?.id ?? "");
  const [previa, setPrevia] = useState<Previa | null>(null);

  return (
    <div className={styles.modalBody}>
      {erro && <p role="alert" className={styles.error}>{erro}</p>}
      <label className={styles.modalField}>
        Turma
        <select value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setPrevia(null); }} className={estilos.input}>
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
        </select>
      </label>
      {previa === null ? (
        <button type="button" disabled={ocupado || !turmaId} onClick={() => executar(async () => setPrevia(dadosOuErro(await previaLigacoesPorNome(turmaId))))} className={styles.primary}>
          Ver prévia
        </button>
      ) : (
        <>
          <section aria-label="Será ligado">
            <h4 className={styles.modalSubtitle}>Será ligado ({previa.ligar.length})</h4>
            {previa.ligar.length === 0 ? <p className={styles.help}>Nenhuma conta com nome igual ao da planilha, sem repetição.</p> : (
              <ul className={styles.modalList}>
                {previa.ligar.map((p) => (
                  <li key={p.contaId} className={styles.pairRow}>
                    <span>{p.nomeConta}</span>
                    <Link2 size={16} aria-hidden="true" />
                    <span>{p.nomeAluno}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {previa.repetidos.length > 0 && (
            <section aria-label="Nomes repetidos">
              <h4 className={styles.modalSubtitle}>Nomes repetidos ({previa.repetidos.length}) — ligue à mão</h4>
              <ul className={styles.modalList}>
                {previa.repetidos.map((r, i) => <li key={i} className={styles.pairRow}><span>{r.nome}</span><span>{r.contas} conta(s) e {r.alunos} aluno(s) da planilha</span></li>)}
              </ul>
            </section>
          )}
          {previa.semPar.length > 0 && (
            <section aria-label="Sem par na planilha">
              <h4 className={styles.modalSubtitle}>Sem par na planilha ({previa.semPar.length})</h4>
              <p className={styles.help}>{previa.semPar.join(", ")}</p>
            </section>
          )}
          <div className={styles.modalActions}>
            <button type="button" onClick={() => setPrevia(null)} className={styles.secondary}>Voltar</button>
            <button
              type="button"
              disabled={ocupado || previa.ligar.length === 0}
              onClick={() => executar(async () => {
                const r = await aplicarLigacoes(turmaId, previa.ligar.map(({ contaId, alunoId }) => ({ contaId, alunoId })));
                // Parou no meio: algumas ligações podem ter sido gravadas; atualiza a lista antes do erro.
                if (!r.ok) await onConcluido().catch(() => {});
                const { ligadas } = dadosOuErro(r);
                try {
                  await onConcluido(`${ligadas} conta(s) ligada(s) à planilha.`);
                } catch {
                  throw new Error("As ligações foram feitas, mas a lista não atualizou; recarregue a página.");
                }
                onClose();
              })}
              className={styles.primary}
            >
              Aplicar {previa.ligar.length} ligação(ões)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ModalLigarPorNome({ open, onClose, turmas, onConcluido }: ModalProps) {
  return (
    <Modal open={open} onClose={onClose} titulo="Ligar pelo nome" descricao="Liga as contas já existentes ao nome da planilha quando o nome é igual e único. Nomes repetidos você liga à mão." largura="lg">
      <CorpoLigarPorNome turmas={turmas} onClose={onClose} onConcluido={onConcluido} />
    </Modal>
  );
}

/** Em cada conta: selo de ligação por turma, com "Ligar a…" (alunos sem conta da turma) e "Desligar". */
export function LigacaoConta({ conta, desabilitado, onMudou, onErro }: { conta: ContaAlunoAdmin; desabilitado: boolean; onMudou: (aviso?: string) => Promise<void>; onErro: (mensagem: string) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [escolhendo, setEscolhendo] = useState<{ turmaId: string; opcoes: { alunoId: string; nome: string }[]; alunoId: string } | null>(null);

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      // Atualiza a lista (a ligação pode ter mudado por outro lado) e só então mostra o erro.
      await onMudou().catch(() => {});
      onErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  }

  if (conta.vinculos.length === 0) return null;
  const travado = desabilitado || ocupado;

  return (
    <div className={styles.linkBox} aria-label={`Ligação de ${conta.nome} com a planilha`}>
      {conta.vinculos.map((v) => (
        <div key={v.turmaId} className={styles.linkRow}>
          <span className={`${styles.linkBadge} ${v.alunoNome ? styles.linked : styles.unlinked}`}>
            {v.alunoNome ? <Link2 size={15} aria-hidden="true" /> : <Link2Off size={15} aria-hidden="true" />}
            {v.alunoNome ? `Ligada a ${v.alunoNome}` : "Sem ligação com a planilha"}
          </span>
          <span className={styles.linkTurma}>{v.rotulo}</span>
          {v.alunoNome ? (
            <button type="button" disabled={travado} className={styles.secondary} onClick={() => executar(async () => { dadosOuErro(await ligarConta(conta.id, v.turmaId, null)); await onMudou(); })}>
              <Link2Off size={16} aria-hidden="true" />Desligar
            </button>
          ) : escolhendo?.turmaId === v.turmaId ? (
            <div className={styles.linkPicker}>
              <select value={escolhendo.alunoId} aria-label={`Ligar ${conta.nome} a`} onChange={(e) => setEscolhendo({ ...escolhendo, alunoId: e.target.value })} className={estilos.input}>
                <option value="">Escolha o aluno da planilha</option>
                {escolhendo.opcoes.map((o) => <option key={o.alunoId} value={o.alunoId}>{o.nome}</option>)}
              </select>
              <button type="button" disabled={travado || !escolhendo.alunoId} className={styles.primary} onClick={() => executar(async () => { dadosOuErro(await ligarConta(conta.id, v.turmaId, escolhendo.alunoId)); setEscolhendo(null); await onMudou(); })}>Ligar</button>
              <button type="button" disabled={travado} className={styles.secondary} onClick={() => setEscolhendo(null)}>Cancelar</button>
            </div>
          ) : (
            <button type="button" disabled={travado} className={styles.secondary} onClick={() => executar(async () => { setEscolhendo({ turmaId: v.turmaId, opcoes: dadosOuErro(await alunosSemContaDaTurma(v.turmaId)), alunoId: "" }); })}>
              <Link2 size={16} aria-hidden="true" />Ligar a…
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
