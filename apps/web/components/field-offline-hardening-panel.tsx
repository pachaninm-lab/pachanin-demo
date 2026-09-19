export function FieldOfflineHardeningPanel({ lanes = [], cases = [] }: { lanes?: any[]; cases?: any[] }) {
  return (
    <section className="section-card-tight">
      <div className="section-title">Offline hardening</div>
      <div className="section-stack" style={{ marginTop: 12 }}>
        {lanes.map((lane, index) => (
          <div key={lane.stage || index} className="list-row" style={{ alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{lane.stage || `lane ${index + 1}`}</div>
              <div className="muted tiny" style={{ marginTop: 4 }}>{lane.reason || '—'}</div>
            </div>
            <span className="mini-chip">{lane.status || 'pending'}</span>
          </div>
        ))}
        {cases.map((item, index) => (
          <div key={item.id || index} className="soft-box">
            <b>{item.title || item.id || `case ${index + 1}`}</b>
            <div className="muted tiny" style={{ marginTop: 4 }}>{item.detail || item.reason || '—'}</div>
          </div>
        ))}
        {!lanes.length && !cases.length ? <div className="muted small">Offline hardening cases не заданы.</div> : null}
      </div>
    </section>
  );
}
