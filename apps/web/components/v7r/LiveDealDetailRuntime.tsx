'use client';

import * as React from 'react';
import Link from 'next/link';
import { useToast } from '@/components/v7r/Toast';
import { DEALS, getDisputeById } from '@/lib/v7r/data';
import { formatMoney, statusLabel } from '@/lib/v7r/helpers';
import { useLiveDealRuntimeStore } from '@/stores/useLiveDealRuntimeStore';

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

function blockerTone(code: string) {
  if (code === 'dispute') return 'danger' as const;
  if (code === 'bank_confirm' || code === 'docs') return 'warning' as const;
  return 'neutral' as const;
}

export function LiveDealDetailRuntime({ id }: { id: string }) {
  const toast = useToast();
  const base = DEALS.find((item) => item.id === id) ?? null;
  const ensureDeal = useLiveDealRuntimeStore((state) => state.ensureDeal);
  const startDocs = useLiveDealRuntimeStore((state) => state.startDocs);
  const completeDocs = useLiveDealRuntimeStore((state) => state.completeDocs);
  const requestRelease = useLiveDealRuntimeStore((state) => state.requestRelease);
  const releaseFunds = useLiveDealRuntimeStore((state) => state.releaseFunds);
  const openDispute = useLiveDealRuntimeStore((state) => state.openDispute);
  const resolveDispute = useLiveDealRuntimeStore((state) => state.resolveDispute);
  const override = useLiveDealRuntimeStore((state) => state.overrides[id]);

  React.useEffect(() => {
    ensureDeal(id);
  }, [ensureDeal, id]);

  if (!base) {
    return (
      <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Сделка не найдена</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>Сделка {id} отсутствует в доменном контуре.</div>
          <Link href='/platform-v7/deals' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Все сделки</Link>
        </section>
      </div>
    );
  }

  const state = override ?? ensureDeal(id);
  if (!state) return null;

  const dispute = base.dispute ? getDisputeById(base.dispute.id) : null;
  const reservedAmount = base.reservedAmount;
  const releaseAmount = state.releaseAmount ?? base.releaseAmount ?? Math.max(reservedAmount - state.holdAmount, 0);

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{base.id}</div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419', marginTop: 6 }}>{base.grain} · {base.quantity} {base.unit}</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>{base.seller.name} → {base.buyer.name} · {statusLabel(state.status)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge tone={state.status === 'release_approved' || state.status === 'closed' ? 'success' : state.status === 'quality_disputed' || state.status === 'release_requested' ? 'danger' : 'warning'}>{statusLabel(state.status)}</Badge>
            <Badge tone={state.disputeState === 'open' ? 'danger' : state.disputeState === 'resolved' ? 'success' : 'neutral'}>{state.disputeState}</Badge>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Резерв' value={formatMoney(reservedAmount)} note='Сумма под резервом по сделке.' />
        <StatCard title='Удержание' value={formatMoney(state.holdAmount)} note='Сумма удержания из-за блокеров или спора.' />
        <StatCard title='К выпуску' value={formatMoney(releaseAmount)} note='Сумма, доступная к выпуску при закрытых блокерах.' />
        <StatCard title='SLA' value={base.slaDeadline ?? '—'} note={state.nextStep} />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Контур сделки</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Документы</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{state.docsState}</div></div>
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Резерв / выпуск</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{state.reserveState}</div></div>
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий владелец</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{state.nextOwner}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {state.blockers.length ? state.blockers.map((blocker) => <Badge key={blocker} tone={blockerTone(blocker)}>{blocker}</Badge>) : <Badge tone='success'>blockers cleared</Badge>}
        </div>
      </section>

      {dispute ? (
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Связанный спор</div>
            <Badge tone={state.disputeState === 'open' ? 'danger' : 'success'}>{state.disputeState}</Badge>
          </div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{dispute.title} · {dispute.reasonCode} · evidence {dispute.evidence.uploaded}/{dispute.evidence.total}</div>
        </section>
      ) : null}

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Действия</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {state.docsState === 'missing' ? <button onClick={() => { startDocs(id); toast('Сбор документов по сделке запущен.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Начать сбор документов</button> : null}
          {state.docsState !== 'complete' ? <button onClick={() => { completeDocs(id); toast('Документный пакет сделки собран.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Документы собраны</button> : null}
          {state.docsState === 'complete' && state.reserveState === 'reserved' && state.disputeState !== 'open' ? <button onClick={() => { requestRelease(id); toast('Запрос на выпуск денег по сделке создан.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Запросить выпуск денег</button> : null}
          {state.reserveState === 'pending_release' ? <button onClick={() => { releaseFunds(id); toast('Деньги по сделке выпущены.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Выпустить деньги</button> : null}
          {state.disputeState !== 'open' && state.reserveState !== 'released' ? <button onClick={() => { openDispute(id); toast('Спор по сделке открыт.', 'warning'); }} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Открыть спор</button> : null}
          {state.disputeState === 'open' ? <button onClick={() => { resolveDispute(id); toast('Спор по сделке закрыт.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Закрыть спор</button> : null}
          <Link href='/platform-v7/bank' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Банк</Link>
          <Link href='/platform-v7/disputes' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Споры</Link>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Журнал событий сделки</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {state.events.map((event, index) => (
            <div key={`${event.ts}-${index}`} style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{event.actor}</div>
                <div style={{ fontSize: 12, color: '#6B778C' }}>{event.ts}</div>
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>{event.action}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
