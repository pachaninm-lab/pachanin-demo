'use client';

import { useState } from 'react';

type DagStatus = 'ready' | 'planned' | 'external';

interface OrchestrationPlan {
  id: string;
  dagId: string;
  description: string;
  cadence: string;
  owner: string;
  status: DagStatus;
  tags: string[];
  taskCount: string;
  acceptance: string;
}

const STATUS_CONFIG: Record<DagStatus, { label: string; bg: string; color: string; icon: string }> = {
  ready: { label: 'Автономно готово', bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  planned: { label: 'План orchestration', bg: '#DBEAFE', color: '#1E40AF', icon: '◌' },
  external: { label: 'Нужно внешнее подключение', bg: '#FEF3C7', color: '#92400E', icon: '!' },
};

const ORCHESTRATION_PLANS: OrchestrationPlan[] = [
  {
    id: 'dag-001',
    dagId: 'deal_daily_control_report',
    description: 'Ежедневная сверка активных сделок, блокеров, просрочек и next action для операционного контура.',
    cadence: 'ежедневно',
    owner: 'operations',
    status: 'planned',
    tags: ['deals', 'ops', 'daily'],
    taskCount: '5-7 задач',
    acceptance: 'отчёт должен строиться из фактических сделок и журнала событий',
  },
  {
    id: 'dag-002',
    dagId: 'fgis_sdiz_readiness_sync',
    description: 'Целевой контур сверки СДИЗ и статусов ФГИС после получения боевых доступов.',
    cadence: 'по регламенту интеграции',
    owner: 'integrations',
    status: 'external',
    tags: ['fgis', 'sdiz', 'external'],
    taskCount: 'зависит от API',
    acceptance: 'не считать работающим до доступов, регламента и подтверждённых операций',
  },
  {
    id: 'dag-003',
    dagId: 'gmv_unit_economics_report',
    description: 'Расчёт GMV, take rate, revenue, contribution margin и отклонений по сделкам.',
    cadence: 'ежедневно / еженедельно',
    owner: 'finance',
    status: 'planned',
    tags: ['finance', 'gmv', 'analytics'],
    taskCount: '4-6 задач',
    acceptance: 'показатели считаются только по подтверждённым событиям сделки',
  },
  {
    id: 'dag-004',
    dagId: 'edo_document_reconciliation',
    description: 'Целевая сверка статусов электронных документов и подписания после подключения ЭДО и КЭП.',
    cadence: 'по регламенту ЭДО',
    owner: 'documents',
    status: 'external',
    tags: ['edo', 'documents', 'external'],
    taskCount: 'зависит от провайдера',
    acceptance: 'не считать работающим без договоров, сертификатов и проверенного процесса',
  },
  {
    id: 'dag-005',
    dagId: 'price_analytics_refresh',
    description: 'Обновление ценовой аналитики и сценарных прогнозов без заявления биржевой или банковской гарантии.',
    cadence: 'еженедельно',
    owner: 'analytics',
    status: 'planned',
    tags: ['prices', 'analytics'],
    taskCount: '3-5 задач',
    acceptance: 'прогнозы должны иметь источник данных и дисклеймер сценарности',
  },
  {
    id: 'dag-006',
    dagId: 'bank_reconciliation_readiness',
    description: 'Целевая сверка банковских событий, outbox и оснований для release после подключения банковского контура.',
    cadence: 'по банковому регламенту',
    owner: 'finance-ops',
    status: 'external',
    tags: ['bank', 'money', 'external'],
    taskCount: 'зависит от банка',
    acceptance: 'не считать подключённым без договора, callback, reconciliation и отчёта сверки',
  },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function AirflowDagPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string>('all');

  const allTags = Array.from(new Set(ORCHESTRATION_PLANS.flatMap(d => d.tags)));
  const visible = tagFilter === 'all' ? ORCHESTRATION_PLANS : ORCHESTRATION_PLANS.filter(d => d.tags.includes(tagFilter));
  const readyCount = ORCHESTRATION_PLANS.filter(d => d.status === 'ready').length;
  const plannedCount = ORCHESTRATION_PLANS.filter(d => d.status === 'planned').length;
  const externalCount = ORCHESTRATION_PLANS.filter(d => d.status === 'external').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
        {[
          { label: 'Процессов', value: ORCHESTRATION_PLANS.length, color: '#0F1419' },
          { label: 'Ready', value: readyCount, color: '#065F46' },
          { label: 'Planned', value: plannedCount, color: '#1E40AF' },
          { label: 'External', value: externalCount, color: externalCount > 0 ? '#92400E' : '#0A7A5F' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: '#1E40AF', fontWeight: 900, fontSize: 13 }}>i</span>
        <div style={{ fontSize: 10, color: '#1E40AF', fontWeight: 700 }}>
          Orchestration readiness · процессы описаны как целевой операционный контур. Фактические DAG-run, логи, retry и SLA не заявляются без подключённого orchestration runtime.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {['all', ...allTags].map((tag) => (
          <button key={tag} onClick={() => setTagFilter(tag)} style={{ padding: '3px 8px', borderRadius: 5, border: tagFilter === tag ? 'none' : '1px solid #E4E6EA', background: tagFilter === tag ? '#0F1419' : '#F8FAFB', color: tagFilter === tag ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {tag === 'all' ? 'Все процессы' : tag}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 5 }}>
        {visible.map((dag) => {
          const cfg = STATUS_CONFIG[dag.status];
          const isOpen = selected === dag.id;
          return (
            <div key={dag.id} style={{ borderRadius: 10, border: `1px solid ${isOpen ? '#0A7A5F' : dag.status === 'external' ? '#FDE68A' : '#E4E6EA'}`, overflow: 'hidden' }}>
              <button onClick={() => setSelected(isOpen ? null : dag.id)} style={{ width: '100%', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', background: isOpen ? '#F0FDF4' : dag.status === 'external' ? '#FFFBEB' : '#F8FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: cfg.color, minWidth: 12 }}>{cfg.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419' }}>{dag.dagId}</code>
                    <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{dag.description}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: '#94A3B8' }}>{dag.cadence}</div>
                  <div style={{ fontSize: 8, color: '#CBD5E1' }}>{dag.owner}</div>
                </div>
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '8px 12px', background: '#fff', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 6 }}>
                    {[
                      { label: 'Owner', value: dag.owner },
                      { label: 'Cadence', value: dag.cadence },
                      { label: 'Tasks', value: dag.taskCount },
                      { label: 'Acceptance', value: dag.acceptance },
                    ].map((s) => (
                      <div key={s.label}>
                        <div style={lbl}>{s.label}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', marginTop: 2 }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#374151' }}>Runbook</button>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#374151' }}>Acceptance</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Orchestration readiness · отчёты, сверки, аналитика и интеграционные процессы проектируются вокруг сделки; фактические запуски появляются только после runtime-подключения.
      </div>
    </div>
  );
}
