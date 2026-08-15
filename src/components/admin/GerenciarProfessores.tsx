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

  async function handleExcluir(p: Professor) {
    if (excluindoId) return;
    if (!window.confirm(`Excluir ${p.nome}? Essa ação não pode ser desfeita.`)) return;
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
    <div className="mt-6 flex flex-col gap-5">
      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Adicionar professor
        </h2>

        {erro && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome"
            className="min-w-40 flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="min-w-48 flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha inicial"
            className="min-w-40 flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ProfessorRole)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="professor">Professor</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={salvando}
          className="flex w-fit items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/40 disabled:opacity-50 disabled:shadow-none"
        >
          <UserPlus size={15} />
          {salvando ? "Criando..." : "Criar professor"}
        </button>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Depois de criar, use os botões "Telefone" e "Turmas" na tabela abaixo pra configurar o acesso dele.
        </p>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Nome</th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Email</th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Telefone</th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Papel</th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Status</th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Ações</th>
            </tr>
          </thead>
          <tbody>
            {professores.map((p) => (
              <tr key={p.id} className="border-t border-neutral-200 dark:border-neutral-800 align-top">
                <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">
                  <div className="flex items-center gap-1.5">
                    <span
                      title={statusPresenca(p.ultimo_acesso).texto}
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        statusPresenca(p.ultimo_acesso).online
                          ? "bg-emerald-500"
                          : "bg-neutral-300 dark:bg-neutral-600"
                      }`}
                    />
                    {p.nome}
                  </div>
                  <p className="mt-0.5 pl-3 text-[11px] text-neutral-400 dark:text-neutral-500">
                    {statusPresenca(p.ultimo_acesso).texto}
                  </p>
                </td>
                <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{p.email}</td>
                <td className="px-3 py-2">
                  {telefoneAbertoId === p.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        value={telefoneEdit}
                        onChange={(e) => setTelefoneEdit(e.target.value)}
                        autoFocus
                        placeholder="(00) 00000-0000"
                        className="w-32 rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
                      />
                      <button
                        type="button"
                        onClick={() => handleSalvarTelefone(p.id)}
                        disabled={salvandoTelefoneId === p.id}
                        className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {salvandoTelefoneId === p.id ? "..." : "Salvar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTelefoneAbertoId(null)}
                        className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAbrirTelefone(p)}
                      className="flex items-center gap-1 text-xs text-neutral-500 hover:text-blue-600 dark:text-neutral-400"
                    >
                      {p.telefone ?? "—"}
                      <Pencil size={11} />
                    </button>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      p.role === "admin"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
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
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                      }`}
                    >
                      {p.email_verificado ? "verificado" : "pendente"}
                    </span>
                    {p.senha_provisoria && (
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                        senha provisória
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {p.role === "admin"
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
                        className="w-32 rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
                      />
                      <button
                        type="button"
                        onClick={() => handleDefinirSenha(p.id)}
                        disabled={definindoId === p.id}
                        className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {definindoId === p.id ? "Salvando..." : "Salvar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSenhaAbertaId(null)}
                        className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : turmasAbertaId === p.id ? (
                    <div className="flex w-56 flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-800">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={restritoEdit}
                          onChange={(e) => setRestritoEdit(e.target.checked)}
                        />
                        Restringir a turmas específicas
                      </label>
                      {restritoEdit && (
                        <div className="flex flex-col gap-1 border-t border-neutral-200 pt-1.5 dark:border-neutral-700">
                          {nomesTurmas.map((t) => (
                            <label key={t} className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
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
                          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {salvandoTurmasId === p.id ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTurmasAbertaId(null)}
                          className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
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
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      >
                        <KeyRound size={12} />
                        Senha provisória
                      </button>
                      {p.role !== "admin" && (
                        <button
                          type="button"
                          onClick={() => handleAbrirTurmas(p)}
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                        >
                          <School size={12} />
                          Turmas
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleExcluir(p)}
                        disabled={excluindoId === p.id}
                        className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline disabled:opacity-50"
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
    </div>
  );
}
