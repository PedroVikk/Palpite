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
import { UNIVERSES, getUniverse } from '../shared/universes.js';
import { datasetOf, indexOf } from './catalog.js';
import { compareGuess } from './game.js';
import { isKnownUniverse, poolSizeOf, secretOf, today } from './daily.js';

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
  app.get('/healthz', (_req, res) => res.type('text').send('ok'));

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

  /** Qual e o desafio de hoje — sem entregar a resposta, claro. */
  app.get('/api/daily/:universe', (req, res) => {
    const { universe } = req.params;
    if (!isKnownUniverse(universe)) return res.status(404).json({ error: 'Universo desconhecido.' });
    res.set('Cache-Control', 'no-store');   // vira a meia-noite; cachear atrasaria a troca
    res.json({ date: today(), universe, poolSize: poolSizeOf(universe) });
  });

  /**
   * Um chute contra o segredo do dia. E GET porque nao muda nada no servidor:
   * o progresso do jogador mora no navegador dele.
   */
  app.get('/api/daily/:universe/guess/:id', (req, res) => {
    const { universe, id } = req.params;
    if (!isKnownUniverse(universe)) return res.status(404).json({ error: 'Universo desconhecido.' });

    const guess = datasetOf(universe).byId.get(Number(id));
    if (!guess) return res.status(404).json({ error: 'Chute inválido.' });

    const secret = secretOf(universe);
    if (!secret) return res.status(503).json({ error: 'Sem desafio para hoje neste universo.' });

    const row = compareGuess(guess, secret, getUniverse(universe));
    res.set('Cache-Control', 'no-store');
    // o segredo so viaja depois que a pessoa acertou
    res.json({ date: today(), row, correct: row.correct, secret: row.correct ? secret : null });
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

  if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    // rodar so a API e legitimo em dev (o Vite serve o cliente na 5173),
    // entao isto avisa em vez de derrubar o processo
    console.warn('client/dist não encontrado. Rode "npm run build" para gerar o cliente.');
    app.use((_req, res) => res.status(503).type('text').send('Cliente não construído: rode "npm run build".'));
    return app;
  }

  // os assets do Vite tem hash no nome: podem ficar cravados no cache
  app.use('/assets', express.static(path.join(CLIENT_DIST, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));

  // o index sai carimbado com a versao do deploy; lido uma vez, servido sempre
  // fresco (aponta para os assets com hash, entao nunca pode envelhecer)
  const indexHtml = fs.readFileSync(path.join(CLIENT_DIST, 'index.html'), 'utf8').replace(
    '</head>',
    `<script>window.__APP_VERSION__=${JSON.stringify(BUILD_VERSION)}</script></head>`,
  );

  // fallback de SPA: link direto e F5 em qualquer rota devolvem o index
  app.get('*', (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(indexHtml);
  });

  return app;
}
