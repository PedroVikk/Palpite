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
import QuizPanel from '../components/QuizPanel.jsx';
import TermoTable, { TermoBattleBoard, TermoChooser, termoBanner } from '../components/TermoPanels.jsx';
import { TermoReveal } from '../components/TermoBoard.jsx';
import { SpeedBoard, SpeedFx, SpeedTrack, speedBanner } from '../components/SpeedPanels.jsx';
import Modal from '../components/Modal.jsx';
import TimeBar from '../components/TimeBar.jsx';
import { useTurnAlert } from '../hooks/useTurnAlert.js';
import { usePrefs, reducedMotion } from '../lib/prefs.js';
import { CardPlayFx, DraftModal, HandBar } from '../components/CardPanels.jsx';
import { AnchorIcon, CardsIcon, ClockIcon, ExitIcon, ImageIcon, MaskIcon, PaletteIcon, QuestionIcon, TargetIcon, TermoIcon, UsersIcon } from '../components/Icon.jsx';
import { openThemePicker } from '../lib/theme.js';

const RULES = { hunt: 'Caça ao segredo', duel: 'Duelo', impostor: 'Impostor', battle: 'Batalha naval', quiz: 'Qual deles?', speed: 'Velocidade' };

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

  /**
   * A logo tambem volta para o menu, mas aqui isso e sair da sala: com a
   * partida em pe ela abre a confirmacao numa janela no meio da tela, onde o
   * clique nao passa despercebido, com a partida desfocada atras.
   */
  const backToMenu = () => {
    if (state.phase === 'gameOver') return onLeave();
    setLeaving(true);
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
  const quiz = state.settings.mode === 'quiz';
  // Termo: a palavra letra a letra, sem busca de nomes nem tabela. Na caca e
  // no duelo e corrida (cada um no seu tabuleiro, sem vez); na batalha e de
  // turno, no tabuleiro do alvo
  const termo = state.settings.game === 'termo';
  // velocidade: cada um na propria fila, sem vez; tem tela propria (SpeedPanels)
  const speed = state.settings.mode === 'speed';
  const termoRace = termo && !battle && !speed;
  // o fim da corrida ja visto: mora aqui porque a tela troca de galho no fim
  // da partida, e o aviso tem de sobreviver a troca (ver SpeedFx)
  const speedSeen = useRef(state.speed?.seq ?? 0);
  // as cartas sao uma chave da sala, que vale em qualquer modo
  const withCards = Boolean(state.settings.cards);
  // a mao acende na propria vez; no "Qual deles?" nao ha vez, e ela vale ate responder
  const canPlayCard = state.phase === 'playing'
    && (quiz ? state.cast.includes(myId) && state.myAnswer === null : state.turnPlayerId === myId);
  // na batalha naval todo mundo da batalha esconde, ao mesmo tempo
  const isMyChoice = state.phase === 'choosing'
    && (battle ? state.cast.includes(myId) : state.chooserId === myId);
  const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'alguém';
  // impostor: a rodada ainda esta aberta (draft das cartas, voltas, urna ou chute final)
  const impostorRound = impostorMode && ['drafting', 'playing', 'voting', 'lastGuess'].includes(state.phase);

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
  // cartas: o que a Peneira tirou da busca de quem usou
  const sieveKey = (state.mySieve ?? []).join(',');
  const inScope = useMemo(() => {
    const noRecorte = scopeFilter(universe, state.settings.scope);
    // no impostor quem sabe o segredo nao pode chuta-lo (o servidor recusa):
    // ele some da busca em vez de custar uma recusa na hora da vez
    const hideSecret = impostorRound && secretId !== null;
    const sieved = new Set(sieveKey ? sieveKey.split(',').map(Number) : []);
    return (item) => noRecorte(item)
      && (!byPicture || hasPicture(item))
      && !(hideSecret && item.id === secretId)
      && !sieved.has(item.id);
  }, [universe, state.settings.scope, byPicture, impostorRound, secretId, sieveKey]);

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

  // o draft e igual em todo modo: vem antes do aviso de cada um
  const banner = speed ? speedBanner({ state, myId }) : state.phase === 'drafting'
    ? {
      title: 'Draft de cartas',
      text: `Cada um escolhe 1 de 3 cartas. ${state.drafting.length ? `Faltam ${state.drafting.length}.` : ''}`,
      tone: 'warn',
      icon: <CardsIcon width={22} height={22} />,
    }
    : impostorMode
    ? impostorBanner({ state, myId, universe, isMyTurn, nameOf })
    : battle
      ? battleBanner({ state, myId, universe, isMyTurn, target, canShoot, nameOf, termo })
      : termo
      ? termoBanner({ state, myId, nameOf })
      : quiz
      ? quizBanner({ state, myId })
      : buildBanner({ state, myId, universe, isMyTurn, isMyChoice, nameOf });
  const urgent = left !== null && left <= 10 && state.phase !== 'roundEnd';
  const roundOver = state.phase === 'roundEnd';

  // avisos fora do tabuleiro: vez, tempo e titulo da aba
  const prefs = usePrefs();
  const clockTotal = useTurnAlert({
    myTurn: isMyTurn && state.phase === 'playing',
    nextIsMe: state.nextTurnId === myId,
    left: roundOver ? null : left,
    deadline: state.deadline,
  });
  const still = !prefs.flash || reducedMotion();

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
        <Ambient marks={[universe.id]} />
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
        {speed && <SpeedFx state={state} myId={myId} seenRef={speedSeen} />}
      </>
    );
  }

  return (
    <>
      <Ambient marks={[universe.id]} />
      <TopBar state={state} universe={universe} meta={meta} onBack={backToMenu} />

      <div className="wrap">
        <main className="board">
          <section
            className={`turn-banner ${banner.tone} ${isMyTurn && state.phase === 'playing' ? `mine ${still ? 'still' : ''}` : ''}`}
          >
            <span className="badge">{banner.icon}</span>
            <div>
              <h1>{banner.title}</h1>
              <p>{banner.text}</p>
            </div>
            {left !== null && (
              <div className={`clock ${urgent ? 'urgent' : ''}`}>
                <div className="k">{quiz || speed || (termoRace && state.phase === 'playing') ? 'Tempo' : isMyTurn || isMyChoice ? 'Seu turno' : 'Turno'}</div>
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
          {/* "Qual deles?": a pergunta e, fechada, o gabarito — nos dois estados */}
          {quiz && <QuizPanel state={state} myId={myId} universe={universe} />}

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
              {battle && termo && state.phase === 'playing' && state.sunk[target] && state.secrets[target] && (
                <TermoReveal
                  answer={state.secrets[target]}
                  caption={`Afundada por ${state.sunk[target].by === myId ? 'você' : nameOf(state.sunk[target].by)} — a palavra de ${nameOf(target)} era`}
                />
              )}
              {battle && !termo && state.phase === 'playing' && state.sunk[target] && state.secrets[target] && (
                <Reveal
                  universe={universe}
                  secret={state.secrets[target]}
                  scope={scopeReach(universe, state.settings.scope)}
                  caption={`Afundado por ${state.sunk[target].by === myId ? 'você' : nameOf(state.sunk[target].by)} — o segredo de ${nameOf(target)} era`}
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

              {/* cartas: a mão, que só acende na sua vez */}
              {withCards && state.phase === 'playing' && (
                <HandBar state={state} universe={universe} myTurn={canPlayCard} myId={myId} />
              )}

              {/* Termo: escolher a palavra que se esconde (duelo e batalha) e,
                  na batalha, o tabuleiro do alvo com o teclado */}
              {termo && isMyChoice && <TermoChooser state={state} universe={universe} items={items} />}
              {termo && battle && state.phase === 'playing' && (
                <TermoBattleBoard
                  state={state}
                  targetId={target}
                  active={isMyTurn && canShoot}
                  toast={toast}
                />
              )}

              {/* velocidade: o placar da corrida e o seu tabuleiro */}
              {speed && <SpeedTrack state={state} myId={myId} />}
              {speed && (
                <SpeedBoard state={state} universe={universe} items={items} inScope={inScope} toast={toast} />
              )}

              {state.phase !== 'voting' && !quiz && !termo && !speed && <GuessBar
                items={items}
                guessedIds={battle && isMyChoice ? [] : shownRows.map(row => row.id)}
                groups={state.settings.groups}
                inScope={inScope}
                active={(isMyTurn && (!battle || canShoot)) || isMyChoice}
                choosing={isMyChoice}
                focusKey={state.phase}
                onSubmit={submit}
              />}

              {state.phase === 'playing' && !quiz && !termo && !speed && (
                <TimeBar left={left} total={clockTotal} mine={isMyTurn} still={still} />
              )}

              {/* quantos chutes já foram e quantos sobram, em número e em forma */}
              {state.phase === 'playing' && !quiz && !termo && !speed && (
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
          {/* Termo: o seu tabuleiro e os dos outros; fechada a rodada, com as letras */}
          {termoRace && <TermoTable state={state} myId={myId} toast={toast} />}

          {!(battle && state.phase === 'choosing') && !quiz && !termo && !speed && (
            <HintsTable universe={universe} rows={shownRows} hints={!byPicture} counts={impostorRound} />
          )}

          <div className="game-actions">
            {/* o que e infinito (chutes, rodadas ou relogio) nao fecha sozinho: o host encerra */}
            {isHost && !roundOver && (untilRight || !state.settings.rounds || !state.settings.turnSeconds) && (
              <button className="btn ghost" onClick={() => socket.emit('game:end')}>Encerrar partida</button>
            )}
          </div>
        </main>

        <GameSidebar
          state={state}
          myId={myId}
          universe={universe}
          onLeave={backToMenu}
        />
      </div>

      {withCards && state.phase === 'drafting' && <DraftModal state={state} />}
      {withCards && <CardPlayFx state={state} myId={myId} />}
      {speed && <SpeedFx state={state} myId={myId} seenRef={speedSeen} />}

      {showModal && (
        <ImpostorModal
          state={state}
          myId={myId}
          universe={universe}
          isHost={isHost}
          onClose={() => setClosedModal(modalKey)}
        />
      )}

      {/* por ultimo: se outra janela estiver aberta, a de sair fica por cima */}
      {leaving && <LeaveModal onStay={() => setLeaving(false)} onLeave={onLeave} />}
    </>
  );
}

/** Sair de vez: a unica saida que nao guarda a cadeira, entao pergunta antes. */
function LeaveModal({ onStay, onLeave }) {
  return (
    <Modal label="Sair da partida" onClose={onStay} className="confirm" closeLabel="Ficar">
      <div className="modal-main">
        <span className="confirm-ico"><ExitIcon width={24} height={24} /></span>
        <h2>Sair da partida?</h2>
        <p>Sair de vez abre mão da sua vaga e do seu placar. Não dá para voltar para esta cadeira depois.</p>
        <div className="confirm-actions">
          {/* o foco fica no Ficar: Enter por engano nao custa a partida */}
          <button type="button" className="btn ghost" onClick={onStay} autoFocus>Ficar</button>
          <button type="button" className="btn danger" onClick={onLeave}>Sair mesmo assim</button>
        </div>
      </div>
    </Modal>
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
        <span className="pill"><ClockIcon width={14} height={14} />Rodada <b>{state.round}</b>/{state.settings.rounds || '∞'}</span>
        <span className="pill">
          <UniverseIcon universe={universe.id} size="xs" />
          {universe.label} · {state.settings.game === 'termo' ? `Termo · ${rules}` : rules}
        </span>
        {state.settings.picture && (
          <span className="pill"><ImageIcon width={14} height={14} />Pela imagem</span>
        )}
        {state.settings.cards && (
          <span className="pill"><CardsIcon width={14} height={14} />Com cartas</span>
        )}
        {/* Termo: a categoria da palavra fica a vista a rodada inteira, para
            quem joga e para quem so assiste (na batalha ela vai em cada alvo) */}
        {state.termo?.cat && (
          <span className="pill"><TermoIcon width={14} height={14} />Categoria: <b>{state.termo.cat}</b></span>
        )}
        <span className="pill"><UsersIcon width={14} height={14} />{state.players.length}</span>
        <span className="spacer" />
        <span className="pill code">{state.code}</span>
        <button type="button" className="icon-btn" onClick={openThemePicker} aria-label="Trocar o visual" title="Trocar o visual">
          <PaletteIcon width={17} height={17} />
        </button>
      </div>
    </header>
  );
}

/** A bola da vez no impostor: o aviso muda com o papel de quem olha. */
/** "Qual deles?": nao ha vez — o aviso diz em que pergunta estamos e como ela fechou. */
function quizBanner({ state, myId }) {
  const q = <QuestionIcon width={22} height={22} />;
  if (state.phase === 'playing') {
    return state.myAnswer !== null
      ? { title: 'Resposta enviada', text: `${state.answered.length} de ${state.cast.length} já responderam.`, tone: '', icon: <ClockIcon width={22} height={22} /> }
      : { title: `Pergunta ${state.round}${state.settings.rounds ? ` de ${state.settings.rounds}` : ''}`, text: 'Todo mundo responde junto. Quem acerta mais rápido leva mais pontos.', tone: 'you', icon: q };
  }
  const mine = state.quizResult?.picks?.[myId];
  return {
    title: mine?.correct ? `Acertou! +${mine.points}` : 'Fim da pergunta',
    text: state.message ?? '',
    tone: mine?.correct ? 'you' : '',
    icon: q,
  };
}

function battleBanner({ state, myId, universe, isMyTurn, target, canShoot, nameOf, termo = false }) {
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
        text: `Escolha ${termo ? 'a palavra' : universe.secretLabel} que os outros vão ter de afundar. ${done}`,
        tone: 'warn',
        icon: anchor,
      };
  }

  if (state.phase === 'playing') {
    // afundou: sai da batalha e so assiste ate sobrar um
    const sunk = state.sunk[myId];
    if (sunk) {
      return {
        title: 'Você afundou',
        text: state.message ?? `${nameOf(sunk.by)} achou o seu segredo. Agora é só assistir quem vai sobrar.`,
        tone: '',
        icon: anchor,
      };
    }
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

  // rodadas de batalha: entre uma e outra, o placar da que acabou
  return { title: state.phase === 'roundEnd' ? 'Fim da batalha' : '', text: state.message ?? '', tone: '', icon: anchor };
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
