import { useMemo, useRef, useState } from 'react';
import type { GameStore } from '../store/gameStore';
import { copyText } from './copyText';
import { useDialog } from './useDialog';

export function SaveMenu({ store, onClose }: { store: GameStore; onClose: () => void }) {
  const closeRef = useDialog<HTMLButtonElement>(onClose);
  const exported = useMemo(() => store.exportSave(), [store]);
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const load = (): void => {
    const result = store.importSave(importText.trim());
    setImportMsg(result.ok ? 'Loaded.' : `That save couldn't be read (${result.reason}).`);
    if (result.ok) setImportText('');
  };

  return (
    <div className="gm-overlay">
      <div className="gm-dialog gm-dialog--wide" role="dialog" aria-modal="true" aria-labelledby="gm-save-title">
        <div className="gm-dialog__head">
          <h2 id="gm-save-title" className="gm-dialog__title">Save</h2>
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

        <section className="gm-dialog__section">
          <h3>Reset</h3>
          {confirmReset ? (
            <div className="gm-dialog__actions">
              <span>Really erase this game?</span>
              <button
                type="button"
                className="gm-btn gm-btn--danger"
                onClick={() => {
                  store.hardReset();
                  setConfirmReset(false);
                  onClose();
                }}
              >
                Yes
              </button>
              <button type="button" className="gm-btn" onClick={() => setConfirmReset(false)}>
                No
              </button>
            </div>
          ) : (
            <div className="gm-dialog__actions">
              <button type="button" className="gm-btn" onClick={() => setConfirmReset(true)}>
                Start over
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
