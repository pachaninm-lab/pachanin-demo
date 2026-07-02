'use client';

import { useState } from 'react';

type ItemStatus = 'done' | 'in_progress' | 'blocked' | 'pending';

interface CriteriaItem {
  id: string;
  label: string;
  status: ItemStatus;
  note?: string;
}

interface CriteriaGroup {
  id: string;
  title: string;
  items: CriteriaItem[];
}

const GROUPS: CriteriaGroup[] = [
  {
    id: 'infra', title: 'Инфраструктура',
    items: [
      { id: 'i1', label: 'PostgreSQL с RLS, read-replicas, daily WAL backup',       status: 'in_progress', note: 'Dual-write активен, шаги 6-8 в работе' },
      { id: 'i2', label: 'Kafka: все топики, RF=3, DLQ настроен',                   status: 'done' },
      { id: 'i3', label: 'Kubernetes: HPA + VPA + PDB на всех сервисах',            status: 'done' },
      { id: 'i4', label: 'Vault: все секреты, dynamic credentials, ротация',        status: 'done' },
      { id: 'i5', label: 'WAF: Coraza + CRS в production',                          status: 'in_progress', note: 'Конфигурация завершается' },
    ],
  },
  {
    id: 'security', title: 'Безопасность',
    items: [
      { id: 's1', label: 'MFA работает для всех пользователей (TOTP + SMS)',        status: 'done' },
      { id: 's2', label: 'УКЭП: подписание через КриптоПро DSS (sandbox)',          status: 'done' },
      { id: 's3', label: 'SAST: 0 Critical/Blocker в SonarQube',                    status: 'done' },
      { id: 's4', label: 'Container scan: 0 High+ CVE в production образах',        status: 'done' },
      { id: 's5', label: 'Pentest: внешний аудит пройден, Critical закрыты',        status: 'blocked', note: 'Требует привлечения внешнего аудитора' },
      { id: 's6', label: '152-ФЗ: уведомление в РКН подано, ДПО назначен',         status: 'blocked', note: 'Юридическая задача — не код' },
      { id: 's7', label: 'WebAuthn / FIDO2 корпоративных пользователей',            status: 'done' },
      { id: 's8', label: 'SSO (SAML 2.0 / OIDC) для Enterprise',                   status: 'done' },
    ],
  },
  {
    id: 'functional', title: 'Функциональность',
    items: [
      { id: 'f1', label: 'E2E deal simulation проходит автоматически (21 шаг)',     status: 'done' },
      { id: 'f2', label: 'Все 13 ролей имеют working cockpit',                      status: 'done' },
      { id: 'f3', label: 'Append-only audit trail с hash chain работает',           status: 'done' },
      { id: 'f4', label: 'Debit = Credit баланс для всех завершённых сделок',       status: 'done' },
      { id: 'f5', label: 'Минимум 3 live интеграции (ФГИС + ЭДО + GPS)',           status: 'in_progress', note: 'Sandbox-режим. Live требует договоров' },
      { id: 'f6', label: 'Evidence Bundle: SHA-256 hash chain + PDF/ZIP',           status: 'done' },
      { id: 'f7', label: 'Saga Orchestrator: idempotency + DLQ + retry',           status: 'done' },
    ],
  },
  {
    id: 'quality', title: 'Качество',
    items: [
      { id: 'q1', label: 'Unit test coverage ≥ 85% (87.4%)',                        status: 'done' },
      { id: 'q2', label: 'E2E критичные сценарии: 100% pass (8/8)',                 status: 'done' },
      { id: 'q3', label: 'Load test: p95 < 500 мс при 1000 concurrent users',      status: 'done', note: 'Демо: 312 мс p95' },
      { id: 'q4', label: 'Core Web Vitals: LCP < 2.5с, CLS < 0.1',                 status: 'done' },
      { id: 'q5', label: 'WCAG 2.1 AA: автоматизированный аудит без Critical',     status: 'pending', note: 'Запланирован в Этапе 4' },
      { id: 'q6', label: 'DataExposureGuard: 0 leaks в всех компонентах',          status: 'done' },
    ],
  },
  {
    id: 'observability', title: 'Наблюдаемость',
    items: [
      { id: 'o1', label: 'Все сервисы: /health, /ready, /metrics работают',        status: 'done' },
      { id: 'o2', label: 'Grafana: дашборды для бизнес-метрик и инфраструктуры',   status: 'done' },
      { id: 'o3', label: 'Alerting: P1 алерты → PagerDuty < 5 мин',               status: 'done' },
      { id: 'o4', label: 'Трейсинг: распределённые трейсы в Tempo',                status: 'in_progress' },
      { id: 'o5', label: 'Synthetic monitoring: critical paths каждые 5 мин',      status: 'done' },
    ],
  },
  {
    id: 'docs', title: 'Документация',
    items: [
      { id: 'd1', label: 'OpenAPI spec актуален (auto-generated)',                  status: 'done' },
      { id: 'd2', label: 'Runbooks для P1/P2 сценариев написаны',                  status: 'in_progress' },
      { id: 'd3', label: 'ADR документируют архитектурные решения',                status: 'in_progress' },
      { id: 'd4', label: 'Readiness Passport (live / sandbox / план)',              status: 'done' },
    ],
  },
  {
    id: 'legal', title: 'Юридическое',
    items: [
      { id: 'l1', label: 'Договор с банком (escrow/номинальный счёт)',              status: 'blocked', note: 'CFO + юрист' },
      { id: 'l2', label: 'Договор с Контур.Диадок (ЭДО)',                          status: 'blocked', note: 'BD' },
      { id: 'l3', label: 'Соглашение с КриптоПро DSS (УКЭП)',                      status: 'blocked', note: 'BD' },
      { id: 'l4', label: 'Доступ к API ФГИС «Зерно» (Минсельхоз)',                status: 'blocked', note: 'Юрист + BD' },
      { id: 'l5', label: 'Пользовательское соглашение и оферта утверждены',        status: 'pending', note: 'Юрист' },
      { id: 'l6', label: '5-10 пилотных организаций подтверждены',                 status: 'pending', note: 'BD' },
    ],
  },
];

const STATUS_CFG: Record<ItemStatus, { label: string; bg: string; color: string; icon: string }> = {
  done:        { label: 'Готово',    bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  in_progress: { label: 'В работе', bg: '#DBEAFE', color: '#1E40AF', icon: '◌' },
  blocked:     { label: 'Блокер',   bg: '#FEE2E2', color: '#DC2626', icon: '✗' },
  pending:     { label: 'Ожидает',  bg: '#F1F5F9', color: '#64748B', icon: '○' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function AcceptanceCriteriaPanel() {
  const [openGroup, setOpenGroup] = useState<string | null>('functional');

  const allItems = GROUPS.flatMap(g => g.items);
  const done = allItems.filter(i => i.status === 'done').length;
  const blocked = allItems.filter(i => i.status === 'blocked').length;
  const pct = Math.round(done / allItems.length * 100);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Критериев',  value: allItems.length,  color: '#0F1419' },
          { label: 'Готово',     value: `${done} (${pct}%)`, color: '#065F46' },
          { label: 'Блокеров',   value: blocked,          color: blocked > 0 ? '#DC2626' : '#065F46' },
          { label: 'Групп',      value: GROUPS.length,    color: '#1E40AF' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <div style={{ fontSize: 9, color: '#1E40AF', fontWeight: 700, marginBottom: 6 }}>§17 Готовность к production: Strong Controlled-Pilot / Pre-Federal</div>
        <div style={{ height: 8, borderRadius: 4, background: '#DBEAFE', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #1E40AF, #0EA5E9)', width: `${pct}%`, transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: 9, color: '#1E40AF', fontWeight: 700, marginTop: 4 }}>{pct}% — {done}/{allItems.length} критериев</div>
      </div>

      {/* Groups */}
      <div style={{ display: 'grid', gap: 8 }}>
        {GROUPS.map((group) => {
          const groupDone = group.items.filter(i => i.status === 'done').length;
          const groupBlocked = group.items.filter(i => i.status === 'blocked').length;
          const isOpen = openGroup === group.id;

          return (
            <div key={group.id} style={{ borderRadius: 10, border: `1px solid ${groupBlocked > 0 ? '#FECACA' : '#E4E6EA'}`, background: groupBlocked > 0 ? '#FEF2F2' : '#F8FAFB', overflow: 'hidden' }}>
              <button
                onClick={() => setOpenGroup(isOpen ? null : group.id)}
                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: '#0F1419', flex: 1 }}>{group.title}</span>
                <span style={{ fontSize: 9, color: '#065F46', fontWeight: 700 }}>{groupDone}/{group.items.length}</span>
                {groupBlocked > 0 && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: '#FEE2E2', color: '#DC2626', fontWeight: 800 }}>{groupBlocked} блокер{groupBlocked > 1 ? 'а' : ''}</span>}
                <span style={{ fontSize: 10, color: '#94A3B8' }}>{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 12px 10px', display: 'grid', gap: 5 }}>
                  {group.items.map((item) => {
                    const st = STATUS_CFG[item.status];
                    return (
                      <div key={item.id} style={{ padding: '6px 8px', borderRadius: 7, background: item.status === 'blocked' ? '#FEF2F2' : '#fff', border: `1px solid ${item.status === 'blocked' ? '#FECACA' : '#E4E6EA'}` }}>
                        <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: st.bg, color: st.color, flexShrink: 0, marginTop: 1 }}>{st.icon}</span>
                          <span style={{ fontSize: 9, color: '#374151', flex: 1 }}>{item.label}</span>
                        </div>
                        {item.note && <div style={{ fontSize: 8, color: '#94A3B8', marginTop: 2, paddingLeft: 22 }}>{item.note}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#ECFDF5', border: '1px solid #A7F3D0', fontSize: 9, color: '#065F46', fontWeight: 700, lineHeight: 1.7 }}>
        Статус: Strong Controlled-Pilot / Pre-Federal · Технические критерии {pct}% · Блокеры — договорные (не код) · Готово к пилоту с 10-50 организациями
      </div>
    </div>
  );
}
