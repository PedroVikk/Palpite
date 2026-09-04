/**
 * Entrar com o Google, e a sessao que sai disso.
 *
 * Fluxo de codigo de autorizacao, o de sempre: mandamos a pessoa para o Google,
 * ele volta com um `code`, e a troca desse code por token acontece daqui do
 * servidor, com o segredo do app. O navegador nunca ve token do Google —
 * o que ele guarda e so um cookie de sessao nosso.
 *
 * Nao ha senha em lugar nenhum deste arquivo, e e o ponto de usar o Google:
 * nao guardamos o que nao sabemos proteger.
 */
import crypto from 'node:crypto';
import * as db from './db.js';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const isProd = process.env.NODE_ENV === 'production';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const SESSION_COOKIE = 'palpite_sess';
const STATE_COOKIE = 'palpite_oauth';
const SESSION_DAYS = 60;

/** Login so existe com as duas pontas de pe: app registrado e banco ligado. */
export const configured = () => Boolean(CLIENT_ID && CLIENT_SECRET);

// ------------------------------------------------------------------ cookies

/** Parser proprio: e uma linha de header, nao vale uma dependencia a mais. */
function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      try { return decodeURIComponent(part.slice(eq + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

/**
 * `SameSite=Lax` e obrigatorio aqui, nao preferencia: o retorno do Google e uma
 * navegacao de outro site, e com `Strict` o cookie nao viajaria nela — a pessoa
 * voltaria do login deslogada.
 */
function setCookie(res, name, value, maxAgeSeconds) {
  const bits = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProd) bits.push('Secure');
  res.append('Set-Cookie', bits.join('; '));
}

const clearCookie = (res, name) => setCookie(res, name, '', 0);

// ------------------------------------------------------------------ sessao

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Guardamos o hash do token, nao o token. Um vazamento do banco entrega uma
 * lista de hashes inutil, em vez de um molho de chaves das contas.
 */
async function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.createSession(hash(token), userId, expires);
  setCookie(res, SESSION_COOKIE, token, SESSION_DAYS * 86400);
}

/**
 * Middleware: poe `req.user` quando ha sessao viva, e segue calado quando nao
 * ha. Nenhuma rota fica bloqueada por aqui — quem exige conta e a rota.
 */
export function session() {
  return async (req, _res, next) => {
    req.user = null;
    if (!db.ready()) return next();
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) return next();
    try {
      req.user = await db.userBySession(hash(token));
    } catch (err) {
      console.error('[auth] falhei ao ler a sessão:', err.message);
    }
    next();
  };
}

/** Para rota que so faz sentido logado. */
export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Entre para usar isso.' });
  next();
}

// -------------------------------------------------------------------- rotas

/** De onde o Google deve voltar. Fixo no ambiente sempre que possivel. */
function redirectUri(req) {
  const base = process.env.PUBLIC_URL
    || process.env.RENDER_EXTERNAL_URL
    || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/auth/google/callback`;
}

export function attachAuth(app) {
  app.use(session());

  /** O cliente pergunta se vale a pena mostrar o botao de entrar. */
  app.get('/api/auth/config', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ enabled: configured() && db.ready() });
  });

  app.get('/api/me', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!req.user) return res.json({ user: null });
    const { id, name, email, avatar_url: avatar } = req.user;
    res.json({ user: { id: String(id), name, email, avatar } });
  });

  /** Ida: guarda um `state` no cookie e manda para o consentimento. */
  app.get('/auth/google', (req, res) => {
    if (!configured() || !db.ready()) return res.status(503).send('Login indisponível.');

    const state = crypto.randomBytes(16).toString('base64url');
    setCookie(res, STATE_COOKIE, state, 600);   // dez minutos para decidir

    const url = new URL(AUTH_URL);
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri(req));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    // sem isto o Google pula a tela de escolha para quem tem uma conta so
    url.searchParams.set('prompt', 'select_account');
    res.redirect(url.toString());
  });

  /**
   * Volta: confere o `state`, troca o codigo por token e cria a sessao.
   *
   * O `state` e o que impede alguem de forjar essa volta e colar a propria
   * conta na sessao de outra pessoa. Sem o cookie batendo, nao ha login.
   */
  app.get('/auth/google/callback', async (req, res) => {
    if (!configured() || !db.ready()) return res.redirect('/?login=indisponivel');

    const saved = readCookie(req, STATE_COOKIE);
    clearCookie(res, STATE_COOKIE);
    if (!saved || saved !== req.query.state) return res.redirect('/?login=falhou');
    if (req.query.error || !req.query.code) return res.redirect('/?login=cancelado');

    try {
      const tokenRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(req.query.code),
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: redirectUri(req),
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) throw new Error(`troca de código falhou (${tokenRes.status})`);
      const { access_token: accessToken } = await tokenRes.json();

      /**
       * Perguntamos quem e ao proprio Google em vez de abrir o id_token. A
       * resposta chega por TLS direto da fonte, entao nao ha assinatura para
       * conferir a mao — e nenhum JWT para errar de validar.
       */
      const infoRes = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!infoRes.ok) throw new Error(`userinfo falhou (${infoRes.status})`);
      const info = await infoRes.json();
      if (!info?.sub) throw new Error('resposta do Google sem identidade');

      const user = await db.upsertUser({
        sub: info.sub,
        email: info.email,
        name: info.name || info.given_name || 'Treinador',
        picture: info.picture,
      });
      await startSession(res, user.id);
      res.redirect('/?login=ok');
    } catch (err) {
      console.error('[auth] login do Google falhou:', err.message);
      res.redirect('/?login=falhou');
    }
  });

  app.post('/api/logout', async (req, res) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (token && db.ready()) {
      try { await db.dropSession(hash(token)); } catch { /* sair sempre da certo */ }
    }
    clearCookie(res, SESSION_COOKIE);
    res.json({ ok: true });
  });
}
