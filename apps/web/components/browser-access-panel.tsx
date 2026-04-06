export function BrowserAccessPanel({ surface }: { surface: string }) {
  return (
    <section className="section-card-tight">
      <div className="section-title">Browser access</div>
      <div className="muted small" style={{ marginTop: 8 }}>
        Surface: {surface}. Этот блок должен честно показывать ограничения браузерного режима: background sync, GPS, camera/upload и offline queue.
      </div>
    </section>
  );
}
