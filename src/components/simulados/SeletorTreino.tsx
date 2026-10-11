"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import css from "./SeletorTreino.module.css";

type Opcao = { value: string; label: string };

export function SeletorTreino({ id, value, options, onChange }: {
  id: string;
  value: string;
  options: Opcao[];
  onChange: (value: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const botao = useRef<HTMLButtonElement>(null);
  const busca = useRef({ texto: "", tempo: 0 });
  const selecionado = Math.max(0, options.findIndex((opcao) => opcao.value === value));

  function destacar(index: number) {
    const proximo = Math.max(0, Math.min(options.length - 1, index));
    setAtivo(proximo);
    requestAnimationFrame(() => document.getElementById(`${id}-opcao-${proximo}`)?.scrollIntoView({ block: "nearest" }));
  }

  function escolher(index: number) {
    onChange(options[index].value);
    setAberto(false);
    botao.current?.focus();
  }

  function teclado(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Tab") { setAberto(false); return; }
    if (e.key === "Escape") { e.preventDefault(); setAberto(false); return; }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (aberto) escolher(ativo);
      else { setAberto(true); destacar(selecionado); }
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      setAberto(true);
      destacar(e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : aberto ? ativo + (e.key === "ArrowDown" ? 1 : -1) : selecionado);
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const agora = Date.now();
      const texto = (agora - busca.current.tempo < 700 ? busca.current.texto : "") + e.key.toLocaleLowerCase("pt-BR");
      busca.current = { texto, tempo: agora };
      const index = options.findIndex((opcao) => opcao.label.toLocaleLowerCase("pt-BR").startsWith(texto));
      if (index >= 0) { e.preventDefault(); setAberto(true); destacar(index); }
    }
  }

  return (
    <div className={css.seletor} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false); }}>
      <button ref={botao} id={id} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={aberto}
        aria-controls={`${id}-lista`} aria-labelledby={`${id}-rotulo`}
        aria-activedescendant={aberto ? `${id}-opcao-${ativo}` : undefined}
        className={css.botao} onKeyDown={teclado}
        onClick={() => { setAberto(!aberto); destacar(selecionado); }}>
        <span>{options[selecionado].label}</span>
        <ChevronDown size={18} aria-hidden="true" className={css.seta} />
      </button>
      {aberto && (
        <ul id={`${id}-lista`} role="listbox" aria-labelledby={`${id}-rotulo`} className={css.lista}>
          {options.map((opcao, index) => (
            <li key={opcao.value} id={`${id}-opcao-${index}`} role="option" aria-selected={opcao.value === value}
              data-ativo={index === ativo} className={css.opcao}
              onMouseEnter={() => setAtivo(index)} onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(index)}>
              <span>{opcao.label}</span>
              {opcao.value === value && <Check size={17} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
