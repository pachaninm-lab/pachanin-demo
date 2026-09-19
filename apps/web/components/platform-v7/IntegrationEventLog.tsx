'use client';

import { useState } from 'react';

type Direction = 'inbound' | 'outbound';
type EventStatus = 'success' | 'error' | 'pending';

interface IntEvent {
  id: string;
  adapter: string;
  direction: Direction;
  eventType: string;
  externalId?: string;
  dealId?: string;
  status: EventStatus;
  httpStatus?: number;
  durationMs: number;
  errorMessage?: string;
  ts: string;
}

const EVENTS: IntEvent[] = [
  { id: 'IE-001', adapter: 'FgisZernoAdapter', direction: 'outbound', eventType: 'lot.register', externalId: 'FGIS-LOT-88821', dealId: 'DL-9102', status: 'success', httpStatus: 200, durationMs: 312, ts: '14:35:22' },
  { id: 'IE-002', adapter: 'DiadokAdapter', direction: 'outbound', eventType: 'document.send', externalId: 'DIADOK-54821', dealId: 'DL-9107', status: 'success', httpStatus: 201, durationMs: 488, ts: '14:33:11' },
  { id: 'IE-003', adapter: 'BankAdapter', direction: 'inbound', eventType: 'payment.received', dealId: 'DL-9102', status: 'success', httpStatus: 200, durationMs: 145, ts: '14:28:44' },
  { id: 'IE-004', adapter: 'FgisZernoAdapter', direction: 'outbound', eventType: 'shipment.confirm', externalId: 'FGIS-SH-4421', dealId: 'DL-9114', status: 'error', httpStatus: 503, durationMs: 5001, errorMessage: 'ФГИС API недоступен. Повтор через 30 сек.', ts: '14:22:10' },
  { id: 'IE-005', adapter: 'KryptoproAdapter', direction: 'outbound', eventType: 'document.sign', dealId: 'DL-9107', status: 'success', httpStatus: 200, durationMs: 820, ts: '14:18:33' },
  { id: 'IE-006', adapter: 'FnsAdapter', direction: 'outbound', eventType: 'inn.verify', externalId: '6829012345', status: 'success', httpStatus: 200, durationMs: 210, ts: '14:12:05' },
  { id: 'IE-007', adapter: 'GpsAdapter', direction: 'inbound', eventType: 'vehicle.location', dealId: 'DL-9114', status: 'success', httpStatus: 200, durationMs: 88, ts: '14:10:21' },
  { id: 'IE-008', adapter: 'DiadokAdapter', direction: 'inbound', eventType: 'document.status', externalId: 'DIADOK-54810', dealId: 'DL-9102', status: 'pending', durationMs: 0, ts: '14:05:00' },
];

const ADAPTERS = Array.from(new Set(EVENTS.map((e) => e.adapter)));

const STATUS_CONFIG: Record<EventStatus, { label: string; color: string }> = {
  success: { label: 'OK', color: '#0A7A5F' },
  error: { label: 'ERR', color: '#DC2626' },
  pending: { label: '…', color: '#D97706' },
};

const DIR_CONFIG: Record<Direction, { label: string; color: string }> = {
  inbound: { label: '← Вход', color: '#2563EB' },
  outbound: { label: '→ Исход', color: '#7C3AED' },
};

export function IntegrationEventLog() {
  const [filterAdapter, setFilterAdapter] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<EventStatus | 'all'>('all');
  const [filterDir, setFilterDir] = useState<Direction | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = EVENTS.filter((e) => {
    if (filterAdapter !== 'all' && e.adapter !== filterAdapter) return false;
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    if (filterDir !== 'all' && e.direction !== filterDir) return false;
    return true;
  });

  const label: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

  const sel: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid #E4E6EA',
    fontSize: 11, fontWeight: 600, background: '#fff', color: '#0F1419',
  };

  const errors = EVENTS.filter((e) => e.status === 'error').length;
  const pending = EVENTS.filter((e) => e.status === 'pending').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
        {[
          { label: 'Всего событий', value: EVENTS.length, color: '#0F1419' },
          { label: 'Успешно', value: EVENTS.filter((e) => e.status === 'success').length, color: '#0A7A5F' },
          { label: 'Ошибки', value: errors, color: errors > 0 ? '#DC2626' : '#0F1419' },
          { label: 'Ожидание', value: pending, color: pending > 0 ? '#D97706' : '#0F1419' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
            <div style={label}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterAdapter} onChange={(e) => setFilterAdapter(e.target.value)} style={sel}>
          <option value="all">Все адаптеры</option>
          {ADAPTERS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as EventStatus | 'all')} style={sel}>
          <option value="all">Все статусы</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="pending">Pending</option>
        </select>
        <select value={filterDir} onChange={(e) => setFilterDir(e.target.value as Direction | 'all')} style={sel}>
          <option value="all">Все направления</option>
          <option value="inbound">Входящие</option>
          <option value="outbound">Исходящие</option>
        </select>
      </div>

      {/* Event list */}
      <div style={{ border: '1px solid #E4E6EA', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Нет событий</div>
        )}
        {filtered.map((ev, i) => {
          const sc = STATUS_CONFIG[ev.status];
          const dc = DIR_CONFIG[ev.direction];
          const isExp = expanded === ev.id;
          return (
            <div key={ev.id}>
              <div
                onClick={() => setExpanded(isExp ? null : ev.id)}
                style={{
                  display: 'grid', gridTemplateColumns: '60px 130px 1fr 60px 60px',
                  gap: 10, padding: '10px 14px', cursor: 'pointer', alignItems: 'center',
                  borderBottom: i < filtered.length - 1 || isExp ? '1px solid #F1F5F9' : 'none',
                  background: isExp ? '#F8FAFB' : '#fff',
                }}
              >
                <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>{ev.ts}</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{ev.adapter.replace('Adapter', '')}</div>
                  <div style={{ fontSize: 10, color: dc.color, fontWeight: 700 }}>{dc.label}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0F1419', fontFamily: 'var(--font-mono)' }}>{ev.eventType}</div>
                  {ev.dealId && <div style={{ fontSize: 10, color: '#2563EB' }}>↳ {ev.dealId}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: sc.color, background: `${sc.color}18`, padding: '3px 6px', borderRadius: 6 }}>{sc.label}</span>
                  {ev.httpStatus && <div style={{ fontSize: 9, color: '#94A3B8' }}>{ev.httpStatus}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 10, color: '#94A3B8' }}>
                  {ev.durationMs > 0 ? `${ev.durationMs}мс` : '—'}
                </div>
              </div>
              {isExp && (
                <div style={{ padding: '10px 14px', background: '#F8FAFB', borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none', fontSize: 11, display: 'grid', gap: 4 }}>
                  {ev.externalId && <div><span style={{ color: '#64748B' }}>External ID:</span> <code style={{ fontFamily: 'var(--font-mono)' }}>{ev.externalId}</code></div>}
                  {ev.errorMessage && <div style={{ color: '#DC2626' }}>⚠ {ev.errorMessage}</div>}
                  <div><span style={{ color: '#64748B' }}>Event ID:</span> <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{ev.id}</code></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Демо-превью. В боевом контуре — PostgreSQL таблица integration_event с retention 30 дней, Kafka topik grainflow.integrations.*, Grafana дашборд.
      </div>
    </div>
  );
}
