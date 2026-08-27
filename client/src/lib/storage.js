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

// ------------------------------------------------------- desafio do dia

/**
 * O progresso do diario mora so no navegador — o servidor nao guarda nada.
 * A chave leva a data, entao virar o dia comeca do zero sozinho, e as chaves
 * de dias passados sao varridas para o storage nao crescer sem fim.
 */
const DAILY_PREFIX = 'palpite:daily:';
const dailyKey = (date, universe) => `${DAILY_PREFIX}${date}:${universe}`;

export function loadDaily(date, universe) {
  const raw = safe(() => localStorage.getItem(dailyKey(date, universe)));
  if (!raw) return { rows: [], secret: null };
  try {
    const saved = JSON.parse(raw);
    return { rows: Array.isArray(saved.rows) ? saved.rows : [], secret: saved.secret ?? null };
  } catch {
    return { rows: [], secret: null };
  }
}

export const saveDaily = (date, universe, progress) =>
  safe(() => localStorage.setItem(dailyKey(date, universe), JSON.stringify(progress)));

/** Apaga o que sobrou de outros dias. */
export function pruneDaily(date) {
  safe(() => {
    const stale = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DAILY_PREFIX) && !key.startsWith(`${DAILY_PREFIX}${date}:`)) stale.push(key);
    }
    for (const key of stale) localStorage.removeItem(key);
  });
}
