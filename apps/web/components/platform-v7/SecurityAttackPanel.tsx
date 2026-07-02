'use client';

import { useState } from 'react';

type ThreatStatus = 'protected' | 'mitigated' | 'monitoring';
type RateEvent = 'blocked' | 'allowed';

interface ThreatRow {
  threat: string;
  protection: string;
  status: ThreatStatus;
  lastIncident: string | null;
}

interface RateLimitEvent {
  ip: string;
  endpoint: string;
  attempts: number;
  blockedUntil: string | null;
  status: RateEvent;
  time: string;
}

const THREATS: ThreatRow[] = [
  { threat: 'SQL Injection', protection: 'Prisma parameterized queries + WAF CRS rules', status: 'protected', lastIncident: null },
  { threat: 'XSS', protection: 'CSP header + React DOM escaping + Trusted Types API', status: 'protected', lastIncident: null },
  { threat: 'CSRF', protection: 'SameSite=Strict cookie + CSRF-токен на state-changing ops', status: 'protected', lastIncident: null },
  { threat: 'Brute Force', protection: 'Redis rate limit: 5 попыток → 15 мин блок, 10 → 24 ч', status: 'protected', lastIncident: '2024-03-18' },
  { threat: 'DDoS', protection: 'Cloudflare / Yandex DDoS Protection на уровне DNS', status: 'monitoring', lastIncident: null },
  { threat: 'Path Traversal', protection: 'Validation middleware — пути от пользователя не принимаются', status: 'protected', lastIncident: null },
  { threat: 'Supply Chain', protection: 'Snyk CI + Dependabot + cosign signed Docker images', status: 'mitigated', lastIncident: null },
  { threat: 'Secret Leak', protection: 'GitLeaks pre-commit hook + GitHub secret scanning', status: 'protected', lastIncident: null },
];

const RATE_EVENTS: RateLimitEvent[] = [
  { ip: '95.46.xxx.xxx', endpoint: '/api/v1/auth/login', attempts: 12, blockedUntil: '2024-03-20T12:45:00Z', status: 'blocked', time: '2024-03-20T11:45:00Z' },
  { ip: '185.23.xxx.xxx', endpoint: '/api/v1/auth/login', attempts: 6,  blockedUntil: '2024-03-20T10:25:00Z', status: 'blocked', time: '2024-03-20T10:10:00Z' },
  { ip: '178.56.xxx.xxx', endpoint: '/api/v1/deals',      attempts: 3,  blockedUntil: null,                   status: 'allowed', time: '2024-03-20T11:00:00Z' },
  { ip: '213.87.xxx.xxx', endpoint: '/api/v1/auth/refresh',attempts: 8, blockedUntil: '2024-03-20T09:50:00Z', status: 'blocked', time: '2024-03-20T09:35:00Z' },
];

const WAF_RULES = [
  { id: 'CRS-942100', name: 'SQL Injection', blocked: 47, status: 'active' },
  { id: 'CRS-941100', name: 'XSS Filter', blocked: 12, status: 'active' },
  { id: 'CRS-930100', name: 'Path Traversal', blocked: 3, status: 'active' },
  { id: 'CRS-921110', name: 'HTTP Request Smuggling', blocked: 0, status: 'active' },
  { id: 'CUSTOM-001', name: 'Grain API Rate', blocked: 89, status: 'active' },
];

const STATUS_CFG: Record<ThreatStatus, { bg: string; color: string; icon: string }> = {
  protected:  { bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  mitigated:  { bg: '#EFF6FF', color: '#1E40AF', icon: '~' },
  monitoring: { bg: '#FEF3C7', color: '#92400E', icon: '◉' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'threats' | 'waf' | 'ratelimit';

export function SecurityAttackPanel() {
  const [tab, setTab] = useState<Tab>('threats');

  const protected_ = THREATS.filter(t => t.status === 'protected').length;
  const blocked24h = RATE_EVENTS.filter(e => e.status === 'blocked').length;
  const totalWafBlocks = WAF_RULES.reduce((s, r) => s + r.blocked, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Угроз',          value: THREATS.length,  color: '#0F1419' },
          { label: 'Защищено',       value: protected_,      color: '#065F46' },
          { label: 'WAF заблок.',    value: totalWafBlocks,  color: '#1E40AF' },
          { label: 'Brute блок.',    value: blocked24h,      color: blocked24h > 0 ? '#DC2626' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* WAF status */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 9, color: '#065F46', fontWeight: 700, lineHeight: 1.6 }}>
        WAF: Coraza (ModSecurity compatible) + OWASP CRS 4.0 · Nginx Ingress · SecRuleEngine On · RequestBodyLimit 10МБ · CSP: default-src 'self' · HSTS: max-age=31536000
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['threats', 'Матрица угроз'], ['waf', 'WAF Правила'], ['ratelimit', 'Rate Limit']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'threats' && (
        <div style={{ display: 'grid', gap: 5 }}>
          {THREATS.map((t) => {
            const st = STATUS_CFG[t.status];
            return (
              <div key={t.threat} style={{ padding: '7px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0F1419', flex: 1 }}>{t.threat}</span>
                  {t.lastIncident && <span style={{ fontSize: 8, color: '#92400E' }}>Инцидент: {t.lastIncident}</span>}
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>{t.protection}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'waf' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>OWASP CRS 4.0 + Custom rules — события за 30 дней</div>
          {WAF_RULES.map((r) => (
            <div key={r.id} style={{ padding: '6px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{ fontSize: 9, color: '#1E40AF', minWidth: 100 }}>{r.id}</code>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{r.name}</span>
              <span style={{ fontSize: 9, fontWeight: 900, color: r.blocked > 0 ? '#DC2626' : '#065F46' }}>{r.blocked} заблок.</span>
              <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: '#D1FAE5', color: '#065F46' }}>ACTIVE</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'ratelimit' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Redis rate limit · Brute-force защита · последние события</div>
          {RATE_EVENTS.map((e) => (
            <div key={e.ip + e.time} style={{ padding: '7px 10px', borderRadius: 8, background: e.status === 'blocked' ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${e.status === 'blocked' ? '#FECACA' : '#BBF7D0'}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: e.status === 'blocked' ? '#DC2626' : '#065F46' }}>{e.status === 'blocked' ? '✗ BLOCKED' : '✓ ALLOWED'}</span>
                <code style={{ fontSize: 9, color: '#0F1419', flex: 1 }}>{e.ip}</code>
                <code style={{ fontSize: 9, color: '#64748B' }}>{e.endpoint}</code>
                <span style={{ fontSize: 9, color: '#374151' }}>{e.attempts} попыток</span>
              </div>
              {e.blockedUntil && (
                <div style={{ fontSize: 9, color: '#991B1B', marginTop: 2 }}>Заблокирован до: {new Date(e.blockedUntil).toLocaleTimeString('ru-RU')}</div>
              )}
            </div>
          ))}
          <div style={{ padding: '7px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700 }}>
            Redis rate limit: 5 попыток → 15 мин блок · 10 → 24 ч · IP + User Agent fingerprint · Exponential backoff response time
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        WAF Coraza + OWASP CRS · Redis brute-force · CSP/HSTS · Snyk/Trivy CI · GitLeaks · SAST Semgrep · Демо-данные.
      </div>
    </div>
  );
}
