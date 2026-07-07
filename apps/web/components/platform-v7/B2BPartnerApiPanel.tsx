'use client';

import { useState } from 'react';

type Tab = 'status' | 'events' | 'scopes';

type PartnerRow = {
  id: string;
  name: string;
  scope: string;
  state: 'configured' | 'testing' | 'paused';
  note: string;
};

const PARTNERS: PartnerRow[] = [
  { id: 'p1', name: 'ERP-контур', scope: 'сделки и отгрузки', state: 'testing', note: 'нужна проверка доступа' },
  { id: 'p2', name: 'Учётный контур', scope: 'документы и статусы', state: 'configured', note: 'готов к проверке' },
  { id: 'p3', name: 'CRM-контур', scope: 'заявки и сделки', state: 'paused', note: 'ждёт владельца' },
];

const EVENTS = ['deal.status_changed', 'bank_step.confirmed', 'document.signed', 'shipment.updated'];
const SCOPES = [
  ['deals:read', 'Просмотр сделок организации'],
  ['deals:create', 'Создание сделки по допуску роли'],
  ['shipments:read', 'Просмотр рейсов'],
  ['documents:read', 'Просмотр документов'],
  ['money:read', 'Доступные денежные статусы'],
  ['disputes:read', 'Споры по допуску'],
];

const tone = {
  configured: { label: 'Настроено', bg: '#DBEAFE', color: '#1E40AF' },
  testing: { label: 'Проверка', bg: '#FEF3C7', color: '#92400E' },
  paused: { label: 'Пауза', bg: '#F1F5F9', color: '#64748B' },
};

const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function B2BPartnerApiPanel() {
  const [tab, setTab] = useState<Tab>('status');
  const configured = PARTNERS.filter((item) => item.state === 'configured').length;
  const testing = PARTNERS.filter((item) => item.state === 'testing').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Контуров', value: PARTNERS.length, color: '#0F1419' },
          { label: 'Настроено', value: configured, color: '#1E40AF' },
          { label: 'Проверка', value: testing, color: '#92400E' },
          { label: 'Событий', value: EVENTS.length, color: '#5B21B6' },
        ].map((item) => (
          <div key={item.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={labelStyle}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: item.color, marginTop: 4 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 10, color: '#065F46', fontWeight: 760, lineHeight: 1.55 }}>
        Партнёрские подключения: предынтеграционный контур. Рабочие доступы, подписи событий и промышленные лимиты требуют отдельной проверки.
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['status', 'Статусы'], ['events', 'События'], ['scopes', 'Доступы']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'status' && (
        <div style={{ display: 'grid', gap: 6 }}>
          {PARTNERS.map((row) => {
            const cfg = tone[row.state];
            return (
              <div key={row.id} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB', display: 'grid', gap: 5 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 820, color: '#0F1419' }}>{row.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                </div>
                <div style={{ fontSize: 10, color: '#64748B' }}>{row.scope} · {row.note}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'events' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {EVENTS.map((event) => <span key={event} style={{ fontSize: 9, padding: '3px 7px', borderRadius: 5, background: '#EDE9FE', color: '#5B21B6', fontFamily: 'monospace' }}>{event}</span>)}
        </div>
      )}

      {tab === 'scopes' && (
        <div style={{ display: 'grid', gap: 4 }}>
          {SCOPES.map(([scope, desc]) => (
            <div key={scope} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <code style={{ fontSize: 9, fontWeight: 700, color: '#1E40AF', fontFamily: 'monospace', minWidth: 150 }}>{scope}</code>
              <span style={{ fontSize: 9, color: '#64748B' }}>{desc}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Интеграционный контур · role scope · журнал событий · требуется проверка на реальных подключениях.
      </div>
    </div>
  );
}
