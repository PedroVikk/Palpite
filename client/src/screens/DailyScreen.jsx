import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_UNIVERSE, UNIVERSES, getUniverse, scopeFilter, scopeTipLabel } from '@shared/universes.js';
import { useDataset } from '../hooks/useDataset.js';
import { gameToday, loadDaily, markSolvedToday, pruneDaily, saveDaily } from '../lib/storage.js';
import { hasPicture } from '../lib/picture.js';
import Ambient from '../components/Ambient.jsx';
import UniverseSelect from '../components/UniverseSelect.jsx';
import GuessBar from '../components/GuessBar.jsx';
import HintsTable from '../components/HintsTable.jsx';
import SecretImage from '../components/SecretImage.jsx';
import Reveal from '../components/Reveal.jsx';
import { CheckIcon, ClockIcon, ExitIcon, ImageIcon, TargetIcon } from '../components/Icon.jsx';

/** "2026-08-27" -> "27/08". Sem Date, que reinterpretaria no fuso local. */
const prettyDate = (iso) => {
  const [, month, day] = String(iso ?? '').split('-');
  return month ? `${day}/${month}` : '';
};

const params = () => new URLSearchParams(location.search);
const startingUniverse = () => {
  const asked = params().get('diario');
  return UNIVERSES[asked] ? asked : DEFAULT_UNIVERSE;
};
const startingMode = () => (params().get('modo') === 'imagem' ? 'imagem' : 'dicas');

const EMPTY = { rows: [], secret: null, ticket: null };

/**
 * Desafio do dia: sem sala, sem turno, chutes ilimitados. O segredo e o mesmo
 * para todo mundo e o servidor nao guarda nada — o progresso vive no
 * localStorage deste navegador, e a data na chave faz virar o dia sozinho.
 *
 * Sao dois desafios por universo, e nao dois jeitos de olhar o mesmo. Nas
 * `dicas` o segredo se revela por comparacao, coluna a coluna; na `imagem` ele
 * aparece de verdade, so que reduzido a um punhado de pixels que vai crescendo
 * a cada erro. Os segredos sao diferentes de proposito (ver src/daily.js):
 * resolver um nao estraga o outro, entao da para jogar os dois no mesmo dia.
 *
 * O dia tem recorte (uma epoca, uma categoria) e ele fica a vista, ao lado do
 * universo: saber que hoje o segredo vai ate Shippūden muda o que a pessoa
 * chuta desde o primeiro palpite. So o recorte aparece — quem esta dentro dele
 * continua sendo assunto da busca do chute.
 */
export default function DailyScreen({ toast, onExit }) {
  const [universe, setUniverse] = useState(startingUniverse);
  const [mode, setMode] = useState(startingMode);
  const [info, setInfo] = useState(null);      // { date, poolSize, scope, group, hasPicture, picture? }
  const [progress, setProgress] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [round, setRound] = useState(0);             // sobe na virada do dia, para recarregar

  const schema = getUniverse(universe);
  const items = useDataset(universe) ?? [];
  const solved = Boolean(progress.secret);
  const picture = mode === 'imagem';

  useEffect(() => {
    let alive = true;
    setInfo(null);
    setProgress(EMPTY);
    history.replaceState(null, '', `?diario=${universe}${picture ? '&modo=imagem' : ''}`);

    /**
     * O bilhete do degrau da imagem vai junto do pedido, senao a primeira tela
     * depois de um F5 viria com a figura de volta ao pe da escada. A data sai
     * do relogio daqui so para achar a chave certa no storage: quem decide o
     * dia e o servidor, e bilhete de ontem simplesmente nao confere.
     */
    const saved = loadDaily(gameToday(), universe, mode);
    const ticket = picture && saved.ticket ? `&t=${encodeURIComponent(saved.ticket)}` : '';

    fetch(`/api/daily/${universe}?modo=${mode}${ticket}`)
      .then(async (res) => {
        /**
         * Universo sem desafio de imagem hoje (os Carros nao tem miniatura
         * nenhuma). O modo so fica apagado depois que um dia carrega, entao
         * da para chegar aqui por link direto ou trocando de universo com a
         * aba da imagem aberta — e ai a tela cai na tabela, em vez de ficar
         * carregando para sempre um desafio que nao existe.
         */
        if (res.status === 503 && picture) {
          if (alive) {
            setMode('dicas');
            toast(`${schema.label} não tem desafio de imagem hoje.`);
          }
          return null;
        }
        if (!res.ok) throw new Error('falhou');
        return res.json();
      })
      .then(data => {
        if (!alive || !data) return;
        pruneDaily(data.date);
        setInfo(data);
        setProgress(loadDaily(data.date, universe, mode));
      })
      .catch(() => {
        if (!alive) return;
        toast(picture
          ? 'Não consegui carregar o desafio de imagem de hoje.'
          : 'Não consegui carregar o desafio de hoje.');
      });

    return () => { alive = false; };
  }, [universe, mode, picture, round, schema.label, toast]);

  const submit = useCallback(async (chosen) => {
    if (!chosen) return toast('Escolha um nome da lista.');
    if (!info || solved || sending) return;

    setSending(true);
    try {
      const ticket = progress.ticket ? `&t=${encodeURIComponent(progress.ticket)}` : '';
      const res = await fetch(`/api/daily/${universe}/guess/${chosen.id}?modo=${mode}${ticket}`);
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

      const next = {
        rows: [...progress.rows, data.row],
        secret: data.secret ?? null,
        ticket: data.picture?.ticket ?? progress.ticket,
      };
      setProgress(next);
      saveDaily(data.date, universe, next, mode);
      // o quadro novo chega junto da dica: o degrau ganho e o troco do chute
      if (data.picture) setInfo(prev => (prev ? { ...prev, picture: data.picture } : prev));
      // primeiro acerto do dia e o que segura a sequencia; do segundo em
      // diante a propria funcao ignora, entao nao ha o que checar aqui
      if (next.secret) markSolvedToday(data.date);
    } catch {
      toast('Não consegui enviar o chute.');
    } finally {
      setSending(false);
    }
  }, [info, solved, sending, universe, mode, progress.rows, progress.ticket, toast]);

  const attempts = progress.rows.length;

  /**
   * A trava do dia: fora do recorte o nome nem aparece na busca.
   *
   * No modo imagem a miniatura faz parte do recorte — quem não tem figura não
   * pode ser o segredo, e o servidor recusa o chute. Sem somar isso aqui, a
   * busca ofereceria nomes que voltam com erro, gastando a digitação de quem
   * confiou na lista.
   */
  const inScope = useMemo(() => {
    const noRecorte = scopeFilter(schema, info?.scope ?? null);
    if (!picture) return noRecorte;
    return (item) => noRecorte(item) && hasPicture(item);
  }, [schema, info?.scope, picture]);

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

  /**
   * O modo imagem some onde nao ha imagem. Os carros nao tem miniatura nenhuma
   * espelhada, e um recorte do dia pode deixar outro universo com gente de
   * menos para valer desafio — nos dois casos o botao fica apagado em vez de
   * abrir uma tela quebrada. Enquanto o dia nao carregou, a aba segue
   * clicavel: negar antes de saber esconderia o modo de quem chegou pelo link.
   */
  const semImagem = info ? info.hasPicture === false : false;

  const pickMode = (next) => {
    if (next === mode) return;
    if (next === 'imagem' && semImagem) {
      return toast(`${schema.label} não tem desafio de imagem hoje.`);
    }
    setMode(next);
  };

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
            {solved
              ? <CheckIcon width={22} height={22} />
              : picture ? <ImageIcon width={22} height={22} /> : <TargetIcon width={22} height={22} />}
          </span>
          <div>
            <h1>{solved ? 'Você descobriu!' : picture ? 'Quem está na imagem?' : 'Desafio de hoje'}</h1>
            <p>
              {!info
                ? 'Carregando...'
                : solved
                  ? `Acertou em ${attempts} ${attempts === 1 ? 'chute' : 'chutes'}. Volte amanhã para o próximo.`
                  : picture
                    ? 'A figura começa irreconhecível e ganha nitidez a cada erro. Sem tabela de dicas.'
                    : 'Um segredo por tema, o mesmo para todo mundo. Chutes ilimitados.'}
            </p>
          </div>
          <div className="clock" style={{ minWidth: 120 }}>
            <div className="k">Chutes</div>
            <div className="v">{attempts}</div>
          </div>
        </section>

        {/* dois desafios por universo, com segredos diferentes: trocar de aba
            aqui é trocar de jogo, não de jeito de olhar o mesmo */}
        <div className="field" style={{ marginTop: 2 }}>
          <div className="mode-pick">
            <button type="button" className={!picture ? 'on' : ''} onClick={() => pickMode('dicas')}>
              <span className="ico"><TargetIcon width={17} height={17} /></span>
              <span>
                <b>Dicas</b>
                <small>A tabela pinta a cada chute: verde, amarelo, vermelho.</small>
              </span>
            </button>
            <button
              type="button"
              className={picture ? 'on' : ''}
              disabled={semImagem}
              onClick={() => pickMode('imagem')}
            >
              <span className="ico"><ImageIcon width={17} height={17} /></span>
              <span>
                <b>Imagem</b>
                <small>
                  {semImagem
                    ? `${schema.label} não tem imagem para jogar hoje.`
                    : 'A figura do segredo, clareando a cada erro.'}
                </small>
              </span>
            </button>
          </div>
        </div>

        {/* trocar de universo aqui é trocar de desafio: cada um tem o seu */}
        <section className="progress-bar">
          <span className="txt">Tema do dia</span>
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
          <>
            {picture && info?.picture && (
              <SecretImage
                universe={universe}
                picture={info.picture}
                caption={`Um nome de ${schema.label}, atrás de poucos pixels. Errar não custa nada — só revela mais um pedaço.`}
              />
            )}
            <GuessBar
              items={items}
              guessedIds={progress.rows.map(row => row.id)}
              groups={info?.group ? [info.group] : []}
              inScope={inScope}
              active={Boolean(info) && !sending}
              focusKey={`${universe}:${mode}`}
              onSubmit={submit}
            />
          </>
        )}

        <HintsTable universe={schema} rows={progress.rows} hints={!picture} />
      </main>
    </>
  );
}
