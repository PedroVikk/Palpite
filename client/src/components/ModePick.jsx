import { AnchorIcon, CardsIcon, MaskIcon, QuestionIcon, SearchIcon, SwordsIcon } from './Icon.jsx';

const MODES = [
  {
    id: 'hunt',
    label: 'Caça ao segredo',
    help: 'Ninguém sabe o segredo. Todo mundo adivinha junto.',
    Icon: SearchIcon,
  },
  {
    id: 'duel',
    label: 'Duelo',
    help: 'Um jogador sorteado esconde, o resto adivinha.',
    Icon: SwordsIcon,
  },
  {
    id: 'impostor',
    label: 'Impostor',
    help: 'Todos sabem o segredo, menos um. Chute sem entregar.',
    Icon: MaskIcon,
  },
  {
    id: 'battle',
    label: 'Batalha naval',
    help: 'Cada um esconde o seu e ataca o dos outros. Fica quem sobra.',
    Icon: AnchorIcon,
  },
  {
    id: 'quiz',
    label: 'Qual deles?',
    help: 'Uma pergunta, algumas opções, todos respondem juntos. Rapidez pontua.',
    Icon: QuestionIcon,
  },
  {
    id: 'cards',
    label: 'Cartas',
    help: 'Caça ao segredo com draft de cartas de efeito a cada poucas rodadas.',
    Icon: CardsIcon,
  },
];

/** Os modos de jogo, iguais na criação da sala e na sala de espera. */
export default function ModePick({ value, disabled = false, onChange }) {
  return (
    <div className="mode-pick">
      {MODES.map(({ id, label, help, Icon }) => (
        <button
          key={id}
          type="button"
          className={value === id ? 'on' : ''}
          disabled={disabled}
          onClick={() => onChange(id)}
        >
          <span className="ico"><Icon width={17} height={17} /></span>
          <span>
            <b>{label}</b>
            <small>{help}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
