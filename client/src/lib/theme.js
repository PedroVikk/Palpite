/**
 * Os temas visuais do jogo. As cores e as fontes moram em styles/tokens.css,
 * cada tema num bloco `[data-theme="<id>"]`; aqui fica só a lista (para a
 * janela de escolha) e o vai e vem do `data-theme` no <html>.
 *
 * O tema escolhido é do navegador, não da conta: vive no localStorage, como o
 * nome. O index.html lê a mesma chave antes do React subir, para a página já
 * nascer na cor certa em vez de piscar no Sépia e trocar.
 */

// `scheme` diz se o tema é claro ou escuro: a marca dos universos sai na cor
// escura deles no claro e na clara no escuro (ver .mark-art no app.css)
export const THEMES = [
  {
    id: 'sepia',
    name: 'Sépia',
    scheme: 'light',
    blurb: 'Papel quente e tinta marrom, como leitor de livro digital. O mais descansado para uma partida longa.',
    bar: '#F1E8D6',
  },
  {
    id: 'crepusculo',
    name: 'Crepúsculo',
    scheme: 'dark',
    blurb: 'Escuro em roxo-noite, com rosa e lilás suaves. Para jogar de noite sem ofuscar.',
    bar: '#191724',
  },
  {
    id: 'manga',
    name: 'Mangá',
    scheme: 'light',
    blurb: 'Tinta preta, retícula e carimbo vermelho. A tabela se lê até sem enxergar cor.',
    bar: '#F7F3EA',
  },
  {
    id: 'mesa',
    name: 'Mesa de cartas',
    scheme: 'dark',
    blurb: 'Feltro verde, cartas creme e botões gordos, como mesa de jogo.',
    bar: '#0E3B33',
  },
  {
    id: 'fliperama',
    name: 'Fliperama',
    scheme: 'dark',
    blurb: 'Neon sobre roxo e linhas de tubo, com títulos em pixel. Arcade dos anos 90.',
    bar: '#120B24',
  },
];

export const DEFAULT_THEME = 'sepia';
const KEY = 'palpite:tema';

const byId = (id) => THEMES.find(t => t.id === id) ?? null;
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

/** O tema que a pessoa confirmou, ou null se ela ainda não escolheu nenhum. */
export const savedTheme = () => {
  const id = safe(() => localStorage.getItem(KEY));
  return byId(id) ? id : null;
};

export const saveTheme = (id) => safe(() => localStorage.setItem(KEY, id));

export const themeInfo = (id) => byId(id) ?? byId(DEFAULT_THEME);

/** Pinta a página com o tema, sem guardar nada — é o que a prévia usa. */
export function applyTheme(id) {
  const theme = themeInfo(id);
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.dataset.scheme = theme.scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bar);
}

/**
 * Abre a escolha de tema de qualquer tela. É um evento, e não uma prop, porque
 * o botão mora nas três barras do topo e quem desenha a janela é o App.
 */
const OPEN = 'palpite:visual';
export const openThemePicker = () => dispatchEvent(new Event(OPEN));
export const onOpenThemePicker = (handler) => {
  addEventListener(OPEN, handler);
  return () => removeEventListener(OPEN, handler);
};
