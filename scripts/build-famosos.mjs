/**
 * Monta data/famosos.json com gente famosa de verdade, em cinco categorias.
 *   npm run build:famosos
 * Fonte: Wikidata, lida pelo espelho QLever (aberta, sem chave).
 *
 * API pronta de "famosos" nao existe. As que aparecem na busca ou cobram por um
 * elenco de mil nomes, ou entregam ficha que ninguem sabe de cabeca (patrimonio,
 * altura) — coluna morta pelo criterio da casa. A Wikidata cobre musico, ator e
 * atleta com folga; influencer e gamer sao o buraco dela, e por isso levam um
 * corte proprio (veja TETO).
 *
 * A ocupacao da Wikidata escolhe o candidato, mas quem decide a categoria e a
 * *descricao*. Ordenar por fama sem isso enche o elenco de gente famosa por
 * outra coisa: o Albert Camus e o Niels Bohr entram como atletas (os dois
 * jogaram bola), a Madre Teresa entra como musica, o Reagan e o Papa Francisco
 * como atores, o Brian May e o Jamie Oliver como influencers. A descricao e uma
 * linha escrita por gente dizendo o que a pessoa e — "filosofo e jornalista
 * franco-argelino", "Santa da Igreja Catolica", "futebolista brasileiro",
 * "jogador de League of Legends sul-coreano" — e separa os cinco na hora.
 *
 * Duas pegadinhas da fonte. O QLever devolve *zero linhas*, sem erro nenhum,
 * quando a query junta VALUES com GROUP BY — entao aqui vai uma consulta por
 * ocupacao e a juncao acontece em JS. E resolver nome -> QID por busca textual
 * erra feio ("Anitta" cai num item vazio), entao o elenco sai sempre da
 * ocupacao, nunca de uma lista de nomes escrita a mao.
 *
 * Ficaram de fora duas colunas que pareciam obvias. Cor do cabelo: 17 mil
 * pessoas no mundo tem o campo preenchido, 0,2% dos futebolistas — e o chute ja
 * aparece como retrato, entao a coluna repetiria o que a imagem diz. Seguidores:
 * o numero do Instagram do Neymar na Wikidata e de janeiro de 2022, e nenhum dos
 * gamers e influencers da amostra tem o campo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const SPARQL = 'https://qlever.dev/api/wikidata';
const API = 'https://www.wikidata.org/w/api.php';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'famosos.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'famosos');
const UA = 'palpite-dataset/1.0 (+https://github.com/PedroVikk)';

await fs.mkdir(CACHE_DIR, { recursive: true });

/** Sem acento e em minuscula: a descricao em pt vem dos dois jeitos. */
const chave = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * As cinco categorias. `occs` sao as ocupacoes que levantam o candidato;
 * `diz` sao os termos que a descricao precisa ter para confirmar.
 *
 * A ordem importa duas vezes: e a prioridade do grupo de quem acumula
 * categoria, e e a ordem em que a celula lista. Gamer vem antes de influencer
 * porque a descricao de gamer e especifica (cita o jogo ou diz esports),
 * enquanto "streamer" sozinho e canal, nao campeonato.
 */
const CATEGORIAS = [
  {
    id: 'gamer', label: 'Gamer',
    occs: ['Q4379701', 'Q50279140', 'Q57414145'],
    // "esport" sozinho nao serve: ele mora dentro de "dirigente esportivo" e de
    // "desportivo", e isso trouxe o Joseph Blatter e o Havelange para ca
    diz: ['esports', 'e-sports', 'esporte eletronico', 'esportes eletronicos',
      'electronic sport', 'cybersport', 'progamer', 'pro gamer',
      'professional gamer', 'jogador profissional de',
      'counter-strike', 'league of legends', 'dota 2', 'valorant', 'starcraft',
      'fortnite', 'free fire', 'overwatch', 'rocket league', 'call of duty',
      'pubg', 'apex legends', 'street fighter', 'tekken', 'super smash'],
  },
  {
    id: 'influencer', label: 'Influencer',
    occs: ['Q17125263', 'Q2906862', 'Q2045208'],
    diz: ['youtuber', 'influenciador', 'influenciadora', 'influencer', 'streamer',
      'tiktoker', 'blogueiro', 'blogueira', 'vlogger', 'personalidade da internet',
      'internet personality', 'media personality', 'celebridade da internet',
      'internet celebrity', 'social media'],
  },
  {
    id: 'atleta', label: 'Atleta',
    occs: ['Q937857', 'Q3665646', 'Q10833314', 'Q11338576', 'Q10843402', 'Q378622',
      'Q15117302', 'Q13141064', 'Q10871364', 'Q11774891', 'Q11513337', 'Q12299841',
      'Q19204627'],
    diz: ['futebolista', 'jogador de futebol', 'jogadora de futebol', 'atleta',
      'tenista', 'nadador', 'nadadora', 'pugilista', 'boxeador', 'ginasta',
      'velocista', 'basquetebolista', 'jogador de basquete', 'jogadora de basquete',
      'voleibolista', 'jogador de volei', 'beisebol', 'hoquei', 'ciclista',
      'golfista', 'piloto de', 'automobilismo',
      'footballer', 'football player', 'athlete', 'sportsperson', 'sportsman',
      'tennis player', 'swimmer', 'boxer', 'basketball player', 'baseball player',
      'ice hockey', 'volleyball player', 'racing driver', 'formula one',
      'sprinter', 'gymnast', 'golfer', 'cyclist'],
  },
  {
    id: 'musico', label: 'Músico',
    occs: ['Q177220', 'Q639669', 'Q2252262', 'Q753110', 'Q130857', 'Q488205'],
    diz: ['cantor', 'cantora', 'musico', 'musicista', 'rapper', 'compositor',
      'compositora', 'guitarrista', 'baterista', 'pianista', 'violonista',
      'sertanejo', 'dj ', 'singer', 'musician', 'songwriter', 'composer',
      'guitarist', 'drummer', 'pianist', 'bassist', 'vocalist', 'rap '],
  },
  {
    id: 'ator', label: 'Ator',
    occs: ['Q33999', 'Q10800557', 'Q10798782', 'Q2405480'],
    diz: ['ator', 'atriz', 'dublador', 'dubladora', 'actor', 'actress'],
  },
];

/**
 * Teto por categoria, e e ele que mantem a sala honesta. Sem ele o universo
 * seria um jogo de atores com dois gamers de enfeite: com retrato e 10
 * Wikipedias, a Wikidata tem 32 mil atores e 49 gamers. O corte de cada
 * categoria e o topo dela por numero de Wikipedias — a mesma logica das 600
 * cartas mais vistas do Yu-Gi-Oh, com a regua que a categoria aguenta.
 *
 * FOLGA e quantos candidatos baixam por vaga: a descricao derruba boa parte do
 * topo, entao o corte final precisa de fila atras.
 */
const TETO = 450;
const FOLGA = 4;

/**
 * Piso de Wikipedias para ser sorteado — quem fica abaixo continua chutavel, so
 * nao vira segredo. Ele e baixo de proposito. Numero de Wikipedias mede fama de
 * enciclopedia, e ela subestima quem ficou famoso na internet: e entre tres e
 * cinco idiomas que estao o Whindersson, a Virginia, o Nobru, o Rezende e o PC
 * Siqueira, enquanto qualquer reserva de Serie A passa de vinte. Em 6 o elenco
 * de gamers caia para 98 contra 440 atletas; em 3 ele fica em 277, e a categoria
 * ganha justamente os nomes que a sala reconhece.
 *
 * Para atleta, ator e musico o piso nao corta nada: o teto ja os deixa em 58+.
 */
const PISO = 3;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function cached(slug, fetcher) {
  const file = path.join(CACHE_DIR, `${slug}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  const data = await fetcher();
  await fs.writeFile(file, JSON.stringify(data));
  return data;
}

async function sparql(slug, query) {
  return cached(slug, async () => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch(SPARQL, {
          method: 'POST',
          headers: {
            'content-type': 'application/sparql-query',
            accept: 'application/sparql-results+json',
            'user-agent': UA,
          },
          body: query,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = JSON.parse(await res.text());
        if (json.exception) throw new Error(String(json.exception).slice(0, 120));
        return json.results.bindings;
      } catch (err) {
        if (attempt === 4) throw new Error(`${slug}: ${err.message}`);
        await sleep(800 * attempt * attempt);
      }
    }
  });
}

/** wbgetentities aceita 50 ids por vez; acima disso ele corta sem avisar. */
async function entities(slug, ids, props) {
  return cached(slug, async () => {
    const url = `${API}?${new URLSearchParams({
      action: 'wbgetentities',
      ids: ids.join('|'),
      props,
      languages: 'pt|pt-br|en',
      format: 'json',
    })}`;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'user-agent': UA } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = JSON.parse(await res.text());
        if (!json.entities) throw new Error('sem entities');
        return json.entities;
      } catch (err) {
        if (attempt === 4) throw new Error(`${slug}: ${err.message}`);
        await sleep(1200 * attempt * attempt);
      }
    }
  });
}

// ------------------------------------------------------------- candidatos

/** Todo mundo que exerce a ocupacao e tem retrato, com o peso de fama junto. */
const porOcupacao = (occ) => `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wikibase: <http://wikiba.se/ontology#>
SELECT ?p ?sl WHERE {
  ?p wdt:P106 wd:${occ} ; wdt:P18 ?img ; wikibase:sitelinks ?sl .
}`;

console.log('Baixando os candidatos por ocupacao...');
const pessoas = new Map();   // QID -> { sl, occs:Set de categoria }
for (const cat of CATEGORIAS) {
  for (const occ of cat.occs) {
    const linhas = await sparql(`occ-${occ}`, porOcupacao(occ));
    for (const linha of linhas) {
      const qid = linha.p.value.split('/').pop();
      if (!qid.startsWith('Q')) continue;
      const atual = pessoas.get(qid) ?? { sl: 0, occs: new Set() };
      atual.sl = Math.max(atual.sl, Number(linha.sl.value));
      atual.occs.add(cat.id);
      pessoas.set(qid, atual);
    }
    console.log(`  ${cat.id.padEnd(11)} ${occ.padEnd(10)} ${String(linhas.length).padStart(6)} pessoas`);
  }
}

// a fila de cada categoria e o topo dela por Wikipedias, com folga para a
// descricao derrubar. Quem exerce duas ocupacoes entra nas duas filas
const fila = new Map(CATEGORIAS.map(c => [c.id, []]));
for (const [qid, dados] of pessoas) {
  for (const id of dados.occs) fila.get(id).push({ qid, sl: dados.sl });
}
const candidatos = new Map();
for (const cat of CATEGORIAS) {
  const lista = fila.get(cat.id).sort((a, b) => b.sl - a.sl).slice(0, TETO * FOLGA);
  for (const c of lista) candidatos.set(c.qid, c.sl);
}

// ------------------------------------------------------------- fichas

const listaCandidatos = [...candidatos.keys()];
console.log(`\nBaixando a ficha de ${listaCandidatos.length} candidatos...`);
const fichas = new Map();
for (let i = 0; i < listaCandidatos.length; i += 50) {
  const bloco = await entities(`pessoa-${i}`, listaCandidatos.slice(i, i + 50), 'labels|descriptions|claims');
  for (const qid in bloco) fichas.set(qid, bloco[qid]);
  process.stdout.write(`\r  ${Math.min(i + 50, listaCandidatos.length)}/${listaCandidatos.length}`);
}
console.log('');

const claim = (ficha, prop) => ficha?.claims?.[prop] ?? [];
const valorId = (snak) => snak?.mainsnak?.datavalue?.value?.id ?? null;

/**
 * Onde a Wikidata guarda mais de um valor, o preferido ganha. E o que resolve o
 * Messi, que consta como Espanha, Italia e Argentina: a ficha marca a argentina
 * como preferida.
 */
function melhor(claims) {
  const vivos = claims.filter(c => c.rank !== 'deprecated');
  return vivos.find(c => c.rank === 'preferred') ?? vivos[0] ?? null;
}

/** Ano de uma data da Wikidata, so quando a precisao chega a ano (9). */
function ano(claims) {
  const c = melhor(claims);
  const v = c?.mainsnak?.datavalue?.value;
  if (!v || v.precision < 9) return null;
  const n = Number(String(v.time).slice(1, 5));
  return Number.isFinite(n) && n > 1800 ? n : null;
}

const GENERO = {
  Q6581097: 'Masculino', Q6581072: 'Feminino',
  Q2449503: 'Masculino', Q1052281: 'Feminino',
  Q48270: 'Não binário', Q18116794: 'Não binário', Q1097630: 'Intersexo',
};

// ------------------------------------------------------------- categoria

/**
 * As categorias que a descricao confirma, na ordem em que ela as menciona —
 * porque a descricao escreve o principal primeiro. "ator e musico americano" e
 * ator; "musico e astrofisico britanico" e musico; "ex-pugilista profissional"
 * e atleta, e nao influencer so porque o ingles emenda "media personality".
 *
 * O portugues manda quando existe. O ingles do Reagan diz "president ... and
 * actor" e o colocava entre os atores; o de la, "40.º Presidente dos Estados
 * Unidos", nao deixa duvida de que ele nao e o ator da sala.
 */
function categoriasDe(ficha) {
  const d = ficha?.descriptions ?? {};
  const texto = chave(d.pt?.value ?? d['pt-br']?.value ?? d.en?.value ?? '');
  if (!texto) return [];
  return CATEGORIAS
    .map((c) => {
      const onde = c.diz.map(t => texto.indexOf(t)).filter(i => i >= 0);
      return onde.length ? { cat: c, onde: Math.min(...onde) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.onde - b.onde)
    .map(x => x.cat);
}

const aprovados = [];
let semDescricao = 0;
let semCategoria = 0;
for (const qid of listaCandidatos) {
  const ficha = fichas.get(qid);
  if (!ficha || ficha.missing !== undefined) continue;
  if (!ficha.descriptions || !Object.keys(ficha.descriptions).length) { semDescricao++; continue; }
  const cats = categoriasDe(ficha);
  if (!cats.length) { semCategoria++; continue; }
  aprovados.push({ qid, sl: candidatos.get(qid), cats });
}
console.log(`\nA descricao confirmou ${aprovados.length} de ${listaCandidatos.length}`);
console.log(`  sem descricao: ${semDescricao}   nenhuma das cinco: ${semCategoria}`);

// o grupo e a primeira categoria confirmada, e so entra quem cabe no teto dela
const porGrupo = new Map(CATEGORIAS.map(c => [c.id, []]));
for (const p of aprovados) porGrupo.get(p.cats[0].id).push(p);

const escolhidos = [];
console.log('\nCorte por categoria (topo por numero de Wikipedias):');
for (const cat of CATEGORIAS) {
  const lista = porGrupo.get(cat.id).sort((a, b) => b.sl - a.sl);
  const corte = lista.slice(0, TETO);
  const regua = corte.length ? corte[corte.length - 1].sl : 0;
  console.log(`  ${cat.label.padEnd(11)} ${String(corte.length).padStart(4)} de ${String(lista.length).padStart(5)}  (regua: ${regua} wikis)`);
  escolhidos.push(...corte.map(p => ({ ...p, group: cat.id })));
}

// ------------------------------------------------------------- paises

const paisIds = new Set();
for (const { qid } of escolhidos) {
  const id = valorId(melhor(claim(fichas.get(qid), 'P27')));
  if (id) paisIds.add(id);
}
console.log(`\nResolvendo ${paisIds.size} paises...`);
const paisNome = new Map();
const listaPaises = [...paisIds];
for (let i = 0; i < listaPaises.length; i += 50) {
  const bloco = await entities(`pais-${i}`, listaPaises.slice(i, i + 50), 'labels');
  for (const qid in bloco) {
    const l = bloco[qid].labels;
    const nome = l?.['pt-br']?.value ?? l?.pt?.value ?? l?.en?.value ?? null;
    if (nome) paisNome.set(qid, nome);
  }
}

// ------------------------------------------------------------- montagem

const CAT_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.label]));

const roster = [];
for (const { qid, group, cats, sl } of escolhidos) {
  const ficha = fichas.get(qid);
  const labels = ficha.labels ?? {};
  const nomePt = labels.pt?.value ?? labels['pt-br']?.value ?? null;
  const nomeEn = labels.en?.value ?? null;
  const name = nomePt ?? nomeEn;
  if (!name) continue;

  const arquivo = melhor(claim(ficha, 'P18'))?.mainsnak?.datavalue?.value ?? null;
  const filePath = arquivo
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(arquivo)}`
    : null;

  const pais = paisNome.get(valorId(melhor(claim(ficha, 'P27')))) ?? null;
  const genero = GENERO[valorId(melhor(claim(ficha, 'P21')))] ?? null;
  const nascimento = ano(claim(ficha, 'P569'));
  const morte = ano(claim(ficha, 'P570'));

  const item = {
    id: Number(qid.slice(1)),
    name,
    group,
    // a categoria e `list`: quem e as duas coisas fecha amarelo contra as duas.
    // O Will Smith e ator e musico, e a celula tem de dizer isso
    categories: cats.map(c => c.label),
    gender: genero,
    country: pais,
    birthYear: nascimento,
    // morte aqui nao e spoiler, e dica: quem lembra do Michael Jackson sabe
    status: morte ? 'Morto' : 'Vivo',
    sprite: filePath && `${filePath}?width=256`,
    artwork: filePath && `${filePath}?width=640`,
  };

  // o nome em ingles fica de apelido, para quem so conhece a grafia de la
  if (nomeEn && nomePt && nomeEn !== nomePt) item.aliases = [nomeEn];

  // sem pais ou sem nascimento a linha nasce com dois vazios, e sem retrato nao
  // ha o que a tabela mostre do chute
  item.eligible = Boolean(filePath && pais && nascimento && genero && sl >= PISO);
  roster.push(item);
}

// ------------------------------------------------------------- relatorio

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} pessoas):`);
coverage('retrato', p => p.sprite);
coverage('genero', p => p.gender);
coverage('pais', p => p.country);
coverage('nascimento', p => p.birthYear);
coverage('apelido', p => p.aliases?.length);
coverage('sorteavel', p => p.eligible);

const tally = (label, pick) => {
  const counts = {};
  for (const p of roster) if (p.eligible) for (const v of [pick(p)].flat()) counts[v] = (counts[v] ?? 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`${label}:`, JSON.stringify(Object.fromEntries(top)));
};
console.log('');
tally('Sorteaveis por categoria', p => CAT_LABEL[p.group]);
tally('Categorias na celula', p => p.categories);
tally('Genero', p => p.gender);
tally('Paises (top 12)', p => p.country);
tally('Estado', p => p.status);
tally('Decada de nascimento', p => `${Math.floor(p.birthYear / 10) * 10}s`);

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} pessoas -> data/famosos.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
