import { useState } from 'react';
import { getUniverse, sanitizeScope } from '@shared/universes.js';
import { universeMeta } from '../lib/universeMeta.js';
import UniverseSelect from './UniverseSelect.jsx';
import Stepper from './Stepper.jsx';
import {
  BallMark, BulbIcon, CalendarIcon, CheckIcon, ClockIcon, CloseIcon,
  InfoIcon, SearchIcon, SparkIcon, SwordsIcon, TargetIcon,
} from './Icon.jsx';

/**
 * A sala nasce já configurada. Antes ela nascia com um padrão e o host arrumava
 * tudo no lobby, com os amigos entrando no meio da arrumação; aqui as regras
 * são escolhidas antes de existir código para compartilhar. O lobby continua
 * podendo mudar tudo — isto é só o ponto de partida.
 */
export default function CreateRoomModal({ name, onName, onClose, onCreate }) {
  const [mode, setMode] = useState('hunt');
  const [universeId, setUniverseId] = useState('pokemon');
  const [groups, setGroups] = useState(() => [...getUniverse('pokemon').defaultGroups]);
  const [rounds, setRounds] = useState(5);
  const [turnSeconds, setTurnSeconds] = useState(45);
  const [guessesPerPlayer, setGuessesPerPlayer] = useState(6);
  const [untilRight, setUntilRight] = useState(true);

  const universe = getUniverse(universeId);
  const meta = universeMeta(universeId);
  const duel = mode === 'duel';

  const changeUniverse = (id) => {
    setUniverseId(id);
    setGroups([...getUniverse(id).defaultGroups]);
  };

  const toggleGroup = (id) => {
    // deixar zero grupos marcados sortearia de um saco vazio: o último não sai
    const next = groups.includes(id) ? groups.filter(g => g !== id) : [...groups, id];
    if (next.length) setGroups(next);
  };

  const pickMode = (next) => {
    setMode(next);
    // no duelo quem esconde só pontua quando os chutes dos outros acabam
    if (next === 'duel') setUntilRight(false);
  };

  const create = () => onCreate({
    mode,
    universe: universeId,
    groups,
    scope: sanitizeScope(universe, null),
    rounds,
    turnSeconds,
    guessesPerPlayer: untilRight ? 0 : guessesPerPlayer,
  });

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Criar nova sala">
        <button type="button" className="close" aria-label="Fechar" onClick={onClose}>
          <CloseIcon width={18} height={18} />
        </button>

        <aside className="modal-side">
          <span className="side-tab on"><SparkIcon width={17} height={17} />Configurações</span>
          <BallMark className="side-art" />
          <div className="side-note">
            <div className="h"><BulbIcon width={14} height={14} />Dica</div>
            <p>
              {duel
                ? 'No duelo, quem esconde o segredo ganha pontos pelo tempo que os outros levam para achar.'
                : '“Até acertar” deixa a rodada só fechar em acerto. Bom para grupo grande — ninguém fica de fora.'}
            </p>
          </div>
        </aside>

        <div className="modal-main">
          <div className="modal-title">
            <span className="mark"><SparkIcon width={22} height={22} /></span>
            <div>
              <h2>Criar nova sala</h2>
              <p>Configure a partida do jeito que quiser e chame seus amigos.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <div className="f-label">
                Seu nome <span className="i" title="É como os outros vão te ver"><InfoIcon /></span>
              </div>
              <label className="text-field">
                <SearchIcon width={16} height={16} style={{ color: 'var(--muted)' }} />
                <input
                  value={name}
                  maxLength={16}
                  placeholder="Treinador"
                  autoComplete="nickname"
                  aria-label="Seu nome"
                  onChange={e => onName(e.target.value)}
                />
                <span className="count">{name.length}/16</span>
              </label>
            </div>

            <div className="field">
              <div className="f-label">
                Universo <span className="i" title="De onde sai o segredo"><InfoIcon /></span>
              </div>
              <UniverseSelect value={universeId} onChange={changeUniverse} showDesc={false} />
            </div>

            <div className="field wide">
              <div className="f-label">Modo de jogo</div>
              <div className="mode-pick">
                <button type="button" className={mode === 'hunt' ? 'on' : ''} onClick={() => pickMode('hunt')}>
                  <span className="ico"><SearchIcon width={17} height={17} /></span>
                  <span>
                    <b>Caça ao segredo</b>
                    <small>Ninguém sabe o segredo. Todo mundo adivinha junto.</small>
                  </span>
                </button>
                <button type="button" className={duel ? 'on' : ''} onClick={() => pickMode('duel')}>
                  <span className="ico"><SwordsIcon width={17} height={17} /></span>
                  <span>
                    <b>Duelo</b>
                    <small>Um jogador sorteado esconde, o resto adivinha.</small>
                  </span>
                </button>
              </div>
            </div>

            <div className="field wide">
              <div className="f-label">
                {universe.groupLabel} <span className="i" title="De onde o segredo pode sair"><InfoIcon /></span>
              </div>
              <div className="chips">
                {universe.groups.map(group => {
                  const on = groups.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`chip ${on ? 'on' : ''}`}
                      aria-pressed={on}
                      onClick={() => toggleGroup(group.id)}
                    >
                      {group.label}
                      <CheckIcon className="tick" width={13} height={13} />
                    </button>
                  );
                })}
              </div>
              <p className="f-help">Dá para marcar várias. Sempre fica pelo menos uma.</p>
            </div>

            <div className="field wide">
              <div className="f-label">Regras da partida</div>
              <button
                type="button"
                className={`switch-row ${untilRight ? 'on' : ''}`}
                disabled={duel}
                onClick={() => setUntilRight(v => !v)}
              >
                <span className="ico"><TargetIcon width={18} height={18} /></span>
                <span className="txt">
                  <b>Até acertar</b>
                  <small>
                    {duel
                      ? 'O duelo precisa de teto de chutes para quem esconde pontuar.'
                      : 'A rodada só fecha quando alguém acerta, sem teto de chutes.'}
                  </small>
                </span>
                <span className="switch"><i /></span>
              </button>

              <div className="steppers" style={{ marginTop: 12 }}>
                <Stepper
                  label="Rodadas"
                  icon={<CalendarIcon width={14} height={14} />}
                  value={rounds} min={1} max={20}
                  hint="Total da partida"
                  onChange={setRounds}
                />
                <Stepper
                  label="Tempo por turno"
                  icon={<ClockIcon width={14} height={14} />}
                  value={turnSeconds} min={5} max={180} step={5} suffix="s"
                  hint="Para mandar o chute"
                  onChange={setTurnSeconds}
                />
                <Stepper
                  label="Chutes por jogador"
                  icon={<TargetIcon width={14} height={14} />}
                  value={guessesPerPlayer} min={1} max={20}
                  off={untilRight}
                  hint={untilRight ? '“Até acertar” ignora o teto' : 'Máximo por rodada'}
                  onChange={(v) => { setGuessesPerPlayer(v); setUntilRight(false); }}
                />
              </div>
            </div>
          </div>

          <div className="modal-foot">
            <button type="button" className="btn ghost lg" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn violet lg" onClick={create}>
              Criar sala de {universe.label}
              <span className="mono xs" style={{ background: meta.gradient }}>{meta.mono}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
