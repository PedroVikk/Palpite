/**
 * Monta data/famosos.json com gente famosa de verdade, em cinco categorias.
 *   npm run build:famosos
 * Fontes: Wikidata pelo espelho QLever, e a Wikipedia em portugues (as duas
 * abertas, sem chave).
 *
 * API pronta de "famosos" nao existe. As que aparecem na busca ou cobram por um
 * elenco de mil nomes, ou entregam ficha que ninguem sabe de cabeca (patrimonio,
 * altura) — coluna morta pelo criterio da casa.
 *
 * **A regua de fama e a Wikipedia em portugues, nao a Wikidata.** Contar em
 * quantos idiomas a pessoa tem artigo mede fama de enciclopedia, e ela nao e a
 * fama da sala: por esse criterio o Corbin Bleu e o Basshunter entravam no top 5
 * dos musicos, com 7 mil e 24 mil visitas em pt no ano, enquanto o Wagner Moura
 * (404 mil), a Marilia Mendonca (198 mil) e o Caetano (252 mil) ficavam de fora
 * do universo inteiro. Quem joga em portugues conhece os segundos. Entao o
 * elenco sai de quem tem artigo na Wikipedia em portugues, ordenado pelas
 * visitas que esse artigo recebeu nos ultimos doze meses — a mesma logica das
 * 3000 cartas mais vistas do Yu-Gi-Oh.
 *
 * Visita e um pedido por artigo, e ha 60 mil candidatos: o tamanho do artigo
 * (50 titulos por pedido) faz o desbaste barato antes, e so a fila da frente vai
 * para a contagem de visitas. Os dois medem a mesma coisa de longe — o Corbin
 * Bleu e o ultimo dos dois jeitos —, o tamanho so erra a ordem fina.
 *
 * A ocupacao da Wikidata levanta o candidato, mas quem decide a categoria e a
 * *descricao*. Sem ela o elenco enche de gente famosa por outra coisa: o Albert
 * Camus e o Niels Bohr entram como atletas (os dois jogaram bola), a Madre
 * Teresa entra como musica, o Reagan e o Papa Francisco como atores. A descricao
 * e uma linha escrita por gente dizendo o que a pessoa e — "filosofo e
 * jornalista franco-argelino", "Santa da Igreja Catolica", "futebolista
 * brasileiro" — e separa os cinco na hora.
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
import { createHash } from 'node:crypto';

const SPARQL = 'https://qlever.dev/api/wikidata';
const API = 'https://www.wikidata.org/w/api.php';
const PTWIKI = 'https://pt.wikipedia.org/w/api.php';
const METRICS = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/all-agents';
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
    id: 'gamer', label: 'Gamer', regua: 'idiomas',
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
    id: 'influencer', label: 'Influencer', regua: 'idiomas',
    occs: ['Q17125263', 'Q2906862', 'Q2045208'],
    diz: ['youtuber', 'influenciador', 'influenciadora', 'influencer', 'streamer',
      'tiktoker', 'blogueiro', 'blogueira', 'vlogger', 'personalidade da internet',
      'internet personality', 'media personality', 'celebridade da internet',
      'internet celebrity', 'social media'],
  },
  {
    id: 'atleta', label: 'Atleta', regua: 'visitas',
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
    id: 'musico', label: 'Músico', regua: 'visitas',
    occs: ['Q177220', 'Q639669', 'Q2252262', 'Q753110', 'Q130857', 'Q488205'],
    diz: ['cantor', 'cantora', 'musico', 'musicista', 'rapper', 'compositor',
      'compositora', 'guitarrista', 'baterista', 'pianista', 'violonista',
      'sertanejo', 'dj ', 'singer', 'musician', 'songwriter', 'composer',
      'guitarist', 'drummer', 'pianist', 'bassist', 'vocalist', 'rap '],
  },
  {
    id: 'ator', label: 'Ator', regua: 'visitas',
    occs: ['Q33999', 'Q10800557', 'Q10798782', 'Q2405480'],
    diz: ['ator', 'atriz', 'dublador', 'dubladora', 'actor', 'actress'],
  },
];

/** Quantos entram por categoria, e quantos passam por cada peneira antes. */
const TETO = 450;          // sorteaveis por categoria, no fim
const PRE_TAMANHO = 1500;  // maiores artigos que vao para a ficha da Wikidata
const PRE_VISITAS = 900;   // aprovados que vao para a contagem de visitas

/**
 * Piso de visitas em doze meses para ser sorteado — quem fica abaixo continua
 * chutavel, so nao vira segredo. 20 mil e ~1.600 por mes: abaixo disso estao os
 * nomes que ninguem na sala poe na mesa.
 */
const PISO_VISITAS = 20_000;

/**
 * O mesmo piso para quem corre pela regua de idiomas: tres Wikipedias. E baixo
 * porque a enciclopedia subestima quem ficou famoso na internet — e entre tres
 * e cinco idiomas que estao o Whindersson, o Nobru e o Rezende.
 */
const PISO_IDIOMAS = 3;

/**
 * O nome do arquivo de cache de um lote sai do *conteudo* dele, nunca da
 * posicao. Com `tam-0`, `tam-50` e afins, mudar o recorte do universo faz o
 * lote 50 guardar um conjunto e devolver outro na rodada seguinte — foi o que
 * apagou os gamers em silencio, porque a ficha vinha de outra pessoa.
 */
const loteSlug = (prefixo, ids) =>
  `${prefixo}-${createHash('sha1').update(ids.join('|')).digest('hex').slice(0, 12)}`;

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

/**
 * Um pedido com paciencia. O 429 da Wikipedia e o que manda no ritmo deste
 * build: ele chega em rajada quando varios lotes saem juntos, e so passa se a
 * espera crescer de verdade — por isso o backoff dobra ate um minuto e ele
 * ganha o dobro de tentativas dos outros erros.
 */
async function pega(url, opcoes = {}, tentativas = 8) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const res = await fetch(url, { ...opcoes, headers: { 'user-agent': UA, ...opcoes.headers } });
      if (res.status === 404) return null;      // artigo sem dado de visita
      if (res.status === 429) {
        const pedido = Number(res.headers.get('retry-after')) * 1000;
        await sleep(Math.min(Number.isFinite(pedido) && pedido > 0 ? pedido : 2000 * 2 ** i, 60_000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return JSON.parse(await res.text());
    } catch (err) {
      if (i === tentativas) throw err;
      await sleep(600 * i * i);
    }
  }
  throw new Error(`desistiu apos ${tentativas} tentativas: ${url.slice(0, 80)}`);
}

/** Roda `tarefa` sobre a lista com no maximo `n` pedidos ao mesmo tempo. */
async function emParalelo(lista, n, tarefa) {
  const saida = new Array(lista.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, async () => {
    while (proximo < lista.length) {
      const i = proximo++;
      saida[i] = await tarefa(lista[i], i);
    }
  }));
  return saida;
}

// ------------------------------------------------------------- candidatos

/** Quem exerce a ocupacao e tem retrato, com o numero de Wikipedias junto. */
const porOcupacao = (occ) => `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wikibase: <http://wikiba.se/ontology#>
SELECT ?p ?sl WHERE {
  ?p wdt:P106 wd:${occ} ; wdt:P18 ?img ; wikibase:sitelinks ?sl .
}`;

/** Os mesmos, mas so quem tem artigo na Wikipedia em portugues, com o titulo. */
const porOcupacaoPt = (occ) => `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX schema: <http://schema.org/>
SELECT ?p ?art WHERE {
  ?p wdt:P106 wd:${occ} ; wdt:P18 ?img .
  ?art schema:about ?p ; schema:isPartOf <https://pt.wikipedia.org/> .
}`;

/** "https://pt.wikipedia.org/wiki/Wagner_Moura" -> "Wagner Moura" */
const tituloDaUrl = (url) => {
  try {
    return decodeURIComponent(url.split('/wiki/')[1] ?? '').replace(/_/g, ' ');
  } catch {
    return null;
  }
};

const consulta = (slug, query) => cached(slug, async () => {
  const json = await pega(SPARQL, {
    method: 'POST',
    headers: { 'content-type': 'application/sparql-query', accept: 'application/sparql-results+json' },
    body: query,
  });
  if (json?.exception) throw new Error(String(json.exception).slice(0, 120));
  return json.results.bindings;
});

console.log('Baixando os candidatos por ocupacao...');
const pessoas = new Map();   // QID -> { titulo, sl, occs:Set de categoria }
const anota = (qid) => {
  const atual = pessoas.get(qid) ?? { titulo: null, sl: 0, occs: new Set() };
  pessoas.set(qid, atual);
  return atual;
};

for (const cat of CATEGORIAS) {
  for (const occ of cat.occs) {
    // o titulo em pt interessa a todos (e o nome que a sala le), mas so quem
    // corre pela regua de visitas depende dele para existir
    const comPt = await consulta(`pt-${occ}`, porOcupacaoPt(occ));
    for (const linha of comPt) {
      const qid = linha.p.value.split('/').pop();
      const titulo = tituloDaUrl(linha.art.value);
      if (!qid.startsWith('Q') || !titulo || titulo.includes('|')) continue;
      const p = anota(qid);
      p.titulo = titulo;
      p.occs.add(cat.id);
    }

    if (cat.regua === 'idiomas') {
      const todos = await consulta(`occ-${occ}`, porOcupacao(occ));
      for (const linha of todos) {
        const qid = linha.p.value.split('/').pop();
        if (!qid.startsWith('Q')) continue;
        const p = anota(qid);
        p.sl = Math.max(p.sl, Number(linha.sl.value));
        p.occs.add(cat.id);
      }
      console.log(`  ${cat.id.padEnd(11)} ${occ.padEnd(10)} ${String(todos.length).padStart(6)} no mundo  (${comPt.length} com artigo em pt)`);
    } else {
      console.log(`  ${cat.id.padEnd(11)} ${occ.padEnd(10)} ${String(comPt.length).padStart(6)} com artigo em pt`);
    }
  }
}
console.log(`\n${pessoas.size} pessoas distintas.`);

// ------------------------------------------------- peneira 1: tamanho do artigo

/**
 * O tamanho do artigo em pt e o desbaste barato antes das visitas: 50 titulos
 * por pedido contra um pedido por artigo. Ele so vale para as categorias que
 * correm pela regua de visitas — as outras ja tem o numero de Wikipedias.
 */
const precisaTamanho = new Set();
for (const [qid, dados] of pessoas) {
  if (!dados.titulo) continue;
  if ([...dados.occs].some(id => CATEGORIAS.find(c => c.id === id).regua === 'visitas')) {
    precisaTamanho.add(dados.titulo);
  }
}
const titulos = [...precisaTamanho];
console.log(`\nMedindo ${titulos.length} artigos (50 por pedido)...`);
const tamanho = new Map();
const lotes = [];
for (let i = 0; i < titulos.length; i += 50) lotes.push([i, titulos.slice(i, i + 50)]);

let feitos = 0;
await emParalelo(lotes, 2, async ([i, lote]) => {
  const dados = await cached(loteSlug('tam', lote), async () => {
    const url = `${PTWIKI}?${new URLSearchParams({
      action: 'query', prop: 'info', format: 'json', titles: lote.join('|'),
    })}`;
    const json = await pega(url);
    const saida = {};
    for (const k in json?.query?.pages ?? {}) {
      const pagina = json.query.pages[k];
      if (pagina.length) saida[pagina.title] = pagina.length;
    }
    // a API normaliza titulos (underline, maiuscula): guarda o de volta tambem
    for (const n of json?.query?.normalized ?? []) {
      if (saida[n.to]) saida[n.from] = saida[n.to];
    }
    return saida;
  });
  for (const t in dados) tamanho.set(t, dados[t]);
  feitos += lote.length;
  if (feitos % 5000 < 50) process.stdout.write(`\r  ${feitos}/${titulos.length}`);
});
console.log(`\r  ${titulos.length}/${titulos.length}`);

// a fila de cada categoria e o topo dela pela peneira barata da sua regua: o
// tamanho do artigo em pt, ou o numero de Wikipedias
const fila = new Map(CATEGORIAS.map(c => [c.id, []]));
for (const [qid, dados] of pessoas) {
  const bytes = dados.titulo ? (tamanho.get(dados.titulo) ?? 0) : 0;
  for (const id of dados.occs) {
    const cat = CATEGORIAS.find(c => c.id === id);
    if (cat.regua === 'visitas') {
      if (bytes) fila.get(id).push({ qid, peso: bytes });
    } else {
      fila.get(id).push({ qid, peso: dados.sl });
    }
  }
}
const candidatos = new Set();
for (const cat of CATEGORIAS) {
  const lista = fila.get(cat.id).sort((a, b) => b.peso - a.peso).slice(0, PRE_TAMANHO);
  for (const c of lista) candidatos.add(c.qid);
}

// ------------------------------------------------------------- fichas

const listaCandidatos = [...candidatos];
console.log(`\nBaixando a ficha de ${listaCandidatos.length} candidatos...`);
const fichas = new Map();
const blocos = [];
for (let i = 0; i < listaCandidatos.length; i += 50) blocos.push([i, listaCandidatos.slice(i, i + 50)]);
for (const [i, lote] of blocos) {
  const bloco = await cached(loteSlug('pessoa', lote), async () => {
    const url = `${API}?${new URLSearchParams({
      action: 'wbgetentities', ids: lote.join('|'),
      props: 'labels|descriptions|claims', languages: 'pt|pt-br|en', format: 'json',
    })}`;
    const json = await pega(url);
    if (!json?.entities) throw new Error('sem entities');
    return json.entities;
  });
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
    const dados = pessoas.get(qid);
    const bytes = dados.titulo ? (tamanho.get(dados.titulo) ?? 0) : 0;
    // `peso` e a peneira barata da regua da categoria principal: bytes do artigo
    // em pt para quem corre por visitas, numero de Wikipedias para os outros
    const peso = cats[0].regua === 'visitas' ? bytes : dados.sl;
    aprovados.push({ qid, cats, titulo: dados.titulo, sl: dados.sl, peso });
}
console.log(`\nA descricao confirmou ${aprovados.length} de ${listaCandidatos.length}`);
console.log(`  sem descricao: ${semDescricao}   nenhuma das cinco: ${semCategoria}`);

// ------------------------------------------------- peneira 2: visitas em pt

const porGrupo = new Map(CATEGORIAS.map(c => [c.id, []]));
for (const p of aprovados) porGrupo.get(p.cats[0].id).push(p);

// so quem corre pela regua de visitas vai para a contagem, e so a fila da frente
const paraContar = [];
for (const cat of CATEGORIAS) {
  if (cat.regua !== 'visitas') continue;
  paraContar.push(...porGrupo.get(cat.id).sort((a, b) => b.peso - a.peso).slice(0, PRE_VISITAS));
}

/** Os doze meses fechados antes do mes corrente. */
function janela() {
  const hoje = new Date();
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const ini = new Date(Date.UTC(fim.getUTCFullYear() - 1, fim.getUTCMonth(), 1));
  const carimbo = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}0100`;
  return [carimbo(ini), carimbo(fim)];
}
const [DE, ATE] = janela();

console.log(`\nContando as visitas em pt de ${paraContar.length} artigos (${DE.slice(0, 6)} a ${ATE.slice(0, 6)})...`);
let contados = 0;
await emParalelo(paraContar, 4, async (p) => {
  p.views = await cached(`views-${p.qid}`, async () => {
    const url = `${METRICS}/${encodeURIComponent(p.titulo.replace(/ /g, '_'))}/monthly/${DE}/${ATE}`;
    const json = await pega(url);
    return (json?.items ?? []).reduce((s, i) => s + i.views, 0);
  });
  contados++;
  if (contados % 250 === 0) process.stdout.write(`\r  ${contados}/${paraContar.length}`);
});
console.log(`\r  ${paraContar.length}/${paraContar.length}`);

const escolhidos = [];
console.log('\nCorte por categoria:');
for (const cat of CATEGORIAS) {
  const porVisitas = cat.regua === 'visitas';
  const lista = porVisitas
    ? paraContar.filter(p => p.cats[0].id === cat.id).sort((a, b) => b.views - a.views)
    : porGrupo.get(cat.id).sort((a, b) => b.peso - a.peso);
  const corte = lista.slice(0, TETO);
  const ultimo = corte.length ? corte[corte.length - 1] : null;
  const regua = porVisitas
    ? `${(ultimo?.views ?? 0).toLocaleString('pt-BR')} visitas em pt`
    : `${ultimo?.peso ?? 0} wikipedias`;
  console.log(`  ${cat.label.padEnd(11)} ${String(corte.length).padStart(4)} de ${String(lista.length).padStart(5)}  (regua: ${regua})`);
  escolhidos.push(...corte.map(p => ({ ...p, group: cat.id, porVisitas })));
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
  const bloco = await cached(loteSlug('pais', listaPaises.slice(i, i + 50)), async () => {
    const url = `${API}?${new URLSearchParams({
      action: 'wbgetentities', ids: listaPaises.slice(i, i + 50).join('|'),
      props: 'labels', languages: 'pt|pt-br|en', format: 'json',
    })}`;
    const json = await pega(url);
    if (!json?.entities) throw new Error('sem entities');
    return json.entities;
  });
  for (const qid in bloco) {
    const l = bloco[qid].labels;
    const nome = l?.['pt-br']?.value ?? l?.pt?.value ?? l?.en?.value ?? null;
    if (nome) paisNome.set(qid, nome);
  }
}

// ------------------------------------------------------------- montagem

const CAT_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.label]));

const roster = [];
for (const { qid, group, cats, titulo, views, sl, porVisitas } of escolhidos) {
  const ficha = fichas.get(qid);
  const labels = ficha.labels ?? {};
  // o titulo do artigo em pt e como o leitor de ca escreve o nome; o label da
  // Wikidata so entra quando o titulo vem com desambiguacao entre parenteses
  const nomePt = labels.pt?.value ?? labels['pt-br']?.value ?? null;
  const nomeEn = labels.en?.value ?? null;
  // o titulo do artigo em pt e como o leitor de ca escreve o nome, menos quando
  // ele vem com desambiguacao entre parenteses ("Yuya (youtuber)"). Quem corre
  // pela regua de idiomas pode nao ter artigo em pt: ai vale o label da Wikidata
  const doArtigo = titulo && !titulo.includes('(') ? titulo : null;
  const name = doArtigo ?? nomePt ?? nomeEn ?? titulo;
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
  const apelidos = [nomeEn, nomePt].filter(a => a && a !== name);
  if (apelidos.length) item.aliases = [...new Set(apelidos)];

  // sem pais ou sem nascimento a linha nasce com dois vazios, e sem retrato nao
  // ha o que a tabela mostre do chute
  const conhecida = porVisitas ? views >= PISO_VISITAS : sl >= PISO_IDIOMAS;
  item.eligible = Boolean(filePath && pais && nascimento && genero && conhecida);
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

const brasileiros = roster.filter(p => p.eligible && p.country === 'Brasil');
console.log(`\nBrasileiros sorteaveis: ${brasileiros.length} de ${roster.filter(p => p.eligible).length}`);
for (const cat of CATEGORIAS) {
  const n = brasileiros.filter(p => p.group === cat.id).length;
  console.log(`  ${cat.label.padEnd(11)} ${String(n).padStart(3)}`);
}

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} pessoas -> data/famosos.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
