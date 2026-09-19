export function OfflineFallback({ title = 'Offline fallback', detail = 'Сеть недоступна. Локальный контур продолжает хранить действия до синхронизации.' }: { title?: string; detail?: string }) {
  return (
    <section className="soft-box">
      <b>{title}</b>
      <div className="muted small" style={{ marginTop: 6 }}>{detail}</div>
    </section>
  );
}
