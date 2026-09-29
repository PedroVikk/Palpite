import Stepper from './Stepper.jsx';
import { DraftStepper } from './CardsRules.jsx';
import { effective } from '../lib/roomForm.js';
import { BulbIcon, CalendarIcon, CardIcon, CardsIcon, ClockIcon, ImageIcon, TargetIcon } from './Icon.jsx';

/** Uma chave compacta da grade de regras. */
function Toggle({ on, disabled, icon, title, note, onClick }) {
  return (
    <button
      type="button"
      className={`switch-row compact ${on ? 'on' : ''}`}
      disabled={disabled}
      aria-pressed={on}
      onClick={onClick}
    >
      <span className="ico">{icon}</span>
      <span className="txt">
        <b>{title}</b>
        <small>{note}</small>
      </span>
      <span className="switch"><i /></span>
    </button>
  );
}

/**
 * As regras da partida, iguais na criacao e na sala de espera: primeiro os
 * numeros (rodadas, tempo, chutes), depois as chaves. Os tres numeros aceitam
 * infinito em todo modo — menos as voltas do impostor, que sem teto nunca
 * chegariam na votacao.
 */
export default function RoomRules({ form, universe, comImagem = true, disabled = false, onChange }) {
  const on = effective(form, comImagem);
  const { termo, impostor, battle, quiz, speed, duel, termoRace } = on;
  const plain = !impostor && !battle && !quiz && !termo && !speed;

  const roundsBack = speed ? 3 : battle ? 1 : quiz ? 10 : 5;
  const timeBack = speed ? 180 : termoRace ? 120 : quiz ? 15 : 45;

  const roundsLabel = quiz ? 'Perguntas' : speed ? (termo ? 'Palavras' : 'Segredos') : battle ? 'Batalhas' : 'Rodadas';
  const timeLabel = quiz ? 'Tempo por pergunta' : speed ? 'Tempo da corrida' : termoRace ? 'Tempo da rodada' : 'Tempo por vez';

  const toggles = [];
  if (impostor) {
    toggles.push(
      <Toggle
        key="card" on={form.card} disabled={disabled} icon={<CardIcon width={17} height={17} />}
        title="Ficha de cada chute" note="Mostra os dados, sem dizer o que bate."
        onClick={() => onChange({ card: !form.card })}
      />,
    );
  }
  if (speed) {
    toggles.push(
      <Toggle
        key="same" on={form.speedSame} disabled={disabled} icon={<TargetIcon width={17} height={17} />}
        title="Mesma fila para todos" note={form.speedSame ? 'Todos na mesma ordem.' : 'Cada um com a sua fila.'}
        onClick={() => onChange({ speedSame: !form.speedSame })}
      />,
    );
  }
  if (!termo && !speed) {
    toggles.push(
      <Toggle
        key="cards" on={form.cards} disabled={disabled} icon={<CardsIcon width={17} height={17} />}
        title="Cartas de efeito" note={battle ? 'Um draft na largada da batalha.' : 'Drafts de 1 em 3 ao longo da partida.'}
        onClick={() => onChange({ cards: !form.cards })}
      />,
    );
  }
  if (!quiz && !termo && !speed) {
    toggles.push(
      <Toggle
        key="picture" on={on.picture} disabled={disabled || !plain || !comImagem}
        icon={<ImageIcon width={17} height={17} />} title="Pela imagem"
        note={!comImagem ? `${universe.label} não tem figuras.`
          : impostor ? 'Não vale no impostor.'
          : battle ? 'Não vale na batalha naval.'
          : 'A figura clareia a cada erro.'}
        onClick={() => onChange({ picture: !form.picture })}
      />,
      <Toggle
        key="hints" on={on.tableHints} disabled={disabled || !plain}
        icon={<BulbIcon width={17} height={17} />} title="Dicas da mesa"
        note={impostor ? 'Não vale no impostor.'
          : battle ? 'Não vale na batalha naval.'
          : 'Tamanho do nome e inicial, pagos na vez.'}
        onClick={() => onChange({ tableHints: !form.tableHints })}
      />,
    );
  }

  return (
    <div className="room-rules">
      <div className="steppers">
        <Stepper
          label={roundsLabel}
          icon={<CalendarIcon width={14} height={14} />}
          value={form.rounds || roundsBack} min={1} max={20}
          hint={form.rounds === 0 ? 'Até o host encerrar'
            : battle ? 'Cada uma até sobrar um'
            : speed ? 'Na fila de cada um' : 'Total da partida'}
          disabled={disabled}
          infinite={form.rounds === 0}
          onInfinite={() => onChange({ rounds: form.rounds === 0 ? roundsBack : 0 })}
          onChange={(v) => onChange({ rounds: v })}
        />
        <Stepper
          label={timeLabel}
          icon={<ClockIcon width={14} height={14} />}
          value={form.turnSeconds || timeBack} min={5} max={180} step={5} suffix="s"
          hint={form.turnSeconds === 0 ? 'Sem relógio'
            : quiz ? 'Para todos responderem'
            : speed ? 'Acabou, vence quem resolveu mais'
            : termoRace ? 'Para fechar o tabuleiro' : 'Para mandar o chute'}
          disabled={disabled}
          infinite={form.turnSeconds === 0}
          onInfinite={() => onChange({ turnSeconds: form.turnSeconds === 0 ? timeBack : 0 })}
          onChange={(v) => onChange({ turnSeconds: v })}
        />
        {quiz ? (
          <Stepper
            label="Opções"
            icon={<TargetIcon width={14} height={14} />}
            value={form.choices} min={2} max={5}
            hint="Respostas por pergunta"
            disabled={disabled}
            onChange={(v) => onChange({ choices: v })}
          />
        ) : impostor ? (
          <Stepper
            label="Voltas"
            icon={<TargetIcon width={14} height={14} />}
            value={form.guessesPerPlayer} min={1} max={5}
            hint="Um chute de cada por volta"
            disabled={disabled}
            onChange={(v) => onChange({ guessesPerPlayer: v })}
          />
        ) : battle || (speed && !termo) ? (
          <Stepper
            label="Chutes por jogador"
            icon={<TargetIcon width={14} height={14} />}
            value={0} off offValue="∞"
            hint={battle ? 'A batalha não tem teto' : 'Errar só custa tempo'}
            onChange={() => {}}
          />
        ) : (
          <Stepper
            label={termo ? 'Tentativas' : 'Chutes por jogador'}
            icon={<TargetIcon width={14} height={14} />}
            value={form.guessesPerPlayer} min={termo ? 4 : 1} max={termo ? 10 : 20}
            hint={on.untilRight
              ? (termo ? 'Linhas sem fim' : 'Até alguém acertar')
              : termo ? 'Linhas do tabuleiro'
              : duel ? 'Com teto, quem esconde pontua' : 'Máximo por rodada'}
            disabled={disabled}
            infinite={on.untilRight}
            onInfinite={() => onChange({ untilRight: !form.untilRight })}
            onChange={(v) => onChange({ guessesPerPlayer: v })}
          />
        )}
        {on.cards && (
          <DraftStepper value={form.draftEvery} mode={form.mode} disabled={disabled} onChange={(v) => onChange({ draftEvery: v })} />
        )}
      </div>

      {toggles.length > 0 && <div className="rule-grid">{toggles}</div>}
    </div>
  );
}
