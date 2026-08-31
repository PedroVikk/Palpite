/**
 * Um canal entre as abas do mesmo navegador, aberto para uma pergunta so:
 * "alguem ai ja esta na sala X?".
 *
 * O convite para voltar mora no localStorage, que e compartilhado entre as
 * abas — sem esta pergunta, abrir uma segunda aba para o irmao jogar junto
 * ofereceria a ele a cadeira de quem esta jogando na primeira. Duas abas sao
 * dois jogadores; a aba que esta em campo responde por si e o convite some.
 */
const CHANNEL = 'palpite:abas';

/** Navegador sem BroadcastChannel (ou com ele bloqueado) simplesmente nao responde. */
const open = () => { try { return new BroadcastChannel(CHANNEL); } catch { return null; } };

/** Enquanto esta aba tiver sala aberta, ela responde a quem perguntar. */
export function answerForOpenRoom(currentCode) {
  const bus = open();
  if (!bus) return () => {};
  bus.onmessage = (event) => {
    const code = currentCode();
    if (code && event.data?.ask === code) bus.postMessage({ holding: code });
  };
  return () => bus.close();
}

/** Resolve true se outra aba respondeu que ja esta nessa sala. */
export function roomOpenElsewhere(code, waitMs = 250) {
  const bus = open();
  if (!bus) return Promise.resolve(false);
  return new Promise((resolve) => {
    const done = (held) => { bus.close(); resolve(held); };
    bus.onmessage = (event) => { if (event.data?.holding === code) done(true); };
    bus.postMessage({ ask: code });
    // ninguem respondeu a tempo: a cadeira esta livre para a volta
    setTimeout(() => done(false), waitMs);
  });
}
