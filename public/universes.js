/**
 * Definicao dos universos jogaveis. Compartilhado entre servidor e navegador:
 * o servidor importa via ../public/universes.js, o cliente via <script type="module">.
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
      { key: 'color', label: 'Cor', kind: 'text', labels: COLOR_PT },
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
      {
        key: 'speed', label: 'Velocidade', kind: 'number',
        labels: { 30: 'Muito lenta', 45: 'Lenta', 60: 'Média', 90: 'Rápida', 120: 'Muito rápida' },
      },
      { key: 'hitpoints', label: 'Vida', kind: 'number', tolerance: 0.1 },
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
    columns: [
      { key: 'gender', label: 'Gênero', kind: 'text', labels: { Male: 'Masculino', Female: 'Feminino' } },
      { key: 'clan', label: 'Clã', kind: 'list' },
      { key: 'affiliation', label: 'Afiliação', kind: 'list' },
      { key: 'classification', label: 'Classificação', kind: 'list' },
      { key: 'natureType', label: 'Natureza', kind: 'list' },
      { key: 'ninjaRank', label: 'Patente', kind: 'text' },
      { key: 'debutChapter', label: 'Estreia', kind: 'number', prefix: 'Cap. ', tolerance: 0.1 },
      { key: 'height', label: 'Altura', kind: 'number', unit: 'cm', tolerance: 0.1 },
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
        },
      },
      { key: 'race', label: 'Raça', kind: 'text' },
      { key: 'level', label: 'Nível', kind: 'number' },
      { key: 'atk', label: 'ATK', kind: 'number', tolerance: 0.1 },
      { key: 'def', label: 'DEF', kind: 'number', tolerance: 0.1 },
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
    columns: [
      { key: 'roles', label: 'Funções', kind: 'list' },
      { key: 'resource', label: 'Recurso', kind: 'text' },
      { key: 'attack', label: 'Ataque', kind: 'number' },
      { key: 'magic', label: 'Magia', kind: 'number' },
      { key: 'defense', label: 'Defesa', kind: 'number' },
      { key: 'difficulty', label: 'Dificuldade', kind: 'number' },
      { key: 'attackRange', label: 'Alcance', kind: 'number', tolerance: 0.1 },
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
    columns: [
      { key: 'role', label: 'Função', kind: 'text' },
      { key: 'tags', label: 'Tags', kind: 'list' },
      { key: 'abilities', label: 'Habilidades', kind: 'number' },
      { key: 'passive', label: 'Passiva', kind: 'text' },
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
    columns: [
      { key: 'status', label: 'Status', kind: 'text', labels: { Alive: 'Vivo', Dead: 'Morto' } },
      { key: 'species', label: 'Espécie', kind: 'text' },
      { key: 'gender', label: 'Gênero', kind: 'text', labels: { Male: 'Masculino', Female: 'Feminino', Genderless: 'Sem gênero' } },
      { key: 'origin', label: 'Origem', kind: 'text' },
      { key: 'location', label: 'Localização', kind: 'text' },
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
    columns: [
      { key: 'publisher', label: 'Editora', kind: 'text' },
      {
        key: 'alignment', label: 'Alinhamento', kind: 'text',
        labels: { good: 'Herói', bad: 'Vilão', neutral: 'Neutro' },
      },
      { key: 'gender', label: 'Gênero', kind: 'text', labels: { Male: 'Masculino', Female: 'Feminino' } },
      { key: 'race', label: 'Raça', kind: 'text' },
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
      { key: 'weapons', label: 'Armas', kind: 'list' },
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
      { key: 'debut', label: 'Estreia', kind: 'number' },
      { key: 'birthYear', label: 'Nascimento', kind: 'number' },
    ],
  },
};

export const DEFAULT_UNIVERSE = 'pokemon';

export const getUniverse = (id) => UNIVERSES[id] ?? UNIVERSES[DEFAULT_UNIVERSE];
