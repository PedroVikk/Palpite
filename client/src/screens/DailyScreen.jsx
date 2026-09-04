import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_UNIVERSE, UNIVERSES, getUniverse, scopeFilter, scopeTipLabel } from '@shared/universes.js';
import { useDataset } from '../hooks/useDataset.js';
import { loadDaily, pruneDaily, saveDaily } from '../lib/storage.js';
import Ambient from '../components/Ambient.jsx';
import UniverseSelect from '../components/UniverseSelect.jsx';
import GuessBar from '../components/GuessBar.jsx';
import HintsTable from '../components/HintsTable.jsx';
import Reveal from '../components/Reveal.jsx';
import { CheckIcon, ClockIcon, ExitIcon, TargetIcon } from '../components/Icon.jsx';

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
 * O dia tem recorte (uma epoca, uma categoria) e ele fica a vista, ao lado do
 * universo: saber que hoje o segredo vai ate Shippūden muda o que a pessoa
 * chuta desde o primeiro palpite. So o recorte aparece — quem esta dentro dele
 * continua sendo assunto da busca do chute.
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

  // o recorte de hoje em duas etiquetas: a faixa de epocas pela ponta, a
  // categoria pelo nome. Universo sem recorte no schema nao mostra nenhuma
  const epoca = useMemo(
    () => (info?.scope ? scopeTipLabel(schema, info.scope) : null),
    [schema, info?.scope],
  );
  const categoria = useMemo(
    () => (info?.group ? schema.groups?.find(g => g.id === info.group)?.label ?? null : null),
    [schema, info?.group],
  );

  return (
    <>
      <Ambient />

      <header className="topbar">
        <div className="inner">
          <button type="button" className="wordmark" onClick={onExit}>
            <span className="glyph">?</span>Palpite
          </button>
          <span className="pill"><ClockIcon width={14} height={14} />Desafio diário</span>
          {info && <span className="pill code">{prettyDate(info.date)}</span>}
          <span className="spacer" />
          <button className="btn link" onClick={onExit}>
            <ExitIcon width={15} height={15} /> Sair
          </button>
        </div>
      </header>

      <main className="page">
        <section className={`turn-banner ${solved ? 'you' : ''}`}>
          <span className="badge">
            {solved ? <CheckIcon width={22} height={22} /> : <TargetIcon width={22} height={22} />}
          </span>
          <div>
            <h1>{solved ? 'Você descobriu!' : 'Desafio de hoje'}</h1>
            <p>
              {!info
                ? 'Carregando...'
                : solved
                  ? `Acertou em ${attempts} ${attempts === 1 ? 'chute' : 'chutes'}. Volte amanhã para o próximo.`
                  : 'Um segredo por universo, o mesmo para todo mundo. Chutes ilimitados.'}
            </p>
          </div>
          <div className="clock" style={{ minWidth: 120 }}>
            <div className="k">Chutes</div>
            <div className="v">{attempts}</div>
          </div>
        </section>

        {/* trocar de universo aqui é trocar de desafio: cada um tem o seu */}
        <section className="progress-bar">
          <span className="txt">Universo do dia</span>
          <div style={{ width: 296, maxWidth: '100%' }}>
            <UniverseSelect value={universe} onChange={setUniverse} />
          </div>
          <span className="spacer" />
          {epoca && <span className="pill"><ClockIcon width={14} height={14} />{epoca}</span>}
          {categoria && <span className="pill"><TargetIcon width={14} height={14} />{categoria}</span>}
          <span className="left">
            {info ? <><b>{info.poolSize}</b> nomes possíveis hoje</> : ' '}
          </span>
        </section>

        {solved ? (
          <Reveal universe={schema} secret={progress.secret} />
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
