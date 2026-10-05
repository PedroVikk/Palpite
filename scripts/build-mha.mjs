/**
 * Monta data/mha.json com os personagens de My Hero Academia (Boku no Hero).
 *   npm run build:mha
 * Fonte: My Hero Academia Wiki (myheroacademia.fandom.com), pela API do
 * MediaWiki (aberta, sem chave).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const WIKI = 'https://myheroacademia.fandom.com/api.php';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'mha.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'mha');
const UA = 'palpite-dataset/1.0 (+https://github.com/PedroVikk)';

await fs.mkdir(CACHE_DIR, { recursive: true });

/** Nome do cache pelo conteudo do lote, nunca pela posicao (ver build-famosos). */
const loteSlug = (prefixo, ids) =>
  `${prefixo}-${createHash('sha1').update(ids.join('|')).digest('hex').slice(0, 12)}`;

async function api(nome, params) {
  const file = path.join(CACHE_DIR, `${nome}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let i = 1; i <= 5; i++) {
    try {
      const res = await fetch(`${WIKI}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`,
        { headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.writeFile(file, text);
      return JSON.parse(text);
    } catch (err) {
      if (i === 5) throw new Error(`${nome}: ${err.message}`);
      await new Promise(r => setTimeout(r, 800 * i * i));
    }
  }
}

/** Uma consulta em lotes de 50 titulos, seguindo o `continue` de cada lote. */
async function emLotes(prefixo, titulos, params, cadaPagina) {
  for (let i = 0; i < titulos.length; i += 50) {
    const lote = titulos.slice(i, i + 50);
    let cont = {}, n = 0;
    do {
      const json = await api(loteSlug(`${prefixo}${n++}`, lote), { action: 'query', titles: lote.join('|'), ...params, ...cont });
      for (const p of json.query.pages) cadaPagina(p, json);
      cont = json.continue ?? null;
    } while (cont);
    process.stdout.write(`\r  ${Math.min(i + 50, titulos.length)}/${titulos.length}`);
  }
  process.stdout.write('\n');
}

async function transcluem(template) {
  const titulos = [];
  let cont = {}, n = 0;
  do {
    const json = await api(`emb-${template.replace(/\W/g, '')}-${n++}`, {
      action: 'query', list: 'embeddedin', eititle: `Template:${template}`, einamespace: '0', eilimit: '500', ...cont,
    });
    titulos.push(...json.query.embeddedin.map(p => p.title));
    cont = json.continue ?? null;
  } while (cont);
  return titulos;
}

// -------------------------------------------------------------- wikitexto

/** O wiki escreve "{{Quirk Infobox" e "{{Quirk_Infobox", conforme quem criou a pagina. */
function corpo(texto, nome) {
  const ini = texto.search(new RegExp(`\\{\\{${nome.replace(' ', '[ _]')}`));
  if (ini < 0) return null;
  let fundo = 0;
  for (let i = ini; i < texto.length; i++) {
    if (texto.startsWith('{{', i)) { fundo++; i++; continue; }
    if (texto.startsWith('}}', i)) { fundo--; i++; if (!fundo) return texto.slice(ini + 2, i - 1); }
  }
  return null;
}

/** Os parametros da ficha, quebrando no `|` so fora de [[ ]] e {{ }}, com piso no fundo. */
function parametros(bloco) {
  const t = (bloco ?? '').replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const partes = [];
  let fundo = 0, ini = 0;
  for (let i = 0; i < t.length; i++) {
    if (t.startsWith('{{', i) || t.startsWith('[[', i)) { fundo++; i++; continue; }
    if (t.startsWith('}}', i) || t.startsWith(']]', i)) { fundo = Math.max(0, fundo - 1); i++; continue; }
    if (t[i] === '|' && fundo === 0) { partes.push(t.slice(ini, i)); ini = i + 1; }
  }
  partes.push(t.slice(ini));
  const saida = {};
  for (const p of partes.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) saida[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return saida;
}

const limpa = (v) => (v ?? '')
  .replace(/\{\{(?:Ref|Ruby)[^{}]*\}\}/gi, '')
  .replace(/\{\{Nihongo\|([^|{}]*)[^{}]*\}\}/gi, '$1')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/\{\{[^{}]*\}\}/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/''+/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/** As linhas de um campo escrito como lista, com a marca de "{{Former}}". */
const linhas = (v) => String(v ?? '').split(/<br\s*\/?>|\n/i)
  .map(l => ({ bruto: l, texto: limpa(l.replace(/^\*+/, '')), antigo: /\{\{Former\}\}|\(Former\)/i.test(l) }))
  .filter(l => l.texto);

const primeiroLink = (v) => v?.match(/\[\[([^\]|#]+)/)?.[1]?.trim() ?? null;

// -------------------------------------------------------------- download

console.log('Lendo quem usa a ficha de personagem...');
const titulos = await transcluem('Character Infobox');
console.log(`  ${titulos.length} paginas`);

const paginas = new Map();
await emLotes('ficha', titulos, {
  prop: 'revisions|categories|langlinks', rvprop: 'content', rvslots: 'main', cllimit: 'max', lllimit: 'max',
}, (p) => {
  const atual = paginas.get(p.title) ?? { cats: new Set(), idiomas: new Map() };
  if (p.revisions) atual.texto = p.revisions[0].slots.main.content;
  if (p.pageid) atual.pageid = p.pageid;
  for (const c of p.categories ?? []) atual.cats.add(c.title.replace(/^Category:/, ''));
  for (const l of p.langlinks ?? []) atual.idiomas.set(l.lang, l.title);
  paginas.set(p.title, atual);
});

console.log('\nLendo os capitulos e episodios...');
const capitulos = await transcluem('Chapter Infobox');
const episodios = await transcluem('Episode Infobox');
const aparicoes = new Map();
await emLotes('elo', [...capitulos, ...episodios], { prop: 'links', plnamespace: '0', pllimit: 'max' }, (p) => {
  for (const l of p.links ?? []) aparicoes.set(l.title, (aparicoes.get(l.title) ?? 0) + 1);
});
const arcoDe = new Map();
await emLotes('arco', [...capitulos, ...episodios], { prop: 'revisions', rvprop: 'content', rvslots: 'main' }, (p) => {
  const texto = p.revisions?.[0]?.slots?.main?.content ?? '';
  const f = parametros(corpo(texto, 'Chapter Infobox') ?? corpo(texto, 'Episode Infobox') ?? '');
  arcoDe.set(p.title, { arco: limpa(f.arc), cap: Number(f['ch number']) || null, ep: Number(f['ep number']) || null });
});


// -------------------------------------------------------------- tabelas

/**
 * Os arcos do wiki, agrupados nas fases que a coluna *Estreia* mostra. O manga
 * acabou no 431 e numera sem recomecar, entao o arco de cada capitulo vem da
 * ficha do proprio capitulo, e o personagem herda o do capitulo de estreia.
 * Blocos largos de proposito: com os 23 arcos do wiki a celula quase nunca
 * fecharia verde.
 */
const FASES = [
  { rotulo: 'Ingresso na U.A.', arcos: ['Entrance Exam', 'Quirk Apprehension Test', 'Battle Trial', 'U.S.J.'] },
  { rotulo: 'Festival Esportivo', arcos: ['U.A. Sports Festival'] },
  { rotulo: 'Matador de Heróis', arcos: ['Vs. Hero Killer'] },
  { rotulo: 'Provas e Acampamento', arcos: ['Final Exams', 'Forest Training Camp'] },
  { rotulo: 'Kamino', arcos: ['Hideout Raid'] },
  { rotulo: 'Licença Provisória', arcos: ['Provisional Hero License Exam'] },
  { rotulo: 'Shie Hassaikai', arcos: ['Shie Hassaikai'] },
  { rotulo: 'Festival Escolar', arcos: ['Remedial Course', 'U.A. School Festival'] },
  { rotulo: 'Treino Conjunto', arcos: ['Pro Hero', 'Joint Training'] },
  { rotulo: 'Exército de Libertação', arcos: ['Meta Liberation Army'] },
  { rotulo: 'Guerra Paranormal', arcos: ['Endeavor Agency', 'Paranormal Liberation War'] },
  { rotulo: 'Herói Sombrio', arcos: ['Dark Hero', 'Star and Stripe', 'U.A. Traitor'] },
  { rotulo: 'Guerra Final', arcos: ['Final War', 'Epilogue'] },
];
const faseDoArco = new Map(FASES.flatMap((f, i) => f.arcos.map(a => [a, i])));

/**
 * Quem a sala conhece. As paginas de capitulo e de episodio linkam quem
 * aparece nelas (o Izuku 590, o All Might 530), e o interwiki diz quantos
 * wikis de outros idiomas acharam o personagem digno de pagina. Qualquer uma
 * das portas basta:
 *  - 50+ aparicoes: o elenco fixo, ate o vilao de lodo do capitulo 1;
 *  - 20+ aparicoes e 2+ idiomas: a Lady Nagant, a Star and Stripe, a Mitsuki;
 *  - 5+ idiomas: quem aparece pouco e todo mundo lembra.
 * As 30 e tantas paginas com exatamente 62 aparicoes e nenhum idioma sao do
 * Vigilantes, ligadas por uma caixa de navegacao — o campo de estreia, que
 * fica vazio para elas, as segura fora antes desta regua.
 */
const conhecido = (a, i) => a >= 50 || (a >= 20 && i >= 2) || i >= 5;

/**
 * Paginas com ficha de personagem que nao sao personagem: o autor, os do
 * Vigilantes (o Koichi, protagonista de la, so faz uma ponta no capitulo 424)
 * e a pagina da especie Nomu, que nao e um Nomu so — o da U.S.J. tem pagina
 * propria.
 */
const FORA = new Set(['Kohei Horikoshi', 'Hideyuki Furuhashi', 'Betten Court', 'Nomu', 'Koichi Haimawari']);

/**
 * O nome pelo qual a sala chama. Herói profissional e vilao atendem pelo
 * codinome — ninguem procura "Toshinori Yagi" —, e aluno pelo nome. O nome de
 * registro continua valendo de apelido, e o codinome dos alunos tambem.
 */
const NOME = {
  'Toshinori Yagi': 'All Might', 'Enji Todoroki': 'Endeavor', 'Keigo Takami': 'Hawks',
  'Tsunagu Hakamada': 'Best Jeanist', 'Sorahiko Torino': 'Gran Torino', 'Hizashi Yamada': 'Present Mic',
  'Nemuri Kayama': 'Midnight', 'Shinya Kamihara': 'Edgeshot', 'Yu Takeyama': 'Mt. Lady',
  'Taishiro Toyomitsu': 'Fat Gum', 'Shinji Nishiya': 'Kamui Woods', 'Rumi Usagiyama': 'Mirko',
  'Ryuko Tatsuma': 'Ryukyu', 'Ken Ishiyama': 'Cementoss', 'Mirai Sasaki': 'Sir Nighteye',
  'Anan Kurose': 'Thirteen', 'Kugo Sakamata': 'Gang Orca', 'Masaki Mizushima': 'Manual',
  'Sekijiro Kan': 'Vlad King', 'Ken Takagi': 'Rock Lock', 'Chiyo Shuzenji': 'Recovery Girl',
  'Shino Sosaki': 'Mandalay', 'Yawara Chatora': 'Tiger', 'Ryuko Tsuchikawa': 'Pixie-Bob',
  'Tomoko Shiretoko': 'Ragdoll', 'Moe Kamiji': 'Burnin', 'Kaina Tsutsumi': 'Lady Nagant',
  'Cathleen Bate': 'Star and Stripe', 'Higari Maijima': 'Power Loader', 'Ryo Inui': 'Hound Dog',
  'Kaoruko Awata': 'Bubble Girl', 'Emi Fukukado': 'Ms. Joke', 'Koku Hanabata': 'Trumpet',
  'Jin Bubaigawara': 'Twice', 'Shuichi Iguchi': 'Spinner', 'Chizome Akaguro': 'Stain',
  'Atsuhiro Sako': 'Mr. Compress', 'Kai Chisaki': 'Overhaul', 'Rikiya Yotsubashi': 'Re-Destro',
  'Kenji Hikiishi': 'Magne', 'Tomoyasu Chikazoku': 'Skeptic', 'Hari Kurono': 'Chronostasis',
  'Danjuro Tobita': 'Gentle Criminal', 'Goto Imasuji': 'Muscular', 'Joi Irinaka': 'Mimic',
  'Kendo Rappa': 'Rappa', 'Kagero Okuta': 'Giran', 'Kyudai Garaki': 'Dr. Garaki', 'Manami Aiba': 'La Brava',
  'Naomasa Tsukauchi': 'Detetive Tsukauchi',
};

/**
 * A afiliacao sai das categorias, na ordem de prioridade: o aluno que virou
 * herói no epilogo e aluno (e assim que a historia inteira o mostra), e o
 * vilao que entrou na Frente de Libertacao continua sendo da Liga ou do
 * Exercito de onde veio.
 */
const AFILIACOES = [
  ['liga', ['League of Villains']],
  ['libertacao', ['Meta Liberation Army']],
  ['hassaikai', ['Shie Hassaikai']],
  ['vilao', ['Villains', 'Villain Factory']],
  ['1-a', ['Class 1-A']],
  ['1-b', ['Class 1-B']],
  ['ua', ['U.A. Students', 'U.A. General Department Students', 'U.A. Support Department Students', 'U.A. Business Department Students', 'Former Hero Trainees']],
  ['outra-escola', ['Shiketsu Students', 'Ketsubutsu Students', 'Isamu Students', 'Students']],
  ['professor', ['Hero Teachers']],
  ['heroi', ['Pro Heroes', 'Heroes', 'Former Pro Heroes']],
];

function afiliacaoDe(cats) {
  for (const [id, lista] of AFILIACOES) if (lista.some(c => cats.has(c))) return id;
  return 'civil';
}

/** O grupo que a sala liga: alunos, heróis, vilões e o resto. */
const GRUPO = {
  liga: 'viloes', libertacao: 'viloes', hassaikai: 'viloes', vilao: 'viloes',
  '1-a': 'alunos', '1-b': 'alunos', ua: 'alunos', 'outra-escola': 'alunos',
  professor: 'herois', heroi: 'herois', civil: 'outros',
};

/**
 * Onde a categoria nao conta a historia que a sala viu. A Eri mora na U.A.
 * mas nao estuda la durante a serie; o Gentle e a La Brava viram o
 * "Students" por causa de um curso; o Aoyama e o espiao do All For One
 * dentro da 1-A, e e como aluno que ele aparece.
 */
const CORRECOES = {
  Eri: { affiliation: 'civil' },
  'Kota Izumi': { affiliation: 'civil' },
  'Natsuo Todoroki': { affiliation: 'civil' },
  'Danjuro Tobita': { affiliation: 'vilao' },
  'Manami Aiba': { affiliation: 'vilao' },
};

const TIPO_QUIRK = { Emitter: 'emissor', Transformation: 'transformacao', Mutant: 'mutante' };

/**
 * A cor do cabelo, que no anime e o jeito mais rapido de reconhecer alguem. A
 * ficha escreve "Red (Permanently Dyed; currently) Black (Originally;
 * formerly)" e "Pink (Manga) Purple (Anime)": vale a cor de agora, e a do
 * anime. Duas cores no maximo — o Todoroki e branco e vermelho, e fecha
 * amarelo contra qualquer um dos dois.
 */
const CORES = [
  ['verde', /green|olive/i], ['loiro', /blond|golden|yellow/i], ['preto', /black|^dark$/i],
  ['castanho', /brown|auburn|beige|tawny/i], ['vermelho', /red|crimson|burgundy|copper/i],
  ['branco', /white/i], ['cinza', /gr[ae]y|silver/i], ['azul', /blue|navy|periwinkle|turquoise/i],
  ['roxo', /purple|indigo|violet/i], ['rosa', /pink/i], ['laranja', /orange/i], ['careca', /bald/i],
];

/**
 * A Hagakure e invisivel: a ficha lista as cores que o cabelo dela tem num
 * extra, e nenhuma aparece na serie.
 */
const CABELO = { 'Toru Hagakure': ['nao-aparece'] };

function cabeloDe(campo) {
  // "Dark blue" e azul, "Ash blond" e loiro, e "Golden blond with a
  // lightning bolt-shaped streak of black" e loiro: o tom e a mecha saem
  let t = limpa(campo).replace(/\b(dark|light|pale|dirty|ash|sandy|golden|olive)\s+(?=[a-z])/gi, '')
    .replace(/\s+with\b[^()]*/gi, ' ');
  if (!t) return ['nao-aparece'];
  // cada cor com a nota dela; a que for de antes, do manga ou natural sai
  const trechos = t.split(/(?<=\))\s+|\s+(?=[A-Z][a-z]+\s*(?:\(|$))/);
  const valem = trechos.filter(s => !/formerly|originally|natural|manga|pre-transformation/i.test(s));
  t = (valem.length ? valem : trechos).join(' ').replace(/\([^)]*\)/g, ' ');
  const achadas = [];
  for (const palavra of t.split(/[\s,/-]+|\band\b|\bwith\b/i)) {
    const cor = CORES.find(([, re]) => re.test(palavra))?.[0];
    if (cor && !achadas.includes(cor)) achadas.push(cor);
    if (achadas.length === 2) break;
  }
  return achadas.length ? achadas : ['nao-aparece'];
}

/**
 * A individualidade que conta, para o tipo. A ficha lista a de nascenca, as
 * herdadas e as roubadas, com {{Former}} no que ficou para tras: vale a
 * primeira que nao e "Quirkless". Quem perdeu tudo no fim (o Izuku, o All
 * Might, o Hawks) e lembrado pela que teve, entao a antiga serve quando nao
 * sobra outra.
 */
function quirkDe(campo) {
  const todas = String(campo ?? '').split(/<br\s*\/?>|\n/i)
    .map(l => ({
      // a maioria vem como link; quem nao tem pagina vem em texto ("Iron Claws")
      alvo: primeiroLink(l) ?? (limpa(l.replace(/^\*+/, '')).replace(/\([^)]*\)/g, '').trim() || null),
      antigo: /\{\{Former\}\}|\(Former|formerly/i.test(l),
    }))
    .filter(l => l.alvo && !/^(Unnamed|Unknown|Various)/i.test(l.alvo));
  const reais = todas.filter(l => !/^Quirkless/i.test(l.alvo));
  if (!reais.length) return todas.length ? 'Quirkless' : null;
  const alvo = (reais.find(l => !l.antigo) ?? reais[0]).alvo;
  // a individualidade do All For One tem o nome dele, e a pagina com esse
  // nome e a do personagem
  return paginas.has(alvo) ? `${alvo} (Quirk)` : alvo;
}

/**
 * Quem a ficha deixa sem individualidade com nome, e a obra mostra o que ela
 * faz: a mae do Izuku puxa objetos pequenos, o Manual solta agua, o vilao de
 * lodo e o proprio lodo.
 */
const QUIRK_SEM_PAGINA = {
  'Inko Midoriya': 'emissor', 'Masaki Mizushima': 'emissor', 'Sludge Villain': 'mutante',
};

// -------------------------------------------------------------- montagem

/**
 * A estreia de verdade, nao a ponta. A ficha do Endeavor escreve "Chapter 1
 * (Background) Chapter 3 (Mentioned) Chapter 28 (Official debut)", e a do
 * Hawks "Episode 66 (Silhouette) Episode 87 (Full Appearance)": vale o
 * primeiro que nao e citacao, silhueta, ponta ou flashback. Se todos forem,
 * vale o primeiro.
 */
const PONTA = /^\s*\((?:Mentioned|Background|Silhouette|Cameo|Voice|screen|Vision|Flashback|as )/i;
function estreiaDe(v, tipo) {
  const texto = limpa(v);
  const achados = [...texto.matchAll(new RegExp(`${tipo} (\\d+)`, 'g'))]
    .map(m => ({ n: m[1], ponta: PONTA.test(texto.slice(m.index + m[0].length)) }));
  const vale = achados.find(a => !a.ponta) ?? achados[0];
  return vale ? `${tipo} ${vale.n}` : null;
}

const elenco = [];
for (const [titulo, p] of paginas) {
  if (!p.texto || FORA.has(titulo)) continue;
  const bruto = corpo(p.texto, 'Character Infobox');
  if (!bruto) continue;
  const ficha = parametros(bruto);
  // so quem estreia na serie principal: o Vigilantes escreve a estreia em
  // `debutvigilantes`, e o filme em campo proprio
  // o manga manda; o episodio so vale para quem nao tem capitulo, porque o
  // anime adianta pontas (o Stain aparece de relance no episodio 13)
  const cap = faseDoArco.get(arcoDe.get(estreiaDe(ficha.debut, 'Chapter'))?.arco);
  const ep = faseDoArco.get(arcoDe.get(estreiaDe(ficha.debutanime, 'Episode'))?.arco);
  const fase = cap ?? ep;
  if (fase == null) continue;
  if (!conhecido(aparicoes.get(titulo) ?? 0, p.idiomas.size)) continue;
  elenco.push({ titulo, ...p, ficha, fase });
}
console.log(`\n  ${elenco.length} passam no corte`);

console.log('\nLendo o tipo de cada individualidade...');
const quirks = [...new Set(elenco.map(c => quirkDe(c.ficha.quirk)).filter(q => q && q !== 'Quirkless'))];
const tipoDe = new Map();
await emLotes('quirk', quirks, { prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1' }, (p, json) => {
  const texto = p.revisions?.[0]?.slots?.main?.content ?? '';
  const tipo = limpa(parametros(corpo(texto, 'Quirk Infobox') ?? '')['quirk type']);
  const id = TIPO_QUIRK[Object.keys(TIPO_QUIRK).find(k => tipo.startsWith(k))] ?? null;
  tipoDe.set(p.title, id);
  for (const r of json.query.redirects ?? []) if (r.to === p.title) tipoDe.set(r.from, id);
  for (const n of json.query.normalized ?? []) if (n.to === p.title) tipoDe.set(n.from, id);
});

console.log('\nBaixando os retratos...');
const retrato = new Map();
await emLotes('retrato', elenco.map(c => c.titulo), {
  prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '400',
}, (p) => {
  if (p.thumbnail?.source) retrato.set(p.title, p.thumbnail.source);
});

const roster = [];
for (const c of elenco) {
  const f = c.ficha;
  const affiliation = CORRECOES[c.titulo]?.affiliation ?? afiliacaoDe(c.cats);
  const quirk = quirkDe(f.quirk);
  // sem individualidade nenhuma na ficha e o Nomu da U.S.J. e companhia, que
  // tem varias sem nome: "Desconhecido" fica de fora do sorteio
  const quirkType = QUIRK_SEM_PAGINA[c.titulo]
    ?? (quirk === 'Quirkless' ? 'sem' : (tipoDe.get(quirk) ?? null));
  const genero = limpa(f.gender);
  const sprite = retrato.get(c.titulo) ?? null;

  const item = {
    id: c.pageid,
    name: NOME[c.titulo] ?? c.titulo,
    group: GRUPO[affiliation],
    affiliation,
    quirkType,
    gender: /^Female/i.test(genero) ? 'Feminino' : /^Male/i.test(genero) ? 'Masculino' : null,
    hair: CABELO[c.titulo] ?? cabeloDe(f.hair),
    debut: c.fase,
    sprite,
    artwork: sprite,
  };

  // o codinome vem depois dos dois-pontos ("Erasure Hero: Eraser Head"), e o
  // nome de registro vale para quem ganhou o codinome como nome
  const codinomes = String(f.alias ?? '').split(/<br\s*\/?>|\n/i)
    .map(a => {
      const t = limpa(a).replace(/\([^)]*\)/g, '').trim();
      // 'Lock Hero "Rock Lock"' e 'Erasure Hero: Eraser Head'
      return (t.match(/"([^"]+)"/)?.[1] ?? t.replace(/^.*?:\s*/, '')).trim();
    });
  const apelidos = [c.titulo, ...codinomes]
    .filter(a => a && a !== item.name && a.length < 40 && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(a));
  if (apelidos.length) item.aliases = [...new Set(apelidos)];

  item.eligible = Boolean(sprite && item.gender && item.quirkType);
  roster.push(item);
}

// ------------------------------------------------------------- relatorio

const elegiveis = roster.filter(i => i.eligible);
console.log(`\n${elegiveis.length} sorteaveis de ${roster.length}`);
console.log('  fora do sorteio:', roster.filter(i => !i.eligible).map(i => `${i.name} [${[!i.sprite && 'retrato', !i.gender && 'genero', !i.quirkType && 'quirk'].filter(Boolean)}]`).join(', '));
const tally = (rotulo, pega) => {
  const c = {};
  for (const i of elegiveis) for (const v of [pega(i)].flat()) c[v] = (c[v] ?? 0) + 1;
  console.log(`${rotulo}:`, JSON.stringify(Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]))));
};
tally('Grupo', i => i.group);
tally('Estreia', i => FASES[i.debut].rotulo);
tally('Afiliacao', i => i.affiliation);
tally('Quirk', i => i.quirkType);
tally('Genero', i => i.gender);
tally('Cabelo', i => i.hair);

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(roster.sort((a, b) => a.id - b.id)));
console.log(`\nPronto: ${roster.length} personagens -> data/mha.json (${Math.round((await fs.stat(OUT)).size / 1024)} KB)`);
