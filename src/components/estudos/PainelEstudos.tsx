import Link from "next/link";
import type { ItemListaEstudo, ListaEstudos } from "@/lib/estudos/dados";
import { MATERIAS } from "@/lib/questoes/materias";
import css from "./Painel.module.css";

export type FiltroEstudos = "avisos" | "retidos" | "fotos" | "amostra";

export const FILTROS: { id: FiltroEstudos; rotulo: string; vale: (i: ItemListaEstudo) => boolean }[] = [
  { id: "avisos", rotulo: "Avisos de erro", vale: (i) => i.avisos > 0 },
  { id: "retidos", rotulo: "Retidos", vale: (i) => i.retidos > 0 },
  { id: "fotos", rotulo: "Fotos para aprovar", vale: (i) => i.fotos > 0 },
  { id: "amostra", rotulo: "Amostra para ler", vale: (i) => i.amostraPendente },
];

const rotuloSituacao: Record<string, string> = { rascunho: "Rascunho", retido: "Retido", em_conferencia: "Em conferência" };

/** Lista de estudos por matéria. O dono vê também os contadores, os filtros e as pendências de cada assunto. */
export function PainelEstudos({ lista, dono, filtro }: { lista: ListaEstudos; dono: boolean; filtro: FiltroEstudos | null }) {
  const ativo = filtro ? FILTROS.find((f) => f.id === filtro) : undefined;
  const itens = ativo ? lista.itens.filter(ativo.vale) : lista.itens;
  const porMateria = new Map<string, ItemListaEstudo[]>();
  for (const i of itens) porMateria.set(i.materia, [...(porMateria.get(i.materia) ?? []), i]);

  return (
    <div className={css.pagina}>
      {dono && (
        <nav aria-label="Filtros" className={css.filtros}>
          <Link href="/banco/estudos" className={css.filtro} aria-current={!ativo ? "true" : undefined}>Todos</Link>
          {FILTROS.map((f) => (
            <Link key={f.id} href={`/banco/estudos?filtro=${f.id}`} className={css.filtro} aria-current={ativo?.id === f.id ? "true" : undefined}>
              {f.rotulo}<b>{lista.contadores[f.id]}</b>
            </Link>
          ))}
        </nav>
      )}
      {itens.length === 0 && <p className={css.vazio}>{ativo ? "Nada nesta lista." : "Ainda não há estudos no ar."}</p>}
      {[...porMateria.entries()].map(([materia, doGrupo]) => (
        <section key={materia} className={css.materia} aria-label={(MATERIAS as Record<string, { rotulo: string }>)[materia]?.rotulo ?? materia}>
          <h2>{(MATERIAS as Record<string, { rotulo: string }>)[materia]?.rotulo ?? materia}</h2>
          <ul className={css.lista}>
            {doGrupo.map((i) => (
              <li key={i.assuntoId}>
                <Link href={`/banco/estudos/${i.assuntoId}`} className={css.item}>
                  {i.nome}
                  {dono && i.situacao && i.situacao !== "publicado" && <span className={css.selo} data-tom="ouro">{rotuloSituacao[i.situacao]}</span>}
                  {dono && i.avisos > 0 && <span className={css.selo} data-tom="alerta">{i.avisos} aviso(s)</span>}
                  {dono && i.retidos > 0 && i.situacao !== "retido" && <span className={css.selo} data-tom="ouro">Retido</span>}
                  {dono && i.fotos > 0 && <span className={css.selo}>{i.fotos} foto(s)</span>}
                  {dono && i.amostraPendente && <span className={css.selo}>Para ler</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
