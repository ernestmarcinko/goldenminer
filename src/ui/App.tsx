export function App() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--gm-ground)' }}>
      <header
        style={{
          padding: '14px 24px',
          background: 'var(--gm-header)',
          borderBottom: '1px solid var(--gm-line)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--gm-font-display)',
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: '0.04em',
            color: 'var(--gm-gold)',
          }}
        >
          Golden Miner
        </div>
      </header>
    </div>
  );
}
