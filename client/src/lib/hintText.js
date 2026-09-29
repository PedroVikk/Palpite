import { formatValue, fullValue } from './format.js';

/**
 * As palavras da tabela de dicas: o que uma célula quer dizer (o balão do
 * clique) e o que a tabela inteira já garante (a faixa em cima dela). Tudo sai
 * das linhas que o servidor mandou — nada aqui olha o segredo.
 */

const listLabels = (column, values) => (values ?? []).map(v => column.labels?.[v] ?? v);
const joinPt = (items) => (items.length <= 1 ? items.join('')
  : `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`);

/** O slot vizinho de uma coluna de slot (Tipo 1 -> Tipo 2), quando há um só. */
function otherSlot(universe, column) {
  const others = (column.slots ?? []).filter(key => key !== column.key);
  return others.length === 1 ? universe.columns.find(c => c.key === others[0]) ?? null : null;
}

/**
 * O que uma célula quer dizer, em uma ou duas frases. É o balão que abre no
 * clique: a cor diz "perto", e aqui se lê perto de quê e para que lado.
 */
export function explainCell(universe, column, cell) {
  const label = column.label;
  const shown = fullValue(column, cell.value);
  if (cell.status === 'unknown') return { title: label, text: 'Sem dado para comparar nesta coluna, num dos dois lados.' };
  if (cell.status === 'plain') return { title: `${label}: ${shown}`, text: 'Só o valor do chute: se ele bate ou não, a mesa descobre no fim da rodada.' };
  if (cell.status === 'hit') return { title: `${label}: ${shown}`, text: 'Igual ao segredo.' };

  if (column.kind === 'number') {
    if (!cell.hint) return { title: `${label}: ${shown}`, text: 'Não bate: um dos dois tem este campo e o outro não.' };
    const bigger = cell.hint === 'up';
    if (cell.status === 'close') {
      return { title: `${label}: quase!`, text: `O segredo é um pouco ${bigger ? 'maior' : 'menor'} que ${shown}.` };
    }
    return cell.far
      ? { title: `${label}: longe`, text: `O segredo é bem ${bigger ? 'maior' : 'menor'} que ${shown} — mais de um quarto do catálogo de distância.` }
      : { title: `${label}: não é ${shown}`, text: `O segredo é ${bigger ? 'maior' : 'menor'}, mas não tão longe.` };
  }

  if (column.kind === 'slot') {
    if (cell.status === 'partial') {
      const other = otherSlot(universe, column);
      return { title: `${label}: ${shown} no lugar errado`, text: other ? `${shown} é o ${other.label} do segredo.` : `${shown} aparece no segredo, mas em outra posição.` };
    }
    return cell.value == null
      ? { title: `${label}: —`, text: `O segredo tem ${label}.` }
      : { title: `${label}: não é ${shown}`, text: `${shown} não aparece em lugar nenhum do segredo.` };
  }

  if (column.kind === 'list') {
    if (cell.status === 'partial') {
      const match = listLabels(column, cell.match);
      const guessed = listLabels(column, cell.value);
      const missing = guessed.filter(v => !match.includes(v));
      if (!match.length) return { title: `${label}: em parte`, text: 'Algum destes está no segredo, mas não todos.' };
      const parts = [`${joinPt(match)} ${match.length === 1 ? 'bate' : 'batem'}.`];
      if (missing.length) parts.push(`${joinPt(missing)} não.`);
      if (cell.more) parts.push('E o segredo tem mais algum.');
      return { title: `${label}: acertou ${joinPt(match)}`, text: parts.join(' ') };
    }
    return { title: `${label}: nenhum`, text: `Nada de ${joinPt(listLabels(column, cell.value))} no segredo.` };
  }

  return { title: `${label}: não é ${shown}`, text: 'Não bate com o segredo.' };
}

/**
 * O que a tabela inteira já garante, coluna por coluna: o valor certo (verde,
 * ou deduzido do slot vizinho), a faixa dos números pelas setas, os itens de
 * lista que já bateram e o que já foi descartado. É a conta que a pessoa faria
 * olhando a pilha — feita uma vez, em uma linha.
 */
export function knownFacts(universe, rows) {
  const facts = [];
  const scored = rows.filter(row => row.cells);
  // descartes de slot valem para todos os slots (a miss diz "em lugar nenhum")
  const slotOut = new Set();
  const deduced = {};
  for (const column of universe.columns) {
    if (column.kind !== 'slot') continue;
    for (const row of scored) {
      const cell = row.cells[column.key];
      if (!cell) continue;
      if (cell.status === 'miss' && cell.value != null) slotOut.add(cell.value);
      const other = cell.status === 'partial' && otherSlot(universe, column);
      if (other) deduced[other.key] = cell.value;
    }
  }

  for (const column of universe.columns) {
    const cells = scored.map(row => row.cells[column.key]).filter(Boolean);
    const hit = cells.find(cell => cell.status === 'hit');
    if (hit) {
      facts.push({ key: column.key, label: column.label, text: formatValue(column, hit.value), tone: 'hit' });
      continue;
    }
    if (column.kind === 'slot' && column.key in deduced) {
      facts.push({ key: column.key, label: column.label, text: formatValue(column, deduced[column.key]), tone: 'hit' });
      continue;
    }

    if (column.kind === 'number') {
      let lo = null, hi = null, near = false;
      for (const cell of cells) {
        if (cell.value == null || !cell.hint) continue;
        if (cell.hint === 'up' && (lo === null || cell.value > lo)) lo = cell.value;
        if (cell.hint === 'down' && (hi === null || cell.value < hi)) hi = cell.value;
        if (cell.status === 'close') near = true;
      }
      if (lo === null && hi === null) continue;
      const text = lo !== null && hi !== null
        ? `entre ${formatValue(column, lo)} e ${formatValue(column, hi)}`
        : lo !== null ? `> ${formatValue(column, lo)}` : `< ${formatValue(column, hi)}`;
      facts.push({ key: column.key, label: column.label, text, tone: near ? 'partial' : 'range' });
      continue;
    }

    if (column.kind === 'list') {
      const has = new Set();
      const out = new Set();
      let more = false;
      for (const cell of cells) {
        if (cell.status === 'partial') {
          (cell.match ?? []).forEach(v => has.add(v));
          (cell.value ?? []).filter(v => !(cell.match ?? []).includes(v)).forEach(v => out.add(v));
          more ||= Boolean(cell.more);
        } else if (cell.status === 'miss') {
          (cell.value ?? []).forEach(v => out.add(v));
        }
      }
      if (has.size) {
        facts.push({ key: column.key, label: column.label, text: `tem ${joinPt(listLabels(column, [...has]))}${more ? ' e mais' : ''}`, tone: 'partial' });
      } else if (out.size) {
        facts.push({ key: column.key, label: column.label, text: `não: ${shortList(listLabels(column, [...out]))}`, tone: 'miss' });
      }
      continue;
    }

    // categoria e slot sem valor certo: o que já foi descartado
    const out = new Set(column.kind === 'slot' ? slotOut
      : cells.filter(cell => cell.status === 'miss' && cell.value != null).map(cell => cell.value));
    if (out.size) {
      facts.push({ key: column.key, label: column.label, text: `não: ${shortList([...out].map(v => formatValue(column, v)))}`, tone: 'miss' });
    }
  }
  return facts;
}

const shortList = (items) => (items.length > 3 ? `${items.slice(0, 3).join(', ')} +${items.length - 3}` : items.join(', '));
