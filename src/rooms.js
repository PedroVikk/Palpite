/**
 * As salas: estado da partida, maquina de rodadas e os handlers de socket.
 *
 * Um processo hospeda todas as salas em memoria — nao ha banco, e reiniciar o
 * servidor derruba as partidas em andamento. E de proposito: sala e efemera,
 * vive de codigo de 4 letras e morre quando esvazia.
 */
import { randomUUID } from 'node:crypto';
import {
  MODES, getUniverse, sanitizeSettings, isEndless,
  compareGuess, scoreForWin, SCORE_CHOOSER_SURVIVED, pickSecret,
} from './game.js';
import { datasetOf as datasetFor } from './catalog.js';

/** Preenchido por attachRooms; broadcast e a unica coisa que depende dele. */
let io = null;

// ---------------------------------------------------------------- salas

const rooms = new Map();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1

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
    rows: [],
    turnPlayerId: null,
    guessesLeft: {},
    deadline: null,
    timer: null,
    winnerId: null,
    message: null,
    lastActivity: Date.now(),
  };
  rooms.set(room.code, room);
  return room;
}

/** null = sem teto de chutes (partida sem fim). */
const guessBudget = (room) => (isEndless(room.settings) ? null : room.settings.guessesPerPlayer);
const hasGuessLeft = (left) => left === null || left > 0;
/** Cuidado: `?? 0` transformaria null (ilimitado) em zero. */
const guessesOf = (room, id) => (id in room.guessesLeft ? room.guessesLeft[id] : 0);

const universeOf = (room) => getUniverse(room.settings.universe);
const datasetOf = (room) => datasetFor(room.settings.universe);
const itemById = (room, id) => datasetOf(room).byId.get(Number(id));

/** Candidatos a segredo: so os grupos ligados na sala, e so os com dados completos. */
function pool(room) {
  const groups = new Set(room.settings.groups);
  const eligible = datasetOf(room).list.filter(item => item.eligible);
  const filtered = eligible.filter(item => groups.has(item.group));
  return filtered.length ? filtered : eligible;
}

const activePlayers = (room) => room.order.map(id => room.players.get(id)).filter(p => p && p.connected);

function publicState(room) {
  const showSecret = room.phase === 'roundEnd' || room.phase === 'gameOver';
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
      };
    }),
    turnPlayerId: room.turnPlayerId,
    chooserId: room.chooserId,
    rows: room.rows,
    deadline: room.deadline,
    winnerId: room.winnerId,
    message: room.message,
    secret: showSecret && room.secret ? room.secret : null,
  };
}

function broadcast(room) {
  room.lastActivity = Date.now();
  io.to(room.code).emit('room:state', publicState(room));
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

/** Proximo jogador na ordem circular que ainda pode chutar. */
function nextTurn(room, afterId) {
  const canPlay = (id) => {
    const p = room.players.get(id);
    return p && p.connected && id !== room.chooserId && hasGuessLeft(guessesOf(room, id));
  };
  const start = afterId ? room.order.indexOf(afterId) : -1;
  for (let step = 1; step <= room.order.length; step++) {
    const candidate = room.order[(start + step + room.order.length) % room.order.length];
    if (canPlay(candidate)) return candidate;
  }
  return null;
}

function startRound(room) {
  // sala vazia (todos caíram): nao adianta sortear, e no duelo quebraria
  if (!activePlayers(room).length) {
    clearTimer(room);
    room.phase = 'lobby';
    room.message = 'Todo mundo saiu. A partida voltou para o lobby.';
    return broadcast(room);
  }

  room.round += 1;
  room.rows = [];
  room.winnerId = null;
  room.message = null;
  room.secret = null;
  room.guessesLeft = {};
  for (const p of room.players.values()) room.guessesLeft[p.id] = guessBudget(room);

  if (room.settings.mode === MODES.DUEL) {
    const players = activePlayers(room);
    room.chooserId = players[(room.round - 1) % players.length].id;
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
  room.phase = 'playing';
  room.turnPlayerId = nextTurn(room, null);
  if (!room.turnPlayerId) return endRound(room, null);
  armTurnTimer(room);
  broadcast(room);
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
  const next = nextTurn(room, room.turnPlayerId);
  if (!next) return endRound(room, null);
  room.turnPlayerId = next;
  armTurnTimer(room);
  broadcast(room);
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

  room.message = room.message ? `${room.message} ${final}` : final;
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

  // na partida sem fim as rodadas seguem ate o host mandar encerrar
  if (!isEndless(room.settings) && room.round >= room.settings.rounds) {
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

function joinRoom(socket, room, name, playerId, cb) {
  const existing = room.players.get(playerId);
  if (existing) {
    existing.connected = true;
    existing.name = name;
    existing.socketId = socket.id;
  } else {
    room.players.set(playerId, { id: playerId, name, score: 0, connected: true, socketId: socket.id });
    room.order.push(playerId);
    // quem entra com a rodada em andamento so joga a partir da proxima
    room.guessesLeft[playerId] = room.phase === 'lobby' ? guessBudget(room) : 0;
  }
  if (!room.hostId || !room.players.get(room.hostId)?.connected) room.hostId = playerId;

  socket.data.code = room.code;
  socket.data.playerId = playerId;
  socket.join(room.code);
  cb?.({ code: room.code, playerId, state: publicState(room) });
  broadcast(room);
}

function handleDisconnect(socket, permanent) {
  const { room, player } = findPlayerRoom(socket);
  if (!room || !player) return;
  socket.leave(room.code);

  if (permanent || room.phase === 'lobby') {
    room.players.delete(player.id);
    room.order = room.order.filter(id => id !== player.id);
    delete room.guessesLeft[player.id];
  } else {
    player.connected = false;
  }

  if (room.hostId === player.id) room.hostId = activePlayers(room)[0]?.id ?? null;

  if (room.phase === 'playing' && room.turnPlayerId === player.id) {
    room.message = `${player.name} saiu no meio do turno.`;
    return advance(room);
  }
  if (room.phase === 'choosing' && room.chooserId === player.id) {
    room.chooserId = null;
    room.secret = pickSecret(pool(room));
    room.message = `${player.name} saiu: o segredo foi sorteado.`;
    return beginGuessing(room);
  }
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
    for (const p of room.players.values()) p.score = 0;
    room.round = 0;
    startRound(room);
  });

  socket.on('game:choose', ({ pokemonId }) => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || room.phase !== 'choosing' || room.chooserId !== player.id) return;
    const mon = itemById(room, pokemonId);
    if (!mon) return socket.emit('room:error', 'Escolha inválida.');
    if (!room.settings.groups.includes(mon.group)) {
      return socket.emit('room:error', `${mon.name} está fora das opções ligadas nesta sala.`);
    }
    if (!mon.eligible) {
      return socket.emit('room:error', `${mon.name} não tem dados completos o bastante para ser o segredo.`);
    }
    clearTimer(room);
    room.secret = mon;
    room.message = `${player.name} escolheu o segredo.`;
    beginGuessing(room);
  });

  socket.on('game:guess', ({ pokemonId }) => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || room.phase !== 'playing') return;
    if (room.turnPlayerId !== player.id) return socket.emit('room:error', 'Não é a sua vez.');
    if (!hasGuessLeft(guessesOf(room, player.id))) return socket.emit('room:error', 'Você não tem mais chutes.');

    const guess = itemById(room, pokemonId);
    if (!guess) return socket.emit('room:error', 'Chute inválido.');
    if (room.rows.some(r => r.id === guess.id)) return socket.emit('room:error', `${guess.name} já foi chutado.`);

    if (room.guessesLeft[player.id] !== null) room.guessesLeft[player.id] -= 1;
    room.rows.push({
      ...compareGuess(guess, room.secret, universeOf(room)),
      playerId: player.id,
      playerName: player.name,
    });
    room.message = null;

    const row = room.rows[room.rows.length - 1];
    if (row.correct) return endRound(room, player.id);
    advance(room);
  });

  // so faz sentido na partida sem fim, que nao acaba sozinha
  socket.on('game:end', () => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || room.hostId !== player.id) return;
    if (room.phase !== 'playing' && room.phase !== 'roundEnd') return;
    if (room.phase === 'playing') {
      room.message = `Partida encerrada pelo host. O segredo era ${room.secret?.name ?? '???'}.`;
    }
    finishMatch(room);
  });

  socket.on('game:next', () => {
    const { room, player } = findPlayerRoom(socket);
    if (!room || !player || room.hostId !== player.id) return;
    if (room.phase === 'roundEnd') {
      clearTimer(room);
      startRound(room);
    }
  });

  socket.on('room:leave', () => handleDisconnect(socket, true));
  socket.on('disconnect', () => handleDisconnect(socket, false));
}

// limpeza de salas abandonadas
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (!activePlayers(room).length && room.lastActivity < cutoff) {
      clearTimer(room);
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000).unref();

/** Liga a maquina de salas a um servidor socket.io ja criado. */
export function attachRooms(server) {
  io = server;
  io.on('connection', onConnection);
}
