import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';
import { formatValue } from '../lib/format.js';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import { CardsIcon } from './Icon.jsx';

/**
 * O baralho, do lado da tela. Espelha src/cards.js: o servidor e quem aplica o
 * efeito, aqui e so o rosto de cada carta — nome, texto e a arte, com as duas
 * cores do quadro da ilustracao. As cores sao da carta, nao do tema: uma
 * Congelar e azul-gelo em qualquer visual, como carta de verdade.
 */
export const CARD_FACES = {
  tempo: { name: 'Tempo extra', rarity: 'common', colors: ['#7AB8FF', '#2F5FD0'], text: '+20 s no relógio da sua vez.' },
  aposta: { name: 'Aposta', rarity: 'common', colors: ['#F6C453', '#C27A12'], text: 'Se você acertar esta rodada, leva o dobro. Se outro acertar, perde 20.' },
  peneira: { name: 'Peneira', rarity: 'common', colors: ['#7BD389', '#2E8B57'], text: 'Tira 30% dos nomes errados da sua busca nesta rodada.' },
  letra: { name: 'Letra', rarity: 'common', colors: ['#FFB3C7', '#C2185B'], text: 'Revela uma letra ao acaso do nome do segredo, e onde ela fica. Só para você.' },
  bussola: { name: 'Bússola', rarity: 'common', colors: ['#E3CFA6', '#7C5A33'], text: 'Mostra de qual grupo é o segredo (a geração, a vila, a casa...). Só para você.' },
  reforco: { name: 'Reforço', rarity: 'common', colors: ['#D9F99D', '#4D7C0F'], text: 'Compra duas cartas para a sua mão.' },
  raiox: { name: 'Raio-X', rarity: 'rare', colors: ['#5EEAD4', '#0E7490'], text: 'Revela uma coluna do segredo, só para você.' },
  duplo: { name: 'Chute duplo', rarity: 'rare', colors: ['#FFD84D', '#E07A10'], text: 'Nesta vez você chuta duas vezes seguidas.' },
  embaralhar: { name: 'Embaralhar', rarity: 'rare', colors: ['#C4B5FD', '#6D28D9'], text: 'Troca todas as outras cartas da sua mão por cartas novas.' },
  escudo: { name: 'Escudo', rarity: 'rare', colors: ['#CBD5E1', '#475569'], text: 'Até o fim da rodada, cartas de ataque não pegam em você.' },
  pressa: { name: 'Pressa', rarity: 'rare', target: true, attack: true, colors: ['#FDBA74', '#C2410C'], text: 'Quem você escolher tem só 15 s na próxima vez.' },
  espiar: { name: 'Espiar', rarity: 'rare', target: true, colors: ['#F0ABFC', '#86198F'], text: 'Mostra as cartas da mão de quem você escolher. Só para você.' },
  espelho: { name: 'Espelho', rarity: 'rare', colors: ['#CFFAFE', '#6366F1'], text: 'A próxima carta de ataque usada em você volta para quem usou. Ninguém vê que você tem.' },
  congelar: { name: 'Congelar', rarity: 'epic', target: true, attack: true, colors: ['#BFE9FF', '#4A90D9'], text: 'Quem você escolher perde a próxima vez.' },
  assalto: { name: 'Assalto', rarity: 'epic', target: true, attack: true, colors: ['#FF8A8A', '#9B1C31'], text: 'Rouba 25 pontos de quem você escolher.' },
  furto: { name: 'Furto', rarity: 'epic', target: true, attack: true, colors: ['#A1A1AA', '#27272A'], text: 'Pega uma carta ao acaso da mão de quem você escolher.' },
  troca: { name: 'Troca', rarity: 'epic', target: true, attack: true, colors: ['#FCD34D', '#DB2777'], text: 'Troca a sua mão inteira com a de quem você escolher.' },
};

const RARITY = { common: 'Comum', rare: 'Rara', epic: 'Épica' };
const UNKNOWN = { name: 'Carta', rarity: 'common', colors: ['#C9C2B3', '#6F665A'], text: '' };
const faceOf = (id) => CARD_FACES[id] ?? { ...UNKNOWN, name: id };

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
export function PlayCard({ id, size = 'md' }) {
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
        {size !== 'sm' && <small className="pc-text">{face.text}</small>}
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

function CardButton({ id, size, onClick, disabled }) {
  const face = faceOf(id);
  return (
    <button
      type="button"
      className="pcard-btn"
      disabled={disabled}
      onClick={onClick}
      title={`${face.name} — ${face.text}`}
      aria-label={`${face.name}: ${face.text}`}
    >
      <PlayCard id={id} size={size} />
    </button>
  );
}

/**
 * O draft: as três cartas oferecidas, das quais se leva uma. Enquanto os
 * outros escolhem, a janela fica esperando — e fecha sozinha quando a rodada
 * começa, porque a fase deixa de ser o draft.
 */
export function DraftModal({ state }) {
  const offer = state.myOffer;
  const waiting = state.drafting.length;
  return (
    <Modal label="Draft de cartas" className="impostor draft" dismissable={false} onClose={() => {}}>
      <div className="modal-main">
        <div className="modal-title">
          <span className="mark"><CardsIcon width={22} height={22} /></span>
          <div>
            <h2>{offer ? 'Escolha uma carta' : 'Carta escolhida'}</h2>
            <p>
              {offer
                ? 'Ela vai para a sua mão. Use na sua vez, antes de chutar.'
                : `Esperando ${waiting === 1 ? 'mais uma pessoa' : `mais ${waiting} pessoas`} escolherem.`}
            </p>
          </div>
        </div>
        {offer ? (
          <div className="card-offer">
            {offer.map((id, index) => (
              <CardButton key={id} id={id} size="lg" onClick={() => socket.emit('game:draft', { index })} />
            ))}
          </div>
        ) : (
          <div className="card-offer">
            {state.myHand.map(card => <PlayCard key={card.uid} id={card.id} size="sm" />)}
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * A mão, embaixo do aviso da vez: as cartas de quem olha, que só acendem na
 * própria vez. Ao lado, o que as cartas já deram nesta rodada — as colunas que
 * o Raio-X revelou, a aposta de pé, o chute a mais.
 */
export function HandBar({ state, universe, myTurn, myId }) {
  const hand = state.myHand ?? [];
  const intel = state.myIntel ?? [];
  const [aiming, setAiming] = useState(null);   // a carta com alvo esperando a escolha
  const perks = [];
  if (state.myBet) perks.push('💰 Aposta de pé');
  if (state.myExtra) perks.push('⚡ Chute a mais nesta vez');
  if (state.mySieve?.length) perks.push(`🧹 ${state.mySieve.length} nomes peneirados`);
  if (state.myShield) perks.push('🛡️ Escudo de pé até o fim da rodada');
  if (state.myMirror) perks.push('🪞 Espelho de pé, só você sabe');

  if (!hand.length && !intel.length && !perks.length) return null;
  return (
    <section className="hand">
      <div className="hand-cards">
        <span className="k">Sua mão {hand.length ? `· ${hand.length}` : ''}</span>
        {hand.length ? (
          <div className="hand-row">
            {hand.map(card => (
              <CardButton
                key={card.uid}
                id={card.id}
                size="sm"
                disabled={!myTurn}
                onClick={() => (faceOf(card.id).target
                  ? setAiming(card)
                  : socket.emit('game:card', { uid: card.uid }))}
              />
            ))}
          </div>
        ) : <small className="muted">Sem cartas. O próximo draft traz mais.</small>}
      </div>
      {(intel.length > 0 || perks.length > 0) && (
        <div className="hand-intel">
          {intel.map(({ key, value, of, who }) => {
            if (key === 'grupo') {
              return <span key={key} className="fact">🧭 {of}: <b>{value}</b></span>;
            }
            if (key.startsWith('espiar:')) {
              return (
                <span key={key} className="fact">
                  👁 Mão de {who}: <b>{value.length ? value.map(id => faceOf(id).name).join(', ') : 'vazia'}</b>
                </span>
              );
            }
            if (key.startsWith('letra:')) {
              return (
                <span key={key} className="fact">
                  🔤 {key.slice(6)}ª letra{of ? ` (de ${of})` : ''}: <b>{value}</b>
                </span>
              );
            }
            const column = universe.columns.find(c => c.key === key);
            return (
              <span key={key} className="fact">
                🔍 {column?.label ?? key}: <b>{column ? formatValue(column, value) : String(value)}</b>
              </span>
            );
          })}
          {perks.map(text => <span key={text} className="fact dim">{text}</span>)}
        </div>
      )}
      {myTurn && hand.length > 0 && <p className="f-help">Toque numa carta para usar. Depois é só chutar.</p>}
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

/**
 * Em quem usar: a carta com alvo abre esta janela, e o dono escolhe. Quem não
 * pode ser alvo aparece apagado com o porquê — escudo de pé (para ataque),
 * sem pontos para o Assalto, sem cartas para o Furto e o Espiar. O Espelho
 * não aparece aqui: ele é segredo, e é justamente a surpresa.
 */
function TargetModal({ card, state, myId, onClose, onPick }) {
  const face = faceOf(card.id);
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
        <PlayCard id={card.id} size="md" />
        <h2>Em quem usar {face.name}?</h2>
        <p>{face.text}</p>
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
export function CardPlayFx({ state, myId }) {
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
      <span className="fx-card">{play.id ? <PlayCard id={play.id} size="xl" /> : <CardBack size="xl" />}</span>
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
