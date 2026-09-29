import { useEffect, useMemo, useState } from 'react';
import { keyboardMarks } from '@shared/termo.js';

const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/**
 * Corta uma fileira de letras no desenho do nome: [7, 6] vira duas palavras,
 * com o vao entre elas. `cell(i)` desenha a casa da letra i do nome inteiro.
 */
function Words({ pattern, cell }) {
  let at = 0;
  return pattern.map((size, w) => {
    const start = at;
    at += size;
    return (
      <span className="termo-word" key={w}>
        {Array.from({ length: size }, (_, i) => cell(start + i))}
      </span>
    );
  });
}

/**
 * O tabuleiro do Termo, igual no desafio do dia e na sala: as linhas gastas,
 * a linha sendo digitada e o teclado pintado com o melhor que cada letra ja
 * mostrou. Digita pelo teclado da tela ou pelo de verdade.
 *
 * `cat` e a categoria da palavra ("Arma", "Lugar", "Personagem"), a dica que
 * fica em cima do tabuleiro a rodada inteira.
 */
export default function TermoBoard({
  pattern, tries, rows, active, cat = null, toast, onSubmit,
}) {
  const length = pattern.reduce((a, b) => a + b, 0);
  const [typed, setTyped] = useState('');
  const [shake, setShake] = useState(0);

  // linha nova no tabuleiro (a do chute que o servidor aceitou): digitacao limpa
  useEffect(() => { setTyped(''); }, [rows.length, length]);

  const marks = useMemo(() => keyboardMarks(rows), [rows]);

  const refuse = (message) => {
    setShake(n => n + 1);
    toast?.(message);
  };

  const press = (key) => {
    if (!active) return;
    if (key === 'ENTER') {
      if (typed.length < length) return refuse(`A palavra tem ${length} letras.`);
      return onSubmit(typed);
    }
    if (key === 'BACK') return setTyped(t => t.slice(0, -1));
    if (/^[A-Z]$/.test(key)) setTyped(t => (t.length < length ? t + key : t));
  };

  // o teclado de verdade, so com o tabuleiro valendo e fora de campo de texto
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
      const key = event.key === 'Enter' ? 'ENTER'
        : event.key === 'Backspace' ? 'BACK'
        : event.key.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
      if (key === 'ENTER' || key === 'BACK' || /^[A-Z]$/.test(key)) {
        event.preventDefault();
        press(key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // linhas infinitas (tries 0): o tabuleiro cresce uma linha por chute
  const total = tries || Math.max(6, rows.length + 1);
  const lines = Array.from({ length: total }, (_, r) => {
    const row = rows[r];
    if (row) {
      return (
        <div className={`termo-row done ${row.correct ? 'correct' : ''}`} key={r}>
          <Words pattern={pattern} cell={(i) => (
            <span key={i} className={`termo-tile ${row.marks?.[i] ?? ''}`} style={{ animationDelay: `${i * 60}ms` }}>
              {row.word?.[i] ?? ''}
            </span>
          )} />
        </div>
      );
    }
    const current = r === rows.length && active;
    return (
      <div className={`termo-row ${current ? 'now' : ''} ${current && shake ? 'shake' : ''}`} key={current ? `now:${shake}` : r}>
        <Words pattern={pattern} cell={(i) => (
          <span key={i} className={`termo-tile ${current && typed[i] ? 'typed' : ''} ${current && i === typed.length ? 'at' : ''}`}>
            {current ? typed[i] ?? '' : ''}
          </span>
        )} />
      </div>
    );
  });

  return (
    <section className="termo">
      {cat && (
        <span className="pill termo-cat">
          Categoria: <b>{cat}</b>
          {tries > 0 && tries < 6 && active && <small> · {tries} {tries === 1 ? 'linha' : 'linhas'}, categoria pequena</small>}
        </span>
      )}
      <div className="termo-grid" style={{ '--n': length }}>{lines}</div>

      <div className={`termo-keys ${active ? '' : 'off'}`} aria-label="Teclado">
        {KEYS.map((line, i) => (
          <div className="termo-keyrow" key={line}>
            {i === 2 && (
              <button type="button" className="termo-key wide" disabled={!active} onClick={() => press('ENTER')}>
                Enviar
              </button>
            )}
            {[...line].map(letter => (
              <button
                type="button"
                key={letter}
                className={`termo-key ${marks[letter] ?? ''}`}
                disabled={!active}
                onClick={() => press(letter)}
              >
                {letter}
              </button>
            ))}
            {i === 2 && (
              <button type="button" className="termo-key wide" disabled={!active} onClick={() => press('BACK')} aria-label="Apagar">
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * A palavra revelada, com a categoria. Nome do tema vem com a figura; palavra
 * do tema (KUNAI, KONOHA) nao tem figura nem ficha — por isso o Termo nao usa
 * a revelacao das colunas dos outros modos.
 */
export function TermoReveal({ answer, caption = 'A palavra era' }) {
  if (!answer) return null;
  return (
    <section className="termo-reveal">
      {answer.sprite && <img src={answer.sprite} alt="" />}
      <div>
        <small>{caption}</small>
        <b>{answer.label}</b>
        <span className="tag ghost">{answer.cat}</span>
      </div>
    </section>
  );
}

/**
 * O tabuleiro de outra pessoa, em miniatura: so as cores enquanto a rodada
 * corre (o servidor nem manda as letras), as letras quando ela fecha.
 */
export function TermoMini({ pattern, tries, rows }) {
  const total = tries || Math.max(6, rows?.length ?? 0);
  return (
    <div className="termo-mini">
      {Array.from({ length: total }, (_, r) => {
        const row = rows?.[r];
        return (
          <div className="termo-row" key={r}>
            <Words pattern={pattern} cell={(i) => (
              <span key={i} className={`termo-tile ${row?.marks?.[i] ?? ''}`}>{row?.word?.[i] ?? ''}</span>
            )} />
          </div>
        );
      })}
    </div>
  );
}
