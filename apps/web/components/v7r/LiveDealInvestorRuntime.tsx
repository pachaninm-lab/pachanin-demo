'use client';

import * as React from 'react';
import Link from 'next/link';
import { useToast } from '@/components/v7r/Toast';
import { selectRuntimeDealById, selectRuntimeDisputeById } from '@/lib/domain/selectors';
import { formatMoney, statusLabel } from '@/lib/v7r/helpers';
import { useLiveDealRuntimeStore } from '@/stores/useLiveDealRuntimeStore';
import { useFieldRuntimeStore } from '@/stores/useFieldRuntimeStore';

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

function formatTs(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function LiveDealInvestorRuntime({ id }: { id: string }) {
  const toast = useToast();
  const base = selectRuntimeDealById(id) ?? null;
  const ensureDeal = useLiveDealRuntimeStore((state) => state.ensureDeal);
  const startDocs = useLiveDealRuntimeStore((state) => state.startDocs);
  const completeDocs = useLiveDealRuntimeStore((state) => state.completeDocs);
  const requestRelease = useLiveDealRuntimeStore((state) => state.requestRelease);
  const releaseFunds = useLiveDealRuntimeStore((state) => state.releaseFunds);
  const openDispute = useLiveDealRuntimeStore((state) => state.openDispute);
  const resolveDispute = useLiveDealRuntimeStore((state) => state.resolveDispute);
  const override = useLiveDealRuntimeStore((state) => state.overrides[id]);

  const trip = useFieldRuntimeStore((state) => (state.trip.dealId === id ? state.trip : null));
  const reception = useFieldRuntimeStore((state) => state.receptions.find((item) => item.dealId === id) ?? null);
  const labCase = useFieldRuntimeStore((state) => state.labCases.find((item) => item.dealId === id) ?? null);

  React.useEffect(() => {
    ensureDeal(id);
  }, [ensureDeal, id]);

  if (!base) {
    return <div style={{ padding: 24 }}>Сделка не найдена</div>;
  }

  const state = override ?? ensureDeal(id);
  if (!state) return null;

  const dispute = base.dispute ? selectRuntimeDisputeById(base.dispute.id) : null;
  const reservedAmount = base.reservedAmount;
  const moistureValue = Number(labCase?.moisture || 0);
  const proteinValue = Number(labCase?.protein || 0);
  const qualityRequiresReview = Boolean(labCase && labCase.result === 'review');
  const qualityDiscountPercent = qualityRequiresReview
    ? Math.max(0.5, (moistureValue > 14 ? (moistureValue - 14) * 0.6 : 0) + (proteinValue > 0 && proteinValue < 12 ? (12 - proteinValue) * 0.35 : 0))
    : 0;
  const qualityDiscountAmount = Math.round(reservedAmount * (qualityDiscountPercent / 100));
  const recommendedHold = qualityRequiresReview ? Math.max(state.holdAmount, Math.round(reservedAmount * 0.12) + qualityDiscountAmount) : state.holdAmount;
  const releaseAmount = state.releaseAmount ?? base.releaseAmount ?? Math.max(reservedAmount - recommendedHold, 0);

  const antiBypassSignals: string[] = [];
  if (trip?.status === 'deviation') antiBypassSignals.push('Маршрут отклонён от плана');
  if (state.disputeState === 'open') antiBypassSignals.push('Сделка ушла в спорный сценарий');
  if (labCase?.result === 'review') antiBypassSignals.push('Качество требует ручного разбора');
  if (reception && !reception.fgis) antiBypassSignals.push('Приёмка ещё не подтверждена в ФГИС');
  const antiBypassLevel = antiBypassSignals.length >= 3 ? 'high' : antiBypassSignals.length >= 1 ? 'medium' : 'low';

  const timeline = [
    ...(trip ? [{ ts: trip.arrivedAt || new Date().toISOString(), actor: 'Логистика', action: trip.status === 'arrived' ? 'Рейс прибыл на точку приёмки' : trip.status === 'deviation' ? `Отклонение: ${trip.deviationText || 'без описания'}` : `Рейс в пути, ETA ${trip.eta}` }] : []),
    ...(reception ? [{ ts: new Date().toISOString(), actor: 'Элеватор', action: `Приёмка ${reception.status}, вес ${reception.weight || '—'} т, ФГИС ${reception.fgis ? 'да' : 'нет'}` }] : []),
    ...(labCase ? [{ ts: new Date().toISOString(), actor: 'Лаборатория', action: `Результат ${labCase.result}, белок ${labCase.protein || '—'}, влажность ${labCase.moisture || '—'}` }] : []),
    ...state.events.map((e) => ({ ts: e.ts, actor: e.actor, action: e.action })),
  ].sort((a, b) => String(b.ts).localeCompare(String(a.ts)));

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
            <Badge tone={antiBypassLevel === 'high' ? 'danger' : antiBypassLevel === 'medium' ? 'warning' : 'success'}>{antiBypassLevel.toUpperCase()} RISK</Badge>
            {qualityRequiresReview ? <Badge tone='danger'>LAB REVIEW</Badge> : null}
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Резерв' value={formatMoney(reservedAmount)} note='Сумма под резервом по сделке.' />
        <StatCard title='Удержание' value={formatMoney(recommendedHold)} note='Включено удержание и возможный quality-дисконт.' />
        <StatCard title='К выпуску' value={formatMoney(releaseAmount)} note='Сумма после учёта качества и блокеров.' />
        <StatCard title='Автодисконт' value={`${qualityDiscountPercent.toFixed(1)}%`} note={qualityRequiresReview ? formatMoney(qualityDiscountAmount) : 'Качество в норме'} />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Control tower сделки</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Логистика</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{trip ? `${trip.status} · ETA ${trip.eta}` : 'Нет активного рейса'}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 8 }}>{trip ? `Км до точки: ${trip.kmLeft}` : '—'}</div></div>
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Приёмка</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{reception ? `${reception.status} · ${reception.weight || '—'} т` : 'Нет записи'}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 8 }}>{reception ? `FGIS: ${reception.fgis ? 'да' : 'нет'} · СДИЗ: ${reception.sdiz || '—'}` : '—'}</div></div>
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Лаборатория</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{labCase ? `${labCase.status} · ${labCase.result}` : 'Нет пробы'}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 8 }}>{labCase ? `Белок ${labCase.protein || '—'} · Влажность ${labCase.moisture || '—'}` : '—'}</div></div>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Антиобходный контур</div>
          <Badge tone={antiBypassLevel === 'high' ? 'danger' : antiBypassLevel === 'medium' ? 'warning' : 'success'}>{antiBypassLevel.toUpperCase()}</Badge>
        </div>
        {antiBypassSignals.length ? antiBypassSignals.map((signal, index) => (
          <div key={`${signal}-${index}`} style={{ padding: 14, borderRadius: 14, background: antiBypassLevel === 'high' ? 'rgba(220,38,38,0.06)' : 'rgba(217,119,6,0.08)', border: antiBypassLevel === 'high' ? '1px solid rgba(220,38,38,0.16)' : '1px solid rgba(217,119,6,0.16)', fontSize: 13 }}>{signal}</div>
        )) : <div style={{ padding: 14, borderRadius: 14, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.14)', fontSize: 13, color: '#0A7A5F', fontWeight: 700 }}>Сигналов обхода не обнаружено.</div>}
      </section>

      {dispute ? <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}><div style={{ fontSize: 18, fontWeight: 800 }}>Связанный спор</div><div style={{ fontSize: 13, color: '#475569', marginTop: 8 }}>{dispute.title} · {dispute.reasonCode}</div></section> : null}

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Действия</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {state.docsState === 'missing' ? <button onClick={() => { startDocs(id); toast('Сбор документов по сделке запущен.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Начать сбор документов</button> : null}
          {state.docsState !== 'complete' ? <button onClick={() => { completeDocs(id); toast('Документный пакет сделки собран.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Документы собраны</button> : null}
          {state.docsState === 'complete' && state.reserveState === 'reserved' && state.disputeState !== 'open' ? <button onClick={() => { requestRelease(id); toast('Запрос на выпуск денег по сделке создан.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Запросить выпуск денег</button> : null}
          {state.reserveState === 'pending_release' ? <button onClick={() => { releaseFunds(id); toast('Деньги по сделке выпущены.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Выпустить деньги</button> : null}
          {state.disputeState !== 'open' && state.reserveState !== 'released' ? <button onClick={() => { openDispute(id); toast('Спор по сделке открыт.', 'warning'); }} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Открыть спор</button> : null}
          {state.disputeState === 'open' ? <button onClick={() => { resolveDispute(id); toast('Спор по сделке закрыт.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Закрыть спор</button> : null}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Единый timeline сделки</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {timeline.map((event, index) => (
            <div key={`${event.ts}-${index}`} style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{event.actor}</div>
                <div style={{ fontSize: 12, color: '#6B778C' }}>{formatTs(event.ts)}</div>
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>{event.action}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
