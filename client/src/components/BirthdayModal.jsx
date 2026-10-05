import { useState } from 'react';
import { gameToday } from '../lib/storage.js';
import { BIRTHDAYS } from '../lib/birthdays.js';
import Modal from './Modal.jsx';

/**
 * Parabens aos aniversariantes do dia ou do mes (a lista mora em
 * lib/birthdays.js). Cada navegador ve cada um uma vez: fechar deixa a marca no
 * localStorage. Com dois ao mesmo tempo, fechar um abre o proximo. Passado o
 * prazo nenhuma data bate e o modal nem monta — nao ha nada para limpar depois.
 */
const seenKey = (b) => `palpite:parabens:${b.day ?? b.month}:${b.name}`;
const isNow = (b, today) => b.day === today || b.month === today.slice(0, 7);

const seen = (b) => { try { return !!localStorage.getItem(seenKey(b)); } catch { return false; } };
const markSeen = (b) => { try { localStorage.setItem(seenKey(b), '1'); } catch { /* storage bloqueado */ } };

export default function BirthdayModal() {
  const [queue, setQueue] = useState(() => {
    const today = gameToday();
    return BIRTHDAYS.filter(b => isNow(b, today) && !seen(b));
  });
  const current = queue[0];
  if (!current) return null;

  const close = () => { markSeen(current); setQueue(q => q.slice(1)); };

  return (
    <Modal key={seenKey(current)} label={current.title} onClose={close} className="birthday">
      <img className="birthday-photo" src={current.photo} alt={current.name} />
      <div className="birthday-body">
        <span className="birthday-tag">{current.month ? 'Aniversariante do mês' : 'Hoje é dia de festa'}</span>
        <h2>{current.title}</h2>
        {current.message.map((text, i) => <p key={i}>{text}</p>)}
        <button type="button" className="btn primary lg" onClick={close}>Valeu, bora jogar!</button>
      </div>
    </Modal>
  );
}
