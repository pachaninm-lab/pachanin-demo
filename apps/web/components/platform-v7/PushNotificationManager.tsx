'use client';

import { useState, useEffect } from 'react';

type NotifEvent = 'deal_status' | 'payment_blocked' | 'dispute_opened' | 'document_required' | 'quality_mismatch' | 'shipment_arrived';

interface NotifPrefs {
  event: NotifEvent;
  label: string;
  description: string;
  enabled: boolean;
  icon: string;
}

const DEFAULT_PREFS: NotifPrefs[] = [
  { event: 'deal_status',      label: 'Изменение статуса сделки', description: 'При смене этапа исполнения', icon: '📋', enabled: true },
  { event: 'payment_blocked',  label: 'Блокировка выплаты',       description: 'Когда деньги заблокированы по любой причине', icon: '⚠️', enabled: true },
  { event: 'dispute_opened',   label: 'Открытие спора',           description: 'Новый или изменённый спор по вашей сделке', icon: '⚖️', enabled: true },
  { event: 'document_required',label: 'Требуется документ',       description: 'Отсутствует обязательный документ', icon: '📄', enabled: false },
  { event: 'quality_mismatch', label: 'Расхождение по качеству',  description: 'Протокол лаборатории выявил отклонение', icon: '🔬', enabled: true },
  { event: 'shipment_arrived', label: 'Прибытие груза',           description: 'Водитель подтвердил прибытие на элеватор', icon: '🚛', enabled: false },
];

type PermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

export function PushNotificationManager() {
  const [permission, setPermission] = useState<PermissionStatus>('default');
  const [prefs, setPrefs] = useState<NotifPrefs[]>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PermissionStatus);
  }, []);

  async function requestPermission() {
    if (!('Notification' in window)) return;
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionStatus);
      if (result === 'granted') {
        new Notification('GrainFlow · уведомления включены', {
          body: 'Вы будете получать важные события по сделкам и платежам.',
          icon: '/icon-192.png',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function sendTest() {
    if (permission !== 'granted') return;
    new Notification('GrainFlow · тестовое уведомление', {
      body: 'Сделка DL-9102: выплата 9 365 700 ₽ заблокирована · нужен документ',
      icon: '/icon-192.png',
      tag: 'test',
    });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  }

  function togglePref(event: NotifEvent) {
    setPrefs((prev) => prev.map((p) => p.event === event ? { ...p, enabled: !p.enabled } : p));
  }

  const permLabel: Record<PermissionStatus, { text: string; color: string; bg: string; border: string }> = {
    default:     { text: 'Не настроено', color: '#B45309', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.2)' },
    granted:     { text: 'Разрешено',    color: '#0A7A5F', bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.2)' },
    denied:      { text: 'Заблокировано', color: '#B91C1C', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)' },
    unsupported: { text: 'Не поддерживается', color: '#64748B', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' },
  };
  const pal = permLabel[permission];

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Status */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.875rem', borderRadius: 12, background: pal.bg, border: `1px solid ${pal.border}` }}>
        <div style={{ fontSize: 22 }}>🔔</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: pal.color }}>
            Браузерные Push-уведомления · {pal.text}
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
            {permission === 'granted' && 'Уведомления активны. Вы получаете события в реальном времени.'}
            {permission === 'default' && 'Нажмите «Включить», чтобы получать уведомления о сделках.'}
            {permission === 'denied' && 'Вы заблокировали уведомления. Разрешите в настройках браузера.'}
            {permission === 'unsupported' && 'Браузер не поддерживает уведомления. Используйте Chrome / Firefox.'}
          </div>
        </div>
        {(permission === 'default' || permission === 'granted') && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {permission === 'default' && (
              <button
                onClick={requestPermission}
                disabled={loading}
                style={{ fontSize: 12, fontWeight: 800, padding: '8px 16px', borderRadius: 10, cursor: loading ? 'wait' : 'pointer', border: 'none', background: '#0A7A5F', color: '#fff' }}
              >
                {loading ? 'Запрос...' : 'Включить'}
              </button>
            )}
            {permission === 'granted' && (
              <button
                onClick={sendTest}
                style={{ fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(10,122,95,0.3)', background: 'transparent', color: '#0A7A5F' }}
              >
                {testSent ? '✓ Отправлено' : 'Тест'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Event preferences */}
      <div style={{ display: 'grid', gap: '0.375rem' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0F1419', marginBottom: 4 }}>
          Какие события отправлять
        </div>
        {prefs.map((pref) => (
          <label
            key={pref.event}
            style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.625rem 0.75rem', borderRadius: 10, border: '1px solid var(--p7-color-border, #E4E6EA)', background: pref.enabled ? 'rgba(10,122,95,0.04)' : '#FAFAFA', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{pref.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419' }}>{pref.label}</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>{pref.description}</div>
            </div>
            <div
              onClick={() => togglePref(pref.event)}
              style={{
                width: 36, height: 20, borderRadius: 999, cursor: 'pointer', flexShrink: 0,
                background: pref.enabled ? '#0A7A5F' : '#CBD5E1',
                position: 'relative', transition: 'background 200ms',
              }}
              role="switch"
              aria-checked={pref.enabled}
            >
              <div style={{
                position: 'absolute', top: 2, left: pref.enabled ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </label>
        ))}
      </div>

      {/* PWA / Service Worker note */}
      <div style={{ padding: '0.625rem 0.875rem', borderRadius: 10, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.14)', fontSize: 11, color: '#374151', lineHeight: 1.55 }}>
        <strong style={{ color: '#2563EB' }}>Service Worker Push</strong> — в мобильном приложении (PWA) уведомления
        работают даже при закрытом браузере через Web Push Protocol + VAPID-ключи.
        Токен устройства хранится в IndexedDB и синхронизируется с сервером при каждом запуске.
      </div>
    </div>
  );
}
