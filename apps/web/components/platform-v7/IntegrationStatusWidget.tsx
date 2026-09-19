'use client';

export type ApiStatus = 'online' | 'degraded' | 'offline' | 'unknown';

export interface IntegrationStatusItem {
  id: string;
  name: string;
  shortName: string;
  status: ApiStatus;
  latencyMs?: number;
  isDemo?: boolean;
  note?: string;
}

const STATUS_COLOR: Record<ApiStatus, string> = {
  online:   'var(--status-active-text)',
  degraded: 'var(--status-warning-text)',
  offline:  'var(--status-error-text)',
  unknown:  'var(--status-draft-text)',
};

const STATUS_LABEL: Record<ApiStatus, string> = {
  online:   'Работает',
  degraded: 'Нагрузка',
  offline:  'Недоступен',
  unknown:  'Неизвестно',
};

const STATUS_DOT: Record<ApiStatus, string> = {
  online:   '●',
  degraded: '◐',
  offline:  '○',
  unknown:  '·',
};

export const DEMO_INTEGRATIONS: IntegrationStatusItem[] = [
  { id: 'fgis',    name: 'ФГИС «Зерно»',         shortName: 'ФГИС',    status: 'online',   latencyMs: 245,  isDemo: true },
  { id: 'fns',     name: 'ФНС ЕГРЮЛ',             shortName: 'ФНС',     status: 'online',   latencyMs: 312,  isDemo: true },
  { id: 'diadok',  name: 'Диадок ЭДО',            shortName: 'Диадок',  status: 'online',   latencyMs: 188,  isDemo: true },
  { id: 'sber',    name: 'СберБизнес API',         shortName: 'Сбер',    status: 'degraded', latencyMs: 1820, isDemo: true, note: 'Повышенная латентность' },
  { id: 'rshb',    name: 'РСХБ API',               shortName: 'РСХБ',    status: 'online',   latencyMs: 441,  isDemo: true },
  { id: 'gis_epd', name: 'ГИС ЭПД',               shortName: 'ГИС ЭПД', status: 'online',   latencyMs: 290,  isDemo: true },
  { id: 'cryptopro', name: 'КриптоПро DSS',        shortName: 'УКЭП',    status: 'online',   latencyMs: 155,  isDemo: true },
  { id: 'spark',   name: 'СПАРК / Контур.Фокус',  shortName: 'СПАРК',   status: 'online',   latencyMs: 520,  isDemo: true },
  { id: 'smev',    name: 'СМЭВ',                   shortName: 'СМЭВ',    status: 'online',   latencyMs: 890,  isDemo: true },
  { id: 'rzd',     name: 'РЖД ЭТРАН',              shortName: 'ЭТРАН',   status: 'offline',               isDemo: true, note: 'Техработы' },
];

interface Props {
  items?: IntegrationStatusItem[];
  compact?: boolean;
}

export function IntegrationStatusWidget({ items = DEMO_INTEGRATIONS, compact = false }: Props) {
  const online = items.filter((i) => i.status === 'online').length;
  const total = items.length;

  if (compact) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', marginRight: '0.25rem' }}>
          API {online}/{total}
        </span>
        {items.map((item) => (
          <span
            key={item.id}
            title={`${item.name}: ${STATUS_LABEL[item.status]}${item.latencyMs ? ` · ${item.latencyMs}мс` : ''}${item.isDemo ? ' [демо]' : ''}${item.note ? ` · ${item.note}` : ''}`}
            style={{
              fontSize: '10px', fontWeight: 600,
              color: STATUS_COLOR[item.status],
              padding: '1px 5px', borderRadius: '4px',
              background: `${STATUS_COLOR[item.status]}18`,
              border: `1px solid ${STATUS_COLOR[item.status]}33`,
              cursor: 'default',
            }}
          >
            {STATUS_DOT[item.status]} {item.shortName}
            {item.isDemo && <span style={{ opacity: 0.6 }}> demo</span>}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span className="caption">Статус интеграций</span>
        <span style={{ fontSize: 'var(--text-xs)', color: online === total ? 'var(--status-active-text)' : 'var(--status-warning-text)', fontWeight: 600 }}>
          {online}/{total} онлайн
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.375rem' }}>
        {items.map((item) => (
          <div
            key={item.id}
            data-demo={item.isDemo ? 'true' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.625rem', borderRadius: '8px',
              background: 'var(--p7-color-surface-muted)',
              border: `1px solid ${STATUS_COLOR[item.status]}22`,
            }}
          >
            <span style={{ color: STATUS_COLOR[item.status], fontSize: '0.875rem' }}>
              {STATUS_DOT[item.status]}
            </span>
            <span style={{ flex: 1, fontSize: 'var(--text-xs)', color: 'var(--pc-text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </span>
            <span style={{ fontSize: '10px', color: STATUS_COLOR[item.status], fontWeight: 600, flexShrink: 0 }}>
              {item.latencyMs ? `${item.latencyMs}мс` : STATUS_LABEL[item.status]}
            </span>
            {item.isDemo && (
              <span style={{ fontSize: '9px', color: 'var(--pc-text-muted)', background: 'var(--p7-color-surface-strong)', padding: '1px 4px', borderRadius: '3px', flexShrink: 0 }}>
                demo
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
