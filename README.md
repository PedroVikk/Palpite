# Palpite

Um jogo de adivinhação multiplayer no estilo Pokédle, com **dezoito universos**.
Um secreto por rodada, todo mundo na mesma sala, **um chute por vez**. Cada
chute vira uma linha de dicas visível para todos — verde acerta, amarelo chega
perto, seta indica se o secreto é maior ou menor.

Express + Socket.IO no servidor, React + Vite no navegador. Os dados são
baixados **uma vez** de APIs públicas para arquivos JSON locais — em partida o
jogo não depende delas, só as imagens vêm dos CDNs.

## Como rodar

```bash
npm install && npm run build
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
| **Pokémon** | 1025 | 1025 | Gerações 1–9 | Tipo 1, Tipo 2, Geração, Cores, Evolução, Altura, Peso |
| **Bleach** | 221 | 106 | Shinigami, Humanos, Quincy, Arrancar | Raça, Gênero, Afiliação, Bankai, Estreia, Altura, Peso |
| **Clash Royale** | 120 | 120 | 5 raridades | Raridade, Tipo, Elixir, Arena, Alvo, Velocidade, Vida |
| **Naruto** | 1431 | 230 | 8 vilas + Akatsuki | Gênero, Clã, Afiliação, Classificação, Natureza, Patente, Estado, Estreia |
| **Yu-Gi-Oh!** | 3000 | 600 | 10 tipos de carta | Tipo, Atributo, Raça, Nível, ATK, DEF, Arquétipo |
| **League of Legends** | 173 | 170 | 6 classes | Gênero, Posições, Espécie, Recurso, Alcance, Região, Lançamento |
| **Valorant · Agentes** | 29 | 29 | 4 funções | Função, Gênero, Raça, Origem, Lançamento |
| **Valorant · Armas** | 19 | 19 | 6 categorias | Categoria, Custo, Dano, Cadência, Pente, Penetração |
| **Rick and Morty** | 826 | 97 | Humanos, Aliens, Outros | Status, Espécie, Gênero, Origem, Localização, Episódios, Estreia |
| **Super-heróis** | 563 | 433 | Marvel, DC, Outras | Editora, Alinhamento, Gênero, Raça, Inteligência, Força, Altura |
| **Harry Potter** | 437 | 91 | 4 casas de Hogwarts | Casa, Espécie, Gênero, Ascendência, Papel, Vivo, Cabelo |
| **Senhor dos Anéis** | 25 | 25 | 7 raças | Raça, Reino, Grupo, Gênero, Altura, Cabelo, Filmes |
| **Fórmula 1** | 853 | 265 | 8 décadas de estreia | País, Equipe, Temporadas, Vitórias, Títulos, Melhor ano, Estreia |
| **Carros** | 1570 | 1020 | 9 origens de marca | Marca, Categoria, Tração, Consumo, Cilindros, Cilindrada, Estreia, Último ano |
| **My Little Pony** | 555 | 117 | 6 espécies | Espécie, Gênero, Residência, Ocupação |
| **One Piece** | 786 | 375 | 7 facções | Tripulação, Papel, Fruta, Origem, Status, Recompensa, Altura, Idade |
| **Dragon Ball** | 58 | 43 | 6 raças | Raça, Gênero, Afiliação, Planeta, Transformações, Ki base, Ki máximo |
| **Hunter × Hunter 2011** | 607 | 447 | 7 facções | Gênero, Nen, Estado, Afiliação, Ocupação, Cabelo, Estreia |

**Sorteáveis** são os que têm dados completos o bastante para uma rodada justa.
Qualquer um pode ser **chutado** — a restrição vale só para o secreto. Por isso
Naruto e Rick and Morty têm poucos sorteáveis: as APIs deixam a maioria dos
secundários sem altura, afiliação ou episódio de estreia. No Yu-Gi-Oh, das 14 mil
cartas ficam as 3000 mais vistas no site, e só as 600 mais vistas viram segredo.
Na Fórmula 1, sorteáveis são os vencedores de corrida, quem tem 5+ temporadas ou
quem correu de 2020 para cá — os outros 588 são nomes de uma prova só.

**Uma coluna só vale se o jogador puder saber a resposta de cabeça.** É o que
guia a escolha aqui, e é por isso que a ficha de *League of Legends* e a de
*Valorant · Agentes* não são a que a API entrega. No LoL, o Data Dragon dá notas
de 1 a 10 para Ataque, Magia, Defesa e Dificuldade: ninguém sabe que a Ahri tem
"Magia 8", então quatro das sete colunas viravam chute no escuro. No lugar
entrou a ficha de lore do wiki — gênero, posição, espécie, recurso, alcance,
região e ano de lançamento, o mesmo conjunto do LoLdle. Em Valorant, as colunas
*Habilidades* (4 ou 5) e *Passiva* (sim ou não) diziam a mesma coisa duas vezes
— quem tem 5 habilidades é exatamente quem tem passiva — e *Tags* estava vazia
em 18 dos 29 agentes; agora são função, gênero, raça, origem e lançamento. Em
Carros, *Combustível* saiu pelo mesmo motivo: 97% dos sorteáveis são a gasolina,
então a célula fechava verde para quase todo chute. O *Consumo* em km/l tomou o
lugar, com as setas ▲/▼. No Senhor dos Anéis, *Armas* saiu porque cada um dos 25
personagens tinha um conjunto próprio: a célula só ficava verde na resposta
certa. Entrou *Cabelo*. Na Fórmula 1, *Nascimento* deu lugar a *Melhor ano* — a
melhor colocação no campeonato, onde 1 é campeão e o resto do grid se espalha —,
porque o ano de nascimento quase ninguém sabe e ele andava colado no de estreia.

**E célula cinza não é dica.** Quando um campo está em branco a comparação não
acontece: a célula sai cinza de "sem dado" e não separa nada. Às vezes o branco
é lacuna mesmo (o peso de 15% do elenco de Bleach), mas quase sempre ele *é*
a resposta — o ninja não é de clã nenhum, a magia de Yu-Gi-Oh não tem ATK, o
marinheiro não tem recompensa. Nesses casos o dataset agora grava o valor
explícito ("Sem clã", "Nenhuma", "Sem arquétipo"), e nas colunas numéricas o
schema marca `blank`, que faz duas cartas sem ATK fecharem verde entre si. Isso
tirou o cinza de 65% das células de *Clã* e *Classificação* no Naruto, de um
terço da tabela do Yu-Gi-Oh e de 69% da *Recompensa* do One Piece.

Em **One Piece**, a api-onepiece não traz imagem e ficou meio traduzida do
francês ("Baggy", "Chapeau de Paille"), então a ficha vem dela e o nome
canônico e o retrato vêm da One Piece Wiki — 88% casam, e o nome francês fica
de apelido na busca. Sorteável precisa de retrato, tripulação, papel, status e
altura ou idade. Da mesma página do wiki sai a `{{Char Box}}`, que preenche o
que a API não sabe: o *mar de origem* (que ela não tem), 31% das recompensas
contra 26% dela, e a altura certa — a API põe o Fisher Tiger com 4520 cm, dez
vezes os 520 cm da ficha. Quem continua sem recompensa é marinheiro ou civil:
nunca teve uma anunciada. Em **Dragon Ball** o ki
varia de 450 ao "969 Googolplex" do Zeno, então a célula mostra a ordem de
grandeza ("Milhões", "Setilhões") em vez do número — as setas ▲▼ continuam
valendo. Quem não tem ki na base (Bulma, Chi-Chi) pode ser chutado, mas não
sorteado. **Hunter × Hunter 2011** leva esse nome porque a Hunterpedia entrega
o retrato e a cor de cabelo da adaptação de 2011 sempre que ela existe. Lá,
*Nen* separa três respostas: o tipo revelado, o campo escrito "Unknown" (usa
nen, nunca disseram qual) e a ficha sem o campo, que é quem nunca foi mostrado
usando nen — as três valem como dica e fecham verde contra a igual. *Ocupação*
agrupa o texto livre da wiki em treze papéis, senão cada personagem teria um
valor único e a coluna nunca ficaria verde.

Hunter × Hunter é também o único universo com **recorte**: o mangá passou muito
do que foi animado, então a sala pergunta se entra o elenco todo (447
sorteáveis) ou só quem apareceu em algum episódio, OVA ou filme (271). Quem não
tem `anime debut` na ficha só existe no papel — é quase todo o arco de Kakin.
O recorte é um segundo filtro, independente dos grupos; qualquer universo pode
ganhar o seu declarando `scope` no schema.

Em **Carros**, cada item é um modelo (as versões de motor viram um só "Toyota
Corolla"), e o secreto precisa de 3+ anos de linha e ficha completa — elétricos
podem ser chutados, mas não sorteados, porque não têm cilindros nem cilindrada.
Atenção a *Estreia*: a base do EPA começa em 1984, então para modelos mais
antigos é o primeiro ano **na base**, não o lançamento real. **My Little Pony**
é o único universo sem coluna numérica (a API não traz número nenhum), então lá
não aparecem as setas ▲/▼.

### De onde vêm os dados

| Fonte | Precisa de chave? |
| --- | --- |
| [PokéAPI](https://pokeapi.co/) | não |
| [Bleach API](https://bleach-api-8v2r.onrender.com/) | não |
| [RoyaleAPI cr-api-data](https://royaleapi.github.io/cr-api-data/) | não |
| [Dattebayo](https://dattebayo-api.onrender.com/) | não |
| [YGOPRODeck](https://ygoprodeck.com/api-guide/) | não |
| [Data Dragon (Riot)](https://ddragon.leagueoflegends.com/) | não |
| [Wiki de LoL (MediaWiki)](https://leagueoflegends.fandom.com/) | não |
| [valorant-api](https://valorant-api.com/) | não |
| [Wiki do Valorant (MediaWiki)](https://valorant.fandom.com/) | não |
| [Rick and Morty API](https://rickandmortyapi.com/) | não |
| [SuperHero API (espelho akabab)](https://akabab.github.io/superhero-api/) | não |
| [HP-API](https://hp-api.onrender.com/) | não |
| [Harry Potter Wiki (MediaWiki)](https://harrypotter.fandom.com/) | não |
| [LOTR API (vlayer)](https://lotr-api.vlayer.vercel.app/) | não |
| [One Wiki to Rule Them All](https://lotr.fandom.com/) | não |
| [F1 API](https://f1api.dev/) | não |
| [Wikipedia (retratos da F1)](https://en.wikipedia.org/) | não |
| [EPA fueleconomy.gov](https://www.fueleconomy.gov/feg/ws/) | não |
| [PonyAPI](https://ponyapi.net/) | não |
| [api-onepiece](https://api-onepiece.com/) | não |
| [One Piece Wiki (MediaWiki)](https://onepiece.fandom.com/) | não |
| [Dragon Ball API](https://dragonball-api.com/) | não |
| [Hunterpedia (MediaWiki)](https://hunterxhunter.fandom.com/) | não |

Cinco fontes pedidas **não** deram para usar direto e foram substituídas:

- **developer.riotgames.com** exige chave que expira a cada 24h e serve dados de
  partidas, não a ficha dos campeões. O **Data Dragon** da própria Riot é aberto,
  tem os 173 campeões e vem em pt-BR — dele saem o nome, a classe e as imagens.
  Espécie, gênero, região, posição, alcance e ano de lançamento não existem em
  API nenhuma da Riot: vêm do wiki, do `Module:ChampionData/data` e da ficha
  `{{Champion bio}}` de cada campeão. Os três campeões mais novos (Locke, Yunara
  e Zaahen) ainda não estão no módulo, então podem ser chutados mas não
  sorteados. O mesmo vale para Valorant: a valorant-api só tem números de jogo,
  e raça, pronome, origem e estreia saem de uma página só do wiki, o
  `Template:Agent Infobox Shortcut`.
- **developer.marvel.com** exige chave pública + hash privado. A Marvel entra
  pelo espelho aberto da SuperHero API, como grupo (239 personagens sorteáveis).
- **superheroapi.com** exige um token por usuário; o espelho estático do akabab
  serve os mesmos dados sem cadastro.
- **the-one-api.dev** devolve 401 em `/character` sem token Bearer (só `/book` é
  público). A **LOTR API da vlayer** é aberta: são apenas 25 personagens, mas
  todos os principais e com todos os campos preenchidos.
- **hxh-api.vercel.app**, a única API de Hunter × Hunter que aparece nas buscas,
  responde `402 DEPLOYMENT_DISABLED` — está fora do ar. Hunter × Hunter vem da
  API do MediaWiki da **Hunterpedia**: `list=embeddedin` acha as 610 páginas que
  transcluem a ficha de personagem, e o resto é limpar wikitexto.

### As cores do Pokémon saem do sprite

O `color` da PokéAPI é a categoria de busca da Pokédex, não a aparência: é um
rótulo único, escolhido a dedo, e às vezes ele contradiz o desenho. Moltres
entra como *amarelo* com um sprite 75% vermelho; Rapidash, *amarelo* com 77% de
vermelho; Staraptor, *marrom* sendo 61% cinza. Em 61 dos 1025 a cor declarada
ocupava menos de 5% dos pixels visíveis.

Então `build:pokedex` mede o próprio sprite e grava um campo `colors` com as
cores que ocupam pelo menos 18% dele (no máximo três, e a dominante entra
sempre). O vocabulário continua o mesmo da Pokédex, para a coluna seguir
traduzida, e a coluna virou `list`: conjunto igual fica verde, interseção fica
amarela — como já acontece com Clã ou Afiliação no Naruto.

Isso resolve as duas metades do problema. Charizard deixa de ser só *vermelho*
e vira *marrom, vermelho, azul* (asas). Bulbasaur, que é ciano, sai como *verde
e azul* — o matiz dele fica exatamente na fronteira entre os dois, e duas cores
ali dizem a verdade que uma só não diz. 257 Pokémon ficaram com uma cor, 558 com
duas e 210 com três.

## Modos

| Modo | Como funciona |
| --- | --- |
| **Caça ao segredo** | O servidor sorteia o secreto e **ninguém** sabe qual é. Todos adivinham, um por turno, até alguém acertar (ou os chutes acabarem). |
| **Duelo** | A cada rodada um jogador escolhe o secreto e assiste, **na vez dele numa fila**; os outros se revezam nos chutes. Se ninguém acertar, quem escolheu leva 50 pontos. |

Quantos jogadores quiser (até 12 por sala) — não é 1v1, é todo mundo contra todo
mundo, com placar acumulado ao longo das rodadas.

Com dois ou mais na fila, **quem abre cada rodada é sorteado**: abrir vale mais
(o acerto perde 5 pontos por chute já feito), então deixar a largada sempre com
quem entrou primeiro na sala seria vantagem fixa. Só a largada é sorteada — o
rodízio dali em diante segue a ordem da sala.

No duelo, **quem esconde o segredo circula numa fila**, não é sorteado. Esconder
é a cadeira ruim (não chuta, e só pontua se ninguém acertar), e no sorteio dava
para cair nela várias rodadas seguidas. Na fila, quem acabou de esconder vai
para o fim: a vez só volta depois que todo mundo passou. A ordem inicial é
embaralhada — em ordem de chegada o host esconderia sempre primeiro. Quem entra
no meio da partida entra no fim da fila; quem cai é pulado sem perder o lugar e
volta a ser o próximo quando reconecta.

## Configurações da sala (o host define)

- **Universo** e **grupos** — quais fatias entram no sorteio.
- **Recorte** — onde o universo tem um (só Hunter × Hunter hoje): elenco
  completo ou só o que foi animado.
- **Até acertar** (ligado por padrão na caça ao segredo) — a rodada só fecha
  quando alguém acerta, sem teto de chutes; o host pode cortar pelo botão
  **Encerrar partida**. Mexer em *Chutes por jogador* desliga essa opção. No
  **duelo** ela não existe: quem esconde o segredo só pontua se os chutes dos
  outros acabarem, então ali o teto é obrigatório.
- **Rodadas** — quantas até o placar final (1 a 20).
- **Segundos por turno (por jogador)** — vale a vez de cada um. **Jogando
  sozinho não há cronômetro**: ele existe para a vez não travar no versus.
  Quem não chuta a tempo perde a vez (e um chute, se houver limite).
- **Chutes por jogador** — quando todos zeram, a rodada acaba sem vencedor.

## Cache entre deploys

Os assets do Vite têm hash no nome e ficam cravados no cache por um ano, mas o
`index.html` nunca é cacheado e sai carimbado com a versão do deploy
(`RENDER_GIT_COMMIT`, ou a hora de subida do processo fora do Render). O cliente
compara esse carimbo com `/api/version` ao voltar o foco da aba e a cada minuto:
se mudou, um deploy novo entrou no ar e a aba recarrega sozinha. O índice do
catálogo também vai com `?v=<versão>`, então um deploy invalida o cache dele sem
esperar a hora de `max-age`.

## Pontuação

- Quem acerta ganha `100 - 5 × (chutes já feitos na rodada)`, com piso de 25.
  Acertar cedo vale mais.
- No duelo, quem escolheu o segredo ganha 50 se ninguém acertar.

## Como ler as dicas

- **Verde**: exato.
- **Vermelho**: errado.
- **Amarelo em tipo**: esse tipo existe no secreto, mas no outro slot.
- **Amarelo em lista** (afiliação, clã, funções): há itens em comum, mas as
  listas não são idênticas.
- **Amarelo em número**: diferença de até 10%.
- **▲ / ▼**: o valor do secreto é maior / menor que o do seu chute.
- **Cinza em itálico**: falta o dado de um dos lados, então não dá para comparar.
  Não é a mesma coisa que errar, por isso não fica vermelho.

Listas longas aparecem cortadas (`A, B, C +2`); passe o mouse para ver tudo.
Em Clash Royale e LoL dá para buscar pelo nome em português ou em inglês.

## Estrutura

Backend Express + Socket.IO, cliente React construído com Vite. Em produção o
Express serve o build; não há segundo processo nem segunda porta.

```
shared/universes.js        schema dos universos (colunas, grupos, rótulos)
                           — importado pelo servidor e pelo cliente
src/server.js              bootstrap: junta HTTP e socket na mesma porta
src/http.js                Express: API, estáticos e fallback de SPA
src/rooms.js               salas, turnos, timers e eventos Socket.IO
src/game.js                comparação e pontuação — puro, guiado pelo schema
src/catalog.js             datasets em memória + índice enxuto do cliente
client/src/                interface React (telas, componentes, estilos)
scripts/build-*.mjs        uma ingestão por universo -> data/<nome>.json
scripts/mirror-sprites.mjs baixa as miniaturas -> data/sprites/<universo>/
scripts/smoke-test.mjs     teste end-to-end com jogadores simulados
data/*.json                os datasets prontos, versionados junto do código
data/sprites/              as miniaturas espelhadas, servidas pelo próprio app
```

Para desenvolver o front com recarga instantânea, deixe os dois rodando: `npm
run dev` (servidor na 3000) e `npm run dev:client` (Vite na 5173, com proxy de
`/api` e `/socket.io` para a 3000).

### Adicionar um universo novo

1. Escreva um `scripts/build-<nome>.mjs` que gere `data/<nome>.json`. Cada item
   precisa de `id`, `name`, `group`, `sprite`, `artwork`, `eligible` e uma chave
   por coluna. Opcional: `aliases` (nomes alternativos para a busca).
2. Adicione a entrada em `shared/universes.js` com `groups` e `columns`.

Nada em `src/game.js`, `src/rooms.js` ou no cliente precisa mudar — as colunas
da tabela, os filtros do lobby e a comparação saem do schema. O teste também é
genérico: o universo novo passa a ser testado sozinho.

Tipos de coluna: `text` (igual/diferente), `slot` (igual, ou existe no outro
slot → amarelo), `list` (conjuntos iguais → verde, interseção → amarelo) e
`number` (com tolerância e seta).

## Testes

```bash
npm test
```

Sobe o servidor de verdade, conecta jogadores falsos e joga partidas completas
nos dois modos e **nos dezoito universos**, verificando turnos, dicas, timeout,
pontuação, filtros de grupo, sigilo do segredo e reconexão. São 211 verificações.

## Atualizar os dados

Os JSON já vêm prontos. Para regerar tudo:

```bash
npm run build:data
```

Ou um de cada vez: `build:pokedex`, `build:bleach`, `build:clash`,
`build:naruto`, `build:yugioh`, `build:lol`, `build:valorant`,
`build:rickmorty`, `build:heroes`, `build:potter`, `build:lotr`, `build:f1`,
`build:cars`, `build:mlp`, `build:onepiece`, `build:dragonball`, `build:hxh`.
As respostas ficam em `.cache/`, então rodar de novo é instantâneo.

Depois de regerar um dataset, `npm run mirror:sprites` baixa as miniaturas que
entraram — veja [Se as APIs caírem](#se-as-apis-caírem).

## Se as APIs caírem

O jogo não fala com API nenhuma em tempo de execução: os dezoito datasets vivem
em `data/*.json`, versionados junto do código, e o `src/catalog.js` lê tudo do
disco na subida. Com todas as fontes fora do ar, as partidas continuam iguais.

As imagens eram a exceção — `sprite` e `artwork` apontavam para onze CDNs de
terceiros. Por isso as miniaturas também moram aqui:

```bash
npm run mirror:sprites
```

Baixa cada `sprite`, reduz para 128px (o tamanho em que ela aparece na busca de
chute e na tabela de dicas) e grava em `data/sprites/<universo>/<id>.webp`: são
9.080 arquivos, 27,9 MB no total — os originais crus dariam ~1,5 GB. Rodar de
novo pega só o que falta, `--only=<universo>` limita a um universo e `--force`
refaz tudo. Hoje o espelho cobre 100% dos itens que têm imagem.

O script não mexe nos JSONs: quem troca a URL remota pelo caminho local é o
catálogo, na leitura. Assim os `build-*.mjs` continuam gravando a URL de origem,
e regerar um dataset não apaga o espelho nem enche o diff de caminhos locais.

### Links podres na origem

As APIs de Naruto e My Little Pony raspam a Fandom e guardam o link da imagem;
quando a wiki renomeia o arquivo, elas seguem servindo o antigo. Eram 74
retratos com 404 — 73 no Naruto (o Jiraiya entre eles) e 1 no My Little Pony.

Por isso `build:naruto` e `build:mlp` conferem cada imagem por HEAD antes de
escrever o dataset e, para as mortas, pedem o retrato atual à própria wiki
(`prop=pageimages`, o mesmo caminho que o `build:hxh` já usava). Sobraram dois
personagens do Naruto sem retrato em lugar nenhum: ficam com `sprite: null`, e
o cliente simplesmente não pede imagem. O veredito de cada URL fica em
`.cache/`, então a conferência só custa na primeira vez.

Fora do espelho ficou a arte grande do reveal: guardá-las em tamanho cheio
custaria centenas de MB. Quando ela não carrega, o reveal cai na miniatura
local — perde resolução, não a imagem.

O que ainda depende das fontes é **reconstruir** os datasets (`npm run
build:data`). As respostas ficam em `.cache/`, que não vai para o git.

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
- **A coluna *Estado* do Naruto sai do silêncio da ficha**: a Narutopedia só
  escreve `status` para quem morreu, então ausência do campo é "vivo". Dá um
  53%/47% — a divisão mais equilibrada da tabela.
- **Os dados de carreira da Fórmula 1 são agregados por nós** a partir da
  classificação de cada temporada, não vêm prontos da API. Títulos e vitórias
  batem com a história (Schumacher e Hamilton com 7, Senna com 3 e 41). A f1api
  não serve fotos, mas manda o link do artigo de cada piloto na Wikipedia, e o
  `pageimages` de lá cobre 85% dos sorteáveis.
- **Retrato de Harry Potter, Senhor dos Anéis e Fórmula 1 vem de fora da API.**
  A HP-API traz imagem de só 25 dos 437 personagens e a LOTR API não traz
  nenhuma; com o `pageimages` do wiki de cada franquia são 95% e 100% dos
  sorteáveis com foto. Um único personagem ficou de fora do espelho local
  (Cassius Warrington, num formato que o `sharp` não abre) e continua apontando
  para a CDN.
- **Valorant · Agentes é um universo curto**: são 29 agentes e cinco colunas.
  Por isso existe também o **Valorant · Armas**, com custo, dano, cadência,
  pente e penetração — poucas opções, mas outra cabeça de dedução.
