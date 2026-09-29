/**
 * Monta data/animais.json com os bichos que a sala conhece.
 *   npm run build:animais
 * Fontes: a tabela abaixo, escrita a mao, e a Wikipedia em ingles (pela API
 * aberta), que da a foto e o id da Wikidata de cada um. Onde o artigo nao tem
 * imagem livre, entra a da ficha da Wikidata, servida pelo Commons.
 *
 * O elenco e curado pelo mesmo motivo dos Deuses. A Wikidata tem a taxonomia
 * inteira, mas o que a sala pergunta — come carne? vive no mar? voa? e da
 * Africa? — nao esta la do jeito que o jogador pensa: a dieta e o habitat vem
 * em texto livre ou em nenhum lugar, e a arvore de especies da dois milhoes de
 * nomes para quem so conhece o "tubarao-branco". A tabela e a fonte; a
 * Wikipedia so empresta a foto e a regua de fama.
 *
 * O nome e o que a sala fala, no nivel em que ela fala: "Formiga" e "Barata",
 * mas "Tubarao-branco" e "Tubarao-martelo" em vez de "Tubarao". Quando o bicho
 * tem especies que o brasileiro separa, entram as especies; quando nao separa,
 * entra o nome de todo mundo, e o artigo da Wikipedia e o do grupo.
 *
 * O id e o numero do item na Wikidata (Q140 → 140), como nos Deuses: nao muda
 * se a tabela mudar de ordem, e a miniatura espelhada segue com ele.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ENWIKI = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const PTWIKI = 'https://pt.wikipedia.org/w/api.php';
const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'animais.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'animais');
const METRICS = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/user';
const UA = 'palpite-dataset/1.0 (+https://github.com/PedroVikk)';

/**
 * Piso de visitas em doze meses na Wikipedia em portugues para ser sorteavel.
 * A tabela ja e so de bicho conhecido, entao o piso so tira a ponta de baixo:
 * o urso-negro, a ra-de-vidro, a raposa-voadora, que a sala chuta mas nao
 * adivinharia. Quem fica abaixo continua no arquivo, chutavel.
 */
const PISO_VISITAS = 5_000;
/** Quantos cada grupo garante, pelos mais visitados, mesmo abaixo do piso. */
const MINIMO = 25;
/**
 * Os que a regua subestima: o bicho que a sala conhece do desenho e nao da
 * enciclopedia. O peixe-palhaco e o Nemo e tem 3 mil visitas; o ourico e o
 * Sonic, e o artigo dele em portugues e o do genero.
 */
const SEMPRE = new Set(['Peixe-palhaço', 'Ouriço', 'Porco-espinho']);

await fs.mkdir(CACHE_DIR, { recursive: true });

// ------------------------------------------------------------- a tabela

/**
 * Uma linha por bicho:
 *   [nome, titulo na Wikipedia em ingles, classe, dieta, habitat, continentes,
 *    locomocao, peso, apelidos]
 *
 * classe      do vocabulario de CLASSES: o grupo e largo (Invertebrados), a
 *             coluna separa o inseto da aranha e do caranguejo
 * dieta       c carnivoro (inseto conta: o tamandua e carnivoro) · h herbivoro
 *             · o onivoro · s sangue (mosquito, pulga, morcego-vampiro)
 * habitat     ate tres, separados por espaco, de HABITATS. O bicho de casa e
 *             de fazenda mora em `casa`; a praga da rua, em `cidade`
 * continentes onde vive solto, separados por espaco: sa (America do Sul),
 *             na (do Norte, com a Central), eu, af, as, oc, an. `*` e o mundo
 *             todo — o cachorro, a baleia, a barata —, e vale pelos seis
 *             continentes habitados: a baleia fecha amarelo contra o leao
 * locomocao   letras: a anda · v voa · n nada · r rasteja. So o que o bicho
 *             faz de costume: o tigre nada quando precisa e fica so `a`; a
 *             capivara vive na agua e e `an`
 * peso        o de um adulto tipico, em kg. A coluna mostra a faixa (ver
 *             FAIXAS), e o numero fica na tabela para quem quiser conferir
 * apelidos    os outros nomes que a busca aceita
 */
const CLASSES = {
  mamifero: 'Mamífero', ave: 'Ave', reptil: 'Réptil', anfibio: 'Anfíbio', peixe: 'Peixe',
  inseto: 'Inseto', aracnideo: 'Aracnídeo', crustaceo: 'Crustáceo', molusco: 'Molusco',
  outro: 'Outro invertebrado',
};
const DIETAS = { c: 'carnivoro', h: 'herbivoro', o: 'onivoro', s: 'sangue' };
const HABITATS = new Set(['floresta', 'campo', 'deserto', 'montanha', 'gelo', 'mar', 'rio', 'casa', 'cidade']);
const CONTINENTES = new Set(['sa', 'na', 'eu', 'af', 'as', 'oc', 'an']);
const MUNDO = ['sa', 'na', 'eu', 'af', 'as', 'oc'];
const LOCOMOCAO = { a: 'anda', v: 'voa', n: 'nada', r: 'rasteja' };

/**
 * A faixa de peso, de dez em dez vezes. Ninguem sabe que o leao pesa 190 kg,
 * mas todo mundo sabe que ele pesa mais que um cachorro e menos que um cavalo
 * — e e essa a pergunta que a seta responde. O teto de cada faixa entra nela.
 */
const FAIXAS = [0.01, 1, 10, 100, 1000, 10_000, Infinity];
const faixa = (kg) => FAIXAS.findIndex(teto => kg <= teto) + 1;

const GRUPOS = [
  { group: 'mamiferos', bichos: [
    ['Leão', 'Lion', 'mamifero', 'c', 'campo', 'af as', 'a', 190, []],
    ['Tigre', 'Tiger', 'mamifero', 'c', 'floresta', 'as', 'a', 200, ['Tigre-de-bengala']],
    ['Onça-pintada', 'Jaguar', 'mamifero', 'c', 'floresta rio', 'sa na', 'a', 90, ['Onça', 'Jaguar']],
    ['Leopardo', 'Leopard', 'mamifero', 'c', 'floresta campo', 'af as', 'a', 60, []],
    ['Guepardo', 'Cheetah', 'mamifero', 'c', 'campo', 'af', 'a', 50, ['Chita', 'Cheetah']],
    ['Puma', 'Cougar', 'mamifero', 'c', 'floresta montanha', 'sa na', 'a', 60, ['Onça-parda', 'Suçuarana', 'Leão-da-montanha']],
    ['Lince', 'Eurasian lynx', 'mamifero', 'c', 'floresta montanha', 'eu as', 'a', 20, ['Lince-euroasiático']],
    ['Leopardo-das-neves', 'Snow leopard', 'mamifero', 'c', 'montanha', 'as', 'a', 45, ['Irbis', 'Onça-das-neves']],
    ['Jaguatirica', 'Ocelot', 'mamifero', 'c', 'floresta', 'sa na', 'a', 12, ['Ocelote']],
    ['Gato', 'Cat', 'mamifero', 'c', 'casa', '*', 'a', 4, ['Gato-doméstico', 'Gata']],
    ['Lobo', 'Wolf', 'mamifero', 'c', 'floresta campo', 'na eu as', 'a', 40, ['Lobo-cinzento']],
    ['Cachorro', 'Dog', 'mamifero', 'o', 'casa', '*', 'a', 25, ['Cão', 'Cachorra']],
    ['Raposa', 'Red fox', 'mamifero', 'o', 'floresta campo', 'na eu as af', 'a', 6, ['Raposa-vermelha']],
    ['Raposa-do-ártico', 'Arctic fox', 'mamifero', 'c', 'gelo', 'na eu as', 'a', 4, ['Raposa-polar', 'Raposa-do-Ártico']],
    ['Feneco', 'Fennec fox', 'mamifero', 'o', 'deserto', 'af', 'a', 1.2, ['Raposa-do-deserto', 'Fennec']],
    ['Lobo-guará', 'Maned wolf', 'mamifero', 'o', 'campo', 'sa', 'a', 25, ['Guará']],
    ['Hiena', 'Spotted hyena', 'mamifero', 'c', 'campo', 'af', 'a', 60, ['Hiena-malhada']],
    ['Coiote', 'Coyote', 'mamifero', 'c', 'campo deserto', 'na', 'a', 12, []],
    ['Chacal', 'Golden jackal', 'mamifero', 'c', 'campo deserto', 'af as eu', 'a', 10, ['Chacal-dourado']],
    ['Dingo', 'Dingo', 'mamifero', 'c', 'campo deserto', 'oc', 'a', 15, []],
    ['Guaxinim', 'Raccoon', 'mamifero', 'o', 'floresta cidade', 'na', 'a', 7, ['Racum', 'Mão-pelada']],
    ['Urso-pardo', 'Brown bear', 'mamifero', 'o', 'floresta montanha', 'na eu as', 'a', 300, ['Urso-marrom', 'Urso-cinzento', 'Grizzly', 'Urso']],
    ['Urso-polar', 'Polar bear', 'mamifero', 'c', 'gelo mar', 'na eu as', 'an', 450, ['Urso-branco']],
    ['Urso-negro', 'American black bear', 'mamifero', 'o', 'floresta', 'na', 'a', 120, ['Urso-negro-americano', 'Urso-preto']],
    ['Urso-de-óculos', 'Spectacled bear', 'mamifero', 'o', 'floresta montanha', 'sa', 'a', 120, ['Urso-andino']],
    ['Panda', 'Giant panda', 'mamifero', 'h', 'floresta montanha', 'as', 'a', 100, ['Panda-gigante']],
    ['Panda-vermelho', 'Red panda', 'mamifero', 'h', 'floresta montanha', 'as', 'a', 5, []],
    ['Coala', 'Koala', 'mamifero', 'h', 'floresta', 'oc', 'a', 9, []],
    ['Canguru', 'Red kangaroo', 'mamifero', 'h', 'campo deserto', 'oc', 'a', 60, ['Canguru-vermelho']],
    ['Vombate', 'Common wombat', 'mamifero', 'h', 'floresta campo', 'oc', 'a', 30, ['Wombat']],
    ['Diabo-da-tasmânia', 'Tasmanian devil', 'mamifero', 'c', 'floresta', 'oc', 'a', 8, ['Diabo-da-Tasmânia', 'Taz']],
    ['Gambá', 'Didelphis', 'mamifero', 'o', 'floresta cidade', 'sa na', 'a', 1.5, ['Saruê', 'Timbu', 'Opossum']],
    ['Cangambá', 'Striped skunk', 'mamifero', 'o', 'floresta campo', 'na', 'a', 3, ['Zorrilho', 'Jaratataca', 'Gambá-listrado', 'Skunk']],
    ['Ornitorrinco', 'Platypus', 'mamifero', 'c', 'rio', 'oc', 'an', 1.5, []],
    ['Équidna', 'Short-beaked echidna', 'mamifero', 'c', 'floresta campo', 'oc', 'a', 4, ['Equidna']],
    ['Tamanduá-bandeira', 'Giant anteater', 'mamifero', 'c', 'campo floresta', 'sa na', 'a', 30, ['Tamanduá', 'Papa-formigas']],
    ['Tatu', 'Nine-banded armadillo', 'mamifero', 'o', 'campo floresta', 'sa na', 'a', 5, ['Tatu-galinha']],
    ['Tatu-bola', 'Brazilian three-banded armadillo', 'mamifero', 'c', 'campo', 'sa', 'a', 1.2, ['Fuleco']],
    ['Bicho-preguiça', 'Brown-throated sloth', 'mamifero', 'h', 'floresta', 'sa na', 'a', 4, ['Preguiça']],
    ['Capivara', 'Capybara', 'mamifero', 'h', 'rio campo', 'sa', 'an', 50, []],
    ['Anta', 'South American tapir', 'mamifero', 'h', 'floresta rio', 'sa', 'an', 250, ['Tapir']],
    ['Javali', 'Wild boar', 'mamifero', 'o', 'floresta', 'eu as af', 'a', 80, []],
    ['Javali-africano', 'Common warthog', 'mamifero', 'h', 'campo', 'af', 'a', 80, ['Facochero', 'Facóquero', 'Pumba']],
    ['Porco', 'Domestic pig', 'mamifero', 'o', 'casa', '*', 'a', 150, ['Porca', 'Leitão', 'Suíno']],
    ['Vaca', 'Cattle', 'mamifero', 'h', 'casa', '*', 'a', 700, ['Boi', 'Touro', 'Gado', 'Bezerro']],
    ['Búfalo', 'Water buffalo', 'mamifero', 'h', 'rio campo', 'as', 'an', 800, ['Búfalo-asiático', 'Búfalo-d\'água']],
    ['Bisão', 'American bison', 'mamifero', 'h', 'campo', 'na', 'a', 700, ['Bisão-americano']],
    ['Iaque', 'Domestic yak', 'mamifero', 'h', 'montanha', 'as', 'a', 500, ['Yak']],
    ['Cavalo', 'Horse', 'mamifero', 'h', 'casa campo', '*', 'a', 500, ['Égua', 'Potro']],
    ['Zebra', 'Plains zebra', 'mamifero', 'h', 'campo', 'af', 'a', 350, []],
    ['Burro', 'Donkey', 'mamifero', 'h', 'casa', '*', 'a', 250, ['Jumento', 'Jegue', 'Asno', 'Jumenta']],
    ['Ovelha', 'Sheep', 'mamifero', 'h', 'casa', '*', 'a', 70, ['Carneiro', 'Cordeiro']],
    ['Cabra', 'Goat', 'mamifero', 'h', 'casa montanha', '*', 'a', 50, ['Bode', 'Cabrito']],
    ['Lhama', 'Llama', 'mamifero', 'h', 'montanha casa', 'sa', 'a', 150, []],
    ['Alpaca', 'Alpaca', 'mamifero', 'h', 'montanha casa', 'sa', 'a', 60, []],
    ['Camelo', 'Bactrian camel', 'mamifero', 'h', 'deserto', 'as', 'a', 600, ['Camelo-bactriano']],
    ['Dromedário', 'Dromedary', 'mamifero', 'h', 'deserto', 'af as', 'a', 500, []],
    ['Girafa', 'Giraffe', 'mamifero', 'h', 'campo', 'af', 'a', 1200, []],
    ['Ocapi', 'Okapi', 'mamifero', 'h', 'floresta', 'af', 'a', 250, ['Okapi']],
    ['Hipopótamo', 'Hippopotamus', 'mamifero', 'h', 'rio', 'af', 'an', 1500, []],
    ['Rinoceronte', 'White rhinoceros', 'mamifero', 'h', 'campo', 'af', 'a', 2300, ['Rinoceronte-branco']],
    ['Elefante-africano', 'African bush elephant', 'mamifero', 'h', 'campo', 'af', 'a', 6000, ['Elefante']],
    ['Elefante-asiático', 'Asian elephant', 'mamifero', 'h', 'floresta', 'as', 'a', 4000, ['Elefante-indiano']],
    ['Gorila', 'Gorilla', 'mamifero', 'h', 'floresta', 'af', 'a', 160, []],
    ['Chimpanzé', 'Chimpanzee', 'mamifero', 'o', 'floresta', 'af', 'a', 50, []],
    ['Orangotango', 'Orangutan', 'mamifero', 'h', 'floresta', 'as', 'a', 70, []],
    ['Babuíno', 'Baboon', 'mamifero', 'o', 'campo', 'af', 'a', 25, []],
    ['Mandril', 'Mandrill', 'mamifero', 'o', 'floresta', 'af', 'a', 25, []],
    ['Mico-leão-dourado', 'Golden lion tamarin', 'mamifero', 'o', 'floresta', 'sa', 'a', 0.6, ['Mico-leão']],
    ['Macaco-prego', 'Tufted capuchin', 'mamifero', 'o', 'floresta', 'sa', 'a', 3, ['Macaco']],
    ['Bugio', 'Howler monkey', 'mamifero', 'h', 'floresta', 'sa na', 'a', 7, ['Guariba', 'Macaco-bugio', 'Barbado']],
    ['Sagui', 'Common marmoset', 'mamifero', 'o', 'floresta cidade', 'sa', 'a', 0.35, ['Mico', 'Sagui-de-tufos-brancos', 'Soim', 'Sagüi']],
    ['Macaco-aranha', 'Spider monkey', 'mamifero', 'h', 'floresta', 'sa na', 'a', 8, []],
    ['Lêmure', 'Ring-tailed lemur', 'mamifero', 'h', 'floresta', 'af', 'a', 2.5, ['Lêmure-de-cauda-anelada', 'Lemur']],
    ['Rato', 'Brown rat', 'mamifero', 'o', 'cidade', '*', 'a', 0.3, ['Ratazana', 'Rato-de-esgoto']],
    ['Camundongo', 'House mouse', 'mamifero', 'o', 'casa cidade', '*', 'a', 0.02, ['Rato-doméstico', 'Catita']],
    ['Hamster', 'Golden hamster', 'mamifero', 'o', 'casa', '*', 'a', 0.15, ['Hamster-sírio']],
    ['Porquinho-da-índia', 'Guinea pig', 'mamifero', 'h', 'casa', '*', 'a', 1, ['Cobaia', 'Porquinho-da-Índia']],
    ['Coelho', 'European rabbit', 'mamifero', 'h', 'campo casa', '*', 'a', 2, ['Coelha']],
    ['Lebre', 'European hare', 'mamifero', 'h', 'campo', 'eu as', 'a', 4, []],
    ['Esquilo', 'Eastern gray squirrel', 'mamifero', 'h', 'floresta cidade', 'na eu', 'a', 0.5, ['Serelepe', 'Caxinguelê']],
    ['Castor', 'North American beaver', 'mamifero', 'h', 'rio floresta', 'na eu', 'an', 20, []],
    ['Porco-espinho', 'Crested porcupine', 'mamifero', 'h', 'floresta campo', 'af eu', 'a', 15, []],
    ['Ouriço', 'Hedgehog', 'mamifero', 'c', 'floresta campo', 'eu as af', 'a', 0.8, ['Ouriço-terrestre', 'Porco-espinho-europeu']],
    ['Chinchila', 'Chinchilla', 'mamifero', 'h', 'montanha', 'sa', 'a', 0.6, []],
    ['Paca', 'Lowland paca', 'mamifero', 'h', 'floresta', 'sa na', 'an', 8, []],
    ['Cutia', 'Agouti', 'mamifero', 'h', 'floresta', 'sa na', 'a', 3, []],
    ['Suricato', 'Meerkat', 'mamifero', 'c', 'deserto', 'af', 'a', 0.8, ['Suricata', 'Timão']],
    ['Toupeira', 'European mole', 'mamifero', 'c', 'campo', 'eu as', 'a', 0.1, []],
    ['Quati', 'South American coati', 'mamifero', 'o', 'floresta', 'sa', 'a', 4, []],
    ['Texugo', 'European badger', 'mamifero', 'o', 'floresta', 'eu as', 'a', 12, []],
    ['Furão', 'Ferret', 'mamifero', 'c', 'casa', '*', 'a', 1, []],
    ['Pangolim', 'Pangolin', 'mamifero', 'c', 'floresta campo', 'af as', 'a', 10, []],
    ['Morcego-vampiro', 'Common vampire bat', 'mamifero', 's', 'floresta', 'sa na', 'av', 0.04, ['Morcego', 'Vampiro']],
    ['Raposa-voadora', 'Megabat', 'mamifero', 'h', 'floresta', 'as oc af', 'av', 1, ['Morcego-frugívoro', 'Morcego-da-fruta']],
    ['Cervo', 'Red deer', 'mamifero', 'h', 'floresta', 'eu as', 'a', 150, ['Veado', 'Cervo-vermelho', 'Corça']],
    ['Veado-campeiro', 'Pampas deer', 'mamifero', 'h', 'campo', 'sa', 'a', 35, []],
    ['Rena', 'Reindeer', 'mamifero', 'h', 'gelo campo', 'na eu as', 'a', 120, ['Caribu']],
    ['Alce', 'Moose', 'mamifero', 'h', 'floresta', 'na eu as', 'a', 500, []],
    ['Impala', 'Impala', 'mamifero', 'h', 'campo', 'af', 'a', 50, ['Antílope']],
    ['Gnu', 'Blue wildebeest', 'mamifero', 'h', 'campo', 'af', 'a', 200, []],
    ['Gazela', "Thomson's gazelle", 'mamifero', 'h', 'campo', 'af', 'a', 25, []],
    ['Golfinho', 'Common bottlenose dolphin', 'mamifero', 'c', 'mar', '*', 'n', 200, ['Golfinho-nariz-de-garrafa', 'Roaz']],
    ['Boto-cor-de-rosa', 'Amazon river dolphin', 'mamifero', 'c', 'rio', 'sa', 'n', 150, ['Boto', 'Boto-vermelho']],
    ['Orca', 'Orca', 'mamifero', 'c', 'mar gelo', '* an', 'n', 5000, ['Baleia-assassina']],
    ['Baleia-azul', 'Blue whale', 'mamifero', 'c', 'mar', '* an', 'n', 150_000, ['Baleia']],
    ['Baleia-jubarte', 'Humpback whale', 'mamifero', 'c', 'mar', '* an', 'n', 30_000, ['Jubarte']],
    ['Cachalote', 'Sperm whale', 'mamifero', 'c', 'mar', '*', 'n', 40_000, []],
    ['Beluga', 'Beluga whale', 'mamifero', 'c', 'mar gelo', 'na eu as', 'n', 1400, ['Baleia-branca']],
    ['Narval', 'Narwhal', 'mamifero', 'c', 'mar gelo', 'na eu as', 'n', 1200, []],
    ['Peixe-boi', 'Manatee', 'mamifero', 'h', 'mar rio', 'sa na af', 'n', 500, []],
    ['Foca', 'Harbor seal', 'mamifero', 'c', 'mar gelo', 'na eu as', 'an', 100, []],
    ['Leão-marinho', 'California sea lion', 'mamifero', 'c', 'mar', 'na', 'an', 250, ['Lobo-marinho']],
    ['Morsa', 'Walrus', 'mamifero', 'c', 'gelo mar', 'na eu as', 'an', 1000, []],
    ['Lontra', 'Neotropical otter', 'mamifero', 'c', 'rio', 'sa na', 'an', 8, ['Lontra-neotropical']],
    ['Ariranha', 'Giant otter', 'mamifero', 'c', 'rio', 'sa', 'an', 30, []],
    ['Lontra-marinha', 'Sea otter', 'mamifero', 'c', 'mar', 'na as', 'n', 30, []],
  ] },

  { group: 'aves', bichos: [
    ['Águia-careca', 'Bald eagle', 'ave', 'c', 'floresta rio', 'na', 'av', 5, ['Águia-americana', 'Águia']],
    ['Águia-real', 'Golden eagle', 'ave', 'c', 'montanha', 'na eu as af', 'av', 5, []],
    ['Harpia', 'Harpy eagle', 'ave', 'c', 'floresta', 'sa na', 'av', 7, ['Gavião-real']],
    ['Falcão-peregrino', 'Peregrine falcon', 'ave', 'c', 'montanha cidade', '*', 'av', 1, ['Falcão']],
    ['Coruja-buraqueira', 'Burrowing owl', 'ave', 'c', 'campo cidade', 'sa na', 'av', 0.15, ['Coruja', 'Corujinha']],
    ['Coruja-das-neves', 'Snowy owl', 'ave', 'c', 'gelo', 'na eu as', 'av', 2, []],
    ['Suindara', 'Barn owl', 'ave', 'c', 'campo cidade', '*', 'av', 0.5, ['Coruja-das-torres', 'Coruja-de-igreja', 'Rasga-mortalha']],
    ['Urubu', 'Black vulture', 'ave', 'c', 'cidade campo', 'sa na', 'av', 2, ['Urubu-de-cabeça-preta', 'Abutre']],
    ['Condor', 'Andean condor', 'ave', 'c', 'montanha', 'sa', 'av', 12, ['Condor-dos-andes']],
    ['Arara-azul', 'Hyacinth macaw', 'ave', 'h', 'floresta campo', 'sa', 'av', 1.4, ['Arara-azul-grande', 'Arara']],
    ['Arara-vermelha', 'Scarlet macaw', 'ave', 'h', 'floresta', 'sa na', 'av', 1, ['Araracanga', 'Arara-canga']],
    ['Ararinha-azul', "Spix's macaw", 'ave', 'h', 'floresta', 'sa', 'av', 0.3, ['Blu']],
    ['Papagaio', 'Turquoise-fronted amazon', 'ave', 'h', 'floresta casa', 'sa', 'av', 0.4, ['Papagaio-verdadeiro', 'Louro']],
    ['Periquito-australiano', 'Budgerigar', 'ave', 'h', 'casa campo', 'oc', 'av', 0.035, ['Periquito']],
    ['Calopsita', 'Cockatiel', 'ave', 'h', 'casa campo', 'oc', 'av', 0.09, []],
    ['Cacatua', 'Sulphur-crested cockatoo', 'ave', 'h', 'floresta', 'oc', 'av', 0.8, []],
    ['Tucano', 'Toco toucan', 'ave', 'o', 'floresta', 'sa', 'av', 0.6, ['Tucano-toco', 'Tucanuçu']],
    ['Beija-flor', 'Hummingbird', 'ave', 'h', 'floresta cidade', 'sa na', 'v', 0.004, ['Colibri']],
    ['Pica-pau', 'Woodpecker', 'ave', 'c', 'floresta', 'sa na eu af as', 'av', 0.1, []],
    ['João-de-barro', 'Rufous hornero', 'ave', 'c', 'campo cidade', 'sa', 'av', 0.05, ['Forneiro']],
    ['Bem-te-vi', 'Great kiskadee', 'ave', 'o', 'cidade campo', 'sa na', 'av', 0.06, []],
    ['Sabiá', 'Rufous-bellied thrush', 'ave', 'o', 'cidade floresta', 'sa', 'av', 0.07, ['Sabiá-laranjeira']],
    ['Pardal', 'House sparrow', 'ave', 'o', 'cidade', '*', 'av', 0.03, []],
    ['Pombo', 'Rock dove', 'ave', 'h', 'cidade', '*', 'av', 0.35, ['Pomba', 'Pombo-doméstico']],
    ['Andorinha', 'Barn swallow', 'ave', 'c', 'campo cidade', '*', 'v', 0.02, []],
    ['Canário', 'Domestic canary', 'ave', 'h', 'casa', '*', 'av', 0.02, ['Canário-belga']],
    ['Corvo', 'Common raven', 'ave', 'o', 'floresta montanha', 'na eu as af', 'av', 1.2, []],
    ['Gaivota', 'Gull', 'ave', 'o', 'mar cidade', '*', 'avn', 1, []],
    ['Pelicano', 'Pelican', 'ave', 'c', 'mar rio', '*', 'avn', 7, []],
    ['Flamingo', 'Flamingo', 'ave', 'o', 'rio mar', 'sa na eu af as', 'av', 3, []],
    ['Garça', 'Great egret', 'ave', 'c', 'rio', '*', 'av', 1, ['Garça-branca']],
    ['Tuiuiú', 'Jabiru', 'ave', 'c', 'rio', 'sa na', 'av', 7, ['Jaburu']],
    ['Cegonha', 'White stork', 'ave', 'c', 'campo rio', 'eu af as', 'av', 3.5, []],
    ['Pinguim-imperador', 'Emperor penguin', 'ave', 'c', 'gelo mar', 'an', 'an', 30, ['Pinguim']],
    ['Pinguim-de-magalhães', 'Magellanic penguin', 'ave', 'c', 'mar', 'sa', 'an', 4, []],
    ['Avestruz', 'Common ostrich', 'ave', 'o', 'campo deserto', 'af', 'a', 110, []],
    ['Ema', 'Greater rhea', 'ave', 'o', 'campo', 'sa', 'a', 25, ['Nhandu']],
    ['Emu', 'Emu', 'ave', 'o', 'campo', 'oc', 'a', 40, ['Emu-australiano']],
    ['Casuar', 'Southern cassowary', 'ave', 'o', 'floresta', 'oc', 'a', 50, []],
    ['Kiwi', 'Kiwi (bird)', 'ave', 'o', 'floresta', 'oc', 'a', 2.5, ['Quivi']],
    ['Galinha', 'Chicken', 'ave', 'o', 'casa', '*', 'a', 2.5, ['Galo', 'Frango', 'Pintinho']],
    ['Peru', 'Domestic turkey', 'ave', 'o', 'casa', '*', 'a', 10, []],
    ['Pato', 'Mallard', 'ave', 'o', 'rio casa', '*', 'avn', 1.2, ['Pato-real', 'Marreco']],
    ['Ganso', 'Domestic goose', 'ave', 'h', 'rio casa', '*', 'avn', 5, []],
    ['Cisne', 'Mute swan', 'ave', 'h', 'rio', 'eu as', 'avn', 11, ['Cisne-branco']],
    ['Pavão', 'Indian peafowl', 'ave', 'o', 'floresta casa', 'as', 'av', 5, ['Pavão-indiano', 'Pavoa']],
    ['Seriema', 'Red-legged seriema', 'ave', 'c', 'campo', 'sa', 'a', 1.5, []],
    ['Quero-quero', 'Southern lapwing', 'ave', 'c', 'campo cidade', 'sa', 'av', 0.3, []],
    ['Albatroz', 'Wandering albatross', 'ave', 'c', 'mar', 'an sa af oc', 'vn', 9, []],
    ['Gralha-azul', 'Azure jay', 'ave', 'o', 'floresta', 'sa', 'av', 0.25, []],
    ['Martim-pescador', 'Common kingfisher', 'ave', 'c', 'rio', 'eu as af', 'vn', 0.04, []],
    ['Papagaio-do-mar', 'Atlantic puffin', 'ave', 'c', 'mar', 'na eu', 'avn', 0.5, ['Puffin']],
  ] },

  { group: 'repteis', bichos: [
    ['Jacaré', 'Yacare caiman', 'reptil', 'c', 'rio', 'sa', 'an', 60, ['Jacaré-do-pantanal']],
    ['Jacaré-açu', 'Black caiman', 'reptil', 'c', 'rio', 'sa', 'an', 400, []],
    ['Crocodilo', 'Nile crocodile', 'reptil', 'c', 'rio', 'af', 'an', 400, ['Crocodilo-do-nilo', 'Crocodilo-do-Nilo']],
    ['Crocodilo-de-água-salgada', 'Saltwater crocodile', 'reptil', 'c', 'rio mar', 'as oc', 'an', 700, ['Crocodilo-marinho']],
    ['Aligátor', 'American alligator', 'reptil', 'c', 'rio', 'na', 'an', 300, ['Jacaré-americano', 'Alligator']],
    ['Tartaruga-marinha', 'Green sea turtle', 'reptil', 'h', 'mar', '*', 'n', 150, ['Tartaruga-verde', 'Tartaruga']],
    ['Tartaruga-de-couro', 'Leatherback sea turtle', 'reptil', 'c', 'mar', '*', 'n', 500, ['Tartaruga-gigante-marinha']],
    ['Jabuti', 'Red-footed tortoise', 'reptil', 'h', 'floresta', 'sa', 'a', 6, ['Jabuti-piranga']],
    ['Tartaruga-de-galápagos', 'Galápagos tortoise', 'reptil', 'h', 'campo', 'sa', 'a', 250, ['Tartaruga-gigante', 'Tartaruga-de-Galápagos']],
    ['Iguana', 'Green iguana', 'reptil', 'h', 'floresta', 'sa na', 'a', 5, ['Iguana-verde']],
    ['Iguana-marinha', 'Marine iguana', 'reptil', 'h', 'mar', 'sa', 'an', 1.5, []],
    ['Camaleão', 'Chameleon', 'reptil', 'c', 'floresta', 'af as', 'a', 0.15, []],
    ['Lagartixa', 'Tropical house gecko', 'reptil', 'c', 'casa cidade', '*', 'a', 0.005, ['Lagartixa-de-parede', 'Osga', 'Briba']],
    ['Teiú', 'Argentine black and white tegu', 'reptil', 'o', 'campo floresta', 'sa', 'a', 5, ['Teju', 'Tiú', 'Lagarto']],
    ['Dragão-de-komodo', 'Komodo dragon', 'reptil', 'c', 'campo floresta', 'as', 'a', 80, ['Dragão-de-Komodo']],
    ['Monstro-de-gila', 'Gila monster', 'reptil', 'c', 'deserto', 'na', 'a', 2, ['Monstro-de-Gila']],
    ['Dragão-barbudo', 'Central bearded dragon', 'reptil', 'o', 'deserto casa', 'oc', 'a', 0.4, ['Pogona']],
    ['Sucuri', 'Green anaconda', 'reptil', 'c', 'rio', 'sa', 'rn', 70, ['Anaconda', 'Sucuriju']],
    ['Jiboia', 'Boa constrictor', 'reptil', 'c', 'floresta', 'sa na', 'r', 15, ['Jibóia']],
    ['Píton', 'Burmese python', 'reptil', 'c', 'floresta rio', 'as', 'rn', 60, ['Pitão', 'Píton-birmanesa']],
    ['Cascavel', 'Crotalus durissus', 'reptil', 'c', 'campo', 'sa na', 'r', 2, []],
    ['Jararaca', 'Bothrops jararaca', 'reptil', 'c', 'floresta', 'sa', 'r', 0.8, []],
    ['Surucucu', 'Lachesis muta', 'reptil', 'c', 'floresta', 'sa', 'r', 3, ['Surucucu-pico-de-jaca']],
    ['Cobra-coral', 'Micrurus corallinus', 'reptil', 'c', 'floresta', 'sa', 'r', 0.3, ['Coral', 'Coral-verdadeira']],
    ['Naja', 'Indian cobra', 'reptil', 'c', 'campo floresta', 'as', 'r', 2, ['Cobra-capelo', 'Cobra-de-óculos']],
    ['Naja-real', 'King cobra', 'reptil', 'c', 'floresta', 'as', 'r', 6, ['Cobra-real']],
    ['Mamba-negra', 'Black mamba', 'reptil', 'c', 'campo', 'af', 'r', 1.6, ['Mamba']],
    ['Sapo-cururu', 'Cane toad', 'anfibio', 'c', 'floresta cidade rio', 'sa na oc', 'an', 1, ['Sapo', 'Cururu']],
    ['Rã-touro', 'American bullfrog', 'anfibio', 'c', 'rio', 'na', 'an', 0.5, ['Rã']],
    ['Perereca-de-olhos-vermelhos', 'Agalychnis callidryas', 'anfibio', 'c', 'floresta', 'na', 'a', 0.007, ['Perereca']],
    ['Sapo-dardo', 'Poison dart frog', 'anfibio', 'c', 'floresta', 'sa na', 'a', 0.002, ['Sapo-flecha', 'Rã-dardo', 'Sapo-venenoso']],
    ['Rã-de-vidro', 'Glass frog', 'anfibio', 'c', 'floresta rio', 'sa na', 'a', 0.005, []],
    ['Sapo-de-chifre', 'Ceratophrys', 'anfibio', 'c', 'floresta', 'sa', 'a', 0.3, ['Sapo-boi', 'Untanha', 'Sapo-pacman']],
    ['Axolote', 'Axolotl', 'anfibio', 'c', 'rio', 'na', 'an', 0.1, ['Axolotl', 'Axolotle']],
    ['Salamandra', 'Fire salamander', 'anfibio', 'c', 'floresta', 'eu', 'a', 0.04, ['Salamandra-de-fogo']],
    ['Cobra-cega', 'Caecilian', 'anfibio', 'c', 'floresta', 'sa af as', 'r', 0.1, ['Cecília']],
  ] },

  { group: 'peixes', bichos: [
    ['Tubarão-branco', 'Great white shark', 'peixe', 'c', 'mar', '*', 'n', 1100, ['Tubarão', 'Tubarão-branco-grande']],
    ['Tubarão-martelo', 'Hammerhead shark', 'peixe', 'c', 'mar', '*', 'n', 300, []],
    ['Tubarão-baleia', 'Whale shark', 'peixe', 'c', 'mar', '*', 'n', 19_000, []],
    ['Tubarão-tigre', 'Tiger shark', 'peixe', 'c', 'mar', '*', 'n', 500, []],
    ['Jamanta', 'Giant oceanic manta ray', 'peixe', 'c', 'mar', '*', 'n', 1500, ['Arraia-jamanta', 'Manta', 'Raia-manta']],
    ['Arraia', 'Stingray', 'peixe', 'c', 'mar rio', '*', 'n', 10, ['Raia', 'Arraia-de-ferrão']],
    ['Peixe-palhaço', 'Ocellaris clownfish', 'peixe', 'o', 'mar', 'as oc', 'n', 0.02, ['Nemo']],
    ['Cirurgião-patela', 'Paracanthurus', 'peixe', 'o', 'mar', 'as oc af', 'n', 0.6, ['Dory', 'Peixe-cirurgião', 'Cirurgião-azul']],
    ['Baiacu', 'Tetraodontidae', 'peixe', 'o', 'mar', '*', 'n', 0.5, ['Peixe-balão', 'Fugu']],
    ['Peixe-leão', 'Red lionfish', 'peixe', 'c', 'mar', 'as oc na', 'n', 1, []],
    ['Peixe-espada', 'Swordfish', 'peixe', 'c', 'mar', '*', 'n', 300, ['Espadarte']],
    ['Atum', 'Atlantic bluefin tuna', 'peixe', 'c', 'mar', 'na eu af', 'n', 250, ['Atum-rabilho', 'Atum-azul']],
    ['Salmão', 'Atlantic salmon', 'peixe', 'c', 'mar rio', 'na eu', 'n', 5, []],
    ['Sardinha', 'Sardine', 'peixe', 'o', 'mar', '*', 'n', 0.1, []],
    ['Bacalhau', 'Atlantic cod', 'peixe', 'c', 'mar', 'na eu', 'n', 10, []],
    ['Tilápia', 'Nile tilapia', 'peixe', 'o', 'rio', '*', 'n', 2, ['Tilápia-do-nilo']],
    ['Carpa', 'Common carp', 'peixe', 'o', 'rio', '*', 'n', 5, ['Carpa-comum', 'Koi', 'Carpa-koi']],
    ['Peixe-dourado', 'Goldfish', 'peixe', 'o', 'casa rio', '*', 'n', 0.1, ['Kinguio', 'Peixinho-dourado', 'Peixe-japonês']],
    ['Betta', 'Siamese fighting fish', 'peixe', 'c', 'casa rio', 'as', 'n', 0.003, ['Peixe-beta', 'Peixe-de-briga', 'Beta']],
    ['Piranha', 'Red-bellied piranha', 'peixe', 'c', 'rio', 'sa', 'n', 1, ['Piranha-vermelha']],
    ['Pirarucu', 'Arapaima', 'peixe', 'c', 'rio', 'sa', 'n', 200, ['Arapaima']],
    ['Tambaqui', 'Tambaqui', 'peixe', 'o', 'rio', 'sa', 'n', 30, []],
    ['Tucunaré', 'Cichla', 'peixe', 'c', 'rio', 'sa', 'n', 5, []],
    ['Dourado', 'Salminus brasiliensis', 'peixe', 'c', 'rio', 'sa', 'n', 15, []],
    ['Pintado', 'Pseudoplatystoma corruscans', 'peixe', 'c', 'rio', 'sa', 'n', 40, ['Surubim']],
    ['Lambari', 'Astyanax (fish)', 'peixe', 'o', 'rio', 'sa na', 'n', 0.02, ['Piaba']],
    ['Poraquê', 'Electric eel', 'peixe', 'c', 'rio', 'sa', 'n', 20, ['Peixe-elétrico', 'Enguia-elétrica']],
    ['Enguia', 'European eel', 'peixe', 'c', 'rio mar', 'eu af', 'n', 1.5, []],
    ['Moreia', 'Moray eel', 'peixe', 'c', 'mar', '*', 'n', 5, []],
    ['Cavalo-marinho', 'Seahorse', 'peixe', 'c', 'mar', '*', 'n', 0.01, []],
    ['Peixe-voador', 'Flying fish', 'peixe', 'c', 'mar', '*', 'nv', 0.2, []],
    ['Peixe-lua', 'Ocean sunfish', 'peixe', 'c', 'mar', '*', 'n', 1000, ['Mola-mola']],
    ['Linguado', 'Flatfish', 'peixe', 'c', 'mar', '*', 'n', 2, []],
    ['Peixe-pescador', 'Anglerfish', 'peixe', 'c', 'mar', '*', 'n', 1, ['Diabo-marinho', 'Tamboril']],
    ['Barracuda', 'Great barracuda', 'peixe', 'c', 'mar', '*', 'n', 20, ['Bicuda']],
    ['Esturjão', 'Beluga (sturgeon)', 'peixe', 'c', 'mar rio', 'eu as', 'n', 250, ['Esturjão-beluga']],
  ] },

  { group: 'invertebrados', bichos: [
    ['Formiga', 'Ant', 'inseto', 'o', 'floresta campo casa', '*', 'a', 0.000005, ['Saúva']],
    ['Abelha', 'Western honey bee', 'inseto', 'h', 'campo floresta', '*', 'av', 0.0001, ['Abelha-europeia', 'Abelha-melífera']],
    ['Vespa', 'Vespula vulgaris', 'inseto', 'c', 'floresta cidade', 'eu as', 'av', 0.0005, ['Marimbondo']],
    ['Mosquito', 'Mosquito', 'inseto', 's', 'cidade rio', '*', 'v', 0.000002, ['Pernilongo', 'Muriçoca', 'Carapanã', 'Aedes']],
    ['Mosca', 'Housefly', 'inseto', 'o', 'casa cidade', '*', 'av', 0.00002, ['Mosca-doméstica']],
    ['Barata', 'American cockroach', 'inseto', 'o', 'cidade casa', '*', 'av', 0.001, ['Barata-americana', 'Barata-voadora']],
    ['Borboleta-monarca', 'Monarch butterfly', 'inseto', 'h', 'campo', 'na sa oc', 'v', 0.0005, ['Borboleta', 'Monarca']],
    ['Borboleta-azul', 'Morpho menelaus', 'inseto', 'h', 'floresta', 'sa na', 'v', 0.001, ['Morfo', 'Borboleta-morfo']],
    ['Mariposa', 'Moth', 'inseto', 'h', 'floresta casa', '*', 'v', 0.0005, ['Traça']],
    ['Joaninha', 'Coccinella septempunctata', 'inseto', 'c', 'campo floresta', '*', 'av', 0.00003, []],
    ['Gafanhoto', 'Grasshopper', 'inseto', 'h', 'campo', '*', 'av', 0.003, ['Saltão', 'Locusta']],
    ['Grilo', 'House cricket', 'inseto', 'o', 'campo casa', '*', 'a', 0.0005, []],
    ['Louva-a-deus', 'Mantis', 'inseto', 'c', 'campo floresta', '*', 'av', 0.003, []],
    ['Cigarra', 'Cicada', 'inseto', 'h', 'floresta cidade', '*', 'av', 0.002, []],
    ['Libélula', 'Dragonfly', 'inseto', 'c', 'rio', '*', 'v', 0.001, ['Lavadeira', 'Cavalinho-de-judeu']],
    ['Vaga-lume', 'Firefly', 'inseto', 'c', 'floresta campo', '*', 'av', 0.00002, ['Pirilampo', 'Vagalume']],
    ['Besouro-hércules', 'Hercules beetle', 'inseto', 'h', 'floresta', 'sa na', 'av', 0.1, ['Besouro', 'Besouro-rinoceronte']],
    ['Rola-bosta', 'Dung beetle', 'inseto', 'h', 'campo', '*', 'av', 0.002, ['Escaravelho', 'Besouro-rola-bosta']],
    ['Cupim', 'Termite', 'inseto', 'h', 'floresta campo casa', '*', 'a', 0.00001, ['Térmita', 'Siriri', 'Aleluia']],
    ['Pulga', 'Flea', 'inseto', 's', 'casa', '*', 'a', 0.0000005, []],
    ['Piolho', 'Head louse', 'inseto', 's', 'casa', '*', 'a', 0.0000001, []],
    ['Bicho-pau', 'Phasmatodea', 'inseto', 'h', 'floresta', 'sa na eu af as oc', 'a', 0.005, []],
    ['Barbeiro', 'Triatoma infestans', 'inseto', 's', 'casa campo', 'sa', 'av', 0.0005, ['Chupança', 'Fincão']],
    ['Tarântula', 'Tarantula', 'aracnideo', 'c', 'floresta deserto', 'sa na af as oc', 'a', 0.05, ['Caranguejeira']],
    ['Viúva-negra', 'Latrodectus mactans', 'aracnideo', 'c', 'casa campo', 'na sa', 'a', 0.001, []],
    ['Aranha-armadeira', 'Phoneutria', 'aracnideo', 'c', 'floresta casa', 'sa', 'a', 0.005, ['Armadeira', 'Aranha-das-bananas']],
    ['Aranha-marrom', 'Loxosceles', 'aracnideo', 'c', 'casa', 'sa na', 'a', 0.0005, ['Aranha-violino']],
    ['Escorpião-amarelo', 'Tityus serrulatus', 'aracnideo', 'c', 'cidade casa', 'sa', 'a', 0.003, ['Escorpião']],
    ['Carrapato', 'Tick', 'aracnideo', 's', 'campo floresta', '*', 'a', 0.0001, ['Carrapato-estrela']],
    ['Caranguejo', 'Ucides cordatus', 'crustaceo', 'o', 'mar', 'sa', 'a', 0.5, ['Caranguejo-uçá', 'Uçá']],
    ['Siri', 'Callinectes sapidus', 'crustaceo', 'o', 'mar', 'na sa', 'an', 0.5, ['Siri-azul']],
    ['Lagosta', 'American lobster', 'crustaceo', 'c', 'mar', 'na', 'an', 4, []],
    ['Camarão', 'Shrimp', 'crustaceo', 'o', 'mar rio', '*', 'an', 0.02, []],
    ['Caranguejo-ermitão', 'Hermit crab', 'crustaceo', 'o', 'mar', '*', 'a', 0.05, ['Bernardo-eremita', 'Ermitão']],
    ['Tatuzinho', 'Armadillidium vulgare', 'crustaceo', 'h', 'casa floresta', '*', 'a', 0.0001, ['Tatu-bola-de-jardim', 'Bicho-de-conta']],
    ['Polvo', 'Common octopus', 'molusco', 'c', 'mar', '*', 'n', 5, []],
    ['Lula', 'Squid', 'molusco', 'c', 'mar', '*', 'n', 1, ['Calamar']],
    ['Lula-gigante', 'Giant squid', 'molusco', 'c', 'mar', '*', 'n', 200, []],
    ['Náutilo', 'Nautilus', 'molusco', 'c', 'mar', 'as oc', 'n', 1, ['Nautilus']],
    ['Caracol', 'Cornu aspersum', 'molusco', 'h', 'floresta casa', '*', 'r', 0.01, ['Caramujo', 'Escargô']],
    ['Lesma', 'Slug', 'molusco', 'h', 'floresta casa', '*', 'r', 0.01, []],
    ['Água-viva', 'Jellyfish', 'outro', 'c', 'mar', '*', 'n', 0.5, ['Medusa']],
    ['Caravela-portuguesa', "Portuguese man o' war", 'outro', 'c', 'mar', '*', 'n', 1, ['Caravela']],
    ['Estrela-do-mar', 'Starfish', 'outro', 'c', 'mar', '*', 'r', 0.2, []],
    ['Ouriço-do-mar', 'Sea urchin', 'outro', 'h', 'mar', '*', 'r', 0.1, []],
    ['Minhoca', 'Earthworm', 'outro', 'o', 'floresta campo', '*', 'r', 0.003, []],
    ['Sanguessuga', 'Leech', 'outro', 's', 'rio', '*', 'rn', 0.002, []],
    ['Centopeia', 'Centipede', 'outro', 'c', 'floresta casa', '*', 'a', 0.02, ['Lacraia', 'Centopéia']],
    ['Piolho-de-cobra', 'Millipede', 'outro', 'h', 'floresta', '*', 'a', 0.01, ['Embuá', 'Gongolo', 'Mil-pés']],
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
 * Id da Wikidata e foto de um lote de artigos, seguindo redirecionamento. A
 * foto e a `pageimage` do artigo, que a Wikipedia ja escolhe entre as livres.
 * Vem em dois tamanhos: o pequeno e a miniatura da busca, o grande e o da tela
 * de resultado.
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

/** O arquivo da ficha da Wikidata (P18) de quem o artigo deixou sem foto. */
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
 * A foto trocada a mao, pelo titulo do artigo: o arquivo do Commons que fica
 * no lugar. Sao os artigos de grupo cujo topo e um mosaico de especies, um
 * esqueleto ou um mapa, e as fotos em que o bicho some no cenario — no modo
 * imagem, reduzida a um punhado de pixels, a foto precisa ser o bicho.
 */
const IMAGEM = {
  Hummingbird: 'Colibri-thalassinus-001.jpg',
  Pangolin: 'Pangolin borneo.jpg',
  Anglerfish: 'Humpback anglerfish.png',
  Centipede: 'Centipede.jpg',
  Millipede: 'Millipede.jpg',
  Starfish: 'Asterias rubens.jpg',
  Slug: 'Arion rufus (Dourbes).jpg',
  'Giant squid': 'Architeuthis dux.jpg',
  Swordfish: 'Swordfish natural environment.jpg',
  'Snowy owl': 'Bubo scandiacus (Linnaeus, 1758) Male.jpg',
};

/** Visitas de um artigo da Wikipedia em portugues nos ultimos doze meses fechados. */
async function visitasDe(titulo) {
  const hoje = new Date();
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0));
  const inicio = new Date(Date.UTC(fim.getUTCFullYear() - 1, fim.getUTCMonth() + 1, 1));
  const dia = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const periodo = `${dia(inicio)}00/${dia(fim)}00`;
  const slug = createHash('sha1').update(titulo).digest('hex').slice(0, 12);
  const json = await cached(`visitas-${periodo.replace('/', '-')}-${slug}`, async () => {
    const res = await fetch(`${METRICS}/${encodeURIComponent(titulo.replace(/ /g, '_'))}/monthly/${periodo}`,
      { headers: { 'user-agent': UA } });
    return res.ok ? res.json() : { items: [] };
  });
  return (json.items ?? []).reduce((soma, m) => soma + m.views, 0);
}

/**
 * A fama de cada bicho: as visitas no ultimo ano do artigo em portugues. Sao
 * dois candidatos, e vale o maior. Um e o artigo que a Wikidata liga a
 * especie; o outro e o artigo que o nome da tabela abre, seguindo o
 * redirecionamento. Sem o segundo, a regua media a especie e nao o bicho: a
 * zebra da tabela e a zebra-da-planicie (6 mil visitas), mas quem procura
 * "Zebra" cai no artigo do genero, e e esse que diz quanto a sala conhece.
 */
async function fama(bichos) {
  const ligado = {};
  const qids = bichos.map(b => `Q${b.id}`);
  for (let i = 0; i < qids.length; i += 50) {
    const lote = qids.slice(i, i + 50);
    const json = await cached(loteSlug('ptwiki', lote), () => pega(`${WIKIDATA}?${new URLSearchParams({
      action: 'wbgetentities', format: 'json', props: 'sitelinks', sitefilter: 'ptwiki', ids: lote.join('|'),
    })}`));
    for (const q of lote) ligado[q] = json.entities?.[q]?.sitelinks?.ptwiki?.title ?? null;
  }

  const peloNome = {};
  const nomes = bichos.map(b => b.name);
  for (let i = 0; i < nomes.length; i += 50) {
    const lote = nomes.slice(i, i + 50);
    const json = await cached(loteSlug('ptnomes', lote), () => pega(`${PTWIKI}?${new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', redirects: '1', titles: lote.join('|'),
    })}`));
    const destino = new Map(lote.map(t => [t, t]));
    for (const passo of [...(json.query?.normalized ?? []), ...(json.query?.redirects ?? [])]) {
      for (const [pedido, atual] of destino) if (atual === passo.from) destino.set(pedido, passo.to);
    }
    const existe = new Set((json.query?.pages ?? []).filter(p => !p.missing).map(p => p.title));
    for (const t of lote) peloNome[t] = existe.has(destino.get(t)) ? destino.get(t) : null;
  }

  const saida = {};
  for (const b of bichos) {
    const titulos = [...new Set([ligado[`Q${b.id}`], peloNome[b.name]].filter(Boolean))];
    let maior = 0;
    for (const t of titulos) maior = Math.max(maior, await visitasDe(t));
    saida[b.id] = maior;
  }
  return saida;
}

// ------------------------------------------------------------- montagem

const linhas = GRUPOS.flatMap(({ group, bichos }) =>
  bichos.map(([name, wiki, klass, diet, habitat, continents, move, kg, aliases]) => ({
    name, wiki, klass, diet, kg, aliases, group,
    habitat: habitat.split(' '),
    continents: continents.split(' ').flatMap(c => (c === '*' ? MUNDO : [c])),
    move: [...move],
  })));

// a tabela e escrita a mao: o script recusa o que nao esta no vocabulario em
// vez de deixar uma celula que nunca fecha verde com ninguem
const erros = [];
const nomes = new Set();
for (const b of linhas) {
  if (nomes.has(b.name)) erros.push(`${b.name}: nome repetido`);
  nomes.add(b.name);
  if (!(b.klass in CLASSES)) erros.push(`${b.name}: classe ${b.klass}`);
  if (!(b.diet in DIETAS)) erros.push(`${b.name}: dieta ${b.diet}`);
  if (!b.habitat.length || b.habitat.length > 3) erros.push(`${b.name}: ${b.habitat.length} habitats`);
  for (const h of b.habitat) if (!HABITATS.has(h)) erros.push(`${b.name}: habitat ${h}`);
  for (const c of b.continents) if (!CONTINENTES.has(c)) erros.push(`${b.name}: continente ${c}`);
  for (const m of b.move) if (!(m in LOCOMOCAO)) erros.push(`${b.name}: locomocao ${m}`);
  if (!(b.kg > 0)) erros.push(`${b.name}: peso ${b.kg}`);
}
if (erros.length) throw new Error(`tabela torta:\n  ${erros.join('\n  ')}`);

const titulos = [...new Set(linhas.map(b => b.wiki))];
const pequenas = await emLotes(titulos, 250);
const grandes = await emLotes(titulos, 500);

// o arquivo do Commons de quem nao fica com a foto do artigo: o trocado a mao
// primeiro, a ficha da Wikidata para quem o artigo deixou sem
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

const saida = [];
const semImagem = [];
const vistos = new Map();

for (const b of linhas) {
  const artigo = pequenas[b.wiki];
  if (!artigo?.qid) erros.push(`${b.name}: "${b.wiki}" nao existe na Wikipedia em ingles`);
  else if (artigo.ambigua) erros.push(`${b.name}: "${b.wiki}" e pagina de desambiguacao`);
  if (!artigo?.qid || artigo.ambigua) continue;

  const id = Number(artigo.qid.slice(1));
  if (vistos.has(id)) {
    erros.push(`${b.name}: mesmo artigo que ${vistos.get(id)} (${artigo.titulo})`);
    continue;
  }
  vistos.set(id, b.name);
  if (!artigo.imagem) semImagem.push(b.name);

  // o apelido que so repete o nome (tirando acento e caixa) nao ajuda a busca
  const base = b.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const aliases = [...new Set(b.aliases)]
    .filter(a => a.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() !== base);

  saida.push({
    id,
    name: b.name,
    group: b.group,
    klass: b.klass,
    diet: DIETAS[b.diet],
    habitat: b.habitat,
    continents: b.continents,
    move: b.move.map(m => LOCOMOCAO[m]),
    weight: faixa(b.kg),
    sprite: artigo.imagem,
    artwork: grandes[b.wiki]?.imagem ?? artigo.imagem,
    ...(aliases.length ? { aliases } : {}),
    eligible: false,
  });
}

if (erros.length) throw new Error(`a Wikipedia nao fechou com a tabela:\n  ${erros.join('\n  ')}`);

// a peneira da fama: acima do piso entra; abaixo, so os primeiros do grupo ate
// o minimo dele. Sem foto nao entra — no modo imagem o bicho e a foto
const visitas = await fama(saida);
for (const { group } of GRUPOS) {
  const doGrupo = saida.filter(b => b.group === group && b.sprite)
    .sort((a, b) => visitas[b.id] - visitas[a.id]);
  doGrupo.forEach((b, i) => { b.eligible = visitas[b.id] >= PISO_VISITAS || i < MINIMO || SEMPRE.has(b.name); });
}

await fs.writeFile(OUT, JSON.stringify(saida));

const porGrupo = {};
for (const b of saida.filter(b => b.eligible)) porGrupo[b.group] = (porGrupo[b.group] ?? 0) + 1;
console.log(`${saida.length} animais em ${OUT}, ${saida.filter(b => b.eligible).length} sorteaveis`);
for (const { group } of GRUPOS) console.log(`  ${group}: ${porGrupo[group] ?? 0}`);
if (semImagem.length) console.log(`\nsem foto livre (${semImagem.length}): ${semImagem.join(', ')}`);
if (process.argv.includes('--fama')) {
  for (const b of [...saida].sort((a, b) => visitas[a.id] - visitas[b.id])) {
    console.log(`${String(visitas[b.id]).padStart(8)}  ${b.eligible ? '✓' : ' '} ${b.group.padEnd(13)} ${b.name}`);
  }
}
