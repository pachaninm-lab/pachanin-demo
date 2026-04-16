'use client';

import * as React from 'react';
import Link from 'next/link';
import { DEALS, type Deal } from '@/lib/v7r/data';
import { formatMoney, statusLabel } from '@/lib/v7r/helpers';
import { useBuyerRuntimeStore } from '@/stores/useBuyerRuntimeStore';

function palette(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'warning') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  if (tone === 'danger') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return { bg: '#F8FAFB', border: '#E4E6EA', color: '#475569' };
}

function Badge({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'neutral'; children: React.ReactNode }) {
  const p = palette(tone);
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, color: p.color, fontSize: 11, fontWeight: 800 }}>{children}</span>;
}

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 8 }}>{note}</div>
    </section>
  );
}

function toneByDealStatus(item: Deal) {
  if (item.status === 'quality_disputed') return 'danger' as const;
  if (item.status === 'in_transit' || item.status === 'payment_reserved' || item.status === 'release_requested') return 'warning' as const;
  return 'success' as const;
}

export function DealsOverviewRuntime() {
  const { draftDeals, removeDraftDeal } = useBuyerRuntimeStore();
  const highRisk = DEALS.filter((item) => item.riskScore >= 70).length;
  const releaseRequested = DEALS.filter((item) => item.status === 'release_requested').length;

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Сделки</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>Здесь объединены доменные сделки и новые persistent draft-сделки покупателя. Draft’ы честно вынесены отдельно: это ещё не боевые сделки, а подготовленный вход в договорный и денежный слой.</div>
          </div>
          <Link href='/platform-v7/procurement' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700 }}>Открыть закупку</Link>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Боевые сделки' value={String(DEALS.length)} note='Базовый доменный контур.' />
        <StatCard title='Draft-сделки' value={String(draftDeals.length)} note='Созданы через procurement runtime.' />
        <StatCard title='Высокий риск' value={String(highRisk)} note='Сделки с risk ≥ 70.' />
        <StatCard title='Ожидают выпуск' value={String(releaseRequested)} note='Сделки на release step.' />
      </div>

      {draftDeals.length ? (
        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Draft-сделки</div>
          {draftDeals.map((item) => (
            <section key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419', marginTop: 4 }}>{item.grain} · {item.volume} т</div>
                  <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{item.region} · {item.sellerName} → {item.buyerName}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge tone='neutral'>{item.sourceType}</Badge>
                  <Badge tone='warning'>{item.status}</Badge>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.nextStep}</div></div>
                <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Деньги и документы</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>Резерв: {item.reserveState} · Документы: {item.docsState}</div></div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href={`/platform-v7/deal-drafts/${item.id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700 }}>Открыть draft</Link>
                <button onClick={() => removeDraftDeal(item.id)} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Удалить</button>
              </div>
            </section>
          ))}
        </section>
      ) : null}

      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Доменные сделки</div>
        {DEALS.map((item) => (
          <Link key={item.id} href={`/platform-v7/deals/${item.id}`} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'center' }}>
            <div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div><div style={{ fontSize: 15, fontWeight: 800, color: '#0F1419', marginTop: 4 }}>{item.grain}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{item.seller.name} → {item.buyer.name}</div></div>
            <div><Badge tone={toneByDealStatus(item)}>{statusLabel(item.status)}</Badge></div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F1419' }}>{formatMoney(item.reservedAmount)}</div>
            <div style={{ fontSize: 12, color: '#6B778C' }}>Риск: {item.riskScore}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}
