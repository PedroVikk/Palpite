import { useEffect } from 'react';
import { CloseIcon } from './Icon.jsx';

/**
 * A moldura das janelas: o véu, a caixa e o botão de fechar. Ela existe para o
 * conteúdo poder trocar sem a caixa piscar — é o que deixa a sala nascer dentro
 * do mesmo modal em que ela foi configurada.
 *
 * `dismissable` desliga o clique no véu e o Esc: dentro da sala, fechar sem
 * querer custaria a cadeira, então lá só se sai pelos botões que dizem isso.
 */
export default function Modal({
  label, onClose, children,
  dismissable = true,
  closeLabel = 'Fechar',
  className = '',
}) {
  useEffect(() => {
    if (!dismissable) return;
    // defaultPrevented: o Esc que fecha a lista de universos morre nela, senao
    // fechar a lista levaria o modal inteiro junto
    const onKey = (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [dismissable, onClose]);

  return (
    <div className="scrim" onMouseDown={e => { if (dismissable && e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${className}`.trim()} role="dialog" aria-modal="true" aria-label={label}>
        <button type="button" className="close" aria-label={closeLabel} onClick={onClose}>
          <CloseIcon width={18} height={18} />
        </button>
        {children}
      </div>
    </div>
  );
}
