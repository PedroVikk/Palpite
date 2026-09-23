/**
 * O baralho do modo cartas. Puro: so as definicoes e o sorteio do draft. Quem
 * aplica o efeito e a sala (src/rooms.js), que e quem tem turno, relogio e
 * placar na mao.
 *
 * `rarity` pesa no sorteio; `attack` marca as que mexem no jogo dos outros,
 * que sao de proposito as mais raras — tempero, nao o prato.
 */
export const CARDS = {
  tempo: {
    name: 'Tempo extra', rarity: 'common', attack: false,
    text: '+20 s no relógio da sua vez.',
  },
  aposta: {
    name: 'Aposta', rarity: 'common', attack: false,
    text: 'Se você acertar esta rodada, leva o dobro. Se outro acertar, perde 20.',
  },
  peneira: {
    name: 'Peneira', rarity: 'common', attack: false,
    text: 'Tira 30% dos nomes errados da sua busca nesta rodada.',
  },
  raiox: {
    name: 'Raio-X', rarity: 'rare', attack: false,
    text: 'Revela uma coluna do segredo, só para você.',
  },
  duplo: {
    name: 'Chute duplo', rarity: 'rare', attack: false,
    text: 'Nesta vez você chuta duas vezes seguidas.',
  },
  congelar: {
    name: 'Congelar', rarity: 'epic', attack: true,
    text: 'O próximo jogador perde a vez.',
  },
  assalto: {
    name: 'Assalto', rarity: 'epic', attack: true,
    text: 'Rouba 25 pontos de quem lidera o placar.',
  },
};

/** Quantas cartas saem por draft, e quantas cabem na mao. */
export const OFFER_SIZE = 3;
export const HAND_LIMIT = 5;
export const STEAL_POINTS = 25;
export const BET_PENALTY = 20;
export const EXTRA_SECONDS = 20;

/**
 * Peso de cada raridade no sorteio. Quem esta em ultimo tira de um baralho
 * mais generoso: o draft e a chance de alcancar, nao de disparar na frente.
 */
const WEIGHTS = {
  normal: { common: 6, rare: 3, epic: 1 },
  underdog: { common: 4, rare: 4, epic: 2 },
};

/** Tres cartas diferentes para um jogador escolher uma. */
export function drawOffer(underdog = false, rng = Math.random) {
  const weights = WEIGHTS[underdog ? 'underdog' : 'normal'];
  const deck = Object.keys(CARDS);
  const offer = [];
  while (offer.length < OFFER_SIZE) {
    const left = deck.filter(id => !offer.includes(id));
    const total = left.reduce((sum, id) => sum + weights[CARDS[id].rarity], 0);
    let roll = rng() * total;
    const id = left.find(card => (roll -= weights[CARDS[card].rarity]) < 0) ?? left.at(-1);
    offer.push(id);
  }
  return offer;
}

/** Vai ter draft na rodada `round`? A primeira sempre tem; depois, a cada `every`. */
export const isDraftRound = (round, every) => (round - 1) % every === 0;
