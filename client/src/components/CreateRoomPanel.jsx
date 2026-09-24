import { useState } from 'react';
import { getUniverse, roomDefaults } from '@shared/universes.js';
import { useDataset } from '../hooks/useDataset.js';
import { canPlayPicture } from '../lib/picture.js';
import { universeMeta } from '../lib/universeMeta.js';
import UniverseSelect from './UniverseSelect.jsx';
import UniverseIcon from './UniverseIcon.jsx';
import Stepper from './Stepper.jsx';
import ModePick from './ModePick.jsx';
import {
  BulbIcon, CalendarIcon, CardIcon, CardsIcon, CheckIcon, ClockIcon, ImageIcon,
  InfoIcon, SearchIcon, SparkIcon, TargetIcon,
} from './Icon.jsx';

/**
 * A sala nasce já configurada. Antes ela nascia com um padrão e o host arrumava
 * tudo depois, com os amigos entrando no meio da arrumação; aqui as regras são
 * escolhidas antes de existir código para compartilhar. Criada, este painel dá
 * lugar ao da sala dentro do mesmo modal — nada de mudar de tela.
 */
export default function CreateRoomPanel({ name, onName, onClose, onCreate }) {
  const [mode, setMode] = useState('hunt');
  const [universeId, setUniverseId] = useState('pokemon');
  // o formulario abre so com a primeira opcao marcada (ver roomDefaults)
  const [groups, setGroups] = useState(() => roomDefaults(getUniverse('pokemon')).groups);
  const [scope, setScope] = useState(() => roomDefaults(getUniverse('pokemon')).scope);
  const [rounds, setRounds] = useState(5);
  const [turnSeconds, setTurnSeconds] = useState(45);
  const [guessesPerPlayer, setGuessesPerPlayer] = useState(6);
  const [untilRight, setUntilRight] = useState(true);
  const [picture, setPicture] = useState(false);
  const [card, setCard] = useState(false);
  const [choices, setChoices] = useState(3);
  const [draftEvery, setDraftEvery] = useState(2);

  const universe = getUniverse(universeId);
  const meta = universeMeta(universeId);
  const duel = mode === 'duel';
  const impostor = mode === 'impostor';
  const battle = mode === 'battle';
  const quiz = mode === 'quiz';
  const cardsMode = mode === 'cards';

  // o interruptor da imagem so existe onde ha figura espelhada: os carros nao
  // tem nenhuma, e universo assim mostra a chave apagada em vez de escondida —
  // some a opcao, ficaria a impressao de que ela nunca existiu
  const comImagem = canPlayPicture(useDataset(universeId));

  const changeUniverse = (id) => {
    const start = roomDefaults(getUniverse(id));
    setUniverseId(id);
    setGroups(start.groups);
    setScope(start.scope);
  };

  const toggleGroup = (id) => {
    // deixar zero grupos marcados sortearia de um saco vazio: o último não sai
    const next = groups.includes(id) ? groups.filter(g => g !== id) : [...groups, id];
    if (next.length) setGroups(next);
  };

  const toggleScope = (id) => {
    const next = scope.includes(id) ? scope.filter(e => e !== id) : [...scope, id];
    if (next.length) setScope(next);
  };

  /**
   * Por onde a sala se recorta aqui. Onde existe época, é ela que aparece: "só
   * até o Soul Society" é a regra que os amigos combinam antes de jogar, e a
   * categoria (raça, vila, facção) quase sempre fica inteira mesmo. Quem quiser
   * as duas linhas continua tendo o lobby, que tem espaço para elas.
   *
   * O recorte `nested` é a exceção: ele não é linha do tempo, é filtro dentro
   * dos grupos ("rock, só as nacionais"), e só faz sentido com os grupos à
   * vista. Aí aparecem as duas linhas, o grupo em cima.
   */
  const groupAxis = {
    label: universe.groupLabel,
    help: 'De onde o segredo pode sair',
    options: universe.groups,
    on: groups,
    toggle: toggleGroup,
  };
  const scopeAxis = universe.scope && {
    label: universe.scope.label,
    help: universe.scope.help ?? 'Até onde a história entra no sorteio',
    options: universe.scope.options,
    on: scope,
    toggle: toggleScope,
  };
  const axes = !universe.scope ? [groupAxis]
    : universe.scope.nested ? [groupAxis, scopeAxis]
    : [scopeAxis];

  const pickMode = (next) => {
    setMode(next);
    // no duelo quem esconde só pontua quando os chutes dos outros acabam
    if (next === 'duel') setUntilRight(false);
    // no impostor o saldo de chutes vira o numero de voltas, e 2 e o padrao
    if (next === 'impostor' && mode !== 'impostor') {
      setUntilRight(false);
      setGuessesPerPlayer(2);
    }
    // "Qual deles?" e rapido: 10 perguntas de 15 s
    if (next === 'quiz' && mode !== 'quiz') {
      setRounds(10);
      setTurnSeconds(15);
    }
  };

  const create = () => onCreate({
    mode,
    universe: universeId,
    groups,
    scope,
    rounds,
    turnSeconds,
    guessesPerPlayer: untilRight && !impostor ? 0 : guessesPerPlayer,
    picture: picture && comImagem && !impostor && !battle && !quiz && !cardsMode,
    card,
    choices,
    draftEvery,
  });

  return (
    <>
      <aside className="modal-side">
        <span className="side-tab on"><SparkIcon width={17} height={17} />Configurações</span>
        <img className="side-art" src={meta.mark} alt="" aria-hidden />
        <div className="side-note">
          <div className="h"><BulbIcon width={14} height={14} />Dica</div>
          <p>
            {impostor
              ? 'No impostor, a mesa vê só quantas colunas cada chute acertou. Funciona melhor com 4 ou mais pessoas e um recorte de 50 a 200 opções.'
              : battle
              ? 'Na batalha naval, os tabuleiros são públicos: dá para aproveitar os tiros dos outros e roubar o afundamento.'
              : quiz
              ? 'No "Qual deles?", as perguntas saem das colunas do tema: qual tem tal tipo, qual é o mais pesado, qual estreou primeiro.'
              : cardsMode
              ? 'No modo cartas, cada um escolhe 1 de 3 cartas a cada poucas rodadas. Quem está em último tira cartas melhores.'
              : picture
              ? 'Pela imagem, a rodada não tem tabela: a figura do segredo abre irreconhecível e ganha nitidez a cada chute errado da mesa.'
              : duel
                ? 'No duelo, quem esconde o segredo ganha pontos pelo tempo que os outros levam para achar.'
                : '“Até acertar” deixa a rodada só fechar em acerto. Bom para grupo grande — ninguém fica de fora.'}
          </p>
        </div>
      </aside>

      <div className="modal-main">
        <div className="modal-title">
          <span className="mark"><SparkIcon width={22} height={22} /></span>
          <div>
            <h2>Criar nova sala</h2>
            <p>Configure a partida do jeito que quiser e chame seus amigos.</p>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <div className="f-label">
              Seu nome <span className="i" title="É como os outros vão te ver"><InfoIcon /></span>
            </div>
            <label className="text-field">
              <SearchIcon width={16} height={16} style={{ color: 'var(--muted)' }} />
              <input
                value={name}
                maxLength={16}
                placeholder="Treinador"
                autoComplete="nickname"
                aria-label="Seu nome"
                onChange={e => onName(e.target.value)}
              />
              <span className="count">{name.length}/16</span>
            </label>
          </div>

          <div className="field">
            <div className="f-label">
              Tema <span className="i" title="De onde sai o segredo"><InfoIcon /></span>
            </div>
            <UniverseSelect value={universeId} onChange={changeUniverse} showDesc={false} />
          </div>

          <div className="field wide">
            <div className="f-label">Modo de jogo</div>
            <ModePick value={mode} onChange={pickMode} />
          </div>

          {axes.map((axis, i) => (
            <div className="field wide" key={axis.label}>
              <div className="f-label">
                {axis.label} <span className="i" title={axis.help}><InfoIcon /></span>
              </div>
              <div className="chips">
                {axis.options.map(option => {
                  const on = axis.on.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`chip ${on ? 'on' : ''}`}
                      aria-pressed={on}
                      title={option.hint}
                      onClick={() => axis.toggle(option.id)}
                    >
                      {option.label}
                      <CheckIcon className="tick" width={13} height={13} />
                    </button>
                  );
                })}
              </div>
              {/* com duas linhas, a regra vale para as duas e aparece uma vez so, embaixo */}
              {i === axes.length - 1 && (
                <p className="f-help">
                  {axes.length > 1
                    ? `Dá para marcar várias em cada linha. Com toda ${universe.scope.label.toLowerCase()} marcada, entra tudo.`
                    : 'Dá para marcar várias. Sempre fica pelo menos uma.'}
                </p>
              )}
            </div>
          ))}

          <div className="field wide">
            <div className="f-label">Regras da partida</div>

            {/* a ficha so existe no impostor: nos outros modos a linha ja traz
                tudo, com cor */}
            {impostor && (
              <button
                type="button"
                className={`switch-row ${card ? 'on' : ''}`}
                style={{ marginBottom: 10 }}
                onClick={() => setCard(v => !v)}
              >
                <span className="ico"><CardIcon width={18} height={18} /></span>
                <span className="txt">
                  <b>Mostrar os dados de cada chute</b>
                  <small>
                    Cada linha mostra as características de quem foi chutado, sem dizer quais
                    batem com o segredo. Desligado, aparece só o número de acertos.
                  </small>
                </span>
                <span className="switch"><i /></span>
              </button>
            )}

            {/* o interruptor da imagem atravessa a caça ao segredo e o duelo;
                no impostor cada chute clarearia a figura para quem nao sabe.
                No "Qual deles?" nao ha segredo nem chute: os dois somem */}
            {!quiz && <>
            <button
              type="button"
              className={`switch-row ${picture && comImagem && !impostor && !battle && !cardsMode ? 'on' : ''}`}
              disabled={!comImagem || impostor || battle || cardsMode}
              style={{ marginBottom: 10 }}
              onClick={() => setPicture(v => !v)}
            >
              <span className="ico"><ImageIcon width={18} height={18} /></span>
              <span className="txt">
                <b>Jogar pela imagem</b>
                <small>
                  {impostor
                    ? 'No impostor, cada chute clarearia a figura para quem não sabe o segredo.'
                    : battle
                    ? 'Na batalha naval cada tabuleiro teria a própria figura: por ora ela é só pela tabela.'
                    : cardsMode
                    ? 'No modo cartas o Raio-X e a Peneira falam da tabela: aqui a figura fica de fora.'
                    : comImagem
                      ? 'Sem tabela de dicas: a figura do segredo clareia a cada chute errado.'
                      : `${universe.label} não tem figuras para jogar assim.`}
                </small>
              </span>
              <span className="switch"><i /></span>
            </button>

            <button
              type="button"
              className={`switch-row ${(untilRight && !impostor) || battle ? 'on' : ''}`}
              disabled={duel || impostor || battle}
              onClick={() => setUntilRight(v => !v)}
            >
              <span className="ico"><TargetIcon width={18} height={18} /></span>
              <span className="txt">
                <b>Até acertar</b>
                <small>
                  {impostor
                    ? 'No impostor ninguém da mesa pode acertar: as voltas acabam na votação.'
                    : battle
                    ? 'A batalha só acaba quando sobra um segredo de pé, sem teto de chutes.'
                    : duel
                      ? 'O duelo precisa de teto de chutes para quem esconde pontuar.'
                      : 'A rodada só fecha quando alguém acerta, sem teto de chutes.'}
                </small>
              </span>
              <span className="switch"><i /></span>
            </button>
            </>}

            <div className="steppers" style={{ marginTop: quiz ? 0 : 12 }}>
              <Stepper
                label={quiz ? 'Perguntas' : 'Rodadas'}
                icon={<CalendarIcon width={14} height={14} />}
                value={rounds} min={1} max={20}
                off={battle} offValue="1"
                hint={battle ? 'Uma batalha por partida' : 'Total da partida'}
                onChange={setRounds}
              />
              <Stepper
                label={quiz ? 'Tempo por pergunta' : 'Tempo por turno'}
                icon={<ClockIcon width={14} height={14} />}
                value={turnSeconds} min={5} max={180} step={5} suffix="s"
                hint={quiz ? 'Para todos responderem' : 'Para mandar o chute'}
                onChange={setTurnSeconds}
              />
              {quiz ? (
                <Stepper
                  label="Opções"
                  icon={<TargetIcon width={14} height={14} />}
                  value={choices} min={2} max={5}
                  hint="Respostas por pergunta"
                  onChange={setChoices}
                />
              ) : (
                <Stepper
                  label={impostor ? 'Voltas' : 'Chutes por jogador'}
                  icon={<TargetIcon width={14} height={14} />}
                  value={guessesPerPlayer} min={1} max={impostor ? 5 : 20}
                  off={(untilRight && !impostor) || battle}
                  hint={impostor
                    ? 'Um chute de cada por volta'
                    : untilRight ? '“Até acertar” ignora o teto' : 'Máximo por rodada'}
                  onChange={(v) => { setGuessesPerPlayer(v); setUntilRight(false); }}
                />
              )}
              {cardsMode && (
                <Stepper
                  label="Draft a cada"
                  icon={<CardsIcon width={14} height={14} />}
                  value={draftEvery} min={1} max={5}
                  suffix={draftEvery === 1 ? ' rodada' : ' rodadas'}
                  hint="Cada um escolhe 1 de 3 cartas"
                  onChange={setDraftEvery}
                />
              )}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost lg" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn violet lg" onClick={create}>
            Criar sala de {universe.label}
            <UniverseIcon universe={universeId} size="xs" />
          </button>
        </div>
      </div>
    </>
  );
}
