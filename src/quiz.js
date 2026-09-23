/**
 * O "Qual deles?": gera uma pergunta de multipla escolha a partir das colunas
 * do tema. Puro (sem sala, sem socket), guiado pelo schema como a comparacao
 * do jogo — tema novo entra sem mexer aqui.
 *
 * Tres formas de pergunta:
 * - `has`:  qual deles tem X (so um dos N tem);
 * - `not`:  qual deles NAO tem X (todos tem, menos um);
 * - `max` / `min`: qual deles tem o maior / menor valor numa coluna numerica
 *   (nas colunas de tempo, "veio primeiro" / "veio por ultimo").
 *
 * A resposta certa e sempre uma so: sem empate no numero, sem dois com X.
 */
import { valueOf } from '../shared/universes.js';

const isEmpty = (v) => v === null || v === undefined || v === '';

/**
 * Valores que sao falta de dado com cara de valor ("Não dita", "Desconhecida",
 * "Outros"). Nao viram pergunta — "qual deles tem Raça: Não dita?" nao se sabe
 * de cabeca — e quem os tem nao conta como "nao tem X": nao se sabe. Ja "Não
 * tem", "Nenhuma" e "Sem arquétipo" sao resposta de verdade e ficam.
 */
const UNKNOWN = /^(n[ãa]o dit[oa]|desconhecid[oa]|unknown|none|outros?|outro tipo)$/i;

/** Colunas de tempo: ali "menor" quer dizer "veio primeiro". */
const TIME_KEY = /debut|first|release|year|generation|arc/i;

/**
 * O que um item tem numa coluna de categoria, como conjunto. Slot junta os
 * dois tipos do Pokemon (Fogo no tipo 1 ou no 2 e "tem Fogo"); lista vira os
 * proprios valores; texto vira um valor so.
 */
function traitsOf(item, column, scope) {
  const raw = column.kind === 'slot'
    ? (column.slots ?? [column.key]).map(k => valueOf(item, k, scope))
    : [valueOf(item, column.key, scope)].flat();
  const known = raw.filter(v => !isEmpty(v));
  // um valor desconhecido torna o item todo desconhecido nesta coluna
  if (known.some(v => UNKNOWN.test(valueText(column, v)))) return [];
  return known;
}

/** "Tipo 1" e "Tipo 2" viram uma pergunta so, sobre "Tipo". */
const traitLabel = (column) => (column.kind === 'slot' ? column.label.replace(/\s*\d+$/, '') : column.label);

const valueText = (column, value) => column.labels?.[value] ?? String(value);

/**
 * "Qual deles" ou "Qual delas": concorda com o que o tema chama de segredo —
 * "a arma secreta", "a carta secreta", "a pessoa famosa secreta" sao delas.
 */
const whichOf = (universe) => (/^a /.test(universe.secretLabel ?? '') ? 'Qual delas' : 'Qual deles');

/**
 * O enunciado por extenso. Nas colunas numericas ele vem pronto do schema
 * (`quiz: [maior, menor]`), porque "o maior Peso" / "a maior Evolução" nao se
 * resolve com artigo: cada coluna pede o seu verbo ("é o mais pesado", "está
 * no estágio mais avançado"). Coluna sem frase cai numa forma que nao depende
 * de genero.
 */
function numberPrompt(universe, column, wantMax, time) {
  if (column.quiz) return column.quiz[wantMax ? 0 : 1];
  if (time) return `${whichOf(universe)} veio ${wantMax ? 'por último' : 'primeiro'} em ${column.label}?`;
  return `${whichOf(universe)} tem o ${wantMax ? 'maior' : 'menor'} valor em ${column.label}?`;
}

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

/** Colunas de categoria elegiveis, com os slots repetidos colapsados em um. */
function traitColumns(universe) {
  const seen = new Set();
  return universe.columns.filter(column => {
    if (column.kind === 'number') return false;
    const id = column.kind === 'slot' ? (column.slots ?? [column.key]).join('+') : column.key;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function traitQuestion(universe, pool, count, negate, scope, rng) {
  const column = pick(traitColumns(universe), rng);
  if (!column) return null;
  const known = pool.filter(item => traitsOf(item, column, scope).length);
  if (known.length < count) return null;

  // o valor da pergunta sai de um item de verdade, para nunca perguntar por
  // algo que ninguem do tema tem
  const value = pick(traitsOf(pick(known, rng), column, scope), rng);
  const withIt = known.filter(item => traitsOf(item, column, scope).includes(value));
  const without = known.filter(item => !traitsOf(item, column, scope).includes(value));

  const [odd, crowd] = negate ? [without, withIt] : [withIt, without];
  if (!odd.length || crowd.length < count - 1) return null;
  const answer = pick(odd, rng);
  const others = shuffle(crowd, rng).slice(0, count - 1);
  return {
    kind: negate ? 'not' : 'has',
    prompt: `${whichOf(universe)} ${negate ? 'NÃO tem' : 'tem'}…`,
    column,
    label: traitLabel(column),
    value: valueText(column, value),
    answer,
    options: [answer, ...others],
  };
}

function numberQuestion(universe, pool, count, scope, rng) {
  const columns = universe.columns.filter(c => c.kind === 'number');
  const column = pick(columns, rng);
  if (!column) return null;

  // um item por valor: sem empate, a resposta e uma so
  const byValue = new Map();
  for (const item of shuffle(pool, rng)) {
    const value = valueOf(item, column.key, scope);
    if (typeof value !== 'number' || byValue.has(value)) continue;
    byValue.set(value, item);
    if (byValue.size >= count) break;
  }
  if (byValue.size < count) return null;

  const wantMax = rng() < 0.5;
  const values = [...byValue.keys()];
  const target = wantMax ? Math.max(...values) : Math.min(...values);
  const time = TIME_KEY.test(column.key);
  return {
    kind: time ? (wantMax ? 'latest' : 'earliest') : (wantMax ? 'max' : 'min'),
    prompt: numberPrompt(universe, column, wantMax, time),
    column,
    label: column.label,
    value: null,
    answer: byValue.get(target),
    options: [...byValue.values()],
  };
}

/**
 * Uma pergunta nova com `count` opcoes, sorteada do `pool` (os sorteaveis da
 * sala). Tenta formas e colunas diferentes ate achar uma que feche com
 * resposta unica; tema sem dado nenhum que sirva devolve null.
 */
export function makeQuestion(universe, pool, count, scope = null, rng = Math.random) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const roll = rng();
    const q = roll < 0.4
      ? numberQuestion(universe, pool, count, scope, rng)
      : traitQuestion(universe, pool, count, roll > 0.8, scope, rng);
    if (!q) continue;
    const options = shuffle(q.options, rng);
    return {
      kind: q.kind,
      prompt: q.prompt,
      columnKey: q.column.key,
      label: q.label,
      value: q.value,
      options,
      answerIndex: options.indexOf(q.answer),
    };
  }
  return null;
}

/**
 * "Quem é esse Pokémon?": a resposta e as opcoes, so nomes. A figura em preto
 * e da sala (ver silhouetteOf em picture.js), porque sai de arquivo e demora;
 * aqui so se sorteia quem. `canDraw` diz quem tem figura para virar silhueta.
 */
export function makeWhoQuestion(universe, pool, count, canDraw, rng = Math.random) {
  if (!universe.silhouette) return null;
  const drawable = pool.filter(canDraw);
  if (!drawable.length || pool.length < count) return null;
  const answer = pick(drawable, rng);
  // nomes repetidos (duas formas do mesmo bicho) viram opcoes iguais na tela
  const others = shuffle(pool.filter(item => item.id !== answer.id && item.name !== answer.name), rng)
    .filter((item, i, list) => list.findIndex(o => o.name === item.name) === i)
    .slice(0, count - 1);
  if (others.length < count - 1) return null;
  const options = shuffle([answer, ...others], rng);
  return {
    kind: 'who',
    prompt: universe.silhouette,
    columnKey: null,
    label: universe.silhouette,
    value: null,
    options,
    answerIndex: options.indexOf(answer),
  };
}

/** Acerto vale de 50 a 100: quanto mais cedo, mais perto de 100. */
export function scoreForAnswer(msTaken, msTotal) {
  const left = Math.max(0, Math.min(1, 1 - msTaken / msTotal));
  return Math.round(50 + 50 * left);
}
