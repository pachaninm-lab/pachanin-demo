'use client';

import { useState } from 'react';

type CheckStatus = 'ready' | 'planned' | 'required' | 'blocked';

interface SyntheticCheck {
  id: string;
  name: string;
  path: string;
  method: string;
  cadence: string;
  targetDurationMs: number;
  status: CheckStatus;
  p95TargetMs: number;
  uptimeTarget: number;
  alertRoute: string;
}

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: 'P1' | 'P2' | 'P3';
  channel: string;
  status: CheckStatus;
  note: string;
}

const CHECKS: SyntheticCheck[] = [
  { id: 'sc-01', name: 'API Health', path: '/api/health', method: 'GET', cadence: '1 мин', targetDurationMs: 100, status: 'ready', p95TargetMs: 200, uptimeTarget: 99.9, alertRoute: 'P1 после подключения alerting' },
  { id: 'sc-02', name: 'Auth: login flow', path: '/api/auth/session', method: 'POST', cadence: '5 мин', targetDurationMs: 300, status: 'planned', p95TargetMs: 500, uptimeTarget: 99.9, alertRoute: 'P1 security/auth' },
  { id: 'sc-03', name: 'Deals list', path: '/api/deals', method: 'GET', cadence: '5 мин', targetDurationMs: 500, status: 'planned', p95TargetMs: 700, uptimeTarget: 99.5, alertRoute: 'P2 operations' },
  { id: 'sc-04', name: 'Create deal', path: '/api/deals', method: 'POST', cadence: '15 мин', targetDurationMs: 700, status: 'planned', p95TargetMs: 1000, uptimeTarget: 99.5, alertRoute: 'P1 core deal' },
  { id: 'sc-05', name: 'Settlement reserve readiness', path: '/api/settlement/reserve', method: 'POST', cadence: '15 мин', targetDurationMs: 700, status: 'required', p95TargetMs: 1000, uptimeTarget: 99.5, alertRoute: 'P1 bank contour' },
  { id: 'sc-06', name: 'FGIS adapter readiness', path: '/api/integrations/fgis/ping', method: 'GET', cadence: '30 мин', targetDurationMs: 1000, status: 'required', p95TargetMs: 2000, uptimeTarget: 99.0, alertRoute: 'P2 integration contour' },
  { id: 'sc-07', name: 'Evidence pack build', path: '/api/deals/:id/evidence', method: 'GET', cadence: '30 мин', targetDurationMs: 1500, status: 'planned', p95TargetMs: 2500, uptimeTarget: 99.0, alertRoute: 'P2 dispute/evidence' },
  { id: 'sc-08', name: 'Event backbone readiness', path: '/api/infra/event-bus/health', method: 'GET', cadence: '1 мин', targetDurationMs: 200, status: 'required', p95TargetMs: 500, uptimeTarget: 99.9, alertRoute: 'P1 event backbone' },
  { id: 'sc-09', name: 'Lab protocol create', path: '/api/lab/samples', method: 'POST', cadence: '15 мин', targetDurationMs: 700, status: 'planned', p95TargetMs: 1000, uptimeTarget: 99.5, alertRoute: 'P2 lab runtime' },
  { id: 'sc-10', name: 'Bank outbox status', path: '/api/outbox/status', method: 'GET', cadence: '5 мин', targetDurationMs: 200, status: 'planned', p95TargetMs: 500, uptimeTarget: 99.9, alertRoute: 'P1 bank/outbox' },
];

const ALERT_RULES: AlertRule[] = [
  { id: 'ar-01', name: 'API unavailable', condition: 'health/readiness fails for 2 consecutive checks', severity: 'P1', channel: 'incident route', status: 'planned', note: 'Канал эскалации подключается после выбора мониторинга' },
  { id: 'ar-02', name: 'Settlement blocked', condition: 'bank/outbox pending or manual_review above threshold', severity: 'P1', channel: 'bank ops route', status: 'required', note: 'Не активировать как live без банкового callback/reconciliation' },
  { id: 'ar-03', name: 'Latency spike', condition: 'p95 target breached for 5 min', severity: 'P2', channel: 'ops route', status: 'planned', note: 'Требует фактических метрик из production monitoring' },
  { id: 'ar-04', name: 'FGIS adapter unavailable', condition: 'adapter probe fails after live credentials connected', severity: 'P2', channel: 'integration route', status: 'required', note: 'ФГИС не считать подключённой до боевых доступов' },
  { id: 'ar-05', name: 'Event consumer lag', condition: 'consumer lag exceeds per-topic threshold', severity: 'P2', channel: 'platform ops route', status: 'required', note: 'Требует event backbone и consumer group metrics' },
  { id: 'ar-06', name: 'Outbox backlog', condition: 'pending operations exceed SLA threshold', severity: 'P2', channel: 'finance ops route', status: 'planned', note: 'Нужен outbox dashboard и manual-review регламент' },
  { id: 'ar-07', name: 'Storage capacity risk', condition: 'storage usage exceeds threshold', severity: 'P3', channel: 'infra route', status: 'planned', note: 'Документы/evidence требуют retention и capacity planning' },
  { id: 'ar-08', name: 'MFA brute force', condition: 'failed MFA exceeds security threshold', severity: 'P1', channel: 'security route', status: 'planned', note: 'Требует серверной MFA-политики и audit trail' },
];

const STATUS_CFG: Record<CheckStatus, { label: string; bg: string; color: string; dot: string }> = {
  ready:    { label: 'READY',    bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
  planned:  { label: 'PLANNED',  bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
  required: { label: 'REQUIRED', bg: '#FEE2E2', color: '#DC2626', dot: '#EF4444' },
  blocked:  { label: 'BLOCKED',  bg: '#F3E8FF', color: '#7C3AED', dot: '#A78BFA' },
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

  const ready = CHECKS.filter(c => c.status === 'ready').length;
  const planned = CHECKS.filter(c => c.status === 'planned').length;
  const required = CHECKS.filter(c => c.status === 'required').length;
  const requiredAlerts = ALERT_RULES.filter(a => a.status === 'required').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Проверок', value: CHECKS.length, color: '#0F1419' },
          { label: 'READY', value: ready, color: '#065F46' },
          { label: 'PLANNED', value: planned, color: planned > 0 ? '#92400E' : '#065F46' },
          { label: 'REQUIRED', value: required, color: required > 0 ? '#DC2626' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        Synthetic monitoring readiness · критические пути, cadence, alert routing и SLO-пороги подготовлены; фактические uptime, last run и активные алерты требуют подключённого промышленного мониторинга. Required alert rules: {requiredAlerts}.
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
          <div style={lbl}>Синтетические проверки · целевая карта</div>
          {CHECKS.map((check) => {
            const st = STATUS_CFG[check.status];
            return (
              <div key={check.id} style={{ padding: '8px 12px', borderRadius: 10, background: check.status === 'required' ? '#FEF2F2' : check.status === 'planned' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${check.status === 'required' ? '#FCA5A5' : check.status === 'planned' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{check.name}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: st.bg, color: st.color }}>{st.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#065F46' }}>target {check.targetDurationMs} мс</span>
                  <span style={{ fontSize: 9, color: '#64748B' }}>p95 ≤ {check.p95TargetMs} мс</span>
                  <span style={{ fontSize: 9, color: '#64748B', fontWeight: 700 }}>uptime ≥ {check.uptimeTarget}%</span>
                </div>
                <div style={{ fontSize: 8, color: '#94A3B8', marginTop: 2 }}>
                  {check.method} {check.path} · cadence: {check.cadence} · route: {check.alertRoute}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'alerts' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Alert rules · целевая маршрутизация</div>
          {ALERT_RULES.map((rule) => {
            const sev = SEV_CFG[rule.severity];
            const st = STATUS_CFG[rule.status];
            return (
              <div key={rule.id} style={{ padding: '8px 12px', borderRadius: 10, background: rule.status === 'required' ? '#FEF2F2' : rule.status === 'planned' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${rule.status === 'required' ? '#FCA5A5' : rule.status === 'planned' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: sev.bg, color: sev.color }}>{rule.severity}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{rule.name}</span>
                  <span style={{ fontSize: 8, color: '#64748B' }}>{rule.channel}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>
                  Условие: {rule.condition}
                  <span style={{ color: '#92400E', marginLeft: 8 }}>{rule.note}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Synthetic monitoring readiness · Prometheus/Grafana/Alertmanager/PagerDuty/Telegram указаны как целевой контур; фактические проверки, uptime и алерты не заявляются без live-мониторинга.
      </div>
    </div>
  );
}
