/**
 * Baixa a YGOPRODeck API e gera data/yugioh.json.
 *   npm run build:yugioh
 *
 * Fonte: https://db.ygoprodeck.com/api/v7 (aberta, sem chave).
 * São 14 mil cartas — jogar com todas seria impossivel, entao usamos a
 * contagem de visualizacoes do site como medida de fama: ficam no arquivo as
 * TOP_KEEP mais vistas (chutaveis) e so as TOP_SECRET mais vistas podem ser
 * sorteadas como segredo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'yugioh.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'yugioh');
const TOP_KEEP = 3000;    // cartas que entram no arquivo (podem ser chutadas)
const TOP_SECRET = 600;   // cartas que podem ser o segredo

await fs.mkdir(CACHE_DIR, { recursive: true });

async function getJSON() {
  const file = path.join(CACHE_DIR, 'cardinfo.json');
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
      if (attempt === 4) throw new Error(`cardinfo: ${err.message}`);
      await new Promise(r => setTimeout(r, 800 * attempt * attempt));
    }
  }
}

/** frameType tem 17 valores; agrupamos nos que o jogador reconhece. */
function kindOf(frameType) {
  const frame = String(frameType ?? '');
  if (frame === 'spell') return 'spell';
  if (frame === 'trap') return 'trap';
  if (frame.includes('pendulum')) return 'pendulum';
  if (['normal', 'effect', 'fusion', 'synchro', 'xyz', 'link', 'ritual'].includes(frame)) return frame;
  return 'outros';
}

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text && text !== 'N/A' ? text : null;
};

console.log('Baixando cartas da YGOPRODeck...');
console.log('São ~25 MB; fica em .cache/yugioh/, entao rodar de novo e instantaneo.\n');

const payload = await getJSON();
const all = payload.data ?? [];
console.log(`  ${all.length} cartas na base`);

const views = (card) => card.misc_info?.[0]?.views ?? 0;
const ranked = [...all].sort((a, b) => views(b) - views(a)).slice(0, TOP_KEEP);
console.log(`  mantendo as ${ranked.length} mais vistas`);

const roster = ranked.map((card, index) => {
  const kind = kindOf(card.frameType);
  const isMonster = !['spell', 'trap'].includes(kind);

  return {
    id: index + 1,
    sourceId: card.id,
    name: card.name,
    group: kind,
    kind,
    // magia e armadilha tem atributo sim — e o icone SPELL/TRAP no canto da
    // carta. A API nao manda o campo, mas deixar em branco pintava a celula de
    // "sem dado" em um terco da base, e duas magias nunca fechavam verde
    attribute: isMonster ? clean(card.attribute) : kind.toUpperCase(),
    race: clean(card.race),                       // Dragon/Spellcaster, ou Quick-Play/Continuous
    level: isMonster ? (card.level ?? card.linkval ?? null) : null,
    atk: isMonster ? (card.atk ?? null) : null,
    def: isMonster ? (card.def ?? null) : null,
    // carta fora de arquetipo e a maioria da base: "Sem arquétipo" e resposta,
    // nao lacuna
    archetype: clean(card.archetype) ?? 'Sem arquétipo',
    sprite: card.card_images?.[0]?.image_url_small ?? null,
    artwork: card.card_images?.[0]?.image_url ?? null,
    // as TOP_SECRET mais vistas sao famosas o bastante para virar segredo
    eligible: index < TOP_SECRET && Boolean(card.name && card.card_images?.[0]),
  };
});

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} cartas):`);
coverage('atributo', c => c.attribute);
coverage('raca/tipo', c => c.race);
coverage('nivel', c => c.level != null);
coverage('atk', c => c.atk != null);
coverage('arquetipo', c => c.archetype);
coverage('imagem', c => c.sprite);
coverage('sorteavel', c => c.eligible);

const porTipo = {};
for (const c of roster) if (c.eligible) porTipo[c.group] = (porTipo[c.group] ?? 0) + 1;
console.log('\nSorteaveis por tipo:', JSON.stringify(porTipo));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} cartas -> data/yugioh.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
