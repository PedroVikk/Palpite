/**
 * A camada visual dos universos: cor, uma linha de descrição e o rosto.
 *
 * Fica aqui e não no `shared/universes.js` de propósito — aquele arquivo é o
 * contrato do jogo, lido pelo servidor, e não deve carregar hex de gradiente.
 * O que falta aqui cai num cinza neutro em vez de quebrar, então universo novo
 * aparece na lista no mesmo dia em que entra no schema.
 *
 * O ícone é o retrato de quem é a cara da franquia, tirado do próprio espelho
 * de miniaturas do jogo (`/sprites/<universo>/<id>.webp`) — nada de logo
 * baixado de fora, e nenhum arquivo novo no repositório. Onde não existe um
 * rosto óbvio (Carros não tem miniatura; Famosos são pessoas de verdade, e
 * eleger uma seria estranho) fica o monograma, que é o padrão de sempre.
 *
 * A marca (`mark`) é outra coisa: a silhueta chapada que serve de marca-d'água
 * atrás do segredo do dia e na lateral do modal. Mora em `data/marks/<id>.png`
 * — branco sobre transparente, 256x256 — e o caminho sai do id, sem tabela no
 * meio. UNIVERSO NOVO PRECISA DO ARQUIVO: sem ele a marca cai na pokébola e o
 * universo passa a se anunciar com a cara de outro. O teste cobra
 * (`npm test`, bloco "Todos os universos") e o desenho tem regras próprias,
 * escritas em `docs/marcas-dos-universos.md`.
 */
const META = {
  //                mono   de         para       descrição                          rosto
  pokemon:          ['PK', '#FF6E78', '#C0303C', '1025 criaturas, 9 gerações',       25],
  bleach:           ['BL', '#93A5C4', '#3D4C6B', 'Shinigami, Quincy e Arrancar',     114],
  clash:            ['CR', '#6FB6FF', '#2A5FC4', 'Cartas, raridades e elixir',       1],
  naruto:           ['NA', '#FF9F45', '#C25A0E', 'Shinobi de Konoha a Boruto',       1344],
  yugioh:           ['YG', '#C08BFF', '#6C3BB8', 'Monstros, magias e armadilhas',    21],
  lol:              ['LO', '#D8B04A', '#8A6A20', 'Campeões de Runeterra',            138],
  valorant:         ['VA', '#FF7A6B', '#B8332A', 'Duelistas, sentinelas e mais',     29],
  'valorant-armas': ['VW', '#9AA7BD', '#4A566E', 'O arsenal inteiro do jogo',        3],
  rickmorty:        ['RM', '#7FE3B0', '#1E8B5E', 'Personagens do multiverso',        1],
  heroes:           ['SH', '#6FA8FF', '#2C4FB8', 'Marvel e DC lado a lado',          477],
  potter:           ['HP', '#C9A227', '#7A5E0B', 'Bruxos, casas e varinhas',         1],
  lotr:             ['SA', '#B79A6A', '#6B5433', 'Povos da Terra-média',             1],
  f1:               ['F1', '#FF5C5C', '#A81E1E', 'Pilotos, equipes e títulos',       643],
  cars:             ['CA', '#E23A44', '#8E0F1B', 'Marcas, motores e potência',       null],
  mlp:              ['ML', '#FFA6D5', '#B03D77', 'Pôneis de Equestria',              1],
  onepiece:         ['OP', '#FF8A5B', '#C24A16', 'Piratas, marinha e akuma no mi',   1],
  dragonball:       ['DB', '#FFB84D', '#C07A00', 'Guerreiros e transformações',      1],
  hxh:              ['HX', '#7BE0D8', '#1F8E86', 'Nen, tipos e associações',         522],
  ordem:            ['OR', '#B36BFF', '#5E23A8', 'Agentes e os quatro elementos',    11],
  ben10:            ['B1', '#9BE84F', '#4E8A12', 'Os aliens do Omnitrix',            146],
  jojo:             ['JJ', '#FFD166', '#B07C0A', 'Stands, poses e partes',           2],
  famosos:          ['FA', '#FF9EC4', '#B03D6B', 'Gente de carne e osso',            142794],
};

const FALLBACK = ['??', '#8FA3BF', '#3C4B63', '', null];

export function universeMeta(id) {
  const known = id in META;
  const [mono, from, to, desc, face] = known ? META[id] : FALLBACK;
  return {
    mono,
    desc,
    gradient: `linear-gradient(145deg, ${from}, ${to})`,
    icon: face ? `/sprites/${id}/${face}.webp` : null,
    // desconhecido volta para a pokébola: melhor a marca errada que um quadrado quebrado
    mark: `/marks/${known ? id : 'pokemon'}.png`,
  };
}
