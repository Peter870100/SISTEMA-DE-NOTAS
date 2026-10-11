import css from "./ProgressoCurso.module.css";

export function ProgressoCurso({ porcentagem, rotulo }: { porcentagem: number; rotulo: string }) {
  return (
    <div className={css.resumo}>
      <div className={css.trilha} role="progressbar" aria-label={rotulo} aria-valuenow={porcentagem} aria-valuemin={0} aria-valuemax={100}>
        <div className={css.preenchimento} style={{ width: `${porcentagem}%` }} />
      </div>
      <span className={css.percentual} aria-hidden="true"><strong>{porcentagem}</strong><span>%</span></span>
    </div>
  );
}
