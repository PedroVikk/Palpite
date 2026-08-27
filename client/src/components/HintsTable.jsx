import { formatValue, fullValue } from '../lib/format.js';

const ARROW = { up: '▲', down: '▼' };

/**
 * A grade de dicas. A cor da celula e a informacao principal (verde acertou,
 * amarelo chegou perto, cinza errou); o texto e o detalhe. Cada linha e uma
 * grade propria, para poder animar e destacar a vencedora sem quebrar o
 * alinhamento das colunas.
 */
export default function HintsTable({ universe, rows }) {
  if (!rows.length) {
    return <p className="empty-hint">Nenhum chute ainda. Boa sorte!</p>;
  }

  const columns = `minmax(150px, 1.6fr) repeat(${universe.columns.length}, minmax(88px, 1fr))`;
  const newest = rows[rows.length - 1];

  return (
    <div className="hints-wrap">
      <div className="hints" style={{ '--hint-cols': columns }}>
        <div className="hints-row">
          <div className="cell head">Chute</div>
          {universe.columns.map(column => (
            <div key={column.key} className="cell head">{column.label}</div>
          ))}
        </div>

        {/* chute mais recente no topo */}
        {[...rows].reverse().map(row => (
          <div
            key={row.id}
            className={`hints-row ${row === newest ? 'newest' : ''} ${row.correct ? 'correct' : ''}`}
          >
            <div className="cell guess">
              <span className="by">{row.playerName}</span>
              <span className="name">
                {row.sprite && <img src={row.sprite} alt="" loading="lazy" />}
                <span>{row.name}</span>
              </span>
            </div>

            {universe.columns.map(column => {
              const cell = row.cells[column.key] ?? { value: null, status: 'unknown', hint: null };
              const title = cell.status === 'unknown'
                ? 'sem dado para comparar'
                : fullValue(column, cell.value);
              return (
                <div key={column.key} className={`cell ${cell.status}`} title={title}>
                  <span>{formatValue(column, cell.value)}</span>
                  {ARROW[cell.hint] && <span className="arrow">{ARROW[cell.hint]}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
