/**
 * Monta data/ordem.json com as criaturas paranormais de Ordem Paranormal.
 *   npm run build:ordem
 * Fonte: API do MediaWiki da Ordem Paranormal Wiki (aberta, sem chave).
 *
 * API pronta de Ordem Paranormal nao existe: os repositorios que aparecem na
 * busca sao ficha de personagem para rodar local, e o sistema de FoundryVTT
 * traz o schema mas so uma criatura de exemplo. O wiki, em compensacao, e em
 * pt-BR e ja guarda o que a coluna precisa — `elementos = Morte,Medo` sai da
 * ficha pronto para virar dica.
 *
 * Duas pegadinhas da fonte: a ficha aparece como `Infobox Monstro`,
 * `Infobox Criatura` e `Infobox_Criatura` (com underline), e a campanha vem
 * como numero dentro de {{EpLink|2|3}} e {{CampanhaLink|2}} — a ordem das
 * campanhas esta no Modulo:Episodios/dados do proprio wiki.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://ordemparanormal.fandom.com/api.php';
const INFOBOX = 'Predefinição:Infobox Criatura';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'ordem.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'ordem');

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

/** Wikitexto -> texto puro: sem refs, sem notas, sem links, sem templates. */
function unwiki(raw) {
  let text = String(raw ?? '');
  text = text.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  for (let round = 0; round < 8; round++) {
    const next = text.replace(/\{\{[^{}]*\}\}/g, '');
    if (next === text) break;
    text = next;
  }
  text = text.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1');
  text = text.replace(/<[^>]+>/g, '').replace(/'{2,}/g, '');
  return text.replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

/** Um campo do infobox costuma ser uma lista de bullets ou de <br />. */
const lines = (raw) => unwiki(String(raw ?? '').replace(/<br\s*\/?>/gi, '\n'))
  .split('\n')
  .map(line => line.replace(/^\*+/, '').trim())
  .filter(Boolean);

// -------------------------------------------------------------- campanhas

/**
 * A ordem das campanhas e a do Modulo:Episodios/dados — o numero em
 * {{CampanhaLink|4}} e o indice nessa lista. As pequenas entram na vizinha:
 * A Ordem Paranormal (3 criaturas) e a mesa que abre O Segredo na Floresta, e
 * Quarentena, Natal Macabro e A Vigilia sao especiais de uma noite so.
 */
const CAMPAIGNS = {
  1: 'osnf',    // A Ordem Paranormal
  2: 'osnf',    // O Segredo na Floresta
  3: 'opd',     // Desconjuracao
  4: 'opc',     // Calamidade
  5: 'osni',    // O Segredo na Ilha
  6: 'sdol',    // Sinais do Outro Lado
  7: 'osni',    // Quarentena
  8: 'osni',    // Natal Macabro
  9: 'hex',     // Hexatombe
  10: 'hex',    // A Vigilia
  11: 'hex',    // Apocalipse
};

/** Criatura que nenhuma campanha mostrou so existe no papel. */
const LIVROS = 'livros';

/**
 * A estreia sai de `primeira_aparição`/`única_aparição` ({{EpLink|campanha|ep}});
 * quando a ficha nao data, vale a primeira campanha em que ela aparece.
 */
function campaignOf(fields, wikitext) {
  const debut = [fields['primeira_aparição'], fields['única_aparição']]
    .filter(Boolean).join(' ')
    .match(/EpLink\s*\|\s*(\d+)/);
  if (debut) return CAMPAIGNS[Number(debut[1])] ?? LIVROS;

  const seen = [...wikitext.matchAll(/CampanhaLink\|(\d+)/g)].map(m => Number(m[1]));
  return seen.length ? (CAMPAIGNS[Math.min(...seen)] ?? LIVROS) : LIVROS;
}

/**
 * O campo `campanhas` e uma lista de secoes marcadas por emoji — o dado para as
 * mesas, o livro para os livros, a pasta para as missoes prontas. E o que
 * responde "isso eu vi na campanha ou li no Livro de Regras?".
 */
const MEDIA = [
  ['RPG', '\u{1F3B2}'],
  ['Graphic Novel', '\u{1F4DA}'],
  ['Missão pronta', '\u{1F4C2}'],
  ['Livro', '\u{1F4D6}'],
  ['Pacote', '\u{1F4F0}'],
  ['Jogo', '\u{1F3AE}'],
];

const mediaOf = (raw) => MEDIA.filter(([, emoji]) => String(raw ?? '').includes(emoji)).map(([id]) => id);

// ---------------------------------------------------------------- faccoes

/**
 * `associacao` diz "Ocultismo" em 105 das 123 fichas — e a categoria, nao a
 * dica: toda criatura paranormal e do Ocultismo. O que sobra depois dele mistura
 * organizacao com endereco (a Caverna dos Cristais, o Cemiterio das Melodias),
 * e valor que aparece uma vez so nunca fecha verde. Ficam as cinco que o
 * jogador associa a um dono; o resto vira "Outra", que tambem e resposta.
 */
const FACTIONS = [
  'Indústrias Panacea', 'Alheios', 'Santo Berço', 'Escriptas', 'Infecticídio',
];

const GENERIC_FACTIONS = /^(ocultismo|paranormal|realidade|outro lado)$/i;

function factionsOf(raw) {
  const found = lines(raw)
    .map(text => text.replace(/\s*[;,.]\s*$/, '').trim())
    .filter(text => text && !GENERIC_FACTIONS.test(text));
  if (!found.length) return ['Nenhuma'];
  const known = [...new Set(found.filter(text => FACTIONS.includes(text)))];
  return known.length ? known : ['Outra'];
}

// -------------------------------------------------------------- elementos

const ELEMENTS = ['Sangue', 'Morte', 'Conhecimento', 'Energia', 'Medo', 'Transmissão'];

/**
 * `elementos = Morte,Medo` ja vem na ordem em que o fa fala da criatura: "de
 * Morte com complemento de Medo". O primeiro e o elemento; o resto, complemento
 * — ate quatro deles, no caso da Degolificada.
 */
function elementsOf(raw) {
  const found = String(raw ?? '')
    .split(',')
    .map(part => unwiki(part).trim())
    .filter(part => ELEMENTS.includes(part));
  return [...new Set(found)];
}

// ---------------------------------------------------------------- nomes

/** O titulo carrega desambiguacao entre parenteses que o nome nao quer. */
const cleanName = (raw) => unwiki(raw).replace(/\s*\([^)]*\)\s*$/, '').trim();

// ------------------------------------------------------------- ingestao

console.log('Listando criaturas na Ordem Paranormal Wiki...\n');

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
console.log(`  ${titles.length} paginas com ficha de criatura`);

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
    action: 'query', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '400', titles: joined,
  });
  for (const page of Object.values(images.query?.pages ?? {})) {
    if (page.thumbnail?.source) imageByTitle.set(page.title, page.thumbnail.source);
  }
}
process.stdout.write('\n');

/** As grafias da ficha no wiki. A primeira que casar vale. */
const BOXES = ['Infobox Monstro', 'Infobox Criatura', 'Infobox_Monstro', 'Infobox_Criatura'];

const roster = [];
for (const title of titles) {
  const wikitext = wikitextByTitle.get(title);
  if (!wikitext) continue;
  const boxName = BOXES.find(name => wikitext.includes(`{{${name}`));
  if (!boxName) continue;
  const fields = templateParams(sliceTemplate(wikitext, boxName));

  const elements = elementsOf(fields.elementos);
  const sprite = imageByTitle.get(title) ?? null;
  const name = cleanName(fields.nome || fields['título'] || title) || title;

  const campaign = campaignOf(fields, wikitext);

  const item = {
    id: roster.length + 1,
    name,
    group: campaign,
    campaign,
    // sem elemento nenhum sao os bichos da Realidade — o javali da ilha, a
    // cobra da mina. "Nenhum" e a resposta certa para eles, nao uma lacuna
    element: elements[0] ?? 'Nenhum',
    complements: elements.length > 1 ? elements.slice(1) : ['Nenhum'],
    faction: factionsOf(fields['associação']),
    media: mediaOf(fields.campanhas),
    sprite,
    artwork: sprite,
  };

  const aliases = [...new Set([title, ...lines(fields.apelido).map(cleanName)]
    .filter(alias => alias && alias !== name && alias.length < 40))];
  if (aliases.length) item.aliases = aliases;

  // sem retrato a linha de dica fica vazia, e sem elemento a criatura e um
  // bicho comum da Realidade, que ninguem chama pelo nome
  item.eligible = Boolean(sprite && elements.length);
  roster.push(item);
}

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} criaturas):`);
coverage('retrato', c => c.sprite);
coverage('elemento', c => c.element !== 'Nenhum');
coverage('complemento', c => c.complements[0] !== 'Nenhum');
coverage('faccao', c => c.faction[0] !== 'Nenhuma');
coverage('midias', c => c.media.length);
coverage('apelido', c => c.aliases?.length);
coverage('sorteavel', c => c.eligible);

const tally = (label, pick) => {
  const counts = {};
  for (const c of roster) if (c.eligible) for (const v of [pick(c)].flat()) counts[v] = (counts[v] ?? 0) + 1;
  console.log(`${label}:`, JSON.stringify(counts));
};
console.log('');
tally('Sorteaveis por campanha', c => c.group);
tally('Elemento', c => c.element);
tally('Complementos', c => c.complements);
tally('Faccao', c => c.faction);
tally('Midias', c => c.media);

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} criaturas -> data/ordem.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
