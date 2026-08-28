/**
 * Espelha as miniaturas dos datasets em data/sprites/, para o jogo nao depender
 * das CDNs de terceiros.
 *   npm run mirror:sprites            # so o que ainda falta
 *   npm run mirror:sprites -- --only=yugioh --force
 *
 * Cada sprite vira <universo>/<id>.webp com no maximo 128px — o tamanho em que
 * ela aparece na busca de chute e na tabela de dicas. O original cru daria
 * ~1,5 GB somando os 18 universos; assim o espelho inteiro cabe em dezenas de
 * MB e pode viver no repositorio.
 *
 * O script nao toca nos JSONs: quem troca a URL remota pelo arquivo local e o
 * catalogo, na subida do servidor (src/catalog.js). Assim os build-*.mjs
 * continuam gravando a URL de origem e rodar este script de novo nao rende
 * diff nenhum nos datasets.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { UNIVERSES } from '../shared/universes.js';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'data', 'sprites');
const SIZE = 128;          // maior lado da miniatura
const QUALITY = 80;        // webp: acima disto o ganho visual some
const WORKERS = 8;
const TIMEOUT = 20_000;
const GAP = 120;           // ms minimos entre dois pedidos ao mesmo host

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.find(a => a.startsWith('--only='))?.slice(7) ?? null;

// alguns wikis devolvem 403 para cliente sem User-Agent
const HEADERS = { 'User-Agent': 'palpite-mirror/1.0 (+https://github.com/PedroVikk)' };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** 404 e companhia: a imagem nao existe mais na origem, retentar nao muda nada. */
class Morta extends Error {}

/**
 * Ritmo por host. Os workers puxam de uma fila so, entao sem isto os oito caem
 * juntos em cima da mesma origem — a Rick and Morty API devolve 429 na hora.
 * Cada host tem seu proprio proximo horario livre: hosts diferentes continuam
 * em paralelo e ninguem apanha sozinho.
 */
const nextSlot = new Map();

function waitFor(host) {
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + GAP);
  return at - now;
}

async function download(url) {
  const { host } = new URL(url);
  for (let attempt = 1; attempt <= 5; attempt++) {
    await sleep(waitFor(host));
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT) });
      if (res.status === 429 || res.status === 503) {
        // a origem pediu calma: segura o host inteiro, nao so este pedido
        const retryAfter = Number(res.headers.get('retry-after'));
        const espera = Math.min(60_000, (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5) * 1000);
        nextSlot.set(host, Date.now() + espera);
        throw new Error(`HTTP ${res.status}`);
      }
      if (res.status === 404 || res.status === 410) throw new Morta(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (err instanceof Morta || attempt === 5) throw err;
      await sleep(400 * attempt * attempt);
    }
  }
}

/** Fila unica consumida por WORKERS em paralelo — mantem o ritmo sem estourar as CDNs. */
async function run(jobs, worker) {
  let cursor = 0;
  const next = async () => {
    while (cursor < jobs.length) await worker(jobs[cursor++]);
  };
  await Promise.all(Array.from({ length: WORKERS }, next));
}

const universes = Object.values(UNIVERSES).filter(u => !only || u.id === only);
if (!universes.length) throw new Error(`Universo desconhecido: ${only}`);

let baixadas = 0;
let bytes = 0;
const falhas = [];

for (const universe of universes) {
  const dir = path.join(OUT_DIR, universe.id);
  await fs.mkdir(dir, { recursive: true });

  const list = JSON.parse(await fs.readFile(path.join(ROOT, 'data', universe.dataFile), 'utf8'));
  const existentes = new Set(await fs.readdir(dir));

  const jobs = list
    .filter(item => typeof item.sprite === 'string' && item.sprite.startsWith('http'))
    .filter(item => force || !existentes.has(`${item.id}.webp`));

  process.stdout.write(`${universe.label}: ${jobs.length} a baixar`);
  let feitas = 0;

  await run(jobs, async (item) => {
    try {
      const origem = await download(item.sprite);
      const webp = await sharp(origem)
        .resize({ width: SIZE, height: SIZE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();
      await fs.writeFile(path.join(dir, `${item.id}.webp`), webp);
      baixadas++;
      bytes += webp.length;
      if (++feitas % 100 === 0) process.stdout.write(`.`);
    } catch (err) {
      falhas.push({ universo: universe.id, id: item.id, name: item.name, motivo: err.message });
    }
  });

  const total = (await fs.readdir(dir)).length;
  console.log(` → ${total} espelhadas`);
}

console.log(`\n${baixadas} novas miniaturas, ${(bytes / 1024 / 1024).toFixed(1)} MB gravados.`);

if (falhas.length) {
  console.log(`\n${falhas.length} falharam (continuam apontando para a CDN):`);
  for (const f of falhas.slice(0, 30)) console.log(`  ${f.universo}/${f.id} ${f.name}: ${f.motivo}`);
  if (falhas.length > 30) console.log(`  ...e mais ${falhas.length - 30}`);
  // rodar de novo pega so estas: as que deram certo ja estao no disco
}
