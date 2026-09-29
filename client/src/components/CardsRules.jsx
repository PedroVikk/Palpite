import Stepper from './Stepper.jsx';
import { CardsIcon } from './Icon.jsx';

/**
 * As cartas são uma chave da sala, não um modo: atravessam todos, como a
 * imagem. O que muda de um modo para outro é quando se usa a carta e quantos
 * drafts a partida tem — e o texto aqui diz isso, porque é o que a mesa
 * precisa saber antes de ligar.
 */
const HELP = {
  quiz: 'A cada poucas perguntas, cada um escolhe 1 de 3 cartas de efeito para usar antes de responder.',
  battle: 'Na largada da batalha, cada um escolhe 1 de 3 cartas de efeito para usar na sua vez.',
};
const DEFAULT_HELP = 'A cada poucas rodadas, cada um escolhe 1 de 3 cartas de efeito para usar na sua vez. Quem está em último tira cartas melhores.';

/** A chave das cartas, igual na criação da sala e na sala de espera. */
export function CardsSwitch({ on, mode, disabled = false, style, onToggle }) {
  return (
    <button
      type="button"
      className={`switch-row ${on ? 'on' : ''}`}
      disabled={disabled}
      style={style}
      onClick={onToggle}
    >
      <span className="ico"><CardsIcon width={18} height={18} /></span>
      <span className="txt">
        <b>Jogar com cartas</b>
        <small>{HELP[mode] ?? DEFAULT_HELP}</small>
      </span>
      <span className="switch"><i /></span>
    </button>
  );
}

/** De quantas em quantas rodadas sai um draft. A batalha é uma rodada só: um draft, na largada. */
export function DraftStepper({ value, mode, disabled = false, onChange }) {
  const quiz = mode === 'quiz';
  const unit = quiz ? (value === 1 ? ' pergunta' : ' perguntas') : (value === 1 ? ' rodada' : ' rodadas');
  return (
    <Stepper
      label="Draft a cada"
      icon={<CardsIcon width={14} height={14} />}
      value={value} min={1} max={5}
      suffix={unit}
      off={mode === 'battle'} offValue="1 só"
      hint={mode === 'battle' ? 'Na largada da batalha' : 'Cada um escolhe 1 de 3 cartas'}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
