/**
 * Baixa a base de super-herois e gera data/heroes.json (inclui a Marvel).
 *   npm run build:heroes
 *
 * Fonte: https://akabab.github.io/superhero-api (espelho estatico e aberto da
 * SuperHero API). O superheroapi.com exige token por usuario e a API oficial
 * da Marvel (developer.marvel.com) exige chave publica + hash privado, entao
 * este espelho e o caminho sem cadastro. Marvel e DC saem como grupos.
 *
 * A base so conhece a HQ, entao quem chegou ao cinema vem de outro lugar: os
 * wikis dos proprios filmes (veja WIKIS_DE_FILME). E o que separa as duas
 * epocas da sala — "Filmes" e "Só nos quadrinhos".
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE = 'https://akabab.github.io/superhero-api/api/all.json';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'heroes.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'heroes');
const UA = { 'User-Agent': 'palpite-build/1.0 (+https://github.com/PedroVikk)' };

await fs.mkdir(CACHE_DIR, { recursive: true });

async function getJSON() {
  const file = path.join(CACHE_DIR, 'all.json');
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(SOURCE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.writeFile(file, text);
      return JSON.parse(text);
    } catch (err) {
      if (attempt === 4) throw new Error(`all.json: ${err.message}`);
      await new Promise(r => setTimeout(r, 600 * attempt * attempt));
    }
  }
}

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text && !/^(-|null|unknown|n\/a)$/i.test(text) ? text : null;
};

/** appearance.height vem como ["5'10", "178 cm"] — queremos os cm. */
const metric = (pair, unit) => {
  const found = (Array.isArray(pair) ? pair : []).find(v => String(v).includes(unit));
  const n = Number(String(found ?? '').replace(unit, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

function publisherGroup(publisher) {
  const text = String(publisher ?? '').toLowerCase();
  if (text.includes('marvel')) return 'marvel';
  if (text.includes('dc comics')) return 'dc';
  return 'outros';
}

console.log('Baixando a base de super-herois...\n');


/**
 * Wikis dedicados as adaptacoes em imagem real. Um personagem que tem pagina
 * la e esta numa categoria de elenco de algum titulo ("Avengers: Endgame
 * Characters") apareceu na tela; quem so tem pagina, nao — esses wikis tambem
 * documentam a HQ de origem, e sem olhar a categoria a Garota-Esquilo entraria
 * como personagem de cinema.
 */
/**
 * O que os tres wikis nao pegam, conferido a mao.
 *
 * Sao dois casos. O primeiro e a franquia de fora: a base tem Star Wars, Alien,
 * Hellboy e companhia, e nenhum wiki de filme da Marvel ou da DC sabe deles. O
 * segundo e o filme antigo ou a serie que nao entrou nos tres wikis — a
 * Trilogia do Cavaleiro das Trevas, o Lanterna Verde de 2011, o Watchmen, os
 * X-Men de antes do reboot, o Arrowverse.
 *
 * Cada nome aqui foi conferido um a um; na duvida (aparicao de dois segundos,
 * so animacao, so videogame) ficou de fora.
 */
const NA_TELA_A_MAO = [
  // Star Wars, Star Trek e outras franquias que nasceram na tela
  'Boba Fett', 'Darth Maul', 'Darth Vader', 'Greedo', 'Han Solo', 'Jar Jar Binks',
  'Luke Skywalker', 'Rey', 'Stormtrooper', 'Yoda', 'Indiana Jones',
  'James T. Kirk', 'Spock', 'James Bond', 'Master Chief', 'Paul Blart', 'Sauron',
  // quadrinho de outra editora que virou filme ou serie
  'Hellboy', 'Abe Sapien', 'Spawn', 'Judge Dredd', 'Alien', 'Predator',
  'Buffy', 'T-1000', 'Mr Incredible', 'Elastigirl', 'Dash', 'Violet Parr', 'Jack-Jack',
  'Goku', 'Vegeta', 'Naruto Uzumaki', 'One Punch Man',
  // Batman de Nolan, Burton e Schumacher
  'Bane', 'Penguin', 'Two-Face', 'Scarecrow', "Ra's Al Ghul", 'Mister Freeze',
  'Nightwing', 'Robin',
  // Lanterna Verde (2011) e Watchmen (2009)
  'Hal Jordan', 'Sinestro', 'Kilowog', 'Abin Sur', 'Rorschach', 'The Comedian',
  // X-Men e o resto da Fox
  'Banshee', 'Bishop', 'Blink', 'Cable', 'Domino', 'Havok', 'Sunspot',
  'Cannonball', 'Wolfsbane', 'Warpath', 'Angel', 'Archangel', 'Legion',
  // Homem-Aranha fora do MCU
  'Kraven the Hunter', 'Rhino', 'Green Goblin II', 'Molten Man', 'Hydro-Man',
  // MCU que o wiki listou so pelo nome civil
  'Ant-Man II', 'Yellowjacket II',
  // Arrowverse, Titans, Supergirl, Stargirl
  'Supergirl', 'Green Arrow', 'Beast Boy', 'Raven', 'Starfire', 'Superboy',
  'Gorilla Grodd', 'Firestorm', 'Elongated Man', 'Professor Zoom', 'Zoom',
  'Stargirl', 'Black Lightning', 'Cheetah III', 'Krypto', 'Hawkgirl', 'Guy Gardner',
];

const WIKIS_DE_FILME = ['marvelcinematicuniverse', 'dcextendeduniverse', 'xmenmovies'];

/**
 * Categoria de elenco que NAO e da tela. Os wikis catalogam tambem a HQ, o
 * jogo e o brinquedo, e todas essas categorias terminam em "Characters".
 */
const FORA_DA_TELA = /^(Comic|Book|Novel|Video Game|Card Game|Toy|Non-Canon|Motion Comic|Prelude|Mentioned|Unseen|Cut) /i;
const deElenco = (titulo) => titulo.endsWith(' Characters') && !FORA_DA_TELA.test(titulo);

/** O MediaWiki responde com o titulo final; isto volta ao nome que entrou. */
function desfazerSaltos(json) {
  const daNormalizacao = new Map((json.query?.normalized ?? []).map(n => [n.to, n.from]));
  const doRedirect = new Map((json.query?.redirects ?? []).map(r => [r.to, r.from]));
  return (titulo) => {
    const antes = doRedirect.get(titulo) ?? titulo;
    return daNormalizacao.get(antes) ?? antes;
  };
}

/**
 * Quem apareceu em algum filme ou serie em imagem real. O veredito de cada
 * nome fica no cache: sao ~90 requests na primeira vez e zero nas seguintes.
 */
async function naTela(nomes) {
  const file = path.join(CACHE_DIR, 'na_tela.json');
  let mapa = {};
  try {
    mapa = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}

  const faltando = nomes.filter(nome => mapa[nome] === undefined);
  if (!faltando.length) return mapa;
  for (const nome of faltando) mapa[nome] = false;

  const conhecidos = new Set(nomes);
  const orfaos = NA_TELA_A_MAO.filter(nome => !conhecidos.has(nome));
  if (orfaos.length) console.log(`  a lista a mao cita ${orfaos.length} nome(s) que nao existem na base: ${orfaos.join(', ')}`);
  for (const nome of NA_TELA_A_MAO) if (conhecidos.has(nome)) mapa[nome] = true;

  for (const wiki of WIKIS_DE_FILME) {
    for (let i = 0; i < faltando.length; i += 20) {
      process.stdout.write(`\r  ${wiki}: ${i}/${faltando.length}`);
      const lote = faltando.slice(i, i + 20);
      let cont = {};
      do {
        const params = new URLSearchParams({
          action: 'query', prop: 'categories', titles: lote.join('|'),
          redirects: '1', cllimit: 'max', format: 'json', ...cont,
        });
        const res = await fetch(`https://${wiki}.fandom.com/api.php?${params}`, {
          headers: UA, signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) throw new Error(`${wiki}: HTTP ${res.status}`);
        const json = await res.json();
        const original = desfazerSaltos(json);
        for (const page of Object.values(json.query?.pages ?? {})) {
          const elenco = (page.categories ?? [])
            .some(cat => deElenco(cat.title.replace(/^Category:/, '')));
          if (elenco) mapa[original(page.title)] = true;
        }
        cont = json.continue ?? {};
      } while (Object.keys(cont).length);
    }
    process.stdout.write(`\r  ${wiki}: ${faltando.length}/${faltando.length}\n`);
  }

  await fs.writeFile(file, JSON.stringify(mapa));
  return mapa;
}

const raw = await getJSON();
console.log(`  ${raw.length} personagens`);

console.log('\nProcurando quem chegou ao cinema...');
const naTelaPor = await naTela([...new Set(raw.map(h => String(h.name).trim()))]);

const roster = raw.map((h, index) => {
  const stats = h.powerstats ?? {};
  const look = h.appearance ?? {};
  const bio = h.biography ?? {};

  const item = {
    id: index + 1,
    sourceId: h.id,
    name: h.name,
    aliases: [clean(bio.fullName)].filter(Boolean),   // busca tambem pelo nome civil
    group: publisherGroup(bio.publisher),
    publisher: clean(bio.publisher),
    alignment: clean(bio.alignment),
    gender: clean(look.gender),
    // a base marca com "-" quem nunca teve raca dita na HQ; sem um valor
    // explicito, um quarto do elenco ficava com a celula cinza de "sem dado"
    race: clean(look.race) ?? 'Unknown',
    intelligence: stats.intelligence ?? null,
    strength: stats.strength ?? null,
    speed: stats.speed ?? null,
    height: metric(look.height, 'cm'),
    // indice da epoca, na ordem do `scope` do schema: 0 = chegou a tela
    era: naTelaPor[String(h.name).trim()] ? 0 : 1,
    sprite: h.images?.sm ?? h.images?.md ?? null,
    artwork: h.images?.lg ?? h.images?.md ?? null,
  };

  item.eligible = Boolean(
    item.name && item.publisher && item.alignment && item.gender &&
    item.height != null && item.strength != null && item.sprite,
  );
  return item;
});

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('editora', c => c.publisher);
coverage('alinhamento', c => c.alignment);
coverage('genero', c => c.gender);
coverage('raca', c => c.race !== 'Unknown');
coverage('altura', c => c.height != null);
coverage('forca', c => c.strength != null);
coverage('sorteavel', c => c.eligible);

console.log(`\nNos filmes: ${roster.filter(c => c.eligible && c.era === 0).length}`
  + ` de ${roster.filter(c => c.eligible).length} sorteáveis`);

const porGrupo = {};
for (const c of roster) if (c.eligible) porGrupo[c.group] = (porGrupo[c.group] ?? 0) + 1;
console.log('\nSorteaveis por editora:', JSON.stringify(porGrupo));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/heroes.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
