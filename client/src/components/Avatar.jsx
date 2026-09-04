/**
 * Iniciais num circulo colorido. A cor sai do proprio nome, entao o mesmo
 * jogador tem sempre o mesmo tom em todas as telas e em todos os navegadores —
 * sem precisar de campo no servidor.
 */
const TONES = [
  ['#9B85FF', '#5B3FD6'],
  ['#2ED694', '#0E7A4C'],
  ['#F0A92B', '#B36F06'],
  ['#6FA8FF', '#2C4FB8'],
  ['#FF7A9C', '#B83A5E'],
  ['#7BE0D8', '#1F8E86'],
];

const hash = (text) => {
  let sum = 0;
  for (let i = 0; i < text.length; i += 1) sum = (sum * 31 + text.charCodeAt(i)) % 100000;
  return sum;
};

/** "Pedro Karaio" -> "PK"; "Brockao" -> "BR". */
const initials = (name) => {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function Avatar({ name, size = '', className = '' }) {
  const [from, to] = TONES[hash(String(name ?? '')) % TONES.length];
  return (
    <span
      className={`avatar ${size} ${className}`.trim()}
      style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
