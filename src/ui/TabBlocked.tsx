export function TabBlocked({ onPlayHere }: { onPlayHere: () => void }) {
  return (
    <div className="gm-blocked">
      <h1 className="gm-blocked__title">Golden Miner</h1>
      <p>Golden Miner is open in another tab.</p>
      <button type="button" className="gm-btn gm-btn--primary" onClick={onPlayHere}>
        Play here
      </button>
    </div>
  );
}
