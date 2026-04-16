'use client';

import * as React from 'react';
import Link from 'next/link';
import { CALLBACKS } from '@/lib/v7r/data';
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

export function BankRuntime() {
  const toast = useToast();
  const { draftDeals, approveDraftReserve, releaseDraftFunds } = useBuyerRuntimeStore();
  const pendingReserve = draftDeals.filter((item) => item.reserveState === 'pending');
  const readyRelease = draftDeals.filter((item) => item.paymentState === 'ready_for_release');

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Банковый контур</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>Здесь объединены базовые callback-события и persistent draft-сделки, которые дошли до резерва или выпуска денег.</div>
          </div>
          <Badge tone='warning'>SANDBOX + PERSISTENT RUNTIME</Badge>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Базовые callbacks' value={String(CALLBACKS.length)} note='Статический доменный контур.' />
        <StatCard title='Ждут резерв' value={String(pendingReserve.length)} note='Draft-сделки на банковой проверке.' />
        <StatCard title='Готовы к выпуску' value={String(readyRelease.length)} note='Документы и резерв закрыты.' />
        <StatCard title='Выпущено' value={String(draftDeals.filter((item) => item.paymentState === 'released').length)} note='Draft-сделки с завершённым денежным шагом.' />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Draft-сделки в банковом канале</div>
        {draftDeals.length === 0 ? <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA', fontSize: 13, color: '#6B778C' }}>Пока нет draft-сделок в банковом контуре.</div> : draftDeals.map((item) => (
          <section key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419', marginTop: 4 }}>{item.grain} · {item.volume} т</div>
                <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{formatMoney(item.price)} / т · {item.nextOwner}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge tone={item.reserveState === 'approved' ? 'success' : item.reserveState === 'pending' ? 'warning' : 'neutral'}>{item.reserveState}</Badge>
                <Badge tone={item.paymentState === 'released' ? 'success' : item.paymentState === 'ready_for_release' ? 'warning' : 'neutral'}>{item.paymentState}</Badge>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.nextStep}</div></div>
              <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Блокеры</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.blockers.length ? item.blockers.join(', ') : 'Нет'}</div></div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={`/platform-v7/deal-drafts/${item.id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Открыть draft</Link>
              {item.reserveState === 'pending' ? <button onClick={() => { approveDraftReserve(item.id); toast(`Резерв по ${item.id} подтверждён.`, 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Подтвердить резерв</button> : null}
              {item.paymentState === 'ready_for_release' ? <button onClick={() => { releaseDraftFunds(item.id); toast(`Деньги по ${item.id} выпущены.`, 'success'); }} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Выпустить деньги</button> : null}
            </div>
          </section>
        ))}
      </section>
    </div>
  );
}
