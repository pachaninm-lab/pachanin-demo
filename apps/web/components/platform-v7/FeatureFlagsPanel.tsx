'use client';

import { useState } from 'react';

type FlagStatus = 'platform' | 'planned' | 'integration';
type RolloutType = 'platform' | 'role' | 'org' | 'integration';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  status: FlagStatus;
  rolloutType: RolloutType;
  rolloutValue: string;
  category: string;
}

const STATUS_CONFIG: Record<FlagStatus, { label: string; bg: string; color: string }> = {
  platform: { label: 'Платформа', bg: '#D1FAE5', color: '#065F46' },
  planned: { label: 'Доработка', bg: '#DBEAFE', color: '#1E40AF' },
  integration: { label: 'Интеграция позже', bg: '#FEF3C7', color: '#92400E' },
};

const ROLLOUT_LABEL: Record<RolloutType, string> = {
  platform: 'Контур платформы',
  role: 'Роли',
  org: 'Организации',
  integration: 'Внешняя интеграция',
};

const FEATURE_FLAGS: FeatureFlag[] = [
  { id: 'ff-001', name: 'price_analytics_assist', description: 'Сценарная аналитика цены внутри сделки без заявления гарантии цены', status: 'planned', rolloutType: 'role', rolloutValue: 'buyer, seller, executive', category: 'Аналитика' },
  { id: 'ff-002', name: 'risk_review_assist', description: 'Подсказки по рискам сделки, документам и спорным условиям', status: 'planned', rolloutType: 'role', rolloutValue: 'operator, compliance', category: 'Риски' },
  { id: 'ff-003', name: 'mobile_action_model', description: 'Intent-first действия в мобильных кабинетах ролей', status: 'platform', rolloutType: 'platform', rolloutValue: 'ядро интерфейса', category: 'UX' },
  { id: 'ff-004', name: 'deal_evidence_bundle', description: 'Пакет доказательств по сделке для спора и закрытия', status: 'planned', rolloutType: 'role', rolloutValue: 'operator, arbitrator, compliance', category: 'Evidence' },
  { id: 'ff-005', name: 'state_contour_connectors', description: 'Подключения к государственным контурам после доступов и регламента', status: 'integration', rolloutType: 'integration', rolloutValue: 'временно без интеграций', category: 'Интеграции' },
  { id: 'ff-006', name: 'bank_release_basis', description: 'Основание для банковской проверки выплаты без самостоятельного выпуска денег платформой', status: 'integration', rolloutType: 'integration', rolloutValue: 'временно без интеграций', category: 'Финансы' },
  { id: 'ff-007', name: 'enterprise_sso', description: 'Корпоративный вход после промышленной политики доступа и проверки', status: 'planned', rolloutType: 'org', rolloutValue: 'enterprise-контур', category: 'Доступ' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function FeatureFlagsPanel() {
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<FlagStatus | 'all'>('all');

  const categories = ['all', ...Array.from(new Set(FEATURE_FLAGS.map(f => f.category)))];
  const visible = FEATURE_FLAGS
    .filter((f) => filterCat === 'all' || f.category === filterCat)
    .filter((f) => filterStatus === 'all' || f.status === filterStatus);

  const platform = FEATURE_FLAGS.filter((f) => f.status === 'platform').length;
  const planned = FEATURE_FLAGS.filter((f) => f.status === 'planned').length;
  const integration = FEATURE_FLAGS.filter((f) => f.status === 'integration').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
        {[
          { label: 'Функций', value: FEATURE_FLAGS.length, color: '#0F1419' },
          { label: 'Платформа', value: platform, color: '#065F46' },
          { label: 'Доработка', value: planned, color: '#1E40AF' },
          { label: 'Интеграции', value: integration, color: integration > 0 ? '#92400E' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 10, color: '#1E40AF', fontWeight: 760, lineHeight: 1.55 }}>
        Feature readiness · настоящая платформа временно без интеграций. Флаги показывают управляемые функции платформы и будущие интеграционные зоны, но не означают включённый production rollout.
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setFilterCat(cat)} style={{ padding: '4px 10px', borderRadius: 6, border: filterCat === cat ? 'none' : '1px solid #E4E6EA', background: filterCat === cat ? '#0F1419' : '#F8FAFB', color: filterCat === cat ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              {cat === 'all' ? 'Все' : cat}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all','platform','planned','integration'] as const).map((status) => (
            <button key={status} onClick={() => setFilterStatus(status)} style={{ padding: '4px 10px', borderRadius: 6, border: filterStatus === status ? 'none' : '1px solid #E4E6EA', background: filterStatus === status ? '#0F1419' : '#F8FAFB', color: filterStatus === status ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              {status === 'all' ? 'Все статусы' : STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {visible.map((f) => {
          const st = STATUS_CONFIG[f.status];
          return (
            <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: f.status === 'integration' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${f.status === 'integration' ? '#FDE68A' : '#E4E6EA'}` }}>
              <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 11, background: st.bg, color: st.color, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900 }}>{f.status === 'platform' ? '✓' : f.status === 'planned' ? '◌' : '!'}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{f.name}</code>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 800 }}>{st.label}</span>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#F1F5F9', color: '#475569', fontWeight: 700 }}>{f.category}</span>
                </div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 3 }}>{f.description}</div>
                <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>
                  {ROLLOUT_LABEL[f.rolloutType]}: <b style={{ color: '#475569' }}>{f.rolloutValue}</b>
                </div>
              </div>

              <div style={{ fontSize: 9, fontWeight: 800, flexShrink: 0, padding: '3px 8px', borderRadius: 6, background: st.bg, color: st.color }}>
                {st.label}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>Нет функций по выбранным фильтрам</div>
        )}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Feature management · без fake rollout, pilot/canary процентов и live-интеграций; функции должны усиливать ядро сделки.
      </div>
    </div>
  );
}
