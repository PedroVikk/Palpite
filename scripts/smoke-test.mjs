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
  // ----------------------------------------------------------- modo classico
  console.log('\n== Modo classico, 3 jogadores ==');
  const [ash, misty, brock] = await Promise.all([connect('Ash'), connect('Misty'), connect('Brock')]);

  const created = await new Promise(res => ash.socket.emit('room:create', {
    name: 'Ash',
    settings: { mode: 'classic', universe: 'pokemon', groups: ['1'], rounds: 2, turnSeconds: 5, guessesPerPlayer: 2 },
  }, res));
  const code = created.code;
  check(`sala criada (${code})`, /^[A-Z2-9]{4}$/.test(code));

  for (const p of [misty, brock]) {
    await new Promise(res => p.socket.emit('room:join', { code, name: p.name }, res));
  }
  await until(ash, s => s.players.length === 3, '3 jogadores no lobby');
  check('todos no lobby', ash.state.players.map(p => p.name).join() === 'Ash,Misty,Brock');
  check('configuracoes aplicadas', ash.state.settings.rounds === 2 && ash.state.settings.turnSeconds === 5);

  ash.socket.emit('game:start');
  await until(ash, s => s.phase === 'playing', 'partida comecou');
  check('rodada 1 comecou com Ash', ash.state.turnPlayerId === created.playerId);
  check('segredo escondido durante a partida', ash.state.secret === null);
  check('chutes distribuidos', ash.state.players.every(p => p.guessesLeft === 2));

  // fora da vez: deve ser rejeitado
  misty.socket.emit('game:guess', { pokemonId: 25 });
  await sleep(150);
  check('chute fora da vez recusado', misty.errors.some(e => e.includes('sua vez')));

  ash.socket.emit('game:guess', { pokemonId: 25 }); // Pikachu
  await until(ash, s => s.rows.length === 1, 'primeira dica publicada');
  const row = ash.state.rows[0];
  check('dica tem as 7 colunas', Object.keys(row.cells).length === 7);
  check('dica mostra quem chutou', row.playerName === 'Ash');
  check('turno passou para Misty', ash.state.turnPlayerId === ash.state.players[1].id);

  // repetir o mesmo Pokemon deve ser bloqueado
  misty.socket.emit('game:guess', { pokemonId: 25 });
  await sleep(150);
  check('chute repetido recusado', misty.errors.some(e => e.includes('já foi chutado')));

  // Pokemon fora dos grupos da sala ainda e aceito como chute (so o segredo e limitado)
  misty.socket.emit('game:guess', { pokemonId: 1 });
  await until(ash, s => s.rows.length === 2, 'segunda dica');
  check('turno passou para Brock', ash.state.turnPlayerId === ash.state.players[2].id);

  // Brock nao chuta: o timer (5s) deve consumir um chute dele e passar a vez
  const brockId = ash.state.players[2].id;
  await until(ash, s => s.turnPlayerId !== brockId, 'timeout de turno', 9000);
  check('timeout nao gerou dica', ash.state.rows.length === 2);
  check('timeout consumiu um chute de Brock', ash.state.players[2].guessesLeft === 1);
  check('a vez voltou para Ash', ash.state.turnPlayerId === ash.state.players[0].id);

  // gasta os chutes restantes de Ash e Misty; Brock deixa estourar de novo
  ash.socket.emit('game:guess', { pokemonId: 4 });
  await until(ash, s => s.rows.length === 3, 'terceira dica');
  misty.socket.emit('game:guess', { pokemonId: 7 });
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
    settings: { mode: 'classic', universe: 'pokemon', groups: ['1'], rounds: 1, turnSeconds: 120, guessesPerPlayer: 20 },
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
  console.log('\n== Modo duelo de escolhas ==');
  const [gary, may] = await Promise.all([connect('Gary'), connect('May')]);
  const room3 = await new Promise(res => gary.socket.emit('room:create', {
    name: 'Gary',
    settings: { mode: 'duel', universe: 'pokemon', groups: ['1', '2'], rounds: 1, turnSeconds: 30, guessesPerPlayer: 3 },
  }, res));
  await new Promise(res => may.socket.emit('room:join', { code: room3.code, name: 'May' }, res));
  gary.socket.emit('game:start');
  await until(gary, s => s.phase === 'choosing', 'fase de escolha');
  check('quem escolhe e o primeiro jogador', gary.state.chooserId === room3.playerId);
  check('escolhedor nao chuta', gary.state.players[0].guessesLeft === 0);

  gary.socket.emit('game:choose', { pokemonId: 400 }); // fora da Gen 1-2
  await sleep(150);
  check('escolha fora dos grupos recusada', gary.errors.some(e => e.includes('fora das opções')));

  gary.socket.emit('game:choose', { pokemonId: 143 }); // Snorlax
  await until(may, s => s.phase === 'playing', 'duelo comecou');
  check('turno vai para o adversario', may.state.turnPlayerId === may.state.players[1].id);
  check('escolhedor nao entra no rodizio', may.state.chooserId !== may.state.turnPlayerId);

  may.socket.emit('game:guess', { pokemonId: 143 });
  await until(may, s => s.phase !== 'playing', 'adversario acertou');
  check('segredo era o escolhido', may.state.secret?.id === 143);
  check('adversario pontuou', may.state.players[1].score > 0);
  check('escolhedor nao pontuou', may.state.players[0].score === 0);

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
      settings: { mode: 'classic', universe: universe.id, groups: [groupId], rounds: 1, turnSeconds: 120, guessesPerPlayer: 20 },
    }, res));
    await new Promise(res => p2.socket.emit('room:join', { code: room.code, name: 'J2' }, res));
    await until(p1, s => s.players.length === 2, `sala de ${universe.label}`);
    check(`${universe.label}: universo e grupo gravados`,
      p1.state.settings.universe === universe.id && p1.state.settings.groups[0] === groupId);

    p1.socket.emit('game:start');
    await until(p1, s => s.phase === 'playing', `partida de ${universe.label}`);

    p1.socket.emit('game:guess', { pokemonId: data[0].id });
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

  // ----------------------------------------------------------- partida sem fim
  console.log('\n== Partida sem fim ==');
  const [inf1, inf2] = await Promise.all([connect('Inf1'), connect('Inf2')]);
  const roomInf = await new Promise(res => inf1.socket.emit('room:create', {
    name: 'Inf1',
    settings: { mode: 'classic', universe: 'pokemon', groups: ['1'], rounds: 0, turnSeconds: 120, guessesPerPlayer: 6 },
  }, res));
  await new Promise(res => inf2.socket.emit('room:join', { code: roomInf.code, name: 'Inf2' }, res));
  await until(inf1, s => s.players.length === 2, 'sala sem fim montada');
  check('rodadas ficam indefinidas', inf1.state.settings.rounds === 0);
  check('teto de chutes desligado', inf1.state.settings.guessesPerPlayer === 0);

  inf1.socket.emit('game:start');
  await until(inf1, s => s.phase === 'playing', 'partida sem fim comecou');
  check('chutes aparecem como ilimitados', inf1.state.players.every(p => p.guessesLeft === null));

  // 30 chutes: com teto de 6 a rodada ja teria fechado
  for (let i = 1; i <= 30; i++) {
    const who = inf1.state.turnPlayerId === roomInf.playerId ? inf1 : inf2;
    who.socket.emit('game:guess', { pokemonId: i });
    await until(inf1, s => s.rows.length === i || s.phase !== 'playing', `chute sem fim ${i}`);
    if (inf1.state.phase !== 'playing') break;
  }
  const acertouCedo = inf1.state.phase !== 'playing';
  check('rodada segue depois de 30 chutes (ou fechou por acerto)',
    acertouCedo ? inf1.state.rows.some(r => r.correct) : inf1.state.rows.length === 30);
  check('ninguem ficou sem chute', acertouCedo || inf1.state.players.every(p => p.guessesLeft === null));

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
  console.log('\n== Padrao sem fim e cronometro ==');
  const solo = await connect('Solo');
  const roomPadrao = await new Promise(res => solo.socket.emit('room:create', { name: 'Solo' }, res));
  check('classico ja nasce indefinido', roomPadrao.state.settings.rounds === 0);
  check('sem teto de chutes por padrao', roomPadrao.state.settings.guessesPerPlayer === 0);

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
    name: 'Duelista', settings: { mode: 'duel', rounds: 0 },
  }, res));
  check('duelo recusa o indefinido', roomDuelo.state.settings.rounds > 0);
  check('duelo mantem teto de chutes', roomDuelo.state.settings.guessesPerPlayer > 0);

  // ----------------------------------------------------------- reconexao
  console.log('\n== Reconexao ==');
  const back = await connect('May');
  const rejoined = await new Promise(res => back.socket.emit('room:join', {
    code: room3.code, name: 'May', playerId: may.state.players[1].id,
  }, res));
  check('reconectou como o mesmo jogador', rejoined.playerId === may.state.players[1].id);
  check('placar preservado', rejoined.state.players.find(p => p.id === rejoined.playerId).score > 0);
  check('sala nao duplicou jogador', rejoined.state.players.length === 2);

  for (const p of [ash, misty, brock, ...squad, gary, may, ...arena, inf1, inf2, solo, duelista, back]) p.socket.close();
} catch (err) {
  console.error('\nERRO NO TESTE:', err.message);
  failures++;
} finally {
  server.kill();
}

console.log(failures ? `\n${failures} verificacao(oes) falharam.` : '\nTudo verde.');
process.exit(failures ? 1 : 0);
