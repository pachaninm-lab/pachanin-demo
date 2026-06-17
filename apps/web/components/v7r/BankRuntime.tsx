'use client';

import Link from 'next/link';
import { CALLBACKS, DEALS, getDealIntegrationState } from '@/lib/v7r/data';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';
import { getTransportHotlist } from '@/lib/v7r/transport-docs';

function card(title: string, value: string, note: string) {
  return (
    <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: 'var(--pc-text-muted, #6B778C)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)', marginTop: 8, wordBreak: 'break-word' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6, marginTop: 8, wordBreak: 'break-word' }}>{note}</div>
    </section>
  );
}

export function BankRuntime() {
  const totalReserved = DEALS.reduce((sum, item) => sum + item.reservedAmount, 0);
  const totalHold = DEALS.reduce((sum, item) => sum + item.holdAmount, 0);
  const reviewSum = DEALS.reduce((sum, item) => sum + (item.releaseAmount ?? Math.max(item.reservedAmount - item.holdAmount, 0)), 0);
  const callbacksToReview = CALLBACKS.filter((item) => item.status !== 'ok').length;
  const transportHotlist = getTransportHotlist().slice(0, 3);

  const rows = DEALS.map((deal) => {
    const integration = getDealIntegrationState(deal.id, deal.lotId);
    return {
      id: deal.id,
      buyer: deal.buyer.name,
      seller: deal.seller.name,
      status: statusLabel(deal.status),
      nextOwner: integration.nextOwner ?? '—',
      nextStep: integration.nextStep ?? 'Нужно уточнение оператором',
    };
  });

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0', maxWidth: '100%', overflowX: 'hidden' }}>
      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Банковский контур</div>
        <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>Проверка основания, документов, статусов и следующих действий по сделке.</div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {card('В резерве', formatCompactMoney(totalReserved), 'Сумма в контуре проверки.')}
        {card('Под удержанием', formatCompactMoney(totalHold), 'Часть, требующая разбора.')}
        {card('К проверке', formatCompactMoney(reviewSum), 'Основание после закрытия блокеров.')}
        {card('События', String(callbacksToReview), 'Требуют внимания оператора.')}
      </div>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Очередь сделок</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <div key={row.id} style={{ border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{row.id}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--pc-text-secondary, #475569)' }}>{row.seller} → {row.buyer}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-secondary, #334155)', fontSize: 11, fontWeight: 800 }}>{row.status}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.6 }}>Следующий владелец: {row.nextOwner}<br />Следующий шаг: {row.nextStep}</div>
              <Link href={`/platform-v7/deals/${row.id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-primary, #0F1419)', fontSize: 12, fontWeight: 700, width: 'fit-content' }}>Открыть сделку</Link>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Транспортные документы</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {transportHotlist.map((item) => (
            <div key={item.id} style={{ background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{item.providerLabel}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{item.title}</div>
              <div style={{ fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.6 }}>{item.note}</div>
              <Link href={item.primaryHref} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-primary, #0F1419)', fontSize: 12, fontWeight: 700, width: 'fit-content' }}>Открыть пакет</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
