import Link from 'next/link';
import { DEALS } from '@/lib/v7r/data';

export default function LogisticsPage() {
  const routes = DEALS.filter(d => d.routeId);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Логистика</h1>

      <div style={{ display: 'grid', gap: 12 }}>
        {routes.map((d) => (
          <div key={d.id} style={{ border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{d.routeId}</div>
                <div style={{ fontSize: 12, color: '#6B778C' }}>{d.grain} · {d.quantity} т</div>
              </div>
              <div style={{ fontWeight: 700 }}>{d.routeState}</div>
            </div>

            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
              <div>Сделка: {d.id}</div>
              <Link href={`/platform-v7/deals/${d.id}`} style={{ color: '#0A7A5F', fontWeight: 700 }}>Открыть</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
