import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';
import { formatValue } from '../lib/format.js';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import { CardsIcon, ChevronIcon, SwapIcon } from './Icon.jsx';
import TimeBar from './TimeBar.jsx';

/**
 * O baralho, do lado da tela. Espelha src/cards.js: o servidor e quem aplica o
 * efeito, aqui e so o rosto de cada carta — nome, texto e a arte, com as duas
 * cores do quadro da ilustracao. As cores sao da carta, nao do tema: uma
 * Congelar e azul-gelo em qualquer visual, como carta de verdade.
 *
 * `quiz` e o texto da carta no "Qual deles?", onde nao ha segredo nem vez: la
 * a carta fala da resposta e da pergunta.
 */
export const CARD_FACES = {
  tempo: { name: 'Tempo extra', rarity: 'common', colors: ['#7AB8FF', '#2F5FD0'], text: '+20 s no relógio da sua vez.' },
  aposta: { name: 'Aposta', rarity: 'uncommon', colors: ['#F6C453', '#C27A12'], text: 'Se você acertar esta rodada, leva o dobro. Se outro acertar, perde 20.', quiz: 'Se você acertar esta pergunta, leva o dobro. Se errar, perde 20.' },
  peneira: { name: 'Peneira', rarity: 'uncommon', colors: ['#7BD389', '#2E8B57'], text: 'Tira 30% dos nomes errados da sua busca nesta rodada.', quiz: 'Apaga uma opção errada da pergunta, só para você.' },
  letra: { name: 'Letra', rarity: 'legendary', colors: ['#FFB3C7', '#C2185B'], text: 'Revela uma letra ao acaso do nome do segredo, e onde ela fica. Só para você.', quiz: 'Revela uma letra ao acaso do nome da resposta, e onde ela fica. Só para você.' },
  bussola: { name: 'Bússola', rarity: 'common', colors: ['#E3CFA6', '#7C5A33'], text: 'Mostra de qual grupo é o segredo (a geração, a vila, a casa...). Só para você.', quiz: 'Mostra de qual grupo é a resposta (a geração, a vila, a casa...). Só para você.' },
  reforco: { name: 'Reforço', rarity: 'uncommon', colors: ['#D9F99D', '#4D7C0F'], text: 'Compra duas cartas para a sua mão.' },
  raiox: { name: 'Raio-X', rarity: 'rare', colors: ['#5EEAD4', '#0E7490'], text: 'Revela uma coluna do segredo, só para você.', quiz: 'Revela uma coluna da resposta, só para você.' },
  duplo: { name: 'Chute duplo', rarity: 'rare', colors: ['#FFD84D', '#E07A10'], text: 'Nesta vez você chuta duas vezes seguidas.' },
  embaralhar: { name: 'Embaralhar', rarity: 'uncommon', colors: ['#C4B5FD', '#6D28D9'], text: 'Troca todas as outras cartas da sua mão por cartas novas.' },
  escudo: { name: 'Escudo', rarity: 'rare', colors: ['#CBD5E1', '#475569'], text: 'Até o fim da rodada, cartas de ataque não pegam em você.' },
  pressa: { name: 'Pressa', rarity: 'rare', target: true, attack: true, colors: ['#FDBA74', '#C2410C'], text: 'Quem você escolher tem só 15 s na próxima vez.' },
  espiar: { name: 'Espiar', rarity: 'common', target: true, colors: ['#F0ABFC', '#86198F'], text: 'Mostra as cartas da mão de quem você escolher. Só para você.' },
  espelho: { name: 'Espelho', rarity: 'rare', colors: ['#CFFAFE', '#6366F1'], text: 'A próxima carta de ataque usada em você volta para quem usou. Ninguém vê que você tem.' },
  congelar: { name: 'Congelar', rarity: 'epic', target: true, attack: true, colors: ['#BFE9FF', '#4A90D9'], text: 'Quem você escolher perde a próxima vez.' },
  assalto: { name: 'Assalto', rarity: 'epic', target: true, attack: true, colors: ['#FF8A8A', '#9B1C31'], text: 'Rouba 25 pontos de quem você escolher.' },
  furto: { name: 'Furto', rarity: 'epic', target: true, attack: true, colors: ['#A1A1AA', '#27272A'], text: 'Pega uma carta ao acaso da mão de quem você escolher.' },
  troca: { name: 'Troca', rarity: 'epic', target: true, attack: true, colors: ['#FCD34D', '#DB2777'], text: 'Troca a sua mão inteira com a de quem você escolher.' },
  recompra: { name: 'Recompra', rarity: 'common', draft: true, colors: ['#99F6E4', '#0F766E'], text: 'No próximo draft, troca as três cartas oferecidas por três novas.' },
};

const RARITY = { common: 'Comum', uncommon: 'Incomum', rare: 'Rara', epic: 'Épica', legendary: 'Lendária' };
const UNKNOWN = { name: 'Carta', rarity: 'common', colors: ['#C9C2B3', '#6F665A'], text: '' };
const faceOf = (id) => CARD_FACES[id] ?? { ...UNKNOWN, name: id };
/** O texto da carta no modo da sala (ver `quiz` em CARD_FACES). */
const textOf = (id, mode) => faceOf(id)[mode] ?? faceOf(id).text;

/** As ilustracoes, em traco branco sobre o degrade da carta. */
const ART = {
  tempo: (
    <>
      <path d="M20 8h24M20 56h24" />
      <path d="M22 8c0 13 20 15 20 24S22 43 22 56M42 8c0 13-20 15-20 24s20 11 20 24" />
      <path d="M25 51h14l-7-8z" fill="currentColor" stroke="none" />
      <path d="M28 19h8l-4 5z" fill="currentColor" stroke="none" />
    </>
  ),
  aposta: (
    <>
      <ellipse cx="30" cy="47" rx="16" ry="6" />
      <path d="M14 47v-7M46 47v-7" />
      <ellipse cx="30" cy="40" rx="16" ry="6" />
      <path d="M14 40v-7M46 40v-7" />
      <ellipse cx="30" cy="33" rx="16" ry="6" fill="currentColor" fillOpacity=".22" />
      <path d="M50 8v10M45 13h10M40 22v5M37.5 24.5h5" />
    </>
  ),
  peneira: (
    <>
      <path d="M8 21h48" />
      <path d="M11 21l6 16a7 7 0 0 0 6.5 4.5h17A7 7 0 0 0 47 37l6-16" />
      <circle cx="25" cy="29" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="32" cy="33" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="39" cy="29" r="1.8" fill="currentColor" stroke="none" />
      <path d="M26 48v3M32 51v3M38 48v3M29 57v1M35 57v1" />
    </>
  ),
  raiox: (
    <>
      <path d="M6 32s10-15 26-15 26 15 26 15-10 15-26 15S6 32 6 32z" />
      <circle cx="32" cy="32" r="8" />
      <circle cx="32" cy="32" r="3" fill="currentColor" stroke="none" />
      <path d="M8 10h48M8 54h48" strokeDasharray="3 5" opacity=".7" />
    </>
  ),
  duplo: (
    <>
      <path d="M27 5 14 34h12l-4 25 19-33H29l6-21z" fill="currentColor" fillOpacity=".22" />
      <path d="M46 12l-6 14h7l-3 15 11-19h-7l4-10z" opacity=".8" />
    </>
  ),
  congelar: (
    <>
      <path d="M32 6v52M9.5 19l45 26M9.5 45l45-26" />
      <path d="M26 11l6 6 6-6M26 53l6-6 6 6M11.5 27.5l8.2-2.2-2.2-8.2M52.5 36.5l-8.2 2.2 2.2 8.2M17.5 46.7l2.2-8.2-8.2-2.2M46.5 17.3l-2.2 8.2 8.2 2.2" />
      <circle cx="32" cy="32" r="4.5" fill="currentColor" fillOpacity=".25" />
    </>
  ),
  assalto: (
    <>
      <path d="M6 25c6-6 16-6 26-2 10-4 20-4 26 2-2 10-8 16-16 16-5 0-8-3-10-6-2 3-5 6-10 6-8 0-14-6-16-16z" fill="currentColor" fillOpacity=".2" />
      <path d="M17 29.5h9M38 29.5h9" strokeWidth="4.5" />
      <path d="M20 52l6-5 6 5 6-5 6 5" />
    </>
  ),
  letra: (
    <>
      <path d="M14 52 28 12 42 52M19 38h18" />
      <circle cx="46" cy="44" r="8" fill="currentColor" fillOpacity=".22" />
      <path d="M52 50l6 6" />
      <path d="M50 8v8M46 12h8" />
    </>
  ),
  embaralhar: (
    <>
      <rect x="12" y="12" width="22" height="30" rx="3" transform="rotate(-12 23 27)" />
      <rect x="30" y="14" width="22" height="30" rx="3" transform="rotate(12 41 29)" fill="currentColor" fillOpacity=".22" />
      <path d="M14 50a20 20 0 0 0 34 3" />
      <path d="M49 46v7h-7" />
    </>
  ),
  escudo: (
    <>
      <path d="M32 6l20 7v15c0 13-9 22-20 28-11-6-20-15-20-28V13z" fill="currentColor" fillOpacity=".22" />
      <path d="M23 32l6 6 12-13" />
    </>
  ),
  pressa: (
    <>
      <circle cx="38" cy="36" r="18" />
      <path d="M38 26v10l7 5M33 11h10M38 11v7" />
      <path d="M4 30h9M2 38h11M6 46h8" />
    </>
  ),
  bussola: (
    <>
      <circle cx="32" cy="32" r="23" />
      <path d="M32 14l7 18-7 18-7-18z" fill="currentColor" fillOpacity=".25" />
      <path d="M25 32h14" opacity=".6" />
      <circle cx="32" cy="32" r="2.6" fill="currentColor" stroke="none" />
      <path d="M32 4v4M32 56v4M4 32h4M56 32h4" />
    </>
  ),
  reforco: (
    <>
      <rect x="8" y="18" width="22" height="30" rx="3" />
      <rect x="20" y="10" width="22" height="30" rx="3" fill="currentColor" fillOpacity=".22" />
      <path d="M50 36v18M41 45h18" />
    </>
  ),
  espiar: (
    <>
      <circle cx="19" cy="42" r="11" />
      <circle cx="45" cy="42" r="11" />
      <path d="M30 42h4M12 33l6-17h8l3 15M52 33l-6-17h-8l-3 15" />
      <circle cx="19" cy="42" r="4" fill="currentColor" fillOpacity=".3" />
      <circle cx="45" cy="42" r="4" fill="currentColor" fillOpacity=".3" />
    </>
  ),
  espelho: (
    <>
      <ellipse cx="28" cy="26" rx="17" ry="21" fill="currentColor" fillOpacity=".2" />
      <path d="M38 44l13 15" strokeWidth="5" />
      <path d="M19 20l7-7M19 31l17-17" opacity=".75" />
      <path d="M52 8l-6 6M58 16h-7" />
    </>
  ),
  troca: (
    <>
      <path d="M10 22h40M42 13l9 9-9 9" />
      <path d="M54 42H14M22 33l-9 9 9 9" />
    </>
  ),
  recompra: (
    <>
      <rect x="8" y="16" width="16" height="23" rx="2.5" transform="rotate(-10 16 27)" />
      <rect x="24" y="14" width="16" height="23" rx="2.5" fill="currentColor" fillOpacity=".22" />
      <rect x="40" y="16" width="16" height="23" rx="2.5" transform="rotate(10 48 27)" />
      <path d="M16 50a17 9 0 0 0 32 0" />
      <path d="M48 44v6h-6" />
    </>
  ),
  furto: (
    <>
      <rect x="30" y="22" width="22" height="30" rx="3" transform="rotate(14 41 37)" fill="currentColor" fillOpacity=".22" />
      <path d="M14 6v24a9 9 0 0 0 18 0v-5" />
      <path d="M32 25l-4 4" />
    </>
  ),
};

/**
 * Uma carta de baralho: moldura na cor da raridade, a ilustracao em cima e o
 * texto embaixo. `size` so muda a largura (o resto escala junto); a pequena,
 * da mao, esconde o texto e o mostra no title.
 */
export function PlayCard({ id, size = 'md', mode }) {
  const face = faceOf(id);
  return (
    <span
      className={`pcard ${size} ${face.rarity}`}
      style={{ '--c1': face.colors[0], '--c2': face.colors[1] }}
    >
      <span className="pc-face">
        <span className="pc-art">
          <span className="pc-rar">{RARITY[face.rarity]}</span>
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ART[id] ?? <path d="M22 22a10 10 0 1 1 14 9c-3 1.5-4 3-4 6M32 46v1" />}
          </svg>
        </span>
        <b className="pc-name">{face.name}</b>
        {size !== 'sm' && <small className="pc-text">{textOf(id, mode)}</small>}
      </span>
    </span>
  );
}

/** O verso: o que a mesa vê de uma carta que não é para ela saber qual é. */
function CardBack({ size = 'md' }) {
  return (
    <span className={`pcard ${size} back`}>
      <span className="pc-back" aria-hidden="true">?</span>
    </span>
  );
}

function CardButton({ id, size, mode, onClick, disabled, kbd = null, note = null }) {
  const face = faceOf(id);
  const text = note ?? textOf(id, mode);
  return (
    <button
      type="button"
      className="pcard-btn"
      disabled={disabled}
      onClick={onClick}
      title={`${face.name} — ${text}${kbd ? ` (${kbd})` : ''}`}
      aria-label={`${face.name}: ${text}`}
      aria-keyshortcuts={kbd ?? undefined}
    >
      <PlayCard id={id} size={size} mode={mode} />
      {kbd && <kbd className="pc-kbd" aria-hidden="true">{kbd}</kbd>}
    </button>
  );
}

/** A tecla veio de dentro de um campo de texto? Ali o número é do nome, não do atalho. */
const typing = (event) => Boolean(event.target.closest?.('input, textarea, select, [contenteditable="true"]'));

/** O número da tecla (Digit1 -> 0), pelo código físico: com Shift o `key` vira "!" */
const digitOf = (event) => (/^Digit[1-9]$/.test(event.code) ? Number(event.code.slice(5)) - 1 : null);

/** Quanto dura a subida da carta escolhida antes de ela ir para a mão. */
const PICK_MS = 460;

/**
 * O draft: as três cartas oferecidas, das quais se leva uma. Elas chegam
 * distribuídas uma a uma e ficam flutuando; a escolhida sobe e as outras caem
 * antes do pedido sair. A barra embaixo é o prazo do servidor — quem não
 * escolhe a tempo leva uma sorteada. Enquanto os outros escolhem, a janela
 * fica esperando, e fecha sozinha quando a rodada começa.
 *
 * Embaixo de cada carta fica o vai e vem: gasta uma troca guardada e troca só
 * aquela carta (a nova entra girando no lugar). Com uma Recompra na mão, dá
 * para trocar as três de uma vez. Atalhos: 1–3 escolhe, Shift+1–3 troca, R
 * usa a Recompra.
 */
export function DraftModal({ state, left, total, still }) {
  const offer = state.myOffer;
  const waiting = state.drafting.length;
  const { mode } = state.settings;
  // o detetive conta colunas da tabela: no "Qual deles?" nao ha
  const rerollScout = state.settings.rerollScout && mode !== 'quiz';
  const rerolls = state.myRerolls ?? 0;
  const redraw = (state.myHand ?? []).find(card => card.id === 'recompra');
  const [picked, setPicked] = useState(null);
  // as cartas da primeira mesa entram distribuídas; as que chegam por troca, girando
  const dealt = useRef(null);
  if (offer && !dealt.current) dealt.current = new Set(offer);

  const pick = (index) => {
    if (picked !== null || !offer?.[index]) return;
    setPicked(index);
    setTimeout(() => socket.emit('game:draft', { index }), PICK_MS);
  };
  const reroll = (index) => {
    if (picked !== null || rerolls < 1 || !offer?.[index]) return;
    socket.emit('game:reroll', { index });
  };
  const spendRedraw = () => {
    if (picked !== null || !redraw || !offer) return;
    socket.emit('game:redraft', { uid: redraw.uid });
  };

  // tudo aqui é por referência nova a cada estado: o efeito relê a cada troca
  useEffect(() => {
    if (!offer || picked !== null) return undefined;
    const onKey = (event) => {
      if (typing(event) || event.ctrlKey || event.metaKey || event.altKey) return;
      const at = digitOf(event);
      if (at !== null && at < offer.length) {
        event.preventDefault();
        if (event.shiftKey) reroll(at); else pick(at);
      } else if (event.code === 'KeyR' && !event.shiftKey && redraw) {
        event.preventDefault();
        spendRedraw();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const hurry = offer && picked === null && left !== null && left <= 5;
  return (
    <Modal label="Draft de cartas" className="impostor draft" dismissable={false} onClose={() => {}}>
      <div className="modal-main">
        <div className="modal-title">
          <span className="mark"><CardsIcon width={22} height={22} /></span>
          <div>
            <h2>{offer ? 'Escolha uma carta' : 'Carta escolhida'}</h2>
            <p>
              {offer
                ? `Ela vai para a sua mão. Use ${mode === 'quiz' ? 'antes de responder' : 'na sua vez, antes de chutar'}.`
                : waiting
                  ? `Esperando ${waiting === 1 ? 'mais uma pessoa' : `mais ${waiting} pessoas`} escolherem.`
                  : 'Todo mundo escolheu. A rodada já vai começar.'}
            </p>
          </div>
          {offer && (
            <span
              className={`reroll-bank ${rerolls ? 'has' : ''}`}
              title={`Ganhe trocas vencendo a rodada${rerollScout ? ' ou descobrindo mais colunas' : ''}. Guarda até 2.`}
            >
              <SwapIcon width={15} height={15} />
              <b>{rerolls}</b> {rerolls === 1 ? 'troca' : 'trocas'}
            </span>
          )}
        </div>
        {offer ? (
          <>
            <div className={`card-offer deal ${picked !== null ? 'picked' : ''} ${hurry ? 'hurry' : ''}`}>
              {offer.map((id, index) => (
                <span
                  key={`${index}:${id}`}
                  className={`offer-slot ${dealt.current?.has(id) ? '' : 'fresh'} ${picked === index ? 'chosen' : picked !== null ? 'passed' : ''}`}
                  style={{ '--i': index, '--n': offer.length }}
                >
                  <CardButton id={id} size="lg" mode={mode} disabled={picked !== null} kbd={String(index + 1)} onClick={() => pick(index)} />
                  <button
                    type="button"
                    className="reroll"
                    disabled={picked !== null || rerolls < 1}
                    onClick={() => reroll(index)}
                    title={rerolls ? `Trocar só esta carta (Shift+${index + 1})` : 'Sem trocas guardadas'}
                    aria-label={`Trocar ${faceOf(id).name} por outra carta`}
                  >
                    <SwapIcon width={16} height={16} />
                  </button>
                </span>
              ))}
            </div>
            {redraw && (
              <button type="button" className="redraw" disabled={picked !== null} onClick={spendRedraw} aria-keyshortcuts="R">
                <PlayCard id="recompra" size="sm" />
                <span>
                  <b>Usar Recompra</b>
                  <small>Troca as três cartas de uma vez. Ela sai da sua mão.</small>
                </span>
                <kbd>R</kbd>
              </button>
            )}
            <p className="draft-keys">
              <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> escolhe · <kbd>Shift</kbd>+número troca uma
              {!rerolls && <> · <span className="muted">sem trocas: vença uma rodada{rerollScout ? ' ou descubra mais colunas' : ''} para ganhar</span></>}
            </p>
          </>
        ) : (
          <div className="card-offer settled">
            {state.myHand.map((card, index) => (
              <span key={card.uid} className="offer-slot" style={{ '--i': index }}>
                <PlayCard id={card.id} size="sm" />
              </span>
            ))}
          </div>
        )}
        <TimeBar left={left} total={total} mine={Boolean(offer)} still={still} label="Tempo para escolher" />
        {offer && left !== null && (
          <p className="draft-note">Sem escolha até o fim do tempo, uma das três vem sorteada.</p>
        )}
      </div>
    </Modal>
  );
}

/**
 * A mão, embaixo do aviso da vez: as cartas de quem olha, que só acendem na
 * própria vez (no "Qual deles?", enquanto a pessoa não respondeu). Ao lado, o
 * que as cartas já deram nesta rodada — as colunas que o Raio-X revelou, a
 * aposta de pé, o chute a mais.
 *
 * Na vez, Alt+1–5 usa a carta daquela posição: o campo de chute está com o
 * foco, e número sozinho ali é parte de nome ("7 Colored Fish").
 */
export function HandBar({ state, universe, myTurn, myId }) {
  const hand = state.myHand ?? [];
  const intel = state.myIntel ?? [];
  const { mode } = state.settings;
  const quiz = mode === 'quiz';
  const [aiming, setAiming] = useState(null);   // a carta com alvo esperando a escolha
  const [confirming, setConfirming] = useState(null); // a carta sem alvo esperando o "sim"
  // a carta ampliada ao passar o mouse: na mão ela é pequena demais para ler
  const [peek, setPeek] = useState(null);       // { id, rect }
  const perks = [];
  const sieved = state.mySieve?.length ?? 0;
  if (state.myBet) perks.push('Aposta de pé');
  if (state.myExtra) perks.push('Chute a mais nesta vez');
  if (sieved) {
    perks.push(quiz
      ? `${sieved} ${sieved === 1 ? 'opção apagada' : 'opções apagadas'}`
      : `${sieved} nomes peneirados`);
  }
  if (state.myShield) perks.push('Escudo de pé até o fim da rodada');
  if (state.myMirror) perks.push('Espelho de pé, só você sabe');

  /**
   * Tocar na carta não a gasta: abre a confirmação (ou, na carta com alvo, a
   * escolha de em quem, que já é a confirmação dela). Um toque errado na mão
   * custava a carta.
   */
  const play = (card) => {
    if (!myTurn || faceOf(card.id).draft) return;
    setPeek(null);
    if (faceOf(card.id).target) setAiming(card);
    else setConfirming(card);
  };

  // a vez acabou com a janela aberta (tempo, congelado): a carta não vale mais agora
  useEffect(() => {
    if (!myTurn) {
      setConfirming(null);
      setAiming(null);
    }
  }, [myTurn]);
  // a carta saiu da mão (Furto, Troca) enquanto se decidia
  const handKey = hand.map(card => card.uid).join(',');
  useEffect(() => {
    const has = (card) => card && hand.some(c => c.uid === card.uid);
    setConfirming(card => (has(card) ? card : null));
    setAiming(card => (has(card) ? card : null));
    setPeek(null);
  }, [handKey]);

  const showPeek = (id, event) => setPeek({ id, rect: event.currentTarget.getBoundingClientRect() });

  useEffect(() => {
    if (!myTurn || aiming || confirming) return undefined;
    const onKey = (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const at = digitOf(event);
      if (at === null || !hand[at]) return;
      event.preventDefault();
      play(hand[at]);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  if (!hand.length && !intel.length && !perks.length) return null;
  return (
    <section className="hand">
      <div className="hand-cards">
        <span className="k">Sua mão {hand.length ? `· ${hand.length}` : ''}</span>
        {hand.length ? (
          <div className="hand-row">
            {hand.map((card, index) => {
              const draftOnly = Boolean(faceOf(card.id).draft);
              return (
                // o invólucro recebe o mouse mesmo com o botão apagado (fora
                // da vez): ver a carta vale a qualquer hora
                <span
                  key={card.uid}
                  className="hand-slot"
                  onPointerEnter={(event) => { if (event.pointerType === 'mouse') showPeek(card.id, event); }}
                  onPointerLeave={() => setPeek(null)}
                  onFocus={(event) => showPeek(card.id, event)}
                  onBlur={() => setPeek(null)}
                >
                  <CardButton
                    id={card.id}
                    size="sm"
                    mode={mode}
                    disabled={!myTurn || draftOnly}
                    kbd={myTurn && !draftOnly ? `Alt+${index + 1}` : null}
                    note={draftOnly ? 'Guardada para o próximo draft: lá ela troca as três cartas.' : null}
                    onClick={() => play(card)}
                  />
                </span>
              );
            })}
          </div>
        ) : <small className="muted">Sem cartas. O próximo draft traz mais.</small>}
        {state.myRerolls > 0 && (
          <span className="reroll-bank has" title="Trocas guardadas para o próximo draft">
            <SwapIcon width={14} height={14} /> <b>{state.myRerolls}</b> {state.myRerolls === 1 ? 'troca' : 'trocas'}
          </span>
        )}
      </div>
      {(intel.length > 0 || perks.length > 0) && (
        <div className="hand-intel">
          {intel.map((entry) => {
            const { label, value } = describeIntel(entry, universe);
            return <span key={entry.key} className="fact">{label}: <b>{value}</b></span>;
          })}
          {perks.map(text => <span key={text} className="fact dim">{text}</span>)}
        </div>
      )}
      {myTurn && hand.length > 0 && (
        <p className="f-help">
          Toque numa carta (ou <kbd>Alt</kbd>+número) para usar. Depois é só {quiz ? 'responder' : 'chutar'}.
        </p>
      )}
      {peek && !aiming && !confirming && <CardPeek id={peek.id} rect={peek.rect} mode={mode} />}
      {confirming && (
        <ConfirmCardModal
          card={confirming}
          mode={mode}
          onClose={() => setConfirming(null)}
          onConfirm={() => {
            socket.emit('game:card', { uid: confirming.uid });
            setConfirming(null);
          }}
        />
      )}
      {aiming && (
        <TargetModal
          card={aiming}
          state={state}
          myId={myId}
          onClose={() => setAiming(null)}
          onPick={(targetId) => {
            socket.emit('game:card', { uid: aiming.uid, targetId });
            setAiming(null);
          }}
        />
      )}
    </section>
  );
}

const LOG_KEY = 'palpite:cardlog';
const readLogOpen = () => { try { return localStorage.getItem(LOG_KEY) === 'open'; } catch { return false; } };
const saveLogOpen = (open) => { try { localStorage.setItem(LOG_KEY, open ? 'open' : 'closed'); } catch { /* sem storage, vale só nesta tela */ } };

/** "agora", "há 40 s", "há 3 min": o registro é de uma rodada, não passa disso. */
function ago(at, now) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return 'agora';
  if (s < 60) return `há ${s} s`;
  return `há ${Math.floor(s / 60)} min`;
}

/**
 * O registro das cartas da rodada, para quem clicou rápido demais na carta
 * que passou na tela. Recolhido, mostra só a última jogada numa linha; aberto,
 * a rodada inteira, a mais nova em cima. A escolha fica guardada no
 * navegador. As jogadas que mexeram com quem olha ganham destaque.
 */
export function CardLog({ state, myId }) {
  const log = state.cardLog ?? [];
  const [open, setOpen] = useState(readLogOpen);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(handle);
  }, []);
  if (!log.length) return null;

  const toggle = () => setOpen(o => { saveLogOpen(!o); return !o; });
  const shown = open ? [...log].reverse() : [log.at(-1)];
  return (
    <section className={`card-log ${open ? 'open' : ''}`}>
      <button type="button" className="cl-head" aria-expanded={open} onClick={toggle}>
        <CardsIcon width={16} height={16} />
        <b>Cartas da rodada</b>
        <span className="n">{log.length}</span>
        <span className="cl-hint">{open ? 'Recolher' : log.length > 1 ? 'Ver todas' : 'Abrir'}</span>
        <ChevronIcon className="chev" width={16} height={16} />
      </button>
      <ol className="cl-list">
        {shown.map(entry => {
          const face = entry.id ? faceOf(entry.id) : UNKNOWN;
          const mine = entry.by === myId || entry.target === myId;
          return (
            <li key={entry.seq} className={mine ? 'me' : ''}>
              <i className="cl-chip" style={{ '--c1': face.colors[0], '--c2': face.colors[1] }} aria-hidden="true" />
              <span className="tx">{entry.text}</span>
              <time>{ago(entry.at, now)}</time>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Em quem usar: a carta com alvo abre esta janela, e o dono escolhe. Quem não
 * pode ser alvo aparece apagado com o porquê — escudo de pé (para ataque),
 * sem pontos para o Assalto, sem cartas para o Furto e o Espiar. O Espelho
 * não aparece aqui: ele é segredo, e é justamente a surpresa.
 */
function TargetModal({ card, state, myId, onClose, onPick }) {
  const face = faceOf(card.id);
  const { mode } = state.settings;
  const others = state.players.filter(p => p.id !== myId);
  const why = (p) => {
    if (face.attack && p.shielded) return 'de escudo';
    if (card.id === 'assalto' && p.score <= 0) return 'sem pontos';
    if ((card.id === 'furto' || card.id === 'espiar') && !p.cards) return 'sem cartas';
    return null;
  };
  return (
    <Modal label={`Em quem usar ${face.name}`} onClose={onClose} className="confirm target-pick" closeLabel="Cancelar">
      <div className="modal-main">
        <PlayCard id={card.id} size="md" mode={mode} />
        <h2>Em quem usar {face.name}?</h2>
        <p>{textOf(card.id, mode)}</p>
        <ul className="targets">
          {others.map(p => {
            const blocked = why(p);
            return (
              <li key={p.id}>
                <button type="button" disabled={Boolean(blocked)} onClick={() => onPick(p.id)}>
                  <Avatar name={p.name} size="sm" />
                  <span className="nm">{p.name}{!p.connected && <small> · caiu</small>}</span>
                  <span className="meta">
                    {p.score} pts · {p.cards ?? 0} {p.cards === 1 ? 'carta' : 'cartas'}
                  </span>
                  {blocked && <span className="tag ghost">{blocked}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn link" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}

/** Largura da carta ampliada (a .pcard.lg) e a folga até a borda da tela. */
const PEEK_W = 176;
const PEEK_GAP = 12;

/**
 * A carta da mão ampliada, com o texto inteiro, enquanto o mouse está em cima
 * dela. Flutua acima da carta (abaixo, se não couber) e não pega clique: o
 * clique continua indo para a carta de verdade, embaixo.
 */
function CardPeek({ id, rect, mode }) {
  const half = PEEK_W / 2 + PEEK_GAP;
  const left = Math.min(Math.max(rect.left + rect.width / 2, half), innerWidth - half);
  // cabe em cima? a carta grande tem uns 1,45 de altura por largura, mais o texto
  const above = rect.top > PEEK_W * 1.75;
  const style = above
    ? { left, bottom: innerHeight - rect.top + PEEK_GAP }
    : { left, top: rect.bottom + PEEK_GAP };
  return (
    <div className={`card-peek ${above ? 'up' : 'down'}`} style={style} aria-hidden="true">
      <PlayCard id={id} size="lg" mode={mode} />
    </div>
  );
}

/**
 * "Você confirma que quer usar esta carta?" — a carta grande, o que ela faz, e
 * os dois botões. O foco fica no Usar: quem chegou por Alt+número confirma com
 * Enter, e Esc desiste.
 */
function ConfirmCardModal({ card, mode, onClose, onConfirm }) {
  const face = faceOf(card.id);
  return (
    <Modal label={`Usar ${face.name}`} onClose={onClose} className="confirm card-confirm" closeLabel="Cancelar">
      <div className="modal-main">
        <PlayCard id={card.id} size="lg" mode={mode} />
        <h2>Usar {face.name}?</h2>
        <p>{textOf(card.id, mode)} Depois de usada, a carta sai da sua mão.</p>
        <div className="confirm-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" onClick={onConfirm} autoFocus>Usar carta</button>
        </div>
      </div>
    </Modal>
  );
}

/** As cartas que mostram algo só para quem usou: na jogada, elas viram. */
const REVEALS = new Set(['bussola', 'raiox', 'letra', 'espiar']);

/**
 * Uma entrada de myIntel em palavras: o rótulo, o valor e, na Letra, a
 * posição e o tamanho do nome. É o mesmo texto da faixa ao lado da mão.
 */
function describeIntel(entry, universe) {
  const { key, value, of, who } = entry;
  if (key === 'grupo') return { label: of, value };
  if (key.startsWith('espiar:')) {
    return { label: `Mão de ${who}`, value: value.length ? value.map(id => faceOf(id).name).join(', ') : 'vazia', list: value };
  }
  if (key.startsWith('letra:')) {
    const at = Number(key.slice(6));
    return { label: `${at}ª letra${of ? ` de ${of}` : ''}`, value, at, of };
  }
  const column = universe?.columns.find(c => c.key === key);
  return { label: column?.label ?? key, value: column ? formatValue(column, value) : String(value) };
}

/** O que a carta `id` acabou de mostrar, se a entrada é mesmo dela. */
function revealOf(entry, id, universe) {
  if (!entry) return null;
  const { key } = entry;
  const mine = id === 'bussola' ? key === 'grupo'
    : id === 'letra' ? key.startsWith('letra:')
      : id === 'espiar' ? key.startsWith('espiar:')
        : key !== 'grupo' && !key.includes(':');
  return mine ? describeIntel(entry, universe) : null;
}

/**
 * O verso da carta que virou: a mesma moldura e as mesmas cores, e no lugar
 * da ilustração, o que ela mostrou. Na Letra, o nome em casas vazias com a
 * letra na posição dela; no Espiar, as cartas da mão espiada.
 */
function RevealCard({ id, reveal }) {
  const face = faceOf(id);
  const slots = reveal.at && reveal.of && reveal.of <= 16
    ? Array.from({ length: reveal.of }, (_, i) => (i + 1 === reveal.at ? reveal.value : ''))
    : null;
  return (
    <span className={`pcard xl ${face.rarity} reveal`} style={{ '--c1': face.colors[0], '--c2': face.colors[1] }}>
      <span className="pc-face">
        <span className="pc-reveal">
          <small className="rv-k">{reveal.label}</small>
          {reveal.list ? (
            reveal.list.length ? (
              <span className="rv-hand">{reveal.list.map((card, i) => <PlayCard key={i} id={card} size="sm" />)}</span>
            ) : <b className="rv-v">Vazia</b>
          ) : (
            <b className={`rv-v ${String(reveal.value).length > 14 ? 'long' : ''}`}>{reveal.value}</b>
          )}
          {slots && (
            <span className="rv-slots">{slots.map((ch, i) => <i key={i} className={ch ? 'on' : ''}>{ch}</i>)}</span>
          )}
        </span>
        <b className="pc-name">{face.name}</b>
        <small className="pc-text">Só você está vendo.</small>
      </span>
    </span>
  );
}

/** Quanto dura a saída da carta depois do clique. */
const OUT_MS = 420;

/**
 * A carta na mesa: quando alguém usa uma carta, ela aparece na tela de todo
 * mundo e fica ali até a pessoa clicar (ou apertar Esc/Enter). O clique vale a
 * qualquer momento: no meio da entrada ele pula direto para a saída. O jeito
 * muda com quem olha:
 *
 * - quem usou vê a carta subir da mão, e no clique ela volta para a mão;
 * - quem só assiste vê a carta entrar pelo lado e, no clique, sair por onde
 *   veio — ou, se ela mira alguém, voar até o nome do alvo na lateral;
 * - o alvo leva a carta na cara: ela pula na tela com um tranco, e no clique
 *   cai. Devolvida pelo Espelho, quem leva a pancada é quem usou.
 *
 * Várias jogadas seguidas fazem fila, uma por clique. O que já estava na mesa
 * quando a tela abriu (F5, entrar no meio) não entra na fila.
 */
export function CardPlayFx({ state, myId, universe }) {
  const last = state.lastCard;
  const seen = useRef(last?.seq ?? 0);
  const [queue, setQueue] = useState([]);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!last || last.seq <= seen.current) return;
    seen.current = last.seq;

    const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'Alguém';
    let variant = last.target && last.target === myId ? 'hit'
      : last.by === myId ? 'mine'
        : last.target ? 'aimed' : 'watch';

    // para onde a carta voa na saída: o nome do alvo na lateral, se estiver à vista
    let to = null;
    if (variant === 'aimed') {
      const row = document.querySelector(`[data-player="${CSS.escape(last.target)}"]`)?.getBoundingClientRect();
      if (row && row.bottom > 0 && row.top < innerHeight) {
        to = { x: row.left + row.width / 2 - innerWidth / 2, y: row.top + row.height / 2 - innerHeight / 2 };
      } else {
        variant = 'watch';
      }
    }

    setQueue(q => [...q, {
      key: last.seq,
      id: last.id,
      variant,
      by: nameOf(last.by),
      byMe: last.by === myId,
      via: last.via ? nameOf(last.via) : null,
      viaMe: last.via === myId,
      reflected: Boolean(last.reflected),
      message: state.message,
      to,
      // carta de informação usada por quem olha: o servidor põe o que ela
      // mostrou no fim de myIntel, no mesmo estado que anuncia a jogada
      reveal: last.by === myId && !last.reflected && REVEALS.has(last.id)
        ? revealOf(state.myIntel?.at(-1), last.id, universe)
        : null,
    }]);
    // so a jogada nova importa; o resto do estado e lido no momento dela
  }, [last?.seq]);

  const play = queue[0];

  const dismiss = useCallback(() => {
    if (!play || leaving) return;
    setLeaving(true);
    setTimeout(() => {
      setQueue(q => q.slice(1));
      setLeaving(false);
    }, OUT_MS);
  }, [play, leaving]);

  // Esc e Enter também dispensam; na captura, para o Enter não virar um chute
  // no campo de busca que está por baixo
  useEffect(() => {
    if (!play) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape' && event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }, [play, dismiss]);

  if (!play) return null;
  const face = play.id ? faceOf(play.id) : null;
  const name = face?.name ?? 'uma carta';
  const title = !face ? `${play.by} usou uma carta secreta`
    : play.reflected && play.variant === 'hit' ? `O espelho de ${play.via} devolveu a sua ${name}!`
      : play.reflected && play.viaMe ? `Seu espelho devolveu ${name}!`
        : play.reflected ? `${play.via} tinha um espelho!`
          : play.variant === 'hit' ? `${play.by} usou ${name} em você!`
            : play.byMe ? `Você usou ${name}`
              : `${play.by} usou ${name}`;
  const colors = face?.colors ?? ['#C9C2B3', '#6F665A'];

  return (
    <button
      type="button"
      key={play.key}
      className={`card-fx ${play.variant} ${face?.rarity ?? 'common'} ${leaving ? 'out' : ''}`}
      style={{
        '--c1': colors[0],
        '--c2': colors[1],
        '--to-x': `${play.to?.x ?? 0}px`,
        '--to-y': `${play.to?.y ?? 0}px`,
      }}
      onClick={dismiss}
      aria-label={`${title}. Clique para continuar.`}
    >
      <span className="fx-flash" aria-hidden="true" />
      <span className="fx-glow" aria-hidden="true" />
      <span className="fx-card">
        {play.reveal ? (
          <span className="fx-flip">
            <span className="fx-side front"><PlayCard id={play.id} size="xl" mode={state.settings.mode} /></span>
            <span className="fx-side back"><RevealCard id={play.id} reveal={play.reveal} /></span>
          </span>
        ) : play.id ? <PlayCard id={play.id} size="xl" mode={state.settings.mode} /> : <CardBack size="xl" />}
      </span>
      <span className="fx-caption" role="status" aria-live="assertive">
        <b>{title}</b>
        {play.message && <span>{play.message}</span>}
        <small className="fx-hint">
          {queue.length > 1 ? `Clique para ver a próxima (${queue.length - 1})` : 'Clique para continuar'}
        </small>
      </span>
    </button>
  );
}
