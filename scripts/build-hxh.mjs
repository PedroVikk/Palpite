/**
 * Monta data/hxh.json com os personagens de Hunter x Hunter.
 *   npm run build:hxh
 * Fonte: API do MediaWiki da Hunterpedia (aberta, sem chave).
 *
 * Nao existe API pronta de HxH no ar — a hxh-api.vercel.app devolve 402 —,
 * entao a ingestao usa o proprio wiki: `list=embeddedin` acha as paginas que
 * transcluem a ficha de personagem, `prop=revisions` traz o wikitexto de 50
 * por vez e `prop=pageimages` o retrato do infobox. O trabalho todo esta em
 * limpar o wikitexto: refs, {{dtb|...}}, [[link|texto]] e <br /> no meio de
 * cada campo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://hunterxhunter.fandom.com/api.php';
const INFOBOX = 'Hunterpedia:Character';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'hxh.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'hxh');

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

/** Remove um template pelo nome, com os aninhados dele. */
function dropTemplate(text, name) {
  let out = text;
  for (;;) {
    const box = sliceTemplate(out, name);
    if (!box) return out;
    out = out.replace(box, '');
  }
}

/**
 * Resolve os templates de dentro para fora — `{{jap|'''King'''|{{Ruby|王|おう}}|Ō}}`
 * so entrega "King" depois que o Ruby aninhado sai da frente. `dtb` (valor do
 * databook) e `jap` (nome latino) guardam o primeiro parametro; o resto some.
 */
function collapseTemplates(text) {
  let out = text;
  for (let round = 0; round < 8; round++) {
    const next = out.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => {
      const parts = inner.split('|');
      const name = parts[0].trim().toLowerCase();
      return name === 'dtb' || name === 'jap' ? (parts[1] ?? '') : '';
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Wikitexto -> texto puro: sem refs, sem templates de nota, sem links. */
function unwiki(raw) {
  let text = String(raw ?? '');
  text = text.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  text = dropTemplate(text, 'Note');
  text = collapseTemplates(text);
  text = text.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/'{2,}/g, '');
  return text.replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

/** Um campo do infobox costuma ser uma lista separada por <br />. */
const lines = (raw) => unwiki(String(raw ?? '').replace(/<br\s*\/?>/gi, '\n'))
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean);

/** Tira o qualificador entre parenteses ("White (Manga; 2011)" -> "White"). */
const bare = (text) => text.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();

// ---------------------------------------------------------------- campos

const NEN_TYPES = [
  ['Enhancement', /enhance/i], ['Transmutation', /transmut/i], ['Emission', /emi(ss|tt)/i],
  ['Manipulation', /manipulat/i], ['Conjuration', /conjur/i], ['Specialization', /special/i],
];

/**
 * A ficha de 260 personagens diz "Unknown" de proposito: nunca revelaram a
 * categoria. Isso e informacao, nao buraco — vira valor e fecha verde contra
 * outro desconhecido; so quem nao tem o campo fica sem nada.
 */
const nenOf = (raw) => {
  if (!raw) return null;
  const text = unwiki(raw);
  return NEN_TYPES.find(([, pattern]) => pattern.test(text))?.[0] ?? 'Unknown';
};

const statusOf = (raw) => {
  const text = bare(lines(raw)[0] ?? '').toLowerCase();
  if (!text) return null;
  if (text.includes('deceas') || text.includes('dead')) return 'Deceased';
  if (text.includes('alive')) return 'Alive';
  return 'Unknown';
};

const genderOf = (raw) => {
  const text = bare(lines(raw)[0] ?? '').toLowerCase();
  if (text.startsWith('male')) return 'Male';
  if (text.startsWith('female')) return 'Female';
  return null;
};

/** "White (Manga; 1999; 2011)" ou "Black / Green" -> primeira cor. */
const HAIR = {
  black: 'Black', white: 'White', blonde: 'Blonde', blond: 'Blonde', brown: 'Brown',
  brunette: 'Brown', green: 'Green', blue: 'Blue', red: 'Red', ginger: 'Red',
  purple: 'Purple', violet: 'Purple', pink: 'Pink', silver: 'Silver', grey: 'Grey',
  gray: 'Grey', orange: 'Orange', bald: 'Bald', none: 'Bald', yellow: 'Blonde',
};

/** Varias fichas dao uma cor por adaptacao; vale a do manga / anime de 2011. */
const hairOf = (raw) => {
  const parts = lines(raw);
  const chosen = parts.find(part => /manga|2011/i.test(part)) ?? parts[0];
  const text = bare(chosen ?? '').toLowerCase();
  const found = Object.keys(HAIR).find(color => new RegExp(`\\b${color}`, 'i').test(text));
  return found ? HAIR[found] : null;
};

/**
 * Ocupacao vem em texto livre ("Royal Bodyguard for Prince Tubeppa"), entao
 * cai em um punhado de baldes — senao cada personagem teria um valor unico e
 * a coluna nunca ficaria verde. A ordem decide os casos duplos.
 */
const JOB_RULES = [
  ['assassino', /assassin/i],
  ['guarda', /bodyguard|private guard|guard of|henchman/i],
  ['soldado', /soldier|army|corporal|general\b|militar/i],
  ['mafioso', /mafios[oi]|mafia|heavenly kings|\bdon\b/i],
  ['lutador', /fighter|prizefighter|floor master|boxer|wrestler/i],
  ['hunter', /hunter/i],
  ['servo', /servant|maid|butler|attendant|chef|bartender/i],
  ['realeza', /prince|princess|queen|king\b|royalty|chairman/i],
  ['ladrao', /thief|bandit|robber|pirate|smuggler/i],
  ['jogador', /greed island|game master/i],
  ['ciencia', /doctor|researcher|scientist|nurse|professor|teacher/i],
  ['artista', /circus|performer|announcer|singer|actor|musician/i],
];

function jobOf(raw) {
  const text = lines(raw).map(bare).join(' | ');
  // ficha sem o campo e ficha com texto que nao cai em balde nenhum sao coisas
  // diferentes: a primeira e "nao tem ocupacao", a segunda e "outra"
  if (!text) return 'nenhuma';
  const found = JOB_RULES.find(([, pattern]) => pattern.test(text));
  return found ? found[0] : 'outros';
}

/** "Chapter 6" -> 6. So o primeiro capitulo importa. */
const chapterOf = (raw) => {
  const match = unwiki(raw).match(/Chapter\s+(\d+)/i);
  return match ? Number(match[1]) : null;
};

/**
 * O manga vai muito alem do que foi animado, entao quem nao tem "anime debut"
 * so existe no papel. E o que separa os dois recortes da sala.
 */
const inAnimeOf = (raw) => /episode|ova|movie|mission/i.test(unwiki(raw));

/** Afiliacoes viram lista curta e sem repeticao. */
const affiliationsOf = (raw) => {
  const list = lines(raw)
    .map(bare)
    .map(text => text.replace(/\s*[;,]\s*$/, '').trim())
    .filter(text => text && text.length < 40);
  return [...new Set(list)].slice(0, 4);
};

// ---------------------------------------------------------------- grupos

/**
 * Os baldes do lobby saem das afiliacoes. A ordem importa: quem e Zoldyck e
 * Hunter cai em Zoldyck, que e a fatia mais especifica.
 */
const GROUP_RULES = [
  ['zoldyck', /zoldyck/i],
  ['trupe', /phantom troupe|spiders?\b|genei ryodan/i],
  // "Chimera Ant Extermination Team" e time de Hunter, nao formiga: exige o plural
  ['formigas', /chimera ants|chimera ant (queen|king)|royal guards?/i],
  ['kakin', /kakin|hui guo rou|dark continent expedition/i],
  ['mafia', /mafia|nostrade|ten dons|shadow beast/i],
  ['hunter', /hunter association|hunter exam|hunter\b/i],
];

function groupOf(affiliations, occupationRaw) {
  const haystack = [...affiliations, unwiki(occupationRaw)].join(' | ');
  for (const [id, pattern] of GROUP_RULES) if (pattern.test(haystack)) return id;
  return 'outros';
}

/**
 * Nome proprio fica como esta, mas o wiki registra uns vinte personagens so
 * pelo cargo ("Trick Tower's 3rd Examiner"). Esses sao descricao, nao nome,
 * entao vao traduzidos — o titulo em ingles continua valendo de apelido.
 */
const NAME_PT = {
  'Chimera Ant Queen': 'Rainha das Formigas Quimera',
  'Chimera Ant King': 'Rei das Formigas Quimera',
  "288th Hunter Exam's 1st Phase Examiner": 'Examinador da 1ª fase do 288º Exame Hunter',
  "Trick Tower's 2nd Examiner": '2º examinador da Torre das Armadilhas',
  "Trick Tower's 3rd Examiner": '3º examinador da Torre das Armadilhas',
  "Kurapika's Father": 'Pai do Kurapika',
  "Kurapika's Mother": 'Mãe do Kurapika',
  "Gyro's Father": 'Pai do Gyro',
  'Hunter Website Bartender': 'Barman do site dos Hunters',
  'Heavens Arena 200th Floor Clerk': 'Atendente do 200º andar da Arena Celestial',
  'Hunter Association Exorcist': 'Exorcista da Associação Hunter',
  'East Gorteau Nen-using Soldier': 'Soldado com nen de Gorteau Oriental',
  'Gun-toting Ant': 'Formiga armada',
  "Kakin's First King": 'Primeiro rei de Kakin',
  'Kakin Announcer': 'Locutor de Kakin',
  'Conditional Auction Announcer': 'Locutor do leilão condicional',
  'Nostrade Butler': 'Mordomo dos Nostrade',
  'Princess Corco': 'Princesa Corco',
  'Prince of Moony': 'Príncipe de Moony',
  'Bounty Hunter': 'Caçador de recompensas',
  'Woble (boy)': 'Woble (menino)',
  Captain: 'Capitão',
  "Ging and Mito's Grandmother": 'Avó do Ging e da Mito',
  'Sengi Guild Agent': 'Agente da Guilda Sengi',
  'Underground Clinic Nurse': 'Enfermeira da clínica clandestina',
  'Rabid Dog': 'Cão raivoso',
  Dog: 'Cão',
  Snake: 'Cobra',
  // os capangas sem nome da familia Zoldyck, numerados pelo proprio wiki
  'Assassin A': 'Assassino A', 'Assassin B': 'Assassino B', 'Assassin C': 'Assassino C',
  'Assassin D': 'Assassino D', 'Assassin E': 'Assassino E', 'Assassin F': 'Assassino F',
};

// ------------------------------------------------------------- ingestao

console.log('Listando personagens na Hunterpedia...\n');

const titles = [];
let cont = null;
for (let page = 1; ; page++) {
  const params = {
    action: 'query', list: 'embeddedin', eititle: INFOBOX,
    einamespace: '0', eilimit: '500',
  };
  if (cont) params.eicontinue = cont;
  const data = await get(`list_${page}`, params);
  titles.push(...data.query.embeddedin.map(p => p.title));
  cont = data.continue?.eicontinue;
  if (!cont) break;
}
console.log(`  ${titles.length} paginas com ficha de personagem`);

const chunk = (list, size) => Array.from(
  { length: Math.ceil(list.length / size) },
  (_, i) => list.slice(i * size, i * size + size),
);

const batches = chunk(titles, 50);

console.log('\nBaixando wikitexto e retratos...');
const wikitextByTitle = new Map();
const imageByTitle = new Map();

for (const [i, batch] of batches.entries()) {
  process.stdout.write(`\r  lote ${i + 1}/${batches.length}`);
  const joined = batch.join('|');

  const content = await get(`wikitext_${i}`, {
    action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: joined,
  });
  for (const page of Object.values(content.query?.pages ?? {})) {
    const text = page.revisions?.[0]?.slots?.main?.['*'];
    if (text) wikitextByTitle.set(page.title, text);
  }

  const images = await get(`images_${i}`, {
    action: 'query', prop: 'pageimages', pithumbsize: '400', titles: joined,
  });
  for (const page of Object.values(images.query?.pages ?? {})) {
    if (page.thumbnail?.source) imageByTitle.set(page.title, page.thumbnail.source);
  }
}
process.stdout.write('\n');

const roster = [];
for (const title of titles) {
  const wikitext = wikitextByTitle.get(title);
  if (!wikitext) continue;
  const box = sliceTemplate(wikitext, INFOBOX);
  if (!box) continue;
  const fields = templateParams(box);

  const wikiName = unwiki(fields.name) || title;
  const name = NAME_PT[wikiName] ?? wikiName;
  // metade das fichas so preenche "previous affiliation" (o Meruem, por
  // exemplo), entao as duas entram na mesma lista
  const affiliations = affiliationsOf([fields.affiliation, fields['previous affiliation']]
    .filter(Boolean).join('<br />'));
  const sprite = imageByTitle.get(title) ?? null;

  const item = {
    id: roster.length + 1,
    name,
    group: groupOf(affiliations, fields.occupation),
    gender: genderOf(fields.gender),
    // ficha sem o campo `type` e de quem nunca foi mostrado usando nen; quem
    // usa mas nunca revelou o tipo tem o campo escrito "Unknown", e o nenOf
    // devolve isso. Sao respostas diferentes, e as duas contam como dica
    nen: nenOf(fields.type) ?? 'None',
    status: statusOf(fields.status),
    affiliation: affiliations.length ? affiliations : ['None'],
    job: jobOf(fields.occupation),
    hair: hairOf(fields.hair) ?? 'Unknown',
    debutChapter: chapterOf(fields['manga debut']),
    inAnime: inAnimeOf(fields['anime debut']),
    // aqui a "epoca" e a midia: 0 = chegou ao anime, 1 = so existe no mangá
    era: inAnimeOf(fields['anime debut']) ? 0 : 1,
    sprite,
    artwork: sprite,
  };

  // paginas de grupo tambem transcluem a ficha; sem genero nem estado nao e gente
  if (!item.gender && !item.status) continue;

  const alias = bare(lines(fields['also known as'])[0] ?? '');
  const aliases = [...new Set([title, wikiName, alias].filter(a => a && a !== name))];
  if (aliases.length) item.aliases = aliases;

  // sem retrato a linha de dica fica vazia; sem estreia nao da para comparar.
  // Nen e afiliacao agora tem valor ate quando a ficha nao diz, entao o teste
  // e por conteudo: quem nao tem nem um nem outro e figurante
  item.eligible = Boolean(
    item.sprite && item.gender && item.status && item.debutChapter != null &&
    (item.nen !== 'None' || item.affiliation[0] !== 'None'),
  );
  roster.push(item);
}

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('retrato', c => c.sprite);
coverage('genero', c => c.gender);
coverage('nen', c => c.nen);
coverage('estado', c => c.status);
coverage('afiliacao', c => c.affiliation.length);
coverage('ocupacao', c => c.job);
coverage('cabelo', c => c.hair);
coverage('estreia', c => c.debutChapter != null);
coverage('no anime', c => c.inAnime);
coverage('sorteavel', c => c.eligible);
console.log(`  ${'so do anime'.padEnd(14)} ${String(roster.filter(c => c.eligible && c.inAnime).length).padStart(4)}/${roster.filter(c => c.eligible).length}  dos sorteaveis`);

const porGrupo = {};
for (const c of roster) if (c.eligible) porGrupo[c.group] = (porGrupo[c.group] ?? 0) + 1;
console.log('\nSorteaveis por grupo:', JSON.stringify(porGrupo));

const nens = {};
for (const c of roster) if (c.nen) nens[c.nen] = (nens[c.nen] ?? 0) + 1;
console.log('Tipos de nen:', JSON.stringify(nens));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/hxh.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
