import Modal from './Modal.jsx';
import CreateRoomPanel from './CreateRoomPanel.jsx';
import LobbyPanel from './LobbyPanel.jsx';

/**
 * A janela da sala, nos seus dois momentos: antes de existir código ela é o
 * formulário de criação; nascida a sala, o mesmo modal vira a sala de espera.
 * A moldura é a mesma nos dois — não há tela nova, a caixa é que muda de dentro.
 *
 * Dentro da sala o véu e o Esc param de fechar: sair custa a cadeira, então só
 * sai quem clica em "Sair da sala" (ou no X, que aqui diz a mesma coisa).
 */
export default function RoomModal({
  state, myId, name, onName, onCreate, onCancel, onLeave, toast,
}) {
  const room = state?.phase === 'lobby' ? state : null;

  return (
    <Modal
      label={room ? `Sala ${room.code}` : 'Criar nova sala'}
      className={room ? 'room' : ''}
      dismissable={!room}
      closeLabel={room ? 'Sair da sala' : 'Fechar'}
      onClose={room ? onLeave : onCancel}
    >
      {room
        ? <LobbyPanel state={room} myId={myId} toast={toast} onLeave={onLeave} />
        : <CreateRoomPanel name={name} onName={onName} onClose={onCancel} onCreate={onCreate} />}
    </Modal>
  );
}
