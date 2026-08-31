/**
 * Baixa a valorant-api e gera data/valorant.json.
 *   npm run build:valorant
 *
 * Fontes:
 *  - https://valorant-api.com (aberta, sem chave, com traducao pt-BR): funcao,
 *    nome e as imagens.
 *  - Wiki do Valorant, `Template:Agent Infobox Shortcut` — uma pagina so com a
 *    ficha de todos os agentes: raca, pronome, origem e data de estreia.
 *
 * A ficha do wiki entrou porque a valorant-api so tem numeros de jogo. As
 * colunas antigas "Habilidades" (4 ou 5) e "Passiva" (sim ou nao) diziam a
 * mesma coisa duas vezes — quem tem 5 habilidades e exatamente quem tem
 * passiva — e nenhuma das duas era conhecimento de jogador.
 *
 * A API oficial da Riot (developer.riotgames.com) exige chave que expira em
 * 24h e nao expoe dados de agentes — por isso usamos estas.
 *
 * Gera dois arquivos: agentes e armas (custo, dano, cadencia, pente,
 * penetracao — deducao de verdade).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://valorant-api.com/v1';
const WIKI = 'https://valorant.fandom.com/api.php';
const ROOT = path.resolve(process.cwd());
const OUT_AGENTS = path.join(ROOT, 'data', 'valorant.json');
const OUT_WEAPONS = path.join(ROOT, 'data', 'valorant-armas.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'valorant');

await fs.mkdir(CACHE_DIR, { recursive: true });

async function getJSON(name, url) {
  const file = path.join(CACHE_DIR, `${name}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.writeFile(file, text);
      return JSON.parse(text);
    } catch (err) {
      if (attempt === 4) throw new Error(`${name}: ${err.message}`);
      await new Promise(r => setTimeout(r, 500 * attempt * attempt));
    }
  }
}

const ROLE_GROUP = {
  Duelista: 'duelista', Iniciador: 'iniciador',
  Controlador: 'controlador', Sentinela: 'sentinela',
};

/**
 * Continente de cada pais de origem. Vai junto do pais na mesma celula: acertar
 * o pais fecha verde, acertar so o continente fecha amarelo.
 */
const CONTINENT = {
  Ghana: 'Africa', Morocco: 'Africa', Senegal: 'Africa',
  Sweden: 'Europe', France: 'Europe', 'United Kingdom': 'Europe',
  Norway: 'Europe', Germany: 'Europe', Croatia: 'Europe', Russia: 'Europe',
  'Türkiye': 'Europe',
  Japan: 'Asia', India: 'Asia', China: 'Asia', 'South Korea': 'Asia',
  Philippines: 'Asia', Thailand: 'Asia',
  'United States': 'North America', Mexico: 'North America',
  Brazil: 'South America', Colombia: 'South America',
  Australia: 'Oceania',
};

console.log('Baixando agentes da valorant-api...\n');

const agents = await getJSON('agents', `${API}/agents?language=pt-BR&isPlayableCharacter=true`);
console.log(`  ${agents.data.length} agentes jogaveis`);

console.log('\nLendo a ficha dos agentes no wiki...');
const infoboxes = await getJSON('fichas', `${WIKI}?${new URLSearchParams({
  format: 'json', formatversion: '2', action: 'query', prop: 'revisions',
  rvprop: 'content', rvslots: 'main', titles: 'Template:Agent Infobox Shortcut',
})}`);
const wikitext = infoboxes.query.pages[0].revisions[0].slots.main.content;

/** Tira link, template de bandeira, aspas e o asterisco de nota de rodape. */
const clean = (value) => String(value)
  .replace(/\{\{[^{}]*\}\}/g, '')
  .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
  .replace(/\[\[([^\]]*)\]\]/g, '$1')
  .replace(/["*]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const fichas = new Map();
for (const [, name, body] of wikitext.matchAll(/\n\|([^=\n]+)=\{\{Infobox agent\n([\s\S]*?)\n\}\}/g)) {
  const field = (key) => clean(body.match(new RegExp(`^\\|\\s*${key}\\s*=(.*)$`, 'm'))?.[1] ?? '');
  // "{{fi|KR}} Seoul, South Korea" -> "South Korea"; o KAY/O e o Omen nao vem
  // de pais nenhum ("Alpha Earth") e ficam so com o proprio lugar
  const origin = field('origin').split(',').pop().trim();
  fichas.set(name.trim(), {
    race: field('race') || 'Unknown',
    gender: field('pronouns').split('/')[0] || null,
    origin: origin || 'Unknown',
    // os agentes do beta fechado nao tem data: sairam com o jogo, em 2020
    releaseYear: Number(field('added').match(/\b(20\d\d)\b/)?.[1]) || 2020,
  });
}
console.log(`  ${fichas.size} fichas lidas`);

const roster = agents.data.map((a, index) => {
  const role = a.role?.displayName ?? null;
  const ficha = fichas.get(a.displayName) ?? {};

  const item = {
    id: index + 1,
    sourceId: a.uuid,
    name: a.displayName,
    group: ROLE_GROUP[role] ?? 'outros',
    role,
    gender: ficha.gender ?? null,
    race: ficha.race ?? null,
    origin: [ficha.origin, CONTINENT[ficha.origin]].filter(Boolean),
    releaseYear: ficha.releaseYear ?? null,
    sprite: a.displayIcon ?? a.displayIconSmall ?? null,
    artwork: a.fullPortrait ?? a.displayIcon ?? null,
  };

  item.eligible = Boolean(
    item.name && item.role && item.sprite
    && item.gender && item.race && item.origin.length && item.releaseYear,
  );
  return item;
});

const total = roster.length;
const coverage = (label, predicate) => {
  const faltam = roster.filter(c => !predicate(c));
  console.log(`  ${label.padEnd(14)} ${String(total - faltam.length).padStart(3)}/${total}`
    + (faltam.length ? `  (sem: ${faltam.map(c => c.name).join(', ')})` : ''));
};

console.log(`\nCobertura dos campos (${total} agentes):`);
coverage('funcao', c => c.role);
coverage('genero', c => c.gender);
coverage('raca', c => c.race);
coverage('origem', c => c.origin.length);
coverage('lancamento', c => c.releaseYear);
coverage('imagem', c => c.sprite);
coverage('sorteavel', c => c.eligible);

const porFuncao = {};
for (const c of roster) porFuncao[c.group] = (porFuncao[c.group] ?? 0) + 1;
console.log('\nPor funcao:', JSON.stringify(porFuncao));
const conta = (key) => {
  const m = new Map();
  for (const c of roster) for (const v of [].concat(c[key] ?? [])) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v}(${n})`).join(', ');
};
console.log('Racas:', conta('race'));
console.log('Origens:', conta('origin'));

await fs.mkdir(path.dirname(OUT_AGENTS), { recursive: true });
await fs.writeFile(OUT_AGENTS, JSON.stringify(roster));
console.log(`\nPronto: ${total} agentes -> data/valorant.json (${Math.round((await fs.stat(OUT_AGENTS)).size / 1024)} KB)`);

// ------------------------------------------------------------ armas

console.log('\nBaixando armas...');
const weapons = await getJSON('weapons', `${API}/weapons?language=pt-BR`);

const PENETRATION_PT = { Low: 'Baixa', Medium: 'Média', High: 'Alta' };
const penetrationOf = (value) => PENETRATION_PT[String(value ?? '').split('::').pop()] ?? null;

/** "Fuzis de Assalto" -> "fuzis-de-assalto" */
const slug = (text) => String(text ?? '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'outros';

const armas = weapons.data
  .filter(w => w.shopData?.categoryText)   // tira o corpo a corpo, que nao tem categoria nem custo
  .map((w, index) => {
  const stats = w.weaponStats ?? {};
  const shop = w.shopData ?? {};
  const item = {
    id: index + 1,
    sourceId: w.uuid,
    name: w.displayName,
    group: slug(shop.categoryText),
    category: shop.categoryText ?? null,
    cost: shop.cost ?? null,
    bodyDamage: stats.damageRanges?.[0]?.bodyDamage ?? null,
    fireRate: stats.fireRate ?? null,
    magazineSize: stats.magazineSize ?? null,
    penetration: penetrationOf(stats.wallPenetration),
    sprite: w.displayIcon ?? null,
    artwork: w.displayIcon ?? null,
  };
  item.eligible = Boolean(item.name && item.category && item.sprite);
  return item;
});

const porCategoria = {};
for (const a of armas) porCategoria[a.group] = (porCategoria[a.group] ?? 0) + 1;
console.log(`  ${armas.length} armas, ${armas.filter(a => a.eligible).length} sorteaveis`);
console.log('  por categoria:', JSON.stringify(porCategoria));

await fs.writeFile(OUT_WEAPONS, JSON.stringify(armas));
console.log(`Pronto: ${armas.length} armas -> data/valorant-armas.json (${Math.round((await fs.stat(OUT_WEAPONS)).size / 1024)} KB)`);
