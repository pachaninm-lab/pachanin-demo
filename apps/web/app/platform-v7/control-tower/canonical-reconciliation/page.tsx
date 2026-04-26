import Link from 'next/link';
import { CanonicalKpiReconciliation } from '@/components/v7r/CanonicalKpiReconciliation';

export default function PlatformV7CanonicalReconciliationPage() {
  return (
    <main style={{ display: 'grid', gap: 18 }}>
      <section style={{ border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          E1 · read-only bridge
        </div>
        <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, color: '#0F1419' }}>Сверка canonical KPI</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#475569', maxWidth: 920 }}>
          Эта страница нужна для безопасной миграции: текущая формула KPI остаётся рабочей, canonical domain считается параллельно. Экран не включает новые денежные действия и не меняет runtime-состояние сделки.
        </p>
        <div>
          <Link href='/platform-v7/control-tower' style={{ display: 'inline-flex', border: '1px solid #E4E6EA', borderRadius: 10, padding: '8px 12px', textDecoration: 'none', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
            ← Центр управления
          </Link>
        </div>
      </section>

      <CanonicalKpiReconciliation />
    </main>
  );
}
