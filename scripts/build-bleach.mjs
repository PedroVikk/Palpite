/**
 * Baixa a Bleach API e gera data/bleach.json.
 *   npm run build:bleach
 *
 * A API so tem busca por substring (/characters/{raca}/{termo}), entao varremos
 * as letras a-z de cada raca e deduplicamos pelo id. Cada resultado ja vem com
 * o registro completo, entao ~26 requisicoes por raca bastam.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://bleach-api-8v2r.onrender.com';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'bleach.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'bleach');
const RACES = ['shinigami', 'humans', 'quincy', 'arrancar'];
const RACE_PT = { shinigami: 'Shinigami', humans: 'Humano', quincy: 'Quincy', arrancar: 'Arrancar' };
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const CONCURRENCY = 4;

await fs.mkdir(CACHE_DIR, { recursive: true });

async function getJSON(race, term) {
  const file = path.join(CACHE_DIR, `${race}_${term}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/characters/${race}/${term}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      await fs.writeFile(file, JSON.stringify(json));
      return json;
    } catch (err) {
      if (attempt === 4) throw new Error(`${race}/${term}: ${err.message}`);
      await new Promise(r => setTimeout(r, 500 * attempt * attempt));
    }
  }
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0, done = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await worker(items[i]);
      process.stdout.write(`\r  ${++done}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  process.stdout.write('\n');
  return out;
}

// ------------------------------------------------------------ parsing

const firstNumber = (text, unit) => {
  const match = String(text ?? '').match(new RegExp(`([\\d.]+)\\s*${unit}`, 'i'));
  const value = match ? Number(match[1]) : NaN;
  return Number.isFinite(value) ? value : null;
};

/** "Volume 1, Chapter 1" / "Chapter #423" -> 1 / 423 */
const chapterOf = (text) => {
  const match = String(text ?? '').match(/chapter\s*#?\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

/** "13th Division" -> 13 */
const divisionOf = (text) => {
  const match = String(text ?? '').match(/(\d+)(?:st|nd|rd|th)?\s*Division/i);
  return match ? Number(match[1]) : null;
};

const asList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text && !/^(unknown|n\/a|none)$/i.test(text) ? text : null;
};

// ------------------------------------------------------------ execucao

console.log('Baixando personagens da Bleach API...');
console.log('Respostas ficam em .cache/bleach/, entao rodar de novo e instantaneo.\n');

const byId = new Map();

for (const race of RACES) {
  console.log(`${RACE_PT[race]}:`);
  const pages = await mapLimit(LETTERS, CONCURRENCY, letter => getJSON(race, letter));
  for (const page of pages) {
    for (const character of page?.results ?? []) {
      if (!byId.has(character.id)) byId.set(character.id, { race, character });
    }
  }
  console.log(`  acumulado: ${byId.size} personagens`);
}

const roster = [...byId.values()].map(({ race, character: c }, index) => {
  const stats = c.stats ?? {};
  const professional = stats['Professional Status'] ?? {};
  const zanpakuto = stats['Zanpakutō'] ?? stats['Zanpakuto'] ?? {};
  const debut = stats['First Appearance'] ?? {};

  return {
    id: index + 1,
    slug: c.slug ?? c.id,
    name: c.name?.english ?? c.id,
    group: race,
    race: RACE_PT[race],
    gender: clean(stats.gender),
    height: firstNumber(stats.height, 'cm'),
    weight: firstNumber(stats.weight, 'kg'),
    affiliation: asList(professional.affiliation),
    profession: clean(professional.profession),
    division: divisionOf(professional.division ?? professional.position),
    bankai: clean(zanpakuto.bankai) ? 'Sim' : 'Não',
    shikai: clean(zanpakuto.shikai),
    debutChapter: chapterOf(debut.manga),
    sprite: c.avatar?.[0] ?? null,
    artwork: c.avatar?.[0] ?? null,
  };
}).map(c => ({
  // so quem tem dados completos pode ser sorteado como segredo;
  // qualquer um continua valendo como chute
  ...c,
  eligible: Boolean(c.gender && c.affiliation.length && c.debutChapter != null && c.height != null),
}));

// ------------------------------------------------------------ cobertura

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(16)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('nome', c => c.name);
coverage('genero', c => c.gender);
coverage('altura', c => c.height != null);
coverage('peso', c => c.weight != null);
coverage('afiliacao', c => c.affiliation.length);
coverage('profissao', c => c.profession);
coverage('divisao', c => c.division != null);
coverage('bankai=Sim', c => c.bankai === 'Sim');
coverage('cap. estreia', c => c.debutChapter != null);
coverage('imagem', c => c.sprite);
coverage('sorteavel', c => c.eligible);

const porRaca = {};
for (const c of roster) porRaca[c.race] = (porRaca[c.race] ?? 0) + 1;
console.log('\nPor raca:', JSON.stringify(porRaca));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/bleach.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
