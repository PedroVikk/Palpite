import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_UNIVERSE, UNIVERSES } from '@shared/universes.js';
import { socket } from './socket.js';
import { rememberName, rememberPlayerId, savedName, savedPlayerId } from './lib/storage.js';
import HomeScreen from './screens/HomeScreen.jsx';
import LobbyScreen from './screens/LobbyScreen.jsx';
import GameScreen from './screens/GameScreen.jsx';
import DailyScreen from './screens/DailyScreen.jsx';

/** Com o que uma sala nasce. O host ajusta tudo depois, no lobby. */
const NEW_ROOM = {
  mode: 'hunt',
  universe: DEFAULT_UNIVERSE,
  groups: [...UNIVERSES[DEFAULT_UNIVERSE].defaultGroups],
  rounds: 5,
  turnSeconds: 45,
  guessesPerPlayer: 0, // 0 = "ate acertar", o padrao da caca ao segredo
};

export default function App() {
  const [state, setState] = useState(null);   // ultimo estado publico da sala
  const [myId, setMyId] = useState(null);
  const [name, setName] = useState(savedName);
  const [toast, setToast] = useState(null);
  // ?diario=<universo> abre o desafio direto, para o link ser compartilhavel
  const [daily, setDaily] = useState(() => new URLSearchParams(location.search).has('diario'));

  const toastTimer = useRef(null);
  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // os handlers de socket sao registrados uma vez; a ref da o valor atual
  const latest = useRef({ state, name });
  latest.current = { state, name };

  const handleJoined = useCallback((res) => {
    if (res?.error) return showToast(res.error);
    setMyId(res.playerId);
    rememberPlayerId(res.code, res.playerId);
    history.replaceState(null, '', `?sala=${res.code}`);
    setState(res.state);
  }, [showToast]);

  useEffect(() => {
    const onConnect = () => {
      // reconexao automatica: volta para a sala que estava aberta
      const code = latest.current.state?.code;
      if (!code) return;
      socket.emit('room:join', { code, name: latest.current.name, playerId: savedPlayerId(code) }, handleJoined);
    };
    const onDisconnect = () => showToast('Conexão perdida, reconectando...');

    socket.on('room:state', setState);
    socket.on('room:error', showToast);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('room:state', setState);
      socket.off('room:error', showToast);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [handleJoined, showToast]);

  /** O servidor tambem apara o nome; aqui e so para o que fica salvo bater. */
  const commitName = () => {
    const clean = name.trim().slice(0, 16) || 'Treinador';
    rememberName(clean);
    setName(clean);
    return clean;
  };

  const createRoom = () =>
    socket.emit('room:create', { name: commitName(), settings: NEW_ROOM }, handleJoined);

  const joinRoom = (code) =>
    socket.emit('room:join', { code, name: commitName(), playerId: savedPlayerId(code) }, handleJoined);

  const leave = () => {
    socket.emit('room:leave');
    setState(null);
    setMyId(null);
    history.replaceState(null, '', location.pathname);
  };

  const openDaily = () => setDaily(true);
  const closeDaily = () => {
    setDaily(false);
    history.replaceState(null, '', location.pathname);
  };

  const shared = { state, myId, toast: showToast, onLeave: leave };

  return (
    <>
      {toast && <div className="toast" role="status">{toast}</div>}

      {!state && daily && <DailyScreen toast={showToast} onExit={closeDaily} />}
      {!state && !daily && (
        <HomeScreen
          name={name}
          onName={setName}
          onCreate={createRoom}
          onJoin={joinRoom}
          onDaily={openDaily}
          toast={showToast}
        />
      )}
      {state?.phase === 'lobby' && <LobbyScreen {...shared} />}
      {state && state.phase !== 'lobby' && <GameScreen {...shared} />}
    </>
  );
}
