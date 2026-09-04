import { BallMark } from './Icon.jsx';

/**
 * A camada de fundo: dois brilhos da marca, uma grade fraquíssima e duas
 * pokébolas de marca-d'água. Fica `fixed` atrás de tudo e não recebe clique —
 * é atmosfera, não interface.
 */
export default function Ambient({ extraGlow = false }) {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="glow g1" />
      <div className="glow g2" />
      {extraGlow && <div className="glow g3" />}
      <div className="grid" />
      <BallMark className="ball b1" />
      <BallMark className="ball b2" />
    </div>
  );
}
