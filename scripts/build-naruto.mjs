/**
 * Baixa a Dattebayo API e gera data/naruto.json.
 *   npm run build:naruto
 *
 * A base publica e https://dattebayo-api.onrender.com (o dominio .vercel.app
 * serve so a documentacao). Sao 1431 personagens em paginas de 100 — e a
 * maioria esmagadora e figurante de um episodio so. Quem chuta "Kajika" nao
 * aprende nada sobre o segredo e ainda perde o turno, entao o dataset gravado
 * so tem quem da para reconhecer: personagem de mangao com peso na Narutopedia
 * (veja NOTORIEDADE) e retrato que carrega.
 *
 * Alem do elenco, o build resolve tres coisas que a API nao entrega prontas:
 *   - tipo de jutsu, lendo a classificacao de cada tecnica na Narutopedia;
 *   - arco de estreia, cruzando o capitulo com a tabela de shared/universes.js;
 *   - ate onde o jogador precisa ter assistido (Classico, Shippuden, Boruto).
 *
 * Os retratos que a API indica envelhecem: a Narutopedia renomeia e apaga
 * arquivos e a API segue servindo o link antigo. Por isso, antes de escrever o
 * dataset, cada imagem e conferida e as mortas dao lugar ao retrato atual da
 * propria wiki.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NARUTO_ARCS, NARUTO_NATURE_ICONS } from '../shared/universes.js';

const API = 'https://dattebayo-api.onrender.com';
const WIKI = 'https://naruto.fandom.com/api.php';
const UA = { 'User-Agent': 'palpite-build/1.0 (+https://github.com/PedroVikk)' };
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'naruto.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'naruto');
const PAGE_SIZE = 100;

/**
 * Quantas paginas da Narutopedia precisam apontar para o personagem para ele
 * valer como chute. O corte separa bem: o Zabuza tem 164 links, o Gatō 59, o
 * Inari 49 — e o figurante que ninguem lembra vive na casa dos 10 a 20
 * (a mediana do elenco inteiro e 11). Abaixo de 40 sobrava so quem o jogador
 * nunca viu; acima de 40 comecam a sumir nomes de verdade.
 */
const NOTORIEDADE = 40;

/** Nome do arquivo na Narutopedia -> nome com que ele fica em data/icons/. */
const NATURE_ICONS = new Map(Object.values(NARUTO_NATURE_ICONS)
  .map(icon => [icon.wiki, path.basename(icon.src, '.svg')]));

await fs.mkdir(CACHE_DIR, { recursive: true });

// ------------------------------------------------------------ rede

/** Fila unica consumida por N workers, com o veredito guardado em cache. */
async function emParalelo(itens, trabalho, largura = 8) {
  let cursor = 0;
  let feitas = 0;
  const worker = async () => {
    while (cursor < itens.length) {
      await trabalho(itens[cursor++]);
      if (++feitas % 50 === 0) process.stdout.write(`\r  ${feitas}/${itens.length}`);
    }
  };
  await Promise.all(Array.from({ length: largura }, worker));
  if (itens.length) process.stdout.write(`\r  ${feitas}/${itens.length}\n`);
}

/** Cache em disco de um mapa nome -> valor; so o que falta vai para a rede. */
async function comCache(arquivo, chaves, buscar, largura = 8) {
  const file = path.join(CACHE_DIR, arquivo);
  let mapa = {};
  try {
    mapa = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}

  const faltando = chaves.filter(chave => mapa[chave] === undefined);
  if (!faltando.length) return mapa;

  await buscar(faltando, mapa, largura);
  await fs.writeFile(file, JSON.stringify(mapa));
  return mapa;
}

async function getPage(page) {
  const file = path.join(CACHE_DIR, `page_${page}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/characters?limit=${PAGE_SIZE}&page=${page}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      await fs.writeFile(file, JSON.stringify(json));
      return json;
    } catch (err) {
      if (attempt === 4) throw new Error(`pagina ${page}: ${err.message}`);
      await new Promise(r => setTimeout(r, 600 * attempt * attempt));
    }
  }
}

/** Uma consulta ao MediaWiki, com o par (titulos -> resposta) guardado no cache. */
async function consultaWiki(params, lote) {
  const joined = lote.join('|');
  const slug = createHash('sha1').update(`${params.prop}:${joined}`).digest('hex').slice(0, 12);
  const file = path.join(CACHE_DIR, `wiki_${slug}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}

  const query = new URLSearchParams({ action: 'query', titles: joined, redirects: '1', format: 'json', ...params });
  const res = await fetch(`${WIKI}?${query}`, { headers: UA });
  if (!res.ok) throw new Error(`Narutopedia: HTTP ${res.status}`);
  const json = await res.json();
  await fs.writeFile(file, JSON.stringify(json));
  return json;
}

/**
 * O MediaWiki normaliza o titulo e segue redirecionamento, entao a resposta
 * volta com o nome final da pagina. Este mapa desfaz os dois saltos, para
 * casar de volta com o nome que entrou.
 */
function desfazerSaltos(json) {
  const daNormalizacao = new Map((json.query?.normalized ?? []).map(n => [n.to, n.from]));
  const doRedirect = new Map((json.query?.redirects ?? []).map(r => [r.to, r.from]));
  return (titulo) => {
    const antes = doRedirect.get(titulo) ?? titulo;
    return daNormalizacao.get(antes) ?? antes;
  };
}

// ------------------------------------------------------------ notoriedade

/**
 * Quantas paginas da wiki linkam para o personagem. E o melhor sinal barato de
 * "alguem lembra dele": um protagonista e citado em centenas de paginas, o
 * figurante do episodio filler so na propria e na lista do arco.
 */
const contarLinks = (nomes) => comCache('backlinks.json', nomes, (faltando, mapa) =>
  emParalelo(faltando, async (nome) => {
    const params = new URLSearchParams({
      action: 'query', prop: 'linkshere', titles: nome, redirects: '1',
      lhnamespace: '0', lhshow: '!redirect', lhlimit: '500', format: 'json',
    });
    try {
      const res = await fetch(`${WIKI}?${params}`, { headers: UA, signal: AbortSignal.timeout(20_000) });
      const json = await res.json();
      const page = Object.values(json.query?.pages ?? {})[0];
      // 500 e o teto do MediaWiki; com `continue` ha mais, e ai o numero exato
      // nao importa — ja passou de qualquer corte
      mapa[nome] = (page?.linkshere ?? []).length + (json.continue ? 500 : 0);
    } catch {
      mapa[nome] = 0;
    }
  }));

/**
 * Confere por HEAD se cada retrato ainda existe. Nao da para adivinhar quais
 * apodreceram sem perguntar, entao vao todos — mas o veredito fica no cache e
 * so as URLs novas sao checadas na proxima vez.
 */
const checarImagens = (urls) => comCache('imagens_vivas.json', urls, (faltando, mapa) =>
  emParalelo(faltando, async (url) => {
    try {
      const res = await fetch(url, { method: 'HEAD', headers: UA, signal: AbortSignal.timeout(15_000) });
      mapa[url] = res.ok;
    } catch {
      mapa[url] = false;
    }
  }));

/**
 * Os simbolos de chakra (o 火 do fogo, o 水 da agua) que a coluna de natureza
 * mostra no lugar do nome. Sao 23 SVGs de poucos KB, entao ficam no repositorio
 * como o resto do schema — nao sao miniatura de item, e por isso nao passam
 * pelo espelho de data/sprites/.
 */
async function baixarIconesDeNatureza() {
  const dir = path.join(ROOT, 'data', 'icons', 'naruto');
  await fs.mkdir(dir, { recursive: true });
  const existentes = new Set(await fs.readdir(dir));

  const faltando = [...NATURE_ICONS].filter(([, slug]) => !existentes.has(`${slug}.svg`));
  if (!faltando.length) return console.log(`  ${NATURE_ICONS.size} ja no disco`);

  const titulos = faltando.map(([nome]) => `File:Nature Icon ${nome}.svg`);
  const json = await consultaWiki({ prop: 'imageinfo', iiprop: 'url' }, titulos);
  const urlPorTitulo = new Map(
    Object.values(json.query?.pages ?? {})
      .filter(page => page.imageinfo?.[0]?.url)
      .map(page => [page.title, page.imageinfo[0].url]),
  );

  let baixados = 0;
  for (const [nome, slug] of faltando) {
    const url = urlPorTitulo.get(`File:Nature Icon ${nome}.svg`);
    if (!url) {
      console.log(`  sem icone para ${nome}`);
      continue;
    }
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`icone ${nome}: HTTP ${res.status}`);
    await fs.writeFile(path.join(dir, `${slug}.svg`), Buffer.from(await res.arrayBuffer()));
    baixados++;
  }
  console.log(`  ${baixados} baixados, ${NATURE_ICONS.size - faltando.length} ja no disco`);
}

/** Retrato atual de cada pagina da Narutopedia (prop=pageimages). */
async function retratosDaWiki(nomes) {
  const retratos = new Map();
  for (let i = 0; i < nomes.length; i += 50) {
    process.stdout.write(`\r  ${i}/${nomes.length}`);
    const json = await consultaWiki({ prop: 'pageimages', pithumbsize: '400' }, nomes.slice(i, i + 50));
    const original = desfazerSaltos(json);
    for (const page of Object.values(json.query?.pages ?? {})) {
      if (page.thumbnail?.source) retratos.set(original(page.title), page.thumbnail.source);
    }
  }
  process.stdout.write(`\r  ${nomes.length}/${nomes.length}\n`);
  return retratos;
}

// ------------------------------------------------------------ tipos de jutsu

/**
 * A API lista o nome das tecnicas, nao o tipo delas. O tipo mora no infobox da
 * pagina do jutsu, no campo `jutsu classification` — entao o build le o
 * wikitexto de cada tecnica uma vez e guarda o resultado no cache.
 */
async function classificarJutsu(nomes) {
  return comCache('jutsu_classes.json', nomes, async (faltando, mapa) => {
    for (let i = 0; i < faltando.length; i += 50) {
      process.stdout.write(`\r  ${i}/${faltando.length}`);
      const lote = faltando.slice(i, i + 50);
      const json = await consultaWiki({ prop: 'revisions', rvprop: 'content', rvslots: 'main' }, lote);
      const original = desfazerSaltos(json);
      for (const page of Object.values(json.query?.pages ?? {})) {
        const texto = page.revisions?.[0]?.slots?.main['*'] ?? '';
        const campo = texto.match(/\|\s*jutsu classification\s*=([^|\n]*)/i);
        mapa[original(page.title)] = campo
          ? campo[1].split(',').map(s => s.replace(/[[\]']/g, '').trim()).filter(Boolean)
          : [];
      }
      // tecnica sem pagina (a API cita algumas que a wiki nao tem) nao volta na
      // resposta; marcar como vazio evita pedir de novo no proximo build
      for (const nome of lote) if (mapa[nome] === undefined) mapa[nome] = [];
    }
    process.stdout.write(`\r  ${faltando.length}/${faltando.length}\n`);
  });
}

/**
 * Da classificacao crua da wiki para os tipos que valem como dica.
 *
 * O vocabulario da Narutopedia tem dezenas de rotulos, e usar todos enchia a
 * celula ("Kenjutsu, Ninjutsu, Dōjutsu +6" para o Sasuke) sem dizer mais nada:
 * quem assistiu responde ninjutsu, taijutsu, genjutsu, espada ou medicina, e
 * so. Entao variacao de ninjutsu volta a ser ninjutsu e o resto (fūinjutsu,
 * senjutsu, kinjutsu, dōjutsu, "Chakra Flow", "Hiden~Nara Clan") nao entra —
 * dōjutsu ja e a coluna de kekkei genkai.
 *
 * "Bukijutsu" e "Shurikenjutsu" tambem ficaram de fora: como todo ninja atira
 * kunai, eles davam kenjutsu para o Gaara e para a Sakura. Kenjutsu aqui e
 * espada mesmo, e sao 20 personagens — uma dica que separa.
 */
const TIPOS_DE_JUTSU = new Map([
  ['Ninjutsu', 'Ninjutsu'],
  ['Cooperation Ninjutsu', 'Ninjutsu'],
  ['Barrier Ninjutsu', 'Ninjutsu'],
  ['Space–Time Ninjutsu', 'Ninjutsu'],
  ['Reincarnation Ninjutsu', 'Ninjutsu'],
  ['Medical Ninjutsu', 'Medical Ninjutsu'],
  ['Taijutsu', 'Taijutsu'],
  ['Genjutsu', 'Genjutsu'],
  ['Kenjutsu', 'Kenjutsu'],
]);

/**
 * Filiacao que o jogador guarda: vila, organizacao. A ficha da Narutopedia
 * mistura nisso o pais, o time de invocacao e a coalizao da guerra — e as
 * "Forças Aliadas Shinobi", que metade do elenco tem, so faziam a celula
 * fechar amarelo sem separar ninguem.
 */
const AFILIACOES = new Set([
  'Konohagakure', 'Sunagakure', 'Kirigakure', 'Iwagakure', 'Kumogakure',
  'Otogakure', 'Amegakure', 'Takigakure', 'Kusagakure', 'Yugakure',
  'Uzushiogakure', 'Hoshigakure', 'Akatsuki', 'Kara', 'Root', 'Anbu', 'Taka',
]);

/**
 * Mangekyō e Mangekyō Eterno sao o mesmo Sharingan mais adiante, e a ficha
 * lista os tres: sem juntar, a celula do Sasuke virava uma lista de quatro.
 */
/**
 * Ordem fixa das duas listas, para a celula ler sempre igual: ninjutsu antes de
 * taijutsu, fogo antes de agua. Sem isto a ordem seria a das tecnicas na ficha,
 * que muda de personagem para personagem — e como a celula corta em tres, o
 * corte cairia num tipo diferente em cada linha.
 */
const ordenarPor = (ordem) => {
  const peso = new Map(ordem.map((valor, i) => [valor, i]));
  return (a, b) => (peso.get(a) ?? ordem.length) - (peso.get(b) ?? ordem.length);
};
const porTipoDeJutsu = ordenarPor(['Ninjutsu', 'Taijutsu', 'Genjutsu', 'Kenjutsu', 'Medical Ninjutsu']);
const porNatureza = ordenarPor(Object.keys(NARUTO_NATURE_ICONS));

const DOJUTSU_RAIZ = new Map([
  ['Mangekyō Sharingan', 'Sharingan'],
  ['Eternal Mangekyō Sharingan', 'Sharingan'],
]);

// ------------------------------------------------------------ parsing

/** Remove notas como "(Anime only)" / "(Affinity)" e espacos duplicados. */
const tidy = (text) => String(text ?? '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

/**
 * A ficha da wiki as vezes vaza HTML ou o aviso de validacao do proprio
 * MediaWiki para dentro de um campo de lista (o tipo de chakra do Ido veio como
 * uma tag <img>). Nada disso e resposta: valor com marcacao ou tamanho de
 * frase nao e nome de nada e cai fora.
 */
const ehValor = (text) => text.length > 0 && text.length <= 48 && !/[<>"]/.test(text);

const asList = (value) => {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  return [...new Set(list.map(tidy).filter(ehValor))];
};

const clean = (value) => {
  const text = tidy(value);
  return text && !/^(unknown|n\/a|none)$/i.test(text) ? text : null;
};

/**
 * Campo em branco na Narutopedia nao e falta de dado, e a resposta: a ficha so
 * lista natureza, atributo ou kekkei genkai quando o personagem tem. Sem um
 * valor explicito a celula ficaria cinza de "sem dado" para dois tercos do
 * elenco — e duas pessoas sem kekkei genkai nunca fechariam verde entre si.
 */
const orElse = (list, fallback) => (list.length ? list : [fallback]);

/**
 * "Naruto Chapter #239" -> { serie: 'naruto', cap: 239 }. O Gaiden numera
 * "700+1" a "700+10", que a tabela de arcos le como 701 em diante. Estreia que
 * nao e no mangao de Naruto nem no de Boruto (databook, novel, so anime) volta
 * null: sem capitulo nao ha arco nem era, e sem os dois o personagem nao entra.
 */
function estreiaNoManga(text) {
  const match = String(text ?? '').match(/^(Naruto|Boruto)\s+Chapter\s*#?\s*(\d+)(?:\s*\+\s*(\d+))?/i);
  if (!match) return null;
  const extra = match[3] ? Number(match[3]) : 0;
  return { serie: match[1].toLowerCase(), cap: Number(match[2]) + extra };
}

/** Ultimo arco que ja tinha comecado no capitulo de estreia. */
function arcoDe(estreia) {
  const daSerie = NARUTO_ARCS
    .map((arc, index) => ({ ...arc, index }))
    .filter(arc => arc.serie === estreia.serie && arc.start <= estreia.cap);
  return daSerie.length ? daSerie[daSerie.length - 1] : null;
}

const VILLAGES = [
  ['konoha', 'Konohagakure'], ['suna', 'Sunagakure'], ['kiri', 'Kirigakure'],
  ['iwa', 'Iwagakure'], ['kumo', 'Kumogakure'], ['oto', 'Otogakure'],
];

/** Vila principal (grupo da sala): vila oculta > Akatsuki > outros. */
function groupOf(affiliation) {
  for (const [id, name] of VILLAGES) if (affiliation.includes(name)) return id;
  if (affiliation.includes('Akatsuki')) return 'akatsuki';
  return 'outros';
}

// ------------------------------------------------------------ execucao

console.log('Baixando personagens da Dattebayo API...');
console.log('Respostas ficam em .cache/naruto/, entao rodar de novo e instantaneo.\n');

const first = await getPage(1);
const totalPages = Math.ceil(first.total / PAGE_SIZE);
const raw = [...first.characters];

for (let page = 2; page <= totalPages; page++) {
  process.stdout.write(`\r  pagina ${page}/${totalPages}`);
  const json = await getPage(page);
  raw.push(...(json.characters ?? []));
}
process.stdout.write('\n');

// ------------------------------------------------------- quem entra no jogo

// o nome sai como veio da API porque ele e o titulo da pagina na Narutopedia —
// e e o parenteses que separa os quatro Raikage chamados "A"
const nomeDe = (c) => String(c.name ?? '').replace(/\s+/g, ' ').trim();

console.log('\nPesando cada personagem pelos links da Narutopedia...');
const links = await contarLinks([...new Set(raw.map(nomeDe))]);

const candidatos = raw.filter(c => estreiaNoManga(c.debut?.manga) && (links[nomeDe(c)] ?? 0) >= NOTORIEDADE);
console.log(`  ${candidatos.length} passam de ${NOTORIEDADE} links, de ${raw.length} no total`);

console.log('\nLendo a classificação das técnicas na Narutopedia...');
const tecnicas = [...new Set(candidatos.flatMap(c => (c.jutsu ?? []).map(tidy)))]
  .filter(nome => ehValor(nome) && !nome.includes('|'));
const classes = await classificarJutsu(tecnicas);

const roster = candidatos.map((c) => {
  const personal = c.personal ?? {};
  const affiliation = asList(personal.affiliation);
  const estreia = estreiaNoManga(c.debut.manga);
  const arco = arcoDe(estreia);

  const tipos = new Set();
  for (const jutsu of c.jutsu ?? []) {
    for (const classe of classes[tidy(jutsu)] ?? []) {
      const tipo = TIPOS_DE_JUTSU.get(classe);
      if (tipo) tipos.add(tipo);
    }
  }

  return {
    id: c.id,
    name: nomeDe(c),
    group: groupOf(affiliation),
    // a ficha de quem muda de forma vem com o icone junto:
    // "File:Gender Various.svg Various". Besta com cauda nao tem sexo na ficha,
    // e isso e a resposta: "sem gênero", nao "nao sabemos"
    gender: clean(String(personal.sex ?? '').replace(/^File:.*?\.(?:svg|png|jpg)\s*/i, '')) ?? 'None',
    affiliation: orElse(affiliation.filter(a => AFILIACOES.has(a)), 'Sem filiação'),
    jutsuTypes: orElse([...tipos].sort(porTipoDeJutsu), 'Nenhum'),
    // kekkei mōra e kekkei tōta sao o mesmo tipo de heranca, so que mais raros
    kekkeiGenkai: orElse(
      [...new Set(asList([personal.kekkeiGenkai, personal.kekkeiMōra, personal.kekkeiTōta].flat())
        .map(kg => DOJUTSU_RAIZ.get(kg) ?? kg))],
      'Não tem',
    ),
    natureType: orElse(asList(c.natureType).sort(porNatureza), 'Nenhum'),
    classification: orElse(asList(personal.classification), 'Nenhum'),
    debutArc: arco?.index ?? null,
    // recorte cumulativo: quem viu Shippūden viu o Clássico antes
    inClassic: arco?.era === 'classico',
    inShippuden: arco?.era === 'classico' || arco?.era === 'shippuden',
    sprite: c.images?.[0] ?? null,
    artwork: c.images?.[0] ?? null,
  };
});

// ------------------------------------------------------- conserto de imagens

console.log('\nBaixando os símbolos de chakra da Narutopedia...');
await baixarIconesDeNatureza();

console.log('\nConferindo os retratos indicados pela API...');
const veredito = await checarImagens([...new Set(roster.map(c => c.sprite).filter(Boolean))]);

// link morto e ficha sem imagem nenhuma (a do Kurama e a da Chiyo) tem a mesma
// saida: perguntar o retrato atual para a Narutopedia
const quebrados = roster.filter(c => !c.sprite || !veredito[c.sprite]);
console.log(`  ${quebrados.length} sem retrato que carregue`);

if (quebrados.length) {
  console.log('Procurando o retrato atual na Narutopedia...');
  const retratos = await retratosDaWiki([...new Set(quebrados.map(c => c.name))]);
  let repostos = 0;
  for (const item of quebrados) {
    // sem retrato na wiki o campo fica null: melhor sem imagem do que com uma
    // que o navegador nao consegue carregar
    const atual = retratos.get(item.name) ?? null;
    item.sprite = atual;
    item.artwork = atual;
    if (atual) repostos++;
  }
  console.log(`  ${repostos} repostos, ${quebrados.length - repostos} ficaram sem imagem`);
}

// ------------------------------------------------------------ gravacao

// sem retrato o segredo revelado fica um retangulo vazio, entao quem ficou sem
// imagem sai. Vem depois do conserto porque a wiki repoe boa parte deles.
for (const item of roster) item.eligible = Boolean(item.sprite && item.debutArc != null);

const jogaveis = roster.filter(item => item.eligible);
const perdidos = roster.length - jogaveis.length;

const total = jogaveis.length;
const coverage = (label, predicate) => {
  const n = jogaveis.filter(predicate).length;
  console.log(`  ${label.padEnd(18)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} jogáveis, ${perdidos} descartados por falta de retrato):`);
coverage('gênero', c => c.gender !== 'None');
coverage('filiação', c => c.affiliation[0] !== 'Sem filiação');
coverage('tipo de jutsu', c => c.jutsuTypes[0] !== 'Nenhum');
coverage('kekkei genkai', c => c.kekkeiGenkai[0] !== 'Não tem');
coverage('natureza', c => c.natureType[0] !== 'Nenhum');
coverage('atributos', c => c.classification[0] !== 'Nenhum');

const conta = (chave, lista) => {
  const tally = {};
  for (const c of jogaveis) tally[chave(c)] = (tally[chave(c)] ?? 0) + 1;
  console.log(`\n${lista}:`, JSON.stringify(tally));
};
conta(c => c.group, 'Por vila');
conta(c => (c.inClassic ? 'clássico' : c.inShippuden ? 'shippūden' : 'boruto'), 'Por era');

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(jogaveis));
console.log(`\nPronto: ${total} personagens -> data/naruto.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
