import { useEffect, useMemo, useRef, useState } from 'react';
import { UNIVERSES } from '@shared/universes.js';
import { universeMeta } from '../lib/universeMeta.js';
import UniverseIcon from './UniverseIcon.jsx';
import { CheckIcon, ChevronIcon, SearchIcon } from './Icon.jsx';

const ALL = Object.values(UNIVERSES);

/**
 * Escolha do universo. São vinte e dois — um `<select>` vira um paredão de
 * nomes sem contexto, então aqui cada linha tem monograma, nome e uma linha
 * dizendo o que tem dentro, e a busca filtra por qualquer um dos dois textos.
 *
 * A lista fecha ao escolher, ao clicar fora e no Esc; o teclado anda com as
 * setas, que é como se usa uma lista que já está aberta com o foco na busca.
 */
export default function UniverseSelect({ value, onChange, disabled = false, showDesc = true }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const selected = UNIVERSES[value] ?? ALL[0];
  const meta = universeMeta(selected.id);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return ALL;
    return ALL.filter(u =>
      u.label.toLowerCase().includes(term) || universeMeta(u.id).desc.toLowerCase().includes(term));
  }, [query]);

  useEffect(() => { setIndex(0); }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    searchRef.current?.focus();
    const onDocumentClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, [open]);

  // a lista rola: sem isto a seta do teclado sairia da área visível
  useEffect(() => {
    if (open) listRef.current?.children[index]?.scrollIntoView({ block: 'nearest' });
  }, [index, open]);

  const pick = (universe) => {
    setOpen(false);
    if (universe && universe.id !== value) onChange(universe.id);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!matches.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setIndex(i => (i + step + matches.length) % matches.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(matches[index]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="universe" ref={rootRef}>
      <button
        type="button"
        className="universe-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
      >
        <UniverseIcon universe={selected.id} />
        <span className="txt">
          <span className="name">{selected.label}</span>
          {showDesc && <span className="desc">{meta.desc}</span>}
        </span>
        <ChevronIcon className="chev" width={16} height={16} />
      </button>

      {open && (
        <div className="universe-panel">
          <div className="usearch">
            <SearchIcon width={16} height={16} />
            <input
              ref={searchRef}
              value={query}
              placeholder="Buscar universo..."
              autoComplete="off"
              spellCheck={false}
              aria-label="Buscar universo"
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <kbd>ESC</kbd>
          </div>

          <ul className="ulist" role="listbox" ref={listRef}>
            {matches.length === 0 && <li className="none">Nenhum universo com esse nome.</li>}
            {matches.map((universe, i) => {
              const item = universeMeta(universe.id);
              return (
                <li
                  key={universe.id}
                  role="option"
                  aria-selected={universe.id === value}
                  className={i === index ? 'active' : ''}
                  // mousedown, não click: o blur da busca fecharia a lista antes
                  onMouseDown={e => { e.preventDefault(); pick(universe); }}
                  onMouseEnter={() => setIndex(i)}
                >
                  <UniverseIcon universe={universe.id} />
                  <span className="txt">
                    <span className="name">{universe.label}</span>
                    <span className="desc">{item.desc}</span>
                  </span>
                  <CheckIcon className="check" width={17} height={17} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
