/**
 * Cache-buster de deploy. O servidor carimba `window.__APP_VERSION__` no
 * index.html (que nunca e cacheado) e responde a mesma coisa em /api/version.
 * Se, ao revalidar, a versao do servidor mudou, um deploy novo entrou no ar e
 * esta aba esta rodando o bundle antigo — recarrega uma vez para pegar o novo.
 */
export const APP_VERSION = (typeof window !== 'undefined' && window.__APP_VERSION__) || 'dev';

async function serverVersion() {
  const res = await fetch('/api/version', { cache: 'no-store' });
  if (!res.ok) return null;
  const { version } = await res.json();
  return version || null;
}

export function watchForNewVersion() {
  if (APP_VERSION === 'dev') return;   // em dev (Vite) nao ha deploy para comparar

  let reloading = false;
  const check = async () => {
    if (reloading) return;
    try {
      const latest = await serverVersion();
      if (latest && latest !== APP_VERSION) {
        reloading = true;
        location.reload();
      }
    } catch {
      /* offline ou servidor hibernando: tenta de novo no proximo ciclo */
    }
  };

  // volta a aba para o foco e a cada minuto: cobre a aba esquecida aberta
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  setInterval(check, 60_000);
}
