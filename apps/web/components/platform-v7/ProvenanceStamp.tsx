import { formatDateMsk } from '@/lib/utils/formatDate';

export interface ProvenanceStampProps {
  entityId: string;
  action: string;
  actor: string;
  timestamp?: Date | string;
  dealId?: string;
}

export function ProvenanceStamp({ entityId, action, actor, timestamp, dealId }: ProvenanceStampProps) {
  const ts = timestamp ? new Date(timestamp) : new Date();
  const formatted = formatDateMsk(ts, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      data-provenance
      data-entity={entityId}
      data-deal={dealId}
      style={shell}
      aria-label={`Изменение: ${action} — ${actor} — ${formatted}`}
    >
      <span style={chainIcon} aria-hidden>⊕</span>
      <span style={content}>
        <span style={entity}>{entityId}</span>
        {dealId && <span style={sep}>·</span>}
        {dealId && <span style={dealRef}>{dealId}</span>}
        <span style={sep}>·</span>
        <span style={actionLabel}>{action}</span>
        <span style={sep}>·</span>
        <span style={actorLabel}>{actor}</span>
        <span style={sep}>·</span>
        <time dateTime={ts.toISOString()} style={timeLabel}>{formatted}</time>
      </span>
    </div>
  );
}

const shell = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 12px',
  borderRadius: 8,
  background: 'var(--pc-bg-subtle, rgba(10,122,95,0.04))',
  border: '1px solid var(--pc-accent-border, rgba(10,122,95,0.14))',
  fontSize: 11,
} as const;

const chainIcon = {
  color: 'var(--pc-accent, #0A7A5F)',
  flexShrink: 0,
  lineHeight: 1,
} as const;

const content = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  alignItems: 'baseline',
  gap: 4,
  lineHeight: 1.3,
} as const;

const entity = {
  fontFamily: 'JetBrains Mono, monospace',
  fontWeight: 800,
  color: 'var(--pc-accent, #0A7A5F)',
  fontSize: 11,
} as const;

const sep = {
  color: 'var(--pc-text-muted)',
} as const;

const dealRef = {
  fontFamily: 'JetBrains Mono, monospace',
  color: 'var(--pc-text-muted)',
  fontSize: 11,
} as const;

const actionLabel = {
  color: 'var(--pc-text-secondary)',
  fontWeight: 700,
} as const;

const actorLabel = {
  color: 'var(--pc-text-primary)',
  fontWeight: 800,
} as const;

const timeLabel = {
  color: 'var(--pc-text-muted)',
  fontVariantNumeric: 'tabular-nums',
} as const;
