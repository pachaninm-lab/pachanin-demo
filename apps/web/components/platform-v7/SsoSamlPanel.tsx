'use client';

import { useState } from 'react';

type SsoStatus = 'configured' | 'testing' | 'disabled';

interface SsoConnection {
  id: string;
  orgName: string;
  protocol: 'SAML 2.0' | 'OIDC';
  idpProvider: string;
  entityId: string;
  status: SsoStatus;
  usersCount: number;
  lastLoginAt: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<SsoStatus, { label: string; bg: string; color: string }> = {
  configured: { label: 'Настроен',    bg: '#DBEAFE', color: '#1E40AF' },
  testing:    { label: 'Проверка',    bg: '#FEF3C7', color: '#92400E' },
  disabled:   { label: 'Отключён',    bg: '#F1F5F9', color: '#64748B' },
};

const CONNECTIONS: SsoConnection[] = [
  { id: 'sso-001', orgName: 'Агрохолдинг',     protocol: 'SAML 2.0', idpProvider: 'Microsoft AD FS',        entityId: 'urn:pc:saml:partner-1',    status: 'testing',    usersCount: 0, lastLoginAt: '—', createdAt: '2026-07-01' },
  { id: 'sso-002', orgName: 'Логистический партнёр', protocol: 'OIDC',     idpProvider: 'Keycloak',           entityId: 'pc-oidc-partner-2',         status: 'configured', usersCount: 0, lastLoginAt: '—', createdAt: '2026-07-01' },
  { id: 'sso-003', orgName: 'Покупатель',       protocol: 'SAML 2.0', idpProvider: 'Яндекс 360 Enterprise', entityId: 'urn:pc:saml:partner-3',    status: 'disabled',   usersCount: 0, lastLoginAt: '—', createdAt: '2026-07-01' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function SsoSamlPanel() {
  const [selected, setSelected] = useState<string | null>(null);

  const configured = CONNECTIONS.filter((c) => c.status === 'configured').length;
  const testing = CONNECTIONS.filter((c) => c.status === 'testing').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Контуров',   value: CONNECTIONS.length, color: '#0F1419' },
          { label: 'Настроено',  value: configured,          color: '#1E40AF' },
          { label: 'Проверка',   value: testing,             color: '#92400E' },
          { label: 'SAML 2.0',   value: CONNECTIONS.filter(c => c.protocol === 'SAML 2.0').length, color: '#1E40AF' },
          { label: 'OIDC',       value: CONNECTIONS.filter(c => c.protocol === 'OIDC').length, color: '#5B21B6' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1E40AF', marginBottom: 4 }}>SAML 2.0</div>
          <div style={{ fontSize: 9, color: '#3B82F6', lineHeight: 1.5 }}>ACS URL: /auth/saml/callback · Entity ID: urn:pc:saml · Cert: RSA-SHA256 · Bindings: HTTP-POST / HTTP-Redirect</div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#5B21B6', marginBottom: 4 }}>OIDC / OAuth 2.0</div>
          <div style={{ fontSize: 9, color: '#7C3AED', lineHeight: 1.5 }}>Redirect URI: /auth/oidc/callback · Scopes: openid profile email · PKCE: required · Алгоритм: RS256</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {CONNECTIONS.map((c) => {
          const cfg = STATUS_CONFIG[c.status];
          const isOpen = selected === c.id;
          return (
            <div key={c.id} style={{ borderRadius: 12, border: `1px solid ${isOpen ? '#0A7A5F' : '#E4E6EA'}`, overflow: 'hidden' }}>
              <button onClick={() => setSelected(isOpen ? null : c.id)} style={{ width: '100%', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', background: isOpen ? '#F0FDF4' : '#F8FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0F1419' }}>{c.orgName}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: c.protocol === 'SAML 2.0' ? '#DBEAFE' : '#F5F3FF', color: c.protocol === 'SAML 2.0' ? '#1E40AF' : '#5B21B6' }}>{c.protocol}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{c.idpProvider} · подключение требует проверки</div>
                </div>
                <div style={{ fontSize: 9, color: '#94A3B8', textAlign: 'right', flexShrink: 0 }}>{c.lastLoginAt}</div>
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '10px 12px', background: '#fff', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 6 }}>
                    {[
                      { label: 'Entity ID / Client ID', value: c.entityId },
                      { label: 'IdP провайдер',          value: c.idpProvider },
                      { label: 'Создано',                value: c.createdAt },
                      { label: 'Последний вход',         value: c.lastLoginAt },
                    ].map((s) => (
                      <div key={s.label}>
                        <div style={lbl}>{s.label}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', marginTop: 2, wordBreak: 'break-all' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>Проверить</button>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>Метаданные</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#0F1419', marginBottom: 4 }}>SCIM 2.0 · синхронизация пользователей</div>
        <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1.5 }}>
          SCIM-эндпоинт: /scim/v2 · группы и пользователи из IdP · деактивация при удалении из IdP · маппинг: email → логин, groups → роль, department → организация
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        SSO: SAML 2.0 + OIDC · предынтеграционный контур · требуется проверка IdP и промышленного доступа.
      </div>
    </div>
  );
}
