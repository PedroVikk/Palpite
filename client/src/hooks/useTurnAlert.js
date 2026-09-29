import { useEffect, useRef } from 'react';
import { buzz, ding, systemNotify, tick } from '../lib/alerts.js';
import { pushNotice } from '../lib/notices.js';
import { usePrefs } from '../lib/prefs.js';

let baseTitle = null;

/**
 * Tudo o que avisa a pessoa fora do tabuleiro: o toque e a vibracao da vez, o
 * "voce e o proximo", os tiques dos ultimos segundos, os avisos de metade e de
 * 10 s, e o titulo da aba (que e o que quem esta em outra aba consegue ver).
 *
 * Devolve o total de segundos do relogio atual, que a barra de tempo usa para
 * saber quanto ja foi. Sem cronometro (`left` nulo) sobra so o aviso de vez.
 */
export function useTurnAlert({ myTurn, nextIsMe, left, deadline }) {
  const prefs = usePrefs();
  baseTitle ??= document.title;

  // o total do relogio: o que sobrava quando este prazo apareceu
  const clock = useRef({ deadline: null, total: 0, half: false, ten: false });
  if (clock.current.deadline !== deadline) {
    clock.current = { deadline, total: left ?? 0, half: false, ten: false };
  }
  if (left !== null && left > clock.current.total) clock.current.total = left;
  const total = clock.current.total;

  const wasMine = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMine.current) {
      ding();
      buzz();
      systemNotify('Palpite', 'É a sua vez de chutar.');
    }
    wasMine.current = myTurn;
  }, [myTurn]);

  const wasNext = useRef(false);
  useEffect(() => {
    if (nextIsMe && !wasNext.current) {
      pushNotice({ kind: 'next', text: 'Você é o próximo a chutar.' });
    }
    wasNext.current = nextIsMe;
  }, [nextIsMe]);

  // tique-taque nos ultimos 5 segundos, so para quem esta na vez
  useEffect(() => {
    if (!myTurn || left === null || left < 1 || left > 5) return;
    tick();
    if (left === 3) buzz([80]);
  }, [left, myTurn]);

  // metade do tempo e 10 s: um aviso discreto, uma vez cada
  useEffect(() => {
    if (!myTurn || left === null || !total) return;
    const c = clock.current;
    if (!c.half && total >= 20 && left <= total / 2 && left > 10) {
      c.half = true;
      pushNotice({ kind: 'time', text: `Metade do tempo: restam ${left} segundos.` });
    }
    if (!c.ten && total > 12 && left <= 10 && left > 0) {
      c.ten = true;
      pushNotice({ kind: 'time', text: 'Faltam 10 segundos.' });
    }
  }, [left, myTurn, total]);

  useEffect(() => {
    if (!prefs.title) {
      document.title = baseTitle;
      return;
    }
    if (myTurn) document.title = `Sua vez${left !== null ? ` (${left}s)` : ''} - Palpite`;
    else if (left !== null && left <= 10 && left > 0) document.title = `${left}s - Palpite`;
    else document.title = baseTitle;
  }, [myTurn, left, prefs.title]);

  useEffect(() => () => { document.title = baseTitle; }, []);

  return total;
}
