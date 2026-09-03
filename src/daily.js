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
 * Abaixo disso o desafio ja nasceria quase entregue — os 3 personagens da 5a
 * temporada de Rick and Morty, as 2 cartas Pendulo do Yu-Gi-Oh!.
 */
const MIN_POOL = 10;

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
 * O recorte do dia: uma epoca e uma categoria — os dois eixos que o host liga e
 * desliga no lobby, aqui reduzidos a um de cada. Nada disso e anunciado: quem
 * joga descobre porque a busca do chute so oferece quem esta dentro.
 *
 * A epoca vem primeiro, e a categoria e escolhida ja dentro dela — senao a
 * combinacao das duas poderia sobrar em tres nomes. Eixo sem duas fatias
 * grandes o bastante fica solto (null): com uma so o recorte seria o mesmo todo
 * dia, e com fatias minusculas o desafio acabaria no primeiro chute.
 */
export function sliceOf(universeId, date = today()) {
  const universe = UNIVERSES[universeId];
  if (!universe) return { scope: null, group: null };
  const eligible = eligibleOf(universeId);

  const epocas = scopeOptions(universe)
    .filter(option => eligible.filter(scopeFilter(universe, [option.id])).length >= MIN_POOL);
  // chaves proprias: epoca, categoria e segredo sao sorteios independentes
  const scope = epocas.length >= 2 ? pickFrom(epocas, `${date}:${universeId}:epoca`).id : null;

  const naEpoca = scope ? eligible.filter(scopeFilter(universe, [scope])) : eligible;
  const counts = new Map();
  for (const item of naEpoca) counts.set(item.group, (counts.get(item.group) ?? 0) + 1);

  const categorias = (universe.groups ?? []).filter(g => (counts.get(g.id) ?? 0) >= MIN_POOL);
  const group = categorias.length >= 2 ? pickFrom(categorias, `${date}:${universeId}:categoria`).id : null;

  return { scope, group };
}

/** Se o item cabe no desafio de hoje — o mesmo teste que a busca faz no cliente. */
export function inSlice(universeId, item, date = today()) {
  const universe = UNIVERSES[universeId];
  if (!universe || !item) return false;
  const { scope, group } = sliceOf(universeId, date);
  if (group && item.group !== group) return false;
  return scope ? scopeFilter(universe, [scope])(item) : true;
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
