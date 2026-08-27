/**
 * Baixa a PokeAPI uma unica vez e gera data/pokedex.json.
 * Uso:  npm run build:pokedex
 * Env:  LIMIT=151 npm run build:pokedex   (para testar rapido)
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://pokeapi.co/api/v2';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'pokemon.json');
const CACHE_DIR = path.join(ROOT, '.cache');
const LIMIT = Number(process.env.LIMIT || 1025);
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);

const GEN_ROMAN = {
  'generation-i': 1, 'generation-ii': 2, 'generation-iii': 3,
  'generation-iv': 4, 'generation-v': 5, 'generation-vi': 6,
  'generation-vii': 7, 'generation-viii': 8, 'generation-ix': 9,
};

await fs.mkdir(CACHE_DIR, { recursive: true });

function cacheKey(url) {
  return url.replace(API + '/', '').replace(/[^a-z0-9]+/gi, '_') + '.json';
}

async function getJSON(url) {
  const file = path.join(CACHE_DIR, cacheKey(url));
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
      const json = await res.json();
      await fs.writeFile(file, JSON.stringify(json));
      return json;
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise(r => setTimeout(r, 400 * attempt * attempt));
    }
  }
}

/** Executa `worker` sobre `items` com paralelismo limitado. */
async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  let done = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await worker(items[i], i);
      done++;
      if (done % 25 === 0 || done === items.length) {
        process.stdout.write(`\r  ${done}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  process.stdout.write('\n');
  return out;
}

/** Profundidade (1, 2 ou 3) da especie dentro da cadeia evolutiva. */
function evolutionStage(chainNode, speciesName, depth = 1) {
  if (chainNode.species.name === speciesName) return depth;
  for (const next of chainNode.evolves_to) {
    const found = evolutionStage(next, speciesName, depth + 1);
    if (found) return found;
  }
  return 0;
}

const pretty = (s) => s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

console.log(`Baixando ${LIMIT} Pokemon da PokeAPI (concorrencia ${CONCURRENCY})...`);
console.log('Respostas ficam em .cache/, entao rodar de novo e instantaneo.\n');

const ids = Array.from({ length: LIMIT }, (_, i) => i + 1);

console.log('1/3 - dados de batalha (tipos, altura, peso, sprites)');
const mons = await mapLimit(ids, CONCURRENCY, id => getJSON(`${API}/pokemon/${id}`));

console.log('2/3 - especies (geracao, cor, cadeia evolutiva)');
const species = await mapLimit(ids, CONCURRENCY, id => getJSON(`${API}/pokemon-species/${id}`));

const chainUrls = [...new Set(species.map(s => s.evolution_chain?.url).filter(Boolean))];
console.log(`3/3 - ${chainUrls.length} cadeias evolutivas`);
const chains = await mapLimit(chainUrls, CONCURRENCY, url => getJSON(url));
const chainByUrl = new Map(chainUrls.map((url, i) => [url, chains[i]]));

const pokedex = ids.map((id, i) => {
  const mon = mons[i];
  const sp = species[i];
  const chain = chainByUrl.get(sp.evolution_chain?.url);
  const types = mon.types.sort((a, b) => a.slot - b.slot).map(t => t.type.name);
  const artwork = mon.sprites.other?.['official-artwork']?.front_default;
  return {
    id,
    name: pretty(sp.name),
    slug: sp.name,
    group: String(GEN_ROMAN[sp.generation?.name] ?? 0),
    eligible: true,
    type1: types[0] ?? null,
    type2: types[1] ?? null,
    generation: GEN_ROMAN[sp.generation?.name] ?? 0,
    color: sp.color?.name ?? 'unknown',
    stage: chain ? (evolutionStage(chain.chain, sp.name) || 1) : 1,
    height: mon.height / 10,   // decimetros -> metros
    weight: mon.weight / 10,   // hectogramas -> kg
    sprite: mon.sprites.front_default,
    artwork: artwork ?? mon.sprites.front_default,
  };
});

const broken = pokedex.filter(p => !p.type1 || !p.generation);
if (broken.length) console.warn(`Aviso: ${broken.length} registros incompletos:`, broken.slice(0, 5).map(p => p.name));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(pokedex));
const kb = Math.round((await fs.stat(OUT)).size / 1024);
console.log(`\nPronto: ${pokedex.length} Pokemon -> data/pokemon.json (${kb} KB)`);
