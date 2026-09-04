/**
 * A camada web: arquivos estaticos e API REST. O tempo real fica em rooms.js.
 *
 * Servimos o build do cliente (client/dist) com fallback de SPA: qualquer
 * rota fora de /api devolve o index.html, para link direto e F5 funcionarem
 * no roteamento do navegador.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNIVERSES, getUniverse, scopeReach } from '../shared/universes.js';
import { datasetOf, indexOf } from './catalog.js';
import { compareGuess } from './game.js';
import { inSlice, isKnownUniverse, poolSizeOf, secretOf, sliceOf, today } from './daily.js';
import { spendDailyGuess } from './limits.js';
import * as db from './db.js';
import { attachAuth } from './auth.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_DIST = path.join(ROOT, 'client', 'dist');
const isProd = process.env.NODE_ENV === 'production';

/**
 * Identifica o deploy atual. O Render carimba o commit em RENDER_GIT_COMMIT;
 * fora dele a hora de subida do processo ja basta, porque todo deploy reinicia
 * o processo. O cliente compara isto com o que veio carimbado no index e, se
 * mudou, recarrega — assim uma aba aberta durante um deploy nao fica com o
 * bundle velho.
 */
export const BUILD_VERSION =
  (process.env.RENDER_GIT_COMMIT || '').slice(0, 12) || String(Date.now());

/** Em dev o cliente roda noutra porta (Vite); em producao sai do mesmo host. */
export const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * O indice muda so quando o deploy muda, mas o navegador nao sabe disso:
 * revalida sempre e recebe 304 vazio enquanto o ETag bater.
 */
const DATASET_CACHE = 'public, max-age=3600, must-revalidate';

function sendIndex(req, res, index) {
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': DATASET_CACHE,
    ETag: index.etag,
    Vary: 'Accept-Encoding',
  });
  if (req.headers['if-none-match'] === index.etag) return res.status(304).end();

  // o gzip ja veio pronto do catalogo; aqui e so escolher a versao
  const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  if (gzip) res.set('Content-Encoding', 'gzip');
  res.send(gzip ? index.gzip : index.body);
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);   // os ETags que valem sao os do catalogo
  /**
   * Quantos saltos de proxy ha na frente da gente. Importa para o freio do
   * chute do dia (limits.js), que conta por IP: sem isto, atras do Render o
   * mundo inteiro chega como o IP do proxy — um visitante so, punido junto ou
   * liberado junto.
   *
   * E ligado so onde ha proxy de verdade, e nunca por padrao: quem confia num
   * salto que nao existe aceita `X-Forwarded-For` escrito pelo proprio cliente,
   * e ai trocar de IP no freio custa um cabecalho. O Render carimba `RENDER` no
   * ambiente; noutro lugar com proxy na frente, ajuste `TRUST_PROXY`.
   */
  const hops = Number(process.env.TRUST_PROXY ?? (process.env.RENDER ? 1 : 0));
  app.set('trust proxy', Number.isFinite(hops) && hops > 0 ? hops : false);

  if (!isProd) {
    app.use((req, res, next) => {
      // libera o dev server do Vite caso alguem rode sem o proxy dele
      if (LOCAL_ORIGIN.test(req.headers.origin ?? '')) {
        res.set('Access-Control-Allow-Origin', req.headers.origin);
        res.set('Vary', 'Origin');
      }
      next();
    });
  }

  // ------------------------------------------------------------------- api
  attachAuth(app);

  app.get('/healthz', (_req, res) => res.type('text').send('ok'));

  /**
   * Tudo que a home precisa saber sobre quem esta olhando, numa viagem so:
   * quem e, a sequencia e o placar de hoje. Sem conta responde vazio, e a home
   * cai no que ela sempre teve — o progresso do proprio navegador.
   */
  app.get('/api/profile', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!req.user) return res.json({ user: null });
    const { id, name, email, avatar_url: avatar } = req.user;
    try {
      const day = today();
      const [streak, totals] = await Promise.all([db.streakOf(id, day), db.todayTotals(id, day)]);
      res.json({ user: { id: String(id), name, email, avatar }, streak, today: totals, date: day });
    } catch (err) {
      console.error('[api] perfil falhou:', err.message);
      res.status(503).json({ error: 'Não consegui carregar seu perfil.' });
    }
  });

  /** Versao do deploy no ar. Nunca cacheia: e o que o cliente consulta para saber se recarrega. */
  app.get('/api/version', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ version: BUILD_VERSION });
  });

  /** Schema dos universos. O cliente importa shared/ em build; isto e para consumo externo. */
  app.get('/api/universes', (_req, res) => {
    res.set('Cache-Control', DATASET_CACHE);
    res.json(Object.values(UNIVERSES));
  });

  app.get('/api/dataset/:universe', (req, res) => {
    const index = indexOf(req.params.universe);
    if (!index) return res.status(404).json({ error: 'Universo desconhecido.' });
    sendIndex(req, res, index);
  });

  /**
   * Qual e o desafio de hoje — sem entregar a resposta, claro. O recorte do dia
   * (`scope` e `group`) vai junto porque e ele que tranca a busca do chute no
   * cliente: sem isso a tela ofereceria nomes que o servidor recusa. Cada eixo
   * vem null quando o universo nao tem fatia grande o bastante para recortar.
   */
  app.get('/api/daily/:universe', (req, res) => {
    const { universe } = req.params;
    if (!isKnownUniverse(universe)) return res.status(404).json({ error: 'Universo desconhecido.' });
    res.set('Cache-Control', 'no-store');   // vira a meia-noite; cachear atrasaria a troca
    res.json({ date: today(), universe, poolSize: poolSizeOf(universe), ...sliceOf(universe) });
  });

  /**
   * Um chute contra o segredo do dia. E GET porque nao muda nada no servidor:
   * o progresso do jogador mora no navegador dele.
   *
   * O freio vem antes de qualquer conta, e antes ate de saber se o id existe:
   * varredura tambem chuta id que nao existe, e a resposta "esse nem existe" e
   * informacao de graca. Quem paga a ficha e a conta de quem esta logado, ou o
   * IP de quem nao esta.
   */
  app.get('/api/daily/:universe/guess/:id', (req, res) => {
    const { universe, id } = req.params;
    if (!isKnownUniverse(universe)) return res.status(404).json({ error: 'Universo desconhecido.' });

    res.set('Cache-Control', 'no-store');
    const freio = spendDailyGuess(req.user ? `conta:${req.user.id}` : `ip:${req.ip}`, universe, today());
    if (!freio.ok) {
      res.set('Retry-After', String(freio.retryAfter));
      return res.status(429).json({ error: freio.error, retryAfter: freio.retryAfter, date: today() });
    }

    const guess = datasetOf(universe).byId.get(Number(id));
    if (!guess) return res.status(404).json({ error: 'Chute inválido.' });

    const secret = secretOf(universe);
    if (!secret) return res.status(503).json({ error: 'Sem desafio para hoje neste universo.' });

    // fora do recorte do dia nem vira dica: a busca do cliente ja esconde esses
    // nomes, entao aqui so chega aba velha — a data vai junto para ela se achar
    if (!inSlice(universe, guess)) {
      return res.status(409).json({ error: 'Esse nome está fora do desafio de hoje.', date: today() });
    }

    // o recorte tambem manda nas colunas: numa quinta-feira de Shippuden o
    // Naruto ja e sabio, e a dica tem de responder por essa epoca
    const schema = getUniverse(universe);
    const row = compareGuess(guess, secret, schema, scopeReach(schema, sliceOf(universe).scope));
    const day = today();

    /**
     * Quem esta logado tem o chute anotado na conta — e aqui, nao no cliente:
     * o servidor ve todos os chutes, entao a contagem nao depende de o
     * navegador ser honesto nem de a ultima requisicao ter chegado.
     * A anotacao nao segura a resposta: sequencia e placar podem esperar o
     * proximo carregamento, o chute nao.
     */
    if (req.user) {
      db.bumpDailyResult({ userId: req.user.id, day, universe, solved: row.correct })
        .catch(err => console.error('[api] não anotei o chute na conta:', err.message));
    }

    // o segredo so viaja depois que a pessoa acertou
    res.json({ date: day, row, correct: row.correct, secret: row.correct ? secret : null });
  });

  // sem isto uma rota /api errada cairia no index.html do SPA
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota inexistente.' }));

  // ------------------------------------------------------------- estaticos
  /**
   * O espelho das miniaturas (npm run mirror:sprites). O caminho ja carrega
   * universo e id, e o arquivo so muda em outro deploy: pode cravar no cache.
   * Vem antes do early return abaixo para valer tambem quando so a API sobe,
   * em dev. Com fallthrough desligado, miniatura ausente da 404 em vez de cair
   * no index.html do SPA.
   */
  app.use('/sprites', express.static(path.join(ROOT, 'data', 'sprites'), {
    immutable: true,
    maxAge: '1y',
    fallthrough: false,
  }));

  /**
   * Os simbolos que uma coluna pode mostrar no lugar do texto (os elementos de
   * chakra do Naruto). Sao do schema, nao do dataset — mesmas regras de cache
   * das miniaturas.
   */
  app.use('/icons', express.static(path.join(ROOT, 'data', 'icons'), {
    immutable: true,
    maxAge: '1y',
    fallthrough: false,
  }));

  /**
   * As marcas-d'agua dos universos, uma por id (data/marks/<id>.png). Sao a
   * cara do universo no fundo do desafio do dia; universo sem arquivo aqui
   * aparece com a pokebola, e o smoke test cobra o que falta.
   */
  app.use('/marks', express.static(path.join(ROOT, 'data', 'marks'), {
    immutable: true,
    maxAge: '1y',
    fallthrough: false,
  }));

  if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    // rodar so a API e legitimo em dev (o Vite serve o cliente na 5173),
    // entao isto avisa em vez de derrubar o processo
    console.warn('client/dist não encontrado. Rode "npm run build" para gerar o cliente.');
    app.use((_req, res) => res.status(503).type('text').send('Cliente não construído: rode "npm run build".'));
    return app;
  }

  // o index sai carimbado com a versao do deploy; lido uma vez, servido sempre
  // fresco (aponta para os assets com hash, entao nunca pode envelhecer)
  const indexHtml = fs.readFileSync(path.join(CLIENT_DIST, 'index.html'), 'utf8').replace(
    '</head>',
    `<script>window.__APP_VERSION__=${JSON.stringify(BUILD_VERSION)}</script></head>`,
  );

  const sendApp = (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(indexHtml);
  };

  /**
   * O caminho literal vem antes dos estaticos de proposito. Servido pela pasta,
   * /index.html sairia como arquivo — com uma hora de cache e sem o carimbo da
   * versao, ou seja, uma aba sem cache buster nenhum, presa no bundle daquele
   * deploy. E o mesmo documento: tem de sair pela mesma porta que "/".
   */
  app.get('/index.html', sendApp);

  // os assets do Vite tem hash no nome: podem ficar cravados no cache
  app.use('/assets', express.static(path.join(CLIENT_DIST, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));

  // fallback de SPA: link direto e F5 em qualquer rota devolvem o index
  app.get('*', sendApp);

  return app;
}
