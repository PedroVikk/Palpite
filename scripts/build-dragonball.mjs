/**
 * Baixa a Dragon Ball API e gera data/dragonball.json.
 *   npm run build:dragonball
 * Fonte: https://dragonball-api.com (aberta, sem chave).
 *
 * A lista traz raca, genero, afiliacao, ki e imagem; o detalhe de cada
 * personagem acrescenta planeta de origem e transformacoes, entao sao 58
 * requests a mais — todas cacheadas em .cache/dragonball/.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://dragonball-api.com/api';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'dragonball.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'dragonball');

await fs.mkdir(CACHE_DIR, { recursive: true });

async function get(slug, url) {
  const file = path.join(CACHE_DIR, `${slug}.json`);
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
      if (attempt === 4) throw new Error(`${slug}: ${err.message}`);
      await new Promise(r => setTimeout(r, 500 * attempt * attempt));
    }
  }
}

/**
 * Ki vem como texto em tres formatos: "60.000.000", "160,000,000" e
 * "10.8 Septillion". Com escala por extenso o numero usa ponto decimal;
 * sem escala, ponto e virgula sao separadores de milhar.
 */
const SCALES = {
  thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12,
  quadrillion: 1e15, quintillion: 1e18, sextillion: 1e21,
  septillion: 1e24, septllion: 1e24, // typo da propria API
  googolplex: 1e100,                 // so o Zeno chega aqui: serve de teto
};

function parseKi(raw) {
  const text = String(raw ?? '').trim().toLowerCase();
  if (!text || text === 'unknown' || text === '0') return null;
  const scale = Object.keys(SCALES).find(word => text.includes(word));
  if (scale) {
    const n = Number(text.replace(scale, '').replace(/,/g, '').trim());
    return Number.isFinite(n) ? n * SCALES[scale] : null;
  }
  const n = Number(text.replace(/[.,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Nao da para mostrar 9e25 numa celula, entao o ki vira a ordem de grandeza
 * (centenas, milhares, milhoes...). Ainda rende as setas ▲▼ e fica legivel.
 */
const kiTier = (ki) => (ki == null ? null : Math.min(9, Math.floor(Math.log10(ki) / 3)));

const RACE_GROUP = {
  Saiyan: 'saiyajin', Human: 'humano', Namekian: 'namekuseijin',
  Android: 'androide', God: 'divino', Angel: 'divino',
};
const groupOf = (race) => RACE_GROUP[race] ?? 'outros';

const PLANET_PT = {
  Tierra: 'Terra', Namek: 'Namekusei', Vegeta: 'Vegeta', Kanassa: 'Kanassa',
  Monmar: 'Monmar', Yardrat: 'Yardrat', Makyo: 'Makyo', Babari: 'Babari',
  'Freezer No. 79': 'Freeza nº 79', 'Kaiō del Norte': 'Planeta do Kaioh do Norte',
  'Tsufur (Universo 6)': 'Tsufur (Universo 6)', 'Otro Mundo': 'Outro Mundo',
  'Planeta de Bills': 'Planeta de Bills', 'Planeta del Gran Kaio': 'Planeta do Grande Kaioh',
  'Nucleo del Mundo': 'Núcleo do Mundo', 'Planeta sagrado': 'Planeta Sagrado',
  'Nuevo Planeta Tsufrui': 'Novo Planeta Tsufuru',
  'Templo móvil del Rey de Todo': 'Templo do Rei de Tudo', 'Universo 11': 'Universo 11',
};

/** Nomes em pt-BR onde a dublagem brasileira diverge do rotulo da API. */
const NAME_PT = {
  Celula: 'Cell', 'Master Roshi': 'Mestre Kame', 'Kaio del norte (Kaito)': 'Kaioh do Norte',
  'Kaio del Sur': 'Kaioh do Sul', 'Kaio del este': 'Kaioh do Leste',
  'Kaio del Oeste': 'Kaioh do Oeste', 'Gran Kaio': 'Grande Kaioh',
  'Kaio-shin del Este': 'Kaioh Shin do Leste', 'Kaio-shin del Norte': 'Kaioh Shin do Norte',
  'Kaio-shin del Sur': 'Kaioh Shin do Sul', 'Kaio-shin del Oeste': 'Kaioh Shin do Oeste',
  'Gran Kaio-shin': 'Grande Kaioh Shin', 'Grand Priest': 'Grande Sacerdote',
  'Android 20 (Dr. Gero)': 'Dr. Gero (Android 20)', Vermoudh: 'Vermoud',
};

/**
 * A epoca de estreia nao vem da API — e lista escrita a mao, pelos nomes ja em
 * pt-BR. So o Classico e o Super aparecem aqui: quem nao esta em nenhum dos
 * dois estreou no Z, que e a maior parte do elenco. Filme conta para a epoca em
 * que saiu, entao Broly, Janemba e Gogeta ficam no Z, e Bills e Whis no Super.
 * A ordem dos indices e a mesma do `scope.options` do universo.
 */
const ERA_CLASSICO = new Set([
  'Goku', 'Bulma', 'Piccolo', 'Krillin', 'Tenshinhan', 'Yamcha',
  'Chi-Chi', 'Launch', 'Mestre Kame',
]);
const ERA_SUPER = new Set([
  'Bills', 'Whis', 'Zeno', 'Jiren', 'Toppo', 'Dyspo',
  'Marcarita', 'Vermoud', 'Grande Sacerdote',
]);
const eraDe = (nome) => (ERA_CLASSICO.has(nome) ? 0 : ERA_SUPER.has(nome) ? 2 : 1);

/**
 * Apelidos da busca: o nome original e o traduzido levam ao mesmo personagem.
 * A fonte e em espanhol e a dublagem brasileira renomeou meio elenco, entao
 * "Cell" e "Célula", "Krillin" e "Kuririn", "Daishinkan" e "Grande Sacerdote"
 * precisam achar a mesma ficha — quem assistiu num idioma nao deveria perder o
 * chute por causa disso. O nome cru da API entra sozinho, la embaixo; aqui
 * ficam o japones, o ingles e as grafias que a dublagem consagrou.
 */
const ALIASES = {
  Goku: ['Son Goku', 'Kakaroto', 'Kakarot'],
  Vegeta: ['Principe Vegeta'],
  Piccolo: ['Piccolo Jr.', 'Ma Junior', 'Big Green'],
  Bulma: ['Buruma'],
  Celula: ['Cell', 'Célula', 'Perfect Cell'],
  Freezer: ['Frieza', 'Freeza'],
  Zarbon: ['Zarbom'],
  Ginyu: ['Capitão Ginyu', 'Ginew'],
  Gohan: ['Son Gohan'],
  Krillin: ['Kuririn', 'Cririn', 'Klilyn'],
  Tenshinhan: ['Tien', 'Tien Shinhan', 'Ten Shin Han'],
  Yamcha: ['Yamtcha', 'Yamsha'],
  'Chi-Chi': ['Chichi'],
  Trunks: ['Trunks do Futuro'],
  'Master Roshi': ['Mestre Kame', 'Roshi', 'Muten Roshi', 'Kamesennin', 'Tartaruga Genial'],
  Bardock: ['Burdock', 'Bardak'],
  Launch: ['Lunch'],
  'Mr. Satan': ['Hercule', 'Satan', 'Senhor Satan'],
  'Android 13': ['C-13', 'Androide 13'],
  'Android 14': ['C-14', 'Androide 14'],
  'Android 15': ['C-15', 'Androide 15'],
  'Android 16': ['C-16', 'Androide 16'],
  'Android 17': ['C-17', 'Androide 17', 'Lapis'],
  'Android 18': ['C-18', 'Androide 18', 'Lazuli'],
  'Android 19': ['C-19', 'Androide 19'],
  'Android 20 (Dr. Gero)': ['C-20', 'Androide 20', 'Dr. Maki Gero'],
  Nail: ['Neil'],
  Raditz: ['Radditz'],
  'Majin Buu': ['Majin Boo', 'Boo', 'Bu'],
  Bills: ['Beerus', 'Birus'],
  Zeno: ['Zen-Oh', 'Zeno Sama', 'Rei de Tudo'],
  'Kibito-Shin': ['Kibitoshin', 'Kibito Kai', 'Kaioh Shin', 'Shin'],
  Toppo: ['Top'],
  Dyspo: ['Dispo'],
  Vermoudh: ['Vermoud', 'Vermouth'],
  // o Daishinkan e o caso que motivou a lista: ninguem procura por "Grande
  // Sacerdote", que e como a dublagem o chama
  'Grand Priest': ['Daishinkan', 'Dai Shinkan', 'Sumo Sacerdote'],
  'Kaio del norte (Kaito)': ['King Kai', 'Kaito', 'Kaioh Sama'],
  'Kaio-shin del Este': ['Supremo Kaioh Sama', 'Kaioshin', 'Shin'],
  'Gran Kaio-shin': ['Dai Kaioshin'],
  Gogeta: ['Gogueta'],
  Vegetto: ['Vegito', 'Vegerot'],
  Janemba: ['Jannemba'],
  Broly: ['Brolly', 'Broli'],
};

console.log('Baixando personagens da Dragon Ball API...\n');

const lista = (await get('characters', `${API}/characters?limit=1000`)).items;

const detalhes = [];
for (const [i, c] of lista.entries()) {
  process.stdout.write(`\r  personagem ${i + 1}/${lista.length}`);
  detalhes.push(await get(`character_${c.id}`, `${API}/characters/${c.id}`));
}
process.stdout.write('\n');

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text && !/^(unknown|desconocido|-)$/i.test(text) ? text : null;
};

const roster = detalhes.map((c, index) => {
  const ki = parseKi(c.ki);
  const maxKi = parseKi(c.maxKi);
  const nome = NAME_PT[c.name.trim()] ?? c.name.trim();
  const item = {
    id: index + 1,
    sourceId: c.id,
    name: nome,
    group: groupOf(c.race),
    era: eraDe(nome),
    race: clean(c.race),
    gender: clean(c.gender),
    affiliation: clean(c.affiliation),
    planet: clean(PLANET_PT[c.originPlanet?.name?.trim()] ?? c.originPlanet?.name),
    transformations: Array.isArray(c.transformations) ? c.transformations.length : 0,
    ki: kiTier(ki),
    maxKi: kiTier(maxKi),
    sprite: c.image ?? null,
    artwork: c.image ?? null,
  };
  const apelidos = [...new Set([...(ALIASES[c.name.trim()] ?? []), c.name.trim()])]
    .filter(a => a !== nome);
  if (apelidos.length) item.aliases = apelidos;

  item.eligible = Boolean(item.name && item.sprite && item.race && item.gender && item.maxKi != null);
  return item;
});

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(3)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('raca', c => c.race);
coverage('genero', c => c.gender);
coverage('afiliacao', c => c.affiliation);
coverage('planeta', c => c.planet);
coverage('ki', c => c.ki != null);
coverage('ki maximo', c => c.maxKi != null);
coverage('sorteavel', c => c.eligible);

const porGrupo = {};
for (const c of roster) if (c.eligible) porGrupo[c.group] = (porGrupo[c.group] ?? 0) + 1;
console.log('\nSorteaveis por raca:', JSON.stringify(porGrupo));

// as epocas escritas a mao so batem se os nomes baterem: a contagem denuncia
// tanto o nome que mudou na fonte quanto o personagem novo que caiu no Z sem
// ninguem decidir isso
const porEpoca = ['classico', 'z', 'super']
  .map((id, i) => id + ' ' + roster.filter(c => c.eligible && c.era === i).length);
console.log('Sorteaveis por epoca:', porEpoca.join(', '));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/dragonball.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
