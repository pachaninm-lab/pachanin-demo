'use client';

import { useState } from 'react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type MetricStatus = 'ready' | 'planned' | 'required';

interface ServiceMetric {
  name: string;
  p95TargetMs: number;
  errorRateTarget: number;
  signal: string;
  status: MetricStatus;
}

const STATUS_COLOR: Record<MetricStatus, string> = { ready: '#0A7A5F', planned: '#D97706', required: '#DC2626' };
const STATUS_BG: Record<MetricStatus, string> = { ready: '#D1FAE5', planned: '#FEF3C7', required: '#FEE2E2' };
const STATUS_LABEL: Record<MetricStatus, string> = { ready: 'READY', planned: 'PLANNED', required: 'REQUIRED' };

const SERVICES: ServiceMetric[] = [
  { name: 'deal-service',      p95TargetMs: 500, errorRateTarget: 1, signal: 'deal state transitions / blockers / next action', status: 'ready' },
  { name: 'payment-service',   p95TargetMs: 700, errorRateTarget: 1, signal: 'outbox / bank reconciliation / manual review', status: 'planned' },
  { name: 'document-service',  p95TargetMs: 700, errorRateTarget: 1, signal: 'document readiness / signing / evidence export', status: 'planned' },
  { name: 'logistics-service', p95TargetMs: 800, errorRateTarget: 2, signal: 'shipment events / GPS checkpoints / elevator queue', status: 'planned' },
  { name: 'notification-svc',  p95TargetMs: 1000, errorRateTarget: 2, signal: 'delivery status / retries / dead letters', status: 'required' },
  { name: 'ml-serving',        p95TargetMs: 1200, errorRateTarget: 2, signal: 'scenario analytics / price risk explanations', status: 'required' },
];

const generateTargetLatency = (target: number, points = 20) =>
  Array.from({ length: points }, (_, i) => ({
    t: `${String(Math.floor((i * 3) / 60)).padStart(2,'0')}:${String((i * 3) % 60).padStart(2,'0')}`,
    p50: Math.round(target * 0.45),
    p95: target,
    p99: Math.round(target * 1.8),
  }));

const ERROR_BUDGET_PLAN = Array.from({ length: 20 }, (_, i) => ({
  t: `${String(Math.floor((i * 3) / 60)).padStart(2,'0')}:${String((i * 3) % 60).padStart(2,'0')}`,
  rate: i < 8 ? 0.4 : i < 15 ? 0.8 : 1,
}));

const BUSINESS_SIGNALS = [
  { day: 'GMV', value: 100 },
  { day: 'Deals', value: 85 },
  { day: 'Docs', value: 70 },
  { day: 'Money', value: 60 },
  { day: 'Disputes', value: 55 },
  { day: 'Outbox', value: 75 },
  { day: 'Audit', value: 90 },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function ObservabilityPanel() {
  const [activeService, setActiveService] = useState<string>(SERVICES[0].name);
  const [tab, setTab] = useState<'latency' | 'errors' | 'business'>('latency');

  const svc = SERVICES.find((s) => s.name === activeService) ?? SERVICES[0];
  const latData = generateTargetLatency(svc.p95TargetMs);

  const required = SERVICES.filter((s) => s.status === 'required').length;
  const planned = SERVICES.filter((s) => s.status === 'planned').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
        {[
          { label: 'Сигналов', value: SERVICES.length, color: '#0F1419' },
          { label: 'Required', value: required, color: required > 0 ? '#DC2626' : '#0A7A5F' },
          { label: 'Planned', value: planned, color: planned > 0 ? '#D97706' : '#0A7A5F' },
          { label: 'Метрики', value: 'целевые', color: '#0F1419' },
          { label: 'p95 target max', value: `${Math.max(...SERVICES.map(s => s.p95TargetMs))} мс`, color: '#0F1419' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Service list */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Сервисы и обязательные сигналы наблюдаемости</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {SERVICES.map((s) => (
            <button
              key={s.name}
              onClick={() => setActiveService(s.name)}
              style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 8, border: `1px solid ${activeService === s.name ? STATUS_COLOR[s.status] : '#E4E6EA'}`, background: activeService === s.name ? STATUS_BG[s.status] + '80' : '#F8FAFB', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: STATUS_BG[s.status], color: STATUS_COLOR[s.status] }}>{STATUS_LABEL[s.status]}</span>
              <code style={{ fontSize: 11, fontWeight: 700, flex: 1, color: '#0F1419' }}>{s.name}</code>
              <span style={{ fontSize: 10, color: '#64748B', minWidth: 80 }}>p95 target: {s.p95TargetMs} мс</span>
              <span style={{ fontSize: 10, color: '#94A3B8', minWidth: 90 }}>err target &lt; {s.errorRateTarget}%</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart tabs */}
      <div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {([['latency','Latency targets'], ['errors','Error budget'], ['business','Business signals']] as const).map(([key, title]) => (
            <button key={key} onClick={() => setTab(key)} style={{ padding: '5px 12px', borderRadius: 8, border: tab === key ? 'none' : '1px solid #E4E6EA', background: tab === key ? '#0F1419' : '#F8FAFB', color: tab === key ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {title}
            </button>
          ))}
        </div>

        {tab === 'latency' && (
          <div>
            <div style={{ ...lbl, marginBottom: 4 }}>{activeService} · целевые задержки</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={latData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="t" tick={{ fontSize: 9 }} interval={4} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="p50" stroke="#0A7A5F" dot={false} name="p50 target" strokeWidth={1.5} />
                <Line type="monotone" dataKey="p95" stroke="#D97706" dot={false} name="p95 target" strokeWidth={2} />
                <Line type="monotone" dataKey="p99" stroke="#DC2626" dot={false} name="p99 target" strokeWidth={1} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 12, fontSize: 9, color: '#94A3B8', marginTop: 4 }}>
              <span style={{ color: '#0A7A5F' }}>— p50 target</span>
              <span style={{ color: '#D97706' }}>— p95 target</span>
              <span style={{ color: '#DC2626' }}>-- p99 target</span>
              <span style={{ marginLeft: 'auto' }}>Факт требует live-metrics</span>
            </div>
          </div>
        )}

        {tab === 'errors' && (
          <div>
            <div style={{ ...lbl, marginBottom: 4 }}>Error budget target · сводная модель</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={ERROR_BUDGET_PLAN} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="t" tick={{ fontSize: 9 }} interval={4} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v: number) => [`${v}%`, 'target err budget']} />
                <Area type="monotone" dataKey="rate" stroke="#DC2626" fill="#FEE2E2" name="err target" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 4 }}>Цель: error rate ниже порога. Фактические значения требуют подключённого мониторинга.</div>
          </div>
        )}

        {tab === 'business' && (
          <div>
            <div style={{ ...lbl, marginBottom: 4 }}>Business observability · обязательные сигналы</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={BUSINESS_SIGNALS} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v: number) => [`${v}%`, 'readiness']} />
                <Bar dataKey="value" fill="#0A7A5F" radius={[3,3,0,0]} name="readiness" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Alert queue */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Alerting runbook · без fake-live алертов</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {[
            { svc: 'payment-service', msg: 'Bank outbox pending/manual_review превышает порог — P1 после подключения банка', sev: 'P1', color: '#DC2626', bg: '#FEE2E2' },
            { svc: 'deal-service', msg: 'Сделка зависла в статусе без next action — P2 операционная эскалация', sev: 'P2', color: '#D97706', bg: '#FEF3C7' },
            { svc: 'document-service', msg: 'Документный комплект блокирует банковскую проверку — P3 контроль полноты', sev: 'P3', color: '#B45309', bg: '#FFF7ED' },
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
        Observability readiness · Prometheus/Grafana/Loki/Tempo/OpenTelemetry/Alertmanager как целевой контур; фактические метрики, GMV и алерты требуют подключённого промышленного мониторинга.
      </div>
    </div>
  );
}
