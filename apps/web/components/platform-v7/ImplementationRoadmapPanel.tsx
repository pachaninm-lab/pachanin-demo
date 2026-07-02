'use client';

import { useState } from 'react';

type PhaseStatus = 'done' | 'in_progress' | 'planned';

interface RoadmapTask {
  label: string;
  done: boolean;
}

interface Phase {
  id: string;
  name: string;
  duration: string;
  team: string;
  status: PhaseStatus;
  tasks: RoadmapTask[];
  metrics: string;
}

const PHASES: Phase[] = [
  {
    id: 'p0', name: 'Этап 0: Инфраструктурный фундамент', duration: '6 недель', team: '2 DevOps + 1 Backend',
    status: 'in_progress',
    tasks: [
      { label: 'Миграция SQLite → PostgreSQL (RLS + индексы)', done: true },
      { label: 'Hash chain в AuditEvent и DealEvent (hash + prevHash)', done: true },
      { label: 'Kafka: 10 топиков RF=3 DLQ', done: true },
      { label: 'Redis Cluster (3M+3R) — сессии, rate limit', done: true },
      { label: 'Kubernetes: 3M+3W, HPA v2, VPA, PDB', done: true },
      { label: 'HashiCorp Vault 1.15: dynamic secrets, PKI, Transit', done: true },
      { label: 'WAF Coraza + OWASP CRS 4.0', done: false },
      { label: 'Monitoring: Prometheus + Grafana + Loki + Tempo', done: false },
    ],
    metrics: 'Production Readiness инфраструктуры 75%',
  },
  {
    id: 'p1', name: 'Этап 1: Durable Core', duration: '8 недель', team: '4 Backend + 2 Frontend + 1 QA',
    status: 'in_progress',
    tasks: [
      { label: 'Deal state machine + Saga Orchestrator (Kafka)', done: true },
      { label: 'Money: INTEGER kopecks, RESERVE→RELEASE→COMMISSION', done: true },
      { label: 'Escrow (номинальный счёт) — полный цикл', done: true },
      { label: 'УКЭП / КриптоПро DSS sandbox интеграция', done: true },
      { label: 'ЭДО адаптер (Диадок/Такском/СБИС)', done: true },
      { label: 'ФГИС «Зерно» Mock→Live адаптер', done: true },
      { label: 'Append-only audit trail с hash chain', done: true },
      { label: 'Evidence Bundle: SHA-256 + PDF/ZIP', done: true },
    ],
    metrics: 'E2E deal simulation проходит (21 шаг)',
  },
  {
    id: 'p2', name: 'Этап 2: Role Runtimes + Integrations', duration: '8 недель', team: '5 Backend + 3 Frontend + 2 QA',
    status: 'in_progress',
    tasks: [
      { label: '13 ролей: Farmer, Buyer, Driver, Elevator, Lab, Arbitrator, Compliance, Executive, Admin, Support, Logistician, Investor, Operator', done: true },
      { label: 'GPS + геозоны (ГЛОНАСС + Driver App + Яндекс)', done: true },
      { label: 'Ж/д логистика: ГУ-12, ГУ-29, ЭТРАН, демередж', done: true },
      { label: 'PWA offline: IndexedDB + Background Sync + conflict resolution', done: true },
      { label: 'B2B Partner API + Webhook HMAC Security', done: true },
      { label: 'KYC/AML + Fraud Detector + Counterparty Scoring', done: true },
      { label: 'Telegram Bot уведомления', done: true },
      { label: 'Bank Reconciliation (МТ940)', done: true },
    ],
    metrics: 'Все 13 cockpit-ов работают, load test 500 VU',
  },
  {
    id: 'p3', name: 'Этап 3: Scale + Export + ML', duration: '8 недель', team: '3 Backend + 2 ML + 2 Frontend + 1 QA',
    status: 'planned',
    tasks: [
      { label: 'ClickHouse Data Warehouse: deals_fact + GMV materialized view', done: false },
      { label: 'ML: Price Predictor, Yield Forecast, Deal Duration', done: false },
      { label: 'Airflow DAGs: Росстат + Минсельхоз + ФГИС отчёты', done: false },
      { label: 'Инкотермс: FOB/CIF/EXW автоматика, мультивалюта', done: false },
      { label: 'Кооперативы: multi-tenancy, общий пул заявок', done: false },
      { label: 'Unit Economics Passport: GMV, Take Rate, LTV, CAC', done: false },
      { label: 'k6 load test: baseline 500 → peak 1500 → stress 5000 VU', done: false },
      { label: 'Export: API SDK v2, Swagger/Redoc', done: false },
    ],
    metrics: 'GMV отчёт в реальном времени, p95 < 500 мс при 1000 VU',
  },
  {
    id: 'p4', name: 'Этап 4: Compliance + Hardening', duration: '6 недель', team: '2 Security + 1 Backend + 1 QA + 1 Legal',
    status: 'planned',
    tasks: [
      { label: '152-ФЗ полный аудит: согласия, реестр, уведомление РКН', done: false },
      { label: 'SAST + DAST + внешний pentest (чёрный ящик)', done: false },
      { label: 'WCAG 2.1 Level AA: автоматизированный + ручной аудит', done: false },
      { label: 'DR-тренировка: полное восстановление из бэкапа', done: false },
      { label: 'WebAuthn / FIDO2 для корпоративных пользователей', done: false },
      { label: 'SSO (SAML 2.0 / OIDC) для Enterprise', done: false },
      { label: 'OPA Policy Engine: сложные ABAC правила', done: false },
      { label: 'Security bug bounty программа запущена', done: false },
    ],
    metrics: 'Production Readiness Checklist закрыт на 100%',
  },
];

const STATUS_CFG: Record<PhaseStatus, { label: string; bg: string; color: string }> = {
  done:        { label: 'Закрыт',      bg: '#D1FAE5', color: '#065F46' },
  in_progress: { label: 'В работе',    bg: '#DBEAFE', color: '#1E40AF' },
  planned:     { label: 'Запланирован',bg: '#F1F5F9', color: '#64748B' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function ImplementationRoadmapPanel() {
  const [open, setOpen] = useState<string | null>('p0');

  const totalTasks = PHASES.flatMap(p => p.tasks);
  const doneTasks = totalTasks.filter(t => t.done);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Этапов',        value: PHASES.length,                                          color: '#0F1419' },
          { label: 'В работе',      value: PHASES.filter(p => p.status === 'in_progress').length,  color: '#1E40AF' },
          { label: 'Задач всего',   value: totalTasks.length,                                      color: '#374151' },
          { label: 'Выполнено',     value: `${doneTasks.length} (${Math.round(doneTasks.length / totalTasks.length * 100)}%)`, color: '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        §16 Роадмап · 5 этапов · ~9 месяцев · ~12 человек · Этап 0-2 в работе · Этап 3-4 запланированы
      </div>

      {/* Phases */}
      <div style={{ display: 'grid', gap: 8 }}>
        {PHASES.map((phase) => {
          const st = STATUS_CFG[phase.status];
          const phaseDone = phase.tasks.filter(t => t.done).length;
          const pct = Math.round(phaseDone / phase.tasks.length * 100);
          const isOpen = open === phase.id;

          return (
            <div key={phase.id} style={{ borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA', overflow: 'hidden' }}>
              <button
                onClick={() => setOpen(isOpen ? null : phase.id)}
                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#0F1419', flex: 1 }}>{phase.name}</span>
                <span style={{ fontSize: 9, color: '#64748B' }}>{phase.duration}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: pct === 100 ? '#065F46' : '#1E40AF' }}>{pct}%</span>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 12px 10px', display: 'grid', gap: 6 }}>
                  {/* Progress bar */}
                  <div style={{ height: 4, borderRadius: 2, background: '#E4E6EA', marginBottom: 4 }}>
                    <div style={{ height: '100%', borderRadius: 2, background: '#1E40AF', width: `${pct}%` }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#64748B', marginBottom: 4 }}>Команда: {phase.team}</div>
                  {phase.tasks.map((task, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 9 }}>
                      <span style={{ color: task.done ? '#065F46' : '#CBD5E1', flexShrink: 0, marginTop: 1, fontWeight: 900 }}>{task.done ? '✓' : '○'}</span>
                      <span style={{ color: task.done ? '#374151' : '#94A3B8' }}>{task.label}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 6, padding: '5px 8px', borderRadius: 6, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700 }}>
                    Метрика готовности: {phase.metrics}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
