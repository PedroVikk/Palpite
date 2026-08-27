/* Palpite - cliente. Sem build: modulo ES nativo + socket.io. */
import { UNIVERSES, DEFAULT_UNIVERSE, getUniverse } from './universes.js';

const socket = io();
const $ = (id) => document.getElementById(id);

const datasets = new Map();   // universeId -> lista de itens
let state = null;             // ultimo estado publico da sala
let myId = null;
let tickHandle = null;

// ------------------------------------------------------------- util

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 3000);
}

function showScreen(name) {
  for (const id of ['home', 'lobby', 'game']) $(`screen-${id}`).hidden = id !== name;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const arrow = (hint) => (hint === 'up' ? '<span class="arrow">▲</span>' : hint === 'down' ? '<span class="arrow">▼</span>' : '');

// o nome fica no localStorage (comodidade); a identidade do jogador fica no
// sessionStorage, para que recarregar reconecte mas duas abas sejam dois jogadores.
const savedName = () => localStorage.getItem('palpite:name') || '';
const savedPlayerId = (code) => sessionStorage.getItem(`palpite:player:${code}`);

// ------------------------------------------------------------- universos

/** Universo da sala; antes de entrar numa, o escolhido no formulario. */
function currentUniverse() {
  return getUniverse(state ? state.settings.universe : $('set-universe').value);
}

const currentGroups = () =>
  state ? state.settings.groups : [...$('set-groups').querySelectorAll('input:checked')].map(el => el.value);

async function loadDataset(universeId) {
  if (!datasets.has(universeId)) {
    datasets.set(universeId, await fetch(`/api/dataset/${universeId}`).then(r => r.json()));
  }
  return datasets.get(universeId);
}

const items = () => datasets.get(currentUniverse().id) ?? [];

/** Itens sorteaveis como segredo: dados completos e dentro dos grupos ligados. */
function secretPool() {
  const groups = new Set(currentGroups());
  return items().filter(item => item.eligible && groups.has(item.group));
}

/** Texto completo da celula (vai para o tooltip). */
function fullValue(column, value) {
  if (!Array.isArray(value)) return formatValue(column, value);
  return value.length ? value.map(v => column.labels?.[v] ?? v).join(', ') : '—';
}

/** Texto exibido: listas longas viram "A, B, C +2" para nao esticar a linha. */
function formatValue(column, value) {
  if (Array.isArray(value)) {
    if (!value.length) return '—';
    const labels = value.map(v => column.labels?.[v] ?? v);
    return labels.length > 3 ? `${labels.slice(0, 3).join(', ')} +${labels.length - 3}` : labels.join(', ');
  }
  if (value === null || value === undefined || value === '') return '—';
  if (column.labels?.[value]) return column.labels[value];
  if (column.kind === 'number') {
    const text = String(value).replace('.', ',');
    return `${column.prefix ?? ''}${text}${column.unit ? ` ${column.unit}` : ''}`;
  }
  return String(value);
}

// ------------------------------------------------------------- busca

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function search(query) {
  const q = normalize(query.trim());
  if (!q) return [];

  // ao escolher o segredo (modo duelo) so valem os sorteaveis dos grupos ligados;
  // como chute, qualquer um do universo vale
  const choosing = state?.phase === 'choosing';
  const guessed = new Set(choosing ? [] : (state?.rows ?? []).map(r => r.id));
  const groups = new Set(currentGroups());
  const source = choosing ? items().filter(i => i.eligible && groups.has(i.group)) : items();

  const starts = [], contains = [];
  for (const item of source) {
    if (guessed.has(item.id)) continue;
    // alem do nome exibido, aceita apelidos (ex.: o nome em ingles da carta)
    const names = [item.name, ...(item.aliases ?? [])].map(normalize);
    if (names.some(n => n.startsWith(q))) starts.push(item);
    else if (names.some(n => n.includes(q))) contains.push(item);
    if (starts.length >= 8) break;
  }
  return [...starts, ...contains].slice(0, 8);
}

// ------------------------------------------------------------- tela inicial

$('input-name').value = savedName();

function myName() {
  const name = $('input-name').value.trim() || 'Treinador';
  localStorage.setItem('palpite:name', name);
  return name;
}

function handleJoined(res) {
  if (res?.error) return toast(res.error);
  myId = res.playerId;
  sessionStorage.setItem(`palpite:player:${res.code}`, res.playerId);
  history.replaceState(null, '', `?sala=${res.code}`);
  render(res.state);
}

$('btn-create').onclick = () => {
  socket.emit('room:create', { name: myName(), settings: readSettings() }, handleJoined);
};

$('form-join').onsubmit = (e) => {
  e.preventDefault();
  const code = $('input-code').value.trim().toUpperCase();
  if (code.length !== 4) return toast('O código tem 4 caracteres.');
  socket.emit('room:join', { code, name: myName(), playerId: savedPlayerId(code) }, handleJoined);
};

const urlCode = new URLSearchParams(location.search).get('sala');
if (urlCode) $('input-code').value = urlCode.toUpperCase();

// ------------------------------------------------------------- lobby

const NUMBER_SETTINGS = ['rounds', 'turnSeconds', 'guessesPerPlayer'];
const DEFAULT_FORM = { mode: 'classic', rounds: 5, turnSeconds: 45, guessesPerPlayer: 6 };
const DEFAULT_ENDLESS = true;   // o classico comeca indefinido, ate alguem acertar

$('set-universe').innerHTML = Object.values(UNIVERSES)
  .map(u => `<option value="${u.id}">${u.label}</option>`).join('');
$('set-universe').value = DEFAULT_UNIVERSE;
$('set-mode').value = DEFAULT_FORM.mode;
for (const key of NUMBER_SETTINGS) $(`set-${key}`).value = DEFAULT_FORM[key];
$('set-endless').checked = DEFAULT_ENDLESS;

/** Desenha as caixinhas de grupo (gerações, raças, ...) do universo atual. */
function renderGroupChips(universe, enabled, disabled) {
  $('groups-label').textContent = universe.groupLabel;
  $('set-groups').innerHTML = universe.groups.map(g => `
    <label class="chip">
      <input type="checkbox" value="${g.id}" ${enabled.includes(g.id) ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      <span>${g.label}</span>
    </label>`).join('');
  for (const box of $('set-groups').querySelectorAll('input')) box.onchange = onGroupToggle;
}

function onGroupToggle() {
  if (!currentGroups().length) {
    toast(`Deixe pelo menos ${currentUniverse().groupLabel.toLowerCase()} marcado.`);
    return renderLobby();
  }
  pushSettings();
}

function readSettings() {
  const numbers = Object.fromEntries(NUMBER_SETTINGS.map(key => [key, Number($(`set-${key}`).value)]));
  return {
    mode: $('set-mode').value,
    universe: $('set-universe').value,
    groups: [...$('set-groups').querySelectorAll('input:checked')].map(el => el.value),
    ...numbers,
    // rodadas 0 avisa o servidor que a partida e sem fim (e sem teto de chutes)
    rounds: $('set-endless').checked ? 0 : numbers.rounds,
  };
}

/**
 * Sem fim: rodadas e chutes por jogador deixam de valer, mas continuam
 * editaveis — mexer neles e justamente o que desliga o indefinido.
 * No duelo o indefinido nao existe: quem esconde o segredo precisa que os
 * chutes acabem para pontuar.
 */
function applyEndlessToForm(endless, isHost) {
  const duel = $('set-mode').value === 'duel';
  const on = endless && !duel;

  $('set-endless').checked = on;
  $('set-endless').disabled = !isHost || duel;
  $('set-endless').closest('.chip').classList.toggle('off', !isHost || duel);

  for (const key of ['rounds', 'guessesPerPlayer']) {
    $(`set-${key}`).disabled = !isHost;
    $(`set-${key}`).closest('.field').classList.toggle('ignored', on);
  }
}

/** Digitar em rodadas/chutes significa que o jogador quer limites. */
function turnOffEndless() {
  if (!$('set-endless').checked) return;
  $('set-endless').checked = false;
  applyEndlessToForm(false, true);
}

function pushSettings() {
  if (!state || state.hostId !== myId) return;
  socket.emit('room:settings', readSettings());
}

$('set-mode').onchange = () => { applyEndlessToForm($('set-endless').checked, true); pushSettings(); };
$('set-endless').onchange = () => { applyEndlessToForm($('set-endless').checked, true); pushSettings(); };
for (const key of NUMBER_SETTINGS) $(`set-${key}`).onchange = pushSettings;
for (const key of ['rounds', 'guessesPerPlayer']) {
  $(`set-${key}`).oninput = () => { turnOffEndless(); pushSettings(); };
}

$('set-universe').onchange = async () => {
  const universe = getUniverse($('set-universe').value);
  renderGroupChips(universe, universe.defaultGroups, false);
  await loadDataset(universe.id);
  if (state) pushSettings(); else renderPoolSize();
};

$('btn-start').onclick = () => socket.emit('game:start');
$('btn-next').onclick = () => socket.emit('game:next');
$('btn-restart').onclick = () => socket.emit('game:start');
$('btn-end').onclick = () => socket.emit('game:end');

function leave() {
  socket.emit('room:leave');
  state = null;
  myId = null;
  history.replaceState(null, '', location.pathname);
  showScreen('home');
}
$('btn-leave').onclick = leave;
$('btn-leave-lobby').onclick = leave;

$('btn-copy').onclick = async () => {
  const link = `${location.origin}?sala=${state.code}`;
  try {
    await navigator.clipboard.writeText(link);
    toast('Link copiado! Manda no grupo.');
  } catch {
    prompt('Copie o link:', link);
  }
};

function renderPoolSize() {
  const universe = currentUniverse();
  const total = secretPool().length;
  $('pool-size').textContent = datasets.has(universe.id)
    ? `${total} ${total === 1 ? 'opção sorteável' : 'opções sorteáveis'} com essa seleção.`
    : 'Carregando...';
}

function renderLobby() {
  const isHost = state.hostId === myId;
  const universe = getUniverse(state.settings.universe);

  $('lobby-code').textContent = state.code;
  $('lobby-count').textContent = `(${state.players.length})`;
  $('lobby-players').innerHTML = state.players.map(p => `
    <li>
      <span class="dot ${p.connected ? '' : 'off'}"></span>
      <strong>${escapeHtml(p.name)}</strong>
      ${p.id === myId ? '<span class="muted">(você)</span>' : ''}
      <span class="tag">${p.id === state.hostId ? 'Host' : ''}</span>
    </li>`).join('');

  $('set-mode').value = state.settings.mode;
  $('set-universe').value = state.settings.universe;
  $('set-mode').disabled = !isHost;
  $('set-universe').disabled = !isHost;
  const endless = state.settings.rounds === 0;
  for (const key of NUMBER_SETTINGS) {
    const el = $(`set-${key}`);
    // com a partida sem fim o servidor zera esses dois; nao sobrescreve o campo
    if (document.activeElement !== el && !(endless && key !== 'turnSeconds')) {
      el.value = state.settings[key];
    }
    el.disabled = !isHost;

  }
  applyEndlessToForm(endless, isHost);
  renderGroupChips(universe, state.settings.groups, !isHost);

  $('settings-lock').textContent = isHost ? '' : '— só o host edita';
  loadDataset(universe.id).then(() => { if (state?.phase === 'lobby') renderPoolSize(); });
  renderPoolSize();

  const enoughPlayers = state.settings.mode !== 'duel' || state.players.length >= 2;
  $('btn-start').hidden = !isHost;
  $('btn-start').disabled = !enoughPlayers;
  $('lobby-hint').textContent = !isHost
    ? 'Esperando o host começar...'
    : enoughPlayers ? '' : 'O modo duelo precisa de pelo menos 2 jogadores.';
}

// ------------------------------------------------------------- jogo

const isMyTurn = () => state?.phase === 'playing' && state.turnPlayerId === myId;
const isMyChoice = () => state?.phase === 'choosing' && state.chooserId === myId;
const playerName = (id) => state?.players.find(p => p.id === id)?.name ?? 'alguém';

function renderGame() {
  const universe = getUniverse(state.settings.universe);
  const endless = state.settings.rounds === 0;
  $('game-round').textContent = endless ? `Rodada ${state.round}` : `Rodada ${state.round}/${state.settings.rounds}`;
  $('game-mode').textContent = `${universe.label} · ${state.settings.mode === 'duel' ? 'Duelo' : 'Clássico'}`;
  $('game-code').textContent = state.code;

  $('scoreboard').innerHTML = state.players.map(p => {
    const cls = [
      p.id === state.turnPlayerId ? 'turn' : '',
      p.id === state.chooserId ? 'chooser' : '',
      p.connected ? '' : 'gone',
    ].join(' ');
    return `<li class="${cls}">
      <span>${escapeHtml(p.name)}${p.id === myId ? ' (você)' : ''}</span>
      <span class="score">${p.score}</span>
      <span class="left">${state.phase === 'playing' ? (p.guessesLeft === null ? '∞ chutes' : `${p.guessesLeft} chutes`) : ''}</span>
    </li>`;
  }).join('');

  renderBanner(universe);
  renderGuessArea(universe);
  renderHead(universe);
  renderRows(universe);
  renderReveal(universe);

  const isHost = state.hostId === myId;
  $('btn-next').hidden = !(isHost && state.phase === 'roundEnd');
  $('btn-restart').hidden = !(isHost && state.phase === 'gameOver');
  // sem fim a partida nao acaba sozinha: alguem precisa encerrar
  $('btn-end').hidden = !(isHost && endless && state.phase !== 'gameOver');
}

function renderBanner(universe) {
  const banner = $('banner');
  let text = '', cls = '';

  if (state.phase === 'choosing') {
    text = isMyChoice()
      ? `🤫 Escolha ${universe.secretLabel} para os outros adivinharem.`
      : `Aguardando ${playerName(state.chooserId)} escolher o segredo...`;
    cls = isMyChoice() ? 'you' : 'wait';
  } else if (state.phase === 'playing') {
    text = isMyTurn() ? '🎯 Sua vez! Mande o chute.' : `Vez de ${playerName(state.turnPlayerId)}...`;
    cls = isMyTurn() ? 'you' : 'wait';
    if (state.chooserId === myId) text = 'Você escolheu o segredo — só assista. 😈';
  } else if (state.phase === 'roundEnd' || state.phase === 'gameOver') {
    text = state.message ?? '';
    cls = state.winnerId === myId ? 'you' : '';
  }
  if (state.message && state.phase === 'playing') text += `  •  ${state.message}`;

  banner.className = `banner ${cls}`;
  banner.textContent = text;
}

function renderGuessArea(universe) {
  const active = isMyTurn() || isMyChoice();
  const input = $('input-guess');
  $('guess-area').style.opacity = active ? '1' : '.5';
  input.disabled = !active;
  $('btn-guess').disabled = !active;
  $('btn-guess').textContent = isMyChoice() ? 'Escolher' : 'Chutar';
  input.placeholder = isMyChoice()
    ? `Escolha ${universe.secretLabel}...`
    : active ? `Digite o nome...` : 'Aguarde sua vez...';
  if (!active) closeSuggestions();
}

function renderHead(universe) {
  $('hint-head').innerHTML = `<th>Chute</th>${universe.columns.map(c => `<th>${c.label}</th>`).join('')}`;
}

function renderRows(universe) {
  const rows = state.rows ?? [];
  $('empty-hint').hidden = rows.length > 0;
  // chute mais recente no topo
  $('hint-rows').innerHTML = [...rows].reverse().map((r, i) => `
    <tr class="${i === 0 ? 'newest' : ''} ${r.correct ? 'correct' : ''}">
      <td class="guess-cell">
        <span class="who">${escapeHtml(r.playerName)}</span>
        <span class="mon">${r.sprite ? `<img src="${r.sprite}" alt="" loading="lazy">` : ''}${escapeHtml(r.name)}</span>
      </td>
      ${universe.columns.map(column => {
        const cell = r.cells[column.key] ?? { value: null, status: 'unknown' };
        const title = cell.status === 'unknown'
          ? 'sem dado para comparar'
          : fullValue(column, cell.value);
        return `<td class="${cell.status}" title="${escapeHtml(title)}">${escapeHtml(formatValue(column, cell.value))}${arrow(cell.hint)}</td>`;
      }).join('')}
    </tr>`).join('');
}

function renderReveal(universe) {
  const secret = state.secret;
  $('reveal').hidden = !secret;
  if (!secret) return;
  const art = secret.artwork ?? secret.sprite ?? null;
  $('reveal-img').hidden = !art;              // ha universos sem imagem (LOTR)
  if (art) $('reveal-img').src = art;
  $('reveal-name').textContent = secret.name;
  $('reveal-meta').textContent = universe.columns
    .map(column => `${column.label}: ${fullValue(column, secret[column.key])}`)
    .join(' • ');
}

// ------------------------------------------------------------- cronometro

function startTicking() {
  clearInterval(tickHandle);
  tickHandle = setInterval(() => {
    const el = $('game-timer');
    if (!state?.deadline) { el.textContent = ''; el.className = 'timer'; return; }
    const left = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
    el.textContent = `${left}s`;
    el.className = `timer ${left <= 10 && state.phase !== 'roundEnd' ? 'urgent' : ''}`;
  }, 250);
}

// ------------------------------------------------------------- autocomplete

let suggestions = [];
let activeIndex = -1;

function closeSuggestions() {
  suggestions = [];
  activeIndex = -1;
  $('suggestions').hidden = true;
}

function renderSuggestions() {
  const ul = $('suggestions');
  if (!suggestions.length) return closeSuggestions();
  ul.innerHTML = suggestions.map((item, i) => `
    <li data-i="${i}" class="${i === activeIndex ? 'active' : ''}">
      ${item.sprite ? `<img src="${item.sprite}" alt="" loading="lazy">` : ''}
      <span>${escapeHtml(item.name)}</span>
    </li>`).join('');
  ul.hidden = false;
}

$('input-guess').addEventListener('input', (e) => {
  suggestions = search(e.target.value);
  activeIndex = suggestions.length ? 0 : -1;
  renderSuggestions();
});

$('input-guess').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!suggestions.length) return;
    activeIndex = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
    renderSuggestions();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    submitGuess();
  } else if (e.key === 'Escape') {
    closeSuggestions();
  }
});

$('suggestions').addEventListener('mousedown', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  e.preventDefault();
  activeIndex = Number(li.dataset.i);
  submitGuess();
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.autocomplete')) closeSuggestions();
});

$('btn-guess').onclick = submitGuess;

function submitGuess() {
  const input = $('input-guess');
  const chosen = suggestions[activeIndex] ?? search(input.value)[0];
  if (!chosen) return toast('Escolha um nome da lista.');

  if (isMyChoice()) socket.emit('game:choose', { pokemonId: chosen.id });
  else if (isMyTurn()) socket.emit('game:guess', { pokemonId: chosen.id });
  else return toast('Não é a sua vez.');

  input.value = '';
  closeSuggestions();
}

// ------------------------------------------------------------- render raiz

function render(next) {
  const previousPhase = state?.phase;
  const previousUniverse = state?.settings.universe;
  state = next;
  if (!state) return showScreen('home');

  // o dataset do universo da sala precisa estar em memoria para busca e contagem
  if (state.settings.universe !== previousUniverse && !datasets.has(state.settings.universe)) {
    loadDataset(state.settings.universe).then(() => { if (state) render(state); });
  }

  if (state.phase === 'lobby') {
    showScreen('lobby');
    renderLobby();
  } else {
    showScreen('game');
    renderGame();
    if (previousPhase !== state.phase && (isMyTurn() || isMyChoice())) $('input-guess').focus();
  }
}

socket.on('room:state', render);
socket.on('room:error', toast);
socket.on('connect', () => {
  // reconexao automatica: volta para a sala que estava aberta
  if (state?.code) {
    socket.emit('room:join', { code: state.code, name: myName(), playerId: savedPlayerId(state.code) }, handleJoined);
  }
});
socket.on('disconnect', () => toast('Conexão perdida, reconectando...'));

renderGroupChips(getUniverse(DEFAULT_UNIVERSE), getUniverse(DEFAULT_UNIVERSE).defaultGroups, false);
startTicking();
await loadDataset(DEFAULT_UNIVERSE);
renderPoolSize();
