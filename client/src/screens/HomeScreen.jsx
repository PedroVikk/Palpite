import { useMemo, useState } from 'react';
import { UNIVERSES, getUniverse } from '@shared/universes.js';
import { dailySnapshot, lastDaily, streak } from '../lib/storage.js';
import { universeMeta } from '../lib/universeMeta.js';
import Ambient from '../components/Ambient.jsx';
import Avatar from '../components/Avatar.jsx';
import UniverseSelect from '../components/UniverseSelect.jsx';
import CreateRoomModal from '../components/CreateRoomModal.jsx';
import {
  CheckIcon, ChartIcon, ClockIcon, EnterIcon, ExitIcon, FlameIcon,
  GoogleIcon, PlusIcon, SendIcon, TargetIcon,
} from '../components/Icon.jsx';

const TOTAL_UNIVERSES = Object.keys(UNIVERSES).length;

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

export default function HomeScreen({
  name, onName, onCreate, onJoin, onDaily, toast, resume, onResume, onForgetResume, profile,
}) {
  // convite chega como ?sala=XXXX: o código já vem preenchido
  const [code, setCode] = useState(() =>
    (new URLSearchParams(location.search).get('sala') ?? '').toUpperCase());
  const [dailyUniverse, setDailyUniverse] = useState('pokemon');
  const [creating, setCreating] = useState(false);

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
    return { rows, secret, last, cells };
  }, [dailyUniverse]);

  // a marca-d'água segue o universo escolhido: o card do dia e o atalho do
  // desafio mostram a cara de quem está em jogo, não a pokébola de sempre
  const dailyMark = universeMeta(dailyUniverse).mark;

  const submitCode = (event) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length !== 4) return toast('O código tem 4 caracteres.');
    onJoin(clean);
  };

  return (
    <>
      <Ambient extraGlow />

      <header className="topbar">
        <div className="inner">
          <span className="wordmark"><span className="glyph">?</span>Palpite</span>
          <span className="pill"><ClockIcon width={14} height={14} />{today()}</span>
          <span className="spacer" />

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
            <div className="codebox">
              <div className="k">Sua sala</div>
              <div className="v">{resume.code}</div>
            </div>
            <div>
              <h3>Você estava jogando</h3>
              <div className="meta">
                <Avatar name={resume.name} size="sm" />
                <span>
                  A vaga de <b style={{ color: 'var(--text-dim)' }}>{resume.name}</b> fica guardada por
                  alguns minutos: volte e o placar continua de onde parou.
                </span>
              </div>
            </div>
            <div className="actions">
              <button className="btn ghost" onClick={onForgetResume}>Agora não</button>
              <button className="btn primary" onClick={onResume}>Voltar para a partida</button>
            </div>
          </section>
        )}

        <section className="hero">
          <div>
            <span className="eyebrow"><ClockIcon width={13} height={13} strokeWidth={2.4} />Todo dia · troca à meia-noite</span>
            <h1>Desafio diário</h1>
            <p className="lead">Um segredo por universo. O mesmo para todo mundo, até a virada do dia.</p>

            <div className="hero-stats">
              {/* a sequência vem primeiro: é o número que faz voltar amanhã */}
              <div className="stat streak">
                <div className="k"><FlameIcon width={12} height={12} strokeWidth={2.2} />Sequência</div>
                <div className="v">{dias.current} <small>{streakNote(dias)}</small></div>
              </div>
              <div className="stat">
                <div className="k"><CheckIcon width={12} height={12} strokeWidth={2.2} />Resolvidos hoje</div>
                <div className="v">{day.solved} <small>de {TOTAL_UNIVERSES} universos</small></div>
              </div>
              <div className="stat">
                <div className="k"><ChartIcon width={12} height={12} strokeWidth={2.2} />Chutes hoje</div>
                <div className="v">{day.guesses}</div>
              </div>
            </div>

            <div className="hero-actions">
              <UniverseSelect value={dailyUniverse} onChange={setDailyUniverse} />
              <button className="btn primary lg" onClick={() => onDaily(dailyUniverse)}>
                Jogar agora <SendIcon width={16} height={16} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {/* onde a pilha de hoje parou, neste universo */}
          <aside className="mystery">
            <div className="cap">
              <span className="tag coral">{UNIVERSES[dailyUniverse].label} · hoje</span>
              <span className={`tag ${stack.secret ? 'green' : 'ghost'}`}>
                {stack.secret
                  ? 'resolvido'
                  : stack.rows.length
                    ? `${stack.rows.length} ${stack.rows.length === 1 ? 'chute' : 'chutes'}`
                    : 'sem chutes'}
              </span>
            </div>

            <div className="silhouette">
              {stack.secret?.sprite ? (
                <img className="face" src={stack.secret.sprite} alt={stack.secret.name} />
              ) : (
                <>
                  <img className="art" src={dailyMark} alt="" aria-hidden />
                  <span className="qm">?</span>
                  <div className="scan" />
                </>
              )}
            </div>

            <div className="mini-row">
              {stack.cells.map(cell => (
                <div key={cell.key} className={`mini ${cell.tone}`} title={cell.label}>{cell.label}</div>
              ))}
            </div>

            <div className="foot">
              {stack.secret ? (
                <>
                  <span>Era <b style={{ color: 'var(--text-dim)' }}>{stack.secret.name}</b></span>
                  <span>em {stack.rows.length} {stack.rows.length === 1 ? 'chute' : 'chutes'}</span>
                </>
              ) : stack.last ? (
                <>
                  <span>Último: <b style={{ color: 'var(--text-dim)' }}>{stack.last.name}</b></span>
                  <span>continue de onde parou</span>
                </>
              ) : (
                <>
                  <span>Chutes ilimitados</span>
                  <span>Sem sala, sem turno</span>
                </>
              )}
            </div>
          </aside>
        </section>

        <div className="section-head">
          <h2>Como você quer jogar</h2>
          <span className="spacer" />
          <span className="hint">Salas aceitam de 2 a 8 jogadores</span>
        </div>

        <div className="modes-grid">
          <button className="mode-card accent" onClick={() => onDaily(dailyUniverse)}>
            <img className="corner" src={dailyMark} alt="" aria-hidden />
            <span className="ico"><TargetIcon width={19} height={19} /></span>
            <h3>Desafio diário</h3>
            <p>Um segredo por universo, igual para todo mundo. Jogue sozinho e compare o resultado.</p>
            <div className="foot">
              <span className="tag green">{day.solved}/{TOTAL_UNIVERSES} hoje</span>
              <SendIcon className="go" width={18} height={18} />
            </div>
          </button>

          <button className="mode-card violet" onClick={() => setCreating(true)}>
            <span className="ico"><PlusIcon width={19} height={19} /></span>
            <h3>Criar sala</h3>
            <p>Escolha o universo, as regras e o tempo por turno. Você vira o host e convida por link.</p>
            <div className="foot">
              <span className="tag purple">Você é o host</span>
              <SendIcon className="go" width={18} height={18} />
            </div>
          </button>

          <div className="mode-card">
            <span className="ico"><EnterIcon width={19} height={19} /></span>
            <h3>Entrar em uma sala</h3>
            <p>Tem um código de 4 letras? Cole aqui e caia direto na partida dos seus amigos.</p>
            <div className="foot" style={{ display: 'block' }}>
              <form className="code-join" onSubmit={submitCode}>
                <label className="text-field">
                  <input
                    className="code-input"
                    value={code}
                    maxLength={4}
                    placeholder="CÓDIGO"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Código da sala"
                    onChange={e => setCode(e.target.value.toUpperCase())}
                  />
                </label>
                <button className="btn secondary" type="submit">Entrar</button>
              </form>
            </div>
          </div>
        </div>

        <div className="section-head">
          <h2>Como jogar</h2>
          <span className="spacer" />
          <span className="hint">Leva um minuto para pegar</span>
        </div>

        <div className="steps">
          <div className="step-card">
            <div className="n">1</div>
            <h4>Crie ou entre em uma sala</h4>
            <p>Escolha o universo e as regras, ou entre com o código de 4 letras de um amigo.</p>
          </div>
          <div className="step-card">
            <div className="n">2</div>
            <h4>Descubra o segredo</h4>
            <p>A cada rodada há um segredo escondido — todo mundo tenta adivinhar quem é.</p>
          </div>
          <div className="step-card">
            <div className="n">3</div>
            <h4>Dê seus chutes</h4>
            <p>Cada chute pinta a tabela: verde acertou, amarelo chegou perto, vermelho errou.</p>
          </div>
          <div className="step-card">
            <div className="n">4</div>
            <h4>Acerte antes dos seus amigos</h4>
            <p>Quem acerta primeiro leva mais pontos. No fim das rodadas, sai o ranking.</p>
          </div>
        </div>
      </main>

      {creating && (
        <CreateRoomModal
          name={name}
          onName={onName}
          onClose={() => setCreating(false)}
          onCreate={(settings) => { setCreating(false); onCreate(settings); }}
        />
      )}
    </>
  );
}
