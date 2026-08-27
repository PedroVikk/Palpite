/**
 * Baixa a PonyAPI e gera data/mlp.json.
 *   npm run build:mlp
 *
 * Fonte: https://ponyapi.net (aberta, sem chave).
 * O endpoint devolve 50 itens por padrao; `?limit=1000` traz os 555.
 *
 * Os campos sao raspados do fandom, entao chegam como texto livre de varias
 * linhas com referencias de episodio:
 *   sex:       "Male (according to Applejack)"
 *   residence: "Canterlot (S1E1)\nCastle of Friendship, Ponyville (seasons 5-9)"
 * Normalizamos para um vocabulario fechado. O que nao casa vira null e a
 * celula aparece como "sem dado" — melhor uma lacuna honesta que um rotulo
 * inventado, porque a coluna vira dica e dica errada estraga a partida.
 *
 * Este universo nao tem nenhuma coluna numerica: a API nao traz numero
 * nenhum, entao aqui nao ha setas ▲/▼.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const URL = 'https://ponyapi.net/v1/character/all?limit=1000';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'mlp.json');
const CACHE = path.join(ROOT, '.cache', 'mlp', 'characters.json');

async function source() {
  try {
    return JSON.parse(await fs.readFile(CACHE, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.mkdir(path.dirname(CACHE), { recursive: true });
      await fs.writeFile(CACHE, text);
      return JSON.parse(text);
    } catch (err) {
      if (attempt === 4) throw new Error(`download: ${err.message}`);
      await new Promise(r => setTimeout(r, 500 * attempt * attempt));
    }
  }
}

// ------------------------------------------------------------ normalizacao

/** Cada linha do campo, sem o parentetico de episodio. */
const linesOf = (raw) => String(raw ?? '')
  .split('\n')
  .map(line => line.replace(/\s*\([^)]*\)/g, '').trim())
  .filter(Boolean);

/**
 * "Male (according to Applejack)" -> male.
 * "Female\nMale (Rosy Thorn)"     -> null, porque a ficha cobre um grupo de
 * personagens de generos diferentes e nao ha resposta unica.
 */
function gender(raw) {
  const found = new Set(linesOf(raw).filter(line => line === 'Female' || line === 'Male'));
  return found.size === 1 ? [...found][0].toLowerCase() : null;
}

/**
 * Vocabulario de lugares. A ordem importa: "Canterlot, human world" e o
 * Canterlot do mundo humano, entao 'human world' precisa vir antes.
 */
const PLACES = [
  ['human world', 'mundo-humano'],
  ['sweet apple acres', 'ponyville'],
  ['ponyville', 'ponyville'],
  ['canterlot', 'canterlot'],
  ['crystal empire', 'crystal-empire'],
  ['manehattan', 'manehattan'],
  ['cloudsdale', 'cloudsdale'],
  ['appleloosa', 'appleloosa'],
  ['griffonstone', 'griffonstone'],
  ['dragon lands', 'dragon-lands'],
  ['seaquestria', 'seaquestria'],
  ['mount aris', 'mount-aris'],
  ['las pegasus', 'las-pegasus'],
  ['baltimare', 'baltimare'],
  ['fillydelphia', 'fillydelphia'],
  ['vanhoover', 'vanhoover'],
  ['yakyakistan', 'yakyakistan'],
  ['changeling kingdom', 'changeling-kingdom'],
  ['everfree', 'everfree'],
  ['our town', 'our-town'],
  ['rock farm', 'rock-farm'],
  ['rockville', 'rock-farm'],
  ['klugetown', 'klugetown'],
  ['dodge junction', 'dodge-junction'],
  ['somnambula', 'somnambula'],
  ['silver shoals', 'silver-shoals'],
  ['maretropolis', 'maretropolis'],
  ['sire\'s hollow', 'sires-hollow'],
];

function residence(raw) {
  const text = linesOf(raw).join(' | ').toLowerCase();
  if (!text) return null;
  return PLACES.find(([needle]) => text.includes(needle))?.[1] ?? null;
}

/**
 * 200+ ocupacoes em texto livre viram 12 categorias. A ordem resolve os
 * empates: "Fashion designer" e moda, nao comercio.
 *
 * `student` vai com limite de palavra de proposito: "School of Friendship
 * generosity teacher" e ensino, nao estudante — sem isso a Rarity, que da
 * aula la, era classificada como estudante.
 */
const JOBS = [
  [/\bstudent\b|\bpupil\b|crusader/i, 'estudante'],
  [/princess|prince |ruler|queen|king |monarch|co-ruler/i, 'realeza'],
  [/wonderbolt|shadowbolt/i, 'wonderbolts'],
  [/teacher|principal|professor|instructor|counselor|tutor|librarian/i, 'ensino'],
  [/fashion|designer|seamstress|tailor|model/i, 'moda'],
  [/doctor|nurse|veterinar|healer|dentist/i, 'saude'],
  [/writer|journalist|reporter|editor|photographer|historian|author|publisher/i, 'imprensa'],
  [/athlete|racer|player|coach|sport|derby/i, 'esporte'],
  [/guard|soldier|officer|sheriff|deputy|captain/i, 'guarda'],
  [/farmer|farm|rancher|orchard/i, 'campo'],
  [/singer|musician|dj |dancer|actor|actress|performer|artist|comedian|magician|clown/i, 'artes'],
  [/baker|chef|cook|waiter|vendor|shopkeeper|salespony|merchant|owner|clerk|barista/i, 'comercio'],
];

/**
 * Linha a linha, na ordem em que o fandom lista: a primeira que casa vence.
 * Varrer o texto inteiro de uma vez deixaria um cargo secundario ganhar do
 * principal (a Applejack e fazendeira antes de ser professora).
 */
function occupation(raw) {
  for (const line of linesOf(raw)) {
    const found = JOBS.find(([re]) => re.test(line))?.[1];
    if (found) return found;
  }
  return null;
}

/** Especie principal, do mais especifico para o mais generico. */
const KIND_ORDER = [
  ['Alicorn', 'alicornio'],
  ['Unicorn', 'unicornio'],
  ['Pegasus', 'pegaso'],
  ['Earth', 'terrestre'],
  ['Crystal', 'terrestre'],   // pony de cristal e uma variacao do terrestre
  ['Human', 'humano'],
];

function primaryKind(kinds) {
  const set = new Set(kinds);
  return KIND_ORDER.find(([kind]) => set.has(kind))?.[1] ?? 'outros';
}

/** As chaves da coluna `list` precisam ser estaveis: viram rotulo no schema. */
const slug = (kind) => String(kind).toLowerCase().replace(/[^a-z0-9]+/g, '-');

// ------------------------------------------------------------------ montagem

const { data } = await source();

const roster = data.map((character) => {
  const kinds = Array.isArray(character.kind) ? character.kind.filter(Boolean) : [];
  const image = Array.isArray(character.image) ? character.image[0] ?? null : null;

  // a wikia serve o original em 500x600; a miniatura vai para celula de 36px
  // e para a lista de sugestoes, entao pedimos o recorte pronto no servidor
  const thumb = image ? image.replace('/revision/latest', '/revision/latest/scale-to-width-down/120') : null;

  const item = {
    id: character.id,
    name: String(character.name ?? '').trim(),
    aliases: character.alias ? [String(character.alias).trim()] : [],
    group: primaryKind(kinds),
    kinds: kinds.map(slug),
    gender: gender(character.sex),
    residence: residence(character.residence),
    occupation: occupation(character.occupation),
    sprite: thumb,
    artwork: image,
  };

  // Todas as quatro colunas sao exigidas do segredo. Sao poucas: deixar uma
  // delas vazia apagaria 25% da tabela de dicas a rodada inteira. Custa pool
  // (211 -> 117), mas quem for sorteado tem ficha completa.
  item.eligible = Boolean(
    item.name && item.kinds.length && item.gender && item.residence && item.occupation,
  );
  return item;
});

// ------------------------------------------------------------------ relatorio

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(12)} ${String(n).padStart(3)}/${total}`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('especie', c => c.kinds.length);
coverage('genero', c => c.gender);
coverage('residencia', c => c.residence);
coverage('ocupacao', c => c.occupation);
coverage('imagem', c => c.sprite);
coverage('sorteavel', c => c.eligible);

const porEspecie = {};
for (const c of roster) if (c.eligible) porEspecie[c.group] = (porEspecie[c.group] ?? 0) + 1;
console.log('\nSorteaveis por especie:', JSON.stringify(porEspecie));

const especies = new Set(roster.flatMap(c => c.kinds));
console.log('Especies encontradas:', [...especies].sort().join(', '));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/mlp.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
