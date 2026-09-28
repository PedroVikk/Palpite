import { universeMeta } from '../lib/universeMeta.js';

/**
 * A silhueta de um universo (data/marks/<id>.png) usada como máscara. O arquivo
 * é branco sobre transparente e só dá o formato: a cor vem do CSS, e por padrão
 * é a do próprio universo — a escura nos temas claros, a clara nos escuros.
 * Com `ink` ela sai na tinta do tema, que é o que o fundo da página usa.
 */
export default function MarkArt({ universe, ink = false, className = '', style }) {
  const meta = universeMeta(universe);
  return (
    <span
      className={`mark-art ${ink ? 'ink' : ''} ${className}`.trim()}
      style={{ '--mark': `url(${meta.mark})`, '--uni-from': meta.from, '--uni-to': meta.to, ...style }}
      aria-hidden="true"
    />
  );
}
