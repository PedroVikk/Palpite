import { useState } from 'react';
import { LATEST_NOTE, PATCH_NOTES } from '../lib/patchNotes.js';
import Modal from './Modal.jsx';
import { SparkIcon } from './Icon.jsx';

/**
 * O botao "Novidades" do topo da home e a janela com as notas. A bolinha acende
 * enquanto o navegador nao abriu a nota mais nova; abrir guarda o id dela no
 * localStorage, e a proxima atualizacao acende de novo.
 */
const KEY = 'palpite:novidades';

const lastSeen = () => { try { return localStorage.getItem(KEY); } catch { return LATEST_NOTE; } };
const markSeen = () => { try { localStorage.setItem(KEY, LATEST_NOTE); } catch { /* storage bloqueado */ } };

export default function PatchNotes() {
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(() => lastSeen() !== LATEST_NOTE);

  const show = () => { setOpen(true); setFresh(false); markSeen(); };

  return (
    <>
      <button type="button" className="btn link news-btn" onClick={show} title="O que mudou nas últimas atualizações">
        <SparkIcon width={16} height={16} /> Novidades
        {fresh && <span className="news-dot" aria-label="(novo)" />}
      </button>

      {open && (
        <Modal label="Novidades" onClose={() => setOpen(false)} className="news">
          <div className="news-head">
            <span className="news-tag">Notas de atualização</span>
            <h2>O que mudou no Palpite</h2>
          </div>
          <div className="news-list">
            {PATCH_NOTES.map((note, i) => (
              <article key={note.id} className={`news-entry ${i === 0 ? 'latest' : ''}`.trim()}>
                <header>
                  <time dateTime={note.id}>{note.date}</time>
                  {i === 0 && <span className="tag coral">mais recente</span>}
                </header>
                <h3>{note.title}</h3>
                {note.sections.map((section, j) => (
                  <div key={j} className="news-section">
                    {section.head && <b>{section.head}</b>}
                    <ul>{section.items.map((text, k) => <li key={k}>{text}</li>)}</ul>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
