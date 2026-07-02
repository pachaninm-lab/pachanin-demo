'use client';

import { useState } from 'react';

type SyncStatus = 'synced' | 'pending' | 'conflict' | 'failed';

interface CachedItem {
  id: string;
  type: 'shipment' | 'document' | 'address' | 'deal';
  label: string;
  dealId: string | null;
  cachedAt: string;
  sizeKb: number;
}

interface QueuedAction {
  id: string;
  type: 'photo' | 'gps_mark' | 'signature' | 'form_submit';
  label: string;
  dealId: string | null;
  createdAt: string;
  retries: number;
  status: SyncStatus;
  conflictReason: string | null;
}

const CACHED_ITEMS: CachedItem[] = [
  { id: 'c-001', type: 'shipment', label: 'Рейс SH-4412 Ростов → Новороссийск', dealId: 'DL-9095', cachedAt: '2024-03-20T06:00:00Z', sizeKb: 24 },
  { id: 'c-002', type: 'shipment', label: 'Рейс SH-4415 Кущёвская → Краснодар', dealId: 'DL-9110', cachedAt: '2024-03-20T06:00:00Z', sizeKb: 18 },
  { id: 'c-003', type: 'document', label: 'ЭТрН SH-4412 (XML СБИС)', dealId: 'DL-9095', cachedAt: '2024-03-20T06:01:00Z', sizeKb: 12 },
  { id: 'c-004', type: 'address', label: 'Адрес разгрузки: ПАО «Новороссийский КХП», ул. Портовая 4', dealId: null, cachedAt: '2024-03-19T18:00:00Z', sizeKb: 2 },
  { id: 'c-005', type: 'address', label: 'Адрес загрузки: ООО «АгроХолдинг Черноземье», элеватор пос. Зерновой', dealId: null, cachedAt: '2024-03-19T18:00:00Z', sizeKb: 2 },
  { id: 'c-006', type: 'deal', label: 'Сделка DL-9095: условия, контакты, инструкции', dealId: 'DL-9095', cachedAt: '2024-03-20T06:02:00Z', sizeKb: 8 },
];

const QUEUED_ACTIONS: QueuedAction[] = [
  { id: 'q-001', type: 'photo', label: 'Фото пломбы вагона №52134789', dealId: 'DL-9095', createdAt: '2024-03-20T09:15:00Z', retries: 0, status: 'pending', conflictReason: null },
  { id: 'q-002', type: 'gps_mark', label: 'GPS-отметка: въезд на территорию КХП', dealId: 'DL-9095', createdAt: '2024-03-20T09:17:00Z', retries: 1, status: 'pending', conflictReason: null },
  { id: 'q-003', type: 'signature', label: 'Подпись акта приёмки SH-4412', dealId: 'DL-9095', createdAt: '2024-03-20T08:50:00Z', retries: 3, status: 'failed', conflictReason: 'Network timeout (3/3 retries)' },
  { id: 'q-004', type: 'form_submit', label: 'Форма ГУ-29 финальная отметка', dealId: 'DL-9095', createdAt: '2024-03-20T08:30:00Z', retries: 0, status: 'conflict', conflictReason: 'Статус рейса изменён сервером (last-write-wins)' },
  { id: 'q-005', type: 'gps_mark', label: 'GPS-отметка: отправление от элеватора', dealId: 'DL-9110', createdAt: '2024-03-20T10:05:00Z', retries: 0, status: 'synced', conflictReason: null },
];

const SYNC_CONFIG: Record<SyncStatus, { label: string; bg: string; color: string; icon: string }> = {
  synced:   { label: 'Синхронизировано', bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  pending:  { label: 'В очереди',        bg: '#FEF3C7', color: '#92400E', icon: '⏳' },
  conflict: { label: 'Конфликт',         bg: '#FEE2E2', color: '#991B1B', icon: '⚠' },
  failed:   { label: 'Ошибка',           bg: '#FEE2E2', color: '#991B1B', icon: '✗' },
};

const TYPE_LABELS: Record<QueuedAction['type'], string> = {
  photo: 'Фото',
  gps_mark: 'GPS',
  signature: 'Подпись',
  form_submit: 'Форма',
};

const CACHE_TYPE_LABELS: Record<CachedItem['type'], { icon: string; color: string }> = {
  shipment: { icon: '🚛', color: '#065F46' },
  document: { icon: '📄', color: '#1E40AF' },
  address:  { icon: '📍', color: '#5B21B6' },
  deal:     { icon: '🤝', color: '#92400E' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'cache' | 'queue' | 'settings';

export function PwaOfflinePanel() {
  const [tab, setTab] = useState<Tab>('cache');
  const [isOnline] = useState(false);

  const totalCacheKb = CACHED_ITEMS.reduce((s, c) => s + c.sizeKb, 0);
  const pendingCount = QUEUED_ACTIONS.filter(a => a.status === 'pending').length;
  const conflictCount = QUEUED_ACTIONS.filter(a => a.status === 'conflict' || a.status === 'failed').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Online/Offline banner */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: isOnline ? '#D1FAE5' : '#FEF3C7', border: `1px solid ${isOnline ? '#BBF7D0' : '#FDE68A'}`, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? '#16a34a' : '#d97706', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: isOnline ? '#065F46' : '#92400E' }}>
          {isOnline ? 'Online — данные синхронизируются в реальном времени' : 'Offline-режим — работа из кэша IndexedDB, очередь действий накапливается'}
        </span>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Кэш (IndexedDB)', value: `${totalCacheKb} КБ`, color: '#1E40AF' },
          { label: 'Объектов',        value: CACHED_ITEMS.length,  color: '#0F1419' },
          { label: 'В очереди',       value: pendingCount,          color: '#92400E' },
          { label: 'Конфликтов',      value: conflictCount,         color: conflictCount > 0 ? '#DC2626' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['cache', 'Кэш рейсов'], ['queue', 'Очередь действий'], ['settings', 'Настройки']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'cache' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={{ ...lbl, marginBottom: 2 }}>Активный рейсы, адреса и документы в IndexedDB</div>
          {CACHED_ITEMS.map((item) => {
            const t = CACHE_TYPE_LABELS[item.type];
            return (
              <div key={item.id} style={{ padding: '6px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#0F1419' }}>{item.label}</div>
                  {item.dealId && <div style={{ fontSize: 9, color: '#64748B' }}>{item.dealId} · кэш: {new Date(item.cachedAt).toLocaleTimeString('ru-RU')}</div>}
                </div>
                <span style={{ fontSize: 9, color: '#94A3B8', flexShrink: 0 }}>{item.sizeKb} КБ</span>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button style={{ fontSize: 10, padding: '4px 12px', borderRadius: 6, border: '1px solid #BBF7D0', background: '#F0FDF4', cursor: 'pointer', fontWeight: 700, color: '#065F46' }}>Обновить кэш</button>
            <button style={{ fontSize: 10, padding: '4px 12px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', fontWeight: 700, color: '#DC2626' }}>Очистить кэш</button>
          </div>
        </div>
      )}

      {tab === 'queue' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={{ ...lbl, marginBottom: 2 }}>Фото, GPS-отметки, подписи — синхронизация при восстановлении сети</div>
          {QUEUED_ACTIONS.map((action) => {
            const st = SYNC_CONFIG[action.status];
            return (
              <div key={action.id} style={{ padding: '7px 10px', borderRadius: 8, background: action.status === 'synced' ? '#F0FDF4' : action.status === 'pending' ? '#FFFBEB' : '#FEF2F2', border: `1px solid ${action.status === 'synced' ? '#BBF7D0' : action.status === 'pending' ? '#FDE68A' : '#FECACA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: '#E4E6EA', color: '#374151' }}>{TYPE_LABELS[action.type]}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{action.label}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                </div>
                {action.conflictReason && (
                  <div style={{ fontSize: 9, color: '#991B1B', marginTop: 3 }}>
                    ℹ {action.conflictReason} — last-write-wins применён, уведомление отправлено
                  </div>
                )}
                {action.retries > 0 && action.status !== 'synced' && (
                  <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>Попыток: {action.retries}</div>
                )}
                {(action.status === 'failed' || action.status === 'conflict') && (
                  <button style={{ marginTop: 4, fontSize: 9, padding: '2px 8px', borderRadius: 5, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#374151' }}>Повторить вручную</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'settings' && (
        <div style={{ display: 'grid', gap: 6 }}>
          {[
            { label: 'Service Worker', value: 'Зарегистрирован (sw.js v2.1.0)', ok: true },
            { label: 'IndexedDB', value: 'grainflow-offline v3 · 4 объектных хранилища', ok: true },
            { label: 'Background Sync API', value: 'Поддерживается браузером', ok: true },
            { label: 'Cache Storage', value: `${totalCacheKb} КБ / 50 МБ лимит`, ok: true },
            { label: 'Стратегия конфликтов', value: 'last-write-wins + уведомление водителю', ok: true },
            { label: 'Heartbeat (online check)', value: 'Каждые 10 сек → /health', ok: true },
            { label: 'Push Notifications', value: 'FCM · deal_status · payment · dispute', ok: true },
          ].map((s) => (
            <div key={s.label} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: s.ok ? '#065F46' : '#DC2626' }}>{s.ok ? '✓' : '✗'}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#374151', minWidth: 180 }}>{s.label}</span>
              <span style={{ fontSize: 9, color: '#64748B' }}>{s.value}</span>
            </div>
          ))}
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.5 }}>
            PWA: manifest.json · scope:/driver · Workbox 7 · NetworkFirst для API · CacheFirst для статики · IndexedDB 4 stores: shipments, documents, addresses, action_queue
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        PWA offline-first · IndexedDB / Service Worker · Background Sync · Очередь действий · last-write-wins + уведомление · FCM Push · Демо-данные.
      </div>
    </div>
  );
}
