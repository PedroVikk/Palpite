/**
 * Baixa a LOTR API da vlayer e gera data/lotr.json.
 *   npm run build:lotr
 *
 * Fonte: https://lotr-api.vlayer.vercel.app (aberta, sem chave).
 * A the-one-api.dev exige token Bearer em /character (devolve 401 sem ele),
 * entao usamos esta. Sao poucos personagens, mas todos os principais e com
 * todos os campos preenchidos.
 *
 * Raca, reino, grupo e especie vem como URLs; resolvemos pelas tabelas.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://lotr-api.vlayer.vercel.app/api/v1';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'lotr.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'lotr');

await fs.mkdir(CACHE_DIR, { recursive: true });

async function getJSON(name, url) {
  const file = path.join(CACHE_DIR, `${name}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.writeFile(file, text);
      return JSON.parse(text);
    } catch (err) {
      if (attempt === 4) throw new Error(`${name}: ${err.message}`);
      await new Promise(r => setTimeout(r, 500 * attempt * attempt));
    }
  }
}

/** Tabela auxiliar id -> nome, para resolver as URLs dos personagens. */
async function lookup(resource) {
  const page = await getJSON(resource, `${API}/${resource}?limit=200`);
  return new Map((page.results ?? []).map(item => [String(item.id), item.name]));
}

/** ".../api/v1/races/3" -> "Elf" */
const resolve = (table, url) => table.get(String(url ?? '').split('/').filter(Boolean).pop()) ?? null;

/** `5'6"` -> 168 cm */
function heightCm(text) {
  const match = String(text ?? '').match(/(\d+)'\s*(\d+)?/);
  if (!match) return null;
  const cm = Math.round((Number(match[1]) * 12 + Number(match[2] ?? 0)) * 2.54);
  return cm > 0 ? cm : null;
}

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text && !/^(unknown|n\/a|none)$/i.test(text) ? text : null;
};

const slug = (text) => String(text ?? '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'outros';

console.log('Baixando personagens da LOTR API (vlayer)...\n');

const [races, realms, groups] = await Promise.all([lookup('races'), lookup('realms'), lookup('groups')]);
console.log(`  tabelas: ${races.size} racas, ${realms.size} reinos, ${groups.size} grupos`);

const raw = [];
let page = 1;
while (true) {
  const json = await getJSON(`characters_${page}`, `${API}/characters?page=${page}`);
  raw.push(...(json.results ?? []));
  if (!json.links?.next) break;
  page += 1;
}
console.log(`  ${raw.length} personagens em ${page} paginas`);

const roster = raw.map((c, index) => {
  const race = resolve(races, c.race);
  const item = {
    id: index + 1,
    sourceId: c.id,
    name: c.name,
    group: slug(race),
    race,
    realm: resolve(realms, c.realm),
    fellowship: resolve(groups, c.group),
    gender: clean(c.gender),
    height: heightCm(c.height),
    hairColor: clean(c.hair_color),
    weapons: Array.isArray(c.weapons) ? c.weapons.filter(Boolean) : [],
    films: Array.isArray(c.films) ? c.films.length : null,
    sprite: null,      // a API nao serve imagens
    artwork: null,
  };

  item.eligible = Boolean(item.name && item.race && item.realm && item.gender && item.films != null);
  return item;
});

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(12)} ${String(n).padStart(3)}/${total}`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('raca', c => c.race);
coverage('reino', c => c.realm);
coverage('grupo', c => c.fellowship);
coverage('altura', c => c.height != null);
coverage('armas', c => c.weapons.length);
coverage('sorteavel', c => c.eligible);

const porRaca = {};
for (const c of roster) if (c.eligible) porRaca[c.group] = (porRaca[c.group] ?? 0) + 1;
console.log('\nSorteaveis por raca:', JSON.stringify(porRaca));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/lotr.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
