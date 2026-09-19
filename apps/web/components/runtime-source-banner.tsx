export function RuntimeSourceBanner({ snapshot }: { snapshot?: any }) {
  const source = snapshot?.meta?.source || 'runtime';
  const updatedAt = snapshot?.meta?.lastSimulatedAt || snapshot?.meta?.generatedAt || null;
  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">Runtime source</div>
          <div className="muted tiny" style={{ marginTop: 4 }}>source: {source}</div>
        </div>
        {updatedAt ? <span className="mini-chip">{String(updatedAt).slice(0, 16).replace('T', ' ')}</span> : null}
      </div>
    </section>
  );
}
