import { ExitIcon, RestartIcon, TrophyIcon } from './Icon.jsx';

/**
 * Placar final. O texto do titulo vem pronto do servidor — ele ja sabe se
 * houve vitoria, empate ou se ninguem pontuou.
 */
export default function GameOver({ state, myId, isHost, onRestart, onLeave }) {
  const ranking = [...state.players].sort((a, b) => b.score - a.score);
  const top = ranking[0]?.score ?? 0;

  return (
    <div className="gameover">
      <div className="crest">Fim de partida</div>
      <div className="card">
        <div className="trophy"><TrophyIcon /></div>
        <h2>{state.message}</h2>

        <ul className="ranking">
          {ranking.map((player, i) => (
            <li key={player.id} className={player.score === top && top > 0 ? 'top' : ''}>
              <span className="place">{i + 1}</span>
              <strong>{player.name}</strong>
              {player.id === myId && <span className="muted">(você)</span>}
              <span className="pts">{player.score} pts</span>
            </li>
          ))}
        </ul>

        <div className="chips" style={{ justifyContent: 'center', marginTop: 'var(--sp-md)' }}>
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
