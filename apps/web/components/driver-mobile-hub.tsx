import Link from 'next/link';

export function DriverMobileHub() {
  return (
    <section className="section-card-tight">
      <div className="section-title">Driver mobile hub</div>
      <div className="muted small" style={{ marginTop: 8 }}>Быстрый переход между assignment, route follow-up, receiving и weight rail.</div>
      <div className="cta-stack" style={{ marginTop: 12 }}>
        <Link href="/dispatch" className="secondary-link">Dispatch</Link>
        <Link href="/logistics" className="secondary-link">Логистика</Link>
        <Link href="/receiving" className="secondary-link">Приёмка</Link>
        <Link href="/weighbridge" className="secondary-link">Весовая</Link>
      </div>
    </section>
  );
}
