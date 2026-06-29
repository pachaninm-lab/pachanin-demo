'use client';

import { useState } from 'react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type MetricStatus = 'ok' | 'warn' | 'crit';

interface ServiceMetric {
  name: string;
  p95ms: number;
  errorRate: number;
  rps: number;
  status: MetricStatus;
}

const STATUS_COLOR: Record<MetricStatus, string> = { ok: '#0A7A5F', warn: '#D97706', crit: '#DC2626' };
const STATUS_BG: Record<MetricStatus, string> = { ok: '#D1FAE5', warn: '#FEF3C7', crit: '#FEE2E2' };
const STATUS_LABEL: Record<MetricStatus, string> = { ok: 'OK', warn: 'WARN', crit: 'CRIT' };

const SERVICES: ServiceMetric[] = [
  { name: 'deal-service',      p95ms: 187, errorRate: 0.12, rps: 142, status: 'ok'  },
  { name: 'payment-service',   p95ms: 241, errorRate: 0.08, rps: 38,  status: 'ok'  },
  { name: 'document-service',  p95ms: 412, errorRate: 0.41, rps: 67,  status: 'warn'},
  { name: 'logistics-service', p95ms: 319, errorRate: 0.19, rps: 55,  status: 'ok'  },
  { name: 'notification-svc',  p95ms: 621, errorRate: 1.82, rps: 290, status: 'crit'},
  { name: 'ml-serving',        p95ms: 893, errorRate: 0.55, rps: 22,  status: 'warn'},
];

const generateLatency = (base: number, points = 20) =>
  Array.from({ length: points }, (_, i) => ({
    t: `${String(Math.floor((i * 3) / 60).toString().padStart(2,'0'))}:${String((i * 3) % 60).padStart(2,'0')}`,
    p50: Math.round(base * 0.6 + Math.random() * base * 0.3),
    p95: Math.round(base + Math.random() * base * 0.5),
    p99: Math.round(base * 1.5 + Math.random() * base * 0.8),
  }));

const ERROR_SERIES = Array.from({ length: 20 }, (_, i) => ({
  t: `${String(Math.floor((i * 3) / 60)).padStart(2,'0')}:${String((i * 3) % 60).padStart(2,'0')}`,
  rate: +(Math.random() * 2).toFixed(2),
}));

const GMV_SERIES = Array.from({ length: 7 }, (_, i) => ({
  day: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i],
  gmv: Math.round(120 + Math.random() * 80),
}));

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function ObservabilityPanel() {
  const [activeService, setActiveService] = useState<string>(SERVICES[0].name);
  const [tab, setTab] = useState<'latency' | 'errors' | 'business'>('latency');

  const svc = SERVICES.find((s) => s.name === activeService) ?? SERVICES[0];
  const latData = generateLatency(svc.p95ms);

  const crit = SERVICES.filter((s) => s.status === 'crit').length;
  const warn = SERVICES.filter((s) => s.status === 'warn').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
        {[
          { label: 'Сервисов', value: SERVICES.length, color: '#0F1419' },
          { label: 'CRIT', value: crit, color: crit > 0 ? '#DC2626' : '#0A7A5F' },
          { label: 'WARN', value: warn, color: warn > 0 ? '#D97706' : '#0A7A5F' },
          { label: 'RPS (сумм.)', value: SERVICES.reduce((s,x) => s + x.rps, 0), color: '#0F1419' },
          { label: 'p95 max', value: `${Math.max(...SERVICES.map(s => s.p95ms))} мс`, color: '#0F1419' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Service list */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Сервисы (Prometheus scrape)</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {SERVICES.map((s) => (
            <button
              key={s.name}
              onClick={() => setActiveService(s.name)}
              style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 8, border: `1px solid ${activeService === s.name ? STATUS_COLOR[s.status] : '#E4E6EA'}`, background: activeService === s.name ? STATUS_BG[s.status] + '80' : '#F8FAFB', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: STATUS_BG[s.status], color: STATUS_COLOR[s.status] }}>{STATUS_LABEL[s.status]}</span>
              <code style={{ fontSize: 11, fontWeight: 700, flex: 1, color: '#0F1419' }}>{s.name}</code>
              <span style={{ fontSize: 10, color: '#64748B', minWidth: 60 }}>p95: {s.p95ms} мс</span>
              <span style={{ fontSize: 10, color: s.errorRate >= 1 ? '#DC2626' : s.errorRate >= 0.4 ? '#D97706' : '#0A7A5F', minWidth: 55, fontWeight: 700 }}>err: {s.errorRate}%</span>
              <span style={{ fontSize: 10, color: '#94A3B8', minWidth: 48 }}>{s.rps} rps</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart tabs */}
      <div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {([['latency','Latency p50/95/99'], ['errors','Error rate'], ['business','GMV']] as const).map(([key, title]) => (
            <button key={key} onClick={() => setTab(key)} style={{ padding: '5px 12px', borderRadius: 8, border: tab === key ? 'none' : '1px solid #E4E6EA', background: tab === key ? '#0F1419' : '#F8FAFB', color: tab === key ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {title}
            </button>
          ))}
        </div>

        {tab === 'latency' && (
          <div>
            <div style={{ ...lbl, marginBottom: 4 }}>{activeService} · задержка мс (последние ~1 ч)</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={latData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="t" tick={{ fontSize: 9 }} interval={4} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="p50" stroke="#0A7A5F" dot={false} name="p50" strokeWidth={1.5} />
                <Line type="monotone" dataKey="p95" stroke="#D97706" dot={false} name="p95" strokeWidth={2} />
                <Line type="monotone" dataKey="p99" stroke="#DC2626" dot={false} name="p99" strokeWidth={1} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 12, fontSize: 9, color: '#94A3B8', marginTop: 4 }}>
              <span style={{ color: '#0A7A5F' }}>— p50</span>
              <span style={{ color: '#D97706' }}>— p95</span>
              <span style={{ color: '#DC2626' }}>-- p99</span>
              <span style={{ marginLeft: 'auto' }}>SLO: p95 &lt; 500 мс</span>
            </div>
          </div>
        )}

        {tab === 'errors' && (
          <div>
            <div style={{ ...lbl, marginBottom: 4 }}>Error rate % · все сервисы · сводно</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={ERROR_SERIES} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="t" tick={{ fontSize: 9 }} interval={4} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v: number) => [`${v}%`, 'err rate']} />
                <Area type="monotone" dataKey="rate" stroke="#DC2626" fill="#FEE2E2" name="err%" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 4 }}>SLO: error rate &lt; 1%</div>
          </div>
        )}

        {tab === 'business' && (
          <div>
            <div style={{ ...lbl, marginBottom: 4 }}>GMV по дням · млн ₽ · текущая неделя</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={GMV_SERIES} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v: number) => [`${v} млн ₽`, 'GMV']} />
                <Bar dataKey="gmv" fill="#0A7A5F" radius={[3,3,0,0]} name="GMV" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Alert queue */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Активные алерты (Alertmanager)</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {[
            { svc: 'notification-svc', msg: 'Error rate 1.82% превышает SLO 1%',        sev: 'P1', color: '#DC2626', bg: '#FEE2E2' },
            { svc: 'ml-serving',       msg: 'p95 latency 893 мс превышает SLO 500 мс',  sev: 'P2', color: '#D97706', bg: '#FEF3C7' },
            { svc: 'document-service', msg: 'Error rate 0.41% приближается к SLO',      sev: 'P3', color: '#B45309', bg: '#FFF7ED' },
          ].map((a) => (
            <div key={a.svc} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 10px', borderRadius: 8, background: a.bg, border: `1px solid ${a.color}40` }}>
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: a.color, color: '#fff', flexShrink: 0 }}>{a.sev}</span>
              <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flexShrink: 0 }}>{a.svc}</code>
              <span style={{ fontSize: 10, color: '#374151', flex: 1 }}>{a.msg}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Prometheus + Grafana + Loki + Tempo · OpenTelemetry Collector · Alertmanager → PagerDuty (P1/P2) + Telegram (P3) · Демо-данные.
      </div>
    </div>
  );
}
