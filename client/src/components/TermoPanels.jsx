import { useMemo } from 'react';
import { scopeFilter } from '@shared/universes.js';
import { termoNames, termoThemeWords } from '@shared/termo.js';
import { socket } from '../socket.js';
import GuessBar from './GuessBar.jsx';
import TermoBoard, { TermoMini, TermoReveal } from './TermoBoard.jsx';
import { CheckIcon, ClockIcon, TermoIcon } from './Icon.jsx';

/** Como o tabuleiro de alguem terminou, numa etiqueta curta. */
function doneLabel(done, rows) {
  if (!done) return `${rows} ${rows === 1 ? 'linha' : 'linhas'}`;
  if (done.solved) return `acertou em ${done.used}${done.points ? ` · +${done.points}` : ''}`;
  return 'não acertou';
}

/**
 * O Termo da sala: o seu tabuleiro, grande e com teclado, e o dos outros em
 * miniatura. Durante a rodada o servidor manda so as cores dos outros — e o
 * que da a corrida do x1 sem virar cola. Fechada a rodada, chegam as letras.
 */
export default function TermoTable({ state, myId, toast }) {
  const termo = state.termo;
  if (!termo) return null;

  const playing = state.phase === 'playing';
  const inCast = state.cast.includes(myId);
  const mine = termo.boards[myId] ?? [];
  const myDone = termo.done[myId];
  const rivals = state.cast.filter(id => id !== myId);
  const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'alguém';
  const over = !playing;

  return (
    <>
      {/* no duelo, quem escolheu ve a propria palavra enquanto os outros correm */}
      {termo.answer && <TermoReveal answer={termo.answer} caption={over ? 'A palavra era' : 'Sua palavra'} />}
      {inCast && (
        <TermoBoard
          pattern={termo.pattern}
          tries={termo.tries}
          rows={mine}
          active={playing && !myDone}
          cat={termo.cat}
          toast={toast}
          onSubmit={(word) => socket.emit('game:word', { word })}
        />
      )}

      {rivals.length > 0 && (
        <section className="termo-rivals" aria-label="Tabuleiros dos outros">
          {rivals.map(id => {
            const rows = termo.boards[id] ?? [];
            const done = termo.done[id];
            return (
              <div key={id} className={`termo-rival ${done?.solved ? 'won' : ''} ${over || !inCast ? 'wide' : ''}`}>
                <div className="who">
                  {done?.solved ? <CheckIcon width={14} height={14} /> : <ClockIcon width={14} height={14} />}
                  {nameOf(id)}
                  <small>{doneLabel(done, rows.length)}</small>
                </div>
                <TermoMini pattern={termo.pattern} tries={termo.tries} rows={rows} />
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

/**
 * A escolha da palavra que se esconde, no duelo e na batalha: a busca de
 * sempre, so que sobre os sacos do Termo — os nomes no recorte da sala e as
 * palavras do tema. O servidor confere que a escolhida esta neles.
 */
export function TermoChooser({ state, universe, items }) {
  const options = useMemo(() => {
    const groups = new Set(state.settings.groups);
    const inScope = scopeFilter(universe, state.settings.scope);
    const names = termoNames(items, universe).filter(e => groups.has(e.item.group) && inScope(e.item));
    return [...names, ...termoThemeWords(universe.id)].map(entry => ({
      id: entry.key,
      name: entry.cat === names[0]?.cat ? entry.label : `${entry.label} · ${entry.cat}`,
      sprite: entry.item?.sprite ?? null,
      eligible: true,
    }));
  }, [items, universe, state.settings.groups, state.settings.scope]);

  return (
    <GuessBar
      items={options}
      guessedIds={[]}
      active
      choosing
      focusKey={state.phase}
      onSubmit={(chosen) => chosen && socket.emit('game:chooseWord', { word: chosen.id })}
    />
  );
}

/**
 * A batalha do Termo: o tabuleiro do alvo aberto, com as linhas de todo mundo
 * contra ele (letra e cor sao da mesa, como na batalha do segredo) e o teclado
 * para quem esta na vez. Sem teto: cresce uma linha por tiro.
 */
export function TermoBattleBoard({ state, targetId, active, toast }) {
  const target = state.termo?.targets?.[targetId];
  if (!target) return null;
  const rows = state.rows.filter(row => row.targetId === targetId);
  return (
    <TermoBoard
      pattern={target.pattern}
      tries={Math.max(6, rows.length + 1)}
      rows={rows}
      active={active && !state.sunk[targetId]}
      cat={target.cat}
      toast={toast}
      onSubmit={(word) => socket.emit('game:word', { word, targetId })}
    />
  );
}

/** O aviso do Termo: na corrida nao ha vez, entao ele fala do seu tabuleiro. */
export function termoBanner({ state, myId, nameOf }) {
  const icon = <TermoIcon width={22} height={22} />;
  const termo = state.termo;
  const done = termo?.done?.[myId];
  const letters = termo ? `${termo.length} letras` : '';
  const chooser = state.chooserId && state.chooserId === myId;
  // a categoria no titulo: o texto de baixo e trocado pelas mensagens da rodada
  const cat = termo?.cat ? ` · ${termo.cat}` : '';

  if (state.phase === 'choosing') {
    return chooser
      ? { title: 'Escolha a palavra', text: 'Um nome ou algo do tema — os outros vão correr atrás dela.', tone: 'warn', icon }
      : { title: 'Aguardando a palavra', text: `${nameOf(state.chooserId)} está escolhendo...`, tone: '', icon: <ClockIcon width={22} height={22} /> };
  }

  if (state.phase === 'playing' && chooser) {
    return {
      title: `Você escondeu a palavra${cat}`,
      text: state.message ?? 'Só assista: se ninguém acertar, você pontua.',
      tone: 'warn',
      icon,
    };
  }

  if (state.phase === 'playing') {
    if (!state.cast.includes(myId)) {
      return { title: `Rodada em andamento${cat}`, text: 'Você entrou no meio: assiste esta e joga a próxima.', tone: '', icon };
    }
    if (done?.solved) {
      return {
        title: `Acertou em ${done.used}! +${done.points}`,
        text: state.message ?? 'Agora é torcer: a rodada fecha quando todo mundo terminar.',
        tone: 'you',
        icon: <CheckIcon width={22} height={22} />,
      };
    }
    if (done) {
      return { title: 'Suas linhas acabaram', text: 'A palavra aparece quando a rodada fechar.', tone: 'warn', icon };
    }
    return {
      title: `Rodada ${state.round}${state.settings.rounds ? ` de ${state.settings.rounds}` : ''}${cat}`,
      text: state.message ?? `${letters}${termo?.cat ? ` · ${termo.cat}` : ''}. Verde: letra no lugar certo. Amarelo: existe, mas em outro lugar.`,
      tone: 'you',
      icon,
    };
  }

  return {
    title: done?.solved ? `Você acertou! +${done.points}` : 'Fim da rodada',
    text: state.message ?? '',
    tone: done?.solved ? 'you' : '',
    icon,
  };
}
