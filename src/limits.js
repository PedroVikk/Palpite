/**
 * O freio do chute do dia.
 *
 * O `/api/daily/:universo/guess/:id` é um oráculo: ele responde "acertou" ou
 * "errou" para qualquer id, de graça e sem memória. Como o dataset é público
 * — a busca do chute precisa dele —, dá para varrer todos os ids até um voltar
 * `correct: true`. Foi o que fizeram: um script com vinte requisições
 * paralelas achava o segredo em segundos.
 *
 * Tirar o oráculo do ar tiraria o jogo junto: alguém tem de dizer se o chute
 * acertou, e a resposta não pode sair do navegador (aí o segredo viajaria).
 * O que dá é cobrar o preço de quem varre sem cobrar nada de quem joga — as
 * duas coisas não se parecem em nada:
 *
 *   ritmo — um balde de fichas por chave. Rajada paralela esvazia o balde na
 *           primeira leva e passa a levar 429; quem digita um nome de cada vez
 *           nunca chega perto do fundo.
 *   teto  — quantos chutes uma chave dá num universo por dia. Gente resolve em
 *           dezenas (a tabela de dicas é boa); varredura precisa de centenas.
 *
 * A chave é a conta de quem está logado e o IP de quem não está. Logado ganha
 * orçamento próprio de propósito: sem isso a escola e o café inteiros
 * dividiriam um único teto.
 *
 * Nada disto substitui o [tempero do sorteio](./daily.js): o freio encarece a
 * varredura, o tempero impede a conta feita em casa, sem tocar no servidor.
 */

const numero = (nome, padrao) => {
  const valor = Number(process.env[nome]);
  return Number.isFinite(valor) && valor >= 0 ? valor : padrao;
};

/** Fichas do balde e o tempo de reposição de cada uma. */
const FICHAS = numero('DAILY_RITMO_FICHAS', 12);
const RECARGA_MS = numero('DAILY_RITMO_MS', 2000);

/**
 * Chutes por (chave, universo) num dia. É teto de abuso, não de jogo: com a
 * tabela de dicas, resolver leva menos de uma dezena de chutes, e teimar leva
 * duas. O número certo fica acima do jogador teimoso e abaixo do recorte do
 * dia, que hoje vai de 17 (Ordem Paranormal) a 284 (Heróis) candidatos.
 *
 * Onde o recorte é menor que este teto, a varredura sempre coube num dia — e
 * cabe também para uma pessoa com paciência, que é o preço de MIN_POOL lá no
 * daily.js. O freio não inventa segredo onde o universo é pequeno demais.
 */
const TETO_DIA = numero('DAILY_TETO_DIA', 60);

/**
 * Quantas chaves cabem na memória antes de a faxina ser antecipada. O IP não é
 * forjável (vem do proxy, ver `trust proxy` no http.js), mas quem tem um /64 de
 * IPv6 tem endereço sobrando — o teto evita que isso vire consumo sem fim.
 */
const MAX_CHAVES = 50_000;

const baldes = new Map();   // chave -> { fichas, visto }
const cotas = new Map();    // `${data}:${chave}:${universo}` -> chutes gastos

/**
 * Baldes cheios e parados não guardam informação nenhuma: quem some por dez
 * minutos volta com o balde cheio de qualquer jeito. Cota de outro dia também
 * já não serve a ninguém.
 */
function faxina(agora = Date.now(), hoje = null) {
  for (const [chave, balde] of baldes) {
    const cheio = balde.fichas + (agora - balde.visto) / RECARGA_MS >= FICHAS;
    if (cheio && agora - balde.visto > 10 * 60_000) baldes.delete(chave);
  }
  if (hoje) for (const chave of cotas.keys()) if (!chave.startsWith(`${hoje}:`)) cotas.delete(chave);
}

setInterval(() => faxina(), 5 * 60_000).unref();

/**
 * Cobra um chute da chave. Devolve `{ ok: true }` ou o motivo da recusa junto
 * com quantos segundos esperar — o cliente mostra a mensagem e o `Retry-After`
 * sai no cabeçalho.
 *
 * O teto é conferido antes do balde para a resposta não mentir sobre o tempo:
 * quem estourou o dia não resolve nada esperando alguns segundos.
 */
export function spendDailyGuess(chave, universo, hoje) {
  const agora = Date.now();
  if (baldes.size > MAX_CHAVES) faxina(agora, hoje);

  const cota = `${hoje}:${chave}:${universo}`;
  const gastos = cotas.get(cota) ?? 0;
  if (gastos >= TETO_DIA) {
    // uma linha por chave que estourou, na primeira recusa: e o que aparece no
    // log quando alguem esta varrendo, e o que nao vira enxurrada se ele insistir
    if (gastos === TETO_DIA) {
      cotas.set(cota, gastos + 1);
      console.warn(`[limits] ${chave} estourou o teto de ${TETO_DIA} chutes em ${universo} (${hoje}).`);
    }
    return {
      ok: false,
      error: 'Você já deu chutes demais neste universo hoje. O desafio volta a aceitar amanhã.',
      // até a virada do dia; o cliente só usa isso como "não insista"
      retryAfter: 3600,
    };
  }

  const balde = baldes.get(chave) ?? { fichas: FICHAS, visto: agora };
  if (RECARGA_MS > 0) {
    balde.fichas = Math.min(FICHAS, balde.fichas + (agora - balde.visto) / RECARGA_MS);
  } else {
    balde.fichas = FICHAS;   // sem ritmo: só o teto do dia manda (usado nos testes)
  }
  balde.visto = agora;

  if (balde.fichas < 1) {
    baldes.set(chave, balde);
    return {
      ok: false,
      error: 'Calma no chute! Espere alguns segundos e tente de novo.',
      retryAfter: Math.max(1, Math.ceil(((1 - balde.fichas) * RECARGA_MS) / 1000)),
    };
  }

  balde.fichas -= 1;
  baldes.set(chave, balde);
  cotas.set(cota, gastos + 1);
  return { ok: true };
}
