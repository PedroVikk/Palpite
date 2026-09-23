import { useMemo, useRef, useState } from 'react';
import { getUniverse, scopeFilter, scopeReach } from '@shared/universes.js';
import { socket } from '../socket.js';
import { useDataset } from '../hooks/useDataset.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { hasPicture } from '../lib/picture.js';
import { universeMeta } from '../lib/universeMeta.js';
import Ambient from '../components/Ambient.jsx';
import GameSidebar from '../components/GameSidebar.jsx';
import UniverseIcon from '../components/UniverseIcon.jsx';
import GuessBar from '../components/GuessBar.jsx';
import HintsTable from '../components/HintsTable.jsx';
import SecretImage from '../components/SecretImage.jsx';
import Reveal from '../components/Reveal.jsx';
import GameOver from '../components/GameOver.jsx';
import { ImpostorModal, RoleCard } from '../components/ImpostorPanels.jsx';
import { BattleTabs, MySecretCard } from '../components/BattlePanels.jsx';
import { AnchorIcon, ClockIcon, ImageIcon, MaskIcon, TargetIcon, UsersIcon } from '../components/Icon.jsx';

const RULES = { hunt: 'Caça ao segredo', duel: 'Duelo', impostor: 'Impostor', battle: 'Batalha naval' };

export default function GameScreen({ state, myId, toast, onLeave }) {
  const universe = getUniverse(state.settings.universe);
  const items = useDataset(state.settings.universe) ?? [];
  const left = useCountdown(state.deadline);
  const meta = universeMeta(universe.id);

  // sair e a unica saida que nao guarda a cadeira; com a partida rolando o
  // botao pede confirmacao, senao um toque errado custa o placar
  const [leaving, setLeaving] = useState(false);
  // impostor: a carta nasce virada a cada rodada; guarda so em qual rodada o
  // jogador a desvirou, e a proxima ja chega escondida de novo
  const [shownRound, setShownRound] = useState(null);
  // a janela da votacao/gabarito fechada nesta fase; na fase seguinte ela abre
  // de novo sozinha (fechar a urna nao pode esconder o gabarito)
  const [closedModal, setClosedModal] = useState(null);
  // batalha naval: o tabuleiro que o jogador abriu (ver `target` abaixo)
  const [pickedTarget, setPickedTarget] = useState(null);
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
  const byPicture = Boolean(state.settings.picture);
  const impostorMode = state.settings.mode === 'impostor';
  const isImpostor = state.role === 'impostor';
  // o chute final de quem foi pego passa pelo mesmo campo do chute de sempre
  const isMyLastGuess = state.phase === 'lastGuess' && state.turnPlayerId === myId;
  const isMyTurn = (state.phase === 'playing' && state.turnPlayerId === myId) || isMyLastGuess;
  const battle = state.settings.mode === 'battle';
  // na batalha naval todo mundo da batalha esconde, ao mesmo tempo
  const isMyChoice = state.phase === 'choosing'
    && (battle ? state.cast.includes(myId) : state.chooserId === myId);
  const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'alguém';
  // impostor: a rodada ainda esta aberta (voltas, urna ou chute final)
  const impostorRound = impostorMode && ['playing', 'voting', 'lastGuess'].includes(state.phase);

  /**
   * Batalha naval: o tabuleiro aberto na tela e o alvo do proximo tiro. Da para
   * abrir o proprio ou o de quem ja afundou para olhar, mas o tiro so vai em
   * quem esta de pe — sem escolha valida, cai no primeiro adversario de pe.
   */
  const shootable = (id) => battle && state.cast.includes(id) && id !== myId && !state.sunk[id];
  const firstTarget = state.cast.find(shootable) ?? null;
  const target = battle && state.cast.includes(pickedTarget) ? pickedTarget : firstTarget;
  const canShoot = shootable(target);
  const shownRows = battle ? state.rows.filter(row => row.targetId === target) : state.rows;

  /**
   * O que a busca do chute oferece. Jogando pela imagem, quem nao tem figura
   * ficou fora do sorteio do segredo (ver `pool` em src/rooms.js) — oferecer o
   * nome seria vender um chute que nunca poderia ser a resposta, e num jogo de
   * um turno por vez isso custa a vez de alguem.
   */
  const secretId = state.secret?.id ?? null;
  const inScope = useMemo(() => {
    const noRecorte = scopeFilter(universe, state.settings.scope);
    // no impostor quem sabe o segredo nao pode chuta-lo (o servidor recusa):
    // ele some da busca em vez de custar uma recusa na hora da vez
    const hideSecret = impostorRound && secretId !== null;
    return (item) => noRecorte(item)
      && (!byPicture || hasPicture(item))
      && !(hideSecret && item.id === secretId);
  }, [universe, state.settings.scope, byPicture, impostorRound, secretId]);

  const me = state.players.find(p => p.id === myId);
  const budget = state.settings.guessesPerPlayer;
  const myGuesses = state.rows.filter(row => row.playerId === myId).length;

  const restart = () => socket.emit('game:start');

  function submit(chosen) {
    if (!chosen) return toast('Escolha um nome da lista.');
    if (isMyChoice) socket.emit('game:choose', { pokemonId: chosen.id });
    else if (isMyTurn && battle) {
      if (!canShoot) return toast('Escolha um alvo que ainda esteja de pé.');
      socket.emit('game:guess', { pokemonId: chosen.id, targetId: target });
    } else if (isMyTurn) socket.emit('game:guess', { pokemonId: chosen.id });
    else toast('Não é a sua vez.');
  }

  const banner = impostorMode
    ? impostorBanner({ state, myId, universe, isMyTurn, nameOf })
    : battle
      ? battleBanner({ state, myId, universe, isMyTurn, target, canShoot, nameOf })
      : buildBanner({ state, myId, universe, isMyTurn, isMyChoice, nameOf });
  const urgent = left !== null && left <= 10 && state.phase !== 'roundEnd';
  const roundOver = state.phase === 'roundEnd';

  /**
   * A janela do impostor: urna, espera do chute final e gabarito. Quem foi
   * pego fica sem ela no chute final — precisa do campo de chute livre.
   */
  const modalKey = `${state.round}:${state.phase}`;
  const modalPhase = impostorMode && (state.phase === 'voting'
    || roundOver
    || (state.phase === 'lastGuess' && !isMyLastGuess));
  const showModal = modalPhase && closedModal !== modalKey;
  const reopenLabel = state.phase === 'voting' ? 'Abrir a votação' : 'Ver o gabarito';

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
                {modalPhase && !showModal && (
                  <button className="btn violet" onClick={() => setClosedModal(null)}>{reopenLabel}</button>
                )}
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
              {/* impostor: a mesa ve o segredo que precisa proteger, o impostor
                  ve so a mascara. Os dois comecam com a carta virada */}
              {impostorRound && (
                <RoleCard
                  state={state}
                  universe={universe}
                  isImpostor={isImpostor}
                  hidden={shownRound !== state.round}
                  onToggle={() => setShownRound(r => (r === state.round ? null : state.round))}
                />
              )}

              {modalPhase && !showModal && (
                <div className="game-actions">
                  <button className="btn violet lg" onClick={() => setClosedModal(null)}>{reopenLabel}</button>
                </div>
              )}

              {/* batalha naval: o seu segredo (virado) e os tabuleiros, que sao
                  tambem a escolha do alvo */}
              {battle && (
                <MySecretCard
                  secret={state.secrets[myId]}
                  sunkBy={state.sunk[myId] ? nameOf(state.sunk[myId].by) : null}
                />
              )}
              {battle && state.phase === 'playing' && (
                <BattleTabs state={state} myId={myId} targetId={target} onPick={setPickedTarget} />
              )}
              {battle && state.phase === 'playing' && state.sunk[target] && state.secrets[target] && (
                <Reveal
                  universe={universe}
                  secret={state.secrets[target]}
                  scope={scopeReach(universe, state.settings.scope)}
                  caption={`${nameOf(target)} afundou — o segredo era`}
                />
              )}

              {/* jogando pela imagem, a figura fica onde a tabela ficaria: em
                  cima do campo de chute, que e para onde o olho vai antes de
                  digitar. Quem escondeu o segredo no duelo ja sabe quem e, mas
                  ve o mesmo quadro dos outros — e assim acompanha o quanto a
                  mesa ja arrancou dele */}
              {byPicture && state.picture && (
                <SecretImage
                  universe={universe.id}
                  picture={state.picture}
                  caption={`Um nome de ${universe.label}, atrás de poucos pixels. Cada chute errado da mesa revela mais um pedaço.`}
                />
              )}

              {state.phase !== 'voting' && <GuessBar
                items={items}
                guessedIds={battle && isMyChoice ? [] : shownRows.map(row => row.id)}
                groups={state.settings.groups}
                inScope={inScope}
                active={(isMyTurn && (!battle || canShoot)) || isMyChoice}
                choosing={isMyChoice}
                focusKey={state.phase}
                onSubmit={submit}
              />}

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

          {/* na escolha da batalha ainda nao ha tabuleiro para mostrar */}
          {!(battle && state.phase === 'choosing') && (
            <HintsTable universe={universe} rows={shownRows} hints={!byPicture} counts={impostorRound} />
          )}

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

      {showModal && (
        <ImpostorModal
          state={state}
          myId={myId}
          universe={universe}
          isHost={isHost}
          onClose={() => setClosedModal(modalKey)}
        />
      )}
    </>
  );
}

function TopBar({ state, universe, meta, onBack }) {
  const rules = RULES[state.settings.mode] ?? RULES.hunt;
  return (
    <header className="topbar">
      <div className="inner">
        <button type="button" className="wordmark" onClick={onBack}>
          <span className="glyph">?</span>Palpite
        </button>
        <span className="pill"><ClockIcon width={14} height={14} />Rodada <b>{state.round}</b>/{state.settings.rounds}</span>
        <span className="pill">
          <UniverseIcon universe={universe.id} size="xs" />
          {universe.label} · {rules}
        </span>
        {state.settings.picture && (
          <span className="pill"><ImageIcon width={14} height={14} />Pela imagem</span>
        )}
        <span className="pill"><UsersIcon width={14} height={14} />{state.players.length}</span>
        <span className="spacer" />
        <span className="pill code">{state.code}</span>
      </div>
    </header>
  );
}

/** A bola da vez no impostor: o aviso muda com o papel de quem olha. */
function battleBanner({ state, myId, universe, isMyTurn, target, canShoot, nameOf }) {
  const anchor = <AnchorIcon width={22} height={22} />;

  if (state.phase === 'choosing') {
    const mine = state.chosen.includes(myId);
    const done = `${state.chosen.length} de ${state.cast.length} já esconderam.`;
    if (!state.cast.includes(myId)) {
      return { title: 'Batalha começando', text: `Você entrou depois: assiste a esta. ${done}`, tone: '', icon: anchor };
    }
    return mine
      ? {
        title: 'Segredo escondido',
        text: `${done} Dá para trocar enquanto os outros escolhem.`,
        tone: '',
        icon: <ClockIcon width={22} height={22} />,
      }
      : {
        title: 'Esconda o seu segredo',
        text: `Escolha ${universe.secretLabel} que os outros vão ter de afundar. ${done}`,
        tone: 'warn',
        icon: anchor,
      };
  }

  if (state.phase === 'playing') {
    if (isMyTurn) {
      return {
        title: canShoot ? `Sua vez — atire em ${nameOf(target)}` : 'Sua vez — escolha um alvo',
        text: state.message ?? 'Toque num tabuleiro para trocar de alvo. As dicas dos outros tiros valem para você também.',
        tone: 'you',
        icon: <TargetIcon width={22} height={22} />,
      };
    }
    return {
      title: `Vez de ${nameOf(state.turnPlayerId)}`,
      text: state.message ?? 'Abra os tabuleiros e veja quem está perto de afundar.',
      tone: '',
      icon: <ClockIcon width={22} height={22} />,
    };
  }

  return { title: '', text: state.message ?? '', tone: '', icon: anchor };
}

function impostorBanner({ state, myId, universe, isMyTurn, nameOf }) {
  const mask = <MaskIcon width={22} height={22} />;

  /**
   * Durante as voltas o aviso e o mesmo para a mesa e para o impostor: mesma
   * frase, mesma cor, mesmo icone. O papel mora so na carta, que nasce virada
   * — um aviso diferente entregaria quem e o impostor a quem olhasse a tela.
   */
  if (state.phase === 'playing') {
    if (isMyTurn) {
      return {
        title: 'Sua vez',
        text: state.message ?? `Chute ${universe.secretLabel} que convença a mesa de que você sabe.`,
        tone: 'you',
        icon: <TargetIcon width={22} height={22} />,
      };
    }
    return {
      title: `Vez de ${nameOf(state.turnPlayerId)}`,
      text: state.message ?? 'Esse chute convence? Fique de olho na contagem de acertos.',
      tone: '',
      icon: <ClockIcon width={22} height={22} />,
    };
  }

  if (state.phase === 'voting') {
    const done = state.voted.includes(myId);
    return {
      title: 'Quem é o impostor?',
      text: done
        ? `Voto registrado. ${state.voted.length} de ${state.cast.length} já votaram.`
        : 'Vote em quem você acha que não sabia o segredo. Empate salva o impostor.',
      tone: 'warn',
      icon: mask,
    };
  }

  if (state.phase === 'lastGuess') {
    return state.turnPlayerId === myId
      ? {
        title: 'Você foi pego — última chance',
        text: `Acerte ${universe.secretLabel} e a vitória ainda é sua.`,
        tone: 'warn',
        icon: mask,
      }
      : {
        title: `${nameOf(state.impostorId)} era o impostor`,
        text: 'Ainda resta um chute para dizer o segredo. Torça para a mesa não ter ajudado demais.',
        tone: 'you',
        icon: mask,
      };
  }

  if (state.phase === 'roundEnd') {
    const won = state.winnerId === myId
      || (state.outcome && ['caught', 'left'].includes(state.outcome.how) && state.impostorId !== myId);
    return {
      title: won ? 'Vitória!' : 'Fim da rodada',
      text: state.message ?? '',
      tone: won ? 'you' : '',
      icon: mask,
    };
  }

  return { title: '', text: '', tone: '', icon: <ClockIcon width={22} height={22} /> };
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
