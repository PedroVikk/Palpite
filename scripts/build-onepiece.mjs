/**
 * Baixa a api-onepiece e gera data/onepiece.json.
 *   npm run build:onepiece
 * Fontes: https://api.api-onepiece.com (aberta, sem chave) para a ficha e a
 * API do MediaWiki da One Piece Wiki para o nome canonico e o retrato.
 *
 * A rota /v2/characters/en nao traz imagem e ficou meio traduzida do frances
 * ("Baggy", "Chapeau de Paille", "Ile des hommes-poissons"), entao cada
 * personagem e casado com a pagina do wiki: de la vem a foto e o nome que a
 * galera conhece, e o nome da API vira apelido de busca.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.api-onepiece.com/v2';
const WIKI = 'https://onepiece.fandom.com/api.php';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'onepiece.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'onepiece');

await fs.mkdir(CACHE_DIR, { recursive: true });

async function getJson(slug, url) {
  const file = path.join(CACHE_DIR, `${slug}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'palpite-dataset/1.0' } });
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

const wikiQuery = (slug, params) =>
  getJson(slug, `${WIKI}?${new URLSearchParams({ format: 'json', action: 'query', ...params })}`);

// ------------------------------------------------------------- traducoes

/**
 * A API mistura ingles e frances no mesmo campo. O mapa cobre os bandos e
 * lugares que aparecem de verdade; o resto passa pelas regras genericas
 * logo abaixo.
 */
const CREW_PT = {
  'The Chapeau de Paille crew': 'Piratas do Chapéu de Palha',
  'Armarda du Chapeau de Paille': 'Grande Frota do Chapéu de Palha',
  'Faux Equipage du Chapeau de Paille': 'Falsos Chapéus de Palha',
  'Le Roux crew': 'Piratas do Ruivo',
  'The Pirates Roger crew': 'Piratas do Roger',
  "Whitebeard's crew": 'Piratas do Barba Branca',
  "Blackbeard's crew": 'Piratas do Barba Negra',
  "Big Mom's crew": 'Piratas da Big Mom',
  'The Hundred Beasts crew': 'Piratas das Cem Feras',
  'The Rocks crew': 'Piratas Rocks',
  "Don Quixote's crew": 'Família Donquixote',
  'The Sun Pirates crew': 'Piratas do Sol',
  'The New Fishmen crew': 'Novos Piratas Homens-Peixe',
  'The Arlong crew': 'Piratas do Arlong',
  'The Kuja Pirates crew': 'Piratas Kuja',
  'The Hearth crew': 'Piratas do Coração',
  'The Kid crew': 'Piratas do Kid',
  'The Hawkins crew': 'Piratas do Hawkins',
  'The On-Air crew': 'Piratas No Ar',
  "Bonney's crew": 'Piratas da Bonney',
  "Drake's crew": 'Piratas do Drake',
  'The Fire Tank crew': 'Piratas Tanque de Fogo',
  'The Foxy crew': 'Piratas do Foxy',
  'The Spade crew': 'Piratas Espadas',
  'The Black Cat crew': 'Piratas do Gato Preto',
  'The Clown Crew': 'Piratas do Buggy',
  'The Alvida crew': 'Piratas da Alvida',
  "Captain Usopp's crew": 'Piratas do Capitão Usopp',
  "Don Krieg's Pirate Armada": 'Armada Krieg',
  'The Rumbar crew': 'Piratas Rumbar',
  'The Giant Crew': 'Piratas Gigantes',
  'New Giant Crew': 'Novos Piratas Gigantes',
  'The Caribou crew': 'Piratas do Caribou',
  'The Phoenix crew': 'Piratas da Fênix',
  "Bartolomeo's crew": 'Piratas Bartolomeo',
  'The Bluejam crew': 'Piratas Bluejam',
  'The ASL crew': 'Piratas ASL',
  'The Flying Pirates crew': 'Piratas Voadores',
  'The Magnificent Pirates crew': 'Piratas Magníficos',
  'Baggy\'s Delivery': 'Buggy Delivery',
  "Buggy's Delivery": 'Buggy Delivery',
  'Baroque Works': 'Baroque Works',
  Marine: 'Marinha',
  'Néo Marine': 'Neo Marinha',
  'Anciens membres de la Marine': 'Ex-Marinha',
  'Armée Révolutionnaire': 'Exército Revolucionário',
  'Dragon Célestes': 'Dragões Celestiais',
  'Cipher Pol': 'Cipher Pol',
  'Anciens membres du Cipher Pol': 'Ex-Cipher Pol',
  'Anciens membres du Baroque Works': 'Ex-Baroque Works',
  'Enies Lobby': 'Enies Lobby',
  'Impel Down': 'Impel Down',
  'Pays des Wa': 'País de Wano',
  'Île des hommes-poissons': 'Ilha dos Homens-Peixe',
  'Royaume de Goa': 'Reino de Goa',
  'Royaume de Germa': 'Reino de Germa',
  'Royaume de Lvneel': 'Reino de Lvneel',
  'Royaume de Luvneel': 'Reino de Lvneel',
  'Royaume de Prodence': 'Reino de Prodence',
  'Royaume de Mogalo': 'Reino de Mogalo',
  'Royaume de Tontatta': 'Reino Tontatta',
  'Royaume maléfique de Black Drum': 'Reino de Black Drum',
  'Île de Drum': 'Ilha de Drum',
  'Île aux cactus': 'Ilha dos Cactos',
  'Île de Mecha': 'Ilha Mecha',
  "Île d'Asuka": 'Ilha Asuka',
  'Île des animaux étranges': 'Ilha dos Animais Estranhos',
  'IÎle de la couronne': 'Ilha da Coroa',
  'La lune': 'Lua',
  'Archipel des Sabaody': 'Arquipélago Sabaody',
  'Archipel Conomi': 'Arquipélago Conomi',
  'Archipel des Gecko': 'Arquipélago Gecko',
  'Archipel des Argao': 'Arquipélago Argao',
  'Archipel de Boing': 'Arquipélago Boing',
  'Village de Shimotsuki': 'Vila Shimotsuki',
  'Pays des fleurs': 'País das Flores',
  'Source de l\'insouciance': 'Fonte da Despreocupação',
  'Cap des Jumeaux': 'Cabo dos Gêmeos',
  'Frères Voleurs': 'Irmãos Ladrões',
  'La Flotte de Happou': 'Frota Happou',
  'Fleet Yonta Maria': 'Frota Yonta Maria',
  'World Economic Journal': 'Jornal Econômico Mundial',
  Esclave: 'Escravos',
  'Espace Pirate': 'Piratas Espaciais',
  'Space Pirate': 'Piratas Espaciais',
  'Primate League': 'Liga dos Primatas',
  'Thriller Bark': 'Piratas de Thriller Bark',
  'The Trump Pirates crew': 'Piratas Trump',
  'The Schneider Pirates crew': 'Piratas Schneider',
  "Gasparde's crew": 'Piratas do Gasparde',
  'The crew of Barbe Brune': 'Piratas do Barba Marrom',
  'The crew of Les Moines Dépravés': 'Piratas dos Monges Depravados',
  "The crew of the Lion d'Or": 'Piratas do Leão de Ouro',
  "L'Équipage des Maquereaux": 'Piratas Cavala',
  'The Marquereaux crew': 'Piratas Cavala',
  'Pirate des flèches rouges': 'Piratas das Flechas Vermelhas',
  'Pirate au foyer': 'Piratas Caseiros',
  'Pirate Moustachus': 'Piratas dos Bigodes',
  'The Pirates with Moustaches crew': 'Piratas dos Bigodes',
  'The Red Arrows crew': 'Piratas das Flechas Vermelhas',
  'The Gros Casques crew': 'Piratas dos Capacetes',
  'The Pirates du Sables crew': 'Piratas das Areias',
  'The Pirates Yes crew': 'Piratas Yes',
  'Equipage de Bellamy': 'Piratas do Bellamy',
  'Equipage de Pandaman': 'Piratas do Pandaman',
  'Equipage de Bigalo': 'Piratas do Bigalo',
  'Bigaro': 'Piratas do Bigalo',
};

/** Sobra do mapa: traducao mecanica dos padroes franceses e ingleses. */
function crewPt(name) {
  if (!name) return null;
  if (CREW_PT[name]) return CREW_PT[name];
  let text = name
    .replace(/^The crew of the /i, 'Bando do ')
    .replace(/^The crew of /i, 'Bando de ')
    .replace(/^L'Équipage de /i, 'Bando de ')
    .replace(/^Equipage de /i, 'Bando de ')
    .replace(/^Anciens membres du /i, 'Ex-')
    .replace(/^Royaume de /i, 'Reino de ')
    .replace(/^Île de /i, 'Ilha de ')
    .replace(/^Île d'/i, 'Ilha ')
    .replace(/^Archipel des /i, 'Arquipélago ')
    .replace(/^Archipel /i, 'Arquipélago ')
    .replace(/^Pirate /i, 'Piratas ')
    .replace(/^the /i, 'The ');
  const crew = text.match(/^The (.+) crew$/i) ?? text.match(/^(.+)'s crew$/i);
  if (crew) text = `Piratas ${crew[1]}`;
  return text.trim();
}

/**
 * O campo `job` tem quase 200 valores unicos ("Galley-La Company (vice-manager)",
 * "head of a yakuza clan in the Udon region"), entao como coluna crua nunca
 * ficaria verde. Vira um punhado de papeis; a ordem resolve os acumulos.
 */
const JOB_RULES = [
  ['Capitão', /^captain|co-captain|vice-captain|capitaine/i],
  ['Realeza', /prince|princess|\bking\b|queen|shogun|monarch|sovereign|feudal lord|\blord\b|emperor|god\b|absolute ruler/i],
  ['Militar', /admiral|colonel|lieutenant|commodore|marine|private\b|chief of staff|commander-in-chief|army|troop|battalion/i],
  ['Oficial', /officer|commander|right-hand|second-in-command|tobi roppo|gifters|numbers|advisor|strategist|deputy|chief\b|vice-president|chairman|manager|director|boss/i],
  ['Agente', /cipher pol|special agent|\bspy\b|informer|observer|browser|sheriff/i],
  ['Guerreiro', /samurai|fighter|musketeer|guard|warrior|assassin|swordsman|sheaths|fourreaux|superstar|homie|pacifistas|seraph/i],
  ['Cientista', /scientist|vegapunk|researcher|medical student/i],
  ['Tripulante', /cook|chef|doctor|carpenter|navigator|sniper|musician|helmsman|archaeologist|shipwright|blacksmith|armurier|fisherman/i],
  ['Comércio', /owner|employee|merchant|grower|dealer|bartender|loan shark|concierge|butler|courtesan|company|station|keeper|library/i],
  ['Morador', /resident|mayor|nomad|villag|tribe|clan|priestess|explorer|next\b/i],
];

const jobRole = (raw) => {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  return JOB_RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? 'Outros';
};

const FRUIT_PT = {
  Paramecia: 'Paramecia', Logia: 'Logia', Zoan: 'Zoan',
  'Zoan Mythique': 'Zoan Mítica', 'Zoan Antique': 'Zoan Ancestral',
  Smile: 'SMILE', Clone: 'Clone',
};

const STATUS_PT = { living: 'Vivo', vivant: 'Vivo', deceased: 'Morto' };

// ---------------------------------------------------------------- grupos

/**
 * Fatias do lobby. A ordem manda: um ex-Cipher Pol que virou pirata cai em
 * pirata so se nao bater antes com Governo.
 */
const GROUP_RULES = [
  ['chapeu', /Chapéu de Palha/i],
  ['yonko', /Piratas do Ruivo|Barba Branca|Barba Negra|Big Mom|Cem Feras|Piratas do Roger|Piratas Rocks/i],
  ['marinha', /Marinha/i],
  ['governo', /Cipher Pol|Dragões Celestiais|Impel Down|Enies Lobby|Baroque Works/i],
  ['revolucao', /Revolucionário/i],
  ['piratas', /Piratas|Bando|Armada|Frota|Família Donquixote|Buggy Delivery|Baroque Works/i],
];

function groupOf(crew) {
  const found = GROUP_RULES.find(([, pattern]) => pattern.test(crew ?? ''));
  return found ? found[0] : 'civis';
}

// ---------------------------------------------------------------- numeros

/** "3.000.000.000" -> 3000000000 */
const berries = (raw) => {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
};

/**
 * "174cm" -> 174. Os gigantes vem em "2 200cm" (milhar separado por espaco)
 * e ha um punhado de lixo ("352cl", aspas soltas) que precisa cair fora.
 */
const HEIGHT_UNITS = { cm: 1, m: 100, km: 100000 };

function heightCm(raw) {
  const text = String(raw ?? '').toLowerCase().replace(/[\s.]/g, '').replace(',', '.');
  const match = text.match(/^(\d+(?:\.\d+)?)(cm|km|m)$/);
  if (!match) return null;
  const value = Number(match[1]) * HEIGHT_UNITS[match[2]];
  return Number.isFinite(value) ? Math.round(value) : null;
}

/** "19 ans" -> 19 */
const years = (raw) => {
  const match = String(raw ?? '').match(/(\d{1,3})/);
  return match ? Number(match[1]) : null;
};

// ------------------------------------------------------- nomes no wiki

const deaccent = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * A traducao mecanica do acento resolve "Praliné" -> "Praline", mas nao os
 * nomes que a edicao francesa trocou de vez. Aqui so entram os casos certos:
 * chutar um titulo errado colaria a foto de outro personagem.
 */
const NAME_FIX = {
  Baggy: 'Buggy', 'Ficher Tiger': 'Fisher Tiger',
  Pingouin: 'Penguin', 'Prométhée': 'Prometheus',
};

/**
 * O nome da API vira uma lista de palpites de titulo: inicial solta ganha
 * ponto ("Monkey D Luffy" -> "Monkey D. Luffy"), "A / B" abre nos dois lados
 * e o hifen tambem vira espaco ("Tony-Tony Chopper").
 */
function titleGuesses(name) {
  // o wiki usa apostrofo reto: "Who’s Who" nunca acharia "Who's Who"
  const base = name.trim().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
  const sides = base.split(/\s*\/\s*/).filter(Boolean);
  const seeds = [base, ...sides, ...sides.map(s => NAME_FIX[s]).filter(Boolean)];
  if (NAME_FIX[base]) seeds.push(NAME_FIX[base]);
  const out = [];
  for (const seed of seeds) {
    for (const variant of [seed, seed.replace(/-/g, ' ')]) {
      const dotted = variant.replace(/\b([A-Z])\b(?!\.)/g, '$1.');
      out.push(dotted, variant, deaccent(dotted), deaccent(variant));
    }
  }
  return [...new Set(out.filter(Boolean))];
}

const chunk = (list, size) => Array.from(
  { length: Math.ceil(list.length / size) },
  (_, i) => list.slice(i * size, i * size + size),
);

/**
 * Resolve titulos em lote. O wiki normaliza e segue redirects sozinho, entao
 * "Big Mom" chega em "Charlotte Linlin" sem esforco nosso.
 */
async function resolveTitles(guesses, tag) {
  const found = new Map(); // palpite -> { title, image }
  const batches = chunk([...new Set(guesses)], 40);
  for (const [i, batch] of batches.entries()) {
    process.stdout.write(`\r  ${tag} ${i + 1}/${batches.length}`);
    const data = await wikiQuery(`${tag}_${i}`, {
      titles: batch.join('|'), prop: 'pageimages', pithumbsize: '400', redirects: '1',
    });
    const query = data.query ?? {};
    const step = new Map([
      ...(query.normalized ?? []).map(n => [n.from, n.to]),
      ...(query.redirects ?? []).map(n => [n.from, n.to]),
    ]);
    const pages = new Map(Object.values(query.pages ?? {}).map(p => [p.title, p]));
    for (const guess of batch) {
      let title = guess;
      for (let hop = 0; hop < 3 && step.has(title); hop++) title = step.get(title);
      const page = pages.get(title);
      if (page && page.pageid) found.set(guess, { title: page.title, image: page.thumbnail?.source ?? null });
    }
  }
  process.stdout.write('\n');
  return found;
}

// ------------------------------------------------------------- ingestao

console.log('Baixando personagens da api-onepiece...\n');

const chars = await getJson('characters', `${API}/characters/en`);
console.log(`  ${chars.length} personagens`);

console.log('\nCasando com a One Piece Wiki...');
const guessesByChar = chars.map(c => titleGuesses(c.name));
const resolved = await resolveTitles(guessesByChar.flat(), 'titulos');

/** Quem nao bateu por titulo ainda pode aparecer na busca do wiki. */
const missing = chars.filter((_, i) => !guessesByChar[i].some(g => resolved.has(g)));
console.log(`  ${missing.length} sem pagina; tentando a busca`);

const searched = new Map(); // nome da API -> titulo
for (const [i, c] of missing.entries()) {
  process.stdout.write(`\r  busca ${i + 1}/${missing.length}`);
  const data = await wikiQuery(`busca_${c.id}`, {
    list: 'search', srsearch: c.name.split(/\s*\/\s*/)[0], srlimit: '1', srnamespace: '0',
  });
  const hit = data.query?.search?.[0]?.title;
  // so vale se o resultado divide alguma palavra com o nome: a busca do wiki
  // sempre devolve algo, e um "Ficher Tiger" nao pode virar "Marine Ford"
  const words = new Set(deaccent(c.name).toLowerCase().match(/[a-z]{4,}/g) ?? []);
  if (hit && [...words].some(w => deaccent(hit).toLowerCase().includes(w))) searched.set(c.name, hit);
}
if (missing.length) process.stdout.write('\n');

const searchImages = await resolveTitles([...searched.values()], 'retratos');

const roster = chars.map((c, index) => {
  const hit = guessesByChar[index].map(g => resolved.get(g)).find(Boolean)
    ?? searchImages.get(searched.get(c.name))
    ?? null;

  const apiName = c.name.trim();
  const name = hit?.title ?? apiName;
  const crew = crewPt(c.crew?.name);
  const item = {
    id: index + 1,
    sourceId: c.id,
    name,
    group: groupOf(crew),
    crew,
    job: jobRole(c.job),
    fruit: c.fruit ? (FRUIT_PT[c.fruit.type] ?? c.fruit.type) : 'Nenhuma',
    status: STATUS_PT[String(c.status ?? '').toLowerCase()] ?? null,
    bounty: berries(c.bounty),
    height: heightCm(c.size),
    age: years(c.age),
    sprite: hit?.image ?? null,
    artwork: hit?.image ?? null,
  };

  // o nome da API costuma ser o francofono ("Baggy"), que muita gente busca
  const aliases = [...new Set([apiName, ...apiName.split(/\s*\/\s*/)])]
    .map(a => a.trim())
    .filter(a => a && a !== name);
  if (aliases.length) item.aliases = aliases;

  item.eligible = Boolean(
    item.sprite && item.crew && item.status && item.job &&
    (item.height != null || item.age != null),
  );
  return item;
});

// ------------------------------------------------- ficha do wiki (Char Box)

/**
 * A api-onepiece so conhece a recompensa de um quarto do elenco e nao tem mar
 * de origem. O wiki tem os dois na `{{Char Box}}` — a mesma pagina de onde ja
 * saem o nome e o retrato —, entao vale uma segunda passada.
 */
function sliceCharBox(wikitext) {
  const start = wikitext.indexOf('{{Char Box');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < wikitext.length; i++) {
    if (wikitext.startsWith('{{', i)) { depth++; i++; continue; }
    if (wikitext.startsWith('}}', i)) {
      depth--; i++;
      if (!depth) return wikitext.slice(start + 2, i - 1);
    }
  }
  return null;
}

/**
 * Quebra nos `|` de profundidade zero: ha `|` dentro de {{ref}} e [[link]]. A
 * <gallery> sai antes — as legendas dela tambem sao separadas por `|`, e ela
 * traz um `height=` proprio (a altura da miniatura) que roubava o campo do
 * personagem: o Luffy saiu com 91 cm.
 */
function charBoxParams(body) {
  const limpo = body
    .replace(/<gallery[\s\S]*?<\/gallery>/gi, '')
    .replace(/<ref[\s\S]*?(?:\/>|<\/ref>)/gi, '');

  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < limpo.length; i++) {
    if (limpo.startsWith('{{', i) || limpo.startsWith('[[', i)) { depth++; i++; continue; }
    if (limpo.startsWith('}}', i) || limpo.startsWith(']]', i)) { depth--; i++; continue; }
    if (limpo[i] === '|' && depth <= 0) { parts.push(limpo.slice(start, i)); start = i + 1; }
  }
  parts.push(limpo.slice(start));
  const out = {};
  for (const chunk of parts.slice(1)) {
    const eq = chunk.indexOf('=');
    const key = eq > 0 ? chunk.slice(0, eq).trim().toLowerCase() : null;
    // vale a primeira ocorrencia: o campo de verdade vem antes do que sobrar
    if (key && !(key in out)) out[key] = chunk.slice(eq + 1).trim();
  }
  return out;
}

/** Os mares e regioes que valem como origem; o resto do campo e a cidade. */
const SEAS = {
  'East Blue': 'East Blue', 'West Blue': 'West Blue', 'North Blue': 'North Blue',
  'South Blue': 'South Blue', 'Grand Line': 'Grand Line', 'New World': 'Grand Line',
  'Red Line': 'Red Line', 'Sky Island': 'Sky Island', 'Calm Belt': 'Calm Belt',
};

const originOf = (raw) => {
  for (const link of String(raw ?? '').matchAll(/\[\[([^\]|]+)/g)) {
    const sea = SEAS[link[1].trim()];
    if (sea) return sea;
  }
  return null;
};

/**
 * O campo lista a recompensa atual e depois as antigas, riscadas. A primeira
 * linha sem `<s>` e a que vale hoje.
 */
const bountyOf = (raw) => {
  for (const line of String(raw ?? '').split(/<br\s*\/?>/)) {
    if (/<s>/.test(line)) continue;
    const found = line.match(/(\d{1,3}(?:,\d{3})+)/);
    if (found) return Number(found[1].replace(/,/g, ''));
  }
  return null;
};

/**
 * A ficha lista a altura em cada fase ("91 cm (debut, child)", "172 cm
 * (pre-timeskip)", "174 cm (post-timeskip)"). Vale a atual: a linha marcada
 * como pos-time-skip, ou a ultima.
 */
const wikiCm = (raw) => {
  const linhas = String(raw ?? '').split(/<br\s*\/?>|\n/)
    .filter(linha => /[\d.]+\s*cm/.test(linha));
  const escolhida = linhas.find(l => /post[- ]timeskip|current/i.test(l)) ?? linhas.at(-1);
  const n = Number(String(escolhida ?? '').match(/([\d.]+)\s*cm/)?.[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
};

console.log('\nLendo a ficha de cada personagem no wiki...');
const fichas = new Map();
const comPagina = [...new Set(roster.map(c => c.name))];
// a ficha mora na pagina; nos personagens com abas ela foi para o
// "Template:<nome> Tabs Top"
for (const molde of ['', 'Template:%s Tabs Top']) {
  const faltam = comPagina.filter(t => !fichas.has(t));
  if (!faltam.length) break;
  for (const [i, grupo] of chunk(faltam, 50).entries()) {
    const titulos = grupo.map(t => (molde ? molde.replace('%s', t) : t));
    const page = await wikiQuery(`fichas_${molde ? 'tpl' : 'pag'}_${i}`, {
      formatversion: '2', prop: 'revisions', rvprop: 'content', rvslots: 'main',
      redirects: '1', titles: titulos.join('|'),
    });
    const daRedirecao = new Map((page.query.redirects ?? []).map(r => [r.to, r.from]));
    for (const p of page.query.pages ?? []) {
      if (p.missing) continue;
      const body = sliceCharBox(p.revisions[0].slots.main.content);
      if (!body) continue;
      const titulo = (daRedirecao.get(p.title) ?? p.title)
        .replace(/^Template:/, '').replace(/ Tabs Top$/, '');
      fichas.set(titulo, charBoxParams(body));
    }
    process.stdout.write(`\r  ${fichas.size}/${comPagina.length}`);
  }
}
process.stdout.write('\n');

for (const item of roster) {
  const ficha = fichas.get(item.name);
  if (!ficha) continue;
  // o wiki manda nos tres: conhece quase o dobro de recompensas que a API, e
  // o unico com a origem, e ainda corrige altura errada (a API poe o Fisher
  // Tiger com 4520cm, dez vezes os 520cm da ficha)
  item.origin = originOf(ficha.origin) ?? item.origin ?? null;
  item.bounty = bountyOf(ficha.bounty) ?? item.bounty;
  item.height = wikiCm(ficha.height) ?? item.height;
}

// mar de origem em branco no wiki e mesmo desconhecido — muito personagem
// nunca teve a terra natal dita —, e isso conta como dica
for (const item of roster) item.origin = item.origin ?? 'Unknown';

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('retrato', c => c.sprite);
coverage('tripulacao', c => c.crew);
coverage('cargo', c => c.job);
coverage('fruta', c => c.fruit !== 'Nenhuma');
coverage('status', c => c.status);
coverage('origem', c => c.origin !== 'Unknown');
coverage('recompensa', c => c.bounty != null);
coverage('altura', c => c.height != null);
coverage('idade', c => c.age != null);
coverage('sorteavel', c => c.eligible);

const porGrupo = {};
for (const c of roster) if (c.eligible) porGrupo[c.group] = (porGrupo[c.group] ?? 0) + 1;
console.log('\nSorteaveis por grupo:', JSON.stringify(porGrupo));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/onepiece.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
