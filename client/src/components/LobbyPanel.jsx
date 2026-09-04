import { useEffect, useMemo, useRef, useState } from 'react';
import { getUniverse, scopeFilter, sanitizeScope } from '@shared/universes.js';
import { socket } from '../socket.js';
import { useDataset } from '../hooks/useDataset.js';
import Avatar from './Avatar.jsx';
import UniverseSelect from './UniverseSelect.jsx';
import UniverseIcon from './UniverseIcon.jsx';
import Stepper from './Stepper.jsx';
import {
  CalendarIcon, CheckIcon, ClockIcon, CopyIcon, ExitIcon, SearchIcon,
  ShareIcon, SwordsIcon, TargetIcon, UsersIcon,
} from './Icon.jsx';

const MAX_SEATS = 8;

/**
 * O formulario guarda `untilRight` a parte porque no servidor ele e so o
 * `guessesPerPlayer === 0`. Guardar o numero editavel aqui evita que o campo
 * "chutes por jogador" pisque enquanto o "ate acertar" esta ligado.
 */
const fromSettings = (s) => ({
  mode: s.mode,
  universe: s.universe,
  groups: s.groups,
  scope: s.scope ?? null,
  rounds: s.rounds || 5,
  turnSeconds: s.turnSeconds,
  guessesPerPlayer: s.guessesPerPlayer || 6,
  untilRight: s.guessesPerPlayer === 0,
});

const toSettings = (f) => ({
  mode: f.mode,
  universe: f.universe,
  groups: f.groups,
  scope: f.scope,
  rounds: f.rounds,
  turnSeconds: f.turnSeconds,
  guessesPerPlayer: f.untilRight ? 0 : f.guessesPerPlayer,
});

/**
 * A sala de espera mora no mesmo modal em que ela foi configurada: o codigo e a
 * lista de gente ficam na lateral, as regras seguem editaveis pelo host. Quem
 * entra por link tambem cai aqui, sobre a home — a sala nunca e outra tela.
 */
export default function LobbyPanel({ state, myId, toast, onLeave }) {
  const isHost = state.hostId === myId;
  const [form, setForm] = useState(() => fromSettings(state.settings));
  const wasHost = useRef(isHost);

  useEffect(() => {
    // convidado espelha o servidor; o host so ressincroniza ao ser promovido,
    // senao o eco do proprio broadcast atropelaria o que ele esta mexendo
    if (!isHost || !wasHost.current) setForm(fromSettings(state.settings));
    wasHost.current = isHost;
  }, [state.settings, isHost]);

  const universe = getUniverse(form.universe);
  const items = useDataset(form.universe);

  const poolSize = useMemo(() => {
    if (!items) return null;
    const groups = new Set(form.groups);
    const inScope = scopeFilter(universe, form.scope);
    return items.filter(item => item.eligible && groups.has(item.group) && inScope(item)).length;
  }, [items, form.groups, form.scope, universe]);

  function change(patch) {
    const next = { ...form, ...patch };
    // no duelo o "ate acertar" nao existe: quem esconde o segredo so pontua
    // quando os chutes dos outros acabam
    if (next.mode === 'duel') next.untilRight = false;
    setForm(next);
    if (isHost) socket.emit('room:settings', toSettings(next));
  }

  // as epocas ligadas, ja normalizadas: vazio ou torto vira "todas"
  const epocas = sanitizeScope(universe, form.scope) ?? [];

  function toggleScope(id) {
    const scope = epocas.includes(id) ? epocas.filter(e => e !== id) : [...epocas, id];
    if (!scope.length) return toast(`Deixe pelo menos uma opção de ${universe.scope.label.toLowerCase()} marcada.`);
    change({ scope });
  }

  function toggleGroup(id) {
    const groups = form.groups.includes(id)
      ? form.groups.filter(g => g !== id)
      : [...form.groups, id];
    if (!groups.length) return toast(`Deixe pelo menos ${universe.groupLabel.toLowerCase()} marcado.`);
    change({ groups });
  }

  const link = `${location.origin}?sala=${state.code}`;

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copiado! Manda no grupo.');
    } catch {
      prompt('Copie o link:', link);
    }
  }

  async function shareInvite() {
    if (!navigator.share) return copyInvite();
    try {
      await navigator.share({ title: 'Palpite', text: `Entra na minha sala: ${state.code}`, url: link });
    } catch { /* cancelar o compartilhamento nao e erro */ }
  }

  const duel = form.mode === 'duel';
  const enoughPlayers = !duel || state.players.length >= 2;
  const seatsLeft = Math.max(0, MAX_SEATS - state.players.length);

  return (
    <>
      <aside className="modal-side room-side">
        <section className="codecard">
          <div className="k">Código da sala</div>
          <div className="v">{state.code}</div>
          <div className="row">
            <button className="btn ghost block" onClick={copyInvite}>
              <CopyIcon width={15} height={15} /> Copiar convite
            </button>
            <button className="btn violet" aria-label="Compartilhar" onClick={shareInvite}>
              <ShareIcon width={15} height={15} />
            </button>
          </div>
        </section>

        <div className="side-seats">
          <div className="h">
            <UsersIcon width={13} height={13} strokeWidth={2.2} />
            Jogadores
            <span className="n">{state.players.length} de {MAX_SEATS}</span>
          </div>
          <ul className="players">
            {state.players.map(player => (
              <li
                key={player.id}
                className={[
                  player.id === myId ? 'me' : '',
                  player.connected ? '' : 'gone',
                ].filter(Boolean).join(' ')}
              >
                <i className={`dot ${player.connected ? '' : 'off'}`} />
                <Avatar name={player.name} size="sm" />
                <span className="nm">
                  {player.name}
                  {player.id === myId && <small> (você)</small>}
                </span>
                {player.id === state.hostId && <span className="tag purple">Host</span>}
                {!player.connected && <span className="tag ghost">Caiu</span>}
              </li>
            ))}
            {seatsLeft > 0 && (
              <li className="empty-seat">
                <span className="slot">+</span>
                {seatsLeft === 1 ? 'Cabe mais uma pessoa' : `Cabem mais ${seatsLeft} pessoas`}
              </li>
            )}
          </ul>
        </div>
      </aside>

      <div className="modal-main">
        <div className="modal-title">
          {/* a cara do universo em jogo: a sala já diz de onde sai o segredo */}
          <UniverseIcon universe={form.universe} />
          <div>
            <h2>Sala de espera</h2>
            <p>
              {isHost
                ? 'Chame a turma pelo código e comece quando todo mundo estiver dentro.'
                : 'Só o host edita as regras. A partida começa a qualquer momento.'}
            </p>
          </div>
        </div>

        <div className="stack">
          <div className="field">
            <div className="f-label">Modo de jogo</div>
            <div className="mode-pick">
              <button
                type="button"
                className={!duel ? 'on' : ''}
                disabled={!isHost}
                onClick={() => change({ mode: 'hunt' })}
              >
                <span className="ico"><SearchIcon width={17} height={17} /></span>
                <span>
                  <b>Caça ao segredo</b>
                  <small>Ninguém sabe o segredo. Todo mundo adivinha junto.</small>
                </span>
              </button>
              <button
                type="button"
                className={duel ? 'on' : ''}
                disabled={!isHost}
                onClick={() => change({ mode: 'duel' })}
              >
                <span className="ico"><SwordsIcon width={17} height={17} /></span>
                <span>
                  <b>Duelo</b>
                  <small>Um jogador sorteado esconde, o resto adivinha.</small>
                </span>
              </button>
            </div>
          </div>

          <div className="field">
            <div className="f-label">Universo</div>
            <UniverseSelect
              value={form.universe}
              disabled={!isHost}
              onChange={(id) => change({
                universe: id,
                groups: [...getUniverse(id).defaultGroups],
                scope: sanitizeScope(getUniverse(id), null),
              })}
            />
          </div>

          {universe.scope && (
            <div className="field">
              <div className="f-label">{universe.scope.label}</div>
              <div className="chips">
                {universe.scope.options.map(option => {
                  const on = epocas.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`chip ${on ? 'on' : ''}`}
                      disabled={!isHost}
                      aria-pressed={on}
                      title={option.hint}
                      onClick={() => toggleScope(option.id)}
                    >
                      {option.label}
                      <CheckIcon className="tick" width={13} height={13} />
                    </button>
                  );
                })}
              </div>
              <p className="f-help">
                {universe.scope.options.filter(o => epocas.includes(o.id)).map(o => o.hint).join(' ')}
              </p>
            </div>
          )}

          <div className="field">
            <div className="f-label">{universe.groupLabel}</div>
            <div className="chips">
              {universe.groups.map(group => {
                const on = form.groups.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    className={`chip ${on ? 'on' : ''}`}
                    disabled={!isHost}
                    aria-pressed={on}
                    onClick={() => toggleGroup(group.id)}
                  >
                    {group.label}
                    <CheckIcon className="tick" width={13} height={13} />
                  </button>
                );
              })}
            </div>
            <p className="f-help">
              {poolSize === null
                ? 'Carregando...'
                : <><b>{poolSize}</b> {poolSize === 1 ? 'opção sorteável' : 'opções sorteáveis'} com essa seleção.</>}
            </p>
          </div>

          <div className="field">
            <div className="f-label">Regras da partida</div>
            <button
              type="button"
              className={`switch-row ${form.untilRight ? 'on' : ''}`}
              disabled={!isHost || duel}
              onClick={() => change({ untilRight: !form.untilRight })}
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
                value={form.rounds} min={1} max={20}
                hint="Total da partida"
                disabled={!isHost}
                onChange={(v) => change({ rounds: v })}
              />
              <Stepper
                label="Tempo por turno"
                icon={<ClockIcon width={14} height={14} />}
                value={form.turnSeconds} min={5} max={180} step={5} suffix="s"
                hint="Para mandar o chute"
                disabled={!isHost}
                onChange={(v) => change({ turnSeconds: v })}
              />
              <Stepper
                label="Chutes por jogador"
                icon={<TargetIcon width={14} height={14} />}
                value={form.guessesPerPlayer} min={1} max={20}
                off={form.untilRight}
                hint={form.untilRight ? '“Até acertar” ignora o teto' : 'Máximo por rodada'}
                disabled={!isHost}
                /* mexer aqui desliga o "ate acertar" */
                onChange={(v) => change({ guessesPerPlayer: v, untilRight: false })}
              />
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost lg" onClick={onLeave}>
            <ExitIcon width={15} height={15} /> Sair da sala
          </button>
          {isHost ? (
            <button
              type="button"
              className="btn primary lg"
              disabled={!enoughPlayers}
              onClick={() => socket.emit('game:start')}
            >
              Começar partida
            </button>
          ) : (
            <span className="foot-note">Esperando o host começar...</span>
          )}
        </div>

        {isHost && (
          <p className="f-help center-text" style={{ marginTop: 10 }}>
            {enoughPlayers
              ? 'Todo mundo cai direto na primeira rodada.'
              : 'O modo duelo precisa de pelo menos 2 jogadores.'}
          </p>
        )}
      </div>
    </>
  );
}
