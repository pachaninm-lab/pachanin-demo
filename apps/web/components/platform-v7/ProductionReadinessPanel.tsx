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
  { id: 'k8s',         category: 'Инфраструктура', item: 'Kubernetes cluster: целевая схема промышленного развёртывания', status: 'warn', note: 'Требует подтверждённого live-cluster и эксплуатационного регламента' },
  { id: 'ha',          category: 'Инфраструктура', item: 'High Availability: целевая модель отказоустойчивости сервисов', status: 'warn', note: 'Нужны нагрузочные прогоны и подтверждённая схема резервирования' },
  { id: 'dr',          category: 'Инфраструктура', item: 'DR план: RPO/RTO как целевые эксплуатационные параметры', status: 'warn', note: 'Требуется промышленная DR-тренировка' },
  { id: 'cdn',         category: 'Инфраструктура', item: 'CDN для статических ассетов: контур подключения', status: 'warn', note: 'Статус зависит от закреплённого deploy/CDN-провайдера' },
  { id: 'pg-replica',  category: 'Инфраструктура', item: 'PostgreSQL replica: миграционный и масштабируемый контур', status: 'warn', note: 'Не выдавать за подтверждённую live-репликацию без промышленной БД' },
  { id: 'redis-ha',    category: 'Инфраструктура', item: 'Redis/Sentinel: целевая модель кэша и блокировок', status: 'warn', note: 'Нужна проверка отказов, TTL и конкурентного доступа' },

  // Безопасность
  { id: 'pentest',     category: 'Безопасность', item: 'OWASP Top 10 / pentest: план независимой проверки', status: 'warn', note: 'Полный внешний аудит не считать пройденным без отчёта' },
  { id: 'waf',         category: 'Безопасность', item: 'WAF: целевой контур защиты от SQLi/XSS', status: 'warn', note: 'Требует выбранного провайдера и правил блокировки' },
  { id: 'secrets',     category: 'Безопасность', item: 'Secrets management: целевой Vault/secret-store контур', status: 'warn', note: 'Не считать HashiCorp Vault подключённым без live-секретов и ротации' },
  { id: 'tls',         category: 'Безопасность', item: 'TLS/HSTS: обязательный контур транспортной защиты', status: 'warn', note: 'Проверять на фактическом домене и deploy-контуре' },
  { id: 'mfa',         category: 'Безопасность', item: 'MFA для операторов: обязательное production-требование', status: 'warn', note: 'Требуется серверная политика, recovery flow и audit trail' },
  { id: 'sso-check',   category: 'Безопасность', item: 'SSO SAML/OIDC: adapter-ready контур', status: 'warn', note: 'Не считать подключённым без IdP, договоров и боевой конфигурации' },

  // Качество кода
  { id: 'coverage',    category: 'Качество', item: 'Test coverage: целевой порог для промышленной эксплуатации', status: 'warn', note: 'Фиксировать фактическое покрытие только из CI-отчёта' },
  { id: 'lint',        category: 'Качество', item: 'ESLint + TypeScript strict: обязательный quality gate', status: 'warn', note: 'Статус должен подтверждаться текущим CI' },
  { id: 'e2e',         category: 'Качество', item: 'E2E тесты критических путей сделки', status: 'warn', note: 'Цена → аукцион → сделка → логистика → приёмка → документы → деньги → спор' },
  { id: 'load-test',   category: 'Качество', item: 'k6/load testing: план проверки тысяч пользователей', status: 'warn', note: 'Не считать пройденным без сохранённого отчёта и профиля нагрузки' },

  // Мониторинг
  { id: 'prometheus',  category: 'Мониторинг', item: 'Prometheus/Grafana: целевой observability-контур', status: 'warn', note: 'Требует промышленного окружения, алертов и retention-политики' },
  { id: 'loki',        category: 'Мониторинг', item: 'Централизованные логи: целевой контур трассировки инцидентов', status: 'warn', note: 'Нужны correlation id, retention и доступы по ролям' },
  { id: 'alerts',      category: 'Мониторинг', item: 'Alerting: P1/P2 маршрутизация и дежурства', status: 'warn', note: 'Не считать включённым без проверенных каналов эскалации' },
  { id: 'slo-track',   category: 'Мониторинг', item: 'SLO/error budget: целевые метрики эксплуатации', status: 'warn', note: 'Без подтверждённого SLA и исторических метрик не писать uptime как факт' },

  // Соответствие (Compliance)
  { id: 'fgis',        category: 'Compliance', item: 'ФГИС «Зерно»: adapter-ready контур', status: 'warn', note: 'Не считать подключённой без боевых доступов и подтверждённых операций' },
  { id: 'diadok',      category: 'Compliance', item: 'ЭДО/Диадок: adapter-ready документный контур', status: 'warn', note: 'Не считать подключённым без договора, ключей и live-документооборота' },
  { id: 'ukep',        category: 'Compliance', item: 'КЭП/УКЭП: контур юридически значимого подписания', status: 'warn', note: 'Требует аккредитованного УЦ, сертификатов и проверенного signing-flow' },
  { id: '152fz',       category: 'Compliance', item: '152-ФЗ: требования к хранению и обработке ПДн', status: 'warn', note: 'Факт соответствия подтверждается документами, политиками и аудитом' },
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
        Production Readiness Checklist · {warnCount}/{CHECKLIST.length} пунктов требуют внешнего подтверждения · Статус: зрелый автономный контур без подтверждённых внешних live-интеграций.
      </div>
    </div>
  );
}
