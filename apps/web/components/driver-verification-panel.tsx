export function DriverVerificationPanel({ requirePin, requireGeo, assignment }: { requirePin?: boolean; requireGeo?: boolean; assignment?: any }) {
  return (
    <section className="section-card-tight">
      <div className="section-title">Driver verification</div>
      <div className="section-stack" style={{ marginTop: 12 }}>
        <div className="list-row"><span>PIN check</span><b>{requirePin ? 'required' : 'optional'}</b></div>
        <div className="list-row"><span>Geo check</span><b>{requireGeo ? 'required' : 'optional'}</b></div>
        <div className="list-row"><span>Assignment</span><b>{assignment?.tripId || '—'}</b></div>
        {assignment ? <div className="muted tiny">{assignment.driverName || 'driver'} · {assignment.routeSummary || 'route'} · {assignment.etaLabel || 'ETA —'}</div> : null}
      </div>
    </section>
  );
}
