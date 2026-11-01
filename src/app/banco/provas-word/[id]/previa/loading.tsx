import { LoaderCircle } from "lucide-react";
import css from "./Previa.module.css";

/** Enquanto o servidor carrega as questões e as figuras: tela cheia no mesmo fundo da pré-visualização. */
export default function CarregandoPrevia() {
  return (
    <div className={css.raiz}>
      <div className={css.carregando} role="status">
        <LoaderCircle size={36} aria-hidden="true" className={css.girar} />
        Montando a prova…
      </div>
    </div>
  );
}
