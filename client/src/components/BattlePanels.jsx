import { useState } from 'react';
import Avatar from './Avatar.jsx';
import { HideButton } from './Reveal.jsx';
import { AnchorIcon, EyeIcon } from './Icon.jsx';

/**
 * O seu segredo na batalha. Como a carta do impostor, começa virada: quem está
 * do lado (ou vê a tela transmitida) não pode ler o que você escondeu.
 */
export function MySecretCard({ secret, sunkBy }) {
  const [shown, setShown] = useState(false);
  if (!secret) return null;

  if (!shown) {
    return (
      <section className="reveal hidden">
        <div>
          <h2>Seu segredo está virado</h2>
          <small className="muted">
            {sunkBy ? 'Você afundou: agora é só assistir.' : 'Só você deve ver o que escondeu.'}
          </small>
        </div>
        <button type="button" className="btn ghost small reveal-toggle" onClick={() => setShown(true)}>
          <EyeIcon width={15} height={15} /> Mostrar
        </button>
      </section>
    );
  }

  return (
    <section className="reveal mine flip-in">
      {secret.sprite && <div className="portrait small"><img src={secret.artwork ?? secret.sprite} alt={secret.name} /></div>}
      <div>
        <span className="k">{sunkBy ? `Seu segredo — afundado por ${sunkBy}` : 'Seu segredo'}</span>
        <h2>{secret.name}</h2>
      </div>
      <HideButton onClick={() => setShown(false)} />
    </section>
  );
}

/**
 * Os tabuleiros, um por jogador da batalha. A aba é o alvo: tocar nela escolhe
 * em quem o próximo tiro vai. O seu tabuleiro aparece também — dá para ver o
 * que os outros já tentaram contra você —, mas não é alvo.
 */
export function BattleTabs({ state, myId, targetId, onPick }) {
  const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'alguém';
  const fleet = state.cast.map(id => state.players.find(p => p.id === id)).filter(Boolean);

  return (
    <section className="fleet" aria-label="Tabuleiros">
      {fleet.map(player => {
        const shots = state.rows.filter(row => row.targetId === player.id).length;
        const sunk = state.sunk[player.id];
        const mine = player.id === myId;
        return (
          <button
            key={player.id}
            type="button"
            className={['ship', targetId === player.id ? 'on' : '', sunk ? 'sunk' : '', mine ? 'mine' : ''].filter(Boolean).join(' ')}
            aria-pressed={targetId === player.id}
            onClick={() => onPick(player.id)}
          >
            <Avatar name={player.name} size="sm" />
            <span className="txt">
              <b>{mine ? 'Seu tabuleiro' : player.name}</b>
              <small>
                {sunk
                  ? `Afundado${sunk.by ? ` por ${sunk.by === myId ? 'você' : nameOf(sunk.by)}` : ''}`
                  : `${shots} ${shots === 1 ? 'tiro' : 'tiros'}`}
              </small>
            </span>
            {sunk && <span className="tag-sunk">Afundou</span>}
          </button>
        );
      })}
    </section>
  );
}

/** Fim da partida: o que cada um tinha escondido, e quem afundou quem. */
export function BattleSecrets({ state, myId }) {
  const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'alguém';
  const fleet = state.cast.filter(id => state.secrets[id]);
  if (!fleet.length) return null;

  return (
    <section className="card">
      <h3><AnchorIcon width={13} height={13} strokeWidth={2.2} />Os segredos da batalha</h3>
      <div className="suspects">
        {fleet.map(id => {
          const secret = state.secrets[id];
          const sunk = state.sunk[id];
          return (
            <div key={id} className={`suspect ${sunk ? '' : 'on'}`}>
              <span className="who">
                <Avatar name={nameOf(id)} size="sm" />
                <span className="nm">{nameOf(id)}{id === myId ? ' (você)' : ''}</span>
                {!sunk && <span className="tag-vote">De pé</span>}
              </span>
              <span className="guesses">
                <span className="g">
                  {secret.sprite && <img src={secret.sprite} alt="" loading="lazy" />}
                  {secret.name}
                </span>
              </span>
              <small className="muted">
                {sunk ? (sunk.by ? `Afundado por ${nameOf(sunk.by)}` : 'Saiu da batalha') : 'Terminou de pé'}
              </small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
