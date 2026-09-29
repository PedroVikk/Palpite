import { useEffect, useMemo, useRef, useState } from 'react';
import { getUniverse, roomDefaults, scopeFilter, sanitizeScope } from '@shared/universes.js';
import { socket } from '../socket.js';
import { useDataset } from '../hooks/useDataset.js';
import { canPlayPicture, hasPicture } from '../lib/picture.js';
import { termoNames, termoThemeWords } from '@shared/termo.js';
import Avatar from './Avatar.jsx';
import UniverseSelect from './UniverseSelect.jsx';
import UniverseIcon from './UniverseIcon.jsx';
import ModePick, { GamePick } from './ModePick.jsx';
import RoomRules from './RoomRules.jsx';
import { applyRules, fromSettings, toSettings } from '../lib/roomForm.js';
import { CheckIcon, CopyIcon, ExitIcon, ShareIcon, UsersIcon } from './Icon.jsx';

/** O impostor precisa de gente para desconfiar (IMPOSTOR_MIN_PLAYERS no servidor). */
const IMPOSTOR_MIN = 3;

const MAX_SEATS = 8;

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
  const comImagem = canPlayPicture(items);

  // quantos podem sair no sorteio com a selecao atual. A imagem entra na
  // conta: com a chave ligada, quem nao tem figura nao e sorteavel
  // no Termo conta quem cabe no tabuleiro, mais as palavras do tema, que
  // valem com qualquer recorte (ver shared/termo.js)
  const poolSize = useMemo(() => {
    if (!items) return null;
    const groups = new Set(form.groups);
    const inScope = scopeFilter(universe, form.scope);
    const termo = form.game === 'termo';
    const base = termo ? termoNames(items, universe).map(entry => entry.item) : items;
    const names = base.filter(item =>
      item.eligible
      && groups.has(item.group)
      && inScope(item)
      && (!form.picture || hasPicture(item))).length;
    return termo ? names + termoThemeWords(universe.id).length : names;
  }, [items, form.groups, form.scope, form.picture, form.game, universe]);

  function change(patch) {
    const next = applyRules(form, patch, { comImagem });
    setForm(next);
    if (isHost) socket.emit('room:settings', toSettings(next, comImagem));
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
  const impostor = form.mode === 'impostor';
  const battle = form.mode === 'battle';
  const minPlayers = impostor ? IMPOSTOR_MIN : duel || battle ? 2 : 1;
  const enoughPlayers = state.players.length >= minPlayers;
  const seatsLeft = Math.max(0, MAX_SEATS - state.players.length);

  const poolLine = poolSize === null
    ? 'Carregando...'
    : <><b>{poolSize}</b> {poolSize === 1 ? 'opção sorteável' : 'opções sorteáveis'} com essa seleção.</>;

  // a linha do recorte. Epoca vem antes dos grupos (e a regra que a mesa
  // combina primeiro); o recorte `nested` e filtro dentro dos grupos e vem
  // depois deles — "rock, so as nacionais"
  const scopeField = universe.scope && (
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
        {/* o filtro de dentro fecha a conta: a contagem mora embaixo dele */}
        {universe.scope.nested
          ? poolLine
          : universe.scope.options.filter(o => epocas.includes(o.id)).map(o => o.hint).join(' ')}
      </p>
    </div>
  );

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
            <GamePick value={form.game} disabled={!isHost} onChange={(game) => change({ game })} />
          </div>

          <div className="field">
            <div className="f-label">Estilo de jogo</div>
            <ModePick value={form.mode} game={form.game} disabled={!isHost} onChange={(mode) => change({ mode })} />
          </div>

          <div className="field">
            <div className="f-label">Tema</div>
            <UniverseSelect
              value={form.universe}
              disabled={!isHost}
              onChange={(id) => change({ universe: id, ...roomDefaults(getUniverse(id)) })}
            />
          </div>

          {universe.scope && !universe.scope.nested && scopeField}

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
            {!universe.scope?.nested && <p className="f-help">{poolLine}</p>}
          </div>

          {universe.scope?.nested && scopeField}

          <div className="field">
            <div className="f-label">Regras da partida</div>
            <RoomRules form={form} universe={universe} comImagem={comImagem} disabled={!isHost} onChange={change} />
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
              : `O estilo ${impostor ? 'impostor' : battle ? 'batalha naval' : 'duelo'} precisa de pelo menos ${minPlayers} jogadores.`}
          </p>
        )}
      </div>
    </>
  );
}
