/**
 * As novidades que aparecem na home, da mais nova para a mais velha. Cada
 * entrada e um dia de atualizacao escrito para quem joga (nao o log do git):
 * o que mudou na mesa, sem nome de arquivo.
 *
 * Para publicar uma nova: uma entrada no topo com `id` novo. O `id` do topo e o
 * que acende a bolinha do botao "Novidades" para quem ainda nao abriu.
 */
export const PATCH_NOTES = [
  {
    id: '2026-09-29',
    date: '29 de setembro',
    title: 'Trocas no draft, a Recompra e uma tabela que explica',
    sections: [
      {
        head: 'Cartas',
        items: [
          'Quem vence a rodada ganha uma troca de draft (guarda até 2). Com a regra “Melhor detetive”, quem mais descobriu colunas sem vencer também ganha uma, e quem está em último sem troca leva uma de brinde.',
          'Carta nova, a Recompra: guardada na mão, troca as três cartas do draft de uma vez.',
          'O draft ficou animado, com o relógio à vista e atalhos 1, 2 e 3.',
          'Bússola, Raio-X, Letra e Espiar viram e mostram o resultado no verso.',
        ],
      },
      {
        head: 'Tabela',
        items: [
          'Busca esperta (regra da sala): some da busca quem a tabela já descartou, e a Peneira corta só entre os nomes ainda possíveis.',
          'Faixa “Já se sabe”, seta dupla para erro longe, balão ao tocar na célula, carimbo no chute novo e o registro das cartas da rodada.',
          'No visual Mangá, acerto verde, perto amarelo com retícula e erro vermelho hachurado.',
        ],
      },
      {
        head: 'Sala',
        items: [
          'Avisos da sala no canto da tela, e um painel para ligar som, vibração, piscar e notificação com a aba em segundo plano.',
          'Na sua vez, um cartão com pular, pedir dica e desistir, com o custo de cada um.',
          'Infinito em todo modo: rodadas, tempo e chutes (os chutes só não no impostor).',
          'Criar sala foi reorganizado, com atalhos prontos (como o “Sem fim”) e o resumo da partida ao lado.',
        ],
      },
    ],
  },
  {
    id: '2026-09-28',
    date: '28 de setembro',
    title: 'O Termo, cinco visuais e quatro temas novos',
    sections: [
      {
        head: 'Modos',
        items: [
          'Chegou o Termo: a palavra do tema letra a letra (um nome ou algo do universo), com a categoria à vista. Joga no diário e na sala, na caça, no duelo, na batalha naval e na nova velocidade.',
          'As cartas deixaram de ser um modo e viraram a chave “Jogar com cartas”, que vale em todos.',
          'Baralho de verdade: 17 cartas com ilustração e raridade, alvo escolhido nas de ataque e a jogada aparecendo na tela de todo mundo.',
        ],
      },
      {
        head: 'Temas',
        items: [
          'Entraram Animais, Deuses (dez panteões, com os orixás inteiros) e Desenhos animados (471 personagens de 42 desenhos).',
          'Dragon Ball foi refeito: 117 personagens e colunas que dá para saber de cabeça.',
        ],
      },
      {
        head: 'Visual',
        items: [
          'Cinco visuais para escolher pelo botão “Visual”: Sépia, Crepúsculo, Mangá, Mesa de cartas e Fliperama.',
          'A home virou duas portas, diário e amigos, e o tema do dia abre no que você mais joga.',
          'Sair da partida agora pede confirmação.',
        ],
      },
    ],
  },
  {
    id: '2026-09-24',
    date: '24 de setembro',
    title: 'As bandas entram na mesa',
    sections: [
      {
        items: [
          'Tema novo com 336 bandas, 91 delas brasileiras, separadas por estilo e por Nacionais e Internacionais.',
          'LoL: as posições agora são as rotas em que cada campeão é jogado, e a Ambessa deixou de ser a Ahri.',
          'O diário na home ganhou um botão só; a troca entre dicas e imagem fica lá dentro.',
        ],
      },
    ],
  },
  {
    id: '2026-09-23',
    date: '23 de setembro',
    title: 'Impostor, batalha naval e “Qual deles?”',
    sections: [
      {
        items: [
          'Impostor: todos sabem o segredo, menos um. A mesa chuta, vota, e quem for pego ainda tem um chute final.',
          'Batalha naval: cada um esconde o próprio segredo e atira no dos outros até sobrar um de pé.',
          '“Qual deles?”: perguntas de múltipla escolha sobre o tema, com a silhueta do “Quem é esse Pokémon?” de vez em quando.',
          'O modo pela imagem começa mais nítido, onde já dá para arriscar um palpite.',
        ],
      },
    ],
  },
];

export const LATEST_NOTE = PATCH_NOTES[0].id;
