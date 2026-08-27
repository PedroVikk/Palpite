import { useState } from 'react';

export default function HomeScreen({ name, onName, onCreate, onJoin, toast }) {
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
        <p>Quinze universos, de Pokémon a carros: adivinhe o secreto em turnos, com seus amigos.</p>
      </header>

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
    </main>
  );
}
