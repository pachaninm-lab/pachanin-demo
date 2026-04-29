'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, AlertTriangle, X } from 'lucide-react';
import {
  platformV7PrimaryShellNotification,
  platformV7ShellNotificationSummary,
  platformV7ShellNotifications,
  type PlatformV7NotificationSeverity,
  type PlatformV7ShellNotification,
} from '@/lib/platform-v7/shellNotifications';

const SEVERITY_RANK: Record<PlatformV7NotificationSeverity, number> = {
  critical: 4,
  warning: 3,
  info: 2,
  success: 1,
};

const SEVERITY_LABEL: Record<PlatformV7NotificationSeverity, string> = {
  critical: 'Критично',
  warning: 'Внимание',
  info: 'Инфо',
  success: 'OK',
};

const SEVERITY_COLOR: Record<PlatformV7NotificationSeverity, string> = {
  critical: '#FF8B90',
  warning: '#F5B41E',
  info: '#93C5FD',
  success: '#7EF2C4',
};

const KIND_LABEL: Record<PlatformV7ShellNotification['kind'], string> = {
  money: 'Деньги',
  document: 'Документы',
  logistics: 'Логистика',
  dispute: 'Спор',
  risk: 'Риск',
  system: 'Система',
};

function sortedForDisplay(notifications: PlatformV7ShellNotification[]): PlatformV7ShellNotification[] {
  return [...notifications].sort((a, b) => {
    if (!a.read && b.read) return -1;
    if (a.read && !b.read) return 1;
    const sv = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sv !== 0) return sv;
    return Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso);
  });
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const dd = d.getUTCDate().toString().padStart(2, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const min = d.getUTCMinutes().toString().padStart(2, '0');
  return `${dd}.${mm} ${hh}:${min} UTC`;
}

export function PlatformV7NotificationCenter() {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const summary = platformV7ShellNotificationSummary();
  const primary = platformV7PrimaryShellNotification();
  const all = platformV7ShellNotifications();
  const sorted = React.useMemo(() => sortedForDisplay(all), [all]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const hasCritical = summary.critical > 0;
  const ariaLabel = hasCritical
    ? `Уведомления: ${summary.unread} непрочитанных, ${summary.critical} критических`
    : `Уведомления: ${summary.unread} непрочитанных`;

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup='dialog'
        className='pc-shell-iconbtn'
        style={hasCritical ? { borderColor: 'rgba(255,139,144,0.4)' } : undefined}
      >
        {hasCritical ? (
          <AlertTriangle size={18} aria-hidden style={{ color: '#FF8B90' }} />
        ) : (
          <Bell size={18} aria-hidden />
        )}
        {summary.unread > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: -5,
              right: -3,
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              background: hasCritical ? '#E5484D' : 'var(--pc-accent)',
              color: hasCritical ? '#fff' : 'var(--pc-bg)',
              fontSize: 10,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {summary.unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            onClick={close}
            style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 69 }}
            aria-hidden
          />
          <div
            role='dialog'
            aria-label='Центр уведомлений'
            className='pc-alert-panel'
            style={{ zIndex: 71 }}
          >
            {/* Panel header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 6px 10px',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--pc-text-primary)' }}>
                  Уведомления
                </span>
                {hasCritical && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#FF8B90',
                      padding: '2px 6px',
                      borderRadius: 999,
                      border: '1px solid rgba(255,139,144,0.3)',
                      background: 'rgba(255,139,144,0.08)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {summary.critical} критич.
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--pc-text-muted)', whiteSpace: 'nowrap' }}>
                  {summary.unread} непрочитанных
                </span>
                <button
                  type='button'
                  onClick={close}
                  aria-label='Закрыть центр уведомлений'
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 4,
                    cursor: 'pointer',
                    color: 'var(--pc-text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: 6,
                    lineHeight: 0,
                  }}
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            </div>

            {/* Primary blocker */}
            {primary && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    padding: '3px 6px',
                    fontSize: 10,
                    fontWeight: 800,
                    color: 'var(--pc-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}
                >
                  Главный блокер
                </div>
                <Link
                  href={primary.href}
                  onClick={close}
                  aria-label={`${primary.title}${primary.dealId ? `, сделка ${primary.dealId}` : ''} — открыть`}
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    padding: '11px 12px',
                    borderRadius: 12,
                    background:
                      primary.severity === 'critical'
                        ? 'rgba(255,139,144,0.06)'
                        : 'rgba(245,180,30,0.06)',
                    border: `1px solid ${
                      primary.severity === 'critical'
                        ? 'rgba(255,139,144,0.28)'
                        : 'rgba(245,180,30,0.22)'
                    }`,
                    boxShadow: 'var(--pc-shadow-sm)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: 'var(--pc-text-primary)',
                        lineHeight: 1.4,
                      }}
                    >
                      {primary.title}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: SEVERITY_COLOR[primary.severity],
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {SEVERITY_LABEL[primary.severity]}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--pc-text-secondary)',
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}
                  >
                    {primary.description}
                  </div>
                  {primary.dealId && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--pc-text-muted)',
                      }}
                    >
                      {primary.dealId} · {KIND_LABEL[primary.kind]} → Открыть
                    </div>
                  )}
                </Link>
              </div>
            )}

            {/* Full list */}
            <div style={{ display: 'grid', gap: 4 }}>
              <div
                style={{
                  padding: '3px 6px',
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'var(--pc-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 2,
                }}
              >
                Все уведомления · {all.length}
              </div>
              {sorted.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={close}
                  aria-label={`${n.title}${n.dealId ? `, сделка ${n.dealId}` : ''} — открыть`}
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    padding: '9px 12px',
                    borderRadius: 12,
                    background: !n.read ? 'var(--pc-bg-subtle)' : 'transparent',
                    border: `1px solid ${!n.read ? 'var(--pc-border)' : 'transparent'}`,
                    opacity: n.read ? 0.6 : 1,
                    boxShadow: !n.read ? 'var(--pc-shadow-sm)' : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: n.read ? 600 : 800,
                        color: 'var(--pc-text-primary)',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}
                    >
                      {n.title}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: SEVERITY_COLOR[n.severity],
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {SEVERITY_LABEL[n.severity]}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--pc-text-secondary)',
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                      marginTop: 2,
                    }}
                  >
                    {n.description}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {n.dealId && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--pc-text-muted)' }}>
                        {n.dealId}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>
                      {KIND_LABEL[n.kind]}
                    </span>
                    <span
                      suppressHydrationWarning
                      style={{ fontSize: 10, color: 'var(--pc-text-muted)', marginLeft: 'auto' }}
                    >
                      {formatTimestamp(n.createdAtIso)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
