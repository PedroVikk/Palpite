/** Busca do autocomplete: sem acento, prefixo antes de contido, com teto. */

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// cabem ~5 na altura da lista; o resto rola. Teto alto o bastante para
// buscas curtas ("kaka" no Naruto) nao esconderem o nome procurado
const LIMIT = 40;

/**
 * @param items    catalogo do universo (indice enxuto vindo de /api/dataset)
 * @param choosing no duelo, escolher o segredo so aceita sorteaveis dos grupos
 * @param groups   grupos ligados na sala
 * @param guessed  ids ja chutados na rodada, que somem da lista
 * @param inScope  recorte do universo (o anime/manga do Hunter x Hunter)
 */
export function search(query, { items, choosing = false, groups = [], guessed = [], inScope }) {
  const q = normalize(query.trim());
  if (!q) return [];

  const groupSet = new Set(groups);
  const guessedSet = new Set(choosing ? [] : guessed);
  const scoped = inScope ?? (() => true);
  const source = choosing
    ? items.filter(i => i.eligible && groupSet.has(i.group) && scoped(i))
    : items;

  const starts = [], contains = [];
  for (const item of source) {
    if (guessedSet.has(item.id)) continue;
    // alem do nome exibido, aceita apelidos (ex.: o nome em ingles da carta)
    const names = [item.name, ...(item.aliases ?? [])].map(normalize);
    if (names.some(n => n.startsWith(q))) starts.push(item);
    else if (names.some(n => n.includes(q))) contains.push(item);
    if (starts.length >= LIMIT) break;
  }
  return [...starts, ...contains].slice(0, LIMIT);
}
