'use client';

import { selectRuntimeDeals } from '@/lib/domain/selectors';
import { formatCompactMoney } from '@/lib/v7r/helpers';

type BucketKey = 'ready' | 'held' | 'dispute' | 'documents' | 'manual' | 'notReady';

type Bucket = {
  key: BucketKey;
  label: string;
  amount: number;
  dealIds: string[];
};

const BUCKETS: Record<BucketKey, string> = {
  ready: 'К выпуску',
  held: 'Удержано',
  dispute: 'Заблокировано спором',
  documents: 'Заблокировано документами',
  manual: 'На ручной проверке банка',
  notReady: 'Недоступно к выпуску',
};

function resolveBucket(deal: ReturnType<typeof selectRuntimeDeals>[number]): BucketKey {
  if (deal.dispute || deal.status === 'quality_disputed') return 'dispute';
  if (deal.blockers.some((blocker) => blocker.includes('docs') || blocker.includes('DOCS'))) return 'documents';
  if (deal.blockers.some((blocker) => blocker.includes('bank') || blocker.includes('BANK'))) return 'manual';
  if (deal.holdAmount > 0) return 'held';
  if ((deal.releaseAmount ?? 0) > 0 && deal.blockers.length === 0) return 'ready';
  return 'notReady';
}

export function MoneyTreeStrip() {
  const deals = selectRuntimeDeals().filter((deal) => deal.reservedAmount > 0);
  const totalReserved = deals.reduce((sum, deal) => sum + deal.reservedAmount, 0);
  const buckets = new Map<BucketKey, Bucket>(
    (Object.keys(BUCKETS) as BucketKey[]).map((key) => [key, { key, label: BUCKETS[key], amount: 0, dealIds: [] }]),
  );

  for (const deal of deals) {
    const key = resolveBucket(deal);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.amount += deal.reservedAmount;
    bucket.dealIds.push(deal.id);
  }

  const parts = [...buckets.values()];
  const partsTotal = parts.reduce((sum, bucket) => sum + bucket.amount, 0);
  const balanced = partsTotal === totalReserved;

  return (
    <section data-testid="platform-v7-money-tree-strip" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>MoneyTree · деньги без двойного счёта</div>
          <div style={{ marginTop: 4, fontSize: 22, lineHeight: 1.12, fontWeight: 950, color: '#0F1419' }}>Всего в резерве: {formatCompactMoney(totalReserved)}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>Резерв — это верхний контейнер. Части ниже не складываются как независимые деньги.</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 999, border: balanced ? '1px solid rgba(10,122,95,0.18)' : '1px solid rgba(220,38,38,0.18)', background: balanced ? 'rgba(10,122,95,0.08)' : 'rgba(220,38,38,0.08)', color: balanced ? '#0A7A5F' : '#B91C1C', fontSize: 12, fontWeight: 900 }}>
          {balanced ? 'Суммы сходятся' : 'Нужна сверка'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {parts.map((bucket) => {
          const width = totalReserved ? Math.round((bucket.amount / totalReserved) * 100) : 0;
          return (
            <div key={bucket.key} style={{ display: 'grid', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 850, color: '#0F1419' }}>{bucket.label}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#64748B' }}>{formatCompactMoney(bucket.amount)} · {bucket.dealIds.length} сделок</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
                <div style={{ width: `${width}%`, height: '100%', borderRadius: 999, background: bucket.amount > 0 ? '#0A7A5F' : '#CBD5E1' }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
