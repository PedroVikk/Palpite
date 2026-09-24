/**
 * Monta data/bandas.json com as bandas que a sala conhece.
 *   npm run build:bandas
 * Fontes: Wikidata pelo espelho QLever, a Wikipedia em portugues, a TheAudioDB
 * (com a chave publica de teste) e o MusicBrainz — as quatro abertas.
 *
 * O elenco sai como o dos Famosos: todo grupo musical da Wikidata com artigo na
 * Wikipedia em portugues, ordenado pelas visitas que esse artigo recebeu nos
 * ultimos doze meses. Contar idiomas poria Carpenters e Lordi no topo, a frente
 * de Metallica e Legiao Urbana; a visita em pt poe quem a sala conhece.
 *
 * A ficha e da TheAudioDB, e por um motivo: ela e a unica fonte aberta que
 * responde as perguntas que o jogador sabe de cabeca. A Wikidata tem pais,
 * fundacao e fim, mas nao diz quantos integrantes a banda tem hoje nem se ela e
 * de homens, de mulheres ou mista — os membros estao la, com data de saida em
 * metade dos casos. A TheAudioDB grava os dois prontos (`intMembers`,
 * `strGender`) e casa com a Wikidata pelo ID do MusicBrainz (P434), sem busca
 * por nome no meio. Onde ela falha — e falha no Brasil — entram o MusicBrainz,
 * os membros da Wikidata e a propria descricao ("dupla sertaneja").
 *
 * So as jogaveis vao para o arquivo: banda sem pais, ano, genero, formacao,
 * integrantes ou imagem nao seria segredo nem chute.
 *
 * Quem decide o genero e a descricao, como nos Famosos: "banda de rock
 * brasileira", "grupo feminino sul-coreano", "dupla sertaneja". Ela escreve o
 * principal primeiro, e o P136 da Wikidata so completa a lista — sozinho ele
 * da ao Queen onze generos, do glam ao hard rock, sem ordem nenhuma.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const SPARQL = 'https://qlever.dev/api/wikidata';
const API = 'https://www.wikidata.org/w/api.php';
const PTWIKI = 'https://pt.wikipedia.org/w/api.php';
const METRICS = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/all-agents';
const AUDIODB = 'https://www.theaudiodb.com/api/v1/json/123/artist-mb.php';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'bandas.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'bandas');
const UA = 'palpite-dataset/1.0 (+https://github.com/PedroVikk)';

await fs.mkdir(CACHE_DIR, { recursive: true });

/** Quantos passam por cada peneira. */
const PRE_TAMANHO = 2500;  // maiores artigos em pt que vao para a ficha da Wikidata
const PRE_VISITAS = 1600;  // os que vao para a contagem de visitas
const TETO = 700;          // no maximo, no fim
/**
 * Piso de visitas em doze meses para entrar. 15 mil e pouco mais de mil por
 * mes: abaixo disso estao as bandas que so o fa do genero conhece.
 */
const PISO_VISITAS = 15_000;

/** Sem acento e em minuscula: a descricao em pt vem dos dois jeitos. */
const chave = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const loteSlug = (prefixo, ids) =>
  `${prefixo}-${createHash('sha1').update(ids.join('|')).digest('hex').slice(0, 12)}`;

async function cached(slug, fetcher) {
  const file = path.join(CACHE_DIR, `${slug}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  const data = await fetcher();
  await fs.writeFile(file, JSON.stringify(data));
  return data;
}

async function pega(url, opcoes = {}, tentativas = 8) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const res = await fetch(url, { ...opcoes, headers: { 'user-agent': UA, ...opcoes.headers } });
      if (res.status === 404) return null;
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

const tituloDaUrl = (url) => {
  try {
    return decodeURIComponent(url.split('/wiki/')[1] ?? '').replace(/_/g, ' ');
  } catch {
    return null;
  }
};

// ------------------------------------------------------------- generos

/**
 * As familias de genero, na ordem em que a celula lista. `diz` sao os termos
 * procurados na descricao e no nome dos generos do P136; o primeiro que a
 * descricao menciona e o genero principal, e ele decide o grupo.
 *
 * Sao largas de proposito: "rock alternativo", "hard rock" e "rock
 * progressivo" sao Rock, porque ninguem na sala separa o Radiohead do Queen por
 * subgenero. As brasileiras ficam separadas porque ai o nome e o que o
 * jogador fala — ninguem chama o Calcinha Preta de "pop".
 */
const GENEROS = [
  { id: 'kpop', label: 'K-pop', diz: ['k-pop', 'kpop', 'pop coreano', 'korean pop', 'sul-coreano', 'sul-coreana', 'south korean'] },
  { id: 'metal', label: 'Metal', diz: ['metal', 'metalcore', 'deathcore', 'djent'] },
  { id: 'punk', label: 'Punk', diz: ['punk', 'hardcore', 'emo'] },
  { id: 'sertanejo', label: 'Sertanejo', diz: ['sertanej', 'musica caipira', 'moda de viola'] },
  { id: 'pagode', label: 'Samba e pagode', diz: ['pagode', 'samba'] },
  { id: 'axe', label: 'Axé', diz: ['axe', 'arrocha', 'swingueira', 'pagodao'] },
  { id: 'forro', label: 'Forró', diz: ['forro', 'piseiro', 'brega', 'calypso', 'tecnobrega', 'xote', 'baiao'] },
  { id: 'mpb', label: 'MPB', diz: ['mpb', 'musica popular brasileira', 'bossa nova', 'tropicalia'] },
  { id: 'gospel', label: 'Gospel', diz: ['gospel', 'crista', 'cristao', 'christian', 'louvor', 'worship'] },
  { id: 'rap', label: 'Hip hop', diz: ['hip hop', 'hip-hop', 'rap', 'trap'] },
  { id: 'eletronica', label: 'Eletrônica', diz: ['eletronic', 'electronic', 'eletro', 'electro', 'house', 'techno', 'trance', 'edm', 'dance', 'synth-pop', 'synthpop', 'dubstep', 'disco'] },
  { id: 'reggae', label: 'Reggae', diz: ['reggae', 'ska', 'dub'] },
  { id: 'rnb', label: 'R&B e soul', diz: ['r&b', 'rhythm and blues', 'soul', 'funk', 'motown'] },
  { id: 'country', label: 'Country e folk', diz: ['country', 'folk', 'bluegrass'] },
  { id: 'jazz', label: 'Jazz e blues', diz: ['jazz', 'blues', 'swing'] },
  { id: 'rock', label: 'Rock', diz: ['rock', 'grunge', 'britpop', 'new wave', 'shoegaze', 'post-punk', 'indie', 'alternativ'] },
  { id: 'pop', label: 'Pop', diz: ['pop', 'boy band', 'boyband', 'girl group', 'grupo feminino', 'grupo masculino', 'grupo vocal', 'banda de garotos', 'banda de garotas'] },
];

/**
 * Um termo curto casa dentro de palavra maior: "ska" em "Nebraska", "dub" em
 * "dublin", "emo" em "demo", "rap" em "rapaz", "axe" em "saxe". Por isso o
 * termo precisa cair em fronteira de palavra dos dois lados — com excecao dos
 * radicais escritos para casar pelo comeco ("sertanej", "eletronic").
 */
const RADICAL = new Set(['sertanej', 'eletronic', 'electronic', 'eletro', 'electro', 'alternativ', 'crista', 'cristao']);
function onde(texto, termo) {
  let i = texto.indexOf(termo);
  while (i >= 0) {
    const antes = i === 0 ? ' ' : texto[i - 1];
    const depois = texto[i + termo.length] ?? ' ';
    const borda = (c) => !/[a-z0-9]/.test(c);
    if (borda(antes) && (RADICAL.has(termo) || borda(depois))) return i;
    i = texto.indexOf(termo, i + 1);
  }
  return -1;
}

/**
 * As familias que um texto menciona, na ordem em que aparecem.
 *
 * Com `nucleo`, o nome composto vale pelo nucleo, e o que vem antes e so
 * adjetivo: "pop rock", "blues rock" e "folk rock" sao Rock, "pop punk" e Punk,
 * "rap metal" e Metal. Sem isso o P136 do Led Zeppelin fazia dele banda de
 * blues, e metade do rock da lista virava Pop. A excecao e "punk rock", que e
 * o nome do proprio punk.
 *
 * O portugues poe o adjetivo depois: "forro eletronico" e forro, "rock
 * alternativo" e rock. Os radicais de adjetivo nunca sao nucleo.
 */
const ADJETIVO = new Set(['eletronic', 'electronic', 'alternativ', 'crista', 'cristao']);
function familias(texto, { nucleo = false } = {}) {
  const t = chave(texto ?? '');
  if (!t) return [];
  const achados = [];
  for (const g of GENEROS) {
    for (const termo of g.diz) {
      const pos = onde(t, termo);
      if (pos >= 0) achados.push({ id: g.id, pos, fim: pos + termo.length, adjetivo: ADJETIVO.has(termo) });
    }
  }
  achados.sort((a, b) => a.pos - b.pos || b.fim - a.fim);
  const validos = achados.filter((a) => {
    if (!nucleo) return true;
    const seguinte = achados.find(b => b.pos > a.pos && /^[\s-]+$/.test(t.slice(a.fim, b.pos)));
    if (!seguinte || seguinte.id === a.id || seguinte.adjetivo) return true;
    if (a.adjetivo) return false;
    return a.id === 'punk' && seguinte.id === 'rock';
  });
  return [...new Set(validos.map(a => a.id))];
}

/**
 * O grupo que a sala liga e desliga. Sao menos que as familias: Punk mora com o
 * Rock, e as brasileiras e as de pista dividem balde, senao sobrava grupo com
 * cinco bandas.
 */
const GRUPO_DO_GENERO = {
  rock: 'rock', punk: 'rock', metal: 'metal', pop: 'pop', kpop: 'kpop',
  sertanejo: 'brasil', pagode: 'brasil', axe: 'brasil', forro: 'brasil', mpb: 'brasil', gospel: 'brasil',
  eletronica: 'outros', rap: 'outros', reggae: 'outros', rnb: 'outros', country: 'outros', jazz: 'outros',
};

// ------------------------------------------------------------- candidatos

console.log('Baixando os grupos musicais com artigo em pt...');
const candidatosQuery = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX schema: <http://schema.org/>
SELECT DISTINCT ?b ?art WHERE {
  ?b wdt:P31/wdt:P279* wd:Q215380 .
  ?art schema:about ?b ; schema:isPartOf <https://pt.wikipedia.org/> .
}`;
const linhas = await cached('candidatos', async () => {
  const json = await pega(SPARQL, {
    method: 'POST',
    headers: { 'content-type': 'application/sparql-query', accept: 'application/sparql-results+json' },
    body: candidatosQuery,
  });
  if (json?.exception) throw new Error(String(json.exception).slice(0, 120));
  return json.results.bindings;
});

const titulos = new Map();   // QID -> titulo em pt
for (const l of linhas) {
  const qid = l.b.value.split('/').pop();
  const titulo = tituloDaUrl(l.art.value);
  if (qid.startsWith('Q') && titulo && !titulo.includes('|')) titulos.set(qid, titulo);
}
console.log(`  ${titulos.size} grupos.`);

// ------------------------------------------------- peneira 1: tamanho do artigo

const listaTitulos = [...new Set(titulos.values())];
console.log(`\nMedindo ${listaTitulos.length} artigos (50 por pedido)...`);
const tamanho = new Map();
const lotes = [];
for (let i = 0; i < listaTitulos.length; i += 50) lotes.push(listaTitulos.slice(i, i + 50));
await emParalelo(lotes, 2, async (lote) => {
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
    for (const n of json?.query?.normalized ?? []) {
      if (saida[n.to]) saida[n.from] = saida[n.to];
    }
    return saida;
  });
  for (const t in dados) tamanho.set(t, dados[t]);
});

const porTamanho = [...titulos]
  .map(([qid, titulo]) => ({ qid, titulo, bytes: tamanho.get(titulo) ?? 0 }))
  .filter(c => c.bytes > 0)
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, PRE_TAMANHO);

// ------------------------------------------------------------- fichas

console.log(`\nBaixando a ficha de ${porTamanho.length} candidatos...`);
const fichas = new Map();
for (let i = 0; i < porTamanho.length; i += 50) {
  const lote = porTamanho.slice(i, i + 50).map(c => c.qid);
  const bloco = await cached(loteSlug('banda', lote), async () => {
    const url = `${API}?${new URLSearchParams({
      action: 'wbgetentities', ids: lote.join('|'),
      props: 'labels|descriptions|claims', languages: 'pt|pt-br|en', format: 'json',
    })}`;
    const json = await pega(url);
    if (!json?.entities) throw new Error('sem entities');
    return json.entities;
  });
  for (const qid in bloco) fichas.set(qid, bloco[qid]);
}

const claim = (ficha, prop) => ficha?.claims?.[prop] ?? [];
const valorId = (snak) => snak?.mainsnak?.datavalue?.value?.id ?? null;
function melhor(claims) {
  const vivos = claims.filter(c => c.rank !== 'deprecated');
  return vivos.find(c => c.rank === 'preferred') ?? vivos[0] ?? null;
}
const todos = (claims) => claims.filter(c => c.rank !== 'deprecated');
function anoDe(c) {
  const v = c?.mainsnak?.datavalue?.value;
  if (!v || v.precision < 9) return null;
  const n = Number(String(v.time).slice(1, 5));
  return Number.isFinite(n) && n > 1800 ? n : null;
}
const texto = (ficha, campo) => {
  const d = ficha?.[campo] ?? {};
  return d.pt?.value ?? d['pt-br']?.value ?? d.en?.value ?? '';
};

// ------------------------------------------------- nomes dos generos e paises

const entidadesAuxiliares = new Set();
for (const { qid } of porTamanho) {
  const f = fichas.get(qid);
  for (const c of todos(claim(f, 'P136'))) if (valorId(c)) entidadesAuxiliares.add(valorId(c));
  for (const p of ['P495', 'P17']) {
    const id = valorId(melhor(claim(f, p)));
    if (id) entidadesAuxiliares.add(id);
  }
}
const nomeDe = new Map();
const auxiliares = [...entidadesAuxiliares];
console.log(`\nResolvendo ${auxiliares.length} generos e paises...`);
for (let i = 0; i < auxiliares.length; i += 50) {
  const lote = auxiliares.slice(i, i + 50);
  const bloco = await cached(loteSlug('aux', lote), async () => {
    const url = `${API}?${new URLSearchParams({
      action: 'wbgetentities', ids: lote.join('|'), props: 'labels', languages: 'pt|pt-br|en', format: 'json',
    })}`;
    const json = await pega(url);
    if (!json?.entities) throw new Error('sem entities');
    return json.entities;
  });
  for (const id in bloco) {
    const l = bloco[id].labels;
    nomeDe.set(id, { pt: l?.['pt-br']?.value ?? l?.pt?.value ?? null, en: l?.en?.value ?? null });
  }
}

// ------------------------------------------------- peneira 2: visitas em pt

function janela() {
  const hoje = new Date();
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const ini = new Date(Date.UTC(fim.getUTCFullYear() - 1, fim.getUTCMonth(), 1));
  const carimbo = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}0100`;
  return [carimbo(ini), carimbo(fim)];
}
const [DE, ATE] = janela();

// so conta visita quem tem MusicBrainz: sem ele nao ha ficha na TheAudioDB
const paraContar = porTamanho
  .filter(c => claim(fichas.get(c.qid), 'P434').length)
  .slice(0, PRE_VISITAS);
console.log(`\nContando as visitas em pt de ${paraContar.length} artigos (${DE.slice(0, 6)} a ${ATE.slice(0, 6)})...`);
let contados = 0;
await emParalelo(paraContar, 4, async (c) => {
  c.views = await cached(`views-${c.qid}`, async () => {
    const url = `${METRICS}/${encodeURIComponent(c.titulo.replace(/ /g, '_'))}/monthly/${DE}/${ATE}`;
    const json = await pega(url);
    return (json?.items ?? []).reduce((s, i) => s + i.views, 0);
  });
  if (++contados % 250 === 0) process.stdout.write(`\r  ${contados}/${paraContar.length}`);
});
console.log(`\r  ${paraContar.length}/${paraContar.length}`);

const fila = paraContar
  .filter(c => c.views >= PISO_VISITAS)
  .sort((a, b) => b.views - a.views)
  .slice(0, TETO);
console.log(`  ${fila.length} passam do piso de ${PISO_VISITAS.toLocaleString('pt-BR')} visitas.`);

// ------------------------------------------------------------- TheAudioDB

/**
 * A chave publica de teste aguenta uns 30 pedidos por minuto. Um por vez, com
 * folga, e o cache faz a segunda rodada nao pedir nada.
 */
console.log(`\nBuscando a ficha de ${fila.length} bandas na TheAudioDB...`);
let buscados = 0;
for (const c of fila) {
  const mbid = melhor(claim(fichas.get(c.qid), 'P434'))?.mainsnak?.datavalue?.value;
  c.adb = await cached(`adb-${mbid}`, async () => {
    await sleep(2100);
    const json = await pega(`${AUDIODB}?i=${mbid}`);
    return json?.artists?.[0] ?? null;
  });
  if (++buscados % 25 === 0) process.stdout.write(`\r  ${buscados}/${fila.length}`);
}
console.log(`\r  ${fila.length}/${fila.length}`);

// ------------------------------------------------------------- MusicBrainz

/**
 * A TheAudioDB conhece mal o Brasil: Calcinha Preta, Raimundos, Los Hermanos e
 * quase toda dupla sertaneja vem sem formacao ou sem integrantes — e sao
 * exatamente as bandas que a sala conhece. E onde conhece, envelhece: da dois
 * integrantes ao Titas, que segue com tres, e deixa os Mamonas Assassinas na
 * ativa. O MusicBrainz tem a lista de membros com a data de saida de cada um e
 * a data de fim da banda, entao ele e lido para todas.
 *
 * Os integrantes sao quem esta na banda hoje, ou quem estava quando ela acabou.
 * O genero de cada um so e buscado onde a TheAudioDB nao disse a formacao.
 * Um integrante so conta como buraco: e o que a TheAudioDB grava para a
 * Maiara & Maraisa e para o Raca Negra, e grupo de um nao e grupo.
 */
const MB = 'https://musicbrainz.org/ws/2';
let ultimoMb = 0;
async function mb(caminho) {
  // o MusicBrainz pede no maximo um pedido por segundo, e bloqueia quem passa
  const espera = ultimoMb + 1100 - Date.now();
  if (espera > 0) await sleep(espera);
  ultimoMb = Date.now();
  // ID torto na Wikidata vira 400 aqui: sem ficha, e a banda segue com o que tem
  return pega(`${MB}/${caminho}${caminho.includes('?') ? '&' : '?'}fmt=json`, {}, 3).catch((err) => {
    console.log(`\n  MusicBrainz recusou ${caminho.slice(0, 60)}: ${err.message}`);
    return null;
  });
}

const regiao = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
// o genero de cada membro custa uma busca a mais: so vai quem a TheAudioDB
// deixou sem formacao
const semFormacao = new Set(fila.filter(c => !c.adb?.strGender).map(c => c.qid));
console.log(`\nLendo a formacao de ${fila.length} bandas no MusicBrainz...`);
let completados = 0;
for (const c of fila) {
  const mbid = melhor(claim(fichas.get(c.qid), 'P434'))?.mainsnak?.datavalue?.value;
  if (!mbid) continue;
  const querGenero = semFormacao.has(c.qid);
  c.mb = await cached(`mb3-${mbid}${querGenero ? '-g' : ''}`, async () => {
    const art = await mb(`artist/${mbid}?inc=artist-rels`);
    if (!art) return null;
    const vida = art['life-span'] ?? {};
    const fimBanda = vida.ended ? String(vida.end ?? '').slice(0, 4) : null;

    // um membro aparece uma vez por instrumento: junta tudo por pessoa
    const pessoas = new Map();
    for (const r of art.relations ?? []) {
      if (r.type !== 'member of band' || r.direction !== 'backward' || r.artist?.type !== 'Person') continue;
      const p = pessoas.get(r.artist.id) ?? { id: r.artist.id, atual: false, saida: null };
      if (!r.ended) p.atual = true;
      const saida = String(r.end ?? '').slice(0, 4);
      if (saida && (!p.saida || saida > p.saida)) p.saida = saida;
      pessoas.set(r.artist.id, p);
    }
    const lista = [...pessoas.values()];
    let formacao = fimBanda
      ? lista.filter(p => p.saida === fimBanda || p.atual)
      : lista.filter(p => p.atual);
    if (!formacao.length) formacao = [];

    let generos = [];
    if (formacao.length && querGenero) {
      const busca = await mb(`artist?limit=100&query=${encodeURIComponent(formacao.map(p => `arid:${p.id}`).join(' OR '))}`);
      const porId = new Map((busca?.artists ?? []).map(a => [a.id, a.gender?.toLowerCase() ?? null]));
      generos = formacao.map(p => porId.get(p.id) ?? null);
    }
    return {
      inicio: Number(String(vida.begin ?? '').slice(0, 4)) || null,
      // fim com alguem ainda na banda e fim de uma formacao, nao da banda: o
      // MusicBrainz encerra o Queen em 1991, e o May e o Taylor seguem nele
      encerrada: Boolean(vida.ended) && !lista.some(p => p.atual),
      pais: art.country ?? null,
      integrantes: formacao.length || null,
      generos,
    };
  });
  if (++completados % 25 === 0) process.stdout.write(`\r  ${completados}/${fila.length}`);
}
console.log(`\r  ${fila.length}/${fila.length}`);

// ------------------------------------------------ membros pela Wikidata

/**
 * O ultimo recurso para integrantes e formacao: quem a Wikidata diz ser membro,
 * pelos dois lados (a pessoa com P463 "membro de", a banda com P527 "tem
 * parte"), sem data de saida. E esparso — o Raimundos tem um membro so la —,
 * mas acerta onde as outras duas nao chegam: a Banda Calypso e a Joelma e o
 * Chimbinha. Com menos de dois, nao conta.
 */
const semMembros = fila.filter(c => !(Number(c.adb?.intMembers) > 1) && !(c.mb?.integrantes > 1)
  || (!c.adb?.strGender && !formacaoPorMembros(c.mb?.generos)));
const membrosWd = new Map();
if (semMembros.length) {
  const linhasMembros = await cached(loteSlug('membros', semMembros.map(c => c.qid)), async () => {
    const json = await pega(SPARQL, {
      method: 'POST',
      headers: { 'content-type': 'application/sparql-query', accept: 'application/sparql-results+json' },
      body: `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
SELECT ?b ?m ?g ?fim WHERE {
  VALUES ?b { ${semMembros.map(c => `wd:${c.qid}`).join(' ')} }
  { ?m p:P463 ?st . ?st ps:P463 ?b . OPTIONAL { ?st pq:P582 ?fim } }
  UNION
  { ?b p:P527 ?st . ?st ps:P527 ?m . OPTIONAL { ?st pq:P582 ?fim } }
  ?m wdt:P31 wd:Q5 .
  OPTIONAL { ?m wdt:P21 ?g }
}`,
    });
    if (json?.exception) throw new Error(String(json.exception).slice(0, 120));
    return json.results.bindings;
  });
  for (const l of linhasMembros) {
    if (l.fim) continue;
    const banda = l.b.value.split('/').pop();
    const m = membrosWd.get(banda) ?? new Map();
    const g = l.g?.value.split('/').pop();
    m.set(l.m.value, g === 'Q6581097' ? 'male' : g === 'Q6581072' ? 'female' : null);
    membrosWd.set(banda, m);
  }
}

/**
 * Dupla e trio a descricao ja diz ("dupla sertaneja brasileira", "trio
 * sertanejo"), e o nome com "&" tambem — e o que salva quase toda dupla
 * sertaneja, que nem a TheAudioDB nem o MusicBrainz conhecem por dentro.
 */
function integrantesPeloNome(nome, descricao) {
  const d = chave(descricao ?? '');
  if (/(dupla|duo)/.test(d) || / & /.test(nome)) return 2;
  if (/trio/.test(d)) return 3;
  return null;
}

/** Masculina, Feminina ou Mista pelo genero de quem esta na formacao — so com todos conhecidos. */
function formacaoPorMembros(generos) {
  if (!generos?.length || generos.some(g => g !== 'male' && g !== 'female')) return null;
  const tem = new Set(generos);
  return tem.size === 2 ? 'Mista' : tem.has('male') ? 'Masculina' : 'Feminina';
}

// ------------------------------------------------------------- montagem

/** Pais pelo nome que o leitor daqui usa. */
const PAIS_CURTO = {
  'Estados Unidos da América': 'Estados Unidos', 'Reino da Dinamarca': 'Dinamarca',
  'Reino dos Países Baixos': 'Países Baixos', 'República da Irlanda': 'Irlanda',
  // a Wikidata grava a nacao do Reino Unido em parte das fichas e o pais nas
  // outras; misturadas, Beatles e Queen nunca fechariam verde entre si
  'Alemanha Ocidental': 'Alemanha', Inglaterra: 'Reino Unido', 'Escócia': 'Reino Unido', 'País de Gales': 'Reino Unido', 'Irlanda do Norte': 'Reino Unido',
};

const FORMACAO = { Male: 'Masculina', Female: 'Feminina', Mixed: 'Mista' };

const roster = [];
const descarte = { semPais: 0, semAno: 0, semGenero: 0, semFormacao: 0, semIntegrantes: 0, semImagem: 0 };
for (const c of fila) {
  const f = fichas.get(c.qid);
  const adb = c.adb;
  const labels = f.labels ?? {};

  // o titulo do artigo em pt e o nome que o leitor daqui escreve, menos quando
  // vem com desambiguacao: "Nirvana (banda)" vira "Nirvana"
  const name = c.titulo.replace(/\s*\([^)]*\)\s*$/, '').trim();

  const paisId = valorId(melhor(claim(f, 'P495'))) ?? valorId(melhor(claim(f, 'P17')));
  const paisNome = nomeDe.get(paisId)?.pt ?? nomeDe.get(paisId)?.en ?? null;
  const doMb = c.mb?.pais ? regiao.of(c.mb.pais) : null;
  const country = PAIS_CURTO[paisNome ?? doMb] ?? paisNome ?? doMb;

  // fundacao: a Wikidata primeiro, a TheAudioDB so no buraco — ela grava o ano
  // em que o nome atual pegou (o Radiohead de 1991, nao o On a Friday de 1985)
  const inicio = todos(claim(f, 'P571')).map(anoDe).filter(Boolean);
  const formedYear = inicio.length ? Math.min(...inicio) : (Number(adb?.intFormedYear) || c.mb?.inicio || null);

  // generos: descricao primeiro (ela diz o principal), depois o P136, depois a
  // TheAudioDB. Tres no maximo, senao a celula fecha amarelo contra tudo
  // o P136 nao tem ordem: vale a familia que mais aparece nele. O Queen tem
  // seis generos de rock e um de pop, e e banda de rock
  const votos = new Map();
  for (const cl of todos(claim(f, 'P136'))) {
    const nome = nomeDe.get(valorId(cl));
    for (const id of familias(nome?.en ?? nome?.pt ?? '', { nucleo: true })) votos.set(id, (votos.get(id) ?? 0) + 1);
  }
  const doP136 = [...votos].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const daDescricao = familias(texto(f, 'descriptions'), { nucleo: true });
  // so o strGenre: o strStyle e prateleira de loja ("Rock/Pop", "Urban/R&B") e
  // punha o Metallica entre as bandas de pop
  const daAdb = familias(adb?.strGenre ?? "", { nucleo: true });
  const ordem = [...new Set([...daDescricao, ...doP136, ...daAdb])];
  // grupo coreano e K-pop antes de tudo, mesmo quando a descricao abre com
  // "boy band" — e o nome que a sala da, e o que separa o BTS dos Backstreet Boys
  if (ordem.includes('kpop')) ordem.splice(0, 0, ...ordem.splice(ordem.indexOf('kpop'), 1));
  // a TheAudioDB chama sertanejo de country; na mesma celula, o Country so repete
  if (ordem.includes('sertanejo') && ordem.includes('country')) ordem.splice(ordem.indexOf('country'), 1);
  const principal = ordem[0] ?? null;
  const genres = ordem.slice(0, 3).map(id => GENEROS.find(g => g.id === id).label);

  // a TheAudioDB primeiro; o MusicBrainz fecha o buraco (e o "1" dela, que e buraco tambem)
  const wd = [...(membrosWd.get(c.qid)?.values() ?? [])];
  const lineup = FORMACAO[adb?.strGender] ?? formacaoPorMembros(c.mb?.generos)
    ?? (wd.length > 1 ? formacaoPorMembros(wd) : null);
  // integrantes: a TheAudioDB grava a formacao que ficou (Beatles 4, Queen 4,
  // Pink Floyd 5). O MusicBrainz so no buraco: ele conta como atual quem morreu
  // sem ter a saida anotada, e da treze ao Lynyrd Skynyrd
  const members = Number(adb?.intMembers) > 1 ? Number(adb.intMembers)
    : c.mb?.integrantes > 1 ? c.mb.integrantes
    : integrantesPeloNome(name, texto(f, 'descriptions')) ?? (wd.length > 1 ? wd.length : null);

  // encerrada so quando as duas fontes nao discordam por reuniao: a TheAudioDB
  // marca `strDisbanded`, a Wikidata o P576 — e quem voltou (Oasis, Titas com a
  // formacao classica) tem data de fim mais antiga que a de volta
  const fim = todos(claim(f, 'P576')).map(anoDe).filter(Boolean);
  // o MusicBrainz entra porque as outras duas deixavam os Mamonas na ativa
  const encerrada = adb?.strDisbanded === 'Yes' || fim.length > 0 || Boolean(c.mb?.encerrada);
  const status = encerrada ? 'Encerrada' : 'Ativa';

  const commons = melhor(claim(f, 'P18'))?.mainsnak?.datavalue?.value ?? null;
  const thumb = adb?.strArtistThumb || null;
  const sprite = thumb ? `${thumb}/small`
    : commons ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons)}?width=256` : null;
  const artwork = thumb ? `${thumb}/medium`
    : commons ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons)}?width=640` : null;

  const item = {
    id: Number(c.qid.slice(1)),
    name,
    group: GRUPO_DO_GENERO[principal] ?? null,
    // o indice da opcao de `scope` (Origem) no schema: 0 nacional, 1 de fora
    origin: country === 'Brasil' ? 0 : 1,
    genres,
    country,
    lineup,
    members,
    formedYear,
    status,
    sprite,
    artwork,
  };
  const apelidos = [labels.pt?.value, labels['pt-br']?.value, labels.en?.value, adb?.strArtist]
    .filter(a => a && a !== name);
  if (apelidos.length) item.aliases = [...new Set(apelidos)];

  if (!country) descarte.semPais++;
  if (!formedYear) descarte.semAno++;
  if (!principal) descarte.semGenero++;
  if (!lineup) descarte.semFormacao++;
  if (!members) descarte.semIntegrantes++;
  if (!sprite) descarte.semImagem++;
  item.eligible = Boolean(country && formedYear && principal && lineup && members && sprite);
  roster.push(item);
}

// ------------------------------------------------------------- relatorio

const total = roster.length;
const elegiveis = roster.filter(p => p.eligible);
console.log(`\n${elegiveis.length} sorteaveis de ${total}. Faltas:`, JSON.stringify(descarte));

const tally = (label, pick) => {
  const counts = {};
  for (const p of elegiveis) for (const v of [pick(p)].flat()) counts[v] = (counts[v] ?? 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 18);
  console.log(`${label}:`, JSON.stringify(Object.fromEntries(top)));
};
tally('Grupo', p => p.group);
tally('Generos na celula', p => p.genres);
tally('Pais', p => p.country);
tally('Formacao', p => p.lineup);
tally('Integrantes', p => p.members);
tally('Estado', p => p.status);
tally('Decada', p => `${Math.floor(p.formedYear / 10) * 10}s`);

// so as jogaveis vao para o arquivo: banda com lacuna na ficha nao vira
// segredo nem chute, entao guarda-la seria so peso no repositorio
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(elegiveis));
console.log(`\nPronto: ${elegiveis.length} bandas -> data/bandas.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
