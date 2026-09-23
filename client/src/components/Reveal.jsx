import { revealChips } from '../lib/format.js';
import { EyeOffIcon } from './Icon.jsx';

/** O botao que vira a carta para baixo (ver RoleCard em ImpostorPanels). */
export function HideButton({ onClick }) {
  return (
    <button type="button" className="btn ghost small reveal-toggle" onClick={onClick}>
      <EyeOffIcon width={15} height={15} /> Esconder
    </button>
  );
}

/**
 * O segredo, mostrado quando a rodada fecha — e, no impostor, durante a rodada
 * para quem sabe. Com `onHide`, o cartao ganha o botao de esconder.
 */
export default function Reveal({
  universe, secret, scope = null, caption = 'O segredo era', onHide = null,
}) {
  const art = secret.artwork ?? secret.sprite ?? null;   // ha universos sem imagem (LOTR)

  /**
   * A arte grande do reveal continua vindo da CDN de origem — espelhar as ~9 mil
   * em tamanho cheio custaria centenas de MB. Quando ela nao carrega, cai na
   * miniatura, que e local: com a fonte fora do ar o reveal perde resolucao, nao
   * a imagem.
   */
  const fallbackToSprite = (e) => {
    if (!secret.sprite || e.currentTarget.src.endsWith(secret.sprite)) return;
    e.currentTarget.src = secret.sprite;
  };

  const toggle = onHide && <HideButton onClick={onHide} />;

  return (
    <section className="reveal">
      {art && (
        <div className="portrait">
          <img src={art} alt={secret.name} onError={fallbackToSprite} />
        </div>
      )}
      <div>
        <span className="k">{caption}</span>
        <h2>{secret.name}</h2>
        <div className="facts">
          {revealChips(universe, secret, scope).map(chip => (
            <span key={chip.key} className="fact" title={chip.label}>{chip.text}</span>
          ))}
        </div>
      </div>
      {toggle}
    </section>
  );
}
