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

/** Candidatos do dia: todos os sorteaveis do universo, sem filtro de grupo. */
const poolOf = (universeId) => datasetOf(universeId).list.filter(item => item.eligible);

/** O item do dia. Mesma data + mesmo universo = sempre o mesmo item. */
export function secretOf(universeId, date = today()) {
  const pool = poolOf(universeId);
  if (!pool.length) return null;
  const digest = createHash('sha256').update(`${date}:${universeId}`).digest();
  return pool[digest.readUInt32BE(0) % pool.length];
}

export const poolSizeOf = (universeId) => poolOf(universeId).length;
