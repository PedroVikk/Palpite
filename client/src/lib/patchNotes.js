/**
 * As novidades que aparecem na home, da mais nova para a mais velha. Cada
 * entrada e um dia de atualizacao escrito para quem joga (nao o log do git):
 * o que mudou na mesa, sem nome de arquivo.
 *
 * Cada entrada tem secoes (Cartas, Tabela...), cada secao tem grupos com um
 * titulo curto e os itens. Um item pode ser texto ou `{ text, sub }`, quando
 * precisa de uma lista por dentro.
 *
 * Para publicar uma nova: uma entrada no topo com `id` novo. O `id` do topo e o
 * que acende a bolinha do botao "Novidades" para quem ainda nao abriu.
 */
export const PATCH_NOTES = [
  {
    id: '2026-09-29',
    date: '29 de setembro',
    title: 'Trocas no Draft, Recompra e uma tabela mais esperta',
    sections: [
      {
        head: 'Cartas',
        groups: [
          {
            head: 'Trocas de Draft',
            items: [
              'Venceu a rodada? Você ganha 1 troca de Draft, podendo guardar até 2.',
              'A regra Melhor Detetive também recompensa quem mais descobriu colunas sem vencer a rodada.',
              'Está em último e sem trocas? Você ganha 1 de graça.',
            ],
          },
          {
            head: 'Recompra',
            items: [
              'Uma nova carta entrou no baralho.',
              'A Recompra permite trocar as 3 cartas do Draft de uma só vez.',
              'Ela fica guardada na sua mão até você decidir usar.',
            ],
          },
          {
            head: 'Draft',
            items: [
              'O relógio agora fica sempre visível durante o Draft.',
              'Adicionamos atalhos rápidos para selecionar as cartas com 1, 2 e 3.',
              'Bússola, Raio-X, Letra e Espiar agora revelam o resultado no verso da carta.',
            ],
          },
        ],
      },
      {
        head: 'Tabela',
        groups: [
          {
            head: 'Busca Inteligente',
            items: [
              'A busca agora respeita as informações descobertas pela mesa.',
              'Com a regra da sala ativada, nomes já descartados deixam de aparecer.',
              'A Peneira também considera apenas os nomes que continuam possíveis.',
            ],
          },
          {
            head: 'Mais informações, menos adivinhação',
            items: [
              'Adicionamos a faixa Já se sabe.',
              'Setas duplas agora indicam quando um chute está muito distante.',
              'Toque em uma célula para ver suas informações.',
              'Novos chutes recebem um carimbo visual.',
              'O histórico da rodada agora registra as cartas utilizadas.',
            ],
          },
          {
            head: 'Visual Mangá',
            items: [
              'Acertos aparecem em verde.',
              'Resultados próximos aparecem em amarelo com retícula.',
              'Erros aparecem em vermelho com hachuras.',
            ],
          },
        ],
      },
      {
        head: 'Sala',
        groups: [
          {
            head: 'Mais controle',
            items: [
              'Avisos da sala agora aparecem no canto da tela.',
              'Um novo painel permite configurar som, vibração, piscar e notificações, inclusive quando a aba está em segundo plano.',
            ],
          },
          {
            head: 'Sua vez',
            items: [
              'Um novo cartão reúne as ações disponíveis: Pular, Pedir Dica e Desistir.',
              'O custo de cada ação fica visível antes de confirmar.',
            ],
          },
          {
            head: 'Sem limites',
            items: [
              'Todos os modos agora podem ser jogados no Infinito.',
              'Rodadas, tempo e chutes deixam de ter limite.',
              'No modo Impostor, os chutes continuam limitados.',
            ],
          },
          {
            head: 'Criando uma sala',
            items: [
              'O fluxo de criação foi reorganizado.',
              'Atalhos prontos, como Sem Fim, agora ficam mais fáceis de encontrar.',
              'O resumo da partida aparece ao lado durante a configuração.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: '2026-09-28',
    date: '28 de setembro',
    title: 'O Termo chegou, cinco visuais e quatro temas novos',
    sections: [
      {
        head: 'Modos',
        groups: [
          {
            head: 'Termo',
            items: [
              'Apresentamos o Termo: descubra a palavra do tema, letra por letra.',
              'A categoria fica visível durante toda a partida.',
              'O modo está disponível no Diário e nas Salas, além de Caça, Duelo, Batalha Naval e do novo modo Velocidade.',
            ],
          },
          {
            head: 'Cartas em todos os modos',
            items: [
              'Cartas deixaram de ser um modo separado.',
              'Agora, Jogar com Cartas é uma opção que pode ser ativada em qualquer modo compatível.',
            ],
          },
          {
            head: 'Baralho de verdade',
            items: [
              'O baralho agora conta com 17 cartas, cada uma com ilustração e raridade.',
              'Cartas de ataque permitem escolher o alvo.',
              'A jogada realizada agora aparece para todos na mesa.',
            ],
          },
        ],
      },
      {
        head: 'Temas',
        groups: [
          {
            head: 'Novos temas',
            items: [
              'Animais chegou à mesa.',
              'Deuses traz 10 panteões, incluindo o conjunto completo de orixás.',
              'Desenhos Animados chega com 471 personagens de 42 desenhos.',
            ],
          },
          {
            head: 'Dragon Ball',
            items: [
              'O tema foi reformulado.',
              'Agora são 117 personagens, com colunas pensadas para facilitar aquelas respostas que você já sabe de cabeça.',
            ],
          },
        ],
      },
      {
        head: 'Visual',
        groups: [
          {
            head: 'Cinco novos visuais',
            items: [
              { text: 'Escolha seu estilo pelo botão Visual:', sub: ['Sépia', 'Crepúsculo', 'Mangá', 'Mesa de Cartas', 'Fliperama'] },
            ],
          },
          {
            head: 'Uma Home mais simples',
            items: [
              'A Home agora tem duas portas principais: Diário e Amigos.',
              'O tema do dia abre automaticamente no modo que você mais joga.',
            ],
          },
          {
            head: 'Saída segura',
            items: [
              'Sair de uma partida agora exige confirmação.',
            ],
          },
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
        head: 'Temas',
        groups: [
          {
            head: 'Bandas',
            items: [
              'Um novo tema chega com 336 bandas, sendo 91 brasileiras.',
              'As bandas estão organizadas por estilo e divididas entre Nacionais e Internacionais.',
            ],
          },
          {
            head: 'LoL',
            items: [
              'As posições dos campeões agora representam as rotas em que eles são jogados.',
              'E sim, corrigimos aquela Ambessa que estava aparecendo como Ahri.',
            ],
          },
          {
            head: 'Diário',
            items: [
              'O Diário na Home agora tem um único botão.',
              'A troca entre Dicas e Imagem acontece dentro do próprio Diário.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: '2026-09-23',
    date: '23 de setembro',
    title: 'Impostor, Batalha Naval e “Qual Deles?”',
    sections: [
      {
        groups: [
          {
            head: 'Impostor',
            items: [
              'Todos recebem o segredo, menos um jogador.',
              'A mesa precisa descobrir quem está escondendo a informação.',
              'Depois dos chutes e da votação, o jogador descoberto ainda tem uma última chance de acertar o segredo.',
            ],
          },
          {
            head: 'Batalha Naval',
            items: [
              'Cada jogador esconde seu próprio segredo.',
              'Ataque os segredos dos adversários até restar apenas um jogador.',
            ],
          },
          {
            head: 'Qual Deles?',
            items: [
              'Responda perguntas de múltipla escolha sobre o tema.',
              'Em algumas rodadas, uma silhueta aparece para testar seus conhecimentos no melhor estilo “Quem é esse Pokémon?”.',
            ],
          },
          {
            head: 'Imagens',
            items: [
              'O modo por imagem agora começa em um nível de definição maior.',
              'Menos espera, mais chance de arriscar aquele primeiro palpite.',
            ],
          },
        ],
      },
    ],
  },
];

export const LATEST_NOTE = PATCH_NOTES[0].id;
