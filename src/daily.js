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
import { UNIVERSES } from '../shared/universes.js';
import { datasetOf } from './catalog.js';

const ZONE = 'America/Sao_Paulo';

/**
 * Quantos candidatos uma categoria precisa ter para virar o tema do dia.
 * Abaixo disso o desafio ja nasceria quase entregue — os 2 anoes do Senhor
 * dos Aneis, as 2 cartas Pendulo do Yu-Gi-Oh!.
 */
const MIN_GROUP = 10;

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
 * A categoria do dia: uma geracao de Pokemon, uma casa de Hogwarts, um tipo de
 * carta — a mesma fatia que o host liga e desliga no lobby, aqui reduzida a uma
 * so. E o tema anunciado na tela: quem joga sabe de onde o segredo saiu.
 *
 * Universo sem duas fatias grandes o bastante joga sem tema (null): com uma so
 * o "tema" seria o mesmo todo dia, e com fatias minusculas o desafio acabaria
 * no primeiro chute.
 */
export function groupOf(universeId, date = today()) {
  const universe = UNIVERSES[universeId];
  if (!universe?.groups?.length) return null;

  const counts = new Map();
  for (const item of eligibleOf(universeId)) counts.set(item.group, (counts.get(item.group) ?? 0) + 1);

  const viable = universe.groups.filter(group => (counts.get(group.id) ?? 0) >= MIN_GROUP);
  // chave propria: a categoria e o item sao sorteios independentes
  return viable.length >= 2 ? pickFrom(viable, `${date}:${universeId}:categoria`) : null;
}

/** Candidatos do dia: os sorteaveis da categoria do dia, ou todos se nao houver. */
const poolOf = (universeId, date = today()) => {
  const group = groupOf(universeId, date);
  const eligible = eligibleOf(universeId);
  return group ? eligible.filter(item => item.group === group.id) : eligible;
};

/** O item do dia. Mesma data + mesmo universo = sempre o mesmo item. */
export function secretOf(universeId, date = today()) {
  const pool = poolOf(universeId, date);
  return pool.length ? pickFrom(pool, `${date}:${universeId}`) : null;
}

export const poolSizeOf = (universeId, date = today()) => poolOf(universeId, date).length;
