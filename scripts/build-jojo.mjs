/**
 * Monta data/jojo.json com os personagens de JoJo's Bizarre Adventure.
 *   npm run build:jojo
 * Fonte: API do MediaWiki da JoJo's Bizarre Encyclopedia (aberta, sem chave).
 *
 * A jojos-bizarre-api.netlify.app, a API que aparece nas buscas, devolve HTML
 * em `/api/characters` — e um site, nao um endpoint. E o wiki tem mais: a ficha
 * `{{Character Info}}` traz parte, nacionalidade, estado, genero e o Stand de
 * cada um, e a `{{Stand Info}}` traz o tipo de cada Stand.
 *
 * As duas fichas se cruzam pelo nome: o personagem aponta para o Stand, e e da
 * pagina do Stand que sai a coluna *Stand* (Perto, Longe, Automatico...). O
 * nome do Stand vira apelido de busca — quem lembra de "Star Platinum" antes de
 * "Jotaro" acha do mesmo jeito.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://jojo.fandom.com/api.php';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'jojo.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'jojo');

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

const chunk = (list, size) => Array.from(
  { length: Math.ceil(list.length / size) },
  (_, i) => list.slice(i * size, i * size + size),
);

async function fetchPages(list, slug, { images = true } = {}) {
  const wikitext = new Map();
  const image = new Map();
  const batches = chunk(list, 50);
  for (const [i, batch] of batches.entries()) {
    process.stdout.write(`\r  ${slug} ${i + 1}/${batches.length}`);
    const titles = batch.join('|');
    const content = await get(`${slug}_wikitext_${i}`, {
      action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles,
    });
    for (const page of Object.values(content.query?.pages ?? {})) {
      const text = page.revisions?.[0]?.slots?.main?.['*'];
      if (text) wikitext.set(page.title, text);
    }
    if (!images) continue;
    const pics = await get(`${slug}_images_${i}`, {
      action: 'query', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '400', titles,
    });
    for (const page of Object.values(pics.query?.pages ?? {})) {
      if (page.thumbnail?.source) image.set(page.title, page.thumbnail.source);
    }
  }
  process.stdout.write('\n');
  return { wikitext, image };
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

/**
 * Quebra em `chave = valor` nos `|` de primeiro nivel.
 *
 * A profundidade nunca desce abaixo de zero. Sem isso, um `]]` solto — e as
 * fichas grandes daqui tem varios, dentro de <gallery> e <tabber> — deixava a
 * conta negativa e todo `|` seguinte parava de contar como separador: a ficha
 * do Jotaro terminava sem `mangadebut`, sem `status` e sem `nation`. Eram 67
 * fichas, e justamente as dos protagonistas, que sao as maiores.
 */
function templateParams(box) {
  const params = [];
  let depth = 0;
  let buffer = '';
  for (let i = 2; i < box.length - 2; i++) {
    if (box.startsWith('{{', i) || box.startsWith('[[', i)) { depth++; buffer += box[i]; continue; }
    if (box.startsWith('}}', i) || box.startsWith(']]', i)) { depth = Math.max(0, depth - 1); buffer += box[i]; continue; }
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

/** Wikitexto -> texto puro: sem refs, sem templates, sem link. */
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

/** O primeiro item de um campo que a ficha escreve como lista. */
const first = (raw) => unwiki(String(raw ?? '').split(/<br\s*\/?>|\n/)[0]).split(/[,;(]/)[0].trim();

/** Alvo do primeiro `[[link]]` do campo — o titulo da pagina, nao o rotulo. */
const linkTarget = (raw) => String(raw ?? '').match(/\[\[([^\]|]+)/)?.[1]?.trim() ?? null;

// ---------------------------------------------------------------- partes

/**
 * `colors` e o tema visual da ficha, e na pratica e a parte a que o personagem
 * pertence — o wiki pinta cada parte de uma cor. E o unico campo que da a parte
 * sem depender de ler o texto.
 */
const PARTS = {
  PhantomBlood: 'parte1',
  BattleTendency: 'parte2',
  StardustCrusaders: 'parte3',
  DiamondIsUnbreakable: 'parte4',
  VentoAureo: 'parte5',
  StoneOcean: 'parte6',
  SteelBallRun: 'parte7',
  JoJolion: 'parte8',
  JoJolands: 'parte9',
};

const partOf = (raw) => PARTS[String(raw ?? '').replace(/[^A-Za-z]/g, '')] ?? null;

/** A ordem das partes, que e a ordem das epocas da sala. */
const PART_ORDER = [
  'parte1', 'parte2', 'parte3', 'parte4', 'parte5',
  'parte6', 'parte7', 'parte8', 'parte9',
];

/**
 * Ate a parte 5 a numeracao dos capitulos e continua (1 a 594); dai em diante
 * cada parte recomeca do 1 e ganha uma sigla — SO de Stone Ocean, SBR de Steel
 * Ball Run, JJL de JoJolion, TJL de The JOJOLands. E o que permite dizer em que
 * parte um capitulo esta.
 */
const CONTINUOUS = [
  [44, 'parte1'], [113, 'parte2'], [265, 'parte3'], [439, 'parte4'], [594, 'parte5'],
];
const PREFIX_PART = { SO: 'parte6', SBR: 'parte7', JJL: 'parte8', TJL: 'parte9' };

/** "{{Ch3|SO Chapter 154}}" -> parte6; "Chapter 264" -> parte3. */
function partOfChapter(raw) {
  // a ficha lista a ultima aparicao e, as vezes, um flashback depois dela; a
  // primeira e a que vale
  const first = String(raw ?? '').split(/<br|\n/)[0];
  const match = first.match(/([A-Z]{2,4})?\s*Chapter\s+(\d+)/);
  if (!match) return null;
  if (match[1]) return PREFIX_PART[match[1]] ?? null;
  const chapter = Number(match[2]);
  return CONTINUOUS.find(([last]) => chapter <= last)?.[1] ?? null;
}

/** Nome da parte, para desempatar os homonimos de partes diferentes. */
const PART_LABEL = {
  parte1: 'Phantom Blood', parte2: 'Battle Tendency', parte3: 'Stardust Crusaders',
  parte4: 'Diamond is Unbreakable', parte5: 'Vento Aureo', parte6: 'Stone Ocean',
  parte7: 'Steel Ball Run', parte8: 'JoJolion', parte9: 'The JOJOLands',
};

// ------------------------------------------------------------------ campos

const genderOf = (raw) => {
  const text = first(raw).toLowerCase();
  if (text.startsWith('female')) return 'F';
  if (text.startsWith('male')) return 'M';
  return null;
};

/**
 * Morrer em JoJo e mais complicado do que parece — a ficha tem "Deceased
 * Reborn as Irene" e "Fused with Enrico Pucci". Tres baldes bastam, e o
 * "Aposentado" e do wiki: quem saiu da historia vivo e nao voltou.
 */
const statusOf = (raw) => {
  const text = unwiki(raw).toLowerCase();
  if (!text) return null;
  if (text.includes('deceased') || text.includes('dead')) return 'morto';
  if (text.includes('retired')) return 'aposentado';
  if (text.includes('alive')) return 'vivo';
  return 'desconhecido';
};

/**
 * Nacionalidade cai em balde: a ficha escreve "Neapolitan" e "Sicilian" (que
 * sao italianos), "Japanese-American" e "Italy". Fora dos seis paises que a
 * serie visita, o resto e "Outra" — valor que aparece uma vez nunca fecha
 * verde.
 */
const NATIONS = [
  ['japao', /japan|japanese/i],
  ['eua', /american|usa|united states/i],
  ['italia', /italian|italy|neapolitan|sicilian|napolitan/i],
  ['reino-unido', /british|english|england|scottish|irish|uk\b/i],
  ['egito', /egypt/i],
  ['alemanha', /german/i],
];

function nationOf(raw) {
  const text = unwiki(raw);
  // metade do elenco de coadjuvantes nunca teve pais dito; "não dita" e
  // resposta, e fecha verde contra outro igual
  if (!text) return 'nao-dita';
  // "Mexican-American" e "Japanese-British" batem em dois baldes; vale o
  // primeiro escrito, que e como a ficha se refere ao personagem
  const found = NATIONS
    .map(([id, pattern]) => [id, text.search(pattern)])
    .filter(([, at]) => at >= 0)
    .sort((a, b) => a[1] - b[1])[0];
  return found ? found[0] : 'outra';
}

/** "{{Ch3|Chapter 443}}" -> 443. So o primeiro capitulo importa. */
const chapterOf = (raw) => {
  const match = String(raw ?? '').match(/Chapter\s+(\d+)/i);
  return match ? Number(match[1]) : null;
};

// ------------------------------------------------------------------ stands

/**
 * O tipo do Stand mora na ficha do Stand, nao na do personagem. O campo `type`
 * costuma listar mais de um ("Close-Range Stand Bound"), e vale o primeiro:
 * e assim que o fa descreve o Stand.
 */
const STAND_TYPES = [
  ['perto', /close.range/i],
  ['longe', /long.distance|long.range/i],
  ['automatico', /automatic/i],
  ['colonia', /colony/i],
  ['ligado', /bound/i],
  ['integrado', /integrated/i],
];

function standTypeOf(raw) {
  const text = unwiki(raw);
  if (!text) return null;
  const found = STAND_TYPES
    .map(([id, pattern]) => [id, text.search(pattern)])
    .filter(([, at]) => at >= 0)
    .sort((a, b) => a[1] - b[1])[0];
  return found ? found[0] : 'outro';
}

// ------------------------------------------------------------- ingestao

console.log('Listando personagens e Stands na JoJo\'s Bizarre Encyclopedia...\n');

const charTitles = await embeddedin('Template:Character Info', 'chars');
const standTitles = await embeddedin('Template:Stand Info', 'stands');
console.log(`  ${charTitles.length} fichas de personagem, ${standTitles.length} de Stand`);

/**
 * O wiki guarda a ficha de varios personagens numa subpagina ("Jotaro
 * Kujo/Infobox") que a pagina principal transclui. As duas aparecem na lista, e
 * a subpagina viraria um Jotaro duplicado na busca.
 */
const isSubpage = (title) => title.includes('/');
const titles = charTitles.filter(title => !isSubpage(title));
console.log(`  ${charTitles.length - titles.length} subpaginas de ficha descartadas`);

console.log('\nBaixando fichas e retratos...');
const { wikitext: charText, image: charImage } = await fetchPages(titles, 'char');
const { wikitext: standText } = await fetchPages(standTitles, 'stand', { images: false });

const standType = new Map();
for (const [title, text] of standText) {
  const box = sliceTemplate(text, 'Stand Info');
  if (!box) continue;
  standType.set(title, standTypeOf(templateParams(box).type));
}

const roster = [];
for (const title of titles) {
  const wikitext = charText.get(title);
  if (!wikitext) continue;
  const box = sliceTemplate(wikitext, 'Character Info');
  if (!box) continue;
  const fields = templateParams(box);

  const standName = linkTarget(fields.stand);
  const sprite = charImage.get(title) ?? null;
  const part = partOf(fields.colors);

  const item = {
    id: roster.length + 1,
    name: unwiki(fields.title) || title,
    // o grupo e o unico eixo alem das partes: quem usa Stand e quem nao usa.
    // As partes 1 e 2 sao inteiras de Hamon, e essa e a divisao que a sala liga
    group: standName ? 'stand' : 'sem-stand',
    // sem parte no wiki e o personagem de one-shot, de novel ou o proprio
    // Araki: fica de fora do sorteio
    part: part ?? 'outros',
    era: PART_ORDER.indexOf(part),
    gender: genderOf(fields.gender),
    nation: nationOf(fields.nation),
    status: statusOf(fields.status),
    // quem nao tem Stand e metade do elenco (as partes 1 e 2 inteiras): "Não
    // tem" e resposta, e fecha verde contra outro sem Stand
    stand: standName ? (standType.get(standName) ?? 'outro') : 'nenhum',
    debutChapter: chapterOf(fields.mangadebut),
    sprite,
    artwork: sprite,
  };

  // o nome do Stand vale de apelido: quem lembra do Star Platinum antes do
  // Jotaro acha do mesmo jeito
  const aliases = [...new Set([title, standName, unwiki(fields.engname), unwiki(fields.ja_romaji)]
    .map(alias => String(alias ?? '').trim())
    .filter(alias => alias && alias !== item.name && alias.length < 40))];
  if (aliases.length) item.aliases = aliases;

  /**
   * O `status` do wiki e o do fim da historia, e isso e spoiler: numa sala que
   * parou na parte 3 o Jotaro nao pode aparecer como morto, porque ele morre na
   * parte 6. A ultima aparicao (`mangafinal`) diz em que parte cada um sai de
   * cena; antes dela, o personagem estava vivo.
   */
  const finalPart = partOfChapter(fields.mangafinal);
  const finalIndex = PART_ORDER.indexOf(finalPart);
  if (item.status && item.status !== 'vivo' && finalIndex > item.era && item.era >= 0) {
    item.byScope = {};
    for (let i = item.era; i < finalIndex; i++) {
      item.byScope[PART_ORDER[i]] = { status: 'vivo' };
    }
  }

  item.eligible = Boolean(sprite && part && item.gender && item.status);
  roster.push(item);
}

/**
 * Josuke Higashikata e o protagonista da parte 4 e tambem um da parte 8; o
 * Yoshikage Kira idem. Como a busca de chute mostra so o nome, o repetido
 * carrega a parte junto — e o nome limpo continua valendo de apelido.
 */
const byName = new Map();
for (const item of roster) byName.set(item.name, (byName.get(item.name) ?? 0) + 1);
for (const item of roster) {
  if (byName.get(item.name) < 2) continue;
  const label = PART_LABEL[item.part];
  if (!label) continue;
  item.aliases = [...new Set([item.name, ...(item.aliases ?? [])])];
  item.name = `${item.name} (${label})`;
}

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('retrato', c => c.sprite);
coverage('parte', c => c.part !== 'outros');
coverage('genero', c => c.gender);
coverage('nacao', c => c.nation);
coverage('estado', c => c.status);
coverage('stand', c => c.stand !== 'nenhum');
coverage('estreia', c => c.debutChapter != null);
coverage('sorteavel', c => c.eligible);

const tally = (label, pick) => {
  const counts = {};
  for (const c of roster) if (c.eligible) for (const v of [pick(c)].flat()) counts[v] = (counts[v] ?? 0) + 1;
  console.log(`${label}:`, JSON.stringify(counts));
};
console.log('');
tally('Sorteaveis por parte', c => c.part);
tally('Sorteaveis por grupo', c => c.group);
console.log('Com status por epoca:', roster.filter(c => c.eligible && c.byScope).length);
tally('Stand', c => c.stand);
tally('Nacao', c => c.nation);
tally('Estado', c => c.status);

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/jojo.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
