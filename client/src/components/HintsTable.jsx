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
 * amarelo chegou perto, vermelho errou); o texto e o detalhe. Cada linha e uma
 * grade propria, para poder animar e destacar a vencedora sem quebrar o
 * alinhamento das colunas.
 */
export default function HintsTable({ universe, rows }) {
  if (!rows.length) {
    return <p className="empty-hint">Nenhum chute ainda. A tabela se pinta a cada palpite.</p>;
  }

  const columns = `176px repeat(${universe.columns.length}, minmax(88px, 1fr))`;
  // a largura minima acompanha o numero de colunas: universo enxuto nao precisa
  // rolar de lado, universo largo rola em vez de espremer a celula
  const minWidth = `${176 + universe.columns.length * 94}px`;
  const newest = rows[rows.length - 1];

  return (
    <section className="table">
      <div className="tscroll">
        <div className="hints" style={{ '--hint-cols': columns, '--hint-min': minWidth }}>
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
              <div className="cell guess" title={row.name}>
                {row.sprite && <img src={row.sprite} alt="" loading="lazy" />}
                <span>
                  <span className="nm">{row.name}</span>
                  {row.playerName && <span className="by">{row.playerName}</span>}
                </span>
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

      {/* a legenda aparece uma vez, embaixo: a cor precisa ser ensinada, mas
          repetir a explicacao em cada celula seria ruido */}
      <div className="legend">
        <span className="k"><i className="sw" style={{ background: 'var(--hit)' }} />Acertou</span>
        <span className="k"><i className="sw" style={{ background: 'var(--partial)' }} />Chegou perto</span>
        <span className="k"><i className="sw" style={{ background: 'var(--miss)' }} />Errou</span>
        <span className="spacer" />
        <span className="k">▲ o segredo é maior · ▼ é menor</span>
      </div>
    </section>
  );
}
