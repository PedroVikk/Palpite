import { getUniverse, roomDefaults } from '@shared/universes.js';
import { gameLabel, styleFits, styleLabel } from '../components/ModePick.jsx';

/**
 * O formulario das regras da sala, igual na criacao e na sala de espera. Ele
 * guarda `untilRight` a parte porque no servidor ele e so o
 * `guessesPerPlayer === 0`: guardar o numero editavel aqui evita que o campo de
 * chutes pisque enquanto o infinito esta ligado.
 *
 * O infinito (0) vale em qualquer modo para rodadas e relogio; nos chutes, em
 * todo modo que tem teto, menos o impostor (sem teto de voltas a mesa nunca
 * chegaria na votacao).
 */
export function newForm(universeId = 'pokemon') {
  return {
    game: 'segredo',
    mode: 'hunt',
    universe: universeId,
    ...roomDefaults(getUniverse(universeId)),
    rounds: 5,
    turnSeconds: 45,
    guessesPerPlayer: 6,
    untilRight: true,
    picture: false,
    card: false,
    choices: 3,
    cards: false,
    draftEvery: 2,
    speedSame: true,
    tableHints: false,
  };
}

export const fromSettings = (s) => ({
  game: s.game ?? 'segredo',
  mode: s.mode,
  universe: s.universe,
  groups: s.groups,
  scope: s.scope ?? null,
  rounds: s.rounds ?? 5,
  turnSeconds: s.turnSeconds ?? 45,
  guessesPerPlayer: s.guessesPerPlayer || 6,
  untilRight: s.guessesPerPlayer === 0,
  picture: Boolean(s.picture),
  card: Boolean(s.card),
  choices: s.choices || 3,
  cards: Boolean(s.cards),
  draftEvery: s.draftEvery || 2,
  speedSame: s.speedSame ?? true,
  tableHints: Boolean(s.tableHints),
});

/** O que cada chave vale de verdade no modo escolhido (o servidor desliga o resto). */
export function effective(f, comImagem = true) {
  const termo = f.game === 'termo';
  const impostor = f.mode === 'impostor';
  const battle = f.mode === 'battle';
  const quiz = f.mode === 'quiz';
  const speed = f.mode === 'speed';
  const plain = !impostor && !battle && !quiz && !termo && !speed;
  return {
    termo, impostor, battle, quiz, speed,
    duel: f.mode === 'duel',
    termoRace: termo && !battle && !speed,
    cards: f.cards && !termo && !speed,
    picture: f.picture && comImagem && plain,
    tableHints: f.tableHints && plain,
    card: f.card && impostor,
    untilRight: f.untilRight && !impostor,
  };
}

export const toSettings = (f, comImagem = true) => {
  const on = effective(f, comImagem);
  return {
    game: f.game,
    mode: f.mode,
    universe: f.universe,
    groups: f.groups,
    scope: f.scope,
    rounds: f.rounds,
    turnSeconds: f.turnSeconds,
    guessesPerPlayer: on.untilRight ? 0 : f.guessesPerPlayer,
    picture: on.picture,
    card: f.card,
    choices: f.choices,
    cards: on.cards,
    draftEvery: f.draftEvery,
    speedSame: f.speedSame,
    tableHints: on.tableHints,
  };
};

/**
 * Trocar de modo ou de estilo puxa os padroes dele (10 perguntas de 15 s no
 * "Qual deles?", 2 voltas no impostor, 6 linhas e 2 minutos no Termo). O que a
 * pessoa deixou infinito continua infinito.
 */
export function applyRules(form, patch, { comImagem = true } = {}) {
  const next = { ...form, ...patch };
  const keep = (key, value) => { if (next[key] !== 0) next[key] = value; };

  // no duelo o padrao e ter teto: e ele que deixa quem esconde pontuar
  if (next.mode === 'duel' && form.mode !== 'duel') next.untilRight = false;
  if (next.mode === 'impostor') {
    if (form.mode !== 'impostor') next.guessesPerPlayer = 2;
    next.untilRight = false;
  }
  if (next.mode === 'quiz' && form.mode !== 'quiz') {
    keep('rounds', 10);
    keep('turnSeconds', 15);
  }
  // na batalha cada rodada e uma batalha inteira
  if (next.mode === 'battle' && form.mode !== 'battle') keep('rounds', 1);
  else if (form.mode === 'battle' && next.mode !== 'battle' && next.rounds === 1) next.rounds = 5;

  if (next.game === 'termo') {
    if (!styleFits('termo', next.mode)) next.mode = 'hunt';
    if (form.game !== 'termo') {
      next.guessesPerPlayer = 6;
      next.untilRight = false;
    }
    // na corrida o relogio e o da rodada inteira; na batalha, o do turno
    const race = next.mode !== 'battle' && next.mode !== 'speed';
    const wasRace = form.game === 'termo' && form.mode !== 'battle' && form.mode !== 'speed';
    if (race !== wasRace) keep('turnSeconds', race ? 120 : 45);
  } else if (form.game === 'termo' && next.turnSeconds === 120) {
    next.turnSeconds = 45;
  }

  if (next.mode === 'speed' && form.mode !== 'speed') {
    keep('rounds', 3);
    keep('turnSeconds', 180);
  } else if (form.mode === 'speed' && next.mode !== 'speed') {
    keep('rounds', 5);
    keep('turnSeconds', next.game === 'termo' && next.mode !== 'battle' ? 120 : 45);
  }

  if (!comImagem) next.picture = false;
  return next;
}

/** Os atalhos da criacao: um clique monta a partida inteira. */
export const PRESETS = [
  {
    id: 'rapida', label: 'Partida rápida', note: '3 rodadas · 30 s · até acertar',
    patch: { game: 'segredo', mode: 'hunt', rounds: 3, turnSeconds: 30, untilRight: true, cards: false, picture: false, tableHints: false },
  },
  {
    id: 'classica', label: 'Clássica', note: '5 rodadas · 45 s · 6 chutes',
    patch: { game: 'segredo', mode: 'hunt', rounds: 5, turnSeconds: 45, untilRight: false, guessesPerPlayer: 6, cards: false, picture: false, tableHints: false },
  },
  {
    id: 'semfim', label: 'Sem fim', note: 'Rodadas, tempo e chutes infinitos',
    patch: { game: 'segredo', mode: 'hunt', rounds: 0, turnSeconds: 0, untilRight: true, cards: false, picture: false },
  },
  {
    id: 'imagem', label: 'Pela imagem', note: '5 rodadas · 45 s · figura borrada',
    patch: { game: 'segredo', mode: 'hunt', rounds: 5, turnSeconds: 45, untilRight: true, picture: true, cards: false, tableHints: false },
  },
  {
    id: 'termo', label: 'Termo', note: '5 rodadas · 2 min · 6 linhas',
    patch: { game: 'termo', mode: 'hunt', rounds: 5, turnSeconds: 120, untilRight: false, guessesPerPlayer: 6 },
  },
  {
    id: 'impostor', label: 'Impostor', note: '5 rodadas · 45 s · 2 voltas',
    patch: { game: 'segredo', mode: 'impostor', rounds: 5, turnSeconds: 45, guessesPerPlayer: 2, untilRight: false, cards: false },
  },
  {
    id: 'quiz', label: 'Qual deles?', note: '10 perguntas · 15 s · 3 opções',
    patch: { game: 'segredo', mode: 'quiz', rounds: 10, turnSeconds: 15, choices: 3, cards: false },
  },
  {
    id: 'cartas', label: 'Com cartas', note: '5 rodadas · 45 s · draft a cada 2',
    patch: { game: 'segredo', mode: 'hunt', rounds: 5, turnSeconds: 45, untilRight: true, cards: true, draftEvery: 2 },
  },
];

/** O atalho aplicado por cima do que ja esta: os valores dele vencem os padroes do modo. */
export const applyPreset = (form, preset, opts) => ({ ...applyRules(form, preset.patch, opts), ...preset.patch });

export const presetOn = (form, preset) =>
  Object.entries(preset.patch).every(([key, value]) => form[key] === value);

const clock = (s) => {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m}min${String(s % 60).padStart(2, '0')}` : `${m} min`;
};

/** O resumo da sala em linhas curtas: o que a mesa vai jogar, sem ler o formulario inteiro. */
export function summaryOf(f, universe, comImagem = true) {
  const on = effective(f, comImagem);
  const noun = on.quiz ? ['pergunta', 'perguntas']
    : on.speed ? (on.termo ? ['palavra', 'palavras'] : ['segredo', 'segredos'])
    : on.battle ? ['batalha', 'batalhas'] : ['rodada', 'rodadas'];

  const scopeAxis = universe.scope && !universe.scope.nested;
  const cut = scopeAxis
    ? { k: universe.scope.label, on: f.scope?.length ?? universe.scope.options.length, of: universe.scope.options.length }
    : { k: universe.groupLabel, on: f.groups.length, of: universe.groups.length };

  const perTime = on.quiz ? 'por pergunta' : on.speed ? 'de corrida' : on.termoRace ? 'por rodada' : 'por vez';
  const guesses = on.quiz ? `${f.choices} opções`
    : on.battle || (on.speed && !on.termo) ? 'Sem teto'
    : on.impostor ? `${f.guessesPerPlayer} ${f.guessesPerPlayer === 1 ? 'volta' : 'voltas'}`
    : on.untilRight ? (on.termo ? 'Linhas sem fim' : 'Até acertar')
    : on.termo ? `${f.guessesPerPlayer} linhas`
    : `${f.guessesPerPlayer} por jogador`;

  const extras = [
    on.cards && 'Cartas',
    on.picture && 'Imagem',
    on.tableHints && 'Dicas da mesa',
    on.card && 'Ficha dos chutes',
    on.speed && !f.speedSame && 'Filas separadas',
  ].filter(Boolean);

  return [
    { k: 'Jogo', v: `${gameLabel(f.game)} · ${styleLabel(f.mode)}` },
    { k: 'Tema', v: universe.label },
    { k: cut.k, v: cut.on >= cut.of ? 'Tudo' : `${cut.on} de ${cut.of}` },
    { k: noun[1][0].toUpperCase() + noun[1].slice(1), v: f.rounds === 0 ? 'Sem fim' : `${f.rounds} ${f.rounds === 1 ? noun[0] : noun[1]}` },
    { k: 'Tempo', v: f.turnSeconds === 0 ? 'Sem relógio' : `${clock(f.turnSeconds)} ${perTime}` },
    { k: on.quiz ? 'Opções' : on.impostor ? 'Voltas' : on.termo ? 'Linhas' : 'Chutes', v: guesses },
    { k: 'Extras', v: extras.length ? extras.join(', ') : 'Nenhum' },
  ];
}
