/**
 * A pontuacao, pura, dividida entre o servidor (que paga) e a tela (que
 * mostra quanto o acerto vale agora). Uma conta so: se a tela fizesse a sua,
 * um dia ela prometeria um numero e o servidor pagaria outro.
 */
import { TERMO_TRIES } from './termo.js';

/** Quanto mais chutes ja gastos na rodada, menos vale o acerto. */
export function scoreForWin(totalGuessesInRound) {
  return Math.max(25, 100 - 5 * Math.max(0, totalGuessesInRound - 1));
}

/**
 * Termo: acertar vale mais quanto menos linhas gastou (10 por linha que
 * sobrou, mais 10 do acerto), e o primeiro a fechar leva um bonus — e o que
 * faz o x1 ser corrida alem de conta.
 */
export const SCORE_TERMO_FIRST = 20;
//
// Sem teto de linhas (tries 0), a conta usa as 6 do Termo, com piso de 10.
export const scoreForTermo = (used, tries, first) =>
  Math.max(10, 10 * ((tries || TERMO_TRIES) - used + 1)) + (first ? SCORE_TERMO_FIRST : 0);

/**
 * Velocidade: cada segredo resolvido vale 10, e quem termina a fila primeiro
 * (ou, no fim do relogio, quem resolveu mais) leva 100.
 */
export const SCORE_SPEED_EACH = 10;
export const SCORE_SPEED_WIN = 100;

/** No modo duelo, o dono do segredo pontua se ninguem acertar. */
export const SCORE_CHOOSER_SURVIVED = 50;

/**
 * Impostor. Ele leva 100 quando escapa da votacao, quando acerta o chute final
 * depois de pego, ou quando chuta o segredo no meio das voltas. Pego e errando
 * o chute final, cada um da mesa leva 50, e quem votou nele leva mais 20.
 */
export const SCORE_IMPOSTOR_WINS = 100;
export const SCORE_CREW_WINS = 50;
export const SCORE_RIGHT_VOTE = 20;

/**
 * Batalha naval. Afundar vale o acerto de sempre, contado pelos chutes daquele
 * tabuleiro (ver scoreForWin). Quem termina com o segredo de pe leva o bonus.
 */
export const SCORE_BATTLE_SURVIVOR = 50;
