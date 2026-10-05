/**
 * Monta data/cdz.json com os personagens de Os Cavaleiros do Zodiaco.
 *   npm run build:cdz
 * Fonte: o wiki pt-br da Seiyapedia (saintseiya.fandom.com/pt-br), pela API do
 * MediaWiki (aberta, sem chave).
 *
 * O wiki em ingles tem tres fichas diferentes, uma por geracao de editor; o
 * pt-br tem uma so, `{{Personagens}}`, e escreve os nomes como a dublagem os
 * consagrou: Saga de Gemeos, Mascara da Morte de Cancer, Shun de Andromeda.
 *
 * **So a serie classica.** A franquia tem The Lost Canvas, Omega, Next
 * Dimension, Saintia Sho, Alma de Ouro... e cada versao do Seiya tem pagina
 * propria, com o nome da obra entre parenteses. Fica quem e do seculo XX e
 * estreia no manga de 1986, no anime de 1986 ou nas OVAs de Hades — o campo
 * de estreia diz qual, e a outra obra escreve o proprio nome nele ("Saintia
 * Sho - Capitulo 12"). Sao 126; o figurante de um episodio entra na busca,
 * mas nao e sorteado (ver `conhecido`).
 *
 * As colunas sao as que a sala responde sem abrir o wiki: classe (ouro,
 * prata, marina, espectro...), o deus a quem serve, genero, de onde vem e a
 * saga em que estreou. Signo e constelacao ficaram de fora: a constelacao e
 * unica por personagem e nunca fecharia verde, e o signo o wiki so tem para
 * dois tercos do elenco.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const WIKI = 'https://saintseiya.fandom.com/pt-br/api.php';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'cdz.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'cdz');
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
    const json = await api(`emb-${template.replace(/[^\w]/g, '')}-${n++}`, {
      action: 'query', list: 'embeddedin', eititle: `Predefinição:${template}`, einamespace: '0', eilimit: '500', ...cont,
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

/**
 * Os parametros da ficha, quebrando no `|` so fora de [[ ]] e {{ }}. O fundo
 * tem piso: um `]]` solto deixava a conta negativa e engolia o resto da ficha
 * (foi o que truncou o Jotaro em build-jojo).
 */
function parametros(bloco) {
  const t = (bloco ?? '').replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const partes = [];
  let fundo = 0, ini = 0;
  for (let i = 0; i < t.length; i++) {
    if (t.startsWith('{{', i) || t.startsWith('[[', i)) { fundo++; i++; continue; }
    if (t.startsWith('}}', i) || t.startsWith(']]', i)) { fundo = Math.max(0, fundo - 1); i++; continue; }
    if (t[i] === '|' && fundo === 0) { partes.push(t.slice(ini, i)); ini = i + 1; }
  }
  partes.push(t.slice(ini));
  const saida = {};
  for (const p of partes.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) saida[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return saida;
}

const limpa = (v) => (v ?? '')
  .replace(/\{\{tt\|[^{}]*\}\}/gi, '')
  .replace(/\[\[(?:Arquivo|File):[^\]]*\]\]/gi, '')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/\{\{([^{}|]*)\}\}/g, '$1')
  .replace(/\{\{[^{}]*\}\}/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/''+/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// -------------------------------------------------------------- tabelas

/**
 * As fases em que um personagem pode estrear, na ordem da historia. O manga
 * numera os capitulos de 1 a 110 sem recomecar, e o anime os episodios de 1 a
 * 114 (as OVAs de Hades seguem dali, do 115). A estreia vale pela mais antiga
 * das duas: a Hilda so existe no anime, o Radamanthys estreia no manga.
 *
 * O Santuario sai partido em quatro porque e metade da obra; Hades em tres
 * pelo mesmo motivo. Asgard e so do anime.
 */
const FASES = [
  'Guerra Galáctica', 'Cavaleiros Negros', 'Cavaleiros de Prata', 'Doze Casas',
  'Asgard', 'Poseidon', 'Hades: Santuário', 'Hades: Inferno', 'Hades: Elísios',
];

/** Capitulos do manga -> fase. Os Cavaleiros de Ouro (26-28) abrem as Doze Casas. */
const faseDoCapitulo = (n) =>
  n <= 10 ? 0 : n <= 19 ? 1 : n <= 25 ? 2 : n <= 46 ? 3 : n <= 67 ? 5 : n <= 83 ? 6 : n <= 98 ? 7 : 8;

/**
 * Episodios do anime -> fase. As Forcas Ocultas (16-22, os cavaleiros sem
 * constelacao do Docrates) passam antes da Prata e contam com ela.
 */
const faseDoEpisodio = (n) =>
  n <= 8 ? 0 : n <= 15 ? 1 : n <= 35 ? 2 : n <= 73 ? 3 : n <= 99 ? 4 : n <= 114 ? 5 : n <= 127 ? 6 : n <= 139 ? 7 : 8;

/** As OVAs de Hades se escrevem "Episodio 07 Hades": a numeracao e da propria OVA. */
const faseDaOva = (n) => (n <= 13 ? 6 : n <= 25 ? 7 : 8);

/** As quatro sagas, que sao as epocas da sala. */
const SAGAS = ['santuario', 'asgard', 'poseidon', 'hades'];
const sagaDaFase = (f) => (f <= 3 ? 0 : f - 3 > 3 ? 3 : f - 3);

/** Outra obra escreve o proprio nome no campo de estreia. */
const DE_OUTRA_OBRA = /Saintia|Ep\. ?G|Episode|Lost Canvas|Next Dimension|Omega|Ω|Soul of Gold|Alma de Ouro/i;

function faseDaEstreia(manga, anime) {
  const fases = [];
  const m = limpa(manga);
  if (!DE_OUTRA_OBRA.test(m)) {
    // "Capitulo # 44" e como a ficha do Shion e a do Dohko escrevem
    const cap = m.match(/Capítulo #? ?(\d+)/);
    if (cap) fases.push(faseDoCapitulo(Number(cap[1])));
  }
  const a = String(anime ?? '');
  if (!DE_OUTRA_OBRA.test(a)) {
    const ova = a.match(/Episódio (\d+) \(?Hades/);
    const ep = a.match(/Episódio #? ?(\d+)/);
    if (ova) fases.push(faseDaOva(Number(ova[1])));
    else if (ep) fases.push(faseDoEpisodio(Number(ep[1])));
    else if (/OVA|Hades/.test(a)) fases.push(6);
  }
  return fases.length ? Math.min(...fases) : null;
}

/**
 * A classe sai das categorias, que o wiki mantem melhor que o campo `classe`
 * (o do Dohko e do Shion abre com "Cavaleiro de Bronze (ND)", a versao deles
 * em Next Dimension). A ordem decide quem tem duas: o Kanon e marina e
 * cavaleiro de ouro, e na ficha final ele e de ouro — a marina fica na epoca
 * de Poseidon (ver `POR_SAGA`).
 */
const CLASSES = [
  ['ouro', ['Cavaleiros de Ouro']],
  ['prata', ['Cavaleiros de Prata', 'Amazonas de Prata']],
  ['bronze', ['Cavaleiros de Bronze', 'Amazonas de Bronze']],
  ['negro', ['Cavaleiros Negros']],
  ['marina', ['Generais Marinas', 'Marinas de Poseidon']],
  ['guerreiro-deus', ['Guerreiros Deuses']],
  ['espectro', ['Espectros Celestes', 'Espectros Terrestres', 'Kyotos']],
  ['deus', ['Deuses Olímpicos', 'Divindades', 'Deuses']],
  ['outro', ['Cavaleiros de Aço', 'Cavaleiros Fantasmas', 'Cavaleiros sem Constelação']],
];

function classeDe(cats, campo) {
  for (const [id, lista] of CLASSES) if (lista.some(c => cats.has(c))) return id;
  const c = limpa(campo);
  if (/Espectro/.test(c)) return 'espectro';
  if (/Marina|Escama/.test(c)) return 'marina';
  if (/Guerreiro Deus/.test(c)) return 'guerreiro-deus';
  if (/Divindade|Deus/.test(c)) return 'deus';
  // os sem constelacao do Docrates, os de Aco e os fantasmas: cavaleiro, mas
  // fora das tres classes de Atena
  if (/Cavaleiro|Amazona/.test(c)) return 'outro';
  return 'sem-armadura';
}

/** O deus a quem serve, pelo primeiro escrito no campo `divindade`. */
function exercitoDe(campo, classe) {
  const t = limpa(String(campo ?? '').split(/<br\s*\/?>/i)[0]);
  if (/Atena/.test(t)) return 'atena';
  if (/Poseidon/.test(t)) return 'poseidon';
  if (/Hades/.test(t)) return 'hades';
  if (/Odin/.test(t)) return 'odin';
  return { marina: 'poseidon', espectro: 'hades', 'guerreiro-deus': 'odin' }[classe] ?? 'nenhum';
}

/**
 * De onde vem. Pais por pais quase nunca fecharia verde — sao 60 lugares
 * diferentes —, entao o pais vira regiao. Japao e Grecia ficam sozinhos
 * porque sao a casa dos protagonistas e do Santuario, e Asgard porque e como
 * o anime trata os guerreiros deuses.
 */
const REGIOES = [
  ['japao', /Japão/],
  ['grecia', /Grécia|Santuário|Milos|Canon|Chipre/],
  ['asgard', /Asgard/],
  ['europa', /Itália|França|Áustria|Finlândia|Polônia|Rússia|Sibéria|Soviética|Suécia|Espanha|Alemanha|Turíngia|Inglaterra|Fellows|Portugal|Noruega|Dinamarca|Iugoslávia|Bélgica|Turquia|Escócia/],
  ['asia', /China|Tibete|Tibet|Índia|Nepal|Sri Lanka|Arábia|Iraque|Camboja|Malásia|Laos|Israel/],
  ['africa', /Etiópia|África|Líbia|Egito|Madagascar/],
  ['americas', /Brasil|Canadá|México|Bolívia|Argentina|Cuba|São Félix/],
  ['oceania', /Zelândia|Samoa|Austrália|Rainha da Morte/],
];

function origemDe(campo) {
  const t = limpa(campo);
  if (!t) return 'nao-dita';
  return REGIOES.find(([, re]) => re.test(t))?.[0] ?? 'nao-dita';
}

/**
 * O grupo que a sala liga e desliga e o exercito. "Outros" e quem nao serve a
 * deus nenhum — os Cavaleiros Negros, a Seika, a Natassia.
 */
const GRUPO = { atena: 'atena', odin: 'asgard', poseidon: 'poseidon', hades: 'hades', nenhum: 'outros' };

/**
 * Quem passa no corte sem ser personagem que a sala chuta: o narrador da
 * serie, e o Fudo-Myo, a divindade que o Shaka invoca numa luta. A Ker, o
 * Lemur e o Deus Dragao sao de Origem e de Next Dimension, que escrevem a
 * estreia com "SS:" na frente como se fossem da classica.
 */
const FORA = new Set(['Narrador', 'Fudo-Myo', 'Deus Dragão', 'Ker', 'Lemur']);

/**
 * Pagina comprida, figurante mesmo assim: o criador dos Cavaleiros de Aco e os
 * soldados de filler. Entram na busca, mas nao sao sorteados.
 */
const NAO_SORTEIA = new Set(['Asamori Hakase', 'Faetonte', 'Ohko', 'Leda', 'Geist']);

/**
 * Quem a ficha nao data. A Shunrei tem uma das maiores paginas do wiki e
 * nenhum campo de estreia preenchido; a Euridice escreve a estreia no campo
 * do manga com o numero da OVA. O Shion "estreia" no episodio 1 porque o
 * Grande Mestre do comeco e ele no papel — so que quem esta debaixo da
 * mascara e o Saga. Ele mesmo so aparece em Hades.
 */
const ESTREIA = { Shunrei: 0, Miho: 0, 'Eurídice': 7, 'Shion de Áries': 6 };

/**
 * Pagina curta nao e sinonimo de figurante: o pai dos cavaleiros e a irma do
 * Seiya tem pagina magra e sao da historia toda.
 */
const SEMPRE = new Set(['Mitsumasa Kido', 'Seika', 'Hilda de Polaris', 'Freya', 'Eurídice', 'Miho']);

/** Onde a ficha nao responde, ou responde pelo que a sala nao reconhece. */
const CORRECOES = {
  // a Saori e Atena; o Julian Solo e o corpo de Poseidon
  'Saori Kido': { army: 'atena', classe: 'deus' },
  'Julian Solo': { army: 'poseidon', classe: 'deus' },
  'Mitsumasa Kido': { army: 'atena' },
  'Tokumaru Tatsumi': { army: 'atena' },
  'Hilda de Polaris': { army: 'odin' },
  // o Kanon e o Isaak escrevem primeiro o deus que serviam antes
  'Kanon de Gêmeos': { army: 'atena' },
  'Isaak de Kraken': { army: 'poseidon' },
  Hades: { army: 'hades' },
  // o mestre do Ikki guarda a Ilha da Rainha da Morte, mas nao e cavaleiro negro
  Guilty: { classe: 'outro' },
  'Markino de Esqueleto': { classe: 'espectro' },
  Freya: { army: 'odin' },
  Pandora: { army: 'hades' },
};

/**
 * Quem muda de lado no meio da historia. O Kanon e o General Marina do Dragao
 * Marinho em Poseidon e so veste a armadura de Gemeos em Hades: numa sala que
 * parou em Poseidon ele aparece como marina.
 */
const POR_SAGA = {
  'Kanon de Gêmeos': { poseidon: { classe: 'marina', army: 'poseidon' } },
};

/** Apelidos que a sala usa e o titulo da pagina nao traz. */
const APELIDOS = {
  'Saori Kido': ['Atena', 'Athena'],
  'Julian Solo': ['Poseidon'],
  'Saga de Gêmeos': ['Grande Mestre', 'Mestre Ares', 'Ares'],
  'Kanon de Gêmeos': ['Kanon de Dragão Marinho', 'Dragão Marinho'],
  'Máscara da Morte de Câncer': ['Death Mask', 'Deathmask'],
  'Afrodite de Peixes': ['Aphrodite'],
  'Aldebaran de Touro': ['Aldebarã'],
  'Shion de Áries': ['Grande Mestre Shion'],
  'Dohko de Libra': ['Mestre Ancião', 'Ancião'],
  'Radamanthys de Wyvern': ['Rhadamanthys'],
  'Mime de Benetnasch': ['Mime de Benetnash'],
  'Docrates': ['Dócrates'],
};

// -------------------------------------------------------------- download

console.log('Lendo quem usa a ficha de personagem...');
const titulos = await transcluem('Personagens');
console.log(`  ${titulos.length} paginas`);

console.log('\nBaixando fichas, categorias e retratos...');
const paginas = new Map();
await emLotes('ficha', titulos, {
  prop: 'revisions|categories', rvprop: 'content', rvslots: 'main', cllimit: 'max',
}, (p) => {
  const atual = paginas.get(p.title) ?? { cats: new Set() };
  if (p.revisions) atual.texto = p.revisions[0].slots.main.content;
  if (p.pageid) atual.pageid = p.pageid;
  for (const c of p.categories ?? []) atual.cats.add(c.title.replace(/^Categoria:/, ''));
  paginas.set(p.title, atual);
});

/**
 * Categorias das outras obras. O anime de Saintia Sho e o de Alma de Ouro
 * tambem tem "Episodio 2", sem o nome da obra no link; quem esta numa destas
 * so fica se o `{{Media icons}}` marcar a pagina como a da classica (`SC = #`)
 * — e o caso do Shiryu, que tambem esta em Next Dimension.
 */
const OUTRAS_OBRAS = /^(Episode G|Episode G - Assassin|Saintia Sho|Saintia Shô|Soul of Gold|Gigantomaquia|Knights of the Zodiac|Lenda do Santuário|Ω|Next Dimension|The Lost Canvas.*|A Lenda dos Defensores de Atena|Hero of Heroes|Personagens de Filmes)$/;

function daClassica(titulo, p) {
  const sc = parametros(corpo(p.texto, 'Media icons') ?? '').sc;
  if (sc === '#' || sc === titulo) return true;
  return ![...p.cats].some(c => OUTRAS_OBRAS.test(c));
}

/** A versao classica: titulo sem "(Omega)", seculo XX e estreia na serie de 1986. */
const elenco = [];
for (const [titulo, p] of paginas) {
  if (titulo.includes('(') || FORA.has(titulo) || !p.texto) continue;
  const bruto = corpo(p.texto, 'Personagens');
  if (!bruto || !daClassica(titulo, p)) continue;
  const ficha = parametros(bruto);
  const fase = ESTREIA[titulo] ?? faseDaEstreia(ficha['mangá'], ficha.anime);
  if (!(titulo in ESTREIA) && !/XX(?!I)/.test(ficha.era ?? '')) continue;
  if (fase == null) continue;
  elenco.push({ titulo, ...p, ficha, fase });
}
console.log(`  ${elenco.length} da serie classica`);

const retrato = new Map();
await emLotes('retrato', elenco.map(c => c.titulo), {
  prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '400',
}, (p) => {
  if (p.thumbnail?.source) retrato.set(p.title, p.thumbnail.source);
});

// -------------------------------------------------------------- montagem

/**
 * Quem a sala conhece. A pagina do wiki cresce com a historia do personagem:
 * o Seiya passa de 79 mil caracteres, os cavaleiros de ouro de 20 mil, e o
 * soldado do Santuario fica em 5 mil. Abaixo de 6 mil e figurante.
 */
const conhecido = (c) => SEMPRE.has(c.titulo) || (c.texto.length >= 6000 && !NAO_SORTEIA.has(c.titulo));

const roster = [];
for (const c of elenco) {
  const f = c.ficha;
  const classe = CORRECOES[c.titulo]?.classe ?? classeDe(c.cats, f.classe);
  const army = CORRECOES[c.titulo]?.army ?? exercitoDe(f.divindade, classe);
  const gender = /Feminino/.test(f.sexo ?? '') ? 'Feminino' : 'Masculino';
  const sprite = retrato.get(c.titulo) ?? null;

  const item = {
    id: c.pageid,
    name: c.titulo,
    group: GRUPO[army],
    era: sagaDaFase(c.fase),
    classe,
    army,
    gender,
    origin: origemDe(f.nascimento),
    debut: c.fase,
    sprite,
    artwork: sprite,
  };

  const porSaga = POR_SAGA[c.titulo];
  if (porSaga) item.byScope = porSaga;

  // "Seiya" acha o "Seiya de Pegaso" pelo comeco do nome; o que vem aqui e o
  // que a busca nao acharia sozinha. A ficha escreve "Milo, Miro" e "Mu de
  // Jamiel (ジャミールのムウ ...)": cada nome vira um apelido, sem o parentese, e o
  // que sobra com escrita japonesa ou parentese partido pela virgula sai
  const outros = limpa(String(f['outros nomes'] ?? '').replace(/<br\s*\/?>/gi, '|')).split(/[|,]/)
    .map(a => a.replace(/\([^)]*\)/g, ''));
  const apelidos = [...(APELIDOS[c.titulo] ?? []), ...outros]
    .map(a => a.trim())
    .filter(a => a && a !== item.name && a.length < 40 && !/[()぀-ヿ一-鿿]/.test(a));
  if (apelidos.length) item.aliases = [...new Set(apelidos)];

  item.eligible = Boolean(sprite && conhecido(c));
  roster.push(item);
}

// ------------------------------------------------------------- relatorio

const elegiveis = roster.filter(i => i.eligible);
console.log(`\n${elegiveis.length} sorteaveis de ${roster.length}`);
const semImagem = roster.filter(i => !i.sprite).map(i => i.name);
if (semImagem.length) console.log('  sem imagem:', semImagem.join(', '));
console.log('  fora do sorteio:', roster.filter(i => !i.eligible).map(i => i.name).join(', '));
const tally = (rotulo, pega) => {
  const c = {};
  for (const i of elegiveis) c[pega(i)] = (c[pega(i)] ?? 0) + 1;
  console.log(`${rotulo}:`, JSON.stringify(Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]))));
};
tally('Grupo', i => i.group);
tally('Saga', i => SAGAS[i.era]);
tally('Fase', i => FASES[i.debut]);
tally('Classe', i => i.classe);
tally('Exercito', i => i.army);
tally('Genero', i => i.gender);
tally('Origem', i => i.origin);

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster.sort((a, b) => a.id - b.id)));
console.log(`\nPronto: ${roster.length} personagens -> data/cdz.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
