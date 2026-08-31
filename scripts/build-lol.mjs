/**
 * Baixa os campeoes de League of Legends e gera data/lol.json.
 *   npm run build:lol
 *
 * Duas fontes, porque nenhuma sozinha da conta:
 *  - Data Dragon (https://ddragon.leagueoflegends.com): aberto, sem chave, em
 *    pt-BR — nome, classe e as imagens.
 *  - Wiki de LoL (leagueoflegends.fandom.com), via API do MediaWiki: o
 *    `Module:ChampionData/data` traz posicao, recurso, alcance e ano de
 *    lancamento; a ficha `{{Champion bio}}` de cada pagina traz especie,
 *    pronome e regiao.
 *
 * As notas de Ataque/Magia/Defesa/Dificuldade do Data Dragon ficaram de fora de
 * proposito: sao rotulos de 1 a 10 que ninguem sabe de cabeca, e como dica so
 * davam chute no escuro. O conjunto de colunas segue o do LoLdle.
 *
 * A API de developer.riotgames.com exige chave que expira em 24h e serve dados
 * de partidas, nao a ficha dos campeoes — por isso o Data Dragon.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const DDRAGON = 'https://ddragon.leagueoflegends.com';
const WIKI = 'https://leagueoflegends.fandom.com/api.php';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'lol.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'lol');

await fs.mkdir(CACHE_DIR, { recursive: true });

async function fetchText(name, url) {
  const file = path.join(CACHE_DIR, name);
  try {
    return await fs.readFile(file, 'utf8');
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'palpite-dataset/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.writeFile(file, text);
      return text;
    } catch (err) {
      if (attempt === 4) throw new Error(`${name}: ${err.message}`);
      await new Promise(r => setTimeout(r, 500 * attempt * attempt));
    }
  }
}

const getJSON = async (name, url) => JSON.parse(await fetchText(`${name}.json`, url));
const wiki = (name, params) =>
  getJSON(name, `${WIKI}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`);

// -------------------------------------------------------------- wikitexto

/** Recorta o corpo do primeiro infobox que existir, respeitando {{ }} aninhado. */
function sliceTemplate(wikitext, names) {
  for (const name of names) {
    const start = wikitext.indexOf(`{{${name}`);
    if (start < 0) continue;
    let depth = 0;
    for (let i = start; i < wikitext.length; i++) {
      if (wikitext.startsWith('{{', i)) { depth++; i++; continue; }
      if (wikitext.startsWith('}}', i)) {
        depth--; i++;
        if (!depth) return wikitext.slice(start + 2, i - 1);
      }
    }
  }
  return null;
}

/**
 * Separa os parametros do infobox. Nao da para quebrar no `|` cru: metade das
 * paginas escreve a ficha inteira em uma linha so, e ha `|` dentro de
 * [[link|texto]], {{template|arg}} e das legendas da <gallery>. Entao a quebra
 * respeita a profundidade, e a galeria sai antes.
 */
function infoboxParams(body) {
  const stripped = body
    .replace(/<gallery>[\s\S]*?<\/gallery>/g, '')
    .replace(/<ref[\s\S]*?(?:\/>|<\/ref>)/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < stripped.length; i++) {
    if (stripped.startsWith('{{', i) || stripped.startsWith('[[', i)) { depth++; i++; continue; }
    if (stripped.startsWith('}}', i) || stripped.startsWith(']]', i)) { depth--; i++; continue; }
    if (stripped[i] === '|' && depth <= 0) { parts.push(stripped.slice(start, i)); start = i + 1; }
  }
  parts.push(stripped.slice(start));

  const out = {};
  for (const chunk of parts.slice(1)) {        // parts[0] e o nome do campeao
    const eq = chunk.indexOf('=');
    if (eq > 0) out[chunk.slice(0, eq).trim()] = chunk.slice(eq + 1).trim();
  }
  return out;
}

/** Tira link, template de icone, negrito e nota de rodape de um valor. */
const clean = (value) => value
  // o {{tt|texto|explicacao}} vem antes do <small>, senao a explicacao (que
  // tem <small> dentro) leva junto o fim do template e sobra so lixo
  .replace(/\{\{tt\|([^|}]+)[^}]*\}\}/gi, '$1')
  .replace(/<small>[\s\S]*?<\/small>/g, '')
  .replace(/\{\{[Ff]i\|([^|}]+)[^}]*\}\}/g, '$1')
  .replace(/\{\{[^{}]*\}\}/g, '')
  .replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '$1')
  .replace(/'''?/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Valores de um campo, um por item da lista. O wiki risca o que deixou de valer
 * (`<s>ex-regiao</s>`) — isso sai fora: a dica e sobre o que o campeao e hoje.
 */
function values(raw) {
  if (!raw) return [];
  const lines = raw.split(/\n|<br\s*\/?>/);
  const bullets = lines.filter(l => l.trimStart().startsWith('*'));
  const items = bullets.length ? bullets.map(l => l.replace(/^\s*\*+/, '')) : lines;
  return [...new Set(items.filter(v => !/<s>/.test(v)).map(clean).filter(Boolean))];
}

// -------------------------------------------------------------- traducoes

const POSITION_PT = {
  Top: 'Topo', Jungle: 'Selva', Middle: 'Meio', Bottom: 'Atirador', Support: 'Suporte',
};

/**
 * O wiki escreve a regiao com o nome da pagina, e algumas tem duas grafias para
 * o mesmo lugar (Targon / Mount Targon; Blessed Isles e o nome das Shadow Isles
 * antes da Ruina).
 */
const REGION_ALIAS = {
  'Mount Targon': 'Targon',
  'Blessed Isles': 'Shadow Isles',
  'the Void': 'Void',
  'The Void': 'Void',
};

/**
 * Regioes conhecidas. Serve so para o plano B de quem tem o campo `region`
 * vazio na ficha (o Smolder): dai vale a regiao que aparece na origem.
 */
const REGIONS = new Set([
  'Ionia', 'Noxus', 'Demacia', 'Freljord', 'Shurima', 'Piltover', 'Zaun',
  'Bilgewater', 'Ixtal', 'Targon', 'Shadow Isles', 'Bandle City', 'Void',
  'Runeterra', 'Camavor', 'Icathia', 'Kathkan',
]);

/**
 * Seis fichas nao respondem o pronome: Xerath, Jinx, Mel e Ambessa nao tem o
 * campo, o Nunu deixa em branco e o Rammus responde "Rolling/Spinning".
 */
const GENDER_FALLBACK = {
  Rammus: 'It', Nunu: 'He', Xerath: 'He', Jinx: 'She', Mel: 'She', Ambessa: 'She',
};

// ------------------------------------------------------------------ dados

console.log('Baixando campeoes do Data Dragon...\n');

const versions = await getJSON('versions', `${DDRAGON}/api/versions.json`);
const version = versions[0];
console.log(`  versao ${version}`);

const champions = await getJSON(`champion_${version}`, `${DDRAGON}/cdn/${version}/data/pt_BR/champion.json`);
const list = Object.values(champions.data);
console.log(`  ${list.length} campeoes`);

console.log('\nLendo o Module:ChampionData/data do wiki...');
const dataModule = await wiki('championdata', {
  action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
  titles: 'Module:ChampionData/data',
});
const lua = dataModule.query.pages[0].revisions[0].slots.main.content;

const starts = [...lua.matchAll(/^ {2}\["([^"]+)"\] = \{$/gm)];
const field = (block, key) => block.match(new RegExp(`\\["${key}"\\]\\s*=\\s*"([^"]*)"`))?.[1] ?? null;

const byApiName = new Map();
for (const [i, match] of starts.entries()) {
  const block = lua.slice(match.index, starts[i + 1]?.index ?? lua.length);
  const apiname = field(block, 'apiname');
  // "Mega Gnar" e "Kled & Skaarl" sao formas, nao campeoes: para cada apiname
  // vale o primeiro bloco, que e o do campeao
  if (!apiname || byApiName.has(apiname)) continue;
  byApiName.set(apiname, {
    wikiKey: match[1],
    rangeType: field(block, 'rangetype'),
    resource: field(block, 'resource'),
    releaseYear: Number(field(block, 'date')?.slice(0, 4)) || null,
    positions: [...(block.match(/\["client_positions"\]\s*=\s*\{([^}]*)\}/)?.[1] ?? '')
      .matchAll(/"([^"]+)"/g)].map(m => POSITION_PT[m[1]] ?? m[1]),
  });
}
console.log(`  ${byApiName.size} campeoes no modulo`);

console.log('\nBaixando a ficha de lore de cada campeao...');
const wikiKeys = [...byApiName.values()].map(c => c.wikiKey);
const bios = new Map();
for (let i = 0; i < wikiKeys.length; i += 50) {
  const slice = wikiKeys.slice(i, i + 50);
  const page = await wiki(`bios_${i}`, {
    action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
    redirects: '1', titles: slice.join('|'),
  });
  // com redirects=1 o titulo volta trocado (Nunu & Willump -> Nunu)
  const backwards = new Map((page.query.redirects ?? []).map(r => [r.to, r.from]));
  for (const p of page.query.pages ?? []) {
    if (p.missing) continue;
    const body = sliceTemplate(p.revisions[0].slots.main.content, ['Champion bio', 'Arcane character']);
    if (!body) continue;
    const params = infoboxParams(body);
    for (const key of [p.title, backwards.get(p.title)].filter(Boolean)) bios.set(key, params);
  }
  process.stdout.write(`  ${Math.min(i + 50, wikiKeys.length)}/${wikiKeys.length}\r`);
}
console.log(`  ${bios.size} fichas lidas   `);

// ----------------------------------------------------------------- roster

const roster = list.map((c, index) => {
  const data = byApiName.get(c.id) ?? {};
  const bio = bios.get(data.wikiKey) ?? {};

  const pronoun = values(bio.pronoun)[0] ?? '';
  const gender = pronoun.match(/^(He|She|They|It)\b/)?.[1] ?? GENDER_FALLBACK[c.id] ?? null;

  const named = (raw) => values(raw).map(r => REGION_ALIAS[r] ?? r).filter(r => REGIONS.has(r));
  // ficha com `region` em branco (o Smolder) cai para a regiao de onde ele veio
  const regions = named(bio.region).length ? named(bio.region) : named(bio.originplace);

  const item = {
    id: index + 1,
    key: c.id,
    name: c.name,
    aliases: [c.id],                       // busca tambem pelo id em ingles (ex.: Wukong -> MonkeyKing)
    group: (c.tags?.[0] ?? 'outros').toLowerCase(),
    gender,
    positions: data.positions ?? [],
    // a ficha oscila entre singular e plural para a mesma especie
    species: values(bio.species).map(s => ({ 'Spirit Gods': 'Spirit God', Dogs: 'Dog' })[s] ?? s),
    resource: data.resource ?? null,
    rangeType: data.rangeType ?? null,
    regions: [...new Set(regions)],
    releaseYear: data.releaseYear ?? null,
    sprite: `${DDRAGON}/cdn/${version}/img/champion/${c.image?.full ?? `${c.id}.png`}`,
    artwork: `${DDRAGON}/cdn/img/champion/loading/${c.id}_0.jpg`,
  };

  item.eligible = Boolean(
    item.name && item.gender && item.positions.length && item.species.length
    && item.resource && item.rangeType && item.regions.length && item.releaseYear,
  );
  return item;
});

const total = roster.length;
const cobertura = (label, predicate) => {
  const faltam = roster.filter(c => !predicate(c));
  console.log(`  ${label.padEnd(12)} ${String(total - faltam.length).padStart(3)}/${total}`
    + (faltam.length ? `  (sem: ${faltam.map(c => c.name).join(', ')})` : ''));
};

console.log(`\nCobertura dos campos (${total} campeoes):`);
cobertura('genero', c => c.gender);
cobertura('posicoes', c => c.positions.length);
cobertura('especie', c => c.species.length);
cobertura('recurso', c => c.resource);
cobertura('alcance', c => c.rangeType);
cobertura('regiao', c => c.regions.length);
cobertura('lancamento', c => c.releaseYear);
cobertura('sorteavel', c => c.eligible);

const conta = (key) => {
  const m = new Map();
  for (const c of roster) for (const v of [].concat(c[key] ?? [])) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v}(${n})`).join(', ');
};
console.log('\nEspecies:', conta('species'));
console.log('\nRegioes:', conta('regions'));
console.log('\nRecursos:', conta('resource'));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} campeoes -> data/lol.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
