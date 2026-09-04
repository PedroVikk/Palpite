import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/** O backend Express + socket.io continua na 3000; o Vite so serve o cliente. */
const API = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // o schema dos universos e o mesmo arquivo que o servidor importa
    alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  server: {
    port: 5173,
    fs: { allow: ['..'] },   // shared/ vive fora de client/
    // com o proxy o navegador ve tudo na mesma origem, entao nao ha CORS em dev
    proxy: {
      '/api': API,
      '/sprites': API,
      '/marks': API,
      '/socket.io': { target: API, ws: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
