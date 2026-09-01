/**
 * Definicao dos universos jogaveis. Compartilhado entre servidor e navegador:
 * o servidor importa via ../shared/universes.js, o cliente importa em build.
 *
 * Cada dataset em data/<dataFile> e uma lista de itens com, no minimo:
 *   id, name, group, sprite, artwork, eligible  +  uma chave por coluna.
 *
 * `group` e a fatia que o host liga/desliga na sala (geracao, raca, vila...).
 * `eligible` marca quem tem dados completos o bastante para ser o segredo —
 * todo mundo pode ser chutado, mas so os elegiveis sao sorteados.
 *
 * Tipos de coluna:
 *   text    igual -> verde, diferente -> cinza
 *   slot    igual -> verde; valor existe no outro slot do secreto -> amarelo
 *   list    conjuntos iguais -> verde; alguma interseccao -> amarelo
 *   number  igual -> verde; dentro da tolerancia -> amarelo; + seta ▲/▼
 */

const TYPE_PT = {
  normal: 'Normal', fire: 'Fogo', water: 'Água', grass: 'Planta', electric: 'Elétrico',
  ice: 'Gelo', fighting: 'Lutador', poison: 'Venenoso', ground: 'Terrestre', flying: 'Voador',
  psychic: 'Psíquico', bug: 'Inseto', rock: 'Pedra', ghost: 'Fantasma', dragon: 'Dragão',
  dark: 'Sombrio', steel: 'Aço', fairy: 'Fada',
};

const COLOR_PT = {
  black: 'Preto', blue: 'Azul', brown: 'Marrom', gray: 'Cinza', green: 'Verde',
  pink: 'Rosa', purple: 'Roxo', red: 'Vermelho', white: 'Branco', yellow: 'Amarelo',
};

const HAIR_PT = {
  Black: 'Preto', Brown: 'Castanho', Red: 'Ruivo', Ginger: 'Ruivo', Blonde: 'Loiro',
  Blond: 'Loiro', Golden: 'Dourado', Grey: 'Grisalho', Silver: 'Prateado',
  White: 'Branco', Bald: 'Careca', Sandy: 'Acastanhado', Dark: 'Escuro',
  Green: 'Verde', Tawny: 'Fulvo', Purple: 'Roxo', Dull: 'Sem brilho',
  Unknown: 'Não dita',
  // so aparecem em Hunter x Hunter, mas o mapa de cabelo e um so
  Blue: 'Azul', Pink: 'Rosa', Orange: 'Laranja',
};

const COUNTRY_PT = {
  'Great Britain': 'Reino Unido', 'United States': 'EUA', Italy: 'Itália', France: 'França',
  Germany: 'Alemanha', 'East Germany': 'Alemanha Oriental', Argentina: 'Argentina',
  Brazil: 'Brasil', Belgium: 'Bélgica', 'South Africa': 'África do Sul',
  Switzerland: 'Suíça', Japan: 'Japão', Netherlands: 'Países Baixos', Spain: 'Espanha',
  Austria: 'Áustria', Canada: 'Canadá', Sweden: 'Suécia', 'New Zealand': 'Nova Zelândia',
  Finland: 'Finlândia', Mexico: 'México', Ireland: 'Irlanda', Denmark: 'Dinamarca',
  Australia: 'Austrália', Monaco: 'Mônaco', Uruguay: 'Uruguai', Portugal: 'Portugal',
  Rhodesia: 'Rodésia', Russia: 'Rússia', Venezuela: 'Venezuela', Colombia: 'Colômbia',
  Thailand: 'Tailândia', India: 'Índia', Liechtenstein: 'Liechtenstein', Chile: 'Chile',
  'Czech Republic': 'Tchéquia', Malaysia: 'Malásia', Hungary: 'Hungria', Poland: 'Polônia',
  Indonesia: 'Indonésia', China: 'China',
};

const CAR_CATEGORY_PT = {
  subcompacto: 'Subcompacto', compacto: 'Compacto', medio: 'Médio',
  grande: 'Grande', esportivo: 'Esportivo 2 lugares', suv: 'SUV',
  picape: 'Picape', perua: 'Perua', van: 'Van',
};

const CAR_DRIVE_PT = {
  dianteira: 'Dianteira', traseira: 'Traseira', integral: 'Integral', '4x4': '4x4',
};

const MLP_KIND_PT = {
  earth: 'Pônei terrestre', unicorn: 'Unicórnio', pegasus: 'Pégaso',
  alicorn: 'Alicórnio', crystal: 'Pônei de cristal', human: 'Humano',
  pony: 'Pônei', dragon: 'Dragão', griffon: 'Grifo', hippogriff: 'Hipogrifo',
  seapony: 'Pônei-do-mar', changeling: 'Changeling', yak: 'Iaque',
  siren: 'Sereia', zebra: 'Zebra', donkey: 'Burro', mule: 'Mula',
  buffalo: 'Búfalo', kirin: 'Kirin', minotaur: 'Minotauro', centaur: 'Centauro',
  draconequus: 'Draconequus', umbrum: 'Umbrum', 'sea-serpent': 'Serpente marinha',
  breezie: 'Breezie', dog: 'Cão', cat: 'Gato', bear: 'Urso', rabbit: 'Coelho',
  owl: 'Coruja', phoenix: 'Fênix', tortoise: 'Tartaruga', parrot: 'Papagaio',
  cow: 'Vaca', bull: 'Touro', ram: 'Carneiro', alligator: 'Jacaré',
  gargoyle: 'Gárgula', hedgehog: 'Ouriço', raccoon: 'Guaxinim', rock: 'Pedra',
};

const MLP_GENDER_PT = { female: 'Fêmea', male: 'Macho' };

const MLP_PLACE_PT = {
  ponyville: 'Ponyville', canterlot: 'Canterlot', 'crystal-empire': 'Império de Cristal',
  manehattan: 'Manehattan', cloudsdale: 'Cloudsdale', 'mundo-humano': 'Mundo humano',
  appleloosa: 'Appleloosa', griffonstone: 'Griffonstone', 'dragon-lands': 'Terras dos Dragões',
  seaquestria: 'Seaquestria', 'mount-aris': 'Monte Aris', 'las-pegasus': 'Las Pegasus',
  baltimare: 'Baltimare', fillydelphia: 'Fillydelphia', vanhoover: 'Vanhoover',
  yakyakistan: 'Yakyakistan', 'changeling-kingdom': 'Reino Changeling',
  everfree: 'Floresta Everfree', 'our-town': 'Nossa Vila', 'rock-farm': 'Fazenda de Pedras',
  klugetown: 'Klugetown', 'dodge-junction': 'Dodge Junction', somnambula: 'Somnambula',
  'silver-shoals': 'Silver Shoals', maretropolis: 'Maretropolis', 'sires-hollow': 'Sire\'s Hollow',
};

const MLP_JOB_PT = {
  estudante: 'Estudante', realeza: 'Realeza', wonderbolts: 'Wonderbolts',
  ensino: 'Ensino', moda: 'Moda', saude: 'Saúde', imprensa: 'Imprensa',
  esporte: 'Esporte', guarda: 'Guarda', campo: 'Campo', artes: 'Artes',
  comercio: 'Comércio',
};

const DB_RACE_PT = {
  Saiyan: 'Saiyajin', Human: 'Humano', Namekian: 'Namekuseijin', Android: 'Andróide',
  'Frieza Race': 'Raça do Freeza', Majin: 'Majin', God: 'Deus', Angel: 'Anjo',
  'Jiren Race': 'Raça do Jiren', Evil: 'Maligno', Unknown: 'Desconhecida',
  Nucleico: 'Nucleico', 'Nucleico benigno': 'Nucleico benigno',
};

const DB_SIDE_PT = {
  'Z Fighter': 'Guerreiros Z', 'Army of Frieza': 'Exército do Freeza',
  Villain: 'Vilão', 'Pride Troopers': 'Tropas do Orgulho', Freelancer: 'Autônomo',
  'Assistant of Beerus': 'Assistente de Bills', 'Assistant of Vermoud': 'Assistente de Vermoud',
  Other: 'Outros',
};

/**
 * O ki dos personagens vai de 450 ao "969 Googolplex" do Zeno, entao o dataset
 * guarda a ordem de grandeza (log10 / 3) e a celula mostra o nome dela.
 */
const DB_KI_PT = {
  0: 'Centenas', 1: 'Milhares', 2: 'Milhões', 3: 'Bilhões', 4: 'Trilhões',
  5: 'Quatrilhões', 6: 'Quintilhões', 7: 'Sextilhões', 8: 'Setilhões',
  9: 'Incalculável',
};

const NEN_PT = {
  Enhancement: 'Reforço', Transmutation: 'Transmutação', Emission: 'Emissão',
  Manipulation: 'Manipulação', Conjuration: 'Materialização',
  Specialization: 'Especialização', Unknown: 'Nunca revelado',
  None: 'Não usa nen',
};

const HXH_STATUS_PT = { Alive: 'Vivo', Deceased: 'Morto', Unknown: 'Desconhecido' };

/**
 * Afiliacoes da Hunterpedia. O dataset guarda o nome do wiki (em ingles) e a
 * celula mostra a traducao; quem nao esta aqui e nome proprio — os principes
 * "Hui Guo Rou", o Beyond Netero, a Nanika — e sai como veio.
 */
const HXH_AFFILIATION_PT = {
  None: 'Sem afiliação',
  'Hunter Association': 'Associação Hunter',
  'Hunter Association Exorcist': 'Exorcista da Associação Hunter',
  'Amateur Hunters': 'Hunters amadores',
  Zodiacs: 'Zodíacos',
  'Kakin Empire': 'Império Kakin',
  'Kakin Royal Army': 'Exército Real de Kakin',
  'Kakin Justice Bureau': 'Departamento de Justiça de Kakin',
  'Kakin Empire Wildlife Exploration Team': 'Expedição de Fauna de Kakin',
  'Dark Continent Expedition Team': 'Expedição ao Continente Negro',
  'NGL Expedition Team': 'Expedição à NGL',
  'NGL Government': 'Governo da NGL',
  "NGL's Drug Cartel": 'Cartel de drogas da NGL',
  'Chimera Ants': 'Formigas Quimera',
  "Chimera Ants' Colony": 'Colônia das Formigas Quimera',
  'Chimera Ant Queen': 'Rainha das Formigas Quimera',
  'Chimera Ant King': 'Rei das Formigas Quimera',
  'Chimera Ant Extermination Team': 'Time de Extermínio',
  'Royal Guards': 'Guardas Reais',
  'Phantom Troupe': 'Trupe Fantasma',
  'Moritonio Troupe': 'Trupe do Moritonio',
  '"Something Troupe"': 'Trupe "Alguma Coisa"',
  'Zoldyck Family': 'Família Zoldyck',
  'Nostrade Family': 'Família Nostrade',
  'Nostrade Butler': 'Mordomo dos Nostrade',
  'Heil-Ly Family': 'Família Heil-Ly',
  'Cha-R Family': 'Família Cha-R',
  'Xi-Yu Family': 'Família Xi-Yu',
  'Ritz Family': 'Família Ritz',
  'Gappai Family': 'Família Gappai',
  'Kurta Clan': 'Clã Kurta',
  'Glam Clan': 'Clã Glam',
  'Gyudondond Tribe': 'Tribo Gyudondond',
  'Amori Brothers': 'Irmãos Amori',
  'Ortho Siblings': 'Irmãos Ortho',
  'Ten Dons': 'Dez Chefões',
  'Mafia Community': 'Comunidade da Máfia',
  'Ten Dons/Mafia Community': 'Dez Chefões / Comunidade da Máfia',
  'Shadow Beasts': 'Feras das Sombras',
  Shadow: 'Sombra',
  'Heavens Arena': 'Arena Celestial',
  'Trick Tower': 'Torre das Armadilhas',
  'Meteor City': 'Cidade Meteoro',
  'Yorknew City': 'Cidade de Yorknew',
  'Republic of East Gorteau': 'República de Gorteau Oriental',
  'Pure Paladin Squad': 'Esquadrão Paladino Puro',
  'Bomber Group': 'Grupo Bomber',
  'Death Row Convicts': 'Condenados à morte',
  'G.I. Convicts': 'Condenados do Greed Island',
  'Bianu Mercenaries': 'Mercenários de Bianu',
  'Southernpiece Auction House': 'Leilão Southernpiece',
  'Underground Clinic': 'Clínica clandestina',
  'Sengi Guild': 'Guilda Sengi',
  'Norwell Fund': 'Fundo Norwell',
  'Varvard University': 'Universidade Varvard',
  'Miwal University': 'Universidade Miwal',
  'Preview Market': 'Mercado Preview',
  'Stone Wall': 'Muro de Pedra',
  'Cloud-Hidden Style': 'Estilo Oculto nas Nuvens',
  'Shingen-ryu School/Dojo': 'Escola Shingen-ryu',
  "Kazsule's Alliance": 'Aliança de Kazsule',
  "Nickes' Alliance": 'Aliança de Nickes',
  "Leol's Squad": 'Esquadrão do Leol',
  "Zazan's Squad": 'Esquadrão da Zazan',
  "Meleoron's Squad": 'Esquadrão do Meleoron',
  "Meleoron's Squadron": 'Esquadrão do Meleoron',
  "Welfin's Squadron": 'Esquadrão do Welfin',
  "Yunju's Squadron": 'Esquadrão do Yunju',
  "Colt's Squadron": 'Esquadrão do Colt',
  'Team Tsezguerra': 'Time do Tsezguerra',
  'Team Tsezguerra‎': 'Time do Tsezguerra',
  'Team Asta': 'Time do Asta',
  'Team Kazsule': 'Time do Kazsule',
  'Team Hanse': 'Time do Hanse',
  'Team Yabibi': 'Time do Yabibi',
  'Team Tokharone': 'Time do Tokharone',
  'Team Hagakushi': 'Time do Hagakushi',
  'IPA Special Task Force': 'Força-tarefa da IPA',
  "IPA's Special Task Force": 'Força-tarefa da IPA',
  'Have-Nots': 'Despossuídos',
  "Mom's Help": 'Ajuda da mamãe',
  'Unnamed Lover': 'Amante sem nome',
  'Unnamed Man': 'Homem sem nome',
  'Queen Duazul Hui Guo Rou': 'Rainha Duazul Hui Guo Rou',
  Captain: 'Capitão',
  Unknown: 'Desconhecida',
};

const HXH_JOB_PT = {
  hunter: 'Hunter', assassino: 'Assassino', guarda: 'Guarda-costas',
  soldado: 'Soldado', mafioso: 'Mafioso', lutador: 'Lutador', servo: 'Servo',
  realeza: 'Realeza', ladrao: 'Ladrão', jogador: 'Jogador de Greed Island',
  ciencia: 'Ciência e saúde', artista: 'Artista', outros: 'Outra',
  nenhuma: 'Sem ocupação',
};

/** Os wikis respondem o genero em pronome; a celula mostra o rotulo. */
const PRONOUN_PT = { He: 'Masculino', She: 'Feminino', They: 'Outro', It: 'Sem gênero' };

const LOL_RESOURCE_PT = {
  Mana: 'Mana', Energy: 'Energia', Health: 'Vida', Rage: 'Raiva', Fury: 'Fúria',
  Ferocity: 'Ferocidade', Flow: 'Fluxo', Grit: 'Ousadia', Heat: 'Aquecimento',
  Courage: 'Coragem', Shield: 'Escudo', Frenzy: 'Frenesi',
  'Blood Well': 'Poço de Sangue', 'Crimson Rush': 'Ímpeto Vermelho',
  None: 'Sem recurso',
};

const LOL_REGION_PT = {
  Targon: 'Monte Targon', 'Shadow Isles': 'Ilhas das Sombras',
  'Bandle City': 'Bandópolis', Void: 'Vazio',
};

/**
 * Especie na ficha de lore. So as que tem nome em portugues estao aqui — o
 * resto (Yordle, Darkin, Vastaya, Brackern...) e nome proprio e sai como veio.
 */
const LOL_SPECIES_PT = {
  Human: 'Humano', Voidborn: 'Ser do Vazio', Wraith: 'Espectro',
  Revenant: 'Revenante', Demon: 'Demônio', Spirit: 'Espírito',
  'Spirit God': 'Deus espírito', 'Aspect Host': 'Hospedeiro de Aspecto',
  'God-Warrior': 'Guerreiro Divino', Dragon: 'Dragão',
  'Celestial Dragon': 'Dragão Celestial', 'Terrestrial Dragon': 'Dragão Terrestre',
  Minotaur: 'Minotauro', Treant: 'Ent', Cat: 'Gato', Dog: 'Cão',
  'Plague Rat': 'Rato da Praga', 'Fae Fawn': 'Cervo Feérico',
  'Techmaturgy Golem': 'Golem de Techmaturgia', 'Petricite Golem': 'Golem de Petricita',
  'Plant / Human Hybrid': 'Híbrido de planta e humano', Unknown: 'Desconhecida',
};

/**
 * Origem dos agentes de Valorant: pais e continente na mesma celula, entao o
 * mapa tem os dois. O KAY/O e o Omen nao vem de pais nenhum.
 */
const VAL_ORIGIN_PT = {
  ...COUNTRY_PT,
  'United Kingdom': 'Reino Unido', Ghana: 'Gana', Morocco: 'Marrocos',
  Senegal: 'Senegal', Norway: 'Noruega', Croatia: 'Croácia',
  'Türkiye': 'Turquia', 'South Korea': 'Coreia do Sul', Philippines: 'Filipinas',
  Africa: 'África', Europe: 'Europa', Asia: 'Ásia', Oceania: 'Oceania',
  'North America': 'América do Norte', 'South America': 'América do Sul',
  'Alpha Earth': 'Terra Alfa', 'Alternate Timeline Earth': 'Terra de outra linha',
  Unknown: 'Desconhecida',
};

/** Mar de origem no One Piece; "Desconhecida" e a ficha do wiki em branco. */
const OP_ORIGIN_PT = {
  'East Blue': 'East Blue', 'West Blue': 'West Blue', 'North Blue': 'North Blue',
  'South Blue': 'South Blue', 'Grand Line': 'Grand Line', 'Red Line': 'Red Line',
  'Sky Island': 'Ilha do Céu', 'Calm Belt': 'Calm Belt', Unknown: 'Desconhecida',
};

/**
 * Os arcos do mangá em ordem, com o capítulo em que cada um abre. O dataset
 * guarda o índice desta lista (o build importa daqui, para nao existirem duas
 * tabelas de arco) e a coluna mostra o nome: o número esta ali so para a seta
 * ▲/▼ dizer de que lado da historia o segredo esta.
 *
 * Os limites vem da Narutopedia, da frase "covers chapters X to Y of the
 * manga" de cada pagina de arco. `era` e ate onde o jogador precisa ter visto
 * para conhecer o pessoal que estreia ali.
 */
export const NARUTO_ARCS = [
  { serie: 'naruto', start: 1, era: 'classico', label: 'Prólogo — País das Ondas' },
  { serie: 'naruto', start: 34, era: 'classico', label: 'Exame Chūnin' },
  { serie: 'naruto', start: 116, era: 'classico', label: 'Destruição de Konoha' },
  { serie: 'naruto', start: 139, era: 'classico', label: 'Busca por Tsunade' },
  { serie: 'naruto', start: 172, era: 'classico', label: 'Resgate do Sasuke' },
  // intermezzo entre as duas partes: o anime so contou isso em Shippūden
  { serie: 'naruto', start: 239, era: 'shippuden', label: 'Kakashi Gaiden' },
  { serie: 'naruto', start: 245, era: 'shippuden', label: 'Resgate do Kazekage' },
  { serie: 'naruto', start: 282, era: 'shippuden', label: 'Ponte Tenchi' },
  { serie: 'naruto', start: 311, era: 'shippuden', label: 'Caçada à Akatsuki' },
  { serie: 'naruto', start: 343, era: 'shippuden', label: 'Perseguição a Itachi' },
  { serie: 'naruto', start: 368, era: 'shippuden', label: 'A Lenda de Jiraiya' },
  { serie: 'naruto', start: 384, era: 'shippuden', label: 'Irmãos Frente a Frente' },
  { serie: 'naruto', start: 413, era: 'shippuden', label: 'Invasão de Pain' },
  { serie: 'naruto', start: 454, era: 'shippuden', label: 'Reunião dos Cinco Kage' },
  { serie: 'naruto', start: 484, era: 'shippuden', label: 'Contagem para a Guerra' },
  { serie: 'naruto', start: 516, era: 'shippuden', label: 'Guerra: Confronto' },
  { serie: 'naruto', start: 560, era: 'shippuden', label: 'Guerra: Clímax' },
  { serie: 'naruto', start: 640, era: 'shippuden', label: 'Jinchūriki das Dez Caudas' },
  { serie: 'naruto', start: 678, era: 'shippuden', label: 'Kaguya Ōtsutsuki' },
  { serie: 'naruto', start: 700, era: 'boruto', label: 'Epílogo' },
  // o Gaiden numera os capitulos como "700+1" ... "700+10"; o build soma
  { serie: 'naruto', start: 701, era: 'boruto', label: 'Naruto Gaiden' },
  { serie: 'boruto', start: 1, era: 'boruto', label: 'Boruto: Versus Momoshiki' },
  { serie: 'boruto', start: 11, era: 'boruto', label: 'Boruto: Bandidos Mujina' },
  { serie: 'boruto', start: 16, era: 'boruto', label: 'Boruto: Ao' },
  { serie: 'boruto', start: 24, era: 'boruto', label: 'Boruto: Kawaki' },
  { serie: 'boruto', start: 56, era: 'boruto', label: 'Boruto: Investida de Code' },
  { serie: 'boruto', start: 68, era: 'boruto', label: 'Boruto: Onipotência' },
];

const NARUTO_ARC_PT = Object.fromEntries(NARUTO_ARCS.map((arc, i) => [i, arc.label]));

/**
 * O simbolo de chakra de cada natureza, que a celula mostra no lugar do nome —
 * quem assistiu reconhece o 火 do fogo antes de ler "Fogo", e cinco simbolos
 * cabem onde "Raio, Fogo, Vento +3" nao cabia.
 *
 * Os arquivos vem da Narutopedia (`File:Nature Icon <wiki>.svg`), sao baixados
 * por `npm run build:naruto` e ficam versionados em data/icons/naruto/. Quem
 * nao tem simbolo cai no rotulo de texto, como qualquer coluna de lista.
 */
export const NARUTO_NATURE_ICONS = {
  // na ordem do ciclo elemental, que e tambem a ordem em que a celula
  // desenha os simbolos: o build ordena a lista por esta chave
  'Fire Release': { wiki: 'Fire', src: '/icons/naruto/fire.svg' },
  'Wind Release': { wiki: 'Wind', src: '/icons/naruto/wind.svg' },
  'Lightning Release': { wiki: 'Lightning', src: '/icons/naruto/lightning.svg' },
  'Earth Release': { wiki: 'Earth', src: '/icons/naruto/earth.svg' },
  'Water Release': { wiki: 'Water', src: '/icons/naruto/water.svg' },
  'Yin Release': { wiki: 'Yin', src: '/icons/naruto/yin.svg' },
  'Yang Release': { wiki: 'Yang', src: '/icons/naruto/yang.svg' },
  'Yin–Yang Release': { wiki: 'Yin–Yang', src: '/icons/naruto/yin-yang.svg' },
  'Wood Release': { wiki: 'Wood', src: '/icons/naruto/wood.svg' },
  'Ice Release': { wiki: 'Ice', src: '/icons/naruto/ice.svg' },
  'Lava Release': { wiki: 'Lava', src: '/icons/naruto/lava.svg' },
  'Magnet Release': { wiki: 'Magnet', src: '/icons/naruto/magnet.svg' },
  'Boil Release': { wiki: 'Boil', src: '/icons/naruto/boil.svg' },
  'Storm Release': { wiki: 'Storm', src: '/icons/naruto/storm.svg' },
  'Explosion Release': { wiki: 'Explosion', src: '/icons/naruto/explosion.svg' },
  'Steel Release': { wiki: 'Steel', src: '/icons/naruto/steel.svg' },
  'Dust Release': { wiki: 'Dust', src: '/icons/naruto/dust.svg' },
  'Scorch Release': { wiki: 'Scorch', src: '/icons/naruto/scorch.svg' },
  'Swift Release': { wiki: 'Swift', src: '/icons/naruto/swift.svg' },
  'Crystal Release': { wiki: 'Crystal', src: '/icons/naruto/crystal.svg' },
  'Dark Release': { wiki: 'Dark', src: '/icons/naruto/dark.svg' },
  'Mud Release': { wiki: 'Mud', src: '/icons/naruto/mud.svg' },
  'Typhoon Release': { wiki: 'Typhoon', src: '/icons/naruto/typhoon.svg' },
};

const NARUTO_NATURE_PT = {
  'Fire Release': 'Fogo', 'Wind Release': 'Vento', 'Lightning Release': 'Raio',
  'Earth Release': 'Terra', 'Water Release': 'Água', 'Yin Release': 'Yin',
  'Yang Release': 'Yang', 'Yin–Yang Release': 'Yin-Yang', 'Wood Release': 'Madeira',
  'Ice Release': 'Gelo', 'Lava Release': 'Lava', 'Magnet Release': 'Ímã',
  'Boil Release': 'Vapor', 'Dust Release': 'Poeira', 'Storm Release': 'Tempestade',
  'Explosion Release': 'Explosão', 'Steel Release': 'Aço', 'Scorch Release': 'Escaldante',
  'Swift Release': 'Rapidez', 'Crystal Release': 'Cristal', 'Dark Release': 'Trevas',
  'Mud Release': 'Lama', 'Typhoon Release': 'Tufão',
};

/**
 * Kekkei genkai e ou um dōjutsu (nome proprio, sai como veio) ou um elemento
 * misturado — e ai o nome e o mesmo da coluna de natureza, so que como herança.
 */
const NARUTO_KEKKEI_PT = {
  ...Object.fromEntries(Object.entries(NARUTO_NATURE_PT).map(([en, pt]) => [en, `Elemento ${pt}`])),
  Shikotsumyaku: 'Shikotsumyaku',
  "Jūgo's Clan's Kekkei Genkai": 'Kekkei genkai do clã do Jūgo',
  "Sakon and Ukon's Kekkei Genkai": 'Kekkei genkai de Sakon e Ukon',
  "Iburi Clan's Kekkei Genkai": 'Kekkei genkai do clã Iburi',
  "Kurama Clan's Kekkei Genkai": 'Kekkei genkai do clã Kurama',
  "Rinha Clan's Kekkei Genkai": 'Kekkei genkai do clã Rinha',
  "Ranmaru's Kekkei Genkai": 'Kekkei genkai do Ranmaru',
  "Ryūzetsu's Kekkei Genkai": 'Kekkei genkai da Ryūzetsu',
  'Eternal Mangekyō Sharingan': 'Mangekyō Sharingan Eterno',
  "Isshiki's Dōjutsu": 'Dōjutsu do Isshiki',
};

/**
 * Tipo de jutsu, e nao o jutsu em si: a ficha da Narutopedia classifica cada
 * tecnica, e o personagem herda o conjunto das dele. Sao so cinco de proposito
 * — e o que quem assistiu responde de cabeça; o vocabulario cheio da wiki
 * enchia a celula sem separar ninguem (veja TIPOS_DE_JUTSU no build).
 */
const NARUTO_JUTSU_PT = {
  Ninjutsu: 'Ninjutsu', Taijutsu: 'Taijutsu', Genjutsu: 'Genjutsu',
  Kenjutsu: 'Kenjutsu', 'Medical Ninjutsu': 'Ninjutsu médico',
};

/**
 * A vila pelo apelido, que e como todo mundo fala: "Konoha", nao
 * "Konohagakure". O dataset guarda o nome de ficha para a comparacao; aqui e
 * so o que a célula mostra.
 */
const NARUTO_AFFILIATION_PT = {
  Konohagakure: 'Konoha', Sunagakure: 'Suna', Kirigakure: 'Kiri',
  Iwagakure: 'Iwa', Kumogakure: 'Kumo', Otogakure: 'Oto',
  Amegakure: 'Ame', Takigakure: 'Taki', Kusagakure: 'Kusa',
  Yugakure: 'Yu', Uzushiogakure: 'Uzushio', Hoshigakure: 'Hoshi',
  Root: 'Raiz', Anbu: 'Anbu', Akatsuki: 'Akatsuki', Kara: 'Kara', Taka: 'Taka',
};

const NARUTO_CLASS_PT = {
  'Missing-nin': 'Ninja renegado', Summon: 'Invocação', 'Medical-nin': 'Ninja médico',
  'Sensor Type': 'Sensor', Daimyō: 'Daimyō', Jinchūriki: 'Jinchūriki', Sage: 'Sábio',
  'Mercenary Ninja': 'Ninja mercenário', 'S-rank': 'Rank S', Samurai: 'Samurai',
  'Tailed Beast': 'Besta com Cauda', 'Pseudo-Jinchūriki': 'Pseudo-Jinchūriki',
  'Ninja monk': 'Monge ninja', Sannin: 'Sannin', 'Hunter-nin': 'Ninja caçador',
  'Cooking-nin': 'Ninja cozinheiro',
};

/**
 * As familias de poder do Ben 10. A ficha do wiki lista trinta e cinco poderes
 * para um Pyronite; o que vira dica sao estas, e forca, resistencia e salto,
 * que quase todo alien tem, ficam fora de proposito.
 */
const BEN10_POWER_PT = {
  fogo: 'Fogo', gelo: 'Gelo', eletricidade: 'Eletricidade', agua: 'Água',
  planta: 'Planta', terra: 'Terra', cristal: 'Cristal', magnetismo: 'Magnetismo',
  voo: 'Voo', velocidade: 'Velocidade', intangibilidade: 'Intangibilidade',
  invisibilidade: 'Invisibilidade', elasticidade: 'Elasticidade',
  metamorfose: 'Metamorfose', tamanho: 'Tamanho', regeneracao: 'Regeneração',
  tecnologia: 'Tecnologia', som: 'Som', veneno: 'Ácido e veneno',
  energia: 'Energia', teia: 'Teia', esfera: 'Bola', escavacao: 'Escavação',
  realidade: 'Realidade', nenhum: 'Nenhum',
};

const BEN10_SERIES_PT = {
  classica: 'Ben 10 (2005)', alienforce: 'Alien Force',
  ultimatealien: 'Ultimate Alien', omniverse: 'Omniverse', reboot: 'Reboot (2016)',
};

/**
 * A coluna de campanha mostra o mesmo balde que o lobby liga e desliga, entao
 * o rotulo aqui e o do grupo — o dataset guarda so o id.
 */
const ORDEM_CAMPAIGN_PT = {
  osnf: 'O Segredo na Floresta', opd: 'Desconjuração', opc: 'Calamidade',
  osni: 'O Segredo na Ilha', sdol: 'Sinais do Outro Lado', hex: 'Hexatombe',
  livros: 'Livros e pacotes',
};

export const UNIVERSES = {
  pokemon: {
    id: 'pokemon',
    label: 'Pokémon',
    secretLabel: 'o Pokémon secreto',
    dataFile: 'pokemon.json',
    groupLabel: 'Gerações',
    groups: Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1), label: `Gen ${i + 1}` })),
    defaultGroups: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    columns: [
      { key: 'type1', label: 'Tipo 1', kind: 'slot', slots: ['type1', 'type2'], labels: TYPE_PT },
      { key: 'type2', label: 'Tipo 2', kind: 'slot', slots: ['type1', 'type2'], labels: TYPE_PT },
      { key: 'generation', label: 'Ger.', kind: 'number', prefix: 'Gen ' },
      // as cores saem do sprite, nao do rotulo unico da Pokedex (build-pokedex.mjs)
      { key: 'colors', label: 'Cores', kind: 'list', labels: COLOR_PT },
      { key: 'stage', label: 'Evolução', kind: 'number', labels: { 1: '1ª forma', 2: '2ª forma', 3: '3ª forma' } },
      { key: 'height', label: 'Altura', kind: 'number', unit: 'm', tolerance: 0.1 },
      { key: 'weight', label: 'Peso', kind: 'number', unit: 'kg', tolerance: 0.1 },
    ],
  },

  bleach: {
    id: 'bleach',
    label: 'Bleach',
    secretLabel: 'o personagem secreto',
    dataFile: 'bleach.json',
    groupLabel: 'Raças',
    groups: [
      { id: 'shinigami', label: 'Shinigami' },
      { id: 'humans', label: 'Humanos' },
      { id: 'quincy', label: 'Quincy' },
      { id: 'arrancar', label: 'Arrancar' },
    ],
    defaultGroups: ['shinigami', 'humans', 'quincy', 'arrancar'],
    scope: {
      label: 'Épocas',
      key: 'era',
      options: [
        { id: 'agente', label: 'Agente Shinigami', hint: 'Capítulos 1 a 70.' },
        { id: 'soul-society', label: 'Soul Society', hint: 'Capítulos 71 a 182.' },
        { id: 'arrancar', label: 'Arrancar', hint: 'Hueco Mundo e a Karakura falsa, capítulos 183 a 423.' },
        { id: 'sangrenta', label: 'Guerra Sangrenta', hint: 'A guerra contra os Quincy, do capítulo 424 em diante.' },
      ],
    },
    columns: [
      { key: 'race', label: 'Raça', kind: 'text' },
      { key: 'gender', label: 'Gênero', kind: 'text', labels: { Male: 'Masculino', Female: 'Feminino' } },
      { key: 'affiliation', label: 'Afiliação', kind: 'list' },
      { key: 'bankai', label: 'Bankai', kind: 'text' },
      { key: 'debutChapter', label: 'Estreia', kind: 'number', prefix: 'Cap. ', tolerance: 0.1 },
      { key: 'height', label: 'Altura', kind: 'number', unit: 'cm', tolerance: 0.1 },
      { key: 'weight', label: 'Peso', kind: 'number', unit: 'kg', tolerance: 0.1 },
    ],
  },

  clash: {
    id: 'clash',
    label: 'Clash Royale',
    secretLabel: 'a carta secreta',
    dataFile: 'clash.json',
    groupLabel: 'Raridades',
    groups: [
      { id: 'common', label: 'Comum' },
      { id: 'rare', label: 'Rara' },
      { id: 'epic', label: 'Épica' },
      { id: 'legendary', label: 'Lendária' },
      { id: 'champion', label: 'Campeão' },
    ],
    defaultGroups: ['common', 'rare', 'epic', 'legendary', 'champion'],
    columns: [
      {
        key: 'rarity', label: 'Raridade', kind: 'text',
        labels: { Common: 'Comum', Rare: 'Rara', Epic: 'Épica', Legendary: 'Lendária', Champion: 'Campeão' },
      },
      {
        key: 'type', label: 'Tipo', kind: 'text',
        labels: { Troop: 'Tropa', Building: 'Construção', Spell: 'Feitiço' },
      },
      { key: 'elixir', label: 'Elixir', kind: 'number' },
      { key: 'arena', label: 'Arena', kind: 'number', prefix: 'Arena ' },
      {
        key: 'target', label: 'Alvo', kind: 'text',
        labels: { ground: 'Terrestre', air: 'Aéreo', air_ground: 'Ar e terra', buildings: 'Construções', area: 'Área' },
      },
      // construcao nao anda e feitico nao tem vida: o vazio e a resposta, e
      // duas cartas paradas fecham verde entre si
      {
        key: 'speed', label: 'Velocidade', kind: 'number', blank: 'Não anda',
        labels: { 30: 'Muito lenta', 45: 'Lenta', 60: 'Média', 90: 'Rápida', 120: 'Muito rápida' },
      },
      { key: 'hitpoints', label: 'Vida', kind: 'number', tolerance: 0.1, blank: 'Não tem' },
    ],
  },

  naruto: {
    id: 'naruto',
    label: 'Naruto',
    secretLabel: 'o personagem secreto',
    dataFile: 'naruto.json',
    groupLabel: 'Vilas',
    groups: [
      { id: 'konoha', label: 'Konoha' },
      { id: 'suna', label: 'Suna' },
      { id: 'kiri', label: 'Kiri' },
      { id: 'iwa', label: 'Iwa' },
      { id: 'kumo', label: 'Kumo' },
      { id: 'oto', label: 'Oto' },
      { id: 'akatsuki', label: 'Akatsuki' },
      { id: 'outros', label: 'Outros' },
    ],
    defaultGroups: ['konoha', 'suna', 'kiri', 'iwa', 'kumo', 'oto', 'akatsuki', 'outros'],
    // quem parou no Clássico nao tem como adivinhar um personagem que so
    // aparece na guerra. O recorte e cumulativo: quem viu Shippuden viu o
    // Classico antes, entao "Shippuden" inclui o elenco de Part I
    scope: {
      label: 'Épocas',
      key: 'era',
      options: [
        { id: 'classico', label: 'Clássico', hint: 'Capítulos 1 a 238.' },
        { id: 'shippuden', label: 'Shippūden', hint: 'Do Kakashi Gaiden ao fim da guerra, capítulos 239 a 699.' },
        { id: 'boruto', label: 'Boruto', hint: 'Epílogo, Naruto Gaiden e o mangá de Boruto.' },
      ],
    },
    // clã, patente e altura sairam: sao ficha tecnica, nao memoria de quem
    // assistiu. Ficaram as colunas que o jogador responde de cabeça — e vazio
    // aqui e resposta ("Não tem"), nao falta de dado
    columns: [
      {
        key: 'gender', label: 'Gênero', kind: 'text',
        labels: { Male: 'Masculino', Female: 'Feminino', Various: 'Vários', None: 'Sem gênero' },
      },
      { key: 'affiliation', label: 'Filiações', kind: 'list', labels: NARUTO_AFFILIATION_PT },
      { key: 'jutsuTypes', label: 'Tipos de Jutsu', kind: 'list', labels: NARUTO_JUTSU_PT },
      { key: 'kekkeiGenkai', label: 'Kekkei Genkai', kind: 'list', labels: NARUTO_KEKKEI_PT },
      {
        key: 'natureType', label: 'Tipos de natureza', kind: 'list',
        labels: NARUTO_NATURE_PT, icons: NARUTO_NATURE_ICONS,
      },
      { key: 'classification', label: 'Atributos', kind: 'list', labels: NARUTO_CLASS_PT },
      // o indice do arco existe so para a seta ▲/▼ dizer o lado da historia;
      // a celula mostra o nome. `nearby: 1` deixa o arco vizinho em amarelo
      {
        key: 'debutArc', label: 'Arco de estreia', kind: 'number',
        nearby: 1, labels: NARUTO_ARC_PT,
      },
    ],
  },

  yugioh: {
    id: 'yugioh',
    label: 'Yu-Gi-Oh!',
    secretLabel: 'a carta secreta',
    dataFile: 'yugioh.json',
    groupLabel: 'Tipos de carta',
    groups: [
      { id: 'normal', label: 'Normal' },
      { id: 'effect', label: 'Efeito' },
      { id: 'fusion', label: 'Fusão' },
      { id: 'ritual', label: 'Ritual' },
      { id: 'synchro', label: 'Sincro' },
      { id: 'xyz', label: 'Xyz' },
      { id: 'link', label: 'Link' },
      { id: 'pendulum', label: 'Pêndulo' },
      { id: 'spell', label: 'Magia' },
      { id: 'trap', label: 'Armadilha' },
    ],
    defaultGroups: ['normal', 'effect', 'fusion', 'ritual', 'synchro', 'xyz', 'link', 'pendulum', 'spell', 'trap'],
    columns: [
      {
        key: 'kind', label: 'Tipo', kind: 'text',
        labels: {
          normal: 'Normal', effect: 'Efeito', fusion: 'Fusão', ritual: 'Ritual',
          synchro: 'Sincro', xyz: 'Xyz', link: 'Link', pendulum: 'Pêndulo',
          spell: 'Magia', trap: 'Armadilha',
        },
      },
      {
        key: 'attribute', label: 'Atributo', kind: 'text',
        labels: {
          DARK: 'Trevas', LIGHT: 'Luz', EARTH: 'Terra', WATER: 'Água',
          FIRE: 'Fogo', WIND: 'Vento', DIVINE: 'Divino',
          SPELL: 'Magia', TRAP: 'Armadilha',
        },
      },
      { key: 'race', label: 'Raça', kind: 'text' },
      // magia e armadilha nao tem nivel nem ATK/DEF: `blank` diz que o vazio e
      // a resposta, entao duas magias fecham verde em vez de cinza
      { key: 'level', label: 'Nível', kind: 'number', blank: 'Não tem' },
      { key: 'atk', label: 'ATK', kind: 'number', tolerance: 0.1, blank: 'Não tem' },
      { key: 'def', label: 'DEF', kind: 'number', tolerance: 0.1, blank: 'Não tem' },
      { key: 'archetype', label: 'Arquétipo', kind: 'text' },
    ],
  },

  lol: {
    id: 'lol',
    label: 'League of Legends',
    secretLabel: 'o campeão secreto',
    dataFile: 'lol.json',
    groupLabel: 'Função principal',
    groups: [
      { id: 'fighter', label: 'Lutador' },
      { id: 'mage', label: 'Mago' },
      { id: 'assassin', label: 'Assassino' },
      { id: 'marksman', label: 'Atirador' },
      { id: 'tank', label: 'Tanque' },
      { id: 'support', label: 'Suporte' },
    ],
    defaultGroups: ['fighter', 'mage', 'assassin', 'marksman', 'tank', 'support'],
    // as notas de Ataque/Magia/Defesa/Dificuldade do Data Dragon sairam: sao
    // rotulos de 1 a 10 que ninguem sabe de cabeca. No lugar, a ficha de lore
    // do wiki — o mesmo conjunto de colunas do LoLdle
    columns: [
      { key: 'gender', label: 'Gênero', kind: 'text', labels: PRONOUN_PT },
      { key: 'positions', label: 'Posições', kind: 'list' },
      { key: 'species', label: 'Espécie', kind: 'list', labels: LOL_SPECIES_PT },
      { key: 'resource', label: 'Recurso', kind: 'text', labels: LOL_RESOURCE_PT },
      {
        key: 'rangeType', label: 'Alcance', kind: 'text',
        labels: { Melee: 'Corpo a corpo', Ranged: 'À distância' },
      },
      { key: 'regions', label: 'Região', kind: 'list', labels: LOL_REGION_PT },
      { key: 'releaseYear', label: 'Lançamento', kind: 'number' },
    ],
  },

  valorant: {
    id: 'valorant',
    label: 'Valorant · Agentes',
    secretLabel: 'o agente secreto',
    dataFile: 'valorant.json',
    groupLabel: 'Funções',
    groups: [
      { id: 'duelista', label: 'Duelista' },
      { id: 'iniciador', label: 'Iniciador' },
      { id: 'controlador', label: 'Controlador' },
      { id: 'sentinela', label: 'Sentinela' },
    ],
    defaultGroups: ['duelista', 'iniciador', 'controlador', 'sentinela'],
    // "Habilidades" (4 ou 5) e "Passiva" (sim ou nao) sairam: diziam a mesma
    // coisa duas vezes e nao eram conhecimento de jogador. No lugar entrou a
    // ficha do wiki, que e o que os jogos do genero perguntam
    columns: [
      { key: 'role', label: 'Função', kind: 'text' },
      { key: 'gender', label: 'Gênero', kind: 'text', labels: PRONOUN_PT },
      {
        key: 'race', label: 'Raça', kind: 'text',
        labels: { Human: 'Humano', Radiant: 'Radiante', Cybernetic: 'Cibernético', Unknown: 'Desconhecida' },
      },
      // pais e continente juntos: acertar o pais fecha verde, acertar so o
      // continente fecha amarelo
      { key: 'origin', label: 'Origem', kind: 'list', labels: VAL_ORIGIN_PT },
      { key: 'releaseYear', label: 'Lançamento', kind: 'number' },
    ],
  },

  'valorant-armas': {
    id: 'valorant-armas',
    label: 'Valorant · Armas',
    secretLabel: 'a arma secreta',
    dataFile: 'valorant-armas.json',
    groupLabel: 'Categorias',
    groups: [
      { id: 'armas-leves', label: 'Leves' },
      { id: 'submetralhadoras', label: 'SMGs' },
      { id: 'escopetas', label: 'Escopetas' },
      { id: 'fuzis-de-assalto', label: 'Fuzis' },
      { id: 'fuzis-de-precisao', label: 'Snipers' },
      { id: 'armas-pesadas', label: 'Pesadas' },
    ],
    defaultGroups: ['armas-leves', 'submetralhadoras', 'escopetas', 'fuzis-de-assalto', 'fuzis-de-precisao', 'armas-pesadas'],
    columns: [
      { key: 'category', label: 'Categoria', kind: 'text' },
      { key: 'cost', label: 'Custo', kind: 'number', tolerance: 0.1 },
      { key: 'bodyDamage', label: 'Dano', kind: 'number', tolerance: 0.1 },
      { key: 'fireRate', label: 'Cadência', kind: 'number', unit: '/s', tolerance: 0.1 },
      { key: 'magazineSize', label: 'Pente', kind: 'number', tolerance: 0.1 },
      { key: 'penetration', label: 'Penetração', kind: 'text' },
    ],
  },

  rickmorty: {
    id: 'rickmorty',
    label: 'Rick and Morty',
    secretLabel: 'o personagem secreto',
    dataFile: 'rickmorty.json',
    groupLabel: 'Espécies',
    groups: [
      { id: 'human', label: 'Humanos' },
      { id: 'alien', label: 'Aliens' },
      { id: 'outros', label: 'Outros' },
    ],
    defaultGroups: ['human', 'alien', 'outros'],
    scope: {
      label: 'Temporadas',
      key: 'era',
      options: [
        { id: 't1-2', label: '1ª e 2ª', hint: 'Quem apareceu até o fim da 2ª temporada.' },
        { id: 't3-4', label: '3ª e 4ª', hint: 'Estreias da 3ª e da 4ª temporada.' },
        { id: 't5-mais', label: '5ª em diante', hint: 'Estreias da 5ª temporada para cá.' },
      ],
    },
    columns: [
      // "unknown" e resposta da API, nao lacuna: o desenho nunca disse, e dois
      // desconhecidos fecham verde entre si
      {
        key: 'status', label: 'Status', kind: 'text',
        labels: { Alive: 'Vivo', Dead: 'Morto', unknown: 'Desconhecido' },
      },
      { key: 'species', label: 'Espécie', kind: 'text' },
      {
        key: 'gender', label: 'Gênero', kind: 'text',
        labels: { Male: 'Masculino', Female: 'Feminino', Genderless: 'Sem gênero', unknown: 'Desconhecido' },
      },
      { key: 'origin', label: 'Origem', kind: 'text', labels: { unknown: 'Desconhecida' } },
      { key: 'location', label: 'Localização', kind: 'text', labels: { unknown: 'Desconhecida' } },
      { key: 'episodes', label: 'Episódios', kind: 'number', tolerance: 0.1 },
      { key: 'firstEpisode', label: 'Estreia', kind: 'number', prefix: 'Ep. ', tolerance: 0.1 },
    ],
  },

  heroes: {
    id: 'heroes',
    label: 'Super-heróis (Marvel e DC)',
    secretLabel: 'o personagem secreto',
    dataFile: 'heroes.json',
    groupLabel: 'Editoras',
    groups: [
      { id: 'marvel', label: 'Marvel' },
      { id: 'dc', label: 'DC' },
      { id: 'outros', label: 'Outras' },
    ],
    defaultGroups: ['marvel', 'dc', 'outros'],
    // a base so conhece a HQ; quem chegou a tela sai dos wikis dos filmes da
    // Marvel e da DC, mais a lista a mao do build para o que eles nao cobrem
    scope: {
      label: 'Épocas',
      key: 'era',
      options: [
        { id: 'filmes', label: 'Filmes', hint: 'Quem já apareceu em algum filme ou série.' },
        { id: 'quadrinhos', label: 'Só nos quadrinhos', hint: 'Quem nunca saiu da página.' },
      ],
    },
    columns: [
      { key: 'publisher', label: 'Editora', kind: 'text' },
      {
        key: 'alignment', label: 'Alinhamento', kind: 'text',
        labels: { good: 'Herói', bad: 'Vilão', neutral: 'Neutro' },
      },
      { key: 'gender', label: 'Gênero', kind: 'text', labels: { Male: 'Masculino', Female: 'Feminino' } },
      { key: 'race', label: 'Raça', kind: 'text', labels: { Unknown: 'Não dita' } },
      { key: 'intelligence', label: 'Inteligência', kind: 'number', tolerance: 0.1 },
      { key: 'strength', label: 'Força', kind: 'number', tolerance: 0.1 },
      { key: 'height', label: 'Altura', kind: 'number', unit: 'cm', tolerance: 0.1 },
    ],
  },

  potter: {
    id: 'potter',
    label: 'Harry Potter',
    secretLabel: 'o personagem secreto',
    dataFile: 'potter.json',
    groupLabel: 'Casas',
    groups: [
      { id: 'gryffindor', label: 'Grifinória' },
      { id: 'slytherin', label: 'Sonserina' },
      { id: 'ravenclaw', label: 'Corvinal' },
      { id: 'hufflepuff', label: 'Lufa-Lufa' },
    ],
    defaultGroups: ['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff'],
    columns: [
      {
        key: 'house', label: 'Casa', kind: 'text',
        labels: { Gryffindor: 'Grifinória', Slytherin: 'Sonserina', Ravenclaw: 'Corvinal', Hufflepuff: 'Lufa-Lufa' },
      },
      {
        key: 'species', label: 'Espécie', kind: 'text',
        labels: {
          Human: 'Humano', 'Half-giant': 'Meio-gigante', 'Half-human': 'Meio-humano',
          Werewolf: 'Lobisomem', Ghost: 'Fantasma', Goblin: 'Duende', Giant: 'Gigante',
          Centaur: 'Centauro', Vampire: 'Vampiro', 'House-elf': 'Elfo doméstico',
        },
      },
      { key: 'gender', label: 'Gênero', kind: 'text', labels: { male: 'Masculino', female: 'Feminino' } },
      {
        key: 'ancestry', label: 'Ascendência', kind: 'text',
        labels: {
          'pure-blood': 'Sangue puro', 'half-blood': 'Mestiço', muggleborn: 'Nascido trouxa',
          muggle: 'Trouxa', squib: 'Aborto', 'half-veela': 'Meio-veela', 'quarter-veela': 'Um quarto veela',
          'half-breed': 'Meio-humano', unknown: 'Nunca dita',
        },
      },
      { key: 'role', label: 'Papel', kind: 'text' },
      { key: 'alive', label: 'Vivo', kind: 'text' },
      { key: 'hairColour', label: 'Cabelo', kind: 'text', labels: HAIR_PT },
    ],
  },

  lotr: {
    id: 'lotr',
    label: 'Senhor dos Anéis',
    secretLabel: 'o personagem secreto',
    dataFile: 'lotr.json',
    groupLabel: 'Raças',
    groups: [
      { id: 'hobbit', label: 'Hobbits' },
      { id: 'human', label: 'Humanos' },
      { id: 'elf', label: 'Elfos' },
      { id: 'dwarf', label: 'Anões' },
      { id: 'maiar', label: 'Maiar' },
      { id: 'ent', label: 'Ents' },
      { id: 'spider', label: 'Aranhas' },
    ],
    defaultGroups: ['hobbit', 'human', 'elf', 'dwarf', 'maiar', 'ent', 'spider'],
    columns: [
      {
        key: 'race', label: 'Raça', kind: 'text',
        labels: { Human: 'Humano', Elf: 'Elfo', Dwarf: 'Anão', Maiar: 'Maia', Spider: 'Aranha' },
      },
      { key: 'realm', label: 'Reino', kind: 'text', labels: { 'The Shire': 'Condado' } },
      {
        key: 'fellowship', label: 'Grupo', kind: 'text',
        labels: {
          'Fellowship of the Ring': 'Sociedade do Anel', 'White Council': 'Conselho Branco',
          'Company of Thorin': 'Companhia de Thorin', 'Rangers of the North': 'Guardiões do Norte',
          Ents: 'Ents', 'Nazgûl': 'Nazgûl',
        },
      },
      { key: 'gender', label: 'Gênero', kind: 'text', labels: { Male: 'Masculino', Female: 'Feminino' } },
      { key: 'height', label: 'Altura', kind: 'number', unit: 'cm', tolerance: 0.1 },
      // "Armas" saiu: cada um dos 25 tinha um conjunto proprio, entao a celula
      // nunca fechava verde a nao ser na resposta certa
      { key: 'hairColor', label: 'Cabelo', kind: 'text', labels: HAIR_PT },
      { key: 'films', label: 'Filmes', kind: 'number' },
    ],
  },

  f1: {
    id: 'f1',
    label: 'Fórmula 1',
    secretLabel: 'o piloto secreto',
    dataFile: 'f1.json',
    groupLabel: 'Década de estreia',
    groups: [
      { id: '1950s', label: 'Anos 50' },
      { id: '1960s', label: 'Anos 60' },
      { id: '1970s', label: 'Anos 70' },
      { id: '1980s', label: 'Anos 80' },
      { id: '1990s', label: 'Anos 90' },
      { id: '2000s', label: 'Anos 2000' },
      { id: '2010s', label: 'Anos 2010' },
      { id: '2020s', label: 'Anos 2020' },
    ],
    defaultGroups: ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'],
    columns: [
      { key: 'nationality', label: 'País', kind: 'text', labels: COUNTRY_PT },
      { key: 'team', label: 'Equipe', kind: 'text' },
      { key: 'seasons', label: 'Temporadas', kind: 'number', tolerance: 0.1 },
      { key: 'wins', label: 'Vitórias', kind: 'number', tolerance: 0.1 },
      { key: 'titles', label: 'Títulos', kind: 'number' },
      // trocou o ano de nascimento, que quase ninguem sabe e andava colado no
      // ano de estreia: aqui 1 e campeao e o resto do grid se espalha
      { key: 'bestPosition', label: 'Melhor ano', kind: 'number', prefix: '#' },
      { key: 'debut', label: 'Estreia', kind: 'number' },
    ],
  },

  cars: {
    id: 'cars',
    label: 'Carros',
    secretLabel: 'o carro secreto',
    dataFile: 'cars.json',
    groupLabel: 'Origem da marca',
    groups: [
      { id: 'eua', label: 'EUA' },
      { id: 'japao', label: 'Japão' },
      { id: 'alemanha', label: 'Alemanha' },
      { id: 'reino-unido', label: 'Reino Unido' },
      { id: 'italia', label: 'Itália' },
      { id: 'coreia', label: 'Coreia do Sul' },
      { id: 'suecia', label: 'Suécia' },
      { id: 'franca', label: 'França' },
      { id: 'outros', label: 'Outras' },
    ],
    defaultGroups: ['eua', 'japao', 'alemanha', 'reino-unido', 'italia', 'coreia', 'suecia', 'franca', 'outros'],
    columns: [
      { key: 'make', label: 'Marca', kind: 'text' },
      { key: 'category', label: 'Categoria', kind: 'text', labels: CAR_CATEGORY_PT },
      { key: 'drive', label: 'Tração', kind: 'text', labels: CAR_DRIVE_PT },
      // "Combustível" saiu: 97% dos sorteaveis sao a gasolina, entao a celula
      // fechava verde para quase todo chute e nao dizia nada
      { key: 'economy', label: 'Consumo', kind: 'number', unit: 'km/l', tolerance: 0.1 },
      { key: 'cylinders', label: 'Cilindros', kind: 'number' },
      { key: 'displacement', label: 'Cilindrada', kind: 'number', unit: 'L', tolerance: 0.15 },
      // anos sem tolerancia: 3% de 2000 seriam 60 anos de "quase"
      { key: 'debut', label: 'Estreia', kind: 'number' },
      { key: 'lastYear', label: 'Último ano', kind: 'number' },
    ],
  },

  mlp: {
    id: 'mlp',
    label: 'My Little Pony',
    secretLabel: 'o personagem secreto',
    dataFile: 'mlp.json',
    groupLabel: 'Espécie',
    groups: [
      { id: 'terrestre', label: 'Pônei terrestre' },
      { id: 'unicornio', label: 'Unicórnio' },
      { id: 'pegaso', label: 'Pégaso' },
      { id: 'alicornio', label: 'Alicórnio' },
      { id: 'humano', label: 'Humano' },
      { id: 'outros', label: 'Outras espécies' },
    ],
    defaultGroups: ['terrestre', 'unicornio', 'pegaso', 'alicornio', 'humano', 'outros'],
    // a PonyAPI nao traz nenhum numero, entao aqui nao ha coluna numerica nem
    // setas ▲/▼ — o mesmo vale para Ordem Paranormal
    columns: [
      { key: 'kinds', label: 'Espécie', kind: 'list', labels: MLP_KIND_PT },
      { key: 'gender', label: 'Gênero', kind: 'text', labels: MLP_GENDER_PT },
      { key: 'residence', label: 'Residência', kind: 'text', labels: MLP_PLACE_PT },
      { key: 'occupation', label: 'Ocupação', kind: 'text', labels: MLP_JOB_PT },
    ],
  },

  onepiece: {
    id: 'onepiece',
    label: 'One Piece',
    secretLabel: 'o personagem secreto',
    dataFile: 'onepiece.json',
    groupLabel: 'Facções',
    groups: [
      { id: 'chapeu', label: 'Chapéu de Palha' },
      { id: 'yonko', label: 'Yonkou e Roger' },
      { id: 'piratas', label: 'Outros piratas' },
      { id: 'marinha', label: 'Marinha' },
      { id: 'governo', label: 'Governo Mundial' },
      { id: 'revolucao', label: 'Revolucionários' },
      { id: 'civis', label: 'Civis' },
    ],
    defaultGroups: ['chapeu', 'yonko', 'piratas', 'marinha', 'governo', 'revolucao', 'civis'],
    scope: {
      label: 'Épocas',
      key: 'era',
      options: [
        { id: 'east-blue', label: 'East Blue', hint: 'A formação do bando, capítulos 1 a 100.' },
        { id: 'paraiso', label: 'Paraíso', hint: 'De Alabasta a Marineford, capítulos 101 a 597.' },
        { id: 'novo-mundo', label: 'Novo Mundo', hint: 'Depois do salto de dois anos, do capítulo 598 em diante.' },
      ],
    },
    columns: [
      { key: 'crew', label: 'Tripulação', kind: 'text' },
      { key: 'job', label: 'Papel', kind: 'text' },
      { key: 'fruit', label: 'Fruta', kind: 'text' },
      { key: 'origin', label: 'Origem', kind: 'text', labels: OP_ORIGIN_PT },
      { key: 'status', label: 'Status', kind: 'text' },
      // as recompensas variam de mil a 5 bilhoes: 10% de tolerancia so
      // pintaria de amarelo quem ja esta na mesma casa de grandeza. Marinheiro
      // e civil nao tem recompensa nenhuma — `blank` faz esse vazio valer como
      // resposta, entao dois sem recompensa fecham verde
      {
        key: 'bounty', label: 'Recompensa', kind: 'number',
        compact: true, prefix: '฿ ', tolerance: 0.1, blank: 'Não tem',
      },
      { key: 'height', label: 'Altura', kind: 'number', unit: 'cm', tolerance: 0.1 },
      { key: 'age', label: 'Idade', kind: 'number', tolerance: 0.1 },
    ],
  },

  dragonball: {
    id: 'dragonball',
    label: 'Dragon Ball',
    secretLabel: 'o personagem secreto',
    dataFile: 'dragonball.json',
    groupLabel: 'Raças',
    groups: [
      { id: 'saiyajin', label: 'Saiyajin' },
      { id: 'humano', label: 'Humano' },
      { id: 'namekuseijin', label: 'Namekuseijin' },
      { id: 'androide', label: 'Andróide' },
      { id: 'divino', label: 'Divindades' },
      { id: 'outros', label: 'Outras raças' },
    ],
    defaultGroups: ['saiyajin', 'humano', 'namekuseijin', 'androide', 'divino', 'outros'],
    columns: [
      { key: 'race', label: 'Raça', kind: 'text', labels: DB_RACE_PT },
      { key: 'gender', label: 'Gênero', kind: 'text', labels: { Male: 'Masculino', Female: 'Feminino' } },
      { key: 'affiliation', label: 'Afiliação', kind: 'text', labels: DB_SIDE_PT },
      { key: 'planet', label: 'Planeta', kind: 'text' },
      { key: 'transformations', label: 'Transf.', kind: 'number' },
      // o ki vai de 450 ao ki do Zeno: em vez do numero cru, a ordem de
      // grandeza (o expoente dividido por 3) — ainda rende as setas ▲▼
      { key: 'ki', label: 'Ki base', kind: 'number', labels: DB_KI_PT },
      { key: 'maxKi', label: 'Ki máximo', kind: 'number', labels: DB_KI_PT },
    ],
  },

  hxh: {
    id: 'hxh',
    // "2011" porque a Hunterpedia entrega o retrato e a cor de cabelo dessa
    // adaptacao quando ela existe — e ela existe para quase todo mundo
    label: 'Hunter × Hunter 2011',
    secretLabel: 'o personagem secreto',
    dataFile: 'hxh.json',
    groupLabel: 'Facções',
    groups: [
      { id: 'hunter', label: 'Associação Hunter' },
      { id: 'zoldyck', label: 'Família Zoldyck' },
      { id: 'trupe', label: 'Trupe Fantasma' },
      { id: 'formigas', label: 'Formigas Quimera' },
      { id: 'kakin', label: 'Kakin e Continente Negro' },
      { id: 'mafia', label: 'Máfia' },
      { id: 'outros', label: 'Outros' },
    ],
    defaultGroups: ['hunter', 'zoldyck', 'trupe', 'formigas', 'kakin', 'mafia', 'outros'],
    // aqui o eixo nao e o tempo, e a midia: o manga passou muito do que o anime
    // adaptou, e metade do elenco do arco de Kakin nunca apareceu na tela
    scope: {
      key: 'era',
      label: 'De onde vêm os personagens',
      options: [
        { id: 'anime', label: 'Anime', hint: 'Quem apareceu em algum episódio, OVA ou filme.' },
        { id: 'manga', label: 'Só no mangá', hint: 'Quem o anime nunca chegou a adaptar — quase todo o arco de Kakin.' },
      ],
    },
    columns: [
      { key: 'gender', label: 'Gênero', kind: 'text', labels: { Male: 'Masculino', Female: 'Feminino' } },
      { key: 'nen', label: 'Nen', kind: 'text', labels: NEN_PT },
      { key: 'status', label: 'Estado', kind: 'text', labels: HXH_STATUS_PT },
      { key: 'affiliation', label: 'Afiliação', kind: 'list', labels: HXH_AFFILIATION_PT },
      { key: 'job', label: 'Ocupação', kind: 'text', labels: HXH_JOB_PT },
      { key: 'hair', label: 'Cabelo', kind: 'text', labels: HAIR_PT },
      { key: 'debutChapter', label: 'Estreia', kind: 'number', prefix: 'Cap. ', tolerance: 0.1 },
    ],
  },

  ordem: {
    id: 'ordem',
    label: 'Ordem Paranormal',
    secretLabel: 'a criatura secreta',
    dataFile: 'ordem.json',
    groupLabel: 'Campanhas',
    // as campanhas curtas entram na vizinha (a mesa de A Ordem Paranormal abre
    // O Segredo na Floresta; Quarentena e Natal Macabro sao noites de Tipora),
    // e "Livros e pacotes" e onde ficam as criaturas que nenhuma mesa mostrou
    groups: [
      { id: 'osnf', label: 'O Segredo na Floresta' },
      { id: 'opd', label: 'Desconjuração' },
      { id: 'opc', label: 'Calamidade' },
      { id: 'osni', label: 'O Segredo na Ilha' },
      { id: 'sdol', label: 'Sinais do Outro Lado' },
      { id: 'hex', label: 'Hexatombe' },
      { id: 'livros', label: 'Livros e pacotes' },
    ],
    defaultGroups: ['osnf', 'opd', 'opc', 'osni', 'sdol', 'hex', 'livros'],
    // "criatura de Morte com complemento de Medo" e como o fa fala da criatura,
    // e como a ficha do wiki grava: o primeiro elemento e o Elemento, o resto e
    // Complemento. Sao as duas colunas que decidem a partida
    columns: [
      { key: 'element', label: 'Elemento', kind: 'text' },
      { key: 'complements', label: 'Complemento', kind: 'list' },
      { key: 'campaign', label: 'Campanha', kind: 'text', labels: ORDEM_CAMPAIGN_PT },
      { key: 'faction', label: 'Facção', kind: 'list' },
      { key: 'media', label: 'Onde aparece', kind: 'list' },
    ],
  },

  ben10: {
    id: 'ben10',
    label: 'Ben 10',
    secretLabel: 'o alien secreto',
    dataFile: 'ben10.json',
    groupLabel: 'Relógios',
    // o grupo e o relogio, que e como a serie separa os aliens: os do Omnitrix
    // do Ben, os do Reboot, os predadores do Nemetrix do Khyber, os do Ben 23
    // e os do Kevin. Nao canonico e de brinquedo nao entra no dataset
    groups: [
      { id: 'ben', label: 'Omnitrix do Ben' },
      { id: 'reboot', label: 'Omnitrix do Reboot' },
      { id: 'ben23', label: 'Ben 23' },
      { id: 'kevin', label: 'Kevin 11' },
      { id: 'nemetrix', label: 'Nemetrix' },
      { id: 'ultimate', label: 'Ultimates' },
    ],
    // as 14 formas Ultimate vem desligadas: sao um modo a parte, e ligadas por
    // padrao encheriam a busca de nome repetido com "Ultimate" na frente
    defaultGroups: ['ben', 'reboot', 'ben23', 'kevin', 'nemetrix'],
    scope: {
      label: 'Épocas',
      key: 'era',
      options: [
        { id: 'classica', label: 'Ben 10 (2005)', hint: 'A série original, com o Omnitrix de dez aliens.' },
        { id: 'alienforce', label: 'Alien Force', hint: 'Ben aos 15 anos, de 2008.' },
        { id: 'ultimatealien', label: 'Ultimate Alien', hint: 'O Ultimatrix e as formas Ultimate, de 2010.' },
        { id: 'omniverse', label: 'Omniverse', hint: 'De 2012: o Nemetrix do Khyber e o Ben 23.' },
        { id: 'reboot', label: 'Reboot (2016)', hint: 'A série que recomeça do zero, de 2016.' },
      ],
    },
    columns: [
      { key: 'species', label: 'Espécie', kind: 'text' },
      { key: 'planet', label: 'Planeta natal', kind: 'text' },
      { key: 'powers', label: 'Poderes', kind: 'list', labels: BEN10_POWER_PT },
      { key: 'series', label: 'Série', kind: 'text', labels: BEN10_SERIES_PT },
      // ano e coluna a parte da serie porque separa dentro dela: entre os 53
      // aliens de Omniverse, 2012 e 2014 sao duas metades diferentes do elenco
      { key: 'debutYear', label: 'Estreia', kind: 'number', nearby: 1 },
    ],
  },
};

export const DEFAULT_UNIVERSE = 'pokemon';

export const getUniverse = (id) => UNIVERSES[id] ?? UNIVERSES[DEFAULT_UNIVERSE];

/**
 * O **recorte** e o segundo eixo da sala, ao lado dos grupos: as **épocas** da
 * obra. Cada opcao e uma fase da historia, na ordem, e o item guarda em
 * `scope.key` o indice da fase em que ele estreia. A sala liga quantas quiser —
 * quem parou no Clássico deixa so a primeira, quem quer tudo deixa todas.
 *
 * Universo sem `scope` nao tem esse eixo e aceita todo mundo.
 */
export const scopeOptions = (universe) => universe?.scope?.options ?? [];

/**
 * O valor de uma coluna sob o recorte escolhido. Um item pode trazer em
 * `byScope` a versao de um campo naquela epoca — e o caso do Naruto, onde a
 * ficha conta a carreira inteira mas a sala pode estar no Clássico, quando ele
 * ainda nao era sábio. Sem `byScope`, ou fora dele, vale o campo de sempre.
 */
export const valueOf = (item, key, scopeId) => item?.byScope?.[scopeId]?.[key] ?? item?.[key];

/** Chaves que o recorte le nos itens — o indice do cliente precisa levar todas. */
export const scopeKeys = (universe) => (universe?.scope?.key ? [universe.scope.key] : []);

/** Ids validos, na ordem do schema; vazio ou torto vira o padrao (todas). */
export function sanitizeScope(universe, raw) {
  const scope = universe?.scope;
  if (!scope) return null;
  const pedidos = (Array.isArray(raw) ? raw : (raw == null ? [] : [raw])).map(String);
  const escolhidas = scope.options.map(o => o.id).filter(id => pedidos.includes(id));
  return escolhidas.length ? escolhidas : [...(scope.default ?? scope.options.map(o => o.id))];
}

/** Rotulo das epocas ligadas, para as mensagens da sala. */
export const scopeLabel = (universe, ids) =>
  scopeOptions(universe).filter(o => sanitizeScope(universe, ids).includes(o.id))
    .map(o => o.label).join(', ');

export function scopeFilter(universe, ids) {
  const scope = universe?.scope;
  if (!scope) return () => true;
  const ligadas = new Set(sanitizeScope(universe, ids)
    .map(id => scope.options.findIndex(o => o.id === id)));
  // com todas ligadas o eixo nao filtra nada — e ai quem esta sem epoca no
  // dataset continua no jogo, em vez de sumir por falta de dado
  if (ligadas.size === scope.options.length) return () => true;
  return (item) => ligadas.has(Number(item?.[scope.key]));
}

/**
 * A epoca mais avancada que a sala ligou. E ela que decide a versao dos campos
 * em `byScope`: numa sala de Clássico + Shippūden o Naruto ja e sábio, porque
 * o segredo pode vir de Shippūden.
 */
export function scopeReach(universe, ids) {
  const scope = universe?.scope;
  if (!scope) return null;
  const escolhidas = sanitizeScope(universe, ids);
  return scope.options.map(o => o.id).filter(id => escolhidas.includes(id)).pop() ?? null;
}
