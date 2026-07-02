'use client';

import { useState } from 'react';

type KeyStatus = 'active' | 'expired' | 'revoked';

interface ApiKey {
  id: string;
  name: string;
  orgName: string;
  prefix: string;
  scopes: string[];
  status: KeyStatus;
  rateLimit: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
  requestsToday: number;
}

type WebhookStatus = 'active' | 'failing' | 'paused';

interface WebhookSubscription {
  id: string;
  orgName: string;
  url: string;
  events: string[];
  status: WebhookStatus;
  lastDelivery: string;
  failCount: number;
}

const STATUS_CONFIG: Record<KeyStatus, { label: string; bg: string; color: string }> = {
  active:  { label: 'Активен',   bg: '#D1FAE5', color: '#065F46' },
  expired: { label: 'Истёк',     bg: '#FEF3C7', color: '#92400E' },
  revoked: { label: 'Отозван',   bg: '#FEE2E2', color: '#991B1B' },
};

const WH_CONFIG: Record<WebhookStatus, { label: string; bg: string; color: string }> = {
  active:  { label: 'Активен',  bg: '#D1FAE5', color: '#065F46' },
  failing: { label: 'Ошибки',   bg: '#FEE2E2', color: '#991B1B' },
  paused:  { label: 'Пауза',    bg: '#F1F5F9', color: '#64748B' },
};

const DEMO_KEYS: ApiKey[] = [
  {
    id: 'key-001', name: 'ERP Интеграция', orgName: 'АгроХолдинг «Черноземье»', prefix: 'gf_live_ak7x',
    scopes: ['deals:read', 'deals:create', 'shipments:read'], status: 'active',
    rateLimit: '100/мин', createdAt: '2024-01-15', expiresAt: '2025-01-15',
    lastUsedAt: '2024-03-20T11:22:00Z', requestsToday: 342,
  },
  {
    id: 'key-002', name: '1С Бухгалтерия', orgName: 'Транзит-Зерно АО', prefix: 'gf_live_bm2n',
    scopes: ['deals:read', 'documents:read', 'payments:read'], status: 'active',
    rateLimit: '50/мин', createdAt: '2024-02-01', expiresAt: '2025-02-01',
    lastUsedAt: '2024-03-20T09:15:00Z', requestsToday: 89,
  },
  {
    id: 'key-003', name: 'CRM коннектор', orgName: 'ФермерОпт ООО', prefix: 'gf_live_cz9q',
    scopes: ['deals:read'], status: 'expired',
    rateLimit: '30/мин', createdAt: '2023-03-10', expiresAt: '2024-03-10',
    lastUsedAt: '2024-03-09T18:00:00Z', requestsToday: 0,
  },
];

const DEMO_WEBHOOKS: WebhookSubscription[] = [
  {
    id: 'wh-001', orgName: 'АгроХолдинг «Черноземье»',
    url: 'api.agro-chern.ru/webhooks/grainflow',
    events: ['deal.status_changed', 'payment.released', 'document.signed'],
    status: 'active', lastDelivery: '2024-03-20T11:20:00Z', failCount: 0,
  },
  {
    id: 'wh-002', orgName: 'Транзит-Зерно АО',
    url: 'erp.tranzit-zerno.ru/gf-hook',
    events: ['deal.status_changed', 'shipment.updated'],
    status: 'failing', lastDelivery: '2024-03-19T14:30:00Z', failCount: 12,
  },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'keys' | 'webhooks' | 'scopes';

const ALL_SCOPES = [
  { scope: 'deals:read', desc: 'Просмотр сделок организации' },
  { scope: 'deals:create', desc: 'Создание сделок от имени организации' },
  { scope: 'shipments:read', desc: 'Просмотр отгрузок и маршрутов' },
  { scope: 'documents:read', desc: 'Загрузка документов по сделкам' },
  { scope: 'payments:read', desc: 'История платежей и комиссий' },
  { scope: 'disputes:read', desc: 'Просмотр споров (требует обоснования)' },
  { scope: 'webhooks:manage', desc: 'Управление webhook-подписками' },
];

export function B2BPartnerApiPanel() {
  const [tab, setTab] = useState<Tab>('keys');
  const [selected, setSelected] = useState<string | null>(null);

  const activeKeys = DEMO_KEYS.filter(k => k.status === 'active').length;
  const totalRequests = DEMO_KEYS.reduce((s, k) => s + k.requestsToday, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'API ключей',   value: DEMO_KEYS.length, color: '#0F1419' },
          { label: 'Активных',     value: activeKeys,       color: '#065F46' },
          { label: 'Запросов/день', value: totalRequests,   color: '#1E40AF' },
          { label: 'Webhooks',     value: DEMO_WEBHOOKS.length, color: '#5B21B6' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* API info */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 9, color: '#065F46', fontWeight: 700, lineHeight: 1.6 }}>
        Partner API: Base URL api.grainflow.ru/api/v1/partner · Auth: Bearer API Key (gf_live_*) · Ключи в Vault (hash в БД) · Ротация 90 дней · Scope-based · HMAC webhook security
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5 }}>
        {([['keys', 'API Ключи'], ['webhooks', 'Webhooks'], ['scopes', 'Scopes']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'keys' && (
        <div style={{ display: 'grid', gap: 5 }}>
          {DEMO_KEYS.map((key) => {
            const cfg = STATUS_CONFIG[key.status];
            const isOpen = selected === key.id;
            return (
              <div key={key.id} style={{ borderRadius: 10, border: `1px solid ${isOpen ? '#0A7A5F' : '#E4E6EA'}`, overflow: 'hidden' }}>
                <button onClick={() => setSelected(isOpen ? null : key.id)} style={{ width: '100%', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', background: isOpen ? '#F0FDF4' : '#F8FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{key.name}</span>
                      <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      <code style={{ fontSize: 9, color: '#64748B' }}>{key.prefix}****</code>
                    </div>
                    <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{key.orgName} · {key.rateLimit}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#1E40AF' }}>{key.requestsToday} req</div>
                    <div style={{ fontSize: 8, color: '#94A3B8' }}>сегодня</div>
                  </div>
                </button>
                {isOpen && (
                  <div style={{ borderTop: '1px solid #E4E6EA', padding: '8px 12px', background: '#fff', display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {key.scopes.map((s) => (
                        <span key={s} style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#EFF6FF', color: '#1E40AF', fontFamily: 'monospace' }}>{s}</span>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 9, color: '#374151' }}>
                      <div><span style={lbl}>Создан:</span> {key.createdAt}</div>
                      <div><span style={lbl}>Истекает:</span> {key.expiresAt}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#374151' }}>Статистика</button>
                      {key.status === 'active' && <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FEF2F2', cursor: 'pointer', fontWeight: 700, color: '#DC2626' }}>Отозвать</button>}
                      {key.status === 'expired' && <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #BBF7D0', background: '#F0FDF4', cursor: 'pointer', fontWeight: 700, color: '#065F46' }}>Продлить</button>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <button style={{ padding: '6px 14px', borderRadius: 8, border: '1px dashed #0A7A5F', background: 'transparent', color: '#0A7A5F', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            + Выпустить новый ключ
          </button>
        </div>
      )}

      {tab === 'webhooks' && (
        <div style={{ display: 'grid', gap: 5 }}>
          {DEMO_WEBHOOKS.map((wh) => {
            const cfg = WH_CONFIG[wh.status];
            return (
              <div key={wh.id} style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${wh.status === 'failing' ? '#FECACA' : '#E4E6EA'}`, background: wh.status === 'failing' ? '#FEF2F2' : '#F8FAFB' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0F1419', flex: 1 }}>{wh.orgName}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  {wh.failCount > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: '#DC2626' }}>✗ {wh.failCount} ошибок</span>}
                </div>
                <code style={{ fontSize: 9, color: '#64748B', display: 'block', marginTop: 4 }}>{wh.url}</code>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {wh.events.map((e) => (
                    <span key={e} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: '#EDE9FE', color: '#5B21B6', fontFamily: 'monospace' }}>{e}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'scopes' && (
        <div style={{ display: 'grid', gap: 4 }}>
          {ALL_SCOPES.map((s) => (
            <div key={s.scope} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <code style={{ fontSize: 9, fontWeight: 700, color: '#1E40AF', fontFamily: 'monospace', minWidth: 160 }}>{s.scope}</code>
              <span style={{ fontSize: 9, color: '#64748B' }}>{s.desc}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        B2B Partner API · API ключи в Vault (hash в БД) · Scope-based · Ротация 90 дн · Webhook: HMAC-SHA256 + timestamp + replay protection · Демо-данные.
      </div>
    </div>
  );
}
