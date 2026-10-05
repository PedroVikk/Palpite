/**
 * As palavras de cada universo que podem ser o segredo do Termo, alem dos
 * nomes: KUNAI e KONOHA no Naruto, POKEBOLA no Pokemon. Cada uma vem com a
 * categoria, que aparece no tabuleiro como dica ("Categoria: Arma").
 *
 * Escritas do jeito que se leem, com acento e espaco: o tabuleiro tira o
 * acento e desenha o vao (ver shared/termo.js). Palavra com menos de 4 ou mais
 * de 12 letras fica de fora sozinha, entao da para escrever sem contar.
 *
 * Formato: { universo: { Categoria: 'Palavra, Palavra, ...' } }.
 */
export const THEME_WORDS = {
  pokemon: {
    Tipo: 'Fogo, Água, Planta, Elétrico, Psíquico, Fantasma, Dragão, Sombrio, Fada, Lutador, Veneno, Terra, Voador, Inseto, Pedra, Gelo, Normal, Metal',
    Região: 'Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar, Paldea',
    Termo: 'Pokébola, Pokédex, Ginásio, Insígnia, Treinador, Evolução, Lendário, Shiny, Batalha, Liga Pokémon, Centro Pokémon, Mestre',
    Item: 'Poção, Pedra do Fogo, Pedra da Lua, Master Ball, Ultra Ball, Great Ball, Reviver, Bicicleta',
  },
  bleach: {
    Termo: 'Zanpakutō, Bankai, Shikai, Hollow, Arrancar, Shinigami, Espada, Reiatsu, Kidō, Menos, Cero, Visored, Hōgyoku, Shunpo, Getsuga, Gotei',
    Lugar: 'Seireitei, Soul Society, Hueco Mundo, Karakura, Rukongai, Las Noches, Dangai',
    Raça: 'Quincy, Humano, Fullbringer',
  },
  clash: {
    Termo: 'Elixir, Coroa, Torre, Carta, Gemas, Troféu, Baralho, Feitiço, Torneio, Ponte, Arena, Emote, Ouro, Clã',
    Raridade: 'Comum, Rara, Épica, Lendária, Campeão',
    Tipo: 'Tropa, Construção, Feitiço',
  },
  naruto: {
    Arma: 'Kunai, Shuriken, Pergaminho, Makibishi, Fuuma Shuriken',
    Técnica: 'Rasengan, Chidori, Kage Bunshin, Amaterasu, Tsukuyomi, Susanoo, Kamui, Kirin, Edo Tensei, Kawarimi, Henge, Rasenshuriken',
    Termo: 'Ninja, Chakra, Jutsu, Genin, Chunin, Jonin, Hokage, Kazekage, Sannin, Bijuu, Jinchuriki, Ninjutsu, Genjutsu, Taijutsu, Senjutsu, Anbu, Selo, Bandana',
    Olho: 'Sharingan, Byakugan, Rinnegan, Mangekyou',
    Lugar: 'Konoha, Sunagakure, Kirigakure, Kumogakure, Iwagakure, Amegakure, Ichiraku, Uzushiogakure',
    Grupo: 'Akatsuki, Time Sete, Sannin Lendários',
  },
  yugioh: {
    Termo: 'Duelo, Duelista, Monstro, Magia, Armadilha, Cemitério, Tributo, Invocação, Pontos de Vida, Extra Deck, Baralho, Campo',
    Tipo: 'Fusão, Ritual, Sincro, Link, Pêndulo, Efeito, Normal',
    Objeto: 'Enigma do Milênio, Olho do Milênio, Disco de Duelo',
  },
  lol: {
    Mapa: 'Nexus, Barão, Dragão, Arauto, Torre, Inibidor, Selva, Rota, Tropa, Sentinela, Rift',
    Função: 'Suporte, Atirador, Mago, Tanque, Assassino, Lutador, Caçador',
    Termo: 'Runa, Flash, Ultimate, Pentakill, Farm, Ouro, Build, Skin, Ranqueada',
    Região: 'Runeterra, Demacia, Noxus, Piltover, Zaun, Ionia, Freljord, Shurima, Ixtal, Targon, Bilgewater',
  },
  valorant: {
    Mapa: 'Bind, Haven, Split, Ascent, Icebox, Breeze, Fracture, Pearl, Lotus, Sunset, Abyss',
    Função: 'Duelista, Iniciador, Controlador, Sentinela',
    Termo: 'Spike, Rodada, Clutch, Headshot, Ultimate, Habilidade, Radianita, Plantar, Desarmar, Economia',
  },
  'valorant-armas': {
    Tipo: 'Pistola, Rifle, Escopeta, Sniper, Metralhadora, Submetralhadora, Faca',
    Termo: 'Mira, Recuo, Munição, Pente, Headshot, Spray, Skin, Luneta, Silenciador, Rajada, Economia',
  },
  rickmorty: {
    Termo: 'Portal, Multiverso, Dimensão, Picles, Plumbus, Schwifty, Squanch, Cronenberg, Nave, Garagem, Arma de Portal, Szechuan',
    Lugar: 'Citadela, Gazorpazorp, Planeta Squanch, Anatomy Park, Blips and Chitz',
    Grupo: 'Federação Galáctica, Conselho de Ricks',
  },
  heroes: {
    Objeto: 'Mjolnir, Escudo, Manopla, Tesseract, Batmóvel, Laço, Anel, Capa, Máscara, Batarangue',
    Material: 'Vibranium, Adamantium, Kryptonita',
    Lugar: 'Gotham, Metrópolis, Asgard, Wakanda, Krypton, Batcaverna, Arkham, Atlântida, Themyscira',
    Termo: 'Mutante, Vingadores, Liga da Justiça, Poder, Uniforme, Identidade, Vilão, Herói',
  },
  potter: {
    Casa: 'Grifinória, Sonserina, Corvinal, Lufa-Lufa',
    Feitiço: 'Expelliarmus, Lumos, Accio, Crucio, Imperio, Obliviate, Alohomora, Estupefaça, Avada Kedavra',
    Objeto: 'Varinha, Horcrux, Vassoura, Pomo de Ouro, Balaço, Goles, Capa, Chapéu Seletor, Penseira, Vira-Tempo',
    Lugar: 'Hogwarts, Azkaban, Hogsmeade, Gringotes, Beco Diagonal, Toca, Ministério',
    Termo: 'Quadribol, Patrono, Trouxa, Dementador, Poção, Profecia, Animago, Bruxo, Coruja, Sangue-Ruim',
  },
  lotr: {
    Lugar: 'Condado, Mordor, Gondor, Rohan, Valfenda, Moria, Isengard, Minas Tirith, Lothlórien, Erebor, Bri',
    Raça: 'Hobbit, Elfo, Anão, Orque, Uruk-hai, Nazgûl, Balrog, Humano, Mago',
    Objeto: 'Anel, Palantír, Mithril, Ferroada, Andúril, Lembas, Precioso',
    Termo: 'Sociedade, Terra-média, Olho, Montanha, Jornada',
  },
  f1: {
    Termo: 'Pole, Pit Stop, Largada, Bandeira, Volta, Safety Car, Chicane, Curva, Vácuo, Pódio, Campeão, Grid, Ultrapassagem, Pneu, Box, Asa',
    Circuito: 'Mônaco, Interlagos, Monza, Silverstone, Suzuka, Spa, Imola, Hungaroring, Baku, Zandvoort',
    Equipe: 'Ferrari, McLaren, Williams, Mercedes, Renault, Lotus, Brabham, Tyrrell, Red Bull, Sauber, Alpine',
  },
  cars: {
    Peça: 'Motor, Câmbio, Volante, Pneu, Embreagem, Freio, Farol, Capô, Para-choque, Retrovisor, Turbo, Cilindro, Pistão, Carburador, Radiador, Buzina, Airbag, Tanque, Escapamento',
    Carroceria: 'Sedã, Hatch, Picape, Conversível, Perua, Cupê, Utilitário',
    Combustível: 'Gasolina, Etanol, Diesel, Elétrico',
  },
  mlp: {
    Lugar: 'Equestria, Ponyville, Canterlot, Cloudsdale, Império de Cristal, Manehattan',
    Termo: 'Cutie Mark, Unicórnio, Pégaso, Alicórnio, Amizade, Harmonia, Magia, Elementos, Arco-íris, Lealdade, Generosidade, Honestidade, Bondade, Riso',
  },
  onepiece: {
    Termo: 'Pirata, Marinha, Akuma no Mi, Haki, Tesouro, Recompensa, Yonkou, Shichibukai, Poneglyph, Nakama, Mugiwara, Log Pose, Gomu Gomu, One Piece',
    Lugar: 'Grand Line, Wano, Alabasta, Skypiea, Marineford, Impel Down, Laugh Tale, Water Seven, Enies Lobby, Dressrosa, Punk Hazard',
    Navio: 'Going Merry, Thousand Sunny, Moby Dick',
  },
  dragonball: {
    Técnica: 'Kamehameha, Genki Dama, Kaioken, Final Flash, Makankosappo, Kienzan, Fusão, Teletransporte',
    Termo: 'Esferas, Saiyajin, Senzu, Scouter, Nuvem Voadora, Potara, Cápsula, Torneio, Transformação',
    Lugar: 'Namekusei, Kame House, Capsule Corp, Planeta Vegeta, Sala do Tempo',
  },
  hxh: {
    Termo: 'Hunter, Licença, Hatsu, Zetsu, Exame, Aranha, Formiga, Quimera, Carta, Nen',
    Tipo: 'Emissão, Manipulação, Transmutação, Intensificação, Materialização, Especialização',
    Lugar: 'Greed Island, Yorknew, Arena Celestial, Meteor City, Continente Negro',
    Grupo: 'Genei Ryodan, Zoldyck, Associação Hunter',
  },
  ordem: {
    Elemento: 'Sangue, Morte, Conhecimento, Energia, Medo',
    Classe: 'Combatente, Especialista, Ocultista',
    Termo: 'Paranormal, Ritual, Agente, Membrana, Outro Lado, Criatura, Maldição, Sigilo, Transcender, Ordo Realitas, Investigação, Exposição',
  },
  ben10: {
    Termo: 'Omnitrix, Ultimatrix, Alien, Relógio, Encanador, Transformação, Galvan, Primus, Codon, Herói, Mutante',
    Grupo: 'Encanadores, Cavaleiros Eternos, Forever Knights',
    // o dataset e so de aliens: os humanos e os viloes entram por aqui
    Personagem: 'Vilgax, Kevin, Gwen, Vovô Max, Azmuth, Albedo, Julie, Rook, Charmcaster, Hex, Zombozo',
    Lugar: 'Bellwood, Galvan Prime, Trailer',
  },
  jojo: {
    Termo: 'Stand, Hamon, Vampiro, Flecha, Rotação, Cadáver, Estrela, Máscara de Pedra, Réquiem, Usuário',
    Lugar: 'Morioh, Egito, Cairo, Nápoles, Passione, Green Dolphin',
    Grito: 'Ora Ora, Muda Muda, Za Warudo, Yare Yare',
  },
  famosos: {
    Prêmio: 'Oscar, Grammy, Emmy, Globo de Ouro, Palma de Ouro',
    Termo: 'Hollywood, Paparazzi, Autógrafo, Estreia, Fama, Cinema, Novela, Streaming, Influencer, Celebridade, Estrela, Palco, Holofote, Fofoca, Seguidores, Tapete',
  },
  bandas: {
    Instrumento: 'Guitarra, Baixo, Bateria, Teclado, Microfone, Amplificador, Violão, Sintetizador',
    Termo: 'Vocal, Palco, Turnê, Álbum, Single, Riff, Solo, Plateia, Refrão, Acorde, Festival, Setlist, Vinil, Disco, Banda, Show, Groupie',
    Gênero: 'Rock, Metal, Punk, Grunge, Indie, Blues, Reggae, Samba, Funk, Emo, Heavy Metal',
  },
  deuses: {
    Lugar: 'Olimpo, Valhalla, Asgard, Duat, Submundo, Yggdrasil, Bifrost, Tártaro',
    Objeto: 'Raio, Tridente, Martelo, Mjolnir, Ankh, Égide, Néctar, Ambrosia',
    Termo: 'Oráculo, Templo, Panteão, Titã, Semideus, Oferenda, Sacrifício, Ragnarok, Profecia, Mitologia, Valquíria, Faraó, Pirâmide, Imortal',
  },
  desenhos: {
    Termo: 'Desenho, Animação, Episódio, Temporada, Vilão, Herói, Mascote, Personagem, Cartoon, Abertura, Crossover, Bordão',
    Canal: 'Cartoon Network, Nickelodeon, Disney, Discovery Kids, Jetix, Boomerang',
  },
  animais: {
    Classe: 'Mamífero, Réptil, Anfíbio, Peixe, Inseto, Aracnídeo, Crustáceo',
    Hábitat: 'Savana, Floresta, Oceano, Selva, Deserto, Pântano, Recife, Tundra, Cerrado, Caatinga',
    Corpo: 'Pena, Escama, Garra, Juba, Chifre, Casco, Cauda, Presa, Bico, Tromba, Barbatana, Carapaça',
    Termo: 'Predador, Filhote, Manada, Cardume, Alcateia, Herbívoro, Carnívoro, Onívoro, Toca, Ninho, Migração, Hibernação',
  },
  cdz: {
    Termo: 'Cosmo, Armadura, Cavaleiro, Amazona, Constelação, Sétimo Sentido, Urna, Doze Casas, Grande Mestre, Escama, Sobrepeliz, Máscara, Relógio de Fogo',
    Golpe: 'Meteoro de Pégaso, Cólera do Dragão, Pó de Diamante, Ave Fênix, Excalibur, Agulha Escarlate, Rosas Piranhas, Ondas do Inferno, Explosão Galáctica',
    Lugar: 'Santuário, Asgard, Atlântida, Elísios, Giudecca, Rozan, Sibéria, Jamiel, Cinco Picos, Coliseu, Inferno, Cocytos',
  },
  mha: {
    Termo: 'Individualidade, Herói, Vilão, Codinome, Licença, Agência, Sidekick, Ranking, Uniforme, Plus Ultra, Smash, Nomu, Símbolo da Paz',
    Golpe: 'Detroit Smash, Delaware Smash, Full Cowl, Shoot Style, Black Whip, AP Shot, Recipro Burst, Howitzer Impact',
    Lugar: 'Yuuei, Kamino, Hosu, Musutafu, Shiketsu, Tartarus, Jaku, Gunga',
  },
};
