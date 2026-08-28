/**
 * Teste end-to-end: sobe o servidor, conecta jogadores falsos e joga
 * uma partida em cada modo, verificando turnos, dicas, pontuacao e timeout.
 *   node scripts/smoke-test.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { UNIVERSES } from '../shared/universes.js';
import { io } from 'socket.io-client';

const PORT = 3999;
const URL = `http://localhost:${PORT}`;
let failures = 0;

function check(label, condition) {
  console.log(`${condition ? '  OK  ' : ' FALHA'} ${label}`);
  if (!condition) failures++;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function connect(name) {
  return new Promise((resolve) => {
    const socket = io(URL, { transports: ['websocket'] });
    const player = { name, socket, state: null, errors: [] };
    socket.on('room:state', (s) => { player.state = s; });
    socket.on('room:error', (e) => player.errors.push(e));
    socket.on('connect', () => resolve(player));
  });
}

/** Espera ate `predicate(player.state)` virar verdadeiro. */
async function until(player, predicate, label, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (player.state && predicate(player.state)) return player.state;
    await sleep(40);
  }
  throw new Error(`timeout esperando: ${label}`);
}

const server = spawn(process.execPath, ['src/server.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => {
  server.stdout.on('data', d => { if (String(d).includes('rodando')) resolve(); });
  setTimeout(() => reject(new Error('servidor nao subiu')), 15000);
});

try {
  // ------------------------------------------------------- modo caca ao segredo
  console.log('\n== Modo caca ao segredo, 3 jogadores ==');
  const [ash, misty, brock] = await Promise.all([connect('Ash'), connect('Misty'), connect('Brock')]);

  const created = await new Promise(res => ash.socket.emit('room:create', {
    name: 'Ash',
    settings: { mode: 'hunt', universe: 'pokemon', groups: ['1'], rounds: 2, turnSeconds: 5, guessesPerPlayer: 2 },
  }, res));
  const code = created.code;
  check(`sala criada (${code})`, /^[A-Z2-9]{4}$/.test(code));

  const naCadeira = new Map([[created.playerId, ash]]);
  for (const p of [misty, brock]) {
    const joined = await new Promise(res => p.socket.emit('room:join', { code, name: p.name }, res));
    naCadeira.set(joined.playerId, p);
  }
  await until(ash, s => s.players.length === 3, '3 jogadores no lobby');
  check('todos no lobby', ash.state.players.map(p => p.name).join() === 'Ash,Misty,Brock');
  check('configuracoes aplicadas', ash.state.settings.rounds === 2 && ash.state.settings.turnSeconds === 5);

  ash.socket.emit('game:start');
  await until(ash, s => s.phase === 'playing', 'partida comecou');

  // quem abre e sorteado; so o rodizio depois da largada segue a ordem da sala
  const ordem = ash.state.players.map(p => p.id);
  const seguinte = (id) => ordem[(ordem.indexOf(id) + 1) % ordem.length];
  const daVez = () => naCadeira.get(ash.state.turnPlayerId);
  check('a rodada abriu com alguem da sala', naCadeira.has(ash.state.turnPlayerId));
  check('segredo escondido durante a partida', ash.state.secret === null);
  check('chutes distribuidos', ash.state.players.every(p => p.guessesLeft === 2));

  // chutes de Gen 2 (152+): aceitos como chute mas nunca sao o segredo (a sala
  // so ligou a Gen 1), entao a rodada fecha por esgotamento sem vencedor

  // fora da vez: deve ser rejeitado
  const foraDaVez = [ash, misty, brock].find(p => p !== daVez());
  foraDaVez.socket.emit('game:guess', { pokemonId: 152 });
  await sleep(150);
  check('chute fora da vez recusado', foraDaVez.errors.some(e => e.includes('sua vez')));

  const abriu = daVez();
  const depoisDoPrimeiro = seguinte(ash.state.turnPlayerId);
  abriu.socket.emit('game:guess', { pokemonId: 152 }); // Chikorita
  await until(ash, s => s.rows.length === 1, 'primeira dica publicada');
  const row = ash.state.rows[0];
  check('dica tem as 7 colunas', Object.keys(row.cells).length === 7);
  check('dica mostra quem chutou', row.playerName === abriu.name);
  check('turno passou para o proximo da ordem', ash.state.turnPlayerId === depoisDoPrimeiro);

  // repetir o mesmo Pokemon deve ser bloqueado
  const segundo = daVez();
  segundo.errors.length = 0;
  segundo.socket.emit('game:guess', { pokemonId: 152 });
  await sleep(150);
  check('chute repetido recusado', segundo.errors.some(e => e.includes('já foi chutado')));

  // Pokemon fora dos grupos da sala ainda e aceito como chute (so o segredo e limitado)
  const depoisDoSegundo = seguinte(ash.state.turnPlayerId);
  segundo.socket.emit('game:guess', { pokemonId: 153 });
  await until(ash, s => s.rows.length === 2, 'segunda dica');
  check('turno passou para o terceiro da ordem', ash.state.turnPlayerId === depoisDoSegundo);

  // o terceiro nao chuta: o timer (5s) deve consumir um chute dele e passar a vez
  const atrasado = ash.state.turnPlayerId;
  await until(ash, s => s.turnPlayerId !== atrasado, 'timeout de turno', 9000);
  check('timeout nao gerou dica', ash.state.rows.length === 2);
  check('timeout consumiu um chute do atrasado',
    ash.state.players.find(p => p.id === atrasado).guessesLeft === 1);
  check('a vez deu a volta e voltou para quem abriu', ash.state.turnPlayerId === seguinte(atrasado));

  // gasta os chutes restantes dos dois que ja chutaram; o terceiro deixa estourar de novo
  daVez().socket.emit('game:guess', { pokemonId: 154 });
  await until(ash, s => s.rows.length === 3, 'terceira dica');
  daVez().socket.emit('game:guess', { pokemonId: 155 });
  await until(ash, s => s.rows.length === 4, 'quarta dica');

  const ended = await until(ash, s => s.phase === 'roundEnd', 'fim da rodada 1', 12000);
  check('rodada fechou quando os chutes acabaram', ended.rows.length === 4);
  check('segredo revelado no fim da rodada', ended.secret !== null);
  check('segredo respeitou os grupos da sala', ended.secret.generation === 1 && ended.secret.group === '1');
  check('ninguem pontuou sem acerto', ended.players.every(p => p.score === 0));

  ash.socket.emit('game:next');
  const round2 = await until(ash, s => s.round === 2 && s.phase === 'playing', 'rodada 2', 8000);
  check('rodada 2 comecou com chutes renovados', round2.players.every(p => p.guessesLeft === 2));
  check('tabela zerada na rodada 2', round2.rows.length === 0);

  // ----------------------------------------------------------- acerto e pontuacao
  console.log('\n== Acerto direto e pontuacao ==');
  // 8 jogadores x 20 chutes cobrem as 151 opcoes da Gen 1, entao o acerto e garantido
  const squad = await Promise.all(Array.from({ length: 8 }, (_, i) => connect(`P${i + 1}`)));
  const red = squad[0];
  const room2 = await new Promise(res => red.socket.emit('room:create', {
    name: 'P1',
    settings: { mode: 'hunt', universe: 'pokemon', groups: ['1'], rounds: 1, turnSeconds: 120, guessesPerPlayer: 20 },
  }, res));
  const bySocketPlayer = new Map();
  for (const [i, p] of squad.entries()) {
    const joined = i === 0
      ? { playerId: room2.playerId }
      : await new Promise(res => p.socket.emit('room:join', { code: room2.code, name: p.name }, res));
    bySocketPlayer.set(joined.playerId, p);
  }
  await until(red, s => s.players.length === 8, '8 jogadores na sala');
  red.socket.emit('game:start');
  await until(red, s => s.phase === 'playing', 'partida 2 comecou');

  // varre a Gen 1 respeitando o rodizio de turnos ate alguem acertar
  let guessed = 0;
  while (red.state.phase === 'playing' && guessed < 151) {
    const who = bySocketPlayer.get(red.state.turnPlayerId);
    who.socket.emit('game:guess', { pokemonId: ++guessed });
    await until(red, s => s.rows.length === guessed || s.phase !== 'playing', `chute ${guessed}`);
  }
  check('alguem acertou e a rodada fechou', red.state.phase === 'gameOver');
  check('segredo revelado no fim', red.state.secret !== null);
  check('acerto marcado na tabela', red.state.rows.some(r => r.correct));
  check('vencedor pontuou', red.state.players.some(p => p.score > 0));
  check('vencedor e quem chutou certo', red.state.winnerId === red.state.rows.at(-1).playerId);
  const correctRow = red.state.rows.find(r => r.correct);
  check('linha correta e 100% verde', Object.values(correctRow.cells).every(c => c.status === 'hit'));

  // ----------------------------------------------------------- modo duelo
  console.log('\n== Modo duelo ==');
  const [gary, may] = await Promise.all([connect('Gary'), connect('May')]);
  const room3 = await new Promise(res => gary.socket.emit('room:create', {
    name: 'Gary',
    settings: { mode: 'duel', universe: 'pokemon', groups: ['1', '2'], rounds: 1, turnSeconds: 30, guessesPerPlayer: 3 },
  }, res));
  await new Promise(res => may.socket.emit('room:join', { code: room3.code, name: 'May' }, res));
  gary.socket.emit('game:start');
  await until(gary, s => s.phase === 'choosing', 'fase de escolha');
  const duelBySocket = new Map([[room3.playerId, gary], [may.state.players[1].id, may]]);
  const hider = duelBySocket.get(gary.state.chooserId);
  const seeker = hider === gary ? may : gary;
  check('quem esconde foi sorteado entre os jogadores', duelBySocket.has(gary.state.chooserId));
  check('escolhedor nao chuta', gary.state.players.find(p => p.id === gary.state.chooserId).guessesLeft === 0);

  hider.socket.emit('game:choose', { pokemonId: 400 }); // fora da Gen 1-2
  await sleep(150);
  check('escolha fora dos grupos recusada', hider.errors.some(e => e.includes('fora das opções')));

  hider.socket.emit('game:choose', { pokemonId: 143 }); // Snorlax
  await until(seeker, s => s.phase === 'playing', 'duelo comecou');
  check('escolhedor nao entra no rodizio', seeker.state.chooserId !== seeker.state.turnPlayerId);
  check('turno vai para o adversario', seeker.state.turnPlayerId === seeker.state.players.find(p => p.id !== seeker.state.chooserId).id);

  seeker.socket.emit('game:guess', { pokemonId: 143 });
  await until(seeker, s => s.phase !== 'playing', 'adversario acertou');
  check('segredo era o escolhido', seeker.state.secret?.id === 143);
  check('adversario pontuou', seeker.state.players.find(p => p.id !== seeker.state.chooserId).score > 0);
  check('escolhedor nao pontuou', seeker.state.players.find(p => p.id === seeker.state.chooserId).score === 0);
  const seekerId = seeker.state.players.find(p => p.id !== seeker.state.chooserId).id;

  // ------------------------------------------------ fila de quem esconde
  // Tres jogadores, seis rodadas: cada um esconde exatamente duas vezes e
  // ninguem repete seguido — inclusive na virada do ciclo, que e onde um
  // rodizio ingenuo repetiria. No sorteio puro isto falhava sozinho.
  console.log('\n== Fila do duelo ==');
  const fila = await Promise.all([connect('Oak'), connect('Bill'), connect('Lance')]);
  const salaFila = await new Promise(res => fila[0].socket.emit('room:create', {
    name: 'Oak',
    settings: { mode: 'duel', universe: 'pokemon', groups: ['1'], rounds: 6, turnSeconds: 30, guessesPerPlayer: 3 },
  }, res));
  const idsFila = [salaFila.playerId];
  for (const p of fila.slice(1)) {
    const entrada = await new Promise(res => p.socket.emit('room:join', { code: salaFila.code, name: p.name }, res));
    idsFila.push(entrada.playerId);
  }
  const filaPorId = new Map(idsFila.map((id, i) => [id, fila[i]]));

  fila[0].socket.emit('game:start');
  const escondedores = [];
  for (let rodada = 1; rodada <= 6; rodada++) {
    await until(fila[0], s => s.phase === 'choosing' && s.round === rodada, `escolha da rodada ${rodada}`);
    escondedores.push(fila[0].state.chooserId);
    filaPorId.get(fila[0].state.chooserId).socket.emit('game:choose', { pokemonId: 143 });
    await until(fila[0], s => s.phase === 'playing', `rodada ${rodada} comecou`);
    filaPorId.get(fila[0].state.turnPlayerId).socket.emit('game:guess', { pokemonId: 143 });
    await until(fila[0], s => s.phase !== 'playing', `rodada ${rodada} fechou`);
    if (rodada < 6) fila[0].socket.emit('game:next');   // pula a espera de 12s
  }
  check('ninguem escondeu duas rodadas seguidas', escondedores.every((id, i) => i === 0 || id !== escondedores[i - 1]));
  check('em seis rodadas cada um escondeu duas vezes',
    new Set(escondedores).size === 3
    && idsFila.every(id => escondedores.filter(x => x === id).length === 2));

  // ----------------------------------------------------------- todos os universos
  // Um bloco generico: cada universo novo em shared/universes.js entra aqui
  // sozinho, sem precisar de teste escrito a mao.
  console.log('\n== Todos os universos ==');
  const arena = [];
  for (const universe of Object.values(UNIVERSES)) {
    const data = JSON.parse(await fs.readFile(path.join('data', universe.dataFile), 'utf8'));
    const validGroups = new Set(universe.groups.map(g => g.id));

    const eligibleByGroup = new Map();
    for (const item of data) {
      if (!item.eligible || !validGroups.has(item.group)) continue;
      if (!eligibleByGroup.has(item.group)) eligibleByGroup.set(item.group, []);
      eligibleByGroup.get(item.group).push(item);
    }

    // grupo so vale para quem pode ser sorteado: datasets podem ter um balde
    // de descarte (ex.: 'sem-casa' no Harry Potter) fora do schema
    const unknownGroups = [...new Set(data.filter(i => i.eligible).map(i => i.group))]
      .filter(g => !validGroups.has(g));
    check(`${universe.label}: grupos do schema batem com os dados`, unknownGroups.length === 0);
    check(`${universe.label}: todo grupo do schema tem sorteaveis`, eligibleByGroup.size === validGroups.size);

    // o menor grupo deixa a varredura curta o bastante para caber nos chutes
    const [groupId, pool] = [...eligibleByGroup].sort((a, b) => a[1].length - b[1].length)[0];

    const [p1, p2] = await Promise.all([connect('J1'), connect('J2')]);
    arena.push(p1, p2);
    const room = await new Promise(res => p1.socket.emit('room:create', {
      name: 'J1',
      settings: { mode: 'hunt', universe: universe.id, groups: [groupId], rounds: 1, turnSeconds: 120, guessesPerPlayer: 20 },
    }, res));
    await new Promise(res => p2.socket.emit('room:join', { code: room.code, name: 'J2' }, res));
    await until(p1, s => s.players.length === 2, `sala de ${universe.label}`);
    check(`${universe.label}: universo e grupo gravados`,
      p1.state.settings.universe === universe.id && p1.state.settings.groups[0] === groupId);

    p1.socket.emit('game:start');
    await until(p1, s => s.phase === 'playing', `partida de ${universe.label}`);

    // a largada e sorteada: quem chuta e quem esta na vez, nao necessariamente J1
    const naVez = () => (p1.state.turnPlayerId === room.playerId ? p1 : p2);
    naVez().socket.emit('game:guess', { pokemonId: data[0].id });
    await until(p1, s => s.rows.length === 1, `dica de ${universe.label}`);
    check(`${universe.label}: colunas do schema aplicadas`,
      JSON.stringify(Object.keys(p1.state.rows[0].cells)) === JSON.stringify(universe.columns.map(c => c.key)));

    // varre o grupo escolhido ate alguem acertar (2 jogadores x 20 chutes).
    // o chute de sondagem acima ja gastou um id: repetir seria recusado.
    const restante = pool.filter(item => item.id !== data[0].id);
    const alcance = Math.min(restante.length, 38);
    let tentativa = 0;
    while (p1.state.phase === 'playing' && tentativa < alcance) {
      const who = p1.state.turnPlayerId === room.playerId ? p1 : p2;
      who.socket.emit('game:guess', { pokemonId: restante[tentativa++].id });
      await until(p1, s => s.rows.length === tentativa + 1 || s.phase !== 'playing', `chute ${tentativa} em ${universe.label}`);
    }

    check(`${universe.label}: segredo fica oculto durante a partida`,
      p1.state.phase !== 'playing' || p1.state.secret === null);

    // se ninguem acertou, gasta os chutes que sobraram para a rodada fechar:
    // o segredo so e revelado no fim, e e nele que conferimos grupo e elegibilidade
    while (p1.state.phase === 'playing') {
      const usados = new Set(p1.state.rows.map(r => r.id));
      const proximo = data.find(item => !usados.has(item.id));
      if (!proximo) break;
      const who = p1.state.turnPlayerId === room.playerId ? p1 : p2;
      const antes = p1.state.rows.length;
      who.socket.emit('game:guess', { pokemonId: proximo.id });
      await until(p1, s => s.rows.length > antes || s.phase !== 'playing', `drenar chutes de ${universe.label}`);
    }

    check(`${universe.label}: segredo respeitou o grupo e e sorteavel`,
      p1.state.secret?.group === groupId && p1.state.secret?.eligible === true);
    if (restante.length <= alcance) {
      check(`${universe.label}: alguem acertou`, p1.state.rows.some(r => r.correct));
      const acerto = p1.state.rows.find(r => r.correct);
      check(`${universe.label}: linha correta sem erros`,
        acerto && Object.values(acerto.cells).every(c => c.status === 'hit' || c.status === 'unknown'));
    }
  }

  // ----------------------------------------------------------- dados traduzidos
  console.log('\n== Dados especificos ==');
  const clash = JSON.parse(await fs.readFile('data/clash.json', 'utf8'));
  check('clash: nomes em portugues', clash.find(c => c.key === 'hog-rider')?.name === 'Corredor');
  check('clash: nome em ingles como apelido',
    clash.find(c => c.key === 'hog-rider')?.aliases?.includes('Hog Rider') === true);
  const lol = JSON.parse(await fs.readFile('data/lol.json', 'utf8'));
  check('lol: nomes e titulos em portugues', lol.some(c => c.name === 'Ahri') && lol.every(c => c.roles.length));
  const heroes = JSON.parse(await fs.readFile('data/heroes.json', 'utf8'));
  check('herois: Marvel presente', heroes.filter(h => h.group === 'marvel' && h.eligible).length > 100);
  check('herois: Homem-Aranha sorteavel', heroes.find(h => h.name === 'Spider-Man')?.eligible === true);

  // ------------------------------------------------------- recorte do universo
  console.log('\n== Recorte (Hunter x Hunter) ==');
  const hxh = JSON.parse(await fs.readFile('data/hxh.json', 'utf8'));
  const soAnime = hxh.filter(c => c.eligible && c.inAnime);
  check('hxh: recorte do anime e menor que o elenco todo',
    soAnime.length > 100 && soAnime.length < hxh.filter(c => c.eligible).length);

  const rec = await connect('Rec');
  const roomRec = await new Promise(res => rec.socket.emit('room:create', {
    name: 'Rec',
    settings: {
      mode: 'hunt', universe: 'hxh', groups: [...UNIVERSES.hxh.defaultGroups],
      scope: 'anime', rounds: 3, turnSeconds: 120, guessesPerPlayer: 1,
    },
  }, res));
  await until(rec, s => s.phase === 'lobby', 'sala com recorte montada');
  check('recorte gravado nas configuracoes', rec.state.settings.scope === 'anime');

  // um chute so por rodada: a rodada fecha sozinha e revela o segredo. O host
  // pula os 12s de intervalo com game:next
  const sorteados = [];
  rec.socket.emit('game:start');
  for (let round = 1; round <= 3; round++) {
    await until(rec, s => s.phase === 'playing' && s.round === round, `rodada ${round} do recorte`);
    rec.socket.emit('game:guess', { pokemonId: hxh[0].id });
    await until(rec, s => s.secret !== null && s.round === round, `segredo da rodada ${round}`);
    sorteados.push(rec.state.secret);
    if (round < 3) {
      rec.socket.emit('game:next');
      await until(rec, s => s.phase === 'playing' && s.round === round + 1, `rodada ${round + 1}`);
    }
  }
  check('sortearam-se tres segredos', sorteados.length === 3);
  check('todo segredo sorteado saiu do anime', sorteados.every(s => s.inAnime === true));

  rec.socket.disconnect();

  // no duelo, quem esconde o segredo tambem esta preso ao recorte
  const foraDoAnime = hxh.find(c => c.eligible && !c.inAnime);
  const [duo1, duo2] = await Promise.all([connect('Duo1'), connect('Duo2')]);
  const roomDuo = await new Promise(res => duo1.socket.emit('room:create', {
    name: 'Duo1',
    settings: {
      mode: 'duel', universe: 'hxh', groups: [...UNIVERSES.hxh.defaultGroups],
      scope: 'anime', rounds: 2, turnSeconds: 120, guessesPerPlayer: 4,
    },
  }, res));
  await new Promise(res => duo2.socket.emit('room:join', { code: roomDuo.code, name: 'Duo2' }, res));
  await until(duo1, s => s.players.length === 2, 'duelo com recorte montado');
  duo1.socket.emit('game:start');
  await until(duo1, s => s.phase === 'choosing', 'fase de escolha');

  const chooser = duo1.state.chooserId === roomDuo.playerId ? duo1 : duo2;
  chooser.errors.length = 0;
  chooser.socket.emit('game:choose', { pokemonId: foraDoAnime.id });
  await sleep(250);
  check('duelo recusa quem esta fora do recorte', chooser.errors.length === 1);
  check('a recusa explica o recorte', /S(ó|o) o anime/.test(chooser.errors[0] ?? ''));
  check('a escolha recusada nao virou segredo', chooser.state.phase === 'choosing');

  const dentroDoAnime = hxh.find(c => c.eligible && c.inAnime);
  chooser.socket.emit('game:choose', { pokemonId: dentroDoAnime.id });
  await until(duo1, s => s.phase === 'playing', 'duelo comecou com segredo do anime');
  duo1.socket.disconnect();
  duo2.socket.disconnect();

  // --------------------------------------------------------- rodada "ate acertar"
  console.log('\n== Rodada "ate acertar" ==');
  const [inf1, inf2] = await Promise.all([connect('Inf1'), connect('Inf2')]);
  const roomInf = await new Promise(res => inf1.socket.emit('room:create', {
    name: 'Inf1',
    settings: { mode: 'hunt', universe: 'pokemon', groups: ['1'], rounds: 3, turnSeconds: 120, guessesPerPlayer: 0 },
  }, res));
  await new Promise(res => inf2.socket.emit('room:join', { code: roomInf.code, name: 'Inf2' }, res));
  await until(inf1, s => s.players.length === 2, 'sala "ate acertar" montada');
  check('rodadas continuam fixas', inf1.state.settings.rounds === 3);
  check('teto de chutes desligado', inf1.state.settings.guessesPerPlayer === 0);

  inf1.socket.emit('game:start');
  await until(inf1, s => s.phase === 'playing', 'partida "ate acertar" comecou');
  check('chutes aparecem como ilimitados', inf1.state.players.every(p => p.guessesLeft === null));

  // 30 chutes de Gen 2 (152-181): sao aceitos como chute mas nunca sao o
  // segredo (a sala so ligou a Gen 1), entao a rodada fica aberta de proposito
  // — com teto de 6 ela ja teria fechado
  for (let i = 1; i <= 30; i++) {
    const who = inf1.state.turnPlayerId === roomInf.playerId ? inf1 : inf2;
    who.socket.emit('game:guess', { pokemonId: 151 + i });
    await until(inf1, s => s.rows.length === i, `chute "ate acertar" ${i}`);
  }
  check('rodada segue depois de 30 chutes', inf1.state.phase === 'playing' && inf1.state.rows.length === 30);
  check('ninguem ficou sem chute', inf1.state.players.every(p => p.guessesLeft === null));

  // so o host encerra, e o placar final sai
  inf2.socket.emit('game:end');
  await sleep(200);
  check('so o host pode encerrar', inf1.state.phase !== 'gameOver');
  inf1.socket.emit('game:end');
  await until(inf1, s => s.phase === 'gameOver', 'host encerrou a partida');
  check('segredo revelado ao encerrar', inf1.state.secret !== null);
  // o placar final vai em `summary`; `message` fica com o motivo do encerramento
  check('placar final anunciado', /venceu|Empate|ninguém pontuou/.test(inf1.state.summary ?? ''));
  check('motivo do encerramento separado do placar', /encerrada pelo host/.test(inf1.state.message ?? ''));

  // ----------------------------------------------------------- padroes e duelo
  console.log('\n== Padrao e cronometro ==');
  const solo = await connect('Solo');
  const roomPadrao = await new Promise(res => solo.socket.emit('room:create', { name: 'Solo' }, res));
  check('caca ao segredo nasce com rodadas fixas', roomPadrao.state.settings.rounds >= 1);
  check('nasce em "ate acertar" (sem teto de chutes)', roomPadrao.state.settings.guessesPerPlayer === 0);

  solo.socket.emit('game:start');
  await until(solo, s => s.phase === 'playing', 'partida solo comecou');
  check('jogando sozinho nao ha cronometro', solo.state.deadline === null);

  // 10 chutes seguidos: com limite a rodada teria fechado
  for (let i = 1; i <= 10 && solo.state.phase === 'playing'; i++) {
    solo.socket.emit('game:guess', { pokemonId: i });
    await until(solo, s => s.rows.length === i || s.phase !== 'playing', `chute solo ${i}`);
  }
  check('rodada solo nao fecha por chutes',
    solo.state.phase !== 'playing' ? solo.state.rows.some(r => r.correct) : solo.state.rows.length === 10);

  const duelista = await connect('Duelista');
  const roomDuelo = await new Promise(res => duelista.socket.emit('room:create', {
    name: 'Duelista', settings: { mode: 'duel', rounds: 2, guessesPerPlayer: 0 },
  }, res));
  check('duelo fixa as rodadas', roomDuelo.state.settings.rounds === 2);
  check('duelo recusa o "ate acertar" e mantem teto de chutes', roomDuelo.state.settings.guessesPerPlayer > 0);

  // ------------------------------------------- sorteio de quem abre a rodada
  console.log('\n== Sorteio da largada ==');
  const [ini1, ini2] = await Promise.all([connect('Ini1'), connect('Ini2')]);
  const roomIni = await new Promise(res => ini1.socket.emit('room:create', {
    name: 'Ini1',
    // sorteio na Gen 1 + chutes de Gen 2: ninguem acerta, entao toda rodada
    // fecha por esgotamento e o teste controla quantas rodam
    settings: { mode: 'hunt', universe: 'pokemon', groups: ['1'], rounds: 20, turnSeconds: 120, guessesPerPlayer: 1 },
  }, res));
  await new Promise(res => ini2.socket.emit('room:join', { code: roomIni.code, name: 'Ini2' }, res));
  await until(ini1, s => s.players.length === 2, 'sala do sorteio montada');

  const largadas = new Set();
  ini1.socket.emit('game:start');
  for (let round = 1; round <= 20; round++) {
    await until(ini1, s => s.phase === 'playing' && s.round === round, `rodada ${round} do sorteio`);
    largadas.add(ini1.state.turnPlayerId);
    const abre = ini1.state.turnPlayerId === roomIni.playerId ? ini1 : ini2;
    const outro = abre === ini1 ? ini2 : ini1;
    abre.socket.emit('game:guess', { pokemonId: 152 });
    await until(ini1, s => s.rows.length === 1, `largada da rodada ${round}`);
    outro.socket.emit('game:guess', { pokemonId: 153 });
    await until(ini1, s => s.phase !== 'playing', `fim da rodada ${round}`);
    if (round < 20) ini1.socket.emit('game:next');
  }
  // 20 rodadas com 2 jogadores: sair sempre o mesmo da 1 chance em 500 mil
  check('a largada varia entre os jogadores', largadas.size === 2);
  check('so quem esta na sala abre a rodada',
    [...largadas].every(id => ini1.state.players.some(p => p.id === id)));

  // ------------------------------------------------------ versao do deploy
  console.log('\n== Cache buster ==');
  const versao = await fetch(`${URL}/api/version`);
  const { version } = await versao.json();
  check('/api/version responde', versao.ok && typeof version === 'string' && version.length > 0);
  check('/api/version nao e cacheado', versao.headers.get('cache-control') === 'no-store');

  // ----------------------------------------------------------- reconexao
  console.log('\n== Reconexao ==');
  // volta como quem pontuou no duelo (o escolhedor e sorteado, entao pode ser
  // gary ou may): o teste confere que o placar sobrevive a reconexao
  const back = await connect(seeker.name);
  const rejoined = await new Promise(res => back.socket.emit('room:join', {
    code: room3.code, name: seeker.name, playerId: seekerId,
  }, res));
  check('reconectou como o mesmo jogador', rejoined.playerId === seekerId);
  check('placar preservado', rejoined.state.players.find(p => p.id === rejoined.playerId).score > 0);
  check('sala nao duplicou jogador', rejoined.state.players.length === 2);

  for (const p of [ash, misty, brock, ...squad, gary, may, ...fila, ...arena, inf1, inf2, ini1, ini2, solo, duelista, back]) p.socket.close();
} catch (err) {
  console.error('\nERRO NO TESTE:', err.message);
  failures++;
} finally {
  server.kill();
}

console.log(failures ? `\n${failures} verificacao(oes) falharam.` : '\nTudo verde.');
process.exit(failures ? 1 : 0);
