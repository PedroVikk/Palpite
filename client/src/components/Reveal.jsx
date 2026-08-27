import { revealChips } from '../lib/format.js';

/** O segredo, mostrado so quando a rodada fecha. */
export default function Reveal({ universe, secret }) {
  const art = secret.artwork ?? secret.sprite ?? null;   // ha universos sem imagem (LOTR)

  return (
    <div className="reveal">
      {art && <img src={art} alt={secret.name} />}
      <div>
        <span className="label">O segredo era</span>
        <h2>{secret.name}</h2>
        <div className="chips">
          {revealChips(universe, secret).map(chip => (
            <span key={chip.key} className="chip" title={chip.label}>{chip.text}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
