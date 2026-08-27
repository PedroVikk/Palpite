/** Busca do autocomplete: sem acento, prefixo antes de contido, no maximo 8. */

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const LIMIT = 8;

/**
 * @param items    catalogo do universo (indice enxuto vindo de /api/dataset)
 * @param choosing no duelo, escolher o segredo so aceita sorteaveis dos grupos
 * @param groups   grupos ligados na sala
 * @param guessed  ids ja chutados na rodada, que somem da lista
 */
export function search(query, { items, choosing = false, groups = [], guessed = [] }) {
  const q = normalize(query.trim());
  if (!q) return [];

  const groupSet = new Set(groups);
  const guessedSet = new Set(choosing ? [] : guessed);
  const source = choosing
    ? items.filter(i => i.eligible && groupSet.has(i.group))
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
