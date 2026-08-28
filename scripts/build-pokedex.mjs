/**
 * Baixa a PokeAPI uma unica vez e gera data/pokedex.json.
 * Uso:  npm run build:pokedex
 * Env:  LIMIT=151 npm run build:pokedex   (para testar rapido)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const API = 'https://pokeapi.co/api/v2';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'pokemon.json');
const CACHE_DIR = path.join(ROOT, '.cache');
const SPRITE_CACHE = path.join(CACHE_DIR, 'pokemon_sprites');
const LIMIT = Number(process.env.LIMIT || 1025);
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);

const GEN_ROMAN = {
  'generation-i': 1, 'generation-ii': 2, 'generation-iii': 3,
  'generation-iv': 4, 'generation-v': 5, 'generation-vi': 6,
  'generation-vii': 7, 'generation-viii': 8, 'generation-ix': 9,
};

await fs.mkdir(CACHE_DIR, { recursive: true });
await fs.mkdir(SPRITE_CACHE, { recursive: true });

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

// ------------------------------------------------------------------- cores

/**
 * A PokeAPI da uma cor so por Pokemon, e ela e a categoria de busca da Pokedex,
 * nao a aparencia: Moltres entra como "amarelo" com um sprite 75% vermelho, e
 * Charizard e "vermelho" apesar das asas azuis. Como dica de jogo isso engana,
 * entao a cor sai do proprio sprite — e sao varias, porque bicho colorido nao
 * cabe em um rotulo.
 *
 * O vocabulario continua o mesmo da Pokedex (os dez nomes de COLOR_PT), para a
 * coluna seguir legivel e traduzida.
 */
const LIMIAR = 0.18;      // fatia minima do sprite para a cor entrar na lista
const MAX_CORES = 3;      // tres ja enchem a celula; a quarta so polui

/**
 * Croma e luz decidem antes do matiz. O `s` do HSL explode perto do branco e do
 * preto — um pixel quase branco pode marcar saturacao 1 — entao quem separa
 * neutro de colorido aqui e a distancia entre o canal mais forte e o mais fraco.
 */
function nomeDaCor(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const croma = (max - min) / 255;
  const luz = (max + min) / 510;

  if (croma < 0.10) return luz > 0.72 ? 'white' : luz < 0.22 ? 'black' : 'gray';
  if (croma < 0.25 && luz > 0.72) return 'white';   // creme, bege, branco tingido
  if (croma < 0.25 && luz < 0.22) return 'black';

  const d = max - min;
  let h = 0;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;

  // a Pokedex nao tem laranja: laranja claro vira vermelho e o escuro, marrom
  if (h < 14) return luz > 0.55 ? 'pink' : 'red';
  if (h < 40) return luz < 0.55 ? 'brown' : 'red';
  if (h < 68) return luz < 0.35 ? 'brown' : 'yellow';
  if (h < 180) return 'green';                      // o verde vai ate o teal do Bulbasaur
  if (h < 255) return 'blue';
  if (h < 290) return 'purple';
  if (h < 340) return luz > 0.65 ? 'pink' : 'purple';
  return luz > 0.55 ? 'pink' : 'red';
}

/** O PNG do sprite, cacheado como o resto da ingestao. */
async function spriteBytes(id, url) {
  const file = path.join(SPRITE_CACHE, `${id}.png`);
  try {
    return await fs.readFile(file);
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(file, bytes);
      return bytes;
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise(r => setTimeout(r, 400 * attempt * attempt));
    }
  }
}

async function coresDoSprite(id, url) {
  if (!url) return [];
  const { data, info } = await sharp(await spriteBytes(id, url)).raw().toBuffer({ resolveWithObject: true });

  const votos = new Map();
  let total = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (info.channels === 4 && data[i + 3] < 128) continue;              // fundo
    if (Math.max(data[i], data[i + 1], data[i + 2]) < 40) continue;      // traco do contorno
    const nome = nomeDaCor(data[i], data[i + 1], data[i + 2]);
    votos.set(nome, (votos.get(nome) ?? 0) + 1);
    total++;
  }
  if (!total) return [];

  // a dominante entra sempre, mesmo abaixo do limiar: nenhum Pokemon fica sem cor
  return [...votos]
    .sort((a, b) => b[1] - a[1])
    .filter(([, n], i) => i === 0 || n / total >= LIMIAR)
    .slice(0, MAX_CORES)
    .map(([nome]) => nome);
}

const pretty = (s) => s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

console.log(`Baixando ${LIMIT} Pokemon da PokeAPI (concorrencia ${CONCURRENCY})...`);
console.log('Respostas ficam em .cache/, entao rodar de novo e instantaneo.\n');

const ids = Array.from({ length: LIMIT }, (_, i) => i + 1);

console.log('1/4 - dados de batalha (tipos, altura, peso, sprites)');
const mons = await mapLimit(ids, CONCURRENCY, id => getJSON(`${API}/pokemon/${id}`));

console.log('2/4 - especies (geracao, cadeia evolutiva)');
const species = await mapLimit(ids, CONCURRENCY, id => getJSON(`${API}/pokemon-species/${id}`));

const chainUrls = [...new Set(species.map(s => s.evolution_chain?.url).filter(Boolean))];
console.log(`3/4 - ${chainUrls.length} cadeias evolutivas`);
const chains = await mapLimit(chainUrls, CONCURRENCY, url => getJSON(url));
const chainByUrl = new Map(chainUrls.map((url, i) => [url, chains[i]]));

console.log('4/4 - cores de cada sprite');
const cores = await mapLimit(ids, CONCURRENCY, (id, i) => coresDoSprite(id, mons[i].sprites.front_default));

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
    colors: cores[i],
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
