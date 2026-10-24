import { useRef, useState } from 'react';
import type { GameStore } from '../store/gameStore';
import { copyText } from './copyText';
import { saveProblem } from './saveText';
import { useGame } from './useGame';

export function Notices({ store }: { store: GameStore }) {
  const { notice, unreadableSave } = useGame(store);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  if (!notice) return null;

  let text: string;
  let showSave = false;
  if (notice.kind === 'loadFailed') {
    showSave = unreadableSave !== null;
    if (notice.reason === 'future') {
      text = 'Your save was made by a newer version of the game. Reload the page to update — nothing will be saved here until you do, start over, or import.';
    } else {
      const what = saveProblem(notice.reason);
      text = notice.backupKey === null
        ? `Your save couldn't be loaded (${what}) and couldn't be backed up. Copy it below before playing on — progress won't be saved until you start over or import.`
        : `Your save couldn't be loaded (${what}). It was kept as a backup, and a new game started.`;
    }
  } else if (notice.kind === 'saveFailed') {
    text = "Progress couldn't be saved. Your browser storage may be full.";
  } else {
    text = "This browser mode doesn't allow saving, so progress will be lost when you close the tab.";
  }

  return (
    <div className="gm-notice" role="status">
      <div className="gm-notice__body">
        <p className="gm-notice__text">{text}</p>
        {showSave && (
          <div className="gm-notice__save">
            <textarea ref={areaRef} className="gm-textarea" readOnly rows={3} value={unreadableSave ?? ''} aria-label="Unreadable save" />
            <button
              type="button"
              className="gm-btn"
              onClick={() => {
                void copyText(unreadableSave ?? '', areaRef.current).then(setCopied);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
      {unreadableSave === null && (
        <button type="button" className="gm-btn" onClick={() => store.dismissNotice()}>
          Dismiss
        </button>
      )}
    </div>
  );
}
