/**
 * O nome fica no localStorage (comodidade entre sessoes); a identidade do
 * jogador fica no sessionStorage, para que recarregar reconecte o mesmo jogador
 * mas duas abas continuem sendo dois jogadores.
 */
const NAME_KEY = 'palpite:name';
const playerKey = (code) => `palpite:player:${code}`;

/** Storage bloqueado (aba anonima, cookies desligados) nao pode derrubar o jogo. */
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

export const savedName = () => safe(() => localStorage.getItem(NAME_KEY)) || '';
export const rememberName = (name) => safe(() => localStorage.setItem(NAME_KEY, name));

export const savedPlayerId = (code) => safe(() => sessionStorage.getItem(playerKey(code)));
export const rememberPlayerId = (code, id) => safe(() => sessionStorage.setItem(playerKey(code), id));
