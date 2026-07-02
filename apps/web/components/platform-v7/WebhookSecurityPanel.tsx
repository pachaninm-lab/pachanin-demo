'use client';

import { useState } from 'react';

type VerifyStatus = 'ok' | 'replay' | 'sig_fail' | 'duplicate';

interface WebhookEvent {
  id: string;
  eventType: string;
  adapter: string;
  timestamp: string;
  status: VerifyStatus;
  durationMs: number;
  idempotencyKey: string;
  detail: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string;
  deliveredLast24h: number;
  failedLast24h: number;
}

const EVENTS: WebhookEvent[] = [
  { id: 'wh-001', eventType: 'deal.payment_reserved',  adapter: 'Сбер Escrow',   timestamp: '2024-03-20T11:22:00Z', status: 'ok',        durationMs: 42,  idempotencyKey: 'evt_sber_001a', detail: 'HMAC-SHA256 OK · timestamp age 12 сек · idempotency miss → обработан' },
  { id: 'wh-002', eventType: 'fgis.lot_registered',    adapter: 'ФГИС Зерно',    timestamp: '2024-03-20T10:55:00Z', status: 'ok',        durationMs: 67,  idempotencyKey: 'evt_fgis_441892', detail: 'HMAC-SHA256 OK · ФГИС-2024-РО-441892 привязан к DL-9095 · Saga step обновлён' },
  { id: 'wh-003', eventType: 'edo.upd_signed',         adapter: 'Диадок',        timestamp: '2024-03-20T10:30:00Z', status: 'ok',        durationMs: 38,  idempotencyKey: 'evt_ddk_upd_9095', detail: 'HMAC-SHA256 OK · УПД для DL-9095 подписан BUYER · статус документа → SIGNED' },
  { id: 'wh-004', eventType: 'bank.mt940_received',    adapter: 'Сбер МТ940',    timestamp: '2024-03-20T09:15:00Z', status: 'replay',    durationMs: 8,   idempotencyKey: 'evt_mt940_003r', detail: 'Timestamp age 380 сек > 300 сек tolerance → WebhookReplayError, событие отклонено' },
  { id: 'wh-005', eventType: 'kyc.verification_done',  adapter: 'KYC/AML',       timestamp: '2024-03-19T16:44:00Z', status: 'sig_fail',  durationMs: 5,   idempotencyKey: 'evt_kyc_xfail', detail: 'HMAC-SHA256 мисматч: ожидаемая подпись ≠ x-signature → WebhookSignatureError' },
  { id: 'wh-006', eventType: 'deal.payment_reserved',  adapter: 'Сбер Escrow',   timestamp: '2024-03-20T11:22:01Z', status: 'duplicate', durationMs: 3,   idempotencyKey: 'evt_sber_001a', detail: 'idempotencyKey уже обработан (wh-001) → alreadyProcessed: true, пропущен' },
];

const ENDPOINTS: WebhookEndpoint[] = [
  { id: 'ep-001', url: 'https://erp.partnerXYZ.ru/webhook/grainflow', events: ['deal.*', 'payment.*'], active: true,  secret: 'gf_whsec_***', deliveredLast24h: 47, failedLast24h: 2 },
  { id: 'ep-002', url: 'https://1c.agro.corp/api/v2/grainflow-events', events: ['shipment.*', 'lab.*'], active: true,  secret: 'gf_whsec_***', deliveredLast24h: 31, failedLast24h: 0 },
  { id: 'ep-003', url: 'https://analytics.grainco.ru/events',          events: ['deal.closed'],         active: false, secret: 'gf_whsec_***', deliveredLast24h: 0,  failedLast24h: 0 },
];

const STATUS_CFG: Record<VerifyStatus, { label: string; bg: string; color: string; icon: string }> = {
  ok:        { label: 'Принят',      bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  replay:    { label: 'Replay',      bg: '#FEF3C7', color: '#92400E', icon: '⏱' },
  sig_fail:  { label: 'Подпись ✗',  bg: '#FEE2E2', color: '#DC2626', icon: '✗' },
  duplicate: { label: 'Дубликат',    bg: '#F1F5F9', color: '#64748B', icon: '⊗' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'events' | 'endpoints' | 'config';

export function WebhookSecurityPanel() {
  const [tab, setTab] = useState<Tab>('events');

  const ok = EVENTS.filter(e => e.status === 'ok').length;
  const rejected = EVENTS.filter(e => e.status !== 'ok' && e.status !== 'duplicate').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Входящих событий', value: EVENTS.length,                  color: '#0F1419' },
          { label: 'Принято',          value: ok,                             color: '#065F46' },
          { label: 'Отклонено/ошибка', value: rejected,                       color: rejected > 0 ? '#DC2626' : '#065F46' },
          { label: 'Эндпоинтов',       value: ENDPOINTS.filter(e => e.active).length, color: '#1E40AF' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        HMAC-SHA256(secret, timestamp + "." + payload) · Timestamp tolerance 300 сек (replay protection) · Idempotency: Redis TTL 24ч · Секрет из HashiCorp Vault
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['events', 'Входящие события'], ['endpoints', 'Эндпоинты'], ['config', 'Конфигурация']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Верификация входящих webhook-событий</div>
          {EVENTS.map((ev) => {
            const st = STATUS_CFG[ev.status];
            return (
              <div key={ev.id} style={{ padding: '8px 12px', borderRadius: 10, background: ev.status === 'sig_fail' ? '#FEF2F2' : ev.status === 'replay' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${ev.status === 'sig_fail' ? '#FECACA' : ev.status === 'replay' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                  <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419' }}>{ev.eventType}</code>
                  <span style={{ fontSize: 9, color: '#64748B', flex: 1 }}>{ev.adapter}</span>
                  <span style={{ fontSize: 8, color: '#94A3B8' }}>{new Date(ev.timestamp).toLocaleTimeString('ru-RU')}</span>
                  <span style={{ fontSize: 8, color: '#94A3B8' }}>{ev.durationMs} мс</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{ev.detail}</div>
                <div style={{ fontSize: 8, color: '#94A3B8', marginTop: 1 }}>Idempotency: {ev.idempotencyKey}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'endpoints' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Исходящие webhook-эндпоинты партнёров</div>
          {ENDPOINTS.map((ep) => (
            <div key={ep.id} style={{ padding: '8px 12px', borderRadius: 10, background: ep.active ? '#F8FAFB' : '#F1F5F9', border: `1px solid ${ep.active ? '#E4E6EA' : '#CBD5E1'}`, opacity: ep.active ? 1 : 0.65 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: ep.active ? '#D1FAE5' : '#E2E8F0', color: ep.active ? '#065F46' : '#64748B' }}>{ep.active ? 'ACTIVE' : 'INACTIVE'}</span>
                <code style={{ fontSize: 9, fontWeight: 700, color: '#0F1419', flex: 1, wordBreak: 'break-all' }}>{ep.url}</code>
              </div>
              <div style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>
                Events: {ep.events.join(', ')} · 24ч: {ep.deliveredLast24h} доставлено, {ep.failedLast24h} ошибок · Secret: {ep.secret}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'config' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={lbl}>Конфигурация безопасности</div>
          {[
            { key: 'Алгоритм подписи',     value: 'HMAC-SHA256' },
            { key: 'Timestamp tolerance',   value: '300 сек (replay protection)' },
            { key: 'Idempotency store',     value: 'Redis Cluster · TTL 86400 сек' },
            { key: 'Secret хранение',       value: 'HashiCorp Vault · ротация 90 дней' },
            { key: 'Retry (исходящие)',     value: 'exponential backoff · 5 попыток · max 1 ч' },
            { key: 'TLS',                   value: 'TLS 1.3 · проверка cert pinning' },
            { key: 'IP allowlist',          value: 'Vault-managed · per-partner allowlist' },
            { key: 'Rate limit (входящие)', value: '1 000 событий/мин на адаптер · Redis' },
          ].map((row) => (
            <div key={row.key} style={{ display: 'flex', gap: 12, padding: '6px 10px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#374151', width: 160, flexShrink: 0 }}>{row.key}</span>
              <span style={{ fontSize: 10, color: '#64748B' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        §10.4 Webhook Security · HMAC-SHA256 · replay protection · idempotency · Vault secrets · демо-данные.
      </div>
    </div>
  );
}
