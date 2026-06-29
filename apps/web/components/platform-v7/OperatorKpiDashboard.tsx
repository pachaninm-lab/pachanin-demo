'use client';

import { useEffect, useState } from 'react';

export interface OperatorKpi {
  id: string;
  label: string;
  value: string;
  delta?: string;
  deltaDir?: 'up' | 'down' | 'neutral';
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  unit?: string;
  description?: string;
}

const DEMO_KPIS: OperatorKpi[] = [
  { id: 'active_deals', label: 'Активных сделок', value: '14', delta: '+2', deltaDir: 'up', tone: 'info', description: 'Сделки в статусах SIGNED..PAID' },
  { id: 'stop_blockers', label: 'Стоп-блокеров', value: '3', delta: '-1', deltaDir: 'down', tone: 'danger', description: 'Блокеры с критическим влиянием на деньги' },
  { id: 'held_amount', label: 'Удержано по спорам', value: '15,89', unit: 'млн ₽', tone: 'warning', description: 'Эскроу-удержания ожидают арбитража' },
  { id: 'pending_docs', label: 'Документов ждут', value: '7', delta: '+1', deltaDir: 'up', tone: 'warning', description: 'УПД, ЭТрН, акты без подписи' },
  { id: 'active_shipments', label: 'Рейсов в пути', value: '5', tone: 'neutral', description: 'Активные транспортные рейсы' },
  { id: 'settled_today', label: 'Выплачено сегодня', value: '4,2', unit: 'млн ₽', delta: '+4,2', deltaDir: 'up', tone: 'success', description: 'Деньги выпущены из эскроу' },
  { id: 'mfa_pending', label: 'MFA-сессий активных', value: '23', tone: 'neutral', description: 'Пользователей с активными TOTP-сессиями' },
  { id: 'outbox_lag', label: 'Исходящих в очереди', value: '12', tone: 'neutral', description: 'Outbox-записей ожидают отправки' },
];

const TONE_STYLE: Record<OperatorKpi['tone'], { bg: string; border: string; accent: string }> = {
  success: { bg: 'rgba(5,150,105,0.06)', border: 'rgba(5,150,105,0.2)', accent: 'var(--status-active-text, #059669)' },
  warning: { bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.2)', accent: 'var(--status-warning-text, #D97706)' },
  danger:  { bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.2)', accent: 'var(--status-error-text, #DC2626)' },
  info:    { bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.2)', accent: '#2563EB' },
  neutral: { bg: 'var(--p7-color-surface-muted)', border: 'var(--p7-color-border)', accent: 'var(--pc-text-muted)' },
};

const DELTA_ICON = { up: '↑', down: '↓', neutral: '→' } as const;
const DELTA_COLOR = {
  up: { danger: 'var(--status-error-text)', success: 'var(--status-active-text)' },
  down: { danger: 'var(--status-active-text)', success: 'var(--status-error-text)' },
  neutral: { danger: 'var(--pc-text-muted)', success: 'var(--pc-text-muted)' },
};

interface KpiCardProps {
  kpi: OperatorKpi;
}

function KpiCard({ kpi }: KpiCardProps) {
  const s = TONE_STYLE[kpi.tone];
  const deltaDir = kpi.deltaDir ?? 'neutral';
  const deltaColorSet = kpi.tone === 'danger' ? DELTA_COLOR[deltaDir].danger : DELTA_COLOR[deltaDir].success;

  return (
    <div style={{
      padding: '0.875rem',
      borderRadius: '12px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      display: 'grid',
      gap: '0.25rem',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {kpi.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: s.accent, lineHeight: 1.1, fontFamily: 'var(--font-mono)' }}>
          {kpi.value}
        </span>
        {kpi.unit && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', fontWeight: 600 }}>{kpi.unit}</span>
        )}
        {kpi.delta && (
          <span style={{ fontSize: '10px', fontWeight: 700, color: deltaColorSet, marginLeft: '0.25rem' }}>
            {DELTA_ICON[deltaDir]} {kpi.delta}
          </span>
        )}
      </div>
      {kpi.description && (
        <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', lineHeight: 1.4, marginTop: '0.125rem' }}>
          {kpi.description}
        </div>
      )}
    </div>
  );
}

interface Props {
  kpis?: OperatorKpi[];
  refreshIntervalMs?: number;
  compact?: boolean;
}

export function OperatorKpiDashboard({ kpis = DEMO_KPIS, compact = false }: Props) {
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    const update = () => setLastUpdated(new Date().toLocaleTimeString('ru-RU'));
    update();
  }, []);

  const criticals = kpis.filter((k) => k.tone === 'danger');
  const warnings = kpis.filter((k) => k.tone === 'warning');

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {/* Summary strip */}
      {(criticals.length > 0 || warnings.length > 0) && (
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0.5rem 0.875rem', borderRadius: '8px',
          background: criticals.length > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(217,119,6,0.06)',
          border: `1px solid ${criticals.length > 0 ? 'rgba(220,38,38,0.2)' : 'rgba(217,119,6,0.2)'}`,
          flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <span style={{ fontSize: '0.875rem' }}>{criticals.length > 0 ? '🔴' : '🟡'}</span>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--pc-text-primary)', flex: 1 }}>
            {criticals.length > 0 ? `${criticals.length} критических` : ''}{criticals.length > 0 && warnings.length > 0 ? ' · ' : ''}{warnings.length > 0 ? `${warnings.length} предупреждений` : ''}
          </span>
          {lastUpdated && (
            <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)', flexShrink: 0 }}>
              Обновлено {lastUpdated}
            </span>
          )}
        </div>
      )}

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
        {kpis.map((kpi) => <KpiCard key={kpi.id} kpi={kpi} />)}
      </div>
    </div>
  );
}
