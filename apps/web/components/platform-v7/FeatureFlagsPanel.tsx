'use client';

import { useState } from 'react';

type FlagEnv = 'prod' | 'staging' | 'dev';
type RolloutType = 'all' | 'percent' | 'org' | 'role';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutType: RolloutType;
  rolloutValue: string;
  env: FlagEnv;
  createdAt: string;
  updatedAt: string;
  category: string;
}

const ENV_CONFIG: Record<FlagEnv, { label: string; bg: string; color: string }> = {
  prod:    { label: 'prod',    bg: '#FEE2E2', color: '#DC2626' },
  staging: { label: 'staging', bg: '#FEF3C7', color: '#92400E' },
  dev:     { label: 'dev',     bg: '#DBEAFE', color: '#1E40AF' },
};

const ROLLOUT_LABEL: Record<RolloutType, string> = {
  all:     'Все пользователи',
  percent: 'Canary %',
  org:     'Организации',
  role:    'Роли',
};

const DEMO_FLAGS: FeatureFlag[] = [
  { id: 'ff-001', name: 'ml_price_predictor',    description: 'ML-прогноз цены зерна при создании заявки (LightGBM)',   enabled: true,  rolloutType: 'percent', rolloutValue: '20%',              env: 'prod',    createdAt: '2024-01-10', updatedAt: '2024-03-15', category: 'ML' },
  { id: 'ff-002', name: 'fraud_detector_v2',     description: 'Новая модель Fraud Detector v2 с F1=0.91 (beta)',          enabled: true,  rolloutType: 'role',    rolloutValue: 'admin,compliance', env: 'prod',    createdAt: '2024-02-01', updatedAt: '2024-03-18', category: 'Безопасность' },
  { id: 'ff-003', name: 'webauthn_passkeys',     description: 'Беспарольная аутентификация WebAuthn / FIDO2',             enabled: true,  rolloutType: 'org',     rolloutValue: '5 орг (пилот)',    env: 'staging', createdAt: '2024-02-15', updatedAt: '2024-03-20', category: 'Auth' },
  { id: 'ff-004', name: 'clickhouse_analytics',  description: 'Дашборды из ClickHouse вместо PostgreSQL-агрегаций',       enabled: false, rolloutType: 'all',     rolloutValue: '—',                env: 'dev',     createdAt: '2024-01-20', updatedAt: '2024-03-01', category: 'Аналитика' },
  { id: 'ff-005', name: 'etrn_live_rzd',         description: 'Live-интеграция РЖД ЭТРАН (ГУ-29у) вместо fixture',        enabled: false, rolloutType: 'org',     rolloutValue: '—',                env: 'staging', createdAt: '2024-03-01', updatedAt: '2024-03-10', category: 'Логистика' },
  { id: 'ff-006', name: 'telegram_mini_app',     description: 'Telegram Mini App для быстрых действий по сделкам',         enabled: true,  rolloutType: 'percent', rolloutValue: '5%',               env: 'prod',    createdAt: '2024-02-20', updatedAt: '2024-03-19', category: 'Уведомления' },
  { id: 'ff-007', name: 'sso_saml2',             description: 'SSO через SAML 2.0 / OIDC для Enterprise клиентов',         enabled: false, rolloutType: 'role',    rolloutValue: '—',                env: 'dev',     createdAt: '2024-03-10', updatedAt: '2024-03-10', category: 'Auth' },
  { id: 'ff-008', name: 'factoring_sber',        description: 'Факторинг СберФакторинг live (сейчас: МСП Банк)',           enabled: false, rolloutType: 'all',     rolloutValue: '—',                env: 'staging', createdAt: '2024-02-28', updatedAt: '2024-03-05', category: 'Финансы' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>(DEMO_FLAGS);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterEnv, setFilterEnv] = useState<FlagEnv | 'all'>('all');

  const categories = ['all', ...Array.from(new Set(DEMO_FLAGS.map(f => f.category)))];

  const toggle = (id: string) => {
    setFlags((prev) => prev.map((f) => f.id === id ? { ...f, enabled: !f.enabled, updatedAt: new Date().toISOString().split('T')[0] } : f));
  };

  const visible = flags
    .filter((f) => filterCat === 'all' || f.category === filterCat)
    .filter((f) => filterEnv === 'all' || f.env === filterEnv);

  const enabled = flags.filter((f) => f.enabled).length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
        {[
          { label: 'Флагов всего', value: flags.length,             color: '#0F1419' },
          { label: 'Включено',     value: enabled,                  color: '#0A7A5F' },
          { label: 'Выключено',    value: flags.length - enabled,   color: '#64748B' },
          { label: 'Canary/pilot', value: flags.filter(f => f.rolloutType !== 'all').length, color: '#D97706' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setFilterCat(cat)} style={{ padding: '4px 10px', borderRadius: 6, border: filterCat === cat ? 'none' : '1px solid #E4E6EA', background: filterCat === cat ? '#0F1419' : '#F8FAFB', color: filterCat === cat ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              {cat === 'all' ? 'Все' : cat}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all','prod','staging','dev'] as const).map((env) => (
            <button key={env} onClick={() => setFilterEnv(env)} style={{ padding: '4px 10px', borderRadius: 6, border: filterEnv === env ? 'none' : '1px solid #E4E6EA', background: filterEnv === env ? '#0F1419' : '#F8FAFB', color: filterEnv === env ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              {env === 'all' ? 'Все среды' : env}
            </button>
          ))}
        </div>
      </div>

      {/* Flag list */}
      <div style={{ display: 'grid', gap: 6 }}>
        {visible.map((f) => {
          const envCfg = ENV_CONFIG[f.env];
          return (
            <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: f.enabled ? '#F0FDF4' : '#F8FAFB', border: `1px solid ${f.enabled ? '#BBF7D0' : '#E4E6EA'}` }}>
              {/* Toggle */}
              <button
                onClick={() => toggle(f.id)}
                style={{ flexShrink: 0, width: 36, height: 20, borderRadius: 10, background: f.enabled ? '#0A7A5F' : '#CBD5E1', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                aria-label={f.enabled ? 'Выключить' : 'Включить'}
              >
                <span style={{ position: 'absolute', top: 2, left: f.enabled ? 18 : 2, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left 0.2s', display: 'block' }} />
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{f.name}</code>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: envCfg.bg, color: envCfg.color, fontWeight: 800 }}>{envCfg.label}</span>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#F1F5F9', color: '#475569', fontWeight: 700 }}>{f.category}</span>
                </div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 3 }}>{f.description}</div>
                <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>
                  {ROLLOUT_LABEL[f.rolloutType]}: <b style={{ color: '#475569' }}>{f.rolloutValue}</b> · обновлён {f.updatedAt}
                </div>
              </div>

              <div style={{ fontSize: 9, fontWeight: 800, flexShrink: 0, padding: '3px 8px', borderRadius: 6, background: f.enabled ? '#D1FAE5' : '#F1F5F9', color: f.enabled ? '#065F46' : '#64748B' }}>
                {f.enabled ? 'ON' : 'OFF'}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>Нет флагов по выбранным фильтрам</div>
        )}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Flagsmith self-hosted · Canary deploy 5% → 20% → 100% · Kill switch (мгновенное отключение) · A/B тестирование · Демо-данные.
      </div>
    </div>
  );
}
