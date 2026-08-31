import { useState } from 'react';

export default function HomeScreen({
  name, onName, onCreate, onJoin, onDaily, toast, resume, onResume, onForgetResume,
}) {
  // convite chega como ?sala=XXXX: o codigo ja vem preenchido
  const [code, setCode] = useState(() =>
    (new URLSearchParams(location.search).get('sala') ?? '').toUpperCase());

  const submit = (event) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length !== 4) return toast('O código tem 4 caracteres.');
    onJoin(clean);
  };

  return (
    <main className="page center">
      <header className="brand">
        <div className="mark">?</div>
        <h1>Palpite</h1>
        <p>Dezoito universos, de Pokémon a carros: adivinhe o secreto em turnos, com seus amigos.</p>
      </header>

      {/* caiu no meio da partida e a aba perdeu a identidade: um clique devolve
          a cadeira, com placar e chutes de onde parou */}
      {resume && (
        <div className="card narrow resume">
          <span className="tag">Você estava jogando</span>
          <strong>Sala {resume.code}</strong>
          <p className="muted">
            A vaga de <b>{resume.name}</b> fica guardada por alguns minutos: volte e o
            placar continua de onde parou.
          </p>
          <div className="resume-actions">
            <button className="btn primary" onClick={onResume}>Voltar para a partida</button>
            <button className="btn link" onClick={onForgetResume}>Agora não</button>
          </div>
        </div>
      )}

      <div className="card narrow stack">
        <label className="field">
          <span>Seu nome</span>
          <input
            value={name}
            onChange={e => onName(e.target.value)}
            maxLength={16}
            placeholder="Treinador"
            autoComplete="nickname"
          />
        </label>

        <button className="btn primary big" onClick={onCreate}>Criar sala</button>

        <div className="divider"><span>ou</span></div>

        <form className="join-row" onSubmit={submit}>
          <input
            className="code-input"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="CÓDIGO"
            autoComplete="off"
            spellCheck={false}
            aria-label="Código da sala"
          />
          <button className="btn" type="submit">Entrar</button>
        </form>
      </div>

      {/* sem sala e sem codigo: um segredo por universo, igual para todo mundo */}
      <button className="daily-cta" onClick={onDaily}>
        <span className="tag">Todo dia</span>
        <strong>Desafio diário</strong>
        <span className="muted">Um segredo por universo, o mesmo para todo mundo. Jogue sozinho.</span>
      </button>
    </main>
  );
}
