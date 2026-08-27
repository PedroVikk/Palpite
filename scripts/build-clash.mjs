/**
 * Baixa a base publica da RoyaleAPI e gera data/clash.json.
 *   npm run build:clash
 *
 * Fonte: https://royaleapi.github.io/cr-api-data (aberta, sem chave).
 * A API oficial da Supercell exige token com IP fixo, entao usamos o dump
 * da comunidade, que traz cartas, stats e as traducoes oficiais em pt-BR.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://royaleapi.github.io/cr-api-data/json';
const CDN = 'https://cdn.royaleapi.com/static/img';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'clash.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'clash');

await fs.mkdir(CACHE_DIR, { recursive: true });

async function getJSON(name) {
  const file = path.join(CACHE_DIR, `${name}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${BASE}/${name}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.writeFile(file, text);
      return JSON.parse(text);
    } catch (err) {
      if (attempt === 4) throw new Error(`${name}.json: ${err.message}`);
      await new Promise(r => setTimeout(r, 600 * attempt * attempt));
    }
  }
}

console.log('Baixando a base da RoyaleAPI...');
console.log('Respostas ficam em .cache/clash/, entao rodar de novo e instantaneo.\n');

const cards = await getJSON('cards');
console.log(`  cards.json: ${cards.length} cartas`);
const stats = await getJSON('cards_stats');
console.log(`  cards_stats.json: ${Object.keys(stats).length} secoes`);
const texts = await getJSON('texts');   // ~9 MB, com as traducoes oficiais
console.log(`  texts.json: ${Object.keys(texts).length} textos`);

// ------------------------------------------------------------ indices

/** Ingles -> portugues, a partir dos TID_SPELL_* (o nome exibido da carta). */
const namePT = new Map();
for (const [tid, entry] of Object.entries(texts)) {
  if (!tid.startsWith('TID_SPELL_') || tid.startsWith('TID_SPELL_INFO_')) continue;
  if (entry?.en && entry?.pt) namePT.set(entry.en, entry.pt);
}
console.log(`  ${namePT.size} nomes traduzidos para pt-BR`);

/** Cada carta tem um "wrapper" na secao do seu tipo, indexado por key. */
const wrappers = new Map();
for (const section of ['troop', 'building', 'spell']) {
  for (const entry of stats[section] ?? []) {
    if (entry.key) wrappers.set(entry.key, { ...entry, section });
  }
}

/** Os numeros de combate ficam na unidade invocada, nao na carta. */
const unitByName = new Map();
for (const section of ['characters', 'troop', 'building', 'spell']) {
  for (const entry of stats[section] ?? []) {
    if (entry.name && !unitByName.has(entry.name)) unitByName.set(entry.name, entry);
  }
}

function unitOf(wrapper) {
  if (!wrapper) return null;
  return unitByName.get(wrapper.summon_character) ?? wrapper;
}

/** Codigo de alvo, traduzido no schema do universo. */
function targetOf(card, unit) {
  if (card.type === 'Spell') return 'area';
  if (!unit) return null;
  if (unit.target_only_buildings) return 'buildings';
  if (unit.attacks_air && unit.attacks_ground) return 'air_ground';
  if (unit.attacks_ground) return 'ground';
  if (unit.attacks_air) return 'air';
  return null;
}

const positive = (value) => (typeof value === 'number' && value > 0 ? value : null);

// ------------------------------------------------------------ montagem

const roster = cards.map((card, index) => {
  const wrapper = wrappers.get(card.key);
  const unit = unitOf(wrapper);
  const hitpoints = positive(unit?.hitpoints) ?? positive(unit?.hitpoints_per_level?.[0]);

  const item = {
    id: index + 1,
    key: card.key,
    name: namePT.get(card.name) ?? card.name,
    aliases: [card.name],                       // busca tambem pelo nome em ingles
    group: card.rarity.toLowerCase(),
    rarity: card.rarity,
    type: card.type,
    elixir: card.elixir ?? null,
    arena: card.arena ?? null,
    target: targetOf(card, unit),
    speed: positive(unit?.speed),
    hitpoints,
    sprite: `${CDN}/cards-150/${card.key}.png`,
    artwork: `${CDN}/cards/${card.key}.png`,
  };

  // toda carta tem raridade, tipo, elixir e arena, entao todas valem como segredo
  item.eligible = Boolean(item.name && item.elixir != null && item.arena != null);
  return item;
});

// ------------------------------------------------------------ cobertura

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} cartas):`);
coverage('nome em pt', c => namePT.has(c.aliases[0]));
coverage('elixir', c => c.elixir != null);
coverage('arena', c => c.arena != null);
coverage('alvo', c => c.target);
coverage('velocidade', c => c.speed != null);
coverage('vida', c => c.hitpoints != null);
coverage('sorteavel', c => c.eligible);

const porRaridade = {};
for (const c of roster) porRaridade[c.group] = (porRaridade[c.group] ?? 0) + 1;
console.log('\nPor raridade:', JSON.stringify(porRaridade));

const porTipo = {};
for (const c of roster) porTipo[c.type] = (porTipo[c.type] ?? 0) + 1;
console.log('Por tipo:', JSON.stringify(porTipo));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} cartas -> data/clash.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
