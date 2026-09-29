import { useCallback, useEffect, useState } from 'react';
import { socket } from '../socket.js';
import Avatar from './Avatar.jsx';
import GuessBar from './GuessBar.jsx';
import HintsTable from './HintsTable.jsx';
import TermoBoard from './TermoBoard.jsx';
import { BoltIcon, CheckIcon, ClockIcon, TrophyIcon } from './Icon.jsx';

const OUT_MS = 420;

/**
 * O tabuleiro de quem corre: o segredo atual da fila (a tabela de dicas no
 * Segredo, as letras no Termo) e, embaixo, o que ja ficou para tras. Cada
 * segredo resolvido limpa o tabuleiro e puxa o proximo da fila.
 */
export function SpeedBoard({ state, universe, items, inScope, toast }) {
  const race = state.speed;
  const me = race?.me;
  const playing = state.phase === 'playing';
  const termo = state.settings.game === 'termo';
  if (!race) return null;

  if (!me) {
    return <p className="empty-hint">Você entrou no meio da corrida: assiste esta e corre na próxima.</p>;
  }

  const at = me.done.length;   // muda a cada segredo que sai da frente: o campo recomeca
  return (
    <>
      {termo ? (
        me.termo && (
          <TermoBoard
            key={at}
            pattern={me.termo.pattern}
            tries={me.termo.tries}
            rows={me.rows}
            active={playing}
            cat={me.termo.cat}
            toast={toast}
            onSubmit={(word) => socket.emit('game:word', { word })}
          />
        )
      ) : (
        <>
          <GuessBar
            items={items}
            guessedIds={me.rows.map(row => row.id)}
            groups={state.settings.groups}
            inScope={inScope}
            active={playing}
            focusKey={at}
            onSubmit={(chosen) => (chosen
              ? socket.emit('game:guess', { pokemonId: chosen.id })
              : toast('Escolha um nome da lista.'))}
          />
          <HintsTable universe={universe} rows={me.rows} />
        </>
      )}

      {me.done.length > 0 && (
        <section className="speed-done" aria-label="Já resolvidos">
          {me.done.map((d, i) => (
            <span key={i} className={`speed-chip ${d.failed ? 'failed' : ''}`} title={d.failed ? 'As linhas acabaram' : `Em ${d.tries}`}>
              {d.sprite && <img src={d.sprite} alt="" loading="lazy" />}
              {d.label}
              {!d.failed && <small>{d.tries}</small>}
            </span>
          ))}
        </section>
      )}
    </>
  );
}

/** O placar da corrida: onde cada um esta na fila, sem nada do que ele chutou. */
export function SpeedTrack({ state, myId }) {
  const race = state.speed;
  if (!race) return null;
  const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'alguém';
  const order = Object.entries(race.runners)
    .sort((a, b) => b[1].solved - a[1].solved || (a[1].lastAt ?? Infinity) - (b[1].lastAt ?? Infinity));

  return (
    <section className="speed-track" aria-label="A corrida">
      {order.map(([id, r]) => (
        <div key={id} className={`speed-lane ${id === myId ? 'me' : ''} ${race.winnerId === id ? 'won' : ''}`}>
          <Avatar name={nameOf(id)} size="sm" />
          <span className="nm">{nameOf(id)}{id === myId ? ' (você)' : ''}</span>
          <span className="bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (r.solved / race.total) * 100)}%` }} />
          </span>
          <span className="n"><b>{r.solved}</b>/{race.total}</span>
          {state.phase === 'playing' && <small>{r.tries ? `${r.tries} no atual` : ''}</small>}
        </div>
      ))}
    </section>
  );
}

/** O aviso da velocidade: quanto falta da propria fila. */
export function speedBanner({ state, myId }) {
  const race = state.speed;
  const icon = <BoltIcon width={22} height={22} />;
  const noun = state.settings.game === 'termo' ? 'palavras' : 'segredos';
  if (!race) return { title: 'Velocidade', text: state.message ?? '', tone: '', icon };
  const mine = race.runners[myId];
  if (!mine) return { title: 'Corrida em andamento', text: 'Você entrou no meio: assiste esta.', tone: '', icon };
  const left = race.total - mine.solved;
  return {
    title: `Faltam ${left} ${left === 1 ? noun.slice(0, -1) : noun}`,
    text: state.message ?? `Resolva a fila de ${race.total} antes de todo mundo.`,
    tone: 'you',
    icon,
  };
}

/**
 * O fim da corrida na tela de cada um, no mesmo feitio do aviso das cartas:
 * quem perdeu fica sabendo quem terminou primeiro, o vencedor ve o seu. O
 * `seenRef` mora na tela da partida, e nao aqui, porque a tela troca de
 * galho quando a partida acaba — daqui ele nasceria de novo e o aviso nunca
 * apareceria.
 */
export function SpeedFx({ state, myId, seenRef }) {
  const race = state.speed;
  const [shown, setShown] = useState(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!race || !race.how || race.seq <= seenRef.current) return;
    seenRef.current = race.seq;
    const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'Alguém';
    const noun = state.settings.game === 'termo' ? 'palavras' : 'segredos';
    const mine = race.runners[myId];
    const won = race.winnerId === myId;
    const title = race.how === 'none' ? 'Tempo esgotado!'
      : won ? (race.how === 'time' ? 'O tempo acabou e você estava na frente!' : 'Você terminou primeiro!')
        : race.how === 'time' ? `Tempo esgotado: ${nameOf(race.winnerId)} venceu`
          : `${nameOf(race.winnerId)} terminou primeiro!`;
    setShown({
      key: race.seq,
      variant: won ? 'won' : mine ? 'lost' : 'watch',
      title,
      line: mine ? `Você resolveu ${mine.solved} de ${race.total} ${noun}.` : state.message,
    });
  }, [race?.seq, race?.how]);

  const dismiss = useCallback(() => {
    if (!shown || leaving) return;
    setLeaving(true);
    setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, OUT_MS);
  }, [shown, leaving]);

  useEffect(() => {
    if (!shown) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape' && event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }, [shown, dismiss]);

  if (!shown) return null;
  const Emblem = shown.variant === 'won' ? TrophyIcon : shown.variant === 'lost' ? ClockIcon : CheckIcon;
  return (
    <button
      type="button"
      key={shown.key}
      className={`card-fx speed-fx ${shown.variant} ${leaving ? 'out' : ''}`}
      onClick={dismiss}
      aria-label={`${shown.title}. Clique para continuar.`}
    >
      <span className="fx-glow" aria-hidden="true" />
      <span className="speed-emblem" aria-hidden="true"><Emblem width={64} height={64} strokeWidth={1.6} /></span>
      <span className="fx-caption" role="status" aria-live="assertive">
        <b>{shown.title}</b>
        {shown.line && <span>{shown.line}</span>}
        <small className="fx-hint">Clique para continuar</small>
      </span>
    </button>
  );
}
