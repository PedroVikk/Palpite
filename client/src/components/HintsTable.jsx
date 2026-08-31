import { formatValue, fullValue } from '../lib/format.js';

const ARROW = { up: '▲', down: '▼' };

/**
 * Coluna que tem simbolo (os elementos de chakra do Naruto) mostra o simbolo, e
 * o nome vai para o balao do mouse. Valor sem simbolo — "Nenhum", uma natureza
 * que a wiki nao ilustra — cai no texto ali do lado, entao a celula nunca fica
 * vazia. Aqui nao ha o corte de "+2" da versao em texto: simbolo e pequeno e
 * cabem todos, que e o ponto de usa-los.
 */
function Symbols({ column, value }) {
  const values = Array.isArray(value) ? value : [value];
  return (
    <span className="symbols">
      {values.map(item => {
        const label = column.labels?.[item] ?? item;
        const icon = column.icons[item];
        return icon
          ? <img key={item} className="symbol" src={icon.src} alt={label} title={label} loading="lazy" />
          : <span key={item} className="symbol text" title={label}>{label}</span>;
      })}
    </span>
  );
}

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

  const columns = `minmax(120px, 1fr) repeat(${universe.columns.length}, minmax(88px, 1fr))`;
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

        {/* pilha: o chute mais recente no topo */}
        {[...rows].reverse().map(row => (
          <div
            key={row.id}
            className={`hints-row ${row === newest ? 'newest' : ''} ${row.correct ? 'correct' : ''}`}
          >
            {/* o retrato e o chute; o nome so aparece com o mouse em cima, numa
                tarja sobre a propria celula. Sem retrato (universo que a API nao
                ilustra) o nome volta a ser o conteudo, sempre visivel */}
            <div className="cell guess" title={row.name}>
              <span className="by">{row.playerName}</span>
              {row.sprite ? (
                <>
                  <img src={row.sprite} alt={row.name} loading="lazy" />
                  <span className="name-tip" aria-hidden="true">{row.name}</span>
                </>
              ) : (
                <span className="name">{row.name}</span>
              )}
            </div>

            {universe.columns.map(column => {
              const cell = row.cells[column.key] ?? { value: null, status: 'unknown', hint: null };
              const title = cell.status === 'unknown'
                ? 'sem dado para comparar'
                : fullValue(column, cell.value);
              const comSimbolo = column.icons && cell.status !== 'unknown' && cell.value != null;
              return (
                <div key={column.key} className={`cell ${cell.status}`} title={title}>
                  {comSimbolo
                    ? <Symbols column={column} value={cell.value} />
                    : <span>{formatValue(column, cell.value)}</span>}
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
