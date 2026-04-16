'use client';

import * as React from 'react';
import Link from 'next/link';
import { useToast } from '@/components/v7r/Toast';
import { getMarketRfqById, useBuyerRuntimeStore } from '@/stores/useBuyerRuntimeStore';
import { formatMoney } from '@/lib/v7r/helpers';

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

export function DealDraftDetailRuntime({ id }: { id: string }) {
  const toast = useToast();
  const {
    draftDeals,
    removeDraftDeal,
    markDraftDocsCollecting,
    markDraftDocsComplete,
    submitDraftReserve,
    approveDraftReserve,
    openDraftDispute,
    resolveDraftDispute,
    requestDraftRelease,
    releaseDraftFunds,
  } = useBuyerRuntimeStore();
  const item = draftDeals.find((entry) => entry.id === id) ?? null;

  if (!item) {
    return (
      <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Draft-сделка не найдена</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>Такой draft отсутствует в persistent runtime текущей сессии.</div>
          <Link href='/platform-v7/deals' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Все сделки</Link>
        </section>
      </div>
    );
  }

  const sourceLabel = item.sourceType === 'RFQ_MARKET' ? 'Рыночное предложение' : 'Локальный RFQ';
  const marketSource = item.sourceType === 'RFQ_MARKET' ? getMarketRfqById(item.sourceId) : null;

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419', marginTop: 6 }}>{item.grain} · {item.volume} т</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>{item.region} · {item.sellerName} → {item.buyerName} · {sourceLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge tone='neutral'>{sourceLabel}</Badge>
            <Badge tone={item.status === 'released' ? 'success' : item.status === 'dispute_open' ? 'danger' : 'warning'}>{item.status}</Badge>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Цена' value={formatMoney(item.price)} note='Цена из выбранного источника.' />
        <StatCard title='Документы' value={item.docsState} note='Состояние документного пакета.' />
        <StatCard title='Резерв' value={item.reserveState} note='Состояние банкового резерва.' />
        <StatCard title='Выпуск' value={item.paymentState} note={item.nextStep} />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Blocker matrix</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {item.blockers.length ? item.blockers.map((blocker) => <Badge key={blocker} tone={blocker === 'dispute' ? 'danger' : 'warning'}>{blocker}</Badge>) : <Badge tone='success'>blockers cleared</Badge>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий владелец</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.nextOwner}</div></div>
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.nextStep}</div></div>
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Risk flags</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.riskFlags.length ? item.riskFlags.join(', ') : 'Нет'}</div></div>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Что уже известно</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Качество</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.quality}</div></div>
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Оплата</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.payment}</div></div>
          <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Источник</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.sourceId}</div></div>
        </div>
        {marketSource ? <div style={{ padding: 14, borderRadius: 14, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.14)', fontSize: 13, color: '#0F1419', lineHeight: 1.7 }}>Источник найден в рыночном наборе: {marketSource.grain} · {marketSource.volume} т · {marketSource.region}. Draft-сделка создана из него и теперь проходит документный, банковый и спорный слой внутри runtime-контура.</div> : null}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Действия</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {item.docsState === 'missing' ? <button onClick={() => { markDraftDocsCollecting(item.id); toast('Сбор документов запущен.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Начать сбор документов</button> : null}
          {item.docsState !== 'complete' ? <button onClick={() => { markDraftDocsComplete(item.id); toast('Документный пакет отмечен как полный.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Документы собраны</button> : null}
          {item.docsState === 'complete' && item.reserveState === 'not_started' ? <button onClick={() => { submitDraftReserve(item.id); toast('Запрос на резерв отправлен в банк.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Отправить на резерв</button> : null}
          {item.reserveState === 'pending' ? <button onClick={() => { approveDraftReserve(item.id); toast('Резерв подтверждён.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Подтвердить резерв</button> : null}
          {item.reserveState === 'approved' && item.docsState === 'complete' && item.disputeState !== 'open' && item.paymentState !== 'ready_for_release' && item.paymentState !== 'released' ? <button onClick={() => { requestDraftRelease(item.id); toast('Запрос на выпуск денег создан.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Запросить выпуск денег</button> : null}
          {item.paymentState === 'ready_for_release' ? <button onClick={() => { releaseDraftFunds(item.id); toast('Деньги выпущены.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Выпустить деньги</button> : null}
          {item.disputeState !== 'open' && item.paymentState !== 'released' ? <button onClick={() => { openDraftDispute(item.id); toast('Спор открыт.', 'warning'); }} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Открыть спор</button> : null}
          {item.disputeState === 'open' ? <button onClick={() => { resolveDraftDispute(item.id); toast('Спор закрыт.', 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Закрыть спор</button> : null}
          <Link href='/platform-v7/bank' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Банк</Link>
          <Link href='/platform-v7/disputes' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Споры</Link>
          <button onClick={() => { removeDraftDeal(item.id); toast(`Draft-сделка ${item.id} удалена.`, 'warning'); }} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Удалить draft</button>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Журнал событий</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {item.events.map((event, index) => (
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
