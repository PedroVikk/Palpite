/**
 * Monta data/deuses.json com os deuses das mitologias.
 *   npm run build:deuses
 * Fontes: a tabela abaixo, escrita a mao, e a Wikipedia em ingles (pela API
 * aberta), que da a imagem e o id da Wikidata de cada um. Onde o artigo nao
 * tem imagem livre, entra a da ficha da Wikidata, servida pelo Commons.
 * Treze ficam sem nenhuma — o Dagda, o Tsukuyomi, o Balor — e jogam so no
 * modo classico, como os pilotos sem foto da F1.
 *
 * O elenco e curado de proposito. A Wikidata tem "deus grego", "orixa" e
 * "divindade asteca" como classes, mas o dominio (P2925) esta preenchido em
 * menos da metade e sem vocabulario comum — o Zeus sai com dezessete, o Ogum
 * com nenhum. As colunas sao as perguntas que a sala responde de cabeca
 * (Zeus e do ceu, Anubis tem cabeca de chacal, Atena anda com a coruja), e
 * essas respostas nao estao em fonte aberta nenhuma do jeito que o jogador
 * pensa nelas. A tabela e a fonte; a Wikipedia so empresta o rosto.
 *
 * O id e o numero do item na Wikidata (Q34201 → 34201), como nas Bandas: nao
 * muda se a tabela mudar de ordem, e a miniatura espelhada segue com ele.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ENWIKI = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'deuses.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'deuses');
const METRICS = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/user';
const UA = 'palpite-dataset/1.0 (+https://github.com/PedroVikk)';

/**
 * Piso de visitas em doze meses na Wikipedia em portugues para ser sorteavel.
 * 8 mil e pouco mais de 600 por mes: acima estao o Zeus (86 mil), o Anubis e
 * a Iemanja; abaixo, o Ullr, o Ek Chuaj e o Goibniu, que so o estudioso sabe.
 * Quem fica abaixo continua no arquivo, fora do jogo.
 */
const PISO_VISITAS = 8_000;
/** Quantos cada panteao garante, pelos mais visitados, mesmo abaixo do piso. */
const MINIMO = 8;

await fs.mkdir(CACHE_DIR, { recursive: true });

// ------------------------------------------------------------- a tabela

/**
 * Uma linha por deus:
 *   [nome, titulo na Wikipedia em ingles, genero, posicao, dominios, reino, apelidos]
 *
 * genero    M, F ou A (os dois: Oxumare, Inari, Ometeotl)
 * posicao   primordial · soberano (quem reina sobre o panteao) · principal ·
 *           menor · tita (tita grego, gigante nordico, fomoriano)
 * dominios  no maximo tres, do vocabulario de DOMINIOS; o primeiro e o que o
 *           jogador fala primeiro ("Poseidon e do mar")
 * reino     onde o deus age: ceu (o Olimpo, Asgard e o sol e a chuva) · terra
 *           (a colheita, a mata, a forja, a casa) · agua (mar e rio) ·
 *           submundo (os mortos, e os titas presos no Tartaro)
 * apelidos  os outros nomes que a busca aceita — o romano do grego, a grafia
 *           iorubá do orixa, o nome em ingles que o jogo de video game usa
 */
const DOMINIOS = new Set([
  'ceu', 'tempestade', 'sol', 'lua', 'noite', 'agua', 'terra', 'natureza',
  'colheita', 'amor', 'guerra', 'morte', 'sabedoria', 'magia', 'trapaca',
  'fogo', 'artes', 'cura', 'justica', 'festa', 'tempo', 'criacao', 'lar',
  'viagem', 'riqueza', 'caos',
]);
/**
 * A coluna nao mostra o dominio fino: mostra a familia dele. Com os 26 da
 * tabela o amarelo quase nao aparecia — o Apolo (sol) e a Selene (lua) nao
 * tinham nada em comum. A tabela segue fina porque e assim que se escreve
 * ("Hipnos e do sono"), e a coluna junta o que a sala acha parecido.
 */
const FAMILIA = {
  ceu: 'astros', sol: 'astros', lua: 'astros', noite: 'astros',
  tempestade: 'tempestade',
  agua: 'agua',
  terra: 'natureza', natureza: 'natureza', colheita: 'natureza',
  amor: 'amor',
  guerra: 'guerra',
  morte: 'morte',
  sabedoria: 'sabedoria', magia: 'sabedoria',
  artes: 'artes', festa: 'artes',
  fogo: 'fogo',
  cura: 'lar', lar: 'lar',
  justica: 'ordem', tempo: 'ordem',
  trapaca: 'caos', caos: 'caos',
  riqueza: 'riqueza', viagem: 'riqueza',
  criacao: 'criacao',
};
const POSICOES = new Set(['primordial', 'soberano', 'principal', 'menor', 'tita']);
const REINOS = new Set(['ceu', 'terra', 'agua', 'submundo']);

/**
 * Os panteoes, na ordem dos grupos. `pantheon` e o texto da coluna quando ele
 * diz mais que o grupo: astecas e maias dividem o balde (sozinhos os maias
 * ficavam com nove), mas a coluna separa os dois.
 *
 * `minimo` e quantos o panteao garante na peneira da fama, mesmo abaixo do
 * piso (ver PISO_VISITAS). Os quatro do desafio do dia garantem 15, que e o
 * menor recorte que o sorteio aceita; os orixas entram `inteiro`, porque sao
 * o panteao da casa e o Obaluaê e conhecido por outro nome (Omolu), que a
 * contagem de visitas nao ve.
 */
const PANTEOES = [
  { group: 'grega', pantheon: 'Greco-romana', minimo: 15, deuses: [
    ['Zeus', 'Zeus', 'M', 'soberano', ['ceu', 'tempestade', 'justica'], 'ceu', ['Júpiter', 'Jove']],
    ['Hera', 'Hera', 'F', 'soberano', ['lar'], 'ceu', ['Juno']],
    ['Poseidon', 'Poseidon', 'M', 'principal', ['agua', 'terra'], 'agua', ['Netuno', 'Posídon', 'Posêidon']],
    ['Hades', 'Hades', 'M', 'principal', ['morte', 'riqueza'], 'submundo', ['Plutão', 'Dis Pater']],
    ['Deméter', 'Demeter', 'F', 'principal', ['colheita', 'terra'], 'terra', ['Ceres', 'Demeter']],
    ['Héstia', 'Hestia', 'F', 'principal', ['lar', 'fogo'], 'terra', ['Vesta', 'Hestia']],
    ['Atena', 'Athena', 'F', 'principal', ['sabedoria', 'guerra', 'artes'], 'ceu', ['Minerva', 'Palas Atena', 'Athena', 'Atenas']],
    ['Apolo', 'Apollo', 'M', 'principal', ['sol', 'artes', 'cura'], 'ceu', ['Febo', 'Apollo']],
    ['Ártemis', 'Artemis', 'F', 'principal', ['natureza', 'lua'], 'terra', ['Diana', 'Artemis']],
    ['Ares', 'Ares', 'M', 'principal', ['guerra'], 'ceu', ['Marte']],
    ['Afrodite', 'Aphrodite', 'F', 'principal', ['amor'], 'ceu', ['Vênus']],
    ['Hefesto', 'Hephaestus', 'M', 'principal', ['fogo'], 'terra', ['Vulcano', 'Hephaestus']],
    ['Hermes', 'Hermes', 'M', 'principal', ['viagem', 'trapaca'], 'ceu', ['Mercúrio']],
    ['Dionísio', 'Dionysus', 'M', 'principal', ['festa'], 'terra', ['Baco', 'Dioniso', 'Líber']],
    ['Perséfone', 'Persephone', 'F', 'principal', ['morte', 'colheita'], 'submundo', ['Prosérpina', 'Coré']],
    ['Gaia', 'Gaia', 'F', 'primordial', ['terra', 'criacao'], 'terra', ['Gaya', 'Geia', 'Terra', 'Tellus']],
    ['Urano', 'Uranus (mythology)', 'M', 'primordial', ['ceu'], 'ceu', ['Caelus', 'Ouranos']],
    ['Nix', 'Nyx', 'F', 'primordial', ['noite'], 'ceu', ['Nyx', 'Nox']],
    ['Cronos', 'Cronus', 'M', 'tita', ['tempo', 'colheita'], 'submundo', ['Saturno', 'Crono', 'Kronos']],
    ['Reia', 'Rhea (mythology)', 'F', 'tita', ['lar', 'colheita'], 'terra', ['Réia', 'Rhea', 'Ops']],
    ['Oceano', 'Oceanus', 'M', 'tita', ['agua'], 'agua', ['Oceanus']],
    ['Hipérion', 'Hyperion (Titan)', 'M', 'tita', ['sol', 'ceu'], 'ceu', ['Hyperion']],
    ['Têmis', 'Themis', 'F', 'tita', ['justica'], 'ceu', ['Themis', 'Justitia']],
    ['Mnemósine', 'Mnemosyne', 'F', 'tita', ['sabedoria'], 'terra', ['Mnemosyne']],
    ['Prometeu', 'Prometheus', 'M', 'tita', ['fogo', 'trapaca', 'criacao'], 'terra', ['Prometheus']],
    ['Atlas', 'Atlas (mythology)', 'M', 'tita', ['ceu'], 'ceu', []],
    ['Hélio', 'Helios', 'M', 'tita', ['sol'], 'ceu', ['Hélios', 'Helios', 'Sol']],
    ['Selene', 'Selene', 'F', 'tita', ['lua'], 'ceu', ['Luna']],
    ['Eos', 'Eos', 'F', 'tita', ['ceu'], 'ceu', ['Aurora']],
    ['Leto', 'Leto', 'F', 'tita', ['lar'], 'terra', ['Latona']],
    ['Eros', 'Eros', 'M', 'menor', ['amor'], 'ceu', ['Cupido', 'Amor']],
    ['Nice', 'Nike (mythology)', 'F', 'menor', ['guerra'], 'ceu', ['Nike', 'Vitória']],
    ['Hécate', 'Hecate', 'F', 'menor', ['magia', 'noite', 'morte'], 'submundo', ['Hecate', 'Trívia']],
    ['Pã', 'Pan (god)', 'M', 'menor', ['natureza'], 'terra', ['Pan', 'Fauno']],
    ['Hipnos', 'Hypnos', 'M', 'menor', ['noite'], 'submundo', ['Hypnos', 'Somnus']],
    ['Tânatos', 'Thanatos', 'M', 'menor', ['morte'], 'submundo', ['Thanatos', 'Tânato', 'Mors']],
    ['Morfeu', 'Morpheus', 'M', 'menor', ['noite'], 'submundo', ['Morpheus']],
    ['Nêmesis', 'Nemesis', 'F', 'menor', ['justica'], 'ceu', ['Nemesis']],
    ['Tique', 'Tyche', 'F', 'menor', ['riqueza'], 'ceu', ['Tyche', 'Fortuna']],
    ['Éolo', 'Aeolus', 'M', 'menor', ['tempestade'], 'ceu', ['Aeolus', 'Eolo']],
    ['Íris', 'Iris (mythology)', 'F', 'menor', ['ceu', 'viagem'], 'ceu', ['Iris', 'Arco-íris']],
    ['Asclépio', 'Asclepius', 'M', 'menor', ['cura'], 'terra', ['Esculápio', 'Asclepius']],
    ['Hércules', 'Heracles', 'M', 'menor', ['guerra'], 'ceu', ['Héracles', 'Heracles']],
    ['Anfitrite', 'Amphitrite', 'F', 'menor', ['agua'], 'agua', ['Amphitrite', 'Salácia']],
    ['Éris', 'Eris (mythology)', 'F', 'menor', ['caos', 'guerra'], 'ceu', ['Eris', 'Discórdia']],
    ['Jano', 'Janus', 'M', 'principal', ['tempo', 'viagem'], 'terra', ['Janus']],
  ] },

  { group: 'nordica', pantheon: 'Nórdica', minimo: 15, deuses: [
    ['Odin', 'Odin', 'M', 'soberano', ['sabedoria', 'guerra', 'magia'], 'ceu', ['Óðinn', 'Wotan', 'Woden', 'Odim']],
    ['Frigga', 'Frigg', 'F', 'soberano', ['lar', 'tempo'], 'ceu', ['Frigg', 'Frig']],
    ['Thor', 'Thor', 'M', 'principal', ['tempestade', 'guerra'], 'ceu', ['Tor', 'Þórr', 'Donar']],
    ['Loki', 'Loki', 'M', 'principal', ['trapaca', 'caos'], 'ceu', []],
    ['Balder', 'Baldr', 'M', 'principal', ['sol', 'amor'], 'ceu', ['Baldr', 'Baldur']],
    ['Freya', 'Freyja', 'F', 'principal', ['amor', 'guerra', 'magia'], 'ceu', ['Freyja', 'Freia']],
    ['Frey', 'Freyr', 'M', 'principal', ['colheita', 'sol'], 'terra', ['Freyr']],
    ['Njord', 'Njörðr', 'M', 'principal', ['agua', 'riqueza'], 'agua', ['Njörðr', 'Njörd']],
    ['Tyr', 'Týr', 'M', 'principal', ['guerra', 'justica'], 'ceu', ['Týr', 'Tiw']],
    ['Heimdall', 'Heimdall', 'M', 'principal', ['ceu', 'viagem'], 'ceu', ['Heimdallr', 'Heimdal']],
    ['Hel', 'Hel (mythological being)', 'F', 'principal', ['morte'], 'submundo', ['Hela']],
    ['Bragi', 'Bragi', 'M', 'menor', ['artes'], 'ceu', []],
    ['Vidar', 'Víðarr', 'M', 'menor', ['guerra'], 'ceu', ['Víðarr', 'Vidarr']],
    ['Sif', 'Sif', 'F', 'menor', ['colheita', 'lar'], 'terra', []],
    ['Idun', 'Iðunn', 'F', 'menor', ['cura', 'colheita'], 'ceu', ['Iðunn', 'Idunn', 'Iduna']],
    ['Skadi', 'Skaði', 'F', 'tita', ['natureza'], 'terra', ['Skaði']],
    ['Ymir', 'Ymir', 'M', 'primordial', ['criacao'], 'terra', ['Aurgelmir']],
    ['Surtr', 'Surtr', 'M', 'tita', ['fogo', 'caos'], 'terra', ['Surt']],
    ['Mímir', 'Mímir', 'M', 'menor', ['sabedoria'], 'terra', ['Mimir']],
    ['Aegir', 'Ægir', 'M', 'tita', ['agua'], 'agua', ['Ægir']],
    ['Ran', 'Rán', 'F', 'tita', ['agua', 'morte'], 'agua', ['Rán']],
    ['Sól', 'Sól (Germanic mythology)', 'F', 'menor', ['sol'], 'ceu', ['Sol', 'Sunna']],
    ['Máni', 'Máni', 'M', 'menor', ['lua'], 'ceu', ['Mani']],
    ['Nótt', 'Nótt', 'F', 'tita', ['noite'], 'ceu', ['Nott']],
    ['Forseti', 'Forseti', 'M', 'menor', ['justica'], 'ceu', []],
    ['Ullr', 'Ullr', 'M', 'menor', ['natureza'], 'terra', ['Ull', 'Uller']],
    ['Eir', 'Eir', 'F', 'menor', ['cura'], 'ceu', []],
  ] },

  { group: 'egipcia', pantheon: 'Egípcia', minimo: 15, deuses: [
    ['Rá', 'Ra', 'M', 'soberano', ['sol', 'criacao'], 'ceu', ['Ra', 'Re', 'Rê']],
    ['Amon', 'Amun', 'M', 'soberano', ['ceu', 'criacao'], 'ceu', ['Amun', 'Amon-Rá', 'Amen']],
    ['Atum', 'Atum', 'M', 'primordial', ['criacao', 'sol'], 'ceu', ['Tem']],
    ['Nun', 'Nu (mythology)', 'M', 'primordial', ['agua', 'criacao'], 'agua', ['Nu']],
    ['Osíris', 'Osiris', 'M', 'principal', ['morte', 'colheita'], 'submundo', ['Osiris', 'Usir']],
    ['Ísis', 'Isis', 'F', 'principal', ['magia', 'cura', 'lar'], 'ceu', ['Isis', 'Aset']],
    ['Hórus', 'Horus', 'M', 'principal', ['ceu', 'guerra'], 'ceu', ['Horus', 'Hor']],
    ['Seth', 'Set (deity)', 'M', 'principal', ['caos', 'tempestade'], 'terra', ['Set', 'Sutekh']],
    ['Néftis', 'Nephthys', 'F', 'principal', ['morte'], 'submundo', ['Nephthys', 'Neftis']],
    ['Anúbis', 'Anubis', 'M', 'principal', ['morte'], 'submundo', ['Anubis', 'Anpu']],
    ['Tot', 'Thoth', 'M', 'principal', ['sabedoria', 'lua', 'magia'], 'ceu', ['Thoth', 'Toth', 'Djehuty']],
    ['Maat', 'Maat', 'F', 'principal', ['justica'], 'ceu', ["Ma'at", 'Mat']],
    ['Bastet', 'Bastet', 'F', 'principal', ['lar'], 'terra', ['Bast', 'Bastete']],
    ['Sekhmet', 'Sekhmet', 'F', 'principal', ['guerra', 'cura'], 'terra', ['Sacmis', 'Sekmet']],
    ['Hathor', 'Hathor', 'F', 'principal', ['amor', 'artes', 'festa'], 'ceu', ['Hator']],
    ['Sobek', 'Sobek', 'M', 'menor', ['agua'], 'agua', ['Sebek', 'Suchos']],
    ['Ptá', 'Ptah', 'M', 'principal', ['criacao', 'artes'], 'terra', ['Ptah']],
    ['Khnum', 'Khnum', 'M', 'menor', ['criacao', 'agua'], 'agua', ['Quenúbis', 'Chnum']],
    ['Geb', 'Geb', 'M', 'principal', ['terra'], 'terra', ['Keb']],
    ['Nut', 'Nut (goddess)', 'F', 'principal', ['ceu'], 'ceu', []],
    ['Shu', 'Shu (Egyptian god)', 'M', 'principal', ['tempestade', 'ceu'], 'ceu', ['Chu']],
    ['Tefnut', 'Tefnut', 'F', 'principal', ['agua'], 'ceu', ['Tefenet']],
    ['Khepri', 'Khepri', 'M', 'menor', ['sol', 'criacao'], 'ceu', ['Quepri', 'Kheper']],
    ['Apófis', 'Apep', 'M', 'primordial', ['caos', 'noite'], 'submundo', ['Apep', 'Apepi', 'Apophis']],
    ['Aton', 'Aten', 'M', 'principal', ['sol'], 'ceu', ['Aten', 'Aton-Rá']],
    ['Bes', 'Bes', 'M', 'menor', ['lar', 'festa'], 'terra', ['Bés']],
    ['Taweret', 'Taweret', 'F', 'menor', ['lar'], 'terra', ['Tuéris', 'Tueris', 'Tauret']],
    ['Montu', 'Montu', 'M', 'menor', ['guerra'], 'terra', ['Mentu', 'Month']],
    ['Ápis', 'Apis (deity)', 'M', 'menor', ['colheita'], 'terra', ['Apis', 'Hápis']],
    ['Mut', 'Mut', 'F', 'menor', ['lar'], 'ceu', []],
    ['Serket', 'Serket', 'F', 'menor', ['cura', 'magia'], 'terra', ['Selket', 'Selkis']],
    ['Hapi', 'Hapi (Nile god)', 'M', 'menor', ['agua', 'colheita'], 'agua', ['Hápi']],
    ['Neith', 'Neith', 'F', 'principal', ['guerra', 'criacao'], 'terra', ['Neit', 'Nit']],
    ['Min', 'Min (god)', 'M', 'menor', ['colheita'], 'terra', []],
  ] },

  { group: 'hindu', pantheon: 'Hindu', deuses: [
    ['Brahma', 'Brahma', 'M', 'principal', ['criacao', 'sabedoria'], 'ceu', ['Brama']],
    ['Vishnu', 'Vishnu', 'M', 'principal', ['justica'], 'ceu', ['Víxenu', 'Visnu', 'Narayana']],
    ['Shiva', 'Shiva', 'M', 'principal', ['caos', 'artes'], 'terra', ['Xiva', 'Siva', 'Mahadeva']],
    ['Indra', 'Indra', 'M', 'soberano', ['tempestade', 'ceu', 'guerra'], 'ceu', []],
    ['Agni', 'Agni', 'M', 'principal', ['fogo'], 'terra', []],
    ['Varuna', 'Varuna', 'M', 'principal', ['agua', 'justica'], 'agua', []],
    ['Vayu', 'Vayu', 'M', 'menor', ['tempestade'], 'ceu', ['Vaiu', 'Pavana']],
    ['Surya', 'Surya', 'M', 'principal', ['sol'], 'ceu', ['Súria', 'Sūrya']],
    ['Chandra', 'Chandra', 'M', 'menor', ['lua'], 'ceu', ['Soma', 'Candra']],
    ['Yama', 'Yama', 'M', 'principal', ['morte', 'justica'], 'submundo', ['Iama']],
    ['Ganesha', 'Ganesha', 'M', 'principal', ['sabedoria', 'riqueza'], 'terra', ['Ganesh', 'Ganapati', 'Ganexa']],
    ['Lakshmi', 'Lakshmi', 'F', 'principal', ['riqueza', 'amor'], 'ceu', ['Laxmi', 'Lácxmi', 'Sri']],
    ['Saraswati', 'Saraswati', 'F', 'principal', ['sabedoria', 'artes'], 'ceu', ['Sarasvati']],
    ['Parvati', 'Parvati', 'F', 'principal', ['amor', 'lar'], 'terra', ['Uma', 'Gauri']],
    ['Durga', 'Durga', 'F', 'principal', ['guerra'], 'terra', []],
    ['Kali', 'Kali', 'F', 'principal', ['morte', 'tempo', 'caos'], 'terra', ['Cáli', 'Kalika']],
    ['Hanuman', 'Hanuman', 'M', 'menor', ['guerra', 'sabedoria'], 'terra', ['Hanumã', 'Hanumat']],
    ['Krishna', 'Krishna', 'M', 'principal', ['amor', 'artes'], 'terra', ['Críxena', 'Krisna', 'Krsna']],
    ['Rama', 'Rama', 'M', 'principal', ['justica', 'guerra'], 'terra', ['Ram', 'Ramachandra']],
    ['Kartikeya', 'Kartikeya', 'M', 'menor', ['guerra'], 'terra', ['Murugan', 'Skanda', 'Subrahmanya']],
    ['Kama', 'Kamadeva', 'M', 'menor', ['amor'], 'ceu', ['Kamadeva', 'Kamadev']],
    ['Ganga', 'Ganga (goddess)', 'F', 'menor', ['agua', 'cura'], 'agua', ['Ganges', 'Gange']],
    ['Kubera', 'Kubera', 'M', 'menor', ['riqueza'], 'terra', ['Kuvera']],
    ['Ushas', 'Ushas', 'F', 'menor', ['ceu'], 'ceu', ['Usha', 'Uxas']],
    ['Aditi', 'Aditi', 'F', 'primordial', ['criacao', 'ceu'], 'ceu', []],
  ] },

  { group: 'japonesa', pantheon: 'Japonesa', deuses: [
    ['Izanagi', 'Izanagi', 'M', 'primordial', ['criacao'], 'ceu', ['Izanagi-no-Mikoto']],
    ['Izanami', 'Izanami', 'F', 'primordial', ['criacao', 'morte'], 'submundo', ['Izanami-no-Mikoto']],
    ['Amaterasu', 'Amaterasu', 'F', 'soberano', ['sol'], 'ceu', ['Amaterasu-Ōmikami', 'Amaterasu Omikami']],
    ['Tsukuyomi', 'Tsukuyomi-no-Mikoto', 'M', 'principal', ['lua', 'noite'], 'ceu', ['Tsukiyomi', 'Tsukuyomi-no-Mikoto']],
    ['Susanoo', 'Susanoo', 'M', 'principal', ['tempestade', 'agua'], 'agua', ['Susano-o', 'Susanowo', 'Sussanoo']],
    ['Raijin', 'Raijin', 'M', 'menor', ['tempestade'], 'ceu', ['Raiden', 'Kaminari-sama']],
    ['Fujin', 'Fūjin', 'M', 'menor', ['tempestade'], 'ceu', ['Fūjin', 'Futen']],
    ['Inari', 'Inari Ōkami', 'A', 'principal', ['colheita', 'riqueza'], 'terra', ['Inari Ōkami', 'Oinari']],
    ['Hachiman', 'Hachiman', 'M', 'principal', ['guerra'], 'terra', ['Yahata']],
    ['Ryujin', 'Ryūjin', 'M', 'menor', ['agua'], 'agua', ['Ryūjin', 'Watatsumi', 'Owatatsumi']],
    ['Ebisu', 'Ebisu (mythology)', 'M', 'menor', ['riqueza', 'agua'], 'agua', ['Yebisu', 'Hiruko']],
    ['Benzaiten', 'Benzaiten', 'F', 'menor', ['artes', 'riqueza', 'agua'], 'agua', ['Benten']],
    ['Bishamonten', 'Bishamonten', 'M', 'menor', ['guerra', 'riqueza'], 'ceu', ['Bishamon', 'Tamonten']],
    ['Daikokuten', 'Daikokuten', 'M', 'menor', ['riqueza', 'colheita'], 'terra', ['Daikoku']],
    ['Kagutsuchi', 'Kagu-tsuchi', 'M', 'menor', ['fogo'], 'terra', ['Kagu-tsuchi', 'Homusubi']],
    ['Ame-no-Uzume', 'Ame-no-Uzume', 'F', 'menor', ['festa', 'artes'], 'ceu', ['Uzume']],
    ['Omoikane', 'Omoikane', 'M', 'menor', ['sabedoria'], 'ceu', []],
    ['Takemikazuchi', 'Takemikazuchi', 'M', 'menor', ['tempestade', 'guerra'], 'ceu', ['Kashima']],
    ['Okuninushi', 'Ōkuninushi', 'M', 'principal', ['cura', 'magia'], 'terra', ['Ōkuninushi', 'Daikoku']],
    ['Konohanasakuya-hime', 'Konohanasakuya-hime', 'F', 'menor', ['natureza', 'terra'], 'terra', ['Sakuya-hime', 'Konohana']],
  ] },

  { group: 'chinesa', pantheon: 'Chinesa', deuses: [
    ['Imperador de Jade', 'Jade Emperor', 'M', 'soberano', ['ceu', 'justica'], 'ceu', ['Yu Huang', 'Yuhuang', 'Imperador Jade']],
    ['Pangu', 'Pangu', 'M', 'primordial', ['criacao'], 'terra', ['Pan Gu', 'Pan Ku']],
    ['Nüwa', 'Nüwa', 'F', 'primordial', ['criacao'], 'ceu', ['Nuwa', 'Nu Wa', 'Nügua']],
    ['Fuxi', 'Fuxi', 'M', 'primordial', ['criacao', 'sabedoria'], 'terra', ['Fu Xi', 'Fu Hsi']],
    ['Xiwangmu', 'Queen Mother of the West', 'F', 'principal', ['cura'], 'ceu', ['Rainha-Mãe do Oeste', 'Xi Wangmu', 'Wangmu']],
    ['Guanyin', 'Guanyin', 'F', 'principal', ['cura', 'lar'], 'ceu', ['Kuan Yin', 'Kannon', 'Guan Yin']],
    ["Chang'e", "Chang'e", 'F', 'menor', ['lua'], 'ceu', ['Chang E', 'Change', 'Heng-o']],
    ['Houyi', 'Houyi', 'M', 'menor', ['natureza', 'sol'], 'terra', ['Hou Yi', 'Yi']],
    ['Guan Yu', 'Guan Yu', 'M', 'menor', ['guerra', 'justica'], 'terra', ['Guan Gong', 'Guandi', 'Kuan Yu']],
    ['Sun Wukong', 'Sun Wukong', 'M', 'menor', ['trapaca', 'guerra'], 'terra', ['Rei Macaco', 'Wukong', 'Macaco Rei', 'Son Goku']],
    ['Nezha', 'Nezha', 'M', 'menor', ['guerra'], 'ceu', ['Ne Zha', 'Nata']],
    ['Erlang Shen', 'Erlang Shen', 'M', 'menor', ['agua', 'guerra'], 'ceu', ['Erlang', 'Yang Jian']],
    ['Caishen', 'Caishen', 'M', 'menor', ['riqueza'], 'terra', ['Cai Shen', 'Tsai Shen']],
    ['Leigong', 'Leigong', 'M', 'menor', ['tempestade'], 'ceu', ['Lei Gong', 'Lei Shen']],
    ['Rei Dragão', 'Dragon King', 'M', 'menor', ['agua', 'tempestade'], 'agua', ['Longwang', 'Long Wang', 'Rei Dragão do Mar']],
    ['Mazu', 'Mazu', 'F', 'menor', ['agua'], 'agua', ['Matsu', 'Tianhou', 'Tin Hau']],
    ['Zhong Kui', 'Zhong Kui', 'M', 'menor', ['magia'], 'submundo', ['Chung Kuei']],
    ['Yanluo', 'Yama (East Asia)', 'M', 'principal', ['morte', 'justica'], 'submundo', ['Yan Wang', 'Yanluo Wang', 'Yanwang']],
    ['Zao Jun', 'Zao Jun', 'M', 'menor', ['lar', 'fogo'], 'terra', ['Deus da Cozinha', 'Zao Shen']],
    ['Shennong', 'Shennong', 'M', 'menor', ['colheita', 'cura'], 'terra', ['Shen Nong']],
    ['Tudigong', 'Tudigong', 'M', 'menor', ['terra', 'riqueza'], 'terra', ['Tudi Gong', 'Tu Di Gong', 'Tudi']],
  ] },

  { group: 'orixas', pantheon: 'Iorubá', inteiro: true, deuses: [
    ['Olorum', 'Olodumare', 'M', 'soberano', ['criacao', 'ceu'], 'ceu', ['Olodumare', 'Olodumaré', 'Olorun']],
    ['Oxalá', 'Obatala', 'M', 'principal', ['criacao'], 'ceu', ['Obatalá', 'Orixalá', 'Oxaguiã', 'Oxalufã']],
    ['Iemanjá', 'Yemọja', 'F', 'principal', ['agua', 'lar'], 'agua', ['Yemanjá', 'Yemoja', 'Janaína', 'Rainha do Mar']],
    ['Oxum', 'Ọṣun', 'F', 'principal', ['agua', 'amor', 'riqueza'], 'agua', ['Oshun', 'Osun', 'Ochún']],
    ['Xangô', 'Shango', 'M', 'principal', ['tempestade', 'justica', 'fogo'], 'ceu', ['Shango', 'Sàngó', 'Changó']],
    ['Iansã', 'Oya', 'F', 'principal', ['tempestade', 'morte', 'guerra'], 'ceu', ['Oyá', 'Oya', 'Iansá', 'Yansã']],
    ['Ogum', 'Ogun', 'M', 'principal', ['guerra', 'fogo', 'viagem'], 'terra', ['Ogun', 'Ògún', 'Ogou']],
    ['Oxóssi', 'Oshosi', 'M', 'principal', ['natureza'], 'terra', ['Oshosi', 'Ochosi', 'Oxossi']],
    ['Exu', 'Eshu', 'M', 'principal', ['viagem', 'trapaca'], 'terra', ['Eshu', 'Èṣù', 'Elegbara', 'Legba']],
    ['Obaluaê', 'Babalú-Ayé', 'M', 'principal', ['cura', 'morte'], 'terra', ['Omolu', 'Omulu', 'Obaluaiê', 'Babalú-Ayé', 'Xapanã']],
    ['Nanã', 'Nana Buluku', 'F', 'primordial', ['criacao', 'morte', 'agua'], 'agua', ['Nanã Buruquê', 'Nana Buruku', 'Nana Buluku']],
    ['Oxumaré', 'Oshunmare', 'A', 'principal', ['ceu', 'riqueza'], 'ceu', ['Oshunmare', 'Oxumarê', 'Òṣùmàrè']],
    ['Obá', 'Oba (orisha)', 'F', 'menor', ['agua', 'guerra'], 'agua', ['Oba']],
    ['Ewá', 'Yewa', 'F', 'menor', ['agua', 'magia'], 'agua', ['Yewa', 'Euá', 'Iewá']],
    ['Ossaim', 'Osanyin', 'M', 'menor', ['cura', 'natureza'], 'terra', ['Osanyin', 'Ossain', 'Ossãe']],
    ['Orunmilá', 'Orunmila', 'M', 'principal', ['sabedoria', 'tempo'], 'ceu', ['Orunmila', 'Ifá', 'Orumilá']],
    ['Oko', 'Orisha Oko', 'M', 'menor', ['colheita'], 'terra', ['Orixá Okô', 'Okô']],
  ] },

  { group: 'mesoamerica', deuses: [
    ['Quetzalcóatl', 'Quetzalcoatl', 'M', 'principal', ['tempestade', 'sabedoria', 'criacao'], 'ceu', ['Quetzalcoatl', 'Serpente Emplumada'], 'Asteca'],
    ['Tezcatlipoca', 'Tezcatlipoca', 'M', 'principal', ['noite', 'magia', 'tempo'], 'ceu', [], 'Asteca'],
    ['Huitzilopochtli', 'Huitzilopochtli', 'M', 'principal', ['sol', 'guerra'], 'ceu', ['Uitzilopochtli'], 'Asteca'],
    ['Tláloc', 'Tlaloc', 'M', 'principal', ['tempestade', 'colheita'], 'ceu', ['Tlaloc'], 'Asteca'],
    ['Xipe Totec', 'Xipe Totec', 'M', 'menor', ['colheita'], 'terra', [], 'Asteca'],
    ['Mictlantecuhtli', 'Mictlantecuhtli', 'M', 'principal', ['morte'], 'submundo', ['Mictlantecutli'], 'Asteca'],
    ['Mictecacíhuatl', 'Mictecacihuatl', 'F', 'principal', ['morte'], 'submundo', ['Mictecacihuatl'], 'Asteca'],
    ['Coatlicue', 'Coatlicue', 'F', 'principal', ['terra', 'criacao'], 'terra', ['Coatlicué'], 'Asteca'],
    ['Chalchiuhtlicue', 'Chalchiuhtlicue', 'F', 'menor', ['agua'], 'agua', [], 'Asteca'],
    ['Xochiquetzal', 'Xochiquetzal', 'F', 'menor', ['amor', 'artes'], 'terra', [], 'Asteca'],
    ['Tonatiuh', 'Tonatiuh', 'M', 'menor', ['sol'], 'ceu', [], 'Asteca'],
    ['Coyolxauhqui', 'Coyolxauhqui', 'F', 'menor', ['lua'], 'ceu', [], 'Asteca'],
    ['Ometéotl', 'Ometeotl', 'A', 'primordial', ['criacao'], 'ceu', ['Ometeotl', 'Ometecuhtli', 'Omecihuatl'], 'Asteca'],
    ['Centéotl', 'Centeotl', 'M', 'menor', ['colheita'], 'terra', ['Centeotl', 'Cintéotl', 'Cinteotl'], 'Asteca'],
    ['Mixcóatl', 'Mixcoatl', 'M', 'menor', ['natureza'], 'terra', ['Mixcoatl'], 'Asteca'],
    ['Huehuecóyotl', 'Huehuecoyotl', 'M', 'menor', ['trapaca', 'artes'], 'terra', ['Huehuecoyotl'], 'Asteca'],
    ['Kukulkán', 'Kukulkan', 'M', 'principal', ['tempestade', 'sabedoria'], 'ceu', ['Kukulkan', 'Kukulcán', 'Gucumatz'], 'Maia'],
    ['Itzamná', 'Itzamna', 'M', 'soberano', ['ceu', 'sabedoria', 'cura'], 'ceu', ['Itzamna', 'Itzamnaaj'], 'Maia'],
    ['Ixchel', 'Ixchel', 'F', 'principal', ['lua', 'cura', 'lar'], 'ceu', ['Ix Chel'], 'Maia'],
    ['Chaac', 'Chaac', 'M', 'principal', ['tempestade', 'colheita'], 'ceu', ['Chac', 'Chaak'], 'Maia'],
    ['Ah Puch', 'Ah Puch', 'M', 'principal', ['morte'], 'submundo', ['Kisin', 'Yum Kimil'], 'Maia'],
    ['Huracán', 'Huracan', 'M', 'principal', ['tempestade', 'criacao'], 'ceu', ['Hurakan', 'Juracán'], 'Maia'],
    ['Camazotz', 'Camazotz', 'M', 'menor', ['noite', 'morte'], 'submundo', ['Zotz'], 'Maia'],
    ['Kinich Ahau', 'Kinich Ahau', 'M', 'principal', ['sol'], 'ceu', ["K'inich Ajaw", 'Kinich Ajaw'], 'Maia'],
    ['Ek Chuaj', 'Ek Chuaj', 'M', 'menor', ['viagem', 'riqueza'], 'terra', ['Ek Chuah'], 'Maia'],
  ] },

  { group: 'celta', pantheon: 'Celta', deuses: [
    ['Dagda', 'The Dagda', 'M', 'soberano', ['colheita', 'magia', 'sabedoria'], 'terra', ['O Dagda', 'Eochaid Ollathair']],
    ['Morrígan', 'The Morrígan', 'F', 'principal', ['guerra', 'morte', 'magia'], 'terra', ['Morrigan', 'Morrígu']],
    ['Lugh', 'Lugh', 'M', 'principal', ['artes', 'guerra'], 'ceu', ['Lugus', 'Lug', 'Lleu']],
    ['Brígida', 'Brigid', 'F', 'principal', ['fogo', 'cura', 'artes'], 'terra', ['Brigid', 'Brigit', 'Bríd']],
    ['Nuada', 'Nuada', 'M', 'soberano', ['guerra'], 'terra', ['Nuadu', 'Nodens']],
    ['Manannán', 'Manannán mac Lir', 'M', 'principal', ['agua', 'magia'], 'agua', ['Manannán mac Lir', 'Manannan', 'Manawydan']],
    ['Danu', 'Danu (Irish goddess)', 'F', 'primordial', ['criacao', 'terra'], 'terra', ['Anu', 'Dana']],
    ['Ogma', 'Ogma', 'M', 'menor', ['sabedoria', 'artes'], 'terra', ['Ogmios']],
    ['Dian Cécht', 'Dian Cecht', 'M', 'menor', ['cura'], 'terra', ['Dian Cecht']],
    ['Goibniu', 'Goibniu', 'M', 'menor', ['fogo'], 'terra', ['Gofannon']],
    ['Aengus', 'Aengus', 'M', 'menor', ['amor'], 'terra', ['Angus', 'Óengus', 'Mac Óc']],
    ['Balor', 'Balor', 'M', 'tita', ['caos', 'morte'], 'agua', []],
    ['Cernuno', 'Cernunnos', 'M', 'principal', ['natureza', 'riqueza'], 'terra', ['Cernunnos', 'Kernunnos']],
    ['Epona', 'Epona', 'F', 'menor', ['colheita', 'viagem'], 'terra', []],
    ['Taranis', 'Taranis', 'M', 'principal', ['tempestade', 'ceu'], 'ceu', []],
    ['Beleno', 'Belenus', 'M', 'menor', ['sol', 'cura'], 'ceu', ['Belenus', 'Belenos', 'Bel']],
    ['Arawn', 'Arawn', 'M', 'menor', ['morte'], 'submundo', []],
    ['Rhiannon', 'Rhiannon', 'F', 'menor', ['magia'], 'terra', []],
    ['Cerridwen', 'Ceridwen', 'F', 'menor', ['magia', 'sabedoria'], 'terra', ['Ceridwen', 'Keridwen']],
    ['Toutatis', 'Toutatis', 'M', 'menor', ['guerra', 'justica'], 'terra', ['Teutates']],
  ] },

  { group: 'mesopotamica', pantheon: 'Mesopotâmica', deuses: [
    ['Anu', 'Anu', 'M', 'soberano', ['ceu'], 'ceu', ['An']],
    ['Enlil', 'Enlil', 'M', 'soberano', ['tempestade', 'ceu'], 'ceu', ['Ellil']],
    ['Enki', 'Enki', 'M', 'principal', ['agua', 'sabedoria', 'criacao'], 'agua', ['Ea']],
    ['Inanna', 'Inanna', 'F', 'principal', ['amor', 'guerra'], 'ceu', ['Ishtar', 'Istar', 'Ištar']],
    ['Marduk', 'Marduk', 'M', 'soberano', ['justica', 'magia'], 'ceu', ['Bel']],
    ['Tiamat', 'Tiamat', 'F', 'primordial', ['agua', 'caos', 'criacao'], 'agua', []],
    ['Apsu', 'Abzu', 'M', 'primordial', ['agua'], 'agua', ['Abzu', 'Absu']],
    ['Shamash', 'Utu', 'M', 'principal', ['sol', 'justica'], 'ceu', ['Utu', 'Šamaš', 'Samas']],
    ['Sin', 'Sin (mythology)', 'M', 'principal', ['lua'], 'ceu', ['Nanna', 'Suen']],
    ['Ereshkigal', 'Ereshkigal', 'F', 'principal', ['morte'], 'submundo', ['Irkalla', 'Allatu']],
    ['Nergal', 'Nergal', 'M', 'principal', ['morte', 'guerra', 'caos'], 'submundo', ['Erra']],
    ['Ninhursag', 'Ninhursag', 'F', 'principal', ['terra', 'colheita'], 'terra', ['Ninhursaga', 'Ninmah']],
    ['Dumuzi', 'Dumuzid', 'M', 'menor', ['colheita'], 'terra', ['Tamuz', 'Tammuz', 'Dumuzid']],
    ['Assur', 'Ashur (god)', 'M', 'soberano', ['guerra'], 'ceu', ['Ashur', 'Aššur']],
    ['Nabu', 'Nabu', 'M', 'menor', ['sabedoria'], 'terra', ['Nebo']],
    ['Adad', 'Hadad', 'M', 'principal', ['tempestade'], 'ceu', ['Hadad', 'Ishkur', 'Iškur']],
    ['Ninurta', 'Ninurta', 'M', 'principal', ['guerra', 'colheita'], 'terra', ['Ningirsu']],
    ['Pazuzu', 'Pazuzu', 'M', 'menor', ['tempestade', 'caos'], 'ceu', []],
  ] },
];

// ------------------------------------------------------------- a Wikipedia

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

async function pega(url, tentativas = 6) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (res.status === 429) {
        await sleep(2000 * 2 ** i);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tentativas) throw err;
      await sleep(600 * i * i);
    }
  }
  throw new Error(`desistiu apos ${tentativas} tentativas: ${url.slice(0, 80)}`);
}

/**
 * Id da Wikidata e imagem de um lote de artigos, seguindo redirecionamento. A
 * imagem e a `pageimage` do artigo, que a Wikipedia ja escolhe entre as livres
 * — a estatua, o relevo, a pintura do topo da pagina. Vem em dois tamanhos: o
 * pequeno e a miniatura da busca, o grande e o da tela de resultado.
 */
async function artigos(titulos, tamanho) {
  return cached(loteSlug(`artigos-${tamanho}`, titulos), async () => {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', redirects: '1',
      prop: 'pageprops|pageimages', ppprop: 'wikibase_item|disambiguation',
      piprop: 'thumbnail', pithumbsize: String(tamanho), pilicense: 'free',
      titles: titulos.join('|'),
    });
    const json = await pega(`${ENWIKI}?${params}`);
    // o titulo pedido pode ter virado outro no caminho (normalizacao, redirect)
    const destino = new Map(titulos.map(t => [t, t]));
    for (const passo of [...(json.query?.normalized ?? []), ...(json.query?.redirects ?? [])]) {
      for (const [pedido, atual] of destino) if (atual === passo.from) destino.set(pedido, passo.to);
    }
    const paginas = new Map((json.query?.pages ?? []).map(p => [p.title, p]));
    return Object.fromEntries(titulos.map((t) => {
      const p = paginas.get(destino.get(t));
      return [t, p && !p.missing ? {
        titulo: p.title,
        qid: p.pageprops?.wikibase_item ?? null,
        ambigua: p.pageprops?.disambiguation !== undefined,
        imagem: p.thumbnail?.source ?? null,
      } : null];
    }));
  });
}

async function emLotes(titulos, tamanho) {
  const saida = {};
  for (let i = 0; i < titulos.length; i += 50) {
    Object.assign(saida, await artigos(titulos.slice(i, i + 50), tamanho));
  }
  return saida;
}

/** A miniatura de cada arquivo do Commons, no tamanho pedido. */
async function doCommons(arquivos, tamanho) {
  const saida = {};
  const nomes = [...new Set(arquivos)];
  for (let i = 0; i < nomes.length; i += 50) {
    const lote = nomes.slice(i, i + 50).map(a => `File:${a}`);
    const info = await cached(loteSlug(`commons-${tamanho}`, lote), () => pega(`${COMMONS}?${new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo',
      iiprop: 'url', iiurlwidth: String(tamanho), titles: lote.join('|'),
    })}`));
    const normal = new Map((info.query?.normalized ?? []).map(n => [n.from, n.to]));
    const urls = new Map((info.query?.pages ?? []).map(p => [p.title, p.imageinfo?.[0]?.thumburl ?? null]));
    for (const titulo of lote) saida[titulo.slice(5)] = urls.get(normal.get(titulo) ?? titulo) ?? null;
  }
  return saida;
}

/**
 * O arquivo da ficha da Wikidata (P18) de quem o artigo em ingles deixou sem
 * imagem. O artigo so escolhe entre as livres do topo, e o do Amon e o do
 * Susanoo nao tem nenhuma — a ficha tem, o relevo ou o ukiyo-e.
 */
async function daWikidata(qids) {
  const saida = {};
  for (let i = 0; i < qids.length; i += 50) {
    const lote = qids.slice(i, i + 50);
    const fichas = await cached(loteSlug('p18', lote), () => pega(`${WIKIDATA}?${new URLSearchParams({
      action: 'wbgetentities', format: 'json', props: 'claims', ids: lote.join('|'),
    })}`));
    for (const q of lote) {
      const arquivo = fichas.entities?.[q]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (arquivo) saida[q] = arquivo;
    }
  }
  return saida;
}

/**
 * A imagem trocada a mao, pelo titulo do artigo: o arquivo do Commons que fica
 * no lugar, ou null para ficar sem. Sao os casos em que a da Wikipedia serve
 * para outro — o relevo do Marduk contra o monstro e o topo do Marduk, do Apsu
 * e da Ninhursag ao mesmo tempo, e no modo imagem os tres seriam a mesma
 * resposta — ou em que ela nao e retrato, como o nome do Olorum escrito.
 */
const IMAGEM = {
  Olodumare: null,
  Abzu: null,
  Ninhursag: 'Ninhursag1.jpg',
  Izanami: 'Izanagi y Izanami, Totoya Hokkei.jpg',
  // os relevos do Carybe no Museu Afro-Brasileiro, em Salvador: sem eles a Oba
  // e a Ewa ficavam sem figura, e o dia dos orixas sem modo imagem (14 de 15)
  'Oba (orisha)': 'Carybè, rilievi degli orixas, obá.JPG',
  Yewa: 'Carybè, rilievi degli orixas, ewá.JPG',
};

/**
 * Visitas de cada item nos ultimos doze meses fechados, no artigo em portugues
 * que a Wikidata liga a ele. Sem artigo em portugues, zero — o que ja diz
 * quanto a sala conhece.
 */
async function visitas(qids) {
  const hoje = new Date();
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0));
  const inicio = new Date(Date.UTC(fim.getUTCFullYear() - 1, fim.getUTCMonth() + 1, 1));
  const dia = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const periodo = `${dia(inicio)}00/${dia(fim)}00`;

  const titulo = {};
  for (let i = 0; i < qids.length; i += 50) {
    const lote = qids.slice(i, i + 50);
    const json = await cached(loteSlug('ptwiki', lote), () => pega(`${WIKIDATA}?${new URLSearchParams({
      action: 'wbgetentities', format: 'json', props: 'sitelinks', sitefilter: 'ptwiki', ids: lote.join('|'),
    })}`));
    for (const q of lote) titulo[q] = json.entities?.[q]?.sitelinks?.ptwiki?.title ?? null;
  }

  const saida = {};
  for (const q of qids) {
    const t = titulo[q];
    if (!t) { saida[q] = 0; continue; }
    const json = await cached(`visitas-${periodo.replace('/', '-')}-${q}`, async () => {
      const res = await fetch(`${METRICS}/${encodeURIComponent(t.replace(/ /g, '_'))}/monthly/${periodo}`,
        { headers: { 'user-agent': UA } });
      return res.ok ? res.json() : { items: [] };
    });
    saida[q] = (json.items ?? []).reduce((soma, m) => soma + m.views, 0);
  }
  return saida;
}

// ------------------------------------------------------------- montagem

const linhas = PANTEOES.flatMap(({ group, pantheon, minimo, inteiro, deuses }) =>
  deuses.map(([name, wiki, gender, rank, domains, realm, aliases, proprio]) => ({
    name, wiki, gender, rank, domains, realm, aliases,
    group, pantheon: proprio ?? pantheon,
    minimo: inteiro ? Infinity : (minimo ?? MINIMO),
  })));

// a tabela e escrita a mao: o script recusa o que nao esta no vocabulario em
// vez de deixar uma celula que nunca fecha verde com ninguem
const erros = [];
const nomes = new Set();
for (const d of linhas) {
  if (nomes.has(d.name)) erros.push(`${d.name}: nome repetido`);
  nomes.add(d.name);
  if (!['M', 'F', 'A'].includes(d.gender)) erros.push(`${d.name}: genero ${d.gender}`);
  if (!POSICOES.has(d.rank)) erros.push(`${d.name}: posicao ${d.rank}`);
  if (!REINOS.has(d.realm)) erros.push(`${d.name}: reino ${d.realm}`);
  if (!d.domains.length || d.domains.length > 3) erros.push(`${d.name}: ${d.domains.length} dominios`);
  for (const x of d.domains) if (!DOMINIOS.has(x)) erros.push(`${d.name}: dominio ${x}`);
  if (!d.pantheon) erros.push(`${d.name}: sem panteao`);
}
if (erros.length) throw new Error(`tabela torta:\n  ${erros.join('\n  ')}`);

const titulos = [...new Set(linhas.map(d => d.wiki))];
const pequenas = await emLotes(titulos, 250);
const grandes = await emLotes(titulos, 500);

// o arquivo do Commons de quem nao fica com a imagem do artigo: o trocado a
// mao primeiro, a ficha da Wikidata para quem o artigo deixou sem
const semArtigo = titulos.filter(t => pequenas[t]?.qid && !pequenas[t].imagem && !(t in IMAGEM));
const ficha = await daWikidata(semArtigo.map(t => pequenas[t].qid));
const arquivoDe = Object.fromEntries([
  ...semArtigo.map(t => [t, ficha[pequenas[t].qid] ?? null]),
  ...Object.entries(IMAGEM),
].filter(([t]) => pequenas[t]));
const arquivos = Object.values(arquivoDe).filter(Boolean);
const commonsPequena = await doCommons(arquivos, 250);
const commonsGrande = await doCommons(arquivos, 500);
for (const [titulo, arquivo] of Object.entries(arquivoDe)) {
  pequenas[titulo].imagem = arquivo ? commonsPequena[arquivo] : null;
  grandes[titulo].imagem = arquivo ? commonsGrande[arquivo] : null;
}

const GENERO = { M: 'Masculino', F: 'Feminino', A: 'Ambos' };
const saida = [];
const semImagem = [];
const vistos = new Map();

for (const d of linhas) {
  const artigo = pequenas[d.wiki];
  if (!artigo?.qid) erros.push(`${d.name}: "${d.wiki}" nao existe na Wikipedia em ingles`);
  else if (artigo.ambigua) erros.push(`${d.name}: "${d.wiki}" e pagina de desambiguacao`);
  if (!artigo?.qid || artigo.ambigua) continue;

  const id = Number(artigo.qid.slice(1));
  if (vistos.has(id)) {
    erros.push(`${d.name}: mesmo artigo que ${vistos.get(id)} (${artigo.titulo})`);
    continue;
  }
  vistos.set(id, d.name);
  if (!artigo.imagem) semImagem.push(d.name);

  // o apelido que so repete o nome (tirando acento) nao ajuda a busca
  const base = d.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const aliases = [...new Set(d.aliases)]
    .filter(a => a.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() !== base);

  saida.push({
    id,
    name: d.name,
    group: d.group,
    pantheon: d.pantheon,
    gender: GENERO[d.gender],
    domains: [...new Set(d.domains.map(x => FAMILIA[x]))],
    rank: d.rank,
    realm: d.realm,
    sprite: artigo.imagem,
    artwork: grandes[d.wiki]?.imagem ?? artigo.imagem,
    ...(aliases.length ? { aliases } : {}),
    eligible: false,
    minimo: d.minimo,
  });
}

if (erros.length) throw new Error(`a Wikipedia nao fechou com a tabela:\n  ${erros.join('\n  ')}`);

// a peneira da fama: acima do piso entra; abaixo, so os primeiros do panteao
// ate o minimo dele
const fama = await visitas(saida.map(d => `Q${d.id}`));
for (const { group } of PANTEOES) {
  const doPanteao = saida.filter(d => d.group === group)
    .sort((a, b) => fama[`Q${b.id}`] - fama[`Q${a.id}`]);
  doPanteao.forEach((d, i) => { d.eligible = fama[`Q${d.id}`] >= PISO_VISITAS || i < d.minimo; });
}
for (const d of saida) delete d.minimo;

await fs.writeFile(OUT, JSON.stringify(saida));

const porGrupo = {};
for (const d of saida.filter(d => d.eligible)) porGrupo[d.group] = (porGrupo[d.group] ?? 0) + 1;
console.log(`${saida.length} deuses em ${OUT}, ${saida.filter(d => d.eligible).length} sorteaveis`);
for (const { group } of PANTEOES) console.log(`  ${group}: ${porGrupo[group] ?? 0}`);
if (semImagem.length) console.log(`\nsem imagem livre (${semImagem.length}): ${semImagem.join(', ')}`);
