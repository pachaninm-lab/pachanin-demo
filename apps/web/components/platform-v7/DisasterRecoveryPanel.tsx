'use client';

import { useState } from 'react';

type DrStatus = 'ready' | 'planned' | 'required';

interface DrScenario {
  scenario: string;
  rpo: string;
  rto: string;
  mechanism: string;
  validation: string;
  status: DrStatus;
}

interface BackupItem {
  name: string;
  storage: string;
  retention: string;
  verification: string;
  status: DrStatus;
}

const DR_SCENARIOS: DrScenario[] = [
  { scenario: 'Отказ одного runtime-инстанса', rpo: '0', rto: '< 30 сек', mechanism: 'health probe + auto-restart + graceful retry', validation: 'требует live health/readiness probes', status: 'planned' },
  { scenario: 'Отказ контейнерного хоста', rpo: '0', rto: '< 2 мин', mechanism: 'rescheduling + replica policy', validation: 'требует подтверждённого cluster failover test', status: 'required' },
  { scenario: 'Отказ зоны доступности', rpo: '< 1 мин', rto: '< 10 мин', mechanism: 'multi-zone deployment + replicated storage/event backbone', validation: 'требует выбранного провайдера и DR-тренировки', status: 'required' },
  { scenario: 'Полный отказ площадки', rpo: '< 5 мин', rto: '< 30 мин', mechanism: 'active-passive failover + traffic switch runbook', validation: 'не считать подтверждённым без промышленного упражнения', status: 'required' },
  { scenario: 'Потеря данных', rpo: '< 1 час', rto: '< 4 часа', mechanism: 'backup restore + WAL/event replay + integrity verification', validation: 'требует регулярного restore-test и evidence report', status: 'required' },
  { scenario: 'Сбой контура секретов', rpo: '0', rto: '< 15 мин', mechanism: 'secret-store recovery + planned key lifecycle', validation: 'требует secret-store, регламента и audit trail', status: 'required' },
];

const BACKUPS: BackupItem[] = [
  { name: 'Deals database', storage: 'encrypted object storage', retention: '30 дней', verification: 'restore-test + checksum + migration compatibility', status: 'planned' },
  { name: 'Audit / evidence database', storage: 'immutable storage tier', retention: '5 лет', verification: 'retention policy + access audit', status: 'required' },
  { name: 'Business analytics facts', storage: 'warehouse backup tier', retention: '1 год', verification: 'schema restore + row count reconciliation', status: 'planned' },
  { name: 'Event backbone snapshot', storage: 'event log backup tier', retention: '7–30 дней', verification: 'consumer replay + idempotency proof', status: 'required' },
  { name: 'Secret-store snapshot', storage: 'isolated encrypted backup', retention: '90 дней', verification: 'recovery drill under controlled access', status: 'required' },
  { name: 'Documents and evidence files', storage: 'cross-region encrypted object storage', retention: 'по юридическому регламенту', verification: 'hash-chain verification + access audit', status: 'required' },
];

const STATUS_CFG: Record<DrStatus, { label: string; bg: string; color: string; icon: string }> = {
  ready:    { label: 'Подготовлено', bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  planned:  { label: 'Запланировано', bg: '#FEF3C7', color: '#92400E', icon: '!' },
  required: { label: 'Требует подтверждения', bg: '#F5F3FF', color: '#5B21B6', icon: '○' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'scenarios' | 'backups' | 'runbook';

export function DisasterRecoveryPanel() {
  const [tab, setTab] = useState<Tab>('scenarios');

  const prepared = DR_SCENARIOS.filter(s => s.status === 'ready').length;
  const planned = DR_SCENARIOS.filter(s => s.status === 'planned').length;
  const required = DR_SCENARIOS.filter(s => s.status === 'required').length;
  const requiredBackups = BACKUPS.filter(b => b.status === 'required').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Сценариев', value: DR_SCENARIOS.length, color: '#0F1419' },
          { label: 'Подготовлено', value: prepared, color: '#065F46' },
          { label: 'Запланировано', value: planned, color: planned > 0 ? '#92400E' : '#065F46' },
          { label: 'Требует подтверждения', value: required, color: required > 0 ? '#5B21B6' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {required > 0 && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F5F3FF', border: '1px solid #DDD6FE', fontSize: 10, color: '#5B21B6', fontWeight: 700 }}>
          {required} DR-сценариев требуют промышленной тренировки и отчёта восстановления. RPO/RTO являются целевыми параметрами, не подтверждённым SLA.
        </div>
      )}

      <div style={{ display: 'flex', gap: 5 }}>
        {([['scenarios', 'DR Сценарии'], ['backups', 'Резервные копии'], ['runbook', 'Runbook']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'scenarios' && (
        <div style={{ display: 'grid', gap: 6 }}>
          {DR_SCENARIOS.map((s) => {
            const st = STATUS_CFG[s.status];
            return (
              <div key={s.scenario} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${s.status === 'required' ? '#DDD6FE' : s.status === 'planned' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0F1419', flex: 1 }}>{s.scenario}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 6, marginTop: 5, fontSize: 9, color: '#374151' }}>
                  <div><span style={lbl}>RPO target: </span><span style={{ fontWeight: 700 }}>{s.rpo}</span></div>
                  <div><span style={lbl}>RTO target: </span><span style={{ fontWeight: 700 }}>{s.rto}</span></div>
                  <div style={{ gridColumn: '1/-1' }}><span style={lbl}>Механизм: </span>{s.mechanism}</div>
                  <div style={{ gridColumn: '1/-1' }}><span style={lbl}>Валидация: </span>{s.validation}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'backups' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: '#5B21B6', fontWeight: 700 }}>Требуют подтверждения: {requiredBackups}/{BACKUPS.length}</span>
            <span style={{ fontSize: 10, color: '#64748B' }}>Restore-test должен фиксироваться отдельным отчётом и audit trail.</span>
          </div>
          {BACKUPS.map((b) => {
            const st = STATUS_CFG[b.status];
            return (
              <div key={b.name} style={{ padding: '7px 10px', borderRadius: 8, background: b.status === 'required' ? '#F5F3FF' : b.status === 'planned' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${b.status === 'required' ? '#DDD6FE' : b.status === 'planned' ? '#FDE68A' : '#E4E6EA'}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: st.color }}>{st.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{b.name}</span>
                <span style={{ fontSize: 9, color: '#64748B' }}>{b.storage}</span>
                <span style={{ fontSize: 8, color: '#94A3B8' }}>Retention: {b.retention}</span>
                <span style={{ fontSize: 9, color: '#64748B', flexBasis: '100%' }}>{b.verification}</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'runbook' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={lbl}>Runbook · целевой порядок действий при инциденте</div>
          {[
            { step: '1', title: 'Обнаружение', desc: 'Мониторинг создаёт инцидент; канал эскалации зависит от подключённого провайдера alerting.' },
            { step: '2', title: 'Оценка', desc: 'Определить масштаб: runtime, хост, зона, площадка, данные. Зафиксировать impact по сделкам и деньгам.' },
            { step: '3', title: 'Безопасная деградация', desc: 'Включить режим ограничения риска: остановить проблемный контур без потери audit trail и финансовых инвариантов.' },
            { step: '4', title: 'Восстановление', desc: 'Восстановить сервис, данные или интеграционный контур по утверждённому runbook; операции должны быть идемпотентны.' },
            { step: '5', title: 'Верификация', desc: 'Проверить health/readiness, outbox, audit trail, evidence chain, финансовые инварианты и критические пути сделки.' },
            { step: '6', title: 'Post-mortem', desc: 'Подготовить отчёт: таймлайн, root cause, affected deals, financial exposure, corrective actions.' },
          ].map((item) => (
            <div key={item.step} style={{ display: 'flex', gap: 10, padding: '7px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#0A7A5F', flexShrink: 0, minWidth: 18 }}>{item.step}.</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0F1419' }}>{item.title}</div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{item.desc}</div>
              </div>
            </div>
          ))}
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700 }}>
            DR-тренировка должна проводиться регулярно на изолированном стенде; успешность подтверждается restore-report, логами, контрольными суммами и smoke-тестами ядра сделки.
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Disaster recovery readiness · multi-zone, active-passive, encrypted backups, WAL/event replay, secret lifecycle и DR drill — целевые требования взрослой платформы; production proof требует отдельной промышленной тренировки.
      </div>
    </div>
  );
}
