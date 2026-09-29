import Stepper from './Stepper.jsx';
import { CardsIcon } from './Icon.jsx';

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
