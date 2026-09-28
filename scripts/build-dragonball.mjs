/**
 * Monta data/dragonball.json a partir da Dragon Ball Wiki.
 *   npm run build:dragonball
 * Fonte: dragonball.fandom.com, pela API do MediaWiki (aberta, sem chave).
 *
 * Antes o universo vinha da dragonball-api.com, e ela nao dava conta: 58
 * personagens (sem Goten, Videl, Nappa, Cooler, Hit, Goku Black), e colunas que
 * ninguem sabe de cabeca — o "ki" em ordem de grandeza de numeros inventados, a
 * contagem de transformacoes da propria API. O wiki tem a ficha de 2322
 * personagens; o trabalho aqui e mais cortar do que juntar.
 *
 * **O corte e por aparicao, nao por existencia.** Das 2322 fichas, 766 sao das
 * series (DB, Z, GT, Super); o resto e jogo, Heroes, dublador e figurante de
 * Dr. Slump. Mesmo entre as 766, a maioria e o figurante de um episodio — foi
 * o que estragou o Hunter x Hunter. Duas reguas separam quem a sala conhece:
 *  - em quantos episodios e capitulos o personagem e citado (as paginas de
 *    episodio linkam quem aparece nelas). Goku 1563, Kuririn 1000, Freeza 403;
 *    a Gine 10 e o Senbei 8. Os links de pagina de personagem nao servem: as
 *    caixas de navegacao ligam o elenco inteiro em todas, e todo mundo bate 500;
 *  - em quantos wikis de outros idiomas ele tem pagina. E ela que salva os
 *    viloes de filme, que quase nao aparecem em episodio: o Janemba tem 11
 *    aparicoes e pagina em 8 idiomas, o Cooler 37 e 12.
 * O mesmo interwiki da o nome da dublagem brasileira, pelo wiki pt-br: Kuririn,
 * Chaos, Bills, Rei Cutelo, Tullece, Coola, Oob.
 *
 * As colunas sao as que a sala responde sem abrir o wiki: raca, genero, lado
 * (aliado, vilao, ex-vilao), se voa e a saga em que estreou. Afiliacao ficou de
 * fora porque as categorias do wiki somam jogo e manga paralelo: punham o Whis
 * no Exercito do Freeza e a Bulma na Gangue do Pilaf.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const WIKI = 'https://dragonball.fandom.com/api.php';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'dragonball.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'dragonball-wiki');
const UA = 'palpite-dataset/1.0 (+https://github.com/PedroVikk)';

await fs.mkdir(CACHE_DIR, { recursive: true });

/** Nome do cache pelo conteudo do lote, nunca pela posicao (ver build-famosos). */
const loteSlug = (prefixo, ids) =>
  `${prefixo}-${createHash('sha1').update(ids.join('|')).digest('hex').slice(0, 12)}`;

async function api(nome, params) {
  const file = path.join(CACHE_DIR, `${nome}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let i = 1; i <= 5; i++) {
    try {
      const res = await fetch(`${WIKI}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`,
        { headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.writeFile(file, text);
      return JSON.parse(text);
    } catch (err) {
      if (i === 5) throw new Error(`${nome}: ${err.message}`);
      await new Promise(r => setTimeout(r, 800 * i * i));
    }
  }
}

/** Uma consulta em lotes de 50 titulos, seguindo o `continue` de cada lote. */
async function emLotes(prefixo, titulos, params, cadaPagina) {
  for (let i = 0; i < titulos.length; i += 50) {
    const lote = titulos.slice(i, i + 50);
    let cont = {}, n = 0;
    do {
      const json = await api(loteSlug(`${prefixo}${n++}`, lote), { action: 'query', titles: lote.join('|'), ...params, ...cont });
      for (const p of json.query.pages) cadaPagina(p, json);
      cont = json.continue ?? null;
    } while (cont);
    process.stdout.write(`\r  ${Math.min(i + 50, titulos.length)}/${titulos.length}`);
  }
  process.stdout.write('\n');
}

async function transcluem(template) {
  const titulos = [];
  let cont = {}, n = 0;
  do {
    const json = await api(`emb-${template.replace(/\W/g, '')}-${n++}`, {
      action: 'query', list: 'embeddedin', eititle: `Template:${template}`, einamespace: '0', eilimit: '500', ...cont,
    });
    titulos.push(...json.query.embeddedin.map(p => p.title));
    cont = json.continue ?? null;
  } while (cont);
  return titulos;
}

// -------------------------------------------------------------- wikitexto

function corpo(texto, nome) {
  const ini = texto.indexOf(`{{${nome}`);
  if (ini < 0) return null;
  let fundo = 0;
  for (let i = ini; i < texto.length; i++) {
    if (texto.startsWith('{{', i)) { fundo++; i++; continue; }
    if (texto.startsWith('}}', i)) { fundo--; i++; if (!fundo) return texto.slice(ini + 2, i - 1); }
  }
  return null;
}

/** Os parametros do infobox, quebrando no `|` so fora de [[ ]] e {{ }}. */
function parametros(bloco) {
  const t = (bloco ?? '').replace(/<ref[\s\S]*?(?:\/>|<\/ref>)/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const partes = [];
  let fundo = 0, ini = 0;
  for (let i = 0; i < t.length; i++) {
    if (t.startsWith('{{', i) || t.startsWith('[[', i)) { fundo++; i++; continue; }
    if (t.startsWith('}}', i) || t.startsWith(']]', i)) { fundo--; i++; continue; }
    if (t[i] === '|' && fundo <= 0) { partes.push(t.slice(ini, i)); ini = i + 1; }
  }
  partes.push(t.slice(ini));
  const saida = {};
  for (const p of partes.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) saida[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
  }
  return saida;
}

const limpa = (v) => (v ?? '')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/\{\{[^{}]*\}\}/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/''+/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const primeiroLink = (v) => v?.match(/\[\[([^\]|#]+)/)?.[1]?.trim() ?? null;

// -------------------------------------------------------------- tabelas

/**
 * As sagas de estreia, na ordem em que sairam. Sao blocos largos de proposito
 * — o wiki tem trinta e tantas sagas, e com elas a celula quase nunca fecharia
 * verde. O indice vira coluna numerica: a seta diz de que lado da historia
 * esta o segredo, e a saga vizinha fecha amarelo.
 *
 * A ordem e a de lancamento, nao a da cronologia interna: o GT saiu antes do
 * Super, e e assim que a sala lembra.
 */
const SAGAS = [
  { rotulo: 'Pilaf', de: [/Emperor Pilaf Saga/, /^Tournament Saga/] },
  { rotulo: 'Red Ribbon', de: [/Red Ribbon Army Saga/, /General Blue Saga/, /Commander Red Saga/, /Fortuneteller Baba Saga/] },
  { rotulo: 'Piccolo Daimaoh', de: [/Tien Shinhan Saga/, /King Piccolo Saga/, /Piccolo Jr\. Saga/] },
  { rotulo: 'Saiyajins', de: [/Raditz Saga/, /Vegeta Saga/, /Saiyan Saga/] },
  { rotulo: 'Freeza', de: [/Namek Saga/, /Captain Ginyu Saga/, /Frieza Saga/, /Garlic Jr\. Saga/] },
  { rotulo: 'Androides e Cell', de: [/(?<!Future.{0,3})Trunks Saga/, /Androids Saga/, /Cell Saga/, /Cell Games Saga/] },
  { rotulo: 'Majin Boo', de: [/Great Saiyaman Saga/, /World Tournament Saga/, /Babidi Saga/, /Majin Buu Saga/, /Fusion Saga/, /Kid Buu Saga/, /Peaceful World Saga/] },
  { rotulo: 'GT', de: [/Black Star Dragon Ball Saga/, /Baby Saga/, /Super 17 Saga/, /Shadow Dragon Saga/] },
  { rotulo: 'Deuses', de: [/God of Destruction Beerus Saga/, /Golden Frieza Saga/] },
  { rotulo: 'Universo 6', de: [/Universe 6 Saga/] },
  { rotulo: 'Trunks do Futuro', de: [/Future.{0,3}Trunks Saga/] },
  { rotulo: 'Torneio do Poder', de: [/Universe Survival Saga/] },
  { rotulo: 'Moro e Granolah', de: [/Galactic Patrol Prisoner Saga/, /Granolah the Survivor Saga/, /Super Hero Saga/] },
];

/**
 * As epocas da sala, pelo indice da saga de estreia. O GT mora no Z: so o Baby
 * passa no corte estreando la, e uma epoca de um personagem nao e epoca.
 */
const epocaDaSaga = (i) => (i <= 2 ? 0 : i <= 7 ? 1 : 2);

/**
 * Saga de uma ficha de capitulo ou episodio. Quando o capitulo cruza duas
 * sagas ("Frieza Saga, Trunks Saga", a estreia do Rei Cold), vale a mais
 * nova. As sagas do Dragon Ball Heroes (Prison Planet, Universe Creation) nao
 * estao na tabela e somem daqui: o Turles e o Bojack "estreavam" nelas.
 */
function sagaDe(texto) {
  const achadas = SAGAS.map((s, i) => (s.de.some(re => re.test(texto)) ? i : -1)).filter(i => i >= 0);
  return achadas.length ? Math.max(...achadas) : null;
}

/**
 * Filme conta pela saga que passava quando ele estreou. A ficha aponta a
 * estreia em manga e anime mesmo quando ela e uma ponta muito posterior — o
 * Cooler "estreia" no GT, o Gogeta na saga do Dragao Sombrio —, entao vale a
 * mais antiga das tres.
 */
const FILMES = [
  [/Curse of the Blood Rubies/, 0], [/Sleeping Princess/, 1], [/Mystical Adventure/, 2],
  [/Dead Zone/, 3], [/Tree of Might/, 3], [/Bardock/, 4], [/Lord Slug/, 4],
  [/Cooler's Revenge/, 4], [/Return of Cooler/, 5], [/Super Android 13/, 5],
  [/Broly - The Legendary/, 5], [/Bojack Unbound/, 5], [/Broly - Second Coming/, 6],
  [/Bio-Broly/, 6], [/Fusion Reborn/, 6], [/Wrath of the Dragon/, 6], [/Path to Power/, 7],
  // o especial do Trunks do Futuro vem antes do Resurrection F: o titulo dele
  // comeca igual, e punha o Goku Black e a Mai do Futuro na saga dos Deuses
  [/A Hero's Legacy/, 7], [/Battle of Gods/, 8], [/Future.{0,3}Trunks Speci/, 10], [/Resurrection.*Future/, 10],
  [/Resurrection/, 8],
  [/Super: Broly/, 12], [/Super Hero/, 12],
];
const sagaDoFilme = (titulo) => FILMES.find(([re]) => re.test(titulo ?? ''))?.[1] ?? null;

/**
 * Raca pela ficha, que mistura tudo ("1/2 Saiyan-1/2 Human-type Earthling",
 * "Ginyu's race mutant"). Vale a primeira raca escrita; mestico de Saiyajin e
 * uma raca a parte, porque e assim que a obra trata Gohan, Goten e Trunks.
 * Especie sem nome proprio (a do Dodoria, a do Hit) vira Alienigena.
 */
function racaDe(texto, cats, titulo) {
  if (/Zamasu/.test(titulo)) return 'Kaioshin';
  if (cats.has('Androids') || /Android/.test(texto)) return 'Androide';
  const t = texto ?? '';
  // mestico e quem a ficha abre com fracao ("1/2 Saiyan-1/2 Earthling"). Citar
  // Saiyan mais adiante nao basta: a raca do Ginyu lista o corpo do Goku que
  // ele roubou, e a do Goku Black o do Goku que o Zamasu tomou
  if (/Saiyan/.test(t) && /^(1\/2|1\/4|3\/4)/.test(t)) return 'Meio-Saiyajin';
  const regras = [
    // "Ginyu's race", "Dodoria's race": especie sem nome, e vem antes de tudo
    // porque a ficha do Ginyu segue listando os corpos que ele trocou
    [/^Beerus' race/, 'Raça do Bills'],
    [/^[\w.-]+'s race/, 'Alienígena'],
    [/^(Animal|Monster|Dog|Cat|Monkey|Turtle)/i, 'Animal'],
    [/^Saiyan/, 'Saiyajin'],
    [/Earthling/, 'Terráqueo'],
    [/Namek/, 'Namekuseijin'],
    [/^Majin/, 'Majin'],
    [/^Glind/, 'Kaioshin'],
    [/^Angel/, 'Anjo'],
    [/^Beerus' race/, 'Raça do Bills'],
    [/^Frieza (Clan|Race)/, 'Raça do Freeza'],
    [/^Eternal Dragon/, 'Dragão'],
    [/^(Demon|Evil)/, 'Demônio'],
    [/Tuffle/, 'Tsufuru'],
  ];
  for (const [re, raca] of regras) if (re.test(t)) return raca;
  return 'Alienígena';
}

/** O grupo que a sala liga e desliga — os mesmos ids de antes, pela raca. */
const GRUPO_DA_RACA = {
  Saiyajin: 'saiyajin', 'Meio-Saiyajin': 'saiyajin',
  'Terráqueo': 'humano', Animal: 'humano',
  Namekuseijin: 'namekuseijin',
  Androide: 'androide',
  Kaioshin: 'divino', Anjo: 'divino', 'Raça do Bills': 'divino', Deus: 'divino', 'Dragão': 'divino',
};

/**
 * Quem passa nas reguas mas nao e um personagem que a sala chuta: o grupo dos
 * assistentes do Zeno, a copia do Zeno do Futuro, o Boo Inocente (o mesmo
 * Majin Boo gordo, que ja entra como Good Buu), o Yamoshi (lenda, nunca aparece)
 * e o locutor do torneio, que nem nome tem.
 */
const FORA = new Set(["Zeno's Attendants", 'Future Zeno', 'Innocent Buu', 'Yamoshi', 'World Tournament Announcer']);

/**
 * Onde o wiki pt-br escreve a romanizacao japonesa e a dublagem consagrou
 * outro nome, vale o da dublagem. O do wiki fica de apelido.
 */
const NOME_BR = {
  Puar: 'Puar', Jeice: 'Jeice', Burter: 'Burter', Cabba: 'Cabba', Zeno: 'Zeno', 'Chi-Chi': 'Chi-Chi',
  'Good Buu': 'Majin Boo', 'Broly (DBS)': 'Broly (Super)', 'Future Mai': 'Mai do Futuro',
  'Commander Red': 'Comandante Red', 'Grand Minister': 'Grande Sacerdote',
};

/**
 * Onde a ficha nao responde, ou responde pelo que a sala nao reconhece. A
 * categoria "Former Villains" chega ao Goku e a Gine por jogo e por manga
 * paralelo; o Zeno e o Mr. Popo nao tem raca escrita.
 */
const CORRECOES = {
  Goku: { side: 'Nunca foi vilão' },
  Gine: { side: 'Nunca foi vilão' },
  Zeno: { race: 'Deus', group: 'divino' },
  'Mr. Popo': { race: 'Desconhecida' },
};

/** Apelidos que o wiki nao da e a sala usa — os da busca antiga, mais alguns. */
const APELIDOS = {
  Goku: ['Son Goku', 'Kakaroto', 'Kakarot'], Vegeta: ['Príncipe Vegeta'],
  Piccolo: ['Piccolo Jr.', 'Ma Junior'], Frieza: ['Frieza', 'Freezer'],
  Krillin: ['Krillin', 'Cririn'], 'Tien Shinhan': ['Tien', 'Ten Shin Han'],
  'Master Roshi': ['Mestre Kame', 'Muten Roshi', 'Kamesennin'], 'Mr. Satan': ['Hercule', 'Satan'],
  'Android 17': ['C-17', 'Lapis'], 'Android 18': ['C-18', 'Lazuli'], 'Android 16': ['C-16'],
  'Android 19': ['C-19'], 'Android 8': ['C-8', 'Oitão'], 'Dr. Gero': ['Android 20', 'C-20'],
  Beerus: ['Beerus', 'Birus'], Zeno: ["Zen'oh", 'Zeno Sama'], Shin: ['Supremo Senhor Kaioh', 'Kaioshin'],
  'Grand Minister': ['Daishinkan', 'Grande Sacerdote'], 'Good Buu': ['Majin Buu', 'Boo', 'Mr. Buu'],
  'Kid Buu': ['Kid Buu', 'Boo Magro'], 'Super Buu': ['Super Buu'], Vegito: ['Vegito', 'Vegetto'],
  Cooler: ['Cooler'], Turles: ['Turles'], 'Broly (DBS)': ['Broly DBS'], Uub: ['Uub'], Bulla: ['Bulla'],
  'King Kai': ['Kaioh do Norte', 'Kaio-sama'], 'Mercenary Tao': ['Tao Pai Pai'],
};

// -------------------------------------------------------------- download

console.log('Lendo quem usa a ficha de personagem...');
const titulos = await transcluem('Character Infobox');
console.log(`  ${titulos.length} paginas`);

console.log('\nBaixando fichas, categorias e interwikis...');
const paginas = new Map();
await emLotes('ficha', titulos, {
  prop: 'revisions|categories|langlinks', rvprop: 'content', rvslots: 'main', cllimit: 'max', lllimit: 'max',
}, (p) => {
  const atual = paginas.get(p.title) ?? { cats: new Set(), idiomas: new Map() };
  if (p.revisions) atual.texto = p.revisions[0].slots.main.content;
  if (p.pageid) atual.pageid = p.pageid;
  for (const c of p.categories ?? []) atual.cats.add(c.title.replace('Category:', ''));
  for (const l of p.langlinks ?? []) atual.idiomas.set(l.lang, l.title);
  paginas.set(p.title, atual);
});

const SERIES = ['DB Characters', 'DBZ Characters', 'DBGT Characters', 'DBS Characters'];
const dasSeries = [...paginas].filter(([t, p]) =>
  SERIES.some(s => p.cats.has(s)) && !/^Xeno |Future Warrior|\(.*timeline\)/.test(t));
console.log(`  ${dasSeries.length} das series`);

console.log('\nContando aparicoes em episodios e capitulos...');
const obras = [...await transcluem('EpisodeInfobox'), ...await transcluem('Chapter Infobox')];
const aparicoes = new Map();
await emLotes('elo', obras, { prop: 'links', plnamespace: '0', pllimit: 'max' }, (p) => {
  for (const l of p.links ?? []) aparicoes.set(l.title, (aparicoes.get(l.title) ?? 0) + 1);
});

/**
 * Quem a sala conhece. Qualquer uma das quatro portas:
 *  - 100+ aparicoes: o elenco fixo, mesmo o pouco traduzido (a Launch tem
 *    pagina em 2 idiomas, e 154 aparicoes);
 *  - 40+ aparicoes e 3+ idiomas: tira o cachorro Bee e o grilo Gregory;
 *  - 8+ idiomas: os viloes de filme (Cooler, Broly, Janemba, Bojack);
 *  - 25+ aparicoes e 5+ idiomas: Turles, Caulifla, Kale, Moro.
 */
const conhecido = (a, i) => a >= 100 || (a >= 40 && i >= 3) || i >= 8 || (a >= 25 && i >= 5);
const elenco = dasSeries
  .filter(([t, p]) => !FORA.has(t) && conhecido(aparicoes.get(t) ?? 0, p.idiomas.size))
  .map(([t, p]) => {
    const bruto = corpo(p.texto ?? '', 'Character Infobox') ?? '';
    return { titulo: t, ...p, bruto, ficha: parametros(bruto) };
  });
console.log(`  ${elenco.length} passam no corte`);

console.log('\nLendo a saga de cada estreia...');
const estreias = [...new Set(elenco.flatMap(c => [primeiroLink(c.ficha['manga debut']), primeiroLink(c.ficha['anime debut'])]).filter(Boolean))];
const sagaDaEstreia = new Map();
await emLotes('estreia', estreias, { prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1' }, (p, json) => {
  const texto = p.revisions?.[0]?.slots?.main?.content ?? '';
  const f = parametros(corpo(texto, 'Chapter Infobox') ?? corpo(texto, 'EpisodeInfobox'));
  const saga = sagaDe(limpa(f.saga ?? f.Saga ?? ''));
  sagaDaEstreia.set(p.title, saga);
  for (const r of json.query.redirects ?? []) if (r.to === p.title) sagaDaEstreia.set(r.from, saga);
});

console.log('\nResolvendo as imagens...');
/**
 * A imagem vem em tres formatos: um <tabber> com as abas Anime e Manga (que o
 * separador de parametros parte ao meio), uma <gallery> com uma linha por aba
 * ("Bulma anime profile.png|Anime"), ou o nome do arquivo cru. Nos dois
 * primeiros, a primeira aba e a do anime, e e ela que vale.
 */
function arquivoDe(c) {
  const bloco = c.bruto.slice(c.bruto.search(/\|\s*image\s*=/));
  const galeria = bloco.match(/^\s*\|\s*image\s*=\s*<gallery>\s*\n\s*([^|\n]+?\.(?:png|jpe?g|gif|webp))/i)?.[1];
  const tabber = bloco.match(/\[\[File:([^\]|]+)/)?.[1];
  const cru = bloco.match(/^\s*\|\s*image\s*=\s*([^|<\n[]+?\.(?:png|jpe?g|gif|webp))/i)?.[1];
  // o Broly escreve "File:" dentro do proprio campo
  return (galeria ?? cru ?? tabber)?.replace(/^File:/i, '').trim() ?? null;
}
const arquivos = [...new Set(elenco.map(arquivoDe).filter(Boolean))].map(a => `File:${a}`);
const urlDe = new Map();
await emLotes('img', arquivos, { prop: 'imageinfo', iiprop: 'url', iiurlwidth: '640' }, (p, json) => {
  const info = p.imageinfo?.[0];
  if (!info) return;
  urlDe.set(p.title, info.thumburl ?? info.url);
  for (const n of json.query.normalized ?? []) if (n.to === p.title) urlDe.set(n.from, info.thumburl ?? info.url);
});

// -------------------------------------------------------------- montagem

const roster = [];
for (const c of elenco) {
  const f = c.ficha;
  const doTitulo = c.idiomas.get('pt-br')?.replace(/^.*#/, '') ?? null;
  const name = NOME_BR[c.titulo] ?? doTitulo ?? c.titulo;

  const race = racaDe(limpa(f.Race), c.cats, c.titulo);

  // os namekuseijins nao tem sexo na obra, e o wiki deixa o campo vazio; mas
  // todos sao tratados e dublados como "ele", e e assim que a sala chuta.
  // So os dragoes ficam de fora
  const generoCru = limpa(f.Gender).split(' ')[0];
  const gender = race === 'Dragão' ? 'Sem gênero'
    : generoCru === 'Female' ? 'Feminino' : 'Masculino';

  // "Nunca foi vilão" e nao "Aliado": o Jiren e o Toppo sao rivais, nao amigos
  const side = c.cats.has('Villains') ? 'Vilão' : c.cats.has('Former Villains') ? 'Ex-vilão' : 'Nunca foi vilão';
  const flies = c.cats.has('Characters who can fly') ? 'Sim' : 'Não';

  const candidatas = [
    sagaDaEstreia.get(primeiroLink(f['manga debut'])),
    sagaDaEstreia.get(primeiroLink(f['anime debut'])),
    sagaDoFilme(limpa(f['movie debut'])),
  ].filter(s => s != null);
  const debut = candidatas.length ? Math.min(...candidatas) : null;

  const arquivo = arquivoDe(c);
  const imagem = arquivo ? urlDe.get(`File:${arquivo}`) ?? null : null;

  const item = {
    id: c.pageid,
    name,
    group: GRUPO_DA_RACA[race] ?? 'outros',
    era: debut == null ? null : epocaDaSaga(debut),
    race,
    gender,
    side,
    flies,
    debut,
    sprite: imagem,
    artwork: imagem,
  };
  Object.assign(item, CORRECOES[c.titulo] ?? {});

  const apelidos = [c.titulo, doTitulo, ...(APELIDOS[c.titulo] ?? [])]
    .filter(a => a && a !== name);
  if (apelidos.length) item.aliases = [...new Set(apelidos)];
  item.eligible = Boolean(item.sprite && item.debut != null);
  roster.push(item);
}

// dois personagens com o mesmo nome confundem a busca: o de estreia mais nova
// leva a epoca junto
const vistos = new Map();
for (const item of roster.sort((a, b) => (a.debut ?? 99) - (b.debut ?? 99))) {
  if (vistos.has(item.name)) item.name = `${item.name} (${SAGAS[item.debut]?.rotulo ?? 'outro'})`;
  vistos.set(item.name, item);
}

// ------------------------------------------------------------- relatorio

const elegiveis = roster.filter(i => i.eligible);
console.log(`\n${elegiveis.length} sorteaveis de ${roster.length}`);
const semSaga = roster.filter(i => i.debut == null).map(i => i.name);
const semImagem = roster.filter(i => !i.sprite).map(i => i.name);
if (semSaga.length) console.log('  sem saga:', semSaga.join(', '));
if (semImagem.length) console.log('  sem imagem:', semImagem.join(', '));
const tally = (rotulo, pega) => {
  const c = {};
  for (const i of elegiveis) c[pega(i)] = (c[pega(i)] ?? 0) + 1;
  console.log(`${rotulo}:`, JSON.stringify(Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]))));
};
tally('Grupo', i => i.group);
tally('Epoca', i => ['classico', 'z', 'super'][i.era]);
tally('Raca', i => i.race);
tally('Genero', i => i.gender);
tally('Lado', i => i.side);
tally('Voa', i => i.flies);
tally('Saga', i => SAGAS[i.debut].rotulo);

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(elegiveis.sort((a, b) => a.id - b.id)));
console.log(`\nPronto: ${elegiveis.length} personagens -> data/dragonball.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
