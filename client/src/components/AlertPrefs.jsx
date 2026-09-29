import { askNotifyPermission } from '../lib/alerts.js';
import { setPref, usePrefs } from '../lib/prefs.js';

const OPTIONS = [
  { key: 'sound', label: 'Som', help: 'Toque ao chegar a sua vez e nos últimos segundos.' },
  { key: 'vibrate', label: 'Vibração', help: 'No celular, quando chegar a sua vez.' },
  { key: 'flash', label: 'Piscar', help: 'Avisos e a sua vez piscam. Desligado, ganham borda fixa.' },
  { key: 'title', label: 'Título da aba', help: 'Mostra a sua vez e o tempo na aba do navegador.' },
  { key: 'notify', label: 'Notificação', help: 'Avisa com a aba em segundo plano.' },
];

/** O painel único de acessibilidade dos avisos: cada pessoa liga o que quiser. */
export default function AlertPrefs() {
  const prefs = usePrefs();

  const toggle = async (key) => {
    const next = !prefs[key];
    // a permissao so e pedida quando a pessoa liga a opcao, nunca antes
    if (key === 'notify' && next && !(await askNotifyPermission())) return setPref('notify', false);
    setPref(key, next);
  };

  return (
    <ul className="alert-prefs">
      {OPTIONS.map(opt => (
        <li key={opt.key}>
          <label title={opt.help}>
            <input type="checkbox" checked={prefs[opt.key]} onChange={() => toggle(opt.key)} />
            <span>{opt.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
