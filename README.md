# Palpite

Um jogo de adivinhação multiplayer no estilo Pokédle, com **treze universos**.
Um secreto por rodada, todo mundo na mesma sala, **um chute por vez**. Cada
chute vira uma linha de dicas visível para todos — verde acerta, amarelo chega
perto, seta indica se o secreto é maior ou menor.

Node + Socket.IO no servidor, HTML/CSS/JS puro no navegador (sem build, sem
framework). Os dados são baixados **uma vez** de APIs públicas para arquivos
JSON locais — em partida o jogo não depende delas, só as imagens vêm dos CDNs.

## Como rodar

```bash
npm install
npm start
```

Abra <http://localhost:3000>. Crie a sala, clique em **Copiar convite** e mande o
link para a galera. Quem abrir o link já entra com o código preenchido.

Para jogar pela internet sem publicar nada, exponha a porta 3000 com um túnel:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

## Universos

| Universo | Itens | Sorteáveis | Grupos | Colunas de dica |
| --- | ---: | ---: | --- | --- |
| **Pokémon** | 1025 | 1025 | Gerações 1–9 | Tipo 1, Tipo 2, Geração, Cor, Evolução, Altura, Peso |
| **Bleach** | 221 | 106 | Shinigami, Humanos, Quincy, Arrancar | Raça, Gênero, Afiliação, Bankai, Estreia, Altura, Peso |
| **Clash Royale** | 120 | 120 | 5 raridades | Raridade, Tipo, Elixir, Arena, Alvo, Velocidade, Vida |
| **Naruto** | 1431 | 230 | 8 vilas + Akatsuki | Gênero, Clã, Afiliação, Classificação, Natureza, Patente, Estreia, Altura |
| **Yu-Gi-Oh!** | 3000 | 600 | 10 tipos de carta | Tipo, Atributo, Raça, Nível, ATK, DEF, Arquétipo |
| **League of Legends** | 173 | 173 | 6 funções | Funções, Recurso, Ataque, Magia, Defesa, Dificuldade, Alcance |
| **Valorant · Agentes** | 29 | 29 | 4 funções | Função, Tags, Habilidades, Passiva |
| **Valorant · Armas** | 19 | 19 | 6 categorias | Categoria, Custo, Dano, Cadência, Pente, Penetração |
| **Rick and Morty** | 826 | 81 | Humanos, Aliens, Outros | Status, Espécie, Gênero, Origem, Localização, Episódios, Estreia |
| **Super-heróis** | 563 | 433 | Marvel, DC, Outras | Editora, Alinhamento, Gênero, Raça, Inteligência, Força, Altura |
| **Harry Potter** | 437 | 91 | 4 casas de Hogwarts | Casa, Espécie, Gênero, Ascendência, Papel, Vivo, Cabelo |
| **Senhor dos Anéis** | 25 | 25 | 7 raças | Raça, Reino, Grupo, Gênero, Altura, Armas, Filmes |
| **Fórmula 1** | 853 | 265 | 8 décadas de estreia | País, Equipe, Temporadas, Vitórias, Títulos, Estreia, Nascimento |

**Sorteáveis** são os que têm dados completos o bastante para uma rodada justa.
Qualquer um pode ser **chutado** — a restrição vale só para o secreto. Por isso
Naruto e Rick and Morty têm poucos sorteáveis: as APIs deixam a maioria dos
secundários sem altura, afiliação ou episódio de estreia. No Yu-Gi-Oh, das 14 mil
cartas ficam as 3000 mais vistas no site, e só as 600 mais vistas viram segredo.
Na Fórmula 1, sorteáveis são os vencedores de corrida, quem tem 5+ temporadas ou
quem correu de 2020 para cá — os outros 588 são nomes de uma prova só.

### De onde vêm os dados

| Fonte | Precisa de chave? |
| --- | --- |
| [PokéAPI](https://pokeapi.co/) | não |
| [Bleach API](https://bleach-api-8v2r.onrender.com/) | não |
| [RoyaleAPI cr-api-data](https://royaleapi.github.io/cr-api-data/) | não |
| [Dattebayo](https://dattebayo-api.onrender.com/) | não |
| [YGOPRODeck](https://ygoprodeck.com/api-guide/) | não |
| [Data Dragon (Riot)](https://ddragon.leagueoflegends.com/) | não |
| [valorant-api](https://valorant-api.com/) | não |
| [Rick and Morty API](https://rickandmortyapi.com/) | não |
| [SuperHero API (espelho akabab)](https://akabab.github.io/superhero-api/) | não |
| [HP-API](https://hp-api.onrender.com/) | não |
| [LOTR API (vlayer)](https://lotr-api.vlayer.vercel.app/) | não |
| [F1 API](https://f1api.dev/) | não |

Quatro fontes pedidas **não** deram para usar direto e foram substituídas:

- **developer.riotgames.com** exige chave que expira a cada 24h e serve dados de
  partidas, não a ficha dos campeões. O **Data Dragon** da própria Riot é aberto,
  tem os 173 campeões e vem em pt-BR.
- **developer.marvel.com** exige chave pública + hash privado. A Marvel entra
  pelo espelho aberto da SuperHero API, como grupo (239 personagens sorteáveis).
- **superheroapi.com** exige um token por usuário; o espelho estático do akabab
  serve os mesmos dados sem cadastro.
- **the-one-api.dev** devolve 401 em `/character` sem token Bearer (só `/book` é
  público). A **LOTR API da vlayer** é aberta: são apenas 25 personagens, mas
  todos os principais e com todos os campos preenchidos.

## Modos

| Modo | Como funciona |
| --- | --- |
| **Clássico** | O servidor sorteia o secreto. Todos adivinham, um por turno. |
| **Duelo de escolhas** | A cada rodada um jogador escolhe o secreto e assiste; os outros se revezam. Se ninguém acertar, quem escolheu leva 50 pontos. |

Quantos jogadores quiser (até 12 por sala) — não é 1v1, é todo mundo contra todo
mundo, com placar acumulado ao longo das rodadas.

## Configurações da sala (o host define)

- **Universo** e **grupos** — quais fatias entram no sorteio.
- **Indefinido** (ligado por padrão no clássico) — a rodada só fecha quando
  alguém acerta, sem limite de chutes, e as rodadas se sucedem até o host
  clicar em **Encerrar partida**. Mexer em *Rodadas* ou *Chutes por jogador*
  desliga o indefinido automaticamente. No **duelo** ele não existe: quem
  esconde o segredo só pontua se os chutes acabarem.
- **Rodadas** — quantas até o placar final.
- **Segundos por turno (por jogador)** — vale a vez de cada um. **Jogando
  sozinho não há cronômetro**: ele existe para a vez não travar no versus.
  Quem não chuta a tempo perde a vez (e um chute, se houver limite).
- **Chutes por jogador** — quando todos zeram, a rodada acaba sem vencedor.

## Pontuação

- Quem acerta ganha `100 - 5 × (chutes já feitos na rodada)`, com piso de 25.
  Acertar cedo vale mais.
- No duelo, quem escolheu o segredo ganha 50 se ninguém acertar.

## Como ler as dicas

- **Verde**: exato.
- **Amarelo em tipo**: esse tipo existe no secreto, mas no outro slot.
- **Amarelo em lista** (afiliação, clã, funções): há itens em comum, mas as
  listas não são idênticas.
- **Amarelo em número**: diferença de até 10%.
- **▲ / ▼**: o valor do secreto é maior / menor que o do seu chute.
- **Cinza em itálico**: falta o dado de um dos lados, então não dá para comparar.

Listas longas aparecem cortadas (`A, B, C +2`); passe o mouse para ver tudo.
Em Clash Royale e LoL dá para buscar pelo nome em português ou em inglês.

## Estrutura

```
public/universes.js        schema dos universos (colunas, grupos, rótulos)
src/game.js                comparação e pontuação — puro, guiado pelo schema
src/server.js              salas, turnos, timers e eventos Socket.IO
public/                    interface (index.html, style.css, app.js)
scripts/build-*.mjs        uma ingestão por universo -> data/<nome>.json
scripts/smoke-test.mjs     teste end-to-end com jogadores simulados
```

### Adicionar um universo novo

1. Escreva um `scripts/build-<nome>.mjs` que gere `data/<nome>.json`. Cada item
   precisa de `id`, `name`, `group`, `sprite`, `artwork`, `eligible` e uma chave
   por coluna. Opcional: `aliases` (nomes alternativos para a busca).
2. Adicione a entrada em `public/universes.js` com `groups` e `columns`.

Nada em `src/game.js`, `src/server.js` ou `public/app.js` precisa mudar — as
colunas da tabela, os filtros do lobby e a comparação saem do schema. O teste
também é genérico: o universo novo passa a ser testado sozinho.

Tipos de coluna: `text` (igual/diferente), `slot` (igual, ou existe no outro
slot → amarelo), `list` (conjuntos iguais → verde, interseção → amarelo) e
`number` (com tolerância e seta).

## Testes

```bash
npm test
```

Sobe o servidor de verdade, conecta jogadores falsos e joga partidas completas
nos dois modos e **nos treze universos**, verificando turnos, dicas, timeout,
pontuação, filtros de grupo, sigilo do segredo e reconexão. São 157 verificações.

## Atualizar os dados

Os JSON já vêm prontos. Para regerar tudo:

```bash
npm run build:data
```

Ou um de cada vez: `build:pokedex`, `build:bleach`, `build:clash`,
`build:naruto`, `build:yugioh`, `build:lol`, `build:valorant`,
`build:rickmorty`, `build:heroes`, `build:potter`, `build:lotr`, `build:f1`. As respostas ficam em `.cache/`, então rodar
de novo é instantâneo.

## Deploy grátis

**Render** — suba o repo no GitHub, vá em *New > Blueprint* e aponte para ele.
O `render.yaml` já está configurado. O plano free hiberna após 15 min sem uso, e
o primeiro acesso depois disso demora ~30s.

**Fly.io / Railway / qualquer lugar com Docker**:

```bash
docker build -t palpite . && docker run -p 3000:3000 palpite
```

O servidor respeita a variável `PORT` e responde em `/healthz`.

> As salas ficam em memória: reiniciar o servidor derruba as partidas em
> andamento, e não dá para escalar para mais de uma instância sem um Redis no
> meio. Para jogar com amigos, uma instância basta.

## Detalhes que podem confundir

- A identidade do jogador fica no `sessionStorage`, por aba. Recarregar a página
  reconecta você na mesma partida com o mesmo placar; abrir uma segunda aba cria
  um segundo jogador.
- Quem entra com a rodada em andamento assiste e começa a jogar na rodada
  seguinte.
- Se o host cair, o cargo passa para o próximo jogador conectado.
- **Os dados são das APIs, com os defeitos delas.** No Bleach, Ichigo aparece
  como "Humano" e Yhwach não existe na base. No Naruto, o clã da Sakura vem como
  "Uchiha" (pós-casamento) e o do Gaara como "Kazekage", que é título.
- **Fórmula 1 não tem fotos** e os dados de carreira são agregados por nós a
  partir da classificação de cada temporada, não vêm prontos da API. Títulos e
  vitórias batem com a história (Schumacher e Hamilton com 7, Senna com 3 e 41).
- **Harry Potter quase não tem fotos**: a API só traz imagem de 25 dos 437
  personagens, então a maioria das linhas aparece só com o nome. O Senhor dos
  Anéis não tem imagem nenhuma.
- **Valorant · Agentes é o universo mais fraco**: a API só dá função, tags (e
  apenas 11 dos 29 agentes têm alguma) e número de habilidades. Por isso existe
  também o **Valorant · Armas**, com custo, dano, cadência, pente e penetração —
  poucas opções, mas dedução de verdade.
