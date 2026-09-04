import { useRef, useState } from 'react';
import { getUniverse, scopeFilter, scopeReach } from '@shared/universes.js';
import { socket } from '../socket.js';
import { useDataset } from '../hooks/useDataset.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { universeMeta } from '../lib/universeMeta.js';
import Ambient from '../components/Ambient.jsx';
import GameSidebar from '../components/GameSidebar.jsx';
import UniverseIcon from '../components/UniverseIcon.jsx';
import GuessBar from '../components/GuessBar.jsx';
import HintsTable from '../components/HintsTable.jsx';
import Reveal from '../components/Reveal.jsx';
import GameOver from '../components/GameOver.jsx';
import { ClockIcon, TargetIcon, UsersIcon } from '../components/Icon.jsx';

export default function GameScreen({ state, myId, toast, onLeave }) {
  const universe = getUniverse(state.settings.universe);
  const items = useDataset(state.settings.universe) ?? [];
  const left = useCountdown(state.deadline);
  const meta = universeMeta(universe.id);

  // sair e a unica saida que nao guarda a cadeira; com a partida rolando o
  // botao pede confirmacao, senao um toque errado custa o placar
  const [leaving, setLeaving] = useState(false);
  const actionsRef = useRef(null);

  /**
   * A logo tambem volta para o menu, mas aqui isso e sair da sala: com a
   * partida em pe ela so acende a confirmacao la embaixo — e rola ate ela, que
   * senao o clique parece nao ter feito nada.
   */
  const backToMenu = () => {
    if (state.phase === 'gameOver') return onLeave();
    setLeaving(true);
    requestAnimationFrame(() => actionsRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  };

  const isHost = state.hostId === myId;
  const untilRight = state.settings.guessesPerPlayer === 0;
  const isMyTurn = state.phase === 'playing' && state.turnPlayerId === myId;
  const isMyChoice = state.phase === 'choosing' && state.chooserId === myId;
  const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'alguém';

  const me = state.players.find(p => p.id === myId);
  const budget = state.settings.guessesPerPlayer;
  const myGuesses = state.rows.filter(row => row.playerId === myId).length;

  const restart = () => socket.emit('game:start');

  function submit(chosen) {
    if (!chosen) return toast('Escolha um nome da lista.');
    if (isMyChoice) socket.emit('game:choose', { pokemonId: chosen.id });
    else if (isMyTurn) socket.emit('game:guess', { pokemonId: chosen.id });
    else toast('Não é a sua vez.');
  }

  const banner = buildBanner({ state, myId, universe, isMyTurn, isMyChoice, nameOf });
  const urgent = left !== null && left <= 10 && state.phase !== 'roundEnd';
  const roundOver = state.phase === 'roundEnd';

  if (state.phase === 'gameOver') {
    return (
      <>
        <Ambient extraGlow />
        <TopBar state={state} universe={universe} meta={meta} onBack={onLeave} />
        <main className="page">
          <GameOver
            state={state}
            universe={universe}
            myId={myId}
            isHost={isHost}
            onRestart={restart}
            onLeave={onLeave}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <Ambient />
      <TopBar state={state} universe={universe} meta={meta} onBack={backToMenu} />

      <div className="wrap">
        <main className="board">
          <section className={`turn-banner ${banner.tone}`}>
            <span className="badge">{banner.icon}</span>
            <div>
              <h1>{banner.title}</h1>
              <p>{banner.text}</p>
            </div>
            {left !== null && (
              <div className={`clock ${urgent ? 'urgent' : ''}`}>
                <div className="k">{isMyTurn || isMyChoice ? 'Seu turno' : 'Turno'}</div>
                <div className="v">{String(left).padStart(2, '0')}s</div>
              </div>
            )}
          </section>

          {/*
            * Rodada fechada: o segredo e o que vem depois ficam aqui em cima,
            * logo abaixo do aviso. No fim da tabela eles obrigavam a rolar a
            * partida inteira para descobrir quem era e clicar em continuar, e
            * a tabela so cresce a cada chute.
            *
            * O campo de chute sai de cena junto: nao ha o que chutar numa
            * rodada que ja acabou.
            */}
          {roundOver ? (
            <>
              {state.secret && (
                <Reveal
                  universe={universe}
                  secret={state.secret}
                  scope={scopeReach(universe, state.settings.scope)}
                />
              )}
              <div className="game-actions">
                {isHost ? (
                  <>
                    <button className="btn primary lg" onClick={() => socket.emit('game:next')}>
                      Próxima rodada
                    </button>
                    <button className="btn ghost" onClick={() => socket.emit('game:end')}>
                      Encerrar partida
                    </button>
                  </>
                ) : (
                  <span className="muted">Esperando o host puxar a próxima rodada...</span>
                )}
              </div>
            </>
          ) : (
            <>
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

              {/* quantos chutes já foram e quantos sobram, em número e em forma */}
              {state.phase === 'playing' && (
                <section className="progress-bar">
                  <span className="txt">
                    Você já deu <b>{myGuesses} {myGuesses === 1 ? 'chute' : 'chutes'}</b>
                  </span>
                  <i className="sep" />
                  <span className="left">
                    {untilRight
                      ? <>Chutes <b>ilimitados</b> nesta sala</>
                      : <>Faltam <b>{me?.guessesLeft ?? 0} {(me?.guessesLeft ?? 0) === 1 ? 'chute' : 'chutes'}</b></>}
                  </span>
                  {!untilRight && budget > 0 && (
                    <span className="pips" aria-hidden="true">
                      {Array.from({ length: budget }, (_, i) => (
                        <i key={i} className={i < budget - (me?.guessesLeft ?? 0) ? 'used' : ''} />
                      ))}
                    </span>
                  )}
                </section>
              )}
            </>
          )}

          <HintsTable universe={universe} rows={state.rows} />

          <div className="game-actions" ref={actionsRef}>
            {/* rodada "ate acertar" nao fecha sozinha: o host pode encerrar */}
            {isHost && !roundOver && untilRight && (
              <button className="btn ghost" onClick={() => socket.emit('game:end')}>Encerrar partida</button>
            )}
            {leaving && (
              <>
                <span className="muted">Sair de vez abre mão da vaga e do placar.</span>
                <button className="btn ghost small" onClick={onLeave}>Sair mesmo assim</button>
                <button className="btn link" onClick={() => setLeaving(false)}>Ficar</button>
              </>
            )}
          </div>
        </main>

        <GameSidebar
          state={state}
          myId={myId}
          universe={universe}
          onLeave={() => (leaving ? onLeave() : backToMenu())}
        />
      </div>
    </>
  );
}

function TopBar({ state, universe, meta, onBack }) {
  return (
    <header className="topbar">
      <div className="inner">
        <button type="button" className="wordmark" onClick={onBack}>
          <span className="glyph">?</span>Palpite
        </button>
        <span className="pill"><ClockIcon width={14} height={14} />Rodada <b>{state.round}</b>/{state.settings.rounds}</span>
        <span className="pill">
          <UniverseIcon universe={universe.id} size="xs" />
          {universe.label} · {state.settings.mode === 'duel' ? 'Duelo' : 'Caça ao segredo'}
        </span>
        <span className="pill"><UsersIcon width={14} height={14} />{state.players.length}</span>
        <span className="spacer" />
        <span className="pill code">{state.code}</span>
      </div>
    </header>
  );
}

/** Qual e a bola da vez, em um titulo e uma frase. */
function buildBanner({ state, myId, universe, isMyTurn, isMyChoice, nameOf }) {
  if (state.phase === 'choosing') {
    return isMyChoice
      ? {
        title: 'Escolha o segredo',
        text: `Pense em ${universe.secretLabel} — os outros vão ter que adivinhar.`,
        tone: 'warn',
        icon: <TargetIcon width={22} height={22} />,
      }
      : {
        title: 'Aguardando o segredo',
        text: `${nameOf(state.chooserId)} está escolhendo...`,
        tone: '',
        icon: <ClockIcon width={22} height={22} />,
      };
  }

  if (state.phase === 'playing') {
    if (state.chooserId === myId) {
      return {
        title: 'Você escondeu o segredo',
        text: state.message ?? 'Só assista: quanto mais eles demorarem, mais você pontua.',
        tone: 'warn',
        icon: <TargetIcon width={22} height={22} />,
      };
    }
    if (isMyTurn) {
      return {
        title: 'É sua vez',
        text: state.message ?? `Descubra ${universe.secretLabel}.`,
        tone: 'you',
        icon: <TargetIcon width={22} height={22} />,
      };
    }
    return {
      title: `Vez de ${nameOf(state.turnPlayerId)}`,
      text: state.message ?? 'Acompanhe a tabela — o próximo turno é seu.',
      tone: '',
      icon: <ClockIcon width={22} height={22} />,
    };
  }

  if (state.phase === 'roundEnd') {
    const won = state.winnerId === myId;
    return {
      title: won ? 'Você acertou!' : 'Fim da rodada',
      text: state.message ?? '',
      tone: won ? 'you' : '',
      icon: <TargetIcon width={22} height={22} />,
    };
  }

  return { title: '', text: '', tone: '', icon: <ClockIcon width={22} height={22} /> };
}
