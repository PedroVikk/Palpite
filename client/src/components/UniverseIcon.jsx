import { useState } from 'react';
import { universeMeta } from '../lib/universeMeta.js';
import { HondaMark } from './Icon.jsx';

/**
 * Universo cujo selo e um desenho, nao um retrato. Carros nao tem uma unica
 * miniatura no espelho, entao a marca faz o papel do rosto.
 */
const MARKS = { cars: HondaMark };

/**
 * O selo do universo: o retrato de quem é a cara da franquia sobre o gradiente
 * da cor dele. O gradiente fica por baixo, não decorando — as miniaturas têm
 * fundo transparente, e é ele que dá o contorno e o código de cor.
 *
 * Sem retrato (ou se a miniatura não carregar) volta para o monograma, que
 * nunca falha: o seletor não pode ter buraco no lugar do ícone.
 */
export default function UniverseIcon({ universe, size = '', className = '' }) {
  const meta = universeMeta(universe);
  const [broken, setBroken] = useState(false);
  const Mark = MARKS[universe];
  const showFace = meta.icon && !broken;

  return (
    <span
      className={`mono ${size} ${className}`.trim()}
      style={{ background: meta.gradient }}
      aria-hidden="true"
    >
      {Mark
        ? <Mark className="mark" />
        : showFace
          ? <img src={meta.icon} alt="" loading="lazy" onError={() => setBroken(true)} />
          : meta.mono}
    </span>
  );
}
