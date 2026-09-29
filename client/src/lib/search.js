/** Busca do autocomplete: sem acento, prefixo antes de contido, com teto. */

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// cabem ~5 na altura da lista; o resto rola. Teto alto o bastante para
// buscas curtas ("kaka" no Naruto) nao esconderem o nome procurado
const LIMIT = 40;

/**
 * @param items    catalogo do universo (indice enxuto vindo de /api/dataset)
 * @param choosing no duelo, escolher o segredo so aceita sorteaveis dos grupos
 * @param groups   grupos ligados; vazio = todos (o dia pode nao ter categoria)
 * @param guessed  ids ja chutados na rodada, que somem da lista
 * @param inScope  recorte do universo (o anime/manga do Hunter x Hunter)
 */
export function search(query, { items, choosing = false, groups = [], guessed = [], inScope, possible = null }) {
  const q = normalize(query.trim());
  if (!q) return [];

  const groupSet = new Set(groups);
  const guessedSet = new Set(choosing ? [] : guessed);
  const scoped = inScope ?? (() => true);
  // o chute segue os mesmos grupos/recorte que o segredo: se a sala so ligou a
  // Gen 1, nao adianta oferecer um Pokemon de fora — e no desafio diario e essa
  // lista que tranca o dia, sem aviso nenhum na tela. Lista de grupos vazia nao
  // filtra por grupo (o dia pode ter epoca e nenhuma categoria), mas o recorte
  // continua valendo. So o "choosing" exige tambem `eligible`.
  const inPool = (i) => (!groups.length || groupSet.has(i.group)) && scoped(i);
  const source = items.filter(choosing ? (i => i.eligible && inPool(i)) : inPool);

  /**
   * Busca esperta (`possible`, o que a tabela ainda nao descartou): os nomes
   * possiveis vem primeiro e o resto desce apagado, marcado com `out`. Apagar
   * e nao esconder: quem quiser chutar um descartado de proposito ainda pode.
   */
  const starts = [], contains = [], outs = [];
  for (const item of source) {
    if (guessedSet.has(item.id)) continue;
    // alem do nome exibido, aceita apelidos (ex.: o nome em ingles da carta)
    const names = [item.name, ...(item.aliases ?? [])].map(normalize);
    const bucket = possible && !choosing && !possible.has(item.id) ? outs : null;
    if (names.some(n => n.startsWith(q))) (bucket ?? starts).push(bucket ? { ...item, out: true } : item);
    else if (names.some(n => n.includes(q))) (bucket ?? contains).push(bucket ? { ...item, out: true } : item);
    if (starts.length >= LIMIT) break;
  }
  return [...starts, ...contains, ...outs].slice(0, LIMIT);
}
