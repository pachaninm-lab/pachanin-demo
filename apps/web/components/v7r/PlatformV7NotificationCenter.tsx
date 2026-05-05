'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, X } from 'lucide-react';
import {
  platformV7ShellNotificationCenterModel,
  type PlatformV7ShellNotificationCenterModel,
} from '@/lib/platform-v7/shellNotificationCenter';
import type { PlatformV7NotificationSeverity, PlatformV7ShellNotification } from '@/lib/platform-v7/shellNotifications';

const severityLabel: Record<PlatformV7NotificationSeverity, string> = {
  critical: 'Критично',
  warning: 'Внимание',
  info: 'Инфо',
  success: 'OK',
};

const kindLabel: Record<PlatformV7ShellNotification['kind'], string> = {
  money: 'Деньги',
  document: 'Документы',
  logistics: 'Логистика',
  dispute: 'Спор',
  risk: 'Риск',
  system: 'Система',
};

function severityTone(severity: PlatformV7NotificationSeverity): React.CSSProperties {
  if (severity === 'critical') return { color: '#FF8B90' };
  if (severity === 'warning') return { color: '#F5B41E' };
  if (severity === 'success') return { color: '#7EF2C4' };
  return { color: '#93C5FD' };
}

function formatUtcTimestamp(iso: string): string {
  const value = new Date(iso);
  const day = value.getUTCDate().toString().padStart(2, '0');
  const month = (value.getUTCMonth() + 1).toString().padStart(2, '0');
  const hour = value.getUTCHours().toString().padStart(2, '0');
  const minute = value.getUTCMinutes().toString().padStart(2, '0');

  return `${day}.${month} ${hour}:${minute} UTC`;
}

function notificationLinkLabel(notification: PlatformV7ShellNotification): string {
  return `${notification.title}${notification.dealId ? `, сделка ${notification.dealId}` : ''} — открыть`;
}

function NotificationRow({ notification, onOpen, read }: { notification: PlatformV7ShellNotification; onOpen: () => void; read?: boolean }) {
  const isRead = read ?? notification.read;
  return (
    <Link
      href={notification.href}
      onClick={onOpen}
      aria-label={notificationLinkLabel(notification)}
      style={{
        display: 'block',
        minHeight: 46,
        padding: '10px 12px',
        borderRadius: 12,
        textDecoration: 'none',
        background: isRead ? 'transparent' : 'var(--pc-bg-subtle)',
        border: `1px solid ${isRead ? 'transparent' : 'var(--pc-border)'}`,
        boxShadow: isRead ? 'none' : 'var(--pc-shadow-sm)',
        opacity: isRead ? 0.72 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: 'var(--pc-text-primary)', fontSize: 12, fontWeight: isRead ? 650 : 850, lineHeight: 1.4 }}>
          {notification.title}
        </span>
        <span style={{ ...severityTone(notification.severity), flexShrink: 0, fontSize: 10, fontWeight: 850, lineHeight: 1.4, opacity: isRead ? 0.72 : 1 }}>
          {severityLabel[notification.severity]}
        </span>
      </div>
      <div style={{ color: 'var(--pc-text-secondary)', fontSize: 11, lineHeight: 1.5, marginTop: 3, wordBreak: 'break-word' }}>
        {notification.description}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {notification.dealId ? (
          <span style={{ color: 'var(--pc-text-muted)', fontSize: 10, fontWeight: 750 }}>{notification.dealId}</span>
        ) : null}
        <span style={{ color: 'var(--pc-text-muted)', fontSize: 10 }}>{kindLabel[notification.kind]}</span>
        <span suppressHydrationWarning style={{ color: 'var(--pc-text-muted)', fontSize: 10, marginLeft: 'auto' }}>
          {formatUtcTimestamp(notification.createdAtIso)}
        </span>
      </div>
    </Link>
  );
}

function HeaderIconButton({
  ariaLabel,
  active,
  children,
  badge,
  tone,
  onClick,
}: {
  ariaLabel: string;
  active?: boolean;
  children: React.ReactNode;
  badge?: string | number;
  tone?: 'critical' | 'default';
  onClick: () => void;
}) {
  const isCritical = tone === 'critical';
  return (
    <button
      type='button'
      aria-label={ariaLabel}
      aria-expanded={active}
      aria-haspopup='dialog'
      className='pc-shell-iconbtn'
      onClick={onClick}
      style={isCritical ? { borderColor: 'rgba(255,139,144,0.42)' } : undefined}
    >
      {children}
      {badge ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: 2,
            top: 2,
            minWidth: 17,
            height: 17,
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            background: isCritical ? '#E5484D' : 'var(--pc-accent)',
            color: isCritical ? '#fff' : 'var(--pc-bg)',
            fontSize: 9,
            fontWeight: 850,
            lineHeight: 1,
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function PlatformV7NotificationCenter({
  model = platformV7ShellNotificationCenterModel(),
}: {
  model?: PlatformV7ShellNotificationCenterModel;
}) {
  const [open, setOpen] = React.useState(false);
  const [acknowledged, setAcknowledged] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const { summary, primary, items, hasCritical, hasUnread, badgeLabel } = model;
  const hasNewItems = !acknowledged && (hasCritical || hasUnread);
  const showWarningTrigger = !acknowledged && hasCritical;
  const readItems = acknowledged;

  const close = React.useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  const togglePanel = React.useCallback(() => {
    setOpen((value) => !value);
    setAcknowledged(true);
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, open]);

  const warningsLabel = hasCritical
    ? `Предупреждения: ${acknowledged ? 'просмотрены' : `${summary.critical} критических`}`
    : 'Предупреждения: критических нет';
  const notificationsLabel = acknowledged
    ? 'Уведомления: последние просмотренные'
    : `Уведомления: ${summary.unread} непрочитанных`;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {showWarningTrigger ? (
        <HeaderIconButton
          ariaLabel={warningsLabel}
          active={open}
          tone='critical'
          badge={summary.critical}
          onClick={togglePanel}
        >
          <AlertTriangle size={18} aria-hidden style={{ color: '#FF8B90' }} />
        </HeaderIconButton>
      ) : null}
      <HeaderIconButton
        ariaLabel={notificationsLabel}
        active={open}
        badge={!acknowledged && hasUnread ? badgeLabel : undefined}
        onClick={togglePanel}
      >
        <Bell size={18} aria-hidden />
      </HeaderIconButton>

      {open ? (
        <>
          <div aria-hidden onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 69, background: 'transparent' }} />
          <div role='dialog' aria-label='Центр уведомлений' className='pc-alert-panel' style={{ zIndex: 71 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 6px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 900 }}>
                  {acknowledged ? 'Последние уведомления' : 'Уведомления'}
                </span>
                {!acknowledged && hasCritical ? (
                  <span
                    style={{
                      border: '1px solid rgba(255,139,144,0.3)',
                      borderRadius: 999,
                      padding: '2px 6px',
                      background: 'rgba(255,139,144,0.08)',
                      color: '#FF8B90',
                      fontSize: 10,
                      fontWeight: 850,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {summary.critical} критич.
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--pc-text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                  {hasNewItems ? `${summary.unread} непрочитанных` : 'новых нет'}
                </span>
                <button
                  type='button'
                  aria-label='Закрыть центр уведомлений'
                  onClick={close}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 34,
                    minHeight: 34,
                    border: '1px solid transparent',
                    borderRadius: 10,
                    background: 'transparent',
                    color: 'var(--pc-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            </div>

            {primary ? (
              <section style={{ marginBottom: 12 }}>
                <div style={{ color: 'var(--pc-text-muted)', fontSize: 10, fontWeight: 850, letterSpacing: '0.06em', marginBottom: 4, padding: '3px 6px', textTransform: 'uppercase' }}>
                  {acknowledged ? 'Последний важный сигнал' : 'Главный блокер'}
                </div>
                <Link
                  href={primary.href}
                  onClick={close}
                  aria-label={notificationLinkLabel(primary)}
                  style={{
                    display: 'block',
                    padding: '11px 12px',
                    borderRadius: 12,
                    textDecoration: 'none',
                    background: acknowledged ? 'transparent' : primary.severity === 'critical' ? 'rgba(255,139,144,0.06)' : 'rgba(245,180,30,0.06)',
                    border: `1px solid ${acknowledged ? 'var(--pc-border)' : primary.severity === 'critical' ? 'rgba(255,139,144,0.28)' : 'rgba(245,180,30,0.22)'}`,
                    boxShadow: acknowledged ? 'none' : 'var(--pc-shadow-sm)',
                    opacity: acknowledged ? 0.78 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: 'var(--pc-text-primary)', fontSize: 12, fontWeight: 850, lineHeight: 1.4 }}>{primary.title}</span>
                    <span style={{ ...severityTone(primary.severity), flexShrink: 0, fontSize: 10, fontWeight: 850, opacity: acknowledged ? 0.72 : 1 }}>{severityLabel[primary.severity]}</span>
                  </div>
                  <div style={{ color: 'var(--pc-text-secondary)', fontSize: 11, lineHeight: 1.5, wordBreak: 'break-word' }}>{primary.description}</div>
                  {primary.dealId ? (
                    <div style={{ color: 'var(--pc-text-muted)', fontSize: 10, fontWeight: 750, marginTop: 6 }}>
                      {primary.dealId} · {kindLabel[primary.kind]} → Открыть
                    </div>
                  ) : null}
                </Link>
              </section>
            ) : null}

            <section style={{ display: 'grid', gap: 4 }}>
              <div style={{ color: 'var(--pc-text-muted)', fontSize: 10, fontWeight: 850, letterSpacing: '0.06em', marginBottom: 2, padding: '3px 6px', textTransform: 'uppercase' }}>
                {acknowledged ? `Прочитанные · ${items.length}` : `Все уведомления · ${items.length}`}
              </div>
              {items.map((notification) => (
                <NotificationRow key={notification.id} notification={notification} onOpen={close} read={readItems || notification.read} />
              ))}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
