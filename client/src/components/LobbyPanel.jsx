import { useEffect, useMemo, useRef, useState } from 'react';
import { getUniverse, roomDefaults, scopeFilter, sanitizeScope } from '@shared/universes.js';
import { socket } from '../socket.js';
import { useDataset } from '../hooks/useDataset.js';
import { canPlayPicture, hasPicture } from '../lib/picture.js';
import { termoNames, termoThemeWords } from '@shared/termo.js';
import Avatar from './Avatar.jsx';
import UniverseSelect from './UniverseSelect.jsx';
import UniverseIcon from './UniverseIcon.jsx';
import Stepper from './Stepper.jsx';
import ModePick, { GamePick, styleFits } from './ModePick.jsx';
import { CardsSwitch, DraftStepper } from './CardsRules.jsx';
import {
  CalendarIcon, CardIcon, CheckIcon, ClockIcon, CopyIcon, ExitIcon, ImageIcon,
  ShareIcon, TargetIcon, UsersIcon,
} from './Icon.jsx';

/** O impostor precisa de gente para desconfiar (IMPOSTOR_MIN_PLAYERS no servidor). */
const IMPOSTOR_MIN = 3;

const MAX_SEATS = 8;

/**
 * O formulario guarda `untilRight` a parte porque no servidor ele e so o
 * `guessesPerPlayer === 0`. Guardar o numero editavel aqui evita que o campo
 * "chutes por jogador" pisque enquanto o "ate acertar" esta ligado.
 */
const fromSettings = (s) => ({
  game: s.game ?? 'segredo',
  mode: s.mode,
  universe: s.universe,
  groups: s.groups,
  scope: s.scope ?? null,
  rounds: s.rounds ?? 5,   // 0 e o infinito do Termo
  turnSeconds: s.turnSeconds,
  guessesPerPlayer: s.guessesPerPlayer || 6,
  untilRight: s.guessesPerPlayer === 0,
  picture: Boolean(s.picture),
  card: Boolean(s.card),
  choices: s.choices || 3,
  cards: Boolean(s.cards),
  draftEvery: s.draftEvery || 2,
  speedSame: s.speedSame ?? true,
});

const toSettings = (f) => ({
  game: f.game,
  mode: f.mode,
  universe: f.universe,
  groups: f.groups,
  scope: f.scope,
  rounds: f.rounds,
  turnSeconds: f.turnSeconds,
  guessesPerPlayer: f.untilRight ? 0 : f.guessesPerPlayer,
  picture: f.picture,
  card: f.card,
  choices: f.choices,
  cards: f.cards,
  draftEvery: f.draftEvery,
  speedSame: f.speedSame,
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
    const next = { ...form, ...patch };
    // no duelo o "ate acertar" nao existe: quem esconde o segredo so pontua
    // quando os chutes dos outros acabam
    if (next.mode === 'duel') next.untilRight = false;
    // no impostor o saldo de chutes e o numero de voltas, e a imagem entregaria
    // pixels do segredo a quem nao sabe. Entrar no modo volta para 2 voltas
    if (next.mode === 'impostor') {
      if (form.mode !== 'impostor') next.guessesPerPlayer = 2;
      next.untilRight = false;
      next.picture = false;
    }
    // "Qual deles?" e rapido: entrar no modo ja poe 10 perguntas de 15 s
    if (next.mode === 'quiz' && form.mode !== 'quiz') {
      next.rounds = 10;
      next.turnSeconds = 15;
      next.picture = false;
    }
    // Termo: sem figura e sem cartas, e so nos estilos que ele tem. Entrar
    // nele poe 6 linhas; o relogio vira o da rodada inteira na corrida (caca e
    // duelo) e volta a ser o do turno na batalha
    if (next.game === 'termo') {
      if (!styleFits('termo', next.mode)) next.mode = 'hunt';
      if (form.game !== 'termo') {
        next.guessesPerPlayer = 6;
        next.untilRight = false;
      }
      const race = next.mode !== 'battle';
      const wasRace = form.game === 'termo' && form.mode !== 'battle';
      if (race !== wasRace) next.turnSeconds = race ? 120 : 45;
      next.picture = false;
      next.cards = false;
    } else if (form.game === 'termo') {
      // o infinito e so do Termo: de volta ao Segredo, tudo volta a ter fim
      next.turnSeconds = 45;
      if (next.rounds === 0) next.rounds = 5;
    }
    // velocidade: 3 segredos na fila e 3 minutos de corrida; sem figura nem cartas
    if (next.mode === 'speed') {
      if (form.mode !== 'speed') {
        next.rounds = 3;
        next.turnSeconds = 180;
      }
      next.picture = false;
      next.cards = false;
    } else if (form.mode === 'speed') {
      next.rounds = 5;
      next.turnSeconds = next.game === 'termo' && next.mode !== 'battle' ? 120 : 45;
    }
    // universo sem figura espelhada nao joga de imagem; trocar para um deles
    // com a chave ligada desliga ela, em vez de sortear um segredo invisivel
    if (!comImagem) next.picture = false;
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
  const impostor = form.mode === 'impostor';
  const battle = form.mode === 'battle';
  const quiz = form.mode === 'quiz';
  const termo = form.game === 'termo';
  const speed = form.mode === 'speed';
  const termoRace = termo && !battle;
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

            {/* a chave da imagem vale para as rodadas que ainda vao comecar:
                como toda regra da sala, ela so e editavel aqui na espera */}
            {impostor && (
              <button
                type="button"
                className={`switch-row ${form.card ? 'on' : ''}`}
                disabled={!isHost}
                style={{ marginBottom: 10 }}
                onClick={() => change({ card: !form.card })}
              >
                <span className="ico"><CardIcon width={18} height={18} /></span>
                <span className="txt">
                  <b>Mostrar os dados de cada chute</b>
                  <small>
                    Cada linha mostra as características de quem foi chutado, sem dizer quais
                    batem com o segredo. Desligado, aparece só o número de acertos.
                  </small>
                </span>
                <span className="switch"><i /></span>
              </button>
            )}

            {/* velocidade: a mesma fila para todos, ou uma para cada */}
            {speed && (
              <button
                type="button"
                className={`switch-row ${form.speedSame ? 'on' : ''}`}
                disabled={!isHost}
                style={{ marginBottom: 10 }}
                onClick={() => change({ speedSame: !form.speedSame })}
              >
                <span className="ico"><TargetIcon width={18} height={18} /></span>
                <span className="txt">
                  <b>{termo ? 'Palavras iguais para todos' : 'Segredos iguais para todos'}</b>
                  <small>
                    {form.speedSame
                      ? 'Todo mundo corre atrás da mesma fila, na mesma ordem.'
                      : 'Cada um recebe a própria fila, sorteada só para ele.'}
                  </small>
                </span>
                <span className="switch"><i /></span>
              </button>
            )}

            {/* as cartas atravessam os modos, como a imagem — menos o Termo e a velocidade */}
            {!termo && !speed && <CardsSwitch
              on={form.cards}
              mode={form.mode}
              disabled={!isHost}
              style={{ marginBottom: quiz ? 0 : 10 }}
              onToggle={() => change({ cards: !form.cards })}
            />}

            {/* no "Qual deles?" nao ha segredo nem chute: imagem e "ate acertar" nao se aplicam */}
            {!quiz && !termo && !speed && <>
            <button
              type="button"
              className={`switch-row ${form.picture && comImagem && !impostor && !battle ? 'on' : ''}`}
              disabled={!isHost || !comImagem || impostor || battle}
              style={{ marginBottom: 10 }}
              onClick={() => change({ picture: !form.picture })}
            >
              <span className="ico"><ImageIcon width={18} height={18} /></span>
              <span className="txt">
                <b>Jogar pela imagem</b>
                <small>
                  {impostor
                    ? 'No impostor, cada chute clarearia a figura para quem não sabe o segredo.'
                    : battle
                    ? 'Na batalha naval cada tabuleiro teria a própria figura: por ora ela é só pela tabela.'
                    : comImagem
                      ? 'Sem tabela de dicas: a figura do segredo clareia a cada chute errado da mesa.'
                      : `${universe.label} não tem figuras para jogar assim.`}
                </small>
              </span>
              <span className="switch"><i /></span>
            </button>

            <button
              type="button"
              className={`switch-row ${form.untilRight || battle ? 'on' : ''}`}
              disabled={!isHost || duel || impostor || battle}
              onClick={() => change({ untilRight: !form.untilRight })}
            >
              <span className="ico"><TargetIcon width={18} height={18} /></span>
              <span className="txt">
                <b>Até acertar</b>
                <small>
                  {impostor
                    ? 'No impostor ninguém da mesa pode acertar: as voltas acabam na votação.'
                    : battle
                    ? 'A batalha só acaba quando sobra um segredo de pé, sem teto de chutes.'
                    : duel
                      ? 'O duelo precisa de teto de chutes para quem esconde pontuar.'
                      : 'A rodada só fecha quando alguém acerta, sem teto de chutes.'}
                </small>
              </span>
              <span className="switch"><i /></span>
            </button>
            </>}

            <div className="steppers" style={{ marginTop: 12 }}>
              <Stepper
                label={quiz ? 'Perguntas' : speed ? (termo ? 'Palavras' : 'Segredos') : 'Rodadas'}
                icon={<CalendarIcon width={14} height={14} />}
                value={form.rounds} min={1} max={20}
                off={battle} offValue="1"
                hint={battle ? 'Uma batalha por partida' : speed ? 'Na fila de cada um' : form.rounds === 0 ? 'Até o host encerrar' : 'Total da partida'}
                disabled={!isHost}
                infinite={termo && !speed && form.rounds === 0}
                onInfinite={termo && !speed ? () => change({ rounds: form.rounds === 0 ? 5 : 0 }) : null}
                onChange={(v) => change({ rounds: v })}
              />
              <Stepper
                label={quiz ? 'Tempo por pergunta' : speed ? 'Tempo da corrida' : termoRace ? 'Tempo da rodada' : 'Tempo por turno'}
                icon={<ClockIcon width={14} height={14} />}
                value={form.turnSeconds} min={5} max={180} step={5} suffix="s"
                hint={(termo || speed) && form.turnSeconds === 0 ? 'Sem relógio'
                  : quiz ? 'Para todos responderem' : speed ? 'Acabou, vence quem resolveu mais' : termoRace ? 'Para fechar o tabuleiro' : 'Para mandar o chute'}
                infinite={(termo || speed) && form.turnSeconds === 0}
                onInfinite={termo || speed
                  ? () => change({ turnSeconds: form.turnSeconds === 0 ? (speed ? 180 : termoRace ? 120 : 45) : 0 })
                  : null}
                disabled={!isHost}
                onChange={(v) => change({ turnSeconds: v })}
              />
              {quiz ? (
                <Stepper
                  label="Opções"
                  icon={<TargetIcon width={14} height={14} />}
                  value={form.choices} min={2} max={5}
                  hint="Respostas por pergunta"
                  disabled={!isHost}
                  onChange={(v) => change({ choices: v })}
                />
              ) : termoRace ? (
                <Stepper
                  label="Tentativas"
                  icon={<TargetIcon width={14} height={14} />}
                  value={form.guessesPerPlayer} min={4} max={10}
                  hint={form.untilRight ? 'Linhas sem fim' : 'Linhas do tabuleiro'}
                  disabled={!isHost}
                  infinite={form.untilRight}
                  onInfinite={() => change({ untilRight: !form.untilRight })}
                  onChange={(v) => change({ guessesPerPlayer: v })}
                />
              ) : <Stepper
                label={impostor ? 'Voltas' : 'Chutes por jogador'}
                icon={<TargetIcon width={14} height={14} />}
                value={form.guessesPerPlayer} min={1} max={impostor ? 5 : 20}
                off={form.untilRight || battle || speed}
                hint={speed
                  ? 'Errar só custa tempo'
                  : impostor
                  ? 'Um chute de cada por volta'
                  : form.untilRight ? '“Até acertar” ignora o teto' : 'Máximo por rodada'}
                disabled={!isHost}
                /* mexer aqui desliga o "ate acertar" */
                onChange={(v) => change({ guessesPerPlayer: v, untilRight: false })}
              />}
              {form.cards && !termo && (
                <DraftStepper
                  value={form.draftEvery}
                  mode={form.mode}
                  disabled={!isHost}
                  onChange={(v) => change({ draftEvery: v })}
                />
              )}
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
              : `O estilo ${impostor ? 'impostor' : battle ? 'batalha naval' : 'duelo'} precisa de pelo menos ${minPlayers} jogadores.`}
          </p>
        )}
      </div>
    </>
  );
}
