import { useEffect, useState } from 'react';

/**
 * Catalogo do universo, usado pela busca e pelo contador do lobby.
 * O cache e de modulo: voltar a um universo ja visitado nao refaz o request —
 * e o servidor ainda responde 304 quando o navegador revalida.
 */
const cache = new Map();

export function useDataset(universeId) {
  const [items, setItems] = useState(() => cache.get(universeId) ?? null);

  useEffect(() => {
    if (cache.has(universeId)) return setItems(cache.get(universeId));

    let alive = true;
    setItems(null);
    fetch(`/api/dataset/${universeId}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(res.status))))
      .then(list => {
        cache.set(universeId, list);
        if (alive) setItems(list);
      })
      .catch(() => { if (alive) setItems([]); });

    return () => { alive = false; };
  }, [universeId]);

  return items;   // null enquanto carrega
}
