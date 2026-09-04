/**
 * A camada visual dos universos: monograma, cores e uma linha de descrição.
 *
 * Fica aqui e não no `shared/universes.js` de propósito — aquele arquivo é o
 * contrato do jogo, lido pelo servidor, e não deve carregar hex de gradiente.
 * O que falta aqui cai num cinza neutro em vez de quebrar, então universo novo
 * aparece na lista no mesmo dia em que entra no schema.
 */
const META = {
  pokemon:          ['PK', '#FF6E78', '#C0303C', '1025 criaturas, 9 gerações'],
  bleach:           ['BL', '#93A5C4', '#3D4C6B', 'Shinigami, Quincy e Arrancar'],
  clash:            ['CR', '#6FB6FF', '#2A5FC4', 'Cartas, raridades e elixir'],
  naruto:           ['NA', '#FF9F45', '#C25A0E', 'Shinobi de Konoha a Boruto'],
  yugioh:           ['YG', '#C08BFF', '#6C3BB8', 'Monstros, magias e armadilhas'],
  lol:              ['LO', '#D8B04A', '#8A6A20', 'Campeões de Runeterra'],
  valorant:         ['VA', '#FF7A6B', '#B8332A', 'Duelistas, sentinelas e mais'],
  'valorant-armas': ['VW', '#9AA7BD', '#4A566E', 'O arsenal inteiro do jogo'],
  rickmorty:        ['RM', '#7FE3B0', '#1E8B5E', 'Personagens do multiverso'],
  heroes:           ['SH', '#6FA8FF', '#2C4FB8', 'Marvel e DC lado a lado'],
  potter:           ['HP', '#C9A227', '#7A5E0B', 'Bruxos, casas e varinhas'],
  lotr:             ['SA', '#B79A6A', '#6B5433', 'Povos da Terra-média'],
  f1:               ['F1', '#FF5C5C', '#A81E1E', 'Pilotos, equipes e títulos'],
  cars:             ['CA', '#8FA3BF', '#3C4B63', 'Marcas, motores e potência'],
  mlp:              ['ML', '#FFA6D5', '#B03D77', 'Pôneis de Equestria'],
  onepiece:         ['OP', '#FF8A5B', '#C24A16', 'Piratas, marinha e akuma no mi'],
  dragonball:       ['DB', '#FFB84D', '#C07A00', 'Guerreiros e transformações'],
  hxh:              ['HX', '#7BE0D8', '#1F8E86', 'Nen, tipos e associações'],
  ordem:            ['OR', '#B36BFF', '#5E23A8', 'Agentes e os quatro elementos'],
  ben10:            ['B1', '#9BE84F', '#4E8A12', 'Os aliens do Omnitrix'],
  jojo:             ['JJ', '#FFD166', '#B07C0A', 'Stands, poses e partes'],
  famosos:          ['FA', '#FF9EC4', '#B03D6B', 'Gente de carne e osso'],
};

const FALLBACK = ['??', '#8FA3BF', '#3C4B63', ''];

export function universeMeta(id) {
  const [mono, from, to, desc] = META[id] ?? FALLBACK;
  return { mono, desc, gradient: `linear-gradient(145deg, ${from}, ${to})` };
}
