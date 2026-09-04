/**
 * Ícones inline, em SVG no bundle — a página não depende de terceiros para
 * desenhar a interface. Todos herdam `currentColor` e o traço de 2px, então
 * mudam de cor junto com o texto ao redor.
 */
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const SearchIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const SendIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const CopyIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const ShareIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);

export const TrophyIcon = (props) => (
  <svg {...base} width="34" height="34" {...props}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
    <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
    <path d="M12 14v4M9 21h6M10 18h4" />
  </svg>
);

export const ExitIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </svg>
);

export const RestartIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 11a9 9 0 1 1 2.6 6.4" />
    <path d="M3 5v6h6" />
  </svg>
);

export const ClockIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const TargetIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);

export const UsersIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
  </svg>
);

export const PlusIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MinusIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M5 12h14" />
  </svg>
);

export const CheckIcon = (props) => (
  <svg {...base} strokeWidth={2.6} {...props}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const CloseIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const ChevronIcon = (props) => (
  <svg {...base} {...props}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const SettingsIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

export const CalendarIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M8 2v4M16 2v4M3 10h18" />
  </svg>
);

export const SwordsIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M5 21l6-6M3 18l3 3" />
  </svg>
);

export const SparkIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </svg>
);

export const BulbIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" />
  </svg>
);

export const LockIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="4" y="10" width="16" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export const ChartIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 20v-6M6 20v-3M18 20V8" />
  </svg>
);

export const EnterIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
  </svg>
);

export const InfoIcon = (props) => (
  <svg {...base} width="13" height="13" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

/** A pokébola: assinatura discreta do jogo, usada como marca-d'água no fundo. */
export const BallMark = (props) => (
  <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden {...props}>
    <path d="M50 2a48 48 0 1 0 0 96 48 48 0 0 0 0-96Zm0 10a38 38 0 0 1 37.6 33H62a12 12 0 0 0-24 0H12.4A38 38 0 0 1 50 12Zm0 26a12 12 0 1 1 0 24 12 12 0 0 1 0-24Zm-37.6 17H38a12 12 0 0 0 24 0h25.6A38 38 0 0 1 12.4 55Z" />
  </svg>
);

/**
 * O "H" da Honda, desenhado a mao em vez de baixado: Carros e o unico universo
 * sem miniatura nenhuma no espelho (nenhum dos 1570 carros tem imagem), entao
 * o selo dele precisava de uma forma propria. Montanhas verticais que abrem
 * para cima e para baixo, travessao no meio, tudo dentro do retangulo.
 */
export const HondaMark = (props) => (
  <svg viewBox="0 0 100 100" fill="none" aria-hidden {...props}>
    <rect x="9" y="19" width="82" height="62" rx="11" stroke="currentColor" strokeWidth="7" />
    <path d="M23 29h16v13h22V29h16l-6 21 6 21H61V58H39v13H23l6-21z" fill="currentColor" />
  </svg>
);
