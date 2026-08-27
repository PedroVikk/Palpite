import { useEffect, useMemo, useRef, useState } from 'react';
import { search } from '../lib/search.js';
import { SearchIcon, SendIcon } from '../components/Icon.jsx';

/**
 * Campo de chute com autocomplete. So o item escolhido na lista e enviado —
 * texto livre nunca vira palpite, senao um erro de digitacao gastaria a vez.
 *
 * Nao conhece sala: recebe o que ja foi chutado e os grupos ligados soltos,
 * para servir tanto a partida quanto o desafio diario.
 */
export default function GuessBar({
  items, guessedIds, groups = [], active, choosing = false, focusKey, onSubmit,
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return search(query, { items, choosing, groups, guessed: guessedIds });
  }, [query, items, choosing, groups, guessedIds]);

  useEffect(() => { setIndex(0); }, [query]);

  // chegou a vez: o foco vai para o campo sem o jogador precisar clicar
  useEffect(() => {
    if (active) inputRef.current?.focus();
    else setOpen(false);
  }, [active, focusKey]);

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  const pick = (item) => {
    if (!item) return onSubmit(null);
    onSubmit(item);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!suggestions.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setIndex(i => (i + step + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(suggestions[index]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const placeholder = choosing
    ? 'Escolha o segredo...'
    : active ? 'Digite o nome...' : 'Aguarde sua vez...';

  return (
    <div className={`guess-bar ${active ? '' : 'off'}`}>
      <div className="autocomplete" ref={boxRef}>
        <span className="search-icon"><SearchIcon /></span>
        <input
          ref={inputRef}
          value={query}
          disabled={!active}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-label={choosing ? 'Escolher o segredo' : 'Seu chute'}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        {open && suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((item, i) => (
              <li
                key={item.id}
                className={i === index ? 'active' : ''}
                // mousedown, nao click: o blur do input fecharia a lista antes
                onMouseDown={e => { e.preventDefault(); pick(item); }}
                onMouseEnter={() => setIndex(i)}
              >
                {item.sprite && <img src={item.sprite} alt="" loading="lazy" />}
                <span>{item.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button className="btn primary" disabled={!active} onClick={() => pick(suggestions[index])}>
        {choosing ? 'Escolher' : 'Chutar'} <SendIcon width={16} height={16} />
      </button>
    </div>
  );
}
