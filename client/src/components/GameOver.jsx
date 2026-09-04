import Avatar from './Avatar.jsx';
import Reveal from './Reveal.jsx';
import {
  CalendarIcon, ExitIcon, RestartIcon, TargetIcon, TrophyIcon, UsersIcon,
} from './Icon.jsx';

const ORDINAL = ['1º', '2º', '3º'];

/**
 * Placar final. O segredo vem primeiro porque e o que todo mundo quer ver; o
 * pódio dá a leitura de um segundo, e o ranking completo logo abaixo tem a
 * barra — a diferença de pontos vira distância, que se lê sem contar.
 *
 * Trofeu e pódio só aparecem se alguem pontuou: coroar um 0 a 0 e estranho.
 */
export default function GameOver({ state, universe, myId, isHost, onRestart, onLeave }) {
  const ranking = [...state.players].sort((a, b) => b.score - a.score);
  const top = ranking[0]?.score ?? 0;
  const someoneScored = top > 0;
  const champion = someoneScored ? ranking[0] : null;

  // o pódio é uma figura de três degraus: com menos gente ele vira um gráfico
  // torto, e o ranking logo abaixo já conta a mesma história
  const podium = someoneScored && ranking.length >= 3
    ? [ranking[1], ranking[0], ranking[2]]
    : null;

  return (
    <>
      <span className="crest">Fim de partida</span>

      {state.secret && (
        <Reveal universe={universe} secret={state.secret} caption="O segredo da última rodada era" />
      )}

      <section className="result">
        {someoneScored && <div className="trophy"><TrophyIcon /></div>}
        <h2>{state.summary ?? state.message}</h2>
        {state.summary && state.message && <p>{state.message}</p>}
      </section>

      {podium && (
        <section className="podium">
          {podium.map((player, i) => {
            const place = i === 1 ? 0 : (i === 0 ? 1 : 2);
            return (
              <div key={player.id} className={`step ${i === 1 ? 'first' : ''}`}>
                <span className="place">{ORDINAL[place]}</span>
                <Avatar name={player.name} size={i === 1 ? 'lg' : ''} />
                <span className="nm">
                  {player.name}
                  <small>{player.id === myId ? '(você)' : ' '}</small>
                </span>
                <span className="pts">{player.score}</span>
              </div>
            );
          })}
        </section>
      )}

      <section className="card">
        <h3>
          <UsersIcon width={13} height={13} strokeWidth={2.2} />
          Classificação final
          <span className="n">{state.players.length} {state.players.length === 1 ? 'jogador' : 'jogadores'}</span>
        </h3>
        <ul className="rank">
          {ranking.map((player, i) => (
            <li
              key={player.id}
              className={[
                someoneScored && player.score === top ? 'top' : '',
                player.id === myId ? 'me' : '',
                player.connected ? '' : 'gone',
              ].filter(Boolean).join(' ')}
            >
              <span className="pos">{i + 1}</span>
              <Avatar name={player.name} size="sm" />
              <span className="nm">
                {player.name}
                {player.id === myId && <small> (você)</small>}
                {!player.connected && <small> · saiu</small>}
              </span>
              <span className="bar">
                <i style={{ width: `${top ? Math.max(4, (player.score / top) * 100) : 0}%` }} />
              </span>
              <span className="pts">{player.score}<small>pts</small></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="summary">
        <div className="tile">
          <div className="k"><CalendarIcon width={14} height={14} />Rodadas</div>
          <div className="v">{state.settings.rounds}</div>
        </div>
        <div className="tile">
          <div className="k"><TargetIcon width={14} height={14} />Chutes na última</div>
          <div className="v">{state.rows.length}</div>
        </div>
        <div className="tile">
          <div className="k"><UsersIcon width={14} height={14} />Jogadores</div>
          <div className="v">{state.players.length}</div>
        </div>
        <div className="tile">
          <div className="k"><TrophyIcon width={14} height={14} strokeWidth={2} />Campeão</div>
          <div className="v" style={{ fontSize: 18 }}>{champion?.name ?? '—'}</div>
        </div>
      </section>

      <div className="game-actions">
        <button className="btn link" onClick={onLeave}>
          <ExitIcon width={16} height={16} /> Sair da sala
        </button>
        {isHost && (
          <button className="btn primary lg" onClick={onRestart}>
            <RestartIcon width={16} height={16} /> Jogar de novo
          </button>
        )}
      </div>
      {!isHost && <p className="muted center-text">Esperando o host começar outra partida...</p>}
    </>
  );
}
