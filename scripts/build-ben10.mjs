/**
 * Monta data/ben10.json com os aliens do Omnitrix (e dos outros relogios).
 *   npm run build:ben10
 * Fonte: API do MediaWiki da Ben 10 Wiki (aberta, sem chave).
 *
 * A unica API de Ben 10 que aparece nas buscas, a ben10api.vercel.app, devolve
 * 404 em todas as rotas — esta fora do ar como a de Hunter x Hunter. O wiki tem
 * mais do que ela teria: 317 fichas de alien com especie, planeta natal e a
 * lista de poderes.
 *
 * Quem manda no grupo nao e a ficha e sim a navbox: `Template:Ben 10 Aliens`,
 * `Template:Reboot Aliens`, `Template:Nemetrix Aliens` e companhia dizem de que
 * relogio (e de que dono) cada alien e. A serie de estreia sai do episodio: a
 * ficha do alien da o nome dele, e o `{{EpisodeInfoBox}}` do episodio da a serie
 * e a data de exibicao.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://ben10.fandom.com/api.php';
const INFOBOX = 'Template:Infobox Alien';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'ben10.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'ben10');

await fs.mkdir(CACHE_DIR, { recursive: true });

async function get(slug, params) {
  const file = path.join(CACHE_DIR, `${slug}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
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

/** Paginas que transcluem um template, com paginacao. */
async function embeddedin(title, slug) {
  const out = [];
  let cont = null;
  for (let page = 1; ; page++) {
    const params = {
      action: 'query', list: 'embeddedin', eititle: title,
      einamespace: '0', eilimit: '500',
    };
    if (cont) params.eicontinue = cont;
    const data = await get(`${slug}_${page}`, params);
    out.push(...data.query.embeddedin.map(p => p.title));
    cont = data.continue?.eicontinue;
    if (!cont) return out;
  }
}

// ------------------------------------------------------------- wikitexto

/** Recorta o {{Infobox ...}} inteiro respeitando os {{ }} aninhados. */
function sliceTemplate(wikitext, name) {
  const start = wikitext.indexOf(`{{${name}`);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < wikitext.length; i++) {
    if (wikitext.startsWith('{{', i)) { depth++; i++; continue; }
    if (wikitext.startsWith('}}', i)) {
      depth--; i++;
      if (depth === 0) return wikitext.slice(start, i + 1);
    }
  }
  return null;
}

/** Quebra em `chave = valor` nos `|` de primeiro nivel. */
function templateParams(box) {
  const params = [];
  let depth = 0;
  let buffer = '';
  for (let i = 2; i < box.length - 2; i++) {
    if (box.startsWith('{{', i) || box.startsWith('[[', i)) { depth++; buffer += box[i]; continue; }
    if (box.startsWith('}}', i) || box.startsWith(']]', i)) { depth--; buffer += box[i]; continue; }
    if (box[i] === '|' && depth === 0) { params.push(buffer); buffer = ''; continue; }
    buffer += box[i];
  }
  params.push(buffer);

  const fields = {};
  for (const param of params.slice(1)) {
    const eq = param.indexOf('=');
    if (eq < 0) continue;
    const key = param.slice(0, eq).trim().toLowerCase();
    const value = param.slice(eq + 1).trim();
    if (key && value && !(key in fields)) fields[key] = value;
  }
  return fields;
}

/** Wikitexto -> texto puro. As notas ({{Refn}}) sao paragrafos inteiros aqui. */
function unwiki(raw) {
  let text = String(raw ?? '');
  text = text.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  for (let round = 0; round < 8; round++) {
    const next = text.replace(/\{\{[^{}]*\}\}/g, '');
    if (next === text) break;
    text = next;
  }
  text = text.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1');
  text = text.replace(/<[^>]+>/g, ' ').replace(/'{2,}/g, '');
  return text.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Tira o qualificador entre parenteses ("Heatblast (Classic)" -> "Heatblast"). */
const bare = (text) => String(text ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();

// ---------------------------------------------------------------- grupos

/**
 * Cada relogio tem a sua navbox no wiki, e e ela que responde "de quem e esse
 * alien?" melhor do que qualquer campo da ficha. A ordem e do mais especifico
 * para o mais geral: Mole-Stache esta nas duas listas do Ben, e a do Reboot e
 * a que diz de onde ele saiu.
 */
const NAVBOXES = [
  ['nemetrix', 'Template:Nemetrix Aliens'],
  ['kevin', "Template:Kevin's Aliens"],
  ['ben23', 'Template:Ben 23 Aliens'],
  ['reboot', 'Template:Reboot Aliens'],
  ['ben', 'Template:Ben 10 Aliens'],
];

/**
 * `1st-appearance` aponta para a pagina do episodio, e o caminho ate ela tem
 * tres pedras: o link pode vir com rotulo (`Inspector 13{{!}}Inspector #13`,
 * onde o `{{!}}` e um pipe escapado), o titulo pode ter virgula ("Ben 10,000")
 * e pode ter um "and" no meio ("Of Predators and Prey"). Quebrar em virgula ou
 * em "and", como parecia natural, perdia 90 episodios.
 */
function debutOf(raw) {
  const text = String(raw ?? '').replace(/\{\{!\}\}/g, '|');
  const inner = text.match(/\[\[([^\]]+)\]\]/)?.[1] ?? text;
  return inner
    .split('|')[0]
    .replace(/<(ref|br)[\s\S]*$/i, '')
    .replace(/\{\{[\s\S]*$/, '')
    .trim();
}

// -------------------------------------------------------------- poderes

/**
 * A ficha lista tudo: o Pyronite tem 35 poderes, e "Enhanced Strength" aparece
 * em 156 dos 298 aliens. Listar tudo nao diz nada e forca bruta todo mundo tem,
 * entao ficam so as familias que identificam o alien — e forca, resistencia e
 * salto, que sao quase universais, ficam de fora de proposito.
 */
const POWER_FAMILIES = [
  ['fogo', /pyrokines|fire|flame|lava|magma|combustion|heat generation/i],
  ['gelo', /cryokines|\bice\b|freez|frost|cold breath|frigokines/i],
  ['eletricidade', /electrokines|electricity|lightning|electric|bio-electr/i],
  ['agua', /hydrokines|water (generation|blast|manipulation|projection|propulsion)|aquakines|underwater (breathing|survivability)|aquatic respiration/i],
  ['planta', /chlorokines|plant|vine|seed|petal|flora/i],
  ['terra', /terrakines|geokines|earthquake|sand|mud|tremor/i],
  ['cristal', /crystal/i],
  ['magnetismo', /magnet|ferrokines/i],
  ['voo', /flight|levitation|gliding|hover/i],
  ['velocidade', /enhanced speed|super speed|speed enhancement|hypersonic/i],
  ['intangibilidade', /intangib|phas(e|ing) through|possession/i],
  ['invisibilidade', /invisib|camouflage|cloaking/i],
  ['elasticidade', /elastic|stretch|malleab|rubber/i],
  ['metamorfose', /shapeshift|body alteration|form manipulation|duplication/i],
  ['tamanho', /size alteration|size reduction|size manipulation|growth|shrink/i],
  ['regeneracao', /regenerat|healing|self-sustenance/i],
  ['tecnologia', /technokines|technopath|technological expertise|technorganic|machine interface/i],
  ['som', /sonic|sound|scream|echo|ultrasonic/i],
  ['veneno', /acid|corrosive|poison|venom|toxic|slime (spit|projection)/i],
  ['energia', /energy (beam|blast|ball|projection|absorption|redirection|constructs)|laser|plasma beam/i],
  ['teia', /\bweb\b/i],
  ['esfera', /sphere transformation|ball form|rolling/i],
  ['escavacao', /digging|burrow|drill/i],
  ['realidade', /reality warping|omnipotence|unlimited powers/i],
];

/**
 * Aguentar fogo nao e cuspir fogo. A ficha mistura o que o alien faz com o que
 * ele suporta ("Fire/Heat Resistance", "Lava Immunity"), e sem esta linha o
 * XLR8 saia com poder de fogo — ele so nao se queima.
 */
const PASSIVE = /resistance|immunit|proof|invulnerab/i;

/**
 * O campo vem dentro de um {{Scroll|...}} com os poderes separados por <br />,
 * e alguns trazem uma nota de rodape inteira grudada.
 */
function powersOf(raw) {
  const list = String(raw ?? '')
    .replace(/\{\{Scroll\s*\|/i, '')
    .split(/<br\s*\/?>/i)
    // "Fire Vortex Generation (via Enhanced Speed)" e o que a velocidade do XLR8
    // faz com o ar, nao poder de fogo. Poder derivado sai junto com o passivo
    .filter(part => part.trim() && !/\(via\b/i.test(part))
    .map(part => unwiki(part).trim())
    .filter(power => power && !PASSIVE.test(power));

  const found = POWER_FAMILIES
    .filter(([, pattern]) => list.some(power => pattern.test(power)))
    .map(([id]) => id);
  // sem nenhuma familia sobra o alien de pancadaria pura, o Four Arms da vida:
  // "Nenhum" e a resposta certa, e ela fecha verde contra outro igual
  return found.length ? found.slice(0, 5) : ['nenhum'];
}

// --------------------------------------------------------------- series

/** `series` do episodio -> o balde do jogo. */
const SERIES = [
  ['classica', /2005 TV Series|^Ben 10$/i],
  ['alienforce', /Alien Force/i],
  ['ultimatealien', /Ultimate Alien/i],
  ['omniverse', /Omniverse/i],
  ['reboot', /2016 TV Series|Reboot/i],
];

const seriesOf = (raw) => SERIES.find(([, pattern]) => pattern.test(unwiki(raw)))?.[0] ?? null;

const yearOf = (raw) => {
  const match = unwiki(raw).match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
};

// ------------------------------------------------------------- ingestao

console.log('Listando aliens na Ben 10 Wiki...\n');

const titles = await embeddedin(INFOBOX, 'aliens');
console.log(`  ${titles.length} paginas com ficha de alien`);

const groupOfTitle = new Map();
for (const [id, template] of NAVBOXES) {
  const members = await embeddedin(template, `nav_${id}`);
  for (const title of members) if (!groupOfTitle.has(title)) groupOfTitle.set(title, id);
  console.log(`  navbox ${id.padEnd(9)} ${String(members.length).padStart(3)}`);
}
// fica de fora quem nao esta em navbox nenhuma: 78 aliens nao canonicos e nao
// oficiais, de jogo, brinquedo e material promocional, mais os dez da Dynamite,
// que sao os mesmos aliens de sempre redesenhados para o quadrinho — mesma
// especie, mesmos poderes, so o retrato muda
const roster0 = titles.filter(title => groupOfTitle.has(title));
console.log(`  ${roster0.length} entram (os outros sao nao canonicos, de jogo ou de brinquedo)`);

const chunk = (list, size) => Array.from(
  { length: Math.ceil(list.length / size) },
  (_, i) => list.slice(i * size, i * size + size),
);

async function fetchPages(list, slug) {
  const wikitext = new Map();
  const image = new Map();
  const batches = chunk(list, 50);
  for (const [i, batch] of batches.entries()) {
    process.stdout.write(`\r  ${slug} ${i + 1}/${batches.length}`);
    const joined = batch.join('|');
    const content = await get(`${slug}_wikitext_${i}`, {
      action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: joined,
    });
    for (const page of Object.values(content.query?.pages ?? {})) {
      const text = page.revisions?.[0]?.slots?.main?.['*'];
      if (text) wikitext.set(page.title, text);
    }
    const images = await get(`${slug}_images_${i}`, {
      action: 'query', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '400', titles: joined,
    });
    for (const page of Object.values(images.query?.pages ?? {})) {
      if (page.thumbnail?.source) image.set(page.title, page.thumbnail.source);
    }
  }
  process.stdout.write('\n');
  return { wikitext, image };
}

console.log('\nBaixando fichas e retratos...');
const { wikitext: alienText, image: alienImage } = await fetchPages(roster0, 'alien');

// os episodios de estreia, para saber a serie e o ano de cada alien
const episodes = new Set();
for (const title of roster0) {
  const box = sliceTemplate(alienText.get(title) ?? '', 'Infobox Alien');
  if (!box) continue;
  const debut = debutOf(templateParams(box)['1st-appearance']);
  if (debut) episodes.add(debut);
}
console.log(`\nBaixando ${episodes.size} episodios de estreia...`);
const { wikitext: episodeText } = await fetchPages([...episodes], 'ep');

/**
 * Nem toda estreia e episodio: uns aliens aparecem primeiro em filme, e a ficha
 * do filme e outra ({{Movie infobox}}, com `release date` no lugar de
 * `original broadcast`). Jogo e propaganda ficam sem data — e sem sorteio.
 */
const episodeInfo = new Map();
for (const [title, text] of episodeText) {
  const box = sliceTemplate(text, 'EpisodeInfoBox') ?? sliceTemplate(text, 'Movie infobox');
  if (!box) continue;
  const fields = templateParams(box);
  episodeInfo.set(title, {
    series: seriesOf(fields.series ?? title),
    year: yearOf(fields['original broadcast'] ?? fields['release date'] ?? ''),
  });
}

/** Quando o episodio nao resolve, o relogio ja diz de que fase o alien e. */
const SERIES_BY_GROUP = { reboot: 'reboot', nemetrix: 'omniverse', ben23: 'omniverse' };

const roster = [];
for (const title of roster0) {
  const wikitext = alienText.get(title);
  if (!wikitext) continue;
  const box = sliceTemplate(wikitext, 'Infobox Alien');
  if (!box) continue;
  const fields = templateParams(box);
  const group = groupOfTitle.get(title);

  const debut = debutOf(fields['1st-appearance']);
  const episode = episodeInfo.get(debut) ?? {};
  const species = bare(unwiki(fields.species).split(/,| and /)[0]) || 'Unknown';
  const sprite = alienImage.get(title) ?? null;

  const item = {
    id: roster.length + 1,
    name: bare(unwiki(fields.name) || title) || title,
    group,
    species: species === 'Unknown' ? 'Desconhecida' : species,
    planet: bare(unwiki(fields['home-planet']).split(/,|\(/)[0]) || 'Desconhecido',
    powers: powersOf(fields.power),
    series: episode.series ?? SERIES_BY_GROUP[group] ?? null,
    debutYear: episode.year ?? null,
    sprite,
    artwork: sprite,
  };

  if (item.planet === 'Unknown') item.planet = 'Desconhecido';

  const aliases = [...new Set([title, unwiki(fields.nicknames).split(/<br|,/)[0].trim()]
    .map(alias => alias.replace(/<[^>]*>/g, '').trim())
    .filter(alias => alias && alias !== item.name && alias.length < 40))];
  if (aliases.length) item.aliases = aliases;

  // sem retrato a linha de dica fica vazia, e sem serie nem ano a pagina e uma
  // lista disfarcada de ficha ("Ultimate Forms"). Especie nao entra no teste:
  // a de varios aliens a serie nunca nomeou, e "Desconhecida" e resposta
  item.eligible = Boolean(sprite && item.series && item.debutYear);
  roster.push(item);
}

/**
 * Heatblast e alien do Ben em duas continuidades. Como a busca de chute mostra
 * so o nome, o repetido carrega de volta o qualificador do wiki — e o nome
 * limpo continua valendo de apelido.
 */
const QUALIFIER_PT = {
  Classic: 'Clássico', Reboot: 'Reboot', Dynamite: 'Quadrinhos',
  Transformation: 'Nemetrix', 'Dimension 23': 'Ben 23',
};

const byName = new Map();
for (const item of roster) byName.set(item.name, (byName.get(item.name) ?? 0) + 1);
for (const item of roster) {
  if (byName.get(item.name) < 2) continue;
  const original = item.aliases?.find(alias => /\(.*\)$/.test(alias)) ?? '';
  const qualifier = original.match(/\(([^)]*)\)$/)?.[1];
  const label = QUALIFIER_PT[qualifier] ?? qualifier;
  if (!label) continue;
  item.aliases = [...new Set([item.name, ...(item.aliases ?? [])])];
  item.name = `${item.name} (${label})`;
}

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} aliens):`);
coverage('retrato', a => a.sprite);
coverage('especie', a => a.species !== 'Desconhecida');
coverage('planeta', a => a.planet !== 'Desconhecido');
coverage('poderes', a => a.powers[0] !== 'nenhum');
coverage('serie', a => a.series);
coverage('ano', a => a.debutYear != null);
coverage('sorteavel', a => a.eligible);

const tally = (label, pick) => {
  const counts = {};
  for (const a of roster) if (a.eligible) for (const v of [pick(a)].flat()) counts[v] = (counts[v] ?? 0) + 1;
  console.log(`${label}:`, JSON.stringify(counts));
};
console.log('');
tally('Sorteaveis por relogio', a => a.group);
tally('Serie', a => a.series);
tally('Poderes', a => a.powers);

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} aliens -> data/ben10.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
