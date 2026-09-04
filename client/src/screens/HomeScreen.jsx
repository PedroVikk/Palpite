import { useMemo, useState } from 'react';
import { UNIVERSES } from '@shared/universes.js';
import { dailySnapshot } from '../lib/storage.js';
import { universeMeta } from '../lib/universeMeta.js';
import Ambient from '../components/Ambient.jsx';
import Avatar from '../components/Avatar.jsx';
import UniverseSelect from '../components/UniverseSelect.jsx';
import CreateRoomModal from '../components/CreateRoomModal.jsx';
import {
  BallMark, CheckIcon, ChartIcon, ClockIcon, EnterIcon, PlusIcon,
  SendIcon, TargetIcon,
} from '../components/Icon.jsx';

const TOTAL_UNIVERSES = Object.keys(UNIVERSES).length;

/** "quarta, 3 de setembro", com a primeira letra em maiúscula. */
const today = () => {
  const text = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export default function HomeScreen({
  name, onName, onCreate, onJoin, onDaily, toast, resume, onResume, onForgetResume,
}) {
  // convite chega como ?sala=XXXX: o código já vem preenchido
  const [code, setCode] = useState(() =>
    (new URLSearchParams(location.search).get('sala') ?? '').toUpperCase());
  const [dailyUniverse, setDailyUniverse] = useState('pokemon');
  const [creating, setCreating] = useState(false);

  // o diário mora no localStorage e o prune deixa só o dia de hoje lá: o que
  // sobrou é o placar de hoje, sem precisar perguntar nada ao servidor
  const day = useMemo(() => dailySnapshot(), []);

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
          {/* a identidade é um campo, não um perfil de mentira: é o nome que
              os outros vão ver, e dá para trocar a qualquer momento */}
          <label className="text-field" style={{ height: 40, maxWidth: 210 }}>
            <Avatar name={name || 'Treinador'} size="sm" />
            <input
              value={name}
              maxLength={16}
              placeholder="Treinador"
              autoComplete="nickname"
              aria-label="Seu nome"
              onChange={e => onName(e.target.value)}
            />
          </label>
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
              <div className="stat">
                <div className="k"><CheckIcon width={12} height={12} strokeWidth={2.2} />Resolvidos hoje</div>
                <div className="v">{day.solved} <small>de {TOTAL_UNIVERSES} universos</small></div>
              </div>
              <div className="stat">
                <div className="k"><TargetIcon width={12} height={12} strokeWidth={2.2} />Começados</div>
                <div className="v">{day.started} <small>{day.started === 1 ? 'universo' : 'universos'}</small></div>
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

          {/* o que se joga, em miniatura: silhueta e as cores da tabela */}
          <aside className="mystery">
            <div className="cap">
              <span className="tag coral">{UNIVERSES[dailyUniverse].label} · hoje</span>
              <span className="tag ghost">{day.solved > 0 ? `${day.solved} resolvidos` : 'sem chutes'}</span>
            </div>
            <div className="silhouette">
              <BallMark className="art" />
              <span className="qm">?</span>
              <div className="scan" />
            </div>
            <div className="mini-row">
              <div className="mini miss">Errou</div>
              <div className="mini part">Perto</div>
              <div className="mini hit">Acertou</div>
              <div className="mini miss">Errou</div>
              <div className="mini miss">Errou</div>
            </div>
            <div className="foot">
              <span>Chutes ilimitados</span>
              <span>Sem sala, sem turno</span>
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
            <BallMark className="corner" />
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
