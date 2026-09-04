/**
 * O banco das contas.
 *
 * O Palpite viveu ate aqui sem guardar nada: salas em memoria, diario no
 * localStorage do navegador. A conta muda isso — sequencia que atravessa o dia
 * precisa de um lugar que sobreviva ao deploy, e o disco do Render e efemero.
 *
 * Tudo aqui e opcional de proposito. Sem DATABASE_URL o modulo inteiro fica
 * desligado e `ready()` responde false; o jogo continua funcionando como
 * convidado, com o diario no navegador. Isso vale para o dev que so quer rodar
 * o jogo e para o deploy antes de o banco existir — em nenhum dos dois o site
 * pode cair por falta de conta.
 */
import pg from 'pg';

const URL = process.env.DATABASE_URL ?? '';

/**
 * O Supabase exige TLS. Verificamos o certificado por padrao; a saida de
 * emergencia existe porque provedor as vezes serve cadeia propria, e nesse dia
 * e melhor uma variavel explicita do que alguem descobrir que estava desligado
 * o tempo todo.
 */
const ssl = URL
  ? { rejectUnauthorized: process.env.PGSSL_NO_VERIFY !== '1' }
  : false;

const pool = URL ? new pg.Pool({ connectionString: URL, ssl, max: 5 }) : null;

// derrubar o processo por causa de uma conexao ociosa perdida seria trocar uma
// falha pequena por uma grande: a sala em memoria de todo mundo iria junto
pool?.on('error', (err) => console.error('[db] conexão ociosa caiu:', err.message));

let live = false;

export const ready = () => live;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id           bigserial PRIMARY KEY,
    google_sub   text UNIQUE NOT NULL,
    email        text,
    name         text NOT NULL,
    avatar_url   text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash text PRIMARY KEY,
    user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

  -- uma linha por (pessoa, dia, universo): e o diario da conta, e tambem de
  -- onde a sequencia e recalculada. Guardar a sequencia como numero deixaria
  -- ela poder divergir do historico; assim ela nunca mente.
  CREATE TABLE IF NOT EXISTS daily_results (
    user_id  bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day      date   NOT NULL,
    universe text   NOT NULL,
    guesses  int    NOT NULL DEFAULT 0,
    solved   boolean NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, day, universe)
  );
  CREATE INDEX IF NOT EXISTS daily_by_day ON daily_results(user_id, day DESC);
`;

/**
 * Liga o banco. Falhar aqui nao derruba o servidor: loga e segue como
 * convidado, que e o modo em que o jogo ja vivia.
 */
export async function connect() {
  if (!pool) {
    console.log('[db] sem DATABASE_URL — contas desligadas, o jogo roda como convidado.');
    return false;
  }
  try {
    await pool.query(SCHEMA);
    live = true;
    console.log('[db] conectado, contas ligadas.');
  } catch (err) {
    console.error('[db] não consegui conectar, seguindo sem contas:', err.message);
    live = false;
  }
  return live;
}

const query = (text, params) => pool.query(text, params);

// ------------------------------------------------------------------ contas

/** Entra ou atualiza a pessoa vinda do Google. O `sub` e a identidade estavel. */
export async function upsertUser({ sub, email, name, picture }) {
  const { rows } = await query(
    `INSERT INTO users (google_sub, email, name, avatar_url)
          VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_sub) DO UPDATE
        SET email = EXCLUDED.email,
            name = EXCLUDED.name,
            avatar_url = EXCLUDED.avatar_url,
            last_seen_at = now()
     RETURNING id, name, email, avatar_url`,
    [sub, email ?? null, name || 'Treinador', picture ?? null],
  );
  return rows[0];
}

export async function createSession(tokenHash, userId, expiresAt) {
  await query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash, userId, expiresAt],
  );
}

/** A pessoa dona de uma sessao viva. Sessao vencida e o mesmo que nao existir. */
export async function userBySession(tokenHash) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.avatar_url
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export const dropSession = (tokenHash) =>
  query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);

/** Faxina das sessoes vencidas, para a tabela nao virar deposito. */
export const sweepSessions = () =>
  query('DELETE FROM sessions WHERE expires_at < now()');

// ------------------------------------------------------------------ diario

/**
 * Registra um chute do dia. Quem conta e o servidor, no proprio endpoint do
 * chute: ele ve todos, entao nao ha o que o cliente precise mandar — nem o que
 * ele possa inflar. O `solved` so liga, nunca desliga.
 */
export async function bumpDailyResult({ userId, day, universe, solved }) {
  await query(
    `INSERT INTO daily_results (user_id, day, universe, guesses, solved)
          VALUES ($1, $2, $3, 1, $4)
     ON CONFLICT (user_id, day, universe) DO UPDATE
        SET guesses = daily_results.guesses + 1,
            solved  = daily_results.solved OR EXCLUDED.solved`,
    [userId, day, universe, solved],
  );
}

/** O que a pessoa fez hoje, universo a universo. */
export async function dayOf(userId, day) {
  const { rows } = await query(
    'SELECT universe, guesses, solved FROM daily_results WHERE user_id = $1 AND day = $2',
    [userId, day],
  );
  return rows;
}

/**
 * A sequencia, recalculada do historico em vez de guardada como contador.
 *
 * Vale o dia em que a pessoa resolveu pelo menos um universo. A sequencia
 * continua de pe se o ultimo dia foi hoje ou ontem — com ontem ela ainda da
 * para salvar, e derrubar antes da virada seria punir quem joga a noite.
 */
export async function streakOf(userId, today) {
  const { rows } = await query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day
       FROM daily_results
      WHERE user_id = $1 AND solved
      GROUP BY day
      ORDER BY day DESC`,
    [userId],
  );
  const days = rows.map(r => r.day);
  if (!days.length) return { current: 0, best: 0, solvedToday: false };

  const before = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d) - 86400000).toISOString().slice(0, 10);
  };

  // melhor sequencia: varre o historico inteiro contando dias encostados
  let best = 1, run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = days[i] === before(days[i - 1]) ? run + 1 : 1;
    if (run > best) best = run;
  }

  const alive = days[0] === today || days[0] === before(today);
  let current = 0;
  if (alive) {
    current = 1;
    for (let i = 1; i < days.length && days[i] === before(days[i - 1]); i += 1) current += 1;
  }

  return { current, best, solvedToday: days[0] === today };
}

/** Contagem do dia, para a home nao precisar somar linha por linha. */
export async function todayTotals(userId, day) {
  const { rows } = await query(
    `SELECT COUNT(*) FILTER (WHERE solved) AS solved,
            COUNT(*)                       AS started,
            COALESCE(SUM(guesses), 0)      AS guesses
       FROM daily_results WHERE user_id = $1 AND day = $2`,
    [userId, day],
  );
  const r = rows[0] ?? {};
  return { solved: Number(r.solved) || 0, started: Number(r.started) || 0, guesses: Number(r.guesses) || 0 };
}
