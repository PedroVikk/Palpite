/**
 * Regras puras do jogo (sem sockets, sem estado global).
 * A comparacao e guiada pelo schema do universo (shared/universes.js),
 * entao adicionar uma franquia nova nao mexe aqui.
 */
import { UNIVERSES, DEFAULT_UNIVERSE, getUniverse, scopeFilter, scopeOption, valueOf } from '../shared/universes.js';

export { UNIVERSES, getUniverse, scopeFilter, scopeOption };

export const MODES = {
  HUNT: 'hunt', // servidor sorteia o segredo, NINGUEM sabe, todos adivinham em turnos
  DUEL: 'duel', // um jogador sorteado ESCONDE o segredo e assiste; o resto adivinha em turnos
};

export const DEFAULT_SETTINGS = {
  mode: MODES.HUNT,
  universe: DEFAULT_UNIVERSE,
  groups: UNIVERSES[DEFAULT_UNIVERSE].defaultGroups,
  scope: null,        // so os universos com `scope` no schema usam este campo
  rounds: 5,
  turnSeconds: 45,
  guessesPerPlayer: 0, // 0 = "ate acertar": sem teto de chutes (so no modo caca ao segredo)
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

  const mode = raw.mode === MODES.DUEL ? MODES.DUEL : MODES.HUNT;

  // "ate acertar" (guessesPerPlayer 0): a rodada so fecha quando alguem acerta,
  // sem teto de chutes. So vale no modo caca ao segredo — no duelo quem esconde
  // o segredo so pontua se os chutes dos outros acabarem, entao ali o teto e
  // obrigatorio e um valor <= 0 cai para o padrao.
  const rawGuesses = Math.round(Number(raw.guessesPerPlayer ?? base.guessesPerPlayer));
  const untilRight = mode === MODES.HUNT && (!Number.isFinite(rawGuesses) || rawGuesses <= 0);

  return {
    mode,
    universe: universeId,
    groups: groups.length ? [...new Set(groups)] : [...universe.defaultGroups],
    scope,
    rounds: clamp(Math.round(Number(raw.rounds ?? base.rounds)) || 5, 1, 20),
    turnSeconds: clamp(Math.round(Number(raw.turnSeconds ?? base.turnSeconds)) || 45, 5, 180),
    guessesPerPlayer: untilRight ? 0 : clamp(rawGuesses || 6, 1, 20),
  };
}

/** Rodada sem teto de chutes: so fecha quando alguem acerta. */
export const isUntilRight = (settings) => settings.guessesPerPlayer === 0;

// ---------------------------------------------------------------- comparacao

const isEmpty = (value) => value === null || value === undefined || value === '';

/**
 * Numero: acerto, "quase" (dentro da tolerancia) ou erro + seta.
 *
 * `tolerance` e proporcional ao segredo (10% da recompensa do One Piece);
 * `nearby` e uma distancia crua, para escala pequena e sem meio-termo, como o
 * indice do arco de estreia do Naruto, onde "quase" quer dizer "o arco do
 * lado". Vale a mais generosa das duas.
 *
 * Vazio quer dizer duas coisas diferentes conforme a coluna. Sem `blank`, e
 * falta de dado: nao da para comparar, a celula fica cinza de "sem dado". Com
 * `blank` (o ATK de uma magia de Yu-Gi-Oh), vazio e a resposta — "essa carta
 * nao tem ATK" —, entao duas cartas sem o campo fecham verde e uma com e outra
 * sem fecham erro, so que sem seta: nao existe maior nem menor que "nao tem".
 */
function compareNumber(guessValue, secretValue, { tolerance = 0, nearby = 0, blank = null } = {}) {
  const semChute = isEmpty(guessValue);
  const semSegredo = isEmpty(secretValue);
  if (semChute || semSegredo) {
    if (!blank) return { status: 'unknown', hint: null };
    return { status: semChute && semSegredo ? 'hit' : 'miss', hint: null };
  }
  if (guessValue === secretValue) return { status: 'hit', hint: null };
  const distancia = Math.abs(guessValue - secretValue);
  const close = distancia <= Math.max(nearby, Math.abs(secretValue) * tolerance);
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
function compareSlot(column, guess, secret, scope) {
  const value = valueOf(guess, column.key, scope) ?? null;
  const expected = valueOf(secret, column.key, scope) ?? null;
  if (value === expected) return { status: 'hit', hint: null };
  const secretSlots = (column.slots ?? [column.key]).map(k => valueOf(secret, k, scope)).filter(Boolean);
  if (value && secretSlots.includes(value)) return { status: 'partial', hint: null };
  return { status: 'miss', hint: null };
}

function compareColumn(column, guess, secret, scope) {
  const value = valueOf(guess, column.key, scope);
  const expected = valueOf(secret, column.key, scope);
  switch (column.kind) {
    case 'slot':
      return compareSlot(column, guess, secret, scope);
    case 'list':
      return compareList(value, expected);
    case 'number':
      return compareNumber(value, expected, column);
    default: {
      if (isEmpty(value ?? null) || isEmpty(expected ?? null)) return { status: 'unknown', hint: null };
      return { status: value === expected ? 'hit' : 'miss', hint: null };
    }
  }
}

/**
 * Compara um chute com o segredo e devolve a linha de dicas. `scope` e o
 * recorte da sala: onde o item guarda versao por recorte, e ela que vale dos
 * dois lados — a dica tem de responder pelo periodo que a sala escolheu.
 */
export function compareGuess(guess, secret, universe, scope = null) {
  const cells = {};
  for (const column of universe.columns) {
    cells[column.key] = {
      value: valueOf(guess, column.key, scope) ?? null,
      ...compareColumn(column, guess, secret, scope),
    };
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
