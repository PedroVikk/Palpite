/**
 * Baixa a HP-API e gera data/potter.json.
 *   npm run build:potter
 * Fonte: https://hp-api.onrender.com (aberta, sem chave).
 *
 * A base tem 437 personagens, mas so 135 tem casa e 22 tem foto. Sorteaveis
 * sao os que tem casa, especie, genero e ator — ter ator significa que o
 * personagem apareceu nos filmes, um bom filtro de "todo mundo conhece".
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://hp-api.onrender.com/api/characters';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'potter.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'potter');

await fs.mkdir(CACHE_DIR, { recursive: true });

async function getJSON() {
  const file = path.join(CACHE_DIR, 'characters.json');
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.writeFile(file, text);
      return JSON.parse(text);
    } catch (err) {
      if (attempt === 4) throw new Error(`characters: ${err.message}`);
      await new Promise(r => setTimeout(r, 600 * attempt * attempt));
    }
  }
}

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text && !/^(unknown|n\/a|none)$/i.test(text) ? text : null;
};

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : null);

console.log('Baixando personagens da HP-API...\n');

const raw = await getJSON();
console.log(`  ${raw.length} personagens`);

const roster = raw.map((c, index) => {
  const house = clean(c.house);
  const item = {
    id: index + 1,
    sourceId: c.id,
    name: c.name,
    aliases: Array.isArray(c.alternate_names) ? c.alternate_names.filter(Boolean) : [],
    group: house ? house.toLowerCase() : 'sem-casa',
    house,
    species: capitalize(clean(c.species)),
    gender: clean(c.gender),
    ancestry: clean(c.ancestry),
    role: c.hogwartsStaff ? 'Funcionário' : c.hogwartsStudent ? 'Estudante' : 'Outro',
    alive: c.alive ? 'Sim' : 'Não',
    hairColour: capitalize(clean(c.hairColour)),
    sprite: clean(c.image),
    artwork: clean(c.image),
  };

  item.eligible = Boolean(item.house && item.species && item.gender && clean(c.actor));
  return item;
});

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('casa', c => c.house);
coverage('especie', c => c.species);
coverage('genero', c => c.gender);
coverage('ascendencia', c => c.ancestry);
coverage('cabelo', c => c.hairColour);
coverage('imagem', c => c.sprite);
coverage('sorteavel', c => c.eligible);

const porCasa = {};
for (const c of roster) if (c.eligible) porCasa[c.group] = (porCasa[c.group] ?? 0) + 1;
console.log('\nSorteaveis por casa:', JSON.stringify(porCasa));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/potter.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
