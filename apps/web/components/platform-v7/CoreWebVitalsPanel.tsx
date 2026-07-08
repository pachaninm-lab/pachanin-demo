'use client';

import { useState } from 'react';

type MetricStatus = 'platform' | 'planned' | 'report_required';

interface VitalRequirement {
  name: string;
  target: string;
  status: MetricStatus;
  evidence: string;
  description: string;
}

interface PageRequirement {
  page: string;
  check: string;
  status: MetricStatus;
}

const VITALS: VitalRequirement[] = [
  { name: 'LCP', target: 'целевой порог Core Web Vitals', status: 'report_required', evidence: 'нужен фактический отчёт на активном домене', description: 'скорость появления основного контента' },
  { name: 'INP', target: 'целевой порог Core Web Vitals', status: 'report_required', evidence: 'нужен фактический отчёт на активном домене', description: 'реакция интерфейса на действие пользователя' },
  { name: 'CLS', target: 'целевой порог Core Web Vitals', status: 'report_required', evidence: 'нужен фактический отчёт на активном домене', description: 'стабильность макета при загрузке' },
  { name: 'Bundle size', target: 'контроль роста клиентского JS', status: 'planned', evidence: 'нужен build-анализ', description: 'контроль веса клиентской части' },
  { name: 'Mobile shell', target: 'без белых экранов, перекрытий и горизонтального скролла', status: 'platform', evidence: 'нужен mobile-smoke по ролям', description: 'шапка, нижняя навигация, формы и safe-area' },
];

const PAGES: PageRequirement[] = [
  { page: 'deals/page', check: 'карточка сделки и next action', status: 'platform' },
  { page: 'bank/page', check: 'денежный статус без fake-интеграции', status: 'planned' },
  { page: 'logistics/page', check: 'рейсы и действия логистики на телефоне', status: 'planned' },
  { page: 'executive/page', check: 'аналитика без ложных live-метрик', status: 'planned' },
  { page: 'driver/field', check: 'полевой сценарий водителя на мобильном', status: 'planned' },
  { page: 'compliance/page', check: 'контроль риска и документов', status: 'planned' },
];

const STATUS_CFG: Record<MetricStatus, { label: string; bg: string; color: string; dot: string }> = {
  platform: { label: 'Платформа', bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
  planned: { label: 'Доработка', bg: '#DBEAFE', color: '#1E40AF', dot: '#3B82F6' },
  report_required: { label: 'Нужен отчёт', bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'vitals' | 'pages';

export function CoreWebVitalsPanel() {
  const [tab, setTab] = useState<Tab>('vitals');

  const platform = VITALS.filter(v => v.status === 'platform').length + PAGES.filter(p => p.status === 'platform').length;
  const planned = VITALS.filter(v => v.status === 'planned').length + PAGES.filter(p => p.status === 'planned').length;
  const reportRequired = VITALS.filter(v => v.status === 'report_required').length + PAGES.filter(p => p.status === 'report_required').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Проверок', value: VITALS.length + PAGES.length, color: '#0F1419' },
          { label: 'Платформа', value: platform, color: '#065F46' },
          { label: 'Доработка', value: planned, color: '#1E40AF' },
          { label: 'Отчёт', value: reportRequired, color: reportRequired > 0 ? '#92400E' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        Performance readiness · настоящая платформа временно без интеграций. Web Vitals, bundle и page-speed цифры не заявляются без фактического отчёта активного домена.
      </div>

      <div style={{ display: 'flex', gap: 5 }}>
        {([['vitals', 'Метрики'], ['pages', 'По страницам']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'vitals' && (
        <div style={{ display: 'grid', gap: 5 }}>
          {VITALS.map((v) => {
            const st = STATUS_CFG[v.status];
            return (
              <div key={v.name} style={{ padding: '8px 12px', borderRadius: 10, background: v.status === 'report_required' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${v.status === 'report_required' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#0F1419', width: 90, flexShrink: 0 }}>{v.name}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: st.bg, color: st.color }}>{st.label}</span>
                  <span style={{ fontSize: 9, color: '#94A3B8' }}>цель: {v.target}</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2, paddingLeft: 16 }}>{v.description} · {v.evidence}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'pages' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Ключевые страницы для performance-smoke</div>
          {PAGES.map((p) => {
            const st = STATUS_CFG[p.status];
            return (
              <div key={p.page} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{p.page}</code>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 4 }}>{p.check}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Core Web Vitals readiness · без fake-метрик, без статичных performance-цифр, без утверждения подключённой RUM-системы.
      </div>
    </div>
  );
}
