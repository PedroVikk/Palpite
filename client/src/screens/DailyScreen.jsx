import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_UNIVERSE, UNIVERSES, getUniverse, scopeFilter } from '@shared/universes.js';
import { useDataset } from '../hooks/useDataset.js';
import { loadDaily, pruneDaily, saveDaily } from '../lib/storage.js';
import GuessBar from '../components/GuessBar.jsx';
import HintsTable from '../components/HintsTable.jsx';
import Reveal from '../components/Reveal.jsx';
import { ExitIcon } from '../components/Icon.jsx';

/** "2026-08-27" -> "27/08". Sem Date, que reinterpretaria no fuso local. */
const prettyDate = (iso) => {
  const [, month, day] = String(iso ?? '').split('-');
  return month ? `${day}/${month}` : '';
};

const startingUniverse = () => {
  const asked = new URLSearchParams(location.search).get('diario');
  return UNIVERSES[asked] ? asked : DEFAULT_UNIVERSE;
};

/**
 * Desafio do dia: sem sala, sem turno, chutes ilimitados. O segredo e o mesmo
 * para todo mundo e o servidor nao guarda nada — o progresso vive no
 * localStorage deste navegador, e a data na chave faz virar o dia sozinho.
 *
 * O dia tem recorte (uma epoca, uma categoria), e ele nao e anunciado em lugar
 * nenhum: a busca do chute so oferece quem esta dentro, e a pessoa descobre o
 * cerco jogando.
 */
export default function DailyScreen({ toast, onExit }) {
  const [universe, setUniverse] = useState(startingUniverse);
  const [info, setInfo] = useState(null);      // { date, poolSize, scope, group }
  const [progress, setProgress] = useState({ rows: [], secret: null });
  const [sending, setSending] = useState(false);
  const [round, setRound] = useState(0);             // sobe na virada do dia, para recarregar

  const schema = getUniverse(universe);
  const items = useDataset(universe) ?? [];
  const solved = Boolean(progress.secret);

  useEffect(() => {
    let alive = true;
    setInfo(null);
    setProgress({ rows: [], secret: null });
    history.replaceState(null, '', `?diario=${universe}`);

    fetch(`/api/daily/${universe}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('falhou'))))
      .then(data => {
        if (!alive) return;
        pruneDaily(data.date);
        setInfo(data);
        setProgress(loadDaily(data.date, universe));
      })
      .catch(() => { if (alive) toast('Não consegui carregar o desafio de hoje.'); });

    return () => { alive = false; };
  }, [universe, round, toast]);

  const submit = useCallback(async (chosen) => {
    if (!chosen) return toast('Escolha um nome da lista.');
    if (!info || solved || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/daily/${universe}/guess/${chosen.id}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // recusa por recorte velho quer dizer que o dia virou nesta aba
        if (data?.date && data.date !== info.date) { pruneDaily(data.date); setRound(n => n + 1); }
        return toast(data?.error ?? 'Não consegui enviar o chute.');
      }

      // alguem pode estar jogando na virada da meia-noite: a categoria tambem
      // trocou, entao vale recarregar o desafio inteiro em vez de so a data
      if (data.date !== info.date) {
        pruneDaily(data.date);
        setRound(n => n + 1);
        return toast('O dia virou — desafio novo!');
      }

      const next = { rows: [...progress.rows, data.row], secret: data.secret ?? null };
      setProgress(next);
      saveDaily(data.date, universe, next);
    } catch {
      toast('Não consegui enviar o chute.');
    } finally {
      setSending(false);
    }
  }, [info, solved, sending, universe, progress.rows, toast]);

  const attempts = progress.rows.length;

  // a trava do dia: fora do recorte o nome nem aparece na busca
  const inScope = useMemo(
    () => scopeFilter(schema, info?.scope ?? null),
    [schema, info?.scope],
  );

  return (
    <>
      <header className="topbar">
        <span className="wordmark">Palpite</span>
        <span className="pill">Desafio diário</span>
        {info && <span className="pill code">{prettyDate(info.date)}</span>}
        <span className="spacer" />
        <button className="btn link" onClick={onExit}>
          <ExitIcon width={16} height={16} /> Sair
        </button>
      </header>

      <main className="page">
        <div className="daily-head">
          <label className="field">
            <span>Universo</span>
            <select value={universe} onChange={e => setUniverse(e.target.value)}>
              {Object.values(UNIVERSES).map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </label>
          <p className="muted">
            {!info
              ? 'Carregando...'
              : solved
                ? `Você acertou em ${attempts} ${attempts === 1 ? 'chute' : 'chutes'}.`
                : `${attempts} ${attempts === 1 ? 'chute' : 'chutes'} · o mesmo segredo para todo mundo hoje.`}
          </p>
        </div>

        {solved ? (
          <>
            <div className="banner you">🎉 Você descobriu {schema.secretLabel} de hoje! Volte amanhã para o próximo.</div>
            <Reveal universe={schema} secret={progress.secret} />
          </>
        ) : (
          <GuessBar
            items={items}
            guessedIds={progress.rows.map(row => row.id)}
            groups={info?.group ? [info.group] : []}
            inScope={inScope}
            active={Boolean(info) && !sending}
            focusKey={universe}
            onSubmit={submit}
          />
        )}

        <HintsTable universe={schema} rows={progress.rows} />
      </main>
    </>
  );
}
