import { scopeLabel } from '@shared/universes.js';
import { universeMeta } from '../lib/universeMeta.js';
import Avatar from './Avatar.jsx';
import {
  ChartIcon, CheckIcon, ClockIcon, ExitIcon, MinusIcon, TargetIcon, UsersIcon,
} from './Icon.jsx';

/** Volta do 0 ao 1 para o anel do painel; sem teto de chutes o anel fica cheio. */
function Dial({ used, total }) {
  const ratio = total ? Math.min(1, used / total) : 1;
  const dash = 106.8;   // 2πr com r = 17, o raio do círculo abaixo
  return (
    <div className="dial">
      <svg viewBox="0 0 42 42" width="78" height="78" aria-hidden="true">
        <circle cx="21" cy="21" r="17" fill="none" stroke="#FFFFFF14" strokeWidth="5" />
        <circle
          cx="21" cy="21" r="17" fill="none"
          stroke="var(--purple)" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${(ratio * dash).toFixed(1)} ${dash}`}
          transform="rotate(-90 21 21)"
        />
      </svg>
      <div className="num">
        <b>{used}</b>
        <small>{total ? `de ${total}` : 'chutes'}</small>
      </div>
    </div>
  );
}

/**
 * Os três painéis da direita. Tudo aqui sai do estado que o servidor já manda —
 * nenhum número é estimado, porque um placar que erra por conta própria é pior
 * do que não existir.
 */
export default function GameSidebar({ state, myId, universe, onLeave }) {
  const me = state.players.find(p => p.id === myId);
  const ranking = [...state.players].sort((a, b) => b.score - a.score);
  const place = ranking.findIndex(p => p.id === myId) + 1;

  const myRows = state.rows.filter(row => row.playerId === myId);
  const budget = state.settings.guessesPerPlayer;   // 0 = "até acertar"
  const used = budget ? Math.max(0, budget - (me?.guessesLeft ?? 0)) : myRows.length;

  const meta = universeMeta(universe.id);
  const groups = universe.groups.filter(g => state.settings.groups.includes(g.id));
  const epocas = universe.scope ? scopeLabel(universe, state.settings.scope) : null;

  const nextUp = state.players.find(p => p.id === state.turnPlayerId);

  return (
    <aside className="side">
      <section className="card">
        <h3><ChartIcon width={13} height={13} strokeWidth={2.2} />Seu desempenho</h3>
        <div className="perf">
          <Dial used={used} total={budget} />
          <ul>
            <li className="ok">
              <span className="ic"><CheckIcon width={14} height={14} strokeWidth={2.8} /></span>
              <b>{me?.score ?? 0}</b> pontos na partida
            </li>
            <li className="na">
              <span className="ic"><TargetIcon width={14} height={14} strokeWidth={2.4} /></span>
              <b>{myRows.length}</b> {myRows.length === 1 ? 'chute nesta rodada' : 'chutes nesta rodada'}
            </li>
            <li className="no">
              <span className="ic"><MinusIcon width={14} height={14} strokeWidth={2.8} /></span>
              <b>{place || '—'}º</b> de {state.players.length} no placar
            </li>
          </ul>
        </div>
        <div className="perf-foot">
          <span>Chutes restantes</span>
          <b>{budget ? `${me?.guessesLeft ?? 0} de ${budget}` : 'sem limite'}</b>
        </div>
      </section>

      {/* o cerco da sala: dá para esquecer que só a Gen 1 está valendo */}
      <section className="card">
        <h3><ClockIcon width={13} height={13} strokeWidth={2.2} />Nesta rodada</h3>
        <div className="hint-body">
          O segredo sai de <b>{universe.label}</b>
          {epocas ? <> — {universe.scope.label.toLowerCase()}: <b>{epocas}</b></> : null}.
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          <span className="chip on" style={{ background: meta.gradient, borderColor: 'transparent', color: '#fff' }}>
            {universe.label}
          </span>
          {groups.map(group => <span key={group.id} className="chip">{group.label}</span>)}
        </div>
      </section>

      <section className="card">
        <h3>
          <UsersIcon width={13} height={13} strokeWidth={2.2} />
          {state.phase === 'choosing' ? 'Escolhendo' : 'Próximo turno'}
          <span className="n">rodada {state.round}/{state.settings.rounds}</span>
        </h3>
        <ul className="queue">
          {state.players.map(player => {
            const isTurn = player.id === state.turnPlayerId && state.phase === 'playing';
            const isChooser = player.id === state.chooserId;
            return (
              <li
                key={player.id}
                className={[
                  isTurn ? 'now' : '',
                  isChooser ? 'chooser' : '',
                  player.connected ? '' : 'gone',
                ].filter(Boolean).join(' ')}
              >
                <Avatar name={player.name} size="sm" />
                <span className="nm">
                  {player.name}
                  {player.id === myId && <small> (você)</small>}
                  {!player.connected && <small> · caiu</small>}
                </span>
                <span className="pts">{player.score}</span>
                {isTurn && <span className="state">Agora</span>}
                {isChooser && !isTurn && <span className="state">Escondeu</span>}
              </li>
            );
          })}
        </ul>
        {nextUp && state.phase === 'playing' && (
          <p className="f-help" style={{ marginTop: 10 }}>
            Vez de <b>{nextUp.name}</b>. Quem acerta primeiro fecha a rodada.
          </p>
        )}
      </section>

      <div className="exit">
        <button className="btn link" onClick={onLeave}>
          <ExitIcon width={15} height={15} /> Sair da sala
        </button>
      </div>
    </aside>
  );
}
