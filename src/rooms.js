/**
 * As salas: estado da partida, maquina de rodadas e os handlers de socket.
 *
 * Um processo hospeda todas as salas em memoria — nao ha banco, e reiniciar o
 * servidor derruba as partidas em andamento. E de proposito: sala e efemera,
 * vive de codigo de 4 letras e morre quando esvazia.
 */
import { randomUUID } from 'node:crypto';
import {
  MODES, getUniverse, sanitizeSettings, isUntilRight, scopeFilter, scopeReach, scopeLabel,
  compareGuess, scoreForWin, SCORE_CHOOSER_SURVIVED, pickSecret,
  IMPOSTOR_MIN_PLAYERS, SCORE_IMPOSTOR_WINS, SCORE_CREW_WINS, SCORE_RIGHT_VOTE, hitsOf, tallyVotes,
  BATTLE_MIN_PLAYERS, SCORE_BATTLE_SURVIVOR,
} from './game.js';
import { datasetOf as datasetFor } from './catalog.js';
import { makeQuestion, makeWhoQuestion, scoreForAnswer } from './quiz.js';
import {
  CARDS, drawOffer, isDraftRound, HAND_LIMIT, STEAL_POINTS, BET_PENALTY, EXTRA_SECONDS,
} from './cards.js';
import { valueOf } from '../shared/universes.js';
import { TOP as PICTURE_TOP, frameOf, hasPicture, prepare as preparePicture, silhouetteOf } from './picture.js';

/** Preenchido por attachRooms; broadcast e a unica coisa que depende dele. */
let io = null;

// ---------------------------------------------------------------- salas

const rooms = new Map();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1

/**
 * Janela de reconexao: por quanto tempo a cadeira de quem caiu no meio da
 * partida fica reservada, com placar, chutes e lugar na fila do duelo. Cair
 * (aba fechada, sinal ruim, F5) nao pode custar o jogo — mas a cadeira tambem
 * nao pode ficar guardada para sempre segurando o limite de 12.
 */
const RECONNECT_MS = 5 * 60 * 1000;
const RECONNECT_MIN = RECONNECT_MS / 60000;

/** Fases em que ha partida rolando: so nelas a cadeira vale ser guardada. */
const LIVE_PHASES = new Set(['choosing', 'drafting', 'playing', 'voting', 'lastGuess', 'roundEnd']);

/** Segundos para cada um escolher a carta do draft. */
const DRAFT_SECONDS = 20;
const liveMatch = (room) => LIVE_PHASES.has(room.phase);

/** Segundos da votacao do impostor e do chute final de quem foi pego. */
const VOTE_SECONDS = 40;
const LAST_GUESS_SECONDS = 40;

function newCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom(settings) {
  const room = {
    code: newCode(),
    hostId: null,
    settings: sanitizeSettings(settings),
    players: new Map(),
    order: [],
    phase: 'lobby',
    round: 0,
    secret: null,
    chooserId: null,
    chooserQueue: [],   // rodizio de quem esconde no duelo e de quem e o impostor (ver nextChooser)
    impostorId: null,   // so no modo impostor; so ele e o servidor sabem, ate a rodada fechar
    cast: [],           // impostor: quem estava na mesa quando a rodada abriu (e so estes votam)
    votes: {},          // impostor: eleitor -> suspeito
    outcome: null,      // impostor: como a rodada fechou, para a tela contar
    secrets: {},        // batalha naval: jogador -> o segredo que ele escondeu
    sunk: {},           // batalha naval: jogador afundado -> { by } (quem acertou)
    question: null,     // "Qual deles?": a pergunta da rodada, com a resposta (so o servidor ve)
    askedAt: 0,         // "Qual deles?": quando a pergunta saiu, para medir a rapidez
    answers: {},        // "Qual deles?": jogador -> { index, ms }
    quizResult: null,   // "Qual deles?": o gabarito da rodada, depois que ela fecha
    // modo cartas: a mao atravessa a partida; o resto vale so a rodada
    hands: {},          // jogador -> [{ uid, id }]
    cardSeq: 0,         // para cada carta ter uid proprio (duas Peneiras na mao)
    offers: {},         // draft aberto: jogador -> as 3 cartas oferecidas
    intel: {},          // Raio-X: jogador -> [{ key, value }] do segredo, so dele
    sieved: {},         // Peneira: jogador -> ids tirados da busca dele
    bets: {},           // Aposta: jogador -> true
    extraTurns: {},     // Chute duplo: jogador -> chutes a mais nesta vez
    frozen: {},         // Congelar: jogador -> perde a proxima vez
    rows: [],
    turnPlayerId: null,
    pausedAfter: null,  // de quem era a vez quando a rodada parou (ver pauseRound)
    guessesLeft: {},
    deadline: null,
    timer: null,
    winnerId: null,
    message: null,
    summary: null,
    lastActivity: Date.now(),
  };
  rooms.set(room.code, room);
  return room;
}

/** null = sem teto de chutes (rodada "ate acertar"). */
const guessBudget = (room) => (isUntilRight(room.settings) ? null : room.settings.guessesPerPlayer);
const hasGuessLeft = (left) => left === null || left > 0;
/** Cuidado: `?? 0` transformaria null (ilimitado) em zero. */
const guessesOf = (room, id) => (id in room.guessesLeft ? room.guessesLeft[id] : 0);

const universeOf = (room) => getUniverse(room.settings.universe);
const datasetOf = (room) => datasetFor(room.settings.universe);
const itemById = (room, id) => datasetOf(room).byId.get(Number(id));

/**
 * Candidatos a segredo: so os com dados completos, dentro do recorte da sala
 * (quando o universo tem um) e dos grupos ligados. Cada filtro so vale se
 * sobrar alguem — combinacao vazia cai para a fatia anterior em vez de travar
 * a rodada.
 */
function pool(room) {
  const groups = new Set(room.settings.groups);
  const inScope = scopeFilter(universeOf(room), room.settings.scope);

  // jogando de imagem, quem nao tem miniatura nao pode ser o segredo: a rodada
  // inteira e a figura, e sem ela nao ha o que adivinhar
  const eligible = datasetOf(room).list.filter(item =>
    item.eligible && (!room.settings.picture || hasPicture(item)));
  const scoped = eligible.filter(inScope);
  const base = scoped.length ? scoped : eligible;
  const filtered = base.filter(item => groups.has(item.group));
  return filtered.length ? filtered : base;
}

/**
 * Em que degrau da escada (picture.js) a rodada esta: um por chute ja dado na
 * mesa. Aqui nao ha bilhete assinado como no desafio do dia — a sala nao
 * pergunta nada ao jogador, e o servidor e quem empurra o estado. Ninguem
 * consegue pedir um degrau que a rodada ainda nao alcancou porque ninguem pede
 * coisa nenhuma.
 */
const pictureOf = (room) => {
  if (!room.settings.picture || !room.secret) return null;
  const level = Math.min(PICTURE_TOP, room.rows.length);
  return { level, top: PICTURE_TOP, src: frameOf(room.settings.universe, room.secret, level) };
};

const activePlayers = (room) => room.order.map(id => room.players.get(id)).filter(p => p && p.connected);

const isImpostorMode = (room) => room.settings.mode === MODES.IMPOSTOR;
const isBattle = (room) => room.settings.mode === MODES.BATTLE;
const isQuiz = (room) => room.settings.mode === MODES.QUIZ;
const isCards = (room) => room.settings.mode === MODES.CARDS;

/** A pergunta do jeito que vai para a tela: sem a resposta. */
function questionFor(room) {
  const q = room.question;
  if (!q) return null;
  // "Quem é esse?": as opcoes vao sem figura — com ela, bastava casar a
  // silhueta com o desenho. A figura de cada uma chega no gabarito
  const who = q.kind === 'who';
  return {
    kind: q.kind,
    prompt: q.prompt,
    label: q.label,
    value: q.value,
    columnKey: q.columnKey,
    image: who ? q.image : null,
    options: q.options.map(o => ({ id: o.id, name: o.name, sprite: who ? null : o.sprite })),
  };
}

/**
 * O que so quem olha pode ver no modo cartas: a propria mao, as cartas do
 * draft aberto, o que o Raio-X revelou e o que a Peneira tirou da busca.
 */
function cardsStateFor(room, viewerId) {
  return {
    myHand: room.hands[viewerId] ?? [],
    myOffer: room.phase === 'drafting' ? room.offers[viewerId] ?? null : null,
    drafting: room.phase === 'drafting' ? Object.keys(room.offers) : [],
    myIntel: room.intel[viewerId] ?? [],
    mySieve: room.sieved[viewerId] ?? [],
    myBet: Boolean(room.bets[viewerId]),
    myExtra: room.extraTurns[viewerId] ?? 0,
  };
}

/** Batalha naval: quem esta na batalha e ainda tem o segredo de pe. */
const afloat = (room) => room.cast.filter(id => !room.sunk[id]);

/**
 * Os segredos da batalha que cada um pode ver: o proprio, e os que ja foram
 * afundados (esses viram de todo mundo). No fim da partida, todos.
 */
function battleSecretsFor(room, viewerId, over) {
  const out = {};
  for (const [id, item] of Object.entries(room.secrets)) {
    // o item inteiro, como o `secret` dos outros modos: o gabarito do afundado
    // mostra as colunas dele, e so com o nome as fichas saiam todas em branco
    if (over || id === viewerId || room.sunk[id]) out[id] = item;
  }
  return out;
}

/**
 * A linha do jeito que a mesa pode ver. Fora do impostor, e a linha inteira.
 * No impostor, com a rodada aberta, as cores ficam no servidor: vai so quantas
 * colunas acertaram em cheio — e, se a sala ligou a ficha, os valores do
 * proprio chutado, sem comparacao nenhuma. Mandar as celulas e esconder na
 * tela nao serviria: o impostor abriria o devtools e leria as cores.
 */
function rowFor(room, row, revealed) {
  if (!isImpostorMode(room) || revealed) return row;
  const { cells, ...rest } = row;
  const masked = { ...rest, total: Object.keys(cells ?? {}).length };
  if (room.settings.card && cells) {
    masked.cells = Object.fromEntries(Object.entries(cells).map(([key, cell]) =>
      [key, { value: cell.value, status: 'plain', hint: null }]));
  }
  return masked;
}

/**
 * O estado da sala visto por um jogador. Quase tudo e igual para todos; o que
 * muda e o que cada um tem o direito de saber. No impostor, durante a rodada,
 * o segredo vai para todo mundo menos o impostor — e so ele recebe o papel.
 */
function publicState(room, viewerId = null) {
  const over = room.phase === 'roundEnd' || room.phase === 'gameOver';
  const impostorMode = isImpostorMode(room);
  const inRound = impostorMode && ['playing', 'voting', 'lastGuess'].includes(room.phase);
  const isImpostor = impostorMode && viewerId !== null && viewerId === room.impostorId;
  const showSecret = over || (inRound && !isImpostor);
  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    settings: room.settings,
    hostId: room.hostId,
    players: room.order.map(id => {
      const p = room.players.get(id);
      return {
        id: p.id, name: p.name, score: p.score, connected: p.connected,
        guessesLeft: guessesOf(room, p.id),
        // modo cartas: a sala ve quantas cartas cada um tem, nunca quais
        cards: isCards(room) ? (room.hands[p.id]?.length ?? 0) : undefined,
        frozen: isCards(room) ? Boolean(room.frozen[p.id]) : undefined,
      };
    }),
    turnPlayerId: room.turnPlayerId,
    chooserId: room.chooserId,
    rows: room.rows.map(row => rowFor(room, row, over)),
    deadline: room.deadline,
    winnerId: room.winnerId,
    message: room.message,
    summary: room.summary,
    secret: showSecret && room.secret ? room.secret : null,
    picture: pictureOf(room),
    // impostor: o papel de quem olha, e o nome do impostor so depois da rodada
    // (ou na hora do chute final, quando a mesa ja apontou para ele)
    role: inRound ? (isImpostor ? 'impostor' : 'crew') : null,
    impostorId: impostorMode && (over || room.phase === 'lastGuess') ? room.impostorId : null,
    cast: impostorMode || isBattle(room) || isQuiz(room) ? room.cast : [],
    // batalha naval: quem ja escondeu (na escolha), quem afundou, e os segredos
    // que quem olha tem direito de ver
    chosen: isBattle(room) && room.phase === 'choosing' ? Object.keys(room.secrets) : [],
    sunk: isBattle(room) ? room.sunk : {},
    secrets: isBattle(room) ? battleSecretsFor(room, viewerId, over) : {},
    // "Qual deles?": a pergunta, quem ja respondeu (nao o que), a propria
    // resposta, e o gabarito quando a rodada fecha
    question: isQuiz(room) ? questionFor(room) : null,
    answered: isQuiz(room) && room.phase === 'playing' ? Object.keys(room.answers) : [],
    myAnswer: isQuiz(room) && viewerId ? room.answers[viewerId]?.index ?? null : null,
    quizResult: isQuiz(room) && over ? room.quizResult : null,
    // modo cartas: a propria mao inteira; dos outros, so quantas (em players)
    ...(isCards(room) ? cardsStateFor(room, viewerId) : {}),
    // com a urna aberta so aparece quem ja votou; em quem, so quando ela fecha
    voted: room.phase === 'voting' ? Object.keys(room.votes) : [],
    myVote: room.phase === 'voting' && viewerId ? room.votes[viewerId] ?? null : null,
    votes: impostorMode && (over || room.phase === 'lastGuess') ? room.votes : null,
    outcome: over ? room.outcome : null,
  };
}

/**
 * Cada socket recebe o proprio recorte do estado (ver publicState). Com um
 * emit so para a sala, o segredo do impostor teria de ir para todos ou para
 * ninguem.
 */
function broadcast(room) {
  room.lastActivity = Date.now();
  for (const socketId of io.sockets.adapter.rooms.get(room.code) ?? []) {
    const socket = io.sockets.sockets.get(socketId);
    socket?.emit('room:state', publicState(room, socket.data.playerId ?? null));
  }
}

function clearTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
  room.deadline = null;
}

function armTimer(room, seconds, onExpire) {
  clearTimer(room);
  room.deadline = Date.now() + seconds * 1000;
  room.timer = setTimeout(() => {
    room.timer = null;
    room.deadline = null;
    onExpire();
  }, seconds * 1000 + 250);
}

// ---------------------------------------------------------------- rodadas

/**
 * Pode chutar agora: conectado, fora da cadeira de quem escondeu o segredo e
 * com chute sobrando. Quem entra no meio da rodada fica com 0 e so joga na
 * proxima; no "ate acertar" o saldo e null (ilimitado).
 */
function canGuess(room, id) {
  const p = room.players.get(id);
  // na batalha so atira quem esta nela e ainda tem o segredo de pe: afundou,
  // sai do rodizio e so assiste
  if (isBattle(room) && (!room.cast.includes(id) || room.sunk[id])) return false;
  return Boolean(p && p.connected && id !== room.chooserId && hasGuessLeft(guessesOf(room, id)));
}

/** Proximo jogador na ordem circular que ainda pode chutar. */
function nextTurn(room, afterId) {
  const start = afterId ? room.order.indexOf(afterId) : -1;
  for (let step = 1; step <= room.order.length; step++) {
    const candidate = room.order[(start + step + room.order.length) % room.order.length];
    if (canGuess(room, candidate)) return candidate;
  }
  return null;
}

/**
 * Quem abre a rodada. Com dois ou mais na fila o primeiro turno e sorteado:
 * sem isso quem entrou primeiro na sala abriria todas as rodadas, e abrir vale
 * mais — o acerto perde 5 pontos por chute ja feito, entao a primeira vez e a
 * mais barata. Sorteia so a largada: o rodizio dali em diante segue a ordem
 * da sala, como antes.
 */
function firstTurn(room) {
  const queue = room.order.filter(id => canGuess(room, id));
  if (queue.length < 2) return queue[0] ?? null;
  return queue[Math.floor(Math.random() * queue.length)];
}

/** Fisher-Yates. So para a fila do duelo nao comecar sempre pelo host. */
function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Quem esconde o segredo na rodada, tirado de uma fila circular em vez de
 * sorteado. Esconder e a cadeira ruim — quem esconde nao chuta e so pontua se
 * ninguem acertar —, e no sorteio puro dava para cair nela varias rodadas
 * seguidas. Na fila, quem acabou de esconder vai para o fim: a vez so volta
 * depois que todo mundo passou.
 *
 * A fila se conserta sozinha, entao entrar e sair no meio da partida nao a
 * desalinha: quem chegou depois entra no fim, quem saiu de vez perde o lugar e
 * quem esta desconectado e pulado sem perder o dele — volta a ser o proximo
 * quando reconectar.
 */
function nextChooser(room) {
  const active = activePlayers(room);

  const queued = new Set(room.chooserQueue);
  for (const p of active) if (!queued.has(p.id)) room.chooserQueue.push(p.id);
  room.chooserQueue = room.chooserQueue.filter(id => room.players.has(id));

  const connected = new Set(active.map(p => p.id));
  const at = room.chooserQueue.findIndex(id => connected.has(id));
  if (at < 0) return null;

  const [chosen] = room.chooserQueue.splice(at, 1);
  room.chooserQueue.push(chosen);
  return chosen;
}

function startRound(room) {
  // sala vazia (todos caíram): nao adianta sortear, e no duelo quebraria
  if (!activePlayers(room).length) {
    clearTimer(room);
    room.phase = 'lobby';
    room.message = 'Todo mundo caiu. A partida voltou para o lobby, com as vagas de pé.';
    return broadcast(room);
  }

  room.round += 1;
  room.rows = [];
  room.pausedAfter = null;
  room.winnerId = null;
  room.message = null;
  room.summary = null;
  room.secret = null;
  room.impostorId = null;
  room.cast = [];
  room.votes = {};
  room.outcome = null;
  room.secrets = {};
  room.sunk = {};
  room.question = null;
  room.answers = {};
  room.quizResult = null;
  // cartas: os efeitos valem a rodada; a mao fica
  room.offers = {};
  room.intel = {};
  room.sieved = {};
  room.bets = {};
  room.extraTurns = {};
  room.frozen = {};
  room.guessesLeft = {};
  for (const p of room.players.values()) room.guessesLeft[p.id] = guessBudget(room);

  if (isQuiz(room)) return askQuestion(room);

  if (isBattle(room)) {
    // todo mundo esconde ao mesmo tempo; quem nao escolher a tempo ganha um
    // segredo sorteado, como no duelo
    room.chooserId = null;
    room.cast = activePlayers(room).map(p => p.id);
    room.phase = 'choosing';
    room.turnPlayerId = null;
    room.message = 'Cada um esconde o seu segredo. Quando todos esconderem, a batalha começa.';
    broadcast(room);
    armTimer(room, 40, () => {
      if (room.phase !== 'choosing') return;
      const missing = room.cast.filter(id => !room.secrets[id]);
      for (const id of missing) room.secrets[id] = pickFreeSecret(room);
      if (missing.length) room.message = 'Tempo esgotado: quem não escondeu recebeu um segredo sorteado.';
      startBattle(room);
    });
    return;
  }

  if (room.settings.mode === MODES.DUEL) {
    // a cadeira de quem esconde circula pela fila, em vez de ser sorteada
    room.chooserId = nextChooser(room);
    room.guessesLeft[room.chooserId] = 0;
    room.phase = 'choosing';
    room.turnPlayerId = null;
    broadcast(room);
    armTimer(room, 40, () => {
      if (room.phase !== 'choosing') return;
      room.secret = pickSecret(pool(room));
      room.message = 'Tempo esgotado: o segredo foi sorteado pelo servidor.';
      beginGuessing(room);
    });
    return;
  }

  room.chooserId = null;
  room.secret = pickSecret(pool(room));
  if (isImpostorMode(room)) {
    // o impostor sai da mesma fila circular do duelo: ninguem repete seguido
    room.impostorId = nextChooser(room);
    room.cast = activePlayers(room).map(p => p.id);
  }
  // modo cartas: a cada N rodadas, o draft vem antes do primeiro chute
  if (isCards(room) && isDraftRound(room.round, room.settings.draftEvery)) return startDraft(room);
  beginGuessing(room);
}

/**
 * O cronometro existe para a vez nao travar no versus. Jogando sozinho nao ha
 * para quem passar a bola, entao nao ha tempo: o jogador pensa a vontade.
 */
function armTurnTimer(room) {
  if (activePlayers(room).length < 2) return clearTimer(room);
  armTimer(room, room.settings.turnSeconds, () => onTurnTimeout(room));
}

function beginGuessing(room) {
  /**
   * A escada da imagem fica pronta antes de o primeiro chute chegar. Gerar
   * custa uns 40 ms e `publicState` e sincrono: sem adiantar isto, o quadro
   * chegaria vazio no broadcast e so apareceria no seguinte. Quando os quadros
   * ficam prontos, um broadcast extra os entrega — e se a rodada ja tiver
   * virado, ele so repete o estado que todo mundo ja tem.
   */
  if (room.settings.picture && room.secret) {
    preparePicture(room.settings.universe, room.secret).then(() => {
      if (rooms.get(room.code) === room) broadcast(room);
    });
  }

  room.phase = 'playing';
  room.turnPlayerId = firstTurn(room);
  if (!room.turnPlayerId) return awaitingReturn(room) ? pauseRound(room, null) : outOfGuesses(room);
  armTurnTimer(room);
  broadcast(room);
}

/**
 * Ninguem pode chutar agora, mas ha cadeira guardada que poderia chutar de
 * volta. Sem isto, um F5 de quem esta jogando sozinho fecharia a propria
 * rodada — justamente o acidente que a vaga guardada existe para desfazer.
 */
function awaitingReturn(room) {
  // quem afundou na batalha nao volta a atirar: a rodada nao espera por ele
  const outOfBattle = (p) => isBattle(room) && (room.sunk[p.id] || !room.cast.includes(p.id));
  return [...room.players.values()].some(p =>
    !p.connected && p.leftAt && p.id !== room.chooserId && !outOfBattle(p) && hasGuessLeft(guessesOf(room, p.id)));
}

/** Congela a rodada ate alguem voltar; `pausedAfter` guarda o rodizio. */
function pauseRound(room, afterId) {
  clearTimer(room);
  room.pausedAfter = afterId;
  room.turnPlayerId = null;
  room.message = `A rodada parou, esperando quem caiu voltar (até ${RECONNECT_MIN} minutos).`;
  broadcast(room);
}

/**
 * Destrava a rodada parada. Se ha quem chute, o rodizio segue de onde parou;
 * se nao ha mais ninguem por quem esperar (a ultima vaga venceu), a rodada
 * fecha como teria fechado se a queda nao tivesse acontecido.
 */
function unpause(room) {
  if (room.phase !== 'playing' || room.turnPlayerId) return;
  const next = nextTurn(room, room.pausedAfter);
  if (next) {
    room.pausedAfter = null;
    room.turnPlayerId = next;
    room.message = null;
    return armTurnTimer(room);
  }
  if (!awaitingReturn(room)) outOfGuesses(room);
}

function onTurnTimeout(room) {
  if (room.phase !== 'playing') return;
  const late = room.players.get(room.turnPlayerId);
  if (late) {
    const left = room.guessesLeft[late.id];
    if (left !== null) room.guessesLeft[late.id] = Math.max(0, (left ?? 0) - 1);
    room.message = `${late.name} perdeu a vez (tempo esgotado).`;
  }
  advance(room);
}

function advance(room) {
  let next = nextTurn(room, room.turnPlayerId);
  // cartas: quem foi congelado perde esta vez, e a bola passa adiante
  const skipped = [];
  while (next && room.frozen[next]) {
    delete room.frozen[next];
    skipped.push(room.players.get(next)?.name ?? 'alguém');
    next = nextTurn(room, next);
  }
  if (skipped.length) room.message = `${skipped.join(', ')} estava congelado e perdeu a vez.`;
  if (!next) return awaitingReturn(room) ? pauseRound(room, room.turnPlayerId) : outOfGuesses(room);
  room.turnPlayerId = next;
  armTurnTimer(room);
  broadcast(room);
}

/**
 * Os chutes da mesa acabaram. Nos outros modos isso fecha a rodada sem
 * vencedor; no impostor e a hora de apontar o dedo.
 */
function outOfGuesses(room) {
  return isImpostorMode(room) ? startVoting(room) : endRound(room, null);
}

// ---------------------------------------------------------------- impostor

/** Quem vota: estava na mesa quando a rodada abriu e continua conectado. */
const voters = (room) => room.cast.filter(id => room.players.get(id)?.connected);

function startVoting(room) {
  clearTimer(room);
  room.phase = 'voting';
  room.turnPlayerId = null;
  room.votes = {};
  room.message = 'As voltas acabaram. Quem não sabia o segredo?';
  broadcast(room);
  armTimer(room, VOTE_SECONDS, () => {
    if (room.phase === 'voting') closeVoting(room);
  });
}

/** Fecha a urna assim que todo mundo que pode votar ja votou. */
function maybeCloseVoting(room) {
  if (room.phase !== 'voting') return;
  if (voters(room).every(id => id in room.votes)) closeVoting(room);
}

function closeVoting(room) {
  clearTimer(room);
  const { accused } = tallyVotes(room.votes);
  const impostor = room.players.get(room.impostorId);

  if (!impostor || accused !== room.impostorId) return endImpostorRound(room, 'escaped');

  // pego, mas ainda com uma chance: se descobrir o segredo pelo que a mesa
  // chutou, vence mesmo assim — e o castigo de quem ajudou demais
  room.phase = 'lastGuess';
  room.turnPlayerId = room.impostorId;
  room.message = `A mesa apontou ${impostor.name}. Última chance: qual é o segredo?`;
  broadcast(room);
  armTimer(room, LAST_GUESS_SECONDS, () => {
    if (room.phase === 'lastGuess') endImpostorRound(room, 'caught');
  });
}

/**
 * Fecha a rodada do impostor e paga os pontos. `how`:
 * - `guessed`: o impostor chutou o segredo no meio das voltas;
 * - `escaped`: a votacao nao apontou para ele (errou, empatou ou ficou vazia);
 * - `final`: pego, acertou o chute final;
 * - `caught`: pego, errou o chute final (ou deixou o tempo passar);
 * - `left`: saiu da sala de vez no meio da rodada (`leaverName` e o nome dele).
 */
function endImpostorRound(room, how, finalGuess = null, leaverName = null) {
  clearTimer(room);
  room.phase = 'roundEnd';
  room.turnPlayerId = null;

  const impostor = room.players.get(room.impostorId);
  const name = impostor?.name ?? leaverName ?? 'O impostor';
  const secretName = room.secret?.name ?? '???';
  const impostorWins = how !== 'caught' && how !== 'left';
  room.winnerId = impostorWins ? room.impostorId : null;

  if (impostorWins) {
    if (impostor) impostor.score += SCORE_IMPOSTOR_WINS;
    room.message = {
      guessed: `${name} era o impostor e chutou o segredo: ${secretName}! +${SCORE_IMPOSTOR_WINS} pontos.`,
      escaped: `${name} era o impostor e escapou da votação. +${SCORE_IMPOSTOR_WINS} pontos.`,
      final: `${name} foi pego, mas acertou o segredo no chute final: ${secretName}! +${SCORE_IMPOSTOR_WINS} pontos.`,
    }[how];
  } else {
    for (const id of room.cast) {
      const p = id === room.impostorId ? null : room.players.get(id);
      if (p) p.score += SCORE_CREW_WINS + (room.votes[id] === room.impostorId ? SCORE_RIGHT_VOTE : 0);
    }
    const tried = finalGuess ? ` Chutou ${finalGuess.name}, mas era ${secretName}.` : ` Era ${secretName}.`;
    room.message = how === 'left'
      ? `${name} era o impostor e saiu da sala. Era ${secretName}. +${SCORE_CREW_WINS} para cada um da mesa.`
      : `A mesa pegou ${name}!${tried} +${SCORE_CREW_WINS} para cada um, +${SCORE_RIGHT_VOTE} para quem votou certo.`;
  }
  room.outcome = {
    how,
    impostorId: room.impostorId,
    finalGuess: finalGuess && { id: finalGuess.id, name: finalGuess.name },
  };

  if (room.round >= room.settings.rounds) return finishMatch(room);
  broadcast(room);
  armTimer(room, 15, () => {
    if (room.phase === 'roundEnd') startRound(room);
  });
}

// ---------------------------------------------------------------- cartas

/**
 * Abre o draft: cada um recebe 3 cartas e fica com 1. Quem esta em ultimo tira
 * de um baralho mais generoso (ver drawOffer) — so quando ha ultimo de fato,
 * senao na primeira rodada, todo mundo zerado, seriam todos "ultimo". Mao
 * cheia nao recebe oferta: guardar carta demais vira acumular, nao escolher.
 */
function startDraft(room) {
  const active = activePlayers(room);
  const scores = active.map(p => p.score);
  const lowest = Math.min(...scores);
  const someoneBehind = new Set(scores).size > 1;
  room.offers = {};
  for (const p of active) {
    if ((room.hands[p.id]?.length ?? 0) >= HAND_LIMIT) continue;
    room.offers[p.id] = drawOffer(someoneBehind && p.score === lowest);
  }
  if (!Object.keys(room.offers).length) return beginGuessing(room);
  room.phase = 'drafting';
  room.turnPlayerId = null;
  room.message = 'Draft: escolha uma das três cartas.';
  broadcast(room);
  armTimer(room, DRAFT_SECONDS, () => {
    if (room.phase === 'drafting') finishDraft(room);
  });
}

function giveCard(room, playerId, cardId) {
  room.cardSeq += 1;
  (room.hands[playerId] ??= []).push({ uid: room.cardSeq, id: cardId });
}

/** Fecha o draft: quem nao escolheu a tempo leva uma das tres, sorteada. */
function finishDraft(room) {
  clearTimer(room);
  for (const [id, offer] of Object.entries(room.offers)) {
    if (room.players.has(id)) giveCard(room, id, offer[Math.floor(Math.random() * offer.length)]);
  }
  room.offers = {};
  room.message = 'Cartas na mão. Use na sua vez, antes de chutar.';
  beginGuessing(room);
}

/** Todo mundo conectado ja escolheu: nao precisa esperar o relogio. */
function maybeFinishDraft(room) {
  if (room.phase !== 'drafting') return;
  const waiting = Object.keys(room.offers).filter(id => room.players.get(id)?.connected);
  if (!waiting.length) finishDraft(room);
}

/** Aposta: quem acertou e tinha apostado leva o dobro; quem apostou e nao acertou perde. */
function settleBets(room, winnerId, points) {
  const notes = [];
  for (const id of Object.keys(room.bets)) {
    const p = room.players.get(id);
    if (!p) continue;
    if (id === winnerId) {
      p.score += points;
      notes.push(`${p.name} tinha apostado: +${points} de bônus`);
    } else {
      const lost = Math.min(BET_PENALTY, p.score);
      p.score -= lost;
      notes.push(`${p.name} apostou e perdeu ${lost}`);
    }
  }
  return notes.length ? ` ${notes.join('; ')}.` : '';
}

/**
 * Usa uma carta da mao. So na propria vez, antes de chutar: a carta e parte
 * da jogada, e fora da vez ela atropelaria o turno de outro. Carta que nao
 * pode fazer nada agora (Tempo extra sem relogio, Assalto sem ninguem com
 * ponto) e recusada e continua na mao.
 */
function useCard(room, player, uid, socket) {
  const hand = room.hands[player.id] ?? [];
  const at = hand.findIndex(c => c.uid === Number(uid));
  if (at < 0) return socket.emit('room:error', 'Essa carta não está na sua mão.');
  const card = CARDS[hand[at].id];
  const universe = universeOf(room);
  let detail = '';

  switch (hand[at].id) {
    case 'tempo': {
      if (!room.deadline) return socket.emit('room:error', 'Jogando sozinho não há relógio para ganhar tempo.');
      const left = Math.max(0, (room.deadline - Date.now()) / 1000);
      armTimer(room, left + EXTRA_SECONDS, () => onTurnTimeout(room));
      detail = `: +${EXTRA_SECONDS} s na vez`;
      break;
    }
    case 'aposta':
      if (room.bets[player.id]) return socket.emit('room:error', 'Você já apostou nesta rodada.');
      room.bets[player.id] = true;
      break;
    case 'peneira': {
      const out = new Set([...(room.sieved[player.id] ?? []), ...room.rows.map(r => r.id)]);
      const wrong = pool(room).filter(item => item.id !== room.secret.id && !out.has(item.id));
      if (!wrong.length) return socket.emit('room:error', 'Não sobrou nome errado para peneirar.');
      const take = shuffle(wrong).slice(0, Math.max(1, Math.round(wrong.length * 0.3))).map(item => item.id);
      room.sieved[player.id] = [...(room.sieved[player.id] ?? []), ...take];
      detail = `: ${take.length} nomes a menos na busca`;
      break;
    }
    case 'raiox': {
      const seen = new Set((room.intel[player.id] ?? []).map(i => i.key));
      const scope = scopeReach(universe, room.settings.scope);
      // so coluna que separa alguem: numa sala so da Gen 1, "Geração: Gen 1"
      // e o que todo mundo ja sabe, e a carta rara viraria nada
      const candidates = pool(room);
      const informative = (c) => new Set(candidates.map(item => JSON.stringify(valueOf(item, c.key, scope) ?? null))).size > 1;
      const hidden = universe.columns.filter(c => !seen.has(c.key) && informative(c));
      if (!hidden.length) return socket.emit('room:error', 'Você já viu todas as colunas do segredo.');
      const column = hidden[Math.floor(Math.random() * hidden.length)];
      (room.intel[player.id] ??= []).push({ key: column.key, value: valueOf(room.secret, column.key, scope) ?? null });
      detail = ` e viu ${column.label.toLowerCase()} do segredo`;
      break;
    }
    case 'duplo':
      room.extraTurns[player.id] = (room.extraTurns[player.id] ?? 0) + 1;
      detail = ': chuta duas vezes nesta vez';
      break;
    case 'congelar': {
      const target = nextTurn(room, player.id);
      if (!target || target === player.id) return socket.emit('room:error', 'Não há ninguém para congelar.');
      room.frozen[target] = true;
      detail = ` em ${room.players.get(target).name}, que perde a próxima vez`;
      break;
    }
    case 'assalto': {
      const [leader] = [...room.players.values()].filter(p => p.id !== player.id).sort((a, b) => b.score - a.score);
      if (!leader || leader.score <= 0) return socket.emit('room:error', 'Ninguém tem pontos para roubar.');
      const amount = Math.min(STEAL_POINTS, leader.score);
      leader.score -= amount;
      player.score += amount;
      detail = ` em ${leader.name}: ${amount} pontos roubados`;
      break;
    }
    default:
      return socket.emit('room:error', 'Carta desconhecida.');
  }

  hand.splice(at, 1);
  room.message = `${player.name} usou ${card.name}${detail}.`;
  broadcast(room);
}

// ---------------------------------------------------------------- qual deles?

/**
 * Solta a pergunta da rodada. Todo mundo responde ao mesmo tempo — nao ha vez
 * —, e o relogio e o `turnSeconds` da sala. A pergunta sai dos sorteaveis da
 * sala (grupos e recorte), entao "so a Gen 1" vale aqui tambem.
 */
/** Uma em quatro perguntas e a silhueta, onde o tema tem (ver `silhouette` no schema). */
const WHO_SHARE = 0.25;

async function askQuestion(room) {
  const universe = universeOf(room);
  const candidates = pool(room);
  let question = null;

  // "Quem é esse Pokémon?": a silhueta sai de arquivo, entao a pergunta espera
  // por ela. `asking` segura o "proxima rodada" do host nesse meio tempo — sem
  // isso, dois cliques pulariam uma pergunta
  if (universe.silhouette && Math.random() < WHO_SHARE) {
    room.asking = true;
    for (let tries = 0; tries < 3 && !question; tries++) {
      const who = makeWhoQuestion(universe, candidates, room.settings.choices, hasPicture);
      const image = who && await silhouetteOf(universe.id, who.options[who.answerIndex]);
      if (image) question = { ...who, image };
    }
    room.asking = false;
    if (rooms.get(room.code) !== room) return;   // a sala acabou enquanto a figura saia
  }

  question ??= makeQuestion(universe, candidates, room.settings.choices, scopeReach(universe, room.settings.scope));
  if (!question) {
    room.message = 'Não deu para montar pergunta com essa seleção. Marque mais opções no lobby.';
    return finishMatch(room);
  }
  room.question = question;
  room.cast = activePlayers(room).map(p => p.id);
  room.phase = 'playing';
  room.turnPlayerId = null;
  room.chooserId = null;
  room.askedAt = Date.now();
  armTimer(room, room.settings.turnSeconds, () => {
    if (room.phase === 'playing') revealQuiz(room);
  });
  broadcast(room);
}

/** Todo mundo da rodada que esta conectado ja respondeu: nao precisa esperar o relogio. */
function maybeRevealQuiz(room) {
  if (room.phase !== 'playing' || !isQuiz(room)) return;
  const waiting = room.cast.filter(id => room.players.get(id)?.connected && !(id in room.answers));
  if (!waiting.length) revealQuiz(room);
}

/**
 * Fecha a pergunta: paga quem acertou (mais rapido, mais perto de 100) e monta
 * o gabarito — a resposta, o valor de cada opcao na coluna perguntada e o que
 * cada um escolheu. O valor de cada opcao e o que ensina: errou o mais pesado,
 * ve quanto cada um pesa.
 */
function revealQuiz(room) {
  clearTimer(room);
  const q = room.question;
  const universe = universeOf(room);
  const scope = scopeReach(universe, room.settings.scope);
  const column = universe.columns.find(c => c.key === q.columnKey);
  const total = room.settings.turnSeconds * 1000;

  const picks = {};
  let fastest = null;
  for (const [id, answer] of Object.entries(room.answers)) {
    const correct = answer.index === q.answerIndex;
    const points = correct ? scoreForAnswer(answer.ms, total) : 0;
    const player = room.players.get(id);
    if (player) player.score += points;
    picks[id] = { index: answer.index, correct, points, ms: answer.ms };
    if (correct && (!fastest || answer.ms < fastest.ms)) fastest = { id, ms: answer.ms };
  }

  room.quizResult = {
    answerIndex: q.answerIndex,
    values: q.options.map(item => (!column ? null : column.kind === 'slot'
      ? (column.slots ?? [column.key]).map(k => valueOf(item, k, scope)).filter(Boolean)
      : valueOf(item, q.columnKey, scope) ?? null)),
    // as figuras de todas as opcoes: no "Quem é esse?" elas so aparecem agora
    sprites: q.options.map(item => item.sprite ?? null),
    picks,
  };
  const right = Object.values(picks).filter(p => p.correct).length;
  const answer = q.options[q.answerIndex].name;
  room.message = right
    ? `Era ${answer}. ${right === 1 ? 'Só 1 acertou' : `${right} acertaram`}; o mais rápido foi ${room.players.get(fastest.id)?.name ?? 'alguém'}.`
    : `Era ${answer}. Ninguém acertou.`;
  room.winnerId = fastest?.id ?? null;
  room.phase = 'roundEnd';

  if (room.round >= room.settings.rounds) return finishMatch(room);
  broadcast(room);
  armTimer(room, 8, () => {
    if (room.phase === 'roundEnd') startRound(room);
  });
}

// ---------------------------------------------------------------- batalha naval

/**
 * Por que um item nao pode ser segredo nesta sala, ou null se pode. Vale para
 * quem esconde no duelo e para cada um na batalha naval.
 */
function secretProblem(room, mon) {
  if (!mon) return 'Escolha inválida.';
  if (!room.settings.groups.includes(mon.group)) return `${mon.name} está fora das opções ligadas nesta sala.`;
  if (!mon.eligible) return `${mon.name} não tem dados completos o bastante para ser o segredo.`;
  if (room.settings.picture && !hasPicture(mon)) return `Esta sala joga pela imagem, e ${mon.name} não tem figura.`;
  if (!scopeFilter(universeOf(room), room.settings.scope)(mon)) {
    return `Esta sala está em "${scopeLabel(universeOf(room), room.settings.scope)}", e ${mon.name} fica de fora.`;
  }
  return null;
}

/**
 * Um segredo que ninguem da batalha escondeu ainda. Dois navios no mesmo
 * segredo fariam um chute afundar dois de uma vez — e um jogador descobriria
 * o do outro so de olhar para o proprio.
 */
function pickFreeSecret(room) {
  const taken = new Set(Object.values(room.secrets).map(item => item.id));
  const free = pool(room).filter(item => !taken.has(item.id));
  return pickSecret(free.length ? free : pool(room));
}

/** Todo mundo da batalha que esta conectado ja escondeu: comeca. */
function maybeStartBattle(room) {
  if (room.phase !== 'choosing' || !isBattle(room)) return;
  const waiting = room.cast.filter(id => room.players.get(id)?.connected && !room.secrets[id]);
  if (!waiting.length) {
    // quem caiu na escolha nao trava a batalha: fica com um segredo sorteado
    for (const id of room.cast) if (!room.secrets[id]) room.secrets[id] = pickFreeSecret(room);
    startBattle(room);
  }
}

function startBattle(room) {
  clearTimer(room);
  if (afloat(room).length < 2) {
    room.message = 'Sobrou gente de menos para a batalha.';
    return endBattle(room);
  }
  room.message = 'Todos esconderam. Escolha um alvo e atire!';
  beginGuessing(room);
}

/** Afunda o segredo de `targetId`: quem acertou pontua, e talvez a batalha acabe. */
function sink(room, attacker, targetId) {
  const target = room.players.get(targetId);
  const board = room.rows.filter(row => row.targetId === targetId).length;
  const points = scoreForWin(board);
  attacker.score += points;
  room.sunk[targetId] = { by: attacker.id };
  room.message = `${attacker.name} afundou ${target?.name ?? 'alguém'}: era ${room.secrets[targetId].name}! +${points} pontos.`;
  if (afloat(room).length <= 1) return endBattle(room);
  advance(room);
}

/**
 * Fim da batalha: quem ficou de pe leva o bonus. A partida e de uma batalha
 * so, entao daqui vai direto para o placar final.
 */
function endBattle(room) {
  clearTimer(room);
  const [survivorId] = afloat(room);
  const survivor = survivorId ? room.players.get(survivorId) : null;
  room.winnerId = survivorId ?? null;
  if (survivor) {
    survivor.score += SCORE_BATTLE_SURVIVOR;
    room.message = `${room.message ?? ''} ${survivor.name} terminou com o segredo de pé: +${SCORE_BATTLE_SURVIVOR} pontos.`.trim();
  }
  finishMatch(room);
}

/**
 * Um tiro da batalha naval: o chute vai contra o segredo de um alvo so, e a
 * linha entra no tabuleiro dele (`targetId`). Cada tabuleiro tem a propria
 * lista de nomes ja chutados — o mesmo nome pode cair em dois alvos.
 */
function battleShot(room, player, guess, targetId, socket) {
  const target = room.players.get(targetId);
  if (!target || !room.cast.includes(targetId)) return socket.emit('room:error', 'Escolha em quem atirar.');
  if (targetId === player.id) return socket.emit('room:error', 'Não dá para atirar no próprio segredo.');
  if (room.sunk[targetId]) return socket.emit('room:error', `${target.name} já afundou. Escolha outro alvo.`);
  if (room.rows.some(r => r.targetId === targetId && r.id === guess.id)) {
    return socket.emit('room:error', `${guess.name} já foi chutado no tabuleiro de ${target.name}.`);
  }
  if (!scopeFilter(universeOf(room), room.settings.scope)(guess)) {
    const epocas = scopeLabel(universeOf(room), room.settings.scope);
    return socket.emit('room:error', `Esta sala está em "${epocas}", e ${guess.name} fica de fora.`);
  }

  const comparison = compareGuess(guess, room.secrets[targetId], universeOf(room), scopeReach(universeOf(room), room.settings.scope));
  room.rows.push({
    ...comparison,
    hits: hitsOf(comparison),
    playerId: player.id,
    playerName: player.name,
    targetId,
    targetName: target.name,
  });
  room.message = null;
  if (comparison.correct) return sink(room, player, targetId);
  advance(room);
}

/**
 * Tira da batalha quem saiu de vez. O tabuleiro dele some junto — nao conta
 * como afundado, porque ninguem acertou —, e a batalha segue sem ele.
 */
function leaveBattle(room, id) {
  room.cast = room.cast.filter(x => x !== id);
  delete room.secrets[id];
  delete room.sunk[id];
  if (room.phase === 'choosing') return maybeStartBattle(room);
  if (room.phase === 'playing' && afloat(room).length <= 1) return endBattle(room);
}

/** Chute final do impostor pego: acerto vira a rodada, erro a entrega a mesa. */
function finalGuess(room, player, pokemonId, socket) {
  if (player.id !== room.impostorId) return socket.emit('room:error', 'Só o impostor chuta agora.');
  const guess = itemById(room, pokemonId);
  if (!guess) return socket.emit('room:error', 'Chute inválido.');
  endImpostorRound(room, guess.id === room.secret.id ? 'final' : 'caught', guess);
}

/** Fecha a partida e anuncia o placar final. */
function finishMatch(room) {
  clearTimer(room);
  room.phase = 'gameOver';
  room.turnPlayerId = null;

  const ranking = [...room.players.values()].sort((a, b) => b.score - a.score);
  const top = ranking[0]?.score ?? 0;
  const champs = ranking.filter(p => p.score === top);
  const final = top === 0
    ? 'Fim de jogo: ninguém pontuou.'
    : champs.length > 1
      ? `Empate entre ${champs.map(p => p.name).join(', ')} com ${top} pontos!`
      : `${champs[0].name} venceu com ${top} pontos!`;

  // separado de `message` de proposito: o placar final e o titulo da tela, e
  // a mensagem e o rodape ("encerrada pelo host"). Grudar os dois virava um
  // paragrafo unico no lugar do titulo.
  room.summary = final;
  broadcast(room);
}

function endRound(room, winnerId) {
  clearTimer(room);
  room.phase = 'roundEnd';
  room.turnPlayerId = null;
  room.winnerId = winnerId;

  if (winnerId) {
    const winner = room.players.get(winnerId);
    const points = scoreForWin(room.rows.length);
    winner.score += points;
    room.message = `${winner.name} acertou: ${room.secret.name}! +${points} pontos.`;
    if (isCards(room)) room.message += settleBets(room, winnerId, points);
  } else {
    room.message = `Ninguém acertou. Era ${room.secret?.name ?? '???'}.`;
    if (room.settings.mode === MODES.DUEL && room.chooserId) {
      const chooser = room.players.get(room.chooserId);
      if (chooser) {
        chooser.score += SCORE_CHOOSER_SURVIVED;
        room.message += ` ${chooser.name} defendeu o segredo: +${SCORE_CHOOSER_SURVIVED} pontos.`;
      }
    }
  }

  if (room.round >= room.settings.rounds) {
    return finishMatch(room);
  }

  broadcast(room);
  armTimer(room, 12, () => {
    if (room.phase === 'roundEnd') startRound(room);
  });
}

// ---------------------------------------------------------------- sockets

function findPlayerRoom(socket) {
  const room = rooms.get(socket.data.code);
  if (!room) return {};
  return { room, player: room.players.get(socket.data.playerId) };
}

const cleanName = (name) => String(name ?? '').trim().slice(0, 16) || 'Treinador';

/**
 * Sentar na sala. Com um playerId que ainda tem cadeira guardada isto e uma
 * volta: placar, chutes e lugar na fila continuam de onde pararam. O `resumed`
 * da resposta e como o cliente sabe se voltou para a propria cadeira ou entrou
 * como jogador novo (a janela de reconexao fechou, ou a sala reiniciou).
 */
function joinRoom(socket, room, name, playerId, cb) {
  const existing = room.players.get(playerId);
  const wasAway = Boolean(existing) && !existing.connected;
  if (existing) {
    existing.connected = true;
    existing.leftAt = null;
    existing.name = name;
    existing.socketId = socket.id;
  } else {
    room.players.set(playerId, { id: playerId, name, score: 0, connected: true, leftAt: null, socketId: socket.id });
    room.order.push(playerId);
    // quem entra com a rodada em andamento so joga a partir da proxima
    room.guessesLeft[playerId] = room.phase === 'lobby' ? guessBudget(room) : 0;
  }
  if (!room.hostId || !room.players.get(room.hostId)?.connected) room.hostId = playerId;

  socket.data.code = room.code;
  socket.data.playerId = playerId;
  socket.join(room.code);
  unpause(room);

  // so nas fases em que `message` e recado de bastidor: em roundEnd ela carrega
  // o resultado da rodada, e anunciar a volta por cima apagaria o placar
  if (wasAway && ['playing', 'choosing', 'drafting', 'voting', 'lastGuess'].includes(room.phase)) {
    room.message = `${name} voltou para a partida.`;
  }

  cb?.({ code: room.code, playerId, state: publicState(room, playerId), resumed: Boolean(existing) });
  broadcast(room);
}

/** Tira o jogador da sala de vez: cadeira liberada, placar esquecido. */
function dropPlayer(room, id) {
  room.players.delete(id);
  room.order = room.order.filter(x => x !== id);
  delete room.guessesLeft[id];
}

/**
 * Sair da sala tem dois sabores. Clicar em sair, ou cair ainda no lobby,
 * libera a cadeira na hora — ha intencao clara, ou nao ha placar em jogo.
 * Cair com a partida rolando e outra coisa: a cadeira fica guardada por
 * RECONNECT_MS e `room:join` com o mesmo playerId devolve o jogador a ela,
 * com placar, chutes e lugar na fila intactos.
 */
function handleDisconnect(socket, permanent) {
  const { room, player } = findPlayerRoom(socket);
  if (!room || !player) return;
  socket.leave(room.code);

  const keepSeat = !permanent && room.phase !== 'lobby';
  if (keepSeat) {
    player.connected = false;
    player.leftAt = Date.now();
  } else {
    dropPlayer(room, player.id);
  }

  if (room.hostId === player.id) room.hostId = activePlayers(room)[0]?.id ?? null;

  const verb = keepSeat ? 'caiu' : 'saiu';
  const seat = keepSeat ? ` A vaga fica guardada por ${RECONNECT_MIN} minutos.` : '';

  // o impostor saiu de vez: nao ha mais quem pegar, e a mesa leva a rodada
  if (!keepSeat && isImpostorMode(room) && room.impostorId === player.id
    && ['playing', 'voting', 'lastGuess'].includes(room.phase)) {
    return endImpostorRound(room, 'left', null, player.name);
  }
  // saiu de vez da batalha naval: o tabuleiro dele some, e a batalha pode ter
  // acabado (sobrou um so) ou comecado (era o ultimo que faltava esconder)
  if (!keepSeat && isBattle(room) && room.cast.includes(player.id)) {
    room.message = `${player.name} saiu da batalha.`;
    leaveBattle(room, player.id);
    if (room.phase !== 'playing') return broadcast(room);
  }
  if (room.phase === 'playing' && room.turnPlayerId === player.id) {
    room.message = `${player.name} ${verb} no meio do turno.${seat}`;
    return advance(room);
  }
  if (room.phase === 'voting') {
    delete room.votes[player.id];
    room.message = `${player.name} ${verb}.${seat}`;
    broadcast(room);
    return maybeCloseVoting(room);
  }
  if (room.phase === 'choosing' && room.chooserId === player.id) {
    room.chooserId = null;
    room.secret = pickSecret(pool(room));
    room.message = `${player.name} ${verb}: o segredo foi sorteado.`;
    return beginGuessing(room);
  }
  // cartas: se so faltava ele escolher no draft, o draft fecha agora
  if (room.phase === 'drafting') {
    broadcast(room);
    return maybeFinishDraft(room);
  }
  // "Qual deles?": se so faltava ele responder, a pergunta fecha agora
  if (isQuiz(room) && room.phase === 'playing') {
    broadcast(room);
    return maybeRevealQuiz(room);
  }
  // na escolha da batalha, cair nao segura os outros: se so faltava ele, comeca
  if (room.phase === 'choosing' && isBattle(room)) {
    broadcast(room);
    return maybeStartBattle(room);
  }
  // roundEnd e gameOver ficam de fora: la `message` e o resultado da rodada
  if (room.phase === 'playing') room.message = `${player.name} ${verb}.${seat}`;
  broadcast(room);
}

/** Um socket = uma aba aberta. A identidade do jogador vem do playerId, nao daqui. */
function onConnection(socket) {
  socket.on('room:create', ({ name, settings }, cb) => {
    const room = createRoom(settings);
    joinRoom(socket, room, cleanName(name), randomUUID(), cb);
  });

  socket.on('room:join', ({ code, name, playerId }, cb) => {
    const room = rooms.get(String(code ?? '').toUpperCase().trim());
    if (!room) return cb?.({ error: 'Sala não encontrada.' });
    const returning = playerId && room.players.has(playerId);
    if (!returning && room.players.size >= 12) return cb?.({ error: 'Sala cheia (limite de 12).' });
    joinRoom(socket, room, cleanName(name), returning ? playerId : randomUUID(), cb);
  });

  socket.on('room:settings', (settings) => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || room.hostId !== player.id || room.phase !== 'lobby') return;
    room.settings = sanitizeSettings(settings, room.settings);
    for (const id of Object.keys(room.guessesLeft)) room.guessesLeft[id] = guessBudget(room);
    broadcast(room);
  });

  socket.on('game:start', () => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || room.hostId !== player.id) return;
    if (room.phase !== 'lobby' && room.phase !== 'gameOver') return;
    if (room.settings.mode === MODES.DUEL && activePlayers(room).length < 2) {
      return socket.emit('room:error', 'O modo duelo precisa de pelo menos 2 jogadores.');
    }
    if (room.settings.mode === MODES.IMPOSTOR && activePlayers(room).length < IMPOSTOR_MIN_PLAYERS) {
      return socket.emit('room:error', `O impostor precisa de pelo menos ${IMPOSTOR_MIN_PLAYERS} jogadores.`);
    }
    if (isBattle(room) && activePlayers(room).length < BATTLE_MIN_PLAYERS) {
      return socket.emit('room:error', `A batalha naval precisa de pelo menos ${BATTLE_MIN_PLAYERS} jogadores.`);
    }
    for (const p of room.players.values()) p.score = 0;
    room.hands = {};   // partida nova, mao vazia
    room.round = 0;
    // embaralhada na largada: em ordem de chegada o host esconderia sempre primeiro
    room.chooserQueue = shuffle(activePlayers(room).map(p => p.id));
    startRound(room);
  });

  socket.on('game:choose', ({ pokemonId }) => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || room.phase !== 'choosing') return;
    const mon = itemById(room, pokemonId);
    const problem = secretProblem(room, mon);

    // batalha naval: cada um esconde o proprio, ao mesmo tempo, e da para
    // trocar enquanto a escolha nao fecha
    if (isBattle(room)) {
      if (!room.cast.includes(player.id)) return socket.emit('room:error', 'Você entrou depois: espera a próxima batalha.');
      if (problem) return socket.emit('room:error', problem);
      const takenBy = Object.entries(room.secrets).find(([id, item]) => id !== player.id && item.id === mon.id);
      if (takenBy) return socket.emit('room:error', `${mon.name} já foi escondido por outra pessoa. Escolha outro.`);
      room.secrets[player.id] = mon;
      broadcast(room);
      return maybeStartBattle(room);
    }

    if (room.chooserId !== player.id) return;
    if (problem) return socket.emit('room:error', problem);
    clearTimer(room);
    room.secret = mon;
    room.message = `${player.name} escolheu o segredo.`;
    beginGuessing(room);
  });

  socket.on('game:guess', ({ pokemonId, targetId }) => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player) return;
    if (room.phase === 'lastGuess') return finalGuess(room, player, pokemonId, socket);
    if (room.phase !== 'playing') return;
    if (room.turnPlayerId !== player.id) return socket.emit('room:error', 'Não é a sua vez.');
    if (!hasGuessLeft(guessesOf(room, player.id))) return socket.emit('room:error', 'Você não tem mais chutes.');

    const guess = itemById(room, pokemonId);
    if (!guess) return socket.emit('room:error', 'Chute inválido.');
    if (isBattle(room)) return battleShot(room, player, guess, targetId, socket);
    if (room.rows.some(r => r.id === guess.id)) return socket.emit('room:error', `${guess.name} já foi chutado.`);
    // a busca do chute ja esconde quem esta fora do recorte, mas quem esconde e
    // o navegador: com uma aba de antes da troca de recorte o nome ainda chega
    // aqui. E o recorte nao e preferencia, e o combinado da sala — quem parou no
    // Shippūden nao pode receber uma dica sobre o Boruto
    if (!scopeFilter(universeOf(room), room.settings.scope)(guess)) {
      const epocas = scopeLabel(universeOf(room), room.settings.scope);
      return socket.emit('room:error', `Esta sala está em "${epocas}", e ${guess.name} fica de fora.`);
    }

    // quem sabe o segredo nao pode chuta-lo: seria entregar a rodada ao impostor
    if (isImpostorMode(room) && player.id !== room.impostorId && guess.id === room.secret.id) {
      return socket.emit('room:error', 'Esse é o segredo: chutar ele entregaria o jogo ao impostor.');
    }

    if (room.guessesLeft[player.id] !== null) room.guessesLeft[player.id] -= 1;
    /**
     * Jogando de imagem a tabela nao vai para a tela, entao a comparacao nem e
     * feita: mandar as celulas que ninguem mostra seria deixar a tabela inteira
     * no devtools de quem escolheu jogar sem ela. Sobra a lista de quem ja foi
     * chutado, que e o que a rodada precisa para nao repetir nome.
     */
    const comparison = room.settings.picture
      ? { id: guess.id, name: guess.name, sprite: guess.sprite, correct: guess.id === room.secret.id }
      : compareGuess(guess, room.secret, universeOf(room), scopeReach(universeOf(room), room.settings.scope));
    room.rows.push({ ...comparison, hits: hitsOf(comparison), playerId: player.id, playerName: player.name });
    room.message = null;

    const row = room.rows[room.rows.length - 1];
    if (row.correct) {
      // no impostor so ele consegue acertar: a mesa e barrada logo acima
      return isImpostorMode(room) ? endImpostorRound(room, 'guessed') : endRound(room, player.id);
    }
    // Chute duplo: a vez fica com ele para mais um chute (se ainda tiver saldo)
    if (isCards(room) && room.extraTurns[player.id] && hasGuessLeft(guessesOf(room, player.id))) {
      room.extraTurns[player.id] -= 1;
      room.message = `${player.name} chuta de novo (Chute duplo).`;
      armTurnTimer(room);
      return broadcast(room);
    }
    advance(room);
  });

  // modo cartas: a carta escolhida no draft
  socket.on('game:draft', ({ index }) => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || room.phase !== 'drafting') return;
    const offer = room.offers[player.id];
    if (!offer) return;
    const card = offer[Number(index)];
    if (!card) return socket.emit('room:error', 'Carta inválida.');
    giveCard(room, player.id, card);
    delete room.offers[player.id];
    broadcast(room);
    maybeFinishDraft(room);
  });

  // modo cartas: usar uma carta da mao, na propria vez
  socket.on('game:card', ({ uid }) => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || !isCards(room) || room.phase !== 'playing') return;
    if (room.turnPlayerId !== player.id) return socket.emit('room:error', 'Cartas só na sua vez, antes de chutar.');
    useCard(room, player, uid, socket);
  });

  socket.on('game:vote', ({ suspectId }) => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || room.phase !== 'voting') return;
    if (!room.cast.includes(player.id)) return socket.emit('room:error', 'Você entrou no meio da rodada e não vota nesta.');
    if (suspectId === player.id) return socket.emit('room:error', 'Não dá para votar em si mesmo.');
    if (!room.cast.includes(suspectId)) return socket.emit('room:error', 'Voto inválido.');
    room.votes[player.id] = suspectId;
    broadcast(room);
    maybeCloseVoting(room);
  });

  // "Qual deles?": uma resposta por pergunta, sem troca — a rapidez e o ponto
  socket.on('game:answer', ({ index }) => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || !isQuiz(room) || room.phase !== 'playing') return;
    if (!room.cast.includes(player.id)) return socket.emit('room:error', 'Você entrou no meio da pergunta: responde a próxima.');
    if (player.id in room.answers) return;
    const choice = Number(index);
    if (!Number.isInteger(choice) || choice < 0 || choice >= room.question.options.length) {
      return socket.emit('room:error', 'Resposta inválida.');
    }
    room.answers[player.id] = { index: choice, ms: Date.now() - room.askedAt };
    broadcast(room);
    maybeRevealQuiz(room);
  });

  // valvula de escape do host: uma rodada "ate acertar" nao fecha sozinha
  socket.on('game:end', () => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || room.hostId !== player.id) return;
    if (!['playing', 'voting', 'lastGuess', 'roundEnd'].includes(room.phase)) return;
    if (room.phase !== 'roundEnd') {
      room.message = 'Partida encerrada pelo host.';
    }
    finishMatch(room);
  });

  socket.on('game:next', () => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || room.hostId !== player.id) return;
    if (room.phase === 'roundEnd' && !room.asking) {
      clearTimer(room);
      startRound(room);
    }
  });

  socket.on('room:leave', () => handleDisconnect(socket, true));
  socket.on('disconnect', () => handleDisconnect(socket, false));
}

/**
 * Faxina: primeiro as cadeiras guardadas que passaram da janela de reconexao,
 * depois as salas que ninguem mais abre. As cadeiras so vencem com a partida
 * rolando — no fim de jogo elas sao o placar final, e apagar quem caiu no
 * ultimo minuto seria reescrever o resultado.
 */
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (liveMatch(room)) {
      const expired = [...room.players.values()]
        .filter(p => !p.connected && p.leftAt && now - p.leftAt > RECONNECT_MS);
      for (const p of expired) {
        dropPlayer(room, p.id);
        // a vaga venceu no meio da batalha: sai dela como quem saiu de vez
        if (isBattle(room) && room.cast.includes(p.id)) leaveBattle(room, p.id);
        if (room.hostId === p.id) room.hostId = activePlayers(room)[0]?.id ?? null;
      }
      if (expired.length) {
        unpause(room);
        broadcast(room);
      }
    }
    if (!activePlayers(room).length && room.lastActivity < now - 30 * 60 * 1000) {
      clearTimer(room);
      rooms.delete(code);
    }
  }
}, 60 * 1000).unref();

/** Liga a maquina de salas a um servidor socket.io ja criado. */
export function attachRooms(server) {
  io = server;
  io.on('connection', onConnection);
}
