/**
 * Monta data/desenhos.json com os personagens dos canais de desenho.
 *   npm run build:desenhos
 * Fontes: a tabela abaixo, escrita a mao, e os wikis do Fandom de cada
 * desenho (pela API aberta do MediaWiki), que dao a imagem.
 *
 * O elenco e curado como o dos Deuses. Cada desenho tem seu wiki, com sua
 * propria ficha e seu proprio vocabulario — o de Hora de Aventura chama a
 * especie de "Species", o do Bob Esponja de "Classification", o do Irmao do
 * Jorel nem tem ficha —, e o que a sala pergunta (e bicho ou gente? e vilao? e
 * crianca?) nao sai igual de quarenta fichas diferentes. A tabela e a fonte; o
 * wiki so empresta o rosto.
 *
 * Os nomes sao os da dublagem brasileira (Du, Dudu e Edu; Florzinha; Seu
 * Siriguejo), e o original entra como apelido na busca.
 *
 * O id e um numero tirado do par wiki + artigo, e nao a ordem da tabela: um
 * personagem novo no meio da lista nao muda o id de ninguem, e a miniatura
 * espelhada segue com ele.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'data', 'desenhos.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'desenhos');
const UA = 'palpite-dataset/1.0 (+https://github.com/PedroVikk)';

await fs.mkdir(CACHE_DIR, { recursive: true });

// ------------------------------------------------------------- a tabela

/**
 * Um desenho por bloco: nome no Brasil, ano de estreia, grupo (o canal) e o
 * wiki do Fandom ("adventuretime", ou "irmaodojorel/pt-br" para wiki em
 * portugues). `curto` e o nome que vai no parentese quando dois personagens
 * tem o mesmo nome: "Harold (Billy e Mandy)" e "Harold (Hey Arnold!)". Um
 * personagem por linha:
 *   [nome, artigo no wiki, especie, genero, papel, idade, apelidos]
 *
 * especie  humano · animal (o Bob Esponja, o Coragem, o Mordecai) · alien
 *          (as Gems, o Zim) · monstro (o Aku, a Marceline, o King) · robo ·
 *          magico (fada, fantasma, amigo imaginario, a Star) · outro (a
 *          Princesa Jujuba, que e doce; o Tabua, que e tabua)
 * genero   M, F ou O (o BMO, o X.A.N.A.)
 * papel    a coluna "Na historia": protagonista · aliado (a turma, os
 *          amigos) · vilao (e o rival que atormenta: o Kevin, a Angelica) ·
 *          familia (pai, mae, irmao, avo)
 * idade    crianca · adolescente · adulto · idoso — a que o desenho mostra: a
 *          Marceline tem mil anos e e adulta, o Pops e idoso
 */
const ESPECIES = new Set(['humano', 'animal', 'alien', 'monstro', 'robo', 'magico', 'outro']);
const PAPEIS = new Set(['protagonista', 'aliado', 'vilao', 'familia']);
const IDADES = new Set(['crianca', 'adolescente', 'adulto', 'idoso']);

const DESENHOS = [
  // ---------------------------------------------------------- Cartoon Network
  { show: 'O Laboratório de Dexter', curto: 'Dexter', year: 1996, group: 'cartoon', wiki: 'dexterslab', chars: [
    ['Dexter', 'Dexter', 'humano', 'M', 'protagonista', 'crianca', []],
    ['Dee Dee', 'Dee Dee', 'humano', 'F', 'familia', 'crianca', []],
    ['Mandark', 'Mandark', 'humano', 'M', 'vilao', 'crianca', ['Susan Astronomonov']],
    ['Macaco', 'Monkey', 'animal', 'M', 'aliado', 'adulto', ['Monkey', 'Agente Macaco']],
    ['Computador', 'Computer', 'robo', 'F', 'aliado', 'adulto', ['Computer']],
    ['Mãe do Dexter', 'Mom', 'humano', 'F', 'familia', 'adulto', ['Mom']],
    ['Pai do Dexter', 'Dad', 'humano', 'M', 'familia', 'adulto', ['Dad']],
  ] },
  { show: 'As Meninas Superpoderosas', curto: 'Meninas Superpoderosas', year: 1998, group: 'cartoon', wiki: 'powerpuffgirls', chars: [
    ['Florzinha', 'Blossom', 'humano', 'F', 'protagonista', 'crianca', ['Blossom']],
    ['Lindinha', 'Bubbles', 'humano', 'F', 'protagonista', 'crianca', ['Bubbles']],
    ['Docinho', 'Buttercup', 'humano', 'F', 'protagonista', 'crianca', ['Buttercup']],
    ['Professor Utônio', 'Professor Utonium', 'humano', 'M', 'familia', 'adulto', ['Professor Utonium']],
    ['Macaco Louco', 'Mojo Jojo', 'animal', 'M', 'vilao', 'adulto', ['Mojo Jojo']],
    ['Ele', 'HIM', 'monstro', 'M', 'vilao', 'adulto', ['HIM']],
    ['Princesa Fortuna', 'Princess Morbucks', 'humano', 'F', 'vilao', 'crianca', ['Princess Morbucks']],
    ['Prefeito', 'The Mayor', 'humano', 'M', 'aliado', 'idoso', ['Mayor', 'Prefeito de Townsville']],
    ['Srta. Bellum', 'Sara Bellum', 'humano', 'F', 'aliado', 'adulto', ['Sara Bellum', 'Miss Bellum']],
    ['Brick', 'Brick', 'humano', 'M', 'vilao', 'crianca', ['Garotos Desordeiros']],
    ['Boomer', 'Boomer', 'humano', 'M', 'vilao', 'crianca', []],
    ['Butch', 'Butch', 'humano', 'M', 'vilao', 'crianca', []],
    ['Fuzzy', 'Fuzzy Lumpkins', 'monstro', 'M', 'vilao', 'adulto', ['Fuzzy Lumpkins']],
    ['Sedusa', 'Sedusa', 'humano', 'F', 'vilao', 'adulto', []],
    ['Srta. Keane', 'Ms. Keane', 'humano', 'F', 'aliado', 'adulto', ['Ms. Keane', 'Professora Keane']],
  ] },
  { show: 'Johnny Bravo', year: 1997, group: 'cartoon', wiki: 'johnnybravo', chars: [
    ['Johnny Bravo', 'Johnny Bravo (character)', 'humano', 'M', 'protagonista', 'adulto', []],
    ['Bunny Bravo', 'Bunny Bravo', 'humano', 'F', 'familia', 'adulto', ['Mamãe Bravo']],
    ['Suzy', 'Little Suzy', 'humano', 'F', 'aliado', 'crianca', ['Little Suzy']],
    ['Carl', 'Carl Chryniszzswics', 'humano', 'M', 'aliado', 'adulto', []],
    ['Pops', 'Pops', 'humano', 'M', 'aliado', 'idoso', []],
  ] },
  { show: 'Coragem, o Cão Covarde', curto: 'Coragem', year: 1999, group: 'cartoon', wiki: 'courage', chars: [
    ['Coragem', 'Courage', 'animal', 'M', 'protagonista', 'adulto', ['Courage']],
    ['Muriel', 'Muriel Bagge', 'humano', 'F', 'familia', 'idoso', []],
    ['Eustácio', 'Eustace Bagge', 'humano', 'M', 'familia', 'idoso', ['Eustace']],
    ['Computador', 'Computer', 'robo', 'M', 'aliado', 'adulto', []],
    ['Katz', 'Katz', 'animal', 'M', 'vilao', 'adulto', []],
    ['Le Quack', 'Le Quack', 'animal', 'M', 'vilao', 'adulto', []],
    ['Di Lung', 'Di Lung', 'humano', 'M', 'vilao', 'adulto', []],
    ['Shirley', 'Shirley', 'humano', 'F', 'aliado', 'idoso', ['Shirley, a Médium']],
    ['Dr. Vindaloo', 'Dr. Vindaloo', 'humano', 'M', 'aliado', 'adulto', ['Vindaloo']],
    ['Fred', 'Freaky Fred', 'humano', 'M', 'vilao', 'adulto', ['Freaky Fred', 'Fred, o Barbeiro']],
  ] },
  { show: 'Du, Dudu e Edu', year: 1999, group: 'cartoon', wiki: 'ed', chars: [
    ['Du', 'Ed', 'humano', 'M', 'protagonista', 'crianca', ['Ed']],
    ['Dudu', 'Edd', 'humano', 'M', 'protagonista', 'crianca', ['Edd', 'Double D']],
    ['Edu', 'Eddy', 'humano', 'M', 'protagonista', 'crianca', ['Eddy']],
    ['Jonny', 'Jonny', 'humano', 'M', 'aliado', 'crianca', ['Jonny 2x4']],
    ['Tábua', 'Plank', 'outro', 'M', 'aliado', 'crianca', ['Plank']],
    ['Nazz', 'Nazz', 'humano', 'F', 'aliado', 'crianca', []],
    ['Kevin', 'Kevin', 'humano', 'M', 'vilao', 'crianca', []],
    ['Rolf', 'Rolf', 'humano', 'M', 'aliado', 'crianca', []],
    ['Sarah', 'Sarah', 'humano', 'F', 'familia', 'crianca', []],
    ['Jimmy', 'Jimmy', 'humano', 'M', 'aliado', 'crianca', []],
    ['Lee Kanker', 'Lee', 'humano', 'F', 'vilao', 'crianca', ['Irmãs Kanker']],
    ['Marie Kanker', 'Marie Kanker', 'humano', 'F', 'vilao', 'crianca', []],
    ['May Kanker', 'May', 'humano', 'F', 'vilao', 'crianca', []],
    ['Irmão do Edu', "Eddy's Brother", 'humano', 'M', 'vilao', 'adolescente', ["Eddy's Brother", 'Irmão do Eddy']],
  ] },
  { show: 'Samurai Jack', year: 2001, group: 'cartoon', wiki: 'samuraijack', chars: [
    ['Samurai Jack', 'Jack', 'humano', 'M', 'protagonista', 'adulto', ['Jack']],
    ['Aku', 'Aku', 'monstro', 'M', 'vilao', 'adulto', []],
    ['O Escocês', 'The Scotsman', 'humano', 'M', 'aliado', 'adulto', ['Scotsman', 'Escocês']],
    ['Ashi', 'Ashi', 'humano', 'F', 'aliado', 'adulto', []],
  ] },
  { show: 'As Terríveis Aventuras de Billy e Mandy', curto: 'Billy e Mandy', year: 2001, group: 'cartoon', wiki: 'grimadventures', chars: [
    ['Billy', 'Billy', 'humano', 'M', 'protagonista', 'crianca', []],
    ['Mandy', 'Mandy', 'humano', 'F', 'protagonista', 'crianca', []],
    ['Puro Osso', 'Grim', 'magico', 'M', 'protagonista', 'idoso', ['Grim', 'Ceifador']],
    ['Irwin', 'Irwin', 'humano', 'M', 'aliado', 'crianca', []],
    ['Harold', 'Harold', 'humano', 'M', 'familia', 'adulto', ['Pai do Billy']],
    ['General Skarr', 'General Skarr', 'humano', 'M', 'vilao', 'adulto', []],
    ['Hoss Delgado', 'Hoss Delgado', 'humano', 'M', 'aliado', 'adulto', []],
    ['Nergal', 'Nergal', 'monstro', 'M', 'vilao', 'adulto', []],
    ['Nergal Jr.', 'Nergal Jr.', 'monstro', 'M', 'aliado', 'crianca', []],
    ['Mindy', 'Mindy', 'humano', 'F', 'vilao', 'crianca', []],
    ['Fred Fredburger', 'Fred Fredburger', 'monstro', 'M', 'aliado', 'adulto', []],
    ['Gladys', 'Gladys', 'humano', 'F', 'familia', 'adulto', ['Mãe do Billy']],
  ] },
  { show: 'A Turma do Bairro', year: 2002, group: 'cartoon', wiki: 'knd', chars: [
    ['Número 1', 'Numbuh 1', 'humano', 'M', 'protagonista', 'crianca', ['Numbuh 1', 'Nigel Uno']],
    ['Número 2', 'Numbuh 2', 'humano', 'M', 'protagonista', 'crianca', ['Numbuh 2', 'Hoagie']],
    ['Número 3', 'Numbuh 3', 'humano', 'F', 'protagonista', 'crianca', ['Numbuh 3', 'Kuki Sanban']],
    ['Número 4', 'Numbuh 4', 'humano', 'M', 'protagonista', 'crianca', ['Numbuh 4', 'Wally']],
    ['Número 5', 'Numbuh 5', 'humano', 'F', 'protagonista', 'crianca', ['Numbuh 5', 'Abigail Lincoln']],
    ['O Pai', 'Father', 'humano', 'M', 'vilao', 'adulto', ['Father', 'Pai']],
    ['Número 362', 'Numbuh 362', 'humano', 'F', 'aliado', 'crianca', ['Numbuh 362', 'Rachel McKenzie']],
    ['Número 86', 'Numbuh 86', 'humano', 'F', 'aliado', 'crianca', ['Numbuh 86', 'Fanny Fulbright']],
    ['Crianças Encantadoras', 'Delightful Children From Down The Lane', 'humano', 'O', 'vilao', 'crianca', ['Delightful Children']],
  ] },
  { show: 'A Mansão Foster para Amigos Imaginários', curto: 'Mansão Foster', year: 2004, group: 'cartoon', wiki: 'fostershomeforimaginaryfriends', chars: [
    ['Mac', 'Mac', 'humano', 'M', 'protagonista', 'crianca', []],
    ['Blu', 'Bloo', 'magico', 'M', 'protagonista', 'crianca', ['Bloo', 'Blooregard']],
    ['Wilt', 'Wilt', 'magico', 'M', 'aliado', 'adulto', []],
    ['Eduardo', 'Eduardo', 'magico', 'M', 'aliado', 'adulto', []],
    ['Coco', 'Coco', 'magico', 'F', 'aliado', 'adulto', []],
    ['Frankie', 'Frankie Foster', 'humano', 'F', 'aliado', 'adulto', ['Frankie Foster']],
    ['Sr. Herriman', 'Mr. Herriman', 'magico', 'M', 'aliado', 'idoso', ['Mr. Herriman', 'Senhor Herriman']],
    ['Madame Foster', 'Madame Foster', 'humano', 'F', 'aliado', 'idoso', []],
    ['Goo', 'Goo', 'humano', 'F', 'aliado', 'crianca', ['Goo Goo Ga Ga']],
    ['Queijo', 'Cheese', 'magico', 'M', 'aliado', 'crianca', ['Cheese']],
    ['Duquesa', 'Duchess', 'magico', 'F', 'vilao', 'adulto', ['Duchess']],
    ['Terrence', 'Terrence', 'humano', 'M', 'familia', 'adolescente', []],
  ] },
  { show: 'Hora de Aventura', year: 2010, group: 'cartoon', wiki: 'adventuretime', chars: [
    ['Finn', 'Finn', 'humano', 'M', 'protagonista', 'adolescente', ['Finn, o Humano', 'Finn Mertens']],
    ['Jake', 'Jake', 'animal', 'M', 'protagonista', 'adulto', ['Jake, o Cão']],
    ['Princesa Jujuba', 'Princess Bubblegum', 'outro', 'F', 'aliado', 'adulto', ['Princess Bubblegum', 'PB']],
    ['Marceline', 'Marceline', 'monstro', 'F', 'aliado', 'adulto', ['Rainha dos Vampiros']],
    ['Rei Gelado', 'Ice King', 'humano', 'M', 'vilao', 'idoso', ['Ice King', 'Simon Petrikov']],
    ['BMO', 'BMO', 'robo', 'O', 'aliado', 'crianca', ['Beemo']],
    ['Princesa Caroço', 'Lumpy Space Princess', 'alien', 'F', 'aliado', 'adolescente', ['Lumpy Space Princess', 'LSP']],
    ['Lady Iris', 'Lady Rainicorn', 'animal', 'F', 'aliado', 'adulto', ['Lady Rainicorn']],
    ['Lich', 'The Lich (character)', 'monstro', 'M', 'vilao', 'adulto', ['The Lich', 'O Lich']],
    ['Princesa de Fogo', 'Flame Princess', 'magico', 'F', 'aliado', 'adolescente', ['Flame Princess']],
    ['Tronquinha', 'Tree Trunks (character)', 'animal', 'F', 'aliado', 'idoso', ['Tree Trunks']],
    ['Conde de Limãograb', 'Lemongrab', 'outro', 'M', 'vilao', 'adulto', ['Lemongrab', 'Earl of Lemongrab']],
    ['Mordomo Menta', 'Peppermint Butler', 'outro', 'M', 'aliado', 'adulto', ['Peppermint Butler', 'Mentinha']],
    ['Gunter', 'Gunter', 'animal', 'M', 'aliado', 'adulto', []],
    ['Fionna', 'Fionna', 'humano', 'F', 'protagonista', 'adolescente', []],
    ['Cake', 'Cake', 'animal', 'F', 'aliado', 'adulto', []],
    ['Homem Mágico', 'Magic Man', 'magico', 'M', 'vilao', 'adulto', ['Magic Man']],
    ['Hunson Abadeer', 'Hunson Abadeer', 'monstro', 'M', 'familia', 'adulto', []],
    ['Susan Strong', 'Susan Strong (character)', 'humano', 'F', 'aliado', 'adulto', []],
    ['NEPTR', 'Neptr', 'robo', 'M', 'aliado', 'adulto', []],
  ] },
  { show: 'Apenas um Show', year: 2010, group: 'cartoon', wiki: 'regularshow', chars: [
    ['Mordecai', 'Mordecai', 'animal', 'M', 'protagonista', 'adulto', []],
    ['Rigby', 'Rigby', 'animal', 'M', 'protagonista', 'adulto', []],
    ['Benson', 'Benson', 'outro', 'M', 'aliado', 'adulto', []],
    ['Pops', 'Pops', 'outro', 'M', 'aliado', 'idoso', ['Pops Maellard']],
    ['Skips', 'Skips', 'monstro', 'M', 'aliado', 'adulto', []],
    ['Musculoso', 'Muscle Man', 'humano', 'M', 'aliado', 'adulto', ['Muscle Man']],
    ['Fantasminha', 'Hi-Five Ghost', 'magico', 'M', 'aliado', 'adulto', ['Hi-Five Ghost']],
    ['Margaret', 'Margaret', 'animal', 'F', 'aliado', 'adulto', []],
    ['Eileen', 'Eileen', 'animal', 'F', 'aliado', 'adulto', []],
    ['Thomas', 'Thomas', 'animal', 'M', 'aliado', 'adulto', []],
    ['CJ', 'CJ', 'outro', 'F', 'aliado', 'adulto', ['C.J.']],
    ['Morte', 'Death', 'magico', 'M', 'aliado', 'adulto', ['Death']],
    ['Don', 'Don', 'animal', 'M', 'familia', 'adulto', []],
    ['Gary', 'Gary', 'magico', 'M', 'aliado', 'adulto', []],
  ] },
  { show: 'O Incrível Mundo de Gumball', curto: 'Gumball', year: 2011, group: 'cartoon', wiki: 'theamazingworldofgumball', chars: [
    ['Gumball', 'Gumball Watterson', 'animal', 'M', 'protagonista', 'crianca', ['Gumball Watterson']],
    ['Darwin', 'Darwin Watterson', 'animal', 'M', 'protagonista', 'crianca', ['Darwin Watterson']],
    ['Anais', 'Anais Watterson', 'animal', 'F', 'familia', 'crianca', ['Anais Watterson']],
    ['Nicole', 'Nicole Watterson', 'animal', 'F', 'familia', 'adulto', ['Nicole Watterson']],
    ['Richard', 'Richard Watterson', 'animal', 'M', 'familia', 'adulto', ['Richard Watterson']],
    ['Penny', 'Penny Fitzgerald', 'outro', 'F', 'aliado', 'crianca', ['Penny Fitzgerald']],
    ['Tobias', 'Tobias Wilson', 'outro', 'M', 'aliado', 'crianca', ['Tobias Wilson']],
    ['Srta. Simian', 'Miss Simian', 'animal', 'F', 'vilao', 'idoso', ['Miss Simian']],
    ['Banana Joe', 'Banana Joe', 'outro', 'M', 'aliado', 'crianca', []],
    ['Carrie', 'Carrie Krueger', 'magico', 'F', 'aliado', 'crianca', ['Carrie Krueger']],
    ['Tina Rex', 'Tina Rex', 'animal', 'F', 'vilao', 'crianca', []],
    ['Alan', 'Alan Keane', 'outro', 'M', 'aliado', 'crianca', ['Alan Keane']],
    ['Larry', 'Larry Needlemeyer', 'outro', 'M', 'aliado', 'adulto', ['Larry Needlemeyer']],
    ['Diretor Brown', 'Nigel Brown', 'monstro', 'M', 'aliado', 'adulto', ['Principal Brown']],
    ['Bobert', 'Bobert', 'robo', 'M', 'aliado', 'crianca', []],
    ['Rob', 'Rob', 'outro', 'M', 'vilao', 'crianca', []],
  ] },
  { show: 'Steven Universo', year: 2013, group: 'cartoon', wiki: 'steven-universe', chars: [
    ['Steven', 'Steven Universe (character)', 'humano', 'M', 'protagonista', 'crianca', ['Steven Universo']],
    ['Garnet', 'Garnet', 'alien', 'F', 'aliado', 'adulto', []],
    ['Ametista', 'Amethyst', 'alien', 'F', 'aliado', 'adulto', ['Amethyst']],
    ['Pérola', 'Pearl', 'alien', 'F', 'aliado', 'adulto', ['Pearl']],
    ['Connie', 'Connie Maheswaran', 'humano', 'F', 'aliado', 'crianca', []],
    ['Greg', 'Greg Universe', 'humano', 'M', 'familia', 'adulto', ['Greg Universo']],
    ['Peridot', 'Peridot', 'alien', 'F', 'aliado', 'adulto', []],
    ['Lápis Lazúli', 'Lapis Lazuli', 'alien', 'F', 'aliado', 'adulto', ['Lapis Lazuli', 'Lapis']],
    ['Diamante Amarelo', 'Yellow Diamond', 'alien', 'F', 'vilao', 'adulto', ['Yellow Diamond']],
    ['Jasper', 'Jasper', 'alien', 'F', 'vilao', 'adulto', []],
    ['Rubi', 'Ruby', 'alien', 'F', 'aliado', 'adulto', ['Ruby']],
    ['Safira', 'Sapphire', 'alien', 'F', 'aliado', 'adulto', ['Sapphire']],
    ['Rose Quartz', 'Rose Quartz', 'alien', 'F', 'familia', 'adulto', ['Diamante Rosa', 'Pink Diamond', 'Rosa Quartzo']],
    ['Diamante Branco', 'White Diamond', 'alien', 'F', 'vilao', 'adulto', ['White Diamond']],
    ['Diamante Azul', 'Blue Diamond', 'alien', 'F', 'vilao', 'adulto', ['Blue Diamond']],
    ['Espinela', 'Spinel', 'alien', 'F', 'vilao', 'adulto', ['Spinel']],
    ['Bismuto', 'Bismuth (character)', 'alien', 'F', 'aliado', 'adulto', ['Bismuth']],
    ['Leão', 'Lion', 'animal', 'M', 'aliado', 'adulto', ['Lion']],
    ['Lars', 'Lars Barriga', 'humano', 'M', 'aliado', 'adolescente', ['Lars Barriga']],
    ['Sadie', 'Sadie Miller', 'humano', 'F', 'aliado', 'adolescente', ['Sadie Miller']],
    ['Stevonnie', 'Stevonnie', 'humano', 'O', 'aliado', 'adolescente', []],
    ['Cebola', 'Onion', 'humano', 'M', 'aliado', 'crianca', ['Onion']],
    ['Sugilita', 'Sugilite', 'alien', 'F', 'aliado', 'adulto', ['Sugilite']],
    ['Opala', 'Opal', 'alien', 'F', 'aliado', 'adulto', ['Opal']],
    ['Malaquita', 'Malachite', 'alien', 'F', 'vilao', 'adulto', ['Malachite']],
    ['Água-Marinha', 'Aquamarine', 'alien', 'F', 'vilao', 'adulto', ['Aquamarine']],
  ] },
  { show: 'Irmão do Jorel', year: 2014, group: 'cartoon', wiki: 'irmaodojorel/pt-br', chars: [
    ['Irmão do Jorel', 'Irmão do Jorel', 'humano', 'M', 'protagonista', 'crianca', []],
    ['Jorel', 'Jorel', 'humano', 'M', 'familia', 'adolescente', []],
    ['Nico', 'Nico', 'humano', 'M', 'familia', 'adolescente', []],
    ['Lara', 'Lara', 'humano', 'F', 'aliado', 'crianca', []],
    ['Dona Danuza', 'Dona Danuza', 'humano', 'F', 'familia', 'adulto', ['Danuza']],
    ['Seu Edson', 'Seu Edson', 'humano', 'M', 'familia', 'adulto', ['Edson']],
    ['Vovó Juju', 'Vovó Juju', 'humano', 'F', 'familia', 'idoso', []],
    ['Vovó Gigi', 'Vovó Gigi', 'humano', 'F', 'familia', 'idoso', []],
    ['Ana Catarina', 'Ana Catarina', 'humano', 'F', 'aliado', 'crianca', []],
    ['Gesonel', 'Gesonel', 'animal', 'M', 'aliado', 'adulto', []],
  ] },
  { show: 'Ursos sem Curso', year: 2015, group: 'cartoon', wiki: 'webarebears', chars: [
    ['Pardo', 'Grizzly', 'animal', 'M', 'protagonista', 'adulto', ['Grizzly', 'Grizz']],
    ['Panda', 'Panda', 'animal', 'M', 'protagonista', 'adulto', []],
    ['Polar', 'Ice Bear', 'animal', 'M', 'protagonista', 'adulto', ['Ice Bear', 'Urso Polar']],
    ['Chloe', 'Chloe Park', 'humano', 'F', 'aliado', 'crianca', ['Chloe Park']],
    ['Charlie', 'Charlie', 'monstro', 'M', 'aliado', 'adulto', ['Pé-Grande']],
    ['Nom Nom', 'Nom Nom', 'animal', 'M', 'vilao', 'adulto', []],
    ['Ranger Tabes', 'Ranger Tabes', 'humano', 'F', 'aliado', 'adulto', ['Tabes']],
  ] },
  { show: 'Clarêncio, o Otimista', curto: 'Clarêncio', year: 2014, group: 'cartoon', wiki: 'clarence', chars: [
    ['Clarêncio', 'Clarence Wendle', 'humano', 'M', 'protagonista', 'crianca', ['Clarence']],
    ['Jeff', 'Jeff Randell', 'humano', 'M', 'aliado', 'crianca', []],
    ['Sumo', 'Ryan Sumouski', 'humano', 'M', 'aliado', 'crianca', ['Ryan Sumouski']],
    ['Belson', 'Belson Noles', 'humano', 'M', 'vilao', 'crianca', []],
    ['Mary', 'Mary Wendle', 'humano', 'F', 'familia', 'adulto', ['Mary Wendle']],
    ['Chad', 'Chad', 'humano', 'M', 'familia', 'adulto', []],
    ['Chelsea', 'Chelsea Keezheekoni', 'humano', 'F', 'aliado', 'crianca', ['Chelsea Keezheekoni']],
  ] },

  // ---------------------------------------------------------- Nickelodeon
  { show: 'Rugrats', year: 1991, group: 'nick', wiki: 'rugrats', chars: [
    ['Tommy', 'Tommy Pickles', 'humano', 'M', 'protagonista', 'crianca', ['Tommy Pickles']],
    ['Chuckie', 'Chuckie Finster', 'humano', 'M', 'aliado', 'crianca', ['Chuckie Finster']],
    ['Phil', 'Phil DeVille', 'humano', 'M', 'aliado', 'crianca', ['Phil DeVille']],
    ['Lil', 'Lil DeVille', 'humano', 'F', 'aliado', 'crianca', ['Lil DeVille']],
    ['Angélica', 'Angelica Pickles', 'humano', 'F', 'vilao', 'crianca', ['Angelica Pickles', 'Angelica']],
    ['Susie', 'Susie Carmichael', 'humano', 'F', 'aliado', 'crianca', ['Susie Carmichael']],
    ['Dil', 'Dil Pickles', 'humano', 'M', 'familia', 'crianca', ['Dil Pickles']],
    ['Spike', 'Spike', 'animal', 'M', 'aliado', 'adulto', []],
    ['Stu', 'Stu Pickles', 'humano', 'M', 'familia', 'adulto', ['Stu Pickles']],
    ['Didi', 'Didi Pickles', 'humano', 'F', 'familia', 'adulto', ['Didi Pickles']],
    ['Kimi', 'Kimi Finster', 'humano', 'F', 'aliado', 'crianca', ['Kimi Finster']],
    ['Reptar', 'Reptar', 'monstro', 'M', 'aliado', 'adulto', []],
  ] },
  { show: 'A Vida Moderna de Rocko', curto: 'Rocko', year: 1993, group: 'nick', wiki: 'rockosmodernlife', chars: [
    ['Rocko', 'Rocko Rama', 'animal', 'M', 'protagonista', 'adulto', []],
    ['Heffer', 'Heffer Wolfe', 'animal', 'M', 'aliado', 'adulto', ['Heffer Wolfe']],
    ['Filburt', 'Filburt', 'animal', 'M', 'aliado', 'adulto', []],
    ['Spunky', 'Spunky', 'animal', 'M', 'aliado', 'adulto', []],
    ['Ed Cabeção', 'Ed Bighead', 'animal', 'M', 'vilao', 'adulto', ['Ed Bighead']],
    ['Bev Cabeção', 'Bev Bighead', 'animal', 'F', 'vilao', 'adulto', ['Bev Bighead']],
  ] },
  { show: 'Hey Arnold!', year: 1996, group: 'nick', wiki: 'heyarnold', chars: [
    ['Arnold', 'Arnold', 'humano', 'M', 'protagonista', 'crianca', []],
    ['Helga', 'Helga Pataki', 'humano', 'F', 'aliado', 'crianca', ['Helga Pataki']],
    ['Gerald', 'Gerald Johanssen', 'humano', 'M', 'aliado', 'crianca', []],
    ['Phoebe', 'Phoebe Heyerdahl', 'humano', 'F', 'aliado', 'crianca', []],
    ['Harold', 'Harold Berman', 'humano', 'M', 'aliado', 'crianca', ['Harold Berman']],
    ['Vovô Phil', 'Grandpa Phil', 'humano', 'M', 'familia', 'idoso', ['Grandpa Phil', 'Vovô']],
    ['Vovó Gertie', 'Grandma Gertie', 'humano', 'F', 'familia', 'idoso', ['Grandma Gertie', 'Vovó']],
    ['Stinky', 'Stinky Peterson', 'humano', 'M', 'aliado', 'crianca', []],
    ['Sid', 'Sid', 'humano', 'M', 'aliado', 'crianca', []],
    ['Rhonda', 'Rhonda Wellington Lloyd', 'humano', 'F', 'aliado', 'crianca', []],
    ['Eugene', 'Eugene Horowitz', 'humano', 'M', 'aliado', 'crianca', []],
    ['Lila', 'Lila Sawyer', 'humano', 'F', 'aliado', 'crianca', []],
    ['Bob Pataki', 'Big Bob Pataki', 'humano', 'M', 'familia', 'adulto', ['Big Bob']],
    ['Olga', 'Olga Pataki', 'humano', 'F', 'familia', 'adulto', []],
    ['Brainy', 'Brainy', 'humano', 'M', 'aliado', 'crianca', []],
  ] },
  { show: 'Os Thornberrys', curto: 'Thornberrys', year: 1998, group: 'nick', wiki: 'wildthornberrys', chars: [
    ['Eliza', 'Eliza Thornberry', 'humano', 'F', 'protagonista', 'crianca', ['Eliza Thornberry']],
    ['Darwin', 'Darwin', 'animal', 'M', 'aliado', 'adulto', []],
    ['Debbie', 'Debbie Thornberry', 'humano', 'F', 'familia', 'adolescente', ['Debbie Thornberry']],
    ['Donnie', 'Donnie Thornberry', 'humano', 'M', 'familia', 'crianca', ['Donnie Thornberry']],
    ['Nigel', 'Nigel Thornberry', 'humano', 'M', 'familia', 'adulto', ['Nigel Thornberry']],
    ['Marianne', 'Marianne Thornberry', 'humano', 'F', 'familia', 'adulto', ['Marianne Thornberry']],
  ] },
  { show: 'Bob Esponja', year: 1999, group: 'nick', wiki: 'spongebob', chars: [
    ['Bob Esponja', 'SpongeBob SquarePants (character)', 'animal', 'M', 'protagonista', 'adulto', ['SpongeBob', 'Bob Esponja Calça Quadrada']],
    ['Patrick', 'Patrick Star', 'animal', 'M', 'aliado', 'adulto', ['Patrick Estrela', 'Patrick Star']],
    ['Lula Molusco', 'Squidward Tentacles', 'animal', 'M', 'aliado', 'adulto', ['Squidward']],
    ['Seu Siriguejo', 'Eugene H. Krabs', 'animal', 'M', 'aliado', 'adulto', ['Sr. Siriguejo', 'Mr. Krabs', 'Siriguejo']],
    ['Sandy', 'Sandy Cheeks', 'animal', 'F', 'aliado', 'adulto', ['Sandy Bochechas', 'Sandy Cheeks']],
    ['Plankton', 'Sheldon J. Plankton', 'animal', 'M', 'vilao', 'adulto', []],
    ['Gary', 'Gary the Snail', 'animal', 'M', 'aliado', 'adulto', ['Gary, o Caracol']],
    ['Sra. Puff', 'Mrs. Puff', 'animal', 'F', 'aliado', 'adulto', ['Mrs. Puff', 'Dona Puff']],
    ['Pérola', 'Pearl Krabs', 'animal', 'F', 'familia', 'adolescente', ['Pearl Krabs', 'Pérola Siriguejo']],
    ['Karen', 'Karen Plankton', 'robo', 'F', 'vilao', 'adulto', []],
    ['Larry', 'Larry the Lobster', 'animal', 'M', 'aliado', 'adulto', ['Larry, a Lagosta', 'Larry the Lobster']],
    ['Homem Sereia', 'Mermaid Man', 'humano', 'M', 'aliado', 'idoso', ['Mermaid Man']],
    ['Mexilhãozinho', 'Barnacle Boy', 'humano', 'M', 'aliado', 'idoso', ['Barnacle Boy']],
    ['Holandês Voador', 'Flying Dutchman', 'magico', 'M', 'vilao', 'adulto', ['Flying Dutchman']],
    ['Rei Netuno', 'King Neptune', 'magico', 'M', 'aliado', 'adulto', ['King Neptune', 'Netuno']],
  ] },
  { show: 'Os Padrinhos Mágicos', curto: 'Padrinhos Mágicos', year: 2001, group: 'nick', wiki: 'fairlyoddparents', chars: [
    ['Timmy Turner', 'Timmy Turner', 'humano', 'M', 'protagonista', 'crianca', ['Timmy']],
    ['Cosmo', 'Cosmo', 'magico', 'M', 'aliado', 'adulto', []],
    ['Wanda', 'Wanda', 'magico', 'F', 'aliado', 'adulto', []],
    ['Vicky', 'Vicky', 'humano', 'F', 'vilao', 'adolescente', []],
    ['Sr. Crocker', 'Denzel Crocker', 'humano', 'M', 'vilao', 'adulto', ['Crocker', 'Denzel Crocker']],
    ['Poof', 'Poof', 'magico', 'M', 'aliado', 'crianca', []],
    ['Jorgen Von Strangle', 'Jorgen Von Strangle', 'magico', 'M', 'aliado', 'adulto', ['Jorgen']],
    ['Chester', 'Chester McBadbat', 'humano', 'M', 'aliado', 'crianca', []],
    ['AJ', 'A.J.', 'humano', 'M', 'aliado', 'crianca', ['A.J.']],
    ['Trixie Tang', 'Trixie Tang', 'humano', 'F', 'aliado', 'crianca', ['Trixie']],
    ['Anti-Cosmo', 'Anti-Cosmo', 'magico', 'M', 'vilao', 'adulto', []],
    ['Pai do Timmy', 'Mr. Turner', 'humano', 'M', 'familia', 'adulto', ['Mr. Turner']],
    ['Mãe do Timmy', 'Mrs. Turner', 'humano', 'F', 'familia', 'adulto', ['Mrs. Turner']],
    ['Francis', 'Francis', 'humano', 'M', 'vilao', 'crianca', []],
    ['Tootie', 'Tootie', 'humano', 'F', 'aliado', 'crianca', []],
    ['Sparky', 'Sparky', 'magico', 'M', 'aliado', 'adulto', []],
  ] },
  { show: 'Invasor Zim', year: 2001, group: 'nick', wiki: 'zim', chars: [
    ['Zim', 'Zim', 'alien', 'M', 'protagonista', 'adulto', ['Invasor Zim']],
    ['GIR', 'GIR', 'robo', 'M', 'aliado', 'crianca', []],
    ['Dib', 'Dib', 'humano', 'M', 'vilao', 'crianca', ['Dib Membrana']],
    ['Gaz', 'Gaz', 'humano', 'F', 'familia', 'crianca', []],
    ['Professor Membrana', 'Professor Membrane', 'humano', 'M', 'familia', 'adulto', ['Professor Membrane']],
    ['Mais Alto Vermelho', 'Almighty Tallest Red', 'alien', 'M', 'vilao', 'adulto', ['Tallest Red', 'Red']],
    ['Mais Alto Roxo', 'Almighty Tallest Purple', 'alien', 'M', 'vilao', 'adulto', ['Tallest Purple', 'Purple']],
    ['Srta. Bitters', 'Ms. Bitters', 'humano', 'F', 'vilao', 'idoso', ['Ms. Bitters']],
    ['Minimoose', 'Minimoose', 'robo', 'M', 'aliado', 'crianca', []],
  ] },
  { show: 'As Aventuras de Jimmy Neutron', curto: 'Jimmy Neutron', year: 2002, group: 'nick', wiki: 'jimmyneutron', chars: [
    ['Jimmy Neutron', 'Jimmy Neutron', 'humano', 'M', 'protagonista', 'crianca', ['Jimmy']],
    ['Carl', 'Carl Wheezer', 'humano', 'M', 'aliado', 'crianca', ['Carl Wheezer']],
    ['Sheen', 'Sheen Estevez', 'humano', 'M', 'aliado', 'crianca', ['Sheen Estevez']],
    ['Cindy', 'Cindy Vortex', 'humano', 'F', 'aliado', 'crianca', ['Cindy Vortex']],
    ['Libby', 'Libby Folfax', 'humano', 'F', 'aliado', 'crianca', ['Libby Folfax']],
    ['Goddard', 'Goddard', 'robo', 'M', 'aliado', 'adulto', []],
    ['Hugh Neutron', 'Hugh Neutron', 'humano', 'M', 'familia', 'adulto', ['Pai do Jimmy']],
    ['Judy Neutron', 'Judy Neutron', 'humano', 'F', 'familia', 'adulto', ['Mãe do Jimmy']],
    ['Nick Dean', 'Nick Dean', 'humano', 'M', 'aliado', 'crianca', ['Nick']],
    ['Rei Goobot', 'King Goobot', 'alien', 'M', 'vilao', 'adulto', ['King Goobot', 'Goobot']],
  ] },
  { show: 'Danny Phantom', year: 2004, group: 'nick', wiki: 'dannyphantom', chars: [
    ['Danny Phantom', 'Danny Fenton', 'magico', 'M', 'protagonista', 'adolescente', ['Danny Fenton', 'Danny']],
    ['Sam', 'Sam Manson', 'humano', 'F', 'aliado', 'adolescente', ['Sam Manson']],
    ['Tucker', 'Tucker Foley', 'humano', 'M', 'aliado', 'adolescente', ['Tucker Foley']],
    ['Jazz', 'Jazz Fenton', 'humano', 'F', 'familia', 'adolescente', ['Jazz Fenton']],
    ['Jack Fenton', 'Jack Fenton', 'humano', 'M', 'familia', 'adulto', []],
    ['Vlad Plasmius', 'Vlad Masters', 'magico', 'M', 'vilao', 'adulto', ['Vlad Masters', 'Plasmius']],
    ['Skulker', 'Skulker', 'magico', 'M', 'vilao', 'adulto', []],
    ['Maddie Fenton', 'Maddie Fenton', 'humano', 'F', 'familia', 'adulto', []],
    ['Dash Baxter', 'Dash Baxter', 'humano', 'M', 'vilao', 'adolescente', ['Dash']],
    ['Paulina', 'Paulina', 'humano', 'F', 'aliado', 'adolescente', []],
    ['Ember', 'Ember McLain', 'magico', 'F', 'vilao', 'adolescente', ['Ember McLain']],
    ['Desiree', 'Desiree', 'magico', 'F', 'vilao', 'adulto', []],
    ['Clockwork', 'Clockwork', 'magico', 'M', 'aliado', 'adulto', []],
    ['Fantasma da Caixa', 'Box Ghost', 'magico', 'M', 'vilao', 'adulto', ['Box Ghost']],
    ['Dan Phantom', 'Dan Phantom', 'magico', 'M', 'vilao', 'adulto', ['Dark Danny']],
  ] },
  { show: 'Avatar: A Lenda de Aang', curto: 'Avatar', year: 2005, group: 'nick', wiki: 'avatar', chars: [
    ['Aang', 'Aang', 'humano', 'M', 'protagonista', 'crianca', []],
    ['Katara', 'Katara', 'humano', 'F', 'aliado', 'adolescente', []],
    ['Sokka', 'Sokka', 'humano', 'M', 'aliado', 'adolescente', []],
    ['Toph', 'Toph Beifong', 'humano', 'F', 'aliado', 'crianca', ['Toph Beifong']],
    ['Zuko', 'Zuko', 'humano', 'M', 'aliado', 'adolescente', ['Príncipe Zuko']],
    ['Iroh', 'Iroh', 'humano', 'M', 'aliado', 'idoso', ['Tio Iroh']],
    ['Azula', 'Azula', 'humano', 'F', 'vilao', 'adolescente', []],
    ['Senhor do Fogo Ozai', 'Ozai', 'humano', 'M', 'vilao', 'adulto', ['Ozai']],
    ['Appa', 'Appa', 'animal', 'M', 'aliado', 'adulto', []],
    ['Momo', 'Momo', 'animal', 'M', 'aliado', 'adulto', []],
    ['Suki', 'Suki', 'humano', 'F', 'aliado', 'adolescente', []],
    ['Ty Lee', 'Ty Lee', 'humano', 'F', 'vilao', 'adolescente', []],
    ['Mai', 'Mai', 'humano', 'F', 'vilao', 'adolescente', []],
    ['Almirante Zhao', 'Zhao', 'humano', 'M', 'vilao', 'adulto', ['Zhao']],
    ['Jet', 'Jet', 'humano', 'M', 'vilao', 'adolescente', []],
    ['Rei Bumi', 'Bumi', 'humano', 'M', 'aliado', 'idoso', ['Bumi']],
    ['Avatar Roku', 'Roku', 'humano', 'M', 'aliado', 'idoso', ['Roku']],
  ] },
  { show: 'A Lenda de Korra', curto: 'Korra', year: 2012, group: 'nick', wiki: 'avatar', chars: [
    ['Korra', 'Korra', 'humano', 'F', 'protagonista', 'adolescente', ['Avatar Korra']],
    ['Mako', 'Mako', 'humano', 'M', 'aliado', 'adolescente', []],
    ['Bolin', 'Bolin', 'humano', 'M', 'aliado', 'adolescente', []],
    ['Asami', 'Asami Sato', 'humano', 'F', 'aliado', 'adolescente', ['Asami Sato']],
    ['Tenzin', 'Tenzin', 'humano', 'M', 'aliado', 'adulto', []],
    ['Amon', 'Amon', 'humano', 'M', 'vilao', 'adulto', []],
    ['Lin Beifong', 'Lin Beifong', 'humano', 'F', 'aliado', 'adulto', ['Lin']],
    ['Zaheer', 'Zaheer', 'humano', 'M', 'vilao', 'adulto', []],
    ['Kuvira', 'Kuvira', 'humano', 'F', 'vilao', 'adulto', []],
    ['Naga', 'Naga', 'animal', 'F', 'aliado', 'adulto', []],
    ['Unalaq', 'Unalaq', 'humano', 'M', 'vilao', 'adulto', []],
  ] },
  { show: 'As Tartarugas Ninja', curto: 'Tartarugas Ninja', year: 2012, group: 'nick', wiki: 'turtlepedia', chars: [
    ['Leonardo', 'Leonardo (2012 TV series)', 'animal', 'M', 'protagonista', 'adolescente', ['Leo']],
    ['Raphael', 'Raphael (2012 TV series)', 'animal', 'M', 'protagonista', 'adolescente', ['Rafael', 'Raph']],
    ['Donatello', 'Donatello (2012 TV series)', 'animal', 'M', 'protagonista', 'adolescente', ['Donnie']],
    ['Michelangelo', 'Michelangelo (2012 TV series)', 'animal', 'M', 'protagonista', 'adolescente', ['Mikey']],
    ['Mestre Splinter', 'Splinter (2012 TV series)', 'animal', 'M', 'familia', 'idoso', ['Splinter']],
    ['Destruidor', 'Shredder (2012 TV series)', 'humano', 'M', 'vilao', 'adulto', ['Shredder']],
    ["April O'Neil", "April O'Neil (2012 TV series)", 'humano', 'F', 'aliado', 'adolescente', ['April']],
    ['Casey Jones', 'Casey Jones (2012 TV series)', 'humano', 'M', 'aliado', 'adolescente', ['Casey']],
    ['Karai', 'Karai (2012 TV series)', 'humano', 'F', 'vilao', 'adolescente', []],
    ['Baxter Stockman', 'Baxter Stockman (2012 TV series)', 'humano', 'M', 'vilao', 'adulto', []],
    ['Leatherhead', 'Leatherhead (2012 TV series)', 'animal', 'M', 'aliado', 'adulto', []],
  ] },
  { show: 'The Loud House', year: 2016, group: 'nick', wiki: 'theloudhouse', chars: [
    ['Lincoln Loud', 'Lincoln Loud', 'humano', 'M', 'protagonista', 'crianca', ['Lincoln']],
    ['Lori Loud', 'Lori Loud', 'humano', 'F', 'familia', 'adolescente', ['Lori']],
    ['Luan Loud', 'Luan Loud', 'humano', 'F', 'familia', 'adolescente', ['Luan']],
    ['Lucy Loud', 'Lucy Loud', 'humano', 'F', 'familia', 'crianca', ['Lucy']],
    ['Lisa Loud', 'Lisa Loud', 'humano', 'F', 'familia', 'crianca', ['Lisa']],
    ['Clyde', 'Clyde McBride', 'humano', 'M', 'aliado', 'crianca', ['Clyde McBride']],
    ['Leni Loud', 'Leni Loud', 'humano', 'F', 'familia', 'adolescente', ['Leni']],
    ['Luna Loud', 'Luna Loud', 'humano', 'F', 'familia', 'adolescente', ['Luna']],
    ['Lynn Loud', 'Lynn Loud', 'humano', 'F', 'familia', 'crianca', ['Lynn']],
    ['Lana Loud', 'Lana Loud', 'humano', 'F', 'familia', 'crianca', ['Lana']],
    ['Lola Loud', 'Lola Loud', 'humano', 'F', 'familia', 'crianca', ['Lola']],
    ['Lily Loud', 'Lily Loud', 'humano', 'F', 'familia', 'crianca', ['Lily']],
    ['Ronnie Anne', 'Ronnie Anne Santiago', 'humano', 'F', 'aliado', 'crianca', ['Ronnie Anne Santiago']],
  ] },

  // ---------------------------------------------------------- Disney
  { show: 'Hora do Recreio', year: 1997, group: 'disney', wiki: 'recess', chars: [
    ['T.J.', 'T.J. Detweiler', 'humano', 'M', 'protagonista', 'crianca', ['TJ', 'T.J. Detweiler']],
    ['Spinelli', 'Ashley Spinelli', 'humano', 'F', 'aliado', 'crianca', ['Ashley Spinelli']],
    ['Vince', 'Vince LaSalle', 'humano', 'M', 'aliado', 'crianca', ['Vince LaSalle']],
    ['Gretchen', 'Gretchen Grundler', 'humano', 'F', 'aliado', 'crianca', ['Gretchen Grundler']],
    ['Mikey', 'Mikey Blumberg', 'humano', 'M', 'aliado', 'crianca', ['Mikey Blumberg']],
    ['Gus', 'Gus Griswald', 'humano', 'M', 'aliado', 'crianca', ['Gus Griswald']],
    ['Diretor Prickly', 'Peter Prickly', 'humano', 'M', 'vilao', 'adulto', ['Prickly']],
    ['Dona Finster', 'Muriel Finster', 'humano', 'F', 'vilao', 'idoso', ['Finster', 'Muriel Finster']],
    ['Rei Bob', 'King Bob', 'humano', 'M', 'aliado', 'crianca', ['King Bob']],
    ['Randall', 'Randall Weems', 'humano', 'M', 'vilao', 'crianca', ['Randall Weems']],
    ['Menlo', 'Menlo', 'humano', 'M', 'aliado', 'crianca', []],
  ] },
  { show: 'Kim Possible', year: 2002, group: 'disney', wiki: 'kimpossible', chars: [
    ['Kim Possible', 'Kim Possible', 'humano', 'F', 'protagonista', 'adolescente', ['Kim']],
    ['Ron Stoppable', 'Ron Stoppable', 'humano', 'M', 'aliado', 'adolescente', ['Ron']],
    ['Rufus', 'Rufus', 'animal', 'M', 'aliado', 'adulto', []],
    ['Wade', 'Wade', 'humano', 'M', 'aliado', 'crianca', []],
    ['Dr. Drakken', 'Drakken', 'humano', 'M', 'vilao', 'adulto', ['Drakken']],
    ['Shego', 'Shego', 'humano', 'F', 'vilao', 'adulto', []],
    ['Monique', 'Monique', 'humano', 'F', 'aliado', 'adolescente', []],
    ['Bonnie', 'Bonnie Rockwaller', 'humano', 'F', 'vilao', 'adolescente', ['Bonnie Rockwaller']],
    ['Monkey Fist', 'Monkey Fist', 'humano', 'M', 'vilao', 'adulto', []],
    ['Duff Killigan', 'Duff Killigan', 'humano', 'M', 'vilao', 'adulto', []],
  ] },
  { show: 'Phineas e Ferb', year: 2007, group: 'disney', wiki: 'phineasandferb', chars: [
    ['Phineas', 'Phineas Flynn', 'humano', 'M', 'protagonista', 'crianca', ['Phineas Flynn']],
    ['Ferb', 'Ferb Fletcher', 'humano', 'M', 'protagonista', 'crianca', ['Ferb Fletcher']],
    ['Candace', 'Candace Flynn', 'humano', 'F', 'familia', 'adolescente', ['Candace Flynn']],
    ['Perry', 'Perry the Platypus', 'animal', 'M', 'aliado', 'adulto', ['Agente P', 'Perry, o Ornitorrinco']],
    ['Dr. Doofenshmirtz', 'Heinz Doofenshmirtz', 'humano', 'M', 'vilao', 'adulto', ['Doofenshmirtz', 'Heinz Doofenshmirtz']],
    ['Isabella', 'Isabella Garcia-Shapiro', 'humano', 'F', 'aliado', 'crianca', []],
    ['Buford', 'Buford Van Stomm', 'humano', 'M', 'aliado', 'crianca', []],
    ['Baljeet', 'Baljeet Tjinder', 'humano', 'M', 'aliado', 'crianca', []],
    ['Major Monograma', 'Francis Monogram', 'humano', 'M', 'aliado', 'adulto', ['Major Monogram']],
    ['Jeremy', 'Jeremy Johnson', 'humano', 'M', 'aliado', 'adolescente', ['Jeremy Johnson']],
    ['Stacy', 'Stacy Hirano', 'humano', 'F', 'aliado', 'adolescente', ['Stacy Hirano']],
    ['Vanessa', 'Vanessa Doofenshmirtz', 'humano', 'F', 'familia', 'adolescente', ['Vanessa Doofenshmirtz']],
    ['Linda', 'Linda Flynn-Fletcher', 'humano', 'F', 'familia', 'adulto', ['Linda Flynn']],
    ['Norm', 'Norm', 'robo', 'M', 'aliado', 'adulto', []],
  ] },
  { show: 'Gravity Falls', year: 2012, group: 'disney', wiki: 'gravityfalls', chars: [
    ['Dipper', 'Dipper Pines', 'humano', 'M', 'protagonista', 'crianca', ['Dipper Pines']],
    ['Mabel', 'Mabel Pines', 'humano', 'F', 'protagonista', 'crianca', ['Mabel Pines']],
    ['Tio Stan', 'Stan Pines', 'humano', 'M', 'familia', 'idoso', ['Grunkle Stan', 'Stan Pines', 'Tio-Vô Stan']],
    ['Soos', 'Soos Ramirez', 'humano', 'M', 'aliado', 'adulto', []],
    ['Wendy', 'Wendy Corduroy', 'humano', 'F', 'aliado', 'adolescente', ['Wendy Corduroy']],
    ['Bill Cipher', 'Bill Cipher', 'magico', 'M', 'vilao', 'adulto', ['Bill']],
    ['Tio Ford', 'Ford Pines', 'humano', 'M', 'familia', 'idoso', ['Ford', 'Stanford Pines']],
    ['Gideon', 'Gideon Gleeful', 'humano', 'M', 'vilao', 'crianca', ['Gideon Gleeful', 'Lil Gideon']],
    ['Pacifica', 'Pacifica Northwest', 'humano', 'F', 'vilao', 'crianca', ['Pacifica Northwest']],
    ['Robbie', 'Robbie Valentino', 'humano', 'M', 'vilao', 'adolescente', ['Robbie Valentino']],
    ['Candy', 'Candy Chiu', 'humano', 'F', 'aliado', 'crianca', ['Candy Chiu']],
    ['Grenda', 'Grenda', 'humano', 'F', 'aliado', 'crianca', []],
    ['Velho McGucket', 'Old Man McGucket', 'humano', 'M', 'aliado', 'idoso', ['Old Man McGucket', 'McGucket']],
    ['Waddles', 'Waddles', 'animal', 'M', 'aliado', 'crianca', ['Porquinho']],
  ] },
  { show: 'Star vs. as Forças do Mal', curto: 'Star vs.', year: 2015, group: 'disney', wiki: 'starvstheforcesofevil', chars: [
    ['Star Butterfly', 'Star Butterfly', 'magico', 'F', 'protagonista', 'adolescente', ['Star']],
    ['Marco Diaz', 'Marco Diaz', 'humano', 'M', 'protagonista', 'adolescente', ['Marco']],
    ['Ludo', 'Ludo Avarius', 'monstro', 'M', 'vilao', 'adulto', []],
    ['Toffee', 'Toffee', 'monstro', 'M', 'vilao', 'adulto', []],
    ['Tom Lucitor', 'Tom Lucitor', 'monstro', 'M', 'aliado', 'adolescente', ['Tom']],
    ['Rainha Moon', 'Moon Butterfly', 'magico', 'F', 'familia', 'adulto', ['Moon Butterfly']],
    ['Glossaryck', 'Glossaryck', 'magico', 'M', 'aliado', 'idoso', []],
    ['Eclipsa', 'Eclipsa Butterfly', 'magico', 'F', 'aliado', 'adulto', []],
    ['Janna', 'Janna Ordonia', 'humano', 'F', 'aliado', 'adolescente', []],
    ['Pônei Cabeça', 'Pony Head', 'magico', 'F', 'aliado', 'adolescente', ['Pony Head', 'Princesa Pônei Cabeça']],
    ['Rei River', 'River Butterfly', 'magico', 'M', 'familia', 'adulto', ['River Butterfly']],
    ['Meteora', 'Meteora Butterfly', 'monstro', 'F', 'vilao', 'adulto', []],
  ] },
  { show: 'A Casa da Coruja', year: 2020, group: 'disney', wiki: 'theowlhouse', chars: [
    ['Luz', 'Luz Noceda', 'humano', 'F', 'protagonista', 'adolescente', ['Luz Noceda']],
    ['Eda', 'Eda Clawthorne', 'magico', 'F', 'aliado', 'adulto', ['Eda Clawthorne', 'Dama Coruja']],
    ['King', 'King', 'monstro', 'M', 'aliado', 'crianca', ['Rei']],
    ['Amity', 'Amity Blight', 'magico', 'F', 'aliado', 'adolescente', ['Amity Blight']],
    ['Willow', 'Willow Park', 'magico', 'F', 'aliado', 'adolescente', ['Willow Park']],
    ['Gus', 'Gus Porter', 'magico', 'M', 'aliado', 'adolescente', ['Gus Porter']],
    ['Imperador Belos', 'Belos', 'humano', 'M', 'vilao', 'idoso', ['Belos', 'Philip Wittebane']],
    ['Hooty', 'Hooty', 'monstro', 'M', 'aliado', 'adulto', []],
    ['Hunter', 'Hunter', 'magico', 'M', 'aliado', 'adolescente', ['Golden Guard']],
    ['Lilith', 'Lilith Clawthorne', 'magico', 'F', 'familia', 'adulto', ['Lilith Clawthorne']],
    ['Raine', 'Raine Whispers', 'magico', 'O', 'aliado', 'adulto', ['Raine Whispers']],
    ['O Colecionador', 'The Collector', 'magico', 'O', 'vilao', 'crianca', ['Collector']],
  ] },
  { show: 'Anfíbia', year: 2019, group: 'disney', wiki: 'amphibia', chars: [
    ['Anne', 'Anne Boonchuy', 'humano', 'F', 'protagonista', 'adolescente', ['Anne Boonchuy']],
    ['Sprig', 'Sprig Plantar', 'animal', 'M', 'aliado', 'crianca', ['Sprig Plantar']],
    ['Polly', 'Polly Plantar', 'animal', 'F', 'familia', 'crianca', ['Polly Plantar']],
    ['Hop Pop', 'Hop Pop', 'animal', 'M', 'familia', 'idoso', ['Vovô Hop']],
    ['Marcy', 'Marcy Wu', 'humano', 'F', 'aliado', 'adolescente', ['Marcy Wu']],
    ['Sasha', 'Sasha Waybright', 'humano', 'F', 'aliado', 'adolescente', ['Sasha Waybright']],
    ['Rei Andrias', 'Andrias Leviathan', 'animal', 'M', 'vilao', 'adulto', ['Andrias', 'King Andrias']],
    ['Capitã Grime', 'Grime', 'animal', 'F', 'vilao', 'adulto', ['Grime']],
    ['Frobo', 'Frobo', 'robo', 'M', 'aliado', 'crianca', []],
  ] },

  // ---------------------------------------------------------- Fox Kids, Jetix e TV aberta
  { show: 'Tiny Toons', year: 1990, group: 'outros', wiki: 'tinytoons', chars: [
    ['Buster Bunny', 'Buster Bunny', 'animal', 'M', 'protagonista', 'adolescente', ['Buster']],
    ['Babs Bunny', 'Babs Bunny', 'animal', 'F', 'protagonista', 'adolescente', ['Babs']],
    ['Plucky', 'Plucky Duck', 'animal', 'M', 'aliado', 'adolescente', ['Plucky Duck']],
    ['Hamton', 'Hamton J. Pig', 'animal', 'M', 'aliado', 'adolescente', ['Hamton J. Pig']],
    ['Elmyra', 'Elmyra Duff', 'humano', 'F', 'vilao', 'crianca', ['Elmyra Duff']],
    ['Montana Max', 'Montana Max', 'humano', 'M', 'vilao', 'crianca', ['Monty']],
    ['Dizzy Devil', 'Dizzy Devil', 'animal', 'M', 'aliado', 'adolescente', []],
    ['Fifi La Fume', 'Fifi La Fume', 'animal', 'F', 'aliado', 'adolescente', []],
    ['Gogo Dodo', 'Gogo Dodo', 'animal', 'M', 'aliado', 'adolescente', []],
    ['Furrball', 'Furrball', 'animal', 'M', 'aliado', 'adolescente', []],
    ['Shirley', 'Shirley the Loon', 'animal', 'F', 'aliado', 'adolescente', ['Shirley the Loon']],
  ] },
  { show: 'Animaniacs', year: 1993, group: 'outros', wiki: 'animaniacs', chars: [
    ['Yakko', 'Yakko Warner', 'outro', 'M', 'protagonista', 'adolescente', ['Yakko Warner']],
    ['Wakko', 'Wakko Warner', 'outro', 'M', 'protagonista', 'crianca', ['Wakko Warner']],
    ['Dot', 'Dot Warner', 'outro', 'F', 'protagonista', 'crianca', ['Dot Warner']],
    ['Dr. Scratchansniff', 'Dr. Scratchansniff', 'humano', 'M', 'aliado', 'adulto', ['Scratchansniff']],
    ['Slappy', 'Slappy Squirrel', 'animal', 'F', 'protagonista', 'idoso', ['Slappy Squirrel']],
    ['Rita', 'Rita', 'animal', 'F', 'protagonista', 'adulto', []],
    ['Runt', 'Runt', 'animal', 'M', 'protagonista', 'adulto', []],
    ['Hello Nurse', 'Hello Nurse', 'humano', 'F', 'aliado', 'adulto', ['Enfermeira']],
  ] },
  { show: 'Pinky e o Cérebro', year: 1995, group: 'outros', wiki: 'pinkyandthebrain', chars: [
    ['Pinky', 'Pinky', 'animal', 'M', 'protagonista', 'adulto', []],
    ['Cérebro', 'The Brain', 'animal', 'M', 'protagonista', 'adulto', ['Brain', 'O Cérebro']],
  ] },
  { show: 'As Aventuras de Jackie Chan', curto: 'Jackie Chan', year: 2000, group: 'outros', wiki: 'jackiechanadventures', chars: [
    ['Jackie Chan', 'Jackie Chan', 'humano', 'M', 'protagonista', 'adulto', ['Jackie']],
    ['Jade', 'Jade Chan', 'humano', 'F', 'familia', 'crianca', ['Jade Chan']],
    ['Tio', 'Uncle', 'humano', 'M', 'familia', 'idoso', ['Uncle', 'Tio Chan']],
    ['Tohru', 'Tohru', 'humano', 'M', 'aliado', 'adulto', []],
    ['Valmont', 'Valmont', 'humano', 'M', 'vilao', 'adulto', []],
    ['Shendu', 'Shendu', 'monstro', 'M', 'vilao', 'adulto', []],
    ['Capitão Black', 'Captain Black', 'humano', 'M', 'aliado', 'adulto', ['Captain Black']],
    ['Viper', 'Viper', 'humano', 'F', 'aliado', 'adulto', []],
    ['El Toro Fuerte', 'El Toro Fuerte', 'humano', 'M', 'aliado', 'adulto', ['El Toro']],
    ['Daolon Wong', 'Daolon Wong', 'humano', 'M', 'vilao', 'idoso', []],
  ] },
  { show: 'Três Espiãs Demais', year: 2001, group: 'outros', wiki: 'totallyspies', chars: [
    ['Sam', 'Sam', 'humano', 'F', 'protagonista', 'adolescente', ['Samantha']],
    ['Clover', 'Clover', 'humano', 'F', 'protagonista', 'adolescente', []],
    ['Alex', 'Alex', 'humano', 'F', 'protagonista', 'adolescente', []],
    ['Jerry', 'Jerry Lewis', 'humano', 'M', 'aliado', 'adulto', []],
    ['Mandy', 'Mandy', 'humano', 'F', 'vilao', 'adolescente', []],
  ] },
  { show: 'Código Lyoko', year: 2003, group: 'outros', wiki: 'codelyoko', chars: [
    ['Jérémie', 'Jérémie Belpois', 'humano', 'M', 'protagonista', 'adolescente', ['Jeremie', 'Jérémie Belpois']],
    ['Aelita', 'Aelita Schaeffer', 'humano', 'F', 'protagonista', 'adolescente', ['Aelita Schaeffer']],
    ['Ulrich', 'Ulrich Stern', 'humano', 'M', 'protagonista', 'adolescente', ['Ulrich Stern']],
    ['Yumi', 'Yumi Ishiyama', 'humano', 'F', 'protagonista', 'adolescente', ['Yumi Ishiyama']],
    ['Odd', 'Odd Della Robbia', 'humano', 'M', 'protagonista', 'adolescente', ['Odd Della Robbia']],
    ['X.A.N.A.', 'X.A.N.A.', 'robo', 'O', 'vilao', 'adulto', ['XANA']],
    ['William', 'William Dunbar', 'humano', 'M', 'aliado', 'adolescente', ['William Dunbar']],
    ['Franz Hopper', 'Franz Hopper', 'humano', 'M', 'familia', 'adulto', []],
    ['Sissi', 'Elisabeth Delmas', 'humano', 'F', 'vilao', 'adolescente', ['Elisabeth Delmas']],
  ] },
];

// ------------------------------------------------------------- o Fandom

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const hash = (texto) => createHash('sha1').update(texto).digest('hex');

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

const apiDe = (wiki) => {
  const [sub, lingua] = wiki.split('/');
  return `https://${sub}.fandom.com/${lingua ? `${lingua}/` : ''}api.php`;
};

/**
 * A imagem principal de cada artigo de um wiki, seguindo redirecionamento. E
 * a `pageimage` do Fandom — quase sempre o recorte do personagem que abre a
 * ficha. Vem em dois tamanhos: o pequeno e a miniatura da busca, o grande e o
 * da tela de resultado.
 */
async function artigos(wiki, titulos, tamanho) {
  const saida = {};
  for (let i = 0; i < titulos.length; i += 50) {
    const lote = titulos.slice(i, i + 50);
    const json = await cached(`${wiki.replace('/', '-')}-${tamanho}-${hash(lote.join('|')).slice(0, 12)}`, () =>
      pega(`${apiDe(wiki)}?${new URLSearchParams({
        action: 'query', format: 'json', formatversion: '2', redirects: '1',
        prop: 'pageimages', piprop: 'thumbnail', pithumbsize: String(tamanho),
        titles: lote.join('|'),
      })}`));
    const destino = new Map(lote.map(t => [t, t]));
    for (const passo of [...(json.query?.normalized ?? []), ...(json.query?.redirects ?? [])]) {
      for (const [pedido, atual] of destino) if (atual === passo.from) destino.set(pedido, passo.to);
    }
    const paginas = new Map((json.query?.pages ?? []).map(p => [p.title, p]));
    for (const t of lote) {
      const p = paginas.get(destino.get(t));
      saida[t] = p && !p.missing ? { titulo: p.title, imagem: p.thumbnail?.source ?? null } : null;
    }
  }
  return saida;
}

/**
 * A imagem trocada a mao, por wiki e artigo: o arquivo do proprio wiki que
 * fica no lugar da `pageimage`. Sao os casos em que o topo da ficha e cena,
 * colagem ou os creditos do episodio — o Codigo Lyoko abre cada ficha com um
 * mosaico de seis quadros, e o Numero 4 com a tela de creditos.
 */
const IMAGEM = {
  'dexterslab:Monkey': 'Monkey.png',
  'knd:Numbuh 4': 'Numbuh 4.png',
  'knd:Father': 'Father.png',
  'adventuretime:Ice King': 'Original Ice King.png',
  'samuraijack:Ashi': 'Ashi.png',
  'ed:Rolf': 'Rolf.png',
  'ed:Eddy': 'Eddy.jpg',
  'codelyoko:Aelita Schaeffer': 'Aelita.jpg',
  'codelyoko:Ulrich Stern': 'Ulrich.png',
  'codelyoko:Yumi Ishiyama': 'Yumi.PNG',
  'codelyoko:Odd Della Robbia': 'Odd.png',
  'codelyoko:Jérémie Belpois': "Jeremie's face.png",
  'codelyoko:X.A.N.A.': 'Xana.jpg',
  'pinkyandthebrain:Pinky': 'Pinky.jpg',
  'pinkyandthebrain:The Brain': 'The brain.jpg',
  'grimadventures:Nergal': 'Nergal.png',
  'regularshow:Don': 'Don.png',
  'codelyoko:William Dunbar': 'William.png',
};

/** A miniatura de um arquivo do wiki, no tamanho pedido. */
async function arquivo(wiki, nome, tamanho) {
  const json = await cached(`${wiki.replace('/', '-')}-arquivo-${tamanho}-${hash(nome).slice(0, 12)}`, () =>
    pega(`${apiDe(wiki)}?${new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo',
      iiprop: 'url', iiurlwidth: String(tamanho), titles: `File:${nome}`,
    })}`));
  return json.query?.pages?.[0]?.imageinfo?.[0]?.thumburl ?? null;
}

// ------------------------------------------------------------- montagem

/**
 * As epocas sao as decadas de estreia do desenho: o indice vai no `era` de
 * cada personagem, e a sala liga quantas quiser.
 */
const decada = (ano) => (ano < 2000 ? 0 : ano < 2010 ? 1 : 2);

/**
 * Nome repetido entre desenhos ganha o desenho entre parenteses — nos dois,
 * para nenhum parecer o "de verdade". A tabela fica com o nome da dublagem, e
 * o desempate sai daqui.
 */
const vezes = new Map();
for (const d of DESENHOS) for (const [name] of d.chars) vezes.set(name, (vezes.get(name) ?? 0) + 1);
const nomeDe = (name, d) => (vezes.get(name) > 1 ? `${name} (${d.curto ?? d.show})` : name);

const erros = [];
const nomes = new Set();
for (const d of DESENHOS) {
  for (const [bruto, , especie, genero, papel, idade] of d.chars) {
    const name = nomeDe(bruto, d);
    if (nomes.has(name)) erros.push(`${name}: nome repetido no mesmo desenho`);
    nomes.add(name);
    if (!ESPECIES.has(especie)) erros.push(`${name}: especie ${especie}`);
    if (!['M', 'F', 'O'].includes(genero)) erros.push(`${name}: genero ${genero}`);
    if (!PAPEIS.has(papel)) erros.push(`${name}: papel ${papel}`);
    if (!IDADES.has(idade)) erros.push(`${name}: idade ${idade}`);
  }
}
if (erros.length) throw new Error(`tabela torta:\n  ${erros.join('\n  ')}`);

const porWiki = new Map();
for (const d of DESENHOS) {
  const lista = porWiki.get(d.wiki) ?? [];
  lista.push(...d.chars.map(c => c[1]));
  porWiki.set(d.wiki, lista);
}
const pequenas = new Map();
const grandes = new Map();
for (const [wiki, titulos] of porWiki) {
  pequenas.set(wiki, await artigos(wiki, titulos, 250));
  grandes.set(wiki, await artigos(wiki, titulos, 500));
}
for (const [chave, nome] of Object.entries(IMAGEM)) {
  const [wiki, titulo] = [chave.slice(0, chave.indexOf(':')), chave.slice(chave.indexOf(':') + 1)];
  const artigo = pequenas.get(wiki)?.[titulo];
  if (!artigo) throw new Error(`IMAGEM: ${chave} nao esta na tabela`);
  const pequena = await arquivo(wiki, nome, 250);
  if (!pequena) throw new Error(`IMAGEM: ${nome} nao existe em ${wiki}`);
  artigo.imagem = pequena;
  grandes.get(wiki)[titulo].imagem = await arquivo(wiki, nome, 500);
}

const GENERO = { M: 'Masculino', F: 'Feminino', O: 'Outro' };
const saida = [];
const semImagem = [];
const ids = new Map();

for (const d of DESENHOS) {
  for (const [bruto, titulo, species, gender, role, age, aliases] of d.chars) {
    const name = nomeDe(bruto, d);
    const artigo = pequenas.get(d.wiki)[titulo];
    if (!artigo) {
      erros.push(`${name}: "${titulo}" nao existe em ${d.wiki}`);
      continue;
    }
    const id = parseInt(hash(`${d.wiki}:${artigo.titulo}`).slice(0, 8), 16);
    if (ids.has(id)) {
      erros.push(`${name}: mesmo artigo que ${ids.get(id)} (${artigo.titulo})`);
      continue;
    }
    ids.set(id, name);
    if (!artigo.imagem) semImagem.push(name);

    saida.push({
      id,
      name,
      group: d.group,
      era: decada(d.year),
      show: d.show,
      species,
      gender: GENERO[gender],
      role,
      age,
      debutYear: d.year,
      sprite: artigo.imagem,
      artwork: grandes.get(d.wiki)[titulo]?.imagem ?? artigo.imagem,
      ...(aliases.length ? { aliases } : {}),
      eligible: true,
    });
  }
}

if (erros.length) throw new Error(`os wikis nao fecharam com a tabela:\n  ${erros.join('\n  ')}`);

await fs.writeFile(OUT, JSON.stringify(saida));

const porGrupo = {};
for (const d of saida) porGrupo[d.group] = (porGrupo[d.group] ?? 0) + 1;
console.log(`${saida.length} personagens de ${DESENHOS.length} desenhos em ${OUT}`);
for (const [grupo, n] of Object.entries(porGrupo)) console.log(`  ${grupo}: ${n}`);
if (semImagem.length) console.log(`\nsem imagem (${semImagem.length}): ${semImagem.join(', ')}`);
