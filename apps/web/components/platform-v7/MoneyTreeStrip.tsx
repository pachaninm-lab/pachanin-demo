'use client';

import { canonicalDomainDeals } from '@/lib/domain/selectors';
import { calculateMoneyTree } from '@/lib/platform-v7/domain/money';
import { formatCompactMoney } from '@/lib/v7r/helpers';

export function MoneyTreeStrip() {
  const tree = calculateMoneyTree(canonicalDomainDeals.filter((deal) => deal.money.reservedAmount > 0));
  const partsTotal = tree.parts.reduce((sum, bucket) => sum + bucket.amount, 0);
  const balanced = tree.isBalanced;

  return (
    <section data-testid="platform-v7-money-tree-strip" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Деньги · без двойного счёта</div>
          <div style={{ marginTop: 4, fontSize: 22, lineHeight: 1.12, fontWeight: 950, color: '#0F1419' }}>{tree.reserved.label}: {formatCompactMoney(tree.reserved.amount)}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>Резерв — верхний контейнер. Корзины ниже являются разбиением этого резерва, а не отдельными деньгами.</div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#94A3B8', lineHeight: 1.45 }}>Сверка: {formatCompactMoney(partsTotal)} из {formatCompactMoney(tree.reserved.amount)} · остаток {formatCompactMoney(tree.remainder)}</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 999, border: balanced ? '1px solid rgba(10,122,95,0.18)' : '1px solid rgba(220,38,38,0.18)', background: balanced ? 'rgba(10,122,95,0.08)' : 'rgba(220,38,38,0.08)', color: balanced ? '#0A7A5F' : '#B91C1C', fontSize: 12, fontWeight: 900 }}>
          {balanced ? 'Суммы сходятся' : 'Нужна сверка'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {tree.parts.map((bucket) => {
          const width = tree.reserved.amount ? Math.round((bucket.amount / tree.reserved.amount) * 100) : 0;
          return (
            <div key={bucket.key} style={{ display: 'grid', gap: 5 }} title={bucket.formula}>
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
