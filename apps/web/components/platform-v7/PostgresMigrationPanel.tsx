'use client';

import { useState } from 'react';

type StepStatus = 'done' | 'in_progress' | 'pending';

interface MigrationStep {
  num: number;
  label: string;
  detail: string;
  status: StepStatus;
}

interface PgConfig {
  param: string;
  value: string;
  note: string;
}

interface IndexEntry {
  table: string;
  column: string;
  type: string;
  reason: string;
}

const STEPS: MigrationStep[] = [
  { num: 1, label: 'Новые Prisma-схемы для PostgreSQL',         detail: 'UUID, JSONB, TIMESTAMPTZ, BIGINT kopecks. Удалены SQLite-специфичные типы.',               status: 'done' },
  { num: 2, label: 'hash + prevHash в AuditEvent и DealEvent',  detail: 'append-only hash chain: SHA-256(prevHash + payload). Иммутабельный аудит-трейл.',            status: 'done' },
  { num: 3, label: 'Row-Level Security (RLS)',                   detail: 'tenant_id + organization_id RLS policies. Изоляция данных на уровне СУБД.',                  status: 'done' },
  { num: 4, label: 'Индексы B-tree и GIN',                      detail: 'B-tree по FK и статусным полям. GIN по JSONB-полям (metadata, payload).',                   status: 'done' },
  { num: 5, label: 'Flyway миграционные скрипты',               detail: 'V1__initial.sql → V12__ledger_invariants.sql. 12 версий, чистый state.',                   status: 'done' },
  { num: 6, label: '1 master + 2 read-replicas',                detail: 'Streaming replication, synchronous_commit=on для финансовых таблиц.',                      status: 'in_progress' },
  { num: 7, label: 'Dual-write (SQLite + PostgreSQL)',           detail: 'Переходный период: запись в обе БД параллельно. Feature flag: PG_PRIMARY=false.',          status: 'in_progress' },
  { num: 8, label: 'Верификация данных и переключение',         detail: 'Checksum всех таблиц. PG_PRIMARY=true. SQLite отключён.',                                  status: 'pending' },
];

const PG_CONFIG: PgConfig[] = [
  { param: 'max_connections',          value: '200',                     note: 'PgBouncer pooler перед БД' },
  { param: 'shared_buffers',           value: '4 GB',                    note: '25% RAM для кэша' },
  { param: 'effective_cache_size',     value: '12 GB',                   note: 'оценка для планировщика' },
  { param: 'work_mem',                 value: '64 MB',                   note: 'сортировки и hash join' },
  { param: 'wal_level',                value: 'replica',                 note: 'streaming replication' },
  { param: 'synchronous_commit',       value: 'on (финансовые таблицы)', note: 'гарантия записи до ack' },
  { param: 'default_transaction_isolation', value: 'serializable',       note: 'money invariants' },
  { param: 'log_min_duration_statement',    value: '500 мс',             note: 'slow query log' },
];

const INDEXES: IndexEntry[] = [
  { table: 'deal',         column: 'seller_org_id, status',   type: 'B-tree composite',  reason: 'Farmer cockpit: мои сделки по статусу' },
  { table: 'deal',         column: 'buyer_org_id, status',    type: 'B-tree composite',  reason: 'Buyer cockpit: мои покупки' },
  { table: 'ledger_entry', column: 'deal_id, created_at',     type: 'B-tree composite',  reason: 'Финансовый трейл по сделке' },
  { table: 'audit_event',  column: 'deal_id, created_at',     type: 'B-tree composite',  reason: 'Аудит-лог по сделке' },
  { table: 'audit_event',  column: 'metadata',                type: 'GIN (JSONB)',        reason: 'Полнотекстовый поиск по полям' },
  { table: 'outbox_entry', column: 'status, created_at',      type: 'B-tree composite',  reason: 'Outbox worker: pending записи' },
  { table: 'shipment',     column: 'deal_id',                 type: 'B-tree',            reason: 'Логистика по сделке' },
  { table: 'lab_sample',   column: 'deal_id, status',         type: 'B-tree composite',  reason: 'Lab cockpit: ожидающие протоколы' },
];

const STATUS_CFG: Record<StepStatus, { label: string; bg: string; color: string; icon: string }> = {
  done:        { label: 'Готово',      bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  in_progress: { label: 'В работе',   bg: '#DBEAFE', color: '#1E40AF', icon: '◌' },
  pending:     { label: 'Ожидает',    bg: '#F1F5F9', color: '#64748B', icon: '○' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'migration' | 'config' | 'indexes';

export function PostgresMigrationPanel() {
  const [tab, setTab] = useState<Tab>('migration');

  const done = STEPS.filter(s => s.status === 'done').length;
  const inProgress = STEPS.filter(s => s.status === 'in_progress').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Шагов',      value: STEPS.length,   color: '#0F1419' },
          { label: 'Готово',     value: done,            color: '#065F46' },
          { label: 'В работе',   value: inProgress,      color: '#1E40AF' },
          { label: 'Индексов',   value: INDEXES.length,  color: '#0F1419' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FEF3C7', border: '1px solid #FDE68A', fontSize: 9, color: '#92400E', fontWeight: 700, lineHeight: 1.6 }}>
        §4.1 БЛОКЕР: SQLite → PostgreSQL 16 · RLS + Read Replicas · SERIALIZABLE для денег · Dual-write на период перехода · Шаги 1-5 выполнены · Шаги 6-8 в работе
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['migration', 'Миграция'], ['config', 'Конфигурация'], ['indexes', 'Индексы']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'migration' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>8 шагов миграции SQLite → PostgreSQL 16</div>
          {STEPS.map((step) => {
            const st = STATUS_CFG[step.status];
            return (
              <div key={step.num} style={{ padding: '8px 12px', borderRadius: 10, background: step.status === 'in_progress' ? '#EFF6FF' : '#F8FAFB', border: `1px solid ${step.status === 'in_progress' ? '#BFDBFE' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#94A3B8', width: 20, flexShrink: 0 }}>{step.num}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{step.label}</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2, paddingLeft: 28 }}>{step.detail}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'config' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>PostgreSQL 16 — production конфигурация</div>
          {PG_CONFIG.map((c) => (
            <div key={c.param} style={{ display: 'flex', gap: 8, padding: '6px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', flexWrap: 'wrap' }}>
              <code style={{ fontSize: 9, fontWeight: 700, color: '#0F1419', width: 220, flexShrink: 0 }}>{c.param}</code>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#1E40AF', width: 140, flexShrink: 0 }}>{c.value}</span>
              <span style={{ fontSize: 9, color: '#64748B' }}>{c.note}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'indexes' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>{INDEXES.length} индексов для production нагрузки</div>
          {INDEXES.map((idx, i) => (
            <div key={i} style={{ padding: '7px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{ fontSize: 9, fontWeight: 700, color: '#1E40AF' }}>{idx.table}</code>
                <span style={{ fontSize: 9, color: '#374151', flex: 1 }}>({idx.column})</span>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: '#EFF6FF', color: '#1E40AF' }}>{idx.type}</span>
              </div>
              <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{idx.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
