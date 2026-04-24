'use client';

import * as React from 'react';
import { selectDisputeById } from '@/lib/domain/selectors';
import { formatMoney } from '@/lib/v7r/helpers';
import { useToast } from '@/components/v7r/Toast';
import { trackEvent } from '@/lib/analytics/track';

export function DisputeHoldCalculator({ disputeId }: { disputeId: string }) {
  const dispute = selectDisputeById(disputeId);
  const toast = useToast();
  const [qualityDeltaPct, setQualityDeltaPct] = React.useState(6);
  const [transportLossRub, setTransportLossRub] = React.useState(180000);
  const [docsRiskRub, setDocsRiskRub] = React.useState(120000);

  if (!dispute) return null;

  const qualityRiskRub = Math.round(dispute.holdAmount * (qualityDeltaPct / 100));
  const recommendedHold = Math.max(dispute.holdAmount + qualityRiskRub + transportLossRub + docsRiskRub, 0);
  const holdDelta = recommendedHold - dispute.holdAmount;

  function resetCalculator() {
    setQualityDeltaPct(6);
    setTransportLossRub(180000);
    setDocsRiskRub(120000);
  }

  function applyCalculator() {
    trackEvent('dispute_hold_recalculated', {
      disputeId,
      qualityDeltaPct,
      transportLossRub,
      docsRiskRub,
      recommendedHold,
    });
    toast(`Рекомендованное удержание: ${formatMoney(recommendedHold)}`, { type: 'success', duration: 6000 });
  }

  return (
    <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Калькулятор удержания</div>
        <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', lineHeight: 1.6 }}>
          Быстро считает, насколько текущий hold покрывает качественную дельту, транспортный убыток и документный риск.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--pc-text-muted)', fontWeight: 700 }}>Качественная дельта, %</span>
          <input type='number' min={0} max={100} value={qualityDeltaPct} onChange={(e) => setQualityDeltaPct(Number(e.target.value) || 0)} style={{ minHeight: 44, borderRadius: 12, border: '1px solid var(--pc-border)', padding: '10px 12px', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 700 }} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--pc-text-muted)', fontWeight: 700 }}>Транспортный убыток, ₽</span>
          <input type='number' min={0} step={10000} value={transportLossRub} onChange={(e) => setTransportLossRub(Number(e.target.value) || 0)} style={{ minHeight: 44, borderRadius: 12, border: '1px solid var(--pc-border)', padding: '10px 12px', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 700 }} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--pc-text-muted)', fontWeight: 700 }}>Документный риск, ₽</span>
          <input type='number' min={0} step={10000} value={docsRiskRub} onChange={(e) => setDocsRiskRub(Number(e.target.value) || 0)} style={{ minHeight: 44, borderRadius: 12, border: '1px solid var(--pc-border)', padding: '10px 12px', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 700 }} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <CalcCard label='Текущее удержание' value={formatMoney(dispute.holdAmount)} note='Факт, который уже стоит на споре.' />
        <CalcCard label='Риск по качеству' value={formatMoney(qualityRiskRub)} note={`При дельте ${qualityDeltaPct}% от текущего hold.`} />
        <CalcCard label='Доп. риск' value={formatMoney(transportLossRub + docsRiskRub)} note='Транспорт + документный слой.' />
        <CalcCard label='Рекомендованный hold' value={formatMoney(recommendedHold)} note={holdDelta >= 0 ? `Нужно добавить ${formatMoney(holdDelta)}.` : `Можно снять ${formatMoney(Math.abs(holdDelta))}.`} accent />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={applyCalculator} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: 'var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
          Пересчитать hold
        </button>
        <button onClick={resetCalculator} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Сбросить
        </button>
      </div>
    </section>
  );
}

function CalcCard({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <section style={{ background: accent ? 'rgba(10,122,95,0.06)' : 'var(--pc-bg-card)', border: `1px solid ${accent ? 'rgba(10,122,95,0.18)' : 'var(--pc-border)'}`, borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary)' }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--pc-text-muted)', lineHeight: 1.5 }}>{note}</div>
    </section>
  );
}
