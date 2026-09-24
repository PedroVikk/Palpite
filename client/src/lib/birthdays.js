import marcus from '../assets/aniversarios/marcus.webp';

/**
 * Os aniversariantes que ganham parabens na home. Cada um aparece so no `day`
 * dele (no fuso do jogo, America/Sao_Paulo) e uma vez por navegador; passado o
 * dia, a entrada nao faz mais nada e pode ficar aqui ou sair.
 *
 * Para colocar alguem: a foto em assets/aniversarios/, o import acima e uma
 * entrada abaixo. `message` sao os paragrafos do recado, na ordem.
 */
export const BIRTHDAYS = [
  {
    day: '2026-09-24',
    name: 'Marcus Mitra',
    photo: marcus,
    title: 'Feliz aniversário, Marcus!',
    message: [
      'Te desejo muita saúde, felicidade, sucesso e muitas conquistas nessa nova fase da sua vida. Que não faltem bons momentos, pessoas especiais ao seu lado e motivos para comemorar.',
      'Aproveita muito o seu dia, você merece! Parabéns! 🎉',
    ],
  },
];
