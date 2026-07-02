'use client';

import { useState } from 'react';

type DagStatus = 'success' | 'running' | 'failed' | 'paused' | 'queued';

interface DagRun {
  runId: string;
  startedAt: string;
  durationMin: number;
  status: DagStatus;
}

interface AirflowDag {
  id: string;
  dagId: string;
  description: string;
  schedule: string;
  owner: string;
  lastRun: DagRun;
  tags: string[];
  taskCount: number;
  slaMinutes: number;
}

const STATUS_CONFIG: Record<DagStatus, { label: string; bg: string; color: string; icon: string }> = {
  success: { label: 'Выполнен',   bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  running: { label: 'Выполняется', bg: '#DBEAFE', color: '#1E40AF', icon: '⟳' },
  failed:  { label: 'Ошибка',     bg: '#FEE2E2', color: '#991B1B', icon: '✗' },
  paused:  { label: 'Остановлен', bg: '#F1F5F9', color: '#64748B', icon: '‖' },
  queued:  { label: 'В очереди',  bg: '#FEF3C7', color: '#92400E', icon: '○' },
};

const DEMO_DAGS: AirflowDag[] = [
  {
    id: 'dag-001', dagId: 'grain_rosstat_weekly_report', description: 'Еженедельный отчёт в Росстат: объёмы торговли, средние цены, ТОП культуры',
    schedule: '0 8 * * 1', owner: 'analytics-team', tags: ['rosstat', 'regulatory', 'weekly'],
    lastRun: { runId: 'run_2024031801', startedAt: '2024-03-18T08:00:00Z', durationMin: 14, status: 'success' },
    taskCount: 7, slaMinutes: 30,
  },
  {
    id: 'dag-002', dagId: 'fgis_sdiz_sync_daily', description: 'Ежедневная синхронизация СДИЗ с ФГИС «Зерно»: статус, блокировки, аннуляции',
    schedule: '0 6 * * *', owner: 'integration-team', tags: ['fgis', 'sdiz', 'daily'],
    lastRun: { runId: 'run_2024032001', startedAt: '2024-03-20T06:00:00Z', durationMin: 8, status: 'success' },
    taskCount: 5, slaMinutes: 20,
  },
  {
    id: 'dag-003', dagId: 'gmv_analytics_hourly', description: 'Почасовой расчёт GMV, комиссий, конверсии по воронке сделок',
    schedule: '0 * * * *', owner: 'analytics-team', tags: ['analytics', 'gmv', 'hourly'],
    lastRun: { runId: 'run_2024032011', startedAt: '2024-03-20T11:00:00Z', durationMin: 3, status: 'running' },
    taskCount: 4, slaMinutes: 10,
  },
  {
    id: 'dag-004', dagId: 'edo_upd_reconcile_daily', description: 'Сверка УПД Диадок: статус отправки, подписи, ошибки ЭДО',
    schedule: '30 7 * * *', owner: 'integration-team', tags: ['edo', 'diadok', 'upd'],
    lastRun: { runId: 'run_2024032001', startedAt: '2024-03-20T07:30:00Z', durationMin: 6, status: 'success' },
    taskCount: 6, slaMinutes: 15,
  },
  {
    id: 'dag-005', dagId: 'ml_price_predictor_retrain', description: 'Еженедельная переобучение ML-модели прогноза цен по биржевым данным',
    schedule: '0 2 * * 0', owner: 'ml-team', tags: ['ml', 'prices', 'weekly'],
    lastRun: { runId: 'run_2024031701', startedAt: '2024-03-17T02:00:00Z', durationMin: 87, status: 'failed' },
    taskCount: 9, slaMinutes: 120,
  },
  {
    id: 'dag-006', dagId: 'bank_outbox_retry_monitor', description: 'Мониторинг и повторная отправка зависших outbox-записей банковских операций',
    schedule: '*/15 * * * *', owner: 'payments-team', tags: ['bank', 'outbox', 'monitoring'],
    lastRun: { runId: 'run_2024032011', startedAt: '2024-03-20T11:15:00Z', durationMin: 1, status: 'success' },
    taskCount: 3, slaMinutes: 5,
  },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function AirflowDagPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string>('all');

  const allTags = Array.from(new Set(DEMO_DAGS.flatMap(d => d.tags)));
  const visible = tagFilter === 'all' ? DEMO_DAGS : DEMO_DAGS.filter(d => d.tags.includes(tagFilter));

  const successCount = DEMO_DAGS.filter(d => d.lastRun.status === 'success').length;
  const failedCount = DEMO_DAGS.filter(d => d.lastRun.status === 'failed').length;
  const runningCount = DEMO_DAGS.filter(d => d.lastRun.status === 'running').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
        {[
          { label: 'DAG-ов',      value: DEMO_DAGS.length, color: '#0F1419' },
          { label: 'Success',     value: successCount,     color: '#065F46' },
          { label: 'Running',     value: runningCount,     color: '#1E40AF' },
          { label: 'Failed',      value: failedCount,      color: failedCount > 0 ? '#DC2626' : '#0A7A5F' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Airflow info */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: '#0A7A5F', fontWeight: 900, fontSize: 13 }}>✓</span>
        <div style={{ fontSize: 10, color: '#065F46', fontWeight: 700 }}>
          Apache Airflow 2.8 · Kubernetes Executor · DAG sync из GitOps · Celery workers: 4 · Хранение: PostgreSQL + S3 · Алерты: Slack + PagerDuty при SLA breach
        </div>
      </div>

      {/* Tag filter */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {['all', ...allTags].map((tag) => (
          <button key={tag} onClick={() => setTagFilter(tag)} style={{ padding: '3px 8px', borderRadius: 5, border: tagFilter === tag ? 'none' : '1px solid #E4E6EA', background: tagFilter === tag ? '#0F1419' : '#F8FAFB', color: tagFilter === tag ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {tag === 'all' ? 'Все DAG' : tag}
          </button>
        ))}
      </div>

      {/* DAG list */}
      <div style={{ display: 'grid', gap: 5 }}>
        {visible.map((dag) => {
          const cfg = STATUS_CONFIG[dag.lastRun.status];
          const isOpen = selected === dag.id;
          const slaOk = dag.lastRun.durationMin <= dag.slaMinutes;
          return (
            <div key={dag.id} style={{ borderRadius: 10, border: `1px solid ${isOpen ? '#0A7A5F' : dag.lastRun.status === 'failed' ? '#FECACA' : '#E4E6EA'}`, overflow: 'hidden' }}>
              <button onClick={() => setSelected(isOpen ? null : dag.id)} style={{ width: '100%', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', background: isOpen ? '#F0FDF4' : dag.lastRun.status === 'failed' ? '#FEF2F2' : '#F8FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: cfg.color, minWidth: 12 }}>{cfg.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419' }}>{dag.dagId}</code>
                    <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    {!slaOk && <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#FEE2E2', color: '#DC2626' }}>SLA breach</span>}
                  </div>
                  <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{dag.description}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: '#94A3B8' }}>{dag.lastRun.durationMin} мин</div>
                  <div style={{ fontSize: 8, color: '#CBD5E1', fontFamily: 'monospace' }}>{dag.schedule}</div>
                </div>
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '8px 12px', background: '#fff', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 6 }}>
                    {[
                      { label: 'Run ID',     value: dag.lastRun.runId },
                      { label: 'Owner',      value: dag.owner },
                      { label: 'Tasks',      value: dag.taskCount },
                      { label: 'SLA',        value: `${dag.slaMinutes} мин` },
                      { label: 'Длительность', value: `${dag.lastRun.durationMin} мин ${slaOk ? '✓' : '⚠ breach'}` },
                      { label: 'Расписание', value: dag.schedule },
                    ].map((s) => (
                      <div key={s.label}>
                        <div style={lbl}>{s.label}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', marginTop: 2, fontFamily: typeof s.value === 'string' && s.value.includes('*') ? 'monospace' : undefined }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {dag.lastRun.status === 'failed' && (
                    <div style={{ padding: '6px 10px', borderRadius: 6, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                      <div style={{ fontSize: 10, color: '#991B1B', fontWeight: 700 }}>Последний запуск завершился с ошибкой · Требуется ручная проверка логов</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#374151' }}>Логи</button>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#374151' }}>История запусков</button>
                    {dag.lastRun.status === 'failed' && (
                      <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #BBF7D0', background: '#F0FDF4', cursor: 'pointer', fontWeight: 700, color: '#065F46' }}>Запустить повторно</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Apache Airflow 2.8 · Kubernetes Executor · GitOps DAG sync · Регуляторные отчёты: Росстат · ФГИС «Зерно» · Диадок · ML ретрейнинг · Демо-данные.
      </div>
    </div>
  );
}
