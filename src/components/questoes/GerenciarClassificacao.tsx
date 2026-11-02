"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import type { GerenciamentoClassificacao } from "@/lib/questoes/classificacao-pagina";
import type { Assunto } from "@/lib/types";
import { HabilidadesPorArea } from "./HabilidadesPorArea";
import { TopicosPorAssunto } from "./TopicosPorAssunto";
import styles from "./GerenciarClassificacao.module.css";

/** Roda uma ação do servidor, mostra o aviso (ou o erro) e atualiza a página. Devolve se deu certo. */
export type Executar = (acao: () => Promise<unknown>, aviso: string) => Promise<boolean>;

type Props = {
  aba: "topicos" | "habilidades";
  assuntos: Assunto[];
  dados: GerenciamentoClassificacao;
};

/** Tópicos por assunto e habilidades por área (só o dono). As mensagens acompanham a rolagem, para não ficarem fora da tela. */
export function GerenciarClassificacao({ aba, assuntos, dados }: Props) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const executar: Executar = async (acao, mensagem) => {
    setErro(null); setAviso(null); setOcupado(true);
    try {
      await acao();
      setAviso(mensagem);
      router.refresh();
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha.");
      return false;
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {(erro || aviso) && (
        <div className={styles.mensagens}>
          {erro && (
            <p role="alert" className={styles.mensagem}><span>{erro}</span>
              <button type="button" aria-label="Fechar aviso" onClick={() => setErro(null)} className={styles.fechar}><X size={16} aria-hidden="true" /></button></p>
          )}
          {aviso && (
            <p role="status" className={styles.mensagem}><span>{aviso}</span>
              <button type="button" aria-label="Fechar aviso" onClick={() => setAviso(null)} className={styles.fechar}><X size={16} aria-hidden="true" /></button></p>
          )}
        </div>
      )}
      {aba === "topicos"
        ? <TopicosPorAssunto assuntos={assuntos} dados={dados} executar={executar} ocupado={ocupado} />
        : <HabilidadesPorArea habilidades={dados.habilidades} executar={executar} ocupado={ocupado} />}
    </div>
  );
}
