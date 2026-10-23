"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, KeyRound, Link2, Lock, Unlock, UserPlus, Users, Search, School, Clock3, UserRound, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { estilos } from "@/components/ui/estilos";
import styles from "./ContasAdmin.module.css";
import { baixarPlanilha } from "./baixar-acessos";
import { dadosOuErro } from "@/lib/resposta";
import { LigacaoConta, ModalCriarDaPlanilha, ModalLigarPorNome } from "./ContasPlanilha";
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

export function GerenciarAlunos({ contasIniciais, turmas }: Props) {
  const [contas, setContas] = useState(contasIniciais);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [loteAberto, setLoteAberto] = useState(false);
  const [turmaId, setTurmaId] = useState(turmas[0]?.id ?? "");
  const [textoNomes, setTextoNomes] = useState("");
  const [pendentes, setPendentes] = useState<CredencialGerada[] | null>(null);
  const [previa, setPrevia] = useState<{ nome: string; usuario: string }[] | null>(null);
  const [planilhaAberta, setPlanilhaAberta] = useState(false);
  const [ligarAberto, setLigarAberto] = useState(false);

  async function recarregar(mensagem?: string) {
    setErro(null);
    setAviso(mensagem ?? null);
    setContas(await listarContasAluno());
  }

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
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="contas-titulo">
        <div className={styles.toolbar}>
          <div className={styles.sectionTitle}><span className={styles.icon}><Users size={23} aria-hidden="true" /></span><div><p className={styles.eyebrow}>ACESSOS DA ESCOLA</p><h2 id="contas-titulo">Seus alunos</h2><p>Gerencie os acessos e acompanhe quem já entrou na plataforma.</p></div></div>
          <div className={styles.toolbarActions}>
            <button type="button" onClick={() => setPlanilhaAberta(true)} disabled={turmas.length === 0 || ocupado} className={styles.primary}><FileSpreadsheet size={18} aria-hidden="true" />Criar contas da planilha</button>
            <button type="button" onClick={() => setLigarAberto(true)} disabled={turmas.length === 0 || ocupado} className={styles.secondary}><Link2 size={18} aria-hidden="true" />Ligar pelo nome</button>
            <button type="button" onClick={abrirLote} disabled={turmas.length === 0 || ocupado} className={styles.secondary}><UserPlus size={18} aria-hidden="true" />Criar contas</button>
          </div>
        </div>
        <div className={styles.searchRow}>
          <label className={styles.search}><Search size={19} aria-hidden="true" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, usuário, email ou turma" aria-label="Buscar contas" /></label>
          <span className={styles.resultCount} aria-live="polite">{filtradas.length} {filtradas.length === 1 ? "conta encontrada" : "contas encontradas"}</span>
        </div>
        {turmas.length === 0 && <p className={styles.help}>Cadastre uma turma para criar contas de aluno.</p>}
      </section>
      {erro && <p role="alert" className={styles.error}>{erro}</p>}
      {aviso && <p role="status" className={styles.notice}>{aviso}</p>}
      {filtradas.length === 0 ? <div className={`${styles.card} ${styles.empty}`}><span className={styles.icon}><Users size={25} aria-hidden="true" /></span><h2>{contas.length === 0 ? "Sua lista de alunos começa aqui" : "Nenhuma conta encontrada"}</h2><p>{contas.length === 0 ? "Crie acessos para seus alunos começarem a estudar." : "Tente outro nome, usuário, email ou turma."}</p>{busca && <button type="button" className={styles.secondary} onClick={() => setBusca("")}>Limpar busca</button>}</div> : (
        <div className={styles.grid} aria-label="Contas de aluno">
          {filtradas.map((c) => <article key={c.id} className={styles.professor} aria-busy={ocupado}>
            <div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{c.nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()}</span><div className={styles.identityText}><span className={styles.role}>Aluno</span><h3>{c.nome}</h3><span className={`${styles.accountStatus} ${!c.ativo ? styles.blocked : ""}`}>{c.ativo ? <ShieldCheck size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}{c.ativo ? "Conta ativa" : "Conta bloqueada"}</span></div></div>
            <dl className={styles.accountDetails}>
              <div><dt><UserRound size={17} aria-hidden="true" />Acesso</dt><dd>{c.usuario ?? c.email ?? "Não informado"}</dd></div>
              <div><dt><School size={17} aria-hidden="true" />Turmas</dt><dd>{c.turmas.join(", ") || "Sem turma vinculada"}</dd></div>
              <div><dt><Clock3 size={17} aria-hidden="true" />Último acesso</dt><dd>{c.ultimo_acesso ? new Date(c.ultimo_acesso).toLocaleDateString("pt-BR") : "Ainda não acessou"}</dd></div>
            </dl>
            <LigacaoConta conta={c} desabilitado={ocupado} onMudou={recarregar} onErro={(m) => { setAviso(null); setErro(m); }} />
            <div className={styles.actions}>
              <button type="button" disabled={ocupado} onClick={() => executar(async () => { const senha = dadosOuErro(await novaSenhaAlunoPeloAdmin(c.id)); setAviso(`Nova senha de ${c.nome}: ${senha} (aparece só agora; o aluno troca no próximo acesso).`); })} className={styles.secondary}><KeyRound size={17} aria-hidden="true" />Nova senha</button>
              <button type="button" disabled={ocupado} onClick={() => executar(async () => { dadosOuErro(await definirContaAtiva(c.id, !c.ativo)); setContas(await listarContasAluno()); })} className={c.ativo ? styles.secondary : styles.primary}>{c.ativo ? <><Lock size={17} aria-hidden="true" />Bloquear</> : <><Unlock size={17} aria-hidden="true" />Desbloquear</>}</button>
            </div>
          </article>)}
        </div>
      )}

      <ModalCriarDaPlanilha open={planilhaAberta} onClose={() => setPlanilhaAberta(false)} turmas={turmas} onConcluido={recarregar} />
      <ModalLigarPorNome open={ligarAberto} onClose={() => setLigarAberto(false)} turmas={turmas} onConcluido={recarregar} />

      <Modal open={loteAberto} onClose={() => { setLoteAberto(false); setPendentes(null); }} titulo="Criar contas de aluno" descricao="Um nome por linha. Para criar uma conta só, cole um nome." largura="lg">
        {erro && <p role="alert" className={styles.error}>{erro}</p>}
        {pendentes ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-danger" role="alert">
              Contas criadas, mas a planilha não baixou. Anote agora: as senhas não serão mostradas de novo.
            </p>
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {pendentes.map((c, i) => (
                <li key={i} className="grid grid-cols-4 gap-2 py-1.5 text-sm">
                  <span className="truncate text-ink">{c.nome}</span>
                  <span className="truncate text-muted">{c.turma}</span>
                  <span className="truncate font-mono text-xs">{c.usuario}</span>
                  <span className="font-mono text-xs">{c.senha}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => executar(async () => { await baixarPlanilha(pendentes); setPendentes(null); setLoteAberto(false); })}
                className={styles.primary}
              >
                Tentar baixar de novo
              </button>
              <button type="button" onClick={() => { setPendentes(null); setLoteAberto(false); }} className={styles.secondary}>Fechar</button>
            </div>
          </div>
        ) : (
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
              <button type="button" disabled={ocupado || !textoNomes.trim()} onClick={() => executar(async () => setPrevia(await prepararLote(textoNomes.split("\n"))))} className={styles.primary}>
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
                <button type="button" onClick={() => setPrevia(null)} className={styles.secondary}>Voltar</button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => executar(async () => {
                    // Se o lote parar no meio, `executar` recarrega a lista (algumas contas podem ter sido criadas).
                    const credenciais = dadosOuErro(await criarContasAluno(turmaId, previa));
                    try {
                      await baixarPlanilha(credenciais);
                    } catch {
                      setPendentes(credenciais);
                      setPrevia(null);
                      setTextoNomes("");
                      setContas(await listarContasAluno());
                      throw new Error("As contas foram criadas, mas a planilha não baixou. Anote as senhas abaixo ou tente baixar de novo.");
                    }
                    setContas(await listarContasAluno());
                    setLoteAberto(false);
                    setAviso(`${credenciais.length} conta(s) criada(s). A planilha com os usuários e senhas foi baixada — guarde-a, as senhas não aparecem de novo.`);
                  })}
                  className={styles.primary}
                >
                  Criar {previa.length} conta(s) e baixar planilha
                </button>
              </div>
            </>
          )}
        </div>
        )}
      </Modal>
    </div>
  );
}
