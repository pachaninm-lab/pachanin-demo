export function OperationalTimeline({ events }: { events: Array<{ id: string; at: string; title: string; detail?: string; owner?: string }> }) {
  return (
    <section className="card">
      <div className="section-title">Operational timeline</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {events.map((event) => (
          <div key={event.id} className="soft-box">
            <div className="list-row"><b>{event.title}</b><span>{event.at}</span></div>
            {event.detail ? <div className="muted small" style={{ marginTop: 6 }}>{event.detail}</div> : null}
            {event.owner ? <div className="muted tiny" style={{ marginTop: 6 }}>owner {event.owner}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
