/**
 * O baralho das cartas. Puro: so as definicoes e o sorteio do draft. Quem
 * aplica o efeito e a sala (src/rooms.js), que e quem tem turno, relogio e
 * placar na mao.
 *
 * `rarity` pesa no sorteio: comum, incomum, rara, epica e lendaria — esta a
 * mais dificil de tirar, a da Letra, que monta o nome do segredo aos poucos.
 * `attack` marca as que mexem no jogo dos outros, que sao de proposito as
 * mais raras — tempero, nao o prato — e que o Escudo e o Espelho seguram. `target` marca as que pedem um alvo: quem usa escolhe em
 * quem, e o alvo vai junto no pedido.
 *
 * `needs` diz do que a carta precisa na sala para ter o que fazer (ver NEEDS,
 * logo abaixo). Carta que nao tem nao sai no draft, nem na troca, nem no
 * Reforço: sala sem relogio nao ve Tempo extra nem Pressa, no "Qual deles?"
 * ninguem tem vez, na batalha cada um tem o proprio segredo, sala de um grupo
 * so nao ve Bussola, e quem joga sozinho nao ve carta de ataque. Carta nova
 * entra no baralho dizendo o que precisa — sem `needs`, vale em qualquer sala.
 */
export const CARDS = {
  tempo: {
    name: 'Tempo extra', rarity: 'common', attack: false, needs: ['turns', 'clock'],
    text: '+20 s no relógio da sua vez.',
  },
  aposta: {
    name: 'Aposta', rarity: 'uncommon', attack: false, needs: ['winner', 'stakes'],
    text: 'Se você acertar esta rodada, leva o dobro. Se outro acertar, perde 20.',
  },
  peneira: {
    name: 'Peneira', rarity: 'uncommon', attack: false, needs: ['secret'],
    text: 'Tira 30% dos nomes errados da sua busca nesta rodada.',
  },
  raiox: {
    name: 'Raio-X', rarity: 'rare', attack: false, needs: ['secret'],
    text: 'Revela uma coluna do segredo, só para você.',
  },
  duplo: {
    name: 'Chute duplo', rarity: 'rare', attack: false, needs: ['turns'],
    text: 'Nesta vez você chuta duas vezes seguidas.',
  },
  congelar: {
    name: 'Congelar', rarity: 'epic', attack: true, target: true, needs: ['turns', 'rivals'],
    text: 'Quem você escolher perde a próxima vez.',
  },
  assalto: {
    name: 'Assalto', rarity: 'epic', attack: true, target: true, needs: ['rivals'],
    text: 'Rouba 25 pontos de quem você escolher.',
  },
  letra: {
    name: 'Letra', rarity: 'legendary', attack: false, needs: ['secret'],
    text: 'Revela uma letra ao acaso do nome do segredo, e onde ela fica. Só para você.',
  },
  embaralhar: {
    name: 'Embaralhar', rarity: 'uncommon', attack: false,
    text: 'Troca todas as outras cartas da sua mão por cartas novas.',
  },
  escudo: {
    name: 'Escudo', rarity: 'rare', attack: false, needs: ['rivals'],
    text: 'Até o fim da rodada, cartas de ataque não pegam em você.',
  },
  pressa: {
    name: 'Pressa', rarity: 'rare', attack: true, target: true, needs: ['turns', 'clock', 'rush', 'rivals'],
    text: 'Quem você escolher tem só 15 s na próxima vez.',
  },
  furto: {
    name: 'Furto', rarity: 'epic', attack: true, target: true, needs: ['rivals'],
    text: 'Pega uma carta ao acaso da mão de quem você escolher.',
  },
  bussola: {
    name: 'Bússola', rarity: 'common', attack: false, needs: ['secret', 'groups'],
    text: 'Mostra de qual grupo é o segredo (a geração, a vila, a casa...). Só para você.',
  },
  reforco: {
    name: 'Reforço', rarity: 'uncommon', attack: false,
    text: 'Compra duas cartas para a sua mão.',
  },
  espiar: {
    name: 'Espiar', rarity: 'common', attack: false, target: true, needs: ['rivals'],
    text: 'Mostra as cartas da mão de quem você escolher. Só para você.',
  },
  espelho: {
    name: 'Espelho', rarity: 'rare', attack: false, needs: ['rivals'],
    text: 'A próxima carta de ataque usada em você volta para quem usou. Ninguém vê que você tem.',
  },
  troca: {
    name: 'Troca', rarity: 'epic', attack: true, target: true, needs: ['rivals'],
    text: 'Troca a sua mão inteira com a de quem você escolher.',
  },
  // a unica que nao se usa na vez: fica na mao ate o proximo draft (`draft`)
  recompra: {
    name: 'Recompra', rarity: 'common', attack: false, draft: true, needs: ['nextDraft'],
    text: 'No próximo draft, troca as três cartas oferecidas por três novas.',
  },
};

/**
 * Do que uma carta pode precisar da sala. `table` e o retrato da sala na hora
 * do sorteio, montado por quem sorteia (ver `tableOf` em src/rooms.js):
 *
 *   mode      o estilo da sala ('hunt', 'duel', 'quiz', ...)
 *   clock     a vez tem relogio (tempo por vez ligado, e gente para ter vez)
 *   turnSeconds o tamanho da vez, em segundos (0 = sem relogio)
 *   players   quantos estao na mesa
 *   groups    quantos grupos a sala sorteia
 *   nextDraft ainda vem outro draft depois deste
 */
export const NEEDS = {
  // ha vez: no "Qual deles?" todo mundo responde junto
  turns: (table) => table.mode !== 'quiz',
  // ha relogio na vez para ganhar ou tirar tempo
  clock: (table) => Boolean(table.clock),
  // a Pressa corta a vez para 15 s: com a vez ja nesse tamanho, nao corta nada
  rush: (table) => table.turnSeconds > RUSH_SECONDS,
  // ha em quem mirar: sozinho, carta de ataque (e a defesa contra ela) e enfeite
  rivals: (table) => table.players >= 2,
  // ha um segredo so para olhar: na batalha cada um tem o seu
  secret: (table) => table.mode !== 'battle',
  // ha acerto de rodada para dobrar: no impostor e na batalha nao ha
  winner: (table) => table.mode !== 'impostor' && table.mode !== 'battle',
  // a aposta tem risco: no "Qual deles?" o risco e errar; nos outros, e outro
  // acertar antes — sozinho, a rodada "ate acertar" seria o dobro de graca
  stakes: (table) => table.mode === 'quiz' || table.players >= 2,
  // a Bussola aponta o grupo: com um grupo so ligado, todo mundo ja sabe qual
  groups: (table) => table.groups > 1,
  // a Recompra se gasta no proximo draft: sem ele, ela morre na mao
  nextDraft: (table) => Boolean(table.nextDraft),
};

/** A carta tem o que fazer nesta sala? */
export function playsIn(id, table) {
  const card = CARDS[id];
  return Boolean(card) && (card.needs ?? []).every(need => NEEDS[need](table));
}

/** Quantas cartas saem por draft, e quantas cabem na mao. */
export const OFFER_SIZE = 3;
/**
 * Trocas de draft guardadas: quem vence a rodada ganha uma (e, com a
 * subregra, quem mais descobriu colunas). O teto e baixo de proposito — a
 * troca e um empurrao para quem ganhou, nao uma bola de neve.
 */
export const REROLL_LIMIT = 2;
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
  normal: { common: 6, uncommon: 4.5, rare: 3, epic: 1, legendary: 0.5 },
  underdog: { common: 4, uncommon: 4, rare: 4, epic: 2, legendary: 1 },
};

/** Uma carta do baralho da sala, pelo peso da raridade, fora as de `skip`. Null se nao sobrar. */
function pickWeighted(weights, table, skip = [], rng = Math.random) {
  const left = Object.keys(CARDS).filter(id => playsIn(id, table) && !skip.includes(id));
  if (!left.length) return null;
  const total = left.reduce((sum, id) => sum + weights[CARDS[id].rarity], 0);
  let roll = rng() * total;
  return left.find(card => (roll -= weights[CARDS[card].rarity]) < 0) ?? left.at(-1);
}

/**
 * Tres cartas diferentes, do baralho da sala, para um jogador escolher uma.
 * `avoid` sao as que ja estavam na mesa (a Recompra): saem outras, enquanto o
 * baralho da sala tiver. Nunca repete carta na mesma oferta.
 */
export function drawOffer(table, underdog = false, rng = Math.random, avoid = []) {
  const weights = WEIGHTS[underdog ? 'underdog' : 'normal'];
  const offer = [];
  while (offer.length < OFFER_SIZE) {
    const card = pickWeighted(weights, table, [...offer, ...avoid], rng)
      ?? pickWeighted(weights, table, offer, rng);
    if (!card) break;
    offer.push(card);
  }
  return offer;
}

/**
 * A troca de uma carta so do draft: sai outra, diferente das que ja estao na
 * mesa, pelo mesmo peso que a oferta daquele jogador teve.
 */
export function rerollOne(table, offer, underdog = false, rng = Math.random) {
  return pickWeighted(WEIGHTS[underdog ? 'underdog' : 'normal'], table, offer, rng);
}

/**
 * Uma carta solta, para o Reforço e o Embaralhar reporem a mao. Nunca sai
 * outro Embaralhar: senao a carta viraria um caca-niquel de puxar de novo ate
 * vir o que se quer.
 */
export const drawCard = (table, rng = Math.random) => pickWeighted(WEIGHTS.normal, table, ['embaralhar'], rng);

/** Vai ter draft na rodada `round`? A primeira sempre tem; depois, a cada `every`. */
export const isDraftRound = (round, every) => (round - 1) % every === 0;
