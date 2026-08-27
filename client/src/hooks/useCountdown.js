import { useEffect, useState } from 'react';

const remaining = (deadline) => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

/**
 * Segundos ate o fim do turno, ou null quando nao ha cronometro (jogando
 * sozinho o servidor nao arma nenhum). Repica a 250ms para o numero nao
 * "pular" segundos em aba ocupada.
 */
export function useCountdown(deadline) {
  const [left, setLeft] = useState(() => (deadline ? remaining(deadline) : null));

  useEffect(() => {
    if (!deadline) {
      setLeft(null);
      return;
    }
    setLeft(remaining(deadline));
    const handle = setInterval(() => setLeft(remaining(deadline)), 250);
    return () => clearInterval(handle);
  }, [deadline]);

  return left;
}
