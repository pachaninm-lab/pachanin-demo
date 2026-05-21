'use client';

import { useDeals, useDomainTotals } from '@/lib/domain/hooks';
import { formatCompactMoney } from '@/lib/v7r/helpers';

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 8 }}>{note}</div>
    </section>
  );
}

export function DomainDealsSummary() {
  const deals = useDeals();
  const totals = useDomainTotals();
  const activeDeals = deals.filter((deal) => deal.status !== 'closed');
  const highRisk = activeDeals.filter((deal) => deal.riskScore >= 70).length;
  const releaseRequested = activeDeals.filter((deal) => deal.status === 'release_requested').length;

  return (
    <section style={{ display: 'grid', gap: 14 }} aria-label='Доменная сводка сделок'>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Сделки в домене' value={String(deals.length)} note='Все сделки из единого доменного представления.' />
        <StatCard title='Активные сделки' value={String(activeDeals.length)} note='Без закрытых архивных кейсов.' />
        <StatCard title='В резерве' value={formatCompactMoney(totals.reserveTotal)} note='Сумма резерва по активным сделкам.' />
        <StatCard title='Под удержанием' value={formatCompactMoney(totals.heldTotal)} note='Сумма денег под спором или проверкой.' />
        <StatCard title='К выпуску' value={formatCompactMoney(totals.readyToReleaseTotal)} note='Сумма, ближайшая к выпуску денег.' />
        <StatCard title='Высокий риск' value={String(highRisk)} note='Сделки с risk ≥ 70.' />
        <StatCard title='Ожидают выпуск' value={String(releaseRequested)} note='Сделки в статусе запроса выпуска.' />
      </div>
    </section>
  );
}
