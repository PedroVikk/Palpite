/**
 * A imagem do segredo, servida em porções de informação.
 *
 * O modo imagem mostra quem é o segredo antes de dizer o nome: uma miniatura
 * que começa irreconhecível e vai ganhando nitidez a cada chute errado. A
 * tentação é mandar a imagem inteira e escondê-la no navegador — um `blur` de
 * CSS, uma máscara, um canvas. Todos fazem a mesma coisa: entregam a resposta
 * e pedem para o jogador não olhar. Um F12 desfaz qualquer um deles, e aí o
 * desafio do dia acaba para todo mundo, não só para quem abriu o inspetor.
 *
 * Então a redução acontece aqui, e é destrutiva: o degrau 0 é uma imagem de
 * cinco pixels de largura de verdade, com cinco colunas de pixel dentro do
 * arquivo. Não há o que revelar no navegador porque não há o que esconder — a
 * informação que não foi ganha simplesmente não viajou. O jogador amplia o que
 * recebeu, e é só isso que existe.
 *
 * Os degraus saem prontos em WebP e cabem no JSON da resposta (141 bytes no
 * degrau 0, 1,2 KB no topo), então não há rota de imagem para apontar: a
 * figura chega junto com a dica, pela mesma porta e com as mesmas regras.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SPRITES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'sprites');

/**
 * A escada da nitidez: a largura máxima, em pixels, do que o navegador recebe
 * em cada degrau. As miniaturas do jogo têm de 96 a 128 pixels, então o topo
 * (44) ainda é menos da metade da resolução original — reconhecível para quem
 * já gastou oito chutes, e nunca a imagem inteira. A imagem inteira é prêmio
 * de acerto, e quem mostra ela é o `Reveal`.
 *
 * **A escada é colorida desde o primeiro degrau, e isso é o resultado de um
 * erro.** A primeira versão começava em 6 pixels e segurava a cor pelos quatro
 * degraus iniciais, para "a cor também se pagar". Na prática a escada virou
 * dois estados e nenhum meio-termo: em preto e branco o Pikachu, o Naruto e o
 * Goku são a mesma mancha cinza, impossível de nomear; no degrau em que a cor
 * entrava, todos os três estavam entregues de uma vez. Não havia dedução no
 * meio, só um precipício.
 *
 * A cor de longe é justamente a dica que faz o jogo andar — um borrão laranja
 * e amarelo reduz o elenco à paleta certa sem dizer quem é. Então ela fica, e
 * quem segura a dificuldade é só a resolução, que começa bem mais baixa (5) do
 * que dava para começar em cinza. Assim cada degrau é um ganho visível: paleta,
 * silhueta, contorno, rosto.
 *
 * Se um dia quiser apertar o modo, **desça o primeiro degrau, não tire a cor** —
 * já foi tentado.
 */
const LADDER = [5, 7, 9, 11, 14, 18, 24, 32, 44];

/** O último degrau. Chutar além dele não clareia mais nada. */
export const TOP = LADDER.length - 1;

/** Em que degrau está quem já gastou `guesses` chutes. */
export const levelFor = (guesses) => Math.min(TOP, Math.max(0, Math.trunc(Number(guesses)) || 0));

/**
 * Se dá para jogar de imagem com este item. Só vale a miniatura espelhada em
 * data/sprites (o `catalog` troca o endereço de origem pelo local quando o
 * arquivo existe): depender da CDN aqui seria deixar o desafio do dia inteiro
 * de um universo na mão de um Fandom fora do ar, já que o segredo do dia é um
 * só e não tem como ser trocado.
 */
export const hasPicture = (item) => Boolean(item?.sprite?.startsWith('/sprites/'));

/**
 * Os quadros prontos, por item. São poucos e minúsculos: um dia inteiro de
 * desafio são 21 universos × 9 degraus, e uma sala gasta 9 por rodada. O teto
 * existe só para uma maratona de salas não crescer sem fim; a fila é de
 * chegada, que é boa o bastante para um cache de coisa barata de refazer.
 */
const frames = new Map();
const MAX_FRAMES = 4000;
/** Quem já está sendo gerado, para dois pedidos não renderizarem o mesmo item. */
const rendering = new Map();

const keyOf = (universeId, item, level) => `${universeId}:${item.id}:${level}`;

/**
 * Tira a moldura vazia antes de reduzir. As miniaturas vêm de fontes que não
 * combinaram nada entre si: o sprite do Pokémon é 96 × 96 com o bicho pequeno
 * no meio, e o retrato do elenco de One Piece já vem justo. Sem aparar, o
 * degrau 0 do Pokémon gastaria metade dos seus cinco pixels desenhando margem
 * transparente — a mesma dica custaria mais chutes num universo do que no
 * outro, por um detalhe de como o dataset foi raspado.
 *
 * Só onde há transparência para guiar o corte: numa foto o `trim` iria pela
 * cor do canto e comeria fundo de verdade. E sprite que é só uma cor não tem
 * borda para tirar — o sharp reclama, e aí a imagem segue inteira.
 */
async function framed(file) {
  const source = await fs.readFile(file);
  if (!(await sharp(source).metadata()).hasAlpha) return source;
  try {
    return await sharp(source).trim({ threshold: 1 }).toBuffer();
  } catch {
    return source;
  }
}

async function render(universeId, item) {
  const source = await framed(path.join(SPRITES, universeId, `${item.id}.webp`));

  for (const [level, width] of LADDER.entries()) {
    // `inside` mantém a proporção: a caixa é o teto, não o formato. Sem isso a
    // carta de Yu-Gi-Oh (88 × 128) sairia esticada e a silhueta mentiria.
    const webp = await sharp(source)
      .resize({ width, height: width, fit: 'inside' })
      .webp({ quality: 78 })
      .toBuffer();

    if (frames.size >= MAX_FRAMES) frames.delete(frames.keys().next().value);
    frames.set(keyOf(universeId, item, level), `data:image/webp;base64,${webp.toString('base64')}`);
  }
}

/**
 * Deixa a escada inteira pronta. Gerar a escada custa uns 40 ms na primeira
 * vez, então quem chama é a largada da rodada (ou a abertura do desafio), e
 * não o chute: quando o chute chega, o degrau seguinte já está no cache.
 */
export async function prepare(universeId, item) {
  if (!hasPicture(item)) return false;
  /**
   * O degrau 0 é quem responde por toda a escada, e não o topo. Os quadros
   * entram no cache em ordem e a faxina é de chegada, então o 0 é o primeiro a
   * cair: se ele ainda está lá, os de cima também estão. Perguntar pelo topo
   * daria "pronta" para uma escada que perdeu os primeiros degraus — e aí a
   * tela ficaria com a moldura vazia justamente no começo do jogo.
   */
  if (frames.has(keyOf(universeId, item, 0))) return true;

  const key = `${universeId}:${item.id}`;
  let job = rendering.get(key);
  if (!job) {
    job = render(universeId, item).finally(() => rendering.delete(key));
    rendering.set(key, job);
  }
  try {
    await job;
    return true;
  } catch (err) {
    console.error(`[picture] não consegui preparar ${universeId}#${item.id}:`, err.message);
    return false;
  }
}

/**
 * O quadro pronto, sem esperar por nada. É o que a sala usa: `publicState` é
 * síncrono, e segurar o broadcast para renderizar imagem travaria o turno de
 * todo mundo. Cache vazio devolve null e o cliente mostra a moldura vazia até
 * o `prepare` chamar o próximo broadcast.
 */
export const frameOf = (universeId, item, level) =>
  (item ? frames.get(keyOf(universeId, item, levelFor(level))) ?? null : null);

/** O quadro, gerando na hora se preciso. É o caminho do desafio do dia, que é HTTP e pode esperar. */
export async function frameFor(universeId, item, level) {
  const ready = frameOf(universeId, item, level);
  if (ready) return ready;
  return (await prepare(universeId, item)) ? frameOf(universeId, item, level) : null;
}
