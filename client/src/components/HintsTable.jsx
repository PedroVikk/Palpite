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
export default function HintsTable({ universe, rows, hints = true }) {
  if (!rows.length) {
    return (
      <p className="empty-hint">
        {hints
          ? 'Nenhum chute ainda. A tabela se pinta a cada palpite.'
          : 'Nenhum chute ainda. Os nomes que forem caindo ficam listados aqui.'}
      </p>
    );
  }

  /**
   * Jogando pela imagem nao ha dica para comparar — a dica e a figura —, entao
   * a tabela fica so com a coluna do chute. Continua sendo esta tabela, e nao
   * uma lista a parte: o cartao, a celula com retrato e nome, o realce do
   * ultimo chute e o verde do acerto sao os mesmos, e quem trocou de modo
   * reconhece a pilha na hora.
   *
   * Sem as colunas de dica, a linha inteira seria um trilho vazio a direita do
   * nome. Entao a pilha vira grade: as mesmas celulas, lado a lado, quantas
   * couberem na largura.
   */
  const hintColumns = hints ? universe.columns : [];
  const columns = hints
    ? `176px repeat(${hintColumns.length}, minmax(88px, 1fr))`
    : 'minmax(0, 1fr)';
  // a largura minima acompanha o numero de colunas: universo enxuto nao precisa
  // rolar de lado, universo largo rola em vez de espremer a celula
  const minWidth = hints ? `${176 + hintColumns.length * 94}px` : '0';
  const newest = rows[rows.length - 1];

  return (
    <section className="table">
      <div className="tscroll">
        <div
          className={`hints ${hints ? '' : 'bare'}`}
          style={{ '--hint-cols': columns, '--hint-min': minWidth }}
        >
          {hints && (
            <div className="hints-row">
              <div className="cell head">Chute</div>
              {hintColumns.map(column => (
                <div key={column.key} className="cell head">{column.label}</div>
              ))}
            </div>
          )}

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

              {hintColumns.map(column => {
                const cell = row.cells?.[column.key] ?? { value: null, status: 'unknown', hint: null };
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
          repetir a explicacao em cada celula seria ruido. Sem colunas de dica
          nao ha cor para ensinar, e ela sai junto */}
      {hints && <div className="legend">
        <span className="k"><i className="sw" style={{ background: 'var(--hit)' }} />Acertou</span>
        <span className="k"><i className="sw" style={{ background: 'var(--partial)' }} />Chegou perto</span>
        <span className="k"><i className="sw" style={{ background: 'var(--miss)' }} />Errou</span>
        <span className="spacer" />
        <span className="k">▲ o segredo é maior · ▼ é menor</span>
      </div>}
    </section>
  );
}
