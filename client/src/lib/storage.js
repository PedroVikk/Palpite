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

/**
 * O ultimo estado do diario de um universo, hoje. Como o `pruneDaily` varre o
 * que e de outro dia, basta procurar a chave que termina no universo pedido —
 * a data que sobrou e a de hoje, sem precisar perguntar ao servidor.
 */
export function lastDaily(universe) {
  return safe(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(DAILY_PREFIX) || !key.endsWith(`:${universe}`)) continue;
      const saved = JSON.parse(localStorage.getItem(key));
      return {
        rows: Array.isArray(saved?.rows) ? saved.rows : [],
        secret: saved?.secret ?? null,
      };
    }
    return { rows: [], secret: null };
  }, { rows: [], secret: null });
}

// ------------------------------------------------------------- sequencia

/**
 * A sequencia de dias — o unico numero do jogo que precisa sobreviver a virada
 * do dia. O progresso do diario nao serve para isso: o `pruneDaily` apaga o que
 * e de ontem, entao a contagem mora em chave propria, que ele nao varre.
 *
 * Um dia entra na sequencia quando a pessoa resolve pelo menos um universo
 * nele. Sao vinte e dois desafios por dia; exigir todos seria uma sequencia que
 * ninguem mantem, e exigir so ter chutado premiaria abrir a tela e sair.
 */
const STREAK_KEY = 'palpite:streak';

/** "2026-09-04" menos um dia, sem passar por fuso: a data ja e do fuso do jogo. */
function dayBefore(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d) - 86400000);
  return at.toISOString().slice(0, 10);
}

/**
 * Hoje no fuso do jogo (America/Sao_Paulo), a mesma conta que o `today()` do
 * servidor faz. Sem isso, quem joga de outro fuso veria a sequencia quebrar
 * numa data que para o servidor ainda e o mesmo dia.
 */
export function gameToday(now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

const readStreak = () => safe(() => {
  const saved = JSON.parse(localStorage.getItem(STREAK_KEY));
  return {
    last: typeof saved?.last === 'string' ? saved.last : null,
    current: Number(saved?.current) || 0,
    best: Number(saved?.best) || 0,
  };
}, { last: null, current: 0, best: 0 }) ?? { last: null, current: 0, best: 0 };

/**
 * A sequencia como ela esta hoje. Guardada ela nunca cai sozinha, entao a
 * leitura e que decide: resolveu hoje ou ontem, continua de pe (com ontem ela
 * ainda da para salvar); mais velha que isso, ja quebrou e vale zero. O recorde
 * fica, que e o ponto dele.
 */
export function streak(date = gameToday()) {
  const saved = readStreak();
  const alive = saved.last === date || saved.last === dayBefore(date);
  return {
    current: alive ? saved.current : 0,
    best: saved.best,
    solvedToday: saved.last === date,
  };
}

/**
 * Marca que hoje teve acerto. Chamado uma vez por dia, no primeiro universo
 * resolvido — resolver o segundo nao conta de novo.
 */
export function markSolvedToday(date = gameToday()) {
  const saved = readStreak();
  if (saved.last === date) return streak(date);

  const current = saved.last === dayBefore(date) ? saved.current + 1 : 1;
  const next = { last: date, current, best: Math.max(saved.best, current) };
  safe(() => localStorage.setItem(STREAK_KEY, JSON.stringify(next)));
  return { current, best: next.best, solvedToday: true };
}
