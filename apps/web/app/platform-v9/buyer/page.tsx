'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { KpiCard } from '@/components/v9/cards/KpiCard';

export default function BuyerPage() {
  const { data, isLoading } = useQuery<{ data: Array<{id:string;grain:string;quantity:number;unit:string;reservedAmount:number;holdAmount:number;riskScore:number;dispute:{id:string}|null;status:string}> }>({
    queryKey: ['deals'],
    queryFn: () => fetch('/api/deals').then(r => r.json()),
  });

  const deals = data?.data ?? [];
  const myDeals = deals.filter(d => d.riskScore > 0).slice(0, 6);
  const totalBudget = myDeals.reduce((s, d) => s + d.reservedAmount, 0);
  const onHold = myDeals.reduce((s, d) => s + d.holdAmount, 0);
  const inDispute = myDeals.filter(d => d.dispute).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ borderLeft: '4px solid #0284C7', paddingLeft: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Воркспейс покупателя</h1>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>Shortlist, ценовая аналитика и контроль качества сделки</p>
      </div>

      <div className="v9-bento">
        <KpiCard title="Бюджет зарезервирован" value={isLoading ? '—' : `${(totalBudget/1_000_000).toFixed(1)} млн ₽`} loading={isLoading} tone="neutral" />
        <KpiCard title="Под hold" value={isLoading ? '—' : `${(onHold/1_000).toFixed(0)} тыс. ₽`} loading={isLoading} tone={onHold > 0 ? 'danger' : 'success'} />
        <KpiCard title="Споры" value={isLoading ? '—' : String(inDispute)} loading={isLoading} tone={inDispute > 0 ? 'warning' : 'success'} />
        <KpiCard title="Активных сделок" value={isLoading ? '—' : String(myDeals.length)} loading={isLoading} tone="neutral" />
      </div>

      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Мои сделки</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {myDeals.map(deal => (
            <Link key={deal.id} href={`/platform-v9/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#FAFAFA', borderRadius: 6, border: '1px solid #E4E6EA' }}>
              <div>
                <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: '#0A7A5F' }}>{deal.id}</div>
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{deal.grain} · {deal.quantity} {deal.unit}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {deal.dispute && <Badge variant="danger" dot>Спор</Badge>}
                {deal.holdAmount > 0 && <Badge variant="danger">Hold {(deal.holdAmount/1000).toFixed(0)} тыс. ₽</Badge>}
                <span style={{ fontSize: 12, color: '#0A7A5F', fontWeight: 600 }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Требуют действия</h2>
        <div style={{ padding: '12px 14px', background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>DL-9102 · Подтвердить частичный release 70%</div>
          <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Лаб-результат получен · Спор DK-2024-89</div>
          <Button variant="primary" size="sm" style={{ marginTop: 10 }} asChild>
            <Link href="/platform-v9/deals/DL-9102">Перейти к сделке →</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
