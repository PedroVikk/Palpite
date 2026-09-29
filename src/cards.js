/**
 * O baralho das cartas. Puro: so as definicoes e o sorteio do draft. Quem
 * aplica o efeito e a sala (src/rooms.js), que e quem tem turno, relogio e
 * placar na mao.
 *
 * `rarity` pesa no sorteio; `attack` marca as que mexem no jogo dos outros,
 * que sao de proposito as mais raras — tempero, nao o prato — e que o Escudo e
 * o Espelho seguram. `target` marca as que pedem um alvo: quem usa escolhe em
 * quem, e o alvo vai junto no pedido.
 *
 * As cartas valem em qualquer modo, mas nem toda carta tem o que fazer em
 * todos: `off` lista os modos em que ela nem sai no draft. No "Qual deles?"
 * ninguem tem vez (Tempo, Chute duplo, Congelar e Pressa ficam de fora); na
 * batalha cada um tem o proprio segredo, e as cartas que olham "o segredo"
 * nao teriam qual olhar; no impostor e na batalha a Aposta nao tem acerto
 * de rodada para dobrar.
 */
export const CARDS = {
  tempo: {
    name: 'Tempo extra', rarity: 'common', attack: false, off: ['quiz'],
    text: '+20 s no relógio da sua vez.',
  },
  aposta: {
    name: 'Aposta', rarity: 'common', attack: false, off: ['impostor', 'battle'],
    text: 'Se você acertar esta rodada, leva o dobro. Se outro acertar, perde 20.',
  },
  peneira: {
    name: 'Peneira', rarity: 'common', attack: false, off: ['battle'],
    text: 'Tira 30% dos nomes errados da sua busca nesta rodada.',
  },
  raiox: {
    name: 'Raio-X', rarity: 'rare', attack: false, off: ['battle'],
    text: 'Revela uma coluna do segredo, só para você.',
  },
  duplo: {
    name: 'Chute duplo', rarity: 'rare', attack: false, off: ['quiz'],
    text: 'Nesta vez você chuta duas vezes seguidas.',
  },
  congelar: {
    name: 'Congelar', rarity: 'epic', attack: true, target: true, off: ['quiz'],
    text: 'Quem você escolher perde a próxima vez.',
  },
  assalto: {
    name: 'Assalto', rarity: 'epic', attack: true, target: true,
    text: 'Rouba 25 pontos de quem você escolher.',
  },
  letra: {
    name: 'Letra', rarity: 'common', attack: false, off: ['battle'],
    text: 'Revela uma letra ao acaso do nome do segredo, e onde ela fica. Só para você.',
  },
  embaralhar: {
    name: 'Embaralhar', rarity: 'rare', attack: false,
    text: 'Troca todas as outras cartas da sua mão por cartas novas.',
  },
  escudo: {
    name: 'Escudo', rarity: 'rare', attack: false,
    text: 'Até o fim da rodada, cartas de ataque não pegam em você.',
  },
  pressa: {
    name: 'Pressa', rarity: 'rare', attack: true, target: true, off: ['quiz'],
    text: 'Quem você escolher tem só 15 s na próxima vez.',
  },
  furto: {
    name: 'Furto', rarity: 'epic', attack: true, target: true,
    text: 'Pega uma carta ao acaso da mão de quem você escolher.',
  },
  bussola: {
    name: 'Bússola', rarity: 'common', attack: false, off: ['battle'],
    text: 'Mostra de qual grupo é o segredo (a geração, a vila, a casa...). Só para você.',
  },
  reforco: {
    name: 'Reforço', rarity: 'common', attack: false,
    text: 'Compra duas cartas para a sua mão.',
  },
  espiar: {
    name: 'Espiar', rarity: 'rare', attack: false, target: true,
    text: 'Mostra as cartas da mão de quem você escolher. Só para você.',
  },
  espelho: {
    name: 'Espelho', rarity: 'rare', attack: false,
    text: 'A próxima carta de ataque usada em você volta para quem usou. Ninguém vê que você tem.',
  },
  troca: {
    name: 'Troca', rarity: 'epic', attack: true, target: true,
    text: 'Troca a sua mão inteira com a de quem você escolher.',
  },
};

/** A carta tem o que fazer no modo `mode`? */
export const playsIn = (id, mode) => Boolean(CARDS[id]) && !CARDS[id].off?.includes(mode);

/** Quantas cartas saem por draft, e quantas cabem na mao. */
export const OFFER_SIZE = 3;
export const HAND_LIMIT = 5;
export const STEAL_POINTS = 25;
export const BET_PENALTY = 20;
export const EXTRA_SECONDS = 20;
export const RUSH_SECONDS = 15;

/**
 * Peso de cada raridade no sorteio. Quem esta em ultimo tira de um baralho
 * mais generoso: o draft e a chance de alcancar, nao de disparar na frente.
 */
const WEIGHTS = {
  normal: { common: 6, rare: 3, epic: 1 },
  underdog: { common: 4, rare: 4, epic: 2 },
};

/** Uma carta do baralho do modo, pelo peso da raridade, fora as de `skip`. */
function pickWeighted(weights, mode, skip = [], rng = Math.random) {
  const left = Object.keys(CARDS).filter(id => playsIn(id, mode) && !skip.includes(id));
  const total = left.reduce((sum, id) => sum + weights[CARDS[id].rarity], 0);
  let roll = rng() * total;
  return left.find(card => (roll -= weights[CARDS[card].rarity]) < 0) ?? left.at(-1);
}

/** Tres cartas diferentes, do baralho do modo, para um jogador escolher uma. */
export function drawOffer(mode, underdog = false, rng = Math.random) {
  const weights = WEIGHTS[underdog ? 'underdog' : 'normal'];
  const offer = [];
  while (offer.length < OFFER_SIZE) offer.push(pickWeighted(weights, mode, offer, rng));
  return offer;
}

/**
 * Uma carta solta, para o Embaralhar repor a mao. Nunca sai outro Embaralhar:
 * senao a carta viraria um caca-niquel de puxar de novo ate vir o que se quer.
 */
export const drawCard = (mode, rng = Math.random) => pickWeighted(WEIGHTS.normal, mode, ['embaralhar'], rng);

/** Vai ter draft na rodada `round`? A primeira sempre tem; depois, a cada `every`. */
export const isDraftRound = (round, every) => (round - 1) % every === 0;
