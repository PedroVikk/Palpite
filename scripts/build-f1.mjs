/**
 * Baixa a F1 API e gera data/f1.json.
 *   npm run build:f1
 *
 * Fonte: https://f1api.dev (aberta, sem chave).
 *
 * O endpoint /drivers so tem nacionalidade, nascimento e numero — pouco para
 * jogar. Entao varremos a classificacao de cada temporada
 * (/api/{ano}/drivers-championship) e agregamos a carreira de cada piloto:
 * temporadas, vitorias, titulos, estreia e equipe principal.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://f1api.dev/api';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'f1.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'f1');
const CONCURRENCY = 6;

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
      await new Promise(r => setTimeout(r, 600 * attempt * attempt));
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

/** Aceita "1985-01-07" e "07/01/1985". */
const yearOf = (text) => {
  const match = String(text ?? '').match(/(\d{4})/);
  const year = match ? Number(match[1]) : NaN;
  return year >= 1850 && year <= 2030 ? year : null;
};

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text && !/^(unknown|n\/a|none)$/i.test(text) ? text : null;
};

const titleCase = (text) => String(text ?? '')
  .split(/[\s_-]+/).filter(Boolean)
  .map(w => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ');

/** titleCase erra siglas e camelCase: "mclaren" -> "Mclaren", "brm" -> "Brm". */
const TEAM_FIX = {
  Mclaren: 'McLaren', Brm: 'BRM', Bmw: 'BMW', 'Bmw Sauber': 'BMW Sauber',
  Alphatauri: 'AlphaTauri', Rb: 'RB', Hrt: 'HRT', Ats: 'ATS', Bar: 'BAR',
  Alfa: 'Alfa Romeo',
};
const teamName = (id) => {
  const pretty = titleCase(id);
  return TEAM_FIX[pretty] ?? pretty;
};

const decadeOf = (year) => (year ? `${Math.floor(year / 10) * 10}s` : 'outros');

/** A base mistura "American" e "United States" para o mesmo pais. */
const NATIONALITY_FIX = { American: 'United States', 'East German': 'East Germany', Malasya: 'Malaysia' };
const normalizeNationality = (value) => {
  const text = clean(value);
  return text ? (NATIONALITY_FIX[text] ?? text) : null;
};

console.log('Baixando temporadas da F1 API...\n');

// ------------------------------------------------------------ temporadas

const seasons = [];
for (let offset = 0; ; offset += 100) {
  const page = await getJSON(`seasons_${offset}`, `${API}/seasons?limit=100&offset=${offset}`);
  const found = page.championships ?? [];
  seasons.push(...found.map(c => c.year).filter(Boolean));
  if (found.length < 100) break;
}
const years = [...new Set(seasons)].sort((a, b) => a - b);
console.log(`  ${years.length} temporadas: ${years[0]} a ${years.at(-1)}`);

console.log('\nBaixando a classificacao de cada temporada:');
const tables = await mapLimit(years, CONCURRENCY,
  year => getJSON(`championship_${year}`, `${API}/${year}/drivers-championship?limit=100`));

// ------------------------------------------------------------ agregacao

const careers = new Map();

years.forEach((year, index) => {
  for (const row of tables[index]?.drivers_championship ?? []) {
    const id = row.driverId;
    if (!id) continue;

    if (!careers.has(id)) {
      careers.set(id, {
        id, seasons: 0, wins: 0, points: 0, titles: 0,
        bestPosition: null, debut: year, lastSeason: year, teams: new Map(), driver: null,
      });
    }
    const career = careers.get(id);
    career.seasons += 1;
    career.wins += Number(row.wins) || 0;
    career.points += Number(row.points) || 0;
    if (Number(row.position) === 1) career.titles += 1;
    if (career.bestPosition === null || (row.position && row.position < career.bestPosition)) {
      career.bestPosition = Number(row.position);
    }
    career.debut = Math.min(career.debut, year);
    career.lastSeason = Math.max(career.lastSeason, year);
    if (row.teamId) career.teams.set(row.teamId, (career.teams.get(row.teamId) ?? 0) + 1);
    if (row.driver) career.driver = row.driver;
  }
});

console.log(`\n  ${careers.size} pilotos com pelo menos uma temporada classificada`);

const roster = [...careers.values()].map((career, index) => {
  const d = career.driver ?? {};
  const mainTeam = [...career.teams].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const item = {
    id: index + 1,
    sourceId: career.id,
    name: [clean(d.name), clean(d.surname)].filter(Boolean).join(' ') || titleCase(career.id),
    aliases: [clean(d.shortName)].filter(Boolean),
    group: decadeOf(career.debut),
    nationality: normalizeNationality(d.nationality),
    team: mainTeam ? teamName(mainTeam) : null,
    seasons: career.seasons,
    wins: career.wins,
    titles: career.titles,
    debut: career.debut,
    birthYear: yearOf(d.birthday),
    sprite: null,     // a API nao serve fotos
    artwork: null,
  };

  // vencedores, carreiras longas ou gente do grid atual: o resto e nome que
  // ninguem adivinharia, mas continua valendo como chute
  item.eligible = Boolean(
    item.name && item.nationality && item.team &&
    (item.wins >= 1 || item.seasons >= 5 || career.lastSeason >= 2020),
  );
  return item;
});

// ------------------------------------------------------------ cobertura

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} pilotos):`);
coverage('nacionalidade', c => c.nationality);
coverage('equipe', c => c.team);
coverage('ano nasc.', c => c.birthYear != null);
coverage('com vitoria', c => c.wins >= 1);
coverage('com titulo', c => c.titles >= 1);
coverage('sorteavel', c => c.eligible);

const porDecada = {};
for (const c of roster) if (c.eligible) porDecada[c.group] = (porDecada[c.group] ?? 0) + 1;
console.log('\nSorteaveis por decada de estreia:', JSON.stringify(porDecada));

const campeoes = roster.filter(c => c.titles > 0).sort((a, b) => b.titles - a.titles).slice(0, 8);
console.log('Maiores campeoes:', JSON.stringify(campeoes.map(c => `${c.name} (${c.titles})`)));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} pilotos -> data/f1.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
