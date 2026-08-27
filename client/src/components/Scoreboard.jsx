export default function Scoreboard({ state, myId }) {
  return (
    <ul className="scoreboard">
      {state.players.map(player => {
        const classes = [
          player.id === state.turnPlayerId ? 'turn' : '',
          player.id === state.chooserId ? 'chooser' : '',
          player.connected ? '' : 'gone',
        ].filter(Boolean).join(' ');

        return (
          <li key={player.id} className={classes}>
            <span className="who">
              <span className={`dot ${player.connected ? '' : 'off'}`} />
              {player.name}
              {player.id === myId && <span className="muted">(você)</span>}
            </span>
            <span className="score">{player.score} <small>pts</small></span>
            <span className="left">
              {state.phase === 'playing'
                ? (player.guessesLeft === null ? '∞ chutes' : `${player.guessesLeft} chutes`)
                : ' '}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
