import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// fontes empacotadas no build: a pagina nao depende do Google para renderizar
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';
import App from './App.jsx';
import { watchForNewVersion } from './lib/version.js';

watchForNewVersion();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
