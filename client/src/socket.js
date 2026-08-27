import { io } from 'socket.io-client';

/**
 * Mesma origem: em producao o Express serve o build e o socket; em dev o proxy
 * do Vite encaminha /socket.io para a 3000.
 */
export const socket = io({ autoConnect: true });
