import { useEffect, useMemo, useRef, useState } from 'react';
import { UNIVERSES, getUniverse } from '@shared/universes.js';
import { socket } from '../socket.js';
import { useDataset } from '../hooks/useDataset.js';
import { CopyIcon, ExitIcon } from '../components/Icon.jsx';

/**
 * O formulario guarda `endless` a parte porque no servidor ele nao existe:
 * partida sem fim e `rounds === 0`, e nesse caso rodadas e chutes voltam
 * zerados. Guardar um valor editavel aqui evita que os campos pisquem.
 */
const fromSettings = (s) => ({
  mode: s.mode,
  universe: s.universe,
  groups: s.groups,
  rounds: s.rounds || 5,
  turnSeconds: s.turnSeconds,
  guessesPerPlayer: s.guessesPerPlayer || 6,
  endless: s.rounds === 0,
});

const toSettings = (f) => ({
  mode: f.mode,
  universe: f.universe,
  groups: f.groups,
  rounds: f.endless ? 0 : f.rounds,
  turnSeconds: f.turnSeconds,
  guessesPerPlayer: f.guessesPerPlayer,
});

export default function LobbyScreen({ state, myId, toast, onLeave }) {
  const isHost = state.hostId === myId;
  const [form, setForm] = useState(() => fromSettings(state.settings));
  const wasHost = useRef(isHost);

  useEffect(() => {
    // convidado espelha o servidor; o host so ressincroniza ao ser promovido,
    // senao o eco do proprio broadcast atropelaria o que ele esta digitando
    if (!isHost || !wasHost.current) setForm(fromSettings(state.settings));
    wasHost.current = isHost;
  }, [state.settings, isHost]);

  const universe = getUniverse(form.universe);
  const items = useDataset(form.universe);

  const poolSize = useMemo(() => {
    if (!items) return null;
    const groups = new Set(form.groups);
    return items.filter(item => item.eligible && groups.has(item.group)).length;
  }, [items, form.groups]);

  function change(patch) {
    const next = { ...form, ...patch };
    // no duelo o indefinido nao existe: quem esconde o segredo so pontua
    // quando os chutes dos outros acabam
    if (next.mode === 'duel') next.endless = false;
    setForm(next);
    if (isHost) socket.emit('room:settings', toSettings(next));
  }

  function toggleGroup(id) {
    const groups = form.groups.includes(id)
      ? form.groups.filter(g => g !== id)
      : [...form.groups, id];
    if (!groups.length) return toast(`Deixe pelo menos ${universe.groupLabel.toLowerCase()} marcado.`);
    change({ groups });
  }

  async function copyInvite() {
    const link = `${location.origin}?sala=${state.code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copiado! Manda no grupo.');
    } catch {
      prompt('Copie o link:', link);
    }
  }

  const duel = form.mode === 'duel';
  const enoughPlayers = !duel || state.players.length >= 2;

  return (
    <main className="page">
      <div className="card wide stack">
        <div className="center-text">
          <span className="label">Código da sala</span>
          <div className="room-code">{state.code}</div>
          <button className="btn small ghost" onClick={copyInvite}>
            <CopyIcon width={16} height={16} /> Copiar convite
          </button>
        </div>

        <div>
          <span className="label">Jogadores ({state.players.length})</span>
          <ul className="player-list" style={{ marginTop: 8 }}>
            {state.players.map(player => (
              <li key={player.id}>
                <span className={`dot ${player.connected ? '' : 'off'}`} />
                <strong>{player.name}</strong>
                {player.id === myId && <span className="muted">(você)</span>}
                {player.id === state.hostId && <span className="pill host tag">Host</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="settings">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span className="label">Configurações</span>
            {!isHost && <span className="muted">só o host edita</span>}
          </div>

          <div className="field-row">
            <label className="field">
              <span>Modo</span>
              <select value={form.mode} disabled={!isHost} onChange={e => change({ mode: e.target.value })}>
                <option value="classic">Clássico — o servidor sorteia o segredo</option>
                <option value="duel">Duelo de escolhas — o jogador da vez escolhe</option>
              </select>
            </label>
            <label className="field">
              <span>Universo</span>
              <select
                value={form.universe}
                disabled={!isHost}
                onChange={e => change({
                  universe: e.target.value,
                  groups: [...getUniverse(e.target.value).defaultGroups],
                })}
              >
                {Object.values(UNIVERSES).map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </label>
          </div>

          <div className="field">
            <span>{universe.groupLabel}</span>
            <div className="chips">
              {universe.groups.map(group => (
                <button
                  key={group.id}
                  type="button"
                  className={`chip ${form.groups.includes(group.id) ? 'on' : ''}`}
                  disabled={!isHost}
                  aria-pressed={form.groups.includes(group.id)}
                  onClick={() => toggleGroup(group.id)}
                >
                  {group.label}
                </button>
              ))}
            </div>
            <p className="muted">
              {poolSize === null
                ? 'Carregando...'
                : `${poolSize} ${poolSize === 1 ? 'opção sorteável' : 'opções sorteáveis'} com essa seleção.`}
            </p>
          </div>

          <button
            type="button"
            className={`switch-row ${!isHost || duel ? 'off' : ''}`}
            disabled={!isHost || duel}
            onClick={() => change({ endless: !form.endless })}
          >
            <span className="text">
              Modo indefinido
              <small>
                {duel
                  ? 'O duelo precisa de teto de chutes para quem esconde pontuar.'
                  : 'Joga até alguém acertar, sem limite de chutes.'}
              </small>
            </span>
            <span className={`switch ${form.endless ? 'on' : ''}`}><span className="knob" /></span>
          </button>

          <div className="field-row">
            <label className={`field ${form.endless ? 'ignored' : ''}`}>
              <span>Rodadas</span>
              <input
                type="number" min={1} max={20} value={form.rounds} disabled={!isHost}
                /* mexer aqui e o que desliga o indefinido */
                onChange={e => change({ rounds: Number(e.target.value), endless: false })}
              />
            </label>
            <label className="field">
              <span>Segundos por turno</span>
              <input
                type="number" min={5} max={180} step={5} value={form.turnSeconds} disabled={!isHost}
                onChange={e => change({ turnSeconds: Number(e.target.value) })}
              />
            </label>
            <label className={`field ${form.endless ? 'ignored' : ''}`}>
              <span>Chutes por jogador</span>
              <input
                type="number" min={1} max={20} value={form.guessesPerPlayer} disabled={!isHost}
                onChange={e => change({ guessesPerPlayer: Number(e.target.value), endless: false })}
              />
            </label>
          </div>
        </div>

        {isHost && (
          <button className="btn primary big" disabled={!enoughPlayers} onClick={() => socket.emit('game:start')}>
            Começar partida
          </button>
        )}
        <p className="muted center-text">
          {!isHost
            ? 'Esperando o host começar...'
            : enoughPlayers ? '' : 'O modo duelo precisa de pelo menos 2 jogadores.'}
        </p>

        <button className="btn link" onClick={onLeave}><ExitIcon width={16} height={16} /> Sair da sala</button>
      </div>
    </main>
  );
}
