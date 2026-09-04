/**
 * Bootstrap: a camada web (http.js) e o servidor de salas (rooms.js) dividem
 * o mesmo processo e a mesma porta — o socket.io se pendura no servidor HTTP,
 * entao nao ha segunda porta nem origem cruzada em producao.
 */
import http from 'node:http';
import { Server } from 'socket.io';
import { createApp, LOCAL_ORIGIN } from './http.js';
import { attachRooms } from './rooms.js';
import * as db from './db.js';

const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

const server = http.createServer(createApp());

// producao: cliente e socket saem do mesmo host, nada de CORS.
// dev: o Vite serve o cliente noutra porta.
const io = new Server(server, isProd ? {} : { cors: { origin: LOCAL_ORIGIN } });
attachRooms(io);

/**
 * O banco sobe antes de atender, mas nao manda no boot: sem ele o jogo abre
 * do mesmo jeito, so que sem contas. A faxina de sessoes vencidas roda uma vez
 * por dia, junto com o processo.
 */
await db.connect();
if (db.ready()) {
  const sweep = () => db.sweepSessions().catch(() => {});
  sweep();
  setInterval(sweep, 24 * 60 * 60 * 1000).unref();
}

server.listen(PORT, () => console.log(`Palpite rodando em http://localhost:${PORT}`));
