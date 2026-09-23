/**
 * Regras puras do jogo (sem sockets, sem estado global).
 * A comparacao e guiada pelo schema do universo (shared/universes.js),
 * entao adicionar uma franquia nova nao mexe aqui.
 */
import {
  UNIVERSES, DEFAULT_UNIVERSE, getUniverse,
  scopeFilter, scopeReach, scopeLabel, sanitizeScope, valueOf,
} from '../shared/universes.js';

export { UNIVERSES, getUniverse, scopeFilter, scopeReach, scopeLabel };

export const MODES = {
  HUNT: 'hunt', // servidor sorteia o segredo, NINGUEM sabe, todos adivinham em turnos
  DUEL: 'duel', // um jogador sorteado ESCONDE o segredo e assiste; o resto adivinha em turnos
  IMPOSTOR: 'impostor', // todos SABEM o segredo, menos um; a mesa chuta sem entregar e vota em quem nao sabia
  BATTLE: 'battle', // cada um ESCONDE o proprio segredo e ataca o dos outros; ganha quem ficar de pe
  QUIZ: 'quiz', // "Qual deles?": pergunta de multipla escolha, todos respondem juntos, rapidez pontua
  CARDS: 'cards', // caca ao segredo com draft de cartas de efeito a cada N rodadas
};

/** "Qual deles?": quantas opcoes cada pergunta pode ter. */
export const QUIZ_CHOICES = { min: 2, max: 5, fallback: 3 };

/** Batalha naval: com um jogador so nao ha em quem atirar. */
export const BATTLE_MIN_PLAYERS = 2;

/** Impostor: a mesa precisa de gente para desconfiar de alguem. */
export const IMPOSTOR_MIN_PLAYERS = 3;

export const DEFAULT_SETTINGS = {
  mode: MODES.HUNT,
  universe: DEFAULT_UNIVERSE,
  groups: UNIVERSES[DEFAULT_UNIVERSE].defaultGroups,
  scope: null,        // so os universos com `scope` no schema usam este campo
  rounds: 5,
  turnSeconds: 45,
  guessesPerPlayer: 0, // 0 = "ate acertar": sem teto de chutes (so no modo caca ao segredo)
  picture: false,      // rodada jogada pela imagem, sem tabela de dicas
  card: false,         // impostor: a linha mostra a ficha do chutado (sem cor)
  choices: 3,          // "Qual deles?": opcoes por pergunta
  draftEvery: 2,       // cartas: a cada quantas rodadas sai um draft
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

  // o recorte tambem nao atravessa troca de universo: cada um tem as suas
  // epocas (ou nenhuma, e ai o campo fica null)
  const requestedScope = raw.scope ?? (universeId === base.universe ? base.scope : null);
  const scope = sanitizeScope(universe, requestedScope);

  const mode = Object.values(MODES).includes(raw.mode) ? raw.mode : MODES.HUNT;
  const impostor = mode === MODES.IMPOSTOR;
  const battle = mode === MODES.BATTLE;
  const quiz = mode === MODES.QUIZ;
  const cards = mode === MODES.CARDS;

  // "ate acertar" (guessesPerPlayer 0): a rodada so fecha quando alguem acerta,
  // sem teto de chutes. So vale no modo caca ao segredo — no duelo quem esconde
  // o segredo so pontua se os chutes dos outros acabarem, entao ali o teto e
  // obrigatorio e um valor <= 0 cai para o padrao.
  const rawGuesses = Math.round(Number(raw.guessesPerPlayer ?? base.guessesPerPlayer));
  //
  // No impostor o saldo de chutes e o numero de voltas da mesa: a rodada nao
  // fecha em acerto (quem sabe nao pode chutar o segredo), entao sem teto ela
  // nunca chegaria na votacao.
  //
  // Na batalha naval e o contrario: ela so acaba quando sobra um segredo de pe,
  // entao nao ha teto — com ele a batalha podia travar com tres navios boiando.
  // (o modo cartas e a caca ao segredo com draft: vale a mesma regra dela)
  const untilRight = battle || ((mode === MODES.HUNT || cards) && (!Number.isFinite(rawGuesses) || rawGuesses <= 0));
  const fallbackGuesses = impostor ? 2 : 6;

  return {
    mode,
    universe: universeId,
    groups: groups.length ? [...new Set(groups)] : [...universe.defaultGroups],
    scope,
    // a batalha naval e uma partida de uma batalha so
    rounds: battle ? 1 : clamp(Math.round(Number(raw.rounds ?? base.rounds)) || 5, 1, 20),
    turnSeconds: clamp(Math.round(Number(raw.turnSeconds ?? base.turnSeconds)) || 45, 5, 180),
    guessesPerPlayer: untilRight ? 0 : clamp(rawGuesses > 0 ? rawGuesses : fallbackGuesses, 1, 20),
    /**
     * O interruptor da imagem atravessa os dois modos: tanto a caca ao segredo
     * quanto o duelo podem ser jogados pela figura. Ele nao substitui `mode`,
     * entao mora aqui do lado em vez de virar um terceiro valor dele.
     */
    //
    // O impostor e a excecao: a figura clareia a cada chute, e ai todo chute
    // da mesa entregaria pixels a quem nao sabe o segredo, sem ninguem poder
    // evitar. Sem tabela tambem nao ha contagem de acertos para desconfiar.
    //
    // Na batalha naval cada tabuleiro teria a propria figura, e a tela viraria
    // um mosaico de quadros borrados: por ora ela joga so pela tabela.
    // No modo cartas a figura tambem fica de fora: Raio-X e Peneira falam das
    // colunas e dos nomes, e a figura clareando por chute embaralharia as duas.
    picture: !impostor && !battle && !quiz && !cards && Boolean(raw.picture ?? base.picture),
    card: Boolean(raw.card ?? base.card),
    choices: clamp(Math.round(Number(raw.choices ?? base.choices)) || QUIZ_CHOICES.fallback, QUIZ_CHOICES.min, QUIZ_CHOICES.max),
    draftEvery: clamp(Math.round(Number(raw.draftEvery ?? base.draftEvery)) || 2, 1, 5),
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

/**
 * Impostor. Ele leva 100 quando escapa da votacao, quando acerta o chute final
 * depois de pego, ou quando chuta o segredo no meio das voltas. Pego e errando
 * o chute final, cada um da mesa leva 50, e quem votou nele leva mais 20.
 */
export const SCORE_IMPOSTOR_WINS = 100;
export const SCORE_CREW_WINS = 50;
export const SCORE_RIGHT_VOTE = 20;

/**
 * Batalha naval. Afundar vale o acerto de sempre, contado pelos chutes daquele
 * tabuleiro (ver scoreForWin). Quem termina com o segredo de pe leva o bonus.
 */
export const SCORE_BATTLE_SURVIVOR = 50;

/**
 * Quantas colunas o chute acertou em cheio. E tudo o que a mesa ve da linha
 * durante a rodada do impostor: prova que quem chutou sabe um pouco, sem dizer
 * o que — so verde conta, amarelo e seta ficam de fora.
 */
export const hitsOf = (row) => Object.values(row.cells ?? {}).filter(c => c.status === 'hit').length;

/**
 * Apuracao da votacao. So um mais votado, e sendo ele o impostor, conta como
 * pego: empate e urna vazia deixam o impostor escapar, como no jogo de mesa.
 */
export function tallyVotes(votes) {
  const count = new Map();
  for (const suspect of Object.values(votes)) count.set(suspect, (count.get(suspect) ?? 0) + 1);
  let top = 0;
  let leaders = [];
  for (const [id, n] of count) {
    if (n > top) { top = n; leaders = [id]; } else if (n === top) leaders.push(id);
  }
  return { count: Object.fromEntries(count), accused: leaders.length === 1 ? leaders[0] : null };
}

export function pickSecret(pool, rng = Math.random) {
  return pool[Math.floor(rng() * pool.length)];
}
