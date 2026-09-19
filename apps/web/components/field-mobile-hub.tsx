import Link from 'next/link';

export function FieldMobileHub() {
  return (
    <section className="section-card-tight">
      <div className="section-title">Field mobile hub</div>
      <div className="muted small" style={{ marginTop: 8 }}>Быстрый переход между survey, insurance, disputes и documents прямо из полевого контура.</div>
      <div className="cta-stack" style={{ marginTop: 12 }}>
        <Link href="/surveyor" className="secondary-link">Survey</Link>
        <Link href="/insurance" className="secondary-link">Insurance</Link>
        <Link href="/disputes" className="secondary-link">Disputes</Link>
        <Link href="/documents" className="secondary-link">Documents</Link>
      </div>
    </section>
  );
}
