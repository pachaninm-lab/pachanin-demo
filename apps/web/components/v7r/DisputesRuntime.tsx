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

function DisputeCard({
  title,
  subtitle,
  reason,
  hold,
  sla,
  evidence,
  statusTone,
  statusLabel,
  href,
  nextOwner,
  nextStep,
  actionLabel,
  secondaryAction,
}: {
  title: string;
  subtitle: string;
  reason: string;
  hold: string;
  sla: string;
  evidence: string;
  statusTone: 'success' | 'warning' | 'danger' | 'neutral';
  statusLabel: string;
  href: string;
  nextOwner: string;
  nextStep: string;
  actionLabel: string;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <article style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0F1419', lineHeight: 1.2 }}>{title}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#6B778C' }}>{subtitle}</div>
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>

      <div style={{ padding: 14, borderRadius: 14, background: '#FEF2F2', border: '1px solid #FECACA', display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 11, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Что случилось</div>
        <div style={{ fontSize: 13, color: '#7F1D1D', lineHeight: 1.5 }}>{reason}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <InfoCell label='Удержание' value={hold} />
        <InfoCell label='SLA' value={sla} />
        <InfoCell label='Доказательства' value={evidence} />
      </div>

      <div style={{ padding: 14, borderRadius: 14, background: 'rgba(10,122,95,0.05)', border: '1px solid rgba(10,122,95,0.14)', display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{nextStep}</div>
        <div style={{ fontSize: 12, color: '#6B778C' }}>Следующий владелец: {nextOwner}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={href} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>{actionLabel}</Link>
        {secondaryAction}
      </div>
    </article>
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
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>Экран перестроен под действие: кто держит следующий шаг, сколько денег под риском, каких доказательств не хватает и куда идти дальше.</div>
          </div>
          <Badge tone='warning'>DISPUTE RUNTIME</Badge>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Доменные споры' value={String(DISPUTES.length)} note='Базовый статический спорный контур.' />
        <StatCard title='Draft-споры' value={String(draftDisputes.filter((item) => item.disputeState === 'open').length)} note='Открыты внутри persistent runtime.' />
        <StatCard title='Закрытые draft-споры' value={String(draftDisputes.filter((item) => item.disputeState === 'resolved').length)} note='Спор закрыт, но карточка остаётся в истории.' />
        <StatCard title='Удержано в draft' value={formatMoney(draftDisputes.length * 250000)} note='Модельная сумма денег под draft-спорами.' />
      </div>

      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Draft-сделки со спором</div>
        {draftDisputes.length === 0 ? (
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA', fontSize: 13, color: '#6B778C' }}>Пока нет draft-споров.</div>
        ) : draftDisputes.map((item) => (
          <DisputeCard
            key={item.id}
            title={`${item.id} · ${item.grain} · ${item.volume} т`}
            subtitle={`${item.nextOwner} · документы: ${item.docsState} · резерв: ${item.reserveState}`}
            reason={item.nextStep}
            hold={formatMoney(250000)}
            sla={item.disputeState === 'open' ? '2 дн.' : 'Закрыт'}
            evidence={item.disputeState === 'open' ? '2/4' : '4/4'}
            statusTone={item.disputeState === 'open' ? 'danger' : 'success'}
            statusLabel={item.disputeState}
            href={`/platform-v7/deal-drafts/${item.id}`}
            nextOwner={item.nextOwner}
            nextStep={item.nextStep}
            actionLabel='Открыть draft'
            secondaryAction={item.disputeState === 'open' ? (
              <button
                onClick={() => { resolveDraftDispute(item.id); toast(`Спор по ${item.id} закрыт.`, 'success'); }}
                style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                Закрыть спор
              </button>
            ) : undefined}
          />
        ))}
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Доменные споры</div>
        {DISPUTES.map((item) => (
          <DisputeCard
            key={item.id}
            title={`${item.id} · ${item.title}`}
            subtitle={`${item.reasonCode} · сделка ${item.dealId}`}
            reason={item.description}
            hold={formatMoney(item.holdAmount)}
            sla={`${item.slaDaysLeft} дн.`}
            evidence={`${item.evidence.uploaded}/${item.evidence.total}`}
            statusTone={item.status === 'open' ? 'danger' : 'success'}
            statusLabel={item.status}
            href={`/platform-v7/disputes/${item.id}`}
            nextOwner={item.ballAt}
            nextStep='Загрузить заключение эксперта и закрыть спор по качеству.'
            actionLabel='Открыть спор'
          />
        ))}
      </section>
    </div>
  );
}
