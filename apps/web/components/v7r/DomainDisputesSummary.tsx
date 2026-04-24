'use client';

import { useDisputes } from '@/lib/domain/hooks';
import { formatMoney } from '@/lib/v7r/helpers';

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 8 }}>{note}</div>
    </section>
  );
}

export function DomainDisputesSummary() {
  const disputes = useDisputes();
  const openDisputes = disputes.filter((item) => item.status === 'open');
  const totalHold = disputes.reduce((sum, item) => sum + item.holdAmount, 0);
  const missingEvidence = disputes.reduce((sum, item) => sum + Math.max(item.evidence.total - item.evidence.uploaded, 0), 0);

  return (
    <section style={{ display: 'grid', gap: 14 }} aria-label='Доменная сводка споров'>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Споры в домене' value={String(disputes.length)} note='Сводка из единого доменного представления.' />
        <StatCard title='Открытые' value={String(openDisputes.length)} note='Споры, которые ещё влияют на деньги и SLA.' />
        <StatCard title='Удержано' value={formatMoney(totalHold)} note='Суммарные деньги под доменными спорами.' />
        <StatCard title='Не хватает доказательств' value={String(missingEvidence)} note='Сколько доказательств нужно дозагрузить.' />
      </div>
    </section>
  );
}
