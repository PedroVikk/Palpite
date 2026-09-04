# Marcas dos universos

Cada universo tem uma silhueta própria — a marca-d'água que aparece atrás do
segredo do dia e na lateral do modal de criar sala. Antes era a pokébola em
todo lugar: o card do diário de Clash Royale mostrava uma pokébola.

**Universo novo precisa de uma marca.** É a única peça da camada visual que não
se vira sozinha, e por isso `npm test` cobra ela por nome. O resto deste
documento é como desenhar e onde encaixar.

---

## 1. Onde ficam

`data/marks/<id>.png` — o id é o mesmo de [shared/universes.js](../shared/universes.js),
sem tabela de conversão no meio. Servido em `/marks/<id>.png` pelo Express
([http.js](../src/http.js), ao lado de `/sprites` e `/icons`), com o proxy do
Vite espelhando em dev ([vite.config.js](../client/vite.config.js)).

Formato: **PNG 256x256, RGBA, branco puro (255,255,255) sobre transparente**.
A cor não é escolha do arquivo — os quatro slots pintam de branco e só variam
a opacidade. Um arquivo colorido apareceria escuro e sujo no fundo.

## 2. Onde aparecem

O mesmo arquivo serve os três slots, mudando só escala e opacidade:

| Onde | Arquivo | Classe | Tamanho | Opacidade |
| --- | --- | --- | --- | --- |
| Card do diário (o maior, é por ele que se julga) | [HomeScreen.jsx](../client/src/screens/HomeScreen.jsx) | `.silhouette .art` | 210px | .09 |
| Lateral do modal de criar sala | [CreateRoomModal.jsx](../client/src/components/CreateRoomModal.jsx) | `.side-art` | 150px | .07 |
| Canto do card "Desafio diário" | [HomeScreen.jsx](../client/src/screens/HomeScreen.jsx) | `.mode-card .corner` | 140px | .04 |

O quarto lugar onde havia pokébola — o fundo `fixed` da página
([Ambient.jsx](../client/src/components/Ambient.jsx)) — **continua com a
pokébola de propósito**: é o papel de parede do jogo inteiro, não de um
universo. Segue usando o `BallMark` SVG de [Icon.jsx](../client/src/components/Icon.jsx).

O caminho sai de [universeMeta.js](../client/src/lib/universeMeta.js):
`universeMeta(id).mark`. Id desconhecido cai em `/marks/pokemon.png` — marca
errada é menos ruim que quadrado quebrado, mas é justamente o que o teste
existe para impedir.

## 3. As restrições do desenho

Vêm todas do slot maior, o do card do diário ([app.css](../client/src/styles/app.css)):

- **Massa sólida.** A 9% de opacidade sobre `#070C1B` não existe contraste:
  aparece o volume, não o detalhe. Nada mais fino que 6 unidades em 100,
  nada menor que 8.
- **Corte vertical.** A caixa tem 176px de altura e a arte 210px de largura —
  topo e base saem. Só o que está entre **y=8 e y=92** (de 100) aparece.
- **Miolo livre.** Um `?` de 56px senta no centro. Um círculo de raio 17 em
  torno do centro precisa ser vazado ou massa lisa. Na pokébola isso é o botão
  central; é por isso que ela funciona.
- **Sem texto.** Nenhuma letra ou número — o monograma já existe em
  `universeMeta.js` e é ele que cobre esse papel.
- **Símbolo, não logotipo.** A forma genérica que evoca a obra (o objeto, o
  brasão), não a marca registrada da franquia.

Para conferir um arquivo novo contra isso sem abrir editor de imagem, o que
importa é: bounding box dentro de y 14–85 (das 22 atuais, nenhuma passa disso),
preenchimento entre 8% e 26% da tela, e RGB 255,255,255 em tudo que não é
transparente.

E olhe a imagem antes de aceitar: o erro que a primeira rodada cometeu foi
desenhar o "?" dentro da marca. Ele é do aplicativo, não do desenho.

## 4. O prompt

Gerador de imagem, um por universo — trocar só a última linha:

```
Desenhe um ícone "marca d'água" para o painel de um jogo de adivinhação.

Saída: PNG 256x256, fundo TRANSPARENTE, forma em BRANCO PURO (#FFFFFF) chapado.
Sem cor, sem sombra, sem gradiente, sem contorno, sem textura, sem fundo.

Ele será exibido a 210x210px com 9% de opacidade sobre um azul quase preto
(#070C1B) — quase invisível: só a MASSA da forma vai aparecer. Então:

- Forma sólida e cheia, silhueta única, tipo pictograma de sinalização.
  Não é ilustração, não é line-art, não é mascote com rosto detalhado.
- Nenhum traço mais fino que 6% da largura. Nenhum detalhe menor que 8%.
- Nenhuma letra, número ou texto.
- A forma ocupa de 15% a 85% da largura, centralizada e equilibrada.
- Será cortada no topo e na base: tudo que importa fica entre 15% e 85% da
  altura. Nada de ponta fina saindo por cima ou por baixo.
- NÃO DESENHE UM PONTO DE INTERROGAÇÃO. Nenhum. O aplicativo desenha o "?" por
  cima, em outra fonte — se ele já vier na imagem, aparecem dois sobrepostos, e
  a marca ainda carrega um "?" nos lugares onde não há nada a adivinhar.
- Reserve o centro para esse "?" que vem depois: um círculo de raio 17% no meio
  da imagem precisa ser vazado ou massa lisa uniforme, e vazio.
- Não copie um logotipo registrado: faça o símbolo genérico que evoca a obra
  (o objeto, o brasão, a forma), não a marca oficial da franquia.
- Se a silhueta não se reconhece a 9% de opacidade, simplifique em vez de
  acrescentar detalhe.

Desenhe o de: <UNIVERSO> — <SÍMBOLO>
```

## 5. O que cada uma é

| Id | Universo | Símbolo |
| --- | --- | --- |
| `pokemon` | Pokémon | pokébola |
| `bleach` | Bleach | máscara de Hollow, crânio com fendas verticais |
| `clash` | Clash Royale | coroa de batalha, três pontas com esferas |
| `naruto` | Naruto | espiral grossa de redemoinho |
| `yugioh` | Yu-Gi-Oh! | carta virada de costas, losango no centro |
| `lol` | League of Legends | cristal facetado do Nexus |
| `valorant` | Valorant · Agentes | Spike: cilindro com pontas radiais |
| `valorant-armas` | Valorant · Armas | silhueta de rifle de perfil |
| `rickmorty` | Rick and Morty | portal: elipse com espiral concêntrica |
| `heroes` | Super-heróis | escudo com raio no meio |
| `potter` | Harry Potter | óculos redondos com raio entre as lentes |
| `lotr` | Senhor dos Anéis | anel grosso com árvore vazada dentro |
| `f1` | Fórmula 1 | capacete de piloto de perfil |
| `cars` | Carros | volante de três raios |
| `mlp` | My Little Pony | cabeça de pônei de perfil com crina |
| `onepiece` | One Piece | caveira com chapéu de palha |
| `dragonball` | Dragon Ball | esfera com quatro estrelas |
| `hxh` | Hunter × Hunter | punho envolto em aura em chamas |
| `ordem` | Ordem Paranormal | quatro losangos em cruz (os elementos) |
| `ben10` | Ben 10 | Omnitrix: círculo com ampulheta central |
| `jojo` | JoJo | estrela de cinco pontas |
| `famosos` | Famosos | busto de perfil dentro de moldura oval |

## 6. Universo novo: o checklist

1. Gerar a marca com o prompt da seção 4.
2. Salvar como `data/marks/<id>.png`, com o **mesmo id** de `shared/universes.js`.
3. `npm test` — o bloco "Todos os universos" verifica o arquivo por nome. Sem
   ele, falha com `<Universo>: tem marca em data/marks/<id>.png`.

Não precisa mexer em CSS nem nos componentes: o caminho sai do id sozinho.
