export function TabBlocked({ onPlayHere }: { onPlayHere: () => void }) {
  return (
    <div className="gm-blocked">
      <h1 className="gm-blocked__title">The Golden Minder</h1>
      <p>The Golden Minder is open in another tab.</p>
      <button type="button" className="gm-btn gm-btn--primary" onClick={onPlayHere}>
        Play here
      </button>
    </div>
  );
}
