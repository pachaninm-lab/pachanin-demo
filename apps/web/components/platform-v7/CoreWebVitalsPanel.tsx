'use client';

import { useState } from 'react';

type MetricStatus = 'good' | 'needs_improvement' | 'poor';

interface VitalMetric {
  name: string;
  value: string;
  target: string;
  status: MetricStatus;
  tool: string;
  description: string;
}

interface PagePerf {
  page: string;
  lcp: number;
  inp: number;
  cls: number;
  tti: number;
  bundle: number;
}

const VITALS: VitalMetric[] = [
  { name: 'LCP',         value: '1.8 сек',  target: '< 2.5 сек', status: 'good',               tool: 'Grafana Faro',            description: 'Largest Contentful Paint — время рендера основного контента' },
  { name: 'INP',         value: '72 мс',    target: '< 100 мс',  status: 'good',               tool: 'Grafana Faro',            description: 'Interaction to Next Paint — задержка реакции на действие пользователя' },
  { name: 'CLS',         value: '0.04',     target: '< 0.1',     status: 'good',               tool: 'Grafana Faro',            description: 'Cumulative Layout Shift — стабильность макета при загрузке' },
  { name: 'Bundle size', value: '187 КБ',   target: '< 200 КБ',  status: 'good',               tool: 'Webpack Bundle Analyzer', description: 'Начальный JS-бандл (initial load, gzip)' },
  { name: 'TTI',         value: '2.9 сек',  target: '< 3.5 сек', status: 'good',               tool: 'Lighthouse CI',           description: 'Time to Interactive — время до полной интерактивности страницы' },
  { name: 'TTFB',        value: '110 мс',   target: '< 200 мс',  status: 'good',               tool: 'Grafana Faro',            description: 'Time to First Byte — время ответа сервера (Next.js SSR)' },
];

const PAGE_PERF: PagePerf[] = [
  { page: 'deals/page',      lcp: 1.8, inp: 68,  cls: 0.03, tti: 2.7, bundle: 187 },
  { page: 'bank/page',       lcp: 2.1, inp: 82,  cls: 0.05, tti: 3.1, bundle: 195 },
  { page: 'logistics/page',  lcp: 1.9, inp: 74,  cls: 0.04, tti: 2.9, bundle: 189 },
  { page: 'executive/page',  lcp: 2.3, inp: 95,  cls: 0.07, tti: 3.4, bundle: 198 },
  { page: 'driver/field',    lcp: 1.5, inp: 55,  cls: 0.02, tti: 2.3, bundle: 145 },
  { page: 'compliance/page', lcp: 2.0, inp: 88,  cls: 0.06, tti: 3.2, bundle: 192 },
];

const STATUS_CFG: Record<MetricStatus, { label: string; bg: string; color: string; dot: string }> = {
  good:               { label: 'Хорошо',      bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
  needs_improvement:  { label: 'Улучшить',    bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
  poor:               { label: 'Плохо',       bg: '#FEE2E2', color: '#DC2626', dot: '#EF4444' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'vitals' | 'pages';

function lcpColor(v: number) { return v < 2.5 ? '#065F46' : v < 4 ? '#92400E' : '#DC2626'; }
function inpColor(v: number) { return v < 100 ? '#065F46' : v < 200 ? '#92400E' : '#DC2626'; }
function clsColor(v: number) { return v < 0.1 ? '#065F46' : v < 0.25 ? '#92400E' : '#DC2626'; }

export function CoreWebVitalsPanel() {
  const [tab, setTab] = useState<Tab>('vitals');

  const good = VITALS.filter(v => v.status === 'good').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Метрик',       value: VITALS.length,  color: '#0F1419' },
          { label: 'В норме',      value: good,           color: '#065F46' },
          { label: 'LCP p75',      value: '1.8 сек',     color: '#065F46' },
          { label: 'Bundle',       value: '187 КБ',       color: '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        §14.2 Core Web Vitals · Grafana Faro RUM · Lighthouse CI · Webpack Bundle Analyzer · Все 6 метрик в норме
      </div>

      {/* Tabs */}
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
              <div key={v.name} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#0F1419', width: 80, flexShrink: 0 }}>{v.name}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: st.color }}>{v.value}</span>
                  <span style={{ fontSize: 9, color: '#94A3B8' }}>цель: {v.target}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: st.bg, color: st.color, marginLeft: 'auto' }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2, paddingLeft: 16 }}>{v.description} · {v.tool}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'pages' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Производительность по ключевым страницам</div>
          {PAGE_PERF.map((p) => (
            <div key={p.page} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{p.page}</code>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9 }}><b style={{ color: lcpColor(p.lcp) }}>LCP {p.lcp}с</b></span>
                <span style={{ fontSize: 9 }}><b style={{ color: inpColor(p.inp) }}>INP {p.inp}мс</b></span>
                <span style={{ fontSize: 9 }}><b style={{ color: clsColor(p.cls) }}>CLS {p.cls}</b></span>
                <span style={{ fontSize: 9, color: '#64748B' }}>TTI {p.tti}с</span>
                <span style={{ fontSize: 9, color: '#64748B' }}>Bundle {p.bundle}КБ</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        §14.2 Core Web Vitals · Grafana Faro RUM · Lighthouse CI в GitHub Actions · демо-данные.
      </div>
    </div>
  );
}
