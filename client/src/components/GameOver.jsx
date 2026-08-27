import Reveal from './Reveal.jsx';
import { ExitIcon, RestartIcon, TrophyIcon } from './Icon.jsx';

/**
 * Placar final. O segredo vem primeiro porque e o que todo mundo quer ver;
 * o titulo (`summary`) e o placar, e `message` explica como a partida acabou.
 * O trofeu so aparece se alguem pontuou — coroar um 0 a 0 e estranho.
 */
export default function GameOver({ state, universe, myId, isHost, onRestart, onLeave }) {
  const ranking = [...state.players].sort((a, b) => b.score - a.score);
  const top = ranking[0]?.score ?? 0;
  const someoneScored = top > 0;

  return (
    <div className="gameover">
      <div className="crest">Fim de partida</div>
      <div className="card">
        {state.secret && <Reveal universe={universe} secret={state.secret} />}

        {someoneScored && <div className="trophy"><TrophyIcon /></div>}
        <h2>{state.summary ?? state.message}</h2>
        {state.summary && state.message && <p className="muted">{state.message}</p>}

        <ul className="ranking">
          {ranking.map((player, i) => (
            <li key={player.id} className={someoneScored && player.score === top ? 'top' : ''}>
              <span className="place">{i + 1}</span>
              <strong>{player.name}</strong>
              {player.id === myId && <span className="muted">(você)</span>}
              <span className="pts">{player.score} pts</span>
            </li>
          ))}
        </ul>

        <div className="game-actions">
          <button className="btn link" onClick={onLeave}>
            <ExitIcon width={16} height={16} /> Sair da sala
          </button>
          {isHost && (
            <button className="btn primary" onClick={onRestart}>
              <RestartIcon width={16} height={16} /> Jogar de novo
            </button>
          )}
        </div>
        {!isHost && <p className="muted">Esperando o host começar outra partida...</p>}
      </div>
    </div>
  );
}
