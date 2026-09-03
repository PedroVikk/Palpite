/**
 * Baixa a HP-API e gera data/potter.json.
 *   npm run build:potter
 * Fontes: https://hp-api.onrender.com (aberta, sem chave) e a API do MediaWiki
 * do Harry Potter Wiki.
 *
 * A HP-API tem 437 personagens, mas e rasa: 54% sem ascendencia, 51% sem cor
 * de cabelo e so 22 com foto. O wiki resolve os tres — a `{{Individual
 * infobox}}` traz sangue e cabelo de quatro em cada cinco, e o `pageimages`
 * traz o retrato de quase todo mundo.
 *
 * Sorteaveis sao os que tem casa, especie, genero e ator — ter ator significa
 * que o personagem apareceu nos filmes, um bom filtro de "todo mundo conhece".
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const API = 'https://hp-api.onrender.com/api/characters';
const WIKI = 'https://harrypotter.fandom.com/api.php';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'potter.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'potter');

await fs.mkdir(CACHE_DIR, { recursive: true });

async function fetchJSON(slug, url) {
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
      await new Promise(r => setTimeout(r, 600 * attempt * attempt));
    }
  }
}

const getJSON = () => fetchJSON('characters', API);
const wiki = (slug, params) =>
  fetchJSON(slug, `${WIKI}?${new URLSearchParams({ format: 'json', formatversion: '2', action: 'query', ...params })}`);

/**
 * O nome do arquivo de cache de um lote sai do *conteudo* dele, nunca da
 * posicao. Com `wiki_0`, `wiki_50` e afins, mudar o recorte do universo faz
 * o lote 50 guardar um conjunto de titulos e devolver outro na rodada
 * seguinte — o build nao reclama, so monta a ficha do personagem errado.
 */
const loteSlug = (prefixo, ids) =>
  `${prefixo}-${createHash('sha1').update(ids.join('|')).digest('hex').slice(0, 12)}`;

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text && !/^(unknown|n\/a|none)$/i.test(text) ? text : null;
};

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : null);

// ----------------------------------------------------------- ficha do wiki

/** Recorta o {{Individual infobox}} respeitando as chaves aninhadas. */
function sliceInfobox(wikitext) {
  const start = wikitext.indexOf('{{Individual infobox');
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
 * Quebra nos `|` de profundidade zero. Galeria, nota de rodape e comentario
 * saem antes: os tres tem `|` solto dentro e roubariam o campo seguinte.
 */
function infoboxParams(body) {
  const limpo = body
    .replace(/<gallery[\s\S]*?<\/gallery>/gi, '')
    .replace(/<ref[\s\S]*?(?:\/>|<\/ref>)/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

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
    if (key && !(key in out)) out[key] = chunk.slice(eq + 1).trim();
  }
  return out;
}

const unwiki = (value) => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\{\{[^{}]*\}\}/g, ' ')
  .replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

/** "[[Half-blood]] ([[half-giant]])" -> "half-blood" */
const BLOOD_PT = {
  'pure-blood': 'pure-blood', 'half-blood': 'half-blood', 'muggle-born': 'muggleborn',
  muggleborn: 'muggleborn', muggle: 'muggle', squib: 'squib', 'half-breed': 'half-breed',
};
const bloodOf = (raw) => {
  const text = unwiki(raw).toLowerCase();
  return Object.keys(BLOOD_PT).map(k => (text.includes(k) ? BLOOD_PT[k] : null)).find(Boolean) ?? null;
};

/**
 * O wiki escreve o cabelo em prosa ("Jet-black", "White-blond", "Variable
 * (biologically mousy brown)"). Vale a cor, na mesma lista de nomes que a
 * HP-API usa, senao cada personagem viraria um valor unico.
 */
const HAIR_WORDS = [
  ['Bald', /\bbald\b/i], ['Black', /black|jet-black|raven/i], ['Red', /\bred\b|ginger|auburn/i],
  ['Blonde', /blond/i], ['Brown', /brown|mousy|chestnut/i], ['Grey', /grey|gray|silver/i],
  ['White', /white/i], ['Blue', /blue/i], ['Pink', /pink/i], ['Green', /green/i],
  ['Dark', /\bdark\b/i], ['Sandy', /sandy|tawny/i],
];
const hairOf = (raw) => {
  const text = unwiki(raw);
  if (!text) return null;
  return HAIR_WORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
};

/** A HP-API tem uns nomes com erro de digitacao; o wiki so acha os certos. */
const NAME_FIX = {
  'Alicia Spinet': 'Alicia Spinnet',
  'Milicent Bullstroude': 'Millicent Bulstrode',
  'Phineas Nigelus Black': 'Phineas Nigellus Black',
  Avery: 'Avery II',
};

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
    // a cor da API passa pela mesma normalizacao do wiki, senao "blond" da
    // HP-API e "Blonde" do wiki virariam dois valores que nunca fecham verde
    hairColour: hairOf(c.hairColour),
    sprite: clean(c.image),
    artwork: clean(c.image),
  };

  item.eligible = Boolean(item.house && item.species && item.gender && clean(c.actor));
  return item;
});

// ------------------------------------------------------- completando no wiki

console.log('\nLendo a ficha e o retrato no Harry Potter Wiki...');
const titulos = [...new Set(roster.map(c => NAME_FIX[c.name] ?? c.name))];
const fichas = new Map();
const retratos = new Map();

for (let i = 0; i < titulos.length; i += 50) {
  const grupo = titulos.slice(i, i + 50);
  const page = await wiki(loteSlug('wiki', grupo), {
    prop: 'revisions|pageimages', rvprop: 'content', rvslots: 'main',
    piprop: 'thumbnail', pithumbsize: '400', redirects: '1', titles: grupo.join('|'),
  });
  // o titulo volta trocado quando ha redirecionamento ou normalizacao
  const daOrigem = new Map([
    ...(page.query.redirects ?? []).map(r => [r.to, r.from]),
    ...(page.query.normalized ?? []).map(r => [r.to, r.from]),
  ]);
  for (const p of page.query.pages ?? []) {
    if (p.missing) continue;
    const titulo = daOrigem.get(p.title) ?? p.title;
    if (p.thumbnail?.source) retratos.set(titulo, p.thumbnail.source);
    const body = sliceInfobox(p.revisions?.[0]?.slots?.main?.content ?? '');
    if (body) fichas.set(titulo, infoboxParams(body));
  }
  process.stdout.write(`\r  ${fichas.size}/${titulos.length} fichas`);
}
process.stdout.write('\n');

for (const item of roster) {
  const titulo = NAME_FIX[item.name] ?? item.name;
  const ficha = fichas.get(titulo);
  // o retrato do wiki entra so onde a HP-API nao tem: a foto dela e do filme
  item.sprite = item.sprite ?? retratos.get(titulo) ?? null;
  item.artwork = item.artwork ?? item.sprite;
  if (!ficha) continue;
  item.ancestry = item.ancestry ?? bloodOf(ficha.blood);
  item.hairColour = item.hairColour ?? hairOf(ficha.hair);
}

// o que nem a API nem o wiki dizem fica explicito: e a resposta que a serie
// nunca deu, e dois desconhecidos fecham verde entre si
for (const item of roster) {
  item.ancestry = item.ancestry ?? 'unknown';
  item.hairColour = item.hairColour ?? 'Unknown';
}

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('casa', c => c.house);
coverage('especie', c => c.species);
coverage('genero', c => c.gender);
coverage('ascendencia', c => c.ancestry !== 'unknown');
coverage('cabelo', c => c.hairColour !== 'Unknown');
coverage('imagem', c => c.sprite);
coverage('sorteavel', c => c.eligible);

const porCasa = {};
for (const c of roster) if (c.eligible) porCasa[c.group] = (porCasa[c.group] ?? 0) + 1;
console.log('\nSorteaveis por casa:', JSON.stringify(porCasa));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/potter.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
