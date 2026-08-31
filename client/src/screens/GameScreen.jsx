import { useState } from 'react';
import { getUniverse, scopeFilter } from '@shared/universes.js';
import { socket } from '../socket.js';
import { useDataset } from '../hooks/useDataset.js';
import { useCountdown } from '../hooks/useCountdown.js';
import Scoreboard from '../components/Scoreboard.jsx';
import GuessBar from '../components/GuessBar.jsx';
import HintsTable from '../components/HintsTable.jsx';
import Reveal from '../components/Reveal.jsx';
import GameOver from '../components/GameOver.jsx';
import { ExitIcon } from '../components/Icon.jsx';

export default function GameScreen({ state, myId, toast, onLeave }) {
  const universe = getUniverse(state.settings.universe);
  const items = useDataset(state.settings.universe) ?? [];
  const left = useCountdown(state.deadline);

  // sair e a unica saida que nao guarda a cadeira; com a partida rolando o
  // botao pede confirmacao, senao um toque errado custa o placar
  const [leaving, setLeaving] = useState(false);

  const isHost = state.hostId === myId;
  const untilRight = state.settings.guessesPerPlayer === 0;
  const isMyTurn = state.phase === 'playing' && state.turnPlayerId === myId;
  const isMyChoice = state.phase === 'choosing' && state.chooserId === myId;
  const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'alguém';

  const restart = () => socket.emit('game:start');

  function submit(chosen) {
    if (!chosen) return toast('Escolha um nome da lista.');
    if (isMyChoice) socket.emit('game:choose', { pokemonId: chosen.id });
    else if (isMyTurn) socket.emit('game:guess', { pokemonId: chosen.id });
    else toast('Não é a sua vez.');
  }

  const banner = buildBanner({ state, myId, universe, isMyTurn, isMyChoice, nameOf });

  return (
    <>
      <header className="topbar">
        <span className="wordmark">Palpite</span>
        <span className="pill">
          {`Rodada ${state.round}/${state.settings.rounds}`}
        </span>
        <span className="pill">
          {universe.label} · {state.settings.mode === 'duel' ? 'Duelo' : 'Caça ao segredo'}
        </span>
        <span className="pill code">{state.code}</span>
        <span className="spacer" />
        {left !== null && (
          <span className={`timer ${left <= 10 && state.phase !== 'roundEnd' ? 'urgent' : ''}`}>
            {String(left).padStart(2, '0')}s
          </span>
        )}
      </header>

      <main className="page">
        <Scoreboard state={state} myId={myId} />

        {state.phase === 'gameOver' ? (
          <GameOver
            state={state}
            universe={universe}
            myId={myId}
            isHost={isHost}
            onRestart={restart}
            onLeave={onLeave}
          />
        ) : (
          <>
            {banner.text && <div className={`banner ${banner.tone}`}>{banner.text}</div>}

            <GuessBar
              items={items}
              guessedIds={state.rows.map(row => row.id)}
              groups={state.settings.groups}
              inScope={scopeFilter(universe, state.settings.scope)}
              active={isMyTurn || isMyChoice}
              choosing={isMyChoice}
              focusKey={state.phase}
              onSubmit={submit}
            />

            <HintsTable universe={universe} rows={state.rows} />

            {state.secret && <Reveal universe={universe} secret={state.secret} />}

            <div className="game-actions">
              {isHost && state.phase === 'roundEnd' && (
                <button className="btn primary" onClick={() => socket.emit('game:next')}>Próxima rodada</button>
              )}
              {/* rodada "ate acertar" nao fecha sozinha: o host pode encerrar */}
              {isHost && untilRight && (
                <button className="btn" onClick={() => socket.emit('game:end')}>Encerrar partida</button>
              )}
              {leaving ? (
                <>
                  <span className="muted">Sair de vez abre mão da vaga e do placar.</span>
                  <button className="btn small" onClick={onLeave}>Sair mesmo assim</button>
                  <button className="btn link" onClick={() => setLeaving(false)}>Ficar</button>
                </>
              ) : (
                <button className="btn link" onClick={() => setLeaving(true)}>
                  <ExitIcon width={16} height={16} /> Sair da sala
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}

/** Qual e a bola da vez, em uma frase. */
function buildBanner({ state, myId, universe, isMyTurn, isMyChoice, nameOf }) {
  if (state.phase === 'choosing') {
    return isMyChoice
      ? { text: `🤫 Escolha ${universe.secretLabel} para os outros adivinharem.`, tone: 'you' }
      : { text: `Aguardando ${nameOf(state.chooserId)} escolher o segredo...`, tone: 'wait' };
  }

  if (state.phase === 'playing') {
    if (state.chooserId === myId) {
      return { text: 'Você escolheu o segredo — só assista. 😈', tone: 'warn' };
    }
    const text = isMyTurn ? '🎯 Sua vez! Mande o chute.' : `Vez de ${nameOf(state.turnPlayerId)}...`;
    return {
      text: state.message ? `${text}  •  ${state.message}` : text,
      tone: isMyTurn ? 'you' : 'wait',
    };
  }

  if (state.phase === 'roundEnd') {
    return { text: state.message ?? '', tone: state.winnerId === myId ? 'you' : '' };
  }

  return { text: '', tone: '' };
}
