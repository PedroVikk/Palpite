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
 */
import { createHash } from 'node:crypto';
import { UNIVERSES, scopeFilter, scopeOptions } from '../shared/universes.js';
import { datasetOf } from './catalog.js';

const ZONE = 'America/Sao_Paulo';

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

/** Sorteio deterministico: mesma chave, mesmo item, em qualquer instancia. */
function pickFrom(list, key) {
  const digest = createHash('sha256').update(key).digest();
  return list[digest.readUInt32BE(0) % list.length];
}

const eligibleOf = (universeId) => datasetOf(universeId).list.filter(item => item.eligible);

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
 * A epoca sorteada nunca vem sozinha: leva junto todas as mais novas. Uma
 * epoca so seria so quem estreou nela, e sortear o Shippuden deixaria de fora
 * justamente o Naruto e o Sasuke, que sao do Classico — assim o dia rende mais
 * gente, e a fatia mais curta e sempre a ponta mais nova da historia.
 *
 * `daily.scope` e o caso a parte: uma epoca fixa, que nao roda nem acumula. E
 * o anime do Hunter x Hunter e os filmes dos herois — nao e recorte do dia, e
 * o pedaco do universo que o desafio reconhece.
 */
export function sliceOf(universeId, date = today()) {
  const universe = UNIVERSES[universeId];
  const daily = universe?.daily;
  if (!daily) return { scope: null, group: null };

  const eligible = eligibleOf(universeId);
  let scope = daily.scope ? [daily.scope] : null;
  if (!scope && daily.rotate === 'scope') {
    const options = scopeOptions(universe);
    const faixas = options
      .map((_, i) => options.slice(i).map(option => option.id))
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

/** Se o item cabe no desafio de hoje — o mesmo teste que a busca faz no cliente. */
export function inSlice(universeId, item, date = today()) {
  const universe = UNIVERSES[universeId];
  if (!universe || !item) return false;
  const { scope, group } = sliceOf(universeId, date);
  if (group && item.group !== group) return false;
  return scope ? scopeFilter(universe, scope)(item) : true;
}

/** Candidatos do dia: os sorteaveis que sobram depois do recorte. */
const poolOf = (universeId, date = today()) =>
  eligibleOf(universeId).filter(item => inSlice(universeId, item, date));

/** O item do dia. Mesma data + mesmo universo = sempre o mesmo item. */
export function secretOf(universeId, date = today()) {
  const pool = poolOf(universeId, date);
  return pool.length ? pickFrom(pool, `${date}:${universeId}`) : null;
}

export const poolSizeOf = (universeId, date = today()) => poolOf(universeId, date).length;
