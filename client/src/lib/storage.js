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

// --------------------------------------------------------- voltar depois

/**
 * Rastro da ultima sala, este no localStorage: e o que sobra quando a aba
 * fecha e leva o sessionStorage junto — sem ele, reabrir o navegador seria
 * entrar como um jogador novo, sem placar.
 *
 * Ele nunca reconecta sozinho: a volta por aqui e sempre um clique do jogador
 * na home, senao abrir uma segunda aba roubaria a cadeira da primeira, que e
 * exatamente o que o sessionStorage existe para evitar.
 */
const LAST_KEY = 'palpite:last';
/**
 * Prazo generoso de propria casa. Quem decide se a cadeira ainda existe e o
 * servidor (a janela dele e mais curta); este prazo so evita oferecer a volta
 * para uma partida de ontem.
 */
const LAST_TTL = 30 * 60 * 1000;

export const rememberSession = (code, playerId, name) =>
  safe(() => localStorage.setItem(LAST_KEY, JSON.stringify({ code, playerId, name, at: Date.now() })));

export function savedSession() {
  const raw = safe(() => localStorage.getItem(LAST_KEY));
  if (!raw) return null;
  try {
    const last = JSON.parse(raw);
    if (!last?.code || !last?.playerId) return null;
    return Date.now() - last.at > LAST_TTL ? null : last;
  } catch {
    return null;
  }
}

export const forgetSession = () => safe(() => localStorage.removeItem(LAST_KEY));

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

/**
 * Resumo do dia, lido das proprias chaves do diario. Como o `pruneDaily` varre
 * o que e de outro dia, o que sobra no storage e sempre de hoje — entao dá para
 * contar sem saber a data e sem perguntar nada ao servidor.
 */
export function dailySnapshot() {
  return safe(() => {
    let solved = 0, started = 0, guesses = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(DAILY_PREFIX)) continue;
      try {
        const saved = JSON.parse(localStorage.getItem(key));
        const rows = Array.isArray(saved?.rows) ? saved.rows : [];
        if (!rows.length && !saved?.secret) continue;
        started += 1;
        guesses += rows.length;
        if (saved?.secret) solved += 1;
      } catch { /* chave estranha nao derruba a contagem */ }
    }
    return { solved, started, guesses };
  }, { solved: 0, started: 0, guesses: 0 });
}
