/**
 * Baixa a base de veiculos do EPA e gera data/cars.json.
 *   npm run build:cars
 *
 * Fonte: https://www.fueleconomy.gov/feg/epadata/vehicles.csv (aberta, sem
 * chave). Sao ~50 mil linhas cobrindo 1984 a 2027 — uma linha por versao de
 * motor, nao por carro. Aqui agrupamos por marca + modelo base, entao
 * "Toyota Corolla" vira um item so, com o valor mais comum de cada campo.
 *
 * Cuidado com "Estreia": a base do EPA comeca em 1984, entao para modelos
 * mais antigos (Corolla e de 1966) o numero e o primeiro ano NA BASE, nao o
 * lancamento real. Como todos os itens medem a mesma coisa, a comparacao
 * continua justa; so nao e uma data historica.
 *
 * A base nao tem imagens, entao este universo joga so com a tabela de dicas.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const URL = 'https://www.fueleconomy.gov/feg/epadata/vehicles.csv';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'cars.json');
const CACHE = path.join(ROOT, '.cache', 'cars', 'vehicles.csv');

/** Modelos com menos anos de linha que isto podem ser chutados, mas nao sorteados. */
const MIN_YEARS = 3;

// ---------------------------------------------------------------- download

async function source() {
  try {
    return await fs.readFile(CACHE, 'utf8');
  } catch {}
  console.log('Baixando a base do EPA (~21 MB)...');
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.mkdir(path.dirname(CACHE), { recursive: true });
      await fs.writeFile(CACHE, text);
      return text;
    } catch (err) {
      if (attempt === 4) throw new Error(`download: ${err.message}`);
      await new Promise(r => setTimeout(r, 500 * attempt * attempt));
    }
  }
}

/** CSV com aspas: o campo `model` tem virgulas ("Camry, XLE"). */
function parseLine(line) {
  const out = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

// ------------------------------------------------------------ vocabularios

/** Pais da marca — vira o grupo que o host liga/desliga na sala. */
const ORIGIN = {
  eua: ['Chevrolet', 'Ford', 'GMC', 'Dodge', 'Jeep', 'Cadillac', 'Buick', 'Chrysler',
    'Lincoln', 'Pontiac', 'Oldsmobile', 'Plymouth', 'Mercury', 'Ram', 'Tesla', 'Saturn',
    'Hummer', 'Eagle', 'Geo', 'Rivian', 'Lucid', 'Panoz', 'Shelby', 'Saleen', 'Roush',
    'Fisker', 'Karma', 'SRT', 'Checker', 'Avanti', 'VPG'],
  alemanha: ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Opel', 'Smart',
    'Maybach', 'Alpina', 'RUF', 'Wiesmann'],
  japao: ['Toyota', 'Honda', 'Nissan', 'Mazda', 'Mitsubishi', 'Subaru', 'Suzuki', 'Lexus',
    'Acura', 'Infiniti', 'Isuzu', 'Scion', 'Daihatsu'],
  coreia: ['Hyundai', 'Kia', 'Genesis', 'Daewoo', 'Asuna'],
  italia: ['Ferrari', 'Lamborghini', 'Maserati', 'Alfa Romeo', 'Fiat', 'Lancia', 'Pagani',
    'Autobianchi', 'Bertone', 'Qvale'],
  'reino-unido': ['Jaguar', 'Land Rover', 'Bentley', 'Rolls-Royce', 'Aston Martin', 'MINI',
    'Mini', 'Lotus', 'McLaren', 'MG', 'Morgan', 'TVR', 'Sterling', 'Vauxhall'],
  franca: ['Peugeot', 'Renault', 'Citroen', 'Bugatti', 'Alpine'],
  suecia: ['Volvo', 'Saab', 'Koenigsegg', 'Polestar'],
};

/**
 * A base registra o fabricante, nao a marca: "McLaren Automotive", "Ruf
 * Automobile Gmbh", "American Motors Corporation". Por isso casamos por
 * trecho, do nome mais longo para o mais curto — senao "MG" acharia "MGM".
 */
const ORIGIN_ENTRIES = Object.entries(ORIGIN)
  .flatMap(([group, makes]) => makes.map(make => [make.toLowerCase(), group]))
  .sort((a, b) => b[0].length - a[0].length);

function originOf(make) {
  const name = ` ${String(make).toLowerCase()} `;
  for (const [needle, group] of ORIGIN_ENTRIES) {
    // limite de palavra dos dois lados, para "mg" nao casar dentro de "mgm"
    if (new RegExp(`(^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}([^a-z]|$)`).test(name)) {
      return group;
    }
  }
  return 'outros';
}

/** VClass do EPA tem 30+ rotulos; aqui viram 9 categorias jogaveis. */
const CATEGORY = [
  [/two seater/i, 'esportivo'],
  [/station wagon/i, 'perua'],
  [/van/i, 'van'],
  [/pickup/i, 'picape'],
  [/sport utility/i, 'suv'],
  [/minicompact|subcompact/i, 'subcompacto'],
  [/compact/i, 'compacto'],
  [/midsize/i, 'medio'],
  [/large/i, 'grande'],
];

const DRIVE = [
  [/front-wheel/i, 'dianteira'],
  [/rear-wheel/i, 'traseira'],
  [/all-wheel/i, 'integral'],   // cobre "4-Wheel or All-Wheel Drive"
  [/4-wheel/i, '4x4'],
];

const FUEL = [
  [/electricity/i, 'eletrico'],
  [/gasoline/i, 'gasolina'],    // regular, premium e midgrade viram uma coisa so
  [/diesel/i, 'diesel'],
  [/natural gas/i, 'gas-natural'],
  [/hydrogen/i, 'hidrogenio'],
];

const match = (table, value) => table.find(([re]) => re.test(String(value ?? '')))?.[1] ?? null;

// ------------------------------------------------------------------ leitura

const text = await source();
const lines = text.split(/\r?\n/).filter(Boolean);
const header = parseLine(lines[0]);
const at = Object.fromEntries(
  ['make', 'model', 'baseModel', 'year', 'VClass', 'cylinders', 'displ', 'drive', 'fuelType1', 'atvType', 'comb08']
    .map(key => [key, header.indexOf(key)]),
);

/** Agrupa as versoes de motor sob o modelo: "Toyota Corolla" e um item, nao 44. */
const models = new Map();
for (let i = 1; i < lines.length; i++) {
  const row = parseLine(lines[i]);
  const make = row[at.make]?.trim();
  const base = (row[at.baseModel] || row[at.model])?.trim();
  if (!make || !base) continue;

  const key = `${make} ${base}`;
  if (!models.has(key)) models.set(key, { make, base, rows: [] });
  models.get(key).rows.push(row);
}

// ------------------------------------------------------------- agregacao

const numeric = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Valor mais comum entre as versoes — o motor tipico daquele modelo. */
function mode(values) {
  const tally = new Map();
  for (const value of values) {
    if (value === null || value === undefined) continue;
    tally.set(value, (tally.get(value) ?? 0) + 1);
  }
  if (!tally.size) return null;
  return [...tally].sort((a, b) => b[1] - a[1])[0][0];
}

/** Mediana — para o consumo, que e continuo e nao tem "valor mais comum". */
function median(values) {
  const list = values.filter(v => v !== null && v !== undefined).sort((a, b) => a - b);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

// o EPA mede em milhas por galao americano
const MPG_TO_KML = 0.4251437;

const catalog = [...models.values()].map(({ make, base, rows }, index) => {
  const years = [...new Set(rows.map(r => Number(r[at.year])).filter(Number.isFinite))].sort();

  // hibrido nao esta em fuelType1: vem marcado no atvType
  const fuels = rows.map(r => (/hybrid/i.test(r[at.atvType] ?? '')
    ? 'hibrido'
    : match(FUEL, r[at.fuelType1])));

  // Cilindrada e cilindros precisam sair do MESMO motor: tirar a moda de cada
  // um em separado inventaria fichas que nao existem (V8 de 2.3 litros no
  // Mustang, porque o 4-cilindros moderno domina um campo e o V8 o outro).
  const cylinders = mode(rows.map(r => numeric(r[at.cylinders])));
  const sameEngine = rows.filter(r => numeric(r[at.cylinders]) === cylinders);

  const item = {
    id: index + 1,
    // "Golf/GTI" e uma linha so na base; cada variante entra como apelido
    name: `${make} ${base}`,
    aliases: [...new Set([base, ...base.split('/')].map(s => s.trim()).filter(s => s && s !== make))],
    group: originOf(make),
    make,
    category: mode(rows.map(r => match(CATEGORY, r[at.VClass]))),
    drive: mode(rows.map(r => match(DRIVE, r[at.drive]))),
    // `fuel` nao e coluna de dica — quase todo sorteavel e a gasolina, entao
    // a celula ficava verde para todo mundo. Fica no dataset porque e ele que
    // separa o eletrico, que nao pode ser sorteado
    fuel: mode(fuels),
    cylinders,
    displacement: mode(sameEngine.map(r => numeric(r[at.displ]))),
    economy: (() => {
      const kml = median(sameEngine.map(r => numeric(r[at.comb08]))) * MPG_TO_KML;
      return Number.isFinite(kml) ? Math.round(kml * 10) / 10 : null;
    })(),
    debut: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
    sprite: null,      // a base do EPA nao tem imagens
    artwork: null,
  };

  // so vira segredo o modelo com historia na base e ficha completa; os demais
  // continuam chutaveis. Eletricos ficam de fora por nao terem motor a pistao.
  item.eligible = Boolean(
    years.length >= MIN_YEARS
    && item.category && item.drive && item.fuel
    && item.cylinders != null && item.displacement != null && item.economy != null,
  );
  return item;
});

// ------------------------------------------------------------------ relatorio

const total = catalog.length;
const coverage = (label, predicate) => {
  const n = catalog.filter(predicate).length;
  console.log(`  ${label.padEnd(12)} ${String(n).padStart(4)}/${total}`);
};

console.log(`\nCobertura dos campos (${total} modelos):`);
coverage('categoria', c => c.category);
coverage('tracao', c => c.drive);
coverage('combustivel', c => c.fuel);
coverage('cilindros', c => c.cylinders != null);
coverage('cilindrada', c => c.displacement != null);
coverage('consumo', c => c.economy != null);
coverage('sorteavel', c => c.eligible);

const porPais = {};
for (const c of catalog) if (c.eligible) porPais[c.group] = (porPais[c.group] ?? 0) + 1;
console.log('\nSorteaveis por pais:', JSON.stringify(porPais));

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(catalog));
console.log(`\nPronto: ${total} modelos -> data/cars.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
