'use client';

import { useState } from 'react';

type MfaMethod = 'totp' | 'sms';
type SessionStatus = 'active' | 'expired';

interface MfaSession {
  id: string;
  device: string;
  ip: string;
  location: string;
  method: MfaMethod;
  status: SessionStatus;
  lastActiveAt: string;
  createdAt: string;
  current?: boolean;
}

interface LoginEvent {
  id: string;
  device: string;
  ip: string;
  location: string;
  status: 'success' | 'failed' | 'mfa_required';
  method?: MfaMethod;
  at: string;
}

const DEMO_SESSIONS: MfaSession[] = [
  { id: 'sess-001', device: 'MacBook Pro · Chrome 124', ip: '77.234.12.45', location: 'Москва, РФ', method: 'totp', status: 'active', lastActiveAt: new Date(Date.now() - 120_000).toISOString(), createdAt: new Date(Date.now() - 3_600_000).toISOString(), current: true },
  { id: 'sess-002', device: 'iPhone 15 · Safari 17', ip: '77.234.12.46', location: 'Москва, РФ', method: 'sms', status: 'active', lastActiveAt: new Date(Date.now() - 7_200_000).toISOString(), createdAt: new Date(Date.now() - 86_400_000).toISOString() },
  { id: 'sess-003', device: 'Windows · Chrome 122', ip: '91.240.54.10', location: 'Тамбов, РФ', method: 'totp', status: 'expired', lastActiveAt: new Date(Date.now() - 604_800_000).toISOString(), createdAt: new Date(Date.now() - 1_209_600_000).toISOString() },
];

const DEMO_LOGIN_EVENTS: LoginEvent[] = [
  { id: 'ev-1', device: 'MacBook Pro · Chrome 124', ip: '77.234.12.45', location: 'Москва, РФ', status: 'success', method: 'totp', at: new Date(Date.now() - 3_600_000).toISOString() },
  { id: 'ev-2', device: 'iPhone 15 · Safari 17', ip: '77.234.12.46', location: 'Москва, РФ', status: 'success', method: 'sms', at: new Date(Date.now() - 86_400_000).toISOString() },
  { id: 'ev-3', device: 'Unknown · Firefox 115', ip: '185.220.10.5', location: 'Неизвестно', status: 'failed', at: new Date(Date.now() - 172_800_000).toISOString() },
  { id: 'ev-4', device: 'Windows · Chrome 122', ip: '91.240.54.10', location: 'Тамбов, РФ', status: 'success', method: 'totp', at: new Date(Date.now() - 604_800_000).toISOString() },
  { id: 'ev-5', device: 'MacBook Pro · Chrome 123', ip: '77.234.12.45', location: 'Москва, РФ', status: 'mfa_required', at: new Date(Date.now() - 1_209_600_000).toISOString() },
];

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(ms / 86_400_000);
  if (mins < 60) return `${mins} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  return `${days} дн назад`;
}

const MFA_METHOD_LABEL: Record<MfaMethod, string> = { totp: 'TOTP (Authenticator)', sms: 'SMS OTP' };
const MFA_METHOD_ICON: Record<MfaMethod, string> = { totp: '🔑', sms: '📱' };

const LOGIN_STATUS_CONFIG = {
  success: { label: 'Успешно', color: 'var(--status-active-text, #059669)', icon: '✓' },
  failed: { label: 'Неудачно', color: 'var(--status-error-text, #DC2626)', icon: '✕' },
  mfa_required: { label: 'Требовался MFA', color: 'var(--status-warning-text, #D97706)', icon: '⚠' },
};

interface Props {
  totpEnabled?: boolean;
  smsEnabled?: boolean;
}

export function MfaSecurityPanel({ totpEnabled = false, smsEnabled = false }: Props) {
  const [totp, setTotp] = useState(totpEnabled);
  const [sms, setSms] = useState(smsEnabled);
  const [sessions, setSessions] = useState<MfaSession[]>(DEMO_SESSIONS);
  const [activeTab, setActiveTab] = useState<'mfa' | 'sessions' | 'history'>('mfa');
  const [totpCode, setTotpCode] = useState('');
  const [showTotpSetup, setShowTotpSetup] = useState(false);

  function revokeSession(id: string) {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'expired' } : s));
  }

  function revokeAll() {
    setSessions((prev) => prev.map((s) => s.current ? s : { ...s, status: 'expired' }));
  }

  const activeSessions = sessions.filter((s) => s.status === 'active' && !s.current);
  const hasSuspicious = DEMO_LOGIN_EVENTS.some((e) => e.status === 'failed');

  const tabs = [
    { id: 'mfa' as const, label: 'Двухфакторная аутентификация' },
    { id: 'sessions' as const, label: `Активные сессии (${sessions.filter((s) => s.status === 'active').length})` },
    { id: 'history' as const, label: 'История входов' },
  ];

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {hasSuspicious && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.625rem 0.875rem', borderRadius: '8px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <span style={{ fontSize: '0.875rem' }}>⚠️</span>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#DC2626' }}>
            Обнаружены неудачные попытки входа — проверьте историю
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--p7-color-border)', paddingBottom: '0' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.5rem 0.875rem', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              background: 'transparent', border: 'none',
              color: activeTab === tab.id ? 'var(--p7-color-brand)' : 'var(--pc-text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--p7-color-brand)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* MFA Tab */}
      {activeTab === 'mfa' && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {/* TOTP */}
          <div style={{ display: 'grid', gap: '0.75rem', padding: '0.875rem', borderRadius: '12px', background: totp ? 'rgba(5,150,105,0.06)' : 'var(--p7-color-surface-muted)', border: `1px solid ${totp ? 'rgba(5,150,105,0.2)' : 'var(--p7-color-border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem' }}>🔑</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>TOTP (Authenticator App)</span>
                  {totp && <span style={{ fontSize: '10px', color: 'var(--status-active-text)', fontWeight: 700 }}>✓ Подключён</span>}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', marginTop: '2px' }}>
                  Google Authenticator, Яндекс.Ключ, 2FAS — подтверждение каждого входа
                </div>
              </div>
              <button
                onClick={() => { if (totp) setTotp(false); else setShowTotpSetup(true); }}
                style={{ padding: '0.375rem 0.75rem', borderRadius: '8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', background: totp ? 'rgba(220,38,38,0.1)' : 'var(--p7-color-brand)', color: totp ? '#DC2626' : '#fff', border: `1px solid ${totp ? 'rgba(220,38,38,0.2)' : 'var(--p7-color-brand)'}` }}
              >
                {totp ? 'Отключить' : 'Подключить'}
              </button>
            </div>

            {showTotpSetup && !totp && (
              <div style={{ display: 'grid', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB' }}>Настройка TOTP:</div>
                <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--p7-color-surface)', padding: '0.5rem', borderRadius: '6px', letterSpacing: '0.1em', textAlign: 'center', fontWeight: 700 }}>
                  JBSWY3DPEHPK3PXP (демо-ключ)
                </div>
                <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>Введите 6-значный код из приложения для подтверждения:</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--p7-color-border)', background: 'var(--p7-color-surface)', color: 'var(--pc-text-primary)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', textAlign: 'center', letterSpacing: '0.2em' }}
                  />
                  <button
                    onClick={() => { if (totpCode.length === 6) { setTotp(true); setShowTotpSetup(false); setTotpCode(''); } }}
                    disabled={totpCode.length !== 6}
                    style={{ padding: '0.5rem 0.875rem', borderRadius: '8px', fontSize: '10px', fontWeight: 700, cursor: totpCode.length === 6 ? 'pointer' : 'not-allowed', background: 'var(--p7-color-brand)', color: '#fff', border: 'none', opacity: totpCode.length === 6 ? 1 : 0.5 }}
                  >
                    Подтвердить
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SMS */}
          <div style={{ display: 'grid', gap: '0.5rem', padding: '0.875rem', borderRadius: '12px', background: sms ? 'rgba(5,150,105,0.06)' : 'var(--p7-color-surface-muted)', border: `1px solid ${sms ? 'rgba(5,150,105,0.2)' : 'var(--p7-color-border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem' }}>📱</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>SMS OTP</span>
                  {sms && <span style={{ fontSize: '10px', color: 'var(--status-active-text)', fontWeight: 700 }}>✓ Подключён</span>}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', marginTop: '2px' }}>
                  Одноразовый код на номер +7 (9**) ***-**-** при каждом входе
                </div>
              </div>
              <button
                onClick={() => setSms((v) => !v)}
                style={{ padding: '0.375rem 0.75rem', borderRadius: '8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', background: sms ? 'rgba(220,38,38,0.1)' : 'var(--p7-color-brand)', color: sms ? '#DC2626' : '#fff', border: `1px solid ${sms ? 'rgba(220,38,38,0.2)' : 'var(--p7-color-brand)'}` }}
              >
                {sms ? 'Отключить' : 'Подключить'}
              </button>
            </div>
          </div>

          {!totp && !sms && (
            <div style={{ fontSize: '10px', color: 'var(--status-warning-text, #D97706)', fontWeight: 700, padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)' }}>
              ⚠ Двухфакторная аутентификация не настроена — рекомендуется для защиты счётов и сделок
            </div>
          )}
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div style={{ display: 'grid', gap: '0.625rem' }}>
          {activeSessions.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={revokeAll} style={{ fontSize: '10px', fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '6px', padding: '0.25rem 0.75rem', cursor: 'pointer' }}>
                Завершить все, кроме текущей
              </button>
            </div>
          )}
          {sessions.map((s) => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 0.875rem', borderRadius: '10px', background: s.current ? 'rgba(5,150,105,0.06)' : s.status === 'expired' ? 'var(--p7-color-surface-muted)' : 'var(--p7-color-surface)', border: `1px solid ${s.current ? 'rgba(5,150,105,0.2)' : 'var(--p7-color-border)'}`, opacity: s.status === 'expired' ? 0.6 : 1 }}>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>{s.device}</span>
                  {s.current && <span style={{ fontSize: '10px', color: 'var(--status-active-text)', fontWeight: 700 }}>Текущая</span>}
                  {s.status === 'expired' && <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)', fontWeight: 600 }}>Завершена</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '10px', color: 'var(--pc-text-muted)' }}>
                  <span>{s.ip} · {s.location}</span>
                  <span>{MFA_METHOD_ICON[s.method]} {MFA_METHOD_LABEL[s.method]}</span>
                  <span>Активна {formatTimeAgo(s.lastActiveAt)}</span>
                </div>
              </div>
              {!s.current && s.status === 'active' && (
                <button onClick={() => revokeSession(s.id)} style={{ fontSize: '10px', fontWeight: 700, color: '#DC2626', background: 'none', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px', padding: '0.25rem 0.625rem', cursor: 'pointer', flexShrink: 0 }}>
                  Завершить
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div style={{ display: 'grid', gap: '0.375rem' }}>
          {DEMO_LOGIN_EVENTS.map((ev) => {
            const cfg = LOGIN_STATUS_CONFIG[ev.status];
            return (
              <div key={ev.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.625rem 0.875rem', borderRadius: '8px', background: ev.status === 'failed' ? 'rgba(220,38,38,0.05)' : 'var(--p7-color-surface-muted)', border: `1px solid ${ev.status === 'failed' ? 'rgba(220,38,38,0.15)' : 'var(--p7-color-border)'}` }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: cfg.color, flexShrink: 0 }}>{cfg.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>{ev.device} · {ev.ip} · {ev.location}</div>
                  {ev.method && <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>{MFA_METHOD_ICON[ev.method]} {MFA_METHOD_LABEL[ev.method]}</div>}
                </div>
                <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)', flexShrink: 0 }}>{formatTimeAgo(ev.at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
