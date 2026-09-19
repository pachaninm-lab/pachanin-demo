export function WeakConnectionModePanel({ enabled, note }: { enabled: boolean; note?: string }) {
  return (
    <section className="soft-box">
      <div className="list-row">
        <b>Weak connection mode</b>
        <span className={enabled ? 'highlight-amber' : 'highlight-green'}>{enabled ? 'ON' : 'OFF'}</span>
      </div>
      <div className="muted small" style={{ marginTop: 6 }}>
        {note || (enabled ? 'Платформа временно работает в упрощённом режиме до восстановления сети.' : 'Связь стабильна, основной контур доступен полностью.')}
      </div>
    </section>
  );
}
