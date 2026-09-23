import { socket } from '../socket.js';
import { formatValue } from '../lib/format.js';
import Modal from './Modal.jsx';
import { CardsIcon } from './Icon.jsx';

/**
 * O baralho, do lado da tela. Espelha src/cards.js: o servidor e quem aplica o
 * efeito, aqui e so o rosto de cada carta.
 */
export const CARD_FACES = {
  tempo: { name: 'Tempo extra', icon: '⏳', rarity: 'common', text: '+20 s no relógio da sua vez.' },
  aposta: { name: 'Aposta', icon: '💰', rarity: 'common', text: 'Se você acertar esta rodada, leva o dobro. Se outro acertar, perde 20.' },
  peneira: { name: 'Peneira', icon: '🧹', rarity: 'common', text: 'Tira 30% dos nomes errados da sua busca nesta rodada.' },
  raiox: { name: 'Raio-X', icon: '🔍', rarity: 'rare', text: 'Revela uma coluna do segredo, só para você.' },
  duplo: { name: 'Chute duplo', icon: '⚡', rarity: 'rare', text: 'Nesta vez você chuta duas vezes seguidas.' },
  congelar: { name: 'Congelar', icon: '🧊', rarity: 'epic', text: 'O próximo jogador perde a vez.' },
  assalto: { name: 'Assalto', icon: '🦹', rarity: 'epic', text: 'Rouba 25 pontos de quem lidera o placar.' },
};

const RARITY = { common: 'Comum', rare: 'Rara', epic: 'Épica' };

function CardFace({ id, onClick, disabled, compact = false }) {
  const face = CARD_FACES[id] ?? { name: id, icon: '🃏', rarity: 'common', text: '' };
  return (
    <button
      type="button"
      className={`card-face ${face.rarity} ${compact ? 'compact' : ''}`}
      disabled={disabled}
      onClick={onClick}
      title={face.text}
    >
      <span className="rar">{RARITY[face.rarity]}</span>
      <span className="ico" aria-hidden="true">{face.icon}</span>
      <b>{face.name}</b>
      {!compact && <small>{face.text}</small>}
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
              <CardFace key={id} id={id} onClick={() => socket.emit('game:draft', { index })} />
            ))}
          </div>
        ) : (
          <div className="card-offer">
            {state.myHand.map(card => <CardFace key={card.uid} id={card.id} disabled compact />)}
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
export function HandBar({ state, universe, myTurn }) {
  const hand = state.myHand ?? [];
  const intel = state.myIntel ?? [];
  const perks = [];
  if (state.myBet) perks.push('💰 Aposta de pé');
  if (state.myExtra) perks.push('⚡ Chute a mais nesta vez');
  if (state.mySieve?.length) perks.push(`🧹 ${state.mySieve.length} nomes peneirados`);

  if (!hand.length && !intel.length && !perks.length) return null;
  return (
    <section className="hand">
      <div className="hand-cards">
        <span className="k">Sua mão {hand.length ? `· ${hand.length}` : ''}</span>
        {hand.length ? hand.map(card => (
          <CardFace
            key={card.uid}
            id={card.id}
            compact
            disabled={!myTurn}
            onClick={() => socket.emit('game:card', { uid: card.uid })}
          />
        )) : <small className="muted">Sem cartas. O próximo draft traz mais.</small>}
      </div>
      {(intel.length > 0 || perks.length > 0) && (
        <div className="hand-intel">
          {intel.map(({ key, value }) => {
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
    </section>
  );
}
