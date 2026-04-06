import Link from 'next/link';

export function SberMoneyRailPanel({ events }: { events: Array<{ id: string; title: string; status: string; detail?: string }> }) {
  return (
    <section className="card">
      <div className="section-title">Sber money rail</div>
      <div className="muted small" style={{ marginTop: 8 }}>Слой банковых событий рядом со сделкой: reserve, callbacks, hold, release и возврат.</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {events.map((event) => (
          <div key={event.id} className="soft-box">
            <div className="list-row"><b>{event.title}</b><span className="mini-chip">{event.status}</span></div>
            {event.detail ? <div className="muted small" style={{ marginTop: 6 }}>{event.detail}</div> : null}
          </div>
        ))}
      </div>
      <div className="cta-stack" style={{ marginTop: 12 }}>
        <Link href="/sber" className="secondary-link">Открыть Sber rail</Link>
        <Link href="/payments" className="secondary-link">Открыть payments</Link>
      </div>
    </section>
  );
}
