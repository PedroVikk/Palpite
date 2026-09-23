import { socket } from '../socket.js';
import { formatValue } from '../lib/format.js';
import Avatar from './Avatar.jsx';

/**
 * "Qual deles?": a pergunta e as opções, que são os botões de resposta. Cada
 * um responde uma vez, sem troca — a rapidez é o que pontua. Fechada a
 * pergunta, as mesmas opções viram o gabarito: a certa em verde, a sua em
 * vermelho se errou, o valor de cada uma na coluna perguntada e quem marcou
 * o quê.
 */
export default function QuizPanel({ state, myId, universe }) {
  const q = state.question;
  if (!q) return null;
  const result = state.quizResult;
  const column = universe.columns.find(c => c.key === q.columnKey);
  const inRound = state.cast.includes(myId);
  const locked = state.phase !== 'playing' || state.myAnswer !== null || !inRound;
  const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'alguém';

  // no gabarito, quem marcou cada opção
  const pickersOf = (index) => Object.entries(result?.picks ?? {})
    .filter(([, pick]) => pick.index === index)
    .map(([id, pick]) => ({ id, ...pick }));

  // "Quem é esse Pokémon?": a silhueta no lugar do enunciado; fechada a
  // pergunta, ela acende na figura colorida de quem era
  const who = q.kind === 'who';
  const answerSprite = who && result ? result.sprites?.[result.answerIndex] : null;

  return (
    <section className={`quiz ${who ? 'who' : ''}`}>
      {who ? (
        <div className="quiz-q">
          <h2 className="who-title">{q.prompt}</h2>
          <div className="quiz-silhouette">
            {answerSprite
              ? <img key="color" className="lit" src={answerSprite} alt={q.options[result.answerIndex].name} />
              : <img key="shadow" src={q.image} alt="Silhueta" />}
          </div>
        </div>
      ) : q.value ? (
        // "tem" / "NÃO tem": o enunciado em cima, o que se procura em destaque
        <div className="quiz-q">
          <span className="k">{q.prompt}</span>
          <h2>{q.label}: <b>{q.value}</b></h2>
        </div>
      ) : (
        // maior / menor: a pergunta ja vem inteira do schema ("Qual deles é o mais pesado?")
        <div className="quiz-q">
          <span className="k">{q.label}</span>
          <h2 className="whole">{q.prompt}</h2>
        </div>
      )}

      <div className="quiz-options" style={{ '--quiz-cols': Math.min(q.options.length, 3) }}>
        {q.options.map((option, index) => {
          const mine = (result?.picks?.[myId]?.index ?? state.myAnswer) === index;
          const right = result && index === result.answerIndex;
          const wrong = result && mine && !right;
          return (
            <button
              key={option.id}
              type="button"
              className={['quiz-opt', mine ? 'mine' : '', right ? 'right' : '', wrong ? 'wrong' : ''].filter(Boolean).join(' ')}
              disabled={locked}
              onClick={() => socket.emit('game:answer', { index })}
            >
              {/* no "Quem é esse?" a figura de cada opção só chega no gabarito */}
              {(option.sprite ?? result?.sprites?.[index]) && (
                <img src={option.sprite ?? result.sprites[index]} alt="" loading="lazy" />
              )}
              <span className="nm">{option.name}</span>
              {result && column && <span className="val">{formatValue(column, result.values[index])}</span>}
              {result && (
                <span className="who">
                  {pickersOf(index).map(p => (
                    <span key={p.id} className="pick" title={`${nameOf(p.id)}${p.points ? ` +${p.points}` : ''}`}>
                      <Avatar name={nameOf(p.id)} size="xs" />
                      {p.points ? <small>+{p.points}</small> : null}
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="quiz-foot">
        {result
          ? (result.picks?.[myId]?.correct
            ? `Você acertou em ${(result.picks[myId].ms / 1000).toFixed(1)}s: +${result.picks[myId].points} pontos.`
            : result.picks?.[myId] ? 'Não foi dessa vez.' : 'Você não respondeu esta.')
          : !inRound
            ? 'Você entrou no meio desta pergunta: responde a próxima.'
            : state.myAnswer !== null
              ? `Resposta enviada. ${state.answered.length} de ${state.cast.length} já responderam.`
              : 'Responda rápido: quanto antes acertar, mais pontos (de 50 a 100).'}
      </p>
    </section>
  );
}
