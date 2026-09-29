/**
 * O Termo: o segredo e uma palavra do universo, adivinhada letra a letra —
 * verde no lugar certo, amarelo existe noutro lugar, cinza nao tem. Regras
 * puras, sem servidor nem tela: o desafio do dia (src/http.js), a sala
 * (src/rooms.js) e o tabuleiro no navegador leem daqui.
 *
 * O segredo sai de dois sacos: os nomes do universo (Kakashi, Pikachu) e as
 * palavras dele (Kunai, Konoha, Pokébola — ver shared/termo-words.js). Cada um
 * vem com a categoria, que o tabuleiro mostra como dica.
 *
 * A palavra perde o acento como no Termo de verdade: "Kakashi Hatake" e
 * KAKASHIHATAKE. O que separa as palavras nao entra na conta, mas continua no
 * desenho do tabuleiro (ver `termoPattern`): saber que o segredo e 7 + 6
 * letras e dica, a mesma que o Termo daria olhando a forma da palavra.
 *
 * O chute e qualquer palavra do tamanho certo. Com KUNAI podendo ser o
 * segredo, nao da para exigir que o chute seja um nome do tema — e um
 * dicionario do portugues inteiro nao mora aqui.
 */
import { THEME_WORDS } from './termo-words.js';

/** Tentativas por segredo, como no Termo. A sala pode mudar (ver sanitizeSettings). */
export const TERMO_TRIES = 6;
export const TERMO_TRIES_RANGE = { min: 4, max: 10 };

/** Palavra curta demais e loteria; comprida demais nao cabe na tela do celular. */
export const TERMO_MIN = 4;
export const TERMO_MAX = 12;

const unaccent = (text) => String(text ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toUpperCase();

/** As letras da palavra: sem acento, sem espaco, sem pontuacao, em maiuscula. */
export const termoKey = (text) => unaccent(text).replace(/[^A-Z0-9]/g, '');

/**
 * O desenho da palavra: quantas letras tem cada pedaco. E o que o tabuleiro
 * usa para deixar o vao entre "KAKASHI" e "HATAKE".
 */
export const termoPattern = (text) => unaccent(text)
  .split(/[^A-Z0-9]+/)
  .filter(Boolean)
  .map(word => word.length);

/** So letras (numero nao tem tecla no teclado da tela) e no tamanho que cabe. */
const fits = (key) => key.length >= TERMO_MIN && key.length <= TERMO_MAX && !/[0-9]/.test(key);

/**
 * Pinta o chute contra o segredo, com a regra das letras repetidas do Termo:
 * primeiro os verdes, depois os amarelos so enquanto sobrar daquela letra no
 * segredo. Chutar AAAA contra BANA pinta um verde e um amarelo, nao quatro.
 */
export function scoreTermo(guess, answer) {
  const marks = Array(guess.length).fill('miss');
  const left = new Map();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'hit';
    else left.set(answer[i], (left.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'hit') continue;
    const n = left.get(guess[i]) ?? 0;
    if (n > 0) {
      marks[i] = 'near';
      left.set(guess[i], n - 1);
    }
  }
  return marks;
}

/**
 * A categoria dos nomes, tirada do jeito que o universo chama o proprio
 * segredo: "o campeão secreto" vira "Campeão", "a pessoa famosa secreta" vira
 * "Pessoa famosa".
 */
export function nameCategory(universe) {
  const bare = String(universe?.secretLabel ?? 'o personagem secreto')
    .replace(/^(o|a|os|as)\s+/i, '')
    .replace(/\s+secret[oa]s?$/i, '')
    .trim() || 'personagem';
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/**
 * Os nomes que podem ser o segredo: sorteaveis e do tamanho que cabe. Cada um
 * leva o item junto (`item`), para a revelacao mostrar a figura.
 */
export function termoNames(items, universe) {
  const cat = nameCategory(universe);
  const seen = new Set();
  const out = [];
  for (const item of items ?? []) {
    if (!item.eligible) continue;
    const key = termoKey(item.name);
    if (!fits(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: item.name, cat, item });
  }
  return out;
}

/**
 * Categoria com menos palavras que isto nao aparece como ela mesma: "Objeto"
 * com so o Disco de Duelo dentro seria a resposta escrita em cima do
 * tabuleiro. Essas palavras vao para a categoria generica do tema.
 */
const SMALL_CAT = 3;
const GENERIC_CAT = 'Termo';

/** As palavras do universo (shared/termo-words.js), prontas para o sorteio. */
export function termoThemeWords(universeId) {
  const seen = new Set();
  const out = [];
  for (const [cat, list] of Object.entries(THEME_WORDS[universeId] ?? {})) {
    for (const label of list.split(',').map(w => w.trim()).filter(Boolean)) {
      const key = termoKey(label);
      if (!fits(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label, cat, item: null });
    }
  }
  const sizes = termoCatSizes(out);
  for (const entry of out) if (sizes.get(entry.cat) < SMALL_CAT) entry.cat = GENERIC_CAT;
  return out;
}

/** Quantas palavras cada categoria tem, somando os sacos que forem passados. */
export function termoCatSizes(...lists) {
  const sizes = new Map();
  for (const entry of lists.flat()) sizes.set(entry.cat, (sizes.get(entry.cat) ?? 0) + 1);
  return sizes;
}

/**
 * Quantas linhas a palavra merece. A categoria fica a vista, e categoria
 * pequena e Termo facil: "Olho" no Naruto sao quatro palavras, e com seis
 * linhas da para chutar a lista inteira sem ler cor nenhuma. Quanto menor a
 * categoria, menos linhas — os nomes, as centenas, ficam com todas.
 *
 * `base` e o que a sala (ou o diario) daria a uma palavra de categoria grande;
 * o corte e o mesmo em qualquer base, e nunca desce de duas linhas.
 */
export function termoTriesFor(catSize, base = TERMO_TRIES) {
  if (!base) return 0;   // a sala ligou linhas infinitas: nao ha o que cortar
  const full = catSize >= 40 ? 6 : catSize >= 20 ? 5 : catSize >= 10 ? 4 : catSize >= 4 ? 3 : 2;
  return Math.max(2, base - (TERMO_TRIES - full));
}

/**
 * O sorteio do Termo: primeiro o saco (nome ou palavra do tema, meio a meio
 * quando os dois existem), depois quem dentro dele. Sem isso os mil nomes do
 * Pokemon abafariam as sessenta palavras, e KUNAI quase nunca sairia.
 *
 * `pick(list, salt)` escolhe um da lista: aleatorio na sala, pelo hash do dia
 * no diario.
 */
export function pickTermo(names, words, pick) {
  const sacks = [names, words].filter(list => list.length);
  if (!sacks.length) return null;
  return pick(pick(sacks, 'saco'), 'palavra');
}

/**
 * O que a tela precisa para desenhar e revelar a palavra — sem o item
 * inteiro, que carrega as colunas das dicas e nao interessa aqui.
 */
export const termoAnswer = (entry) => entry && {
  label: entry.label,
  cat: entry.cat,
  sprite: entry.item?.sprite ?? null,
};

/** O melhor que cada letra ja mostrou, para pintar o teclado. */
export function keyboardMarks(rows) {
  const rank = { miss: 1, near: 2, hit: 3 };
  const out = {};
  for (const row of rows ?? []) {
    if (!row.word) continue;
    [...row.word].forEach((letter, i) => {
      const mark = row.marks?.[i];
      if (mark && (rank[mark] ?? 0) > (rank[out[letter]] ?? 0)) out[letter] = mark;
    });
  }
  return out;
}
