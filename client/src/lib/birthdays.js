import marcus from '../assets/aniversarios/marcus.webp';
import andraus from '../assets/aniversarios/andraus.webp';

/**
 * Os aniversariantes que ganham parabens na home. Cada um aparece so no `day`
 * dele, ou o mes inteiro quando a entrada traz `month` no lugar (o aniversariante
 * do mes) — sempre no fuso do jogo, America/Sao_Paulo, e uma vez por navegador.
 * Passado o prazo, a entrada nao faz mais nada e pode ficar aqui ou sair.
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
      'Aproveita muito o seu dia, você merece! Parabéns!',
    ],
  },
  {
    month: '2026-10',
    name: 'Andraus',
    photo: andraus,
    title: 'Feliz aniversário, Andraus!',
    message: [
      'Passando aqui pra te desejar tudo de melhor nesse novo ciclo da sua vida. Que não faltem saúde, felicidade, paz e muitos momentos bons ao lado das pessoas que você gosta. Espero que esse novo ano seja cheio de oportunidades, conquistas e experiências que façam valer a pena cada momento.',
      'Que você consiga realizar seus planos e objetivos, superar os desafios que aparecerem pelo caminho e, principalmente, aproveitar bastante as coisas boas da vida. Que seja um ano de muito crescimento, mas também de muita diversão, risadas, rolês bons e histórias pra contar depois.',
      'Espero que você aproveite bastante seu dia, comemore muito e receba todo o carinho que merece. É sempre bom poder contar com uma amizade como a nossa, e espero que ainda tenhamos muitos momentos e histórias pela frente.',
      'Parabéns, meu amigo! Que esse novo ano venha melhor que o anterior e que seja só o começo de uma fase ainda melhor. Feliz aniversário!',
    ],
  },
];
