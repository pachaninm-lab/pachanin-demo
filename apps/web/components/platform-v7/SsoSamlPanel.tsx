'use client';

import { useState } from 'react';

type SsoStatus = 'active' | 'configured' | 'testing' | 'disabled';

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
  active:     { label: 'Активен',     bg: '#D1FAE5', color: '#065F46' },
  configured: { label: 'Настроен',    bg: '#DBEAFE', color: '#1E40AF' },
  testing:    { label: 'Тестируется', bg: '#FEF3C7', color: '#92400E' },
  disabled:   { label: 'Отключён',    bg: '#F1F5F9', color: '#64748B' },
};

const DEMO_CONNECTIONS: SsoConnection[] = [
  { id: 'sso-001', orgName: 'АгроХолдинг «Черноземье»', protocol: 'SAML 2.0', idpProvider: 'Microsoft AD FS',     entityId: 'urn:agro-chern:saml:prod',      status: 'active',     usersCount: 145, lastLoginAt: '2024-03-20T11:00:00Z', createdAt: '2024-01-10' },
  { id: 'sso-002', orgName: 'Транзит-Зерно АО',          protocol: 'OIDC',     idpProvider: 'Keycloak 23.0',        entityId: 'tranzit-zerno-oidc-prod',       status: 'active',     usersCount: 38,  lastLoginAt: '2024-03-20T09:30:00Z', createdAt: '2024-02-01' },
  { id: 'sso-003', orgName: 'ФермерОпт ООО',             protocol: 'SAML 2.0', idpProvider: 'Google Workspace',     entityId: 'https://fermerop.ru/saml/sp',   status: 'testing',    usersCount: 0,   lastLoginAt: '—',                    createdAt: '2024-03-15' },
  { id: 'sso-004', orgName: 'ЗерноТрейд КФХ',            protocol: 'SAML 2.0', idpProvider: 'Яндекс 360 (Enterprise)', entityId: 'urn:zerno-trade:saml',       status: 'configured', usersCount: 0,   lastLoginAt: '—',                    createdAt: '2024-03-18' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function SsoSamlPanel() {
  const [selected, setSelected] = useState<string | null>(null);

  const active = DEMO_CONNECTIONS.filter((c) => c.status === 'active').length;
  const totalUsers = DEMO_CONNECTIONS.reduce((s, c) => s + c.usersCount, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Подключений', value: DEMO_CONNECTIONS.length, color: '#0F1419' },
          { label: 'Активных',    value: active,                  color: '#0A7A5F' },
          { label: 'SSO users',   value: totalUsers,              color: '#0F1419' },
          { label: 'SAML 2.0',    value: DEMO_CONNECTIONS.filter(c => c.protocol === 'SAML 2.0').length, color: '#1E40AF' },
          { label: 'OIDC',        value: DEMO_CONNECTIONS.filter(c => c.protocol === 'OIDC').length, color: '#5B21B6' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Protocol info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1E40AF', marginBottom: 4 }}>SAML 2.0</div>
          <div style={{ fontSize: 9, color: '#3B82F6', lineHeight: 1.5 }}>ACS URL: grainflow.ru/auth/saml/callback · Entity ID: urn:grainflow:saml:prod · Cert: RSA-SHA256 · Bindings: HTTP-POST / HTTP-Redirect</div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#5B21B6', marginBottom: 4 }}>OIDC / OAuth 2.0</div>
          <div style={{ fontSize: 9, color: '#7C3AED', lineHeight: 1.5 }}>Redirect URI: grainflow.ru/auth/oidc/callback · Scopes: openid profile email · PKCE: required · Алгоритм: RS256</div>
        </div>
      </div>

      {/* Connection list */}
      <div style={{ display: 'grid', gap: 6 }}>
        {DEMO_CONNECTIONS.map((c) => {
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
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{c.idpProvider} · {c.usersCount > 0 ? `${c.usersCount} пользователей` : 'нет активных'}</div>
                </div>
                <div style={{ fontSize: 9, color: '#94A3B8', textAlign: 'right', flexShrink: 0 }}>
                  {c.lastLoginAt !== '—' ? new Date(c.lastLoginAt).toLocaleDateString('ru-RU') : '—'}
                </div>
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '10px 12px', background: '#fff', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 6 }}>
                    {[
                      { label: 'Entity ID / Client ID', value: c.entityId },
                      { label: 'IdP провайдер',          value: c.idpProvider },
                      { label: 'Создано',                value: c.createdAt },
                      { label: 'Последний вход',         value: c.lastLoginAt !== '—' ? new Date(c.lastLoginAt).toLocaleString('ru-RU') : '—' },
                    ].map((s) => (
                      <div key={s.label}>
                        <div style={lbl}>{s.label}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', marginTop: 2, wordBreak: 'break-all' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                      Тест SSO
                    </button>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                      Метаданные XML
                    </button>
                    {c.status === 'active' && (
                      <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626', fontWeight: 700 }}>
                        Отключить
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* SCIM */}
      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#0F1419', marginBottom: 4 }}>SCIM 2.0 · Автопровижининг пользователей</div>
        <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1.5 }}>
          SCIM-эндпоинт: /scim/v2 · Автоматическая синхронизация групп и пользователей из IdP · Деактивация при удалении из IdP · Маппинг атрибутов: email → логин, groups → роль, department → организация
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        SSO: SAML 2.0 + OIDC · Enterprise-тариф · IdP: MS AD FS / Keycloak / Google Workspace / Яндекс 360 · SCIM 2.0 · JIT-провижининг · Демо-данные.
      </div>
    </div>
  );
}
