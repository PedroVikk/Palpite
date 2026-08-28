/**
 * Regras puras do jogo (sem sockets, sem estado global).
 * A comparacao e guiada pelo schema do universo (shared/universes.js),
 * entao adicionar uma franquia nova nao mexe aqui.
 */
import { UNIVERSES, DEFAULT_UNIVERSE, getUniverse, scopeFilter, scopeOption } from '../shared/universes.js';

export { UNIVERSES, getUniverse, scopeFilter, scopeOption };

export const MODES = {
  CLASSIC: 'classic', // servidor sorteia o segredo, todos adivinham em turnos
  DUEL: 'duel',       // o jogador da vez ESCOLHE o segredo e os outros adivinham
};

export const DEFAULT_SETTINGS = {
  mode: MODES.CLASSIC,
  universe: DEFAULT_UNIVERSE,
  groups: UNIVERSES[DEFAULT_UNIVERSE].defaultGroups,
  scope: null,        // so os universos com `scope` no schema usam este campo
  rounds: 0,          // 0 = sem fim: o padrao do modo classico
  turnSeconds: 45,
  guessesPerPlayer: 0,
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function sanitizeSettings(raw = {}, base = DEFAULT_SETTINGS) {
  const universeId = UNIVERSES[raw.universe] ? raw.universe : (UNIVERSES[base.universe] ? base.universe : DEFAULT_UNIVERSE);
  const universe = UNIVERSES[universeId];
  const valid = new Set(universe.groups.map(g => g.id));

  // grupos que nao pertencem ao universo escolhido sao descartados; se nao
  // sobrar nenhum (troca de universo, payload torto), volta para o padrao
  const requested = Array.isArray(raw.groups) ? raw.groups : (universeId === base.universe ? base.groups : null);
  const groups = (requested ?? []).map(String).filter(id => valid.has(id));

  // o recorte tambem nao atravessa troca de universo: cada um tem o seu (ou
  // nenhum, e ai o campo fica null)
  const requestedScope = raw.scope ?? (universeId === base.universe ? base.scope : null);
  const scope = universe.scope ? (scopeOption(universe, requestedScope)?.id ?? null) : null;

  // rounds 0 = partida sem fim: as rodadas se sucedem ate o host encerrar e
  // cada rodada so fecha quando alguem acerta, entao os chutes viram ilimitados
  // (guessesPerPlayer 0). O host encerra pelo botao "Encerrar partida".
  const mode = raw.mode === MODES.DUEL ? MODES.DUEL : MODES.CLASSIC;
  const rawRounds = raw.rounds ?? base.rounds;

  // no duelo quem esconde o segredo so pontua se os chutes acabarem, entao
  // ali a partida sem fim nao faz sentido: cai para o padrao com limites
  const endless = Number(rawRounds) === 0 && mode !== MODES.DUEL;

  return {
    mode,
    universe: universeId,
    groups: groups.length ? [...new Set(groups)] : [...universe.defaultGroups],
    scope,
    rounds: endless ? 0 : clamp(Math.round(Number(rawRounds)) || 5, 1, 20),
    turnSeconds: clamp(Math.round(Number(raw.turnSeconds ?? base.turnSeconds)) || 45, 5, 180),
    guessesPerPlayer: endless
      ? 0
      : clamp(Math.round(Number(raw.guessesPerPlayer ?? base.guessesPerPlayer)) || 6, 1, 20),
  };
}

/** Partida sem fim: rodadas ilimitadas e sem teto de chutes. */
export const isEndless = (settings) => settings.rounds === 0;

// ---------------------------------------------------------------- comparacao

const isEmpty = (value) => value === null || value === undefined || value === '';

/** Numero: acerto, "quase" (dentro da tolerancia) ou erro + seta. */
function compareNumber(guessValue, secretValue, tolerance = 0) {
  if (isEmpty(guessValue) || isEmpty(secretValue)) return { status: 'unknown', hint: null };
  if (guessValue === secretValue) return { status: 'hit', hint: null };
  const close = Math.abs(guessValue - secretValue) <= Math.abs(secretValue) * tolerance;
  return { status: close ? 'close' : 'miss', hint: guessValue < secretValue ? 'up' : 'down' };
}

/** Listas: conjuntos iguais -> verde, alguma interseccao -> amarelo. */
function compareList(guessValue, secretValue) {
  const a = Array.isArray(guessValue) ? guessValue : [];
  const b = Array.isArray(secretValue) ? secretValue : [];
  if (!a.length && !b.length) return { status: 'unknown', hint: null };
  if (!a.length || !b.length) return { status: 'miss', hint: null };
  const setB = new Set(b);
  const shared = a.filter(v => setB.has(v));
  if (shared.length === a.length && a.length === b.length) return { status: 'hit', hint: null };
  return { status: shared.length ? 'partial' : 'miss', hint: null };
}

/**
 * Slot (tipo 1 / tipo 2 do Pokemon): igual -> verde; o valor existe no
 * secreto, mas no outro slot -> amarelo.
 */
function compareSlot(column, guess, secret) {
  const value = guess[column.key] ?? null;
  const expected = secret[column.key] ?? null;
  if (value === expected) return { status: 'hit', hint: null };
  const secretSlots = (column.slots ?? [column.key]).map(k => secret[k]).filter(Boolean);
  if (value && secretSlots.includes(value)) return { status: 'partial', hint: null };
  return { status: 'miss', hint: null };
}

function compareColumn(column, guess, secret) {
  switch (column.kind) {
    case 'slot':
      return compareSlot(column, guess, secret);
    case 'list':
      return compareList(guess[column.key], secret[column.key]);
    case 'number':
      return compareNumber(guess[column.key], secret[column.key], column.tolerance ?? 0);
    default: {
      const value = guess[column.key] ?? null;
      const expected = secret[column.key] ?? null;
      if (isEmpty(value) || isEmpty(expected)) return { status: 'unknown', hint: null };
      return { status: value === expected ? 'hit' : 'miss', hint: null };
    }
  }
}

/** Compara um chute com o segredo e devolve a linha de dicas. */
export function compareGuess(guess, secret, universe) {
  const cells = {};
  for (const column of universe.columns) {
    cells[column.key] = { value: guess[column.key] ?? null, ...compareColumn(column, guess, secret) };
  }
  return {
    id: guess.id,
    name: guess.name,
    sprite: guess.sprite,
    correct: guess.id === secret.id,
    cells,
  };
}

// ---------------------------------------------------------------- pontuacao

/** Quanto mais chutes ja gastos na rodada, menos vale o acerto. */
export function scoreForWin(totalGuessesInRound) {
  return Math.max(25, 100 - 5 * Math.max(0, totalGuessesInRound - 1));
}

/** No modo duelo, o dono do segredo pontua se ninguem acertar. */
export const SCORE_CHOOSER_SURVIVED = 50;

export function pickSecret(pool, rng = Math.random) {
  return pool[Math.floor(rng() * pool.length)];
}
