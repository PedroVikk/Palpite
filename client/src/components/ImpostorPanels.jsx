import { scopeReach } from '@shared/universes.js';
import { socket } from '../socket.js';
import { useCountdown } from '../hooks/useCountdown.js';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import Reveal, { HideButton } from './Reveal.jsx';
import { EyeIcon, MaskIcon } from './Icon.jsx';

/** O que o impostor vê no lugar do segredo: a máscara e o que fazer com ela. */
function ImpostorCard({ universe, onHide }) {
  return (
    <section className="role-card flip-in">
      <span className="ico"><MaskIcon width={28} height={28} /></span>
      <div>
        <h2>Você é o impostor</h2>
        <p>
          Todo mundo sabe {universe.secretLabel}, menos você. Chute como quem sabe e
          use as contagens de acerto da mesa para descobrir qual é, sem ser descoberto.
        </p>
      </div>
      <HideButton onClick={onHide} />
    </section>
  );
}

/**
 * A carta de cada um na rodada: o segredo para a mesa, a máscara para o
 * impostor. Ela começa virada, e virada é igual para os dois papéis — sem
 * legenda, sem cor, sem nada que diga de que lado está quem olha. Numa sala em
 * que os amigos estão lado a lado (ou alguém transmite a tela), bater o olho
 * na tela do outro não pode entregar quem é o impostor.
 */
export function RoleCard({ state, universe, isImpostor, hidden, onToggle }) {
  if (hidden) {
    return (
      <section className="reveal hidden">
        <div>
          <h2>Sua carta está virada</h2>
          <small className="muted">Só você deve ver o que tem nela.</small>
        </div>
        <button type="button" className="btn ghost small reveal-toggle" onClick={onToggle}>
          <EyeIcon width={15} height={15} /> Mostrar
        </button>
      </section>
    );
  }
  if (isImpostor) return <ImpostorCard universe={universe} onHide={onToggle} />;
  if (!state.secret) return null;
  return (
    <Reveal
      universe={universe}
      secret={state.secret}
      scope={scopeReach(universe, state.settings.scope)}
      caption="O segredo — o impostor não sabe qual é"
      onHide={onToggle}
      flip
    />
  );
}

/** Os chutes de um jogador na rodada, com a contagem de cada um. */
function GuessList({ rows, playerId }) {
  const mine = rows.filter(row => row.playerId === playerId);
  if (!mine.length) return <small className="guesses muted">Não chutou</small>;
  return (
    <span className="guesses">
      {mine.map(row => (
        <span key={row.id} className="g">
          {row.sprite && <img src={row.sprite} alt="" loading="lazy" />}
          {row.name}
          {/* aberta a rodada, a linha volta inteira e o total sai das celulas */}
          {row.hits !== undefined && <b>{row.hits}/{row.total ?? Object.keys(row.cells ?? {}).length}</b>}
        </span>
      ))}
    </span>
  );
}

/**
 * A urna. Cada suspeito vem com os proprios chutes e contagens: e o que a mesa
 * olha para decidir, e com isso o voto nao precisa da tabela atras do modal.
 * Só quem estava na mesa quando a rodada abriu vota, ninguém vota em si mesmo,
 * e dá para trocar o voto enquanto a urna não fecha.
 */
function Ballot({ state, myId }) {
  const canVote = state.cast.includes(myId);
  const suspects = state.players.filter(p => state.cast.includes(p.id) && p.id !== myId);

  return (
    <>
      <p className="lede">
        {canVote
          ? `${state.voted.length} de ${state.cast.length} já votaram. Toque em quem você acha que não sabia o segredo — dá para trocar até a urna fechar.`
          : 'Você entrou no meio da rodada, então só assiste a esta votação.'}
      </p>
      <div className="suspects">
        {suspects.map(player => {
          const on = state.myVote === player.id;
          return (
            <button
              key={player.id}
              type="button"
              className={`suspect ${on ? 'on' : ''}`}
              disabled={!canVote}
              aria-pressed={on}
              onClick={() => socket.emit('game:vote', { suspectId: player.id })}
            >
              <span className="who">
                <Avatar name={player.name} size="sm" />
                <span className="nm">{player.name}</span>
                {on && <span className="tag-vote">Seu voto</span>}
                {!on && state.voted.includes(player.id) && <span className="n">já votou</span>}
              </span>
              <GuessList rows={state.rows} playerId={player.id} />
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Quem votou em quem, com o impostor marcado. */
export function VoteResult({ state, myId }) {
  if (!state.votes || !state.impostorId) return null;
  const count = {};
  for (const suspect of Object.values(state.votes)) count[suspect] = (count[suspect] ?? 0) + 1;
  const people = state.players.filter(p => state.cast.includes(p.id));

  return (
    <div className="suspects">
      {people.map(player => {
        const targetName = state.players.find(p => p.id === state.votes[player.id])?.name;
        const isImpostor = player.id === state.impostorId;
        return (
          <div key={player.id} className={`suspect ${isImpostor ? 'on' : ''}`}>
            <span className="who">
              <Avatar name={player.name} size="sm" />
              <span className="nm">{player.name}{player.id === myId ? ' (você)' : ''}</span>
              {isImpostor && <span className="tag-vote">Impostor</span>}
              <span className="n">{count[player.id] ?? 0} {count[player.id] === 1 ? 'voto' : 'votos'}</span>
            </span>
            <small className="muted">{targetName ? `Votou em ${targetName}` : 'Não votou'}</small>
            <GuessList rows={state.rows} playerId={player.id} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * A janela do fim da rodada do impostor: abre sozinha na votação, segue aberta
 * na espera do chute final e vira o gabarito quando a rodada fecha — o segredo,
 * quem era o impostor e quem votou em quem, de uma vez. Fechar só esconde: o
 * botão "Ver votação" na tela a traz de volta.
 */
export function ImpostorModal({ state, myId, universe, isHost, onClose }) {
  const left = useCountdown(state.deadline);
  const clock = left !== null && state.phase !== 'roundEnd'
    ? <span className="clock-pill">{String(left).padStart(2, '0')}s</span>
    : null;
  const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'alguém';

  let title;
  let body;
  if (state.phase === 'voting') {
    title = 'Quem é o impostor?';
    body = <Ballot state={state} myId={myId} />;
  } else if (state.phase === 'lastGuess') {
    title = `A mesa apontou ${nameOf(state.impostorId)}`;
    body = (
      <>
        <p className="lede">
          Era mesmo o impostor. Agora resta um chute para dizer o segredo: se acertar,
          vence mesmo assim.
        </p>
        <VoteResult state={state} myId={myId} />
      </>
    );
  } else {
    const how = state.outcome?.how;
    const crewWon = how === 'caught' || how === 'left';
    title = crewWon ? 'A mesa venceu' : 'O impostor venceu';
    body = (
      <>
        <p className="lede">{state.message}</p>
        {state.secret && (
          <Reveal universe={universe} secret={state.secret} scope={scopeReach(universe, state.settings.scope)} />
        )}
        <VoteResult state={state} myId={myId} />
      </>
    );
  }

  return (
    <Modal label={title} className="impostor" closeLabel="Ver a tabela" onClose={onClose}>
      <div className="modal-main">
        <div className="modal-title">
          <span className="mark"><MaskIcon width={22} height={22} /></span>
          <div>
            <h2>{title}</h2>
            <p>Rodada {state.round} de {state.settings.rounds}</p>
          </div>
          {clock}
        </div>

        <div className="stack">{body}</div>

        <div className="modal-foot">
          <button type="button" className="btn ghost lg" onClick={onClose}>Ver a tabela</button>
          {state.phase === 'roundEnd' && (isHost
            ? <button type="button" className="btn primary lg" onClick={() => socket.emit('game:next')}>Próxima rodada</button>
            : <span className="foot-note">Esperando o host puxar a próxima rodada...</span>)}
        </div>
      </div>
    </Modal>
  );
}
