/**
 * Formatacao das celulas de dica. O valor bruto vem do servidor; o schema do
 * universo diz como exibir (rotulo traduzido, unidade, lista encurtada).
 */

const COMPACT = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

/** Texto completo, sem encurtar — vai para o tooltip da celula. */
export function fullValue(column, value) {
  if (!Array.isArray(value)) return formatValue(column, value);
  return value.length ? value.map(v => column.labels?.[v] ?? v).join(', ') : '—';
}

/** Texto exibido: listas longas viram "A, B, C +2" para nao esticar a linha. */
export function formatValue(column, value) {
  if (Array.isArray(value)) {
    if (!value.length) return '—';
    const labels = value.map(v => column.labels?.[v] ?? v);
    return labels.length > 3 ? `${labels.slice(0, 3).join(', ')} +${labels.length - 3}` : labels.join(', ');
  }
  if (value === null || value === undefined || value === '') return '—';
  if (column.labels?.[value]) return column.labels[value];
  if (column.kind === 'number') {
    // `compact` e para numero grande demais para ler digito a digito: a
    // recompensa do One Piece vira "4,6 bi" em vez de "4611100000"
    const text = column.compact ? COMPACT.format(value) : String(value).replace('.', ',');
    return `${column.prefix ?? ''}${text}${column.unit ? ` ${column.unit}` : ''}`;
  }
  return String(value);
}

/** Resumo do segredo revelado, uma entrada por coluna. */
export const revealChips = (universe, secret) =>
  universe.columns.map(column => ({
    key: column.key,
    label: column.label,
    text: fullValue(column, secret[column.key]),
  }));
