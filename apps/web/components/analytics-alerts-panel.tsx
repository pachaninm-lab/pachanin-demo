export function AnalyticsAlertsPanel({ alerts }: { alerts: Array<{ id: string; title: string; detail: string; level?: 'green' | 'amber' | 'red' }> }) {
  return (
    <section className="card">
      <div className="section-title">Analytics alerts</div>
      <div className="muted small" style={{ marginTop: 8 }}>Сигналы рынка и исполнения, которые должны вести к действию, а не оставаться в наблюдении.</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {alerts.map((alert) => (
          <div key={alert.id} className="soft-box">
            <div className="list-row">
              <b>{alert.title}</b>
              <span className={alert.level === 'green' ? 'highlight-green' : alert.level === 'red' ? 'highlight-red' : 'highlight-amber'}>{alert.level || 'amber'}</span>
            </div>
            <div className="muted small" style={{ marginTop: 6 }}>{alert.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
