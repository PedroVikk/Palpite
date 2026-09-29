import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';
import { blip } from '../lib/alerts.js';
import { onNotice, pushNotice } from '../lib/notices.js';
import { reducedMotion, usePrefs } from '../lib/prefs.js';

const LIFETIME = 7000;
const MAX_SHOWN = 4;

/**
 * O feed do canto direito: pulou, desistiu, pediu dica, tempo esgotado. Os
 * avisos da sala chegam pelo socket e sao os mesmos para todo mundo; os locais
 * (metade do tempo, voce e o proximo) entram pelo mesmo barramento.
 *
 * O fundo de cada aviso pisca tres vezes na cor do tipo e para. Com o piscar
 * desligado, ou com o sistema pedindo menos movimento, o aviso ganha uma borda
 * grossa fixa no lugar.
 */
export default function NoticeFeed() {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const timers = useRef(new Map());
  const prefs = usePrefs();

  useEffect(() => {
    const add = (notice) => {
      const id = ++seq.current;
      setItems(list => [...list.slice(-(MAX_SHOWN - 1)), { id, ...notice }]);
      timers.current.set(id, setTimeout(() => {
        timers.current.delete(id);
        setItems(list => list.filter(item => item.id !== id));
      }, LIFETIME));
      if (notice.kind !== 'time' && notice.kind !== 'next') blip();
    };
    const offBus = onNotice(add);
    const onRoom = (notice) => pushNotice(notice);
    socket.on('room:notice', onRoom);
    return () => {
      offBus();
      socket.off('room:notice', onRoom);
      for (const handle of timers.current.values()) clearTimeout(handle);
      timers.current.clear();
    };
  }, []);

  if (!items.length) return null;
  const still = !prefs.flash || reducedMotion();
  return (
    <ul className="notices" aria-live="polite" aria-label="Avisos da sala">
      {items.map(item => (
        <li key={item.id} className={`notice ${item.kind} ${still ? 'still' : ''}`}>
          {item.text}
        </li>
      ))}
    </ul>
  );
}
