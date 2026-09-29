import { useSyncExternalStore } from 'react';

/**
 * Preferencias de aviso, uma por pessoa e por navegador. O padrao liga so o que
 * nao incomoda: som e notificacao do sistema ficam desligados ate a pessoa
 * pedir. Nada disso vai ao servidor.
 */
const KEY = 'palpite:avisos';
const DEFAULTS = { sound: false, vibrate: true, flash: true, title: true, notify: false };

const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

const read = () => {
  const saved = safe(() => JSON.parse(localStorage.getItem(KEY)));
  return { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
};

let current = read();
const listeners = new Set();

export const prefs = () => current;

export function setPref(name, value) {
  if (!(name in DEFAULTS)) return;
  current = { ...current, [name]: Boolean(value) };
  safe(() => localStorage.setItem(KEY, JSON.stringify(current)));
  for (const fn of listeners) fn();
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const usePrefs = () => useSyncExternalStore(subscribe, prefs, prefs);

/** O sistema pediu menos movimento: o piscar vira borda fixa, sempre. */
export const reducedMotion = () =>
  safe(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, false);
