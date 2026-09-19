'use client';

export type VerificationSource =
  | 'FGIS_ZERNO'
  | 'FNS'
  | 'SPARK'
  | 'AML'
  | 'EGRUL'
  | 'UKEP'
  | 'RSHN'
  | 'MANUAL';

export type VerificationLevel = 'VERIFIED' | 'PARTIAL' | 'PENDING' | 'FAILED';

export interface Verification {
  source: VerificationSource;
  level: VerificationLevel;
  verifiedAt?: string;
  note?: string;
}

const SOURCE_LABEL: Record<VerificationSource, string> = {
  FGIS_ZERNO: 'ФГИС «Зерно»',
  FNS:        'ФНС',
  SPARK:      'СПАРК',
  AML:        'AML',
  EGRUL:      'ЕГРЮЛ',
  UKEP:       'УКЭП',
  RSHN:       'РСХН',
  MANUAL:     'Вручную',
};

const LEVEL_COLOR: Record<VerificationLevel, string> = {
  VERIFIED: 'var(--status-active-text)',
  PARTIAL:  'var(--status-pending-text)',
  PENDING:  'var(--status-draft-text)',
  FAILED:   'var(--status-error-text)',
};

const LEVEL_BG: Record<VerificationLevel, string> = {
  VERIFIED: 'var(--status-active-bg)',
  PARTIAL:  'var(--status-pending-bg)',
  PENDING:  'var(--status-draft-bg)',
  FAILED:   'var(--status-error-bg)',
};

const LEVEL_ICON: Record<VerificationLevel, string> = {
  VERIFIED: '✓',
  PARTIAL:  '~',
  PENDING:  '⏳',
  FAILED:   '✗',
};

interface VerificationBadgeProps {
  verification: Verification;
  size?: 'sm' | 'md';
}

export function VerificationBadge({ verification, size = 'sm' }: VerificationBadgeProps) {
  const color = LEVEL_COLOR[verification.level];
  const bg = LEVEL_BG[verification.level];
  const icon = LEVEL_ICON[verification.level];
  const label = SOURCE_LABEL[verification.source];
  const fontSize = size === 'sm' ? '10px' : 'var(--text-xs)';

  return (
    <span
      title={verification.note ?? `${label}: ${verification.level}${verification.verifiedAt ? ` · ${new Date(verification.verifiedAt).toLocaleDateString('ru-RU')}` : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
        padding: size === 'sm' ? '1px 6px' : '2px 8px',
        borderRadius: '9999px',
        background: bg,
        color,
        fontSize,
        fontWeight: 600,
        border: `1px solid ${color}33`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{icon}</span>
      {label}
    </span>
  );
}

interface VerificationSetProps {
  verifications: Verification[];
  maxVisible?: number;
}

export function VerificationSet({ verifications, maxVisible = 4 }: VerificationSetProps) {
  const visible = verifications.slice(0, maxVisible);
  const rest = verifications.length - maxVisible;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
      {visible.map((v) => (
        <VerificationBadge key={v.source} verification={v} />
      ))}
      {rest > 0 && (
        <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)', padding: '1px 6px' }}>
          +{rest}
        </span>
      )}
    </div>
  );
}

// ── Counterparty Trust Card ───────────────────────────────────────────────────

export interface CounterpartyTrust {
  orgId: string;
  inn: string;
  name: string;
  verifications: Verification[];
  riskScore?: number; // 0–100
  dealCount?: number;
  rating?: number; // 1–5
}

export function CounterpartyTrustCard({ trust }: { trust: CounterpartyTrust }) {
  const allVerified = trust.verifications.every((v) => v.level === 'VERIFIED');
  const hasFailure = trust.verifications.some((v) => v.level === 'FAILED');
  const overallColor = hasFailure ? 'var(--status-error-text)' : allVerified ? 'var(--status-active-text)' : 'var(--status-pending-text)';

  return (
    <div style={{
      background: 'var(--p7-color-surface, #0E1A18)',
      border: `1px solid ${overallColor}33`,
      borderRadius: '12px',
      padding: '0.875rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--pc-text-primary)' }}>
            {trust.name}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', fontFamily: 'var(--font-mono)' }}>
            ИНН {trust.inn}
          </div>
        </div>
        {trust.riskScore !== undefined && (
          <span style={{
            fontSize: '10px', fontWeight: 700,
            color: trust.riskScore < 30 ? 'var(--risk-low-text)' : trust.riskScore < 60 ? 'var(--risk-medium-text)' : 'var(--risk-critical-text)',
            background: trust.riskScore < 30 ? 'var(--risk-low-bg)' : trust.riskScore < 60 ? 'var(--risk-medium-bg)' : 'var(--risk-critical-bg)',
            padding: '2px 6px', borderRadius: '9999px',
          }}>
            риск {trust.riskScore}
          </span>
        )}
      </div>

      <VerificationSet verifications={trust.verifications} maxVisible={4} />

      {(trust.dealCount !== undefined || trust.rating !== undefined) && (
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)' }}>
          {trust.dealCount !== undefined && <span>{trust.dealCount} сделок</span>}
          {trust.rating !== undefined && <span>★ {trust.rating.toFixed(1)}</span>}
        </div>
      )}
    </div>
  );
}
