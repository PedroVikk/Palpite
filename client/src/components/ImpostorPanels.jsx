import { socket } from '../socket.js';
import Avatar from './Avatar.jsx';
import { MaskIcon } from './Icon.jsx';

/** O que o impostor vê no lugar do segredo: a máscara e o que fazer com ela. */
export function ImpostorCard({ universe }) {
  return (
    <section className="role-card">
      <span className="ico"><MaskIcon width={28} height={28} /></span>
      <div>
        <h2>Você é o impostor</h2>
        <p>
          Todo mundo sabe {universe.secretLabel}, menos você. Chute como quem sabe e
          use as contagens de acerto da mesa para descobrir qual é, sem ser descoberto.
        </p>
      </div>
    </section>
  );
}

/**
 * A urna. Só quem estava na mesa quando a rodada abriu vota, e ninguém vota
 * em si mesmo. Dá para trocar o voto enquanto ela não fecha: a urna fecha
 * sozinha quando o último voto chega, ou quando o tempo acaba.
 */
export function VotePanel({ state, myId }) {
  const canVote = state.cast.includes(myId);
  const suspects = state.players.filter(p => state.cast.includes(p.id) && p.id !== myId);

  return (
    <section className="vote">
      <h3>Quem não sabia o segredo?</h3>
      <p>
        {canVote
          ? `${state.voted.length} de ${state.cast.length} já votaram. Dá para trocar o voto até a urna fechar.`
          : 'Você entrou no meio da rodada, então só assiste a esta votação.'}
      </p>
      <div className="vote-grid">
        {suspects.map(player => (
          <button
            key={player.id}
            type="button"
            className={state.myVote === player.id ? 'on' : ''}
            disabled={!canVote}
            aria-pressed={state.myVote === player.id}
            onClick={() => socket.emit('game:vote', { suspectId: player.id })}
          >
            <Avatar name={player.name} size="sm" />
            <span className="nm">{player.name}</span>
            {state.voted.includes(player.id) && <span className="n">votou</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Fim da rodada: quem era o impostor e em quem cada um votou. */
export function VoteResult({ state, myId }) {
  if (!state.votes || !state.impostorId) return null;
  const count = {};
  for (const suspect of Object.values(state.votes)) count[suspect] = (count[suspect] ?? 0) + 1;
  const people = state.players.filter(p => state.cast.includes(p.id));

  return (
    <section className="vote">
      <h3>A votação</h3>
      <p>Quem votou em quem. Empate ou urna vazia deixam o impostor escapar.</p>
      <div className="vote-grid">
        {people.map(player => {
          const target = state.votes[player.id];
          const targetName = state.players.find(p => p.id === target)?.name;
          return (
            <button key={player.id} type="button" disabled className={player.id === state.impostorId ? 'on' : ''}>
              <Avatar name={player.name} size="sm" />
              <span className="nm">
                {player.name}{player.id === myId ? ' (você)' : ''}
                <br />
                <small className="muted">{targetName ? `votou em ${targetName}` : 'não votou'}</small>
              </span>
              {player.id === state.impostorId && <span className="imp">Impostor</span>}
              <span className="n">{count[player.id] ?? 0} {count[player.id] === 1 ? 'voto' : 'votos'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
