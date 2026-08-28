import { useEffect, useState } from 'react';
import { APP_VERSION } from '../lib/version.js';

/**
 * Catalogo do universo, usado pela busca e pelo contador do lobby.
 * O cache e de modulo: voltar a um universo ja visitado nao refaz o request —
 * e o servidor ainda responde 304 quando o navegador revalida.
 *
 * O `?v=` amarra o request ao deploy: dentro de uma versao o navegador reusa o
 * cache (max-age 1h), mas um deploy novo troca a URL e forca a busca do indice
 * atualizado sem esperar o cache expirar.
 */
const cache = new Map();

export function useDataset(universeId) {
  const [items, setItems] = useState(() => cache.get(universeId) ?? null);

  useEffect(() => {
    if (cache.has(universeId)) return setItems(cache.get(universeId));

    let alive = true;
    setItems(null);
    fetch(`/api/dataset/${universeId}?v=${APP_VERSION}`)
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
