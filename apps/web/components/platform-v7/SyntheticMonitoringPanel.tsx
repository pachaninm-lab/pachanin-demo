'use client';

import { useState } from 'react';

type CheckStatus = 'ok' | 'degraded' | 'fail' | 'timeout';

interface SyntheticCheck {
  id: string;
  name: string;
  path: string;
  method: string;
  lastRunAt: string;
  durationMs: number;
  status: CheckStatus;
  p95ms: number;
  uptime24h: number;
  alertChannel: string;
}

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: 'P1' | 'P2' | 'P3';
  channel: string;
  active: boolean;
  lastFiredAt: string | null;
}

const CHECKS: SyntheticCheck[] = [
  { id: 'sc-01', name: 'API Health',           path: '/api/health',                 method: 'GET',  lastRunAt: '2024-03-20T11:25:00Z', durationMs: 48,   status: 'ok',       p95ms: 62,   uptime24h: 100.0,  alertChannel: 'PagerDuty P1' },
  { id: 'sc-02', name: 'Auth: login flow',     path: '/api/auth/session',           method: 'POST', lastRunAt: '2024-03-20T11:25:00Z', durationMs: 134,  status: 'ok',       p95ms: 178,  uptime24h: 100.0,  alertChannel: 'PagerDuty P1' },
  { id: 'sc-03', name: 'Deals list',           path: '/api/deals',                  method: 'GET',  lastRunAt: '2024-03-20T11:20:00Z', durationMs: 312,  status: 'ok',       p95ms: 340,  uptime24h: 99.98,  alertChannel: 'Telegram P2' },
  { id: 'sc-04', name: 'Create deal',          path: '/api/deals',                  method: 'POST', lastRunAt: '2024-03-20T11:20:00Z', durationMs: 421,  status: 'ok',       p95ms: 498,  uptime24h: 99.95,  alertChannel: 'PagerDuty P1' },
  { id: 'sc-05', name: 'Settlement reserve',   path: '/api/settlement/reserve',     method: 'POST', lastRunAt: '2024-03-20T11:20:00Z', durationMs: 287,  status: 'ok',       p95ms: 320,  uptime24h: 100.0,  alertChannel: 'PagerDuty P1' },
  { id: 'sc-06', name: 'FGIS adapter ping',    path: '/api/integrations/fgis/ping', method: 'GET',  lastRunAt: '2024-03-20T11:20:00Z', durationMs: 890,  status: 'degraded', p95ms: 1240, uptime24h: 98.2,   alertChannel: 'Telegram P2' },
  { id: 'sc-07', name: 'Evidence pack build',  path: '/api/deals/:id/evidence',     method: 'GET',  lastRunAt: '2024-03-20T11:15:00Z', durationMs: 1120, status: 'ok',       p95ms: 1450, uptime24h: 99.90,  alertChannel: 'Telegram P2' },
  { id: 'sc-08', name: 'Kafka cluster health', path: '/api/infra/kafka/health',     method: 'GET',  lastRunAt: '2024-03-20T11:25:00Z', durationMs: 92,   status: 'ok',       p95ms: 110,  uptime24h: 100.0,  alertChannel: 'PagerDuty P1' },
  { id: 'sc-09', name: 'Lab protocol create',  path: '/api/lab/samples',            method: 'POST', lastRunAt: '2024-03-20T11:15:00Z', durationMs: 245,  status: 'ok',       p95ms: 290,  uptime24h: 99.97,  alertChannel: 'Telegram P2' },
  { id: 'sc-10', name: 'Bank outbox flush',    path: '/api/outbox/status',          method: 'GET',  lastRunAt: '2024-03-20T11:25:00Z', durationMs: 67,   status: 'ok',       p95ms: 85,   uptime24h: 100.0,  alertChannel: 'PagerDuty P1' },
];

const ALERT_RULES: AlertRule[] = [
  { id: 'ar-01', name: 'API Down',             condition: 'uptime < 99.5% за 5 мин',      severity: 'P1', channel: 'PagerDuty',  active: true,  lastFiredAt: null },
  { id: 'ar-02', name: 'Settlement Error',     condition: 'error rate > 1% за 1 мин',     severity: 'P1', channel: 'PagerDuty',  active: true,  lastFiredAt: null },
  { id: 'ar-03', name: 'Latency Spike',        condition: 'p95 > 500 мс за 5 мин',        severity: 'P2', channel: 'Telegram',   active: true,  lastFiredAt: '2024-03-19T03:15:00Z' },
  { id: 'ar-04', name: 'FGIS Degraded',        condition: 'FGIS p95 > 2000 мс за 10 мин', severity: 'P2', channel: 'Telegram',   active: true,  lastFiredAt: '2024-03-20T11:20:00Z' },
  { id: 'ar-05', name: 'Kafka Consumer Lag',   condition: 'lag > 10 000 за 3 мин',        severity: 'P2', channel: 'Telegram',   active: true,  lastFiredAt: null },
  { id: 'ar-06', name: 'Outbox Backlog',        condition: 'pending > 100 за 15 мин',      severity: 'P2', channel: 'Telegram',   active: true,  lastFiredAt: null },
  { id: 'ar-07', name: 'Disk Usage High',       condition: 'disk > 85%',                   severity: 'P3', channel: 'Email',      active: true,  lastFiredAt: null },
  { id: 'ar-08', name: 'MFA Brute Force',       condition: 'failed MFA > 10/min per IP',   severity: 'P1', channel: 'PagerDuty',  active: true,  lastFiredAt: null },
];

const STATUS_CFG: Record<CheckStatus, { label: string; bg: string; color: string; dot: string }> = {
  ok:       { label: 'OK',        bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
  degraded: { label: 'Деградация',bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
  fail:     { label: 'Ошибка',    bg: '#FEE2E2', color: '#DC2626', dot: '#EF4444' },
  timeout:  { label: 'Таймаут',   bg: '#F3E8FF', color: '#7C3AED', dot: '#A78BFA' },
};

const SEV_CFG: Record<'P1'|'P2'|'P3', { bg: string; color: string }> = {
  P1: { bg: '#FEE2E2', color: '#DC2626' },
  P2: { bg: '#FEF3C7', color: '#92400E' },
  P3: { bg: '#F1F5F9', color: '#64748B' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'checks' | 'alerts';

export function SyntheticMonitoringPanel() {
  const [tab, setTab] = useState<Tab>('checks');

  const ok = CHECKS.filter(c => c.status === 'ok').length;
  const degraded = CHECKS.filter(c => c.status === 'degraded').length;
  const avgUptime = (CHECKS.reduce((a, c) => a + c.uptime24h, 0) / CHECKS.length).toFixed(2);
  const activeAlerts = ALERT_RULES.filter(a => a.lastFiredAt !== null).length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Проверок',     value: CHECKS.length,    color: '#0F1419' },
          { label: 'OK',           value: ok,               color: '#065F46' },
          { label: 'Деградация',   value: degraded,         color: degraded > 0 ? '#92400E' : '#065F46' },
          { label: 'Uptime 24h',   value: `${avgUptime}%`,  color: Number(avgUptime) >= 99.9 ? '#065F46' : '#92400E' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        §13.2 Synthetic monitoring · Критичные пути каждые 5 мин · Prometheus + Grafana + Alertmanager · PagerDuty P1 &lt;5 мин · {activeAlerts} активных алертов
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5 }}>
        {([['checks', 'Synthetic checks'], ['alerts', 'Alert rules']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'checks' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Синтетические проверки — каждые 5 минут</div>
          {CHECKS.map((check) => {
            const st = STATUS_CFG[check.status];
            return (
              <div key={check.id} style={{ padding: '8px 12px', borderRadius: 10, background: check.status !== 'ok' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${check.status !== 'ok' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{check.name}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: st.bg, color: st.color }}>{st.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: check.durationMs < 500 ? '#065F46' : check.durationMs < 1000 ? '#92400E' : '#DC2626' }}>{check.durationMs} мс</span>
                  <span style={{ fontSize: 9, color: '#64748B' }}>p95: {check.p95ms} мс</span>
                  <span style={{ fontSize: 9, color: check.uptime24h >= 99.9 ? '#065F46' : '#92400E', fontWeight: 700 }}>{check.uptime24h}%</span>
                </div>
                <div style={{ fontSize: 8, color: '#94A3B8', marginTop: 2 }}>
                  {check.method} {check.path} · {new Date(check.lastRunAt).toLocaleTimeString('ru-RU')} · {check.alertChannel}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'alerts' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Alert rules — Alertmanager + PagerDuty + Telegram</div>
          {ALERT_RULES.map((rule) => {
            const sev = SEV_CFG[rule.severity];
            return (
              <div key={rule.id} style={{ padding: '8px 12px', borderRadius: 10, background: rule.lastFiredAt ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${rule.lastFiredAt ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: sev.bg, color: sev.color }}>{rule.severity}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{rule.name}</span>
                  <span style={{ fontSize: 8, color: '#64748B' }}>{rule.channel}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: rule.active ? '#D1FAE5' : '#F1F5F9', color: rule.active ? '#065F46' : '#94A3B8' }}>{rule.active ? 'ACTIVE' : 'MUTED'}</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>
                  Условие: {rule.condition}
                  {rule.lastFiredAt && <span style={{ color: '#92400E', marginLeft: 8 }}>⚡ Сработало: {new Date(rule.lastFiredAt).toLocaleString('ru-RU')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        §13.2 Observability · Prometheus · Grafana · Alertmanager · PagerDuty P1 &lt;5 мин · Synthetic monitoring · демо-данные.
      </div>
    </div>
  );
}
