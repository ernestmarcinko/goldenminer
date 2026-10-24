import { useMemo, useRef, useState } from 'react';
import type { GameStore } from '../../store/gameStore';
import { copyText } from '../copyText';
import { saveProblem } from '../saveText';
import { useDialog } from '../useDialog';

interface Props {
  store: GameStore;
  runAsOwner: (action: () => void) => boolean;
  onClose: () => void;
}

export function SaveDialog({ store, runAsOwner, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useDialog<HTMLButtonElement>(onClose, dialogRef);
  const exported = useMemo(() => store.exportSave(), [store]);
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const load = (): void => {
    const results: ReturnType<GameStore['importSave']>[] = [];
    runAsOwner(() => {
      results.push(store.importSave(importText.trim()));
    });
    const done = results[0];
    if (!done) return;
    setImportMsg(done.ok ? 'Loaded.' : `That save couldn't be read (${saveProblem(done.reason)}).`);
    if (done.ok) setImportText('');
  };

  return (
    <div className="gm-overlay">
      <div ref={dialogRef} className="gm-dialog gm-dialog--wide" role="dialog" aria-modal="true" aria-labelledby="gm-save-title">
        <div className="gm-dialog__head">
          <h2 id="gm-save-title" className="gm-dialog__title">Export / import save</h2>
          <button type="button" ref={closeRef} className="gm-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="gm-dialog__section">
          <h3>Export</h3>
          <textarea ref={exportRef} className="gm-textarea" readOnly rows={3} value={exported} aria-label="Exported save" />
          <div className="gm-dialog__actions">
            <button
              type="button"
              className="gm-btn"
              onClick={() => {
                void copyText(exported, exportRef.current).then(setCopied);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </section>

        <section className="gm-dialog__section">
          <h3>Import</h3>
          <textarea
            className="gm-textarea"
            rows={3}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            aria-label="Save to import"
          />
          <div className="gm-dialog__actions">
            <button type="button" className="gm-btn" onClick={load}>
              Load
            </button>
            {importMsg && <span role="status">{importMsg}</span>}
          </div>
        </section>
      </div>
    </div>
  );
}
