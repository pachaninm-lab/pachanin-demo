'use client';

import { useDeals, useDomainTotals } from '@/lib/domain/hooks';
import { selectCanonicalDeals } from '@/lib/domain/selectors';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { formatCompactMoney } from '@/lib/v7r/helpers';

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: 'var(--pc-text-muted, #6B778C)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6, marginTop: 8 }}>{note}</div>
    </section>
  );
}

export function DomainMoneySummary() {
  const deals = useDeals();
  const totals = useDomainTotals();
  const activeDeals = deals.filter((deal) => deal.status !== 'closed');
  const reservedDeals = activeDeals.filter((deal) => deal.reservedAmount > 0).length;
  const heldDeals = activeDeals.filter((deal) => deal.holdAmount > 0).length;
  const readyDeals = selectCanonicalDeals(activeDeals).filter((deal) => evaluateReleaseGuard(deal).canExecuteRelease).length;

  return (
    <section style={{ display: 'grid', gap: 14 }} aria-label='Доменная денежная сводка'>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='В резерве' value={formatCompactMoney(totals.reserveTotal)} note={`${reservedDeals} активных сделок с зарезервированной суммой.`} />
        <StatCard title='Под удержанием' value={formatCompactMoney(totals.heldTotal)} note={`${heldDeals} активных сделок с удержанием.`} />
        <StatCard title='К банковскому шагу' value={formatCompactMoney(totals.readyToReleaseTotal)} note={`${readyDeals} сделок проходят строгую матрицу: резерв, документы, ФГИС/СДИЗ, рейс, приёмка, качество, спор и банк.`} />
      </div>
    </section>
  );
}
