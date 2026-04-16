'use client';

import * as React from 'react';
import Link from 'next/link';
import { DISPUTES } from '@/lib/v7r/data';
import { formatMoney } from '@/lib/v7r/helpers';
import { useToast } from '@/components/v7r/Toast';
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

export function DisputesRuntime() {
  const toast = useToast();
  const { draftDeals, resolveDraftDispute } = useBuyerRuntimeStore();
  const draftDisputes = draftDeals.filter((item) => item.disputeState === 'open' || item.disputeState === 'resolved');

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Споры и доказательства</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>Здесь объединены доменные споры и draft-сделки, в которых спор уже открыт на persistent runtime-уровне.</div>
          </div>
          <Badge tone='warning'>DISPUTE RUNTIME</Badge>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Доменные споры' value={String(DISPUTES.length)} note='Базовый статический спорный контур.' />
        <StatCard title='Draft-споры' value={String(draftDisputes.filter((item) => item.disputeState === 'open').length)} note='Открыты внутри persistent runtime.' />
        <StatCard title='Закрытые draft-споры' value={String(draftDisputes.filter((item) => item.disputeState === 'resolved').length)} note='Спор закрыт, но карточка ещё сохраняется в истории.' />
        <StatCard title='Удержано в draft' value={formatMoney(draftDisputes.length * 250000)} note='Модельная оценка денег под спором в draft-контуре.' />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Draft-сделки со спором</div>
        {draftDisputes.length === 0 ? <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA', fontSize: 13, color: '#6B778C' }}>Пока нет draft-споров.</div> : draftDisputes.map((item) => (
          <section key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419', marginTop: 4 }}>{item.grain} · {item.volume} т</div>
                <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{item.nextOwner} · документов: {item.docsState} · резерв: {item.reserveState}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge tone={item.disputeState === 'open' ? 'danger' : 'success'}>{item.disputeState}</Badge>
                <Badge tone='warning'>{item.status}</Badge>
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.nextStep}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={`/platform-v7/deal-drafts/${item.id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Открыть draft</Link>
              {item.disputeState === 'open' ? <button onClick={() => { resolveDraftDispute(item.id); toast(`Спор по ${item.id} закрыт.`, 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Закрыть спор</button> : null}
            </div>
          </section>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Доменные споры</div>
        {DISPUTES.map((item) => (
          <section key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419', marginTop: 4 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{item.reasonCode} · сделка {item.dealId}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge tone={item.status === 'open' ? 'danger' : 'success'}>{item.status}</Badge>
                <Badge tone='warning'>{item.ballAt}</Badge>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Удержание</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{formatMoney(item.holdAmount)}</div></div>
              <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>SLA</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.slaDaysLeft} дн.</div></div>
              <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Доказательства</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.evidence.uploaded}/{item.evidence.total}</div></div>
            </div>
          </section>
        ))}
      </section>
    </div>
  );
}
