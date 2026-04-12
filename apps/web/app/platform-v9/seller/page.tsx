'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { KpiCard } from '@/components/v9/cards/KpiCard';

export default function SellerPage() {
  const { data, isLoading } = useQuery<{ data: Array<{id:string;grain:string;quantity:number;unit:string;reservedAmount:number;holdAmount:number;riskScore:number;blockers:string[];status:string}> }>({
    queryKey: ['deals'],
    queryFn: () => fetch('/api/deals').then(r => r.json()),
  });

  const deals = data?.data ?? [];
  const active = deals.filter(d => d.status !== 'closed').slice(0, 6);
  const totalExpected = active.reduce((s, d) => s + d.reservedAmount, 0);
  const stuck = active.reduce((s, d) => s + d.holdAmount, 0);
  const blockers = active.filter(d => d.blockers.length > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ borderLeft: '4px solid #16A34A', paddingLeft: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Воркспейс продавца</h1>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>Ожидаемые деньги, лоты и блокеры</p>
      </div>

      <div className="v9-bento">
        <KpiCard title="Ожидается выплат" value={isLoading ? '—' : `${(totalExpected/1_000_000).toFixed(1)} млн ₽`} loading={isLoading} tone="neutral" />
        <KpiCard title="Заморожено" value={isLoading ? '—' : `${(stuck/1_000).toFixed(0)} тыс. ₽`} loading={isLoading} tone={stuck > 0 ? 'danger' : 'success'} />
        <KpiCard title="Блокеры" value={isLoading ? '—' : String(blockers)} loading={isLoading} tone={blockers > 0 ? 'warning' : 'success'} />
        <KpiCard title="Активных сделок" value={isLoading ? '—' : String(active.length)} loading={isLoading} tone="neutral" />
      </div>

      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Приоритетные действия</h2>
        <div style={{ padding: '12px 14px', background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 6, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>DL-9102 · Загрузить акт приёмки (форма А)</div>
          <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Блокирует release 3 200 000 ₽</div>
          <Button variant="primary" size="sm" style={{ marginTop: 10 }} asChild>
            <Link href="/platform-v9/deals/DL-9102">Загрузить документ →</Link>
          </Button>
        </div>
      </section>

      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Мои сделки</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {active.map(deal => (
            <Link key={deal.id} href={`/platform-v9/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#FAFAFA', borderRadius: 6, border: '1px solid #E4E6EA' }}>
              <div>
                <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: '#0A7A5F' }}>{deal.id}</div>
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{deal.grain} · {deal.quantity} {deal.unit}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {deal.blockers.length > 0 && <Badge variant="warning">Блокер</Badge>}
                {deal.holdAmount > 0 && <Badge variant="danger">Hold</Badge>}
                <span style={{ fontSize: 12, color: '#0A7A5F', fontWeight: 600 }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
