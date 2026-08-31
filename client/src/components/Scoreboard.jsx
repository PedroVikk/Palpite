export default function Scoreboard({ state, myId }) {
  return (
    <ul className="scoreboard">
      {state.players.map(player => {
        // cadeira guardada: quem caiu ainda pode voltar enquanto a partida
        // roda. No fim de jogo nao ha o que esperar, e o placar e so placar
        const away = !player.connected && state.phase !== 'gameOver';
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
              {away
                ? 'vaga guardada'
                : state.phase === 'playing'
                  ? (player.guessesLeft === null ? '∞ chutes' : `${player.guessesLeft} chutes`)
                  : ' '}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
