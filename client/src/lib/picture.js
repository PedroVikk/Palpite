/**
 * O gemeo de `hasPicture` do servidor (src/picture.js), para a tela poder
 * decidir sem perguntar: so vale a miniatura espelhada em data/sprites, porque
 * e a unica que o servidor consegue reduzir degrau a degrau.
 *
 * O indice do universo ja traz `sprite` de cada item (ver src/catalog.js),
 * entao a conta sai do que a busca do chute ja baixou — sem rota nova.
 */
export const hasPicture = (item) => Boolean(item?.sprite?.startsWith('/sprites/'));

/**
 * Se da para jogar de imagem neste universo. Um punhado de figuras nao basta:
 * com cinco possiveis, a rodada acaba na forca bruta antes de a imagem clarear.
 */
export const canPlayPicture = (items) => {
  if (!items) return true;   // ainda carregando: nao desliga o que talvez exista
  let found = 0;
  for (const item of items) {
    if (item.eligible && hasPicture(item) && ++found >= 15) return true;
  }
  return false;
};
