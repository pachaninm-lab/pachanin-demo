export function LogisticsMapEmbed({ title = 'Logistics map' }: { title?: string }) {
  return (
    <section className="card">
      <div className="section-title">{title}</div>
      <div className="soft-box" style={{ marginTop: 12, minHeight: 220, display: 'grid', placeItems: 'center' }}>
        <div className="muted small">Map embed placeholder</div>
      </div>
    </section>
  );
}
