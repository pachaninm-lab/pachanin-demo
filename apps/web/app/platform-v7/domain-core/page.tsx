'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePlatformDomainStore } from '@/src/domain/store/platformDomainStore';
import { usePlatformAction } from '@/src/domain/actions/usePlatformAction';
import type { DealStatus } from '@/src/domain/types';
import type { PlatformActionId } from '@/src/domain/actions/actionEngine';
import { blockedDealsCount, dealGmvCents, disputeRatePct, releaseReadyCount } from '@/src/domain/kpi';

function money(cents: number) {
  return `${Math.round(cents / 100).toLocaleString('ru-RU')} ₽`;
}

function statusTone(status: DealStatus) {
  if (status === 'documents_complete' || status === 'partial_release' || status === 'final_released' || status === 'closed') return '#0A7A5F';
  if (status === 'dispute_open') return '#B91C1C';
  if (status.includes('reserve') || status.includes('contract')) return '#B45309';
  return '#475569';
}

const demoActions: Array<{ id: PlatformActionId; label: string; actor: string; idem?: string }> = [
  { id: 'create_lot', label: 'Создать лот', actor: 'u-seller' },
  { id: 'publish_lot', label: 'Опубликовать лот', actor: 'u-seller' },
  { id: 'accept_offer', label: 'Принять оффер', actor: 'u-buyer' },
  { id: 'create_deal', label: 'Создать сделку', actor: 'u-operator' },
  { id: 'request_reserve', label: 'Запросить резерв', actor: 'u-buyer', idem: 'reserve-request-demo' },
  { id: 'confirm_reserve', label: 'Подтвердить резерв', actor: 'u-bank', idem: 'reserve-confirm-demo' },
  { id: 'assign_driver', label: 'Назначить водителя', actor: 'u-operator' },
  { id: 'confirm_arrival', label: 'Подтвердить прибытие', actor: 'u-driver' },
  { id: 'create_lab_protocol', label: 'Создать лаб. протокол', actor: 'u-lab' },
  { id: 'open_dispute', label: 'Открыть спор', actor: 'u-operator' },
];

function ActionButton({ dealId, action }: { dealId: string; action: typeof demoActions[number] }) {
  const { execute } = usePlatformAction(dealId, action.actor);
  return (
    <button
      onClick={() => execute(action.id, action.idem ? `${action.idem}-${dealId}` : undefined)}
      style={{ borderRadius: 12, padding: '10px 12px', border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#0F1419' }}
    >
      {action.label}
    </button>
  );
}

export default function PlatformV7DomainCorePage() {
  const deals = usePlatformDomainStore(state => state.deals);
  const disputes = usePlatformDomainStore(state => state.disputes);
  const auditEvents = usePlatformDomainStore(state => state.auditEvents);
  const dealTimeline = usePlatformDomainStore(state => state.dealTimeline);
  const idempotencyKeys = usePlatformDomainStore(state => state.idempotencyKeys);
  const resetDomainFixtures = usePlatformDomainStore(state => state.resetDomainFixtures);
  const lastAction = usePlatformDomainStore(state => state.lastAction);
  const [selectedDealId, setSelectedDealId] = React.useState('DL-9102');

  const selected = deals.find(deal => deal.id === selectedDealId) ?? deals[0];
  const gmv = dealGmvCents(deals);
  const timeline = dealTimeline.filter(event => event.dealId === selected?.id).slice(0, 10);

  return (
    <div style={{ display: 'grid', gap: 16, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(10,122,95,0.18)', background: 'rgba(10,122,95,0.08)', color: '#0A7A5F', fontSize: 11, fontWeight: 900 }}>
              DOMAIN CORE · SANDBOX
            </div>
            <h1 style={{ margin: '10px 0 0', fontSize: 28, lineHeight: 1.15, color: '#0F1419' }}>Движок сделки и actions</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6B778C', lineHeight: 1.7, maxWidth: 920 }}>
              Проверочная панель P0-02/P0-03: state-machine, guards, domain fixtures, action feedback, audit trail, timeline и idempotency. Это честная симуляция, не live bank/FGIS/EDO контур.
            </p>
          </div>
          <button onClick={resetDomainFixtures} style={{ borderRadius: 12, padding: '10px 14px', border: '1px solid #E4E6EA', background: '#F8FAFB', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}>
            Сбросить sandbox
          </button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        {[
          ['GMV fixtures', money(gmv)],
          ['Сделок', String(deals.length)],
          ['К выпуску', String(releaseReadyCount(deals))],
          ['С блокерами', String(blockedDealsCount(deals))],
          ['Idempotency keys', String(idempotencyKeys.length)],
          ['Спорность', `${disputeRatePct(deals, disputes)}%`],
        ].map(([label, value]) => (
          <section key={label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}>{label}</div>
            <div style={{ marginTop: 8, fontSize: 24, lineHeight: 1.1, fontWeight: 900, color: '#0F1419' }}>{value}</div>
          </section>
        ))}
      </div>

      {lastAction ? (
        <section style={{ background: lastAction.ok ? 'rgba(10,122,95,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${lastAction.ok ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, borderRadius: 18, padding: 14, color: lastAction.ok ? '#0A7A5F' : '#B45309', fontSize: 13, fontWeight: 800 }}>
          Последнее действие: {lastAction.actionId} · {lastAction.dealId} · {lastAction.message}{lastAction.idempotentReplay ? ' · replay без изменения состояния' : ''}
        </section>
      ) : null}

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0F1419' }}>Сделка для проверки</div>
          <select value={selected?.id} onChange={event => setSelectedDealId(event.target.value)} style={{ borderRadius: 12, border: '1px solid #E4E6EA', padding: '10px 12px', fontSize: 13, fontWeight: 800, background: '#fff' }}>
            {deals.map(deal => <option key={deal.id} value={deal.id}>{deal.id} · {deal.status}</option>)}
          </select>
        </div>

        {selected ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 16, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}>Статус</div>
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900, color: statusTone(selected.status) }}>{selected.status}</div>
              </div>
              <div style={{ padding: 14, borderRadius: 16, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}>Сумма</div>
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900, color: '#0F1419' }}>{money(selected.totalAmountCents)}</div>
              </div>
              <div style={{ padding: 14, borderRadius: 16, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}>Guards</div>
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: '#475569', lineHeight: 1.6 }}>
                  reserve: {selected.reserveConfirmed ? 'yes' : 'no'} · docs: {selected.documentsComplete ? 'yes' : 'no'} · dispute: {selected.openDisputeId ?? 'no'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {demoActions.map(action => <ActionButton key={action.id} dealId={selected.id} action={action} />)}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={`/platform-v7/deals/${selected.id}`} style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 12px', border: '1px solid #E4E6EA', background: '#F8FAFB', color: '#0F1419', fontSize: 12, fontWeight: 800 }}>Открыть карточку сделки</Link>
              <Link href='/platform-v7/bank' style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 12px', border: '1px solid #E4E6EA', background: '#F8FAFB', color: '#0F1419', fontSize: 12, fontWeight: 800 }}>Банк</Link>
              <Link href='/platform-v7/disputes' style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 12px', border: '1px solid #E4E6EA', background: '#F8FAFB', color: '#0F1419', fontSize: 12, fontWeight: 800 }}>Споры</Link>
            </div>
          </div>
        ) : null}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#0F1419' }}>Timeline сделки</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {timeline.length ? timeline.map(event => (
            <div key={event.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, padding: 14, borderRadius: 16, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
              <div>
                <div style={{ fontSize: 13, color: '#0F1419', fontWeight: 900 }}>{event.message}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{event.statusBefore} → {event.statusAfter} · actor {event.actorUserId} · {event.mode}</div>
              </div>
              <div style={{ fontSize: 11, color: '#6B778C', fontFamily: 'JetBrains Mono, monospace' }}>{event.createdAt.slice(11, 19)}</div>
            </div>
          )) : <div style={{ fontSize: 13, color: '#6B778C' }}>Для выбранной сделки timeline пока пуст.</div>}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#0F1419' }}>Audit trail</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {auditEvents.slice(0, 12).map(event => (
            <div key={event.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, padding: 14, borderRadius: 16, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
              <div>
                <div style={{ fontSize: 13, color: '#0F1419', fontWeight: 900 }}>{event.action}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{event.objectType} · {event.objectId} · actor {event.actorUserId}</div>
              </div>
              <div style={{ fontSize: 11, color: '#6B778C', fontFamily: 'JetBrains Mono, monospace' }}>{event.createdAt.slice(11, 19)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
