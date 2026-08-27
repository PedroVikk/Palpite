/**
 * Baixa a Dattebayo API e gera data/naruto.json.
 *   npm run build:naruto
 *
 * A base publica e https://dattebayo-api.onrender.com (o dominio .vercel.app
 * serve so a documentacao). Sao 1431 personagens em paginas de 100.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://dattebayo-api.onrender.com';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'naruto.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'naruto');
const PAGE_SIZE = 100;

await fs.mkdir(CACHE_DIR, { recursive: true });

async function getPage(page) {
  const file = path.join(CACHE_DIR, `page_${page}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/characters?limit=${PAGE_SIZE}&page=${page}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      await fs.writeFile(file, JSON.stringify(json));
      return json;
    } catch (err) {
      if (attempt === 4) throw new Error(`pagina ${page}: ${err.message}`);
      await new Promise(r => setTimeout(r, 600 * attempt * attempt));
    }
  }
}

// ------------------------------------------------------------ parsing

/** Remove notas como "(Anime only)" / "(Affinity)" e espacos duplicados. */
const tidy = (text) => String(text ?? '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

const asList = (value) => {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  return [...new Set(list.map(tidy).filter(Boolean))];
};

const clean = (value) => {
  const text = tidy(value);
  return text && !/^(unknown|n\/a|none)$/i.test(text) ? text : null;
};

/** Campos como height/ninjaRank vem por arco; pegamos o mais recente disponivel. */
const ARC_ORDER = ['Blank Period', 'Part II', 'Gaiden', 'Part I', 'Academy Graduate'];
function byArc(value) {
  if (!value || typeof value !== 'object') return clean(value);
  for (const arc of ARC_ORDER) if (value[arc]) return clean(value[arc]);
  const first = Object.values(value)[0];
  return first ? clean(first) : null;
}

/** "145.3cm - 147.5cm" / "166cm" -> 145.3 / 166 */
function heightCm(value) {
  const text = byArc(value);
  const match = String(text ?? '').match(/([\d.]+)\s*cm/i);
  const n = match ? Number(match[1]) : NaN;
  return Number.isFinite(n) ? n : null;
}

const chapterOf = (text) => {
  const match = String(text ?? '').match(/chapter\s*#?\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

/** "Hyūga,Uzumaki Clan" -> ["Hyūga", "Uzumaki"] */
const clanList = (value) =>
  asList(String(value ?? '').split(',')).map(name => name.replace(/\s*Clan$/i, '')).filter(Boolean);

const VILLAGES = [
  ['konoha', 'Konohagakure'], ['suna', 'Sunagakure'], ['kiri', 'Kirigakure'],
  ['iwa', 'Iwagakure'], ['kumo', 'Kumogakure'], ['oto', 'Otogakure'],
];

/** Vila principal (grupo da sala): vila oculta > Akatsuki > outros. */
function groupOf(affiliation) {
  for (const [id, name] of VILLAGES) if (affiliation.includes(name)) return id;
  if (affiliation.includes('Akatsuki')) return 'akatsuki';
  return 'outros';
}

// ------------------------------------------------------------ execucao

console.log('Baixando personagens da Dattebayo API...');
console.log('Respostas ficam em .cache/naruto/, entao rodar de novo e instantaneo.\n');

const first = await getPage(1);
const totalPages = Math.ceil(first.total / PAGE_SIZE);
const raw = [...first.characters];

for (let page = 2; page <= totalPages; page++) {
  process.stdout.write(`\r  pagina ${page}/${totalPages}`);
  const json = await getPage(page);
  raw.push(...(json.characters ?? []));
}
process.stdout.write('\n');

const roster = raw.map((c, index) => {
  const personal = c.personal ?? {};
  const affiliation = asList(personal.affiliation);

  const item = {
    id: index + 1,
    sourceId: c.id,
    name: tidy(c.name),
    group: groupOf(affiliation),
    gender: clean(personal.sex),
    clan: clanList(personal.clan),
    affiliation,
    classification: asList(personal.classification),
    natureType: asList(c.natureType),
    ninjaRank: byArc(c.rank?.ninjaRank),
    debutChapter: chapterOf(c.debut?.manga),
    height: heightCm(personal.height),
    sprite: c.images?.[0] ?? null,
    artwork: c.images?.[0] ?? null,
  };

  // so quem tem dados completos pode ser sorteado como segredo;
  // qualquer um continua valendo como chute
  item.eligible = Boolean(
    item.gender && item.affiliation.length && item.debutChapter != null &&
    item.height != null && item.sprite,
  );
  return item;
});

// ------------------------------------------------------------ cobertura

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(16)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('genero', c => c.gender);
coverage('cla', c => c.clan.length);
coverage('afiliacao', c => c.affiliation.length);
coverage('classificacao', c => c.classification.length);
coverage('natureza', c => c.natureType.length);
coverage('patente', c => c.ninjaRank);
coverage('cap. estreia', c => c.debutChapter != null);
coverage('altura', c => c.height != null);
coverage('imagem', c => c.sprite);
coverage('sorteavel', c => c.eligible);

const porGrupo = {};
for (const c of roster) if (c.eligible) porGrupo[c.group] = (porGrupo[c.group] ?? 0) + 1;
console.log('\nSorteaveis por vila:', JSON.stringify(porGrupo));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/naruto.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
