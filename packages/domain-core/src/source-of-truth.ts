export type SourceOfTruthLevel = 'LIVE' | 'CANONICAL' | 'SANDBOX' | 'STUB' | 'FALLBACK';
export type RunMode = 'demo' | 'pilot' | 'live-safe';
export type ConnectorHealth = 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN';

const LIVE_SOURCES = ['postgres', 'bank', 'edo', 'fgis_zerno', 'gps', 'lab', 'smartagro', 'operator_override', 'esia', 'kep', 'connector_live'];
const CANONICAL_SOURCES = ['runtime_snapshot', 'canonical_api', 'canonical_view'];
const SANDBOX_SOURCES = ['sandbox_fixture', 'sandbox', 'demo_fixture'];
const FAIL_CLOSED_ACTIONS = [
  'release_payment',
  'apply_partial_release',
  'publish_settlement',
  'close_dispute',
  'payment.release',
  'payment.reserve',
  'override.apply',
  'payment.final_release',
  'payment.partial_release',
  'bank.release',
  'bank.refund',
  'receiving.accept',
  'lab.publish_final'
];

function normalizeText(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function normalizeConnectorHealth(value?: string | null): ConnectorHealth {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized in { GREEN: 1, AMBER: 1, RED: 1, UNKNOWN: 1 }) return normalized as ConnectorHealth;
  return 'UNKNOWN';
}

export function normalizeRunMode(value?: string | null): RunMode {
  const normalized = normalizeText(value);
  return normalized === 'live-safe' || normalized === 'pilot' ? normalized : 'demo';
}

export function classifySourceOfTruth(value?: string | null): SourceOfTruthLevel {
  const normalized = normalizeText(value);
  if (LIVE_SOURCES.includes(normalized)) return 'LIVE';
  if (CANONICAL_SOURCES.includes(normalized)) return 'CANONICAL';
  if (SANDBOX_SOURCES.includes(normalized)) return 'SANDBOX';
  if (!normalized || normalized.includes('fallback')) return 'FALLBACK';
  return 'STUB';
}

function minutesSince(value?: string | number | Date | null) {
  if (!value) return null;
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.round((Date.now() - at) / 60000));
}

export function sourceOfTruthMatrix(input: {
  runMode?: string | null;
  sourceOfTruth?: string | null;
  providerMode?: string | null;
  connectorHealth?: string | null;
  lastSyncAt?: string | null;
  requiredFreshnessMinutes?: number | null;
}) {
  const runMode = normalizeRunMode(input.runMode);
  const source = classifySourceOfTruth(input.sourceOfTruth || input.providerMode);
  const providerMode = String(input.providerMode || '').trim().toUpperCase();
  const connectorHealth = normalizeConnectorHealth(input.connectorHealth);
  const freshnessMinutes = minutesSince(input.lastSyncAt);
  const staleThreshold = Number(input.requiredFreshnessMinutes || 30);
  const stale = freshnessMinutes !== null && freshnessMinutes > staleThreshold;
  const degraded = ['SANDBOX', 'STUB', 'FALLBACK'].includes(source) || providerMode === 'SANDBOX' || connectorHealth === 'RED' || stale;
  const failClosed = runMode !== 'demo' && degraded;
  const trustScore = source === 'LIVE'
    ? connectorHealth === 'GREEN'
      ? stale ? 72 : 100
      : connectorHealth === 'AMBER'
        ? 64
        : 42
    : source === 'CANONICAL'
      ? stale ? 58 : 70
      : source === 'SANDBOX'
        ? 28
        : source === 'STUB'
          ? 18
          : 8;
  return {
    runMode,
    sourceOfTruth: source,
    connectorHealth,
    freshnessMinutes,
    stale,
    degraded,
    failClosed,
    trustScore,
    severity: failClosed ? 'CRITICAL' : degraded ? 'WARNING' : 'INFO',
    uiLabel: failClosed ? 'MANUAL_REVIEW_REQUIRED' : degraded ? 'DEGRADED' : 'LIVE_READY'
  };
}

export function buildTruthBarState(input: {
  runMode?: string | null;
  sourceOfTruth?: string | null;
  providerMode?: string | null;
  connectorHealth?: string | null;
  lastSyncAt?: string | null;
  requiredFreshnessMinutes?: number | null;
  offlineReady?: boolean | null;
  objectLabel?: string | null;
}) {
  const matrix = sourceOfTruthMatrix(input);
  const objectLabel = String(input.objectLabel || 'object');
  const messages: string[] = [];
  if (matrix.failClosed) messages.push(`${objectLabel}: критичные действия заблокированы до live truth.`);
  if (matrix.stale) messages.push(`Данные устарели${matrix.freshnessMinutes !== null ? ` на ${matrix.freshnessMinutes} мин.` : '.'}`);
  if (matrix.connectorHealth === 'RED') messages.push('Коннектор в красном состоянии.');
  if (input.offlineReady) messages.push('Локальный сбор фактов разрешён, но деньги и юридически значимые действия — fail-closed.');
  return {
    ...matrix,
    offlineReady: Boolean(input.offlineReady),
    label: `${matrix.sourceOfTruth} / ${matrix.connectorHealth}`,
    detail: messages.join(' ') || 'Источник и свежесть позволяют использовать данные как рабочий truth-layer.',
    chips: [
      `source ${matrix.sourceOfTruth}`,
      `mode ${matrix.runMode}`,
      `health ${matrix.connectorHealth}`,
      matrix.freshnessMinutes !== null ? `freshness ${matrix.freshnessMinutes}m` : 'freshness —',
      `trust ${matrix.trustScore}`
    ]
  };
}

export function buildConnectorDegradationSummary(connectors: Array<Record<string, any>> = [], runMode?: string | null) {
  const rows = connectors.map((item) => {
    const state = sourceOfTruthMatrix({
      runMode,
      sourceOfTruth: item?.sourceOfTruth || item?.mode || item?.providerMode,
      providerMode: item?.providerMode || item?.mode,
      connectorHealth: item?.health || item?.status,
      lastSyncAt: item?.lastSyncAt,
      requiredFreshnessMinutes: item?.requiredFreshnessMinutes
    });
    return {
      id: item?.id || item?.key || item?.name || 'connector',
      system: item?.system || item?.provider || item?.name || 'connector',
      ...state
    };
  });
  const critical = rows.filter((item) => item.failClosed).length;
  const degraded = rows.filter((item) => item.degraded).length;
  return {
    rows,
    summary: {
      total: rows.length,
      degraded,
      critical,
      green: rows.filter((item) => !item.degraded).length,
      gate: critical ? 'FAIL_CLOSED' : degraded ? 'DEGRADED' : 'GREEN'
    }
  };
}

export function shouldFailClosedAction(input: {
  action?: string | null;
  runMode?: string | null;
  sourceOfTruth?: string | null;
  providerMode?: string | null;
  connectorHealth?: string | null;
  lastSyncAt?: string | null;
  requiredFreshnessMinutes?: number | null;
}) {
  const matrix = sourceOfTruthMatrix(input);
  const action = normalizeText(input.action);
  const critical = FAIL_CLOSED_ACTIONS.includes(action);
  return {
    ...matrix,
    action,
    critical,
    blocked: matrix.failClosed && critical,
    reasonCode: matrix.failClosed && critical ? (matrix.stale ? 'source_of_truth_stale' : 'source_of_truth_not_live') : null
  };
}

export function summarizeSourceOfTruth(objects: any[] = [], runMode?: string | null) {
  const summary = { LIVE: 0, CANONICAL: 0, SANDBOX: 0, STUB: 0, FALLBACK: 0 } as Record<SourceOfTruthLevel, number>;
  let degraded = 0;
  let failClosed = 0;
  for (const item of objects) {
    const matrix = sourceOfTruthMatrix({
      runMode,
      sourceOfTruth: item?.sourceOfTruth || item?.providerMode || item?.meta?.source,
      providerMode: item?.providerMode,
      connectorHealth: item?.health || item?.status,
      lastSyncAt: item?.lastSyncAt,
      requiredFreshnessMinutes: item?.requiredFreshnessMinutes
    });
    summary[matrix.sourceOfTruth] += 1;
    if (matrix.degraded) degraded += 1;
    if (matrix.failClosed) failClosed += 1;
  }
  const matrix = sourceOfTruthMatrix({
    runMode,
    sourceOfTruth: summary.LIVE > 0 ? 'postgres' : summary.CANONICAL > 0 ? 'runtime_snapshot' : summary.SANDBOX > 0 ? 'sandbox_fixture' : 'fallback'
  });
  return { counts: summary, degraded, failClosed: failClosed > 0 || matrix.failClosed, gate: failClosed > 0 ? 'FAIL_CLOSED' : degraded > 0 ? 'DEGRADED' : matrix.uiLabel };
}
