import { useMemo, useRef, useState } from 'react';
import { UNIVERSES, getUniverse } from '@shared/universes.js';
import { byUse, dailySnapshot, lastDaily, mostPlayed, streak } from '../lib/storage.js';
import { openThemePicker } from '../lib/theme.js';
import Ambient from '../components/Ambient.jsx';
import Avatar from '../components/Avatar.jsx';
import MarkArt from '../components/MarkArt.jsx';
import {
  BackIcon, CheckIcon, ChartIcon, ClockIcon, EnterIcon, ExitIcon, FlameIcon,
  GoogleIcon, LinkIcon, PaletteIcon, PlusIcon, TargetIcon, TermoIcon, UsersIcon,
} from '../components/Icon.jsx';

const TOTAL_UNIVERSES = Object.keys(UNIVERSES).length;
const IDS = Object.keys(UNIVERSES);

/**
 * A linha embaixo do número da sequência. Zerada, ela fala do recorde ou
 * convida a começar; de pé, avisa se o dia de hoje ainda está em aberto —
 * que é justamente quando o aviso serve para alguma coisa.
 */
function streakNote({ current, best, solvedToday }) {
  if (!current) return best ? `recorde: ${best} ${best === 1 ? 'dia' : 'dias'}` : 'comece hoje';
  const dias = current === 1 ? 'dia' : 'dias';
  return solvedToday ? `${dias} seguidos` : `${dias} · não perca hoje`;
}

/** "quarta, 3 de setembro", com a primeira letra em maiúscula. */
const today = () => {
  const text = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Onde cada universo parou hoje no modo escolhido no cartão: resolvido, com
 * chutes, ou intocado. É o selo da grade de temas. No Segredo contam os dois
 * desafios dele (a tabela e a imagem); no Termo, só o tabuleiro de letras.
 */
function dayOf(id, game) {
  const runs = game === 'termo'
    ? [lastDaily(id, 'termo')]
    : [lastDaily(id), lastDaily(id, 'imagem')];
  const solved = runs.some(run => run.secret);
  const guesses = runs.reduce((sum, run) => sum + run.rows.length, 0);
  return { solved, guesses, started: solved || guesses > 0 };
}

const FILTERS = [
  ['todos', 'Todos'],
  ['andamento', 'Em andamento'],
  ['resolvidos', 'Resolvidos'],
];

export default function HomeScreen({
  name, onName, onNewRoom, onJoin, onDaily, toast, resume, onResume, onForgetResume, profile,
}) {
  // convite chega como ?sala=XXXX: o código já vem preenchido
  const [code, setCode] = useState(() =>
    (new URLSearchParams(location.search).get('sala') ?? '').toUpperCase().slice(0, 4));
  const [codeFocus, setCodeFocus] = useState(false);
  // abre no tema que a pessoa mais joga no diario; quem nunca jogou, no Pokemon
  const [dailyUniverse, setDailyUniverse] = useState(() => mostPlayed(IDS) ?? 'pokemon');
  // o modo do diario no cartao: o Segredo de sempre ou o Termo. Abre no Segredo
  const [dailyGame, setDailyGame] = useState('segredo');
  const termo = dailyGame === 'termo';
  const hubRef = useRef(null);
  const scrollTimer = useRef(null);
  const [filter, setFilter] = useState('todos');

  // o diário mora no localStorage e o prune deixa só o dia de hoje lá: o que
  // sobrou é o placar de hoje, sem precisar perguntar nada ao servidor
  const localDay = useMemo(() => dailySnapshot(), []);
  const localStreak = useMemo(() => streak(), []);

  /**
   * Logado, a sequência e o placar do dia vêm da conta — é o que faz eles
   * atravessarem o navegador. Sem conta, seguem saindo do localStorage, que é
   * como o jogo sempre funcionou e continua funcionando.
   */
  const signedIn = Boolean(profile?.user);
  const day = (signedIn && profile.today) || localDay;
  const dias = (signedIn && profile.streak) || localStreak;

  /**
   * A miniatura não é ilustração: ela mostra onde a pilha daquele universo
   * parou hoje. O último chute pinta as cinco primeiras colunas; resolvido
   * fica tudo verde, e quem ainda não jogou vê cinco casas vazias — que é
   * diferente de ter errado tudo.
   */
  const stack = useMemo(() => {
    const schema = getUniverse(dailyUniverse);
    /**
     * No Termo a miniatura e a ultima linha do tabuleiro, letra e cor. Sem
     * chute ainda, cinco casas vazias; resolvido, a palavra inteira em verde.
     */
    if (termo) {
      const { rows, secret, answer } = lastDaily(dailyUniverse, 'termo');
      const last = rows[rows.length - 1] ?? null;
      const tone = { hit: 'hit', near: 'part', miss: 'miss' };
      const cells = last?.word
        ? [...last.word].map((letter, i) => ({ key: i, label: letter, tone: tone[last.marks?.[i]] ?? 'none' }))
        : Array.from({ length: 5 }, (_, i) => ({ key: i, label: '', tone: 'none' }));
      return { rows, secret, answer, last, cells, hits: 0 };
    }
    const { rows, secret } = lastDaily(dailyUniverse);
    const last = rows[rows.length - 1] ?? null;
    const cells = schema.columns.slice(0, 5).map(column => {
      if (secret) return { key: column.key, label: column.label, tone: 'hit' };
      if (!last) return { key: column.key, label: column.label, tone: 'none' };
      const status = last.cells?.[column.key]?.status ?? 'unknown';
      const tone = status === 'hit' ? 'hit'
        : (status === 'partial' || status === 'close') ? 'part'
          : status === 'unknown' ? 'none' : 'miss';
      return { key: column.key, label: column.label, tone };
    });
    const hits = cells.filter(c => c.tone === 'hit').length;
    return { rows, secret, answer: null, last, cells, hits };
  }, [dailyUniverse, termo]);

  // a grade de temas, na ordem de quem mais joga, com o selo de hoje em cada
  // um — do modo escolhido no cartão, Segredo ou Termo
  const tiles = useMemo(
    () => byUse(IDS).map(id => ({ id, label: UNIVERSES[id].label, ...dayOf(id, dailyGame) })),
    [dailyGame],
  );
  const counts = useMemo(() => ({
    todos: tiles.length,
    andamento: tiles.filter(t => t.started && !t.solved).length,
    resolvidos: tiles.filter(t => t.solved).length,
  }), [tiles]);
  const shown = tiles.filter(t => (filter === 'andamento' ? t.started && !t.solved
    : filter === 'resolvidos' ? t.solved : true));

  // o fundo leva o tema escolhido e mais os que a pessoa mais joga
  const ambientMarks = useMemo(
    () => [dailyUniverse, ...tiles.map(t => t.id).filter(id => id !== dailyUniverse)].slice(0, 5),
    [dailyUniverse, tiles],
  );

  const submitCode = (event) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length !== 4) return toast('O código tem 4 caracteres.');
    onJoin(clean);
  };

  /**
   * Um clique na grade só troca o tema do cartão do diário (a marca, o nome, a
   * pilha de hoje) e traz o cartão para a vista se ele tiver saído dela; jogar
   * é o botão do cartão. Dois cliques entram direto — o primeiro clique do par
   * já escolheu o tema, então o segundo só precisa abrir.
   *
   * A rolagem espera passar a janela do duplo clique: se a página andasse já no
   * primeiro, o segundo cairia em outro lugar e o duplo clique se perderia.
   */
  const pickTheme = (id) => {
    setDailyUniverse(id);
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const box = hubRef.current?.getBoundingClientRect();
      if (box && box.bottom < 120) hubRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  };
  const dailyMode = termo ? 'termo' : 'dicas';
  const playTheme = (id) => {
    clearTimeout(scrollTimer.current);
    onDaily(id, dailyMode);
  };

  // Termo perdido: as linhas acabaram, o nome veio, mas o dia nao conta
  const termoLost = termo && !stack.secret && Boolean(stack.answer);
  const reveal = stack.secret ?? stack.answer;
  const revealName = reveal?.label ?? reveal?.name;

  const label = UNIVERSES[dailyUniverse].label;

  return (
    <>
      <Ambient marks={ambientMarks} />

      <header className="topbar">
        <div className="inner">
          <span className="wordmark"><span className="glyph">?</span>Palpite</span>
          <span className="pill"><ClockIcon width={14} height={14} />{today()}</span>
          <span className="spacer" />

          <button type="button" className="btn link" onClick={openThemePicker} title="Trocar o visual do jogo">
            <PaletteIcon width={16} height={16} /> Visual
          </button>

          {/* o apelido é o nome da partida — continua editável mesmo logado,
              porque a conta identifica, não rebatiza */}
          <label className="text-field" style={{ height: 40, maxWidth: 210 }}>
            {signedIn && profile.user.avatar
              ? <img className="avatar sm" src={profile.user.avatar} alt="" referrerPolicy="no-referrer" />
              : <Avatar name={name || 'Treinador'} size="sm" />}
            <input
              value={name}
              maxLength={16}
              placeholder="Treinador"
              autoComplete="nickname"
              aria-label="Seu nome"
              onChange={e => onName(e.target.value)}
            />
          </label>

          {/* o botão só existe onde o login existe: sem banco ou sem app
              registrado, o jogo segue de convidado e não promete o que não tem */}
          {profile?.enabled && !signedIn && (
            <a className="btn ghost" href="/auth/google">
              <GoogleIcon /> Entrar com Google
            </a>
          )}
          {signedIn && (
            <button className="btn link" onClick={profile.logout} title={profile.user.email ?? ''}>
              <ExitIcon width={15} height={15} /> Sair
            </button>
          )}
        </div>
      </header>

      <main className="page">
        {/* caiu no meio da partida e a aba perdeu a identidade: um clique
            devolve a cadeira, com placar e chutes de onde parou */}
        {resume && (
          <section className="room-back">
            <span className="ico"><BackIcon width={20} height={20} /></span>
            <p className="txt">
              <b>Você estava numa partida</b> — sala <b className="code">{resume.code}</b>. A vaga
              de <b>{resume.name}</b> fica guardada por alguns minutos.
            </p>
            <div className="actions">
              <button className="btn link" onClick={onForgetResume}>Agora não</button>
              <button className="btn violet" onClick={onResume}>Voltar para a sala</button>
            </div>
          </section>
        )}

        <div className="home-hub" ref={hubRef}>
          {/* sozinho: o desafio do dia, no tema escolhido na grade de baixo */}
          <section className="hub-card" aria-labelledby="hub-daily">
            <div className="hub-head">
              <span className="hub-ico"><ClockIcon width={19} height={19} /></span>
              <div>
                <h2 id="hub-daily">Desafio diário</h2>
                <p>Sozinho, sem sala. Os mesmos segredos para todo mundo.</p>
              </div>
              <span className="renew">troca à <b>meia-noite</b></span>
            </div>

            {/* o modo do diario: cada tema tem um desafio de cada, com segredos
                diferentes — trocar aqui troca o cartao e o que o Jogar abre */}
            <div className="seg" role="group" aria-label="Modo do diário">
              <button type="button" className={!termo ? 'on' : ''} aria-pressed={!termo} onClick={() => setDailyGame('segredo')}>
                <TargetIcon width={15} height={15} /> Segredo
              </button>
              <button type="button" className={termo ? 'on' : ''} aria-pressed={termo} onClick={() => setDailyGame('termo')}>
                <TermoIcon width={15} height={15} /> Termo
              </button>
            </div>

            <div className="daily-body">
              <div className="silhouette">
                {reveal?.sprite ? (
                  <img className="face" src={reveal.sprite} alt={revealName} />
                ) : (
                  <>
                    <MarkArt universe={dailyUniverse} />
                    <span className="qm">?</span>
                  </>
                )}
              </div>

              <div className="daily-info">
                <div className="daily-name">
                  <MarkArt universe={dailyUniverse} />
                  <b>{label}</b>
                  <span className={`tag ${stack.secret ? 'green' : stack.rows.length ? 'amber' : 'ghost'}`}>
                    {stack.secret
                      ? 'resolvido'
                      : termoLost
                        ? 'não foi hoje'
                      : stack.rows.length
                        ? termo
                          ? `${stack.rows.length} ${stack.rows.length === 1 ? 'linha' : 'linhas'}`
                          : `${stack.rows.length} ${stack.rows.length === 1 ? 'chute' : 'chutes'}`
                        : 'sem chutes'}
                  </span>
                </div>

                <p className="daily-last">
                  {stack.secret ? (
                    <>Era <b>{revealName}</b>, em {stack.rows.length} {termo ? (stack.rows.length === 1 ? 'linha' : 'linhas') : (stack.rows.length === 1 ? 'chute' : 'chutes')}.</>
                  ) : termoLost ? (
                    <>Era <b>{revealName}</b>. As linhas acabaram — amanhã tem outra.</>
                  ) : termo ? (
                    <>Uma palavra do tema — um nome ou algo do universo —, letra por letra. A categoria fica à vista; quanto menor ela, menos linhas.</>
                  ) : stack.last ? (
                    <>Último chute: <b>{stack.last.name}</b> — {stack.hits} de {stack.cells.length} colunas certas.</>
                  ) : (
                    <>Chutes ilimitados. Para trocar de tema, clique nele na grade abaixo.</>
                  )}
                </p>

                <div className="mini-row">
                  {stack.cells.map(cell => (
                    <div key={cell.key} className={`mini ${cell.tone}`} title={cell.label}>{cell.label}</div>
                  ))}
                </div>

                <div className="daily-actions">
                  <button className="btn primary" onClick={() => onDaily(dailyUniverse, dailyMode)}>
                    {stack.rows.length && !stack.secret && !termoLost ? 'Continuar' : 'Jogar'}
                    {termo ? ' o Termo' : ''}
                  </button>
                </div>
              </div>
            </div>

            {/* a sequência vem primeiro: é o número que faz voltar amanhã */}
            <div className="day-stats">
              <div className="stat streak">
                <div className="k"><FlameIcon width={12} height={12} strokeWidth={2.2} />Sequência</div>
                <div className="v">{dias.current} <small>{streakNote(dias)}</small></div>
              </div>
              <div className="stat">
                <div className="k"><CheckIcon width={12} height={12} strokeWidth={2.2} />Resolvidos hoje</div>
                <div className="v">{day.solved} <small>de {TOTAL_UNIVERSES} temas</small></div>
              </div>
              <div className="stat">
                <div className="k"><ChartIcon width={12} height={12} strokeWidth={2.2} />Chutes hoje</div>
                <div className="v">{day.guesses}</div>
              </div>
            </div>
          </section>

          {/* com amigos: criar e entrar no mesmo cartão, que é a mesma decisão */}
          <section className="hub-card" aria-labelledby="hub-friends">
            <div className="hub-head">
              <span className="hub-ico sel"><UsersIcon width={19} height={19} /></span>
              <div>
                <h2 id="hub-friends">Com amigos</h2>
                <p>De 2 a 8 jogadores, um chute por vez.</p>
              </div>
            </div>

            <div className="friend-block">
              <b>Criar uma sala</b>
              <p>Você escolhe o tema, as regras e o tempo por turno, e manda o link.</p>
              <button className="btn violet" onClick={onNewRoom}>
                <PlusIcon width={17} height={17} /> Criar sala
              </button>
            </div>

            <div className="divider">ou</div>

            <form className="join" onSubmit={submitCode}>
              <label htmlFor="room-code">Entrar com um código</label>
              <div className="join-row">
                <div className="code-boxes">
                  {[0, 1, 2, 3].map(i => {
                    const at = codeFocus && i === Math.min(code.length, 3);
                    return (
                      <span key={i} className={`${code[i] ? '' : 'empty'} ${at ? 'at' : ''}`.trim()} aria-hidden="true">
                        {code[i] ?? '·'}
                      </span>
                    );
                  })}
                  <input
                    id="room-code"
                    value={code}
                    maxLength={4}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    onFocus={() => setCodeFocus(true)}
                    onBlur={() => setCodeFocus(false)}
                    onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                  />
                </div>
                <button className="btn ghost" type="submit" disabled={code.length !== 4}>
                  <EnterIcon width={16} height={16} /> Entrar
                </button>
              </div>
              <p className="f-help"><LinkIcon width={14} height={14} />Recebeu um convite? O link já abre com o código preenchido.</p>
            </form>
          </section>
        </div>

        <div className="section-head">
          <h2>Temas do diário</h2>
          <span className="hint">um clique mostra no cartão, dois cliques já entram no jogo</span>
          <div className="chips" role="group" aria-label="Filtrar temas">
            {FILTERS.map(([id, text]) => (
              <button
                key={id}
                type="button"
                className={`chip ${filter === id ? 'on' : ''}`}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {text} · {counts[id]}
              </button>
            ))}
          </div>
        </div>

        <div className="theme-grid">
          {shown.map(tile => (
            <button
              key={tile.id}
              type="button"
              className={`theme-tile ${tile.id === dailyUniverse ? 'on' : ''} ${tile.solved ? 'solved' : ''}`}
              aria-pressed={tile.id === dailyUniverse}
              title={`${tile.label} — dois cliques para jogar`}
              onClick={() => pickTheme(tile.id)}
              onDoubleClick={() => playTheme(tile.id)}
            >
              {tile.solved ? (
                <span className="seal ok" title="Resolvido hoje"><CheckIcon width={13} height={13} strokeWidth={3} /></span>
              ) : tile.guesses > 0 && (
                <span className="seal go" title="Em andamento">{tile.guesses}</span>
              )}
              <MarkArt universe={tile.id} />
              {tile.label}
            </button>
          ))}
          {!shown.length && (
            <p className="none">
              {filter === 'resolvidos' ? 'Nenhum tema resolvido hoje ainda.' : 'Nenhum tema em andamento.'}
            </p>
          )}
        </div>

        <ol className="howto" aria-label="Como jogar">
          <li><span className="n">1</span><div><b>Crie ou entre numa sala</b><p>Ou jogue sozinho no diário, sem sala.</p></div></li>
          <li><span className="n">2</span><div><b>Descubra o segredo</b><p>Todo mundo tenta adivinhar o mesmo.</p></div></li>
          <li><span className="n">3</span><div><b>Cada chute pinta a tabela</b><p>Acertou, chegou perto ou errou, coluna por coluna.</p></div></li>
          <li><span className="n">4</span><div><b>Quem acerta antes pontua mais</b><p>No fim das rodadas sai o ranking.</p></div></li>
        </ol>
      </main>
    </>
  );
}
