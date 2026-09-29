import { scopeLabel } from '@shared/universes.js';
import {
  SCORE_BATTLE_SURVIVOR, SCORE_CHOOSER_SURVIVED, SCORE_CREW_WINS, SCORE_IMPOSTOR_WINS, SCORE_RIGHT_VOTE,
  SCORE_SPEED_EACH, SCORE_SPEED_WIN, scoreForTermo, scoreForWin,
} from '@shared/score.js';
import { universeMeta } from '../lib/universeMeta.js';
import Avatar from './Avatar.jsx';
import AlertPrefs from './AlertPrefs.jsx';
import TurnActions from './TurnActions.jsx';
import {
  AccessIcon, ChartIcon, CheckIcon, ClockIcon, ExitIcon, MinusIcon, TargetIcon, UsersIcon,
} from './Icon.jsx';

/** Volta do 0 ao 1 para o anel do painel; sem teto de chutes o anel fica cheio. */
function Dial({ used, total }) {
  const ratio = total ? Math.min(1, used / total) : 1;
  const dash = 106.8;   // 2πr com r = 17, o raio do círculo abaixo
  return (
    <div className="dial">
      <svg viewBox="0 0 42 42" width="78" height="78" aria-hidden="true">
        <circle cx="21" cy="21" r="17" fill="none" stroke="var(--line-2)" strokeWidth="5" />
        <circle
          cx="21" cy="21" r="17" fill="none"
          stroke="var(--select)" strokeWidth="5" strokeLinecap="round"
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
 * Quanto a próxima jogada vale, em pontos, no modo da sala. A conta é a mesma
 * do servidor (shared/score.js): o número aqui é o que ele vai pagar, não um
 * palpite da tela. Onde o valor depende do que ainda não se sabe (a rapidez
 * no "Qual deles?", o tabuleiro que será afundado), vai a faixa.
 */
function prizeOf(state, myId) {
  const { mode, game } = state.settings;
  // a Aposta de pé dobra o acerto (ver settleBets no servidor)
  const bet = state.myBet ? ' com a Aposta' : '';
  const double = (n) => (state.myBet ? n * 2 : n);

  if (mode === 'speed') {
    return { label: 'Cada acerto · terminar primeiro', value: `+${SCORE_SPEED_EACH} · +${SCORE_SPEED_WIN}` };
  }
  if (mode === 'impostor') {
    if (state.role === 'impostor') return { label: 'Se você escapar da votação', value: `+${SCORE_IMPOSTOR_WINS}` };
    return { label: 'Pegando o impostor (votando nele)', value: `+${SCORE_CREW_WINS} (+${SCORE_RIGHT_VOTE})` };
  }
  if (mode === 'quiz') {
    return { label: `Acertando a pergunta${bet}, quanto antes melhor`, value: `+${double(50)} a +${double(100)}` };
  }
  if (mode === 'battle') {
    // o melhor tabuleiro de pé para afundar: o que tem menos tiros gastos
    const alive = state.cast.filter(id => id !== myId && !state.sunk?.[id]);
    const best = Math.max(0, ...alive.map(id => scoreForWin(state.rows.filter(r => r.targetId === id).length + 1)));
    if (!state.cast.includes(myId) || state.sunk?.[myId] || !best) return null;
    return { label: 'Afundando agora · ficando de pé', value: `até +${best} · +${SCORE_BATTLE_SURVIVOR}` };
  }
  if (game === 'termo') {
    const t = state.termo;
    // no duelo do Termo quem escolheu a palavra so assiste
    if (!t || state.chooserId === myId) return null;
    const done = t.done?.[myId];
    if (done) return done.solved ? { label: 'Você fechou a palavra', value: `+${done.points}` } : null;
    const used = t.boards?.[myId]?.length ?? 0;
    const first = !Object.values(t.done ?? {}).some(d => d.solved);
    return {
      label: first ? 'Acertando na próxima linha (e primeiro)' : 'Acertando na próxima linha',
      value: `+${scoreForTermo(used + 1, t.tries, first)}`,
    };
  }
  // duelo: quem escondeu não chuta, e só pontua se a mesa não acertar
  if (state.chooserId === myId) {
    return state.settings.guessesPerPlayer
      ? { label: 'Se ninguém acertar o seu segredo', value: `+${SCORE_CHOOSER_SURVIVED}` }
      : { label: 'Sem teto de chutes, quem esconde não pontua', value: '—' };
  }
  // caça e duelo: o acerto vale menos a cada chute da mesa, e o próximo conta
  return { label: `Acertando no próximo chute${bet}`, value: `+${double(scoreForWin(state.rows.length + 1))}` };
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
  // o valor da próxima jogada só com a rodada aberta: no intervalo ela já pagou
  const prize = ['playing', 'drafting', 'choosing', 'voting', 'lastGuess'].includes(state.phase)
    ? prizeOf(state, myId)
    : null;

  return (
    <aside className="side">
      {/* pular, dica e desistir: no alto da lateral, onde o olho acha na vez */}
      {state.turnActions && state.phase === 'playing' && <TurnActions state={state} myId={myId} />}

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
        {prize && (
          <div className="perf-foot prize">
            <span>{prize.label}</span>
            <b>{prize.value}</b>
          </div>
        )}
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
          {state.phase === 'choosing' ? 'Escolhendo' : (state.settings.game === 'termo' && state.settings.mode !== 'battle') || state.settings.mode === 'speed' ? 'Placar' : 'Próximo turno'}
          <span className="n">rodada {state.round}/{state.settings.rounds || '∞'}</span>
        </h3>
        <ul className={`queue ${state.phase === 'playing' && state.turnPlayerId ? 'has-turn' : ''}`}>
          {state.players.map(player => {
            const isTurn = player.id === state.turnPlayerId && state.phase === 'playing';
            const isChooser = player.id === state.chooserId;
            return (
              <li
                key={player.id}
                data-player={player.id}
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
                  {player.assist && <span className="assist-mark" title="Modo acessibilidade ligado"><AccessIcon width={12} height={12} /></span>}
                </span>
                <span className="pts">{player.score}</span>
                {isTurn && <span className="state">Agora</span>}
                {isChooser && !isTurn && <span className="state">Escondeu</span>}
                {state.phase === 'voting' && state.voted.includes(player.id) && <span className="state">Votou</span>}
                {/* termo: quem ja fechou o tabuleiro, e como */}
                {state.phase === 'playing' && state.termo?.done?.[player.id] && (
                  <span className="state">{state.termo.done[player.id].solved ? 'Acertou' : 'Esgotou'}</span>
                )}
                {state.sunk?.[player.id] && !isTurn && <span className="state">Afundou</span>}
                {state.phase === 'choosing' && state.chosen?.includes(player.id) && <span className="state">Escondeu</span>}
                {/* cartas: quantas na mão (nunca quais) e quem está congelado */}
                {player.cards > 0 && <span className="cards-n" title="Cartas na mão">{player.cards} {player.cards === 1 ? 'carta' : 'cartas'}</span>}
                {player.frozen && <span className="state">Congelado</span>}
                {player.shielded && <span className="state">Escudo</span>}
              </li>
            );
          })}
        </ul>
        {nextUp && state.phase === 'playing' && (
          <p className="f-help" style={{ marginTop: 10 }}>
            Vez de <b>{nextUp.name}</b>.{' '}
            {state.settings.mode === 'impostor'
              ? 'Quando as voltas acabarem, a mesa vota.'
              : state.settings.mode === 'battle'
                ? 'A batalha acaba quando sobrar um segredo de pé.'
                : 'Quem acerta primeiro fecha a rodada.'}
          </p>
        )}
      </section>

      <section className="card">
        <h3><ClockIcon width={13} height={13} strokeWidth={2.2} />Avisos</h3>
        <AlertPrefs />
      </section>

      <div className="exit">
        <button className="btn link" onClick={onLeave}>
          <ExitIcon width={15} height={15} /> Sair da sala
        </button>
      </div>
    </aside>
  );
}
