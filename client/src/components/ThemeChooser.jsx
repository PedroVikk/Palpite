import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_THEME, THEMES, applyTheme, onOpenThemePicker, saveTheme, savedTheme, themeInfo,
} from '../lib/theme.js';
import Modal from './Modal.jsx';
import MarkArt from './MarkArt.jsx';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, PaletteIcon } from './Icon.jsx';

/**
 * A escolha do visual, em dois passos.
 *
 * 1. A lista: cinco cartões, cada um desenhado com o próprio tema (o cartão
 *    abre um `data-theme` só dele, então as cores e as fontes são as de
 *    verdade). Aparece sozinha na primeira visita e depois pelo botão
 *    "Visual" do topo.
 * 2. A prova: clicar num cartão fecha a lista e pinta o site inteiro com o
 *    tema, sem salvar. No canto fica a pergunta — "vai ser essa?". Sim guarda;
 *    Não devolve o tema de antes e reabre a lista para escolher outro. As setas
 *    trocam de tema ali mesmo, sem voltar à lista.
 *
 * Um cartão é bonito, mas o tema só se julga em cima do jogo — por isso a
 * prévia é a página de verdade, e não uma miniatura.
 */
export default function ThemeChooser({ toast, onBusy }) {
  const [saved, setSaved] = useState(savedTheme);
  // quem nunca escolheu cai direto na lista; quem já escolheu só vê a lista
  // quando pede
  const [phase, setPhase] = useState(() => (savedTheme() ? 'closed' : 'picking'));
  const [trying, setTrying] = useState(null);
  const firstVisit = !saved;
  const dockRef = useRef(null);

  const current = saved ?? DEFAULT_THEME;

  useEffect(() => onOpenThemePicker(() => setPhase('picking')), []);
  useEffect(() => { onBusy?.(phase !== 'closed'); }, [phase, onBusy]);

  const tryTheme = (id) => {
    applyTheme(id);
    setTrying(id);
    setPhase('trying');
  };

  const step = (delta) => {
    const at = THEMES.findIndex(t => t.id === trying);
    tryTheme(THEMES[(at + delta + THEMES.length) % THEMES.length].id);
  };

  const accept = () => {
    saveTheme(trying);
    setSaved(trying);
    setPhase('closed');
    toast?.(`${themeInfo(trying).name} salvo. Dá para trocar em "Visual", no topo.`);
  };

  // "não" desfaz a prova e volta para a lista, para escolher outro
  const refuse = useCallback(() => {
    applyTheme(current);
    setTrying(null);
    setPhase('picking');
  }, [current]);

  // fechar a lista sem escolher: na primeira vez fica o padrão, e ele passa a
  // valer como escolhido para a janela não voltar a cada visita
  const closeList = useCallback(() => {
    applyTheme(current);
    if (firstVisit) {
      saveTheme(DEFAULT_THEME);
      setSaved(DEFAULT_THEME);
      toast?.(`Ficou o ${themeInfo(DEFAULT_THEME).name}. Dá para trocar em "Visual", no topo.`);
    }
    setPhase('closed');
  }, [current, firstVisit, toast]);

  // na prova o Esc é o "não", e o foco vai para a pergunta
  useEffect(() => {
    if (phase !== 'trying') return undefined;
    dockRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') refuse();
      if (event.key === 'ArrowRight' && event.altKey) step(1);
      if (event.key === 'ArrowLeft' && event.altKey) step(-1);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  if (phase === 'trying') {
    const theme = themeInfo(trying);
    return (
      <div className="theme-dock" role="dialog" aria-label="Confirmar o visual" tabIndex={-1} ref={dockRef}>
        <div className="q">
          <span className="k"><PaletteIcon width={13} height={13} />Prévia</span>
          <b>{theme.name}</b>
          <span className="ask">Vai ser essa?</span>
        </div>
        <div className="nav">
          <button type="button" className="icon-btn" aria-label="Tema anterior" onClick={() => step(-1)}>
            <ArrowLeftIcon width={18} height={18} />
          </button>
          <button type="button" className="icon-btn" aria-label="Próximo tema" onClick={() => step(1)}>
            <ArrowRightIcon width={18} height={18} />
          </button>
        </div>
        <div className="answer">
          <button type="button" className="btn ghost small" onClick={refuse}>Não</button>
          <button type="button" className="btn primary small" onClick={accept}>
            <CheckIcon width={15} height={15} />Sim
          </button>
        </div>
      </div>
    );
  }

  if (phase !== 'picking') return null;

  return (
    <Modal label="Escolha o visual" onClose={closeList} className="themes" closeLabel={firstVisit ? 'Decidir depois' : 'Fechar'}>
      <div className="modal-main">
        <div className="modal-title">
          <span className="mark"><PaletteIcon width={22} height={22} /></span>
          <div>
            <h2>{firstVisit ? 'Com que cara você quer jogar?' : 'Trocar o visual'}</h2>
            <p>Clique num tema para ver o jogo inteiro com ele. Nada fica salvo até você dizer que sim.</p>
          </div>
        </div>

        <div className="theme-cards">
          {THEMES.map(theme => (
            <button
              key={theme.id}
              type="button"
              className={`theme-card ${theme.id === saved ? 'on' : ''}`}
              data-theme={theme.id}
              data-scheme={theme.scheme}
              onClick={() => tryTheme(theme.id)}
            >
              <span className="tc-sample" aria-hidden="true">
                <span className="tc-top">
                  <span className="glyph">?</span>Palpite
                </span>
                <span className="tc-stage">
                  <MarkArt universe="clash" />
                  <span className="qm">?</span>
                </span>
                <span className="mini-row">
                  <span className="mini hit">Tipo</span>
                  <span className="mini part">Elixir</span>
                  <span className="mini miss">Alvo</span>
                </span>
                <span className="tc-btn">Jogar</span>
              </span>
              <span className="tc-name">
                {theme.name}
                {theme.id === saved && <small>atual</small>}
              </span>
              <span className="tc-blurb">{theme.blurb}</span>
            </button>
          ))}
        </div>

        {firstVisit && (
          <p className="theme-note">Na dúvida, feche: fica o Sépia, e dá para trocar quando quiser em <b>Visual</b>, no topo.</p>
        )}
      </div>
    </Modal>
  );
}
