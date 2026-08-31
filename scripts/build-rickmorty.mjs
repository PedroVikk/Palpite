/**
 * Baixa a Rick and Morty API e gera data/rickmorty.json.
 *   npm run build:rickmorty
 * Fonte: https://rickandmortyapi.com (aberta, sem chave).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://rickandmortyapi.com/api';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'rickmorty.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'rickmorty');

await fs.mkdir(CACHE_DIR, { recursive: true });

async function getPage(page) {
  const file = path.join(CACHE_DIR, `page_${page}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/character?page=${page}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.writeFile(file, text);
      return JSON.parse(text);
    } catch (err) {
      if (attempt === 4) throw new Error(`pagina ${page}: ${err.message}`);
      await new Promise(r => setTimeout(r, 500 * attempt * attempt));
    }
  }
}

/**
 * Só três baldes: as espécies exóticas têm um ou dois personagens sorteáveis
 * cada, e um filtro com uma opção só não serve para nada.
 */
const SPECIES_GROUP = { Human: 'human', Alien: 'alien' };
const groupOf = (species) => SPECIES_GROUP[species] ?? 'outros';

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text && text !== 'unknown' && text !== '' ? text : null;
};

console.log('Baixando personagens da Rick and Morty API...\n');

const first = await getPage(1);
const raw = [...first.results];
for (let page = 2; page <= first.info.pages; page++) {
  process.stdout.write(`\r  pagina ${page}/${first.info.pages}`);
  raw.push(...(await getPage(page)).results);
}
process.stdout.write('\n');

const roster = raw.map((c, index) => {
  const item = {
    id: index + 1,
    sourceId: c.id,
    name: c.name,
    group: groupOf(c.species),
    // "unknown" e a resposta da API para quem o desenho nunca disse — vale
    // como dica (fecha verde contra outro desconhecido) e nao como lacuna
    status: clean(c.status) ?? 'unknown',
    species: clean(c.species),
    gender: clean(c.gender) ?? 'unknown',
    origin: clean(c.origin?.name) ?? 'unknown',
    location: clean(c.location?.name) ?? 'unknown',
    episodes: Array.isArray(c.episode) ? c.episode.length : 0,
    // numero do primeiro episodio em que aparece: bom para as setas ▲▼
    firstEpisode: Number(String(c.episode?.[0] ?? '').split('/').pop()) || null,
    sprite: c.image ?? null,
    artwork: c.image ?? null,
  };

  // 2+ episodios filtra os figurantes de uma cena so, que ninguem adivinharia
  item.eligible = Boolean(
    item.name && item.species && item.status && item.sprite &&
    item.episodes >= 2 && item.firstEpisode != null,
  );
  return item;
});

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('status', c => c.status);
coverage('especie', c => c.species);
coverage('genero', c => c.gender !== 'unknown');
coverage('origem', c => c.origin !== 'unknown');
coverage('localizacao', c => c.location !== 'unknown');
coverage('2+ episodios', c => c.episodes >= 2);
coverage('sorteavel', c => c.eligible);

const porGrupo = {};
for (const c of roster) if (c.eligible) porGrupo[c.group] = (porGrupo[c.group] ?? 0) + 1;
console.log('\nSorteaveis por especie:', JSON.stringify(porGrupo));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/rickmorty.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
