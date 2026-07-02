'use client';

import { useEffect, useState } from 'react';

type NotificationPermission = 'default' | 'granted' | 'denied';

export interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  type: 'deal' | 'payment' | 'dispute' | 'document' | 'logistics' | 'system';
  href?: string;
  createdAt: string;
  read: boolean;
}

const TYPE_ICON: Record<PlatformNotification['type'], string> = {
  deal: '📋',
  payment: '💰',
  dispute: '⚖️',
  document: '📄',
  logistics: '🚛',
  system: '⚙️',
};

const DEMO_NOTIFICATIONS: PlatformNotification[] = [
  { id: 'n-1', title: 'Платёж подтверждён', body: 'Резерв 9,65 млн ₽ по сделке DL-9106 подтверждён банком', type: 'payment', href: '/platform-v7/deals/DL-9106/money', createdAt: new Date(Date.now() - 300_000).toISOString(), read: false },
  { id: 'n-2', title: 'Спор открыт', body: 'По сделке DL-9102 инициирован спор на 624 тыс. ₽ — отклонение по весу', type: 'dispute', href: '/platform-v7/disputes/DISP-001', createdAt: new Date(Date.now() - 1_200_000).toISOString(), read: false },
  { id: 'n-3', title: 'Рейс ТМБ-14 прибыл', body: 'Водитель подтвердил прибытие на элеватор в Воронеже', type: 'logistics', href: '/platform-v7/logistics/%D0%A2%D0%9C%D0%91-14', createdAt: new Date(Date.now() - 3_600_000).toISOString(), read: true },
  { id: 'n-4', title: 'Документ требует подписи', body: 'ЭТрН-2024-003451 ожидает подписи грузополучателя', type: 'document', href: '/platform-v7/documents', createdAt: new Date(Date.now() - 7_200_000).toISOString(), read: true },
];

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(ms / 3_600_000);
  if (mins < 60) return `${mins} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

export function PushNotificationBanner() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [notifications, setNotifications] = useState<PlatformNotification[]>(DEMO_NOTIFICATIONS);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  async function requestPermission() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      new Notification('GrainFlow · Уведомления включены', {
        body: 'Вы будете получать уведомления о сделках, платежах и спорах в реальном времени.',
        icon: '/favicon.ico',
      });
    }
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {permission === 'default' && (
          <button
            onClick={requestPermission}
            style={{
              padding: '0.5rem 0.875rem',
              borderRadius: '8px',
              border: '1px solid var(--p7-color-brand, #0A7A5F)',
              background: 'rgba(10,122,95,0.08)',
              color: 'var(--p7-color-brand)',
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              minHeight: '36px',
            }}
          >
            🔔 Включить уведомления
          </button>
        )}

        {permission === 'granted' && (
          <div style={{ fontSize: '10px', color: 'var(--status-active-text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            ✓ Push-уведомления активны
          </div>
        )}

        {permission === 'denied' && (
          <div style={{ fontSize: '10px', color: 'var(--status-warning-text)', fontWeight: 600 }}>
            ⚠ Уведомления заблокированы — разрешите в настройках браузера
          </div>
        )}

        <button
          onClick={() => setIsOpen((v) => !v)}
          style={{
            position: 'relative',
            padding: '0.375rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--p7-color-border)',
            background: 'transparent',
            color: 'var(--pc-text-primary)',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            minHeight: '36px',
          }}
        >
          🔔 Уведомления
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: 'var(--status-error-text, #DC2626)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 'min(360px, calc(100vw - 24px))',
          background: 'var(--p7-color-surface, #0E1A18)',
          border: '1px solid var(--p7-color-border, #24342F)',
          borderRadius: '14px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '0.75rem 0.875rem', borderBottom: '1px solid var(--p7-color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>
              Уведомления {unreadCount > 0 && `(${unreadCount} новых)`}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ fontSize: '10px', color: 'var(--p7-color-brand)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                  Прочитать все
                </button>
              )}
              <button onClick={() => setIsOpen(false)} style={{ fontSize: '1rem', color: 'var(--pc-text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>
                ✕
              </button>
            </div>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {notifications.map((n) => (
              <a
                key={n.id}
                href={n.href}
                onClick={() => {
                  setNotifications((prev) => prev.map((p) => p.id === n.id ? { ...p, read: true } : p));
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  padding: '0.75rem 0.875rem',
                  borderBottom: '1px solid var(--p7-color-border)',
                  textDecoration: 'none',
                  background: n.read ? 'transparent' : 'rgba(10,122,95,0.06)',
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{TYPE_ICON[n.type]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: n.read ? 600 : 800, color: 'var(--pc-text-primary)', lineHeight: 1.3 }}>
                      {n.title}
                    </div>
                    {!n.read && (
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--p7-color-brand)', flexShrink: 0, marginTop: '4px' }} />
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                    {n.body}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', marginTop: '4px' }}>
                    {formatAge(n.createdAt)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
