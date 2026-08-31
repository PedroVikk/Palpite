/**
 * Baixa a Dattebayo API e gera data/naruto.json.
 *   npm run build:naruto
 *
 * A base publica e https://dattebayo-api.onrender.com (o dominio .vercel.app
 * serve so a documentacao). Sao 1431 personagens em paginas de 100.
 *
 * Os retratos que ela indica envelhecem: a Narutopedia renomeia e apaga
 * arquivos e a API segue servindo o link antigo. Por isso, antes de escrever o
 * dataset, cada imagem e conferida e as mortas dao lugar ao retrato atual da
 * propria wiki.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const API = 'https://dattebayo-api.onrender.com';
const WIKI = 'https://naruto.fandom.com/api.php';
const UA = { 'User-Agent': 'palpite-build/1.0 (+https://github.com/PedroVikk)' };
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'naruto.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'naruto');
const PAGE_SIZE = 100;

await fs.mkdir(CACHE_DIR, { recursive: true });

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

// ------------------------------------------------------------ retratos

/**
 * Confere por HEAD se cada retrato ainda existe. Nao da para adivinhar quais
 * apodreceram sem perguntar, entao vao todos — mas o veredito fica no cache,
 * junto das paginas, e so as URLs novas sao checadas na proxima vez.
 */
async function checarImagens(urls) {
  const file = path.join(CACHE_DIR, 'imagens_vivas.json');
  let veredito = {};
  try {
    veredito = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}

  const faltando = urls.filter(url => veredito[url] === undefined);
  if (!faltando.length) return veredito;

  let cursor = 0;
  let feitas = 0;
  const worker = async () => {
    while (cursor < faltando.length) {
      const url = faltando[cursor++];
      try {
        const res = await fetch(url, { method: 'HEAD', headers: UA, signal: AbortSignal.timeout(15_000) });
        veredito[url] = res.ok;
      } catch {
        veredito[url] = false;
      }
      if (++feitas % 50 === 0) process.stdout.write(`\r  ${feitas}/${faltando.length}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  process.stdout.write(`\r  ${feitas}/${faltando.length}\n`);

  await fs.writeFile(file, JSON.stringify(veredito));
  return veredito;
}

/**
 * Retrato atual de cada pagina da Narutopedia (prop=pageimages, o mesmo caminho
 * do build do Hunter x Hunter). O MediaWiki normaliza o titulo e segue
 * redirecionamento, entao o mapa desfaz os dois saltos: ele volta com o nome
 * que entrou, nao com o titulo final da pagina.
 */
async function retratosDaWiki(nomes) {
  const retratos = new Map();
  const lotes = Array.from(
    { length: Math.ceil(nomes.length / 50) },
    (_, i) => nomes.slice(i * 50, i * 50 + 50),
  );

  for (const [i, lote] of lotes.entries()) {
    process.stdout.write(`\r  lote ${i + 1}/${lotes.length}`);
    const joined = lote.join('|');
    const slug = createHash('sha1').update(joined).digest('hex').slice(0, 12);
    const file = path.join(CACHE_DIR, `retratos_${slug}.json`);

    let json;
    try {
      json = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      const params = new URLSearchParams({
        action: 'query', prop: 'pageimages', pithumbsize: '400',
        titles: joined, redirects: '1', format: 'json',
      });
      const res = await fetch(`${WIKI}?${params}`, { headers: UA });
      if (!res.ok) throw new Error(`Narutopedia: HTTP ${res.status}`);
      json = await res.json();
      await fs.writeFile(file, JSON.stringify(json));
    }

    const daNormalizacao = new Map((json.query?.normalized ?? []).map(n => [n.to, n.from]));
    const doRedirect = new Map((json.query?.redirects ?? []).map(r => [r.to, r.from]));
    for (const page of Object.values(json.query?.pages ?? {})) {
      if (!page.thumbnail?.source) continue;
      const antes = doRedirect.get(page.title) ?? page.title;
      retratos.set(daNormalizacao.get(antes) ?? antes, page.thumbnail.source);
    }
  }
  process.stdout.write('\n');
  return retratos;
}

// ------------------------------------------------------------ parsing

/** Remove notas como "(Anime only)" / "(Affinity)" e espacos duplicados. */
const tidy = (text) => String(text ?? '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

const asList = (value) => {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  return [...new Set(list.map(tidy).filter(Boolean))];
};

const clean = (value) => {
  const text = tidy(value);
  return text && !/^(unknown|n\/a|none)$/i.test(text) ? text : null;
};

/** Campos como height/ninjaRank vem por arco; pegamos o mais recente disponivel. */
const ARC_ORDER = ['Blank Period', 'Part II', 'Gaiden', 'Part I', 'Academy Graduate'];
function byArc(value) {
  if (!value || typeof value !== 'object') return clean(value);
  for (const arc of ARC_ORDER) if (value[arc]) return clean(value[arc]);
  const first = Object.values(value)[0];
  return first ? clean(first) : null;
}

/** "145.3cm - 147.5cm" / "166cm" -> 145.3 / 166 */
function heightCm(value) {
  const text = byArc(value);
  const match = String(text ?? '').match(/([\d.]+)\s*cm/i);
  const n = match ? Number(match[1]) : NaN;
  return Number.isFinite(n) ? n : null;
}

const chapterOf = (text) => {
  const match = String(text ?? '').match(/chapter\s*#?\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

/** "Hyūga,Uzumaki Clan" -> ["Hyūga", "Uzumaki"] */
const clanList = (value) =>
  asList(String(value ?? '').split(',')).map(name => name.replace(/\s*Clan$/i, '')).filter(Boolean);

/**
 * Campo em branco na Narutopedia nao e falta de dado, e a resposta: a ficha so
 * lista cla, natureza ou classificacao quando o personagem tem. Sem um valor
 * explicito a celula ficaria cinza de "sem dado" para dois terços do elenco —
 * e duas pessoas sem cla nenhum nunca fechariam verde entre si.
 */
const orElse = (list, fallback) => (list.length ? list : [fallback]);

/**
 * A ficha so escreve `status` para quem morreu; quem esta vivo nao tem o campo.
 * "Presumed Deceased" e "Incapacitated" contam como morto — quem sumiu do
 * mangao nao volta como resposta certa de "vivo".
 */
const statusOf = (value) => (/deceased|incapacitated/i.test(String(value ?? '')) ? 'Morto' : 'Vivo');

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

const roster = raw.map((c, index) => {
  const personal = c.personal ?? {};
  const affiliation = asList(personal.affiliation);

  const item = {
    id: index + 1,
    sourceId: c.id,
    name: tidy(c.name),
    group: groupOf(affiliation),
    // a ficha de quem muda de forma vem com o icone junto:
    // "File:Gender Various.svg Various"
    gender: clean(String(personal.sex ?? '').replace(/^File:.*?\.(?:svg|png|jpg)\s*/i, '')),
    clan: orElse(clanList(personal.clan), 'Sem clã'),
    affiliation,
    classification: orElse(asList(personal.classification), 'Nenhuma'),
    natureType: orElse(asList(c.natureType), 'Nenhuma'),
    ninjaRank: byArc(c.rank?.ninjaRank) ?? 'Desconhecida',
    status: statusOf(personal.status),
    debutChapter: chapterOf(c.debut?.manga),
    // altura nao e coluna de dica (ninguem sabe que o Kakashi tem 181cm), mas
    // e o melhor sinal de que a ficha do personagem esta completa
    height: heightCm(personal.height),
    sprite: c.images?.[0] ?? null,
    artwork: c.images?.[0] ?? null,
  };
  return item;
});

// ------------------------------------------------------- conserto de imagens

console.log('\nConferindo os retratos indicados pela API...');
const veredito = await checarImagens([...new Set(roster.map(c => c.sprite).filter(Boolean))]);

const quebrados = roster.filter(c => c.sprite && !veredito[c.sprite]);
console.log(`  ${quebrados.length} fora do ar`);

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

// so quem tem dados completos pode ser sorteado como segredo; qualquer um
// continua valendo como chute. Vem depois do conserto porque a imagem conta.
for (const item of roster) {
  item.eligible = Boolean(
    item.gender && item.affiliation.length && item.debutChapter != null &&
    item.height != null && item.sprite,
  );
}

// ------------------------------------------------------------ cobertura

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(16)} ${String(n).padStart(4)}/${total}  (${Math.round(n / total * 100)}%)`);
};

console.log(`\nCobertura dos campos (${total} personagens):`);
coverage('genero', c => c.gender);
coverage('cla', c => c.clan[0] !== 'Sem clã');
coverage('afiliacao', c => c.affiliation.length);
coverage('classificacao', c => c.classification[0] !== 'Nenhuma');
coverage('natureza', c => c.natureType[0] !== 'Nenhuma');
coverage('patente', c => c.ninjaRank !== 'Desconhecida');
coverage('morto', c => c.status === 'Morto');
coverage('cap. estreia', c => c.debutChapter != null);
coverage('altura', c => c.height != null);
coverage('imagem', c => c.sprite);
coverage('sorteavel', c => c.eligible);

const porGrupo = {};
for (const c of roster) if (c.eligible) porGrupo[c.group] = (porGrupo[c.group] ?? 0) + 1;
console.log('\nSorteaveis por vila:', JSON.stringify(porGrupo));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} personagens -> data/naruto.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
