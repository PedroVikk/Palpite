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

/** Máscara do modo impostor: quem está na mesa sem saber o segredo. */
export const MaskIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 6.5c3-1.3 6-1.5 9-1.5s6 .2 9 1.5c0 6.5-3.6 11-9 12.5C6.6 17.5 3 13 3 6.5Z" />
    <path d="M7 10.5c.8-.7 2.2-.7 3 0M14 10.5c.8-.7 2.2-.7 3 0M9.5 15c1.5.8 3.5.8 5 0" />
  </svg>
);

/** Balão com interrogação, do "Qual deles?". */
export const QuestionIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v9a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 14.5Z" />
    <path d="M9.8 8.2a2.3 2.3 0 0 1 4.4.8c0 1.5-2.2 1.9-2.2 3.2M12 14.4v.1" />
  </svg>
);

/** Âncora da batalha naval. */
export const AnchorIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v14M8 11h8M4.5 13.5A7.5 7.5 0 0 0 12 21a7.5 7.5 0 0 0 7.5-7.5" />
  </svg>
);

export const EyeIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M10.6 5.6A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.3 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.6 4.6-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </svg>
);

/** Ficha: um cartão com linhas, para a opção de mostrar os dados do chutado. */
export const CardIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <circle cx="8.5" cy="11" r="2" />
    <path d="M5.5 16c.6-1.3 1.7-2 3-2s2.4.7 3 2M14 10h4M14 13.5h4" />
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

export const ImageIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="m4 17 4.5-4.5a2 2 0 0 1 2.8 0L16 17M14.5 15.5l1.8-1.8a2 2 0 0 1 2.8 0L21 16" />
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

/** Chama da sequencia de dias — o unico icone que carrega orgulho, nao funcao. */
export const FlameIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 2s5 4.5 5 9a5 5 0 0 1-10 0c0-1.5.5-2.8 1.2-3.8C8.6 9.7 9.5 11 11 11c0-3 1-6 1-9Z" />
  </svg>
);

/**
 * O "G" do Google, nas quatro cores oficiais. E o unico icone do arquivo que
 * nao herda `currentColor`: a marca de entrar com o Google tem forma e cor
 * definidas por eles, e desenha-la de outro jeito seria descaracterizar.
 */
export const GoogleIcon = (props) => (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden {...props}>
    <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z" />
    <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z" />
    <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5A22 22 0 0 0 2 24c0 3.6.9 6.9 2.5 9.9l7.3-5.7z" />
    <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
  </svg>
);
