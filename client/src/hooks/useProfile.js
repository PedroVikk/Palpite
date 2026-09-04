import { useCallback, useEffect, useState } from 'react';

/**
 * Quem esta jogando, do ponto de vista do servidor.
 *
 * A conta e opcional em todo lugar: sem banco no ar, ou sem ninguem logado,
 * isto responde `user: null` e a tela cai no progresso do proprio navegador,
 * que e como o jogo sempre funcionou. Nada aqui pode virar porta trancada.
 */
export function useProfile() {
  const [state, setState] = useState({
    loading: true,
    enabled: false,   // o login existe neste deploy?
    user: null,
    streak: null,
    today: null,
  });

  const load = useCallback(async () => {
    try {
      const [configRes, profileRes] = await Promise.all([
        fetch('/api/auth/config'),
        fetch('/api/profile'),
      ]);
      const config = configRes.ok ? await configRes.json() : { enabled: false };
      const profile = profileRes.ok ? await profileRes.json() : { user: null };
      setState({
        loading: false,
        enabled: Boolean(config.enabled),
        user: profile.user ?? null,
        streak: profile.streak ?? null,
        today: profile.today ?? null,
      });
    } catch {
      // servidor fora do ar nao pode esconder o jogo: segue como convidado
      setState(s => ({ ...s, loading: false, enabled: false, user: null }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const logout = useCallback(async () => {
    try { await fetch('/api/logout', { method: 'POST' }); } catch { /* sair sempre da certo */ }
    setState(s => ({ ...s, user: null, streak: null, today: null }));
  }, []);

  return { ...state, refresh: load, logout };
}
