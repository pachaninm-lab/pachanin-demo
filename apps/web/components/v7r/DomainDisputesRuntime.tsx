'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useDisputes } from '@/lib/domain/hooks';
import { formatMoney } from '@/lib/v7r/helpers';
import { translateRole } from '@/lib/i18n/reason-codes';

function palette(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'warning') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  if (tone === 'danger') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return { bg: '#F8FAFB', border: '#E4E6EA', color: '#475569' };
}

function Badge({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'neutral'; children: ReactNode }) {
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

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{value}</div>
    </div>
  );
}

export function DomainDisputesRuntime() {
  const disputes = useDisputes();
  const openDisputes = disputes.filter((item) => item.status === 'open');
  const totalHold = disputes.reduce((sum, item) => sum + item.holdAmount, 0);
  const missingEvidence = disputes.reduce((sum, item) => sum + Math.max(item.evidence.total - item.evidence.uploaded, 0), 0);

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Споры и доказательства</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>Экран читает доменный слой споров. Оператор видит деньги под удержанием, недостающие доказательства и следующего владельца действия.</div>
          </div>
          <Badge tone='warning'>Доменный слой</Badge>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Всего споров' value={String(disputes.length)} note='Все споры из единого доменного представления.' />
        <StatCard title='Открытые' value={String(openDisputes.length)} note='Споры, которые ещё влияют на деньги и SLA.' />
        <StatCard title='Удержано' value={formatMoney(totalHold)} note='Суммарные деньги под спором.' />
        <StatCard title='Не хватает доказательств' value={String(missingEvidence)} note='Сколько доказательств нужно дозагрузить.' />
      </div>

      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Доменные споры</div>
        {disputes.map((item) => (
          <article key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#0F1419', lineHeight: 1.2 }}>{item.id} · {item.title}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: '#6B778C' }}>{item.reasonCode} · сделка {item.dealId}</div>
              </div>
              <Badge tone={item.status === 'open' ? 'danger' : 'success'}>{item.status === 'open' ? 'Открыт' : 'Закрыт'}</Badge>
            </div>

            <div style={{ padding: 14, borderRadius: 14, background: '#FEF2F2', border: '1px solid #FECACA', display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 11, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Что случилось</div>
              <div style={{ fontSize: 13, color: '#7F1D1D', lineHeight: 1.5 }}>{item.description}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
              <InfoCell label='Удержание' value={formatMoney(item.holdAmount)} />
              <InfoCell label='SLA' value={`${item.slaDaysLeft} дн.`} />
              <InfoCell label='Доказательства' value={`${item.evidence.uploaded}/${item.evidence.total}`} />
              <InfoCell label='Следующий владелец' value={translateRole(item.ballAt)} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={`/platform-v7/disputes/${item.id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>Открыть спор</Link>
              <Link href={`/platform-v7/deals/${item.dealId}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 800 }}>Открыть сделку</Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
