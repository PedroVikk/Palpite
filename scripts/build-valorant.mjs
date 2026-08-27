/**
 * Baixa a valorant-api e gera data/valorant.json.
 *   npm run build:valorant
 *
 * Fonte: https://valorant-api.com (aberta, sem chave, com traducao pt-BR).
 * A API oficial da Riot (developer.riotgames.com) exige chave que expira em
 * 24h e nao expoe dados de agentes — por isso usamos esta.
 *
 * Gera dois arquivos: agentes (poucos atributos comparaveis, rodadas curtas)
 * e armas (custo, dano, cadencia, pente, penetracao — deducao de verdade).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://valorant-api.com/v1';
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

console.log('Baixando agentes da valorant-api...\n');

const agents = await getJSON('agents', `${API}/agents?language=pt-BR&isPlayableCharacter=true`);
console.log(`  ${agents.data.length} agentes jogaveis`);

const roster = agents.data.map((a, index) => {
  const role = a.role?.displayName ?? null;
  const abilities = (a.abilities ?? []).filter(h => h.displayName);

  const item = {
    id: index + 1,
    sourceId: a.uuid,
    name: a.displayName,
    group: ROLE_GROUP[role] ?? 'outros',
    role,
    tags: Array.isArray(a.characterTags) ? a.characterTags : [],
    abilities: abilities.length,
    // passiva e um diferencial raro entre os agentes
    passive: abilities.some(h => h.slot === 'Passive') ? 'Sim' : 'Não',
    sprite: a.displayIcon ?? a.displayIconSmall ?? null,
    artwork: a.fullPortrait ?? a.displayIcon ?? null,
  };

  item.eligible = Boolean(item.name && item.role && item.sprite);
  return item;
});

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(3)}/${total}`);
};

console.log(`\nCobertura dos campos (${total} agentes):`);
coverage('funcao', c => c.role);
coverage('tags', c => c.tags.length);
coverage('passiva', c => c.passive === 'Sim');
coverage('imagem', c => c.sprite);
coverage('sorteavel', c => c.eligible);

const porFuncao = {};
for (const c of roster) porFuncao[c.group] = (porFuncao[c.group] ?? 0) + 1;
console.log('\nPor funcao:', JSON.stringify(porFuncao));
console.log('Habilidades por agente:', JSON.stringify([...new Set(roster.map(c => c.abilities))].sort()));

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
