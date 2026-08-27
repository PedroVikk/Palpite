/**
 * Baixa o Data Dragon da Riot e gera data/lol.json.
 *   npm run build:lol
 *
 * Fonte: https://ddragon.leagueoflegends.com (aberta, sem chave, com pt_BR).
 * A API de developer.riotgames.com exige chave que expira em 24h e serve
 * dados de partidas, nao a ficha dos campeoes — o Data Dragon e o caminho.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const DDRAGON = 'https://ddragon.leagueoflegends.com';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'lol.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'lol');

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

const ROLE_PT = {
  Assassin: 'Assassino', Fighter: 'Lutador', Mage: 'Mago',
  Marksman: 'Atirador', Support: 'Suporte', Tank: 'Tanque',
};

console.log('Baixando campeoes do Data Dragon...\n');

const versions = await getJSON('versions', `${DDRAGON}/api/versions.json`);
const version = versions[0];
console.log(`  versao ${version}`);

const champions = await getJSON(`champion_${version}`, `${DDRAGON}/cdn/${version}/data/pt_BR/champion.json`);
const list = Object.values(champions.data);
console.log(`  ${list.length} campeoes`);

const roster = list.map((c, index) => {
  const roles = (c.tags ?? []).map(tag => ROLE_PT[tag] ?? tag);
  const resource = String(c.partype ?? '').trim();

  const item = {
    id: index + 1,
    key: c.id,
    name: c.name,
    aliases: [c.id],                       // busca tambem pelo id em ingles (ex.: Wukong -> MonkeyKing)
    group: (c.tags?.[0] ?? 'outros').toLowerCase(),
    roles,
    resource: resource && resource !== 'Nenhum' ? resource : null,
    attack: c.info?.attack ?? null,
    magic: c.info?.magic ?? null,
    defense: c.info?.defense ?? null,
    difficulty: c.info?.difficulty ?? null,
    // 125 = corpo a corpo, 500+ = a distancia: uma das melhores dicas
    attackRange: c.stats?.attackrange ?? null,
    sprite: `${DDRAGON}/cdn/${version}/img/champion/${c.image?.full ?? `${c.id}.png`}`,
    artwork: `${DDRAGON}/cdn/img/champion/loading/${c.id}_0.jpg`,
  };

  item.eligible = Boolean(item.name && item.roles.length && item.attackRange != null);
  return item;
});

const total = roster.length;
const coverage = (label, predicate) => {
  const n = roster.filter(predicate).length;
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(3)}/${total}`);
};

console.log(`\nCobertura dos campos (${total} campeoes):`);
coverage('funcoes', c => c.roles.length);
coverage('recurso', c => c.resource);
coverage('alcance', c => c.attackRange != null);
coverage('dificuldade', c => c.difficulty != null);
coverage('sorteavel', c => c.eligible);

const porGrupo = {};
for (const c of roster) porGrupo[c.group] = (porGrupo[c.group] ?? 0) + 1;
console.log('\nPor funcao principal:', JSON.stringify(porGrupo));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster));
console.log(`\nPronto: ${total} campeoes -> data/lol.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
