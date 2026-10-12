"use client";

import { useState } from "react";
import { KeyRound, Phone, School, Trash2, UserPlus, Users, Mail, CheckCircle2, Clock3 } from "lucide-react";
import type { Professor, ProfessorRole } from "@/lib/types";
import {
  criarProfessor,
  definirSenhaProvisoria,
  excluirProfessor,
  atualizarAcessoTurmas,
  atualizarTelefoneProfessor,
} from "@/actions/professores";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import styles from "./ContasAdmin.module.css";
import { ehAdmin } from "@/lib/papeis";

const ONLINE_LIMITE_MS = 3 * 60 * 1000;

function statusPresenca(ultimoAcesso: string | null): { online: boolean; texto: string } {
  if (!ultimoAcesso) return { online: false, texto: "nunca acessou" };
  const diffMs = Date.now() - new Date(ultimoAcesso).getTime();
  if (diffMs < ONLINE_LIMITE_MS) return { online: true, texto: "online agora" };
  const minutos = Math.round(diffMs / 60_000);
  if (minutos < 60) return { online: false, texto: `visto há ${minutos} min` };
  const horas = Math.round(minutos / 60);
  if (horas < 24) return { online: false, texto: `visto há ${horas}h` };
  const dias = Math.round(horas / 24);
  return { online: false, texto: `visto há ${dias}d` };
}

type GerenciarProfessoresProps = {
  professoresIniciais: Professor[];
  nomesTurmas: string[];
  acessoInicialPorProfessor: Record<string, string[]>;
};

export function GerenciarProfessores({
  professoresIniciais,
  nomesTurmas,
  acessoInicialPorProfessor,
}: GerenciarProfessoresProps) {
  const [professores, setProfessores] = useState(professoresIniciais);
  const [acessoPorProfessor, setAcessoPorProfessor] = useState(acessoInicialPorProfessor);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<ProfessorRole>("professor");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [senhaAbertaId, setSenhaAbertaId] = useState<string | null>(null);
  const [novaSenhaProvisoria, setNovaSenhaProvisoria] = useState("");
  const [definindoId, setDefinindoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState<Professor | null>(null);

  const [telefoneAbertoId, setTelefoneAbertoId] = useState<string | null>(null);
  const [telefoneEdit, setTelefoneEdit] = useState("");
  const [salvandoTelefoneId, setSalvandoTelefoneId] = useState<string | null>(null);

  const [turmasAbertaId, setTurmasAbertaId] = useState<string | null>(null);
  const [restritoEdit, setRestritoEdit] = useState(false);
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<Set<string>>(new Set());
  const [salvandoTurmasId, setSalvandoTurmasId] = useState<string | null>(null);

  function fecharPaineis() {
    setSenhaAbertaId(null);
    setTelefoneAbertoId(null);
    setTurmasAbertaId(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    if (!nome.trim() || !email.trim() || !senha) {
      setErro("Preencha nome, email e senha.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const professor = await criarProfessor(nome, email, senha, role);
      setProfessores((prev) => [...prev, professor].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNome("");
      setEmail("");
      setSenha("");
      setRole("professor");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o professor.");
    } finally {
      setSalvando(false);
    }
  }

  function handleAbrirSenha(id: string) {
    fecharPaineis();
    setSenhaAbertaId(id);
    setNovaSenhaProvisoria("");
    setErro(null);
  }

  async function handleDefinirSenha(id: string) {
    if (definindoId) return;
    if (novaSenhaProvisoria.length < 6) {
      setErro("A senha provisória precisa ter pelo menos 6 caracteres.");
      return;
    }
    setDefinindoId(id);
    setErro(null);
    try {
      await definirSenhaProvisoria(id, novaSenhaProvisoria);
      setProfessores((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, email_verificado: true, senha_provisoria: true } : p
        )
      );
      setSenhaAbertaId(null);
      setNovaSenhaProvisoria("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível definir a senha.");
    } finally {
      setDefinindoId(null);
    }
  }

  async function handleExcluir() {
    if (!confirmExcluir || excluindoId) return;
    const p = confirmExcluir;
    setConfirmExcluir(null);
    setExcluindoId(p.id);
    setErro(null);
    try {
      await excluirProfessor(p.id);
      setProfessores((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir o professor.");
    } finally {
      setExcluindoId(null);
    }
  }

  function handleAbrirTelefone(p: Professor) {
    fecharPaineis();
    setTelefoneAbertoId(p.id);
    setTelefoneEdit(p.telefone ?? "");
    setErro(null);
  }

  async function handleSalvarTelefone(id: string) {
    if (salvandoTelefoneId) return;
    setSalvandoTelefoneId(id);
    setErro(null);
    try {
      await atualizarTelefoneProfessor(id, telefoneEdit);
      setProfessores((prev) =>
        prev.map((p) => (p.id === id ? { ...p, telefone: telefoneEdit.trim() || null } : p))
      );
      setTelefoneAbertoId(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o telefone.");
    } finally {
      setSalvandoTelefoneId(null);
    }
  }

  function handleAbrirTurmas(p: Professor) {
    fecharPaineis();
    setTurmasAbertaId(p.id);
    setRestritoEdit(p.acesso_restrito);
    setTurmasSelecionadas(new Set(acessoPorProfessor[p.id] ?? []));
    setErro(null);
  }

  function toggleTurma(nomeTurma: string) {
    setTurmasSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(nomeTurma)) novo.delete(nomeTurma);
      else novo.add(nomeTurma);
      return novo;
    });
  }

  async function handleSalvarTurmas(id: string) {
    if (salvandoTurmasId) return;
    setSalvandoTurmasId(id);
    setErro(null);
    try {
      const lista = [...turmasSelecionadas];
      await atualizarAcessoTurmas(id, restritoEdit, lista);
      setProfessores((prev) => prev.map((p) => (p.id === id ? { ...p, acesso_restrito: restritoEdit } : p)));
      setAcessoPorProfessor((prev) => ({ ...prev, [id]: restritoEdit ? lista : [] }));
      setTurmasAbertaId(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o acesso às turmas.");
    } finally {
      setSalvandoTurmasId(null);
    }
  }

    return (<div className={styles.stack}>
      {erro && <p role="alert" className={styles.error}>{erro}</p>}
      <form onSubmit={handleAdd} className={styles.card}>
        <div className={styles.sectionTitle}><span className={styles.icon}><UserPlus size={23}/></span><div><p className={styles.eyebrow}>AMPLIE SUA EQUIPE</p><h2>Adicionar professor</h2></div></div>
        <div className={styles.fields}>
          <label>Nome completo<input required autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do professor"/></label>
          <label>Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="professor@escola.com.br"/></label>
          <label>Senha inicial<input required type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Crie uma senha"/></label>
          <label>Perfil de acesso<select value={role} onChange={(e) => setRole(e.target.value as ProfessorRole)}><option value="professor">Professor</option><option value="admin">Administrador</option></select></label>
        </div>
        <div className={styles.formFooter}><p>Depois do cadastro, configure o telefone e o acesso às turmas no cartão do professor.</p><button type="submit" disabled={salvando} className={styles.primary}><UserPlus size={18}/>{salvando ? "Criando..." : "Criar professor"}</button></div>
      </form>
      <section aria-labelledby="equipe-titulo" className={styles.stack}>
        <div className={styles.listHeader}><div><p className={styles.eyebrow}>QUEM FAZ PARTE DA ESCOLA</p><h2 id="equipe-titulo">Sua equipe</h2></div><span className={styles.count}><Users size={18}/>{professores.length} {professores.length === 1 ? "profissional" : "profissionais"}</span></div>
        <div className={styles.grid}>
          {professores.map((p) => {
            const presenca = statusPresenca(p.ultimo_acesso);
            const ocupado = definindoId === p.id || salvandoTelefoneId === p.id || salvandoTurmasId === p.id || excluindoId === p.id;
            return <article key={p.id} className={styles.professor} aria-busy={ocupado}>
              <div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{p.nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()}</span><div className={styles.identityText}><span className={styles.role}>{p.role === "dono" ? "Dono da escola" : ehAdmin(p.role) ? "Administrador" : "Professor"}</span><h3>{p.nome}</h3><p className={styles.presence}><span className={presenca.online ? styles.online : styles.offline}/>{presenca.texto}</p></div></div>
              <div className={styles.details}><p><Mail size={17}/><span>{p.email}</span></p><p><Phone size={17}/><span>{p.telefone || "Telefone não informado"}</span></p><p><School size={17}/><span>{ehAdmin(p.role) || !p.acesso_restrito ? "Acesso a todas as turmas" : acessoPorProfessor[p.id]?.join(", ") || "Nenhuma turma liberada"}</span></p></div>
              <div className={styles.badges}><span>{p.email_verificado ? <CheckCircle2 size={15}/> : <Clock3 size={15}/>} {p.email_verificado ? "Email verificado" : "Verificação pendente"}</span>{p.senha_provisoria && <span><KeyRound size={15}/>Senha provisória</span>}</div>
              <div className={styles.actions}>
                <button type="button" disabled={ocupado} aria-expanded={telefoneAbertoId === p.id} onClick={() => handleAbrirTelefone(p)} className={styles.secondary}><Phone size={16}/>Telefone</button>
                <button type="button" disabled={ocupado} aria-expanded={senhaAbertaId === p.id} onClick={() => handleAbrirSenha(p.id)} className={styles.secondary}><KeyRound size={16}/>Senha provisória</button>
                {!ehAdmin(p.role) && <button type="button" disabled={ocupado} aria-expanded={turmasAbertaId === p.id} onClick={() => handleAbrirTurmas(p)} className={styles.secondary}><School size={16}/>Turmas</button>}
                <button type="button" disabled={ocupado} onClick={() => setConfirmExcluir(p)} className={styles.delete}><Trash2 size={16}/>{excluindoId === p.id ? "Excluindo..." : "Excluir"}</button>
              </div>
              {telefoneAbertoId === p.id && <form className={styles.panel} onSubmit={(e) => { e.preventDefault(); void handleSalvarTelefone(p.id); }}><label>Telefone de contato<input type="tel" autoFocus value={telefoneEdit} onChange={(e) => setTelefoneEdit(e.target.value)} placeholder="(00) 00000-0000"/></label><div className={styles.actions}><button disabled={ocupado} type="submit" className={styles.primary}>{ocupado ? "Salvando..." : "Salvar telefone"}</button><button disabled={ocupado} type="button" onClick={fecharPaineis} className={styles.secondary}>Cancelar</button></div></form>}
              {senhaAbertaId === p.id && <form className={styles.panel} onSubmit={(e) => { e.preventDefault(); void handleDefinirSenha(p.id); }}><label>Nova senha provisória<input required minLength={6} autoComplete="new-password" type="password" autoFocus value={novaSenhaProvisoria} onChange={(e) => setNovaSenhaProvisoria(e.target.value)} placeholder="Pelo menos 6 caracteres"/></label><div className={styles.actions}><button disabled={ocupado} type="submit" className={styles.primary}>{ocupado ? "Salvando..." : "Salvar senha"}</button><button disabled={ocupado} type="button" onClick={fecharPaineis} className={styles.secondary}>Cancelar</button></div></form>}
              {turmasAbertaId === p.id && <form className={styles.panel} onSubmit={(e) => { e.preventDefault(); void handleSalvarTurmas(p.id); }}><label className={styles.checkbox}><input type="checkbox" checked={restritoEdit} onChange={(e) => setRestritoEdit(e.target.checked)}/>Restringir a turmas específicas</label>{restritoEdit && <fieldset className={styles.turmas}><legend>Turmas liberadas</legend>{nomesTurmas.length === 0 && <p>Nenhuma turma cadastrada.</p>}{nomesTurmas.map((t) => <label key={t} className={styles.checkbox}><input type="checkbox" checked={turmasSelecionadas.has(t)} onChange={() => toggleTurma(t)}/>{t}</label>)}</fieldset>}<div className={styles.actions}><button disabled={ocupado} type="submit" className={styles.primary}>{ocupado ? "Salvando..." : "Salvar acesso"}</button><button disabled={ocupado} type="button" onClick={fecharPaineis} className={styles.secondary}>Cancelar</button></div></form>}
            </article>;
        })}
        </div>
        {professores.length === 0 && <div className={styles.card}><Users size={30}/><h3>Sua equipe começa aqui</h3><p>Cadastre o primeiro professor ou compartilhe o código de convite.</p></div>}
      </section>
      <ConfirmDialog open={confirmExcluir !== null} title="Excluir professor" message={`Tem certeza que deseja excluir "${confirmExcluir?.nome}"? Essa ação não pode ser desfeita.`} confirmLabel="Excluir" onConfirm={handleExcluir} onCancel={() => setConfirmExcluir(null)}/>
    </div>);
}
