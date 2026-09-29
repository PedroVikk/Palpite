/**
 * Barramento dos avisos do canto da tela. Os que vem da sala chegam pelo socket
 * (`room:notice`); os locais (falta metade do tempo, voce e o proximo) entram
 * por aqui. O feed so escuta este canal.
 */
const listeners = new Set();

export const pushNotice = (notice) => {
  for (const fn of listeners) fn({ at: Date.now(), ...notice });
};

export const onNotice = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
