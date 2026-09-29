import { useEffect, useState } from 'react';
import { socket } from '../socket.js';
import { ArrowRightIcon, BulbIcon, CloseIcon } from './Icon.jsx';

/**
 * O card da vez, na lateral: pular, pedir dica e desistir, com o custo de cada
 * um escrito embaixo. Desistir pede um segundo clique (vira "Tem certeza?" por
 * alguns segundos): e a unica das tres que nao tem volta. As dicas da mesa so
 * aparecem quando o host ligou a chave antes da partida.
 */
export default function TurnActions({ state, myId }) {
  const [sure, setSure] = useState(false);

  useEffect(() => {
    if (!sure) return undefined;
    const handle = setTimeout(() => setSure(false), 4000);
    return () => clearTimeout(handle);
  }, [sure]);

  const myTurn = state.phase === 'playing' && state.turnPlayerId === myId;
  const me = state.players.find(p => p.id === myId);
  const budgeted = state.settings.guessesPerPlayer > 0;
  const hintsOn = Boolean(state.settings.tableHints);
  const others = state.players.some(p => p.id !== myId && p.connected && p.guessesLeft !== 0);
  const hintsUsed = state.hints.length;
  const noHint = hintsUsed >= state.hintMax || (budgeted && (me?.guessesLeft ?? 0) <= 1);
  const noSkip = state.mySkipUsed || !others || (budgeted && (me?.guessesLeft ?? 0) <= 0);

  return (
    <section className={`card turn-card ${myTurn ? 'live' : ''}`}>
      <h3>
        Ações da vez
        <span className="n">{myTurn ? 'sua vez' : 'aguarde'}</span>
      </h3>

      <div className="turn-acts">
        <button
          type="button" className="act skip" disabled={!myTurn || noSkip}
          onClick={() => socket.emit('game:skip')}
        >
          <span className="ic"><ArrowRightIcon width={17} height={17} /></span>
          <span className="tx">
            <b>Pular a vez</b>
            <small>{state.mySkipUsed ? 'Já usado nesta rodada' : budgeted ? 'Custa 1 chute' : '1 vez por rodada'}</small>
          </span>
        </button>

        {hintsOn && (
          <button
            type="button" className="act hint" disabled={!myTurn || noHint}
            onClick={() => socket.emit('game:hint')}
          >
            <span className="ic"><BulbIcon width={17} height={17} /></span>
            <span className="tx">
              <b>Pedir dica</b>
              <small>{budgeted ? 'Custa 1 chute' : 'Custa 3 pontos'} · {hintsUsed} de {state.hintMax}</small>
            </span>
          </button>
        )}

        <button
          type="button" className={`act giveup ${sure ? 'sure' : ''}`} disabled={!myTurn}
          onClick={() => {
            if (!sure) return setSure(true);
            setSure(false);
            socket.emit('game:giveup');
          }}
        >
          <span className="ic"><CloseIcon width={17} height={17} /></span>
          <span className="tx">
            <b>{sure ? 'Tem certeza?' : 'Desistir'}</b>
            <small>{sure ? 'Clique de novo para confirmar' : 'Sai da rodada e vê a resposta'}</small>
          </span>
        </button>
      </div>

      {hintsOn && state.hints.length > 0 && (
        <ul className="table-hints">
          {state.hints.map((hint, i) => (
            <li key={i}>
              <b>Dica {i + 1}</b>
              <span>{hint.text}</span>
              <small>pedida por {hint.by}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
