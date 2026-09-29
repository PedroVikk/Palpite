import { useState } from 'react';
import { getUniverse, roomDefaults } from '@shared/universes.js';
import { useDataset } from '../hooks/useDataset.js';
import { canPlayPicture } from '../lib/picture.js';
import {
  PRESETS, applyPreset, applyRules, newForm, presetOn, summaryOf, toSettings,
} from '../lib/roomForm.js';
import UniverseSelect from './UniverseSelect.jsx';
import UniverseIcon from './UniverseIcon.jsx';
import ModePick, { GamePick, gameLabel, styleLabel } from './ModePick.jsx';
import RoomRules from './RoomRules.jsx';
import {
  BoltIcon, CardsIcon, CheckIcon, ImageIcon, MaskIcon, QuestionIcon, RestartIcon, TargetIcon, TermoIcon, UsersIcon,
} from './Icon.jsx';

const PRESET_ICON = {
  rapida: BoltIcon,
  classica: TargetIcon,
  semfim: RestartIcon,
  imagem: ImageIcon,
  termo: TermoIcon,
  impostor: MaskIcon,
  quiz: QuestionIcon,
  cartas: CardsIcon,
};

/**
 * A sala nasce já configurada: as regras são escolhidas antes de existir código
 * para compartilhar. À direita ficam os atalhos (um clique monta a partida
 * inteira) e o resumo do que a mesa vai jogar. Criada, este painel dá lugar ao
 * da sala dentro do mesmo modal.
 */
export default function CreateRoomPanel({ name, onName, onClose, onCreate }) {
  const [form, setForm] = useState(() => newForm('pokemon'));
  const universe = getUniverse(form.universe);
  const comImagem = canPlayPicture(useDataset(form.universe));
  const opts = { comImagem };

  const change = (patch) => setForm(f => applyRules(f, patch, opts));
  const changeUniverse = (id) => change({ universe: id, ...roomDefaults(getUniverse(id)) });

  // deixar zero marcados sortearia de um saco vazio: o último não sai
  const toggleIn = (key, id) => {
    const list = form[key] ?? [];
    const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
    if (next.length) change({ [key]: next });
  };

  /**
   * Por onde a sala se recorta aqui. Onde existe época, é ela que aparece; o
   * recorte `nested` (filtro dentro dos grupos) mostra as duas linhas.
   */
  const groupAxis = { key: 'groups', label: universe.groupLabel, options: universe.groups };
  const scopeAxis = universe.scope && { key: 'scope', label: universe.scope.label, options: universe.scope.options };
  const axes = !universe.scope ? [groupAxis]
    : universe.scope.nested ? [groupAxis, scopeAxis]
    : [scopeAxis];

  const create = () => onCreate(toSettings(form, comImagem));

  return (
    <>
      <div className="modal-main">
        <div className="modal-title">
          <UniverseIcon universe={form.universe} />
          <div>
            <h2>Criar sala</h2>
            <p>{gameLabel(form.game)} · {styleLabel(form.mode)} · {universe.label}</p>
          </div>
        </div>

        <section className="form-sec">
          <h3>Você e o tema</h3>
          <div className="form-grid">
            <label className="field">
              <span className="f-label">Seu nome</span>
              <span className="text-field">
                <UsersIcon width={16} height={16} style={{ color: 'var(--muted)' }} />
                <input
                  value={name}
                  maxLength={16}
                  placeholder="Treinador"
                  autoComplete="nickname"
                  aria-label="Seu nome"
                  onChange={e => onName(e.target.value)}
                />
                <span className="count">{name.length}/16</span>
              </span>
            </label>
            <div className="field">
              <div className="f-label">Tema</div>
              <UniverseSelect value={form.universe} onChange={changeUniverse} showDesc={false} />
            </div>
          </div>

          {axes.map(axis => (
            <div className="field" key={axis.key} style={{ marginTop: 16 }}>
              <div className="f-label">{axis.label}</div>
              <div className="chips">
                {axis.options.map(option => {
                  const on = (form[axis.key] ?? []).includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`chip ${on ? 'on' : ''}`}
                      aria-pressed={on}
                      title={option.hint}
                      onClick={() => toggleIn(axis.key, option.id)}
                    >
                      {option.label}
                      <CheckIcon className="tick" width={13} height={13} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="form-sec">
          <h3>Modo</h3>
          <GamePick value={form.game} onChange={(game) => change({ game })} />
          <h3 className="sub">Estilo</h3>
          <ModePick className="three" value={form.mode} game={form.game} onChange={(mode) => change({ mode })} />
        </section>

        <section className="form-sec">
          <h3>Regras</h3>
          <RoomRules form={form} universe={universe} comImagem={comImagem} onChange={change} />
        </section>

        <div className="modal-foot">
          <button type="button" className="btn ghost lg" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn violet lg" onClick={create}>
            Criar sala de {universe.label}
            <UniverseIcon universe={form.universe} size="xs" />
          </button>
        </div>
      </div>

      <aside className="modal-side create-side">
        <section>
          <h3>Atalhos</h3>
          <div className="presets">
            {PRESETS.map(preset => {
              const Icon = PRESET_ICON[preset.id];
              const on = presetOn(form, preset);
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`preset ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => setForm(f => applyPreset(f, preset, opts))}
                >
                  <span className="ico"><Icon width={16} height={16} /></span>
                  <span className="tx">
                    <b>{preset.label}</b>
                    <small>{preset.note}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="summary-box">
          <h3>Resumo</h3>
          <dl>
            {summaryOf(form, universe, comImagem).map(row => (
              <div key={row.k}>
                <dt>{row.k}</dt>
                <dd>{row.v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </aside>
    </>
  );
}
