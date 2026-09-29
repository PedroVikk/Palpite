import { useCallback, useEffect, useState } from 'react';
import { formatValue, fullValue } from '../lib/format.js';
import { explainCell, knownFacts } from '../lib/hintText.js';

const ARROW = { up: '▲', down: '▼' };

/**
 * A seta da célula de número. Longe (o servidor marca `far`) ela vem dobrada:
 * ▲▲ quer dizer "bem maior", ▲ sozinha "maior, mas não tão longe".
 */
function Arrow({ hint, far }) {
  if (!ARROW[hint]) return null;
  return (
    <span className={`arrow ${far ? 'far' : ''}`} aria-label={far ? `bem ${hint === 'up' ? 'maior' : 'menor'}` : undefined}>
      {ARROW[hint]}{far && ARROW[hint]}
    </span>
  );
}

/**
 * O que a tabela já garante, em uma faixa em cima dela: o valor certo de cada
 * coluna que alguém acertou, a faixa dos números pelas setas, o que já foi
 * descartado. Só aparece para quem ligou o modo acessibilidade.
 */
function KnownStrip({ universe, rows }) {
  const facts = knownFacts(universe, rows);
  if (!facts.length) return null;
  return (
    <div className="known" aria-label="O que já se sabe">
      <span className="known-k">Já se sabe</span>
      {facts.map(fact => (
        <span key={fact.key} className={`known-chip ${fact.tone}`}>
          <small>{fact.label}</small> {fact.text}
        </span>
      ))}
    </div>
  );
}

/**
 * O balão do clique: o que a célula quer dizer. Mora fora da grade (fixed),
 * porque a tabela rola de lado e cortaria o balão na borda.
 */
function CellPop({ pop, onClose }) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    addEventListener('scroll', close, true);
    addEventListener('resize', close);
    addEventListener('keydown', onKey);
    // o clique que abriu ainda está subindo: fechar só no próximo
    const handle = setTimeout(() => addEventListener('click', close), 0);
    return () => {
      clearTimeout(handle);
      removeEventListener('scroll', close, true);
      removeEventListener('resize', close);
      removeEventListener('keydown', onKey);
      removeEventListener('click', close);
    };
  }, [onClose]);
  const below = pop.rect.top < 140;
  const left = Math.min(Math.max(pop.rect.left + pop.rect.width / 2, 150), innerWidth - 150);
  return (
    <div
      className={`cell-pop ${pop.status} ${below ? 'below' : ''}`}
      role="tooltip"
      style={{ left, top: below ? pop.rect.bottom + 10 : pop.rect.top - 10 }}
    >
      <b>{pop.title}</b>
      <span>{pop.text}</span>
    </div>
  );
}

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
export default function HintsTable({ universe, rows, hints = true, counts = false, known = false }) {
  const [pop, setPop] = useState(null);
  const closePop = useCallback(() => setPop(null), []);
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
  /**
   * Impostor com a rodada aberta (`counts`): o servidor so manda quantas
   * colunas cada chute acertou, e ela vira a coluna ao lado do nome. As colunas
   * de dica so aparecem se a sala ligou a ficha — com o valor do chutado, em
   * celula neutra, porque as cores nem chegaram ao navegador.
   */
  const withSheet = !counts || Boolean(rows[0].cells);
  const hintColumns = hints && withSheet ? universe.columns : [];
  /**
   * So contagem, sem os dados: sobram o nome e o numero. O nome estica e a
   * contagem fica numa coluna estreita a direita — com `repeat(0, ...)` a
   * grade inteira ficava invalida e cada celula caia numa linha propria.
   */
  const countsOnly = counts && !hintColumns.length;
  const lead = counts ? 176 + 6 + 104 : 176;
  const columns = !hints
    ? 'minmax(0, 1fr)'
    : countsOnly
      ? 'minmax(0, 1fr) 132px'
      : `176px ${counts ? '104px ' : ''}repeat(${hintColumns.length}, minmax(88px, 1fr))`;
  // a largura minima acompanha o numero de colunas: universo enxuto nao precisa
  // rolar de lado, universo largo rola em vez de espremer a celula
  const minWidth = hints && !countsOnly ? `${lead + hintColumns.length * 94}px` : '0';
  const newest = rows[rows.length - 1];

  const openPop = (event, row, column, cell) => {
    const id = `${row.id}:${column.key}`;
    if (pop?.id === id) return setPop(null);
    const rect = event.currentTarget.getBoundingClientRect();
    setPop({ id, rect, status: cell.status, ...explainCell(universe, column, cell) });
  };

  return (
    <section className="table">
      {known && hints && !counts && withSheet && <KnownStrip universe={universe} rows={rows} />}
      <div className="tscroll">
        <div
          className={`hints ${hints ? '' : 'bare'} ${rows.length > 1 ? 'stack' : ''}`}
          style={{ '--hint-cols': columns, '--hint-min': minWidth }}
        >
          {hints && (
            <div className="hints-row">
              <div className="cell head">Chute</div>
              {counts && <div className="cell head">Acertos</div>}
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

              {counts && (
                <div className="cell hits" title={`${row.hits} de ${row.total} colunas em cheio`}>
                  <b>{row.hits}</b><small>de {row.total}</small>
                </div>
              )}

              {hintColumns.map(column => {
                const cell = row.cells?.[column.key] ?? { value: null, status: 'unknown', hint: null };
                const title = cell.status === 'unknown' || (cell.status === 'plain' && cell.value == null)
                  ? 'sem dado para comparar'
                  : fullValue(column, cell.value);
                const comSimbolo = column.icons && cell.status !== 'unknown' && cell.value != null;
                const id = `${row.id}:${column.key}`;
                return (
                  <button
                    type="button"
                    key={column.key}
                    className={`cell ${cell.status} ${pop?.id === id ? 'popped' : ''}`}
                    title={title}
                    aria-expanded={pop?.id === id}
                    onClick={(event) => openPop(event, row, column, cell)}
                  >
                    {comSimbolo
                      ? <Symbols column={column} value={cell.value} />
                      : <span>{formatValue(column, cell.value)}</span>}
                    <Arrow hint={cell.hint} far={cell.far} />
                    {cell.match && <span className="match-dots" aria-hidden="true">{cell.match.length}/{(cell.value ?? []).length}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* a legenda aparece uma vez, embaixo: a cor precisa ser ensinada, mas
          repetir a explicacao em cada celula seria ruido. Sem colunas de dica
          nao ha cor para ensinar, e ela sai junto */}
      {counts && (
        <div className="legend">
          <span className="k">Acertos = colunas que o chute acertou em cheio. Quais foram, só no fim da rodada.</span>
        </div>
      )}
      {hints && !counts && <div className="legend">
        <span className="k"><i className="sw hit" />Acertou</span>
        <span className="k"><i className="sw partial" />Chegou perto</span>
        <span className="k"><i className="sw miss" />Errou</span>
        <span className="spacer" />
        <span className="k">▲ o segredo é maior · ▲▲ bem maior · ▼ menor</span>
        <span className="k dim">Toque numa célula para ler o que ela diz</span>
      </div>}
      {pop && <CellPop pop={pop} onClose={closePop} />}
    </section>
  );
}
