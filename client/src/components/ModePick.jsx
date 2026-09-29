import { AnchorIcon, BoltIcon, MaskIcon, QuestionIcon, SearchIcon, SwordsIcon, TargetIcon, TermoIcon } from './Icon.jsx';

/** O modo de jogo: o que se adivinha. O segredo e o de sempre, e vem marcado. */
const GAMES = [
  {
    id: 'segredo',
    label: 'Segredo',
    help: 'Um nome do tema, descoberto pela tabela de dicas ou pela imagem.',
    Icon: TargetIcon,
  },
  {
    id: 'termo',
    label: 'Termo',
    help: 'Uma palavra do tema, letra por letra: um nome ou algo como Kunai e Konoha.',
    Icon: TermoIcon,
  },
];

/**
 * Os estilos de jogo: como a mesa joga. `termo` e o texto do estilo no modo
 * Termo; estilo sem ele nao existe la (ver TERMO_STYLES em src/game.js), e
 * `off` diz por que.
 */
const STYLES = [
  {
    id: 'hunt',
    label: 'Caça ao segredo',
    help: 'Ninguém sabe o segredo. Todo mundo adivinha junto.',
    termo: 'Todos correm atrás da mesma palavra ao mesmo tempo, cada um no seu tabuleiro.',
    Icon: SearchIcon,
  },
  {
    id: 'duel',
    label: 'Duelo',
    help: 'Um jogador sorteado esconde, o resto adivinha.',
    termo: 'Um jogador escolhe a palavra, o resto corre atrás dela.',
    Icon: SwordsIcon,
  },
  {
    id: 'impostor',
    label: 'Impostor',
    help: 'Todos sabem o segredo, menos um. Chute sem entregar.',
    off: 'Só no Segredo: no Termo não há colunas para contar acertos.',
    Icon: MaskIcon,
  },
  {
    id: 'battle',
    label: 'Batalha naval',
    help: 'Cada um esconde o seu e ataca o dos outros. Fica quem sobra.',
    termo: 'Cada um esconde uma palavra e ataca a dos outros, na sua vez. Fica quem sobra.',
    Icon: AnchorIcon,
  },
  {
    id: 'quiz',
    label: 'Qual deles?',
    help: 'Uma pergunta, algumas opções, todos respondem juntos. Rapidez pontua.',
    off: 'Só no Segredo: a pergunta é de múltipla escolha, não de letras.',
    Icon: QuestionIcon,
  },
  {
    id: 'speed',
    label: 'Velocidade',
    help: 'Cada um no seu tabuleiro, com uma fila de segredos. Quem terminar primeiro vence.',
    termo: 'Cada um no seu tabuleiro, com uma fila de palavras. Quem terminar primeiro vence.',
    Icon: BoltIcon,
  },
];

/** Se o estilo existe no modo escolhido. */
export const styleFits = (game, style) =>
  game !== 'termo' || Boolean(STYLES.find(s => s.id === style)?.termo);

function Options({ list, value, disabled, onChange }) {
  return (
    <div className="mode-pick">
      {list.map(({ id, label, help, Icon, locked }) => (
        <button
          key={id}
          type="button"
          className={value === id ? 'on' : ''}
          disabled={disabled || locked}
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

/** O modo de jogo (Segredo ou Termo), igual na criação da sala e na sala de espera. */
export function GamePick({ value, disabled = false, onChange }) {
  return <Options list={GAMES} value={value} disabled={disabled} onChange={onChange} />;
}

/** Os estilos de jogo, com o texto e as travas do modo escolhido. */
export default function ModePick({ value, game = 'segredo', disabled = false, onChange }) {
  const termo = game === 'termo';
  const list = STYLES.map(style => ({
    ...style,
    help: termo ? style.termo ?? style.off : style.help,
    locked: termo && !style.termo,
  }));
  return <Options list={list} value={value} disabled={disabled} onChange={onChange} />;
}
