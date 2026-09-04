/**
 * O desafio do dia: um segredo por universo, igual para todo mundo, trocando
 * a meia-noite.
 *
 * Nao ha sorteio nem nada guardado. O item sai de um hash de (data, universo),
 * entao o servidor reiniciado — ou uma segunda instancia — chega no mesmo
 * resultado sem precisar combinar nada. O unico jeito de o desafio mudar sem
 * querer e o dataset do universo mudar, o que so acontece em deploy novo.
 *
 * O dia vira em America/Sao_Paulo, nao em UTC: com UTC o desafio trocaria as
 * 21h de quem joga aqui, no meio da noite de jogo.
 *
 * Como (data, universo) responde por tudo e o dataset e fixo dentro do deploy,
 * o dia inteiro — recorte, candidatos e segredo — e calculado uma vez e fica
 * guardado. Sem isso cada chute refazia a conta: o recorte varria a lista uma
 * vez por candidato, e nos universos grandes a resposta passava de um segundo,
 * com o campo de chute travado esperando por ela.
 */
import { createHash } from 'node:crypto';
import { UNIVERSES, scopeFilter, scopeOptions } from '../shared/universes.js';
import { datasetOf } from './catalog.js';

const ZONE = 'America/Sao_Paulo';

/**
 * O tempero do sorteio, e a diferença entre "não conto a resposta" e "não dá
 * para calcular a resposta".
 *
 * Sem ele o segredo sai de um sha256 de (data, universo) — uma conta sem
 * segredo nenhum. Quem tem o dataset (ele é público: `/api/dataset/:universo`
 * alimenta a busca do chute) refaz essa conta em casa e sabe o segredo de hoje
 * e o de todo dia que vier, sem pedir nada ao servidor. O tempero entra na
 * chave do hash: saber a receita deixa de bastar.
 *
 * Tem de ser o mesmo em toda instância e sobreviver a reinício, senão o
 * desafio deixa de ser o mesmo para todo mundo — por isso é variável de
 * ambiente, e não sorteio de processo. No Render o `render.yaml` pede um valor
 * gerado uma vez e guardado; sem `DAILY_SALT` o jogo roda igual, mas
 * adivinhável, e o aviso abaixo cobra isso alto na subida.
 *
 * Trocar o tempero troca o segredo do dia no meio do dia. Só mexa na virada.
 */
const SALT = process.env.DAILY_SALT ?? '';
if (!SALT && process.env.NODE_ENV === 'production') {
  console.warn(
    '[daily] DAILY_SALT não definida: o segredo do dia vira uma conta pública,'
    + ' que qualquer pessoa com o dataset refaz sem tocar no servidor.',
  );
}

/**
 * Quantos candidatos uma fatia precisa ter para valer como recorte do dia.
 * Abaixo disso o dia acaba na forca bruta: com dez nomes possiveis a pessoa
 * chuta a lista inteira sem ler dica nenhuma.
 */
const MIN_POOL = 15;

/** Data de hoje no fuso do jogo, como "2026-08-27". */
export function today(now = new Date()) {
  // en-CA formata como ISO, que e o que queremos para a chave
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export const isKnownUniverse = (universeId) => Boolean(UNIVERSES[universeId]);

/**
 * Sorteio deterministico: mesma chave, mesmo item, em qualquer instancia. O
 * tempero entra aqui, na frente da chave, e e o que separa "deterministico" de
 * "previsivel por quem quiser".
 */
function pickFrom(list, key) {
  const digest = createHash('sha256').update(`${SALT}:${key}`).digest();
  return list[digest.readUInt32BE(0) % list.length];
}

/** Sorteaveis do universo. Nao muda dentro do deploy: calculado uma vez so. */
const elegiveis = new Map();
function eligibleOf(universeId) {
  let list = elegiveis.get(universeId);
  if (!list) {
    list = datasetOf(universeId).list.filter(item => item.eligible);
    elegiveis.set(universeId, list);
  }
  return list;
}

/**
 * O recorte do dia, do jeito que o universo pediu no schema (`daily`). Nada
 * disso e anunciado: quem joga descobre porque a busca do chute so oferece
 * quem esta dentro.
 *
 * O eixo preferido e o tempo — a epoca do Naruto, a temporada de Rick and
 * Morty, a parte de JoJo, a geracao do Pokemon. Fatia menor que MIN_POOL nao
 * entra no sorteio, e eixo que sobra com uma fatia so fica solto (null): o
 * recorte seria o mesmo todo dia.
 *
 * A epoca sorteada nunca vem sozinha: leva junto todas as mais antigas, como
 * a sala faz. Uma epoca so seria so quem estreou nela, e sortear o Shippuden
 * deixaria de fora justamente o Naruto e o Sasuke, que sao do Classico — o
 * recorte e ate a epoca sorteada, entao a fatia mais curta e sempre o comeco
 * da historia.
 *
 * `daily.scope` e o caso a parte: uma epoca fixa, que nao roda nem acumula. E
 * o anime do Hunter x Hunter e os filmes dos herois — nao e recorte do dia, e
 * o pedaco do universo que o desafio reconhece.
 */
function cutOf(universeId, date) {
  const universe = UNIVERSES[universeId];
  const daily = universe?.daily;
  if (!daily) return { scope: null, group: null };

  const eligible = eligibleOf(universeId);
  let scope = daily.scope ? [daily.scope] : null;
  if (!scope && daily.rotate === 'scope') {
    const options = scopeOptions(universe);
    const faixas = options
      .map((_, i) => options.slice(0, i + 1).map(option => option.id))
      .filter(ids => eligible.filter(scopeFilter(universe, ids)).length >= MIN_POOL);
    // chaves proprias: epoca, categoria e segredo sao sorteios independentes
    scope = faixas.length >= 2 ? pickFrom(faixas, `${date}:${universeId}:epoca`) : null;
  }

  let group = null;
  if (daily.rotate === 'group') {
    const naEpoca = scope ? eligible.filter(scopeFilter(universe, scope)) : eligible;
    const counts = new Map();
    for (const item of naEpoca) counts.set(item.group, (counts.get(item.group) ?? 0) + 1);
    const categorias = (universe.groups ?? []).filter(g => (counts.get(g.id) ?? 0) >= MIN_POOL);
    group = categorias.length >= 2 ? pickFrom(categorias, `${date}:${universeId}:categoria`).id : null;
  }

  return { scope, group };
}

/**
 * O dia pronto de um universo: recorte, o teste que diz quem esta dentro, os
 * candidatos e o segredo. Guardado por (universo, data), porque e so disso que
 * qualquer uma dessas respostas depende.
 */
const dias = new Map();

function dayOf(universeId, date) {
  const key = `${universeId}:${date}`;
  const pronto = dias.get(key);
  if (pronto) return pronto;

  const universe = UNIVERSES[universeId];
  const { scope, group } = cutOf(universeId, date);
  const noScope = scope ? scopeFilter(universe, scope) : null;
  const matches = (item) => {
    if (!item) return false;
    if (group && item.group !== group) return false;
    return noScope ? noScope(item) : true;
  };

  const pool = eligibleOf(universeId).filter(matches);
  const dia = {
    scope,
    group,
    matches,
    pool,
    secret: pool.length ? pickFrom(pool, `${date}:${universeId}`) : null,
  };

  // o dia de ontem nao serve mais a ninguem; so a virada guarda dois por um
  // instante, enquanto um request atravessa a meia-noite
  for (const [antiga] of dias) if (!antiga.endsWith(`:${date}`)) dias.delete(antiga);
  dias.set(key, dia);
  return dia;
}

/** O recorte de hoje, para o cliente trancar a busca no mesmo pedaco. */
export function sliceOf(universeId, date = today()) {
  if (!UNIVERSES[universeId]) return { scope: null, group: null };
  const { scope, group } = dayOf(universeId, date);
  return { scope, group };
}

/** Se o item cabe no desafio de hoje — o mesmo teste que a busca faz no cliente. */
export function inSlice(universeId, item, date = today()) {
  if (!UNIVERSES[universeId] || !item) return false;
  return dayOf(universeId, date).matches(item);
}

/** O item do dia. Mesma data + mesmo universo = sempre o mesmo item. */
export function secretOf(universeId, date = today()) {
  return UNIVERSES[universeId] ? dayOf(universeId, date).secret : null;
}

/** Quantos candidatos o recorte de hoje deixou de pe. */
export const poolSizeOf = (universeId, date = today()) =>
  (UNIVERSES[universeId] ? dayOf(universeId, date).pool.length : 0);
