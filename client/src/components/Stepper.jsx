import { MinusIcon, PlusIcon } from './Icon.jsx';

/**
 * Número com dois botões, no lugar do `input[type=number]`. As regras da
 * partida são todas de faixa curta — 1 a 20 rodadas, 5 a 180 segundos — e aí o
 * campo livre só oferece formas de errar: apagar tudo, digitar letra, colar um
 * 999. Aqui o limite é a própria borda, e o valor nunca sai da faixa.
 *
 * `off` é para a regra que existe mas não vale agora ("até acertar" desliga o
 * teto de chutes): apaga, mostra o valor substituto e o `hint` diz por quê.
 *
 * `onInfinite` põe o botão ∞ no canto: ligado, o valor vira ∞ (sem fim, sem
 * relógio, sem teto) e os botões de mais e menos descansam até desligar.
 */
export default function Stepper({
  label, icon, value, min = 1, max = 20, step = 1, suffix = '',
  hint, off = false, offValue = '∞', disabled = false, onChange,
  infinite = false, onInfinite = null,
}) {
  const locked = disabled || off || infinite;
  const clamp = (n) => Math.min(max, Math.max(min, n));

  return (
    <div className={`stepper ${off ? 'off' : ''} ${infinite ? 'inf' : ''}`}>
      <div className="k">
        {icon}{label}
        {onInfinite && (
          <button
            type="button"
            className={`inf-btn ${infinite ? 'on' : ''}`}
            aria-pressed={infinite}
            aria-label={`${label}: infinito`}
            title={infinite ? 'Voltar a ter limite' : 'Sem limite'}
            disabled={disabled || off}
            onClick={onInfinite}
          >
            ∞
          </button>
        )}
      </div>
      <div className="ctl">
        <button
          type="button"
          aria-label={`Menos ${label.toLowerCase()}`}
          disabled={locked || value <= min}
          onClick={() => onChange(clamp(value - step))}
        >
          <MinusIcon width={14} height={14} strokeWidth={2.4} />
        </button>
        <span className="v">{off ? offValue : infinite ? '∞' : `${value}${suffix}`}</span>
        <button
          type="button"
          aria-label={`Mais ${label.toLowerCase()}`}
          disabled={locked || value >= max}
          onClick={() => onChange(clamp(value + step))}
        >
          <PlusIcon width={14} height={14} strokeWidth={2.4} />
        </button>
      </div>
      {hint && <small>{hint}</small>}
    </div>
  );
}
