import MarkArt from './MarkArt.jsx';

/**
 * O fundo da página: as marcas dos universos espalhadas num plano fixo, na
 * tinta do tema e quase transparentes. Na partida e no diário são todas do
 * universo em jogo; na home, uma mistura dos temas. Não recebe clique — é
 * atmosfera, não interface. O resto do clima (feltro, retícula, linhas de
 * tubo) é o `--page-bg` do tema, pintado no body.
 */
const SLOTS = ['a1', 'a2', 'a3', 'a4', 'a5'];

export default function Ambient({ marks = ['pokemon'] }) {
  // uma marca só vira as cinco posições; várias se revezam nelas
  const list = marks.length ? marks : ['pokemon'];
  return (
    <div className="ambient" aria-hidden="true">
      {SLOTS.map((slot, i) => (
        <MarkArt key={slot} universe={list[i % list.length]} ink className={slot} />
      ))}
    </div>
  );
}
