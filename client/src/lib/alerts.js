import { prefs } from './prefs.js';

/**
 * Os sinais que nao sao visuais: som curto, vibracao e notificacao do sistema.
 * Cada um confere a preferencia na hora de disparar, entao quem chama nao
 * precisa saber o que a pessoa ligou.
 */
let audio = null;

function tone(freq, start, length, volume = 0.12) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t0 = audio.currentTime + start;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + length + 0.05);
  } catch { /* sem audio nao derruba o jogo */ }
}

/** Dois toques ascendentes: chegou a sua vez. */
export function ding() {
  if (!prefs().sound) return;
  tone(660, 0, 0.16);
  tone(990, 0.12, 0.24);
}

/** Um toque seco por segundo nos ultimos segundos. */
export function tick() {
  if (!prefs().sound) return;
  tone(520, 0, 0.06, 0.08);
}

/** Toque curto para um aviso da sala. */
export function blip() {
  if (!prefs().sound) return;
  tone(440, 0, 0.1, 0.08);
}

export function buzz(pattern = [120, 60, 120]) {
  if (!prefs().vibrate) return;
  try { navigator.vibrate?.(pattern); } catch { /* sem vibracao */ }
}

/** Notificacao do sistema, so com a aba em segundo plano e com a permissao dada. */
export function systemNotify(title, body) {
  if (!prefs().notify || !document.hidden) return;
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'palpite-vez', renotify: true });
    }
  } catch { /* alguns navegadores moveis nao aceitam o construtor */ }
}

/** Pede a permissao quando a pessoa liga a opcao; devolve se ficou valendo. */
export async function askNotifyPermission() {
  try {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}
