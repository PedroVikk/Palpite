/**
 * Baixa a base de super-herois e gera data/heroes.json (inclui a Marvel).
 *   npm run build:heroes
 *
 * Fonte: https://akabab.github.io/superhero-api (espelho estatico e aberto da
 * SuperHero API). O superheroapi.com exige token por usuario e a API oficial
 * da Marvel (developer.marvel.com) exige chave publica + hash privado, entao
 * este espelho e o caminho sem cadastro. Marvel e DC saem como grupos.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE = 'https://akabab.github.io/superhero-api/api/all.json';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'heroes.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'heroes');

await fs.mkdir(CACHE_DIR, { recursive: true });

async function getJSON() {
  const file = path.join(CACHE_DIR, 'all.json');
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(SOURCE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.writeFile(file, text);
      return JSON.parse(text);
    } catch (err) {
      if (attempt === 4) throw new Error(`all.json: ${err.message}`);
      await new Promise(r => setTimeout(r, 600 * attempt * attempt));
    }
  }
}

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text && !/^(-|null|unknown|n\/a)$/i.test(text) ? text : null;
};

/** appearance.height vem como ["5'10", "178 cm"] — queremos os cm. */
const metric = (pair, unit) => {
  const found = (Array.isArray(pair) ? pair : []).find(v => String(v).includes(unit));
  const n = Number(String(found ?? '').replace(unit, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

function publisherGroup(publisher) {
  const text = String(publisher ?? '').toLowerCase();
  if (text.includes('marvel')) return 'marvel';
  if (text.includes('dc comics')) return 'dc';
  return 'outros';
}

console.log('Baixando a base de super-herois...\n');

const raw = await getJSON();
console.log(`  ${raw.length} personagens`);

const roster = raw.map((h, index) => {
  const stats = h.powerstats ?? {};
  const look = h.appearance ?? {};
  const bio = h.biography ?? {};

  const item = {
    id: index + 1,
    sourceId: h.id,
    name: h.name,
    aliases: [clean(bio.fullName)].filter(Boolean),   // busca tambem pelo nome civil
    group: publisherGroup(bio.publisher),
    publisher: clean(bio.publisher),
    alignment: clean(bio.alignment),
    gender: clean(look.gender),
    race: clean(look.race),
    intelligence: stats.intelligence ?? null,
    strength: stats.strength ?? null,
    speed: stats.speed ?? null,
    height: metric(look.height, 'cm'),
    sprite: h.images?.sm ?? h.images?.md ?? null,
    artwork: h.images?.lg ?? h.images?.md ?? null,
  };

  item.eligible = Boolean(
    item.name && item.publisher && item.alignment && item.gender &&
    item.height != null && item.strength != null && item.sprite,
  );
  return item;
});

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('editora', c => c.publisher);
coverage('alinhamento', c => c.alignment);
coverage('genero', c => c.gender);
coverage('raca', c => c.race);
coverage('altura', c => c.height != null);
coverage('forca', c => c.strength != null);
coverage('sorteavel', c => c.eligible);

const porGrupo = {};
for (const c of roster) if (c.eligible) porGrupo[c.group] = (porGrupo[c.group] ?? 0) + 1;
console.log('\nSorteaveis por editora:', JSON.stringify(porGrupo));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/heroes.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
