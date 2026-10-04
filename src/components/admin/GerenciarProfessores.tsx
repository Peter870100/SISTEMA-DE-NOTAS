"use client";

import { useState } from "react";
import { KeyRound, Pencil, School, Trash2, UserPlus } from "lucide-react";
import type { Professor, ProfessorRole } from "@/lib/types";
import {
  criarProfessor,
  definirSenhaProvisoria,
  excluirProfessor,
  atualizarAcessoTurmas,
  atualizarTelefoneProfessor,
} from "@/actions/professores";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { estilos } from "@/components/ui/estilos";
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

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={handleAdd}
        className={`${estilos.card} flex flex-col gap-3 p-4`}
      >
        <h2 className="font-display text-base font-semibold text-ink">
          Adicionar professor
        </h2>

        {erro && (
          <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome"
            className={`${estilos.input} min-w-40 flex-1`}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={`${estilos.input} min-w-48 flex-1`}
          />
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha inicial"
            className={`${estilos.input} min-w-40 flex-1`}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ProfessorRole)}
            className={estilos.input}
          >
            <option value="professor">Professor</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={salvando}
          className={estilos.botaoPrimario}
        >
          <UserPlus size={15} />
          {salvando ? "Criando..." : "Criar professor"}
        </button>
        <p className="text-xs text-muted">
          Depois de criar, use os botões &quot;Telefone&quot; e &quot;Turmas&quot; na tabela abaixo pra configurar o acesso dele.
        </p>
      </form>

      <div className={`${estilos.card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Nome</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Email</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Telefone</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Papel</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Status</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Ações</th>
            </tr>
          </thead>
          <tbody>
            {professores.map((p) => (
              <tr key={p.id} className="border-t border-line align-top">
                <td className="px-3 py-2 text-ink">
                  <div className="flex items-center gap-1.5">
                    <span
                      title={statusPresenca(p.ultimo_acesso).texto}
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        statusPresenca(p.ultimo_acesso).online
                          ? "bg-ok"
                          : "bg-faint"
                      }`}
                    />
                    {p.nome}
                  </div>
                  <p className="mt-0.5 pl-3 text-[11px] text-faint">
                    {statusPresenca(p.ultimo_acesso).texto}
                  </p>
                </td>
                <td className="px-3 py-2 text-muted">{p.email}</td>
                <td className="px-3 py-2">
                  {telefoneAbertoId === p.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        value={telefoneEdit}
                        onChange={(e) => setTelefoneEdit(e.target.value)}
                        autoFocus
                        placeholder="(00) 00000-0000"
                        className={`${estilos.input} w-32 px-2 py-1 text-xs`}
                      />
                      <button
                        type="button"
                        onClick={() => handleSalvarTelefone(p.id)}
                        disabled={salvandoTelefoneId === p.id}
                        className={`${estilos.botaoPrimario} min-h-0 px-2 py-1 text-xs`}
                      >
                        {salvandoTelefoneId === p.id ? "..." : "Salvar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTelefoneAbertoId(null)}
                        className="text-xs text-muted hover:text-ink"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAbrirTelefone(p)}
                      className="flex items-center gap-1 text-xs text-muted hover:text-brand-bright"
                    >
                      {p.telefone ?? "—"}
                      <Pencil size={11} />
                    </button>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      ehAdmin(p.role)
                        ? "bg-gold/40 text-gold-ink"
                        : "bg-surface-sunken text-muted"
                    }`}
                  >
                    {p.role}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        p.email_verificado
                          ? "bg-ok/10 text-ok"
                          : "bg-warn/10 text-warn"
                      }`}
                    >
                      {p.email_verificado ? "verificado" : "pendente"}
                    </span>
                    {p.senha_provisoria && (
                      <span className="rounded bg-brand-bright/10 px-1.5 py-0.5 text-xs font-medium text-brand-bright">
                        senha provisória
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {ehAdmin(p.role)
                      ? "todas as turmas"
                      : p.acesso_restrito
                        ? (acessoPorProfessor[p.id]?.length ?? 0) > 0
                          ? acessoPorProfessor[p.id].join(", ")
                          : "nenhuma turma"
                        : "todas as turmas"}
                  </p>
                </td>
                <td className="px-3 py-2">
                  {senhaAbertaId === p.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="password"
                        value={novaSenhaProvisoria}
                        onChange={(e) => setNovaSenhaProvisoria(e.target.value)}
                        autoFocus
                        placeholder="Nova senha"
                        className={`${estilos.input} w-32 px-2 py-1 text-xs`}
                      />
                      <button
                        type="button"
                        onClick={() => handleDefinirSenha(p.id)}
                        disabled={definindoId === p.id}
                        className={`${estilos.botaoPrimario} min-h-0 px-2 py-1 text-xs`}
                      >
                        {definindoId === p.id ? "Salvando..." : "Salvar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSenhaAbertaId(null)}
                        className="text-xs text-muted hover:text-ink"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : turmasAbertaId === p.id ? (
                    <div className="flex w-56 flex-col gap-2 rounded-control border border-line bg-surface-sunken p-2">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
                        <input
                          type="checkbox"
                          checked={restritoEdit}
                          onChange={(e) => setRestritoEdit(e.target.checked)}
                        />
                        Restringir a turmas específicas
                      </label>
                      {restritoEdit && (
                        <div className="flex flex-col gap-1 border-t border-line pt-1.5">
                          {nomesTurmas.map((t) => (
                            <label key={t} className="flex items-center gap-1.5 text-xs text-muted">
                              <input
                                type="checkbox"
                                checked={turmasSelecionadas.has(t)}
                                onChange={() => toggleTurma(t)}
                              />
                              {t}
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSalvarTurmas(p.id)}
                          disabled={salvandoTurmasId === p.id}
                          className={`${estilos.botaoPrimario} min-h-0 px-2 py-1 text-xs`}
                        >
                          {salvandoTurmasId === p.id ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTurmasAbertaId(null)}
                          className="text-xs text-muted hover:text-ink"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleAbrirSenha(p.id)}
                        className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                      >
                        <KeyRound size={12} />
                        Senha provisória
                      </button>
                      {!ehAdmin(p.role) && (
                        <button
                          type="button"
                          onClick={() => handleAbrirTurmas(p)}
                          className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                        >
                          <School size={12} />
                          Turmas
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmExcluir(p)}
                        disabled={excluindoId === p.id}
                        className="flex items-center gap-1 text-xs font-medium text-danger hover:underline disabled:opacity-50"
                      >
                        <Trash2 size={12} />
                        {excluindoId === p.id ? "Excluindo..." : "Excluir"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmExcluir !== null}
        title="Excluir professor"
        message={`Tem certeza que deseja excluir "${confirmExcluir?.nome}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleExcluir}
        onCancel={() => setConfirmExcluir(null)}
      />
    </div>
  );
}
