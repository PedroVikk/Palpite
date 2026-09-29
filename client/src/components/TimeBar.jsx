/**
 * A barra de tempo colada no campo de chute: esvazia na largura dele e vai de
 * verde a amarelo e a vermelho, para o olho nao sair de onde a pessoa digita.
 * Nos ultimos 5 s o numero cresce e a barra pulsa (o CSS desliga o movimento
 * com prefers-reduced-motion ou com o piscar desligado).
 */
export default function TimeBar({ left, total, mine, still = false }) {
  if (left === null || !total) return null;
  const ratio = Math.max(0, Math.min(1, left / total));
  const tone = ratio > 0.5 ? 'ok' : ratio > 0.2 ? 'warn' : 'bad';
  const last = left > 0 && left <= 5;
  return (
    <div
      className={`timebar ${tone} ${last ? 'last' : ''} ${mine ? 'mine' : ''} ${still ? 'still' : ''}`}
      role="progressbar"
      aria-label="Tempo do turno"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={left}
    >
      <div className="track"><i style={{ width: `${ratio * 100}%` }} /></div>
      <b className="num">{left}s</b>
    </div>
  );
}
