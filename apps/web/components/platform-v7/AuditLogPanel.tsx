'use client';

import { useState } from 'react';

type AuditAction =
  | 'deal_created' | 'deal_status_changed' | 'payment_released' | 'payment_blocked'
  | 'dispute_opened' | 'dispute_resolved' | 'document_uploaded' | 'document_signed'
  | 'lot_published' | 'lot_closed' | 'user_login' | 'user_login_failed'
  | 'mfa_enabled' | 'session_revoked' | 'role_changed' | 'bank_review_started';

type AuditSeverity = 'info' | 'warning' | 'critical';

interface AuditEntry {
  id: string;
  action: AuditAction;
  entityType: 'deal' | 'lot' | 'dispute' | 'document' | 'user' | 'payment';
  entityId: string;
  actorName: string;
  actorRole: string;
  ip: string;
  ts: string;
  severity: AuditSeverity;
  detail?: string;
}

const DEMO_ENTRIES: AuditEntry[] = [
  { id: 'AL-001', action: 'payment_blocked',     entityType: 'payment',  entityId: 'PAY-8803', actorName: 'Система', actorRole: 'auto', ip: '—', ts: '2024-04-10T14:32:11Z', severity: 'critical', detail: 'СДИЗ DL-9106 не подтверждён ФГИС — выплата заблокирована автоматически' },
  { id: 'AL-002', action: 'dispute_opened',       entityType: 'dispute',  entityId: 'DK-2024-91', actorName: 'Покупатель ООО Агро', actorRole: 'buyer', ip: '91.105.22.44', ts: '2024-04-09T11:15:03Z', severity: 'warning', detail: 'Недовес 1,17 т · удержание 1 170 000 ₽' },
  { id: 'AL-003', action: 'payment_released',     entityType: 'payment',  entityId: 'PAY-8802', actorName: 'СберБизнес API', actorRole: 'bank', ip: '—', ts: '2024-04-08T09:00:55Z', severity: 'info', detail: '2 800 000 ₽ выплачено продавцу ООО Зернотрейд' },
  { id: 'AL-004', action: 'document_signed',      entityType: 'document', entityId: 'ЭТрН-003451', actorName: 'Иванов С.П.', actorRole: 'driver', ip: '185.66.14.9', ts: '2024-04-07T16:44:28Z', severity: 'info', detail: 'УКЭП подписание ЭТрН рейса ТМБ-14' },
  { id: 'AL-005', action: 'user_login_failed',    entityType: 'user',     entityId: 'user-337', actorName: 'Неизвестный', actorRole: '—', ip: '194.87.11.3', ts: '2024-04-07T03:18:44Z', severity: 'critical', detail: 'Неверный пароль 3 раза подряд · IP подозрительный' },
  { id: 'AL-006', action: 'mfa_enabled',           entityType: 'user',     entityId: 'user-118', actorName: 'Петров В.С.', actorRole: 'operator', ip: '10.0.1.5', ts: '2024-04-06T10:10:00Z', severity: 'info', detail: 'TOTP MFA включён через мобильное приложение' },
  { id: 'AL-007', action: 'lot_published',         entityType: 'lot',      entityId: 'LOT-2410', actorName: 'ИП Фермеров К.С.', actorRole: 'seller', ip: '92.101.55.8', ts: '2024-04-05T08:30:00Z', severity: 'info', detail: 'Ячмень кормовой 350 т · Воронеж · 14 400 ₽/т' },
  { id: 'AL-008', action: 'deal_status_changed',   entityType: 'deal',     entityId: 'DL-9102', actorName: 'Оператор', actorRole: 'operator', ip: '10.0.1.3', ts: '2024-04-04T13:55:22Z', severity: 'warning', detail: 'Статус → «Расхождение по качеству» · спор DK-2024-89 открыт' },
  { id: 'AL-009', action: 'bank_review_started',   entityType: 'deal',     entityId: 'DL-9109', actorName: 'СберБизнес', actorRole: 'bank', ip: '—', ts: '2024-04-03T15:20:00Z', severity: 'info', detail: 'Банк начал проверку выплаты 10 500 000 ₽' },
  { id: 'AL-010', action: 'session_revoked',       entityType: 'user',     entityId: 'user-118', actorName: 'Петров В.С.', actorRole: 'operator', ip: '10.0.1.5', ts: '2024-04-02T18:44:00Z', severity: 'warning', detail: 'Отозвана сессия с устройства Windows 11 · ручное действие' },
];

const ACTION_LABEL: Record<AuditAction, string> = {
  deal_created:        'Сделка создана',
  deal_status_changed: 'Статус сделки изменён',
  payment_released:    'Выплата выполнена',
  payment_blocked:     'Выплата заблокирована',
  dispute_opened:      'Спор открыт',
  dispute_resolved:    'Спор закрыт',
  document_uploaded:   'Документ загружен',
  document_signed:     'Документ подписан',
  lot_published:       'Лот опубликован',
  lot_closed:          'Лот закрыт',
  user_login:          'Вход выполнен',
  user_login_failed:   'Попытка входа неудачна',
  mfa_enabled:         'MFA включён',
  session_revoked:     'Сессия отозвана',
  role_changed:        'Роль изменена',
  bank_review_started: 'Банк начал проверку',
};

const SEV_COLOR: Record<AuditSeverity, { bg: string; border: string; text: string; dot: string }> = {
  info:     { bg: 'rgba(37,99,235,0.04)',  border: 'rgba(37,99,235,0.12)',  text: '#2563EB', dot: '#3B82F6' },
  warning:  { bg: 'rgba(217,119,6,0.06)',  border: 'rgba(217,119,6,0.18)',  text: '#B45309', dot: '#D97706' },
  critical: { bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.18)',  text: '#B91C1C', dot: '#DC2626' },
};

const ENTITY_HREF: Partial<Record<AuditEntry['entityType'], (id: string) => string>> = {
  deal:     (id) => `/platform-v7/deals/${id}/clean`,
  dispute:  (id) => `/platform-v7/disputes/${id}`,
  lot:      (id) => `/platform-v7/lots/${id}`,
};

function formatTs(ts: string) {
  return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function AuditLogPanel() {
  const [filter, setFilter] = useState<AuditSeverity | 'all'>('all');

  const visible = filter === 'all' ? DEMO_ENTRIES : DEMO_ENTRIES.filter((e) => e.severity === filter);
  const critCount = DEMO_ENTRIES.filter((e) => e.severity === 'critical').length;

  return (
    <div style={{ display: 'grid', gap: '0.875rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                cursor: 'pointer',
                background: filter === f
                  ? (f === 'critical' ? '#DC2626' : f === 'warning' ? '#D97706' : f === 'info' ? '#2563EB' : 'var(--p7-color-brand)')
                  : 'transparent',
                color: filter === f ? '#fff' : 'var(--pc-text-muted)',
                border: `1px solid ${filter === f ? 'transparent' : 'var(--p7-color-border)'}`,
              }}
            >
              {f === 'all' ? 'Все' : f === 'critical' ? 'Критичные' : f === 'warning' ? 'Предупреждения' : 'Инфо'}
            </button>
          ))}
        </div>
        {critCount > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#B91C1C', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 999, padding: '2px 8px' }}>
            {critCount} критичных событий
          </span>
        )}
      </div>

      {/* Log entries */}
      <div style={{ display: 'grid', gap: '0.375rem' }}>
        {visible.map((entry) => {
          const sev = SEV_COLOR[entry.severity];
          const href = ENTITY_HREF[entry.entityType]?.(entry.entityId);
          return (
            <div
              key={entry.id}
              style={{
                padding: '0.625rem 0.75rem',
                borderRadius: 10,
                background: sev.bg,
                border: `1px solid ${sev.border}`,
                display: 'grid',
                gap: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: sev.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: sev.text }}>{ACTION_LABEL[entry.action]}</span>
                  {href ? (
                    <a href={href} style={{ fontSize: 10, fontWeight: 700, color: 'var(--p7-color-brand)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>{entry.entityId}</a>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--pc-text-muted)', fontFamily: 'var(--font-mono)' }}>{entry.entityId}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 9, color: 'var(--pc-text-muted)', fontFamily: 'var(--font-mono)' }}>{entry.ip}</span>
                  <span style={{ fontSize: 9, color: 'var(--pc-text-muted)' }}>{formatTs(entry.ts)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--pc-text-muted)', background: 'rgba(0,0,0,0.04)', borderRadius: 4, padding: '1px 5px' }}>
                  {entry.actorName} · {entry.actorRole}
                </span>
                {entry.detail && (
                  <span style={{ fontSize: 9, color: 'var(--pc-text-secondary)', lineHeight: 1.4 }}>{entry.detail}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', lineHeight: 1.5, padding: '6px 10px', borderRadius: 8, background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }}>
        Аудит-лог неизменяем. Все критичные действия фиксируются с IP, ролью и временной меткой. Хранение — 7 лет (152-ФЗ).
      </div>
    </div>
  );
}
