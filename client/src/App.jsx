import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_UNIVERSE, UNIVERSES } from '@shared/universes.js';
import { socket } from './socket.js';
import {
  forgetSession, rememberName, rememberPlayerId, rememberSession,
  savedName, savedPlayerId, savedSession,
} from './lib/storage.js';
import { answerForOpenRoom, roomOpenElsewhere } from './lib/tabs.js';
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
  // convite para voltar a partida de onde a pessoa caiu (ver o efeito abaixo)
  const [resume, setResume] = useState(null);

  const toastTimer = useRef(null);
  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // os handlers de socket sao registrados uma vez; a ref da o valor atual
  const latest = useRef({ state, name });
  latest.current = { state, name };

  /**
   * O convite para voltar so aparece quando a aba nao consegue voltar sozinha:
   * com o playerId ainda no sessionStorage (F5, queda de sinal) o onConnect
   * mais abaixo resolve calado. E so se nenhuma outra aba estiver com a sala
   * aberta — a cadeira dela nao esta livre.
   */
  useEffect(() => {
    const last = savedSession();
    if (!last || savedPlayerId(last.code)) return;
    let asking = true;
    roomOpenElsewhere(last.code).then(open => { if (asking && !open) setResume(last); });
    return () => { asking = false; };
  }, []);

  /** ...e esta aba responde o mesmo para as outras enquanto estiver em campo. */
  useEffect(() => answerForOpenRoom(() => latest.current.state?.code), []);

  /** Volta para a home sem avisar o servidor: para quando a sala ja nao existe. */
  const forget = useCallback(() => {
    setState(null);
    setMyId(null);
    setResume(null);
    forgetSession();
    history.replaceState(null, '', location.pathname);
  }, []);

  const handleJoined = useCallback((res) => {
    // sala perdida (servidor reiniciou, codigo errado): segurar um estado que
    // nao existe mais deixaria a tela de jogo congelada para sempre
    if (res?.error) {
      if (latest.current.state) forget();
      return showToast(res.error);
    }
    setMyId(res.playerId);
    setResume(null);
    rememberPlayerId(res.code, res.playerId);
    // o nome vem do servidor, ja aparado: e ele que o cartao de voltar mostra
    const seat = res.state.players.find(p => p.id === res.playerId);
    rememberSession(res.code, res.playerId, seat?.name ?? latest.current.name);
    history.replaceState(null, '', `?sala=${res.code}`);
    setState(res.state);
  }, [forget, showToast]);

  useEffect(() => {
    const onConnect = () => {
      // Reconexao automatica, nos dois jeitos de a conexao sumir: com a sala
      // aberta na tela e so voltar para ela; depois de um F5 nao ha estado em
      // memoria, mas o endereco guarda o codigo e a aba guarda o playerId — da
      // para sentar na mesma cadeira sem perguntar nada. Sem playerId a volta
      // nao vale: entrar de novo criaria um jogador zerado e deixaria a
      // cadeira antiga guardada a toa. Esse caso e o do cartao na home.
      const code = latest.current.state?.code
        ?? new URLSearchParams(location.search).get('sala')?.toUpperCase();
      if (!code) return;
      const playerId = savedPlayerId(code);
      if (!latest.current.state && !playerId) return;
      socket.emit('room:join', { code, name: latest.current.name, playerId }, handleJoined);
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

  /**
   * Entrar e voltar sao o mesmo evento: o que muda e levar o playerId da
   * cadeira antiga. O servidor responde `resumed` dizendo se ela ainda estava
   * guardada — quando nao estava, a pessoa entrou zerada e merece saber.
   */
  const joinRoom = (code, playerId = savedPlayerId(code)) =>
    socket.emit('room:join', { code, name: commitName(), playerId }, (res) => {
      const wanted = resume?.code === code;
      if (res?.error && wanted) forget();
      handleJoined(res);
      if (wanted && !res?.error && !res.resumed) {
        showToast('A vaga não estava mais guardada: você entrou como um jogador novo.');
      }
    });

  const leave = () => {
    socket.emit('room:leave');
    forget();
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
          resume={resume}
          onResume={() => joinRoom(resume.code, resume.playerId)}
          onForgetResume={forget}
        />
      )}
      {state?.phase === 'lobby' && <LobbyScreen {...shared} />}
      {state && state.phase !== 'lobby' && <GameScreen {...shared} />}
    </>
  );
}
