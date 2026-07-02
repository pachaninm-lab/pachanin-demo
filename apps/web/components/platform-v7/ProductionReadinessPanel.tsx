'use client';

type CheckStatus = 'pass' | 'warn' | 'fail' | 'na';

interface ReadinessCheck {
  id: string;
  category: string;
  item: string;
  status: CheckStatus;
  note?: string;
}

const STATUS_CONFIG: Record<CheckStatus, { label: string; bg: string; color: string; icon: string }> = {
  pass: { label: 'Готово',     bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  warn: { label: 'Частично',   bg: '#FEF3C7', color: '#92400E', icon: '!' },
  fail: { label: 'Не готово',  bg: '#FEE2E2', color: '#991B1B', icon: '✗' },
  na:   { label: 'Н/А',        bg: '#F1F5F9', color: '#64748B', icon: '—' },
};

const CHECKLIST: ReadinessCheck[] = [
  // Инфраструктура
  { id: 'k8s',         category: 'Инфраструктура', item: 'Kubernetes cluster (3 nodes prod)',         status: 'pass' },
  { id: 'ha',          category: 'Инфраструктура', item: 'High Availability: replica=2 для каждого сервиса', status: 'pass' },
  { id: 'dr',          category: 'Инфраструктура', item: 'DR план: RPO 15 мин, RTO 1 час',            status: 'warn', note: 'DR тест запланирован на апрель' },
  { id: 'cdn',         category: 'Инфраструктура', item: 'CDN для статических ассетов',               status: 'pass' },
  { id: 'pg-replica',  category: 'Инфраструктура', item: 'PostgreSQL streaming replica (async)',      status: 'pass' },
  { id: 'redis-ha',    category: 'Инфраструктура', item: 'Redis Sentinel (3-node)',                   status: 'pass' },

  // Безопасность
  { id: 'pentest',     category: 'Безопасность', item: 'Pentest пройден (OWASP Top 10)',              status: 'warn', note: 'OWASP пройден частично, полный аудит Q2' },
  { id: 'waf',         category: 'Безопасность', item: 'WAF включён (защита от SQLi/XSS)',            status: 'pass' },
  { id: 'secrets',     category: 'Безопасность', item: 'Секреты в HashiCorp Vault (не в env)',       status: 'pass' },
  { id: 'tls',         category: 'Безопасность', item: 'TLS 1.3 everywhere, HSTS',                  status: 'pass' },
  { id: 'mfa',         category: 'Безопасность', item: 'MFA (TOTP / WebAuthn) для операторов',      status: 'pass' },
  { id: 'sso-check',   category: 'Безопасность', item: 'SSO SAML 2.0 + OIDC подключение',           status: 'pass' },

  // Качество кода
  { id: 'coverage',    category: 'Качество', item: 'Test coverage > 80%',                            status: 'warn', note: 'Текущий coverage 72%, цель 80% к prod' },
  { id: 'lint',        category: 'Качество', item: 'ESLint + TypeScript strict без ошибок',          status: 'pass' },
  { id: 'e2e',         category: 'Качество', item: 'E2E тесты критических путей (Playwright)',       status: 'warn', note: 'E2E для payment flow — в работе' },
  { id: 'load-test',   category: 'Качество', item: 'k6 load test: p95 < 500ms при 1500 VU',         status: 'pass' },

  // Мониторинг
  { id: 'prometheus',  category: 'Мониторинг', item: 'Prometheus + Grafana dashboards',              status: 'pass' },
  { id: 'loki',        category: 'Мониторинг', item: 'Loki централизованные логи',                   status: 'pass' },
  { id: 'alerts',      category: 'Мониторинг', item: 'Alertmanager: P1 → pagerduty, P2 → slack',    status: 'pass' },
  { id: 'slo-track',   category: 'Мониторинг', item: 'SLO трекинг: uptime 99.9%, error budget',    status: 'pass' },

  // Соответствие (Compliance)
  { id: 'fgis',        category: 'Compliance', item: 'ФГИС «Зерно» интеграция сертифицирована',      status: 'warn', note: 'Тестовая среда, prod-сертификат Q2' },
  { id: 'diadok',      category: 'Compliance', item: 'Диадок ЭДО (квалифицированный оператор)',     status: 'pass' },
  { id: 'ukep',        category: 'Compliance', item: 'УКЭП КриптоПро CSP (аккредитованный УЦ)',    status: 'pass' },
  { id: '152fz',       category: 'Compliance', item: '152-ФЗ: ПДн хранятся в РФ, DPA подписан',    status: 'pass' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function ProductionReadinessPanel() {
  const categories = Array.from(new Set(CHECKLIST.map(c => c.category)));
  const passCount = CHECKLIST.filter(c => c.status === 'pass').length;
  const warnCount = CHECKLIST.filter(c => c.status === 'warn').length;
  const failCount = CHECKLIST.filter(c => c.status === 'fail').length;
  const readinessPct = Math.round((passCount / CHECKLIST.length) * 100);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Всего пунктов', value: CHECKLIST.length, color: '#0F1419' },
          { label: 'Готово',        value: passCount,         color: '#065F46' },
          { label: 'Частично',      value: warnCount,         color: '#92400E' },
          { label: 'Не готово',     value: failCount,         color: failCount > 0 ? '#DC2626' : '#0A7A5F' },
          { label: 'Готовность',    value: `${readinessPct}%`, color: readinessPct >= 90 ? '#065F46' : readinessPct >= 70 ? '#92400E' : '#DC2626' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 10, borderRadius: 5, background: '#E4E6EA', overflow: 'hidden' }}>
          <div style={{ display: 'flex', height: '100%' }}>
            <div style={{ width: `${(passCount / CHECKLIST.length) * 100}%`, background: '#0A7A5F' }} />
            <div style={{ width: `${(warnCount / CHECKLIST.length) * 100}%`, background: '#D97706' }} />
            <div style={{ width: `${(failCount / CHECKLIST.length) * 100}%`, background: '#DC2626' }} />
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 900, color: '#0F1419', minWidth: 40 }}>{readinessPct}%</span>
      </div>

      {/* Checklist by category */}
      {categories.map((cat) => {
        const items = CHECKLIST.filter(c => c.category === cat);
        return (
          <div key={cat}>
            <div style={{ ...lbl, marginBottom: 6 }}>{cat}</div>
            <div style={{ display: 'grid', gap: 3 }}>
              {items.map((check) => {
                const cfg = STATUS_CONFIG[check.status];
                return (
                  <div key={check.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px', borderRadius: 8, background: cfg.bg + '40', border: `1px solid ${cfg.color}20` }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: cfg.color, minWidth: 12, marginTop: 1 }}>{cfg.icon}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419' }}>{check.item}</span>
                      {check.note && <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{check.note}</div>}
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Production Readiness Checklist · {passCount}/{CHECKLIST.length} пунктов готово · Статус: pilot-ready с сопровождением · Демо-данные.
      </div>
    </div>
  );
}
